import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  BahtToSatang,
  MAX_MINOR_AMOUNT,
} from 'src/decorator/money-transform.decorator';

function transformNullableInteger(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return value;
  return Number(value);
}

export class CreateBudgetDto {
  @ApiProperty({
    description: 'Budget month in YYYY-MM format',
    example: '2026-09',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'period must use YYYY-MM format',
  })
  period: string;

  @ApiPropertyOptional({
    description: 'Expense category ID, or null for Uncategorized',
    example: 1,
    nullable: true,
  })
  @Transform(({ value }) => transformNullableInteger(value))
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  categoryId: number | null;

  @ApiProperty({
    description: 'Planned amount in Thai baht; stored as integer satang',
    example: 5000.25,
    minimum: 0,
    maximum: MAX_MINOR_AMOUNT / 100,
  })
  @BahtToSatang()
  @IsInt({
    message: 'plannedAmount must be a number with at most 2 decimal places',
  })
  @Min(0)
  @Max(MAX_MINOR_AMOUNT)
  @IsNotEmpty()
  plannedAmount: number;
}

export class BudgetPeriodParams {
  @ApiProperty({
    description: 'Budget month in YYYY-MM format',
    example: '2026-09',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'period must use YYYY-MM format',
  })
  period: string;
}
