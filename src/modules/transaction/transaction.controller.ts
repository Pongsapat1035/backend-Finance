import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/transaction.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorator/user.decorator';

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
  findAll(@CurrentUser('userId') userId: number) {
    return this.transactionService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('userId') userId: number) {
    return this.transactionService.findOne(+id, userId);
  }

  @Patch(':id')
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
