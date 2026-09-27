import { useEffect, useState } from 'react';

import type {
  PlaytestChoicesPosition,
  PlaytestLayoutMode,
  PlaytestSettingsState,
  PlaytestWindowSettings,
} from './editorConfig';

const PLAYTEST_SETTINGS_STORAGE_KEY = 'playtest-settings:v1';
const LEGACY_PLAYTEST_SETTING_KEYS = [
  'playtest-dark-mode',
  'playtest-columns',
  'playtest-video-autoplay',
  'playtest-layout-mode',
  'playtest-interaction-mode',
  'playtest-typewriter-speed',
  'playtest-choice-delay',
  'playtest-choices-position',
  'playtest-blur-background',
  'playtest-blur-text',
  'playtest-skip-single-choice-popup',
  'playtest-dim-background',
  'playtest-auto-advance',
  'playtest-auto-advance-delay',
  'playtest-hide-character-tags',
  'playtest-hide-scene-tags',
] as const;

const getStoredValue = (key: string) => {
  if (typeof window === 'undefined') return null;

  try {
    const storedSettings = JSON.parse(
      window.localStorage.getItem(PLAYTEST_SETTINGS_STORAGE_KEY) || '{}',
    ) as Record<string, unknown>;
    const storedValue = storedSettings[key];
    if (typeof storedValue === 'string') return storedValue;
  } catch {
    // Ignore an invalid consolidated value and fall back to the legacy key.
  }

  return window.localStorage.getItem(key);
};

const getStoredBoolean = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback;
  const saved = getStoredValue(key);
  return saved === null ? fallback : saved === 'true';
};

