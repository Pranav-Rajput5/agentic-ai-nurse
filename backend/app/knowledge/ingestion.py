"""
app/knowledge/ingestion.py

RAG knowledge base for patient discharge summaries.

KEY IMPROVEMENT: Each patient gets their own isolated Chroma collection
(collection_name = "patient_{patient_id}"), so queries are scoped to
that patient's discharge documents only.
"""

import os
from typing import Optional

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_chroma import Chroma
from langchain_core.prompts import PromptTemplate
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain

load_dotenv()


class MedicalKnowledgeBase:
    """
    Per-patient RAG knowledge base backed by:
    - HuggingFace embeddings (local) + Chroma (persistent, per-patient collection)
    - Gemini for grounded answer generation

    Each patient is isolated in their own Chroma collection so that RAG
    queries NEVER leak data across patients.
    """

    def __init__(
        self,
        pdf_path: str,
        patient_id: str = "global",
        persist_directory: str = "./chroma_db",
    ) -> None:
        self.pdf_path = pdf_path
        self.persist_directory = persist_directory
        self.patient_id = patient_id

        # Each patient gets a unique Chroma collection
        self.collection_name = f"patient_{patient_id}"

        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment variables")

        # Local embeddings — no network call required
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

        # Gemini for answer generation
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.1,
            google_api_key=api_key,
        )

        self.vector_db: Optional[Chroma] = None
        self.rag_chain = None

    # Step 1: Ingest PDF into per-patient collection

    def ingest_document(self) -> bool:
        """
        Build (or load) a per-patient Chroma collection from the discharge PDF.
        Returns True if the vector DB is ready, False otherwise.
        """
        # Always attempt to open the existing collection first
        try:
            existing = Chroma(
                collection_name=self.collection_name,
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings,
            )
            # If collection already has documents, skip re-ingestion
            if existing._collection.count() > 0:
                print(
                    f"[KB] Loading existing collection '{self.collection_name}' "
                    f"({existing._collection.count()} chunks)"
                )
                self.vector_db = existing
                return True
        except Exception:
            pass  

        # Create new collection from PDF
        if not os.path.exists(self.pdf_path):
            print(f"[KB] ⚠️  PDF not found: {self.pdf_path}. Skipping ingestion.")
            return False

        print(f"[KB] Ingesting '{self.pdf_path}' → collection '{self.collection_name}'")

        loader = PyPDFLoader(self.pdf_path)
        pages = loader.load()

        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        docs = splitter.split_documents(pages)

        # Tag every chunk with patient_id for future filtered queries
        for doc in docs:
            doc.metadata["patient_id"] = self.patient_id

        self.vector_db = Chroma.from_documents(
            documents=docs,
            embedding=self.embeddings,
            collection_name=self.collection_name,
            persist_directory=self.persist_directory,
        )
        print(
            f"[KB] ✅  Collection '{self.collection_name}' created "
            f"({len(docs)} chunks ingested)"
        )
        return True

    # Step 2: Build retrieval chain

    def setup_agentic_retriever(self) -> bool:
        """
        Build the LCEL RAG chain. Must be called after ingest_document().
        Returns True if chain is ready.
        """
        if not self.vector_db:
            print("[KB] ⚠️  Vector DB not ready. Call ingest_document() first.")
            return False

        template = """
        You are an Agentic AI Nurse. Use the patient's discharge context below to answer their question.

        PATIENT DISCHARGE CONTEXT:
        {context}

        PATIENT QUESTION:
        {input}

        INSTRUCTIONS:
        1. Answer strictly based on the discharge context provided.
        2. If the info is not in the context, say: "I don't have that specific information in your discharge papers."
        3. Keep the tone professional, warm, and empathetic.
        4. Never contradict what is written in the discharge context.
        """
        prompt = PromptTemplate.from_template(template)

        retriever = self.vector_db.as_retriever(search_kwargs={"k": 3})
        qa_chain = create_stuff_documents_chain(self.llm, prompt)
        self.rag_chain = create_retrieval_chain(retriever, qa_chain)

        print(f"[KB] ✅  RAG chain ready for patient '{self.patient_id}'")
        return True

    # Step 3: Query

    def ask_nurse(self, query: str) -> str:
        """Run the RAG chain and return a grounded answer."""
        if not self.rag_chain:
            return "Knowledge base not initialized."

        try:
            response = self.rag_chain.invoke({"input": query})
            return response.get("answer", "No answer found.")
        except Exception as e:
            print(f"[KB] ❌  RAG query failed: {e}")
            return "Error retrieving information from discharge papers."

# Manual test

if __name__ == "__main__":
    kb = MedicalKnowledgeBase("patient_discharge.pdf", patient_id="test_001")
    if kb.ingest_document():
        kb.setup_agentic_retriever()
        print(kb.ask_nurse("What is my pain medication?"))