// packages/api/src/common/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';

@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
