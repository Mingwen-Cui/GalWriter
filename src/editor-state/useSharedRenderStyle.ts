import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { applyStylePatch, resolveAppearance, serializeAppearance } from '../components/render/shared/inspectors/styleState';
import type { RenderStyle } from '../components/render/video/shared/types';
import { DEFAULT_RENDER_STYLE } from '../components/render/video/VideoRenderModal/workspaceStorage';

const STORAGE_KEY = 'galwriter-common-appearance-v1';

const migrateLegacyNameplateStyle = (style: RenderStyle): RenderStyle => {
  const nameplate = style.renderObjects?.nameplate;
  const firstStop = nameplate?.fill?.gradientStops?.[0];
  const lastStop = nameplate?.fill?.gradientStops?.[nameplate.fill.gradientStops.length - 1];
  const isLegacyDefault =
    nameplate?.fill?.color === '#172554' &&
    firstStop?.color === '#1e3a8a' &&
    lastStop?.color === '#0f172a';
  if (!isLegacyDefault) return style;

  return {
    ...style,
    nameplateRadius: 12,
    nameplateColor: '#202735',
    nameplateColorAlpha: 96,
    nameplateGradientStops: [
      { id: 'start', color: '#3a4658', alpha: 98, position: 0 },
      { id: 'end', color: '#1c2330', alpha: 98, position: 100 },
    ],
    renderObjects: {
      ...style.renderObjects,
      nameplate: {
        ...nameplate,
        width: 108,
        height: 38,
        radius: 12,
        fill: {
          ...nameplate.fill,
          color: '#202735',
          alpha: 98,
          gradientStops: [
            { id: 'start', color: '#3a4658', alpha: 100, position: 0 },
            { id: 'end', color: '#1c2330', alpha: 100, position: 100 },
          ],
        },
        stroke: {
          ...nameplate.stroke,
          enabled: true,
          color: '#d6dee8',
          alpha: 24,
          width: 1,
        },
        shadow: {
          ...nameplate.shadow,
          enabled: true,
          x: 0,
          y: 8,
          blur: 24,
          alpha: 30,
        },
      },
    },
  };
};

export const useSharedRenderStyle = () => {
  const [sharedRenderStyle, setStyle] = useState<RenderStyle>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return migrateLegacyNameplateStyle(resolveAppearance({ ...DEFAULT_RENDER_STYLE, ...saved }));
    } catch { return resolveAppearance(DEFAULT_RENDER_STYLE); }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeAppearance(sharedRenderStyle))); }
    catch { /* The in-memory appearance remains editable if storage is unavailable. */ }
  }, [sharedRenderStyle]);
  const setSharedRenderStyle: Dispatch<SetStateAction<RenderStyle>> = useCallback((next) => {
    setStyle(previous => resolveAppearance(typeof next === 'function' ? next(previous) : next));
  }, []);
  const updateSharedRenderStyle = useCallback(<K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => {
    setStyle(previous => applyStylePatch(previous, key, value));
  }, []);
  return { sharedRenderStyle, setSharedRenderStyle, updateSharedRenderStyle };
};
