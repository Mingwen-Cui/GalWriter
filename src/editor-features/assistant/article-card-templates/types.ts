import type { AssistantCardDraft } from '../../../agent/planning/agentCardDraft';

export type ArticleTeachingRoleTemplate = {
  id: string;
  name: string;
  teachingMode: 'interactive' | 'lecture';
  generationInstruction: string;
  card: AssistantCardDraft & { type: 'character' };
};
