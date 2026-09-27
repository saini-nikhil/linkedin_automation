import { Injectable } from '@nestjs/common';
import { TelegramSession, TelegramSessionMode } from './telegram.states';

@Injectable()
export class TelegramService {
  private readonly sessions = new Map<string, TelegramSession>();

  getSession(telegramId: string): TelegramSession {
    let s = this.sessions.get(telegramId);
    if (!s) {
      s = { mode: TelegramSessionMode.IDLE, buffer: [] };
      this.sessions.set(telegramId, s);
    }
    return s;
  }

  reset(telegramId: string): TelegramSession {
    const s: TelegramSession = { mode: TelegramSessionMode.IDLE, buffer: [] };
    this.sessions.set(telegramId, s);
    return s;
  }

  /** Parse "YYYY-MM-DD HH:mm" as Asia/Kolkata wall-clock into a Date (UTC instant). */
  parseCustomSchedule(input: string): Date | null {
    const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
    if (!m) return null;
    const [, Y, Mo, D, H, Mi] = m.map(Number);
    // IST = UTC+5:30. Convert wall-clock to UTC.
    const utc = Date.UTC(Y, Mo - 1, D, H, Mi, 0) - 5.5 * 60 * 60 * 1000;
    const d = new Date(utc);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  tomorrowAt(hour: number, minute = 0, timeZone = 'Asia/Kolkata'): Date {
    // Compute "tomorrow at hour:minute" in the target timezone.
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffsetMs);
    const y = istNow.getUTCFullYear();
    const mo = istNow.getUTCMonth();
    const d = istNow.getUTCDate() + 1;
    const utc = Date.UTC(y, mo, d, hour, minute, 0) - istOffsetMs;
    return new Date(utc);
  }

  formatIST(date: Date): string {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }
}
