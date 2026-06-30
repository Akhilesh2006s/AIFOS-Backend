import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExplorerService } from './explorer.service';

@ApiTags('Explorer')
@ApiBearerAuth()
@Controller('explorer')
export class ExplorerController {
  constructor(private readonly service: ExplorerService) {}

  @Get('purchase-request/by-number/:prNumber')
  explorePrByNumber(@Param('prNumber') prNumber: string) {
    return this.service.exploreByNumber(prNumber);
  }

  @Get(':entityType/:entityId')
  explore(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.service.explore(this.service.resolveType(entityType), entityId);
  }
}
