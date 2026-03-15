"""
main.py  —  Agentic AI Nurse API

DATA PIPELINE:
  1. Nurse uploads patient discharge PDF  →  POST /nurse/admit-patient
  2. PDF text is extracted and parsed by LLM into structured JSON
  3. Patient record is saved to MongoDB with status=PENDING
  4. Per-patient Chroma KB is built from the PDF (isolated collection)
  5. RecoveryAgent is instantiated with that patient's KB
  6. Patient status is set to ACTIVE and monitoring_active=True
  7. BackgroundBrain begins polling for due tasks and sending reminders
  8. Patient interacts via /chat, /chat/voice, /chat/upload-image

AUTH FLOW:
  Hospital  →  POST /hospital/purchase          → returns hospital_id + nurse_password
  Nurse     →  POST /auth/nurse/login           → JWT (role=nurse)
  Patient   →  POST /auth/patient/access        → JWT (role=patient, no password MVP)
  Doctor    →  POST /auth/doctor/register       → create account + JWT
              POST /auth/doctor/login           → JWT (role=doctor)

DOCTOR ALERT FILTERING:
  - When a patient PDF is parsed, the primary doctor name is extracted from care_team[0]
  - On doctor register/login, patients whose primary_doctor_name matches the doctor's
    name (last-name match, case-insensitive) are automatically assigned: assigned_doctor_id
  - GET /doctor/alerts reads the JWT to get doctor_id, then returns only alerts
    for that doctor's assigned patients
  - DELETE /doctor/alerts/{alert_id} permanently removes the alert from MongoDB

Additional dependencies (pip install):
  bcrypt
  python-jose[cryptography]
"""

import asyncio
import json
import os
import secrets
import shutil
import string
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from jose import JWTError, jwt as jose_jwt
import bcrypt as _bcrypt
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel
from pymongo import MongoClient
from PyPDF2 import PdfReader

from app.agents.recovery_agent import RecoveryAgent
from app.knowledge import KnowledgeBase
from app.models import (
    AdmitPatientResponse,
    AlertAction,
    Appointment,
    CheckinState,
    ChatEntry,
    ChatRequest,
    ChatRole,
    DailyTask,
    PatientProfile,
    PatientStatus,
    ReplyRequest,
    TaskType,
    TriggerRequest,
)
from app.tools.vision_tool import WoundVisionTool
from app.tools.voice_tool import VoiceTool
from app.utils.scheduler import BackgroundBrain
from app.utils.twilio_helper import TwilioManager

# Setup

load_dotenv()

PATIENT_PHONE = os.getenv("PATIENT_PHONE", "")
MONGO_URI     = os.getenv("MONGO_URI", "mongodb://localhost:27017/")

JWT_SECRET       = os.getenv("JWT_SECRET", "nurseai-dev-secret-change-in-prod")
JWT_ALGORITHM    = "HS256"
JWT_EXPIRE_HOURS = 24

