import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorator/user.decorator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { BudgetService } from './budget.service';
import { BudgetPeriodParams, CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@ApiTags('Budget')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  create(
    @Body() createBudgetDto: CreateBudgetDto,
    @CurrentUser('userId') userId: number,
  ) {
    return this.budgetService.create(createBudgetDto, userId);
  }

  @Get()
  findAll(
    @Query() query: BudgetPeriodParams,
    @CurrentUser('userId') userId: number,
  ) {
    return this.budgetService.findAll(query, userId);
  }

  @Get('exceeded')
  findExceeded(
    @Query() query: BudgetPeriodParams,
    @CurrentUser('userId') userId: number,
  ) {
    return this.budgetService.findExceeded(query, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('userId') userId: number) {
    return this.budgetService.findOne(+id, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateBudgetDto: UpdateBudgetDto,
    @CurrentUser('userId') userId: number,
  ) {
    return this.budgetService.update(+id, updateBudgetDto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('userId') userId: number) {
    return this.budgetService.remove(+id, userId);
  }
}
