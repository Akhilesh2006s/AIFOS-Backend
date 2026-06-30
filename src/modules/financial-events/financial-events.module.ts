import { Global, Module } from '@nestjs/common';
import { FinancialEventsService } from './financial-events.service';

@Global()
@Module({
  providers: [FinancialEventsService],
  exports: [FinancialEventsService],
})
export class FinancialEventsModule {}
