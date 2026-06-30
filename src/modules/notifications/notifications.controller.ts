import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
    @Query('read') read?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (read !== undefined || type || page) {
      return this.service.findFiltered({
        read: read === 'true' ? true : read === 'false' ? false : undefined,
        type,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : 50,
      });
    }
    if (projectId) return this.service.findForProject(projectId);
    if (userId) return this.service.findForUser(userId);
    return this.service.findAllRecent();
  }

  @Get('unread-count')
  async count(@Query('projectId') projectId?: string) {
    const n = await this.service.countUnread(projectId);
    return { count: n };
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.service.markRead(id);
  }

  @Patch('read-all')
  markAllGlobal() {
    return this.service.markAllRead();
  }

  @Patch('project/:projectId/read-all')
  markAll(@Param('projectId') projectId: string) {
    return this.service.markAllReadForProject(projectId);
  }
}
