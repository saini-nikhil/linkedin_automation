import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { LearningService } from './learning.service';
import { CreateLearningNoteDto } from './dto/create-learning-note.dto';

@Controller('learning')
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  // NOTE: In this personal tool, user identity is resolved via Telegram.
  // REST callers pass x-user-id header (validated for ownership in posts module).
  @Post()
  create(@Body() dto: CreateLearningNoteDto, @Req() req: { headers: Record<string, string | undefined> }) {
    const userId = req.headers['x-user-id'] as string;
    return this.learning.create(userId, dto);
  }

  @Get(':userId')
  list(@Param('userId') userId: string) {
    return this.learning.findAllForUser(userId);
  }
}
