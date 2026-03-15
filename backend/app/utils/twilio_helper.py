"""
app/utils/twilio_helper.py

TwilioManager — sends and tracks SMS messages via the Twilio REST API.
Fails gracefully when credentials are absent (e.g. local dev without Twilio).
"""

import os
from typing import Optional


class TwilioManager:
    """
    Wrapper around the Twilio REST client for SMS delivery.

    Requires environment variables:
        TWILIO_SID   — Account SID
        TWILIO_TOKEN — Auth Token
        TWILIO_FROM  — Twilio phone number (e.g. "+15005550006")
    """

    def __init__(self) -> None:
        self.sid = os.getenv("TWILIO_SID", "")
        self.token = os.getenv("TWILIO_TOKEN", "")
        self.from_number = os.getenv("TWILIO_FROM", "")
        self._client = None

        if self.sid and self.token:
            try:
                from twilio.rest import Client
                self._client = Client(self.sid, self.token)
                print("[Twilio] ✅  Client initialized.")
            except ImportError:
                print("[Twilio] ⚠️  twilio package not installed. SMS disabled.")
            except Exception as e:
                print(f"[Twilio] ❌  Client init failed: {e}")
        else:
            print("[Twilio] ⚠️  Credentials missing. SMS will be skipped.")

    # ──────────────────────────────────────────────
    # Public Methods
    # ──────────────────────────────────────────────

    def send_sms(self, to: str, body: str) -> str:
        """
        Send an SMS to `to` with the given `body`.
        Returns the Twilio message SID on success, or an error string.
        """
        if not self._client:
            print(f"[Twilio] ⚠️  Skipped SMS to {to} (not configured).")
            return "Twilio not configured."

        if not self.from_number:
            print("[Twilio] ⚠️  TWILIO_FROM not set.")
            return "TWILIO_FROM not configured."

        try:
            message = self._client.messages.create(
                body=body,
                from_=self.from_number,
                to=to,
            )
            print(f"[Twilio] ✅  SMS sent to {to}. SID: {message.sid}")
            return message.sid

        except Exception as e:
            print(f"[Twilio] ❌  SMS failed to {to}: {e}")
            return f"Error: {e}"

    def send_alert(self, to: str, patient_name: str, risk_score: int, reason: str) -> str:
        """
        Convenience method for doctor/caregiver critical alerts.
        """
        body = (
            f"🚨 NURSE AGENT ALERT\n"
            f"Patient: {patient_name}\n"
            f"Risk Score: {risk_score}/10\n"
            f"Reason: {reason}\n"
            f"Please check immediately."
        )
        return self.send_sms(to, body)

    @property
    def is_configured(self) -> bool:
        return self._client is not None