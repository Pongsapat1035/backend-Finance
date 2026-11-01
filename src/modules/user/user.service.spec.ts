import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from 'generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from './user.service';
import { FileService } from '../file/file.service';

describe('UserService', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const service = new UserService(
    prisma as unknown as PrismaService,
    {} as FileService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('returns only the requested profile fields for the authenticated user', async () => {
    const profile = {
      id: 7,
      email: 'user@example.com',
      name: 'Example User',
      bio: null,
      avatarUrl: null,
      hasPassword: true,
      passwordChangedAt: null,
      status: UserStatus.VERIFIED,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    };
    prisma.user.findUnique.mockResolvedValue({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      bio: profile.bio,
      avatarFileId: null,
      password: 'hash',
      passwordChangedAt: profile.passwordChangedAt,
      status: profile.status,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });

    await expect(service.getMe(7)).resolves.toEqual(profile);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
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
  });

  it('rejects a user removed after token validation', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getMe(7)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a user banned after token validation', async () => {
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.BANNED });

    await expect(service.getMe(7)).rejects.toThrow(ForbiddenException);
  });
});
