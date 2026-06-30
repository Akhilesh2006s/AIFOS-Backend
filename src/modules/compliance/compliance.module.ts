import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComplianceRecord, ComplianceRecordSchema } from './schemas/compliance.schema';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ComplianceRecord.name, schema: ComplianceRecordSchema }]),
    NotificationsModule,
  ],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
