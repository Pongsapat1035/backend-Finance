import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsPositive, IsString } from "class-validator";
import { TransactionType } from "generated/prisma/enums";

export class CreateTransactionDto {
    @ApiProperty({ description: 'The ID of the category this transaction belongs to', example: 1 })
    @IsNumber()
    @IsNotEmpty()
    categoryId: number

    @ApiProperty({ description: 'The date of the transaction in ISO format', example: '2026-04-18T10:00:00.000Z' })
    @IsDateString()
    @IsNotEmpty()
    date: string;

    @ApiProperty({ description: 'The amount of the transaction', example: 1500 })
    @IsNumber()
    @IsPositive()
    @IsNotEmpty()
    amount: number

    @ApiProperty({ enum: TransactionType, description: 'Type of the transaction (e.g., INCOME or EXPEND)' })
    @IsEnum(TransactionType)
    @IsNotEmpty()
    type: TransactionType

    @ApiProperty({ description: 'A short description of the transaction', example: 'Grocery shopping' })
    @IsString()
    @IsNotEmpty()
    description: string
}

export class UpdateTransactionDto extends CreateTransactionDto { }

