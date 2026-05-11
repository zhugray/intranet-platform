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
  private available = false;

  constructor(private config: ConfigService) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT', '');
    const port = parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10);
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';

    this.bucket = this.config.get<string>('MINIO_BUCKET', 'intranet-docs');

    if (!endpoint) {
      this.logger.warn('MINIO_ENDPOINT not configured — file storage disabled');
      this.endpointBase = '';
      this.client = null as any;
      return;
    }

    this.endpointBase = `${useSSL ? 'https' : 'http'}://${endpoint}${useSSL && port === 443 ? '' : `:${port}`}`;

    this.client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }

  async onModuleInit() {
    if (!this.client) return;
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
      this.available = true;
    } catch (error) {
      this.logger.error(`Storage unavailable: ${error?.message}`);
      this.available = false;
    }
  }

  async upload(key: string, stream: Readable, contentType: string): Promise<string> {
    if (!this.client || !this.available) {
      this.logger.warn(`Storage not available — saving placeholder for key: ${key}`);
      return `storage-pending://${key}`;
    }
    const metaData = { 'Content-Type': contentType };
    await this.client.putObject(this.bucket, key, stream, undefined, metaData);
    this.logger.log(`Uploaded object: ${key}`);
    return `${this.endpointBase}/${this.bucket}/${key}`;
  }

  async getPresignedUrl(keyOrUrl: string, expirySeconds = 900): Promise<string> {
    if (!this.client || !this.available || keyOrUrl.startsWith('storage-pending://')) {
      return keyOrUrl;
    }
    const key = this.extractKey(keyOrUrl);
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async delete(keyOrUrl: string): Promise<void> {
    if (!this.client || !this.available || keyOrUrl.startsWith('storage-pending://')) return;
    const key = this.extractKey(keyOrUrl);
    try {
      await this.client.removeObject(this.bucket, key);
      this.logger.log(`Deleted object: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete object ${key}: ${error?.message}`);
    }
  }

  private extractKey(keyOrUrl: string): string {
    const prefix = `${this.endpointBase}/${this.bucket}/`;
    if (keyOrUrl.startsWith(prefix)) {
      return keyOrUrl.slice(prefix.length);
    }
    const bucketPrefix = `/${this.bucket}/`;
    const idx = keyOrUrl.indexOf(bucketPrefix);
    if (idx !== -1) {
      return keyOrUrl.slice(idx + bucketPrefix.length);
    }
    return keyOrUrl;
  }
}
