import type { RenderStyle } from '../../video/shared/types';

export type WebExportOptions = {
  projectName?: string;
  language: 'zh' | 'ja' | 'en';
  style?: WebExportStyle;
  settings?: WebExportSettings;
};

export type WebExportStyle = Partial<RenderStyle> & {
  choiceColor: string;
  choiceTextColor: string;
};

export type WebExportSettings = {
  layoutMode: 'classic' | 'immersive';
  choicesPosition: 'center' | 'aboveText' | 'belowText';
  showStartMenu: boolean;
  startMenuTemplate: 'cinematic' | 'minimal' | 'glass';
  startMenuBackgroundType: 'solid' | 'gradient' | 'image';
  startMenuBackgroundColor: string;
  startMenuBackgroundGradientStart: string;
  startMenuBackgroundGradientEnd: string;
  startMenuBackgroundGradientAngle: number;
  startMenuBackgroundImageUrl: string;
  startMenuBackgroundMusicUrl: string;
  startMenuButtonPosition: 'center' | 'bottomLeft' | 'bottomRight';
  startMenuButtonLayout: 'vertical' | 'horizontal';
  startMenuButtonSize: 'compact' | 'normal' | 'large';
  startMenuElements: Array<{
    id: string;
    kind: 'button' | 'text' | 'image';
    role?: 'save' | 'new' | 'settings' | 'title' | 'subtitle' | 'custom';
    text: string;
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
    rotation: number;
    primary?: boolean;
    disabled?: boolean;
    fontSize?: number;
    textColor?: string;
    backgroundType?: 'solid' | 'gradient' | 'image';
    backgroundColor?: string;
    backgroundGradientStart?: string;
    backgroundGradientEnd?: string;
    backgroundGradientAngle?: number;
    backgroundImageUrl?: string;
    borderColor?: string;
    borderRadius?: number;
    imageUrl?: string;
  }>;
  startMenuPlacementBoundsLocked: boolean;
  startMenuPlacementMinX: number;
  startMenuPlacementMinY: number;
  startMenuPlacementMaxX: number;
  startMenuPlacementMaxY: number;
  startMenuShowSave: boolean;
  startMenuShowNewGame: boolean;
  startMenuShowSettings: boolean;
  blurBackground: boolean;
  skipSingleChoicePopup: boolean;
  interactionMode: 'immediate' | 'typewriter';
  typewriterSpeed: number;
  autoAdvance: boolean;
  videoAutoPlay: boolean;
  hideCharacterTags: boolean;
  hideSceneTags: boolean;
};

export type WebExportNode = {
  id: string;
  type?: string;
  data: {
    title?: string;
    text?: string;
    color?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    rawText?: string;
    backgroundMusic?: {
      url: string;
      loop: boolean;
      volume: number;
      fadeIn: number;
      fadeOut: number;
    };
    objectFit?: string;
    showTextOverlay?: boolean;
    isRoot?: boolean;
    hidden?: boolean;
    skip?: boolean;
    nodeValue?: number;
    threshold?: number;
    ranges?: { id: string; min: number; max: number }[];
    presentation?: {
      characters: {
        sourceNodeId: string;
        position: 'left' | 'right' | 'center';
        offsetX: number;
        offsetY: number;
        scale: number;
        flipX: boolean;
        layer: number;
        imageUrl?: string;
        name?: string;
      }[];
      inlineActions?: {
        id: string;
        kind: 'character' | 'scene';
        sourceNodeId: string;
        name?: string;
        action: string;
        duration: number;
        strength: number;
        repeats?: number;
        offsetX: number;
        offsetY: number;
        scale: number;
      }[];
    };
  };
};

export type WebExportEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string;
};
