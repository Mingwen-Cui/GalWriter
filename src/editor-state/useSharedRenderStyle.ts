import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { applyStylePatch, resolveAppearance, serializeAppearance } from '../components/render/shared/inspectors/styleState';
import type { RenderStyle } from '../components/render/video/shared/types';
import { DEFAULT_RENDER_STYLE } from '../components/render/video/VideoRenderModal/workspaceStorage';

const STORAGE_KEY = 'galwriter-common-appearance-v1';

export const useSharedRenderStyle = () => {
  const [sharedRenderStyle, setStyle] = useState<RenderStyle>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return resolveAppearance({ ...DEFAULT_RENDER_STYLE, ...saved });
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
