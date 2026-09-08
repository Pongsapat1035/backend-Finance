import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import buddhist from 'dayjs/plugin/buddhistEra';
import timezone from 'dayjs/plugin/timezone';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import duration from 'dayjs/plugin/duration';
import helmet from 'helmet';

dayjs.extend(buddhist);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(duration);

function createSwaggerAuthMiddleware(username: string, password: string) {
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');

  return (req: Request, res: Response, next: NextFunction): void => {
    const isSwaggerPath =
      req.path === '/api' ||
      req.path.startsWith('/api/') ||
      req.path === '/api-json';

    if (!isSwaggerPath) return next();
    if (req.headers.authorization === `Basic ${credentials}`) return next();

    res.setHeader('WWW-Authenticate', 'Basic realm="Finance API Docs"');
    res.status(401).send('Swagger authentication required');
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  app.use(helmet({ contentSecurityPolicy: false }));

  const swaggerUsername = configService.get<string>('SWAGGER_USERNAME');
  const swaggerPassword = configService.get<string>('SWAGGER_PASSWORD');

  if (!swaggerUsername || !swaggerPassword) {
    throw new Error('SWAGGER_USERNAME and SWAGGER_PASSWORD are required');
  }

  app.use(createSwaggerAuthMiddleware(swaggerUsername, swaggerPassword));

  const config = new DocumentBuilder()
    .setTitle('Finance')
    .setDescription('Desc')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      filter: true,
    },
  });

  app.enableCors({
    origin: configService
      .get<string>('CORS_ORIGINS', '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  await app.listen(configService.get<number>('PORT') ?? 3000);
}
void bootstrap();
