import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/modules/auth/auth.service';
import { OtpService } from './../src/modules/otp/otp.service';
import { PrismaService } from './../src/modules/prisma/prisma.service';

type ThrottledEndpoint = {
  name: string;
  path: string;
  body: Record<string, unknown>;
};

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;

  const endpoints: ThrottledEndpoint[] = [
    {
      name: 'sign-in',
      path: '/auth/signin',
      body: { email: 'user@example.com', password: 'password' },
    },
    {
      name: 'OTP verification',
      path: '/auth/verify',
      body: { userId: 1, otp: '123456' },
    },
    {
      name: 'OTP request',
      path: '/otp/send',
      body: { email: 'user@example.com' },
    },
    {
      name: 'OTP resend',
      path: '/otp/resent-otp',
      body: { userId: 1, referral: 'test-referral' },
    },
  ];

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.RESEND_API_KEY = 'test-resend-api-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue({
        create: jest.fn().mockResolvedValue({}),
        login: jest.fn().mockResolvedValue({ token: 'test-token' }),
        validateUser: jest.fn().mockResolvedValue({ id: 1 }),
        verifyOtp: jest.fn().mockResolvedValue({}),
      })
      .overrideProvider(OtpService)
      .useValue({
        requestOtp: jest.fn().mockResolvedValue({}),
        resentOtp: jest.fn().mockResolvedValue({}),
      })
      .overrideProvider(PrismaService)
      .useValue({
        user: { findUnique: jest.fn() },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(endpoints)(
    'returns 429 after three requests to $name',
    async ({ path, body }) => {
      const server = app.getHttpServer() as App;

      for (let attempt = 0; attempt < 3; attempt++) {
        await request(server).post(path).send(body).expect(201);
      }

      await request(server).post(path).send(body).expect(429);
    },
  );
});
