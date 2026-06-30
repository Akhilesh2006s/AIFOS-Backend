import { Controller, Get, Post, Patch, Delete, Body, Param, Query, OnModuleInit } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateWorkOrderDto, UpdateWorkOrderDto } from './dto/work-order.dto';

@ApiTags('Maintenance')
@ApiBearerAuth()
@Controller('maintenance')
export class MaintenanceController implements OnModuleInit {
  constructor(private readonly service: MaintenanceService) {}

  async onModuleInit() { await this.service.seedIfEmpty(); }

  @Get('stats') getStats() { return this.service.getStats(); }
  @Get('calendar') getCalendar() { return this.service.getCalendar(); }
  @Get('breakdowns') findBreakdowns(@Query('equipmentId') equipmentId?: string) { return this.service.findBreakdowns(equipmentId); }
  @Post('breakdowns') createBreakdown(@Body() body: { equipmentId: string; title: string; description?: string; reportedBy?: string }) {
    return this.service.createBreakdown(body);
  }

  @Get('work-orders') findAll(@Query('equipmentId') equipmentId?: string) { return this.service.findAll(equipmentId); }
  @Get('work-orders/:id') findOne(@Param('id') id: string) { return this.service.findById(id); }
  @Post('work-orders') create(@Body() dto: CreateWorkOrderDto) { return this.service.create(dto); }
  @Patch('work-orders/:id') update(@Param('id') id: string, @Body() dto: UpdateWorkOrderDto) { return this.service.update(id, dto); }
  @Post('work-orders/:id/complete') complete(@Param('id') id: string, @Body() body: { actualCost?: number; completedBy?: string }) {
    return this.service.completeService(id, body);
  }
  @Delete('work-orders/:id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
