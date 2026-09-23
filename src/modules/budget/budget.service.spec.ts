import { BadRequestException } from '@nestjs/common';
import { TransactionType } from 'generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetProjectionService } from './budget-projection.service';
import { BudgetService } from './budget.service';
import { CategoryService } from '../category/category.service';

describe('BudgetService', () => {
  const prisma = {
    budget: {
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    category: { findFirst: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const projection = { reconcile: jest.fn() };
  const service = new BudgetService(
    prisma as unknown as PrismaService,
    projection as unknown as BudgetProjectionService,
    new CategoryService(prisma as unknown as PrismaService),
  );
  const category = {
    id: 4,
    title: 'Food',
    type: TransactionType.EXPEND,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
  });

  it('returns every expense category, explicit missing budgets, totals, and Uncategorized', async () => {
    prisma.category.findMany.mockResolvedValue([
      category,
      { id: 5, title: 'Travel', type: TransactionType.EXPEND },
    ]);
    prisma.budget.findMany.mockResolvedValue([
      { categoryId: 4, plannedAmount: 10000, spentAmount: 2500 },
      { categoryId: null, plannedAmount: null, spentAmount: 300 },
    ]);
    const result = await service.findAll({ period: '2026-09' }, 1);

    expect(result.data).toEqual([
      expect.objectContaining({
        categoryId: 4,
        hasBudget: true,
        planned: 10000,
        spent: 2500,
        remaining: 7500,
        percentUsed: 25,
      }),
      expect.objectContaining({ categoryId: 5, hasBudget: false, planned: 0 }),
      expect.objectContaining({
        categoryId: null,
        label: 'Uncategorized',
        hasBudget: false,
        spent: 300,
      }),
    ]);
    expect(result).toEqual({
      period: '2026-09',
      data: expect.any(Array),
      summary: {
        totalPlanned: 10000,
        totalSpent: 2800,
        totalRemaining: 7200,
      },
    });
  });

  it('summarizes only planned categories whose spending exceeds the plan', async () => {
    prisma.category.findMany.mockResolvedValue([
      category,
      { id: 5, title: 'Travel', type: TransactionType.EXPEND },
      { id: 6, title: 'Shopping', type: TransactionType.EXPEND },
    ]);
    prisma.budget.findMany.mockResolvedValue([
      { categoryId: 4, plannedAmount: 100, spentAmount: 112 },
      { categoryId: 5, plannedAmount: 100, spentAmount: 100 },
      { categoryId: 6, plannedAmount: null, spentAmount: 200 },
      { categoryId: null, plannedAmount: 0, spentAmount: 8 },
    ]);

    const result = await service.findExceeded({ period: '2026-09' }, 7);

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { userId: 7, type: TransactionType.EXPEND },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.budget.findMany).toHaveBeenCalledWith({
      where: { userId: 7, period: '2026-09' },
    });
    expect(result).toEqual({
      period: '2026-09',
      data: [
        expect.objectContaining({
          categoryId: 4,
          planned: 100,
          spent: 112,
          exceededBy: 12,
        }),
        expect.objectContaining({
          categoryId: null,
          label: 'Uncategorized',
          planned: 0,
          spent: 8,
          exceededBy: 8,
        }),
      ],
      summary: { categoryCount: 2, totalExceeded: 20 },
    });
  });

  it('creates a budget only for an owned expense category', async () => {
    prisma.category.findFirst.mockResolvedValue(category);
    prisma.budget.findFirst.mockResolvedValue(null);
    prisma.budget.create.mockResolvedValue({ id: 1 });

    await service.create(
      { period: '2026-09', categoryId: 4, plannedAmount: 10000 },
      1,
    );

    expect(prisma.budget.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        categoryId: 4,
        period: '2026-09',
        plannedAmount: 10000,
      },
    });
  });

  it('rejects a duplicate persisted budget', async () => {
    prisma.category.findFirst.mockResolvedValue(category);
    prisma.budget.findFirst.mockResolvedValue({ plannedAmount: 1 });

    await expect(
      service.create(
        { period: '2026-09', categoryId: 4, plannedAmount: 10000 },
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates the planned amount without looking up another budget in the same scope', async () => {
    const existing = {
      id: 1,
      userId: 1,
      categoryId: 4,
      period: '2026-09',
      plannedAmount: 10000,
      spentAmount: 2500,
    };
    prisma.budget.findFirst.mockResolvedValue(existing);
    prisma.budget.update.mockResolvedValue({
      ...existing,
      plannedAmount: 12000,
    });

    await expect(
      service.update(1, { plannedAmount: 12000 }, 1),
    ).resolves.toEqual({ ...existing, plannedAmount: 12000 });

    expect(prisma.budget.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 1, userId: 1 },
      data: { plannedAmount: 12000 },
    });
  });

  it('keeps spending in its original scope when moving a plan to an unplanned row', async () => {
    const existing = {
      id: 1,
      userId: 1,
      categoryId: 4,
      period: '2026-09',
      plannedAmount: 10000,
      spentAmount: 2500,
    };
    const target = {
      ...existing,
      id: 2,
      categoryId: 5,
      plannedAmount: null,
      spentAmount: 700,
    };
    prisma.budget.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(target);
    prisma.category.findFirst.mockResolvedValue({ ...category, id: 5 });
    prisma.budget.update
      .mockResolvedValueOnce({ ...target, plannedAmount: 10000 })
      .mockResolvedValueOnce({ ...existing, plannedAmount: null });

    await expect(service.update(1, { categoryId: 5 }, 1)).resolves.toEqual({
      ...target,
      plannedAmount: 10000,
    });

    expect(prisma.budget.update).toHaveBeenNthCalledWith(1, {
      where: { id: 2 },
      data: { plannedAmount: 10000 },
    });
    expect(prisma.budget.update).toHaveBeenNthCalledWith(2, {
      where: { id: 1, userId: 1 },
      data: { plannedAmount: null },
    });
    expect(prisma.budget.create).not.toHaveBeenCalled();
    expect(prisma.budget.delete).not.toHaveBeenCalled();
  });

  it('starts a new scope with zero spending and retains the old usage row', async () => {
    const existing = {
      id: 1,
      userId: 1,
      categoryId: 4,
      period: '2026-09',
      plannedAmount: 10000,
      spentAmount: 2500,
    };
    prisma.budget.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    prisma.category.findFirst.mockResolvedValue(category);
    prisma.budget.create.mockResolvedValue({
      ...existing,
      id: 2,
      period: '2026-10',
      spentAmount: 0,
    });
    prisma.budget.update.mockResolvedValue({
      ...existing,
      plannedAmount: null,
    });

    await service.update(1, { period: '2026-10' }, 1);

    expect(prisma.budget.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        categoryId: 4,
        period: '2026-10',
        plannedAmount: 10000,
        spentAmount: 0,
      },
    });
    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 1, userId: 1 },
      data: { plannedAmount: null },
    });
  });

  it('rejects moving a plan onto a scope that already has a plan', async () => {
    prisma.budget.findFirst
      .mockResolvedValueOnce({
        id: 1,
        userId: 1,
        categoryId: 4,
        period: '2026-09',
        plannedAmount: 10000,
        spentAmount: 0,
      })
      .mockResolvedValueOnce({ id: 2, plannedAmount: 5000 });
    prisma.category.findFirst.mockResolvedValue(category);

    await expect(
      service.update(1, { period: '2026-10' }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.budget.update).not.toHaveBeenCalled();
    expect(prisma.budget.delete).not.toHaveBeenCalled();
  });

  it('clears planning instead of removing a row that contains spending', async () => {
    prisma.budget.findFirst.mockResolvedValue({ id: 1, spentAmount: 50 });
    prisma.budget.update.mockResolvedValue({ id: 1, plannedAmount: null });

    await service.remove(1, 1);

    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { plannedAmount: null },
    });
    expect(prisma.budget.delete).not.toHaveBeenCalled();
  });

  it('delegates rebuilds to the backend-only projection operation', async () => {
    projection.reconcile.mockResolvedValue({ reconciled: true });

    await service.reconcile(1, '2026-09');

    expect(projection.reconcile).toHaveBeenCalledWith(1, '2026-09', undefined);
  });
});
