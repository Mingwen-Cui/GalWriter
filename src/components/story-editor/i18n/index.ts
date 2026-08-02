import type { Language } from '../../../lib/i18n';
import { storyEditorEn } from './en';
import { storyEditorJa } from './ja';
import { storyEditorZh } from './zh';

export type StoryEditorCopy = typeof storyEditorEn;

const dictionaries: Record<Language, StoryEditorCopy> = {
  zh: storyEditorZh,
  ja: storyEditorJa,
  en: storyEditorEn,
};

export const getStoryEditorCopy = (language: Language) => dictionaries[language] || storyEditorEn;

export const formatStoryEditorText = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
