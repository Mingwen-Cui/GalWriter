import type { Node as FlowNode } from '@xyflow/react';
import {
  CheckCircle2,
  Clock,
  ClipboardCopy,
  Copy,
  Download,
  Eye,
  Film,
  FileDown,
  FileText,
  Gauge,
  Image,
  ListPlus,
  Mic,
  Music,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  UserRound,
  Video,
  X,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { generateSpeechAudio, htmlToSpeechText } from '../../../lib/tts';
import { buildAudioBuffer, buildAudioTrack } from './audio/audioTrack';
import { getAssetRegionOptions, getStoryNodeRegion } from './assets/assetRegions';
import { ResizeHandle, makeTrackId } from './controls/RenderControls';
import {
  chooseRenderOutputDir,
  getDefaultRenderDir,
  saveRenderedVideo,
  saveRenderedWebZip,
} from './export/tauriRenderAdapter';
import { useWebExportSettings } from './export/useWebExportSettings';
import { buildInteractiveWebZipBlob, exportInteractiveWebZip } from '../web/webExport';
import { WebWorkspace } from '../web/WebWorkspace';
import { RenderContextMenu } from './panels/RenderContextMenu';
import { RenderHeader } from './panels/RenderHeader';
import { VideoAssetSidebar } from './panels/VideoAssetSidebar';
import { VideoExportSettingsPanel } from './panels/VideoExportSettingsPanel';
import { VideoPreviewPanel } from './panels/VideoPreviewPanel';
import { VideoTimelinePanel } from './panels/VideoTimelinePanel';
import { drawRenderFrame } from './preview/frameRenderer';
import {
  initWebGPU,
  destroyWebGPU,
  isWebGPUSupported,
  getWebGPUCanvas,
} from './gpu/webgpuRenderer';
import { drawGPUFrame, clearGPUTextCache } from './gpu/gpuFrameRenderer';
import {
  ASSET_CARD_MAX_SCALE,
  ASSET_CARD_MIN_SCALE,
  DEFAULT_VIDEO_BITRATE,
  ENCODER_OPTIONS,
  EXPORT_FORMAT_OPTIONS,
  FRAME_RATE_OPTIONS,
  HEADER_HEIGHT,
  MIN_MAIN_HEIGHT,
  MIN_PREVIEW_WIDTH,
  PANEL_SIZE_LIMITS,
  RESOLUTION_OPTIONS,
  TIMELINE_MAX_PIXELS_PER_SECOND,
  TIMELINE_MIN_PIXELS_PER_SECOND,
  TIMELINE_PIXELS_PER_SECOND,
} from './shared/constants';
import {
  clamp,
  getAudioDuration,
  isTauriRuntime,
  loadVideo,
  seekVideo,
  validDuration,
} from './shared/mediaUtils';
import {
  getNodeDisplayTitle,
  getOrderedStoryNodes,
  stripHtml,
} from './shared/storyNodes';
import { renderCopy } from './shared/renderCopy';
import type {
  AssetCardLayout,
  ExportFormat,
  ExportSettingsMode,
  RenderContextMenuSection,
  RenderContextMenuState,
  RenderContextMenuTarget,
  RenderStatus,
  RenderStyle,
  RenderWorkspaceMode,
  RenderedFramePayload,
  SegmentRenderInfo,
  TextAnimation,
  TimelineHistoryState,
  TimelineScaleMode,
  TimelineSegmentMetric,
  TimelineWheelMode,
  VideoRenderModalProps,
} from './shared/types';
import { captureTimelineHistoryState, restoreTimelineHistoryState } from './timeline/timelineHistory';
import { getTimelineTickSettings } from './timeline/timelineUtils';

const DEFAULT_RENDER_STYLE: RenderStyle = {
  titleFontSize: 56,
  bodyFontSize: 38,
  titleColor: '#ffffff',
  bodyColor: '#f8fafc',
  panelColor: '#111827',
  titleAnimation: 'none',
  bodyAnimation: 'typewriter',
};

const DESKTOP_RELEASE_URL = 'https://github.com/Mingwen-Cui/GalWriter/releases';

type RenderNoticeModalState = {
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary?: () => void;
};

type PersistedRenderWorkspaceState = {
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
  timelinePast?: TimelineHistoryState[];
  timelineFuture?: TimelineHistoryState[];
  activePreviewId?: string;
  assetRegionFilter?: string;
  resolutionIndex?: number;
  exportFormat?: ExportFormat;
  speed?: number;
  defaultSeconds?: number;
  animationLeadSeconds?: number;
  frameRate?: number;
  encoder?: string;
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
  useGpuAcceleration?: boolean;
  savedAt?: number;
};

const renderWorkspaceStorageKey = (workspaceKey?: string) =>
  `galwriter-video-render-workspace:v1:${workspaceKey || 'draft'}`;

const readRenderWorkspaceState = (workspaceKey?: string): PersistedRenderWorkspaceState | null => {
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

const clampPersistedNumber = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;

const isRenderWorkspaceMode = (value: unknown): value is RenderWorkspaceMode =>
  value === 'video' || value === 'web';

const isExportFormat = (value: unknown): value is ExportFormat =>
  value === 'webm' || value === 'mp4' || value === 'mov' || value === 'mkv';

function VideoNoticeModal({
  notice,
  onClose,
}: {
  notice: RenderNoticeModalState | null;
  onClose: () => void;
}) {
  if (!notice) return null;

  return (
    <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--vr-border)] bg-[var(--vr-surface)] p-7 shadow-[0_32px_90px_rgba(15,23,42,0.34)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--vr-accent-soft)] text-[var(--vr-accent)]">
              <Download className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--vr-text)]">{notice.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--vr-text-soft)]">
                {notice.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={notice.onSecondary ?? onClose}
            className="flex-1 rounded-2xl border border-[var(--vr-border)] px-4 py-3 text-sm font-bold text-[var(--vr-text-soft)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
          >
            {notice.secondaryLabel}
          </button>
          <button
            type="button"
            onClick={notice.onPrimary}
            className="flex-1 rounded-2xl bg-[var(--vr-accent)] px-4 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)] transition-colors hover:brightness-110"
          >
            {notice.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const isAssetCardLayout = (value: unknown): value is AssetCardLayout =>
  value === 'row' || value === 'grid';

const isExportSettingsMode = (value: unknown): value is ExportSettingsMode =>
  value === 'video' || value === 'audio';

const isTimelineScaleMode = (value: unknown): value is TimelineScaleMode =>
  value === 'seconds' || value === 'frames';

const isTimelineWheelMode = (value: unknown): value is TimelineWheelMode =>
  value === 'horizontal' || value === 'vertical';

export function VideoRenderModal({
  nodes,
  edges,
  onClose,
  language,
  workspaceKey,
  voiceTtsConfig,
}: VideoRenderModalProps) {
  const orderedNodes = useMemo(() => getOrderedStoryNodes(nodes, edges), [nodes, edges]);
  const persistedWorkspace = useMemo(() => readRenderWorkspaceState(workspaceKey), [workspaceKey]);
  const [workspaceMode, setWorkspaceMode] = useState<RenderWorkspaceMode>(() =>
    isRenderWorkspaceMode(persistedWorkspace?.workspaceMode) ? persistedWorkspace.workspaceMode : 'video',
  );
  const defaultWebProjectName = useMemo(
    () => getNodeDisplayTitle(orderedNodes[0]) || 'galwriter-web',
    [orderedNodes],
  );
  const [status, setStatus] = useState<RenderStatus>('idle');
  const isDesktopApp = isTauriRuntime();
  const [noticeModal, setNoticeModal] = useState<RenderNoticeModalState | null>(null);
  const {
    webProjectName,
    setWebProjectName,
    webChoiceColor,
    webChoiceTextColor,
    webSettings,
    webRenderStyle,
    webPast,
    webFuture,
    undoWeb,
    redoWeb,
    updateWebSettings,
    updateWebRenderStyle,
    updateWebChoiceColor,
    updateWebChoiceTextColor,
  } = useWebExportSettings(defaultWebProjectName, status === 'rendering');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      new Set(
        Array.isArray(persistedWorkspace?.selectedIds) && persistedWorkspace.selectedIds.length > 0
          ? persistedWorkspace.selectedIds
          : orderedNodes.map((node) => node.id),
      ),
  );
  const [timelineIds, setTimelineIds] = useState<string[]>(() =>
    Array.isArray(persistedWorkspace?.timelineIds) && persistedWorkspace.timelineIds.length > 0
      ? persistedWorkspace.timelineIds
      : orderedNodes.map((node) => node.id),
  );
  const [timelineSourceById, setTimelineSourceById] = useState<Record<string, string>>(
    () => persistedWorkspace?.timelineSourceById || {},
  );
  const [timelineExcludedSourceIds, setTimelineExcludedSourceIds] = useState<Set<string>>(
    () => new Set(persistedWorkspace?.timelineExcludedSourceIds || []),
  );
  const [videoTrackIds, setVideoTrackIds] = useState<string[]>(() =>
    Array.isArray(persistedWorkspace?.videoTrackIds) && persistedWorkspace.videoTrackIds.length > 0
      ? persistedWorkspace.videoTrackIds
      : ['video-1'],
  );
  const [audioTrackIds, setAudioTrackIds] = useState<string[]>(() =>
    Array.isArray(persistedWorkspace?.audioTrackIds) && persistedWorkspace.audioTrackIds.length > 0
      ? persistedWorkspace.audioTrackIds
      : ['audio-1'],
  );
  const [videoTrackByNodeId, setVideoTrackByNodeId] = useState<Record<string, string>>(() =>
    persistedWorkspace?.videoTrackByNodeId ||
    Object.fromEntries(orderedNodes.map((node) => [node.id, 'video-1'])),
  );
  const [audioTrackByNodeId, setAudioTrackByNodeId] = useState<Record<string, string>>(() =>
    persistedWorkspace?.audioTrackByNodeId ||
    Object.fromEntries(orderedNodes.map((node) => [node.id, 'audio-1'])),
  );
  const [timelineStartById, setTimelineStartById] = useState<Record<string, number>>(
    () => persistedWorkspace?.timelineStartById || {},
  );
  const [timelinePast, setTimelinePast] = useState<TimelineHistoryState[]>(
    () => persistedWorkspace?.timelinePast || [],
  );
  const [timelineFuture, setTimelineFuture] = useState<TimelineHistoryState[]>(
    () => persistedWorkspace?.timelineFuture || [],
  );
  const [activePreviewId, setActivePreviewId] = useState<string>(
    () => persistedWorkspace?.activePreviewId || orderedNodes[0]?.id || '',
  );
  const [assetRegionFilter, setAssetRegionFilter] = useState(
    () => persistedWorkspace?.assetRegionFilter || 'all',
  );
  const [resolutionIndex, setResolutionIndex] = useState(() =>
    clampPersistedNumber(persistedWorkspace?.resolutionIndex, 0, 0, RESOLUTION_OPTIONS.length - 1),
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>(() =>
    isExportFormat(persistedWorkspace?.exportFormat) ? persistedWorkspace.exportFormat : 'mp4',
  );
  const [speed, setSpeed] = useState(() =>
    clampPersistedNumber(persistedWorkspace?.speed, 1, 0.25, 3),
  );
  const [defaultSeconds, setDefaultSeconds] = useState(() =>
    clampPersistedNumber(persistedWorkspace?.defaultSeconds, 4, 1, 60),
  );
  const [animationLeadSeconds, setAnimationLeadSeconds] = useState(() =>
    clampPersistedNumber(persistedWorkspace?.animationLeadSeconds, 0, 0, 10),
  );
  const [frameRate, setFrameRate] = useState(() =>
    FRAME_RATE_OPTIONS.includes(persistedWorkspace?.frameRate || 0)
      ? persistedWorkspace!.frameRate!
      : 30,
  );
  const [encoder, setEncoder] = useState(() => persistedWorkspace?.encoder || 'libx264');
  const [outputDir, setOutputDir] = useState(() => persistedWorkspace?.outputDir || '');
  const [webOutputDir, setWebOutputDir] = useState(() => persistedWorkspace?.webOutputDir || '');
  const [renderStyle, setRenderStyle] = useState<RenderStyle>({
    ...DEFAULT_RENDER_STYLE,
    ...persistedWorkspace?.renderStyle,
  });
  const [useGpuAcceleration, setUseGpuAcceleration] = useState(() =>
    Boolean(persistedWorkspace?.useGpuAcceleration),
  );
  const [progress, setProgress] = useState('');
  const [progressValue, setProgressValue] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(defaultSeconds);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [assetPanelWidth, setAssetPanelWidth] = useState(() =>
    clampPersistedNumber(
      persistedWorkspace?.assetPanelWidth,
      320,
      PANEL_SIZE_LIMITS.asset.min,
      PANEL_SIZE_LIMITS.asset.max,
    ),
  );
  const [assetCardLayout, setAssetCardLayout] = useState<AssetCardLayout>(() =>
    isAssetCardLayout(persistedWorkspace?.assetCardLayout) ? persistedWorkspace.assetCardLayout : 'row',
  );
  const [assetCardScale, setAssetCardScale] = useState(() =>
    clampPersistedNumber(
      persistedWorkspace?.assetCardScale,
      1,
      ASSET_CARD_MIN_SCALE,
      ASSET_CARD_MAX_SCALE,
    ),
  );
  const [exportPanelWidth, setExportPanelWidth] = useState(() =>
    clampPersistedNumber(
      persistedWorkspace?.exportPanelWidth,
      380,
      PANEL_SIZE_LIMITS.export.min,
      PANEL_SIZE_LIMITS.export.max,
    ),
  );
  const [exportSettingsMode, setExportSettingsMode] = useState<ExportSettingsMode>(() =>
    isExportSettingsMode(persistedWorkspace?.exportSettingsMode)
      ? persistedWorkspace.exportSettingsMode
      : 'video',
  );
  const [timelineHeight, setTimelineHeight] = useState(() =>
    clampPersistedNumber(
      persistedWorkspace?.timelineHeight,
      250,
      PANEL_SIZE_LIMITS.timeline.min,
      PANEL_SIZE_LIMITS.timeline.max,
    ),
  );
  const [timelineScaleMode, setTimelineScaleMode] = useState<TimelineScaleMode>(() =>
    isTimelineScaleMode(persistedWorkspace?.timelineScaleMode)
      ? persistedWorkspace.timelineScaleMode
      : 'seconds',
  );
  const [timelineWheelMode, setTimelineWheelMode] = useState<TimelineWheelMode>(() =>
    isTimelineWheelMode(persistedWorkspace?.timelineWheelMode)
      ? persistedWorkspace.timelineWheelMode
      : 'horizontal',
  );
  const [timelineSnapEnabled, setTimelineSnapEnabled] = useState(
    () => persistedWorkspace?.timelineSnapEnabled ?? true,
  );
  const [timelinePixelsPerSecond, setTimelinePixelsPerSecond] = useState(
    () =>
      clampPersistedNumber(
        persistedWorkspace?.timelinePixelsPerSecond,
        TIMELINE_PIXELS_PER_SECOND,
        TIMELINE_MIN_PIXELS_PER_SECOND,
        TIMELINE_MAX_PIXELS_PER_SECOND,
      ),
  );
  const [timelineDisplayDuration, setTimelineDisplayDuration] = useState(() =>
    clampPersistedNumber(persistedWorkspace?.timelineDisplayDuration, 60, 5, 3600),
  );
  const [timelineDurationById, setTimelineDurationById] = useState<Record<string, number>>({});
  const [uploadedAssetNodes, setUploadedAssetNodes] = useState<FlowNode[]>([]);
  const [focusedPreviewId, setFocusedPreviewId] = useState('');
  const [timelinePreviewTime, setTimelinePreviewTime] = useState(() =>
    clampPersistedNumber(persistedWorkspace?.timelinePreviewTime, 0, 0, 3600),
  );
  const [timelineScrollInfo, setTimelineScrollInfo] = useState({
    scrollLeft: 0,
    scrollWidth: 1,
    clientWidth: 1,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [assetScrollInfo, setAssetScrollInfo] = useState({
    scrollTop: 0,
    scrollHeight: 1,
    clientHeight: 1,
  });
  const [contextMenu, setContextMenu] = useState<RenderContextMenuState | null>(null);
  const [error, setError] = useState('');
  const [outputDirError, setOutputDirError] = useState('');
  const [webOutputDirError, setWebOutputDirError] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const [audioMessage, setAudioMessage] = useState('');
  const [audioBusy, setAudioBusy] = useState(false);
  const [isRecordingVoiceover, setIsRecordingVoiceover] = useState(false);
  const modalRootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetUploadInputRef = useRef<HTMLInputElement>(null);
  const assetViewportRef = useRef<HTMLDivElement>(null);
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const timelineScrubSurfaceRef = useRef<HTMLDivElement>(null);
  const voiceoverRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceoverChunksRef = useRef<BlobPart[]>([]);
  const voiceoverStreamRef = useRef<MediaStream | null>(null);
  const timelineScrubRef = useRef(false);
  const timelineScaleDragRef = useRef<{
    side: 'left' | 'right';
    anchorTrackX: number;
    trackWidth: number;
  } | null>(null);
  const assetScaleDragRef = useRef<{
    side: 'top' | 'bottom';
    startY: number;
    startScale: number;
  } | null>(null);
  const timelineScrollDragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    trackWidth: number;
  } | null>(null);
  const assetScrollDragRef = useRef<{
    startY: number;
    startScrollTop: number;
    trackHeight: number;
  } | null>(null);
  const preservePreviewTimeOnNodeChangeRef = useRef(false);
  const previewVideoRef = useRef<{ url: string; video: HTMLVideoElement } | null>(null);
  const previewAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const previewDrawIdRef = useRef(0);
  const uploadedObjectUrlsRef = useRef<Set<string>>(new Set());
  const timelineClipCounterRef = useRef(0);

  const allAssetNodes = useMemo(
    () => [...uploadedAssetNodes, ...orderedNodes],
    [orderedNodes, uploadedAssetNodes],
  );
  const assetNodeById = useMemo(
    () => new Map(allAssetNodes.map((node) => [node.id, node])),
    [allAssetNodes],
  );
  const makeTimelineClipInstanceId = (sourceId: string) => {
    timelineClipCounterRef.current += 1;
    return `${sourceId}::clip-${Date.now()}-${timelineClipCounterRef.current}`;
  };
  const timelineNodes = useMemo(
    () =>
      timelineIds
        .map((id) => {
          const sourceNode = assetNodeById.get(timelineSourceById[id] || id);
          return sourceNode ? ({ ...sourceNode, id } as FlowNode) : null;
        })
        .filter(Boolean) as FlowNode[],
    [assetNodeById, timelineIds, timelineSourceById],
  );
  const timelineNodeById = useMemo(
    () => new Map(timelineNodes.map((node) => [node.id, node])),
    [timelineNodes],
  );
  const nodeById = useMemo(
    () => new Map([...assetNodeById, ...timelineNodeById]),
    [assetNodeById, timelineNodeById],
  );
  const selectedNodes = useMemo(
    () => timelineNodes.filter((node) => selectedIds.has(node.id)),
    [timelineNodes, selectedIds],
  );
  const getSpeechTextForNode = (node: FlowNode) => {
    const title = htmlToSpeechText(String(node.data?.title || ''));
    const body = htmlToSpeechText(String(node.data?.text || ''));
    return [title, body].filter(Boolean).join('\n').trim();
  };
  const canGenerateSpeechFromNode = (node: FlowNode) =>
    !node.data?.videoUrl && Boolean(getSpeechTextForNode(node));
  const selectedSpeechNodes = selectedNodes.filter(canGenerateSpeechFromNode);
  const activePreviewNode = nodeById.get(activePreviewId) || selectedNodes[0] || allAssetNodes[0];
  const focusedPreviewNode = focusedPreviewId ? nodeById.get(focusedPreviewId) : undefined;
  const resolution = RESOLUTION_OPTIONS[resolutionIndex] || RESOLUTION_OPTIONS[0];
  const isZh = language === 'zh';
  const fallbackEstimatedSeconds = (selectedNodes.length * defaultSeconds) / speed;
  const assetRegionOptions = useMemo(() => getAssetRegionOptions(nodes, isZh), [nodes, isZh]);
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const assetPanelMax = Math.max(
    PANEL_SIZE_LIMITS.asset.min,
    Math.min(PANEL_SIZE_LIMITS.asset.max, viewportWidth - exportPanelWidth - MIN_PREVIEW_WIDTH),
  );
  const exportPanelMax = Math.max(
    PANEL_SIZE_LIMITS.export.min,
    Math.min(PANEL_SIZE_LIMITS.export.max, viewportWidth - assetPanelWidth - MIN_PREVIEW_WIDTH),
  );
  const timelineMax = Math.max(
    PANEL_SIZE_LIMITS.timeline.min,
    Math.min(PANEL_SIZE_LIMITS.timeline.max, viewportHeight - HEADER_HEIGHT - MIN_MAIN_HEIGHT),
  );
  const nodeRegionById = useMemo(() => {
    const entries = orderedNodes.map((node) => [node.id, getStoryNodeRegion(node, nodes)] as const);
    return new Map(entries);
  }, [orderedNodes, nodes]);
  const visibleAssetNodes = useMemo(() => {
    if (assetRegionFilter === 'all') return allAssetNodes;
    if (assetRegionFilter === 'media:image')
      return allAssetNodes.filter((node) => Boolean(node.data?.imageUrl));
    if (assetRegionFilter === 'media:video')
      return allAssetNodes.filter((node) => Boolean(node.data?.videoUrl));
    if (assetRegionFilter === 'media:audio')
      return allAssetNodes.filter((node) => Boolean(node.data?.audioUrl));
    if (assetRegionFilter === 'outside')
      return [
        ...uploadedAssetNodes,
        ...orderedNodes.filter((node) => !nodeRegionById.get(node.id)),
      ];
    return orderedNodes.filter((node) => nodeRegionById.get(node.id)?.id === assetRegionFilter);
  }, [allAssetNodes, assetRegionFilter, orderedNodes, uploadedAssetNodes, nodeRegionById]);
  const timelineMetrics = useMemo(() => {
    let cursor = 0;
    const segments = timelineNodes.map((node) => {
      const mediaDuration = timelineDurationById[node.id] || defaultSeconds;
      const duration = Math.max(0.25, mediaDuration / speed);
      const start = timelineStartById[node.id] ?? cursor;
      const metric = {
        node,
        start,
        duration,
        end: start + duration,
      };
      cursor += duration;
      return metric;
    });
    const totalDuration = Math.max(0.25, ...segments.map((segment) => segment.end));
    const displayDuration = Math.max(totalDuration, timelineDisplayDuration);
    const width = Math.max(1, Math.ceil(displayDuration * timelinePixelsPerSecond));
    return {
      segments,
      totalDuration,
      displayDuration,
      width,
      pixelsPerSecond: width / displayDuration,
    };
  }, [
    defaultSeconds,
    speed,
    timelineDisplayDuration,
    timelineDurationById,
    timelineStartById,
    timelineNodes,
    timelinePixelsPerSecond,
  ]);
  const timelineMetricById = useMemo(
    () => new Map(timelineMetrics.segments.map((metric) => [metric.node.id, metric])),
    [timelineMetrics.segments],
  );
  const focusedTimelineMetric = focusedPreviewNode
    ? timelineMetricById.get(focusedPreviewNode.id)
    : undefined;
  const activeTimelineTime = focusedTimelineMetric
    ? clamp(focusedTimelineMetric.start + previewTime / speed, 0, timelineMetrics.totalDuration)
    : clamp(timelinePreviewTime, 0, timelineMetrics.totalDuration);
  const activeAudioSegments = useMemo(
    () =>
      timelineMetrics.segments
        .filter((segment) => selectedIds.has(segment.node.id))
        .filter((segment) => segment.node.data?.audioUrl || segment.node.data?.videoUrl),
    [selectedIds, timelineMetrics.segments],
  );
  const getSegmentAudioSources = (node: FlowNode) =>
    [
      { kind: 'card-audio', url: node.data?.audioUrl as string | undefined },
      { kind: 'video-audio', url: node.data?.videoUrl as string | undefined },
    ].filter((source): source is { kind: string; url: string } => Boolean(source.url));
  const activeTimelineFrame = Math.floor(activeTimelineTime * frameRate);
  const timelinePlayheadLeft = activeTimelineTime * timelineMetrics.pixelsPerSecond;
  const isVisualTimelineNode = (node?: FlowNode | null) =>
    Boolean(node?.data?.videoUrl || node?.data?.imageUrl || stripHtml(String(node?.data?.text || '')).trim());
  const isAudioOnlyNode = (node?: FlowNode | null) =>
    Boolean(node?.data?.audioUrl) && !isVisualTimelineNode(node);
  const timelineTickSettings = getTimelineTickSettings(
    timelineMetrics.pixelsPerSecond,
    timelineScaleMode,
    frameRate,
  );
  const timelineTicks = useMemo(() => {
    const ticks: number[] = [];
    for (
      let time = 0;
      time <= timelineMetrics.displayDuration + 0.001;
      time += timelineTickSettings.step
    ) {
      ticks.push(Number(time.toFixed(3)));
    }
    if (ticks[ticks.length - 1] !== timelineMetrics.displayDuration) {
      ticks.push(timelineMetrics.displayDuration);
    }
    return ticks;
  }, [timelineMetrics.displayDuration, timelineTickSettings.step]);

  const captureTimelineState = (): TimelineHistoryState =>
    captureTimelineHistoryState({
      timelineIds,
      timelineSourceById,
      timelineExcludedSourceIds,
      selectedIds,
      videoTrackIds,
      audioTrackIds,
      videoTrackByNodeId,
      audioTrackByNodeId,
      timelineStartById,
      activePreviewId,
    });

  const restoreTimelineState = (snapshot: TimelineHistoryState) => {
    restoreTimelineHistoryState(snapshot, {
      setTimelineIds,
      setTimelineSourceById,
      setTimelineExcludedSourceIds,
      setSelectedIds,
      setVideoTrackIds,
      setAudioTrackIds,
      setVideoTrackByNodeId,
      setAudioTrackByNodeId,
      setTimelineStartById,
      setActivePreviewId,
    });
  };

  const pushTimelineHistory = () => {
    setTimelinePast((prev) => [...prev, captureTimelineState()]);
    setTimelineFuture([]);
  };

  const closeContextMenu = () => setContextMenu(null);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await modalRootRef.current?.requestFullscreen();
    } catch {
      setError(isZh ? '当前环境无法切换全屏。' : 'Fullscreen is not available here.');
    }
  };

  const chooseOutputDir = async () => {
    if (!isTauriRuntime()) {
      setOutputDirError(
        isZh ? '选择文件夹仅在APP端可用。' : 'Folder picking is only available in the app.',
      );
      return;
    }

    try {
      setOutputDirError('');
      const result = await chooseRenderOutputDir(outputDir);
      if (result?.path) {
        setOutputDir(result.path);
        setOutputDirError('');
        setError('');
      }
    } catch (err) {
      setOutputDirError(
        err instanceof Error
          ? err.message
          : isZh
            ? '选择保存位置失败。'
            : 'Failed to choose save location.',
      );
    }
  };

  const chooseWebOutputDir = async () => {
    if (!isTauriRuntime()) {
      setWebOutputDirError(
        isZh ? '选择文件夹仅在APP端可用。' : 'Folder picking is only available in the app.',
      );
      return;
    }

    try {
      setWebOutputDirError('');
      const result = await chooseRenderOutputDir(webOutputDir);
      if (result?.path) {
        setWebOutputDir(result.path);
        setWebOutputDirError('');
        setError('');
      }
    } catch (err) {
      setWebOutputDirError(
        err instanceof Error
          ? err.message
          : isZh
            ? '选择网页导出位置失败。'
            : 'Failed to choose web export location.',
      );
    }
  };

  const openContextMenu = (
    event: React.MouseEvent<HTMLElement>,
    target: RenderContextMenuTarget,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 240;
    const menuHeight = target.nodeId ? 430 : 260;
    setContextMenu({
      ...target,
      x: clamp(event.clientX, 8, Math.max(8, window.innerWidth - menuWidth - 8)),
      y: clamp(event.clientY, 8, Math.max(8, window.innerHeight - menuHeight - 8)),
    });
  };

  const undoTimeline = () => {
    if (timelinePast.length === 0 || status === 'rendering') return;
    closeContextMenu();
    const previous = timelinePast[timelinePast.length - 1];
    setTimelinePast((prev) => prev.slice(0, -1));
    setTimelineFuture((prev) => [captureTimelineState(), ...prev]);
    restoreTimelineState(previous);
  };

  const redoTimeline = () => {
    if (timelineFuture.length === 0 || status === 'rendering') return;
    closeContextMenu();
    const next = timelineFuture[0];
    setTimelineFuture((prev) => prev.slice(1));
    setTimelinePast((prev) => [...prev, captureTimelineState()]);
    restoreTimelineState(next);
  };

  const seekTimelineTime = (time: number, options?: { keepPlaying?: boolean; preserveFocus?: boolean }) => {
    const nextTime = clamp(time, 0, timelineMetrics.totalDuration);
    if (!options?.preserveFocus) setFocusedPreviewId('');
    setTimelinePreviewTime(nextTime);
    if (options?.preserveFocus && focusedTimelineMetric) {
      setPreviewTime(
        clamp((nextTime - focusedTimelineMetric.start) * speed, 0, focusedTimelineMetric.duration * speed),
      );
    }
    if (!options?.keepPlaying) setPreviewPlaying(false);
  };

  const seekTimelineFromClientX = (
    clientX: number,
    rect: DOMRect,
    options?: { keepPlaying?: boolean },
  ) => {
    const offset = clamp(clientX - rect.left, 0, rect.width);
    seekTimelineTime(offset / timelineMetrics.pixelsPerSecond, options);
  };

  const snapTimelineTime = (time: number) => {
    if (!timelineSnapEnabled) return Math.max(0, time);
    const step = timelineScaleMode === 'frames' ? 1 / frameRate : 0.25;
    return Math.max(0, Math.round(time / step) * step);
  };

  const snapToTimelineClipEdges = (nodeId: string, wantedStart: number, duration: number) => {
    if (!timelineSnapEnabled) return Math.max(0, wantedStart);
    const gridStart = snapTimelineTime(wantedStart);
    const snapToleranceSeconds = Math.max(0.08, 10 / Math.max(1, timelineMetrics.pixelsPerSecond));
    const candidates = timelineMetrics.segments
      .filter((segment) => segment.node.id !== nodeId)
      .flatMap((segment) => [
        segment.start,
        segment.end,
        segment.start - duration,
        segment.end - duration,
      ])
      .map((candidate) => Math.max(0, candidate));

    const nearestEdge = candidates.reduce<{ time: number; distance: number } | null>(
      (nearest, candidate) => {
        const distance = Math.abs(candidate - wantedStart);
        if (distance > snapToleranceSeconds) return nearest;
        if (!nearest || distance < nearest.distance) return { time: candidate, distance };
        return nearest;
      },
      null,
    );

    return nearestEdge ? Math.max(0, nearestEdge.time) : gridStart;
  };

  const findNonOverlappingTrackStart = (
    nodeId: string,
    wantedStart: number,
    duration: number,
    trackKind: 'video' | 'audio',
    trackId: string,
  ) => {
    const assignedTrackByNodeId = trackKind === 'video' ? videoTrackByNodeId : audioTrackByNodeId;
    const fallbackTrackId = trackKind === 'video' ? videoTrackIds[0] : audioTrackIds[0];
    const siblings = timelineMetrics.segments
      .filter((segment) => {
        if (segment.node.id === nodeId) return false;
        return (assignedTrackByNodeId[segment.node.id] || fallbackTrackId) === trackId;
      })
      .sort((a, b) => a.start - b.start);
    let nextStart = snapToTimelineClipEdges(nodeId, wantedStart, duration);
    const overlaps = (start: number, segment: (typeof siblings)[number]) =>
      start < segment.end - 0.001 && start + duration > segment.start + 0.001;

    for (const segment of siblings) {
      if (!overlaps(nextStart, segment)) continue;
      if (nextStart < segment.start) {
        const beforeStart = snapTimelineTime(Math.max(0, segment.start - duration));
        if (!overlaps(beforeStart, segment)) return beforeStart;
      }
      nextStart = snapTimelineTime(segment.end);
    }

    return nextStart;
  };

  const hasAudioTrackSpace = (
    nodeId: string,
    start: number,
    duration: number,
    trackId: string,
  ) => {
    return !timelineMetrics.segments.some((segment) => {
      if (segment.node.id === nodeId) return false;
      const segmentTrackId = audioTrackByNodeId[segment.node.id] || audioTrackIds[0];
      if (segmentTrackId !== trackId) return false;
      return start < segment.end - 0.001 && start + duration > segment.start + 0.001;
    });
  };

  const getAudioDropTrackId = (
    nodeId: string,
    start: number,
    duration: number,
    preferredTrackId?: string,
  ) => {
    if (preferredTrackId) {
      if (hasAudioTrackSpace(nodeId, start, duration, preferredTrackId)) {
        setAudioTrackIds((prev) =>
          prev.includes(preferredTrackId) ? prev : [...prev, preferredTrackId],
        );
        return preferredTrackId;
      }
    } else {
      const availableTrackId = audioTrackIds.find((candidateTrackId) =>
        hasAudioTrackSpace(nodeId, start, duration, candidateTrackId),
      );
      if (availableTrackId) return availableTrackId;
    }

    const nextTrackId = makeTrackId('audio');
    setAudioTrackIds((prev) => (prev.includes(nextTrackId) ? prev : [...prev, nextTrackId]));
    return nextTrackId;
  };

  const assignAudioTrackForVideoPlacement = (
    nodeId: string,
    start: number,
    duration: number,
    videoTrackId: string,
  ) => {
    const currentAudioTrackId = audioTrackByNodeId[nodeId] || audioTrackIds[0];
    const matchingAudioTrackId = audioTrackIds[videoTrackIds.indexOf(videoTrackId)];
    const candidateTrackIds = [
      matchingAudioTrackId,
      currentAudioTrackId,
      ...audioTrackIds,
    ].filter(
      (trackId, index, list): trackId is string => !!trackId && list.indexOf(trackId) === index,
    );
    const availableTrackId = candidateTrackIds.find((candidateTrackId) =>
      hasAudioTrackSpace(nodeId, start, duration, candidateTrackId),
    );
    const nextTrackId = availableTrackId || makeTrackId('audio');

    if (!availableTrackId) {
      setAudioTrackIds((prev) => (prev.includes(nextTrackId) ? prev : [...prev, nextTrackId]));
    }
    setAudioTrackByNodeId((prev) =>
      prev[nodeId] === nextTrackId ? prev : { ...prev, [nodeId]: nextTrackId },
    );
  };

  const handleTimelineScrubStart = (event: React.PointerEvent<HTMLElement>) => {
    if (status === 'rendering') return;
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    timelineScrubRef.current = true;
    seekTimelineFromClientX(event.clientX, element.getBoundingClientRect());
  };

  const handleTimelineScrubMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!timelineScrubRef.current || status === 'rendering') return;
    event.preventDefault();
    seekTimelineFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
  };

  const handleTimelineScrubEnd = (event: React.PointerEvent<HTMLElement>) => {
    timelineScrubRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleTimelinePlayheadGrabStart = (event: React.PointerEvent<HTMLElement>) => {
    if (status === 'rendering') return;
    const scrubSurface = timelineScrubSurfaceRef.current;
    if (!scrubSurface) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineScrubRef.current = true;
    seekTimelineFromClientX(event.clientX, scrubSurface.getBoundingClientRect());
  };

  const handleTimelinePlayheadGrabMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!timelineScrubRef.current || status === 'rendering') return;
    const scrubSurface = timelineScrubSurfaceRef.current;
    if (!scrubSurface) return;
    event.preventDefault();
    seekTimelineFromClientX(event.clientX, scrubSurface.getBoundingClientRect());
  };

  const syncTimelineScrollInfo = () => {
    const element = timelineViewportRef.current;
    if (!element) return;
    setTimelineScrollInfo({
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    });
  };

  const syncAssetScrollInfo = () => {
    const element = assetViewportRef.current;
    if (!element) return;
    setAssetScrollInfo({
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    });
  };

  const updateAssetCardScale = (nextScale: number) => {
    const element = assetViewportRef.current;
    const centerRatio =
      element && element.scrollHeight > 0
        ? (element.scrollTop + element.clientHeight / 2) / element.scrollHeight
        : 0.5;
    setAssetCardScale(clamp(nextScale, ASSET_CARD_MIN_SCALE, ASSET_CARD_MAX_SCALE));
    window.requestAnimationFrame(() => {
      const nextElement = assetViewportRef.current;
      if (!nextElement) return;
      nextElement.scrollTop = Math.max(
        0,
        centerRatio * nextElement.scrollHeight - nextElement.clientHeight / 2,
      );
      syncAssetScrollInfo();
    });
  };

  const updateTimelineScale = (nextScale: number) => {
    const element = timelineViewportRef.current;
    const centerRatio =
      element && element.scrollWidth > 0
        ? (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth
        : 0.5;
    setTimelinePixelsPerSecond(
      clamp(nextScale, TIMELINE_MIN_PIXELS_PER_SECOND, TIMELINE_MAX_PIXELS_PER_SECOND),
    );
    window.requestAnimationFrame(() => {
      const nextElement = timelineViewportRef.current;
      if (!nextElement) return;
      nextElement.scrollLeft = Math.max(
        0,
        centerRatio * nextElement.scrollWidth - nextElement.clientWidth / 2,
      );
      syncTimelineScrollInfo();
    });
  };

  const applyTimelineViewportWindow = (
    leftTrackX: number,
    rightTrackX: number,
    trackWidth: number,
    activeSide: 'left' | 'right',
  ) => {
    const element = timelineViewportRef.current;
    if (!element || trackWidth <= 0) return;
    const viewportWidth = Math.max(1, element.clientWidth);
    const minWindowWidth = Math.min(trackWidth, 10);
    const windowLeft = clamp(
      Math.min(leftTrackX, rightTrackX - minWindowWidth),
      0,
      trackWidth - minWindowWidth,
    );
    const windowRight = clamp(
      Math.max(rightTrackX, windowLeft + minWindowWidth),
      windowLeft + minWindowWidth,
      trackWidth,
    );
    const windowWidth = Math.max(minWindowWidth, windowRight - windowLeft);
    const targetScrollWidth = (viewportWidth * trackWidth) / windowWidth;
    const nextScale = clamp(
      targetScrollWidth / timelineMetrics.displayDuration,
      TIMELINE_MIN_PIXELS_PER_SECOND,
      TIMELINE_MAX_PIXELS_PER_SECOND,
    );

    setTimelinePixelsPerSecond(nextScale);
    window.requestAnimationFrame(() => {
      const nextElement = timelineViewportRef.current;
      if (!nextElement) return;
      const nextScrollWidth = Math.max(1, timelineMetrics.displayDuration * nextScale);
      const targetScrollLeft =
        activeSide === 'right'
          ? (windowRight / trackWidth) * nextScrollWidth - nextElement.clientWidth
          : (windowLeft / trackWidth) * nextScrollWidth;
      nextElement.scrollLeft = clamp(
        targetScrollLeft,
        0,
        Math.max(0, nextScrollWidth - nextElement.clientWidth),
      );
      syncTimelineScrollInfo();
    });
  };

  const handleTimelineScrollThumbStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = timelineViewportRef.current;
    if (!element) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineScrollDragRef.current = {
      startX: event.clientX,
      startScrollLeft: element.scrollLeft,
      trackWidth: event.currentTarget.parentElement?.clientWidth || 1,
    };
  };

  const handleTimelineScrollThumbMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = timelineScrollDragRef.current;
    const element = timelineViewportRef.current;
    if (!drag || !element) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const maxThumbTravel = Math.max(
      1,
      drag.trackWidth - (element.clientWidth / element.scrollWidth) * drag.trackWidth,
    );
    element.scrollLeft = clamp(
      drag.startScrollLeft + ((event.clientX - drag.startX) / maxThumbTravel) * maxScrollLeft,
      0,
      maxScrollLeft,
    );
    syncTimelineScrollInfo();
  };

  const handleTimelineScrollThumbEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    timelineScrollDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleAssetScrollThumbStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = assetViewportRef.current;
    if (!element) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    assetScrollDragRef.current = {
      startY: event.clientY,
      startScrollTop: element.scrollTop,
      trackHeight: event.currentTarget.parentElement?.clientHeight || 1,
    };
  };

  const handleAssetScrollThumbMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = assetScrollDragRef.current;
    const element = assetViewportRef.current;
    if (!drag || !element) return;
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    const maxThumbTravel = Math.max(
      1,
      drag.trackHeight - (element.clientHeight / element.scrollHeight) * drag.trackHeight,
    );
    element.scrollTop = clamp(
      drag.startScrollTop + ((event.clientY - drag.startY) / maxThumbTravel) * maxScrollTop,
      0,
      maxScrollTop,
    );
    syncAssetScrollInfo();
  };

  const handleAssetScrollThumbEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    assetScrollDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const getUploadedAssetKind = (file: File) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'].includes(extension)) return 'image';
    if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(extension)) return 'video';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(extension)) return 'audio';
    return '';
  };

  const handleUploadedAssetFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const nextNodes: FlowNode[] = [];

    fileList.forEach((file, index) => {
      const kind = getUploadedAssetKind(file);
      if (!kind) return;

      const url = URL.createObjectURL(file);
      uploadedObjectUrlsRef.current.add(url);
      const title = file.name.replace(/\.[^/.]+$/, '') || file.name;
      nextNodes.push({
        id: `uploaded-asset-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        type: 'storyNode',
        position: { x: 0, y: 0 },
        data: {
          title,
          text: '',
          ...(kind === 'image' ? { imageUrl: url } : {}),
          ...(kind === 'video' ? { videoUrl: url } : {}),
          ...(kind === 'audio' ? { audioUrl: url } : {}),
        },
      });
    });

    if (nextNodes.length === 0) {
      setError(isZh ? '请选择图片、视频或音频文件。' : 'Choose image, video, or audio files.');
      return;
    }

    setUploadedAssetNodes((prev) => [...nextNodes, ...prev]);
    setAssetRegionFilter('all');
    setActivePreviewId(nextNodes[0].id);
    setError('');
  };

  const addAudioAssetFromBlob = (blob: Blob, title: string, generated = false) => {
    const url = URL.createObjectURL(blob);
    uploadedObjectUrlsRef.current.add(url);
    const node: FlowNode = {
      id: `generated-audio-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'storyNode',
      position: { x: 0, y: 0 },
      data: {
        title,
        text: '',
        audioUrl: url,
        ...(generated ? { ttsGenerated: true } : {}),
      },
    };
    setUploadedAssetNodes((prev) => [node, ...prev]);
    setAssetRegionFilter('all');
    setActivePreviewId(node.id);
    setAudioTrackByNodeId((prev) => ({ ...prev, [node.id]: audioTrackIds[0] || 'audio-1' }));
    setAudioMessage(isZh ? '音频已添加到素材栏，可拖到音频轨。' : 'Audio added to assets. Drag it to an audio track.');
    setError('');
  };

  const selectedSpeechText = (speechNodes = selectedSpeechNodes) =>
    speechNodes
      .map((node, index) => {
        const text = getSpeechTextForNode(node);
        return text ? `${index + 1}. ${text}` : '';
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();

  const generateAudioFromSelectedText = async (speechNodes = selectedSpeechNodes) => {
    if (audioBusy) return;
    const speechText = selectedSpeechText(speechNodes);
    if (!speechText) {
      setAudioMessage(
        isZh
          ? '选中的非视频片段没有可朗读文字。'
          : 'Selected non-video segments have no readable text.',
      );
      return;
    }
    closeContextMenu();
    setAudioBusy(true);
    setAudioMessage(
      isZh
        ? `正在为 ${speechNodes.length} 个片段生成语音...`
        : `Generating speech for ${speechNodes.length} segment(s)...`,
    );
    try {
      const audio = await generateSpeechAudio(
        speechText,
        voiceTtsConfig || {
          provider: 'system',
          apiUrl: '',
          apiKey: '',
          model: '',
          voice: '',
        },
      );
      addAudioAssetFromBlob(
        audio.blob,
        isZh ? `剧本文字配音 ${new Date().toLocaleTimeString()}` : `Script voiceover ${new Date().toLocaleTimeString()}`,
        true,
      );
    } catch (speechError) {
      const message =
        speechError instanceof Error
          ? speechError.message
          : isZh
            ? '文字转音频失败。'
            : 'Text to audio failed.';
      setAudioMessage(message);
    } finally {
      setAudioBusy(false);
    }
  };

  const startVoiceoverRecording = async () => {
    if (isRecordingVoiceover) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      voiceoverChunksRef.current = [];
      voiceoverStreamRef.current = stream;
      voiceoverRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceoverChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(voiceoverChunksRef.current, {
          type: mimeType || recorder.mimeType || 'audio/webm',
        });
        stream.getTracks().forEach((track) => track.stop());
        voiceoverStreamRef.current = null;
        voiceoverRecorderRef.current = null;
        voiceoverChunksRef.current = [];
        setIsRecordingVoiceover(false);
        if (blob.size > 0) {
          addAudioAssetFromBlob(
            blob,
            isZh ? `用户配音 ${new Date().toLocaleTimeString()}` : `Voiceover ${new Date().toLocaleTimeString()}`,
          );
        }
      };
      recorder.start();
      setIsRecordingVoiceover(true);
      setAudioMessage(isZh ? '正在录音，点击停止生成音频素材。' : 'Recording. Stop to create an audio asset.');
    } catch (recordError) {
      setIsRecordingVoiceover(false);
      setAudioMessage(
        recordError instanceof Error
          ? recordError.message
          : isZh
            ? '无法打开麦克风。'
            : 'Could not open the microphone.',
      );
    }
  };

  const stopVoiceoverRecording = () => {
    const recorder = voiceoverRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }
    voiceoverStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceoverStreamRef.current = null;
    setIsRecordingVoiceover(false);
  };

  const handleAssetUploadInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) handleUploadedAssetFiles(event.target.files);
    event.target.value = '';
  };

  const handleAssetFileDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleAssetFileDrop = (event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    event.stopPropagation();
    handleUploadedAssetFiles(event.dataTransfer.files);
  };

  const handleTimelineScaleHandleStart = (
    event: React.PointerEvent<HTMLButtonElement>,
    side: 'left' | 'right',
  ) => {
    const track = event.currentTarget.parentElement?.parentElement;
    if (!track) return;
    const trackWidth = track.clientWidth || 1;
    const thumbLeft = (timelineThumbLeftPercent / 100) * trackWidth;
    const thumbRight = thumbLeft + (timelineThumbWidthPercent / 100) * trackWidth;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineScaleDragRef.current = {
      side,
      anchorTrackX: side === 'left' ? thumbRight : thumbLeft,
      trackWidth,
    };
  };

  const handleAssetScaleHandleStart = (
    event: React.PointerEvent<HTMLButtonElement>,
    side: 'top' | 'bottom',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    assetScaleDragRef.current = {
      side,
      startY: event.clientY,
      startScale: assetCardScale,
    };
  };

  const handleTimelineScaleHandleMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = timelineScaleDragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const track = event.currentTarget.parentElement?.parentElement;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pointerTrackX = clamp(event.clientX - rect.left, 0, drag.trackWidth);
    if (drag.side === 'left') {
      applyTimelineViewportWindow(pointerTrackX, drag.anchorTrackX, drag.trackWidth, 'left');
      return;
    }
    applyTimelineViewportWindow(drag.anchorTrackX, pointerTrackX, drag.trackWidth, 'right');
  };

  const handleAssetScaleHandleMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = assetScaleDragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const dragDistance =
      drag.side === 'top' ? event.clientY - drag.startY : drag.startY - event.clientY;
    const scaleMultiplier = Math.exp(dragDistance / 180);
    updateAssetCardScale(drag.startScale * scaleMultiplier);
  };

  const handleTimelineScaleHandleEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    timelineScaleDragRef.current = null;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleAssetScaleHandleEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    assetScaleDragRef.current = null;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  React.useEffect(() => {
    const validIds = new Set(allAssetNodes.map((node) => node.id));
    const excludedSourceIds = new Set(
      [...timelineExcludedSourceIds].filter((sourceId) => validIds.has(sourceId)),
    );
    const getValidTimelineIds = (ids: string[]) =>
      ids.filter((id) => validIds.has(timelineSourceById[id] || id));
    setTimelineIds((prev) => {
      const kept = getValidTimelineIds(prev);
      const sourceIdsOnTimeline = new Set(kept.map((id) => timelineSourceById[id] || id));
      const missing = orderedNodes
        .map((node) => node.id)
        .filter((id) => !sourceIdsOnTimeline.has(id) && !excludedSourceIds.has(id));
      const next = [...kept, ...missing];
      return next.length === prev.length && next.every((id, index) => id === prev[index])
        ? prev
        : next;
    });
    setTimelineExcludedSourceIds((prev) => {
      const next = new Set([...prev].filter((sourceId) => validIds.has(sourceId)));
      return next.size === prev.size ? prev : next;
    });
    setTimelineSourceById((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([, sourceId]) => validIds.has(sourceId)),
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    },
    );
    setSelectedIds((prev) =>
      new Set([...prev].filter((id) => validIds.has(timelineSourceById[id] || id))),
    );
    setActivePreviewId((prev) =>
      prev && validIds.has(timelineSourceById[prev] || prev) ? prev : allAssetNodes[0]?.id || '',
    );
    setTimelineStartById((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => validIds.has(timelineSourceById[id] || id)),
      ),
    );
    setVideoTrackByNodeId((prev) => {
      const next: Record<string, string> = {};
      getValidTimelineIds(timelineIds).forEach((id) => {
        next[id] = videoTrackIds.includes(prev[id]) ? prev[id] : videoTrackIds[0];
      });
      return next;
    });
    setAudioTrackByNodeId((prev) => {
      const next: Record<string, string> = {};
      getValidTimelineIds(timelineIds).forEach((id) => {
        next[id] = audioTrackIds.includes(prev[id]) ? prev[id] : audioTrackIds[0];
      });
      return next;
    });
  }, [
    allAssetNodes,
    orderedNodes,
    videoTrackIds,
    audioTrackIds,
    timelineIds,
    timelineSourceById,
    timelineExcludedSourceIds,
  ]);

  React.useEffect(() => {
    const objectUrls = uploadedObjectUrlsRef.current;
    return () => {
      if (voiceoverRecorderRef.current?.state === 'recording') {
        voiceoverRecorderRef.current.stop();
      }
      voiceoverStreamRef.current?.getTracks().forEach((track) => track.stop());
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const snapshot: PersistedRenderWorkspaceState = {
      workspaceMode,
      selectedIds: [...selectedIds],
      timelineIds,
      timelineSourceById,
      timelineExcludedSourceIds: [...timelineExcludedSourceIds],
      videoTrackIds,
      audioTrackIds,
      videoTrackByNodeId,
      audioTrackByNodeId,
      timelineStartById,
      timelinePast: timelinePast.slice(-50),
      timelineFuture: timelineFuture.slice(0, 50),
      activePreviewId,
      assetRegionFilter,
      resolutionIndex,
      exportFormat,
      speed,
      defaultSeconds,
      animationLeadSeconds,
      frameRate,
      encoder,
      outputDir,
      webOutputDir,
      renderStyle,
      assetPanelWidth,
      assetCardLayout,
      assetCardScale,
      exportPanelWidth,
      exportSettingsMode,
      timelineHeight,
      timelineScaleMode,
      timelineWheelMode,
      timelineSnapEnabled,
      timelinePixelsPerSecond,
      timelineDisplayDuration,
      timelinePreviewTime,
      useGpuAcceleration,
      savedAt: Date.now(),
    };
    try {
      window.localStorage.setItem(renderWorkspaceStorageKey(workspaceKey), JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota/private-mode failures; the render workspace still works in-memory.
    }
  }, [
    activePreviewId,
    animationLeadSeconds,
    assetCardLayout,
    assetCardScale,
    assetPanelWidth,
    assetRegionFilter,
    audioTrackByNodeId,
    audioTrackIds,
    defaultSeconds,
    encoder,
    exportFormat,
    exportPanelWidth,
    exportSettingsMode,
    frameRate,
    outputDir,
    renderStyle,
    resolutionIndex,
    selectedIds,
    speed,
    timelineDisplayDuration,
    timelineHeight,
    timelineIds,
    timelineExcludedSourceIds,
    timelineFuture,
    useGpuAcceleration,
    timelinePast,
    timelinePixelsPerSecond,
    timelinePreviewTime,
    timelineScaleMode,
    timelineSnapEnabled,
    timelineSourceById,
    timelineStartById,
    timelineWheelMode,
    videoTrackByNodeId,
    videoTrackIds,
    webOutputDir,
    workspaceKey,
    workspaceMode,
  ]);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === modalRootRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  React.useEffect(() => {
    if (assetRegionFilter === 'all' || assetRegionFilter === 'outside') return;
    if (!assetRegionOptions.some((option) => option.id === assetRegionFilter)) {
      setAssetRegionFilter('all');
    }
  }, [assetRegionFilter, assetRegionOptions]);

  React.useEffect(() => {
    if (preservePreviewTimeOnNodeChangeRef.current) {
      preservePreviewTimeOnNodeChangeRef.current = false;
      return;
    }
    setPreviewTime(0);
    setPreviewPlaying(false);
  }, [focusedPreviewNode?.id]);

  React.useEffect(() => {
    setPreviewTime((prev) => Math.min(prev, previewDuration));
  }, [previewDuration]);

  React.useEffect(() => {
    setTimelinePreviewTime((prev) => Math.min(prev, timelineMetrics.totalDuration));
  }, [timelineMetrics.totalDuration]);

  React.useEffect(() => {
    setAssetPanelWidth((prev) => clamp(prev, PANEL_SIZE_LIMITS.asset.min, assetPanelMax));
  }, [assetPanelMax]);

  React.useEffect(() => {
    setExportPanelWidth((prev) => clamp(prev, PANEL_SIZE_LIMITS.export.min, exportPanelMax));
  }, [exportPanelMax]);

  React.useEffect(() => {
    setTimelineHeight((prev) => clamp(prev, PANEL_SIZE_LIMITS.timeline.min, timelineMax));
  }, [timelineMax]);

  React.useEffect(() => {
    const viewportSeconds = Math.max(
      1,
      timelineScrollInfo.clientWidth / Math.max(1, timelineMetrics.pixelsPerSecond),
    );
    const minimumDisplayDuration = Math.max(
      60,
      timelineMetrics.totalDuration + viewportSeconds * 2,
    );
    if (timelineDisplayDuration < minimumDisplayDuration) {
      setTimelineDisplayDuration(Math.ceil(minimumDisplayDuration));
    }
  }, [
    timelineDisplayDuration,
    timelineMetrics.pixelsPerSecond,
    timelineMetrics.totalDuration,
    timelineScrollInfo.clientWidth,
  ]);

  React.useEffect(() => {
    syncTimelineScrollInfo();
  }, [timelineMetrics.width, timelineHeight]);

  React.useEffect(() => {
    syncAssetScrollInfo();
  }, [assetCardLayout, assetCardScale, assetPanelWidth, visibleAssetNodes.length]);

  React.useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    const loadDefaultDir = async () => {
      try {
        const result = await getDefaultRenderDir();
        if (!cancelled) setOutputDir(result.path);
      } catch {
        if (!cancelled) setOutputDir('');
      }
    };
    loadDefaultDir();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const measureDuration = async () => {
      let total = 0;
      for (const node of selectedNodes) {
        if (cancelled) return;
        total += await getNodeMediaDuration(node);
      }
      if (!cancelled) setEstimatedDuration(total / speed);
    };
    measureDuration();
    return () => {
      cancelled = true;
    };
  }, [selectedNodes, defaultSeconds, speed]);

  const toggleNode = (id: string) => {
    closeContextMenu();
    pushTimelineHistory();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addNodeToTimeline = (
    id: string,
    trackKind: 'video' | 'audio' = 'video',
    trackId?: string,
    startTime?: number,
  ) => {
    const sourceNode = assetNodeById.get(id);
    if (!sourceNode) return;
    const normalizedTrackKind = isAudioOnlyNode(sourceNode) ? 'audio' : trackKind;
    const normalizedTrackId =
      normalizedTrackKind === 'audio'
        ? (trackKind === 'video' && trackId
          ? audioTrackIds[videoTrackIds.indexOf(trackId)] || makeTrackId('audio')
          : trackId) ||
        audioTrackIds[0] ||
        'audio-1'
        : trackId;
    const timelineId = makeTimelineClipInstanceId(id);
    closeContextMenu();
    pushTimelineHistory();
    setTimelineExcludedSourceIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setTimelineIds((prev) => [...prev, timelineId]);
    setTimelineSourceById((prev) => ({ ...prev, [timelineId]: id }));
    if (normalizedTrackKind === 'video' && normalizedTrackId) {
      setVideoTrackByNodeId((prev) => ({ ...prev, [timelineId]: normalizedTrackId }));
      assignAudioTrackForVideoPlacement(
        timelineId,
        Math.max(0, startTime ?? 0),
        Math.max(0.25, defaultSeconds / speed),
        normalizedTrackId,
      );
    }
    if (normalizedTrackKind === 'audio' && normalizedTrackId) {
      setAudioTrackIds((prev) =>
        prev.includes(normalizedTrackId) ? prev : [...prev, normalizedTrackId],
      );
      setAudioTrackByNodeId((prev) => ({ ...prev, [timelineId]: normalizedTrackId }));
      setVideoTrackByNodeId((prev) => {
        const { [timelineId]: _removed, ...next } = prev;
        return next;
      });
    }
    if (typeof startTime === 'number') {
      setTimelineStartById((prev) => ({ ...prev, [timelineId]: Math.max(0, startTime) }));
    }
    setSelectedIds((prev) => new Set(prev).add(timelineId));
    setActivePreviewId(timelineId);
  };

  const reorderTimelineNode = (
    dragId: string,
    targetId: string,
    placement: 'before' | 'after' = 'before',
  ) => {
    if (!dragId || !targetId || dragId === targetId) return;
    closeContextMenu();
    pushTimelineHistory();
    setTimelineIds((prev) => {
      const withoutDragged = prev.filter((id) => id !== dragId);
      const targetIndex = withoutDragged.indexOf(targetId);
      if (targetIndex < 0) return prev;
      const next = [...withoutDragged];
      next.splice(placement === 'after' ? targetIndex + 1 : targetIndex, 0, dragId);
      return next;
    });
  };

  const removeTimelineNode = (id: string) => {
    if (!timelineIds.includes(id)) return;
    const sourceId = timelineSourceById[id] || id;
    const hasAnotherInstanceOfSource = timelineIds.some(
      (timelineId) => timelineId !== id && (timelineSourceById[timelineId] || timelineId) === sourceId,
    );
    closeContextMenu();
    pushTimelineHistory();
    setTimelineIds((prev) => prev.filter((item) => item !== id));
    if (!hasAnotherInstanceOfSource) {
      setTimelineExcludedSourceIds((prev) => new Set(prev).add(sourceId));
    }
    setTimelineSourceById((prev) => {
      const { [id]: _removed, ...next } = prev;
      return next;
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (activePreviewId === id) {
      const nextNode =
        timelineNodes.find((node) => node.id !== id) || orderedNodes.find((node) => node.id !== id);
      setActivePreviewId(nextNode?.id || '');
    }
    if (focusedPreviewId === id) {
      setFocusedPreviewId('');
    }
    setVideoTrackByNodeId((prev) => {
      const { [id]: _removed, ...next } = prev;
      return next;
    });
    setAudioTrackByNodeId((prev) => {
      const { [id]: _removed, ...next } = prev;
      return next;
    });
    setTimelineStartById((prev) => {
      const { [id]: _removed, ...next } = prev;
      return next;
    });
  };

  const removeVideoTrack = (trackId: string) => {
    if (videoTrackIds.length <= 1) return;
    closeContextMenu();
    pushTimelineHistory();
    setVideoTrackIds((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((id) => id !== trackId);
      setVideoTrackByNodeId((map) =>
        Object.fromEntries(
          Object.entries(map).map(([nodeId, assignedTrackId]) => [
            nodeId,
            assignedTrackId === trackId ? next[0] : assignedTrackId,
          ]),
        ),
      );
      return next;
    });
  };

  const removeAudioTrack = (trackId: string) => {
    if (audioTrackIds.length <= 1) return;
    closeContextMenu();
    pushTimelineHistory();
    setAudioTrackIds((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((id) => id !== trackId);
      setAudioTrackByNodeId((map) =>
        Object.fromEntries(
          Object.entries(map).map(([nodeId, assignedTrackId]) => [
            nodeId,
            assignedTrackId === trackId ? next[0] : assignedTrackId,
          ]),
        ),
      );
      return next;
    });
  };

  const addVideoTrack = () => {
    closeContextMenu();
    pushTimelineHistory();
    setVideoTrackIds((prev) => [...prev, makeTrackId('video')]);
  };

  const addAudioTrack = () => {
    closeContextMenu();
    pushTimelineHistory();
    setAudioTrackIds((prev) => [...prev, makeTrackId('audio')]);
  };

  const previewNode = (id: string) => {
    if (!nodeById.has(id)) return;
    closeContextMenu();
    if (timelineMetricById.has(id)) {
      focusTimelineSegment(id);
      return;
    }
    setActivePreviewId(id);
    setPreviewTime(0);
    setPreviewPlaying(false);
  };

  const selectTimelineFromNode = (id: string) => {
    const startIndex = timelineIds.indexOf(id);
    if (startIndex < 0) return;
    closeContextMenu();
    pushTimelineHistory();
    setSelectedIds(new Set(timelineIds.slice(startIndex)));
    setActivePreviewId(id);
    setPreviewTime(0);
    setPreviewPlaying(false);
  };

  const selectOnlyNode = (id: string) => {
    if (!timelineIds.includes(id)) return;
    closeContextMenu();
    pushTimelineHistory();
    setSelectedIds(new Set([id]));
    setActivePreviewId(id);
  };

  const selectAllTimelineNodes = () => {
    closeContextMenu();
    pushTimelineHistory();
    setSelectedIds(new Set(timelineIds));
  };

  const clearTimelineSelection = () => {
    closeContextMenu();
    pushTimelineHistory();
    setFocusedPreviewId('');
    setSelectedIds(new Set());
  };

  const boxSelectTimelineNodes = (ids: string[], additive: boolean) => {
    closeContextMenu();
    pushTimelineHistory();
    setFocusedPreviewId('');
    setPreviewPlaying(false);
    setSelectedIds((prev) => {
      if (!additive) return new Set(ids);
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    if (ids[0]) {
      setActivePreviewId(ids[0]);
      const metric = timelineMetricById.get(ids[0]);
      if (metric) setTimelinePreviewTime(metric.start);
    }
  };

  const focusTimelineSegment = (nodeId: string) => {
    const metric = timelineMetricById.get(nodeId);
    if (!metric) return;
    preservePreviewTimeOnNodeChangeRef.current = true;
    setFocusedPreviewId(nodeId);
    setActivePreviewId(nodeId);
    setTimelinePreviewTime(metric.start);
    setPreviewTime(0);
    setPreviewPlaying(false);
  };

  const assignNodeTrack = (id: string, trackKind: 'video' | 'audio', trackId: string) => {
    if (!timelineIds.includes(id)) return;
    closeContextMenu();
    pushTimelineHistory();
    if (trackKind === 'video') {
      setVideoTrackByNodeId((prev) => ({ ...prev, [id]: trackId }));
      assignAudioTrackForVideoPlacement(
        id,
        timelineMetricById.get(id)?.start ?? timelineStartById[id] ?? 0,
        timelineMetricById.get(id)?.duration || Math.max(0.25, defaultSeconds / speed),
        trackId,
      );
      return;
    }
    setAudioTrackByNodeId((prev) => ({ ...prev, [id]: trackId }));
  };

  const addNearestAssetToTimeline = (trackKind: 'video' | 'audio' = 'video') => {
    const node = visibleAssetNodes[0];
    if (!node) return;
    addNodeToTimeline(node.id, trackKind);
  };

  const handleAssetDragStart = (
    event: React.DragEvent,
    id: string,
    trackKind?: 'video' | 'audio',
    dragOffsetSeconds = 0,
  ) => {
    event.stopPropagation();
    event.dataTransfer.setData('application/x-galwriter-node', id);
    event.dataTransfer.setData(
      'application/x-galwriter-drag-origin',
      trackKind ? 'timeline' : 'asset',
    );
    if (trackKind) event.dataTransfer.setData('application/x-galwriter-track-kind', trackKind);
    event.dataTransfer.setData(
      'application/x-galwriter-drag-offset-seconds',
      String(Math.max(0, dragOffsetSeconds)),
    );
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleTimelineDrop = (
    event: React.DragEvent,
    targetId?: string,
    trackId?: string,
    trackKind?: 'video' | 'audio',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedId =
      event.dataTransfer.getData('application/x-galwriter-node') ||
      event.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    const dragOrigin = event.dataTransfer.getData('application/x-galwriter-drag-origin');
    const isTimelineClip = dragOrigin === 'timeline' && timelineIds.includes(draggedId);
    if (!isTimelineClip && !assetNodeById.has(draggedId)) return;
    let droppedTrackKind =
      trackKind ||
      (event.dataTransfer.getData('application/x-galwriter-track-kind') as 'video' | 'audio') ||
      'video';
    let droppedTrackId = trackId;
    const draggedSourceNode = isTimelineClip
      ? timelineNodeById.get(draggedId)
      : assetNodeById.get(draggedId);
    const draggingAudioOnly = isAudioOnlyNode(draggedSourceNode);
    if (draggingAudioOnly) {
      droppedTrackKind = 'audio';
      if (trackKind === 'video' && trackId) {
        droppedTrackId = audioTrackIds[videoTrackIds.indexOf(trackId)] || makeTrackId('audio');
      } else {
        droppedTrackId = trackId || audioTrackIds[0];
      }
    }
    if (draggingAudioOnly || droppedTrackId) {
      const trackElement = (event.currentTarget as HTMLElement).closest(
        '[data-render-track-kind]',
      ) as HTMLElement | null;
      const rect = (trackElement || (event.currentTarget as HTMLElement)).getBoundingClientRect();
      const dragOffsetSeconds =
        Number.parseFloat(
          event.dataTransfer.getData('application/x-galwriter-drag-offset-seconds'),
        ) || 0;
      const timelineId = isTimelineClip ? draggedId : makeTimelineClipInstanceId(draggedId);
      const duration = isTimelineClip
        ? timelineMetricById.get(draggedId)?.duration || Math.max(0.25, defaultSeconds / speed)
        : Math.max(0.25, defaultSeconds / speed);
      const droppedTime =
        (event.clientX - rect.left) / Math.max(1, timelineMetrics.pixelsPerSecond) -
        dragOffsetSeconds;
      const placementTrackId = droppedTrackId || audioTrackIds[0] || makeTrackId('audio');
      const nextStart = draggingAudioOnly
        ? snapToTimelineClipEdges(timelineId, droppedTime, duration)
        : findNonOverlappingTrackStart(
          timelineId,
          droppedTime,
          duration,
          droppedTrackKind,
          placementTrackId,
        );
      if (droppedTrackKind === 'audio') {
        droppedTrackId = getAudioDropTrackId(timelineId, nextStart, duration, droppedTrackId);
      } else {
        droppedTrackId = placementTrackId;
      }
      const resolvedTrackId = droppedTrackId || placementTrackId;
      const shouldPreservePlayhead = timelineId === activePreviewId;
      const preservedTimelineTime = activeTimelineTime;

      pushTimelineHistory();
      setTimelineIds((prev) => (prev.includes(timelineId) ? prev : [...prev, timelineId]));
      if (!isTimelineClip) {
        setTimelineSourceById((prev) => ({ ...prev, [timelineId]: draggedId }));
      }
      if (droppedTrackKind === 'video') {
        setVideoTrackByNodeId((prev) => ({ ...prev, [timelineId]: resolvedTrackId }));
        assignAudioTrackForVideoPlacement(timelineId, nextStart, duration, resolvedTrackId);
      } else {
        setAudioTrackByNodeId((prev) => ({ ...prev, [timelineId]: resolvedTrackId }));
        setVideoTrackByNodeId((prev) => {
          const next = { ...prev };
          delete next[timelineId];
          return next;
        });
      }
      setTimelineStartById((prev) => ({ ...prev, [timelineId]: nextStart }));
      if (shouldPreservePlayhead) {
        preservePreviewTimeOnNodeChangeRef.current = true;
        setPreviewTime(clamp((preservedTimelineTime - nextStart) * speed, 0, duration * speed));
      }
      setSelectedIds((prev) => new Set(prev).add(timelineId));
      if (!activePreviewId || !isTimelineClip) setActivePreviewId(timelineId);
      return;
    }

    if (targetId && isTimelineClip) {
      reorderTimelineNode(
        draggedId,
        targetId,
        event.clientX > (event.currentTarget as HTMLElement).getBoundingClientRect().left
          ? 'after'
          : 'before',
      );
    } else addNodeToTimeline(draggedId, droppedTrackKind, droppedTrackId);
  };

  const handleTimelineWheel = (event: WheelEvent) => {
    if (timelineWheelMode === 'vertical') return;
    event.preventDefault();
    event.stopPropagation();
    const element = timelineViewportRef.current;
    if (!element) return;
    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const scrollDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (maxScrollLeft <= 0 || scrollDelta === 0) return;

    const movingRight = scrollDelta > 0;
    const canMoveRight = element.scrollLeft < maxScrollLeft - 1;
    const canMoveLeft = element.scrollLeft > 1;
    if ((movingRight && canMoveRight) || (!movingRight && canMoveLeft)) {
      element.scrollLeft += scrollDelta;
      syncTimelineScrollInfo();
      return;
    }

    if (movingRight && !canMoveRight) {
      const viewportSeconds = Math.max(
        1,
        element.clientWidth / Math.max(1, timelineMetrics.pixelsPerSecond),
      );
      setTimelineDisplayDuration((prev) => Math.ceil(prev + Math.max(30, viewportSeconds * 2)));
    }
  };

  React.useEffect(() => {
    const element = timelineViewportRef.current;
    if (!element) return;
    element.addEventListener('wheel', handleTimelineWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleTimelineWheel);
  }, [handleTimelineWheel]);

  React.useEffect(() => {
    if (!contextMenu) return undefined;
    const handleCloseMenu = () => closeContextMenu();
    const handleMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };
    document.addEventListener('pointerdown', handleCloseMenu);
    document.addEventListener('scroll', handleCloseMenu, true);
    document.addEventListener('keydown', handleMenuKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleCloseMenu);
      document.removeEventListener('scroll', handleCloseMenu, true);
      document.removeEventListener('keydown', handleMenuKeyDown, true);
    };
  }, [contextMenu]);

  React.useEffect(() => {
    const handleRenderKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        !!target?.isContentEditable;
      if (isEditingText) return;

      if (event.code === 'Space' && !modifier && !event.altKey && !event.shiftKey) {
        if (workspaceMode !== 'video') return;
        event.stopPropagation();
        event.preventDefault();
        if (!activePreviewNode || status === 'rendering') return;
        if (activeTimelineTime >= timelineMetrics.totalDuration - 0.001) {
          seekTimelineTime(0, { keepPlaying: true });
        }
        setPreviewPlaying((prev) => !prev);
        return;
      }

      if (!modifier || (key !== 'z' && key !== 'y')) return;

      event.stopPropagation();
      event.preventDefault();
      if (workspaceMode === 'web') {
        if (key === 'z' && event.shiftKey) redoWeb();
        else if (key === 'z') undoWeb();
        else redoWeb();
        return;
      }
      if (key === 'z' && event.shiftKey) redoTimeline();
      else if (key === 'z') undoTimeline();
      else redoTimeline();
    };

    document.addEventListener('keydown', handleRenderKeyDown, true);
    return () => document.removeEventListener('keydown', handleRenderKeyDown, true);
  });

  const updateRenderStyle = <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => {
    setRenderStyle((prev) => ({ ...prev, [key]: value }));
  };

  const updateProgress = (label: string, current: number, total: number) => {
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    setProgress(`${label} ${percent}%`);
    setProgressValue(percent);
  };

  const stopPreviewAudio = () => {
    previewAudioRefs.current.forEach((audio) => audio.pause());
    previewAudioRefs.current.clear();
  };

  const syncPreviewAudioSegments = async (
    segments: { key: string; audioUrl: string; localTime: number }[],
    shouldPlay: boolean,
  ) => {
    if (status === 'rendering' || segments.length === 0) {
      stopPreviewAudio();
      return;
    }

    const desiredKeys = new Set(segments.map((segment) => segment.key));
    previewAudioRefs.current.forEach((audio, key) => {
      if (desiredKeys.has(key)) return;
      audio.pause();
      previewAudioRefs.current.delete(key);
    });

    for (const segment of segments) {
      let audio = previewAudioRefs.current.get(segment.key);
      if (!audio || audio.src !== segment.audioUrl) {
        audio?.pause();
        audio = new Audio(segment.audioUrl);
        audio.crossOrigin = 'anonymous';
        previewAudioRefs.current.set(segment.key, audio);
      }

      audio.playbackRate = speed;
      const targetTime = Math.max(0, segment.localTime);
      const nextTime = Number.isFinite(audio.duration)
        ? Math.min(Math.max(0, audio.duration - 0.05), targetTime)
        : targetTime;
      if (!shouldPlay || audio.paused || Math.abs(audio.currentTime - nextTime) > 0.35) {
        audio.currentTime = nextTime;
      }

      if (shouldPlay) {
        await audio.play().catch(() => undefined);
      } else {
        audio.pause();
      }
    }
  };

  const syncPreviewAudio = async (
    audioUrl: string | undefined,
    localTime: number,
    shouldPlay: boolean,
  ) => {
    await syncPreviewAudioSegments(
      audioUrl ? [{ key: 'focused', audioUrl, localTime }] : [],
      shouldPlay,
    );
  };

  const getNodeMediaDuration = async (node: FlowNode) => {
    const videoUrl = node.data?.videoUrl as string | undefined;
    const audioUrl = node.data?.audioUrl as string | undefined;
    let videoDuration = 0;
    let audioDuration = 0;

    if (videoUrl) {
      try {
        const video = await loadVideo(videoUrl);
        videoDuration = validDuration(video.duration);
      } catch {
        videoDuration = 0;
      }
    }

    if (audioUrl) {
      audioDuration = validDuration(await getAudioDuration(audioUrl));
    }

    return Math.max(videoDuration, audioDuration, defaultSeconds);
  };

  const getNodeRenderDuration = async (node: FlowNode) => {
    return (await getNodeMediaDuration(node)) / speed;
  };

  React.useEffect(() => {
    let cancelled = false;
    const measureTimelineDurations = async () => {
      const entries: [string, number][] = [];
      for (const node of timelineNodes) {
        if (cancelled) return;
        entries.push([node.id, await getNodeMediaDuration(node)]);
      }
      if (!cancelled) setTimelineDurationById(Object.fromEntries(entries));
    };
    measureTimelineDurations();
    return () => {
      cancelled = true;
    };
  }, [timelineNodes, defaultSeconds]);

  // renderStaticFramesWithFfmpeg 和 ensureFfmpegForDesktopTranscode 已移除，
  // 统一使用 mediabunny 浏览器内编码


  const drawFrame = async (
    ctx: CanvasRenderingContext2D,
    node: FlowNode,
    width: number,
    height: number,
    media?: { source: CanvasImageSource; width: number; height: number },
    elapsed?: number,
    duration?: number,
    forceFinalText = false,
  ) => {
    await drawRenderFrame({
      ctx,
      node,
      width,
      height,
      media,
      elapsed,
      duration,
      forceFinalText,
      renderStyle,
      animationLeadSeconds,
      isZh,
    });
  };

  const getTopVisualTimelineSegment = (time: number) => {
    const candidates = timelineMetrics.segments.filter((metric) => {
      const trackId = videoTrackByNodeId[metric.node.id] || videoTrackIds[0];
      return (
        videoTrackIds.includes(trackId) &&
        time >= metric.start &&
        time < metric.end &&
        (metric.node.data?.videoUrl || metric.node.data?.imageUrl || segmentText(metric.node))
      );
    });
    return candidates.sort((a, b) => {
      const aTrackIndex = videoTrackIds.indexOf(videoTrackByNodeId[a.node.id] || videoTrackIds[0]);
      const bTrackIndex = videoTrackIds.indexOf(videoTrackByNodeId[b.node.id] || videoTrackIds[0]);
      return bTrackIndex - aTrackIndex;
    })[0];
  };

  const drawTimelineCompositeFrame = async (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
  ) => {
    const segment = getTopVisualTimelineSegment(time);
    if (!segment) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const localTime = clamp((time - segment.start) * speed, 0, segment.duration * speed);
    const videoUrl = segment.node.data?.videoUrl as string | undefined;
    if (videoUrl) {
      if (previewVideoRef.current?.url !== videoUrl) {
        previewVideoRef.current = { url: videoUrl, video: await loadVideo(videoUrl) };
      }
      const video = previewVideoRef.current.video;
      await seekVideo(video, localTime);
      await drawFrame(
        ctx,
        segment.node,
        width,
        height,
        {
          source: video,
          width: video.videoWidth || width,
          height: video.videoHeight || height,
        },
        localTime,
        segment.duration * speed,
      );
      return;
    }

    await drawFrame(ctx, segment.node, width, height, undefined, localTime, segment.duration * speed);
  };

  const renderVideo = async () => {
    if (selectedNodes.length === 0 || status === 'rendering') return;

    const canvas2d = canvasRef.current;
    const ctx2d = canvas2d?.getContext('2d');
    if (!canvas2d || !ctx2d) return;

    setStatus('rendering');
    setError('');
    setSavedPath('');
    setProgressValue(0);
    setProgress(isZh ? '准备渲染 0%' : 'Preparing render 0%');

    // 尝试初始化 GPU（如果用户启用且设备支持）
    let gpuCanvas: HTMLCanvasElement | null = null;
    let gpuContext: Awaited<ReturnType<typeof initWebGPU>> | null = null;
    const shouldTryGpu = useGpuAcceleration && isWebGPUSupported();

    if (shouldTryGpu) {
      try {
        gpuContext = await initWebGPU(resolution.width, resolution.height);
        if (gpuContext) {
          gpuCanvas = gpuContext.canvas;
          setProgress(isZh ? 'GPU 加速已启用' : 'GPU acceleration enabled');
        }
      } catch (gpuErr) {
        console.warn('[GPU] 初始化失败，回退到 2D Canvas:', gpuErr);
      }
    }

    const useGpu = gpuContext !== null && gpuCanvas !== null;
    const canvas = useGpu ? gpuCanvas! : canvas2d;

    try {
      canvas.width = resolution.width;
      canvas.height = resolution.height;

      // 计算每个节点的渲染时长
      const nodeDurations: number[] = [];
      let totalDuration = 0;
      for (const node of selectedNodes) {
        const duration = await getNodeRenderDuration(node);
        nodeDurations.push(duration);
        totalDuration += duration;
      }

      const totalFrames = Math.max(1, Math.ceil(totalDuration * frameRate));

      // 准备时间线音频
      const audioSegments: SegmentRenderInfo[] = activeAudioSegments
        .filter((segment) => selectedIds.has(segment.node.id))
        .flatMap((segment) =>
          getSegmentAudioSources(segment.node).map((source) => ({
            node: segment.node,
            startSecs: segment.start,
            durationSecs: segment.duration,
            audioUrl: source.url,
          })),
        );

      const audioBuffer = await buildAudioBuffer(audioSegments, speed);

      // 预加载视频资源
      const videoCache = new Map<string, HTMLVideoElement>();
      for (const node of selectedNodes) {
        const videoUrl = node.data?.videoUrl as string | undefined;
        if (videoUrl && !videoCache.has(videoUrl)) {
          videoCache.set(videoUrl, await loadVideo(videoUrl));
        }
      }

      // 计算每个节点的起始时间
      const nodeStartTimes: number[] = [];
      let acc = 0;
      for (const d of nodeDurations) {
        nodeStartTimes.push(acc);
        acc += d;
      }

      // 逐帧绘制回调（2D 路径）
      const drawFrame2D = async (_frameIndex: number, timestamp: number) => {
        let nodeIndex = selectedNodes.length - 1;
        for (let i = 0; i < selectedNodes.length; i++) {
          if (timestamp < nodeStartTimes[i] + nodeDurations[i]) {
            nodeIndex = i;
            break;
          }
        }

        const node = selectedNodes[nodeIndex];
        const nodeStart = nodeStartTimes[nodeIndex];
        const nodeDuration = nodeDurations[nodeIndex];
        const localTime = (timestamp - nodeStart) * speed;

        const videoUrl = node.data?.videoUrl as string | undefined;
        if (videoUrl) {
          const video = videoCache.get(videoUrl);
          if (video) {
            await seekVideo(video, Math.min(localTime, validDuration(video.duration)));
            await drawFrame(
              ctx2d,
              node,
              resolution.width,
              resolution.height,
              {
                source: video,
                width: video.videoWidth || resolution.width,
                height: video.videoHeight || resolution.height,
              },
              localTime,
              nodeDuration * speed,
            );
          }
        } else {
          await drawFrame(
            ctx2d,
            node,
            resolution.width,
            resolution.height,
            undefined,
            localTime,
            nodeDuration * speed,
          );
        }

        setProgress(`${nodeIndex + 1}/${selectedNodes.length} ${String(node.data?.title || '')}`);
      };

      // 逐帧绘制回调（GPU 路径）
      const drawFrameGPU = async (_frameIndex: number, timestamp: number) => {
        if (!gpuContext) return;
        let nodeIndex = selectedNodes.length - 1;
        for (let i = 0; i < selectedNodes.length; i++) {
          if (timestamp < nodeStartTimes[i] + nodeDurations[i]) {
            nodeIndex = i;
            break;
          }
        }

        const node = selectedNodes[nodeIndex];
        const nodeStart = nodeStartTimes[nodeIndex];
        const nodeDuration = nodeDurations[nodeIndex];
        const localTime = (timestamp - nodeStart) * speed;

        const videoUrl = node.data?.videoUrl as string | undefined;
        let media: { source: CanvasImageSource; width: number; height: number } | undefined;
        if (videoUrl) {
          const video = videoCache.get(videoUrl);
          if (video) {
            await seekVideo(video, Math.min(localTime, validDuration(video.duration)));
            media = {
              source: video,
              width: video.videoWidth || resolution.width,
              height: video.videoHeight || resolution.height,
            };
          }
        }

        await drawGPUFrame({
          gpu: gpuContext,
          node,
          width: resolution.width,
          height: resolution.height,
          renderStyle,
          animationLeadSeconds,
          isZh,
          media,
          elapsed: localTime,
          duration: nodeDuration * speed,
        });

        setProgress(`${nodeIndex + 1}/${selectedNodes.length} ${String(node.data?.title || '')}`);
      };

      // 动态导入 mediabunny 编码器
      const { renderVideoToBuffer } = await import('./export/browserVideoEncoder');

      const bytes = await renderVideoToBuffer({
        canvas,
        format: exportFormat,
        frameRate,
        totalFrames,
        drawFrame: useGpu ? drawFrameGPU : drawFrame2D,
        audioBuffer: audioBuffer || undefined,
        onProgress: (current, total) => {
          setProgressValue(Math.round((current / total) * 100));
        },
      });

      // 保存/下载
      if (isDesktopApp) {
        const result = await saveRenderedVideo({
          fileName: `galwriter-render-${Date.now()}`,
          format: exportFormat,
          bytes: Array.from(bytes),
          outputDir,
          videoBitrate: DEFAULT_VIDEO_BITRATE,
        });
        setSavedPath(result.path);
      } else {
        const mimeType = exportFormat === 'webm' ? 'video/webm' : 'video/mp4';
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `galwriter-render-${Date.now()}.${exportFormat}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      setStatus('done');
      setProgressValue(100);
      setProgress(isZh ? '导出完成 100%' : 'Export complete 100%');
    } catch (renderError: any) {
      console.error('Video render failed:', renderError);
      setStatus('error');
      setError(renderError?.message || (isZh ? '视频渲染失败' : 'Video render failed'));
    } finally {
      if (useGpu) {
        destroyWebGPU();
        clearGPUTextCache();
      }
    }
  };

  const exportWebProject = async () => {
    if (status === 'rendering') return;
    const storyNodes = nodes.filter((node) => node.type === 'storyNode' && !node.data?.hidden);
    if (storyNodes.length === 0) {
      setStatus('error');
      setError(isZh ? '没有可导出的剧本节点' : 'No story nodes to export');
      return;
    }
    const exportTitle = webProjectName.trim() || defaultWebProjectName || 'galwriter-web';

    setStatus('rendering');
    setError('');
    setSavedPath('');
    setProgressValue(15);
    setProgress(isZh ? '正在生成网页 ZIP...' : 'Generating web ZIP...');

    try {
      const webExportOptions = {
        projectName: exportTitle,
        language,
        style: {
          ...webRenderStyle,
          choiceColor: webChoiceColor,
          choiceTextColor: webChoiceTextColor,
        },
        settings: webSettings,
      };

      if (isTauriRuntime()) {
        const blob = await buildInteractiveWebZipBlob(storyNodes, edges, webExportOptions);
        setProgressValue(70);
        setProgress(isZh ? '正在保存网页 ZIP...' : 'Saving web ZIP...');
        const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
        const result = await saveRenderedWebZip({
          fileName: `${exportTitle}-web`,
          bytes,
          outputDir: webOutputDir,
        });
        setSavedPath(result.path);
      } else {
        await exportInteractiveWebZip(storyNodes, edges, webExportOptions);
        setSavedPath(`${exportTitle}-web.zip`);
      }
      setStatus('done');
      setProgressValue(100);
      setProgress(isZh ? '网页 ZIP 已导出' : 'Web ZIP exported');
    } catch (exportError: any) {
      console.error('Web export failed:', exportError);
      setStatus('error');
      setError(exportError?.message || (isZh ? '网页导出失败' : 'Web export failed'));
    }
  };

  React.useEffect(() => {
    if (!focusedPreviewNode) {
      setPreviewDuration(Math.max(0.1, timelineMetrics.totalDuration));
      return;
    }

    let cancelled = false;
    const loadPreviewDuration = async () => {
      const duration = await getNodeMediaDuration(focusedPreviewNode);
      if (!cancelled) setPreviewDuration(duration);
    };
    loadPreviewDuration();
    return () => {
      cancelled = true;
    };
  }, [focusedPreviewNode, defaultSeconds, timelineMetrics.totalDuration]);

  React.useEffect(() => {
    if (status === 'rendering') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let cancelled = false;
    if (canvas.width !== resolution.width) canvas.width = resolution.width;
    if (canvas.height !== resolution.height) canvas.height = resolution.height;

    const drawPreview = async () => {
      const drawId = ++previewDrawIdRef.current;
      if (!focusedPreviewNode) {
        await drawTimelineCompositeFrame(
          ctx,
          resolution.width,
          resolution.height,
          timelinePreviewTime,
        );
        return;
      }

      const videoUrl = focusedPreviewNode.data?.videoUrl as string | undefined;
      if (videoUrl) {
        try {
          if (previewVideoRef.current?.url !== videoUrl) {
            previewVideoRef.current?.video.pause();
            previewVideoRef.current = { url: videoUrl, video: await loadVideo(videoUrl) };
          }
          const video = previewVideoRef.current.video;
          await seekVideo(video, previewTime);
          if (cancelled || drawId !== previewDrawIdRef.current) return;
          await drawFrame(
            ctx,
            focusedPreviewNode,
            resolution.width,
            resolution.height,
            {
              source: video,
              width: video.videoWidth || resolution.width,
              height: video.videoHeight || resolution.height,
            },
            previewTime,
            previewDuration,
          );
          return;
        } catch {
          if (cancelled) return;
        }
      } else if (previewVideoRef.current) {
        previewVideoRef.current.video.pause();
        previewVideoRef.current = null;
      }
      if (cancelled || drawId !== previewDrawIdRef.current) return;
      await drawFrame(
        ctx,
        focusedPreviewNode,
        resolution.width,
        resolution.height,
        undefined,
        previewTime,
        previewDuration,
      );
    };

    drawPreview().catch(() => {
      if (cancelled) return;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, resolution.width, resolution.height);
    });
    return () => {
      cancelled = true;
    };
  }, [
    focusedPreviewNode,
    previewTime,
    timelinePreviewTime,
    timelineMetrics,
    videoTrackByNodeId,
    videoTrackIds,
    resolution.width,
    resolution.height,
    renderStyle,
    animationLeadSeconds,
    status,
  ]);

  React.useEffect(() => {
    if (status === 'rendering') {
      stopPreviewAudio();
      return;
    }

    if (focusedPreviewNode) {
      void syncPreviewAudioSegments(
        getSegmentAudioSources(focusedPreviewNode).map((source) => ({
          key: `focused-${source.kind}`,
          audioUrl: source.url,
          localTime: previewTime,
        })),
        previewPlaying,
      );
      return;
    }

    const overlappingSegments = activeAudioSegments
      .filter((metric) => activeTimelineTime >= metric.start && activeTimelineTime < metric.end)
      .flatMap((metric) =>
        getSegmentAudioSources(metric.node).map((source) => ({
          key: `${metric.node.id}-${source.kind}`,
          audioUrl: source.url,
          localTime: (activeTimelineTime - metric.start) * speed,
        })),
      );
    void syncPreviewAudioSegments(
      overlappingSegments,
      previewPlaying,
    );
  }, [
    activeAudioSegments,
    activeTimelineTime,
    focusedPreviewNode,
    previewPlaying,
    previewTime,
    speed,
    status,
  ]);

  React.useEffect(() => () => stopPreviewAudio(), []);

  React.useEffect(() => {
    if (!previewPlaying || status === 'rendering') return;
    const startedAt = performance.now();
    const startTimelineTime = activeTimelineTime;
    const startPreviewTime = previewTime;
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      if (focusedTimelineMetric) {
        const nextPreviewTime = startPreviewTime + elapsed * speed;
        if (nextPreviewTime >= previewDuration) {
          setPreviewTime(previewDuration);
          setTimelinePreviewTime(focusedTimelineMetric.end);
          setPreviewPlaying(false);
          return;
        }
        setPreviewTime(nextPreviewTime);
        setTimelinePreviewTime(focusedTimelineMetric.start + nextPreviewTime / speed);
        return;
      }

      const nextTime = startTimelineTime + elapsed;
      if (nextTime >= timelineMetrics.totalDuration) {
        seekTimelineTime(timelineMetrics.totalDuration);
        setPreviewPlaying(false);
        return;
      }
      seekTimelineTime(nextTime, { keepPlaying: true });
    }, 120);
    return () => window.clearInterval(timer);
  }, [
    activeTimelineTime,
    focusedTimelineMetric,
    previewDuration,
    previewPlaying,
    previewTime,
    speed,
    status,
    timelineMetrics.totalDuration,
  ]);

  const mediaKind = (node: FlowNode) => {
    if (node.data?.videoUrl) return 'video';
    if (node.data?.imageUrl) return 'image';
    if (node.data?.audioUrl) return 'audio';
    return 'text';
  };

  const mediaIcon = (node: FlowNode, className = 'w-4 h-4') => {
    const kind = mediaKind(node);
    if (kind === 'video') return <Video className={className} />;
    if (kind === 'image') return <Image className={className} />;
    if (kind === 'audio') return <Music className={className} />;
    return <Film className={className} />;
  };

  const segmentTitle = (node: FlowNode) =>
    String(node.data?.title || (isZh ? '未命名片段' : 'Untitled segment'));
  const segmentText = (node: FlowNode) => stripHtml(String(node.data?.text || '')).trim();
  const segmentDurationLabel = (node: FlowNode) => {
    if (node.data?.videoUrl && node.data?.audioUrl)
      return isZh ? '按音画较长时长' : 'Longest media length';
    if (node.data?.videoUrl) return isZh ? '按视频时长' : 'Video length';
    if (node.data?.audioUrl) return isZh ? '按音频时长' : 'Audio length';
    return `${defaultSeconds}s`;
  };
  const getSpeechNodesForContextMenu = (menu: RenderContextMenuTarget, node?: FlowNode) => {
    const explicitSelection = (menu.selectedNodeIds || [])
      .map((id) => timelineNodeById.get(id))
      .filter((item): item is FlowNode => Boolean(item));
    if (explicitSelection.length > 0) return explicitSelection.filter(canGenerateSpeechFromNode);

    if (node && selectedIds.has(node.id)) return selectedSpeechNodes;
    if (node && canGenerateSpeechFromNode(node)) return [node];
    return selectedSpeechNodes;
  };

  const buildContextMenuSections = (
    menu: RenderContextMenuTarget,
    node?: FlowNode,
  ): RenderContextMenuSection[] => {
    const isTimelineNode =
      !!node && (menu.kind === 'timeline' || menu.kind === 'audio') && timelineIds.includes(node.id);
    const canMutate = status !== 'rendering';
    const speechNodesForMenu = getSpeechNodesForContextMenu(menu, node);

    if (!node) {
      return [
        {
          items: [
            {
              label: isZh
                ? `将选中的 ${speechNodesForMenu.length} 个片段文字生成音频`
                : `Generate speech for ${speechNodesForMenu.length} selected segment(s)`,
              icon: <Mic className="w-4 h-4" />,
              onSelect: () => generateAudioFromSelectedText(speechNodesForMenu),
              disabled: !canMutate || audioBusy || speechNodesForMenu.length === 0,
            },
            {
              label: isZh ? '插入最近素材到视频轨' : 'Insert next asset to video track',
              icon: <ListPlus className="w-4 h-4" />,
              onSelect: () => addNearestAssetToTimeline('video'),
              disabled: !canMutate || visibleAssetNodes.length === 0,
            },
            {
              label: isZh ? '插入最近素材到音频轨' : 'Insert next asset to audio track',
              icon: <Mic className="w-4 h-4" />,
              onSelect: () => addNearestAssetToTimeline('audio'),
              disabled: !canMutate || visibleAssetNodes.length === 0,
            },
          ],
        },
        {
          items: [
            {
              label: isZh ? '选择全部时间线卡片' : 'Select all timeline cards',
              icon: <CheckCircle2 className="w-4 h-4" />,
              onSelect: selectAllTimelineNodes,
              disabled: !canMutate || timelineIds.length === 0,
            },
            {
              label: isZh ? '清空导出选择' : 'Clear export selection',
              icon: <Scissors className="w-4 h-4" />,
              onSelect: clearTimelineSelection,
              disabled: !canMutate || selectedIds.size === 0,
            },
          ],
        },
        {
          items: [
            {
              label: isZh ? '新增视频轨' : 'Add video track',
              icon: <Video className="w-4 h-4" />,
              onSelect: addVideoTrack,
              disabled: !canMutate,
            },
            {
              label: isZh ? '新增音频轨' : 'Add audio track',
              icon: <Music className="w-4 h-4" />,
              onSelect: addAudioTrack,
              disabled: !canMutate,
            },
          ],
        },
      ];
    }

    const trackItems =
      menu.trackKind === 'audio'
        ? audioTrackIds.map((trackId, index) => ({
          label: isZh ? `移动到音频轨 ${index + 1}` : `Move to Audio ${index + 1}`,
          icon: <Music className="w-4 h-4" />,
          onSelect: () => assignNodeTrack(node.id, 'audio', trackId),
          disabled: !canMutate || (audioTrackByNodeId[node.id] || audioTrackIds[0]) === trackId,
        }))
        : videoTrackIds.map((trackId, index) => ({
          label: isZh ? `移动到视频轨 ${index + 1}` : `Move to Video ${index + 1}`,
          icon: <Video className="w-4 h-4" />,
          onSelect: () => assignNodeTrack(node.id, 'video', trackId),
          disabled: !canMutate || (videoTrackByNodeId[node.id] || videoTrackIds[0]) === trackId,
        }));

    return [
      {
        items: [
          {
            label: isZh ? '预览此段' : 'Preview this segment',
            icon: <Eye className="w-4 h-4" />,
            onSelect: () => previewNode(node.id),
            disabled: status === 'rendering',
          },
          {
            label: isZh ? '只导出此段' : 'Export only this segment',
            icon: <FileDown className="w-4 h-4" />,
            onSelect: () => selectOnlyNode(node.id),
            disabled: !canMutate || !isTimelineNode,
          },
          {
            label: isZh ? '从此处开始导出' : 'Export from here',
            icon: <Gauge className="w-4 h-4" />,
            onSelect: () => selectTimelineFromNode(node.id),
            disabled: !canMutate || !isTimelineNode,
          },
        ],
      },
      {
        items: [
          {
            label: isZh ? '加入视频时间线' : 'Add to video timeline',
            icon: <ListPlus className="w-4 h-4" />,
            onSelect: () => addNodeToTimeline(node.id, 'video', menu.trackId),
            disabled: !canMutate || isTimelineNode,
          },
          {
            label: isZh ? '加入音频时间线' : 'Add to audio timeline',
            icon: <Mic className="w-4 h-4" />,
            onSelect: () => addNodeToTimeline(node.id, 'audio', menu.trackId),
            disabled: !canMutate || isTimelineNode,
          },
          {
            label: selectedIds.has(node.id)
              ? isZh
                ? '从导出中排除'
                : 'Exclude from export'
              : isZh
                ? '加入导出选择'
                : 'Include in export',
            icon: <CheckCircle2 className="w-4 h-4" />,
            onSelect: () => toggleNode(node.id),
            disabled: !canMutate || !isTimelineNode,
          },
        ],
      },
      {
        items: [
          {
            label: isZh ? '重新生成此段画面' : 'Regenerate visuals',
            icon: <RotateCcw className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '文字转音频' : 'Text to audio',
            icon: <Mic className="w-4 h-4" />,
            onSelect: () => generateAudioFromSelectedText(speechNodesForMenu),
            disabled: !canMutate || audioBusy || speechNodesForMenu.length === 0,
          },
          {
            label: isZh ? '编辑剧情内容' : 'Edit story content',
            icon: <FileText className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '编辑角色/表情' : 'Edit character/expression',
            icon: <UserRound className="w-4 h-4" />,
            disabled: true,
          },
        ],
      },
      {
        items: [
          {
            label: isZh ? '调整时长' : 'Adjust duration',
            icon: <Clock className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '拆分卡片' : 'Split card',
            icon: <Scissors className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '复制卡片' : 'Duplicate card',
            icon: <Copy className="w-4 h-4" />,
            disabled: true,
          },
        ],
      },
      ...(trackItems.length > 1 ? [{ items: trackItems }] : []),
      {
        items: [
          {
            label: isZh ? '复制卡片标题' : 'Copy card title',
            icon: <ClipboardCopy className="w-4 h-4" />,
            onSelect: () => {
              closeContextMenu();
              navigator.clipboard?.writeText(segmentTitle(node));
            },
          },
          {
            label: isZh ? '标记为重点镜头' : 'Mark as key shot',
            icon: <Sparkles className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '从时间线删除' : 'Remove from timeline',
            icon: <Trash2 className="w-4 h-4" />,
            onSelect: () => removeTimelineNode(node.id),
            disabled: !canMutate || !isTimelineNode,
            danger: true,
          },
        ],
      },
    ];
  };

  const timelineThumbWidthPercent =
    timelineScrollInfo.scrollWidth > 0
      ? clamp((timelineScrollInfo.clientWidth / timelineScrollInfo.scrollWidth) * 100, 0, 100)
      : 100;
  const timelineThumbLeftPercent =
    timelineScrollInfo.scrollWidth > 0
      ? clamp(
        (timelineScrollInfo.scrollLeft / timelineScrollInfo.scrollWidth) * 100,
        0,
        100 - timelineThumbWidthPercent,
      )
      : 0;
  const assetThumbHeightPercent =
    assetScrollInfo.scrollHeight > 0
      ? clamp((assetScrollInfo.clientHeight / assetScrollInfo.scrollHeight) * 100, 8, 100)
      : 100;
  const assetThumbTopPercent =
    assetScrollInfo.scrollHeight > 0
      ? clamp(
        (assetScrollInfo.scrollTop / assetScrollInfo.scrollHeight) * 100,
        0,
        100 - assetThumbHeightPercent,
      )
      : 0;

  return (
    <div
      ref={modalRootRef}
      className="video-render-workspace fixed inset-0 z-[350] bg-[var(--vr-bg)] text-[var(--vr-text)]"
    >
      <div
        className="h-full w-full grid"
        style={{
          gridTemplateRows:
            workspaceMode === 'web'
              ? `${HEADER_HEIGHT}px minmax(0, 1fr)`
              : `${HEADER_HEIGHT}px minmax(0, 1fr) ${timelineHeight}px`,
        }}
      >
        <RenderHeader
          language={language}
          workspaceMode={workspaceMode}
          status={status}
          isFullscreen={isFullscreen}
          timelinePast={timelinePast}
          timelineFuture={timelineFuture}
          webPast={webPast}
          webFuture={webFuture}
          selectedNodes={selectedNodes}
          nodes={nodes}
          setWorkspaceMode={setWorkspaceMode}
          setError={setError}
          setProgress={setProgress}
          setSavedPath={setSavedPath}
          toggleFullscreen={toggleFullscreen}
          undoTimeline={undoTimeline}
          redoTimeline={redoTimeline}
          undoWeb={undoWeb}
          redoWeb={redoWeb}
          renderVideo={renderVideo}
          exportWebProject={exportWebProject}
          onClose={onClose}
        />

        {workspaceMode === 'video' ? (
          <>
            <main className="min-h-0 flex bg-[var(--vr-bg)]">
              <VideoAssetSidebar
                language={language}
                assetPanelWidth={assetPanelWidth}
                assetCardLayout={assetCardLayout}
                assetCardScale={assetCardScale}
                assetRegionFilter={assetRegionFilter}
                assetRegionOptions={assetRegionOptions}
                visibleAssetNodes={visibleAssetNodes}
                allAssetNodes={allAssetNodes}
                timelineIds={timelineIds}
                nodeRegionById={nodeRegionById}
                activePreviewNode={activePreviewNode}
                assetScrollInfo={assetScrollInfo}
                assetThumbTopPercent={assetThumbTopPercent}
                assetThumbHeightPercent={assetThumbHeightPercent}
                assetUploadInputRef={assetUploadInputRef}
                assetViewportRef={assetViewportRef}
                setAssetCardLayout={setAssetCardLayout}
                setAssetRegionFilter={setAssetRegionFilter}
                setActivePreviewId={setActivePreviewId}
                handleAssetUploadInputChange={handleAssetUploadInputChange}
                handleAssetFileDragOver={handleAssetFileDragOver}
                handleAssetFileDrop={handleAssetFileDrop}
                syncAssetScrollInfo={syncAssetScrollInfo}
                handleAssetDragStart={handleAssetDragStart}
                openContextMenu={openContextMenu}
                addNodeToTimeline={addNodeToTimeline}
                mediaIcon={mediaIcon}
                mediaKind={mediaKind}
                segmentTitle={segmentTitle}
                segmentText={segmentText}
                segmentDurationLabel={segmentDurationLabel}
                handleAssetScrollThumbStart={handleAssetScrollThumbStart}
                handleAssetScrollThumbMove={handleAssetScrollThumbMove}
                handleAssetScrollThumbEnd={handleAssetScrollThumbEnd}
                handleAssetScaleHandleStart={handleAssetScaleHandleStart}
                handleAssetScaleHandleMove={handleAssetScaleHandleMove}
                handleAssetScaleHandleEnd={handleAssetScaleHandleEnd}
              />

              <ResizeHandle
                label={renderCopy(language, '调整素材卡片宽度', '素材カードの幅を調整', 'Resize asset cards')}
                axis="x"
                value={assetPanelWidth}
                min={PANEL_SIZE_LIMITS.asset.min}
                max={assetPanelMax}
                onChange={setAssetPanelWidth}
              />

              <VideoPreviewPanel
                language={language}
                canvasRef={canvasRef}
                activeTimelineFrame={activeTimelineFrame}
                activeTimelineTime={activeTimelineTime}
                resolution={resolution}
                frameRate={frameRate}
                timelineScaleMode={timelineScaleMode}
                focusedPreviewNode={focusedPreviewNode}
                activePreviewNode={activePreviewNode}
                focusedTimelineMetric={focusedTimelineMetric}
                previewPlaying={previewPlaying}
                previewTime={previewTime}
                previewDuration={previewDuration}
                timelinePreviewTime={timelinePreviewTime}
                timelineNodes={timelineNodes}
                timelineMetrics={timelineMetrics}
                status={status}
                speed={speed}
                setPreviewPlaying={setPreviewPlaying}
                setPreviewTime={setPreviewTime}
                setTimelinePreviewTime={setTimelinePreviewTime}
                seekTimelineTime={seekTimelineTime}
                openContextMenu={openContextMenu}
              />

              <ResizeHandle
                label={renderCopy(language, '调整导出设置宽度', '書き出し設定の幅を調整', 'Resize export settings')}
                axis="x"
                value={exportPanelWidth}
                min={PANEL_SIZE_LIMITS.export.min}
                max={exportPanelMax}
                reverse
                onChange={setExportPanelWidth}
              />

              <VideoExportSettingsPanel
                language={language}
                exportPanelWidth={exportPanelWidth}
                exportSettingsMode={exportSettingsMode}
                setExportSettingsMode={setExportSettingsMode}
                status={status}
                exportFormat={exportFormat}
                setExportFormat={setExportFormat}
                resolutionIndex={resolutionIndex}
                setResolutionIndex={setResolutionIndex}
                frameRate={frameRate}
                setFrameRate={setFrameRate}
                encoder={encoder}
                setEncoder={setEncoder}
                outputDir={outputDir}
                setOutputDir={setOutputDir}
                outputDirError={outputDirError}
                setOutputDirError={setOutputDirError}
                chooseOutputDir={chooseOutputDir}
                renderStyle={renderStyle}
                updateRenderStyle={updateRenderStyle}
                defaultSeconds={defaultSeconds}
                setDefaultSeconds={setDefaultSeconds}
                speed={speed}
                setSpeed={setSpeed}
                estimatedDuration={estimatedDuration}
                fallbackEstimatedSeconds={fallbackEstimatedSeconds}
                animationLeadSeconds={animationLeadSeconds}
                setAnimationLeadSeconds={setAnimationLeadSeconds}
                selectedSpeechNodeCount={selectedSpeechNodes.length}
                audioBusy={audioBusy}
                audioMessage={audioMessage}
                isRecordingVoiceover={isRecordingVoiceover}
                generateAudioFromSelectedText={generateAudioFromSelectedText}
                startVoiceoverRecording={startVoiceoverRecording}
                stopVoiceoverRecording={stopVoiceoverRecording}
                assetUploadInputRef={assetUploadInputRef}
                progress={progress}
                error={error}
                progressValue={progressValue}
                savedPath={savedPath}
                isDesktopApp={isDesktopApp}
                useGpuAcceleration={useGpuAcceleration}
                setUseGpuAcceleration={setUseGpuAcceleration}
                isWebGPUSupported={isWebGPUSupported()}
              />
            </main>

            <VideoTimelinePanel
              language={language}
              timelineHeight={timelineHeight}
              timelineMax={timelineMax}
              setTimelineHeight={setTimelineHeight}
              status={status}
              previewPlaying={previewPlaying}
              setPreviewPlaying={setPreviewPlaying}
              activeTimelineTime={activeTimelineTime}
              activeTimelineFrame={activeTimelineFrame}
              timelineMetrics={timelineMetrics}
              timelineSnapEnabled={timelineSnapEnabled}
              setTimelineSnapEnabled={setTimelineSnapEnabled}
              timelineWheelMode={timelineWheelMode}
              setTimelineWheelMode={setTimelineWheelMode}
              timelineViewportRef={timelineViewportRef}
              syncTimelineScrollInfo={syncTimelineScrollInfo}
              handleTimelineDrop={handleTimelineDrop}
              openContextMenu={openContextMenu}
              timelineScaleMode={timelineScaleMode}
              setTimelineScaleMode={setTimelineScaleMode}
              timelineScrubSurfaceRef={timelineScrubSurfaceRef}
              handleTimelineScrubStart={handleTimelineScrubStart}
              handleTimelineScrubMove={handleTimelineScrubMove}
              handleTimelineScrubEnd={handleTimelineScrubEnd}
              timelineTicks={timelineTicks}
              frameRate={frameRate}
              timelineTickSettings={timelineTickSettings}
              timelinePlayheadLeft={timelinePlayheadLeft}
              videoTrackIds={videoTrackIds}
              audioTrackIds={audioTrackIds}
              videoTrackByNodeId={videoTrackByNodeId}
              audioTrackByNodeId={audioTrackByNodeId}
              timelineNodes={timelineNodes}
              timelineMetricById={timelineMetricById}
              selectedIds={selectedIds}
              focusedPreviewId={focusedPreviewId}
              addVideoTrack={addVideoTrack}
              addAudioTrack={addAudioTrack}
              removeVideoTrack={removeVideoTrack}
              removeAudioTrack={removeAudioTrack}
              removeTimelineNode={removeTimelineNode}
              onBoxSelectTimelineNodes={boxSelectTimelineNodes}
              handleAssetDragStart={handleAssetDragStart}
              focusTimelineSegment={focusTimelineSegment}
              segmentTitle={segmentTitle}
              mediaKind={mediaKind}
              seekTimelineTime={seekTimelineTime}
              setFocusedPreviewId={setFocusedPreviewId}
              segmentText={segmentText}
              handleTimelinePlayheadGrabStart={handleTimelinePlayheadGrabStart}
              handleTimelinePlayheadGrabMove={handleTimelinePlayheadGrabMove}
              timelineThumbLeftPercent={timelineThumbLeftPercent}
              timelineThumbWidthPercent={timelineThumbWidthPercent}
              handleTimelineScrollThumbStart={handleTimelineScrollThumbStart}
              handleTimelineScrollThumbMove={handleTimelineScrollThumbMove}
              handleTimelineScrollThumbEnd={handleTimelineScrollThumbEnd}
              handleTimelineScaleHandleStart={handleTimelineScaleHandleStart}
              handleTimelineScaleHandleMove={handleTimelineScaleHandleMove}
              handleTimelineScaleHandleEnd={handleTimelineScaleHandleEnd}
            />
          </>
        ) : (
          <WebWorkspace
            nodes={nodes}
            edges={edges}
            language={language}
            webRenderStyle={webRenderStyle}
            webChoiceColor={webChoiceColor}
            webChoiceTextColor={webChoiceTextColor}
            webSettings={webSettings}
            webProjectName={webProjectName}
            defaultWebProjectName={defaultWebProjectName}
            progress={progress}
            error={error}
            progressValue={progressValue}
            savedPath={savedPath}
            outputDir={webOutputDir}
            outputDirError={webOutputDirError}
            setWebProjectName={setWebProjectName}
            setOutputDir={setWebOutputDir}
            setOutputDirError={setWebOutputDirError}
            chooseOutputDir={chooseWebOutputDir}
            updateWebSettings={updateWebSettings}
            updateWebChoiceTextColor={updateWebChoiceTextColor}
            updateWebChoiceColor={updateWebChoiceColor}
            updateWebRenderStyle={updateWebRenderStyle}
          />
        )}
      </div>
      {workspaceMode === 'video' && (
        <RenderContextMenu
          contextMenu={contextMenu}
          nodeById={nodeById}
          timelineMenuLabel={renderCopy(language, '时间线菜单', 'タイムラインメニュー', 'Timeline menu')}
          buildContextMenuSections={buildContextMenuSections}
          mediaIcon={mediaIcon}
          mediaKind={mediaKind}
          segmentDurationLabel={segmentDurationLabel}
          segmentTitle={segmentTitle}
          segmentText={segmentText}
        />
      )}
      <VideoNoticeModal notice={noticeModal} onClose={() => setNoticeModal(null)} />
    </div>
  );
}
