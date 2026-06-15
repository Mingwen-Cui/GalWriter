import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { ReactNode } from 'react';

import type { Language } from '../../../../lib/i18n';
import type { TTSConfig } from '../../../../lib/tts';

export type RenderStatus = 'idle' | 'rendering' | 'done' | 'error';
export type ExportFormat = 'mp4' | 'mov' | 'mkv';
export type TextAnimation = 'none' | 'fade' | 'slideUp' | 'typewriter';
export type TimelineScaleMode = 'seconds' | 'frames';
export type TimelineWheelMode = 'vertical' | 'horizontal';
export type AssetCardLayout = 'row' | 'grid';
export type ExportSettingsMode = 'video' | 'audio';
export type RenderWorkspaceMode = 'video' | 'web';
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
  language: Language;
  workspaceKey?: string;
  voiceTtsConfig?: TTSConfig;
};

export type RenderStyle = {
  titleFontSize: number;
  bodyFontSize: number;
  titleColor: string;
  bodyColor: string;
  panelColor: string;
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
