import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MissionControlService } from './mission-control.service';
import { TodayWorkService } from './today-work.service';

@ApiTags('Mission Control')
@ApiBearerAuth()
@Controller('mission-control')
export class MissionControlController {
  constructor(
    private readonly service: MissionControlService,
    private readonly todayWork: TodayWorkService,
  ) {}

  @Get('overview')
  getOverview(@Req() req: { user?: { role?: string } }) {
    return this.service.getOverview(req.user?.role || 'executive');
  }

  @Get('today-work')
  getTodayWork(@Req() req: { user?: { role?: string } }) {
    return this.todayWork.getForRole(req.user?.role || 'executive');
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.service.search(q || '');
  }
}
