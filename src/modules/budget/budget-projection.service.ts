import { Injectable } from '@nestjs/common';
import { Prisma, Transaction, TransactionType } from 'generated/prisma/client';
import { getPeriodForDate, getPeriodRange } from 'src/utils/period';
import { PrismaService } from '../prisma/prisma.service';

type BudgetTransaction = Pick<
  Transaction,
  'amount' | 'categoryId' | 'date' | 'type' | 'userId'
>;

type ExpenseContribution = {
  userId: number;
  categoryId: number | null;
  period: string;
  amount: number;
};

@Injectable()
export class BudgetProjectionService {
  constructor(private readonly prisma: PrismaService) {}

  private contribution(
    transaction: BudgetTransaction | null,
  ): ExpenseContribution | null {
    if (!transaction || transaction.type !== TransactionType.EXPEND) {
      return null;
    }

    return {
      userId: transaction.userId,
      categoryId: transaction.categoryId,
      period: getPeriodForDate(transaction.date),
      amount: transaction.amount,
    };
  }

  private async changeSpentAmount(
    tx: Prisma.TransactionClient,
    expense: ExpenseContribution,
    amountChange: number,
  ) {
    if (amountChange === 0) return;

    const conflictTarget =
      expense.categoryId === null
        ? Prisma.sql`("userId", "period") WHERE "categoryId" IS NULL`
        : Prisma.sql`("userId", "categoryId", "period") WHERE "categoryId" IS NOT NULL`;

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "Budget" ("userId", "categoryId", "period", "plannedAmount", "spentAmount", "updatedAt")
      VALUES (${expense.userId}, ${expense.categoryId}, ${expense.period}, NULL, ${amountChange}, CURRENT_TIMESTAMP)
      ON CONFLICT ${conflictTarget}
      DO UPDATE SET
        "spentAmount" = "Budget"."spentAmount" + EXCLUDED."spentAmount",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
  }

  async applyTransactionChange(
    tx: Prisma.TransactionClient,
    previous: BudgetTransaction | null,
    next: BudgetTransaction | null,
  ) {
    const before = this.contribution(previous);
    const after = this.contribution(next);

    if (
      before &&
      after &&
      before.userId === after.userId &&
      before.categoryId === after.categoryId &&
      before.period === after.period
    ) {
      await this.changeSpentAmount(tx, after, after.amount - before.amount);
      return;
    }

    if (before) await this.changeSpentAmount(tx, before, -before.amount);
    if (after) await this.changeSpentAmount(tx, after, after.amount);
  }

  async reconcile(userId: number, period: string, categoryId?: number | null) {
    const { start, end } = getPeriodRange(period);
    const scopedCategory = categoryId !== undefined;

    return this.prisma.$transaction(async (tx) => {
      const where = {
        userId,
        type: TransactionType.EXPEND,
        date: { gte: start, lt: end },
        ...(scopedCategory && { categoryId }),
      };
      const [spending, budgets] = await Promise.all([
        tx.transaction.groupBy({
          by: ['categoryId'],
          where,
          _sum: { amount: true },
        }),
        tx.budget.findMany({
          where: {
            userId,
            period,
            ...(scopedCategory && { categoryId }),
          },
        }),
      ]);
      const spendingByCategoryId = new Map(
        spending.map((entry) => [entry.categoryId, entry._sum.amount ?? 0]),
      );
      const budgetsByCategoryId = new Map(
        budgets.map((budget) => [budget.categoryId, budget]),
      );

      for (const budget of budgets) {
        await tx.budget.update({
          where: { id: budget.id },
          data: {
            spentAmount: spendingByCategoryId.get(budget.categoryId) ?? 0,
          },
        });
      }

      for (const [currentCategoryId, spentAmount] of spendingByCategoryId) {
        if (budgetsByCategoryId.has(currentCategoryId)) continue;

        await tx.budget.create({
          data: {
            userId,
            categoryId: currentCategoryId,
            period,
            plannedAmount: null,
            spentAmount,
          },
        });
      }

      return { userId, period, categoryId, reconciled: true };
    });
  }
}
