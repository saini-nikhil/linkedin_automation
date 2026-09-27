import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async check() {
    let database: 'ok' | 'error' = 'error';
    try {
      await this.ds.query('SELECT 1');
      database = 'ok';
    } catch {
      database = 'error';
    }
    return { status: 'ok', database, scheduler: 'ok' };
  }
}
