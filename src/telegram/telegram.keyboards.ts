import { Markup } from 'telegraf';
import { POST_STYLE_LABELS, PostStyle } from '../common/constants/post-style.enum';

type CallbackRows = ReturnType<typeof Markup.button.callback>[][];
type MixedRows = (
  | ReturnType<typeof Markup.button.callback>
  | ReturnType<typeof Markup.button.url>
)[][];

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
      Markup.button.callback('🌇 Today 6 PM', `sched_today18:${postId}`),
      Markup.button.callback('🌃 Today 8 PM', `sched_today20:${postId}`),
    ],
    [
      Markup.button.callback('🌅 Tomorrow 10 AM', `sched_am:${postId}`),
      Markup.button.callback('🌙 Tomorrow 7 PM', `sched_pm:${postId}`),
    ],
    [Markup.button.callback('📅 Custom Time', `sched_custom:${postId}`)],
  ]);
}

export function rejectReasonKeyboard(postId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Topic', `reject_reason:${postId}:Topic`),
      Markup.button.callback('Writing', `reject_reason:${postId}:Writing`),
    ],
    [
      Markup.button.callback('Too Generic', `reject_reason:${postId}:Too Generic`),
      Markup.button.callback('Not Useful', `reject_reason:${postId}:Not Useful`),
    ],
    [
      Markup.button.callback('Other', `reject_reason:${postId}:Other`),
      Markup.button.callback('Skip', `reject_reason:${postId}:Skip`),
    ],
  ]);
}

export function styleKeyboard() {
  const styles = Object.values(PostStyle);
  const rows = styles.map((s) => [
    Markup.button.callback(POST_STYLE_LABELS[s], `style:${s}`),
  ]);
  return Markup.inlineKeyboard(rows);
}

export function careerProfileKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('➕ Role', 'cedit:roles'),
      Markup.button.callback('➕ Skill', 'cedit:skills'),
    ],
    [
      Markup.button.callback('📍 Location', 'cedit:location'),
      Markup.button.callback('🏠 Work Type', 'cedit:worktype'),
    ],
    [
      Markup.button.callback('💰 Salary', 'cedit:salary'),
      Markup.button.callback('🧪 Experience', 'cedit:exp'),
    ],
    [Markup.button.callback('🔗 Career URLs', 'cedit:urls')],
  ]);
}

export function jobCardKeyboard(jobId: string, jobUrl?: string | null) {
  const rows: MixedRows = [
    [
      Markup.button.callback('📌 Save', `job:save:${jobId}`),
      Markup.button.callback('🚀 Apply', `job:apply:${jobId}`),
    ],
    [
      Markup.button.callback('📄 Resume', `job:resume:${jobId}`),
      Markup.button.callback('✉️ Cover Letter', `job:cover:${jobId}`),
    ],
  ];
  if (jobUrl) {
    rows.push([Markup.button.url('🔗 Open Job', jobUrl.slice(0, 512))]);
  }
  return Markup.inlineKeyboard(rows);
}

export function jobApplyKeyboard(jobId: string, jobUrl?: string | null) {
  const rows: MixedRows = [
    [
      Markup.button.callback('✅ Mark as Applied', `job:done:${jobId}`),
      Markup.button.callback('❌ Cancel', `job:cancel:${jobId}`),
    ],
    [
      Markup.button.callback('📄 Resume', `job:resume:${jobId}`),
      Markup.button.callback('✉️ Cover Letter', `job:cover:${jobId}`),
    ],
  ];
  if (jobUrl) {
    rows.unshift([Markup.button.url('🔗 Open Application', jobUrl.slice(0, 512))]);
  }
  return Markup.inlineKeyboard(rows);
}

export function coverReviewKeyboard(jobId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔄 Regenerate', `cover:regen:${jobId}`),
      Markup.button.callback('💾 Save', `cover:save:${jobId}`),
    ],
    [
      Markup.button.callback('✏️ Edit', `cover:edit:${jobId}`),
      Markup.button.callback('❌ Cancel', `cover:cancel:${jobId}`),
    ],
  ]);
}

export function networkCardKeyboard(personId: string, profileUrl?: string | null) {
  const rows: MixedRows = [
    [
      Markup.button.callback('💬 Draft Message', `net:draft:${personId}`),
      Markup.button.callback('❌ Ignore', `net:ignore:${personId}`),
    ],
  ];
  if (profileUrl) {
    rows.unshift([Markup.button.url('👤 View', profileUrl.slice(0, 512))]);
  }
  return Markup.inlineKeyboard(rows);
}

export function messageReviewKeyboard(messageId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve', `msg:approve:${messageId}`),
      Markup.button.callback('🔄 Regenerate', `msg:regen:${messageId}`),
    ],
    [
      Markup.button.callback('✏️ Edit', `msg:edit:${messageId}`),
      Markup.button.callback('❌ Cancel', `msg:cancel:${messageId}`),
    ],
  ]);
}

export function messageApprovedKeyboard(messageId: string, profileUrl?: string | null) {
  const rows: MixedRows = [
    [Markup.button.callback('✅ Mark Sent (manual)', `msg:sent:${messageId}`)],
  ];
  if (profileUrl) {
    rows.unshift([Markup.button.url('🔗 Open Profile', profileUrl.slice(0, 512))]);
  }
  return Markup.inlineKeyboard(rows);
}

export function pagerRows(prefix: string, page: number, totalPages: number): CallbackRows {
  const rows: CallbackRows = [];
  if (page > 0 || page < totalPages - 1) {
    const nav: CallbackRows[number] = [];
    if (page > 0) nav.push(Markup.button.callback('⬅️ Previous', `${prefix}:${page - 1}`));
    if (page < totalPages - 1) nav.push(Markup.button.callback('Next ➡️', `${prefix}:${page + 1}`));
    rows.push(nav);
  }
  return rows;
}
