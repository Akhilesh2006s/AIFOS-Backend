import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dns from 'dns';
import helmet from 'helmet';
import compression from 'compression';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { isProductionRuntime } from './common/config/runtime-env';

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set (minimum 32 characters) before starting the API');
  }

  const isProd = isProductionRuntime();

  const app = await NestFactory.create(AppModule, {
    logger: isProd ? ['error', 'warn'] : undefined,
    bufferLogs: isProd,
  });

  app.getHttpAdapter().getInstance().set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

  app.use(
    helmet({
      contentSecurityPolicy: isProd ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      frameguard: { action: 'deny' },
    }),
  );
  app.use(compression());

  app.setGlobalPrefix('api/v1');

  // Root path for browser / Railway probes (Nest routes live under /api/v1).
  app.getHttpAdapter().getInstance().get('/', (_req: Request, res: Response) => {
    res.redirect(302, '/api/v1/health');
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: true,
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Organization-Id',
      'X-AFIOS-Org-Id',
    ],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86_400,
  });

  if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AFIOS API')
      .setDescription('Amenity Forge Infrastructure Operating System — REST API for projects, supply chain, assets, integrations, marketplace, and developer platform.')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
      .addTag('Developer Platform', 'OAuth apps, API keys, sandbox, SDK docs')
      .addTag('Marketplace', 'Extension catalog, install, publish')
      .addTag('Enterprise Platform', 'Multi-org, regional, white-label')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  if (isProd) {
    console.log(`AFIOS API listening on 0.0.0.0:${port}`);
  } else {
    console.log(`AFIOS API running on http://localhost:${port}`);
    if (process.env.ENABLE_SWAGGER === 'true') {
      console.log(`Swagger docs at http://localhost:${port}/api/docs`);
    }
  }
}

bootstrap().catch((err) => {
  console.error('AFIOS API failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
