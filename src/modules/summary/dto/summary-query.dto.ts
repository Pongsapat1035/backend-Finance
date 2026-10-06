import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, Matches, IsOptional } from 'class-validator';

export class SummaryQueryDto {
  @ApiProperty({
    description: 'Summarize one month in Bangkok time, format YYYY-MM',
    example: '2026-07',
  })
  @IsDefined()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;
}

export class SpendingByCategoryQueryDto {
  @ApiPropertyOptional({
    description:
      'Expense month in Bangkok time, format YYYY-MM; defaults to the current month',
    example: '2026-07',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}
