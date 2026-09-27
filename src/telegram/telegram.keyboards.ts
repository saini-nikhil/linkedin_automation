import { Markup } from 'telegraf';
import { POST_STYLE_LABELS, PostStyle } from '../common/constants/post-style.enum';

export function learningSavedKeyboard(postIdHint = '') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🤖 Generate Post', `generate:${postIdHint}`),
      Markup.button.callback('✏️ Add More', 'addmore'),
    ],
    [Markup.button.callback('❌ Cancel', 'cancel')],
  ]);
}

export function collectingKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🤖 Generate Post', 'generate:'),
      Markup.button.callback('❌ Cancel', 'cancel'),
    ],
  ]);
}

export function postReviewKeyboard(postId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve', `approve:${postId}`),
      Markup.button.callback('🔄 Regenerate', `regen:${postId}`),
    ],
    [
      Markup.button.callback('✏️ Edit', `edit:${postId}`),
      Markup.button.callback('❌ Reject', `reject:${postId}`),
    ],
    [Markup.button.callback('🕐 Schedule', `schedule:${postId}`)],
  ]);
}

export function approvedKeyboard(postId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🚀 Publish Now', `publish:${postId}`),
      Markup.button.callback('🕐 Schedule', `schedule:${postId}`),
    ],
  ]);
}

export function scheduleKeyboard(postId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🌅 Tomorrow 10 AM', `sched_am:${postId}`),
      Markup.button.callback('🌙 Tomorrow 7 PM', `sched_pm:${postId}`),
    ],
    [Markup.button.callback('📅 Custom Time', `sched_custom:${postId}`)],
  ]);
}

export function styleKeyboard() {
  const styles = Object.values(PostStyle);
  const rows = styles.map((s) => [
    Markup.button.callback(POST_STYLE_LABELS[s], `style:${s}`),
  ]);
  return Markup.inlineKeyboard(rows);
}
