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
import { PaginationDto, TransactionParams } from 'src/utils/query.dto';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async validateCategoryByType(categoryId: number, type: TransactionType) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
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
    const { categoryId, date, type, ...rest } = createTransactionDto;
    await this.validateCategoryByType(categoryId, type);

    return await this.prisma.transaction.create({
      data: {
        ...rest,
        type,
        date: dayjs(date).toDate(),
        categoryId,
        userId,
      },
      include: { category: true },
    });
  }

  async findAll(userId: number, query: TransactionParams) {
    const { page = 1, limit = 10, keyword, categoryId, type, month } = query;
    const skip = (page - 1) * limit;
    const where = {
      userId,
      ...(categoryId && { categoryId }),
      ...(type && { type }),
      ...(keyword && {
        description: { contains: keyword, mode: 'insensitive' as const },
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
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: lists,
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
    return transaction;
  }

  async update(
    id: number,
    userId: number,
    updateTransactionDto: UpdateTransactionDto,
  ) {
    await this.findOne(id, userId);

    const { categoryId, date, type, ...rest } = updateTransactionDto;
    await this.validateCategoryByType(categoryId, type);

    try {
      return await this.prisma.transaction.update({
        where: { id },
        data: {
          ...rest,
          type,
          date: dayjs(date).toDate(),
          categoryId,
        },
        include: { category: true },
      });
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
    await this.findOne(id, userId);

    try {
      return await this.prisma.transaction.delete({
        where: { id },
      });
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
