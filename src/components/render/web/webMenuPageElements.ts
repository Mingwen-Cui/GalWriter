import type { PlayerControlId } from './playerSettingsPanelConfig';
import { buttonMotionForPreset } from './webButtonMotion';
import type { Language } from '../../../lib/i18n';
import type { WebExportSettings, WebMenuElement } from '../video/shared/types';
import { webAppearance } from '../shared/paint/appearance';
import { SETTINGS_BACKGROUND_STYLE } from './webThemeVisuals';
import {
  buildRehearsalArchivePageElements,
  buildRehearsalSettingsPageElements,
  isPreviousRehearsalSettingsLayout,
  isPreviousRehearsalArchiveLayout,
} from './webExperienceTemplates';

export const buildArchivePageElements = (
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  return buildRehearsalArchivePageElements(language, choiceColor, choiceTextColor);
};

export const buildSettingsPageElements = (
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  return buildRehearsalSettingsPageElements(language, choiceColor, choiceTextColor);
};

export const resolveArchivePageElements = (settings: Partial<WebExportSettings>, language: Language, choiceColor: string, choiceTextColor: string) => {
  const defaults = buildArchivePageElements(language, choiceColor, choiceTextColor);
  if (isPreviousRehearsalArchiveLayout(settings.archivePageElements)) return defaults.map((fallback) => {
    const previous = settings.archivePageElements?.find((element) => element.id === fallback.id);
    return previous ? { ...fallback, visible: previous.visible, disabled: previous.disabled, text: previous.text, ...(previous.appearance ? { appearance: previous.appearance } : {}) } : fallback;
  });
  return settings.archivePageElements?.length ? settings.archivePageElements : defaults;
};

/** Resolve old grouped-page settings once; authored element arrays (including empty ones) are authoritative. */
const resolveSettingsPageElementsBeforeInteractionUpgrade = (
  settings: Partial<WebExportSettings>,
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  const defaults = buildSettingsPageElements(language, choiceColor, choiceTextColor);
  const upgradeBackground = (element: WebMenuElement): WebMenuElement => {
    if (element.id !== 'settings-background' || (element.settingsLayoutVersion || 0) >= 6) return element;
    const updated = { ...element, ...SETTINGS_BACKGROUND_STYLE, settingsLayoutVersion: 6 };
    // Layered paint takes precedence over legacy fields in both preview and export.
    if (element.appearance) updated.appearance = {
      ...element.appearance,
      fills: webAppearance({ ...updated, appearance: undefined }).fills.map((fill) => ({
        ...fill, id: element.appearance!.fills[0]?.id || fill.id,
      })),
    };
    return updated;
  };
  // Upgrade the previous built-in page once, preserving added objects and edited copy.
  // The revision travels with each element so subsequent canvas edits stay authoritative.
  const source = settings.settingsPageElements;
  if (source?.some((element) => element.id === 'settings-intro') &&
      source.some((element) => element.id === 'settings-reading-heading' && (element.settingsLayoutVersion || 0) < 4)) {
    const upgraded = source.flatMap((previous) => {
      if (previous.id === 'settings-panel') return [];
      const fallback = defaults.find((element) => element.id === previous.id);
      if (!fallback || (previous.settingsLayoutVersion || 0) >= 4) return [previous];
      const bareControl = fallback.kind === 'button' && !['back', 'reset'].includes(fallback.role || '');
      const oldAnimationLabels = ['动画速度', 'Animation speed', 'アニメーション速度'];
      return [{
        ...previous,
        settingsLayoutVersion: 5,
        borderRadius: fallback.borderRadius,
        borderTopLeftRadius: fallback.borderRadius, borderTopRightRadius: fallback.borderRadius,
        borderBottomLeftRadius: fallback.borderRadius, borderBottomRightRadius: fallback.borderRadius,
        x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height,
        text: previous.role === 'animationSpeed' && oldAnimationLabels.includes(previous.text) ? fallback.text : previous.text,
        ...(bareControl ? {
          fillEnabled: false, strokeEnabled: false, shadowEnabled: false, borderWidth: 0,
          backgroundType: 'solid' as const, backgroundColor: 'transparent', appearance: undefined,
        } : {}),
        ...(previous.role === 'reset' ? {
          fontSize: fallback.fontSize, textAlign: fallback.textAlign,
          textColor: fallback.textColor, backgroundType: fallback.backgroundType,
          backgroundColor: fallback.backgroundColor, backgroundGradientStart: fallback.backgroundGradientStart,
          backgroundGradientEnd: fallback.backgroundGradientEnd, borderWidth: fallback.borderWidth,
          borderColor: fallback.borderColor, borderRadius: fallback.borderRadius,
          shadowEnabled: fallback.shadowEnabled, shadowOpacity: fallback.shadowOpacity,
          shadowBlur: fallback.shadowBlur, shadowOffsetY: fallback.shadowOffsetY,
          appearance: undefined,
        } : {}),
      }];
    });
    if (!upgraded.some((element) => element.id === 'settings-background')) {
      const background = defaults.find((element) => element.id === 'settings-background')!;
      upgraded.unshift({ ...background, zIndex: Math.min(0, ...upgraded.map((element) => element.zIndex || 0)) - 1 });
    }
    return upgraded.map(upgradeBackground);
  }
  if (isPreviousRehearsalSettingsLayout(settings.settingsPageElements)) {
    return defaults.map((fallback) => {
      const previous = settings.settingsPageElements?.find((element) => element.id === fallback.id);
      if (!previous) return fallback;
      const oldLabels: Record<string, string[]> = {
        mode: ['文字呈现', 'Text display', '文字の表示'],
        speed: ['打字间隔', 'Typing interval', '文字の表示間隔'],
        auto: ['自动翻页', 'Auto advance', '自動ページ送り'],
        animationSpeed: ['动画速度', 'Animation speed', 'アニメーション速度'],
        controls: ['显示控制栏', 'Show toolbar', '操作バーを表示'],
        reset: ['恢复默认', 'Restore defaults', '初期設定に戻す'],
      };
      const oldSize = previous.role === 'title' ? 42 : previous.role === 'back' ? 14 : previous.role === 'reset' ? 13 : 15;
      return {
        ...previous,
        settingsLayoutVersion: 5,
        borderRadius: fallback.borderRadius,
        borderTopLeftRadius: fallback.borderRadius, borderTopRightRadius: fallback.borderRadius,
        borderBottomLeftRadius: fallback.borderRadius, borderBottomRightRadius: fallback.borderRadius,
        fillEnabled: fallback.fillEnabled, strokeEnabled: fallback.strokeEnabled,
        shadowEnabled: fallback.shadowEnabled, appearance: undefined,
        x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height,
        text: oldLabels[previous.role || '']?.includes(previous.text) ? fallback.text : previous.text,
        fontSize: previous.fontSize === oldSize ? fallback.fontSize : previous.fontSize,
        ...(previous.role === 'back' && previous.textColor === '#f8fafc' ? { textColor: fallback.textColor, backgroundColor: fallback.backgroundColor, borderColor: fallback.borderColor, textAlign: fallback.textAlign } : {}),
        ...(previous.borderColor === 'rgba(15,23,42,0.28)' ? { borderColor: fallback.borderColor } : {}),
        ...(previous.shadowOpacity === 12 ? { shadowOpacity: fallback.shadowOpacity, shadowBlur: fallback.shadowBlur, shadowOffsetY: fallback.shadowOffsetY } : {}),
      };
    });
  }
  // Restore inner button corners without moving the already-authored layout.
  if (source?.some((element) => element.settingsLayoutVersion === 4 ||
      (element.id === 'settings-background' && (element.settingsLayoutVersion || 0) < 6))) {
    return source.map((element) => {
      if (element.settingsLayoutVersion !== 4) return upgradeBackground(element);
      const roundedButton = element.kind === 'button' && ['back', 'reset'].includes(element.role || '');
      const radius = defaults.find((fallback) => fallback.role === element.role)?.borderRadius || 0;
      return upgradeBackground({
        ...element, settingsLayoutVersion: 5,
        ...(roundedButton ? {
          borderRadius: radius,
          borderTopLeftRadius: radius, borderTopRightRadius: radius,
          borderBottomLeftRadius: radius, borderBottomRightRadius: radius,
        } : {}),
      });
    });
  }
  if (settings.settingsPageElementsInitialized) return settings.settingsPageElements || [];
  const items = settings.settingsPageElements?.length ? settings.settingsPageElements : defaults;
  return items.flatMap((element) => {
    const role = element.role;
    const config = settings.playerSettingsPanel?.controls?.[role as PlayerControlId];
    if (config?.state === 'removed') return [];
    const fallback = defaults.find((item) => item.role === role);
    const legacyRow =
      element.kind === 'button' && element.x === 28 && element.width === 44 && element.height === 6;
    return [
      {
        ...element,
        ...(legacyRow && fallback
          ? { x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height }
          : {}),
        visible: config?.state ? config.state === 'visible' : element.visible,
        settingsControlForm:
          element.settingsControlForm || config?.form || fallback?.settingsControlForm,
      },
    ];
  });
};

