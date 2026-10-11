import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { BudgetModule } from '../budget/budget.module';

@Module({
  imports: [BudgetModule],
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}
