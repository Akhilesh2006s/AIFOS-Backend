import {
  Controller, Get, Post, Patch, Delete, Param, Query, Req, Res, Body,
  UploadedFile, UploadedFiles, UseInterceptors, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { DocumentsService } from './documents.service';
import { DOCUMENT_CATEGORIES } from './schemas/platform-document.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { validateUpload } from '../../common/utils/file-validation.util';
import { safeJsonParse } from '../../common/utils/sanitize.util';
import { UpdateDocumentMetadataDto } from './dto/update-document.dto';

const uploadOpts = { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } };

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly notifications: NotificationsService,
  ) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'system';
  }

  @Get('center/dashboard')
  centerDashboard(@Query('projectId') projectId?: string) {
    return this.service.getCenterDashboard(projectId);
  }

  @Get('center/search')
  centerSearch(
    @Query('q') q?: string,
    @Query('projectId') projectId?: string,
    @Query('category') category?: string,
    @Query('approvalStatus') approvalStatus?: string,
    @Query('relatedEntityType') relatedEntityType?: string,
    @Query('tag') tag?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.service.globalSearch({
      q,
      projectId,
      category,
      approvalStatus,
      relatedEntityType,
      tag,
      includeArchived: includeArchived === 'true',
    });
  }

  @Get('by-entity')
  byEntity(@Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    if (!entityType || !entityId) throw new BadRequestException('entityType and entityId required');
    return this.service.findByEntity(entityType, entityId);
  }

  @Get('metrics')
  metrics() {
    return this.service.getOperationsMetrics();
  }

  @Get()
  list(@Query('projectId') projectId: string, @Query('category') category?: string) {
    if (!projectId) throw new BadRequestException('projectId required');
    return this.service.findByProject(projectId, category);
  }

  @Get('files/:org/:projectId/:filename')
  async serveFile(
    @Param('org') org: string,
    @Param('projectId') projectId: string,
    @Param('filename') filename: string,
    @Req() req: { user?: { role?: string; organizationId?: string } },
    @Res() res: Response,
  ) {
    const userOrg = req.user?.organizationId;
    const role = req.user?.role || 'user';
    if (userOrg && org !== userOrg && !['admin', 'org_admin', 'executive'].includes(role)) {
      throw new ForbiddenException('Cannot access files for another organization');
    }
    if (filename.includes('..') || org.includes('..') || projectId.includes('..')) {
      throw new BadRequestException('Invalid path');
    }
    const relative = path.join(org, projectId, filename);
    const { stream } = await this.service.getFileStream(relative);
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.pdf' ? 'application/pdf' : ext.match(/\.(jpg|jpeg|png|gif|webp)$/) ? `image/${ext.slice(1)}` : 'application/octet-stream';
    const isInlineImage = /^\.(jpg|jpeg|png|gif|webp)$/.test(ext);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', isInlineImage ? 'inline' : 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    stream.pipe(res);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string) {
    return this.service.getVersions(id);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  async uploadOne(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user?: { sub?: string; name?: string }; body: Record<string, string> },
  ) {
    if (!file) throw new BadRequestException('file required');
    validateUpload(file);
    const { projectId, category, title, siteId, remarks, tags, relatedEntityType, relatedEntityId, autoApprove } = req.body;
    if (!projectId || !category) throw new BadRequestException('projectId and category required');
    if (!DOCUMENT_CATEGORIES.includes(category as typeof DOCUMENT_CATEGORIES[number])) {
      throw new BadRequestException(`Invalid category. Allowed: ${DOCUMENT_CATEGORIES.join(', ')}`);
    }
    const doc = await this.service.saveUpload({
      projectId,
      siteId,
      category,
      title: title || file.originalname,
      file,
      uploadedBy: this.actor(req),
      remarks,
      tags: (() => {
        if (!tags) return [];
        try {
          const parsed = safeJsonParse<string[]>(tags, 'tags');
          if (!Array.isArray(parsed)) throw new Error('not array');
          return parsed.filter((t) => typeof t === 'string').slice(0, 50);
        } catch {
          throw new BadRequestException('Invalid tags JSON');
        }
      })(),
      relatedEntityType,
      relatedEntityId,
      autoApprove: autoApprove === 'true',
    });
    await this.notifications.create({
      projectId,
      type: 'document_uploaded',
      title: 'Document uploaded',
      message: `${doc.title} (${category})`,
      entityType: 'document',
      entityId: doc._id.toString(),
      createdBy: this.actor(req),
    });
    return doc;
  }

  @Post('upload-multiple')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10, uploadOpts))
  async uploadMany(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: { user?: { sub?: string; name?: string }; body: Record<string, string> },
  ) {
    if (!files?.length) throw new BadRequestException('files required');
    const { projectId, category, siteId, remarks, relatedEntityType, relatedEntityId } = req.body;
    if (!projectId || !category) throw new BadRequestException('projectId and category required');
    const uploadedBy = this.actor(req);
    const results = [];
    for (const file of files) {
      validateUpload(file);
      results.push(await this.service.saveUpload({
        projectId,
        siteId,
        category,
        title: file.originalname,
        file,
        uploadedBy,
        remarks,
        relatedEntityType,
        relatedEntityId,
      }));
    }
    return results;
  }

  @Post(':id/new-version')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  async newVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    if (!file) throw new BadRequestException('file required');
    validateUpload(file);
    return this.service.createNewVersion(id, file, this.actor(req));
  }

  @Post(':id/submit-approval')
  submitApproval(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.submitApproval(id, this.actor(req));
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string }; body: { comment?: string } },
  ) {
    return this.service.approve(id, this.actor(req), req.body?.comment);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string }; body: { reason?: string } },
  ) {
    return this.service.reject(id, this.actor(req), req.body?.reason);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.archive(id, this.actor(req));
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.restore(id, this.actor(req));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentMetadataDto) {
    return this.service.updateMetadata(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
