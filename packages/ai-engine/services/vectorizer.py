# packages/ai-engine/services/vectorizer.py
"""
Document vectorization service
Flow: download file → parse text → chunk → embed → store in PostgreSQL pgvector
"""

import os
import io
import logging
import httpx
from openai import AsyncOpenAI
import psycopg
from pgvector.psycopg import register_vector_async

logger = logging.getLogger(__name__)

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
        self.db_url = os.getenv("DATABASE_URL", "")
        self.embedding_model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
        self.chunk_size = int(os.getenv("RAG_CHUNK_SIZE", "512"))
        self.chunk_overlap = int(os.getenv("RAG_CHUNK_OVERLAP", "64"))

    async def ensure_table(self, conn):
        """Create the document_vectors table and pgvector extension if not exist."""
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS document_vectors (
                id BIGINT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                dept_id TEXT NOT NULL,
                title TEXT DEFAULT '',
                dept_name TEXT DEFAULT '',
                chunk_index INT DEFAULT 0,
                text TEXT DEFAULT '',
                embedding vector(1536)
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS document_vectors_dept_idx ON document_vectors(dept_id)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS document_vectors_emb_idx ON document_vectors "
            "USING hnsw (embedding vector_cosine_ops)"
        )

    async def process_document(
        self,
        doc_id: str,
        file_url: str,
        file_type: str,
        dept_id: str,
        title: str = "",
        dept_name: str = "",
    ):
        if not self.db_url:
            logger.warning(f"DATABASE_URL not set — skipping vectorization for {doc_id}")
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

            async with await psycopg.AsyncConnection.connect(self.db_url) as conn:
                await register_vector_async(conn)
                await self.ensure_table(conn)
                await self._upsert_chunks(conn, chunks, doc_id, dept_id, title, dept_name)

            await self._notify_vectorized(doc_id)
            logger.info(f"Document {doc_id} vectorized successfully")

        except Exception as e:
            logger.error(f"Failed to vectorize {doc_id}: {e}")
            raise

    async def delete_document_vectors(self, doc_id: str):
        if not self.db_url:
            return
        async with await psycopg.AsyncConnection.connect(self.db_url) as conn:
            await conn.execute("DELETE FROM document_vectors WHERE doc_id = %s", (doc_id,))
        logger.info(f"Deleted vectors for document: {doc_id}")

    async def _download_file(self, file_url: str) -> bytes:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(file_url)
            response.raise_for_status()
            return response.content

    def _parse_file(self, file_bytes: bytes, file_type: str) -> str:
        file_type = file_type.lower().strip(".")
        if file_type == "pdf":
            return self._parse_pdf(file_bytes)
        elif file_type in ("docx", "doc"):
            return self._parse_docx(file_bytes)
        elif file_type in ("txt", "md"):
            return file_bytes.decode("utf-8", errors="ignore")
        else:
            logger.warning(f"Unsupported file type: {file_type}")
            return ""

    def _parse_pdf(self, file_bytes: bytes) -> str:
        if not HAS_PYPDF:
            raise RuntimeError("pypdf not installed")
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        return "\n\n".join(p.extract_text() for p in reader.pages if p.extract_text())

    def _parse_docx(self, file_bytes: bytes) -> str:
        if not HAS_DOCX:
            raise RuntimeError("python-docx not installed")
        doc = DocxDocument(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    def _split_text(self, text: str) -> list[str]:
        chunks, start = [], 0
        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            if end == len(text):
                break
            start = end - self.chunk_overlap
        return chunks

    async def _upsert_chunks(self, conn, chunks, doc_id, dept_id, title, dept_name):
        for batch_start in range(0, len(chunks), 100):
            batch = chunks[batch_start: batch_start + 100]
            response = await self.openai.embeddings.create(
                model=self.embedding_model,
                input=batch,
            )
            for i, emb_data in enumerate(response.data):
                idx = batch_start + i
                chunk_id = abs(hash(f"{doc_id}_{idx}")) % (2 ** 63)
                await conn.execute(
                    """
                    INSERT INTO document_vectors
                        (id, doc_id, dept_id, title, dept_name, chunk_index, text, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        doc_id = EXCLUDED.doc_id,
                        dept_id = EXCLUDED.dept_id,
                        title = EXCLUDED.title,
                        dept_name = EXCLUDED.dept_name,
                        chunk_index = EXCLUDED.chunk_index,
                        text = EXCLUDED.text,
                        embedding = EXCLUDED.embedding
                    """,
                    (chunk_id, doc_id, dept_id, title, dept_name, idx, batch[i], emb_data.embedding),
                )

    async def _notify_vectorized(self, doc_id: str):
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
