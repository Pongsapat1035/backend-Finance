import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { TransactionType } from 'generated/prisma/enums';

export class CategoryDto {
  @ApiProperty({ description: 'The title of the category', example: 'Salary' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    enum: TransactionType,
    description: 'Type of the transaction',
    example: 'INCOME',
  })
  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;
}
