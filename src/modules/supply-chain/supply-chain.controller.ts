import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupplyChainService } from './supply-chain.service';

@ApiTags('Supply Chain')
@ApiBearerAuth()
@Controller('supply-chain')
export class SupplyChainController {
  constructor(private readonly service: SupplyChainService) {}

  @Get('dashboard')
  getDashboard(@Query('projectId') projectId?: string) {
    return this.service.getDashboard(projectId);
  }

  @Get('search')
  search(@Query('q') q: string, @Query('projectId') projectId?: string) {
    return this.service.search(q || '', projectId);
  }

  @Get('pipeline/:projectId')
  getPipeline(@Param('projectId') projectId: string) {
    return this.service.getWorkflowPipeline(projectId);
  }
}
