import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UserStatus } from 'generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { AuthService } from './auth.service';

const NOW = new Date('2026-09-22T06:00:00.000Z');

const verifiedUser = {
  id: 7,
  email: 'user@example.com',
  name: 'Test User',
  password: null,
  googleSubject: 'google-subject',
  status: UserStatus.VERIFIED,
  bannedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function createPrismaMock() {
  const prisma = {
    googleOAuthAuthorization: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      updateManyAndReturn: jest.fn(),
    },
    authHandoffCode: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      updateManyAndReturn: jest.fn(),
    },
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    category: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(
    (input: unknown[] | ((tx: typeof prisma) => unknown)) => {
      if (typeof input === 'function') {
        return Promise.resolve(input(prisma));
      }
      return Promise.all(input);
    },
  );

  return prisma;
}

describe('AuthService Google sign-in', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: { signAsync: jest.Mock };
  let service: AuthService;
  let generateAuthUrl: jest.SpiedFunction<OAuth2Client['generateAuthUrl']>;
  let getToken: jest.SpiedFunction<OAuth2Client['getToken']>;
  let verifyIdToken: jest.SpiedFunction<OAuth2Client['verifyIdToken']>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    prisma = createPrismaMock();
    jwtService = { signAsync: jest.fn() };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      {} as OtpService,
      {
        jwtSecret: 'jwt-secret',
        frontendUrl: 'https://app.example.com/auth/google',
        google: {
          clientId: 'google-client-id',
          clientSecret: 'google-client-secret',
          redirectUri: 'https://api.example.com/auth/google/callback',
        },
      },
    );

    prisma.googleOAuthAuthorization.deleteMany.mockResolvedValue({ count: 0 });
    prisma.googleOAuthAuthorization.create.mockResolvedValue({});
    prisma.authHandoffCode.deleteMany.mockResolvedValue({ count: 0 });
    prisma.authHandoffCode.create.mockResolvedValue({});
    prisma.category.createMany.mockResolvedValue({ count: 6 });

    generateAuthUrl = jest
      .spyOn(OAuth2Client.prototype, 'generateAuthUrl')
      .mockReturnValue('https://accounts.google.com/authorize');
    getToken = jest.spyOn(OAuth2Client.prototype, 'getToken');
    verifyIdToken = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function mockValidGoogleIdentity(
    profile: {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    } = {
      sub: 'google-subject',
      email: 'user@example.com',
      email_verified: true,
      name: 'Test User',
    },
  ) {
    prisma.googleOAuthAuthorization.updateManyAndReturn.mockResolvedValue([
      { codeVerifier: 'stored-code-verifier' },
    ]);
    getToken.mockResolvedValue({
      tokens: { id_token: 'google-id-token' },
    } as never);
    verifyIdToken.mockResolvedValue({
      getPayload: () => profile,
    } as never);
  }

  describe('createGoogleAuthorizationLink', () => {
    it('stores hashed state and PKCE verifier before returning the Google URL', async () => {
      const result = await service.createGoogleAuthorizationLink();

      expect(result).toEqual({
        authorizationUrl: 'https://accounts.google.com/authorize',
      });
      expect(prisma.googleOAuthAuthorization.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [{ expiresAt: { lte: NOW } }, { consumedAt: { not: null } }],
        },
      });

      const authorizationOptions = generateAuthUrl.mock.calls.at(0)?.[0];
      const [[createInput]] = prisma.googleOAuthAuthorization.create.mock
        .calls as [
        [
          {
            data: {
              stateHash: string;
              codeVerifier: string;
              expiresAt: Date;
            };
          },
        ],
      ];

      expect(authorizationOptions).toBeDefined();
      if (!authorizationOptions) throw new Error('Authorization URL not built');

      expect(createInput.data.stateHash).toBe(
        createHash('sha256')
          .update(authorizationOptions.state as string)
          .digest('hex'),
      );
      expect(createInput.data.expiresAt).toEqual(
        new Date('2026-09-22T06:10:00.000Z'),
      );
      expect(authorizationOptions).toMatchObject({
        scope: ['openid', 'email', 'profile'],
        prompt: 'select_account',
        code_challenge: createHash('sha256')
          .update(createInput.data.codeVerifier)
          .digest('base64url'),
        code_challenge_method: 'S256',
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleGoogleAuthorizationCallback', () => {
    it('requires an authorization code', async () => {
      await expect(
        service.handleGoogleAuthorizationCallback(undefined, 'state'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(
        prisma.googleOAuthAuthorization.updateManyAndReturn,
      ).not.toHaveBeenCalled();
    });

    it('requires OAuth state', async () => {
      await expect(
        service.handleGoogleAuthorizationCallback('code', undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(
        prisma.googleOAuthAuthorization.updateManyAndReturn,
      ).not.toHaveBeenCalled();
    });

    it('atomically rejects an unknown, consumed, or expired state', async () => {
      prisma.googleOAuthAuthorization.updateManyAndReturn.mockResolvedValue([]);

      await expect(
        service.handleGoogleAuthorizationCallback('code', 'invalid-state'),
      ).rejects.toThrow('Google authorization state is invalid or expired.');

      expect(
        prisma.googleOAuthAuthorization.updateManyAndReturn,
      ).toHaveBeenCalledWith({
        where: {
          stateHash: createHash('sha256').update('invalid-state').digest('hex'),
          consumedAt: null,
          expiresAt: { gt: NOW },
        },
        data: { consumedAt: NOW },
        select: { codeVerifier: true },
      });
      expect(prisma.googleOAuthAuthorization.findUnique).not.toHaveBeenCalled();
      expect(prisma.googleOAuthAuthorization.updateMany).not.toHaveBeenCalled();
      expect(getToken).not.toHaveBeenCalled();
    });

    it('signs in an existing Google user and returns a one-time handoff code', async () => {
      mockValidGoogleIdentity();
      prisma.user.findUnique.mockResolvedValue(verifiedUser);

      const result = await service.handleGoogleAuthorizationCallback(
        'authorization-code',
        'valid-state',
      );

      expect(getToken).toHaveBeenCalledWith({
        code: 'authorization-code',
        codeVerifier: 'stored-code-verifier',
      });
      expect(verifyIdToken).toHaveBeenCalledWith({
        idToken: 'google-id-token',
        audience: 'google-client-id',
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { googleSubject: 'google-subject' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.category.createMany).not.toHaveBeenCalled();

      const redirectUrl = new URL(result.redirectUrl);
      const handoffCode = redirectUrl.searchParams.get('code');
      const [[handoffCreateInput]] = prisma.authHandoffCode.create.mock
        .calls as [
        [
          {
            data: { userId: number; codeHash: string; expiresAt: Date };
          },
        ],
      ];

      expect(redirectUrl.origin + redirectUrl.pathname).toBe(
        'https://app.example.com/auth/google',
      );
      expect(handoffCode).toBeTruthy();
      expect(handoffCreateInput.data).toEqual({
        userId: verifiedUser.id,
        codeHash: createHash('sha256')
          .update(handoffCode as string)
          .digest('hex'),
        expiresAt: new Date('2026-09-22T06:05:00.000Z'),
      });
      expect(prisma.authHandoffCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: verifiedUser.id },
      });
    });

    it('allows only one callback to consume the same OAuth state', async () => {
      mockValidGoogleIdentity();
      prisma.googleOAuthAuthorization.updateManyAndReturn
        .mockResolvedValueOnce([{ codeVerifier: 'stored-code-verifier' }])
        .mockResolvedValueOnce([]);
      prisma.user.findUnique.mockResolvedValue(verifiedUser);

      const firstResult = await service.handleGoogleAuthorizationCallback(
        'first-code',
        'same-state',
      );
      expect(firstResult.redirectUrl).toContain('code=');
      await expect(
        service.handleGoogleAuthorizationCallback('second-code', 'same-state'),
      ).rejects.toThrow('Google authorization state is invalid or expired.');

      expect(getToken).toHaveBeenCalledTimes(1);
      expect(prisma.authHandoffCode.create).toHaveBeenCalledTimes(1);
    });

    it('creates a verified user and default categories on first Google sign-in', async () => {
      mockValidGoogleIdentity();
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValue(verifiedUser);

      await service.handleGoogleAuthorizationCallback('code', 'state');

      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: { googleSubject: 'google-subject' },
      });
      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { email: 'user@example.com' },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'user@example.com',
          name: 'Test User',
          status: UserStatus.VERIFIED,
          googleSubject: 'google-subject',
        },
      });
      expect(prisma.category.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: verifiedUser.id }),
        ]) as unknown,
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('rejects an existing password account with the same email', async () => {
      mockValidGoogleIdentity();
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...verifiedUser, password: 'password-hash' });

      await expect(
        service.handleGoogleAuthorizationCallback('code', 'state'),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.authHandoffCode.create).not.toHaveBeenCalled();
    });

    it('rejects a banned Google user', async () => {
      mockValidGoogleIdentity();
      prisma.user.findUnique.mockResolvedValue({
        ...verifiedUser,
        status: UserStatus.BANNED,
      });

      await expect(
        service.handleGoogleAuthorizationCallback('code', 'state'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.authHandoffCode.create).not.toHaveBeenCalled();
    });

    it('rejects a token response without an ID token', async () => {
      prisma.googleOAuthAuthorization.updateManyAndReturn.mockResolvedValue([
        { codeVerifier: 'stored-code-verifier' },
      ]);
      getToken.mockResolvedValue({ tokens: {} } as never);

      await expect(
        service.handleGoogleAuthorizationCallback('code', 'state'),
      ).rejects.toThrow('Google did not return an ID token.');

      expect(verifyIdToken).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an incomplete or unverified Google identity', async () => {
      mockValidGoogleIdentity({
        sub: 'google-subject',
        email: 'user@example.com',
        email_verified: false,
      });

      await expect(
        service.handleGoogleAuthorizationCallback('code', 'state'),
      ).rejects.toThrow('Google account could not be verified.');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('converts unexpected Google errors to a generic unauthorized response', async () => {
      prisma.googleOAuthAuthorization.updateManyAndReturn.mockResolvedValue([
        { codeVerifier: 'stored-code-verifier' },
      ]);
      getToken.mockRejectedValue(new Error('Google is unavailable') as never);

      await expect(
        service.handleGoogleAuthorizationCallback('code', 'state'),
      ).rejects.toThrow('Google authorization failed.');
    });
  });

  describe('exchangeGoogleHandoffCode', () => {
    it('atomically consumes a valid handoff code and returns a JWT', async () => {
      prisma.authHandoffCode.updateManyAndReturn.mockResolvedValue([
        { userId: verifiedUser.id },
      ]);
      prisma.user.findUnique.mockResolvedValue(verifiedUser);
      jwtService.signAsync.mockResolvedValue('application-jwt');

      await expect(
        service.exchangeGoogleHandoffCode({ code: 'handoff-code' }),
      ).resolves.toEqual({ token: 'application-jwt' });

      expect(prisma.authHandoffCode.updateManyAndReturn).toHaveBeenCalledWith({
        where: {
          codeHash: createHash('sha256').update('handoff-code').digest('hex'),
          consumedAt: null,
          expiresAt: { gt: NOW },
        },
        data: { consumedAt: NOW },
        select: { userId: true },
      });
      expect(prisma.authHandoffCode.findUnique).not.toHaveBeenCalled();
      expect(prisma.authHandoffCode.updateMany).not.toHaveBeenCalled();
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        userId: verifiedUser.id,
      });
    });

    it('rejects an unknown, consumed, or expired handoff code', async () => {
      prisma.authHandoffCode.updateManyAndReturn.mockResolvedValue([]);

      await expect(
        service.exchangeGoogleHandoffCode({ code: 'invalid-code' }),
      ).rejects.toThrow('Google sign-in code is invalid or expired.');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('allows only one exchange when the same handoff code is submitted twice', async () => {
      prisma.authHandoffCode.updateManyAndReturn
        .mockResolvedValueOnce([{ userId: verifiedUser.id }])
        .mockResolvedValueOnce([]);
      prisma.user.findUnique.mockResolvedValue(verifiedUser);
      jwtService.signAsync.mockResolvedValue('application-jwt');

      await expect(
        service.exchangeGoogleHandoffCode({ code: 'single-use-code' }),
      ).resolves.toEqual({ token: 'application-jwt' });
      await expect(
        service.exchangeGoogleHandoffCode({ code: 'single-use-code' }),
      ).rejects.toThrow('Google sign-in code is invalid or expired.');

      expect(jwtService.signAsync).toHaveBeenCalledTimes(1);
    });

    it('rejects a handoff code whose user no longer exists', async () => {
      prisma.authHandoffCode.updateManyAndReturn.mockResolvedValue([
        { userId: verifiedUser.id },
      ]);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.exchangeGoogleHandoffCode({ code: 'handoff-code' }),
      ).rejects.toThrow('Google sign-in code is invalid or expired.');

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejects a banned user after consuming the handoff code', async () => {
      prisma.authHandoffCode.updateManyAndReturn.mockResolvedValue([
        { userId: verifiedUser.id },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        ...verifiedUser,
        status: UserStatus.BANNED,
      });

      await expect(
        service.exchangeGoogleHandoffCode({ code: 'handoff-code' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
