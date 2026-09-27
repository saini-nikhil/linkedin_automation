import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ResumeService } from './resume.service';

@Module({
  imports: [AiModule],
  providers: [ResumeService],
  exports: [ResumeService],
})
export class ResumeModule {}
