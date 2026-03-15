"""
app/agents/recovery_agent.py

RecoveryAgent — core AI pipeline for post-discharge patient triage.

Pipeline:
  1. RAG  — retrieve relevant context from patient's discharge KB
  2. Triage — classify message + estimate risk (returns JSON)
  3. Nurse Response — generate empathetic plain-text reply
"""

import json
import re
from typing import Any, Dict

from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI, HarmBlockThreshold, HarmCategory

from .prompts import TRIAGE_SYSTEM_PROMPT, NURSE_RESPONSE_PROMPT


class RecoveryAgent:
    def __init__(self, knowledge_base):
        self.kb = knowledge_base

        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.3,
            safety_settings={
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            },
        )

    # Private Helpers

    def _clean_json_string(self, json_str: str) -> str:
        cleaned = re.sub(r"^```json\s*", "", json_str.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"^```\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned).strip()
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        return match.group(0).strip() if match else cleaned

    def _normalize_response(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "risk_score": 1,
            "action": "LOG",
            "category": "General",
            "patient_reply": "",
        }

        if "risk_score" in raw:
            try:
                result["risk_score"] = max(0, min(10, int(raw["risk_score"])))
            except (TypeError, ValueError):
                pass

        if "action" in raw and isinstance(raw["action"], str):
            action = raw["action"].upper().strip()
            if action in {"LOG", "FLAG", "ALERT"}:
                result["action"] = action

        if "category" in raw and isinstance(raw["category"], str):
            result["category"] = raw["category"].strip() or result["category"]

        if "patient_reply" in raw:
            result["patient_reply"] = str(raw["patient_reply"]).strip()

        return result

    # Main Entry Point

    def run(self, user_message: str) -> Dict[str, Any]:
        """
        Full triage + response pipeline.

        Returns:
            {
                "risk_score":    int 0–10,
                "action":        "LOG" | "FLAG" | "ALERT",
                "category":      str,
                "patient_reply": str,
            }
        """
        # ── Step 1: RAG retrieval ──
        try:
            context = self.kb.ask_nurse(user_message)
        except AttributeError:
            context = "Medical records unavailable."
        except Exception as e:
            print(f"[Agent] RAG Error: {e}")
            context = "Error retrieving records."

        # ── Step 2: Triage ──
        triage_raw: Dict[str, Any] = {}
        triage_category = "ROUTINE_CHECKIN"
        triage_risk = 1
        action = "LOG"
        nurse_reply = ""

        try:
            triage_prompt = PromptTemplate.from_template(
                """{system_prompt}

CONTEXT FROM MEDICAL RECORDS:
{context}

PATIENT MESSAGE:
"{message}"

Reply ONLY with the JSON object described above. Do not include markdown or extra text.
"""
            )
            triage_response = (triage_prompt | self.llm).invoke(
                {
                    "system_prompt": TRIAGE_SYSTEM_PROMPT,
                    "context": context,
                    "message": user_message,
                }
            )

            triage_clean = self._clean_json_string(triage_response.content)
            triage_raw = json.loads(triage_clean)

            triage_category = str(triage_raw.get("category", "ROUTINE_CHECKIN")).upper()
            try:
                triage_risk = int(triage_raw.get("risk_score", 1))
            except (TypeError, ValueError):
                triage_risk = 1

            # ── Step 3: Map to action ──
            if triage_risk >= 8 or triage_category == "CRITICAL":
                action = "ALERT"
            elif triage_risk >= 4 or triage_category == "MEDICAL_QUESTION":
                action = "FLAG"
            else:
                action = "LOG"

            # ── Step 4: Nurse response ──
            nurse_prompt = PromptTemplate.from_template(
                """{system_prompt}

DISCHARGE / MEDICAL CONTEXT:
{context}

TRIAGE RESULT (JSON):
{triage_json}

PATIENT MESSAGE:
"{message}"

Respond with a single empathetic message addressed to the patient.
Do NOT include JSON or markdown, just the plain-text response.
"""
            )
            nurse_response = (nurse_prompt | self.llm).invoke(
                {
                    "system_prompt": NURSE_RESPONSE_PROMPT,
                    "context": context,
                    "triage_json": json.dumps(triage_raw),
                    "message": user_message,
                }
            )
            nurse_reply = nurse_response.content

        except json.JSONDecodeError as e:
            print(f"[Agent] ⚠️  JSON parse failed: {e}. Using safe fallback.")
            if not nurse_reply:
                nurse_reply = (
                    "I received your message. Please call a nurse if this is urgent."
                )

        except Exception as e:
            print(f"[Agent] ❌  Error: {e}")
            return {
                "risk_score": 1,
                "action": "LOG",
                "category": "Error",
                "patient_reply": "I am having trouble connecting. Please call a nurse if this is urgent.",
            }

        return self._normalize_response(
            {
                "risk_score": triage_risk,
                "action": action,
                "category": triage_category,
                "patient_reply": nurse_reply,
            }
        )


# Manual test
if __name__ == "__main__":
    class MockKB:
        def ask_nurse(self, q):
            return "Patient 3 days post-op appendectomy. Prescribed Amoxicillin 500mg."

    agent = RecoveryAgent(knowledge_base=MockKB())
    print("\n--- TEST 1: Critical ---")
    print(agent.run("My chest feels like an elephant is sitting on it."))
    print("\n--- TEST 2: Medical Question ---")
    print(agent.run("I threw up my medication and feel dizzy."))