const getStoredNumber = (key: string, fallback: number) => {
  if (typeof window === 'undefined') return fallback;
  const saved = getStoredValue(key);
  if (!saved) return fallback;
  const parsed = Number.parseInt(saved, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getStoredString = <T extends string>(key: string, fallback: T, allowed?: readonly T[]) => {
  if (typeof window === 'undefined') return fallback;
  const saved = getStoredValue(key);
  if (!saved) return fallback;
  if (allowed && !allowed.includes(saved as T)) return fallback;
  return saved as T;
};

const getStoredWindowSettings = (): PlaytestWindowSettings => {
  const fallback: PlaytestWindowSettings = {
    bounds: null,
    mobileBounds: null,
    followSelectedCard: false,
    autoScaleOnHover: false,
    autoExpandOnPlaylistJump: false,
    autoPlayOnPlaylistJump: false,
    showCurrentBranchOnly: false,
  };
  if (typeof window === 'undefined') return fallback;

  try {
    const legacyBounds = JSON.parse(
      window.localStorage.getItem('galwriter-playtest-window-bounds:v1') || 'null',
    ) as PlaytestWindowSettings['bounds'];
    const bounds =
      legacyBounds &&
      Number.isFinite(legacyBounds.x) &&
      Number.isFinite(legacyBounds.y) &&
      Number.isFinite(legacyBounds.width) &&
      Number.isFinite(legacyBounds.height) &&
      legacyBounds.width > 0 &&
      legacyBounds.height > 0
        ? legacyBounds
        : null;

    return {
      bounds,
      mobileBounds: null,
      followSelectedCard: false,
      autoScaleOnHover: false,
      autoExpandOnPlaylistJump: false,
      autoPlayOnPlaylistJump: false,
      showCurrentBranchOnly: false,
    };
  } catch {
    return fallback;
  }
};

export const usePlaytestSettings = (): PlaytestSettingsState => {
  const [playTestDarkMode, setPlayTestDarkMode] = useState(() =>
    getStoredBoolean(
      'playtest-dark-mode',
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
    ),
  );
  const [playTestChoicesColumns, setPlayTestChoicesColumns] = useState(() =>
    getStoredNumber('playtest-columns', 1),
  );
  const [playTestVideoAutoPlay, setPlayTestVideoAutoPlay] = useState(() =>
    getStoredBoolean('playtest-video-autoplay', true),
  );
  const [playTestLayoutMode, setPlayTestLayoutMode] = useState<PlaytestLayoutMode>(() =>
    getStoredString('playtest-layout-mode', 'classic', ['classic', 'immersive']),
  );
  const [playTestInteractionMode, setPlayTestInteractionMode] = useState(() =>
    getStoredString('playtest-interaction-mode', 'immediate'),
  );
  const [playTestTypewriterSpeed, setPlayTestTypewriterSpeed] = useState(() =>
    getStoredNumber('playtest-typewriter-speed', 30),
  );
  const [playTestChoiceDelay, setPlayTestChoiceDelay] = useState(() =>
    getStoredNumber('playtest-choice-delay', 2),
  );
  const [playTestChoicesPosition, setPlayTestChoicesPosition] = useState<PlaytestChoicesPosition>(
    () =>
      getStoredString('playtest-choices-position', 'belowText', [
        'center',
        'aboveText',
        'belowText',
      ]),
  );
  const [playTestBlurBackground, setPlayTestBlurBackground] = useState(() =>
    getStoredBoolean('playtest-blur-background', true),
  );
  const [playTestBlurText, setPlayTestBlurText] = useState(() =>
    getStoredBoolean('playtest-blur-text', false),
  );
  const [playTestSkipSingleChoicePopup, setPlayTestSkipSingleChoicePopup] = useState(() =>
    getStoredBoolean('playtest-skip-single-choice-popup', true),
  );
  const [playTestDimBackground, setPlayTestDimBackground] = useState(() =>
    getStoredBoolean('playtest-dim-background', true),
  );
  const [playTestAutoAdvance, setPlayTestAutoAdvance] = useState(() =>
    getStoredBoolean('playtest-auto-advance', false),
  );
  const [playTestAutoAdvanceDelay, setPlayTestAutoAdvanceDelay] = useState(() =>
    getStoredNumber('playtest-auto-advance-delay', 2),
  );
  const [playTestHideCharacterTags, setPlayTestHideCharacterTags] = useState(() =>
    getStoredBoolean('playtest-hide-character-tags', true),
  );
  const [playTestHideSceneTags, setPlayTestHideSceneTags] = useState(() =>
    getStoredBoolean('playtest-hide-scene-tags', true),
  );
  const [playTestWindowSettings, setPlayTestWindowSettings] = useState(getStoredWindowSettings);

  useEffect(() => {
    const serializedSettings = JSON.stringify({
      'playtest-dark-mode': String(playTestDarkMode),
      'playtest-columns': String(playTestChoicesColumns),
      'playtest-video-autoplay': String(playTestVideoAutoPlay),
      'playtest-layout-mode': playTestLayoutMode,
      'playtest-interaction-mode': playTestInteractionMode,
      'playtest-typewriter-speed': String(playTestTypewriterSpeed),
      'playtest-choice-delay': String(playTestChoiceDelay),
      'playtest-choices-position': playTestChoicesPosition,
      'playtest-blur-background': String(playTestBlurBackground),
      'playtest-blur-text': String(playTestBlurText),
      'playtest-skip-single-choice-popup': String(playTestSkipSingleChoicePopup),
      'playtest-dim-background': String(playTestDimBackground),
      'playtest-auto-advance': String(playTestAutoAdvance),
      'playtest-auto-advance-delay': String(playTestAutoAdvanceDelay),
      'playtest-hide-character-tags': String(playTestHideCharacterTags),
      'playtest-hide-scene-tags': String(playTestHideSceneTags),
    });

    const storage = window.localStorage;
    let didPersist = false;
    try {
      storage.setItem(PLAYTEST_SETTINGS_STORAGE_KEY, serializedSettings);
      didPersist = true;
    } catch {
      // Older versions stored every value under a separate key. Free those
      // duplicate bytes and retry before giving up on persistence.
      const legacyValues = LEGACY_PLAYTEST_SETTING_KEYS.map(
        (key) => [key, storage.getItem(key)] as const,
      );
      LEGACY_PLAYTEST_SETTING_KEYS.forEach((key) => storage.removeItem(key));

      try {
        storage.setItem(PLAYTEST_SETTINGS_STORAGE_KEY, serializedSettings);
        didPersist = true;
      } catch {
        // Keep the app usable even when the browser's storage quota is full.
        legacyValues.forEach(([key, value]) => {
          if (value === null) return;
          try {
            storage.setItem(key, value);
          } catch {
            // Best-effort restoration; quota errors must not break rendering.
          }
        });
      }
    }

    if (didPersist) {
      LEGACY_PLAYTEST_SETTING_KEYS.forEach((key) => storage.removeItem(key));
    }
  }, [
    playTestAutoAdvance,
    playTestAutoAdvanceDelay,
    playTestHideCharacterTags,
    playTestHideSceneTags,
    playTestBlurBackground,
    playTestBlurText,
    playTestChoiceDelay,
    playTestChoicesColumns,
    playTestChoicesPosition,
    playTestDarkMode,
    playTestDimBackground,
    playTestInteractionMode,
    playTestLayoutMode,
    playTestSkipSingleChoicePopup,
    playTestTypewriterSpeed,
    playTestVideoAutoPlay,
  ]);

  return {
    playTestDarkMode,
    setPlayTestDarkMode,
    playTestChoicesColumns,
    setPlayTestChoicesColumns,
    playTestVideoAutoPlay,
    setPlayTestVideoAutoPlay,
    playTestLayoutMode,
    setPlayTestLayoutMode,
    playTestInteractionMode,
    setPlayTestInteractionMode,
    playTestTypewriterSpeed,
    setPlayTestTypewriterSpeed,
    playTestChoiceDelay,
    setPlayTestChoiceDelay,
    playTestChoicesPosition,
    setPlayTestChoicesPosition,
    playTestBlurBackground,
    setPlayTestBlurBackground,
    playTestBlurText,
    setPlayTestBlurText,
    playTestSkipSingleChoicePopup,
    setPlayTestSkipSingleChoicePopup,
    playTestDimBackground,
    setPlayTestDimBackground,
    playTestAutoAdvance,
    setPlayTestAutoAdvance,
    playTestAutoAdvanceDelay,
    setPlayTestAutoAdvanceDelay,
    playTestHideCharacterTags,
    setPlayTestHideCharacterTags,
    playTestHideSceneTags,
    setPlayTestHideSceneTags,
    playTestWindowSettings,
    setPlayTestWindowSettings,
  };
};
