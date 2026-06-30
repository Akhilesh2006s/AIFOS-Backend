import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import type { CreatePaymentDto, UpdatePaymentDto } from './payment.types';

@ApiTags('Business — Payments')
@ApiBearerAuth()
@Controller('business/payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'system';
  }

  @Get('dashboard')
  dashboard(@Query('projectId') projectId?: string) {
    return this.service.getDashboard(projectId);
  }

  @Get('aging')
  aging(@Query('projectId') projectId?: string) {
    return this.service.getVendorAging(projectId);
  }

  @Get('cash-flow')
  cashFlow(@Query('projectId') projectId?: string) {
    return this.service.getCashFlow(projectId);
  }

  @Get('metrics')
  metrics() {
    return this.service.getOperationsMetrics();
  }

  @Get()
  list(
    @Query('projectId') projectId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
    @Query('costCenter') costCenter?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(
      { projectId, vendorId, status, costCenter, from, to },
      page ? Number(page) : undefined,
      limit ? Number(limit) : 50,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: CreatePaymentDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.create(body, this.actor(req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePaymentDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.update(id, body, this.actor(req));
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.approve(id, this.actor(req), body.comment);
  }

  @Post(':id/mark-paid')
  markPaid(
    @Param('id') id: string,
    @Body() body: { referenceNumber?: string },
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.markPaid(id, this.actor(req), body.referenceNumber);
  }
}
