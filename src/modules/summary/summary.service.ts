import { Injectable } from '@nestjs/common';
import { TransactionType } from 'generated/prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { satangToBaht } from 'src/utils/currency';
import { getPeriodForDate, getPeriodRange } from 'src/utils/period';
import dayjs, { PRODUCT_TIME_ZONE } from 'src/config/dayjs.config';
import { NetCashFlowResponseDto } from './dto/net-cash-flow-response.dto';
import {
  ExpensesByCategoryResponseDto,
  TransactionSummaryResponseDto,
} from './dto/summary-response.dto';
import {
  NetCashFlowQueryDto,
  type NetCashFlowType,
} from './dto/net-cash-flow-query.dto';
import {
  SpendingByCategoryQueryDto,
  SummaryQueryDto,
} from './dto/summary-query.dto';

const NET_CASH_FLOW_PERIODS = {
  monthly: { unit: 'month', bucket: 'day', bucketFormat: 'YYYY-MM-DD' },
  yearly: { unit: 'year', bucket: 'month', bucketFormat: 'YYYY-MM' },
} as const satisfies Record<NetCashFlowType, object>;

type CashFlowSums = { income: number; expenses: number };

function getSummaryPeriod(query: SpendingByCategoryQueryDto) {
  if (query.year !== undefined) {
    const start = dayjs.tz(`${query.year}-01-01`);
    return {
      period: { year: query.year },
      start: start.toDate(),
      end: start.add(1, 'year').toDate(),
    };
  }

  const month = query.month ?? getPeriodForDate(new Date());
  return { period: { month }, ...getPeriodRange(month) };
}

function sumByPeriod(
  transactions: {
    date: Date;
    type: TransactionType;
    _sum: { amount: number | null };
  }[],
  bucketFormat: string,
) {
  const amountsByPeriod = new Map<string, CashFlowSums>();
  const totals: CashFlowSums = { income: 0, expenses: 0 };

  for (const transaction of transactions) {
    const key = dayjs(transaction.date).tz().format(bucketFormat);
    const amounts = amountsByPeriod.get(key) ?? { income: 0, expenses: 0 };
    const field =
      transaction.type === TransactionType.INCOME ? 'income' : 'expenses';
    const amount = transaction._sum.amount ?? 0;
    amounts[field] += amount;
    totals[field] += amount;
    amountsByPeriod.set(key, amounts);
  }

  return { amountsByPeriod, totals };
}

@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getNetCashFlow(
    userId: number,
    query: NetCashFlowQueryDto,
  ): Promise<NetCashFlowResponseDto> {
    const { type } = query;
    const period = type === 'yearly' ? String(query.year!) : query.month!;
    const { unit, bucket, bucketFormat } = NET_CASH_FLOW_PERIODS[type];
    const start = dayjs.tz(period);
    const end = start.add(1, unit);

    const transactions = await this.prisma.transaction.groupBy({
      by: ['date', 'type'],
      where: {
        userId,
        type: { in: [TransactionType.INCOME, TransactionType.EXPEND] },
        date: { gte: start.toDate(), lt: end.toDate() },
      },
      _sum: { amount: true },
    });
    const { amountsByPeriod, totals } = sumByPeriod(transactions, bucketFormat);

    const toAmounts = (amounts: CashFlowSums) => ({
      income: satangToBaht(amounts.income),
      expenses: satangToBaht(amounts.expenses),
      netCashFlow: satangToBaht(amounts.income - amounts.expenses),
    });

    return {
      type,
      period,
      timezone: PRODUCT_TIME_ZONE,
      totals: toAmounts(totals),
      data: Array.from({ length: end.diff(start, bucket) }, (_, index) => {
        const key = start.add(index, bucket).format(bucketFormat);
        return {
          period: key,
          ...toAmounts(amountsByPeriod.get(key) ?? { income: 0, expenses: 0 }),
        };
      }),
    };
  }

  async getSummary(
    userId: number,
    query: SummaryQueryDto,
  ): Promise<TransactionSummaryResponseDto> {
    const { period, start, end } = getSummaryPeriod(query);
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
      ...period,
      income: satangToBaht(summary.INCOME.amount),
      expenses: satangToBaht(summary.EXPEND.amount),
      investment: satangToBaht(summary.INVESTMENT.amount),
      net: satangToBaht(summary.INCOME.amount - summary.EXPEND.amount),
      incomeTransactionCount: summary.INCOME.count,
      expenseTransactionCount: summary.EXPEND.count,
      investmentTransactionCount: summary.INVESTMENT.count,
      transactionCount:
        summary.INCOME.count + summary.EXPEND.count + summary.INVESTMENT.count,
    };
  }

  async getExpensesByCategory(
    userId: number,
    query: SpendingByCategoryQueryDto,
  ): Promise<ExpensesByCategoryResponseDto> {
    const { period, start, end } = getSummaryPeriod(query);
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
      ...period,
      totalExpenses: satangToBaht(totalAmount),
      data: rows.map((row) => ({
        ...row,
        amount: satangToBaht(row.amount),
      })),
    };
  }
}
