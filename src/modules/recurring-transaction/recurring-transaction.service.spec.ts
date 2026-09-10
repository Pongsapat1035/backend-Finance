import { Prisma, TransactionType } from 'generated/prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { RecurringTransactionService } from './recurring-transaction.service';

describe('RecurringTransactionService', () => {
  const prisma = {
    category: {
      findFirst: jest.fn(),
    },
    recurringTransaction: {
      aggregate: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new RecurringTransactionService(
    prisma as unknown as PrismaService,
  );

  const expenseCategory = {
    id: 1,
    title: 'Housing',
    type: TransactionType.EXPEND,
    userId: 10,
  };
  const recurringRecord = (overrides = {}) => ({
    id: 1,
    title: 'Rent',
    description: null,
    amount: 120050,
    dayOfMonth: 1,
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: null,
    nextRunAt: new Date('2026-08-31T17:00:00.000Z'),
    isActive: true,
    category: expenseCategory,
    ...overrides,
  });
  const createDto = (overrides = {}) => ({
    categoryId: 1,
    title: 'Rent',
    amount: 1200.5,
    dayOfMonth: 1,
    startDate: '2026-09-01T00:00:00.000Z',
    ...overrides,
  });
  const recordNotFoundError = () =>
    new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('creates a recurring expense in satang and returns it in baht', async () => {
      prisma.category.findFirst.mockResolvedValue(expenseCategory);
      prisma.recurringTransaction.create.mockResolvedValue(recurringRecord());

      const result = await service.create(createDto({ isActive: false }), 10);

      expect(prisma.recurringTransaction.create).toHaveBeenCalledWith({
        data: {
          title: 'Rent',
          amount: 120050,
          categoryId: 1,
          userId: 10,
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: null,
          dayOfMonth: 1,
          nextRunAt: new Date('2026-08-31T17:00:00.000Z'),
          isActive: false,
        },
        include: { category: true },
      });
      expect(result.amount).toBe(1200.5);
    });

    it('rejects an end date before the start date', async () => {
      await expect(
        service.create(
          createDto({
            startDate: '2026-09-05T00:00:00.000Z',
            endDate: '2026-09-01T00:00:00.000Z',
          }),
          10,
        ),
      ).rejects.toThrow('endDate must be on or after startDate');

      expect(prisma.category.findFirst).not.toHaveBeenCalled();
      expect(prisma.recurringTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects a category that does not belong to the user', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto(), 10)).rejects.toThrow(
        'Category #1 not found',
      );

      expect(prisma.recurringTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects a category that is not an expense category', async () => {
      prisma.category.findFirst.mockResolvedValue({
        ...expenseCategory,
        type: TransactionType.INCOME,
      });

      await expect(service.create(createDto(), 10)).rejects.toThrow(
        'Recurring transactions require an EXPEND category',
      );

      expect(prisma.recurringTransaction.create).not.toHaveBeenCalled();
    });

    it('schedules the next month when the selected day has passed', async () => {
      prisma.category.findFirst.mockResolvedValue(expenseCategory);
      prisma.recurringTransaction.create.mockResolvedValue(recurringRecord());

      await service.create(
        createDto({
          dayOfMonth: 10,
          startDate: '2026-09-20T00:00:00.000Z',
        }),
        10,
      );

      expect(prisma.recurringTransaction.create).toHaveBeenCalledWith({
        data: {
          title: 'Rent',
          amount: 120050,
          categoryId: 1,
          userId: 10,
          startDate: new Date('2026-09-20T00:00:00.000Z'),
          endDate: null,
          dayOfMonth: 10,
          nextRunAt: new Date('2026-10-09T17:00:00.000Z'),
        },
        include: { category: true },
      });
    });

    it('uses the final day of a short month for day 31', async () => {
      prisma.category.findFirst.mockResolvedValue(expenseCategory);
      prisma.recurringTransaction.create.mockResolvedValue(recurringRecord());

      await service.create(
        createDto({
          dayOfMonth: 31,
          startDate: '2026-04-01T00:00:00.000Z',
        }),
        10,
      );

      expect(prisma.recurringTransaction.create).toHaveBeenCalledWith({
        data: {
          title: 'Rent',
          amount: 120050,
          categoryId: 1,
          userId: 10,
          startDate: new Date('2026-04-01T00:00:00.000Z'),
          endDate: null,
          dayOfMonth: 31,
          nextRunAt: new Date('2026-04-29T17:00:00.000Z'),
        },
        include: { category: true },
      });
    });
  });

  describe('findAll', () => {
    it('filters, paginates, and converts stored amounts to baht', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([
        recurringRecord(),
      ]);
      prisma.recurringTransaction.count.mockResolvedValue(2);
      prisma.recurringTransaction.aggregate.mockResolvedValue({
        _sum: { amount: 350075 },
      });

      const result = await service.findAll(10, {
        page: 2,
        limit: 1,
        keyword: 'rent',
        categoryId: 1,
        isActive: false,
      });

      expect(prisma.recurringTransaction.findMany).toHaveBeenCalledWith({
        where: {
          userId: 10,
          categoryId: 1,
          isActive: false,
          title: { contains: 'rent', mode: 'insensitive' },
        },
        include: { category: true },
        orderBy: { nextRunAt: 'asc' },
        skip: 1,
        take: 1,
      });
      expect(result).toEqual({
        data: [{ ...recurringRecord(), amount: 1200.5 }],
        meta: {
          total: 2,
          expectedTotal: 3500.75,
          page: 2,
          limit: 1,
          totalPages: 2,
        },
      });
    });

    it('uses default pagination and returns zero when no amounts match', async () => {
      prisma.recurringTransaction.findMany.mockResolvedValue([]);
      prisma.recurringTransaction.count.mockResolvedValue(0);
      prisma.recurringTransaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const result = await service.findAll(10, {});

      expect(prisma.recurringTransaction.findMany).toHaveBeenCalledWith({
        where: { userId: 10 },
        include: { category: true },
        orderBy: { nextRunAt: 'asc' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        data: [],
        meta: {
          total: 0,
          expectedTotal: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });
    });
  });

  describe('findOne', () => {
    it('returns an owned recurring transaction in baht', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(
        recurringRecord(),
      );

      const result = await service.findOne(1, 10);

      expect(prisma.recurringTransaction.findFirst).toHaveBeenCalledWith({
        where: { id: 1, userId: 10 },
        include: { category: true },
      });
      expect(result).toEqual({ ...recurringRecord(), amount: 1200.5 });
    });

    it('rejects a recurring transaction that is missing or not owned', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne(1, 10)).rejects.toThrow(
        'Recurring transaction #1 not found',
      );
    });
  });

  describe('update', () => {
    it('updates an unchanged schedule without recalculating nextRunAt', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(
        recurringRecord(),
      );
      prisma.category.findFirst.mockResolvedValue(expenseCategory);
      prisma.recurringTransaction.update.mockResolvedValue(
        recurringRecord({ amount: 150050, title: 'New rent' }),
      );

      const result = await service.update(
        1,
        10,
        createDto({
          amount: 1500.5,
          title: 'New rent',
          endDate: '2026-12-01T00:00:00.000Z',
          isActive: false,
        }),
      );

      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          title: 'New rent',
          amount: 150050,
          categoryId: 1,
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2026-12-01T00:00:00.000Z'),
          dayOfMonth: 1,
          isActive: false,
        },
        include: { category: true },
      });
      expect(result.amount).toBe(1500.5);
    });

    it('recalculates nextRunAt when the scheduled day changes', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(
        recurringRecord(),
      );
      prisma.category.findFirst.mockResolvedValue(expenseCategory);
      prisma.recurringTransaction.update.mockResolvedValue(
        recurringRecord({ dayOfMonth: 10 }),
      );

      await service.update(1, 10, createDto({ dayOfMonth: 10 }));

      expect(prisma.recurringTransaction.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          title: 'Rent',
          amount: 120050,
          categoryId: 1,
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: null,
          dayOfMonth: 10,
          nextRunAt: new Date('2026-09-09T17:00:00.000Z'),
        },
        include: { category: true },
      });
    });

    it('returns not found when the record is deleted before the update', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(
        recurringRecord(),
      );
      prisma.category.findFirst.mockResolvedValue(expenseCategory);
      prisma.recurringTransaction.update.mockRejectedValue(
        recordNotFoundError(),
      );

      await expect(service.update(1, 10, createDto())).rejects.toThrow(
        'Recurring transaction #1 not found',
      );
    });

    it('rethrows unexpected update errors', async () => {
      const databaseError = new Error('Database unavailable');
      prisma.recurringTransaction.findFirst.mockResolvedValue(
        recurringRecord(),
      );
      prisma.category.findFirst.mockResolvedValue(expenseCategory);
      prisma.recurringTransaction.update.mockRejectedValue(databaseError);

      await expect(service.update(1, 10, createDto())).rejects.toBe(
        databaseError,
      );
    });
  });

  describe('remove', () => {
    it('deletes an owned recurring transaction and returns its amount in baht', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(
        recurringRecord(),
      );
      prisma.recurringTransaction.delete.mockResolvedValue(recurringRecord());

      const result = await service.remove(1, 10);

      expect(prisma.recurringTransaction.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result.amount).toBe(1200.5);
    });

    it('does not delete a recurring transaction that is missing or not owned', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(null);

      await expect(service.remove(1, 10)).rejects.toThrow(
        'Recurring transaction #1 not found',
      );

      expect(prisma.recurringTransaction.delete).not.toHaveBeenCalled();
    });

    it('returns not found when the record is deleted before removal', async () => {
      prisma.recurringTransaction.findFirst.mockResolvedValue(
        recurringRecord(),
      );
      prisma.recurringTransaction.delete.mockRejectedValue(
        recordNotFoundError(),
      );

      await expect(service.remove(1, 10)).rejects.toThrow(
        'Recurring transaction #1 not found',
      );
    });

    it('rethrows unexpected delete errors', async () => {
      const databaseError = new Error('Database unavailable');
      prisma.recurringTransaction.findFirst.mockResolvedValue(
        recurringRecord(),
      );
      prisma.recurringTransaction.delete.mockRejectedValue(databaseError);

      await expect(service.remove(1, 10)).rejects.toBe(databaseError);
    });
  });
});
