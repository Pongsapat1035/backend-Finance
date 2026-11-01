import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { FileController } from './file.controller';
import { FileService } from './file.service';

@Module({
  controllers: [FileController],
  exports: [FileService],
  providers: [
    FileService,
    {
      provide: S3Client,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new S3Client({
          endpoint: config.getOrThrow<string>('STORAGE_ENDPOINT'),
          region: config.getOrThrow<string>('STORAGE_REGION'),
          credentials: {
            accessKeyId: config.getOrThrow<string>('STORAGE_ACCESS_KEY_ID'),
            secretAccessKey: config.getOrThrow<string>(
              'STORAGE_SECRET_ACCESS_KEY',
            ),
          },
        }),
    },
  ],
})
export class FileModule {}
