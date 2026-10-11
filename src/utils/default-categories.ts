import { TransactionType } from 'generated/prisma/enums';

export const getDefaultCategories = (userId: number) => {
  return [
    // Expend Categories
    { title: 'Food & Dining', type: TransactionType.EXPEND, userId },
    { title: 'Transportation', type: TransactionType.EXPEND, userId },
    { title: 'Housing & Utilities', type: TransactionType.EXPEND, userId },
    // Income Categories
    { title: 'Salary', type: TransactionType.INCOME, userId },
    { title: 'Freelance', type: TransactionType.INCOME, userId },
    { title: 'Investments', type: TransactionType.INCOME, userId },
  ];
};
