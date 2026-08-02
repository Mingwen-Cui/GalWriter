import type { Language } from '../../../../lib/i18n';

import { webSettingsCopy as en } from './en';
import { webSettingsCopy as ja } from './ja';
import { webSettingsCopy as zh } from './zh';

export const getWebSettingsCopy = (language: Language) =>
  language === 'ja' ? ja : language === 'en' ? en : zh;
