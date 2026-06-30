import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';

@ApiTags('Workflow')
@ApiBearerAuth()
@Controller('workflow')
export class WorkflowController {
  constructor(private service: WorkflowService) {}

  @Get('pipeline/:projectId')
  getPipeline(@Param('projectId') projectId: string) {
    return this.service.getProjectPipeline(projectId);
  }

  @Post('mr/:mrId/to-procurement')
  sendToProcurement(@Param('mrId') mrId: string) {
    return this.service.sendRequirementToProcurement(mrId);
  }

  @Post('pr/:prId/approve-rfq')
  approveAndRfq(
    @Param('prId') prId: string,
    @Body() body: { approvedBy: string; level: number; vendorIds: string[] },
  ) {
    return this.service.approveAndCreateRfq(prId, body.approvedBy, body.level, body.vendorIds);
  }

  @Post('rfq/:rfqId/award')
  awardPO(@Param('rfqId') rfqId: string, @Body() body: { quotationId: string }) {
    return this.service.awardAndCreatePO(rfqId, body.quotationId);
  }

  @Post('po/:poId/grn')
  receiveGoods(
    @Param('poId') poId: string,
    @Body() body: {
      warehouseId: string;
      receivedBy?: string;
      lines: Array<{
        materialId: string;
        orderedQty: number;
        receivedQty: number;
        acceptedQty: number;
        rejectedQty: number;
        unit: string;
      }>;
    },
  ) {
    return this.service.receiveGoods(poId, body.warehouseId, body.lines, body.receivedBy);
  }

  @Post('issue-to-site')
  issueToSite(@Body() body: {
    warehouseId: string;
    projectId: string;
    siteId: string;
    issuedTo?: string;
    lines: Array<{ materialId: string; quantity: number; unit: string }>;
  }) {
    return this.service.issueToSiteAndRecord(body);
  }
}
