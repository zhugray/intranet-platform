// packages/api/src/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../common/queue/queue.module';

@Module({
  imports: [StorageModule, QueueModule],
  providers: [DocumentsService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
