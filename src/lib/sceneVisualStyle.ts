import type { CSSProperties } from 'react';

import type { SceneVisualStyle } from '../domain/project';
import {
  getScenePresetAssetUrl,
  getSceneVisualTemplate,
  normalizeSceneVisualStyle,
} from './sceneTemplates';

/**
 * Background-only visual treatment. Lighting is no longer a CSS filter on the
 * scene media — it is a full-frame overlay drawn above characters.
 */
export const getSceneVisualFilter = (style: SceneVisualStyle | undefined) => {
  if (!style) return 'none';
  const normalized = normalizeSceneVisualStyle(style);
  return normalized.backgroundBlur > 0 ? `blur(${normalized.backgroundBlur}px)` : 'none';
};

export const getSceneVisualMediaStyle = (
  style: SceneVisualStyle | undefined,
): Pick<CSSProperties, 'filter' | 'transform'> => {
  if (!style) return { filter: 'none', transform: '' };
  const normalized = normalizeSceneVisualStyle(style);
  return {
    filter: getSceneVisualFilter(normalized),
    // A tiny overscan prevents blurred image edges from showing around the stage.
    transform: normalized.backgroundBlur > 0 ? `scale(${1 + Math.min(0.06, normalized.backgroundBlur / 100)})` : '',
  };
};

/** Resolve the lighting overlay image URL for a scene visual style. */
export const resolveSceneLightOverlayUrl = (
  style: SceneVisualStyle | undefined,
  enabled = true,
): string | undefined => {
  if (!enabled || !style) return undefined;
  if (style.lightOverlayAssetPath) {
    return getScenePresetAssetUrl(style.lightOverlayAssetPath);
  }
  const template = getSceneVisualTemplate(style.templateId);
  return template?.previewUrl || undefined;
};

/** Soft-light overlay opacity derived from the shared intensity slider. */
export const getSceneLightOverlayOpacity = (style: SceneVisualStyle | undefined) => {
  const intensity = normalizeSceneVisualStyle(style).intensity;
  return Math.max(0.2, Math.min(1, intensity / 100));
};

export const getSceneLightOverlayDomStyle = (
  style: SceneVisualStyle | undefined,
): CSSProperties => ({
  mixBlendMode: 'soft-light',
  opacity: getSceneLightOverlayOpacity(style),
});
