import { clamp } from '../shared/mediaUtils';
import type {
  AssetCardLayout,
  ExportFormat,
  ExportSettingsMode,
  RenderStyle,
  RenderWorkspaceMode,
  TimelineScaleMode,
  TimelineWheelMode,
  WebExportSettings,
  WebHistoryState,
} from '../shared/types';

export const DEFAULT_RENDER_STYLE: RenderStyle = {
  titleFontSize: 56,
  bodyFontSize: 38,
  titleColor: '#ffffff',
  bodyColor: '#f8fafc',
  panelColor: '#111827',
  titleAnimation: 'none',
  bodyAnimation: 'typewriter',
};

export const DESKTOP_RELEASE_URL = 'https://github.com/Mingwen-Cui/GalWriter/releases';

export type PersistedRenderWorkspaceState = {
  workspaceMode?: RenderWorkspaceMode;
  selectedIds?: string[];
  timelineIds?: string[];
  timelineSourceById?: Record<string, string>;
  timelineExcludedSourceIds?: string[];
  videoTrackIds?: string[];
  audioTrackIds?: string[];
  videoTrackByNodeId?: Record<string, string>;
  audioTrackByNodeId?: Record<string, string>;
  timelineStartById?: Record<string, number>;
  timelineDurationById?: Record<string, number>;
  timelineDataOverrides?: Record<string, Record<string, unknown>>;
  keyShotIds?: string[];
  timelinePast?: import('../shared/types').TimelineHistoryState[];
  timelineFuture?: import('../shared/types').TimelineHistoryState[];
  activePreviewId?: string;
  assetRegionFilter?: string;
  resolutionIndex?: number;
  resolutionWidth?: number;
  resolutionHeight?: number;
  exportFormat?: ExportFormat;
  speed?: number;
  defaultSeconds?: number;
  animationLeadSeconds?: number;
  frameRate?: number;
  outputDir?: string;
  webOutputDir?: string;
  renderStyle?: Partial<RenderStyle>;
  assetPanelWidth?: number;
  assetCardLayout?: AssetCardLayout;
  assetCardScale?: number;
  exportPanelWidth?: number;
  exportSettingsMode?: ExportSettingsMode;
  timelineHeight?: number;
  timelineScaleMode?: TimelineScaleMode;
  timelineWheelMode?: TimelineWheelMode;
  timelineSnapEnabled?: boolean;
  timelinePixelsPerSecond?: number;
  timelineDisplayDuration?: number;
  timelinePreviewTime?: number;
  timelineScrollLeft?: number;
  assetScrollTop?: number;
  selectedAssetIds?: string[];
  focusedPreviewId?: string;
  useGpuAcceleration?: boolean;
  hideCharacterTags?: boolean;
  hideSceneTags?: boolean;
  webProjectName?: string;
  webChoiceColor?: string;
  webChoiceTextColor?: string;
  webSettings?: Partial<WebExportSettings>;
  webRenderStyle?: Partial<RenderStyle>;
  webPast?: WebHistoryState[];
  webFuture?: WebHistoryState[];
  savedAt?: number;
};

const renderWorkspaceStorageKey = (workspaceKey?: string) =>
  `galwriter-video-render-workspace:v1:${workspaceKey || 'draft'}`;

export const readRenderWorkspaceState = (
  workspaceKey?: string,
): PersistedRenderWorkspaceState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(renderWorkspaceStorageKey(workspaceKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRenderWorkspaceState;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const writeRenderWorkspaceState = (
  workspaceKey: string | undefined,
  snapshot: PersistedRenderWorkspaceState,
) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(renderWorkspaceStorageKey(workspaceKey), JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota/private-mode failures; the render workspace still works in-memory.
  }
};

export const clampPersistedNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) => (typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback);

export const isRenderWorkspaceMode = (value: unknown): value is RenderWorkspaceMode =>
  value === 'video' || value === 'web';

export const isExportFormat = (value: unknown): value is ExportFormat =>
  value === 'mp4' || value === 'mov' || value === 'mkv';

export const isAssetCardLayout = (value: unknown): value is AssetCardLayout =>
  value === 'row' || value === 'grid';

export const isExportSettingsMode = (value: unknown): value is ExportSettingsMode =>
  value === 'video' || value === 'audio';

export const isTimelineScaleMode = (value: unknown): value is TimelineScaleMode =>
  value === 'seconds' || value === 'frames';

export const isTimelineWheelMode = (value: unknown): value is TimelineWheelMode =>
  value === 'horizontal' || value === 'vertical';
