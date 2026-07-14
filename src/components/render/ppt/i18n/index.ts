import type { Language } from '../../../../lib/i18n';
import { en } from './en';
import { ja } from './ja';
import { zh } from './zh';

export type PptWorkspaceCopy = { [Key in keyof typeof en]: string };

export const getPptWorkspaceCopy = (language: Language): PptWorkspaceCopy =>
  language === 'zh' ? zh : language === 'ja' ? ja : en;
