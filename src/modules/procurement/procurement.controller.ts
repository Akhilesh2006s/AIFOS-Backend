import { Controller, Get, Post, Patch, Delete, Body, Param, Query, OnModuleInit, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProcurementService } from './procurement.service';
import { runStartupSeed } from '../../common/utils/startup-seed-runner';
import { CreatePurchaseRequestDto } from './dto/create-pr.dto';
import { CreateVendorDto, UpdateVendorDto, UpdatePurchaseRequestDto } from './dto/vendor.dto';

@ApiTags('Procurement')
@ApiBearerAuth()
@Controller('procurement')
export class ProcurementController implements OnModuleInit {
  private readonly logger = new Logger(ProcurementController.name);

  constructor(private readonly service: ProcurementService) {}

  async onModuleInit() {
    await runStartupSeed(this.logger, 'Procurement', () => this.service.seedIfEmpty());
  }

  @Get('stats') getStats() { return this.service.getStats(); }

  @Get('purchase-requests') findAllPRs(@Query('projectId') projectId?: string) { return this.service.findAllPRs(projectId); }
  @Get('purchase-requests/:id') findPR(@Param('id') id: string) { return this.service.findPRById(id); }
  @Post('purchase-requests') createPR(@Body() dto: CreatePurchaseRequestDto) { return this.service.createPR(dto); }
  @Patch('purchase-requests/:id') updatePR(@Param('id') id: string, @Body() dto: UpdatePurchaseRequestDto) { return this.service.updatePR(id, dto); }
  @Delete('purchase-requests/:id') removePR(@Param('id') id: string) { return this.service.removePR(id); }
  @Post('purchase-requests/:id/submit') submitPR(@Param('id') id: string, @Body() body: { by?: string }) { return this.service.submitPR(id, body.by); }
  @Post('purchase-requests/:id/approve') approvePR(@Param('id') id: string, @Body() body: { approvedBy: string; level: number; remarks?: string }) {
    return this.service.approvePR(id, body.level, body.approvedBy, body.remarks);
  }
  @Post('purchase-requests/:id/reject') rejectPR(@Param('id') id: string, @Body() body: { rejectedBy: string; reason: string }) {
    return this.service.rejectPR(id, body.rejectedBy, body.reason);
  }
  @Post('purchase-requests/:id/revise') revisePR(@Param('id') id: string, @Body() body: { by?: string }) { return this.service.revisePR(id, body.by); }

  @Get('rfqs') findAllRfqs(@Query('projectId') projectId?: string) { return this.service.findAllRfqs(projectId); }
  @Get('rfqs/:id') findRfq(@Param('id') id: string) { return this.service.findRfqById(id); }
  @Post('purchase-requests/:prId/rfq') createRfq(@Param('prId') prId: string, @Body() body: { vendorIds: string[]; closingDate?: string; createdBy?: string }) {
    return this.service.createRfqFromPR(prId, body);
  }
  @Post('rfqs/:id/publish') publishRfq(@Param('id') id: string) { return this.service.publishRfq(id); }
  @Get('rfqs/:id/quotations') findQuotations(@Param('id') id: string) { return this.service.findQuotations(id); }
  @Get('rfqs/:id/compare') compareQuotations(
    @Param('id') id: string,
    @Query('strategy') strategy?: 'lowest_price' | 'best_value' | 'technical' | 'commercial' | 'manual',
    @Query('winnerId') winnerId?: string,
  ) { return this.service.compareQuotations(id, strategy || 'best_value', winnerId); }
  @Post('rfqs/:id/quotations') submitQuotation(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.submitQuotation(id, String(body.vendorId), body.lines as never, body as never);
  }
  @Post('rfqs/:id/award') awardQuotation(@Param('id') id: string, @Body() body: { quotationId: string; awardedBy?: string }) {
    return this.service.awardQuotation(id, body.quotationId, body.awardedBy);
  }

  @Get('purchase-orders') findAllPOs(@Query('projectId') projectId?: string) { return this.service.findAllPOs(projectId); }
  @Get('purchase-orders/:id') findPO(@Param('id') id: string) { return this.service.findPOById(id); }
  @Patch('purchase-orders/:id/status') updatePOStatus(@Param('id') id: string, @Body() body: { status: string; by?: string }) {
    return this.service.updatePOStatus(id, body.status, body.by);
  }
  @Post('purchase-orders/:id/approve') approvePO(@Param('id') id: string, @Body() body: { approvedBy: string }) { return this.service.approvePO(id, body.approvedBy); }
  @Post('purchase-orders/:id/issue') issuePO(@Param('id') id: string, @Body() body: { issuedBy: string }) { return this.service.issuePO(id, body.issuedBy); }

  @Get('vendors') findAllVendors() { return this.service.findAllVendors(); }
  @Get('vendors/:id') findVendor(@Param('id') id: string) { return this.service.findVendorById(id); }
  @Post('vendors') createVendor(@Body() dto: CreateVendorDto) { return this.service.createVendor(dto); }
  @Patch('vendors/:id') updateVendor(@Param('id') id: string, @Body() dto: UpdateVendorDto) { return this.service.updateVendor(id, dto); }
  @Delete('vendors/:id') removeVendor(@Param('id') id: string) { return this.service.removeVendor(id); }
}
