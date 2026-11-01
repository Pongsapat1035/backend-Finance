import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

class SummaryYearQueryDto {
  @ApiPropertyOptional({
    description: 'Calendar year in Bangkok time. Takes precedence over month.',
    example: 2026,
    minimum: 1000,
    maximum: 9999,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(9999)
  year?: number;
}

export class SummaryQueryDto extends SummaryYearQueryDto {
  @ApiPropertyOptional({
    description:
      'Required when year is omitted, format YYYY-MM in Bangkok time',
    example: '2026-07',
  })
  @ValidateIf((query: SummaryQueryDto) => query.year === undefined)
  @IsDefined()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}

export class SpendingByCategoryQueryDto extends SummaryYearQueryDto {
  @ApiPropertyOptional({
    description: 'Defaults to the current Bangkok month when year is omitted',
    example: '2026-07',
  })
  @ValidateIf((query: SpendingByCategoryQueryDto) => query.year === undefined)
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}
