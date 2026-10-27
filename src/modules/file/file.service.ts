import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';

export type ImageUpload = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Client,
    config: ConfigService,
  ) {
    this.bucket = config.getOrThrow<string>('STORAGE_BUCKET');
  }

  async create(userId: number, file: ImageUpload) {
    const storageKey = randomUUID();

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Serialize uploads with account deletion.
          const users = await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
        `;
          if (!users.length)
            throw new ForbiddenException('Account is unavailable.');
          await this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: storageKey,
              Body: file.buffer,
              ContentType: file.mimetype,
            }),
            { abortSignal: AbortSignal.timeout(30_000) },
          );
          const stored = await tx.file.create({
            data: {
              userId,
              storageKey,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
            },
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              size: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          return stored;
        },
        { timeout: 60_000 },
      );
    } catch (error) {
      try {
        await this.deleteObject(storageKey);
      } catch (cleanupError) {
        this.logger.error(
          `Unable to clean up uploaded object ${storageKey}`,
          cleanupError instanceof Error
            ? cleanupError.stack
            : String(cleanupError),
        );
      }
      throw error;
    }
  }

  async deleteObject(storageKey: string) {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }

  async cleanupPending(userId: number) {
    const files = await this.prisma.file.findMany({
      where: { userId, pendingDeletion: true },
      select: { id: true, storageKey: true },
    });
    for (const file of files) {
      await this.deleteObject(file.storageKey);
      await this.prisma.file.deleteMany({
        where: { id: file.id, userId, pendingDeletion: true },
      });
    }
  }

  private async findOwned(id: number, userId: number) {
    const file = await this.prisma.file.findFirst({ where: { id, userId } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async get(id: number, userId: number) {
    const file = await this.findOwned(id, userId);
    const object = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: file.storageKey }),
    );
    if (!(object.Body instanceof Readable)) {
      throw new Error('S3 returned no readable object body');
    }
    return { stream: object.Body, mimeType: file.mimeType, size: file.size };
  }

  async remove(id: number, userId: number) {
    const file = await this.findOwned(id, userId);
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: file.storageKey }),
    );
    await this.prisma.file.deleteMany({ where: { id, userId } });
  }
}
