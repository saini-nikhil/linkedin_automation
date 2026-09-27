export enum PostStyle {
  SOMETHING_I_LEARNED = 'SOMETHING_I_LEARNED',
  CONCEPT_EXPLAINED = 'CONCEPT_EXPLAINED',
  BUG_I_FIXED = 'BUG_I_FIXED',
  PROJECT_LEARNING = 'PROJECT_LEARNING',
  DEVELOPER_TIP = 'DEVELOPER_TIP',
  WEEKLY_LEARNING = 'WEEKLY_LEARNING',
  DEEP_DIVE = 'DEEP_DIVE',
}

export const POST_STYLE_LABELS: Record<PostStyle, string> = {
  [PostStyle.SOMETHING_I_LEARNED]: '💡 Something I Learned',
  [PostStyle.CONCEPT_EXPLAINED]: '🧠 Concept Explained',
  [PostStyle.BUG_I_FIXED]: '🐛 Bug I Fixed',
  [PostStyle.PROJECT_LEARNING]: '🛠️ Project Learning',
  [PostStyle.DEVELOPER_TIP]: '⚡ Developer Tip',
  [PostStyle.WEEKLY_LEARNING]: '📚 Weekly Learning',
  [PostStyle.DEEP_DIVE]: '🔬 Deep Dive',
};
