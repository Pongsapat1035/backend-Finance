import { ConfigService } from '@nestjs/config';

export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')?.trim();

  if (!secret) {
    throw new Error('JWT_SECRET must be configured');
  }

  return secret;
}
