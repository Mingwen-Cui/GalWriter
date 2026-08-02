import type { Language } from '../../../lib/i18n';
import { sideToolbarEn } from './en';
import { sideToolbarJa } from './ja';
import { sideToolbarZh } from './zh';

export interface SideToolbarStrings {
  expand: string;
  collapse: string;
  card: string;
  text: string;
  character: string;
  scene: string;
  plot: string;
  condition: string;
  summary: string;
  replace: string;
  media: string;
  standardCard: string;
  hexagonCard: string;
  diamondCard: string;
  bodyText: string;
  headingText: string;
  image: string;
  video: string;
  audio: string;
  restore: string;
  assistant: string;
  settings: string;
  titles: string;
  undo: string;
  redo: string;
  hideTitles: string;
  titleInside: string;
  titleOutsideLeft: string;
  titleOutsideRight: string;
}

const dictionaries: Record<Language, SideToolbarStrings> = {
  en: sideToolbarEn,
  ja: sideToolbarJa,
  zh: sideToolbarZh,
};

export const getSideToolbarStrings = (language: Language): SideToolbarStrings =>
  dictionaries[language] ?? dictionaries.en;
