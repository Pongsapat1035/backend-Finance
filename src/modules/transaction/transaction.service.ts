import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/transaction.dto';
import dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createTransactionDto: CreateTransactionDto, userId: number) {
    const { categoryId, date, type, ...rest } = createTransactionDto;

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category #${categoryId} not found`);
    }

    if (category.type !== type) {
      throw new BadRequestException(`Category type (${category.type}) does not match transaction type (${type})`);
    }

    return await this.prisma.transaction.create({
      data: {
        ...rest,
        type,
        date: dayjs(date).toDate(),
        categories: {
          connect: { id: categoryId },
        },
        userId
      },
      include: { categories: true },
    });
  }

  findAll(userId: number) {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: { categories: true },
    });
  }

  async findOne(id: number, userId: number) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { categories: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }
    return transaction;
  }

  async update(id: number, userId: number, updateTransactionDto: UpdateTransactionDto) {
    await this.findOne(id, userId);

    const { categoryId, date, ...rest } = updateTransactionDto;
    try {
      return await this.prisma.transaction.update({
        where: { id },
        data: {
          ...rest,
          ...(date && { date: dayjs(date).toDate() }),
          ...(categoryId && {
            categories: {
              set: [{ id: categoryId }], // Replaces existing categories with the new one
            },
          }),
        },
        include: { categories: true },
      });
    } catch (error) {
      if (error.code === 'P2025') {
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
      if (error.code === 'P2025') {
        throw new NotFoundException(`Transaction #${id} not found`);
      }
      throw error;
    }
  }
}
