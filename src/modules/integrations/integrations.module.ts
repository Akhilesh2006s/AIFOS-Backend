import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformModule } from '../platform/platform.module';
import { IntegrationsController } from './integrations.controller';
import { GatewayController } from './gateway.controller';
import { EventsController } from './events.controller';
import { WebhooksController } from './webhooks.controller';
import { ErpController } from './erp.controller';
import { FieldController } from './field.controller';
import { CommController } from './comm.controller';
import { IntegrationsService } from './integrations.service';
import { ConnectorManagerService } from './connector-manager.service';
import { EventBusService } from './event-bus.service';
import { GatewayService } from './gateway.service';
import { WebhookEngineService } from './webhook-engine.service';
import { RetryEngineService } from './retry-engine.service';
import { QueueProcessorService } from './queue-processor.service';
import { RateLimiterService } from './rate-limiter.service';
import { AfiosEventBridgeService } from './afios-event-bridge.service';
import { ErpSyncService } from './erp-sync.service';
import { ErpSchedulerService } from './erp-scheduler.service';
import { FieldIntegrationService } from './field-integration.service';
import { FieldPollSchedulerService } from './field-poll-scheduler.service';
import { CommunicationService } from './communication.service';
import { CommQueueProcessorService } from './comm-queue-processor.service';
import { CommEventBridgeService } from './comm-event-bridge.service';
import { IntConnector, IntConnectorSchema } from './schemas/int-connector.schema';
import { IntConnectorLog, IntConnectorLogSchema } from './schemas/int-connector-log.schema';
import { IntEventLog, IntEventLogSchema } from './schemas/int-event-log.schema';
import { IntGatewayRoute, IntGatewayRouteSchema } from './schemas/int-gateway-route.schema';
import { IntWebhook, IntWebhookSchema } from './schemas/int-webhook.schema';
import { IntQueueJob, IntQueueJobSchema } from './schemas/int-queue-job.schema';
import { IntApiKey, IntApiKeySchema } from './schemas/int-api-key.schema';
import { IntGatewayConfig, IntGatewayConfigSchema } from './schemas/int-gateway-config.schema';
import { IntErpSettings, IntErpSettingsSchema } from './schemas/int-erp-settings.schema';
import { IntFieldMapping, IntFieldMappingSchema } from './schemas/int-field-mapping.schema';
import { IntSyncJob, IntSyncJobSchema } from './schemas/int-sync-job.schema';
import { IntSyncRun, IntSyncRunSchema } from './schemas/int-sync-run.schema';
import { IntSyncError, IntSyncErrorSchema } from './schemas/int-sync-error.schema';
import { IntFieldDevice, IntFieldDeviceSchema } from './schemas/int-field-device.schema';
import { IntFieldSettings, IntFieldSettingsSchema } from './schemas/int-field-settings.schema';
import { IntTelemetryLog, IntTelemetryLogSchema } from './schemas/int-telemetry-log.schema';
import { IntNotificationTemplate, IntNotificationTemplateSchema } from './schemas/int-notification-template.schema';
import { IntCommMessage, IntCommMessageSchema } from './schemas/int-comm-message.schema';
import { IntCommCampaign, IntCommCampaignSchema } from './schemas/int-comm-campaign.schema';
import { IntCommRule, IntCommRuleSchema } from './schemas/int-comm-rule.schema';

@Module({
  imports: [
    PlatformModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || '7d' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: IntConnector.name, schema: IntConnectorSchema },
      { name: IntConnectorLog.name, schema: IntConnectorLogSchema },
      { name: IntEventLog.name, schema: IntEventLogSchema },
      { name: IntGatewayRoute.name, schema: IntGatewayRouteSchema },
      { name: IntWebhook.name, schema: IntWebhookSchema },
      { name: IntQueueJob.name, schema: IntQueueJobSchema },
      { name: IntApiKey.name, schema: IntApiKeySchema },
      { name: IntGatewayConfig.name, schema: IntGatewayConfigSchema },
      { name: IntErpSettings.name, schema: IntErpSettingsSchema },
      { name: IntFieldMapping.name, schema: IntFieldMappingSchema },
      { name: IntSyncJob.name, schema: IntSyncJobSchema },
      { name: IntSyncRun.name, schema: IntSyncRunSchema },
      { name: IntSyncError.name, schema: IntSyncErrorSchema },
      { name: IntFieldDevice.name, schema: IntFieldDeviceSchema },
      { name: IntFieldSettings.name, schema: IntFieldSettingsSchema },
      { name: IntTelemetryLog.name, schema: IntTelemetryLogSchema },
      { name: IntNotificationTemplate.name, schema: IntNotificationTemplateSchema },
      { name: IntCommMessage.name, schema: IntCommMessageSchema },
      { name: IntCommCampaign.name, schema: IntCommCampaignSchema },
      { name: IntCommRule.name, schema: IntCommRuleSchema },
    ]),
  ],
  controllers: [IntegrationsController, GatewayController, EventsController, WebhooksController, ErpController, FieldController, CommController],
  providers: [
    IntegrationsService,
    ConnectorManagerService,
    EventBusService,
    GatewayService,
    WebhookEngineService,
    RetryEngineService,
    QueueProcessorService,
    RateLimiterService,
    AfiosEventBridgeService,
    ErpSyncService,
    ErpSchedulerService,
    FieldIntegrationService,
    FieldPollSchedulerService,
    CommunicationService,
    CommQueueProcessorService,
    CommEventBridgeService,
  ],
  exports: [IntegrationsService, ConnectorManagerService],
})
export class IntegrationsModule {}
