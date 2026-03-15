"""
app/utils/scheduler.py — BackgroundBrain

Two independent automation jobs run inside FastAPI's event loop:

JOB 1 — Morning Check-in (MorningCheckinJob)
  State machine per patient per day:
    UNSENT → SENT(1) → SENT(2) → SENT(3) → ESCALATED_TO_FAMILY
  • Sends initial check-in at CHECKIN_HOUR (default 8 AM)
  • Waits ESCALATION_WINDOW_MINUTES before each re-send (default 120 min)
  • Detects patient response by scanning chat_history for a patient
    message after the last nurse check-in timestamp
  • After MAX_ATTEMPTS with no response → SMS to family contact, stop messaging patient

JOB 2 — Task Reminder (TaskReminderJob)
  • Checks every POLL_INTERVAL_SECONDS (60s) for tasks due ±TASK_WINDOW_MINUTES (2 min)
  • Sends a chat message + SMS to patient for each pending task
  • Idempotency: tracks reminders_sent_today (list of task IDs) in MongoDB
    so no duplicate sends within the same day
  • Resets reminders_sent_today at midnight

Both jobs are safe to run even if Twilio is not configured (degrade gracefully).
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List

from app.utils.twilio_helper import TwilioManager

# ── Tuneable constants ─────────────────────────────────────────────────────────
POLL_INTERVAL_SECONDS    = 60    # How often the main loop wakes up
CHECKIN_HOUR             = 8     # 24h hour to send morning check-in (8 = 8 AM)
CHECKIN_MINUTE           = 0     # Minute within that hour (0 = :00, 30 = :30)
CHECKIN_MINUTE_WINDOW    = 5     # Send check-in if now is within this many minutes of CHECKIN_HOUR:CHECKIN_MINUTE
ESCALATION_WINDOW_MINUTES = 120  # Minutes to wait before re-sending if no response
MAX_ATTEMPTS             = 3     # Max check-ins before escalating to family
TASK_WINDOW_MINUTES      = 2     # ±minutes around task time to trigger reminder


class BackgroundBrain:
    """
    Async background engine that runs all patient automation jobs.
    Instantiated once at startup and runs forever inside FastAPI's event loop.
    """

    def __init__(self, db: Any, agent_registry: Dict[str, Any]) -> None:
        self.db            = db
        self.agent_registry = agent_registry
        self.patients_col  = db["patients"]
        self.chats_col     = db["chat_history"]
        self.twilio        = TwilioManager()

    # Main loop

    async def start(self) -> None:
        print("[Scheduler] ✅  BackgroundBrain started.")
        while True:
            try:
                now             = datetime.now()
                active_patients = self._get_active_patients()

                for patient in active_patients:
                    await self._run_morning_checkin(patient, now)
                    await self._run_task_reminders(patient, now)

            except Exception as e:
                print(f"[Scheduler] ❌  Loop error: {e}")

            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    # Helpers

    def _get_active_patients(self) -> List[Dict[str, Any]]:
        return list(
            self.patients_col.find({"status": "Active", "monitoring_active": True})
        )

    def _log_chat(self, patient_id: str, content: str, risk: int = 0, action: str = "LOG") -> None:
        """Insert a nurse message into chat_history."""
        self.chats_col.insert_one({
            "patient_id": patient_id,
            "role":       "nurse",
            "content":    content,
            "risk_score": risk,
            "action":     action,
            "timestamp":  datetime.now(),
            "automated":  True,         
        })

    def _send_sms(self, phone: str, message: str, patient_id: str = "") -> None:
        """Send SMS, log errors gracefully."""
        if not phone:
            return
        try:
            result = self.twilio.send_sms(phone, message)
            print(f"[Scheduler] 📱  SMS → {phone}: {result}")
        except Exception as e:
            print(f"[Scheduler] ⚠️  SMS failed for {patient_id}: {e}")

    def _patient_responded_after(self, patient_id: str, since: datetime) -> bool:
        """
        Returns True if the patient sent any chat message after `since`.
        This is how we detect whether the patient responded to a check-in.
        """
        if not since:
            return False
        return bool(
            self.chats_col.find_one({
                "patient_id": patient_id,
                "role":       "patient",
                "timestamp":  {"$gt": since},
            })
        )

    # JOB 1 — Morning Check-in State Machine

    async def _run_morning_checkin(self, patient: Dict[str, Any], now: datetime) -> None:
        """
        State machine transitions for the daily morning check-in.
        Called once per patient per poll cycle.
        """
        patient_id = patient["patient_id"]
        today      = now.date().isoformat()
        state      = patient.get("checkin_state", {})

        first_name  = patient.get("name", "Patient").split()[0]
        # Use demo override numbers if set (for hackathon presentation)
        phone       = patient.get("phone_override") or patient.get("phone", "")
        fam_phone   = patient.get("family_override") or patient.get("family_contact", "")
        fam_name    = patient.get("family_name", "family member")

        # ── RESET: New day — clear yesterday's state ──────────────────────────
        if state.get("date", "") != today:
            self.patients_col.update_one(
                {"patient_id": patient_id},
                {"$set": {
                    "checkin_state": {
                        "date":         today,
                        "attempt":      0,
                        "last_sent_at": None,
                        "responded":    False,
                        "escalated":    False,
                    }
                }}
            )
            state = {"date": today, "attempt": 0, "last_sent_at": None,
                     "responded": False, "escalated": False}

        if state.get("escalated", False):
            return

        # ── RESPONSE CHECK: Did patient reply since last check-in? ────────────
        last_sent_raw = state.get("last_sent_at")
        if last_sent_raw and not state.get("responded", False):
            last_sent = (
                last_sent_raw if isinstance(last_sent_raw, datetime)
                else datetime.fromisoformat(str(last_sent_raw))
            )
            if self._patient_responded_after(patient_id, last_sent):
                self.patients_col.update_one(
                    {"patient_id": patient_id},
                    {"$set": {"checkin_state.responded": True}}
                )
                print(f"[Scheduler] ✅  {patient_id} responded to check-in.")
                return   # Patient is active — no further escalation needed

        if state.get("responded", False):
            return

        attempt = state.get("attempt", 0)

        # ── FIRST SEND: It's check-in hour and we haven't sent today ──────────
        if attempt == 0:
            if now.hour != CHECKIN_HOUR or now.minute < CHECKIN_MINUTE or now.minute > CHECKIN_MINUTE + CHECKIN_MINUTE_WINDOW:
                return   # Not time yet
            await self._send_checkin(patient_id, first_name, phone, attempt=1)
            return

        # ── RE-SEND: Enough time has passed and patient hasn't responded ───────
        last_sent = (
            last_sent_raw if isinstance(last_sent_raw, datetime)
            else datetime.fromisoformat(str(last_sent_raw))
        ) if last_sent_raw else None

        if not last_sent:
            return

        minutes_since = (now - last_sent).total_seconds() / 60
        if minutes_since < ESCALATION_WINDOW_MINUTES:
            return   # Still within the wait window

        if attempt < MAX_ATTEMPTS:
            await self._send_checkin(patient_id, first_name, phone, attempt=attempt + 1)
            return

        # ── ESCALATE: MAX_ATTEMPTS reached with no response ───────────────────
        await self._escalate_to_family(
            patient_id, first_name, fam_name, fam_phone, phone
        )


    async def _send_checkin(
        self, patient_id: str, name: str, phone: str, attempt: int
    ) -> None:
        """Send one morning check-in message and update state."""

        messages = [
            (
                f"🌅 Good morning, {name}! I'm your AI Recovery Nurse. "
                f"How are you feeling today? Please reply to let me know — "
                f"any pain, discomfort, or concerns?"
            ),
            (
                f"👋 Hi {name}, just following up on my earlier message. "
                f"I haven't heard from you yet — please reply to confirm you're okay. "
                f"If you need help, type 'HELP' or call your care team."
            ),
            (
                f"⚠️ {name}, this is my third attempt to reach you today. "
                f"I'm concerned about your wellbeing. Please respond immediately. "
                f"If you're unable to respond, please call emergency services or "
                f"ask someone nearby to help you."
            ),
        ]

        msg = messages[min(attempt - 1, 2)]

        # Log to chat dashboard
        self._log_chat(patient_id, f"[MORNING CHECK-IN #{attempt}] {msg}", risk=0)

        # SMS to patient
        self._send_sms(phone, f"[AgenticNurse] {msg}", patient_id)

        # Persist state
        self.patients_col.update_one(
            {"patient_id": patient_id},
            {"$set": {
                "checkin_state.attempt":     attempt,
                "checkin_state.last_sent_at": datetime.now(),
                "checkin_state.responded":   False,
            }}
        )
        print(f"[Scheduler] 🌅  Check-in #{attempt} sent to {patient_id}")


    async def _escalate_to_family(
        self,
        patient_id: str,
        patient_name: str,
        fam_name: str,
        fam_phone: str,
        patient_phone: str,
    ) -> None:
        """
        Called when patient has not responded after MAX_ATTEMPTS.
        1. Notifies family via SMS (if contact exists)
        2. Logs alert to doctor dashboard
        3. Stops further patient messages
        """

        print(f"[Scheduler] 🚨  Escalating {patient_id} to family.")

        # 1. SMS to family member
        if fam_phone:
            family_msg = (
                f"[AgenticNurse ALERT] Hello {fam_name}, "
                f"we have been unable to reach {patient_name} for their morning check-in "
                f"after {MAX_ATTEMPTS} attempts today. "
                f"Please check on them as soon as possible. "
                f"If this is an emergency, call 112 immediately."
            )
            self._send_sms(fam_phone, family_msg, patient_id)
        else:
            print(f"[Scheduler] ⚠️  No family contact for {patient_id} — skipping family SMS.")

        # 2. Log high-risk alert to chat (visible on Doctor dashboard)
        alert_msg = (
            f"🚨 ESCALATION ALERT: {patient_name} has not responded to "
            f"{MAX_ATTEMPTS} morning check-in attempts. "
            f"{'Family member notified via SMS.' if fam_phone else 'No family contact on file.'} "
            f"Immediate follow-up required."
        )
        self._log_chat(patient_id, alert_msg, risk=9, action="ALERT")

        # 3. Mark as escalated in MongoDB — stops further patient messages
        self.patients_col.update_one(
            {"patient_id": patient_id},
            {"$set": {
                "checkin_state.escalated": True,
                "status": "Critical",
            }}
        )

    # JOB 2 — Task Reminders

    async def _run_task_reminders(self, patient: Dict[str, Any], now: datetime) -> None:
        """
        For each pending task whose scheduled time is within ±TASK_WINDOW_MINUTES
        of the current time, send a chat + SMS reminder.

        Idempotency: task IDs are recorded in reminders_sent_today (MongoDB).
        The list is reset daily via reminders_reset_date.
        """
        patient_id = patient["patient_id"]
        today      = now.date().isoformat()
        phone      = patient.get("phone_override") or patient.get("phone", "")
        first_name = patient.get("name", "Patient").split()[0]

        # ── Reset sent-list at the start of each new day ──────────────────────
        if patient.get("reminders_reset_date", "") != today:
            self.patients_col.update_one(
                {"patient_id": patient_id},
                {"$set": {
                    "reminders_sent_today": [],
                    "reminders_reset_date": today,
                }}
            )
            patient["reminders_sent_today"] = []
            patient["reminders_reset_date"] = today

        sent_today = set(patient.get("reminders_sent_today", []))

        for task in patient.get("daily_routine", []):
            task_id   = task.get("id", "")
            completed = task.get("completed", False)

            # Skip already-done or already-reminded tasks
            if completed or task_id in sent_today:
                continue

            # Parse task time
            try:
                task_time = datetime.strptime(
                    f"{now.date()} {task.get('time', '00:00 AM')}",
                    "%Y-%m-%d %I:%M %p"
                )
            except ValueError:
                continue

            # Check if task is within the ±window
            delta_minutes = abs((now - task_time).total_seconds() / 60)
            if delta_minutes > TASK_WINDOW_MINUTES:
                continue

            # Send reminder
            await self._send_task_reminder(
                patient_id, first_name, phone, task
            )

            # Record as sent so we don't send again today
            self.patients_col.update_one(
                {"patient_id": patient_id},
                {"$push": {"reminders_sent_today": task_id}}
            )
            sent_today.add(task_id)


    async def _send_task_reminder(
        self,
        patient_id: str,
        name: str,
        phone: str,
        task: Dict[str, Any],
    ) -> None:
        """Send a task reminder via chat + SMS."""

        title     = task.get("title", "your scheduled task")
        task_time = task.get("time", "now")
        task_id   = task.get("id", "")
        task_type = task.get("type", "task")

        # Personalise message by task type
        type_phrases = {
            "med":      f"💊 It's time to take your medication: **{title}**",
            "checkin":  f"🩺 Time for your health check-in: **{title}**",
            "meal":     f"🍽️ Don't forget your scheduled meal: **{title}**",
            "exercise": f"🏃 Time for your exercise: **{title}**",
        }
        action_line = type_phrases.get(task_type, f"📋 Reminder: **{title}**")

        chat_msg = (
            f"{action_line}\n"
            f"Scheduled for {task_time}. Reply **YES** or **DONE** once completed "
            f"so I can update your progress."
        )

        sms_msg = (
            f"[AgenticNurse] Hi {name}, {action_line.replace('**', '')}. "
            f"Scheduled: {task_time}. "
            f"Please confirm completion via the app."
        )

        # Log to chat
        self._log_chat(patient_id, f"[TASK REMINDER] {chat_msg}", risk=0)

        # SMS to patient (not family — task reminders always go to patient)
        self._send_sms(phone, sms_msg, patient_id)

        print(f"[Scheduler] 🔔  Task reminder sent to {patient_id}: {title}")