import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SummaryPeriodResponseDto {
  @ApiPropertyOptional({
    description: 'Present for a monthly summary',
    example: '2026-07',
  })
  month?: string;

  @ApiPropertyOptional({
    description: 'Present for a yearly summary',
    example: 2026,
  })
  year?: number;
}

export class TransactionSummaryResponseDto extends SummaryPeriodResponseDto {
  @ApiProperty({ description: 'Total income in THB' })
  income: number;

  @ApiProperty({ description: 'Total expenses in THB' })
  expenses: number;

  @ApiProperty({ description: 'Total investment transactions in THB' })
  investment: number;

  @ApiProperty({
    description:
      'Net cash flow in THB: income minus expenses, excluding investment',
  })
  net: number;

  @ApiProperty()
  incomeTransactionCount: number;

  @ApiProperty()
  expenseTransactionCount: number;

  @ApiProperty()
  investmentTransactionCount: number;

  @ApiProperty({
    description: 'Total count across all three transaction types',
  })
  transactionCount: number;
}

class ExpenseCategorySummaryDto {
  @ApiProperty({ type: Number, nullable: true })
  categoryId: number | null;

  @ApiProperty()
  title: string;

  @ApiProperty({ description: 'Expense amount in THB' })
  amount: number;

  @ApiProperty({
    description: 'Share of total expenses, rounded to one decimal',
  })
  percentage: number;
}

export class ExpensesByCategoryResponseDto extends SummaryPeriodResponseDto {
  @ApiProperty({ description: 'Total expenses in THB' })
  totalExpenses: number;

  @ApiProperty({ type: [ExpenseCategorySummaryDto] })
  data: ExpenseCategorySummaryDto[];
}
