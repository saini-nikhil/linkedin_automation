export enum TelegramSessionMode {
  IDLE = 'IDLE',
  COLLECTING_LEARNING = 'COLLECTING_LEARNING',
  AWAITING_EDIT = 'AWAITING_EDIT',
  AWAITING_CUSTOM_SCHEDULE = 'AWAITING_CUSTOM_SCHEDULE',
}

export interface TelegramSession {
  mode: TelegramSessionMode;
  buffer: string[];
  topic?: string;
  pendingPostId?: string;
  learningNoteId?: string;
}
