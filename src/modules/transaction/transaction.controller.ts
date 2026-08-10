import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/transaction.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorator/user.decorator';
import { PaginationDto, TransactionParams } from 'src/utils/query.dto';

@Controller('transaction')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) { }

  @Post()
  create(@Body() createTransactionDto: CreateTransactionDto, @CurrentUser('userId') userId: number) {
    return this.transactionService.create(createTransactionDto, userId);
  }

  @Get()
  findAll(@CurrentUser('userId') userId: number, @Query() query: TransactionParams,) {
    return this.transactionService.findAll(userId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('userId') userId: number) {
    return this.transactionService.findOne(+id, userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @CurrentUser('userId') userId: number,
  ) {
    return this.transactionService.update(+id, userId, updateTransactionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('userId') userId: number) {
    return this.transactionService.remove(+id, userId);
  }
}
