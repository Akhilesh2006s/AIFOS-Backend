import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get('dashboard')
  getDashboard(@Query('projectId') projectId?: string) {
    return this.service.getDashboard(projectId);
  }

  @Get('search')
  search(@Query('q') q: string, @Query('projectId') projectId?: string) {
    return this.service.search(q || '', projectId);
  }

  @Get('reports')
  getReports(@Query('projectId') projectId?: string) {
    return this.service.getReports(projectId);
  }
}
