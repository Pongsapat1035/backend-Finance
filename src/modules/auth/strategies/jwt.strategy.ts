import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { UserStatus } from 'generated/prisma/enums';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'my_super_secret_fallback_key',
    });
  }

  async validate(payload: { userId: number }) {
     const user = await this.prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.status === UserStatus.BANNED) {
    throw new ForbiddenException('Account is banned');
  }
    return { userId: payload.userId };
  }
}
