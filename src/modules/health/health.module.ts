import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { BenchmarkController } from './benchmark.controller';

@Module({
  controllers: [HealthController, BenchmarkController],
})
export class HealthModule {}
