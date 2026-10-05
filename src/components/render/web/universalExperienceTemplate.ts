import defaultMainInterfaceBackgroundUrl from '../../../assets/common/default-main-interface-background.jpg';
import type { Language } from '../../../lib/i18n';
import { themeMenuPatch, themeRenderPatch } from '../experienceThemes';
import { getPptCoverDescription, getPptCoverSubtitle, getPptCoverTitle } from '../ppt/pptCoverTemplate';
import { DEFAULT_RENDER_STYLE } from '../video/VideoRenderModal/workspaceStorage';
import type { WebMenuElement } from '../video/shared/types';
import { buildRehearsalTemplate, type WebExperienceTemplate } from './webExperienceTemplates';

/** The bundled default and the selectable Web preset share the same design. */
export const buildUniversalWebTemplate = (language: Language, title: string): WebExperienceTemplate => {
  const base = buildRehearsalTemplate(language, title);
  const menu = themeMenuPatch('universal', language);
  const accent = '#625bf6';
  const slots: Partial<Record<NonNullable<WebMenuElement['role']>, [number, number, number, number]>> = {
    title: [9, 28, 34, 22], subtitle: [9, 51, 33, 11],
    new: [9, 65, 30, 7], continue: [9, 74, 14, 6], save: [25, 74, 14, 6],
    flowOverview: [9, 82, 14, 6], settings: [25, 82, 14, 6],
  };
  const elements = (base.settings.startMenuElements || []).map((element): WebMenuElement => {
    const frame = element.role ? slots[element.role] : undefined;
    const geometry = frame ? { x: frame[0], y: frame[1], width: frame[2], height: frame[3] } : {};
    if (element.role === 'title') return {
      ...element, ...geometry, text: getPptCoverTitle(title, '', language),
      fontSize: 84, fontWeight: 800, textColor: '#252a49', lineHeight: 1.15,
      shadowEnabled: false, shadowOpacity: 0,
    };
    if (element.role === 'subtitle') return {
      ...element, ...geometry, text: getPptCoverDescription(language),
      fontSize: 30, fontWeight: 400, textColor: '#5f6684', lineHeight: 1.6,
      shadowEnabled: false, shadowOpacity: 0,
    };
    const primary = element.role === 'new';
    return {
      ...element, ...geometry, primary,
      fontSize: primary ? 24 : 20, textColor: primary ? '#ffffff' : '#252a49',
      backgroundType: 'solid', backgroundColor: primary ? accent : '#ffffff',
      backgroundGradientStops: undefined, appearance: undefined,
      borderColor: primary ? accent : '#dce1ee', borderWidth: 1,
      borderRadius: 16, shadowEnabled: true, shadowOpacity: primary ? 8 : 3,
      shadowBlur: primary ? 14 : 8, shadowOffsetX: 0, shadowOffsetY: primary ? 3 : 2,
    };
  });
  const shape = (id: string, x: number, y: number, width: number, height: number, color: string): WebMenuElement => ({
    id, kind: 'shape', shapeType: 'rectangle', role: 'custom', text: '', visible: true,
    x, y, width, height, scale: 1, rotation: 0, backgroundType: 'solid',
    backgroundColor: color, fillEnabled: true, strokeEnabled: false, shadowEnabled: false,
    borderRadius: 0,
  });
  return {
    ...base, id: 'universal', name: language === 'zh' ? '通用封面' : language === 'ja' ? '汎用カバー' : 'Universal cover',
    choiceColor: accent, choiceTextColor: '#ffffff',
    renderStyle: themeRenderPatch('universal', DEFAULT_RENDER_STYLE),
    settings: {
      ...base.settings, ...menu,
      startMenuBackgroundType: 'image', startMenuBackgroundColor: '#ffffff',
      startMenuBackgroundImageUrl: defaultMainInterfaceBackgroundUrl,
      startMenuBackgroundVideoUrl: '', blurBackground: false,
      startMenuElements: [
        shape('universal-accent', 9, 25.8, 3.34, 0.56, accent),
        shape('universal-divider', 9, 90, 30, 0.18, '#dce1ee'),
        ...elements,
        {
          id: 'universal-brand', kind: 'text', role: 'custom', visible: true,
          text: getPptCoverSubtitle(language), x: 9, y: 92, width: 34, height: 4,
          scale: 1, rotation: 0, fontSize: 20, fontWeight: 400, textColor: '#777c97',
          textAlign: 'left',
        },
      ],
    },
  };
};
