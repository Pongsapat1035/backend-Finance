import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/transaction.dto';
import dayjs from 'dayjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createTransactionDto: CreateTransactionDto) {
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
      },
      include: { categories: true },
    });
  }

  findAll() {
    return this.prisma.transaction.findMany({
      include: { categories: true },
    });
  }

  async findOne(id: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { categories: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }
    return transaction;
  }

  async update(id: number, updateTransactionDto: UpdateTransactionDto) {
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

  async remove(id: number) {
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
