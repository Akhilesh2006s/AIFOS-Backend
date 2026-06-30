import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConsumptionService } from './consumption.service';

@ApiTags('Consumption')
@ApiBearerAuth()
@Controller('consumption')
export class ConsumptionController {
  constructor(private service: ConsumptionService) {}

  @Get('stats') getStats() { return this.service.getStats(); }

  @Get('stores/:projectId')
  getStores(@Param('projectId') projectId: string) {
    return this.service.getSiteStores(projectId);
  }

  @Get('entries')
  getEntries() { return this.service.findAllEntries(); }

  @Get('reconciliation/:projectId/:siteId/:materialId')
  reconcile(
    @Param('projectId') projectId: string,
    @Param('siteId') siteId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.service.getReconciliation(projectId, siteId, materialId);
  }

  @Post('usage')
  recordUsage(@Body() body: {
    projectId: string; siteId: string; materialId: string;
    quantity: number; unit?: string; recordedBy?: string; notes?: string;
  }) {
    return this.service.recordUsage(body);
  }

  @Post('wastage')
  recordWastage(@Body() body: {
    projectId: string; siteId: string; materialId: string;
    quantity: number; unit?: string; recordedBy?: string; notes?: string;
  }) {
    return this.service.recordWastage(body);
  }

  @Post('from-issue/:issueId')
  syncFromIssue(@Param('issueId') issueId: string) {
    return this.service.recordFromMaterialIssue(issueId);
  }
}
