import { TransactionType } from 'generated/prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { SummaryService } from './summary.service';

describe('SummaryService', () => {
  const prisma = {
    category: {
      findMany: jest.fn(),
    },
    transaction: {
      groupBy: jest.fn(),
    },
  };
  const service = new SummaryService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('summarizes all three types while keeping investment out of net', async () => {
    prisma.transaction.groupBy.mockResolvedValue([
      {
        type: TransactionType.INCOME,
        _sum: { amount: 415000 },
        _count: { _all: 2 },
      },
      {
        type: TransactionType.EXPEND,
        _sum: { amount: 135899 },
        _count: { _all: 4 },
      },
      {
        type: TransactionType.INVESTMENT,
        _sum: { amount: 50000 },
        _count: { _all: 1 },
      },
    ]);

    const result = await service.getSummary(10, { month: '2026-07' });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['type'],
      where: {
        userId: 10,
        type: {
          in: [
            TransactionType.INCOME,
            TransactionType.EXPEND,
            TransactionType.INVESTMENT,
          ],
        },
        date: {
          gte: new Date('2026-06-30T17:00:00.000Z'),
          lt: new Date('2026-07-31T17:00:00.000Z'),
        },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });
    expect(result).toEqual({
      month: '2026-07',
      income: 4150,
      expenses: 1358.99,
      investment: 500,
      net: 2791.01,
      incomeTransactionCount: 2,
      expenseTransactionCount: 4,
      investmentTransactionCount: 1,
      transactionCount: 7,
    });
  });

  it('returns zero values for an empty month', async () => {
    prisma.transaction.groupBy.mockResolvedValue([]);

    const result = await service.getSummary(10, { month: '2026-08' });

    expect(result).toEqual({
      month: '2026-08',
      income: 0,
      expenses: 0,
      investment: 0,
      net: 0,
      incomeTransactionCount: 0,
      expenseTransactionCount: 0,
      investmentTransactionCount: 0,
      transactionCount: 0,
    });
  });

  it('lists every expense category by monthly spending and includes uncategorized expenses', async () => {
    prisma.category.findMany.mockResolvedValue([
      { id: 1, title: 'Housing' },
      { id: 2, title: 'Groceries' },
      { id: 3, title: 'Dining' },
    ]);
    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 1, _sum: { amount: 76000 } },
      { categoryId: 2, _sum: { amount: 24140 } },
      { categoryId: null, _sum: { amount: 9899 } },
    ]);

    const result = await service.getExpensesByCategory(10, {
      month: '2026-07',
    });

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { userId: 10, type: TransactionType.EXPEND },
      select: { id: true, title: true },
    });
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['categoryId'],
      where: {
        userId: 10,
        type: TransactionType.EXPEND,
        date: {
          gte: new Date('2026-06-30T17:00:00.000Z'),
          lt: new Date('2026-07-31T17:00:00.000Z'),
        },
      },
      _sum: { amount: true },
    });
    expect(result).toEqual({
      month: '2026-07',
      totalExpenses: 1100.39,
      data: [
        { categoryId: 1, title: 'Housing', amount: 760, percentage: 69.1 },
        { categoryId: 2, title: 'Groceries', amount: 241.4, percentage: 21.9 },
        {
          categoryId: null,
          title: 'Uncategorized',
          amount: 98.99,
          percentage: 9,
        },
        { categoryId: 3, title: 'Dining', amount: 0, percentage: 0 },
      ],
    });
  });

  it('defaults to the current Bangkok month and handles a month with no expenses', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-31T18:00:00.000Z'));
    try {
      prisma.category.findMany.mockResolvedValue([{ id: 1, title: 'Housing' }]);
      prisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getExpensesByCategory(10, {});

      expect(result).toEqual({
        month: '2026-08',
        totalExpenses: 0,
        data: [{ categoryId: 1, title: 'Housing', amount: 0, percentage: 0 }],
      });
      expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
        by: ['categoryId'],
        where: {
          userId: 10,
          type: TransactionType.EXPEND,
          date: {
            gte: new Date('2026-07-31T17:00:00.000Z'),
            lt: new Date('2026-08-31T17:00:00.000Z'),
          },
        },
        _sum: { amount: true },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('buckets net cash flow by Bangkok day and keeps satang precision', async () => {
    prisma.transaction.groupBy.mockResolvedValue([
      {
        date: new Date('2026-06-30T17:00:00.000Z'),
        type: TransactionType.EXPEND,
        _sum: { amount: 500 },
      },
      {
        date: new Date('2026-07-01T17:30:00.000Z'),
        type: TransactionType.INCOME,
        _sum: { amount: 10010 },
      },
      {
        date: new Date('2026-07-02T03:00:00.000Z'),
        type: TransactionType.EXPEND,
        _sum: { amount: 3333 },
      },
      {
        date: new Date('2026-07-02T04:00:00.000Z'),
        type: TransactionType.EXPEND,
        _sum: { amount: 1000 },
      },
    ]);

    const result = await service.getNetCashFlow(10, {
      type: 'monthly',
      month: '2026-07',
      year: 1999,
    });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['date', 'type'],
      where: {
        userId: 10,
        type: { in: [TransactionType.INCOME, TransactionType.EXPEND] },
        date: {
          gte: new Date('2026-06-30T17:00:00.000Z'),
          lt: new Date('2026-07-31T17:00:00.000Z'),
        },
      },
      _sum: { amount: true },
    });
    const zeroDays = Array.from({ length: 29 }, (_, index) => ({
      period: `2026-07-${String(index + 3).padStart(2, '0')}`,
      income: 0,
      expenses: 0,
      netCashFlow: 0,
    }));
    expect(result).toEqual({
      type: 'monthly',
      period: '2026-07',
      timezone: 'Asia/Bangkok',
      totals: { income: 100.1, expenses: 48.33, netCashFlow: 51.77 },
      data: [
        { period: '2026-07-01', income: 0, expenses: 5, netCashFlow: -5 },
        {
          period: '2026-07-02',
          income: 100.1,
          expenses: 43.33,
          netCashFlow: 56.77,
        },
        ...zeroDays,
      ],
    });
  });

  it('zero-fills every day of a month with no cash flow', async () => {
    prisma.transaction.groupBy.mockResolvedValue([]);

    const result = await service.getNetCashFlow(10, {
      type: 'monthly',
      month: '2026-02',
    });

    expect(result).toEqual({
      type: 'monthly',
      period: '2026-02',
      timezone: 'Asia/Bangkok',
      totals: { income: 0, expenses: 0, netCashFlow: 0 },
      data: Array.from({ length: 28 }, (_, index) => ({
        period: `2026-02-${String(index + 1).padStart(2, '0')}`,
        income: 0,
        expenses: 0,
        netCashFlow: 0,
      })),
    });
  });

  it('buckets yearly net cash flow by Bangkok month and zero-fills all 12 months', async () => {
    prisma.transaction.groupBy.mockResolvedValue([
      {
        date: new Date('2025-12-31T17:00:00.000Z'),
        type: TransactionType.EXPEND,
        _sum: { amount: 3333 },
      },
      {
        date: new Date('2026-01-15T05:00:00.000Z'),
        type: TransactionType.EXPEND,
        _sum: { amount: 1000 },
      },
      {
        date: new Date('2026-01-31T18:00:00.000Z'),
        type: TransactionType.INCOME,
        _sum: { amount: 10010 },
      },
      {
        date: new Date('2026-12-31T16:59:59.000Z'),
        type: TransactionType.INCOME,
        _sum: { amount: 5000 },
      },
    ]);

    const result = await service.getNetCashFlow(10, {
      type: 'yearly',
      year: 2026,
      month: '1999-01',
    });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['date', 'type'],
      where: {
        userId: 10,
        type: { in: [TransactionType.INCOME, TransactionType.EXPEND] },
        date: {
          gte: new Date('2025-12-31T17:00:00.000Z'),
          lt: new Date('2026-12-31T17:00:00.000Z'),
        },
      },
      _sum: { amount: true },
    });
    const zeroMonths = Array.from({ length: 9 }, (_, index) => ({
      period: `2026-${String(index + 3).padStart(2, '0')}`,
      income: 0,
      expenses: 0,
      netCashFlow: 0,
    }));
    expect(result).toEqual({
      type: 'yearly',
      period: '2026',
      timezone: 'Asia/Bangkok',
      totals: { income: 150.1, expenses: 43.33, netCashFlow: 106.77 },
      data: [
        { period: '2026-01', income: 0, expenses: 43.33, netCashFlow: -43.33 },
        { period: '2026-02', income: 100.1, expenses: 0, netCashFlow: 100.1 },
        ...zeroMonths,
        { period: '2026-12', income: 50, expenses: 0, netCashFlow: 50 },
      ],
    });
  });
});
