// packages/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Infrastructure
import { PrismaModule } from './common/prisma/prisma.module';
import { MailModule } from './common/mail/mail.module';
import { QueueModule } from './common/queue/queue.module';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { DocumentsModule } from './documents/documents.module';
import { NoticesModule } from './notices/notices.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    // Global config — available everywhere without explicit import
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Infrastructure (PrismaModule is @Global so PrismaService is available everywhere)
    PrismaModule,
    MailModule,
    QueueModule,
    StorageModule,

    // Feature modules
    AuthModule,
    UsersModule,
    DepartmentsModule,
    DocumentsModule,
    NoticesModule,
    AiModule,
  ],
})
export class AppModule {}
