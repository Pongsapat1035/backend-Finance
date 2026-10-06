import { Injectable } from '@nestjs/common';
import { TransactionType } from 'generated/prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { satangToBaht } from 'src/utils/currency';
import { getPeriodForDate, getPeriodRange } from 'src/utils/period';
import {
  SpendingByCategoryQueryDto,
  SummaryQueryDto,
} from './dto/summary-query.dto';

@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: number, query: SummaryQueryDto) {
    const { month } = query;
    const { start, end } = getPeriodRange(month);
    const where = {
      userId,
      type: {
        in: [
          TransactionType.INCOME,
          TransactionType.EXPEND,
          TransactionType.INVESTMENT,
        ],
      },
      date: { gte: start, lt: end },
    };
    const totals = await this.prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
    const summary: Record<TransactionType, { amount: number; count: number }> =
      {
        [TransactionType.INCOME]: { amount: 0, count: 0 },
        [TransactionType.EXPEND]: { amount: 0, count: 0 },
        [TransactionType.INVESTMENT]: { amount: 0, count: 0 },
      };
    for (const row of totals) {
      summary[row.type] = {
        amount: row._sum.amount ?? 0,
        count: row._count._all,
      };
    }

    return {
      month,
      income: satangToBaht(summary.INCOME.amount),
      expenses: satangToBaht(summary.EXPEND.amount),
      investment: satangToBaht(summary.INVESTMENT.amount),
      net: satangToBaht(summary.INCOME.amount - summary.EXPEND.amount),
      incomeTransactionCount: summary.INCOME.count,
      expenseTransactionCount: summary.EXPEND.count,
      investmentTransactionCount: summary.INVESTMENT.count,
    };
  }

  async getExpensesByCategory(
    userId: number,
    query: SpendingByCategoryQueryDto,
  ) {
    const month = query.month ?? getPeriodForDate(new Date());
    const { start, end } = getPeriodRange(month);
    const [categories, groupedExpenses] = await Promise.all([
      this.prisma.category.findMany({
        where: { userId, type: TransactionType.EXPEND },
        select: { id: true, title: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          type: TransactionType.EXPEND,
          date: { gte: start, lt: end },
        },
        _sum: { amount: true },
      }),
    ]);

    const amountByCategory = new Map<number | null, number>();
    let totalAmount = 0;

    for (const group of groupedExpenses) {
      const amount = group._sum.amount ?? 0;
      amountByCategory.set(group.categoryId, amount);
      totalAmount += amount;
    }

    const createRow = (
      categoryId: number | null,
      title: string,
      amount: number,
    ) => ({
      categoryId,
      title,
      amount,
      percentage:
        totalAmount === 0 ? 0 : Math.round((amount / totalAmount) * 1000) / 10,
    });
    const rows = categories.map((category) =>
      createRow(
        category.id,
        category.title,
        amountByCategory.get(category.id) ?? 0,
      ),
    );

    const uncategorizedAmount = amountByCategory.get(null);
    if (uncategorizedAmount !== undefined) {
      rows.push(createRow(null, 'Uncategorized', uncategorizedAmount));
    }

    rows.sort((a, b) => b.amount - a.amount || a.title.localeCompare(b.title));

    return {
      month,
      totalExpenses: satangToBaht(totalAmount),
      data: rows.map((row) => ({
        ...row,
        amount: satangToBaht(row.amount),
      })),
    };
  }
}
