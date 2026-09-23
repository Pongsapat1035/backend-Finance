import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { KeywordWithPagination } from 'src/utils/query.dto';

function transformBoolean(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function transformNullableInteger(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return value;
  return Number(value);
}

export class CreateRecurringTransactionDto {
  @ApiPropertyOptional({
    description:
      'The expense category ID for this recurring item, or null for Uncategorized',
    example: 1,
    nullable: true,
  })
  @Transform(({ value }) => transformNullableInteger(value))
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  categoryId: number | null;

  @ApiProperty({
    description: 'A short title for the recurring expense',
    example: 'Monthly rent',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'An optional description for the recurring expense',
    example: 'Condominium rent',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Amount in Thai baht',
    example: 12000.5,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description:
      'Calendar day for the monthly expense. The last day of the month is used when this day does not exist.',
    minimum: 1,
    maximum: 31,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  @IsNotEmpty()
  dayOfMonth: number;

  @ApiProperty({
    description: 'The date this recurring expense starts, in ISO format',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional({
    description:
      'Optional final date for this recurring expense, in ISO format',
    example: '2027-08-31T23:59:59.999Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({
    description: 'Whether this recurring expense is processed by the scheduler',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRecurringTransactionDto extends CreateRecurringTransactionDto {}

export class RecurringTransactionParams extends KeywordWithPagination {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}
