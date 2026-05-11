// packages/api/src/storage/storage.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private readonly bucket: string;
  private readonly endpointBase: string;

  constructor(private config: ConfigService) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10);
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';

    this.bucket = this.config.get<string>('MINIO_BUCKET', 'intranet-docs');
    this.endpointBase = `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`;

    this.client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Bucket "${this.bucket}" created`);
      } else {
        this.logger.log(`Bucket "${this.bucket}" already exists`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure bucket exists: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Upload a file to MinIO.
   * @param key   Object key / path inside the bucket
   * @param stream Readable stream of the file contents
   * @param contentType MIME type of the file
   * @returns Full URL to the stored object
   */
  async upload(key: string, stream: Readable, contentType: string): Promise<string> {
    const metaData = { 'Content-Type': contentType };
    await this.client.putObject(this.bucket, key, stream, undefined, metaData);
    this.logger.log(`Uploaded object: ${key}`);
    return `${this.endpointBase}/${this.bucket}/${key}`;
  }

  /**
   * Generate a presigned URL for temporary read access.
   * @param keyOrUrl Either the object key or the full stored URL
   * @param expirySeconds How many seconds the URL should remain valid (default: 900 = 15 min)
   */
  async getPresignedUrl(keyOrUrl: string, expirySeconds = 900): Promise<string> {
    const key = this.extractKey(keyOrUrl);
    const url = await this.client.presignedGetObject(this.bucket, key, expirySeconds);
    return url;
  }

  /**
   * Delete an object from MinIO.
   * @param keyOrUrl Either the object key or the full stored URL
   */
  async delete(keyOrUrl: string): Promise<void> {
    const key = this.extractKey(keyOrUrl);
    try {
      await this.client.removeObject(this.bucket, key);
      this.logger.log(`Deleted object: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete object ${key}: ${error?.message}`);
    }
  }

  /**
   * Extracts the object key from either a raw key or a full MinIO URL.
   */
  private extractKey(keyOrUrl: string): string {
    const prefix = `${this.endpointBase}/${this.bucket}/`;
    if (keyOrUrl.startsWith(prefix)) {
      return keyOrUrl.slice(prefix.length);
    }
    // Also handle URLs without port (e.g. https://host/bucket/key)
    const bucketPrefix = `/${this.bucket}/`;
    const idx = keyOrUrl.indexOf(bucketPrefix);
    if (idx !== -1) {
      return keyOrUrl.slice(idx + bucketPrefix.length);
    }
    return keyOrUrl;
  }
}
