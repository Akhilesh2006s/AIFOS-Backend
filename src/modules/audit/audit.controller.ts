import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @Roles('admin', 'executive')
  list(@Query('entityType') entityType?: string, @Query('projectId') projectId?: string, @Query('limit') limit?: string) {
    return this.service.findRecent(limit ? Number(limit) : 50, { entityType, projectId });
  }

  @Get('stats')
  @Roles('admin')
  stats() {
    return this.service.count().then((total) => ({ total }));
  }
}
