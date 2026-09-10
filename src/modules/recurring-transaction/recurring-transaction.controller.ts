import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/modules/auth/decorator/user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RecurringTransactionService } from './recurring-transaction.service';
import {
  CreateRecurringTransactionDto,
  RecurringTransactionParams,
  UpdateRecurringTransactionDto,
} from './dto/create-recurring-transaction.dto';

@ApiTags('Recurring Transaction')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recurring-transaction')
export class RecurringTransactionController {
  constructor(
    private readonly recurringTransactionService: RecurringTransactionService,
  ) {}

  @Post()
  create(
    @Body() createRecurringTransactionDto: CreateRecurringTransactionDto,
    @CurrentUser('userId') userId: number,
  ) {
    return this.recurringTransactionService.create(
      createRecurringTransactionDto,
      userId,
    );
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: number,
    @Query() query: RecurringTransactionParams,
  ) {
    return this.recurringTransactionService.findAll(userId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('userId') userId: number) {
    return this.recurringTransactionService.findOne(+id, userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateRecurringTransactionDto: UpdateRecurringTransactionDto,
    @CurrentUser('userId') userId: number,
  ) {
    return this.recurringTransactionService.update(
      +id,
      userId,
      updateRecurringTransactionDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('userId') userId: number) {
    return this.recurringTransactionService.remove(+id, userId);
  }
}
