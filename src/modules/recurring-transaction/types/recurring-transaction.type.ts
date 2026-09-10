import type { Category, RecurringTransaction } from 'generated/prisma/client';

export type RecurringTransactionWithCategory = RecurringTransaction & {
  category: Category;
};

export interface RecurringTransactionListResponse {
  data: RecurringTransactionWithCategory[];
  meta: {
    total: number;
    expectedTotal: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
