import type { Language } from '../../../lib/i18n';
import { regionMusicEn } from './en';
import { regionMusicJa } from './ja';
import { regionMusicZh } from './zh';

type RegionMusicDictionary = { [Key in keyof typeof regionMusicEn]: string };

const dictionaries: Record<Language, RegionMusicDictionary> = {
  zh: regionMusicZh,
  ja: regionMusicJa,
  en: regionMusicEn,
};

export const regionMusicCopy = (language: Language) => dictionaries[language] || regionMusicEn;
