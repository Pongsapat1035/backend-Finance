import { TransactionType } from "generated/prisma/enums";


export const getDefaultCategories = (userId: number) => {
  return [
    // Expend Categories
    { title: 'Food & Dining', type: TransactionType.EXPEND, color: '#FF5733', userId },
    { title: 'Transportation', type: TransactionType.EXPEND, color: '#33B5FF', userId },
    { title: 'Housing & Utilities', type: TransactionType.EXPEND, color: '#FF33B5', userId },
    // Income Categories
    { title: 'Salary', type: TransactionType.INCOME, color: '#33FF57', userId },
    { title: 'Freelance', type: TransactionType.INCOME, color: '#FFC300', userId },
    { title: 'Investments', type: TransactionType.INCOME, color: '#8A33FF', userId },
  ];
};
