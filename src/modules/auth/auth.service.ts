import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto, GoogleAuthExchangeDto, LoginDto } from './dto/auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OtpService } from '../otp/otp.service';
import { OtpVerify } from '../otp/otp.dto';
import dayjs from 'dayjs';
import { OtpType, UserStatus } from 'generated/prisma/enums';
import { UserModel } from 'generated/prisma/models/User';
import { getDefaultCategories } from '../../utils/default-categories';
import { ConfigType } from '@nestjs/config';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes } from 'crypto';
import { appConfig } from '../../config/app.config';

const saltRounds = 10;
const GOOGLE_OAUTH_AUTHORIZATION_TTL_MINUTES = 10;
const GOOGLE_HANDOFF_CODE_TTL_MINUTES = 5;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    @Inject(appConfig.KEY)
    private readonly appConfiguration: ConfigType<typeof appConfig>,
  ) {}

  async create(dto: CreateUserDto) {
    const { email, password, name } = dto;

    const existUser = await this.prisma.user.findFirst({ where: { email } });
    if (existUser) throw new BadRequestException('User is already exist');

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        status: UserStatus.UNVERIFIED,
      },
    });
    const otpResponse = await this.otpService.createOtp({
      userId: user.id,
      email: user.email,
      userName: user.name || undefined,
    });
    const { referral } = otpResponse.otp;
    return {
      message:
        'Registration successful. Please check your email for a verification code.',
      data: {
        userId: user.id,
        email: user.email,
        expireIn: 600,
        referral,
      },
    };
  }

  async verifyOtp(dto: OtpVerify) {
    const { otp: userOtp, userId } = dto;
    const verifyTime = dayjs();

    return await this.prisma.$transaction(async (tx) => {
      const otp = await tx.otp.findFirst({
        where: { userId, purpose: OtpType.EMAIL },
      });
      if (!otp) throw new NotFoundException('Otp does not exist');

      if (otp.attempts >= 5) {
        throw new HttpException(
          'Too many wrong attempts. Please request a new OTP.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (otp.otp !== userOtp) {
        await tx.otp.update({
          where: { id: otp.id },
          data: { attempts: { increment: 1 } },
        });
        throw new BadRequestException('Wrong otp');
      }

      const isExpired = verifyTime.isAfter(dayjs(otp.expireAt));
      if (isExpired) throw new BadRequestException('Otp has expired');

      // Update user emailVerify = true
      const user = await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.VERIFIED },
      });

      // Seed default categories
      const defaultCategories = getDefaultCategories(user.id);
      await tx.category.createMany({
        data: defaultCategories,
      });

      // Delete used OTP
      await tx.otp.delete({ where: { id: otp.id } });

      const token = await this.jwtService.signAsync({ userId: user.id });

      return { message: 'Email verified successfully', token };
    });
  }

  async login(user: UserModel) {
    const token = await this.jwtService.signAsync({ userId: user.id });
    return { token };
  }

  async createGoogleAuthorizationLink() {
    const { clientId, redirectUri } = this.appConfiguration.google;

    const state = this.createRandomCode();
    const codeVerifier = this.createRandomCode(64);
    const codeChallenge = this.hashValue(codeVerifier, 'base64url');
    const now = dayjs();
    const stateExpiresAt = now.add(
      GOOGLE_OAUTH_AUTHORIZATION_TTL_MINUTES,
      'minute',
    );

    await this.prisma.$transaction([
      this.prisma.googleOAuthAuthorization.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: now.toDate() } },
            { consumedAt: { not: null } },
          ],
        },
      }),
      this.prisma.googleOAuthAuthorization.create({
        data: {
          stateHash: this.hashValue(state),
          codeVerifier,
          expiresAt: stateExpiresAt.toDate(),
        },
      }),
    ]);

    const googleClient = new OAuth2Client(clientId, undefined, redirectUri);
    const authorizationUrl = googleClient.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    });

    return { authorizationUrl };
  }

  async handleGoogleAuthorizationCallback(code?: string, state?: string) {
    if (!code) {
      throw new BadRequestException('Google authorization code is required.');
    }
    if (!state) {
      throw new UnauthorizedException(
        'Google authorization state is required.',
      );
    }
    const { clientId, clientSecret, redirectUri } =
      this.appConfiguration.google;
    const frontendUrl = this.appConfiguration.frontendUrl;
    const authorization = await this.consumeGoogleOAuthAuthorization(state);

    try {
      const googleClient = new OAuth2Client(
        clientId,
        clientSecret,
        redirectUri,
      );
      const { tokens } = await googleClient.getToken({
        code,
        codeVerifier: authorization.codeVerifier,
      });

      if (!tokens.id_token) {
        throw new UnauthorizedException('Google did not return an ID token.');
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || !payload.email_verified) {
        throw new UnauthorizedException(
          'Google account could not be verified.',
        );
      }

      const googleUser = await this.findOrCreateGoogleUser({
        subject: payload.sub,
        email: payload.email,
        name: payload.name,
      });
      const handoff = await this.createGoogleHandoffCode(googleUser.user.id);
      const redirectUrl = new URL(`${frontendUrl}`);
      redirectUrl.searchParams.set('code', handoff.code);

      return {
        redirectUrl: redirectUrl.toString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new UnauthorizedException('Google authorization failed.');
    }
  }

  async exchangeGoogleHandoffCode(dto: GoogleAuthExchangeDto) {
    const codeHash = this.hashValue(dto.code);
    const now = dayjs();
    const [handoffCode] = await this.prisma.authHandoffCode.updateManyAndReturn(
      {
        where: {
          codeHash,
          consumedAt: null,
          expiresAt: { gt: now.toDate() },
        },
        data: { consumedAt: now.toDate() },
        select: { userId: true },
      },
    );

    if (!handoffCode) {
      throw new UnauthorizedException(
        'Google sign-in code is invalid or expired.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: handoffCode.userId },
    });
    if (!user) {
      throw new UnauthorizedException(
        'Google sign-in code is invalid or expired.',
      );
    }
    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('Account is banned.');
    }

    const token = await this.jwtService.signAsync({ userId: user.id });
    return { token };
  }

  private async consumeGoogleOAuthAuthorization(state: string) {
    const now = dayjs();
    const [authorization] =
      await this.prisma.googleOAuthAuthorization.updateManyAndReturn({
        where: {
          stateHash: this.hashValue(state),
          consumedAt: null,
          expiresAt: { gt: now.toDate() },
        },
        data: { consumedAt: now.toDate() },
        select: { codeVerifier: true },
      });

    if (!authorization) {
      throw new UnauthorizedException(
        'Google authorization state is invalid or expired.',
      );
    }

    return authorization;
  }

  private async findOrCreateGoogleUser(googleProfile: {
    subject: string;
    email: string;
    name?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existingGoogleUser = await tx.user.findUnique({
        where: { googleSubject: googleProfile.subject },
      });
      if (existingGoogleUser) {
        if (existingGoogleUser.status === UserStatus.BANNED) {
          throw new ForbiddenException('Account is banned.');
        }
        return { user: existingGoogleUser, created: false };
      }

      const existingPasswordAccount = await tx.user.findUnique({
        where: { email: googleProfile.email },
      });
      if (existingPasswordAccount) {
        throw new ConflictException(
          'An account with this email already exists. Sign in with your password.',
        );
      }

      const user = await tx.user.create({
        data: {
          email: googleProfile.email,
          name: googleProfile.name,
          status: UserStatus.VERIFIED,
          googleSubject: googleProfile.subject,
        },
      });
      await tx.category.createMany({
        data: getDefaultCategories(user.id),
      });

      return { user, created: true };
    });
  }

  private async createGoogleHandoffCode(userId: number) {
    const code = this.createRandomCode();
    const now = dayjs();
    const handoffExpiresAt = now.add(GOOGLE_HANDOFF_CODE_TTL_MINUTES, 'minute');

    await this.prisma.$transaction([
      this.prisma.authHandoffCode.deleteMany({ where: { userId } }),
      this.prisma.authHandoffCode.create({
        data: {
          userId,
          codeHash: this.hashValue(code),
          expiresAt: handoffExpiresAt.toDate(),
        },
      }),
    ]);

    return { code, expiresAt: handoffExpiresAt };
  }

  private createRandomCode(bytes = 32) {
    return randomBytes(bytes).toString('base64url');
  }

  private hashValue(value: string, encoding: 'hex' | 'base64url' = 'hex') {
    return createHash('sha256').update(value).digest(encoding);
  }

  async validateUser(dto: LoginDto) {
    const { email, password } = dto;
    const existUser = await this.prisma.user.findUnique({ where: { email } });
    if (!existUser) throw new NotFoundException('email is does not exist');

    if (existUser.status !== UserStatus.VERIFIED) {
      throw new BadRequestException(
        'User account is not verified. Please verify your email.',
      );
    }

    if (!existUser.password) {
      throw new UnauthorizedException('This account uses Google sign-in.');
    }

    const isMatchPassword = await bcrypt.compare(password, existUser.password);
    if (!isMatchPassword)
      throw new BadRequestException('password does not match');

    return existUser;
  }
}
