import { AiService } from '../../src/ai/ai.service';
import { PostStyle } from '../../src/common/constants/post-style.enum';

describe('AiService', () => {
  it('buildHistorySummary caps entries and strips whitespace', () => {
    const svc = new AiService({} as never);
    const posts = Array.from({ length: 20 }, (_, i) => ({
      content: `post number ${i}   with\nnewlines`,
    }));
    const summary = svc.buildHistorySummary(posts);
    expect(summary.split('\n').length).toBe(15);
    expect(summary).not.toContain('\n\n');
  });

  it('generatePost passes style hint', async () => {
    const chat = jest.fn(async () => 'hello post #dev');
    const client = { chat, getModel: () => 'openrouter/free' } as never;
    const svc = new AiService(client);
    const out = await svc.generatePost({
      learningContent: 'Learned Redis TTL',
      style: PostStyle.DEEP_DIVE,
    });
    expect(out.content).toBe('hello post #dev');
    expect(chat).toHaveBeenCalled();
    const messages = (chat.mock.calls[0] as unknown as { content: string }[][])[0];
    expect(messages[0].content).toContain('Never invent');
  });
});
