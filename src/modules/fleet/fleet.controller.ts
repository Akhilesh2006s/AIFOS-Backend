import { Controller, Get, Post, Patch, Delete, Body, Param, Query, OnModuleInit, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FleetService } from './fleet.service';
import { runStartupSeed } from '../../common/utils/startup-seed-runner';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@ApiTags('Fleet')
@ApiBearerAuth()
@Controller('fleet')
export class FleetController implements OnModuleInit {
  private readonly logger = new Logger(FleetController.name);

  constructor(private readonly service: FleetService) {}

  async onModuleInit() {
    await runStartupSeed(this.logger, 'Fleet', () => this.service.seedIfEmpty());
  }

  @Get('stats') getStats() { return this.service.getStats(); }
  @Get('drivers') findDrivers() { return this.service.findDrivers(); }
  @Post('drivers') createDriver(@Body() body: Record<string, unknown>) { return this.service.createDriver(body as never); }
  @Get('trips') findTrips(@Query('vehicleId') vehicleId?: string) { return this.service.findTrips(vehicleId); }
  @Post('trips') createTrip(@Body() body: Record<string, unknown>) { return this.service.createTrip(body as never); }
  @Post('trips/:id/complete') completeTrip(@Param('id') id: string, @Body() body: { distanceKm: number }) { return this.service.completeTrip(id, body.distanceKm); }
  @Get('fuel') findFuel(@Query('vehicleId') vehicleId?: string) { return this.service.findVehicleFuel(vehicleId); }
  @Post('vehicles/:id/fuel') recordFuel(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.recordVehicleFuel(id, body as never); }

  @Get('vehicles') findAll() { return this.service.findAll(); }
  @Get('vehicles/:id') findOne(@Param('id') id: string) { return this.service.findById(id); }
  @Post('vehicles') create(@Body() dto: CreateVehicleDto) { return this.service.create(dto); }
  @Patch('vehicles/:id') update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) { return this.service.update(id, dto); }
  @Delete('vehicles/:id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