app = FastAPI(title="Agentic AI Nurse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:5173", 
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database

mongo_client  = MongoClient(MONGO_URI)
db            = mongo_client["nurse_agent_db"]
patients_col  = db["patients"]
chats_col     = db["chat_history"]
hospitals_col = db["hospitals"]
doctors_col   = db["doctors"]

# Agent & Hardware Registry

agent_registry: Dict[str, RecoveryAgent] = {}

live_vitals: Dict[str, dict] = {}
fall_alert_cooldowns: Dict[str, float] = {}

class VitalsPayload(BaseModel):
    bpm: int
    fall_detected: int

voice_tool     = VoiceTool()
vision_tool    = WoundVisionTool()
twilio_manager = TwilioManager()


# AUTH UTILITIES

def _hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _create_jwt(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    return jose_jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_jwt(token: str) -> dict:
    try:
        return jose_jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {exc}")


def _get_doctor_id_from_request(request: Request) -> Optional[str]:
    """Extract and validate doctor_id from Bearer token. Returns None if missing/invalid."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        claims = _decode_jwt(auth[7:])
        return claims.get("doctor_id")
    except Exception:
        return None


def _generate_hospital_id() -> str:
    while True:
        hid = f"HOSP-{secrets.randbelow(9000) + 1000}"
        if not hospitals_col.find_one({"hospital_id": hid}):
            return hid


def _generate_nurse_password(length: int = 5) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


# DOCTOR ↔ PATIENT ASSIGNMENT HELPERS

def _try_assign_doctor_to_patients(doctor_id: str, doctor_name: str) -> int:
    """
    When a doctor registers or logs in, scan for patients whose primary_doctor_name
    contains the doctor's last name (case-insensitive) and have no assigned_doctor_id yet.
    Assigns this doctor_id to all matches.
    Returns the number of patients newly assigned.
    """
    if not doctor_name or not doctor_name.strip():
        return 0
    last_name = doctor_name.strip().split()[-1]
    result = patients_col.update_many(
        {
            "assigned_doctor_id": None,
            "primary_doctor_name": {"$regex": last_name, "$options": "i"},
        },
        {"$set": {"assigned_doctor_id": doctor_id}},
    )
    if result.modified_count:
        print(
            f"[Doctor-Assign] 🔗  Linked {result.modified_count} patient(s) "
            f"to doctor {doctor_id} ({doctor_name})"
        )
    return result.modified_count


def _extract_and_assign_doctor(patient_id: str, care_team: list) -> Optional[str]:
    """
    Given a newly-admitted patient's care_team list (from PDF parse), attempt to
    find a matching registered doctor and store assigned_doctor_id on the patient.
    Returns the matched doctor_id if found, else None.
    """
    primary_doctor_name = ""
    if care_team:
        primary_doctor_name = care_team[0].get("name", "") if isinstance(care_team[0], dict) else str(care_team[0])

    assigned_doctor_id = None
    if primary_doctor_name:
        last_name = primary_doctor_name.strip().split()[-1]
        doc = doctors_col.find_one({"name": {"$regex": last_name, "$options": "i"}})
        if doc:
            assigned_doctor_id = doc["doctor_id"]
            print(
                f"[Doctor-Assign] Patient {patient_id} matched to "
                f"doctor {assigned_doctor_id} ({primary_doctor_name})"
            )
        else:
            print(
                f"[Doctor-Assign]  No registered doctor found for '{primary_doctor_name}' "
                f"— patient {patient_id} will be assigned when doctor registers."
            )

    patients_col.update_one(
        {"patient_id": patient_id},
        {"$set": {
            "primary_doctor_name": primary_doctor_name,
            "assigned_doctor_id":  assigned_doctor_id,
        }},
    )
    return assigned_doctor_id


# AUTH PYDANTIC MODELS

class HospitalPurchase(BaseModel):
    hospital_name:    str
    hospital_email:   str
    city:             str
    country:          str
    bed_count:        str
    billing_contact:  Optional[str] = None
    contact_sales:    bool          = False
    terms_accepted:   bool


class NurseLoginRequest(BaseModel):
    hospital_id: str
    password:    str


class PatientAccessRequest(BaseModel):
    patient_id: str


class DoctorLoginRequest(BaseModel):
    email:    str
    password: str


class DoctorRegisterRequest(BaseModel):
    name:     str
    email:    str
    password: str


# Pipeline Helpers

def _clean_json_string(raw: str) -> str:
    return raw.strip().replace("```json", "").replace("```", "").strip()


def get_agent(patient_id: str) -> RecoveryAgent:
    if patient_id in agent_registry:
        return agent_registry[patient_id]
    raise HTTPException(
        status_code=503,
        detail=f"Agent for patient '{patient_id}' is not ready yet. Please wait a moment and try again."
    )


async def _build_patient_kb_and_agent(patient_id: str, pdf_path: str) -> bool:
    print(f"[Pipeline] Building KB for patient {patient_id}...")
    try:
        kb = KnowledgeBase(pdf_path=pdf_path, patient_id=patient_id)
        if not kb.is_ready:
            print(f"[Pipeline] KB not fully ready for {patient_id}.")
        agent_registry[patient_id] = RecoveryAgent(knowledge_base=kb)
        patients_col.update_one(
            {"patient_id": patient_id},
            {"$set": {
                "kb_initialized":    kb.is_ready,
                "monitoring_active": True,
                "status":            PatientStatus.ACTIVE.value,
                "activated_at":      datetime.now(),
            }},
        )
        print(f"[Pipeline] Agent activated for patient {patient_id}")
        return True
    except Exception as e:
        print(f"[Pipeline] KB/Agent setup failed for {patient_id}: {e}")
        return False


async def _parse_pdf_to_patient(pdf_path: str, patient_id: str) -> Optional[PatientProfile]:
    try:
        reader = PdfReader(pdf_path)
        text   = "".join(page.extract_text() or "" for page in reader.pages)
    except Exception as e:
        print(f"[Pipeline] PDF read failed: {e}")
        return None

    if not text.strip():
        print("[Pipeline] PDF has no extractable text.")
        return None

    print(f"[Pipeline] Extracted {len(text)} chars from PDF.")

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("[Pipeline] GOOGLE_API_KEY missing.")
        return None

    llm = ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        temperature=0.1,
        google_api_key=api_key,
    )

    parse_prompt = f"""
ACT AS A MEDICAL DATA PARSER. Extract the following fields from the discharge text below.
Output STRICT JSON ONLY — no markdown, no extra text.

REQUIRED FIELDS:
{{
  "name": "string — patient full name",
  "daily_routine": [
    {{
      "id": "task_1",
      "time": "HH:MM AM/PM",
      "title": "Task description e.g. Aspirin 75mg",
      "type": "med | checkin | meal | exercise",
      "completed": false
    }}
  ],
  "care_team": [
    {{"name": "Doctor name", "role": "Role e.g. Cardiologist", "image": null}}
  ],
  "appointments": [
    {{
      "day": 1,
      "month": "Jan",
      "year": 2025,
      "doctor": "Doctor name",
      "note": "Purpose of visit e.g. Follow-up, Wound check"
    }}
  ],
  "family_name": "string — name of emergency contact / next of kin (empty string if not found)",
  "family_contact": "string — phone number of emergency contact (empty string if not found)"
}}

INSTRUCTIONS FOR daily_routine:
- If explicit times are given in the text, use them.
- If NO times are given, INFER from frequency:
  * "Once daily" or "Daily"          → 08:00 AM (ONE entry)
  * "Twice daily" or "BD"            → 08:00 AM and 08:00 PM (TWO entries)
  * "Three times daily" or "TDS"     → 08:00 AM, 02:00 PM, 08:00 PM (THREE entries)
  * "Four times daily" or "QID"      → 08:00 AM, 12:00 PM, 04:00 PM, 10:00 PM
  * "Night" or "At bedtime" or "HS"  → 09:00 PM
  * "Morning"                        → 08:00 AM
  * "With meals"                     → 08:00 AM, 01:00 PM, 07:00 PM
- Always add a morning check-in task at 07:30 AM of type "checkin"
- Always add breakfast at 08:30 AM and dinner at 07:00 PM of type "meal"
- Extract ALL medications and generate a task entry for EACH dose.

INSTRUCTIONS FOR appointments:
- Extract ALL follow-up appointments mentioned. Return empty array [] if none found.
- If doctor name is not mentioned for an appointment, use "Treating Physician".

INSTRUCTIONS FOR care_team:
- Extract all doctors/nurses/specialists mentioned. Return empty array [] if none found.
- The FIRST entry must be the primary treating doctor.

INSTRUCTIONS FOR family_contact:
- Look for any emergency contact, next of kin, family member, or guardian mentioned.
- Extract their name and phone number if present.
- If not found, return empty strings.

DISCHARGE TEXT (first 3000 chars):
{text[:3000]}
"""

    try:
        llm_response = llm.invoke(parse_prompt)
        raw_json     = _clean_json_string(getattr(llm_response, "content", str(llm_response)))
        data         = json.loads(raw_json)
    except Exception as e:
        print(f"[Pipeline] LLM parse failed ({e}). Using minimal defaults.")
        data = {}

    valid_task_types = [e.value for e in TaskType]

    try:
        profile = PatientProfile(
            patient_id=patient_id,
            name=data.get("name") or "New Patient",
            phone=PATIENT_PHONE,
            status=PatientStatus.PENDING,
            discharge_file=pdf_path,
            daily_routine=[
                DailyTask(
                    id=t.get("id") or f"task_{i}",
                    time=t.get("time") or "09:00 AM",
                    title=t.get("title") or "Task",
                    type=TaskType(t.get("type") if t.get("type") in valid_task_types else "checkin"),
                    completed=bool(t.get("completed", False)),
                )
                for i, t in enumerate(data.get("daily_routine") or [])
            ],
            care_team=[
                {
                    "name":  str(c.get("name") or "Unknown"),
                    "role":  str(c.get("role") or "Physician"),
                    "image": None,
                }
                for c in (data.get("care_team") or [])
                if c.get("name")
            ],
            appointments=[
                Appointment(
                    day=int(a.get("day") or 1),
                    month=str(a.get("month") or "Jan"),
                    year=int(a.get("year") or datetime.now().year),
                    doctor=str(a.get("doctor") or "Treating Physician"),
                    note=str(a["note"]) if a.get("note") else None,
                )
                for a in (data.get("appointments") or [])
                if a.get("day") and a.get("month") and a.get("year")
            ],
            family_name=str(data.get("family_name") or ""),
            family_contact=str(data.get("family_contact") or ""),
            checkin_state=CheckinState(),
        )
    except Exception as e:
        print(f"[Pipeline] PatientProfile validation failed: {e}")
        return None

    patients_col.insert_one(profile.to_mongo())
    print(f"[Pipeline] Patient '{profile.name}' (ID: {patient_id}) saved to DB.")

    # ── Try to assign a registered doctor from care_team ──
    _extract_and_assign_doctor(patient_id, profile.care_team)

    return profile


# Chat helpers

def _save_chat(
    patient_id: str,
    role: ChatRole,
    content: str,
    risk_score: int = 0,
    action: AlertAction = AlertAction.LOG,
) -> None:
    entry = ChatEntry(
        patient_id=patient_id,
        role=role,
        content=content,
        risk_score=risk_score,
        action=action,
    )
    chats_col.insert_one(entry.to_mongo())


# Startup

@app.on_event("startup")
async def startup_event() -> None:
    print("[Startup] Agentic AI Nurse starting up...")

    active_patients = list(patients_col.find({"status": "Active", "monitoring_active": True}))
    if active_patients:
        print(f"[Startup] Re-activating {len(active_patients)} existing patient(s)...")
        for p in active_patients:
            pid = p["patient_id"]
            pdf = p.get("discharge_file", "")
            if pid not in agent_registry and pdf and os.path.exists(pdf):
                asyncio.create_task(_build_patient_kb_and_agent(pid, pdf))
            elif not os.path.exists(pdf):
                print(f"[Startup] PDF missing for {pid}: {pdf}. Skipping KB rebuild.")
    else:
        print("[Startup] No existing patients found. Ready for first admission.")

    brain = BackgroundBrain(db, agent_registry)
    asyncio.create_task(brain.start())
    print("[Startup] BackgroundBrain scheduler started.")

# HOSPITAL PURCHASE

@app.post("/hospital/purchase")
async def purchase_hospital_access(body: HospitalPurchase):
    if not body.terms_accepted:
        raise HTTPException(status_code=400, detail="Terms must be accepted to proceed.")

    if hospitals_col.find_one({"hospital_email": body.hospital_email.lower().strip()}):
        raise HTTPException(
            status_code=409,
            detail="A hospital with this email is already registered. Contact support to recover credentials."
        )

    hospital_id    = _generate_hospital_id()
    nurse_password = _generate_nurse_password(length=5)

    hospital_doc = {
        "hospital_id":         hospital_id,
        "hospital_name":       body.hospital_name.strip(),
        "hospital_email":      body.hospital_email.lower().strip(),
        "city":                body.city.strip(),
        "country":             body.country.strip(),
        "bed_count":           body.bed_count,
        "contact_sales":       body.contact_sales,
        "billing_contact":     body.billing_contact or "",
        "nurse_password_hash": _hash_password(nurse_password),
        "registered_at":       datetime.utcnow(),
        "active":              True,
    }
    hospitals_col.insert_one(hospital_doc)

    print(f"[Hospital] New hospital registered: {hospital_id} ({body.hospital_name}) — {body.hospital_email}")

    return {
        "status":         "success",
        "hospital_id":    hospital_id,
        "nurse_password": nurse_password,
        "message": (
            f"Hospital '{body.hospital_name}' registered successfully. "
            "Save these credentials — they will not be shown again."
        ),
    }

# NURSE AUTH

@app.post("/auth/nurse/login")
async def nurse_login(body: NurseLoginRequest):
    hospital = hospitals_col.find_one({"hospital_id": body.hospital_id.strip().upper()})
    if not hospital:
        raise HTTPException(status_code=401, detail="Hospital ID not found.")

    if not _verify_password(body.password, hospital["nurse_password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    if not hospital.get("active", True):
        raise HTTPException(status_code=403, detail="This hospital account has been deactivated.")

    token = _create_jwt({
        "role":        "nurse",
        "hospital_id": hospital["hospital_id"],
        "sub":         hospital["hospital_id"],
    })

    print(f"[Auth] Nurse login: {hospital['hospital_id']} ({hospital['hospital_name']})")
    return {
        "token":         token,
        "role":          "nurse",
        "hospital_id":   hospital["hospital_id"],
        "hospital_name": hospital["hospital_name"],
        "expires_in":    JWT_EXPIRE_HOURS * 3600,
    }

# PATIENT ACCESS

@app.post("/auth/patient/access")
async def patient_access(body: PatientAccessRequest):
    pid = body.patient_id.strip()
    patient = patients_col.find_one({"patient_id": pid}, {"_id": 0, "name": 1, "status": 1})
    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient ID not found. Please check your discharge paperwork or ask your nurse."
        )

    token = _create_jwt({
        "role":       "patient",
        "patient_id": pid,
        "sub":        pid,
    })

    print(f"[Auth] Patient access: {pid} ({patient.get('name', 'Unknown')})")
    return {
        "token":      token,
        "role":       "patient",
        "patient_id": pid,
        "name":       patient.get("name", ""),
        "expires_in": JWT_EXPIRE_HOURS * 3600,
    }

# DOCTOR AUTH

@app.post("/auth/doctor/register")
async def doctor_register(body: DoctorRegisterRequest):
    email = body.email.lower().strip()
    if doctors_col.find_one({"email": email}):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Please sign in instead."
        )

    doctor_id = f"doc_{uuid.uuid4().hex[:8]}"
    doctor_doc = {
        "doctor_id":     doctor_id,
        "name":          body.name.strip(),
        "email":         email,
        "password_hash": _hash_password(body.password),
        "registered_at": datetime.utcnow(),
        "active":        True,
    }
    doctors_col.insert_one(doctor_doc)

    # ── Assign any already-admitted patients whose care_team matches this doctor ──
    assigned = _try_assign_doctor_to_patients(doctor_id, body.name.strip())

    token = _create_jwt({
        "role":      "doctor",
        "doctor_id": doctor_id,
        "sub":       doctor_id,
    })

    print(f"[Auth] Doctor registered: {doctor_id} ({email}) — {assigned} patient(s) auto-assigned")
    return {
        "token":           token,
        "role":            "doctor",
        "doctor_id":       doctor_id,
        "name":            body.name.strip(),
        "patients_linked": assigned,
        "expires_in":      JWT_EXPIRE_HOURS * 3600,
    }


@app.post("/auth/doctor/login")
async def doctor_login(body: DoctorLoginRequest):
    email  = body.email.lower().strip()
    doctor = doctors_col.find_one({"email": email})
    if not doctor:
        raise HTTPException(status_code=401, detail="No account found with this email. Please register first.")

    if not _verify_password(body.password, doctor["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    if not doctor.get("active", True):
        raise HTTPException(status_code=403, detail="This account has been deactivated.")

    # ── Re-run assignment in case new patients were admitted since last login ──
    _try_assign_doctor_to_patients(doctor["doctor_id"], doctor.get("name", ""))

    token = _create_jwt({
        "role":      "doctor",
        "doctor_id": doctor["doctor_id"],
        "sub":       doctor["doctor_id"],
    })

    print(f"[Auth] 🩺  Doctor login: {doctor['doctor_id']} ({email})")
    return {
        "token":      token,
        "role":       "doctor",
        "doctor_id":  doctor["doctor_id"],
        "name":       doctor.get("name", ""),
        "expires_in": JWT_EXPIRE_HOURS * 3600,
    }

# NURSE ENDPOINTS

@app.post("/nurse/admit-patient", response_model=AdmitPatientResponse)
async def admit_patient(file: UploadFile = File(...)):
    os.makedirs("data/uploads", exist_ok=True)
    patient_id = f"p_{uuid.uuid4().hex[:6]}"
    file_path  = f"data/uploads/{patient_id}_{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    print(f"[Admit] PDF saved: {file_path}")

    profile = await _parse_pdf_to_patient(file_path, patient_id)

    if not profile:
        return AdmitPatientResponse(
            status="partial_success",
            message="PDF uploaded but could not be fully parsed. Manual entry required.",
        )

    asyncio.create_task(_build_patient_kb_and_agent(patient_id, file_path))

    return AdmitPatientResponse(
        status="success",
        message=f"Patient '{profile.name}' admitted. AI monitoring activating...",
        patient_id=patient_id,
    )


@app.get("/nurse/patients")
def get_all_patients():
    return list(
        patients_col.find(
            {},
            {
                "_id": 0, "name": 1, "patient_id": 1,
                "status": 1, "monitoring_active": 1, "kb_initialized": 1,
            },
        )
    )


@app.get("/nurse/patient/{patient_id}/status")
def get_patient_pipeline_status(patient_id: str):
    patient = patients_col.find_one({"patient_id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "patient_id":        patient_id,
        "status":            patient.get("status"),
        "kb_initialized":    patient.get("kb_initialized", False),
        "monitoring_active": patient.get("monitoring_active", False),
        "agent_ready":       patient_id in agent_registry,
    }


# CHAT ENDPOINTS

@app.post("/chat")
async def chat_with_nurse(request: ChatRequest):
    agent = get_agent(request.patient_id)

    patient = patients_col.find_one({"patient_id": request.patient_id})
    context_prefix = ""
    if patient:
        pending = [t["title"] for t in patient.get("daily_routine", []) if not t.get("completed")]
        context_prefix = (
            f"CONTEXT: Patient Name: {patient['name']}. "
            f"Pending tasks today: {pending}.\n"
        )

    decision = agent.run(f"{context_prefix}USER: {request.message}")
    reply    = decision.get("patient_reply", str(decision)) if isinstance(decision, dict) else str(decision)
    risk     = decision.get("risk_score", 0) if isinstance(decision, dict) else 0
    action   = AlertAction(decision.get("action", "LOG")) if isinstance(decision, dict) else AlertAction.LOG

    _save_chat(request.patient_id, ChatRole.PATIENT, request.message)
    _save_chat(request.patient_id, ChatRole.NURSE, reply, risk, action)

    return {"response": reply, "risk_score": risk, "action": action.value}


@app.post("/chat/voice")
async def chat_voice(file: UploadFile = File(...), patient_id: str = Form(...)):
    os.makedirs("data", exist_ok=True)
    file_loc = f"data/voice_{uuid.uuid4().hex}.webm"

    with open(file_loc, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        stt_result = voice_tool.process_voice_message(file_loc)
        transcript = stt_result.get("transcript", "")

        if not transcript:
            return {"response": "Could not transcribe audio.", "transcript": "", "audio": None}

        agent = get_agent(patient_id)
        raw   = agent.run(f"Patient Voice Transcript: {transcript}. Reply briefly and clearly.")
        reply = raw.get("patient_reply", str(raw)) if isinstance(raw, dict) else str(raw)
        risk  = raw.get("risk_score", 0) if isinstance(raw, dict) else 0

        _save_chat(patient_id, ChatRole.PATIENT, f"[VOICE] {transcript}")
        _save_chat(patient_id, ChatRole.NURSE, reply, risk)

        audio_b64 = voice_tool.text_to_speech(reply)
        return {"response": reply, "transcript": transcript, "audio": audio_b64}

    except Exception as e:
        print(f"[Voice] {e}")
        return {"response": "Error processing audio.", "error": str(e)}
    finally:
        if os.path.exists(file_loc):
            os.remove(file_loc)


@app.post("/chat/upload-image")
async def chat_upload_image(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    user_query: str = Form("Analyze this image for me."),
):
    os.makedirs("data/images", exist_ok=True)
    ext      = os.path.splitext(file.filename)[1] or ".jpg"
    file_loc = f"data/images/{uuid.uuid4().hex}{ext}"

    with open(file_loc, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        vision_result  = vision_tool.analyze_wound(file_loc)
        healing_status = vision_result.get("healing_status", "Unable to assess")
        infection_risk = vision_result.get("infection_signs", "None detected")
        vision_action  = vision_result.get("action", "MONITOR")
        vision_summary = vision_result.get("summary", "Image analyzed.")

        agent        = get_agent(patient_id)
        patient      = patients_col.find_one({"patient_id": patient_id})
        patient_name = patient["name"] if patient else "Patient"

        prompt = (
            f"CONTEXT: Patient Name: {patient_name}.\n"
            f"WOUND IMAGE ANALYSIS RESULT:\n"
            f"  - Healing Status: {healing_status}\n"
            f"  - Infection Signs: {infection_risk}\n"
            f"  - Recommended Action: {vision_action}\n"
            f"  - Summary: {vision_summary}\n\n"
            f"USER QUERY: {user_query}\n\n"
            f"Based on the wound image analysis above, provide caring and clear guidance to the patient. "
            f"If action is ALERT, emphasise urgency to contact their care team immediately."
        )

        decision = agent.run(prompt)
        reply    = decision.get("patient_reply", str(decision)) if isinstance(decision, dict) else str(decision)
        risk     = 7 if vision_action == "ALERT" else (4 if vision_action == "FLAG" else 1)
        action   = AlertAction.ALERT if vision_action == "ALERT" else (
            AlertAction.FLAG if vision_action == "FLAG" else AlertAction.LOG
        )

        _save_chat(patient_id, ChatRole.PATIENT, f"[IMAGE UPLOAD] {user_query}")
        _save_chat(patient_id, ChatRole.NURSE, reply, risk, action)

        return {"response": reply, "vision_action": vision_action, "risk_score": risk}

    except Exception as e:
        print(f"[Vision] {e}")
        return {
            "response": "I wasn't able to fully analyse the image. Please describe what you see, or contact your care team directly.",
            "error":    str(e),
        }
    finally:
        if os.path.exists(file_loc):
            os.remove(file_loc)


# SMS & WEBHOOKS

@app.post("/trigger-reminder")
def trigger_medication_reminder(req: TriggerRequest):
    patient = patients_col.find_one({"patient_id": req.patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    task = next((t for t in patient.get("daily_routine", []) if t.get("id") == req.task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    name = patient["name"].split()[0]
    body = (
        f"NURSE AGENT: Hi {name}, it is {task['time']}.\n"
        f"Please complete: {task['title']}.\n"
        f"Reply YES to confirm."
    )

    sid = twilio_manager.send_sms(patient.get("phone", ""), body)
    _save_chat(req.patient_id, ChatRole.SYSTEM, f"[SMS SENT] {body}")
    return {"status": "sent" if not str(sid).startswith("Error") else "failed", "sid": sid}


@app.post("/twilio/webhook")
async def twilio_webhook(request: Request):
    form_data    = await request.form()
    incoming_msg = form_data.get("Body", "").strip().upper()
    sender_phone = form_data.get("From", "")

    print(f"[Webhook] SMS from {sender_phone}: {incoming_msg}")

    if incoming_msg in {"YES", "DONE", "TAKEN", "Y", "OK"}:
        patient = patients_col.find_one({"phone": sender_phone})
        if patient:
            for task in patient.get("daily_routine", []):
                if not task.get("completed") and task.get("type") == "med":
                    patients_col.update_one(
                        {"patient_id": patient["patient_id"], "daily_routine.id": task["id"]},
                        {"$set": {"daily_routine.$.completed": True}},
                    )
                    _save_chat(patient["patient_id"], ChatRole.PATIENT, f"SMS Reply: {incoming_msg}")
                    _save_chat(patient["patient_id"], ChatRole.NURSE, "Logged: medication confirmed via SMS.", 0)
                    break

    return Response(content="<Response></Response>", media_type="application/xml")


@app.post("/patient-reply")
def process_patient_reply(req: ReplyRequest):
    if req.response.upper() in {"YES", "DONE", "TAKEN"}:
        patients_col.update_one(
            {"patient_id": req.patient_id, "daily_routine.id": req.task_id},
            {"$set": {"daily_routine.$.completed": True}},
        )
        _save_chat(req.patient_id, ChatRole.PATIENT, f"Confirmed: {req.task_id}")
        _save_chat(req.patient_id, ChatRole.NURSE, "Great job! Adherence logged.", 0)
        return {"status": "success"}
    return {"status": "ignored"}


class TaskCompleteRequest(BaseModel):
    patient_id: str
    task_id:    str


@app.post("/patient/task/complete")
def complete_task(req: TaskCompleteRequest):
    result = patients_col.update_one(
        {"patient_id": req.patient_id, "daily_routine.id": req.task_id},
        {"$set": {"daily_routine.$.completed": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient or task not found")

    _save_chat(req.patient_id, ChatRole.NURSE, f"Task completed: {req.task_id}", 0)
    print(f"[Task] Patient {req.patient_id} completed task {req.task_id}")
    return {"status": "success", "task_id": req.task_id}


# DASHBOARD ENDPOINTS

@app.get("/patient/{patient_id}/personalization")
def get_patient_personalization(patient_id: str):
    patient = patients_col.find_one({"patient_id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@app.get("/chat_history/{patient_id}")
def get_chat_history(patient_id: str, limit: int = 50):
    cursor = (
        chats_col.find({"patient_id": patient_id}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(limit)
    )
    return list(cursor)[::-1]


@app.get("/doctor/alerts")
def get_doctor_alerts(request: Request):
    """
    Returns alerts filtered to the logged-in doctor's assigned patients.

    Flow:
    1. Extract doctor_id from Bearer JWT.
    2. Find all patients where assigned_doctor_id == doctor_id.
    3. Return chat_history entries (risk_score >= 4) for those patients only.
    4. Fallback: if the doctor has no assigned patients yet, return ALL alerts
       (safe for hackathon demo when names haven't been matched).

    Each alert includes alert_id (MongoDB _id as string) for the DELETE endpoint.
    """
    doctor_id = _get_doctor_id_from_request(request)

    # Build patient filter + doctor-name lookup map
    patient_filter:    Optional[list] = None
    doctor_name_by_pid: dict          = {}

    if doctor_id:
        assigned = list(patients_col.find(
            {"assigned_doctor_id": doctor_id},
            {"patient_id": 1, "primary_doctor_name": 1, "_id": 0},
        ))
        if assigned:
            patient_filter     = [p["patient_id"] for p in assigned]
            doctor_name_by_pid = {p["patient_id"]: p.get("primary_doctor_name", "") for p in assigned}
        # If no patients assigned yet → patient_filter stays None → return all (demo fallback)

    query: dict = {"role": "nurse", "risk_score": {"$gte": 4}}
    if patient_filter is not None:
        query["patient_id"] = {"$in": patient_filter}

    cursor = chats_col.find(query).sort("timestamp", -1)

    return [
        {
            "alert_id":            str(doc["_id"]),
            "patient_id":          doc.get("patient_id", ""),
            "primary_doctor_name": doctor_name_by_pid.get(doc.get("patient_id", ""), ""),
            "risk_score":          doc.get("risk_score", 0),
            "action":              doc.get("action", "FLAG"),
            "timestamp":           doc.get("timestamp").isoformat() if doc.get("timestamp") else None,
            "reason":              doc.get("content", ""),
        }
        for doc in cursor
    ]


@app.delete("/doctor/alerts/{alert_id}")
def acknowledge_alert(alert_id: str, request: Request):
    """
    Permanently delete a single alert (chat_history entry) from MongoDB.
    Requires a valid doctor JWT.
    Called when the doctor clicks Acknowledge in the dashboard.
    """
    # Validate auth
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header required.")
    claims = _decode_jwt(auth[7:])
    if claims.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Doctor role required to acknowledge alerts.")

    # Parse ObjectId
    try:
        oid = ObjectId(alert_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid alert ID: {alert_id}")

    result = chats_col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found or already acknowledged.")

    print(f"[Doctor] Alert {alert_id} acknowledged + deleted by {claims.get('doctor_id')}")
    return {"status": "deleted", "alert_id": alert_id}


# 🛠️  DEV / DEMO CONTROL ENDPOINTS

class DevConfig(BaseModel):
    checkin_hour:              Optional[int] = None
    checkin_minute:            Optional[int] = None
    checkin_minute_window:     Optional[int] = None
    escalation_window_minutes: Optional[int] = None
    max_attempts:              Optional[int] = None
    task_window_minutes:       Optional[int] = None
    poll_interval_seconds:     Optional[int] = None
    patient_id:                Optional[str] = None
    phone_override:            Optional[str] = None
    family_override:           Optional[str] = None


class DevTrigger(BaseModel):
    patient_id: str
    trigger:    str
    task_id:    Optional[str] = None


@app.get("/dev/config")
def get_dev_config():
    import app.utils.scheduler as sched

    patient_phones = []
    for p in patients_col.find({}, {"_id": 0, "patient_id": 1, "name": 1, "phone": 1,
                                     "family_name": 1, "family_contact": 1,
                                     "phone_override": 1, "family_override": 1,
                                     "primary_doctor_name": 1, "assigned_doctor_id": 1}):
        patient_phones.append({
            "patient_id":          p.get("patient_id"),
            "name":                p.get("name"),
            "pdf_phone":           p.get("phone", ""),
            "pdf_family_name":     p.get("family_name", ""),
            "pdf_family_contact":  p.get("family_contact", ""),
            "phone_override":      p.get("phone_override", ""),
            "family_override":     p.get("family_override", ""),
            "primary_doctor_name": p.get("primary_doctor_name", ""),
            "assigned_doctor_id":  p.get("assigned_doctor_id", ""),
        })

    return {
        "timing": {
            "checkin_hour":              sched.CHECKIN_HOUR,
            "checkin_minute":            sched.CHECKIN_MINUTE,
            "checkin_minute_window":     sched.CHECKIN_MINUTE_WINDOW,
            "escalation_window_minutes": sched.ESCALATION_WINDOW_MINUTES,
            "max_attempts":              sched.MAX_ATTEMPTS,
            "task_window_minutes":       sched.TASK_WINDOW_MINUTES,
            "poll_interval_seconds":     sched.POLL_INTERVAL_SECONDS,
        },
        "patients": patient_phones,
    }


@app.post("/dev/config")
def update_dev_config(cfg: DevConfig):
    import app.utils.scheduler as sched

    changed = []

    if cfg.checkin_hour is not None:
        sched.CHECKIN_HOUR = cfg.checkin_hour
        changed.append(f"checkin_hour={cfg.checkin_hour}")
    if cfg.checkin_minute is not None:
        sched.CHECKIN_MINUTE = cfg.checkin_minute
        changed.append(f"checkin_minute={cfg.checkin_minute}")
    if cfg.checkin_minute_window is not None:
        sched.CHECKIN_MINUTE_WINDOW = cfg.checkin_minute_window
        changed.append(f"checkin_minute_window={cfg.checkin_minute_window}")
    if cfg.escalation_window_minutes is not None:
        sched.ESCALATION_WINDOW_MINUTES = cfg.escalation_window_minutes
        changed.append(f"escalation_window_minutes={cfg.escalation_window_minutes}")
    if cfg.max_attempts is not None:
        sched.MAX_ATTEMPTS = cfg.max_attempts
        changed.append(f"max_attempts={cfg.max_attempts}")
    if cfg.task_window_minutes is not None:
        sched.TASK_WINDOW_MINUTES = cfg.task_window_minutes
        changed.append(f"task_window_minutes={cfg.task_window_minutes}")
    if cfg.poll_interval_seconds is not None:
        sched.POLL_INTERVAL_SECONDS = cfg.poll_interval_seconds
        changed.append(f"poll_interval_seconds={cfg.poll_interval_seconds}")

    if cfg.patient_id:
        update = {}
        if cfg.phone_override is not None:
            update["phone_override"] = cfg.phone_override
            changed.append(f"phone_override={cfg.phone_override}")
        if cfg.family_override is not None:
            update["family_override"] = cfg.family_override
            changed.append(f"family_override={cfg.family_override}")
        if update:
            patients_col.update_one({"patient_id": cfg.patient_id}, {"$set": update})

    print(f"[DevConfig] ⚙️  Updated: {', '.join(changed) if changed else 'nothing'}")
    return {"status": "ok", "changed": changed}


@app.post("/dev/trigger")
async def dev_trigger(req: DevTrigger):
    patient = patients_col.find_one({"patient_id": req.patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    phone      = patient.get("phone_override") or patient.get("phone", "")
    fam_phone  = patient.get("family_override") or patient.get("family_contact", "")
    fam_name   = patient.get("family_name", "family member")
    first_name = patient.get("name", "Patient").split()[0]

    brain = BackgroundBrain(db, agent_registry)

    if req.trigger == "checkin":
        current_attempt = patient.get("checkin_state", {}).get("attempt", 0)
        await brain._send_checkin(req.patient_id, first_name, phone, attempt=current_attempt + 1)
        return {"status": "sent", "message": f"Check-in #{current_attempt + 1} sent to {phone}"}

    elif req.trigger == "escalate":
        await brain._escalate_to_family(req.patient_id, first_name, fam_name, fam_phone, phone)
        return {"status": "escalated", "message": f"Family alert sent to {fam_phone}"}

    elif req.trigger == "task_reminder":
        if not req.task_id:
            raise HTTPException(status_code=400, detail="task_id required for task_reminder trigger")
        task = next((t for t in patient.get("daily_routine", []) if t.get("id") == req.task_id), None)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        await brain._send_task_reminder(req.patient_id, first_name, phone, task)
        return {"status": "sent", "message": f"Task reminder sent for '{task['title']}'"}

    elif req.trigger == "reset_checkin":
        patients_col.update_one(
            {"patient_id": req.patient_id},
            {"$set": {
                "checkin_state": {
                    "date": "", "attempt": 0,
                    "last_sent_at": None, "responded": False, "escalated": False,
                },
                "reminders_sent_today": [],
                "status": "Active",
            }}
        )
        return {"status": "reset", "message": "Check-in state and reminders reset for today"}

    raise HTTPException(status_code=400, detail=f"Unknown trigger: {req.trigger}")


# HARDWARE INTEGRATION (AI NURSE WATCH)

@app.post("/device/vitals/{patient_id}")
async def update_vitals(patient_id: str, payload: VitalsPayload):
    """
    The watch.py script calls this endpoint continuously.
    We update the RAM cache instantly, and only hit the DB if there's a fall.
    """
    # 1. Update the live cache for the WebSocket to read
    live_vitals[patient_id] = {
        "bpm": payload.bpm,
        "fall_detected": payload.fall_detected,
        "timestamp": datetime.utcnow().isoformat()
    }

    # 2. Emergency Trigger: If a fall is detected, alert the doctor!
    if payload.fall_detected == 1:
        now = datetime.utcnow().timestamp()
        last_alert = fall_alert_cooldowns.get(patient_id, 0)
        
        # Only trigger a DB alert once every 60 seconds per physical fall event
        if now - last_alert > 60:
            print(f"[EMERGENCY] Fall detected for patient {patient_id}!")
            
            # Use your existing chat logging system so it shows up on the Doctor's Dashboard!
            _save_chat(
                patient_id=patient_id,
                role=ChatRole.SYSTEM,
                content="EMERGENCY ALARM: Wearable sensor detected a severe fall!",
                risk_score=10,  # Max risk score
                action=AlertAction.ALERT
            )
            
            fall_alert_cooldowns[patient_id] = now

    return {"status": "ok"}


@app.websocket("/ws/vitals/{patient_id}")
async def vitals_websocket(websocket: WebSocket, patient_id: str):
    """
    React frontend connects to this to get a live stream of the BPM.
    """
    await websocket.accept()
    print(f"[WebSocket] 🔗 React connected to vitals stream for {patient_id}")
    try:
        while True:
            # Fetch the latest vitals from RAM, or default to 0 if no watch is connected
            current_data = live_vitals.get(patient_id, {"bpm": 0, "fall_detected": 0})
            
            # Push the data to the React dashboard
            await websocket.send_json(current_data)
            
            # Send updates twice a second to keep the UI smooth but not overloaded
            await asyncio.sleep(0.5)
            
    except WebSocketDisconnect:
        print(f"[WebSocket] ❌ React disconnected from vitals stream for {patient_id}")