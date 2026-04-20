import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoryDto } from './dto/caregory-dto';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { PaginationDto } from 'src/utils/query.dto';

@Injectable()
export class CategoryService {
  constructor(
    private prisma: PrismaService,
  ) { }

  async create(body: CategoryDto, userId: number) {
    const { title, type } = body

    const existingCate = await this.prisma.category.findFirst({
      where: { title, type, userId }
    })
    if (existingCate) throw new BadRequestException('Category already exists');

    const result = await this.prisma.category.create({
      data: {
        title,
        type,
        userId
      }
    })
    return result;
  }

  async findAll(dto: PaginationDto, userId: number) {
    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    const [lists, total] = await Promise.all([
      this.prisma.category.findMany({
        where: { userId },
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where: { userId } })
    ]);

    return {
      data: lists,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} category`;
  }

  async update(id: number, userId: number, dto: CategoryDto) {
    const res = await this.prisma.category.updateMany({
      where: { id, userId },
      data: dto
    });

    if (res.count === 0) {
      throw new NotFoundException("Category not found or access denied");
    }

    return { message: "Category updated successfully" };
  }

  async remove(id: number, userId: number) {
    const res = await this.prisma.category.deleteMany({
      where: { id, userId }
    });

    if (res.count === 0) {
      throw new NotFoundException("Category not found or access denied");
    }

    return { message: "Category deleted successfully" };
  }
}
