import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, isString, Matches, Min } from 'class-validator';
import { TransactionType } from 'generated/prisma/enums';

export class PaginationDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;
}


export class KeywordWithPagination extends PaginationDto {
    @ApiPropertyOptional({ description: "keyword for search" })
    @IsOptional()
    keyword?: string
}

export class TransactionParams extends KeywordWithPagination {
    @ApiPropertyOptional({ enum: TransactionType, description: 'Type of the transaction (e.g., INCOME or EXPEND)' })
    @IsOptional()
    @IsEnum(TransactionType)
    type?: TransactionType

    @ApiPropertyOptional({ description: 'The ID of the category to filter by' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    categoryId?: number

    @ApiPropertyOptional({ description: 'Filter by month, format YYYY-MM', example: '2026-04' })
    @IsOptional()
    @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    month?: string
}