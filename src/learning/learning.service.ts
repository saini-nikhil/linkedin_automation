import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningNote } from './entities/learning-note.entity';
import { CreateLearningNoteDto } from './dto/create-learning-note.dto';

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    @InjectRepository(LearningNote)
    private readonly notes: Repository<LearningNote>,
  ) {}

  async create(userId: string, dto: CreateLearningNoteDto): Promise<LearningNote> {
    const note = this.notes.create({
      userId,
      content: dto.content.trim(),
      topic: dto.topic?.trim() || null,
    });
    const saved = await this.notes.save(note);
    this.logger.log(`Learning note ${saved.id} created for user ${userId}`);
    return saved;
  }

  async findAllForUser(userId: string): Promise<LearningNote[]> {
    return this.notes.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findOneForUser(id: string, userId: string): Promise<LearningNote> {
    const note = await this.notes.findOne({ where: { id, userId } });
    if (!note) throw new NotFoundException('Learning note not found');
    return note;
  }
}
