import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionType } from 'generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetProjectionService } from './budget-projection.service';
import { CategoryService } from '../category/category.service';

type BudgetRow = {
  categoryId: number | null;
  category: { id: number; title: string; type: TransactionType } | null;
  label?: 'Uncategorized';
  hasBudget: boolean;
  planned: number;
  spent: number;
  remaining: number;
  isOverBudget: boolean;
  percentUsed: number;
};
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetProjection: BudgetProjectionService,
    private readonly categoryService: CategoryService,
  ) {}

  private toRow(
    category: { id: number; title: string; type: TransactionType } | null,
    budget?: { plannedAmount: number | null; spentAmount: number },
  ): BudgetRow {
    const planned = budget?.plannedAmount ?? 0;
    const spent = budget?.spentAmount ?? 0;

    return {
      categoryId: category?.id ?? null,
      category,
      ...(category === null && { label: 'Uncategorized' as const }),
      hasBudget: budget?.plannedAmount != null,
      planned,
      spent,
      remaining: planned - spent,
      isOverBudget: spent > planned,
      percentUsed: planned > 0 ? (spent / planned) * 100 : 0,
    };
  }

  async create(createBudgetDto: CreateBudgetDto, userId: number) {
    const { categoryId, period, plannedAmount } = createBudgetDto;
    await this.categoryService.validateExpenseCategory(categoryId, userId);

    const existing = await this.prisma.budget.findFirst({
      where: { userId, categoryId, period },
    });

    if (existing && existing.plannedAmount !== null) {
      throw new BadRequestException('A budget already exists for this period');
    }

    if (existing) {
      return this.prisma.budget.update({
        where: { id: existing.id },
        data: { plannedAmount },
      });
    }

    try {
      return await this.prisma.budget.create({
        data: { userId, categoryId, period, plannedAmount },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A budget already exists for this period',
        );
      }
      throw error;
    }
  }

  async findAll({ period }: { period: string }, userId: number) {
    const [categories, budgets] = await Promise.all([
      this.prisma.category.findMany({
        where: { userId, type: TransactionType.EXPEND },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.budget.findMany({ where: { userId, period } }),
    ]);
    const budgetsByCategoryId = new Map(
      budgets
        .filter((budget) => budget.categoryId !== null)
        .map((budget) => [budget.categoryId!, budget]),
    );
    const rows: BudgetRow[] = categories.map((category) =>
      this.toRow(category, budgetsByCategoryId.get(category.id)),
    );
    const uncategorizedBudget = budgets.find(
      (budget) => budget.categoryId === null,
    );

    if (uncategorizedBudget) {
      rows.push(this.toRow(null, uncategorizedBudget));
    }

    const summary = rows.reduce(
      (totals, row) => ({
        totalPlanned: totals.totalPlanned + row.planned,
        totalSpent: totals.totalSpent + row.spent,
        totalRemaining: totals.totalRemaining + row.remaining,
      }),
      { totalPlanned: 0, totalSpent: 0, totalRemaining: 0 },
    );

    return { period, data: rows, summary };
  }

  async findExceeded({ period }: { period: string }, userId: number) {
    const { data } = await this.findAll({ period }, userId);
    const exceeded = data
      .filter((row) => row.hasBudget && row.isOverBudget)
      .map((row) => ({ ...row, exceededBy: row.spent - row.planned }));

    return {
      period,
      data: exceeded,
      summary: {
        categoryCount: exceeded.length,
        totalExceeded: exceeded.reduce(
          (total, row) => total + row.exceededBy,
          0,
        ),
      },
    };
  }

  async findOne(id: number, userId: number) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      throw new NotFoundException(`Budget #${id} not found`);
    }

    return budget;
  }

  async update(id: number, updateBudgetDto: UpdateBudgetDto, userId: number) {
    const existing = await this.findOne(id, userId);
    const categoryId =
      updateBudgetDto.categoryId === undefined
        ? existing.categoryId
        : updateBudgetDto.categoryId;
    const period = updateBudgetDto.period ?? existing.period;

    if (categoryId === existing.categoryId && period === existing.period) {
      if (updateBudgetDto.plannedAmount === undefined) return existing;

      return this.prisma.budget.update({
        where: { id, userId },
        data: { plannedAmount: updateBudgetDto.plannedAmount },
      });
    }

    await this.categoryService.validateExpenseCategory(categoryId, userId);
    const plannedAmount =
      updateBudgetDto.plannedAmount ?? existing.plannedAmount;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const target = await tx.budget.findFirst({
          where: { userId, categoryId, period },
        });

        if (target && target.plannedAmount !== null) {
          throw new BadRequestException(
            'A budget already exists for this period',
          );
        }

        const updated = target
          ? await tx.budget.update({
              where: { id: target.id },
              data: { plannedAmount },
            })
          : await tx.budget.create({
              data: {
                userId,
                categoryId,
                period,
                plannedAmount,
                spentAmount: 0,
              },
            });

        if (existing.spentAmount !== 0) {
          await tx.budget.update({
            where: { id, userId },
            data: { plannedAmount: null },
          });
        } else {
          await tx.budget.delete({ where: { id, userId } });
        }

        return updated;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A budget already exists for this period',
        );
      }
      throw error;
    }
  }

  async remove(id: number, userId: number) {
    const budget = await this.findOne(id, userId);

    if (budget.spentAmount > 0) {
      return this.prisma.budget.update({
        where: { id },
        data: { plannedAmount: null },
      });
    }

    return this.prisma.budget.delete({ where: { id } });
  }

  async reconcile(userId: number, period: string, categoryId?: number | null) {
    if (categoryId !== undefined) {
      await this.categoryService.validateExpenseCategory(categoryId, userId);
    }

    return this.budgetProjection.reconcile(userId, period, categoryId);
  }
}
