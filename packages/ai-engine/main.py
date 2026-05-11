# packages/ai-engine/main.py
"""
Company Intranet Platform - AI Knowledge Engine
FastAPI + Qdrant RAG architecture
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import logging

from services.vectorizer import VectorizerService
from services.rag import RAGService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Company Intranet AI Knowledge Engine",
    description="RAG-based enterprise knowledge Q&A service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("API_URL", "http://localhost:4000")],
    allow_methods=["*"],
    allow_headers=["*"],
)

vectorizer = VectorizerService()
rag = RAGService()


class VectorizeRequest(BaseModel):
    doc_id: str
    file_url: str
    file_type: str
    dept_id: str
    title: str = ""
    dept_name: str = ""


class ChatRequest(BaseModel):
    question: str
    user_id: str
    dept_ids: list[str]
    session_id: Optional[str] = None
    history: Optional[list[dict]] = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]
    session_id: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-engine"}


@app.post("/vectorize")
async def vectorize_document(req: VectorizeRequest, background_tasks: BackgroundTasks):
    """
    Document vectorization (async task).
    Called by NestJS API after a document is approved.
    """
    background_tasks.add_task(
        vectorizer.process_document,
        doc_id=req.doc_id,
        file_url=req.file_url,
        file_type=req.file_type,
        dept_id=req.dept_id,
        title=req.title,
        dept_name=req.dept_name,
    )
    return {"message": "Vectorization job queued", "doc_id": req.doc_id}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    AI knowledge Q&A:
    1. Retrieve relevant document chunks
    2. Build prompt
    3. Call OpenAI API
    4. Return answer + source citations
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    if len(req.question) > 1000:
        raise HTTPException(status_code=400, detail="Question too long, please keep it under 1000 characters")

    try:
        result = await rag.answer(
            question=req.question,
            dept_ids=req.dept_ids,
            history=req.history or [],
            session_id=req.session_id,
        )
        return result
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="AI service is temporarily unavailable, please try again later")


@app.delete("/vectorize/{doc_id}")
async def delete_vectors(doc_id: str):
    """Delete document vectors (called when a document is deleted)."""
    await vectorizer.delete_document_vectors(doc_id)
    return {"message": "Vectors deleted", "doc_id": doc_id}
