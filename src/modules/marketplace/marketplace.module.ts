import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PlatformModule } from '../platform/platform.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MktPlugin, MktPluginSchema } from './schemas/mkt-plugin.schema';
import { MktPluginVersion, MktPluginVersionSchema } from './schemas/mkt-plugin-version.schema';
import { MktInstallation, MktInstallationSchema } from './schemas/mkt-installation.schema';
import { MktRating, MktRatingSchema } from './schemas/mkt-rating.schema';

@Module({
  imports: [
    IntegrationsModule,
    PlatformModule,
    MongooseModule.forFeature([
      { name: MktPlugin.name, schema: MktPluginSchema },
      { name: MktPluginVersion.name, schema: MktPluginVersionSchema },
      { name: MktInstallation.name, schema: MktInstallationSchema },
      { name: MktRating.name, schema: MktRatingSchema },
    ]),
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
