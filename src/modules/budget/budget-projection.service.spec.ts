import { TransactionType } from 'generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetProjectionService } from './budget-projection.service';

describe('BudgetProjectionService', () => {
  const tx = {
    $executeRaw: jest.fn(),
    budget: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    transaction: { groupBy: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const service = new BudgetProjectionService(
    prisma as unknown as PrismaService,
  );
  const rawQueries = () =>
    tx.$executeRaw.mock.calls as unknown as Array<
      [{ sql: string; values: unknown[] }]
    >;

  const expense = (overrides = {}) => ({
    userId: 1,
    categoryId: 4,
    amount: 12500,
    date: new Date('2026-08-31T17:00:00.000Z'),
    type: TransactionType.EXPEND,
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
  });

  it('atomically adds spending for a categorized expense', async () => {
    await service.applyTransactionChange(tx as never, null, expense());

    const query = rawQueries()[0][0];
    expect(query.sql).toContain(
      'ON CONFLICT ("userId", "categoryId", "period") WHERE "categoryId" IS NOT NULL',
    );
    expect(query.sql).toContain(
      '"spentAmount" = "Budget"."spentAmount" + EXCLUDED."spentAmount"',
    );
    expect(query.values).toEqual([1, 4, '2026-09', 12500]);
    expect(tx.budget.findFirst).not.toHaveBeenCalled();
  });

  it('uses the Uncategorized unique index when categoryId is null', async () => {
    await service.applyTransactionChange(
      tx as never,
      null,
      expense({ categoryId: null }),
    );

    const query = rawQueries()[0][0];
    expect(query.sql).toContain(
      'ON CONFLICT ("userId", "period") WHERE "categoryId" IS NULL',
    );
    expect(query.values).toEqual([1, null, '2026-09', 12500]);
  });

  it('moves spending between category/month rows during an edit', async () => {
    await service.applyTransactionChange(
      tx as never,
      expense({ categoryId: 4, amount: 1000 }),
      expense({
        categoryId: 7,
        amount: 2500,
        date: new Date('2026-09-30T17:00:00.000Z'),
      }),
    );

    const queries = rawQueries().map(([query]) => query);
    expect(queries.map((query) => query.values)).toEqual([
      [1, 4, '2026-09', -1000],
      [1, 7, '2026-10', 2500],
    ]);
  });

  it('updates only the amount difference when category and month stay the same', async () => {
    await service.applyTransactionChange(
      tx as never,
      expense({ amount: 1000 }),
      expense({ amount: 2500 }),
    );

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const query = rawQueries()[0][0];
    expect(query.values).toEqual([1, 4, '2026-09', 1500]);
  });

  it('ignores income and investment transactions', async () => {
    await service.applyTransactionChange(
      tx as never,
      null,
      expense({ type: TransactionType.INCOME }),
    );
    await service.applyTransactionChange(
      tx as never,
      null,
      expense({ type: TransactionType.INVESTMENT }),
    );

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('rebuilds a period from transactions and resets stale rows', async () => {
    tx.transaction.groupBy.mockResolvedValue([
      { categoryId: 4, _sum: { amount: 9000 } },
      { categoryId: null, _sum: { amount: 500 } },
    ]);
    tx.budget.findMany.mockResolvedValue([
      { id: 10, categoryId: 4 },
      { id: 11, categoryId: 8 },
    ]);

    await service.reconcile(1, '2026-09');

    expect(tx.budget.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { spentAmount: 9000 },
    });
    expect(tx.budget.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { spentAmount: 0 },
    });
    expect(tx.budget.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        categoryId: null,
        period: '2026-09',
        plannedAmount: null,
        spentAmount: 500,
      },
    });
  });
});
