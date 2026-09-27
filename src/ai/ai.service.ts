import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterClient } from './openrouter.client';
import {
  LINKEDIN_POST_SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildUserPrompt,
} from './prompts/linkedin-post.prompt';
import { STYLE_INSTRUCTIONS } from './prompts/style-prompts';
import { PostStyle } from '../common/constants/post-style.enum';

export interface GenerateInput {
  learningContent: string;
  style?: PostStyle;
  historySummary?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly client: OpenRouterClient) {}

  get promptVersion(): string {
    return PROMPT_VERSION;
  }

  async generatePost(input: GenerateInput): Promise<{ content: string; model: string }> {
    const style = input.style ?? PostStyle.SOMETHING_I_LEARNED;
    const styleHint = STYLE_INSTRUCTIONS[style] ?? '';
    const started = Date.now();
    const userPrompt =
      buildUserPrompt(input.learningContent, style, input.historySummary) +
      (styleHint ? `\nStyle hint: ${styleHint}` : '');
    const content = await this.client.chat([
      { role: 'system', content: LINKEDIN_POST_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
    const model = this.client.getModel();
    this.logger.log(
      `Generated post model=${model} style=${style} duration=${Date.now() - started}ms`,
    );
    return { content, model };
  }

  buildHistorySummary(recentPosts: { content: string }[]): string {
    return recentPosts
      .slice(0, 15)
      .map((p, i) => `${i + 1}. ${p.content.slice(0, 160).replace(/\s+/g, ' ')}`)
      .join('\n');
  }
}
