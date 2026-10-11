import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/modules/auth/decorator/user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import {
  SpendingByCategoryQueryDto,
  SummaryQueryDto,
} from './dto/summary-query.dto';
import { SummaryService } from './summary.service';

@ApiTags('Summary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get('transaction')
  getSummary(
    @CurrentUser('userId') userId: number,
    @Query() query: SummaryQueryDto,
  ) {
    return this.summaryService.getSummary(userId, query);
  }

  @Get('expenses-by-category')
  getExpensesByCategory(
    @CurrentUser('userId') userId: number,
    @Query() query: SpendingByCategoryQueryDto,
  ) {
    return this.summaryService.getExpensesByCategory(userId, query);
  }
}
