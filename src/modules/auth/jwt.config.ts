import { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';

export function getJwtSecret(config: ConfigType<typeof appConfig>): string {
  return config.jwtSecret;
}
