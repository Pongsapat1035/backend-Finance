import { Module } from '@nestjs/common';
import { RecurringTransactionService } from './recurring-transaction.service';
import { RecurringTransactionController } from './recurring-transaction.controller';

@Module({
  controllers: [RecurringTransactionController],
  providers: [RecurringTransactionService],
})
export class RecurringTransactionModule {}
