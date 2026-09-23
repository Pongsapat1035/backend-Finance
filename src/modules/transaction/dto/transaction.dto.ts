import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { TransactionType } from 'generated/prisma/enums';

function transformNullableInteger(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return value;
  return Number(value);
}

export class CreateTransactionDto {
  @ApiPropertyOptional({
    description:
      'The ID of the category this transaction belongs to, or null for an uncategorized expense',
    example: 1,
    nullable: true,
  })
  @Transform(({ value }) => transformNullableInteger(value))
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  categoryId: number | null;

  @ApiProperty({
    description: 'The date of the transaction in ISO format',
    example: '2026-04-18T10:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: 'The amount of the transaction in Thai baht',
    example: 1500.5,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    enum: TransactionType,
    description: 'Type of the transaction (e.g., INCOME or EXPEND)',
  })
  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;

  @ApiProperty({
    description: 'A short description of the transaction',
    example: 'Grocery shopping',
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class UpdateTransactionDto extends CreateTransactionDto {}