/** Apply this revision once so later user edits remain authoritative. */
export const resolveSettingsPageElements = (
  settings: Partial<WebExportSettings>, language: Language, choiceColor: string, choiceTextColor: string,
): WebMenuElement[] => {
  const source = resolveSettingsPageElementsBeforeInteractionUpgrade(settings, language, choiceColor, choiceTextColor);
  const interactionUpgrade = source.map((element) => element.kind === 'button' && (element.settingsLayoutVersion || 0) < 7 && !['back', 'reset'].includes(element.role || '')
    ? { ...element, settingsLayoutVersion: 7, buttonMotion: buttonMotionForPreset('none'), ...(element.role === 'preview' ? {} : { width: 30 }) }
    : element);
  const defaults = buildSettingsPageElements(language, choiceColor, choiceTextColor);
  const isBuiltIn = source.some((element) => element.id === 'settings-intro') && source.some((element) => element.id === 'settings-reading-heading');
  if (!isBuiltIn || !source.some((element) => (element.settingsLayoutVersion || 0) < 8 && defaults.some((fallback) => fallback.id === element.id))) {
    return interactionUpgrade.every((element, index) => element === source[index]) ? source : interactionUpgrade;
  }
  const upgraded = interactionUpgrade.map((element) => {
    const fallback = defaults.find((item) => item.id === element.id);
    if (!fallback || (element.settingsLayoutVersion || 0) >= 8) return element;
    return { ...element, x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height, settingsLayoutVersion: 8,
      ...(element.id.endsWith('-heading') ? { text: fallback.text } : {}),
    };
  });
  const newIds = ['settings-effects-heading', 'settings-divider-0', 'settings-divider-1', 'settings-musicVolume', 'settings-voiceVolume'];
  const removed = new Set(settings.settingsPageRemovedElements?.map((element) => element.id) || []);
  defaults.forEach((element) => {
    if (newIds.includes(element.id) && !upgraded.some((item) => item.id === element.id) && !removed.has(element.id)) upgraded.push(element);
  });
  return upgraded;
};
