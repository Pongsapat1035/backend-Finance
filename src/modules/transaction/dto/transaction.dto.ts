import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { TransactionType } from 'generated/prisma/enums';
import {
  BahtToSatang,
  MAX_MINOR_AMOUNT,
} from 'src/decorator/money-transform.decorator';

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
    maximum: MAX_MINOR_AMOUNT / 100,
  })
  @BahtToSatang()
  @IsInt({ message: 'amount must be a number with at most 2 decimal places' })
  @Min(1)
  @Max(MAX_MINOR_AMOUNT)
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
