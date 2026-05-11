// packages/api/src/common/queue/queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface VectorizationJobData {
  docId: string;
  fileUrl: string;
  fileType: string;
  deptId: string;
  title?: string;
  deptName?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly aiEngineUrl: string;

  constructor(private config: ConfigService) {
    this.aiEngineUrl = this.config.get<string>('AI_ENGINE_URL', 'http://localhost:8000');
  }

  /**
   * Fire-and-forget: submit a document to the AI engine for vectorization.
   */
  async addVectorizationJob(data: VectorizationJobData): Promise<void> {
    const url = `${this.aiEngineUrl}/vectorize`;

    // Fire and forget — do not await in the caller
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: data.docId,
        file_url: data.fileUrl,
        file_type: data.fileType,
        dept_id: data.deptId,
        title: data.title || '',
        dept_name: data.deptName || '',
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          this.logger.error(
            `Vectorization job failed for doc ${data.docId}: HTTP ${res.status} — ${text}`,
          );
        } else {
          this.logger.log(`Vectorization job submitted for doc ${data.docId}`);
        }
      })
      .catch((err) => {
        this.logger.error(
          `Vectorization job request error for doc ${data.docId}:`,
          err?.message,
        );
      });
  }

  /**
   * Fire-and-forget: delete all vectors for a document from the AI engine.
   */
  async deleteDocumentVectors(docId: string): Promise<void> {
    const url = `${this.aiEngineUrl}/vectorize/${docId}`;

    fetch(url, { method: 'DELETE' })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          this.logger.error(
            `Delete vectors failed for doc ${docId}: HTTP ${res.status} — ${text}`,
          );
        } else {
          this.logger.log(`Vectors deleted for doc ${docId}`);
        }
      })
      .catch((err) => {
        this.logger.error(
          `Delete vectors request error for doc ${docId}:`,
          err?.message,
        );
      });
  }
}
