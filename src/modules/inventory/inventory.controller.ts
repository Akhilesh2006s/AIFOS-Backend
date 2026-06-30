import { Controller, Get, Post, Patch, Delete, Body, Param, OnModuleInit, Query, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { runStartupSeed } from '../../common/utils/startup-seed-runner';
import { CreateMaterialDto, UpdateMaterialDto, CreateMovementDto } from './dto/inventory.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController implements OnModuleInit {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private readonly service: InventoryService) {}

  async onModuleInit() {
    await runStartupSeed(this.logger, 'Inventory', () => this.service.seedIfEmpty());
  }

  @Get('stats') getStats() { return this.service.getStats(); }

  @Get('warehouses') findWarehouses(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAllWarehouses(page ? Number(page) : undefined, limit ? Number(limit) : 50);
  }
  @Post('warehouses') createWarehouse(@Body() body: Record<string, unknown>) { return this.service.createWarehouse(body); }

  @Get('grns') findGrns() { return this.service.findAllGrns(); }
  @Post('purchase-orders/:poId/grn') createGrn(@Param('poId') poId: string, @Body() body: {
    warehouseId: string; receivedBy?: string;
    lines: Array<{ materialId: string; orderedQty: number; receivedQty: number; acceptedQty: number; rejectedQty: number; unit: string }>;
  }) {
    return this.service.createGrnFromPO(poId, body.warehouseId, body.lines, body.receivedBy);
  }

  @Get('issues') findIssues() { return this.service.findAllIssues(); }
  @Post('issues') issueToSite(@Body() body: {
    warehouseId: string; projectId: string; siteId?: string; issuedTo?: string;
    lines: Array<{ materialId: string; quantity: number; unit: string }>;
  }) {
    return this.service.issueToSite(body);
  }

  @Get('stock/:warehouseId/:materialId') getStock(@Param('warehouseId') wh: string, @Param('materialId') mat: string) {
    return this.service.getStockBalance(mat, wh);
  }

  @Get('materials') findAllMaterials(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAllMaterials(page ? Number(page) : undefined, limit ? Number(limit) : 50);
  }
  @Get('materials/:id') findMaterial(@Param('id') id: string) { return this.service.findMaterialById(id); }
  @Post('materials') createMaterial(@Body() dto: CreateMaterialDto) { return this.service.createMaterial(dto); }
  @Patch('materials/:id') updateMaterial(@Param('id') id: string, @Body() dto: UpdateMaterialDto) { return this.service.updateMaterial(id, dto); }
  @Delete('materials/:id') removeMaterial(@Param('id') id: string) { return this.service.removeMaterial(id); }
  @Get('movements') getMovements() { return this.service.getRecentMovements(); }
  @Post('movements') createMovement(@Body() dto: CreateMovementDto) { return this.service.createMovement(dto); }
}
