import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CacheService } from '../../common/cache/cache.service';
import { JobQueueService } from '../../common/jobs/job-queue.service';
import { Public } from '../../common/decorators/auth.decorators';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class BenchmarkController {
  constructor(
    private cache: CacheService,
    private jobs: JobQueueService,
  ) {}

  @Public()
  @Get('runtime')
  runtime() {
    const mem = process.memoryUsage();
    return {
      uptimeSec: Math.round(process.uptime()),
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        externalMb: Math.round(mem.external / 1024 / 1024),
      },
      cache: this.cache.stats(),
      jobs: this.jobs.stats(),
      node: process.version,
    };
  }
}
