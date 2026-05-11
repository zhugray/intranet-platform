// packages/api/src/notices/notices.service.ts
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

interface CreateNoticeDto {
  title: string;
  content: string;
  pinned?: boolean;
  expiresAt?: string | Date;
}

interface UpdateNoticeDto {
  title?: string;
  content?: string;
  pinned?: boolean;
  expiresAt?: string | Date | null;
}

@Injectable()
export class NoticesService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const now = new Date();

    const where = {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    };

    const [total, items] = await Promise.all([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        skip,
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

  async findOne(id: string) {
    const notice = await this.prisma.notice.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
    if (!notice) throw new NotFoundException('Notice not found');
    return notice;
  }

  async create(dto: CreateNoticeDto, authorId: string) {
    return this.prisma.notice.create({
      data: {
        title: dto.title,
        content: dto.content,
        pinned: dto.pinned ?? false,
        authorId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdateNoticeDto) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');

    return this.prisma.notice.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.pinned !== undefined && { pinned: dto.pinned }),
        ...(dto.expiresAt !== undefined && {
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        }),
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
  }

  async delete(id: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');
    await this.prisma.notice.delete({ where: { id } });
    return { message: 'Notice deleted' };
  }
}
