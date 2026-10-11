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
});
