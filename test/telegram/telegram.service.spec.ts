import { TelegramService } from '../../src/telegram/telegram.service';

describe('TelegramService scheduling helpers', () => {
  const svc = new TelegramService();

  it('parses YYYY-MM-DD HH:mm', () => {
    const d = svc.parseCustomSchedule('2026-09-26 10:00');
    expect(d).toBeInstanceOf(Date);
    // 10:00 IST = 04:30 UTC
    expect(d!.getUTCHours()).toBe(4);
    expect(d!.getUTCMinutes()).toBe(30);
  });

  it('rejects invalid input', () => {
    expect(svc.parseCustomSchedule('tomorrow')).toBeNull();
    expect(svc.parseCustomSchedule('2026/09/26 10:00')).toBeNull();
  });

  it('tomorrowAt returns future date', () => {
    const d = svc.tomorrowAt(10, 0);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });
});
