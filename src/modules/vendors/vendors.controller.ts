import { Controller, Get, Post, Patch, Delete, Body, Param, OnModuleInit, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { runStartupSeed } from '../../common/utils/startup-seed-runner';

@ApiTags('Vendors')
@ApiBearerAuth()
@Controller('vendors')
export class VendorsController implements OnModuleInit {
  private readonly logger = new Logger(VendorsController.name);

  constructor(private service: VendorsService) {}

  async onModuleInit() {
    await runStartupSeed(this.logger, 'Vendors', () => this.service.seedIfEmpty());
  }

  @Get('stats') getStats() { return this.service.getStats(); }
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findById(id); }
  @Post() create(@Body() body: Record<string, unknown>) { return this.service.create(body); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.update(id, body); }
  @Post(':id/approve') approve(@Param('id') id: string) { return this.service.approve(id); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
