import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ConsumptionModule } from './modules/consumption/consumption.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SupplyChainModule } from './modules/supply-chain/supply-chain.module';
import { AssetsModule } from './modules/assets/assets.module';
import { MissionControlModule } from './modules/mission-control/mission-control.module';
import { InsightsModule } from './modules/insights/insights.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { SeedModule } from './modules/seed/seed.module';
import { FinancialEventsModule } from './modules/financial-events/financial-events.module';
import { BusinessModule } from './modules/business/business.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { AdminModule } from './modules/admin/admin.module';
import { OperationalIntelligenceModule } from './modules/operational-intelligence/operational-intelligence.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { PlatformModule } from './modules/platform/platform.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { DeveloperModule } from './modules/developer/developer.module';
import { ExplorerModule } from './modules/explorer/explorer.module';
import { CacheModule } from './common/cache/cache.module';
import { JobsModule } from './common/jobs/jobs.module';
import { SecurityAuditInterceptor } from './common/interceptors/security-audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: Number(process.env.RATE_LIMIT_PER_MIN || 120),
      },
    ]),
    CacheModule,
    JobsModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 50),
        minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 5),
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    SeedModule,
    AuthModule,
    UsersModule,
    ProcurementModule,
    InventoryModule,
    EquipmentModule,
    FleetModule,
    MaintenanceModule,
    ProjectsModule,
    ComplianceModule,
    AnalyticsModule,
    ConsumptionModule,
    WorkflowModule,
    VendorsModule,
    DashboardsModule,
    DocumentsModule,
    NotificationsModule,
    SupplyChainModule,
    AssetsModule,
    MissionControlModule,
    InsightsModule,
    AuditModule,
    FinancialEventsModule,
    BusinessModule,
    WorkforceModule,
    AdminModule,
    OperationalIntelligenceModule,
    IntegrationsModule,
    PlatformModule,
    MarketplaceModule,
    DeveloperModule,
    ExplorerModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: SecurityAuditInterceptor },
  ],
})
export class AppModule {}
