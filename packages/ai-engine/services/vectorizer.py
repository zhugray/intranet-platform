# packages/ai-engine/services/vectorizer.py
"""
Document vectorization service
Flow: download file → parse text → chunk → embed → store in Qdrant
"""

import os
import io
import logging
import httpx
from typing import Optional
from openai import AsyncOpenAI
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    PointStruct,
    VectorParams,
    Distance,
    FilterSelector,
    Filter,
    FieldCondition,
    MatchValue,
)

logger = logging.getLogger(__name__)

# Document parsing dependencies (install as needed)
try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

try:
    from docx import Document as DocxDocument
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False


class VectorizerService:
    def __init__(self):
        self.openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        qdrant_url = os.getenv("QDRANT_URL", "")
        self.qdrant = AsyncQdrantClient(url=qdrant_url, timeout=5) if qdrant_url else None
        self.collection = os.getenv("QDRANT_COLLECTION", "intranet_docs")
        self.embedding_model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
        self.chunk_size = int(os.getenv("RAG_CHUNK_SIZE", "512"))
        self.chunk_overlap = int(os.getenv("RAG_CHUNK_OVERLAP", "64"))
        self.embedding_dim = int(os.getenv("EMBEDDING_DIMENSION", "1536"))

    async def ensure_collection(self):
        """Ensure the Qdrant collection exists."""
        collections = await self.qdrant.get_collections()
        names = [c.name for c in collections.collections]

        if self.collection not in names:
            await self.qdrant.create_collection(
                collection_name=self.collection,
                vectors_config=VectorParams(
                    size=self.embedding_dim,
                    distance=Distance.COSINE,
                ),
            )
            logger.info(f"Created Qdrant collection: {self.collection}")

    async def process_document(
        self,
        doc_id: str,
        file_url: str,
        file_type: str,
        dept_id: str,
        title: str = "",
        dept_name: str = "",
    ):
        """Main processing pipeline."""
        if not self.qdrant:
            logger.warning(f"Qdrant not configured — skipping vectorization for {doc_id}")
            return

        try:
            logger.info(f"Processing document: {doc_id}")

            file_bytes = await self._download_file(file_url)

            text = self._parse_file(file_bytes, file_type)
            if not text.strip():
                logger.warning(f"Empty text extracted from {doc_id}")
                return

            chunks = self._split_text(text)
            logger.info(f"Document {doc_id}: {len(chunks)} chunks")

            await self.ensure_collection()
            await self._upsert_chunks(chunks, doc_id, dept_id, title, dept_name)

            await self._notify_vectorized(doc_id)

            logger.info(f"Document {doc_id} vectorized successfully")

        except Exception as e:
            logger.error(f"Failed to vectorize {doc_id}: {e}")
            raise

    async def delete_document_vectors(self, doc_id: str):
        """Delete all vector points for a document."""
        await self.qdrant.delete(
            collection_name=self.collection,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
                )
            ),
        )
        logger.info(f"Deleted vectors for document: {doc_id}")

    async def _download_file(self, file_url: str) -> bytes:
        """Download file from object storage."""
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(file_url)
            response.raise_for_status()
            return response.content

    def _parse_file(self, file_bytes: bytes, file_type: str) -> str:
        """Parse file content to plain text."""
        file_type = file_type.lower().strip(".")

        if file_type == "pdf":
            return self._parse_pdf(file_bytes)
        elif file_type in ("docx", "doc"):
            return self._parse_docx(file_bytes)
        elif file_type == "txt":
            return file_bytes.decode("utf-8", errors="ignore")
        elif file_type == "md":
            return file_bytes.decode("utf-8", errors="ignore")
        else:
            logger.warning(f"Unsupported file type: {file_type}")
            return ""

    def _parse_pdf(self, file_bytes: bytes) -> str:
        if not HAS_PYPDF:
            raise RuntimeError("pypdf not installed. Run: pip install pypdf")
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        texts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                texts.append(text)
        return "\n\n".join(texts)

    def _parse_docx(self, file_bytes: bytes) -> str:
        if not HAS_DOCX:
            raise RuntimeError("python-docx not installed. Run: pip install python-docx")
        doc = DocxDocument(io.BytesIO(file_bytes))
        return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])

    def _split_text(self, text: str) -> list[str]:
        """
        Sliding window chunking.
        chunk_size: max characters per chunk
        chunk_overlap: overlap between adjacent chunks
        """
        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = min(start + self.chunk_size, text_len)
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            if end == text_len:
                break
            start = end - self.chunk_overlap

        return chunks

    async def _upsert_chunks(
        self,
        chunks: list[str],
        doc_id: str,
        dept_id: str,
        title: str,
        dept_name: str,
    ):
        """Batch embed chunks and upsert into Qdrant."""
        batch_size = 100
        points = []

        for batch_start in range(0, len(chunks), batch_size):
            batch = chunks[batch_start : batch_start + batch_size]

            response = await self.openai.embeddings.create(
                model=self.embedding_model,
                input=batch,
            )

            for i, embedding_data in enumerate(response.data):
                chunk_index = batch_start + i
                point_id = f"{doc_id}_{chunk_index}"

                points.append(
                    PointStruct(
                        id=abs(hash(point_id)) % (2**63),  # Qdrant requires uint64
                        vector=embedding_data.embedding,
                        payload={
                            "doc_id": doc_id,
                            "dept_id": dept_id,
                            "title": title,
                            "dept_name": dept_name,
                            "chunk_index": chunk_index,
                            "text": batch[i],
                        },
                    )
                )

        await self.qdrant.upsert(collection_name=self.collection, points=points)

    async def _notify_vectorized(self, doc_id: str):
        """Notify the API service to update the vectorization status."""
        api_url = os.getenv("API_URL", "http://localhost:4000")
        async with httpx.AsyncClient() as client:
            try:
                await client.patch(
                    f"{api_url}/api/v1/documents/{doc_id}/vectorized",
                    json={"vectorized": True},
                    headers={"X-Internal-Token": os.getenv("INTERNAL_TOKEN", "")},
                    timeout=10,
                )
            except Exception as e:
                logger.warning(f"Failed to notify API for {doc_id}: {e}")
