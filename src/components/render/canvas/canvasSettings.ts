import { useSyncExternalStore } from 'react';

import type { WebExportSettings } from '../video/shared/types';

export type SharedCanvasSettings = Pick<
  WebExportSettings,
  | 'canvasWidth'
  | 'canvasHeight'
  | 'canvasRatioWidth'
  | 'canvasRatioHeight'
  | 'canvasRatioLocked'
  | 'layoutMode'
  | 'choicesPosition'
  | 'skipSingleChoicePopup'
  | 'autoAdvance'
  | 'videoAutoPlay'
  | 'hideCharacterTags'
  | 'hideSceneTags'
>;

export const DEFAULT_SHARED_CANVAS_SETTINGS: SharedCanvasSettings = {
  canvasWidth: 1920,
  canvasHeight: 1080,
  canvasRatioWidth: 16,
  canvasRatioHeight: 9,
  canvasRatioLocked: true,
  layoutMode: 'immersive',
  choicesPosition: 'center',
  skipSingleChoicePopup: true,
  autoAdvance: false,
  videoAutoPlay: false,
  hideCharacterTags: true,
  hideSceneTags: true,
};

const listeners = new Map<string, Set<() => void>>();
const snapshots = new Map<string, SharedCanvasSettings>();
const storageKey = (workspaceKey: string) => `galwriter-canvas-settings:v1:${workspaceKey}`;

const clampInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function normalizeSharedCanvasSettings(
  value?: Partial<SharedCanvasSettings>,
): SharedCanvasSettings {
  return {
    ...DEFAULT_SHARED_CANVAS_SETTINGS,
    ...value,
    canvasWidth: clampInteger(value?.canvasWidth, 1920, 320, 7680),
    canvasHeight: clampInteger(value?.canvasHeight, 1080, 180, 4320),
    canvasRatioWidth: clampInteger(value?.canvasRatioWidth, 16, 1, 100),
    canvasRatioHeight: clampInteger(value?.canvasRatioHeight, 9, 1, 100),
    canvasRatioLocked: value?.canvasRatioLocked !== false,
    layoutMode: value?.layoutMode === 'classic' ? 'classic' : 'immersive',
    choicesPosition:
      value?.choicesPosition === 'aboveText' || value?.choicesPosition === 'belowText'
        ? value.choicesPosition
        : 'center',
    skipSingleChoicePopup: value?.skipSingleChoicePopup !== false,
    autoAdvance: value?.autoAdvance === true,
    videoAutoPlay: value?.videoAutoPlay === true,
    hideCharacterTags: value?.hideCharacterTags !== false,
    hideSceneTags: value?.hideSceneTags !== false,
  };
}

function readSnapshot(workspaceKey: string, initial?: Partial<SharedCanvasSettings>) {
  const cached = snapshots.get(workspaceKey);
  if (cached) return cached;
  let stored: Partial<SharedCanvasSettings> | undefined;
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceKey));
    if (raw) stored = JSON.parse(raw) as Partial<SharedCanvasSettings>;
  } catch {
    // Storage is optional; the in-memory snapshot still keeps both open surfaces in sync.
  }
  const snapshot = normalizeSharedCanvasSettings(stored || initial);
  snapshots.set(workspaceKey, snapshot);
  return snapshot;
}

export function updateSharedCanvasSettings(
  workspaceKey: string,
  patch: Partial<SharedCanvasSettings>,
) {
  const next = normalizeSharedCanvasSettings({ ...readSnapshot(workspaceKey), ...patch });
  snapshots.set(workspaceKey, next);
  try {
    window.localStorage.setItem(storageKey(workspaceKey), JSON.stringify(next));
  } catch {
    // Keep working in memory when storage is unavailable or full.
  }
  listeners.get(workspaceKey)?.forEach((listener) => listener());
}

export function useSharedCanvasSettings(
  workspaceKey: string,
  initial?: Partial<SharedCanvasSettings>,
) {
  const settings = useSyncExternalStore(
    (listener) => {
      const workspaceListeners = listeners.get(workspaceKey) || new Set<() => void>();
      workspaceListeners.add(listener);
      listeners.set(workspaceKey, workspaceListeners);
      return () => workspaceListeners.delete(listener);
    },
    () => readSnapshot(workspaceKey, initial),
    () => normalizeSharedCanvasSettings(initial),
  );
  return {
    settings,
    update: (patch: Partial<SharedCanvasSettings>) =>
      updateSharedCanvasSettings(workspaceKey, patch),
  };
}

export function canvasPatchFromWebSettings(
  settings: Partial<WebExportSettings>,
): Partial<SharedCanvasSettings> {
  const keys: Array<keyof SharedCanvasSettings> = [
    'canvasWidth',
    'canvasHeight',
    'canvasRatioWidth',
    'canvasRatioHeight',
    'canvasRatioLocked',
    'layoutMode',
    'choicesPosition',
    'skipSingleChoicePopup',
    'autoAdvance',
    'videoAutoPlay',
    'hideCharacterTags',
    'hideSceneTags',
  ];
  return Object.fromEntries(
    keys.filter((key) => settings[key] !== undefined).map((key) => [key, settings[key]]),
  ) as Partial<SharedCanvasSettings>;
}
