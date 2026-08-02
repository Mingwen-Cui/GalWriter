import type { Language } from '../../../lib/i18n';
import { editorHeaderEn } from './en';
import { editorHeaderJa } from './ja';
import { editorHeaderZh } from './zh';

type EditorHeaderDictionary = {
  [Key in keyof typeof editorHeaderEn]: string;
};

const dictionaries: Record<Language, EditorHeaderDictionary> = {
  zh: editorHeaderZh,
  ja: editorHeaderJa,
  en: editorHeaderEn,
};

export const editorHeaderCopy = (language: Language) => dictionaries[language] || editorHeaderEn;
