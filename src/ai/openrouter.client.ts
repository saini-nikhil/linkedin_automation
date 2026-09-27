import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.baseUrl =
      this.config.get<string>('openrouter.baseUrl') ??
      'https://openrouter.ai/api/v1';
    this.apiKey = this.config.get<string>('openrouter.apiKey') ?? '';
    this.model =
      this.config.get<string>('openrouter.model') ?? 'openrouter/free';
  }

  getModel(): string {
    return this.model;
  }

  async chat(messages: ChatMessage[], timeoutMs = 60000): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }
    const maxAttempts = 3;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await firstValueFrom(
          this.http.post(
            `${this.baseUrl}/chat/completions`,
            {
              model: this.model,
              messages,
              temperature: 0.7,
              max_tokens: 800,
            },
            {
              timeout: timeoutMs,
              headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer':
                  this.config.get<string>('appBaseUrl') ??
                  'http://localhost:3000',
                'X-Title': 'linkedin-learning-automation',
              },
            },
          ),
        );
        const content: string | undefined =
          res.data?.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string' || !content.trim()) {
          throw new Error('Empty response from OpenRouter');
        }
        return content.trim();
      } catch (err: unknown) {
        lastError = err;
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        const retryable =
          status === 429 || (status !== undefined && status >= 500) || status === undefined;
        this.logger.warn(
          `OpenRouter attempt ${attempt}/${maxAttempts} failed (status=${status ?? 'n/a'})`,
        );
        if (!retryable || attempt === maxAttempts) break;
        await new Promise((r) => setTimeout(r, 1000 * attempt * 2));
      }
    }
    throw new Error(
      `OpenRouter request failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }
}
