// packages/api/src/documents/documents.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../common/queue/queue.service';
import { DocCategory, DocStatus, Role } from '@prisma/client';
import { Readable } from 'stream';

interface UploadDocDto {
  title: string;
  description?: string;
  category: DocCategory;
  tags?: string[];
  deptId: string;
}

interface ReviewDocDto {
  status: 'APPROVED' | 'REJECTED';
  rejectReason?: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private queue: QueueService,
  ) {}

  async uploadDocument(
    file: Express.Multer.File,
    dto: UploadDocDto,
    uploaderId: string,
    uploaderRole: Role,
  ) {
    if (uploaderRole === Role.DEPT_EDITOR) {
      const uploader = await this.prisma.user.findUnique({
        where: { id: uploaderId },
        select: { deptId: true },
      });
      if (uploader?.deptId !== dto.deptId) {
        throw new ForbiddenException('You can only upload to your own department');
      }
    }

    const fileKey = `docs/${dto.deptId}/${Date.now()}-${file.originalname}`;
    const fileUrl = await this.storage.upload(
      fileKey,
      Readable.from(file.buffer),
      file.mimetype,
    );

    const doc = await this.prisma.document.create({
      data: {
        title: dto.title,
        description: dto.description,
        fileUrl,
        fileName: file.originalname,
        fileType: file.originalname.split('.').pop()?.toLowerCase() || 'unknown',
        fileSize: file.size,
        category: dto.category,
        tags: dto.tags || [],
        deptId: dto.deptId,
        uploadedById: uploaderId,
        status: DocStatus.PENDING,
      },
      include: {
        department: { select: { name: true } },
        uploadedBy: { select: { name: true } },
      },
    });

    return doc;
  }

  async reviewDocument(
    docId: string,
    dto: ReviewDocDto,
    reviewerId: string,
    reviewerRole: Role,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
      include: { department: true },
    });

    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status !== DocStatus.PENDING) {
      throw new BadRequestException('Document has already been reviewed');
    }

    if (reviewerRole === Role.DEPT_ADMIN) {
      const reviewer = await this.prisma.user.findUnique({
        where: { id: reviewerId },
        select: { deptId: true },
      });
      if (reviewer?.deptId !== doc.deptId) {
        throw new ForbiddenException('You can only review documents from your own department');
      }
    }

    const updated = await this.prisma.document.update({
      where: { id: docId },
      data: {
        status: dto.status,
        rejectReason: dto.rejectReason,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    if (dto.status === DocStatus.APPROVED) {
      const presignedUrl = await this.storage.getPresignedUrl(doc.fileUrl, 3600);
      await this.queue.addVectorizationJob({
        docId: doc.id,
        fileUrl: presignedUrl,
        fileType: doc.fileType,
        deptId: doc.deptId,
        title: doc.title,
        deptName: doc.department?.name || '',
      });
    }

    return updated;
  }

  async findDocuments(query: {
    category?: DocCategory;
    deptId?: string;
    status?: DocStatus;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { category, deptId, status, q, page = 1, limit = 20 } = query;

    const where: any = {};
    if (category) where.category = category;
    if (deptId) where.deptId = deptId;
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          uploadedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDownloadUrl(docId: string, userId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
    });
    if (!doc || doc.status !== DocStatus.APPROVED) {
      throw new NotFoundException('Document not found');
    }

    const url = await this.storage.getPresignedUrl(doc.fileUrl, 900);
    return { url, fileName: doc.fileName };
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        department: true,
        uploadedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async markVectorized(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');

    return this.prisma.document.update({
      where: { id },
      data: { vectorized: true, vectorizedAt: new Date() },
      select: { id: true, vectorized: true, vectorizedAt: true },
    });
  }

  async deleteDocument(id: string, userId: string, userRole: Role) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');

    if (doc.uploadedById !== userId && userRole === Role.DEPT_EDITOR) {
      throw new ForbiddenException('You do not have permission to delete this document');
    }

    await this.storage.delete(doc.fileUrl);
    await this.prisma.document.delete({ where: { id } });
    return { message: 'Document deleted' };
  }
}
