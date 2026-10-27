import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { UserStatus } from 'generated/prisma/client';
import { Readable } from 'node:stream';
import request from 'supertest';
import { App } from 'supertest/types';
import { appConfig } from '../src/config/app.config';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { FileController } from '../src/modules/file/file.controller';
import { FileService } from '../src/modules/file/file.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';

const secret = 'files-e2e-test-secret';
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
type Row = {
  id: number;
  userId: number;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
};

describe('Files endpoints (e2e)', () => {
  let app: INestApplication;
  let rows: Row[];
  let objects: Map<string, Buffer>;
  const jwt = new JwtService({ secret });
  const token = (id: number) => `Bearer ${jwt.sign({ userId: id })}`;
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: number } }) => ({
        id: where.id,
        status: UserStatus.VERIFIED,
      })),
    },
    file: {
      create: jest.fn(
        ({ data }: { data: Omit<Row, 'id' | 'createdAt' | 'updatedAt'> }) => {
          const row = {
            ...data,
            id: rows.length + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          rows.push(row);
          return {
            id: row.id,
            originalName: row.originalName,
            mimeType: row.mimeType,
            size: row.size,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
        },
      ),
      findFirst: jest.fn(
        ({ where }: { where: { id: number; userId: number } }) =>
          rows.find(
            (row) => row.id === where.id && row.userId === where.userId,
          ) ?? null,
      ),
      deleteMany: jest.fn(
        ({ where }: { where: { id: number; userId: number } }) => {
          rows = rows.filter(
            (row) => row.id !== where.id || row.userId !== where.userId,
          );
          return { count: 1 };
        },
      ),
    },
  };
  Object.assign(prisma, {
    $queryRaw: () => Promise.resolve([{ id: 1 }]),
    $transaction: (fn: (transaction: typeof prisma) => unknown) => fn(prisma),
  });
  const s3 = {
    send: jest.fn(
      (command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand) => {
        const key = command.input.Key!;
        if (command instanceof PutObjectCommand)
          objects.set(key, command.input.Body as Buffer);
        if (command instanceof DeleteObjectCommand) objects.delete(key);
        if (command instanceof GetObjectCommand)
          return { Body: Readable.from(objects.get(key)!) };
        return {};
      },
    ),
  };

  beforeEach(async () => {
    rows = [];
    objects = new Map();
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [FileController],
      providers: [
        FileService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: S3Client, useValue: s3 },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'test-bucket' },
        },
        { provide: appConfig.KEY, useValue: { jwtSecret: secret } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it('uploads two independent images, retrieves each, and deletes only one', async () => {
    const server = app.getHttpServer() as App;
    const first = await request(server)
      .post('/files')
      .set('Authorization', token(1))
      .attach('file', image, 'first.png')
      .expect(201);
    const second = await request(server)
      .post('/files')
      .set('Authorization', token(1))
      .attach('file', image, 'second.png')
      .expect(201);
    const firstId = (first.body as { id: number }).id;
    const secondId = (second.body as { id: number }).id;
    expect(firstId).not.toBe(secondId);
    const read = await request(server)
      .get(`/files/${firstId}`)
      .set('Authorization', token(1))
      .expect(200)
      .expect('Content-Type', 'image/png');
    expect(read.body).toEqual(image);
    await request(server)
      .delete(`/files/${firstId}`)
      .set('Authorization', token(1))
      .expect(204);
    await request(server)
      .get(`/files/${firstId}`)
      .set('Authorization', token(1))
      .expect(404);
    await request(server)
      .get(`/files/${secondId}`)
      .set('Authorization', token(1))
      .expect(200);
    expect(objects.size).toBe(1);
  });

  it('rejects missing, non-image and oversized uploads without saving', async () => {
    const server = app.getHttpServer() as App;
    await request(server)
      .post('/files')
      .set('Authorization', token(1))
      .expect(400);
    await request(server)
      .post('/files')
      .set('Authorization', token(1))
      .attach('file', Buffer.from('not an image'), 'photo.png')
      .expect(400);
    await request(server)
      .post('/files')
      .set('Authorization', token(1))
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png')
      .expect(400);
    expect(rows).toHaveLength(0);
    expect(objects.size).toBe(0);
  });

  it('requires authentication and restricts files to their owner', async () => {
    const server = app.getHttpServer() as App;
    await request(server).post('/files').expect(401);
    await request(server).get('/files/1').expect(401);
    await request(server).delete('/files/1').expect(401);
    const created = await request(server)
      .post('/files')
      .set('Authorization', token(1))
      .attach('file', image, 'photo.png')
      .expect(201);
    const id = (created.body as { id: number }).id;
    await request(server)
      .get(`/files/${id}`)
      .set('Authorization', token(2))
      .expect(404);
    await request(server)
      .delete(`/files/${id}`)
      .set('Authorization', token(2))
      .expect(404);
    await request(server)
      .get('/files/999')
      .set('Authorization', token(1))
      .expect(404);
    await request(server)
      .delete('/files/999')
      .set('Authorization', token(1))
      .expect(404);
    expect(objects.size).toBe(1);
  });
});
