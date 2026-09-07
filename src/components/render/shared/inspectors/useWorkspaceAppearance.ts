import { useState } from 'react';
import type { RenderStyle, RenderWorkspaceMode } from '../../video/shared/types';
import { applyStylePatch } from './styleState';

export type WorkspaceAppearanceOverrides = Partial<Record<RenderWorkspaceMode, RenderStyle>>;
export function useWorkspaceAppearance(
  shared: RenderStyle,
  updateShared: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void,
  initial?: WorkspaceAppearanceOverrides,
) {
  const [overrides, setOverrides] = useState<WorkspaceAppearanceOverrides>(() => initial || {});
  const resolve = (mode: RenderWorkspaceMode) => overrides[mode] || shared;
  const update = <K extends keyof RenderStyle>(
    mode: RenderWorkspaceMode,
    key: K,
    value: RenderStyle[K],
  ) => {
    if (!overrides[mode]) updateShared(key, value);
    else
      setOverrides((previous) => ({
        ...previous,
        [mode]: applyStylePatch(previous[mode] || shared, key, value),
      }));
  };
  const setIndependent = (mode: RenderWorkspaceMode, independent: boolean) =>
    setOverrides((previous) => {
      if (independent) return { ...previous, [mode]: structuredClone(previous[mode] || shared) };
      const next = { ...previous };
      delete next[mode];
      return next;
    });
  return { overrides, resolve, update, setIndependent };
}
