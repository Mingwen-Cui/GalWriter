import { useEffect, useState } from 'react';

import type {
  PlaytestChoicesPosition,
  PlaytestLayoutMode,
  PlaytestSettingsState,
} from './editorConfig';

const getStoredBoolean = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback;
  const saved = window.localStorage.getItem(key);
  return saved === null ? fallback : saved === 'true';
};

const getStoredNumber = (key: string, fallback: number) => {
  if (typeof window === 'undefined') return fallback;
  const saved = window.localStorage.getItem(key);
  if (!saved) return fallback;
  const parsed = Number.parseInt(saved, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getStoredString = <T extends string>(key: string, fallback: T, allowed?: readonly T[]) => {
  if (typeof window === 'undefined') return fallback;
  const saved = window.localStorage.getItem(key);
  if (!saved) return fallback;
  if (allowed && !allowed.includes(saved as T)) return fallback;
  return saved as T;
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

  useEffect(() => {
    window.localStorage.setItem('playtest-dark-mode', String(playTestDarkMode));
    window.localStorage.setItem('playtest-columns', String(playTestChoicesColumns));
    window.localStorage.setItem('playtest-video-autoplay', String(playTestVideoAutoPlay));
    window.localStorage.setItem('playtest-layout-mode', playTestLayoutMode);
    window.localStorage.setItem('playtest-interaction-mode', playTestInteractionMode);
    window.localStorage.setItem('playtest-typewriter-speed', String(playTestTypewriterSpeed));
    window.localStorage.setItem('playtest-choice-delay', String(playTestChoiceDelay));
    window.localStorage.setItem('playtest-choices-position', playTestChoicesPosition);
    window.localStorage.setItem('playtest-blur-background', String(playTestBlurBackground));
    window.localStorage.setItem('playtest-blur-text', String(playTestBlurText));
    window.localStorage.setItem(
      'playtest-skip-single-choice-popup',
      String(playTestSkipSingleChoicePopup),
    );
    window.localStorage.setItem('playtest-dim-background', String(playTestDimBackground));
    window.localStorage.setItem('playtest-auto-advance', String(playTestAutoAdvance));
    window.localStorage.setItem('playtest-auto-advance-delay', String(playTestAutoAdvanceDelay));
    window.localStorage.setItem('playtest-hide-character-tags', String(playTestHideCharacterTags));
    window.localStorage.setItem('playtest-hide-scene-tags', String(playTestHideSceneTags));
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
  };
};
