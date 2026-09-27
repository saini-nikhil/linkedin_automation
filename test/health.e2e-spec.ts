import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

describe('Health (e2e-ish)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: { check: async () => ({ status: 'ok', database: 'ok', scheduler: 'ok' }) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  it('/health (GET)', () =>
    request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'ok',
      database: 'ok',
      scheduler: 'ok',
    }));

  afterAll(async () => {
    await app.close();
  });
});
