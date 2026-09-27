import { PostStyle } from '../../common/constants/post-style.enum';

export const STYLE_INSTRUCTIONS: Record<PostStyle, string> = {
  [PostStyle.SOMETHING_I_LEARNED]: 'Frame as something learned today, humble and curious.',
  [PostStyle.CONCEPT_EXPLAINED]: 'Explain the concept clearly, definition then practical notes.',
  [PostStyle.BUG_I_FIXED]: 'Describe the symptom, root cause, and fix — only what the user stated.',
  [PostStyle.PROJECT_LEARNING]: 'Tie learning to project context given by the user.',
  [PostStyle.DEVELOPER_TIP]: 'Give a concise actionable tip derived from the notes.',
  [PostStyle.WEEKLY_LEARNING]: 'Summarize the week as a short list of learnings.',
  [PostStyle.DEEP_DIVE]: 'Go deeper: how it works, trade-offs, when to use it.',
};
