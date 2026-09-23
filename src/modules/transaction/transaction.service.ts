import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { Prisma, TransactionType } from 'generated/prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionParams } from 'src/utils/query.dto';
import { bahtToSatang, satangToBaht } from 'src/utils/currency.util';
import { BudgetProjectionService } from '../budget/budget-projection.service';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetProjection: BudgetProjectionService,
  ) {}

  async validateCategoryByType(
    categoryId: number | null,
    type: TransactionType,
    userId: number,
  ) {
    if (categoryId === null) {
      if (type !== TransactionType.EXPEND) {
        throw new BadRequestException(
          'Uncategorized transactions must use the EXPEND type',
        );
      }
      return;
    }

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId, userId },
    });

    if (!category) {
      throw new NotFoundException(`Category #${categoryId} not found`);
    }

    if (category.type !== type) {
      throw new BadRequestException(
        `Category type (${category.type}) does not match transaction type (${type})`,
      );
    }
  }

  async create(createTransactionDto: CreateTransactionDto, userId: number) {
    const { amount, categoryId, date, type, ...rest } = createTransactionDto;
    await this.validateCategoryByType(categoryId, type, userId);

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          ...rest,
          amount: bahtToSatang(amount),
          type,
          date: dayjs(date).toDate(),
          categoryId,
          userId,
        },
        include: { category: true },
      });

      await this.budgetProjection.applyTransactionChange(tx, null, created);
      return created;
    });

    return {
      ...transaction,
      amount: satangToBaht(transaction.amount),
    };
  }

  async findAll(userId: number, query: TransactionParams) {
    const {
      page = 1,
      limit = 10,
      keyword,
      search,
      categoryId,
      type,
      month,
      sortBy = 'date',
      order = 'desc',
    } = query;
    const skip = (page - 1) * limit;
    const descriptionSearch = search ?? keyword;
    const where = {
      userId,
      ...(categoryId && { categoryId }),
      ...(type && { type }),
      ...(descriptionSearch && {
        description: {
          contains: descriptionSearch,
          mode: 'insensitive' as const,
        },
      }),
      ...(month && {
        date: {
          gte: dayjs(month, 'YYYY-MM').startOf('month').toDate(),
          lte: dayjs(month, 'YYYY-MM').endOf('month').toDate(),
        },
      }),
    };
    const [lists, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: [{ [sortBy]: order }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: lists.map((transaction) => ({
        ...transaction,
        amount: satangToBaht(transaction.amount),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, userId: number) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }
    return {
      ...transaction,
      amount: satangToBaht(transaction.amount),
    };
  }

  private async findRawTransaction(id: number, userId: number) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }

    return transaction;
  }

  async update(
    id: number,
    userId: number,
    updateTransactionDto: UpdateTransactionDto,
  ) {
    const existing = await this.findRawTransaction(id, userId);

    const { amount, categoryId, date, type, ...rest } = updateTransactionDto;
    await this.validateCategoryByType(categoryId, type, userId);

    try {
      const transaction = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.transaction.update({
          where: { id },
          data: {
            ...rest,
            amount: bahtToSatang(amount),
            type,
            date: dayjs(date).toDate(),
            categoryId,
          },
          include: { category: true },
        });

        await this.budgetProjection.applyTransactionChange(
          tx,
          existing,
          updated,
        );
        return updated;
      });

      return {
        ...transaction,
        amount: satangToBaht(transaction.amount),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Transaction #${id} or Category not found`);
      }
      throw error;
    }
  }

  async remove(id: number, userId: number) {
    const existing = await this.findRawTransaction(id, userId);

    try {
      const transaction = await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.transaction.delete({
          where: { id },
        });
        await this.budgetProjection.applyTransactionChange(tx, existing, null);
        return deleted;
      });

      return {
        ...transaction,
        amount: satangToBaht(transaction.amount),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Transaction #${id} not found`);
      }
      throw error;
    }
  }
}
