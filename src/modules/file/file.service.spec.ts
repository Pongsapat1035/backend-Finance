import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from './file.service';

describe('FileService', () => {
  const image = {
    buffer: Buffer.from('image'),
    originalname: 'photo.png',
    mimetype: 'image/png',
    size: 5,
  };
  const prisma = {
    file: { create: jest.fn(), findFirst: jest.fn(), deleteMany: jest.fn() },
  };
  const tx = {
    file: prisma.file,
    $queryRaw: jest.fn().mockResolvedValue([{ id: 1 }]),
  };
  Object.assign(prisma, {
    $transaction: (fn: (transaction: typeof tx) => unknown) => fn(tx),
  });
  const s3 = { send: jest.fn() };
  const service = new FileService(
    prisma as unknown as PrismaService,
    s3 as unknown as S3Client,
    { getOrThrow: () => 'test-bucket' } as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    tx.$queryRaw.mockResolvedValue([{ id: 1 }]);
  });

  it('does not create metadata if S3 upload fails', async () => {
    s3.send.mockRejectedValueOnce(new Error('upload failed'));
    await expect(service.create(1, image)).rejects.toThrow('upload failed');
    expect(prisma.file.create).not.toHaveBeenCalled();
  });

  it('cleans up the uploaded object if the metadata write fails', async () => {
    s3.send.mockResolvedValue({});
    prisma.file.create.mockRejectedValueOnce(new Error('database failed'));
    await expect(service.create(1, image)).rejects.toThrow('database failed');
    const calls = s3.send.mock.calls as [
      PutObjectCommand | DeleteObjectCommand,
    ][];
    const upload = calls[0][0];
    const cleanup = calls[1][0];
    expect(cleanup.input.Key).toBe(upload.input.Key);
    expect(cleanup.input.Bucket).toBe('test-bucket');
  });

  it('removes the object and metadata for an owned file', async () => {
    prisma.file.findFirst.mockResolvedValue({
      id: 9,
      userId: 1,
      storageKey: 'key',
    });
    s3.send.mockResolvedValue({});
    await service.remove(9, 1);
    const calls = s3.send.mock.calls as [DeleteObjectCommand][];
    expect(calls[0][0].input.Key).toBe('key');
    expect(prisma.file.deleteMany).toHaveBeenCalledWith({
      where: { id: 9, userId: 1 },
    });
  });

  it('retains metadata if deleting the object fails', async () => {
    prisma.file.findFirst.mockResolvedValue({
      id: 9,
      userId: 1,
      storageKey: 'key',
    });
    s3.send.mockRejectedValueOnce(new Error('delete failed'));
    await expect(service.remove(9, 1)).rejects.toThrow('delete failed');
    expect(prisma.file.deleteMany).not.toHaveBeenCalled();
  });
});
