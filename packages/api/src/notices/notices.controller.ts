// packages/api/src/notices/notices.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { NoticesService } from './notices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Notices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notices')
export class NoticesController {
  constructor(private noticesService: NoticesService) {}

  @Get()
  @ApiOperation({ summary: 'Get notice list' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.noticesService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notice details' })
  findOne(@Param('id') id: string) {
    return this.noticesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Publish notice (Super Admin only)' })
  create(
    @Body()
    dto: {
      title: string;
      content: string;
      pinned?: boolean;
      expiresAt?: string;
    },
    @CurrentUser('id') authorId: string,
  ) {
    return this.noticesService.create(dto, authorId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update notice (Super Admin only)' })
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      title?: string;
      content?: string;
      pinned?: boolean;
      expiresAt?: string | null;
    },
  ) {
    return this.noticesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete notice (Super Admin only)' })
  delete(@Param('id') id: string) {
    return this.noticesService.delete(id);
  }
}
