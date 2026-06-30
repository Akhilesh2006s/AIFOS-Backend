import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { BekemDemoService } from '../../src/modules/seed/bekem-demo.service';
import { QueueProcessorService } from '../../src/modules/integrations/queue-processor.service';
import { CommQueueProcessorService } from '../../src/modules/integrations/comm-queue-processor.service';
import { ErpSchedulerService } from '../../src/modules/integrations/erp-scheduler.service';
import { FieldPollSchedulerService } from '../../src/modules/integrations/field-poll-scheduler.service';

const noopProcessor = { onModuleInit: () => undefined, tick: async () => undefined };

export interface TestContext {
  app: INestApplication;
  mongod: MongoMemoryServer | null;
  http: ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  let mongod: MongoMemoryServer | null = null;

  if (process.env.MONGO_URI_TEST) {
    process.env.MONGO_URI = process.env.MONGO_URI_TEST;
  } else {
    mongod = await MongoMemoryServer.create({
      instance: {
        launchTimeout: 120_000,
      },
    });
    process.env.MONGO_URI = mongod.getUri();
  }

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .overrideProvider(BekemDemoService)
    .useValue({ onApplicationBootstrap: async () => undefined })
    .overrideProvider(QueueProcessorService)
    .useValue(noopProcessor)
    .overrideProvider(CommQueueProcessorService)
    .useValue(noopProcessor)
    .overrideProvider(ErpSchedulerService)
    .useValue(noopProcessor)
    .overrideProvider(FieldPollSchedulerService)
    .useValue(noopProcessor)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  return {
    app,
    mongod,
    http: request(app.getHttpServer()),
  };
}

export async function closeTestApp(ctx?: TestContext) {
  if (!ctx) return;
  await ctx.app.close();
  if (ctx.mongod) await ctx.mongod.stop();
}

export async function loginAs(
  http: ReturnType<typeof request>,
  email: string,
  password: string,
): Promise<string> {
  const res = await http.post('/api/v1/auth/login').send({ email, password });
  expect([200, 201]).toContain(res.status);
  return res.body.accessToken as string;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
