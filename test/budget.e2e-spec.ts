import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/modules/auth/guard/jwt-auth.guard';
import { BudgetController } from '../src/modules/budget/budget.controller';
import { BudgetService } from '../src/modules/budget/budget.service';

describe('Budget endpoints (e2e)', () => {
  let app: INestApplication;
  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    findExceeded: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    service.create.mockResolvedValue({ id: 1 });
    service.findAll.mockResolvedValue({ data: [] });
    service.findExceeded.mockResolvedValue({ period: '2026-09', data: [] });
    service.findOne.mockResolvedValue({ id: 1 });
    service.update.mockResolvedValue({ id: 1 });
    service.remove.mockResolvedValue({ id: 1 });

    const module = await Test.createTestingModule({
      controllers: [BudgetController],
      providers: [{ provide: BudgetService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = { userId: Number(request.headers['x-user-id']) };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => app.close());

  it('passes the authenticated user, not client input, to every Budget operation', async () => {
    const server = app.getHttpServer() as App;
    const body = { period: '2026-09', categoryId: null, plannedAmount: 0 };

    await request(server)
      .post('/budget')
      .set('x-user-id', '7')
      .send(body)
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(body, 7);

    await request(server)
      .get('/budget?period=2026-09')
      .set('x-user-id', '8')
      .expect(200);
    expect(service.findAll).toHaveBeenCalledWith({ period: '2026-09' }, 8);

    await request(server)
      .get('/budget/exceeded?period=2026-09')
      .set('x-user-id', '8')
      .expect(200);
    expect(service.findExceeded).toHaveBeenCalledWith({ period: '2026-09' }, 8);

    await request(server).get('/budget/1').set('x-user-id', '9').expect(200);
    expect(service.findOne).toHaveBeenCalledWith(1, 9);

    await request(server)
      .patch('/budget/1')
      .set('x-user-id', '10')
      .send({ plannedAmount: 100 })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(1, { plannedAmount: 100 }, 10);

    await request(server)
      .delete('/budget/1')
      .set('x-user-id', '11')
      .expect(200);
    expect(service.remove).toHaveBeenCalledWith(1, 11);
  });

  it('rejects an invalid month for exceeded categories', async () => {
    await request(app.getHttpServer() as App)
      .get('/budget/exceeded?period=2026-13')
      .set('x-user-id', '8')
      .expect(400);

    expect(service.findExceeded).not.toHaveBeenCalled();
  });
});
