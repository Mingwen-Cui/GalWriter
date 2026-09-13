import { applyStylePatch } from '../components/render/shared/inspectors/styleState';
import { useEffect, useState } from 'react';

import type { RenderStyle } from '../components/render/video/shared/types';
import { DEFAULT_RENDER_STYLE } from '../components/render/video/VideoRenderModal/workspaceStorage';

const STORAGE_KEY = 'galwriter-shared-render-style';
const LEGACY_DEFAULT_FONT = '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif';
const LEGACY_NAMEPLATE_COLOR = '#4f46e5';
const LEGACY_NAMEPLATE_ALPHA = 86;

const normalizeLegacyNameplatePalette = (stored: Partial<RenderStyle>): Partial<RenderStyle> => {
  if (
    stored.nameplateColor !== LEGACY_NAMEPLATE_COLOR ||
    stored.nameplateColorAlpha !== LEGACY_NAMEPLATE_ALPHA
  )
    return stored;

  const nameplate = stored.renderObjects?.nameplate;
  const legacyObjectFill =
    !nameplate?.fill ||
    (nameplate.fill.color === LEGACY_NAMEPLATE_COLOR &&
      nameplate.fill.alpha === LEGACY_NAMEPLATE_ALPHA);
  return {
    ...stored,
    nameplateColor: DEFAULT_RENDER_STYLE.nameplateColor,
    nameplateColorAlpha: DEFAULT_RENDER_STYLE.nameplateColorAlpha,
    nameplateGradientStops: DEFAULT_RENDER_STYLE.nameplateGradientStops,
    renderObjects: legacyObjectFill
      ? {
          ...stored.renderObjects,
          nameplate: {
            ...nameplate,
            fill: {
              ...nameplate?.fill,
              color: DEFAULT_RENDER_STYLE.nameplateColor,
              alpha: DEFAULT_RENDER_STYLE.nameplateColorAlpha,
              gradientStops: DEFAULT_RENDER_STYLE.nameplateGradientStops,
            },
          },
        }
      : stored.renderObjects,
  };
};

const readStoredRenderStyle = (): Partial<RenderStyle> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const stored = parsed as Partial<RenderStyle>;
    return normalizeLegacyNameplatePalette({
      ...stored,
      titleFontSize: stored.titleFontSize === 56 ? DEFAULT_RENDER_STYLE.titleFontSize : stored.titleFontSize,
      bodyFontSize: stored.bodyFontSize === 38 ? DEFAULT_RENDER_STYLE.bodyFontSize : stored.bodyFontSize,
      titleFontFamily:
        stored.titleFontFamily === LEGACY_DEFAULT_FONT
          ? DEFAULT_RENDER_STYLE.titleFontFamily
          : stored.titleFontFamily,
      bodyFontFamily:
        stored.bodyFontFamily === LEGACY_DEFAULT_FONT
          ? DEFAULT_RENDER_STYLE.bodyFontFamily
          : stored.bodyFontFamily,
    });
  } catch {
    return {};
  }
};

export const useSharedRenderStyle = () => {
  const [sharedRenderStyle, setSharedRenderStyle] = useState<RenderStyle>(() => ({
    ...DEFAULT_RENDER_STYLE,
    ...readStoredRenderStyle(),
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedRenderStyle));
    } catch {
      // Ignore storage failures; the current project state still holds the style in memory.
    }
  }, [sharedRenderStyle]);

  const updateSharedRenderStyle = <K extends keyof RenderStyle>(
    key: K,
    value: RenderStyle[K],
  ) => {
    setSharedRenderStyle((previous) => applyStylePatch(previous, key, value));
  };

  return {
    sharedRenderStyle,
    setSharedRenderStyle,
    updateSharedRenderStyle,
  };
};
