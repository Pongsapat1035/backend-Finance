import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionType } from 'generated/prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { bahtToSatang, satangToBaht } from 'src/utils/currency.util';
import {
  CreateRecurringTransactionDto,
  RecurringTransactionParams,
  UpdateRecurringTransactionDto,
} from './dto/create-recurring-transaction.dto';
import {
  RecurringTransactionListResponse,
  RecurringTransactionWithCategory,
} from './types/recurring-transaction.type';
import {
  getMonthlyOccurrence,
  PRODUCT_TIME_ZONE,
} from '../budget/budget-period.util';
import { CategoryService } from '../category/category.service';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class RecurringTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: CategoryService,
  ) {}

  private validateDateRange(startDate: Date, endDate?: Date | null) {
    if (
      endDate &&
      dayjs(endDate)
        .tz(PRODUCT_TIME_ZONE)
        .isBefore(dayjs(startDate).tz(PRODUCT_TIME_ZONE), 'day')
    ) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
  }

  private calculateNextRunAt(startDate: Date, dayOfMonth: number) {
    const scheduledStartDate = dayjs(startDate).tz(PRODUCT_TIME_ZONE);
    let nextRunAt = getMonthlyOccurrence(
      scheduledStartDate.format('YYYY-MM'),
      dayOfMonth,
    );

    if (
      dayjs(nextRunAt)
        .tz(PRODUCT_TIME_ZONE)
        .isBefore(scheduledStartDate, 'day')
    ) {
      nextRunAt = getMonthlyOccurrence(
        scheduledStartDate.add(1, 'month').format('YYYY-MM'),
        dayOfMonth,
      );
    }

    return nextRunAt;
  }

  async create(
    createRecurringTransactionDto: CreateRecurringTransactionDto,
    userId: number,
  ): Promise<RecurringTransactionWithCategory> {
    const {
      amount,
      categoryId,
      startDate,
      endDate,
      dayOfMonth,
      isActive,
      ...data
    } = createRecurringTransactionDto;
    const parsedStartDate = dayjs(startDate).toDate();
    const parsedEndDate = endDate ? dayjs(endDate).toDate() : null;

    this.validateDateRange(parsedStartDate, parsedEndDate);
    await this.categoryService.validateExpenseCategory(categoryId, userId);

    const recurringTransaction = await this.prisma.recurringTransaction.create({
      data: {
        ...data,
        amount: bahtToSatang(amount),
        categoryId,
        userId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        dayOfMonth,
        nextRunAt: this.calculateNextRunAt(parsedStartDate, dayOfMonth),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true },
    });

    return {
      ...recurringTransaction,
      amount: satangToBaht(recurringTransaction.amount),
    };
  }

  async findAll(
    userId: number,
    query: RecurringTransactionParams,
  ): Promise<RecurringTransactionListResponse> {
    const { page = 1, limit = 10, keyword, categoryId, isActive } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.RecurringTransactionWhereInput = {
      userId,
      ...(categoryId && { categoryId }),
      ...(isActive !== undefined && { isActive }),
      ...(keyword && {
        title: { contains: keyword, mode: 'insensitive' },
      }),
    };

    const [lists, total, aggregate] = await Promise.all([
      this.prisma.recurringTransaction.findMany({
        where,
        include: { category: true },
        orderBy: { nextRunAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.recurringTransaction.count({ where }),
      this.prisma.recurringTransaction.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      data: lists.map((recurringTransaction) => ({
        ...recurringTransaction,
        amount: satangToBaht(recurringTransaction.amount),
      })),
      meta: {
        total,
        expectedTotal: satangToBaht(aggregate._sum.amount ?? 0),
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async upcoming(userId: number) {
    const currentDate = dayjs().tz(PRODUCT_TIME_ZONE);
    const rangeStart = currentDate.startOf('day');
    const rangeEnd = currentDate.add(30, 'day').endOf('day');
    const where: Prisma.RecurringTransactionWhereInput = {
      userId,
      isActive: true,
      nextRunAt: {
        gte: rangeStart.toDate(),
        lte: rangeEnd.toDate(),
      },
      OR: [
        { endDate: null },
        { endDate: { gte: this.prisma.recurringTransaction.fields.nextRunAt } },
      ],
    };
    const candidates = await this.prisma.recurringTransaction.findMany({
      where,
      include: { category: true },
      orderBy: [{ nextRunAt: 'asc' }, { id: 'asc' }],
    });
    const expectedTotal = candidates.reduce(
      (total, recurringTransaction) => total + recurringTransaction.amount,
      0,
    );

    return {
      data: candidates.map((recurringTransaction) => ({
        id: recurringTransaction.id,
        description:
          recurringTransaction.description ?? recurringTransaction.title,
        category: recurringTransaction.category,
        type: TransactionType.EXPEND,
        amount: satangToBaht(recurringTransaction.amount),
        dueDate: recurringTransaction.nextRunAt,
      })),
      meta: {
        from: rangeStart.format('YYYY-MM-DD'),
        to: rangeEnd.format('YYYY-MM-DD'),
        timezone: PRODUCT_TIME_ZONE,
        total: candidates.length,
        expectedTotal: satangToBaht(expectedTotal),
      },
    };
  }

  async findOne(
    id: number,
    userId: number,
  ): Promise<RecurringTransactionWithCategory> {
    const recurringTransaction =
      await this.prisma.recurringTransaction.findFirst({
        where: { id, userId },
        include: { category: true },
      });

    if (!recurringTransaction) {
      throw new NotFoundException(`Recurring transaction #${id} not found`);
    }

    return {
      ...recurringTransaction,
      amount: satangToBaht(recurringTransaction.amount),
    };
  }

  async update(
    id: number,
    userId: number,
    updateRecurringTransactionDto: UpdateRecurringTransactionDto,
  ): Promise<RecurringTransactionWithCategory> {
    const existing = await this.findOne(id, userId);
    const {
      amount,
      categoryId,
      startDate,
      endDate,
      dayOfMonth,
      isActive,
      ...data
    } = updateRecurringTransactionDto;
    const parsedStartDate = dayjs(startDate).toDate();
    const parsedEndDate = endDate ? dayjs(endDate).toDate() : null;

    this.validateDateRange(parsedStartDate, parsedEndDate);
    await this.categoryService.validateExpenseCategory(categoryId, userId);

    const scheduleChanged =
      existing.dayOfMonth !== dayOfMonth ||
      !dayjs(existing.startDate).isSame(parsedStartDate, 'day');

    try {
      const recurringTransaction =
        await this.prisma.recurringTransaction.update({
          where: { id },
          data: {
            ...data,
            amount: bahtToSatang(amount),
            categoryId,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            dayOfMonth,
            ...(isActive !== undefined && { isActive }),
            ...(scheduleChanged && {
              nextRunAt: this.calculateNextRunAt(parsedStartDate, dayOfMonth),
            }),
          },
          include: { category: true },
        });

      return {
        ...recurringTransaction,
        amount: satangToBaht(recurringTransaction.amount),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Recurring transaction #${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId);

    try {
      const recurringTransaction =
        await this.prisma.recurringTransaction.delete({
          where: { id },
        });

      return {
        ...recurringTransaction,
        amount: satangToBaht(recurringTransaction.amount),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Recurring transaction #${id} not found`);
      }
      throw error;
    }
  }
}
