import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isStartupSeedEnabled } from '../../common/config/startup-seed';
import { UsersService } from '../users/users.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private usersService: UsersService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    if (!isStartupSeedEnabled()) {
      this.logger.log('Startup seed skipped (production or ENABLE_STARTUP_SEED=false)');
      return;
    }
    await this.seedAdmin();
    await this.seedDemoData();
  }

  private async seedAdmin() {
    const count = await this.usersService.count();
    if (count > 0) return;

    const email = this.config.get('SEED_ADMIN_EMAIL') || 'admin@afios.com';
    const password = this.config.get('SEED_ADMIN_PASSWORD') || 'Admin@123';
    const name = this.config.get('SEED_ADMIN_NAME') || 'AFIOS Administrator';

    await this.usersService.create({
      name,
      email,
      password,
      role: 'admin',
      department: 'Executive',
    });

    this.logger.log(`Admin user seeded: ${email}`);
  }

  private async seedDemoData() {
    // Demo data seeding handled per module
    this.logger.log('AFIOS modules initialized');
  }
}
