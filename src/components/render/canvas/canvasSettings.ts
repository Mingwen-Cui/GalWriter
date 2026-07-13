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
  | 'sceneFit'
  | 'sceneScale'
  | 'sceneScaleX'
  | 'sceneScaleY'
  | 'sceneOffsetX'
  | 'sceneOffsetY'
  | 'sceneBackgroundVisible'
  | 'sceneBackgroundType'
  | 'sceneBackgroundColor'
  | 'sceneBackgroundGradientStart'
  | 'sceneBackgroundGradientEnd'
  | 'sceneBackgroundGradientAngle'
  | 'sceneBackgroundImageUrl'
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
  sceneFit: 'cover',
  sceneScale: 50,
  sceneScaleX: 50,
  sceneScaleY: 50,
  sceneOffsetX: 0,
  sceneOffsetY: -20,
  sceneBackgroundVisible: true,
  sceneBackgroundType: 'solid',
  sceneBackgroundColor: '#020617',
  sceneBackgroundGradientStart: '#020617',
  sceneBackgroundGradientEnd: '#0f172a',
  sceneBackgroundGradientAngle: 135,
  sceneBackgroundImageUrl: '',
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
    sceneFit:
      value?.sceneFit === 'contain' || value?.sceneFit === 'stretch'
        ? value.sceneFit
        : 'cover',
    sceneScale: clampInteger(value?.sceneScale, 50, 25, 400),
    sceneScaleX: clampInteger(value?.sceneScaleX ?? value?.sceneScale, 50, 25, 400),
    sceneScaleY: clampInteger(value?.sceneScaleY ?? value?.sceneScale, 50, 25, 400),
    sceneOffsetX: clampInteger(value?.sceneOffsetX, 0, -100, 100),
    sceneOffsetY: clampInteger(value?.sceneOffsetY, -20, -100, 100),
    sceneBackgroundVisible: value?.sceneBackgroundVisible !== false,
    sceneBackgroundType:
      value?.sceneBackgroundType === 'gradient' || value?.sceneBackgroundType === 'image'
        ? value.sceneBackgroundType
        : 'solid',
    sceneBackgroundColor: value?.sceneBackgroundColor || '#020617',
    sceneBackgroundGradientStart: value?.sceneBackgroundGradientStart || '#020617',
    sceneBackgroundGradientEnd: value?.sceneBackgroundGradientEnd || '#0f172a',
    sceneBackgroundGradientAngle: clampInteger(value?.sceneBackgroundGradientAngle, 135, 0, 360),
    sceneBackgroundImageUrl: value?.sceneBackgroundImageUrl || '',
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
    'sceneFit',
    'sceneScale',
    'sceneScaleX',
    'sceneScaleY',
    'sceneOffsetX',
    'sceneOffsetY',
    'sceneBackgroundVisible',
    'sceneBackgroundType',
    'sceneBackgroundColor',
    'sceneBackgroundGradientStart',
    'sceneBackgroundGradientEnd',
    'sceneBackgroundGradientAngle',
    'sceneBackgroundImageUrl',
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
