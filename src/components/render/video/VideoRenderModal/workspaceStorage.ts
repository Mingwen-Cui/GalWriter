import { clamp } from '../shared/mediaUtils';
import type {
  AssetCardLayout,
  ExportFormat,
  ExportSettingsMode,
  RenderStyle,
  RenderWorkspaceMode,
  TimelineScaleMode,
  TimelineWheelMode,
  VideoTextScaleMode,
  WebExportSettings,
  WebHistoryState,
} from '../shared/types';

export const DEFAULT_RENDER_STYLE: RenderStyle = {
  titleVisible: true,
  titleFontSize: 28,
  bodyFontSize: 18,
  titleFontFamily: 'SimHei, "Noto Sans SC", sans-serif',
  bodyFontFamily: 'SimHei, "Noto Sans SC", sans-serif',
  titleColor: '#ffffff',
  bodyColor: '#f8fafc',
  titleColorAlpha: 100,
  bodyColorAlpha: 100,
  titleStrokeColor: '#000000',
  bodyStrokeColor: '#000000',
  titleStrokeWidth: 0,
  bodyStrokeWidth: 0,
  titleAlign: 'left',
  bodyAlign: 'left',
  titleLetterSpacing: 0,
  bodyLetterSpacing: 0,
  titleLineHeight: 1.25,
  bodyLineHeight: 1.45,
  titleAnimationLeadSeconds: 0,
  bodyAnimationLeadSeconds: 0,
  titleTypewriterMode: 'character',
  bodyTypewriterMode: 'character',
  panelColor: '#111827',
  panelColorAlpha: 82,
  dialogVisible: true,
  dialogWidth: 86,
  dialogHeight: 34,
  dialogHeightMode: 'fixed',
  dialogRadius: 24,
  dialogOffsetX: 0,
  dialogOffsetY: 0,
  dialogTextPaddingX: 9,
  dialogTextOffsetY: 0,
  dialogBackgroundType: 'solid',
  dialogGradientAngle: 90,
  dialogGradientStartColor: 'rgba(17, 24, 39, 0)',
  dialogGradientColor: 'rgba(17, 24, 39, 0.86)',
  dialogGradientStops: [
    { id: 'start', color: '#111827', alpha: 0, position: 0 },
    { id: 'end', color: '#111827', alpha: 86, position: 100 },
  ],
  dialogImageUrl: '',
  nameplateVisible: true,
  nameplateInside: false,
  nameplateFollowCharacter: true,
  nameplateFontSize: 18,
  nameplateFontFamily: 'SimHei, "Noto Sans SC", sans-serif',
  nameplateScale: 100,
  nameplateRadius: 14,
  nameplateTextColor: '#ffffff',
  nameplateTextColorAlpha: 100,
  nameplateOffsetX: 0,
  nameplateOffsetY: 0,
  nameplateBackgroundType: 'solid',
  nameplateColor: '#4f46e5',
  nameplateColorAlpha: 86,
  nameplateGradientAngle: 90,
  nameplateGradientStops: [
    { id: 'start', color: '#6366f1', alpha: 92, position: 0 },
    { id: 'end', color: '#ec4899', alpha: 82, position: 100 },
  ],
  nameplateImageUrl: '',
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
  videoTextScaleMode?: VideoTextScaleMode;
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

// NOTE: 模块级内存缓存作为主存储层。
// 在 Tauri webview 等环境下，localStorage 写入后可能无法跨组件挂载周期可靠读取。
// 使用内存缓存可确保同一 Tab 会话内（关闭/重开 Modal）状态100%持久，
// localStorage 仅作为应用重启后的跨会话备份。
const inMemoryWorkspaceCache = new Map<string, PersistedRenderWorkspaceState>();

export const readRenderWorkspaceState = (
  workspaceKey?: string,
): PersistedRenderWorkspaceState | null => {
  const storageKey = renderWorkspaceStorageKey(workspaceKey);

  // 优先从内存缓存读取（同一会话内最可靠）
  const cached = inMemoryWorkspaceCache.get(storageKey);
  if (cached) {
    return cached;
  }

  // 内存中没有时，尝试从 localStorage 恢复（跨会话/页面刷新后）
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRenderWorkspaceState;
    if (parsed && typeof parsed === 'object') {
      // 写回内存缓存，供后续快速访问
      inMemoryWorkspaceCache.set(storageKey, parsed);
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

export const writeRenderWorkspaceState = (
  workspaceKey: string | undefined,
  snapshot: PersistedRenderWorkspaceState,
) => {
  const storageKey = renderWorkspaceStorageKey(workspaceKey);

  // 始终写入内存缓存（同步、可靠）
  inMemoryWorkspaceCache.set(storageKey, snapshot);

  // 同时尝试写入 localStorage（跨会话备份，失败不影响当前会话）
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota/private-mode failures; the render workspace still works in-memory.
  }
};

export const clampPersistedNumber = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;

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

export const isVideoTextScaleMode = (value: unknown): value is VideoTextScaleMode =>
  value === 'literal' || value === 'webRatio';
