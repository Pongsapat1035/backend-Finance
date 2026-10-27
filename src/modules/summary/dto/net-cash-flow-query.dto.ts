import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export const NET_CASH_FLOW_TYPES = ['monthly', 'yearly'] as const;
export type NetCashFlowType = (typeof NET_CASH_FLOW_TYPES)[number];

export class NetCashFlowQueryDto {
  @ApiProperty({ enum: NET_CASH_FLOW_TYPES, example: 'monthly' })
  @IsIn(NET_CASH_FLOW_TYPES)
  type!: NetCashFlowType;

  @ApiPropertyOptional({
    description: 'Required when type is monthly',
    example: '2026-07',
  })
  @ValidateIf((query: NetCashFlowQueryDto) => query.type === 'monthly')
  @IsDefined()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;

  @ApiPropertyOptional({
    description: 'Required when type is yearly',
    example: 2026,
    minimum: 1000,
    maximum: 9999,
  })
  @ValidateIf((query: NetCashFlowQueryDto) => query.type === 'yearly')
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(9999)
  year?: number;
}
