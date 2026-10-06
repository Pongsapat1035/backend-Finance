import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TransactionType, UserStatus } from 'generated/prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { BudgetController } from '../src/modules/budget/budget.controller';
import { BudgetProjectionService } from '../src/modules/budget/budget-projection.service';
import { BudgetService } from '../src/modules/budget/budget.service';
import { CategoryService } from '../src/modules/category/category.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { appConfig } from '../src/config/app.config';

const jwtSecret = 'budget-e2e-test-secret';

type BudgetRecord = {
  id: number;
  userId: number;
  categoryId: number | null;
  period: string;
  plannedAmount: number | null;
  spentAmount: number;
};

describe('Budget endpoints (e2e)', () => {
  let app: INestApplication;
  const jwt = new JwtService({ secret: jwtSecret });
  const categories = [
    { id: 4, userId: 1, title: 'Food', type: TransactionType.EXPEND },
    { id: 5, userId: 2, title: 'Private', type: TransactionType.EXPEND },
  ];
  let budgets: BudgetRecord[];
  const matches = (budget: BudgetRecord, where: Partial<BudgetRecord>) =>
    Object.entries(where).every(
      ([key, value]) => budget[key as keyof BudgetRecord] === value,
    );
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: number } }) =>
        [1, 2].includes(where.id)
          ? { id: where.id, status: UserStatus.VERIFIED }
          : null,
      ),
    },
    category: {
      findFirst: jest.fn(
        ({ where }: { where: { id: number; userId: number } }) =>
          categories.find(
            (category) =>
              category.id === where.id && category.userId === where.userId,
          ) ?? null,
      ),
      findMany: jest.fn(({ where }: { where: { userId: number } }) =>
        categories.filter((category) => category.userId === where.userId),
      ),
    },
    budget: {
      findFirst: jest.fn(
        ({ where }: { where: Partial<BudgetRecord> }) =>
          budgets.find((budget) => matches(budget, where)) ?? null,
      ),
      findMany: jest.fn(({ where }: { where: Partial<BudgetRecord> }) =>
        budgets.filter((budget) => matches(budget, where)),
      ),
      create: jest.fn(
        ({ data }: { data: Omit<BudgetRecord, 'id' | 'spentAmount'> }) => {
          const budget = {
            ...data,
            id: Math.max(...budgets.map((row) => row.id)) + 1,
            spentAmount: 0,
          };
          budgets.push(budget);
          return budget;
        },
      ),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const tokenFor = (userId: number) => jwt.sign({ userId });

  beforeEach(async () => {
    jest.clearAllMocks();
    budgets = [
      {
        id: 10,
        userId: 1,
        categoryId: 4,
        period: '2026-09',
        plannedAmount: 10000,
        spentAmount: 2500,
      },
      {
        id: 20,
        userId: 2,
        categoryId: 5,
        period: '2026-09',
        plannedAmount: 50000,
        spentAmount: 0,
      },
    ];

    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [BudgetController],
      providers: [
        BudgetService,
        CategoryService,
        JwtStrategy,
        { provide: appConfig.KEY, useValue: { jwtSecret } },
        { provide: PrismaService, useValue: prisma },
        {
          provide: BudgetProjectionService,
          useValue: { reconcile: jest.fn() },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => app.close());

  it('requires a valid bearer token on every Budget route', async () => {
    const server = app.getHttpServer() as App;
    await request(server).post('/budget').send({}).expect(401);
    await request(server).get('/budget?period=2026-09').expect(401);
    await request(server).get('/budget/exceeded?period=2026-09').expect(401);
    await request(server).get('/budget/10').expect(401);
    await request(server).patch('/budget/10').send({}).expect(401);
    await request(server).delete('/budget/10').expect(401);
    await request(server)
      .get('/budget/10')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('keeps reads and mutations scoped to the authenticated user', async () => {
    const server = app.getHttpServer() as App;
    const auth = `Bearer ${tokenFor(1)}`;

    const list = await request(server)
      .get('/budget?period=2026-09')
      .set('Authorization', auth)
      .expect(200);
    const body = list.body as { data: unknown; summary: unknown };
    expect(body.data).toEqual([
      expect.objectContaining({
        id: 10,
        categoryId: 4,
        planned: 100,
        spent: 25,
      }),
    ]);
    expect(body.summary).toEqual(
      expect.objectContaining({ totalPlanned: 100, totalSpent: 25 }),
    );

    await request(server)
      .get('/budget/20')
      .set('Authorization', auth)
      .expect(404);
    await request(server)
      .patch('/budget/20')
      .set('Authorization', auth)
      .send({ plannedAmount: 12.34 })
      .expect(404);
    await request(server)
      .delete('/budget/20')
      .set('Authorization', auth)
      .expect(404);
    await request(server)
      .post('/budget')
      .set('Authorization', auth)
      .send({ period: '2026-09', categoryId: 5, plannedAmount: 12.34 })
      .expect(404);
    expect(prisma.budget.update).not.toHaveBeenCalled();
    expect(prisma.budget.delete).not.toHaveBeenCalled();
    expect(prisma.budget.create).not.toHaveBeenCalled();
  });

  it('stores incoming baht as satang and responds in baht', async () => {
    const response = await request(app.getHttpServer() as App)
      .post('/budget')
      .set('Authorization', `Bearer ${tokenFor(1)}`)
      .send({ period: '2026-10', categoryId: null, plannedAmount: 12.34 })
      .expect(201);

    expect(prisma.budget.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        categoryId: null,
        period: '2026-10',
        plannedAmount: 1234,
      },
    });
    expect(response.body).toEqual(
      expect.objectContaining({ plannedAmount: 12.34, spentAmount: 0 }),
    );
  });

  it('rejects amounts with more than two decimals and invalid months', async () => {
    const server = app.getHttpServer() as App;
    const auth = `Bearer ${tokenFor(1)}`;
    await request(server)
      .post('/budget')
      .set('Authorization', auth)
      .send({ period: '2026-09', categoryId: null, plannedAmount: 12.345 })
      .expect(400);
    await request(server)
      .post('/budget')
      .set('Authorization', auth)
      .send({ period: '2026-09', categoryId: null, plannedAmount: '' })
      .expect(400);
    await request(server)
      .post('/budget')
      .set('Authorization', auth)
      .send({ period: '2026-09', categoryId: null, plannedAmount: 21474836.48 })
      .expect(400);
    await request(server)
      .patch('/budget/10')
      .set('Authorization', auth)
      .send({ plannedAmount: null })
      .expect(400);
    await request(server)
      .get('/budget/exceeded?period=2026-13')
      .set('Authorization', auth)
      .expect(400);
    expect(prisma.budget.create).not.toHaveBeenCalled();
  });
});
