import type { Language } from '../../../../../lib/i18n';
import { renderObjectInspectorEn } from './en';
import { renderObjectInspectorJa } from './ja';
import { renderObjectInspectorZh } from './zh';

type Dictionary = typeof renderObjectInspectorEn;

const dictionaries: Record<Language, Dictionary> = {
  en: renderObjectInspectorEn,
  ja: renderObjectInspectorJa,
  zh: renderObjectInspectorZh,
};

export const renderObjectText = (language: Language) => dictionaries[language] || renderObjectInspectorEn;
