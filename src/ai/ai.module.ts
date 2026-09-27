import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiService } from './ai.service';
import { OpenRouterClient } from './openrouter.client';

@Module({
  imports: [HttpModule],
  providers: [AiService, OpenRouterClient],
  exports: [AiService, OpenRouterClient],
})
export class AiModule {}
