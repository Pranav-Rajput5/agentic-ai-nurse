"""
app/models.py — Pydantic models for all entities in the Agentic AI Nurse system.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# Enums

class TaskType(str, Enum):
    MED      = "med"
    CHECKIN  = "checkin"
    MEAL     = "meal"
    EXERCISE = "exercise"


class PatientStatus(str, Enum):
    PENDING    = "Pending"
    ACTIVE     = "Active"
    CRITICAL   = "Critical"
    DISCHARGED = "Discharged"


class ChatRole(str, Enum):
    PATIENT = "patient"
    NURSE   = "nurse"
    SYSTEM  = "system"


class AlertAction(str, Enum):
    LOG   = "LOG"
    FLAG  = "FLAG"
    ALERT = "ALERT"

# Sub-models

class DailyTask(BaseModel):
    id:        str
    time:      str            # e.g. "08:00 AM"
    title:     str
    type:      TaskType
    completed: bool = False


class CareTeamMember(BaseModel):
    name:  str
    role:  str
    image: Optional[str] = None


class Appointment(BaseModel):
    day:    int
    month:  str               # e.g. "Jan"
    year:   int
    doctor: str = "Treating Physician"
    note:   Optional[str] = None


class CheckinState(BaseModel):
    """
    Tracks the daily morning check-in state machine for one patient.
    Persisted in MongoDB — survives server restarts.

    State transitions:
      UNSENT → attempt=1 → attempt=2 → attempt=3 → escalated=True
    """
    date:         str = ""              # ISO date "2026-03-04" of last check-in cycle
    attempt:      int = 0               # How many check-ins sent today
    last_sent_at: Optional[datetime] = None
    responded:    bool = False          # Patient replied after last check-in?
    escalated:    bool = False          # Escalated to family member?

    def to_mongo(self) -> Dict[str, Any]:
        data = self.model_dump()
        return data


# Core Patient Profile

class PatientProfile(BaseModel):
    patient_id: str
    name:       str
    phone:      str = ""           # Patient's mobile (from PDF or env)

    # Emergency / family contact (extracted from discharge PDF)
    family_name:    str = ""       # e.g. "Sanjay Mehra (Son)"
    family_contact: str = ""       # e.g. "+91 98765 00001"

    status:         PatientStatus = PatientStatus.PENDING
    discharge_file: str = ""

    daily_routine: List[DailyTask]       = Field(default_factory=list)
    care_team:     List[CareTeamMember]  = Field(default_factory=list)
    appointments:  List[Appointment]     = Field(default_factory=list)

    # Pipeline flags
    kb_initialized:   bool = False
    monitoring_active: bool = False

    # Automation state
    checkin_state:        CheckinState = Field(default_factory=CheckinState)
    reminders_sent_today: List[str]    = Field(default_factory=list)  # task IDs sent today
    reminders_reset_date: str = ""     # ISO date of last reminders reset

    # Metadata
    admitted_at:  datetime = Field(default_factory=datetime.now)
    activated_at: Optional[datetime] = None
    admitted_by:  str = "system"

    def to_mongo(self) -> Dict[str, Any]:
        data = self.model_dump()
        data["status"] = self.status.value
        data["checkin_state"] = self.checkin_state.to_mongo()
        return data


# Chat / Interaction

class ChatEntry(BaseModel):
    patient_id: str
    role:       ChatRole
    content:    str
    risk_score: int = 0
    action:     AlertAction = AlertAction.LOG
    timestamp:  datetime = Field(default_factory=datetime.now)

    def to_mongo(self) -> Dict[str, Any]:
        data = self.model_dump()
        data["role"]   = self.role.value
        data["action"] = self.action.value
        return data


# API Request / Response

class ChatRequest(BaseModel):
    message:    str
    patient_id: str


class CheckInRequest(BaseModel):
    patient_id: str
    heart_rate: int
    oxygen:     int


class TriggerRequest(BaseModel):
    patient_id: str
    task_id:    str


class ReplyRequest(BaseModel):
    patient_id: str
    task_id:    str
    response:   str


class AdmitPatientResponse(BaseModel):
    status:     str
    message:    str
    patient_id: Optional[str] = None