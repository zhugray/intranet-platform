// packages/api/src/documents/documents.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { Role, DocCategory, DocStatus } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DEPT_EDITOR)
  @ApiOperation({ summary: 'Upload document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Unsupported file type. Allowed: PDF, DOCX, TXT, XLSX',
            ),
            false,
          );
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('category') category: DocCategory,
    @Body('deptId') deptId: string,
    @Body('tags') rawTags: string | string[],
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    if (!file) throw new BadRequestException('Please upload a file');
    if (!title) throw new BadRequestException('Document title is required');
    if (!deptId) throw new BadRequestException('Please select a department');
    if (!category) throw new BadRequestException('Please select a category');

    // Normalize tags: may come as comma-separated string or array
    let tags: string[] = [];
    if (rawTags) {
      if (Array.isArray(rawTags)) {
        tags = rawTags;
      } else {
        tags = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    return this.documentsService.uploadDocument(
      file,
      { title, description, category, tags, deptId },
      userId,
      userRole,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Document list' })
  findAll(
    @Query('category') category?: DocCategory,
    @Query('deptId') deptId?: string,
    @Query('status') status?: DocStatus,
    @Query('q') q?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.documentsService.findDocuments({
      category,
      deptId,
      status,
      q,
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Document details' })
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get document download URL' })
  getDownloadUrl(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.getDownloadUrl(id, userId);
  }

  @Patch(':id/review')
  @UseGuards(RolesGuard)
  @Roles(Role.DEPT_ADMIN)
  @ApiOperation({ summary: 'Review document (Dept Admin and above)' })
  review(
    @Param('id') id: string,
    @Body('status') status: 'APPROVED' | 'REJECTED',
    @Body('rejectReason') rejectReason: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.documentsService.reviewDocument(
      id,
      { status, rejectReason },
      userId,
      userRole,
    );
  }

  @Patch(':id/vectorized')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark document as vectorized (internal)' })
  async markVectorized(@Param('id') id: string, @Req() req: Request) {
    const token = req.headers['x-internal-token'];
    if (!token || token !== process.env.INTERNAL_TOKEN) {
      throw new ForbiddenException('Internal endpoint, access denied');
    }

    return this.documentsService.markVectorized(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DEPT_EDITOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete document' })
  delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.documentsService.deleteDocument(id, userId, userRole);
  }
}
