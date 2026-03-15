import os
from datetime import datetime
from typing import Any, Dict

import firebase_admin
from firebase_admin import credentials, firestore


class LogManager:
    """
    Helper for logging high-level patient interactions to Firestore
    for clinician review.
    """

    def __init__(self, service_account_path: str | None = None) -> None:
        """
        Initialize Firebase app (idempotent) and Firestore client.

        If `service_account_path` is not provided, it will look for
        FIREBASE_SERVICE_ACCOUNT in the environment, and fall back to
        'serviceAccountKey.json'.
        """
        if service_account_path is None:
            service_account_path = (
                os.getenv("FIREBASE_SERVICE_ACCOUNT") or "serviceAccountKey.json"
            )

        if not firebase_admin._apps:
            if not os.path.exists(service_account_path):
                raise FileNotFoundError(
                    f"Firebase service account JSON not found at: {service_account_path}"
                )
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)

        self.db = firestore.client()

    def log_interaction(
        self,
        patient_id: str,
        message: str,
        risk_score: int,
        response: str,
    ) -> Dict[str, Any]:
        """
        Save an interaction to Firestore for the Doctor's Dashboard.

        Returns the log entry dict for optional further use.
        """
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(),
            "patient_message": message,
            "agent_response": response,
            "risk_score": int(risk_score),
            "alert_triggered": risk_score >= 7,
        }

        self.db.collection("patients").document(patient_id).collection("logs").add(
            log_entry
        )
        print(f"--- Interaction Logged for Patient {patient_id} ---")
        return log_entry