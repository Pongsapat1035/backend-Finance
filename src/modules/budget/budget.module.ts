import { Module } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetController } from './budget.controller';
import { BudgetProjectionService } from './budget-projection.service';
import { CategoryModule } from '../category/category.module';

@Module({
  imports: [CategoryModule],
  controllers: [BudgetController],
  providers: [BudgetService, BudgetProjectionService],
  exports: [BudgetProjectionService],
})
export class BudgetModule {}
