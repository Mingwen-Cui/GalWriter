import type { AssistantCardDraft } from '../../../agent/planning/agentCardDraft';
import { ARTICLE_TEACHING_ROLE_TEMPLATES } from './teachingRoleTemplates';

export type { ArticleTeachingRoleTemplate } from './types';

export const createArticleTeachingRoleTemplateCards = (): AssistantCardDraft[] =>
  ARTICLE_TEACHING_ROLE_TEMPLATES.map((template) => ({
    ...template.card,
    assistantTemplateId: template.id,
    assistantTemplateName: template.name,
    assistantTemplateInstruction: template.generationInstruction,
    assistantTemplateTeachingMode: template.teachingMode,
  }));
