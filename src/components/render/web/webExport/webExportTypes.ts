import type { RenderStyle, WebExportSettings } from '../../video/shared/types';

export type { WebExportSettings };

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
