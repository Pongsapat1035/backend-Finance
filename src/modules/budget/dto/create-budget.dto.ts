import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

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
    description: 'Planned amount in Thai satang',
    example: 500000,
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
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
