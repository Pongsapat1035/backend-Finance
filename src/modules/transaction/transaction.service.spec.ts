import { TransactionType } from 'generated/prisma/client';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetProjectionService } from '../budget/budget-projection.service';
import { TransactionService } from './transaction.service';

describe('TransactionService budget projection integration', () => {
  const prisma = {
    $transaction: jest.fn(),
    category: { findUnique: jest.fn() },
    transaction: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const projection = { applyTransactionChange: jest.fn() };
  const service = new TransactionService(
    prisma as unknown as PrismaService,
    projection as unknown as BudgetProjectionService,
  );
  const category = { id: 4, userId: 1, type: TransactionType.EXPEND };
  const transaction = (overrides = {}) => ({
    id: 1,
    userId: 1,
    categoryId: 4,
    amount: 10000,
    date: new Date('2026-09-01T00:00:00.000Z'),
    type: TransactionType.EXPEND,
    description: 'Groceries',
    category,
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    prisma.category.findUnique.mockResolvedValue(category);
  });

  it('adds an expense contribution after creation', async () => {
    const created = transaction();
    prisma.transaction.create.mockResolvedValue(created);

    await service.create(
      {
        categoryId: 4,
        amount: 10000,
        date: '2026-09-01T00:00:00.000Z',
        type: TransactionType.EXPEND,
        description: 'Groceries',
      },
      1,
    );

    expect(projection.applyTransactionChange).toHaveBeenCalledWith(
      prisma,
      null,
      created,
    );
  });

  it('allows an uncategorized expense but rejects uncategorized income', async () => {
    const created = transaction({ categoryId: null });
    prisma.transaction.create.mockResolvedValue(created);

    await service.create(
      {
        categoryId: null,
        amount: 10000,
        date: '2026-09-01T00:00:00.000Z',
        type: TransactionType.EXPEND,
        description: 'Cash expense',
      },
      1,
    );
    expect(prisma.category.findUnique).not.toHaveBeenCalled();

    await expect(
      service.create(
        {
          categoryId: null,
          amount: 10000,
          date: '2026-09-01T00:00:00.000Z',
          type: TransactionType.INCOME,
          description: 'Cash income',
        },
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies the old and new contribution on a recategorization edit', async () => {
    const existing = transaction();
    const updated = transaction({ categoryId: 5, amount: 20000 });
    prisma.transaction.findFirst.mockResolvedValue(existing);
    prisma.transaction.update.mockResolvedValue(updated);
    prisma.category.findUnique.mockResolvedValue({ ...category, id: 5 });

    await service.update(1, 1, {
      categoryId: 5,
      amount: 20000,
      date: '2026-09-01T00:00:00.000Z',
      type: TransactionType.EXPEND,
      description: 'Groceries',
    });

    expect(projection.applyTransactionChange).toHaveBeenCalledWith(
      prisma,
      existing,
      updated,
    );
  });

  it('removes an expense contribution on delete', async () => {
    const existing = transaction();
    prisma.transaction.findFirst.mockResolvedValue(existing);
    prisma.transaction.delete.mockResolvedValue(existing);

    await service.remove(1, 1);
    expect(projection.applyTransactionChange).toHaveBeenLastCalledWith(
      prisma,
      existing,
      null,
    );
  });

  it('lists the same Bangkok month used by the summary', async () => {
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.transaction.count.mockResolvedValue(0);

    await service.findAll(1, { month: '2026-07', sortBy: 'date' });

    const expectedWhere = {
      userId: 1,
      date: {
        gte: new Date('2026-06-30T17:00:00.000Z'),
        lt: new Date('2026-07-31T17:00:00.000Z'),
      },
    };
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(prisma.transaction.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });
});
