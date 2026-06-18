import { useEffect, useState } from 'react';

import type { RenderStyle } from '../components/render/video/shared/types';
import { DEFAULT_RENDER_STYLE } from '../components/render/video/VideoRenderModal/workspaceStorage';

const STORAGE_KEY = 'galwriter-shared-render-style';

const readStoredRenderStyle = (): Partial<RenderStyle> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
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
    setSharedRenderStyle((previous) => ({ ...previous, [key]: value }));
  };

  return {
    sharedRenderStyle,
    setSharedRenderStyle,
    updateSharedRenderStyle,
  };
};
