import { TransactionType } from 'generated/prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  const prisma = {
    category: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const service = new CategoryService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.category.findMany.mockResolvedValue([]);
    prisma.category.count.mockResolvedValue(0);
  });

  it('combines the type and keyword filters', async () => {
    await service.findAll(
      { type: TransactionType.EXPEND, keyword: 'food' },
      10,
    );

    const where = {
      userId: 10,
      type: TransactionType.EXPEND,
      title: { contains: 'food', mode: 'insensitive' as const },
    };
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where,
      skip: 0,
      take: 10,
    });
    expect(prisma.category.count).toHaveBeenCalledWith({ where });
  });

  it('allows Uncategorized without querying a category', async () => {
    await expect(service.validateExpenseCategory(null, 10)).resolves.toBeNull();
    expect(prisma.category.findFirst).not.toHaveBeenCalled();
  });

  it('checks ownership and expense type for a category', async () => {
    prisma.category.findFirst.mockResolvedValueOnce(null);
    await expect(service.validateExpenseCategory(1, 10)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { id: 1, userId: 10 },
    });

    prisma.category.findFirst.mockResolvedValueOnce({
      id: 1,
      userId: 10,
      type: TransactionType.INCOME,
    });
    await expect(service.validateExpenseCategory(1, 10)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const expense = { id: 1, userId: 10, type: TransactionType.EXPEND };
    prisma.category.findFirst.mockResolvedValueOnce(expense);
    await expect(service.validateExpenseCategory(1, 10)).resolves.toEqual(
      expense,
    );
  });
});
