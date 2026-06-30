import 'reflect-metadata';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.ALLOW_PUBLIC_REGISTRATION = 'true';
process.env.RATE_LIMIT_PER_MIN = '10000';
process.env.SEED_DEMO = 'false';
process.env.SEED_ADMIN_EMAIL = 'admin@test.afios.local';
process.env.SEED_ADMIN_PASSWORD = 'TestAdmin!Pass2026';
process.env.SEED_ADMIN_NAME = 'Test Admin';
process.env.NODE_ENV = 'test';
