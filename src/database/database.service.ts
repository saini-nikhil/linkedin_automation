import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async isHealthy(): Promise<boolean> {
    try {
      await this.ds.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
