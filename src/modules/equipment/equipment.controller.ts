import { Controller, Get, Post, Patch, Delete, Body, Param, Query, OnModuleInit, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EquipmentService } from './equipment.service';
import { runStartupSeed } from '../../common/utils/startup-seed-runner';
import { CreateEquipmentDto, UpdateEquipmentDto } from './dto/equipment.dto';

@ApiTags('Equipment')
@ApiBearerAuth()
@Controller('equipment')
export class EquipmentController implements OnModuleInit {
  private readonly logger = new Logger(EquipmentController.name);

  constructor(private readonly service: EquipmentService) {}

  async onModuleInit() {
    await runStartupSeed(this.logger, 'Equipment', () => this.service.seedIfEmpty());
  }

  @Get('stats') getStats() { return this.service.getStats(); }
  @Get('operators') findOperators() { return this.service.findAllOperators(); }
  @Post('operators') createOperator(@Body() body: Record<string, unknown>) { return this.service.createOperator(body as never); }
  @Get('fuel') findAllFuel(@Query('equipmentId') equipmentId?: string) { return this.service.findFuelEntries(equipmentId); }
  @Get('engine-hours') findAllHours(@Query('equipmentId') equipmentId?: string) { return this.service.findEngineHours(equipmentId); }

  @Get() findAll(@Query('includeArchived') includeArchived?: string) {
    return this.service.findAll(includeArchived === 'true');
  }

  @Get(':id/profile') getProfile(@Param('id') id: string) { return this.service.getProfile(id); }
  @Get(':id/timeline') getTimeline(@Param('id') id: string) { return this.service.getTimeline(id); }
  @Get(':id/fuel-stats') getFuelStats(@Param('id') id: string) { return this.service.getFuelStats(id); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findById(id); }

  @Post() create(@Body() dto: CreateEquipmentDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post(':id/transfer') transfer(@Param('id') id: string, @Body() body: { projectId: string; siteId?: string; transferredBy?: string }) {
    return this.service.transfer(id, body);
  }
  @Post(':id/archive') archive(@Param('id') id: string, @Body() body: { by?: string }) { return this.service.archive(id, body.by); }
  @Post(':id/assign-operator') assignOperator(@Param('id') id: string, @Body() body: { operatorId: string; operatorName?: string }) {
    return this.service.assignOperator(id, body.operatorId, body.operatorName);
  }
  @Post(':id/fuel') recordFuel(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.recordFuel(id, body as never);
  }
  @Post(':id/engine-hours') recordHours(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.recordEngineHours(id, body as never);
  }
}
