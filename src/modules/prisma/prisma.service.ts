import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    super({ adapter: pool });
  }

  async onModuleInit() {
    const databaseUrl = process.env.DATABASE_URL;
    const databaseTarget = this.getDatabaseTarget(databaseUrl);

    this.logger.log(
      databaseTarget
        ? `Connecting to database at ${databaseTarget}`
        : 'Connecting to database with missing or invalid DATABASE_URL',
    );

    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error(
        'Database connection failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private getDatabaseTarget(databaseUrl?: string) {
    if (!databaseUrl) return null;

    try {
      const parsedUrl = new URL(databaseUrl);
      return `${parsedUrl.hostname}:${parsedUrl.port || '5432'}${parsedUrl.pathname}`;
    } catch {
      return null;
    }
  }
}
