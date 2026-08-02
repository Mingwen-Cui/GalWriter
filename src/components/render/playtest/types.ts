import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';

import type { PlaytestWindowSettings } from '../../../domain/project';
import type { Language } from '../../../lib/i18n';
import type { SharedCanvasSettings } from '../canvas/canvasSettings';
import type { RenderStyle } from '../video/shared/types';

export type PlayTestDisplayMode = 'fullscreen' | 'windowed';

export interface PlayTestProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
  displayMode: PlayTestDisplayMode;
  onDisplayModeChange: (mode: PlayTestDisplayMode) => void;
  windowSettings: PlaytestWindowSettings;
  setWindowSettings: Dispatch<SetStateAction<PlaytestWindowSettings>>;
  selectedNodeId?: string | null;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isDarkMode: boolean;
  choicesColumns: number;
  setChoicesColumns: (val: number) => void;
  videoAutoPlay: boolean;
  setVideoAutoPlay: (val: boolean) => void;
  layoutMode: 'classic' | 'immersive';
  setLayoutMode: (val: 'classic' | 'immersive') => void;

  interactionMode: string;
  setInteractionMode: (val: string) => void;
  typewriterSpeed: number;
  setTypewriterSpeed: (val: number) => void;
  choiceDelay: number;
  setChoiceDelay: (val: number) => void;

  choicesPosition: 'center' | 'aboveText' | 'belowText';
  setChoicesPosition: (val: 'center' | 'aboveText' | 'belowText') => void;
  blurBackground: boolean;
  setBlurBackground: (val: boolean) => void;
  blurText: boolean;
  setBlurText: (val: boolean) => void;
  skipSingleChoicePopup: boolean;
  setSkipSingleChoicePopup: (val: boolean) => void;
  autoAdvance: boolean;
  setAutoAdvance: (val: boolean) => void;
  autoAdvanceDelay: number;
  setAutoAdvanceDelay: (val: number) => void;
  hideCharacterTags: boolean;
  setHideCharacterTags: (val: boolean) => void;
  hideSceneTags: boolean;
  setHideSceneTags: (val: boolean) => void;
  canvasSettings: SharedCanvasSettings;
  onCanvasSettingsChange: (patch: Partial<SharedCanvasSettings>) => void;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  isMobile?: boolean;
}
