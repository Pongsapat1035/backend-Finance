import { Module } from '@nestjs/common';
import { RecurringTransactionService } from './recurring-transaction.service';
import { RecurringTransactionController } from './recurring-transaction.controller';
import { CategoryModule } from '../category/category.module';

@Module({
  imports: [CategoryModule],
  controllers: [RecurringTransactionController],
  providers: [RecurringTransactionService],
})
export class RecurringTransactionModule {}
