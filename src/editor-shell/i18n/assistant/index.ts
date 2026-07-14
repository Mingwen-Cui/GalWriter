import type { Language } from '../../../lib/i18n';
import { assistantPanelEn } from './en';
import { assistantPanelJa } from './ja';
import { assistantPanelZh } from './zh';

type LocalizedDictionary<Value> = {
  [Key in keyof Value]: Value[Key] extends string
    ? string
    : Value[Key] extends Record<string, unknown>
      ? LocalizedDictionary<Value[Key]>
      : Value[Key];
};

type AssistantPanelDictionary = LocalizedDictionary<typeof assistantPanelEn>;

const dictionaries: Record<Language, AssistantPanelDictionary> = {
  zh: assistantPanelZh,
  ja: assistantPanelJa,
  en: assistantPanelEn,
};

export const assistantPanelCopy = (language: Language) => dictionaries[language] || assistantPanelEn;
