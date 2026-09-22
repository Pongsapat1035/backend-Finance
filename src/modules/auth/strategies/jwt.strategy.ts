import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { UserStatus } from 'generated/prisma/enums';
import { getJwtSecret } from '../jwt.config';
import { appConfig } from '../../../config/app.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(appConfig.KEY)
    appConfiguration: ConfigType<typeof appConfig>,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(appConfiguration),
    });
  }

  async validate(payload: { userId: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user || user.status === UserStatus.BANNED) {
      throw new ForbiddenException('Account is banned');
    }
    return { userId: payload.userId };
  }
}
