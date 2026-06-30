import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PlatformModule } from '../platform/platform.module';
import { DeveloperController } from './developer.controller';
import { DeveloperService } from './developer.service';
import { DevApplication, DevApplicationSchema } from './schemas/dev-application.schema';
import { DevApiKey, DevApiKeySchema } from './schemas/dev-api-key.schema';
import { DevUsageRecord, DevUsageRecordSchema } from './schemas/dev-usage-record.schema';
import { DevLicense, DevLicenseSchema } from './schemas/dev-license.schema';

@Module({
  imports: [
    IntegrationsModule,
    PlatformModule,
    MongooseModule.forFeature([
      { name: DevApplication.name, schema: DevApplicationSchema },
      { name: DevApiKey.name, schema: DevApiKeySchema },
      { name: DevUsageRecord.name, schema: DevUsageRecordSchema },
      { name: DevLicense.name, schema: DevLicenseSchema },
    ]),
  ],
  controllers: [DeveloperController],
  providers: [DeveloperService],
  exports: [DeveloperService],
})
export class DeveloperModule {}
