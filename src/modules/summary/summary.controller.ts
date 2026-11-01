import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/modules/auth/decorator/user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import {
  SpendingByCategoryQueryDto,
  SummaryQueryDto,
} from './dto/summary-query.dto';
import { SummaryService } from './summary.service';
import { NetCashFlowQueryDto } from './dto/net-cash-flow-query.dto';
import { NetCashFlowResponseDto } from './dto/net-cash-flow-response.dto';
import {
  ExpensesByCategoryResponseDto,
  TransactionSummaryResponseDto,
} from './dto/summary-response.dto';

@ApiTags('Summary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get('transaction')
  @ApiOperation({
    summary: 'Get transaction totals and counts for a month or a year',
    description:
      'Provide month (YYYY-MM) or year (YYYY); year takes precedence if both are supplied. Periods use Asia/Bangkok time. Investment is reported separately. net = income - expenses, excluding investment.',
  })
  @ApiOkResponse({ type: TransactionSummaryResponseDto })
  getSummary(
    @CurrentUser('userId') userId: number,
    @Query() query: SummaryQueryDto,
  ) {
    return this.summaryService.getSummary(userId, query);
  }

  @Get('expenses-by-category')
  @ApiOperation({
    summary:
      'Get expense amounts and percentages by category for a month or a year',
    description:
      'Provide month (YYYY-MM) or year (YYYY); year takes precedence if both are supplied. Defaults to the current Bangkok month. Includes zero-spend categories and uncategorized expenses; sorted by amount descending. Percentages are rounded to one decimal.',
  })
  @ApiOkResponse({ type: ExpensesByCategoryResponseDto })
  getExpensesByCategory(
    @CurrentUser('userId') userId: number,
    @Query() query: SpendingByCategoryQueryDto,
  ) {
    return this.summaryService.getExpensesByCategory(userId, query);
  }

  @Get('net-cash-flow')
  @ApiOperation({
    summary: 'Get net cash flow for a month or a year',
    description:
      'monthly: one bucket per day (`period` YYYY-MM-DD). yearly: one bucket per month (`period` YYYY-MM). Buckets are ascending, zero-filled and not cumulative. netCashFlow = income - expenses; investment is excluded.',
  })
  @ApiOkResponse({ type: NetCashFlowResponseDto })
  getNetCashFlow(
    @CurrentUser('userId') userId: number,
    @Query() query: NetCashFlowQueryDto,
  ) {
    return this.summaryService.getNetCashFlow(userId, query);
  }
}
