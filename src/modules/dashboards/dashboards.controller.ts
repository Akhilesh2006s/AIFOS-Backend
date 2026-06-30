import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardsService } from './dashboards.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Dashboards')
@ApiBearerAuth()
@Controller('dashboards')
export class DashboardsController {
  constructor(private service: DashboardsService) {}

  @Get('roles') listRoles() { return this.service.listRoles(); }

  @Get('me')
  getMyDashboard(@CurrentUser() user: { role: string }) {
    return this.service.getDashboardData(user.role);
  }

  @Get(':role')
  getByRole(@Param('role') role: string) {
    return this.service.getDashboardData(role);
  }

  @Get(':role/layout')
  getLayout(@Param('role') role: string) {
    return this.service.getLayout(role);
  }
}
