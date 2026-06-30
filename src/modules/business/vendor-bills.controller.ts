import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VendorBillsService } from './vendor-bills.service';
import type { CreateVendorBillDto, UpdateVendorBillDto } from './vendor-bill.types';

@ApiTags('Business — Vendor Bills')
@ApiBearerAuth()
@Controller('business/vendor-bills')
export class VendorBillsController {
  constructor(private readonly service: VendorBillsService) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'system';
  }

  @Get('exceptions')
  exceptions(@Query('projectId') projectId?: string) {
    return this.service.listExceptions(projectId);
  }

  @Get('aging')
  aging(@Query('projectId') projectId?: string) {
    return this.service.getAging(projectId);
  }

  @Get('dashboard')
  dashboard(@Query('projectId') projectId?: string) {
    return this.service.getDashboard(projectId);
  }

  @Get('metrics')
  metrics() {
    return this.service.getApMetrics();
  }

  @Get()
  list(
    @Query('projectId') projectId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(
      { projectId, vendorId, status, purchaseOrderId },
      page ? Number(page) : undefined,
      limit ? Number(limit) : 50,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: CreateVendorBillDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.create(body, this.actor(req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateVendorBillDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.update(id, body, this.actor(req));
  }

  @Post(':id/match')
  match(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.runMatch(id, this.actor(req));
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.approve(id, this.actor(req), body.comment);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.reject(id, this.actor(req), body.reason);
  }

  @Post(':id/send-back')
  sendBack(
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.sendBack(id, this.actor(req), body.comment);
  }
}
