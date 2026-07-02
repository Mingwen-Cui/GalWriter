import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { ReactNode } from 'react';

import type { Language } from '../../../../lib/i18n';
import type { TTSConfig } from '../../../../lib/tts';

export type RenderStatus = 'idle' | 'rendering' | 'done' | 'error';
export type ExportFormat = 'mp4' | 'mov' | 'mkv';
export type TextAnimation = 'none' | 'fade' | 'slideUp' | 'typewriter';
export type TextAlign = 'left' | 'center' | 'right';
export type TypewriterMode = 'character' | 'word' | 'sentence' | 'line';
export type TimelineScaleMode = 'seconds' | 'frames';
export type TimelineWheelMode = 'vertical' | 'horizontal';
export type AssetCardLayout = 'row' | 'grid';
export type ExportSettingsMode = 'video' | 'audio';
export type RenderWorkspaceMode = 'video' | 'web';
export type VideoTextScaleMode = 'literal' | 'webRatio';
export type TimelineSegmentMetric = {
  node: FlowNode;
  start: number;
  duration: number;
  end: number;
};

export type VideoRenderModalProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
  onUpdateNodeData?: (id: string, data: Record<string, unknown>) => void;
  language: Language;
  workspaceKey?: string;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  voiceTtsConfig?: TTSConfig;
};

export type RenderStyle = {
  titleVisible: boolean;
  titleFontSize: number;
  bodyFontSize: number;
  titleFontFamily: string;
  bodyFontFamily: string;
  titleColor: string;
  bodyColor: string;
  titleColorAlpha: number;
  bodyColorAlpha: number;
  titleStrokeColor: string;
  bodyStrokeColor: string;
  titleStrokeWidth: number;
  bodyStrokeWidth: number;
  titleAlign: TextAlign;
  bodyAlign: TextAlign;
  titleLetterSpacing: number;
  bodyLetterSpacing: number;
  titleLineHeight: number;
  bodyLineHeight: number;
  titleAnimationLeadSeconds: number;
  bodyAnimationLeadSeconds: number;
  titleTypewriterMode: TypewriterMode;
  bodyTypewriterMode: TypewriterMode;
  panelColor: string;
  panelColorAlpha?: number;
  dialogVisible: boolean;
  dialogWidth: number;
  dialogHeight: number;
  dialogHeightMode: 'fixed' | 'auto';
  dialogRadius: number;
  dialogOffsetX: number;
  dialogOffsetY: number;
  dialogTextPaddingX: number;
  dialogTextPaddingTop: number;
  dialogBackgroundType: 'solid' | 'gradient' | 'image';
  dialogGradientAngle: number;
  dialogGradientStartColor: string;
  dialogGradientColor: string;
  dialogGradientStops: Array<{ id: string; color: string; alpha: number; position: number }>;
  dialogImageUrl: string;
  titleAnimation: TextAnimation;
  bodyAnimation: TextAnimation;
};

export type WebExportSettings = {
  layoutMode: 'classic' | 'immersive';
  choicesPosition: 'center' | 'aboveText' | 'belowText';
  blurBackground: boolean;
  skipSingleChoicePopup: boolean;
  interactionMode: 'immediate' | 'typewriter';
  typewriterSpeed: number;
  autoAdvance: boolean;
  videoAutoPlay: boolean;
  hideCharacterTags: boolean;
  hideSceneTags: boolean;
};

export type SegmentRenderInfo = {
  node: FlowNode;
  durationSecs: number;
  startSecs?: number;
  audioUrl?: string;
  videoUrl?: string;
  volume?: number;
  loop?: boolean;
  fadeIn?: number;
  fadeOut?: number;
};

export type RenderedFramePayload = {
  bytes: number[];
  durationSecs: number;
};

export type AssetRegionOption = {
  id: string;
  label: string;
  type:
    | 'all'
    | 'outside'
    | 'mediaImage'
    | 'mediaVideo'
    | 'mediaAudio'
    | 'dynamicGroup'
    | 'background';
};

export type TimelineHistoryState = {
  timelineIds: string[];
  timelineSourceById: Record<string, string>;
  timelineExcludedSourceIds?: string[];
  selectedIds: string[];
  videoTrackIds: string[];
  audioTrackIds: string[];
  videoTrackByNodeId: Record<string, string>;
  audioTrackByNodeId: Record<string, string>;
  timelineStartById: Record<string, number>;
  timelineDurationById?: Record<string, number>;
  timelineDataOverrides?: Record<string, Record<string, unknown>>;
  keyShotIds?: string[];
  activePreviewId: string;
};

export type WebHistoryState = {
  settings: WebExportSettings;
  renderStyle: RenderStyle;
  choiceColor: string;
  choiceTextColor: string;
};

export type RenderContextMenuTarget = {
  kind: 'asset' | 'timeline' | 'audio' | 'preview' | 'empty';
  nodeId?: string;
  selectedNodeIds?: string[];
  trackId?: string;
  trackKind?: 'video' | 'audio';
};

export type RenderContextMenuState = RenderContextMenuTarget & {
  x: number;
  y: number;
};

export type RenderContextMenuItem = {
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export type RenderContextMenuSection = {
  items: RenderContextMenuItem[];
};
