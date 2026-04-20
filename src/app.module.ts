import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { OtpModule } from './modules/otp/otp.module';
import { CategoryModule } from './modules/category/category.module';
import { TransactionModule } from './modules/transaction/transaction.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, OtpModule, PrismaModule, CategoryModule, TransactionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
