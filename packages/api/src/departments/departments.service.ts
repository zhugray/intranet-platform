// packages/api/src/departments/departments.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

interface CreateDeptDto {
  name: string;
  code: string;
  parentId?: string;
  order?: number;
}

interface UpdateDeptDto {
  name?: string;
  code?: string;
  parentId?: string;
  order?: number;
}

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Return all departments structured as a nested tree.
   */
  async findTree() {
    const all = await this.prisma.department.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        order: true,
        createdAt: true,
        _count: { select: { users: true, documents: true } },
      },
    });

    return this.buildTree(all, null);
  }

  private buildTree(departments: any[], parentId: string | null): any[] {
    return departments
      .filter((d) => d.parentId === parentId)
      .map((d) => ({
        ...d,
        children: this.buildTree(departments, d.id),
      }));
  }

  async findOne(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        children: {
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, code: true, order: true },
        },
        _count: { select: { users: true, documents: true } },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(dto: CreateDeptDto) {
    // Verify parent exists if provided
    if (dto.parentId) {
      const parent = await this.prisma.department.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new BadRequestException('Parent department not found');
    }

    // Check unique code
    const existing = await this.prisma.department.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new BadRequestException('Department code already exists');

    return this.prisma.department.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        parentId: dto.parentId || null,
        order: dto.order ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateDeptDto) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');

    // Prevent circular references
    if (dto.parentId === id) {
      throw new BadRequestException('A department cannot be its own parent');
    }

    if (dto.code && dto.code !== dept.code) {
      const existing = await this.prisma.department.findUnique({
        where: { code: dto.code },
      });
      if (existing) throw new BadRequestException('Department code already exists');
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code.toUpperCase() }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId || null }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }

  async delete(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        _count: { select: { children: true, users: true, documents: true } },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');

    if (dept._count.children > 0) {
      throw new BadRequestException('Please delete child departments first');
    }
    if (dept._count.users > 0) {
      throw new BadRequestException('Cannot delete: department has members');
    }
    if (dept._count.documents > 0) {
      throw new BadRequestException('Cannot delete: department has documents');
    }

    await this.prisma.department.delete({ where: { id } });
    return { message: 'Department deleted' };
  }

  async findAll() {
    return this.prisma.department.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        order: true,
      },
    });
  }
}
