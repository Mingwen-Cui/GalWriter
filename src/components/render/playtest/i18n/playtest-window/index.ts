import type { Language } from '../../../../../lib/i18n';
import { playtestWindowEn } from './en';
import { playtestWindowJa } from './ja';
import { playtestWindowZh } from './zh';

type PlaytestWindowDictionary = {
  [Key in keyof typeof playtestWindowEn]: string;
};

const dictionaries: Record<Language, PlaytestWindowDictionary> = {
  zh: playtestWindowZh,
  ja: playtestWindowJa,
  en: playtestWindowEn,
};

export const getPlaytestWindowText = (language: Language) =>
  dictionaries[language] || playtestWindowEn;
