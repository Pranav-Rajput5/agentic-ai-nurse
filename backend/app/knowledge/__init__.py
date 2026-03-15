"""
app/knowledge/__init__.py

Exposes KnowledgeBase — a thin wrapper over MedicalKnowledgeBase.

KEY CHANGE: accepts patient_id so every patient gets an isolated
Chroma collection.  The rest of the app only needs to call ask_nurse().
"""

from .ingestion import MedicalKnowledgeBase


class KnowledgeBase:
    """
    Public interface for the RAG knowledge base.

    Usage:
        kb = KnowledgeBase(pdf_path="path/to/discharge.pdf", patient_id="p_001")
        answer = kb.ask_nurse("When do I take my medication?")
    """

    def __init__(self, pdf_path: str, patient_id: str = "global") -> None:
        self._kb = MedicalKnowledgeBase(pdf_path, patient_id=patient_id)
        self._ready = False

        # Ingest + setup in one call
        if self._kb.ingest_document():
            self._ready = self._kb.setup_agentic_retriever()

    @property
    def is_ready(self) -> bool:
        return self._ready

    def ask_nurse(self, query: str) -> str:
        """Delegate to the underlying MedicalKnowledgeBase."""
        if not self._ready:
            return "Knowledge base is not ready yet."
        return self._kb.ask_nurse(query)