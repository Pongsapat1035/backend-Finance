import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from 'generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UserProfileDto } from './dto/user-profile.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: number): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists.');
    }
    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('Account is banned.');
    }

    return user;
  }
}
