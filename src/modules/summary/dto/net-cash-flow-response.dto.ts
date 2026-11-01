import { ApiProperty } from '@nestjs/swagger';
import { PRODUCT_TIME_ZONE } from 'src/config/dayjs.config';
import {
  NET_CASH_FLOW_TYPES,
  type NetCashFlowType,
} from './net-cash-flow-query.dto';

class CashFlowAmountsDto {
  @ApiProperty({ example: 1000 })
  income: number;

  @ApiProperty({ example: 250.5 })
  expenses: number;

  @ApiProperty({ example: 749.5 })
  netCashFlow: number;
}

class CashFlowBucketDto extends CashFlowAmountsDto {
  @ApiProperty({ example: '2026-07-01' })
  period: string;
}

export class NetCashFlowResponseDto {
  @ApiProperty({ enum: NET_CASH_FLOW_TYPES, example: 'monthly' })
  type: NetCashFlowType;

  @ApiProperty({ example: '2026-07' })
  period: string;

  @ApiProperty({ enum: [PRODUCT_TIME_ZONE], example: PRODUCT_TIME_ZONE })
  timezone: typeof PRODUCT_TIME_ZONE;

  @ApiProperty({ type: CashFlowAmountsDto })
  totals: CashFlowAmountsDto;

  @ApiProperty({ type: [CashFlowBucketDto] })
  data: CashFlowBucketDto[];
}
