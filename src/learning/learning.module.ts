import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningNote } from './entities/learning-note.entity';
import { LearningService } from './learning.service';
import { LearningController } from './learning.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LearningNote])],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
