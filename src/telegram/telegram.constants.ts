export const TELEGRAM_COMMANDS = {
  START: 'start',
  HELP: 'help',
  LEARN: 'learn',
  POSTS: 'posts',
  LINKEDIN: 'linkedin',
  CANCEL: 'cancel',
} as const;

export const CALLBACK = {
  GENERATE: 'generate',
  ADD_MORE: 'addmore',
  CANCEL: 'cancel',
  APPROVE: 'approve',
  REJECT: 'reject',
  REGENERATE: 'regen',
  EDIT: 'edit',
  PUBLISH_NOW: 'publish',
  SCHEDULE: 'schedule',
  SCHED_TOMORROW_AM: 'sched_am',
  SCHED_TOMORROW_PM: 'sched_pm',
  SCHED_CUSTOM: 'sched_custom',
  STYLE_PREFIX: 'style:',
  OPEN_POST_PREFIX: 'open:',
} as const;
