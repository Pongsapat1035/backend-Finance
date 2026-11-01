import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from 'generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { FileService, ImageUpload } from '../file/file.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileDto } from './dto/user-profile.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileService,
  ) {}

  async getMe(userId: number): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatarFileId: true,
        password: true,
        passwordChangedAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user)
      throw new UnauthorizedException('User account no longer exists.');
    if (user.status === UserStatus.BANNED)
      throw new ForbiddenException('Account is banned.');

    const { avatarFileId, password, ...profile } = user;
    return {
      ...profile,
      avatarUrl: avatarFileId === null ? null : '/me/avatar',
      hasPassword: password !== null,
    };
  }

  async updateMe(userId: number, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, bio: dto.bio },
    });
    return this.getMe(userId);
  }

  async putAvatar(userId: number, file: ImageUpload) {
    const uploaded = await this.files.create(userId, file);
    try {
      await this.prisma.$transaction(async (tx) => {
        // Serialize avatar changes and account deletion for this user.
        const locked = await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
        `;
        if (!locked.length) throw new UnauthorizedException();
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        const ownedFile = await tx.file.findFirst({
          where: { id: uploaded.id, userId },
        });
        if (!ownedFile) throw new NotFoundException('File not found');
        await tx.user.update({
          where: { id: userId },
          data: { avatarFileId: uploaded.id },
        });
        if (user.avatarFileId !== null) {
          await tx.file.updateMany({
            where: { id: user.avatarFileId, userId },
            data: { pendingDeletion: true },
          });
        }
      });
    } catch (error) {
      // Retain metadata for retry if object cleanup itself fails.
      await this.prisma.file.updateMany({
        where: { id: uploaded.id, userId },
        data: { pendingDeletion: true },
      });
      try {
        await this.files.cleanupPending(userId);
      } catch {
        /* retry on the next avatar operation */
      }
      throw error;
    }
    await this.files.cleanupPending(userId);
    return this.getMe(userId);
  }

  async getAvatar(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarFileId: true },
    });
    if (!user?.avatarFileId) throw new NotFoundException('Avatar not found');
    return this.files.get(user.avatarFileId, userId);
  }

  async deleteAvatar(userId: number) {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
      `;
      if (!locked.length) throw new UnauthorizedException();
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.avatarFileId !== null) {
        await tx.user.update({
          where: { id: userId },
          data: { avatarFileId: null },
        });
        await tx.file.updateMany({
          where: { id: user.avatarFileId, userId },
          data: { pendingDeletion: true },
        });
      }
    });
    await this.files.cleanupPending(userId);
  }

  async deleteMe(userId: number) {
    await this.prisma.$transaction(
      async (tx) => {
        // Prevent uploads from creating files while the account is being removed.
        const locked = await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
        `;
        if (!locked.length) throw new UnauthorizedException();
        const files = await tx.file.findMany({
          where: { userId },
          select: { storageKey: true },
        });
        for (const file of files) {
          await this.files.deleteObject(file.storageKey);
        }
        await tx.file.deleteMany({ where: { userId } });
        await tx.budget.deleteMany({ where: { userId } });
        await tx.transaction.deleteMany({ where: { userId } });
        await tx.recurringTransaction.deleteMany({ where: { userId } });
        await tx.category.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
      },
      { timeout: 120_000 },
    );
  }
}
