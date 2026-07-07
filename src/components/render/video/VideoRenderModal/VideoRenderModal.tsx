import type { Node as FlowNode } from '@xyflow/react';
import React, { useMemo, useRef, useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import { WebWorkspace } from '../../web/WebWorkspace';
import { getAssetRegionOptions, getStoryNodeRegion } from '../assets/assetRegions';
import { makeTrackId, ResizeHandle } from '../controls/RenderControls';
import { chooseRenderOutputDir, getDefaultRenderDir } from '../export/tauriRenderAdapter';
import { useWebExportSettings } from '../export/useWebExportSettings';
import { isWebGPUSupported } from '../gpu/webgpuRenderer';
import { RenderContextMenu } from '../panels/RenderContextMenu';
import { RenderHeader } from '../panels/RenderHeader';
import { RenderProgressModal } from '../panels/RenderProgressModal';
import { ExportDialog } from '../panels/ExportDialog';
import { VideoAssetSidebar } from '../panels/VideoAssetSidebar';
import { VideoExportSettingsPanel } from '../panels/VideoExportSettingsPanel';
import { VideoPreviewPanel } from '../panels/VideoPreviewPanel';
import { VideoTimelinePanel } from '../panels/VideoTimelinePanel';
import {
  ASSET_CARD_MAX_SCALE,
  ASSET_CARD_MIN_SCALE,
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
} from '../shared/constants';
import { clamp, isTauriRuntime } from '../shared/mediaUtils';
import { renderCopy } from '../shared/renderCopy';
import { stripHtml } from '../shared/storyNodes';
import { getNodeDisplayTitle, getOrderedStoryNodes } from '../shared/storyNodes';
import type {
  AssetCardLayout,
  ExportFormat,
  ExportSettingsMode,
  RenderContextMenuState,
  RenderContextMenuTarget,
  RenderStatus,
  RenderStyle,
  RenderWorkspaceMode,
  TimelineHistoryState,
  TimelineScaleMode,
  TimelineWheelMode,
  VideoTextScaleMode,
  VideoRenderModalProps,
} from '../shared/types';
import {
  captureTimelineHistoryState,
  restoreTimelineHistoryState,
} from '../timeline/timelineHistory';
import { getTimelineTickSettings } from '../timeline/timelineUtils';
import {
  DESKTOP_RELEASE_URL,
  clampPersistedNumber,
  isAssetCardLayout,
  isExportFormat,
  isExportSettingsMode,
  isRenderWorkspaceMode,
  isTimelineScaleMode,
  isTimelineWheelMode,
  isVideoTextScaleMode,
  readRenderWorkspaceState,
  type PersistedRenderWorkspaceState,
  writeRenderWorkspaceState,
} from './workspaceStorage';
import { VideoNoticeModal, type RenderNoticeModalState } from './VideoNoticeModal';
import {
  mediaIcon as getMediaIcon,
  mediaKind as getMediaKind,
  segmentDurationLabel as getSegmentDurationLabel,
  segmentText as getSegmentText,
  segmentTitle as getSegmentTitle,
} from './segmentHelpers';
import { createContextMenuSectionBuilder } from './contextMenuSections';
import { getSpeechTagNames, getSpeechTextForNode as buildSpeechTextForNode } from './speechText';
import { calculateTimelineMetrics } from './timelineMetrics';
import {
  findNonOverlappingTrackStart as calculateNonOverlappingTrackStart,
  hasTrackSpace,
  snapTimelineTime as calculateSnappedTimelineTime,
  snapToTimelineClipEdges as calculateTimelineClipEdgeSnap,
} from './timelinePlacement';
import {
  calculateVideoTrackLayout,
  isAudioOnlyNode,
  isVisualTimelineNode,
} from './timelineTrackLayout';
import { useAssetAudioTools } from './useAssetAudioTools';
import { useAssetMenuActions } from './useAssetMenuActions';
import { useMediaDurations } from './useMediaDurations';
import { usePreviewAudio } from './usePreviewAudio';
import { usePreviewPlayback } from './usePreviewPlayback';
import { usePreviewRenderer } from './usePreviewRenderer';
import { useTimelineEditingActions } from './useTimelineEditingActions';
import { useTimelineDragDrop } from './useTimelineDragDrop';
import { useVideoExport } from './useVideoExport';
import { useWebProjectExport } from './useWebProjectExport';
import { useWorkspaceInteractions } from './useWorkspaceInteractions';
import { InteractiveSegmentExportWorkspace } from '../interactive/InteractiveSegmentExportWorkspace';
import { exportInteractiveSegmentZip } from '../interactive/interactiveSegmentZipExport';
import {
  buildInteractiveSegments,
  type InteractiveSegmentDraft,
} from '../interactive/interactiveSegments';

type VideoWorkspaceMode = 'timeline' | 'interactive';

export function VideoRenderModal({
  nodes,
  edges,
  onClose,
  language,
  workspaceKey,
  renderStyle,
  updateRenderStyle,
  callAIForTextResult,
  voiceTtsConfig,
}: VideoRenderModalProps) {
  const orderedNodes = useMemo(() => getOrderedStoryNodes(nodes, edges), [nodes, edges]);
  const persistedWorkspace = useMemo(() => readRenderWorkspaceState(workspaceKey), [workspaceKey]);
  const [workspaceMode, setWorkspaceMode] = useState<RenderWorkspaceMode>(() =>
    isRenderWorkspaceMode(persistedWorkspace?.workspaceMode)
      ? persistedWorkspace.workspaceMode
      : 'video',
  );
  const [videoWorkspaceMode, setVideoWorkspaceMode] = useState<VideoWorkspaceMode>('timeline');
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
    webPast,
    webFuture,
    undoWeb,
    redoWeb,
    updateWebSettings,
    updateWebChoiceColor,
    updateWebChoiceTextColor,
  } = useWebExportSettings(defaultWebProjectName, status === 'rendering', {
    projectName: persistedWorkspace?.webProjectName,
    choiceColor: persistedWorkspace?.webChoiceColor,
    choiceTextColor: persistedWorkspace?.webChoiceTextColor,
    settings: persistedWorkspace?.webSettings,
    renderStyle,
    past: persistedWorkspace?.webPast,
    future: persistedWorkspace?.webFuture,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      new Set(Array.isArray(persistedWorkspace?.selectedIds) ? persistedWorkspace.selectedIds : []),
  );
  // NOTE: 这两个 ref 必须在对应 useState 之前声明，
  // 以便在每次渲染时同步写入最新状态值，供 useEffect 读取，
  // 避免验证 effect 因 stale closure 将恢复的时间轴 ID 错误地全部清空。
  const timelineSourceByIdRef = useRef<Record<string, string>>(
    persistedWorkspace?.timelineSourceById || {},
  );
  const timelineIdsRef = useRef<string[]>(
    Array.isArray(persistedWorkspace?.timelineIds) ? persistedWorkspace.timelineIds : [],
  );
  const [timelineIds, setTimelineIds] = useState<string[]>(() =>
    Array.isArray(persistedWorkspace?.timelineIds) ? persistedWorkspace.timelineIds : [],
  );
  const [timelineSourceById, setTimelineSourceById] = useState<Record<string, string>>(
    () => persistedWorkspace?.timelineSourceById || {},
  );
  const [timelineExcludedSourceIds, setTimelineExcludedSourceIds] = useState<Set<string>>(
    () => new Set(persistedWorkspace?.timelineExcludedSourceIds || []),
  );
  // NOTE: 每次渲染都同步更新 ref，保证 useEffect 中始终读到最新状态值。
  timelineSourceByIdRef.current = timelineSourceById;
  timelineIdsRef.current = timelineIds;
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
  const [videoTrackByNodeId, setVideoTrackByNodeId] = useState<Record<string, string>>(
    () => persistedWorkspace?.videoTrackByNodeId || {},
  );
  const [audioTrackByNodeId, setAudioTrackByNodeId] = useState<Record<string, string>>(
    () => persistedWorkspace?.audioTrackByNodeId || {},
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
    clampPersistedNumber(persistedWorkspace?.resolutionIndex, 1, 0, RESOLUTION_OPTIONS.length - 1),
  );
  const [resolutionWidth, setResolutionWidth] = useState(() =>
    clampPersistedNumber(
      persistedWorkspace?.resolutionWidth,
      RESOLUTION_OPTIONS[resolutionIndex]?.width || 1920,
      320,
      7680,
    ),
  );
  const [resolutionHeight, setResolutionHeight] = useState(() =>
    clampPersistedNumber(
      persistedWorkspace?.resolutionHeight,
      RESOLUTION_OPTIONS[resolutionIndex]?.height || 1080,
      240,
      4320,
    ),
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
  const [videoTextScaleMode, setVideoTextScaleMode] = useState<VideoTextScaleMode>(() =>
    isVideoTextScaleMode(persistedWorkspace?.videoTextScaleMode)
      ? persistedWorkspace.videoTextScaleMode
      : 'webRatio',
  );
  const [outputDir, setOutputDir] = useState(() => persistedWorkspace?.outputDir || '');
  const [webOutputDir, setWebOutputDir] = useState(() => persistedWorkspace?.webOutputDir || '');
  const [useGpuAcceleration, setUseGpuAcceleration] = useState(() =>
    Boolean(persistedWorkspace?.useGpuAcceleration),
  );
  const [hideCharacterTags, setHideCharacterTags] = useState(
    () => persistedWorkspace?.hideCharacterTags ?? true,
  );
  const [hideSceneTags, setHideSceneTags] = useState(
    () => persistedWorkspace?.hideSceneTags ?? true,
  );
  const [progress, setProgress] = useState('');
  const [progressValue, setProgressValue] = useState(0);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(defaultSeconds);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [assetPanelWidth, setAssetPanelWidth] = useState(() =>
    clampPersistedNumber(persistedWorkspace?.assetPanelWidth, 320, 0, PANEL_SIZE_LIMITS.asset.max),
  );
  const [assetCardLayout, setAssetCardLayout] = useState<AssetCardLayout>(() =>
    isAssetCardLayout(persistedWorkspace?.assetCardLayout)
      ? persistedWorkspace.assetCardLayout
      : 'grid',
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
      0,
      PANEL_SIZE_LIMITS.export.max,
    ),
  );
  const [exportSettingsMode, setExportSettingsMode] = useState<ExportSettingsMode>(() =>
    isExportSettingsMode(persistedWorkspace?.exportSettingsMode)
      ? persistedWorkspace.exportSettingsMode
      : 'video',
  );
  const TIMELINE_COLLAPSED_HEIGHT = 44;
  const [timelineHeight, setTimelineHeight] = useState(() => {
    const persistedHeight = clampPersistedNumber(
      persistedWorkspace?.timelineHeight,
      250,
      TIMELINE_COLLAPSED_HEIGHT,
      PANEL_SIZE_LIMITS.timeline.max,
    );
    return persistedHeight < TIMELINE_COLLAPSED_HEIGHT
      ? TIMELINE_COLLAPSED_HEIGHT
      : persistedHeight;
  });
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
  const [timelinePixelsPerSecond, setTimelinePixelsPerSecond] = useState(() =>
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
  const [timelineDurationById, setTimelineDurationById] = useState<Record<string, number>>(
    () => persistedWorkspace?.timelineDurationById || {},
  );
  const [timelineDataOverrides, setTimelineDataOverrides] = useState<
    Record<string, Record<string, unknown>>
  >(() => persistedWorkspace?.timelineDataOverrides || {});
  const [keyShotIds, setKeyShotIds] = useState<Set<string>>(
    () => new Set(persistedWorkspace?.keyShotIds || []),
  );
  const [uploadedAssetNodes, setUploadedAssetNodes] = useState<FlowNode[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    () => persistedWorkspace?.selectedAssetIds || [],
  );
  const [focusedPreviewId, setFocusedPreviewId] = useState(
    () => persistedWorkspace?.focusedPreviewId || '',
  );
  const [timelinePreviewTime, setTimelinePreviewTime] = useState(() =>
    clampPersistedNumber(persistedWorkspace?.timelinePreviewTime, 0, 0, 3600),
  );
  const [timelineScrollInfo, setTimelineScrollInfo] = useState({
    scrollLeft: persistedWorkspace?.timelineScrollLeft || 0,
    scrollWidth: 1,
    clientWidth: 1,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [assetScrollInfo, setAssetScrollInfo] = useState({
    scrollTop: persistedWorkspace?.assetScrollTop || 0,
    scrollHeight: 1,
    clientHeight: 1,
  });
  const [contextMenu, setContextMenu] = useState<RenderContextMenuState | null>(null);
  const [error, setError] = useState('');
  const [outputDirError, setOutputDirError] = useState('');
  const [webOutputDirError, setWebOutputDirError] = useState('');
  const [savedPath, setSavedPath] = useState('');
  // NOTE: 控制导出确认弹窗的显示状态
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [interactiveSegments, setInteractiveSegments] = useState<InteractiveSegmentDraft[]>(() =>
    buildInteractiveSegments(nodes, edges),
  );
  const [activeInteractiveSegmentId, setActiveInteractiveSegmentId] = useState(
    () => interactiveSegments[0]?.id || '',
  );
  const modalRootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetPanelLastWidthRef = useRef(assetPanelWidth || 320);
  const exportPanelLastWidthRef = useRef(exportPanelWidth || 380);
  const assetUploadInputRef = useRef<HTMLInputElement>(null);
  const preservePreviewTimeOnNodeChangeRef = useRef(false);
  const timelineClipCounterRef = useRef(0);
  const latestWorkspaceSnapshotRef = useRef<{
    workspaceKey?: string;
    snapshot: PersistedRenderWorkspaceState;
  } | null>(null);
  const previousVideoPlacementRef = useRef<Record<string, { start: number; duration: number }>>({});
  const EMPTY_TIMELINE_PLACEHOLDER = '\u200b';

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
  const isBlankTimelineSource = (node?: FlowNode | null) =>
    Boolean(node) &&
    !node?.data?.videoUrl &&
    !node?.data?.imageUrl &&
    !node?.data?.audioUrl &&
    !String(node?.data?.title || '').trim() &&
    !stripHtml(String(node?.data?.text || '')).trim();
  const getTimelinePlaceholderOverrides = (node?: FlowNode | null) =>
    isBlankTimelineSource(node)
      ? {
          title: EMPTY_TIMELINE_PLACEHOLDER,
          text: EMPTY_TIMELINE_PLACEHOLDER,
        }
      : {};
  const timelineNodes = useMemo(
    () =>
      timelineIds
        .map((id) => {
          const sourceNode = assetNodeById.get(timelineSourceById[id] || id);
          return sourceNode
            ? ({
                ...sourceNode,
                id,
                data: { ...sourceNode.data, ...(timelineDataOverrides[id] || {}) },
              } as FlowNode)
            : null;
        })
        .filter(Boolean) as FlowNode[],
    [assetNodeById, timelineDataOverrides, timelineIds, timelineSourceById],
  );
  const timelineNodeById = useMemo(
    () => new Map(timelineNodes.map((node) => [node.id, node])),
    [timelineNodes],
  );
  const nodeById = useMemo(
    () => new Map([...assetNodeById, ...timelineNodeById]),
    [assetNodeById, timelineNodeById],
  );
  const storyNodeById = useMemo(
    () =>
      new Map(
        nodes
          .filter((node) => node.type === 'storyNode' && !node.data?.hidden)
          .map((node) => [node.id, node]),
      ),
    [nodes],
  );
  const selectedNodes = useMemo(
    () => timelineNodes.filter((node) => selectedIds.has(node.id)),
    [timelineNodes, selectedIds],
  );
  const speechTagNames = useMemo(() => getSpeechTagNames(nodes), [nodes]);
  const getSpeechTextForNode = (node: FlowNode) => buildSpeechTextForNode(node, speechTagNames);
  const canGenerateSpeechFromNode = (node: FlowNode) => Boolean(getSpeechTextForNode(node));
  const selectedSpeechNodes = selectedNodes.filter(canGenerateSpeechFromNode);
  const selectedAudioNodes = selectedNodes.filter(
    (node) => node.data?.audioUrl || (node.data?.videoUrl && node.data?.muteVideoAudio !== true),
  );
  const selectedAudioVolume = Number(selectedAudioNodes[0]?.data?.volume ?? 1);
  const selectedAudioFadeIn = Number(selectedAudioNodes[0]?.data?.fadeIn ?? 0);
  const selectedAudioFadeOut = Number(selectedAudioNodes[0]?.data?.fadeOut ?? 0);
  const activePreviewNode = nodeById.get(activePreviewId) || selectedNodes[0] || allAssetNodes[0];
  const focusedPreviewNode = focusedPreviewId ? nodeById.get(focusedPreviewId) : undefined;
  const resolution = {
    label: `${resolutionWidth} x ${resolutionHeight}`,
    width: resolutionWidth,
    height: resolutionHeight,
  };
  const isZh = language === 'zh';
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
    HEADER_HEIGHT,
    Math.min(PANEL_SIZE_LIMITS.timeline.max, viewportHeight - HEADER_HEIGHT - MIN_MAIN_HEIGHT),
  );
  const assetPanelCollapsed = assetPanelWidth === 0;
  const exportPanelCollapsed = exportPanelWidth === 0;
  const setAssetPanelWidthInteractive = (nextWidth: number) => {
    const clamped = clamp(nextWidth, PANEL_SIZE_LIMITS.asset.min, assetPanelMax);
    assetPanelLastWidthRef.current = clamped;
    setAssetPanelWidth(clamped);
  };
  const commitAssetPanelWidth = (nextWidth: number) => {
    if (nextWidth <= PANEL_SIZE_LIMITS.asset.min) {
      setAssetPanelWidth(0);
      return;
    }
    const clamped = clamp(nextWidth, PANEL_SIZE_LIMITS.asset.min, assetPanelMax);
    assetPanelLastWidthRef.current = clamped;
    setAssetPanelWidth(clamped);
  };
  const setExportPanelWidthInteractive = (nextWidth: number) => {
    const clamped = clamp(nextWidth, PANEL_SIZE_LIMITS.export.min, exportPanelMax);
    exportPanelLastWidthRef.current = clamped;
    setExportPanelWidth(clamped);
  };
  const commitExportPanelWidth = (nextWidth: number) => {
    if (nextWidth <= PANEL_SIZE_LIMITS.export.min) {
      setExportPanelWidth(0);
      return;
    }
    const clamped = clamp(nextWidth, PANEL_SIZE_LIMITS.export.min, exportPanelMax);
    exportPanelLastWidthRef.current = clamped;
    setExportPanelWidth(clamped);
  };
  const toggleAssetPanel = () => {
    setAssetPanelWidth((prev) => {
      if (prev === 0)
        return clamp(
          assetPanelLastWidthRef.current || 320,
          PANEL_SIZE_LIMITS.asset.min,
          assetPanelMax,
        );
      assetPanelLastWidthRef.current = prev;
      return 0;
    });
  };
  const toggleExportPanel = () => {
    setExportPanelWidth((prev) => {
      if (prev === 0)
        return clamp(
          exportPanelLastWidthRef.current || 380,
          PANEL_SIZE_LIMITS.export.min,
          exportPanelMax,
        );
      exportPanelLastWidthRef.current = prev;
      return 0;
    });
  };
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
  const timelineMetrics = useMemo(
    () =>
      calculateTimelineMetrics({
        nodes: timelineNodes,
        durationById: timelineDurationById,
        startById: timelineStartById,
        defaultSeconds,
        speed,
        displayDuration: timelineDisplayDuration,
        pixelsPerSecond: timelinePixelsPerSecond,
      }),
    [
      defaultSeconds,
      speed,
      timelineDisplayDuration,
      timelineDurationById,
      timelineStartById,
      timelineNodes,
      timelinePixelsPerSecond,
    ],
  );
  const timelineMetricById = useMemo(
    () => new Map(timelineMetrics.segments.map((metric) => [metric.node.id, metric])),
    [timelineMetrics.segments],
  );
  const { getNodeMediaDuration, getNodeRenderDuration } = useMediaDurations({
    timelineNodes,
    defaultSeconds,
    speed,
    setTimelineDurationById,
  });
  const { stopPreviewAudio, syncPreviewAudioSegments } = usePreviewAudio({ status, speed });
  const focusedTimelineMetric = focusedPreviewNode
    ? timelineMetricById.get(focusedPreviewNode.id)
    : undefined;
  const activeTimelineTime = focusedTimelineMetric
    ? clamp(focusedTimelineMetric.start + previewTime / speed, 0, timelineMetrics.totalDuration)
    : clamp(timelinePreviewTime, 0, timelineMetrics.totalDuration);
  const activeAudioSegments = useMemo(
    () =>
      timelineMetrics.segments.filter(
        (segment) =>
          segment.node.data?.audioUrl ||
          (segment.node.data?.videoUrl && segment.node.data?.muteVideoAudio !== true),
      ),
    [timelineMetrics.segments],
  );
  const getSegmentAudioSources = (node: FlowNode) =>
    [
      { kind: 'card-audio', url: node.data?.audioUrl as string | undefined },
      {
        kind: 'video-audio',
        url: node.data?.muteVideoAudio ? undefined : (node.data?.videoUrl as string | undefined),
      },
    ].filter((source): source is { kind: string; url: string } => Boolean(source.url));
  const activeTimelineFrame = Math.floor(activeTimelineTime * frameRate);
  const timelinePlayheadLeft = activeTimelineTime * timelineMetrics.pixelsPerSecond;
  const normalizeVideoTrackAssignments = (changedIds: Set<string>) => {
    const layout = calculateVideoTrackLayout({
      segments: timelineMetrics.segments,
      changedIds,
      trackIds: videoTrackIds,
      trackByNodeId: videoTrackByNodeId,
      createTrackId: () => makeTrackId('video'),
    });
    if (!layout) return;

    const shouldUpdateTrackIds =
      layout.trackIds.length !== videoTrackIds.length ||
      layout.trackIds.some((trackId, index) => trackId !== videoTrackIds[index]);
    const shouldUpdateAssignments = layout.visualSegments.some(
      (segment) => layout.trackByNodeId[segment.node.id] !== videoTrackByNodeId[segment.node.id],
    );

    if (shouldUpdateTrackIds) setVideoTrackIds(layout.trackIds);
    if (shouldUpdateAssignments) {
      setVideoTrackByNodeId((previous) => {
        const next = { ...previous };
        layout.visualSegments.forEach((segment) => {
          next[segment.node.id] =
            layout.trackByNodeId[segment.node.id] || next[segment.node.id] || 'video-1';
        });
        return next;
      });
    }
  };
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

  React.useEffect(() => {
    const previousPlacements = previousVideoPlacementRef.current;
    const nextPlacements: Record<string, { start: number; duration: number }> = {};
    const changedIds = new Set<string>();

    timelineMetrics.segments.forEach((segment) => {
      if (!isVisualTimelineNode(segment.node)) return;
      const nextPlacement = { start: segment.start, duration: segment.duration };
      nextPlacements[segment.node.id] = nextPlacement;
      const previousPlacement = previousPlacements[segment.node.id];
      if (
        !previousPlacement ||
        previousPlacement.start !== nextPlacement.start ||
        previousPlacement.duration !== nextPlacement.duration
      ) {
        changedIds.add(segment.node.id);
      }
    });

    Object.keys(previousPlacements).forEach((id) => {
      if (!nextPlacements[id]) changedIds.add(id);
    });

    previousVideoPlacementRef.current = nextPlacements;
    if (changedIds.size === 0) return;
    normalizeVideoTrackAssignments(changedIds);
  }, [timelineMetrics.segments, videoTrackByNodeId, videoTrackIds]);

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
      timelineDurationById,
      timelineDataOverrides,
      keyShotIds,
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
      setTimelineDurationById,
      setTimelineDataOverrides,
      setKeyShotIds,
      setActivePreviewId,
    });
  };

  const pushTimelineHistory = () => {
    setTimelinePast((prev) => [...prev, captureTimelineState()]);
    setTimelineFuture([]);
  };

  const captureWorkspaceState = (): PersistedRenderWorkspaceState => ({
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
    timelineDurationById,
    timelineDataOverrides,
    keyShotIds: [...keyShotIds],
    timelinePast: timelinePast.slice(-50),
    timelineFuture: timelineFuture.slice(0, 50),
    activePreviewId,
    assetRegionFilter,
    resolutionIndex,
    resolutionWidth,
    resolutionHeight,
    exportFormat,
    speed,
    defaultSeconds,
    animationLeadSeconds,
    frameRate,
    videoTextScaleMode,
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
    timelineScrollLeft: timelineScrollInfo.scrollLeft,
    assetScrollTop: assetScrollInfo.scrollTop,
    selectedAssetIds,
    focusedPreviewId,
    useGpuAcceleration,
    hideCharacterTags,
    hideSceneTags,
    webProjectName,
    webChoiceColor,
    webChoiceTextColor,
    webSettings,
    webRenderStyle: renderStyle,
    webPast: webPast.slice(-50),
    webFuture: webFuture.slice(0, 50),
    savedAt: Date.now(),
  });

  const saveWorkspaceImmediately = () => {
    const snapshot = captureWorkspaceState();
    latestWorkspaceSnapshotRef.current = { workspaceKey, snapshot };
    writeRenderWorkspaceState(workspaceKey, snapshot);
  };

  const closeContextMenu = () => setContextMenu(null);
  const {
    audioMessage,
    audioBusy,
    isRecordingVoiceover,
    generateAudioFromSelectedText,
    startVoiceoverRecording,
    stopVoiceoverRecording,
    handleAssetUploadInputChange,
    handleAssetFileDragOver,
    handleAssetFileDrop,
    revokeTrackedObjectUrl,
  } = useAssetAudioTools({
    isZh,
    selectedSpeechNodes,
    getSpeechTextForNode,
    voiceTtsConfig,
    audioTrackIds,
    setUploadedAssetNodes,
    setAssetRegionFilter,
    setActivePreviewId,
    setAudioTrackByNodeId,
    setError,
    closeContextMenu,
  });
  const closeRenderWorkspace = () => {
    saveWorkspaceImmediately();
    onClose();
  };

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
    // NOTE: Tauri uses the native folder picker; web uses showDirectoryPicker on HTTPS/localhost.
    if (isTauriRuntime()) {
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
      return;
    }

    // Web fallback: try the File System Access API.
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        setOutputDirError('');
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        setOutputDir(handle.name);
        setOutputDirError('');
        setError('');
      } catch (err) {
        // Ignore user cancellation.
        if (err instanceof Error && err.name !== 'AbortError') {
          setOutputDirError(isZh ? '选择保存位置失败。' : 'Failed to choose save location.');
        }
      }
      return;
    }

    // Fallback: ask the user to type the path manually.
    setOutputDirError(isZh ? '请手动输入保存路径。' : 'Please type the save path manually.');
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
    setContextMenu({
      ...target,
      x: event.clientX,
      y: event.clientY,
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

  const seekTimelineTime = (
    time: number,
    options?: { keepPlaying?: boolean; preserveFocus?: boolean },
  ) => {
    const nextTime = clamp(time, 0, timelineMetrics.totalDuration);
    if (!options?.preserveFocus) setFocusedPreviewId('');
    setTimelinePreviewTime(nextTime);
    if (options?.preserveFocus && focusedTimelineMetric) {
      setPreviewTime(
        clamp(
          (nextTime - focusedTimelineMetric.start) * speed,
          0,
          focusedTimelineMetric.duration * speed,
        ),
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
  const {
    assetViewportRef,
    timelineViewportRef,
    timelineScrubSurfaceRef,
    timelineThumbWidthPercent,
    timelineThumbLeftPercent,
    assetThumbHeightPercent,
    assetThumbTopPercent,
    syncTimelineScrollInfo,
    syncAssetScrollInfo,
    handleTimelineScrubStart,
    handleTimelineScrubMove,
    handleTimelineScrubEnd,
    handleTimelinePlayheadGrabStart,
    handleTimelinePlayheadGrabMove,
    handleTimelineScrollThumbStart,
    handleTimelineScrollThumbMove,
    handleTimelineScrollThumbEnd,
    handleAssetScrollThumbStart,
    handleAssetScrollThumbMove,
    handleAssetScrollThumbEnd,
    handleTimelineScaleHandleStart,
    handleTimelineScaleHandleMove,
    handleTimelineScaleHandleEnd,
    handleAssetScaleHandleStart,
    handleAssetScaleHandleMove,
    handleAssetScaleHandleEnd,
  } = useWorkspaceInteractions({
    status,
    timelineScrollInfo,
    setTimelineScrollInfo,
    assetScrollInfo,
    setAssetScrollInfo,
    assetCardScale,
    setAssetCardScale,
    timelineDisplayDuration: timelineMetrics.displayDuration,
    timelinePixelsPerSecond: timelineMetrics.pixelsPerSecond,
    timelineWheelMode,
    setTimelineDisplayDuration,
    setTimelinePixelsPerSecond,
    seekTimelineFromClientX,
  });

  const snapTimelineTime = (time: number) => {
    return calculateSnappedTimelineTime({
      time,
      enabled: timelineSnapEnabled,
      scaleMode: timelineScaleMode,
      frameRate,
    });
  };

  const snapToTimelineClipEdges = (
    nodeId: string,
    wantedStart: number,
    duration: number,
    excludedNodeIds?: Iterable<string>,
  ) =>
    calculateTimelineClipEdgeSnap({
      nodeId,
      wantedStart,
      duration,
      enabled: timelineSnapEnabled,
      pixelsPerSecond: timelineMetrics.pixelsPerSecond,
      segments: timelineMetrics.segments,
      snapTime: snapTimelineTime,
      excludedNodeIds,
      snapToTime: activeTimelineTime,
    });

  const findNonOverlappingTrackStart = (
    nodeId: string,
    wantedStart: number,
    duration: number,
    trackKind: 'video' | 'audio',
    trackId: string,
  ) => {
    return calculateNonOverlappingTrackStart({
      nodeId,
      wantedStart,
      duration,
      trackKind,
      trackId,
      segments: timelineMetrics.segments,
      videoTrackByNodeId,
      audioTrackByNodeId,
      snapToEdges: snapToTimelineClipEdges,
      snapTime: snapTimelineTime,
    });
  };

  const hasAudioTrackSpace = (nodeId: string, start: number, duration: number, trackId: string) =>
    hasTrackSpace({
      nodeId,
      start,
      duration,
      trackId,
      segments: timelineMetrics.segments,
      trackByNodeId: audioTrackByNodeId,
    });

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
    const candidateTrackIds = [matchingAudioTrackId, currentAudioTrackId, ...audioTrackIds].filter(
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

  React.useEffect(() => {
    const validIds = new Set(allAssetNodes.map((node) => node.id));
    // NOTE: 从 ref 读取最新值，避免 stale closure 导致初次挂载时过滤行为错误。
    const latestSourceById = timelineSourceByIdRef.current;
    const latestTimelineIds = timelineIdsRef.current;
    const getValidTimelineIds = (ids: string[]) =>
      ids.filter((id) => validIds.has(latestSourceById[id] || id));
    setTimelineIds((prev) => {
      const next = getValidTimelineIds(prev);
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
    });
    setSelectedIds(
      (prev) => new Set([...prev].filter((id) => validIds.has(latestSourceById[id] || id))),
    );
    setActivePreviewId((prev) =>
      prev && validIds.has(latestSourceById[prev] || prev) ? prev : allAssetNodes[0]?.id || '',
    );
    setTimelineStartById((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => validIds.has(latestSourceById[id] || id)),
      ),
    );
    setTimelineDurationById((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => validIds.has(latestSourceById[id] || id)),
      ),
    );
    setVideoTrackByNodeId((prev) => {
      const next: Record<string, string> = {};
      getValidTimelineIds(latestTimelineIds).forEach((id) => {
        next[id] = videoTrackIds.includes(prev[id]) ? prev[id] : videoTrackIds[0];
      });
      return next;
    });
    setAudioTrackByNodeId((prev) => {
      const next: Record<string, string> = {};
      getValidTimelineIds(latestTimelineIds).forEach((id) => {
        next[id] = audioTrackIds.includes(prev[id]) ? prev[id] : audioTrackIds[0];
      });
      return next;
    });
  }, [allAssetNodes, videoTrackIds, audioTrackIds, timelineExcludedSourceIds]);

  React.useEffect(() => {
    return () => {
      const latestWorkspace = latestWorkspaceSnapshotRef.current;
      if (latestWorkspace) {
        writeRenderWorkspaceState(latestWorkspace.workspaceKey, latestWorkspace.snapshot);
      }
    };
  }, []);

  React.useEffect(() => {
    const snapshot = captureWorkspaceState();
    latestWorkspaceSnapshotRef.current = { workspaceKey, snapshot };
    writeRenderWorkspaceState(workspaceKey, snapshot);
  }, [
    activePreviewId,
    animationLeadSeconds,
    assetCardLayout,
    assetCardScale,
    assetPanelWidth,
    assetRegionFilter,
    assetScrollInfo.scrollTop,
    audioTrackByNodeId,
    audioTrackIds,
    defaultSeconds,
    exportFormat,
    exportPanelWidth,
    exportSettingsMode,
    frameRate,
    focusedPreviewId,
    hideCharacterTags,
    hideSceneTags,
    outputDir,
    renderStyle,
    resolutionHeight,
    resolutionIndex,
    resolutionWidth,
    selectedIds,
    selectedAssetIds,
    speed,
    timelineDisplayDuration,
    timelineDurationById,
    timelineDataOverrides,
    timelineHeight,
    timelineIds,
    timelineExcludedSourceIds,
    timelineFuture,
    keyShotIds,
    useGpuAcceleration,
    timelinePast,
    timelinePixelsPerSecond,
    timelinePreviewTime,
    timelineScrollInfo.scrollLeft,
    timelineScaleMode,
    timelineSnapEnabled,
    timelineSourceById,
    timelineStartById,
    timelineWheelMode,
    videoTextScaleMode,
    videoTrackByNodeId,
    videoTrackIds,
    webChoiceColor,
    webChoiceTextColor,
    webFuture,
    webOutputDir,
    webPast,
    webProjectName,
    webSettings,
    workspaceKey,
    workspaceMode,
  ]);

  React.useEffect(() => {
    const saveBeforePageExit = () => {
      const latestWorkspace = latestWorkspaceSnapshotRef.current;
      if (latestWorkspace) {
        writeRenderWorkspaceState(latestWorkspace.workspaceKey, {
          ...latestWorkspace.snapshot,
          savedAt: Date.now(),
        });
      }
    };
    window.addEventListener('pagehide', saveBeforePageExit);
    window.addEventListener('beforeunload', saveBeforePageExit);
    return () => {
      window.removeEventListener('pagehide', saveBeforePageExit);
      window.removeEventListener('beforeunload', saveBeforePageExit);
    };
  }, []);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === modalRootRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  React.useEffect(() => {
    if (workspaceMode !== 'video') return;
    const frame = requestAnimationFrame(() => {
      if (timelineViewportRef.current) {
        timelineViewportRef.current.scrollLeft = timelineScrollInfo.scrollLeft;
      }
      if (assetViewportRef.current) {
        assetViewportRef.current.scrollTop = assetScrollInfo.scrollTop;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [workspaceMode]);

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
    setAssetPanelWidth((prev) =>
      prev === 0 ? 0 : clamp(prev, PANEL_SIZE_LIMITS.asset.min, assetPanelMax),
    );
  }, [assetPanelMax]);

  React.useEffect(() => {
    setExportPanelWidth((prev) =>
      prev === 0 ? 0 : clamp(prev, PANEL_SIZE_LIMITS.export.min, exportPanelMax),
    );
  }, [exportPanelMax]);

  React.useEffect(() => {
    setTimelineHeight((prev) => clamp(prev, TIMELINE_COLLAPSED_HEIGHT, timelineMax));
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
    const nextOverrides: Record<string, Record<string, unknown>> = {};
    for (const node of timelineNodes) {
      if (!isBlankTimelineSource(node)) continue;
      const currentOverride = timelineDataOverrides[node.id] || {};
      if (
        currentOverride.title === EMPTY_TIMELINE_PLACEHOLDER &&
        currentOverride.text === EMPTY_TIMELINE_PLACEHOLDER
      ) {
        continue;
      }
      nextOverrides[node.id] = {
        ...currentOverride,
        title: EMPTY_TIMELINE_PLACEHOLDER,
        text: EMPTY_TIMELINE_PLACEHOLDER,
      };
    }
    if (Object.keys(nextOverrides).length === 0) return;
    setTimelineDataOverrides((previous) => {
      let changed = false;
      const next = { ...previous };
      for (const [id, overrides] of Object.entries(nextOverrides)) {
        const current = previous[id] || {};
        if (
          current.title === overrides.title &&
          current.text === overrides.text &&
          current.imageUrl === overrides.imageUrl &&
          current.videoUrl === overrides.videoUrl &&
          current.audioUrl === overrides.audioUrl
        ) {
          continue;
        }
        next[id] = overrides;
        changed = true;
      }
      return changed ? next : previous;
    });
  }, [timelineDataOverrides, timelineNodes]);

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
    const placeholderOverrides = getTimelinePlaceholderOverrides(sourceNode);
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
    if (Object.keys(placeholderOverrides).length > 0) {
      setTimelineDataOverrides((prev) => ({
        ...prev,
        [timelineId]: {
          ...(prev[timelineId] || {}),
          ...placeholderOverrides,
        },
      }));
    }
    setSelectedIds((prev) => new Set(prev).add(timelineId));
    setActivePreviewId(timelineId);
  };
  const { handleAssetDragStart, handleTimelineDrop } = useTimelineDragDrop({
    timelineIds,
    selectedAssetIds,
    assetNodeById,
    timelineNodeById,
    timelineMetricById,
    timelineMetrics,
    videoTrackIds,
    audioTrackIds,
    activePreviewId,
    activeTimelineTime,
    defaultSeconds,
    speed,
    preservePreviewTimeOnNodeChangeRef,
    closeContextMenu,
    pushTimelineHistory,
    getNodeMediaDuration,
    makeTimelineClipInstanceId,
    getTimelinePlaceholderOverrides,
    snapTimelineTime,
    snapToTimelineClipEdges,
    findNonOverlappingTrackStart,
    getAudioDropTrackId,
    assignAudioTrackForVideoPlacement,
    addNodeToTimeline,
    setTimelineIds,
    setTimelineSourceById,
    setTimelineStartById,
    setTimelineDurationById,
    setTimelineDataOverrides,
    setVideoTrackByNodeId,
    setAudioTrackByNodeId,
    setSelectedIds,
    setActivePreviewId,
    setPreviewTime,
    setTimelinePreviewTime,
  });

  const {
    toggleNode,
    removeTimelineNodes,
    removeTimelineNode,
    useActualMediaDuration,
    separateTimelineAudio,
    toggleKeyShot,
    removeVideoTrack,
    removeAudioTrack,
    addVideoTrack,
    addAudioTrack,
    previewNode,
    selectTimelineFromNode,
    selectOnlyNode,
    selectAllTimelineNodes,
    clearTimelineSelection,
    setTimelineNodesExported,
    focusTimelineSegment,
    assignNodeTrack,
    addNearestAssetToTimeline,
  } = useTimelineEditingActions({
    timelineIds,
    timelineSourceById,
    timelineNodes,
    orderedNodes,
    nodeById,
    timelineMetricById,
    timelineStartById,
    timelineDurationById,
    videoTrackIds,
    audioTrackIds,
    audioTrackByNodeId,
    activePreviewId,
    focusedPreviewId,
    defaultSeconds,
    speed,
    visibleAssetNodes,
    preservePreviewTimeOnNodeChangeRef,
    closeContextMenu,
    pushTimelineHistory,
    getNodeMediaDuration,
    makeTimelineClipInstanceId,
    segmentTitle: (node) => getSegmentTitle(node, isZh ? '未命名片段' : 'Untitled segment'),
    separatedAudioLabel: isZh ? '音频' : 'Audio',
    assignAudioTrackForVideoPlacement,
    addNodeToTimeline,
    setTimelineIds,
    setTimelineSourceById,
    setTimelineExcludedSourceIds,
    setSelectedIds,
    setActivePreviewId,
    setFocusedPreviewId,
    setPreviewTime,
    setPreviewPlaying,
    setTimelinePreviewTime,
    setVideoTrackIds,
    setAudioTrackIds,
    setVideoTrackByNodeId,
    setAudioTrackByNodeId,
    setTimelineStartById,
    setTimelineDurationById,
    setTimelineDataOverrides,
    setKeyShotIds,
  });

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

  const updateSelectedAudioSettings = (key: 'volume' | 'fadeIn' | 'fadeOut', value: number) => {
    if (selectedAudioNodes.length === 0) return;
    setTimelineDataOverrides((previous) => {
      const next = { ...previous };
      selectedAudioNodes.forEach((node) => {
        next[node.id] = { ...(next[node.id] || {}), [key]: value };
      });
      return next;
    });
  };

  const updateProgress = (label: string, current: number, total: number) => {
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    setProgress(`${label} ${percent}%`);
    setProgressValue(percent);
  };

  // renderStaticFramesWithFfmpeg and ensureFfmpegForDesktopTranscode were removed.
  // Video encoding now uses mediabunny in the browser runtime.

  const { drawFrame } = usePreviewRenderer({
    canvasRef,
    nodes,
    focusedPreviewNode,
    previewTime,
    previewDuration,
    timelinePreviewTime,
    timelineSegments: timelineMetrics.segments,
    videoTrackByNodeId,
    videoTrackIds,
    resolution,
    renderStyle,
    videoTextScaleMode,
    animationLeadSeconds,
    isZh,
    hideCharacterTags,
    hideSceneTags,
    speed,
    status,
    segmentText: (node) => getSegmentText(node, hideCharacterTags, hideSceneTags),
  });
  const { isCancellingRender, renderVideo, cancelVideoRender } = useVideoExport({
    canvasRef,
    nodes,
    selectedNodes,
    activeAudioSegments,
    status,
    language,
    isZh,
    isDesktopApp,
    useGpuAcceleration,
    resolution,
    frameRate,
    exportFormat,
    outputDir,
    speed,
    renderStyle,
    videoTextScaleMode,
    animationLeadSeconds,
    hideCharacterTags,
    hideSceneTags,
    drawFrame,
    getNodeRenderDuration,
    getSegmentAudioSources,
    setStatus,
    setError,
    setSavedPath,
    setProgress,
    setProgressValue,
  });
  const rescanInteractiveSegments = () => {
    const next = buildInteractiveSegments(nodes, edges);
    setInteractiveSegments(next);
    setActiveInteractiveSegmentId(next[0]?.id || '');
    setError('');
    setProgress('');
    setSavedPath('');
  };
  const exportInteractiveSegments = async () => {
    if (status === 'rendering') return;
    await exportInteractiveSegmentZip({
      language,
      segments: interactiveSegments,
      nodesById: storyNodeById,
      activeSegmentId: activeInteractiveSegmentId,
      outputDir,
      frameRate,
      renderVideo,
      setStatus,
      setError,
      setSavedPath,
      setProgress,
      setProgressValue,
    });
  };  const { exportWebProject } = useWebProjectExport({
    nodes,
    edges,
    status,
    language,
    isZh,
    webProjectName,
    defaultWebProjectName,
    webRenderStyle: renderStyle,
    webChoiceColor,
    webChoiceTextColor,
    webSettings,
    webOutputDir,
    setStatus,
    setError,
    setSavedPath,
    setProgress,
    setProgressValue,
  });

  usePreviewPlayback({
    focusedPreviewNode,
    focusedTimelineMetric,
    activeAudioSegments,
    activeTimelineTime,
    previewPlaying,
    previewTime,
    previewDuration,
    speed,
    status,
    timelineTotalDuration: timelineMetrics.totalDuration,
    getNodeMediaDuration,
    getSegmentAudioSources,
    stopPreviewAudio,
    syncPreviewAudioSegments,
    seekTimelineTime,
    setPreviewDuration,
    setPreviewPlaying,
    setPreviewTime,
    setTimelinePreviewTime,
  });

  const mediaKind = getMediaKind;
  const mediaIcon = getMediaIcon;
  const segmentTitle = (node: FlowNode) =>
    getSegmentTitle(node, isZh ? '未命名片段' : 'Untitled segment');
  const segmentText = (node: FlowNode) => getSegmentText(node, hideCharacterTags, hideSceneTags);
  const segmentDurationLabel = (node: FlowNode) =>
    getSegmentDurationLabel(node, defaultSeconds, {
      longestMedia: isZh ? '按音画较长时长' : 'Longest media length',
      video: isZh ? '按视频时长' : 'Video length',
      audio: isZh ? '按音频时长' : 'Audio length',
    });
  const { sortSelectedAssetsByCardOrder, importSelectedAssetsToTimeline, removeUploadedAssets } =
    useAssetMenuActions({
      status,
      selectedAssetIds,
      visibleAssetNodes,
      uploadedAssetNodes,
      allAssetNodes,
      assetNodeById,
      timelineIds,
      timelineSourceById,
      timelineTotalDuration: timelineMetrics.totalDuration,
      videoTrackIds,
      audioTrackIds,
      speed,
      activePreviewId,
      focusedPreviewId,
      closeContextMenu,
      pushTimelineHistory,
      getNodeMediaDuration,
      makeTimelineClipInstanceId,
      revokeTrackedObjectUrl,
      setSelectedAssetIds,
      setUploadedAssetNodes,
      setTimelineIds,
      setTimelineSourceById,
      setTimelineStartById,
      setTimelineDurationById,
      setTimelineDataOverrides,
      setVideoTrackByNodeId,
      setAudioTrackByNodeId,
      setSelectedIds,
      setKeyShotIds,
      setActivePreviewId,
      setFocusedPreviewId,
    });
  const buildContextMenuSections = createContextMenuSectionBuilder({
    language,
    status,
    audioBusy,
    timelineIds,
    assetNodeById,
    timelineNodeById,
    uploadedAssetNodes,
    selectedIds,
    selectedSpeechNodes,
    visibleAssetNodes,
    videoTrackIds,
    audioTrackIds,
    videoTrackByNodeId,
    audioTrackByNodeId,
    timelineDurationById,
    keyShotIds,
    speed,
    defaultSeconds,
    canGenerateSpeechFromNode,
    segmentDurationLabel,
    segmentTitle,
    sortSelectedAssetsByCardOrder,
    importSelectedAssetsToTimeline,
    removeUploadedAssets,
    generateAudioFromSelectedText,
    setTimelineNodesExported,
    removeTimelineNodes,
    addNearestAssetToTimeline,
    selectAllTimelineNodes,
    clearTimelineSelection,
    addVideoTrack,
    addAudioTrack,
    assignNodeTrack,
    useActualMediaDuration,
    previewNode,
    toggleNode,
    separateTimelineAudio,
    toggleKeyShot,
    removeTimelineNode,
    selectOnlyNode,
    selectTimelineFromNode,
    addNodeToTimeline,
    closeContextMenu,
  });
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
              : videoWorkspaceMode === 'interactive'
                ? `${HEADER_HEIGHT}px minmax(0, 1fr)`
                : `${HEADER_HEIGHT}px minmax(0, 1fr) ${timelineHeight}px`,
        }}
      >
        <RenderHeader
          language={language}
          workspaceMode={workspaceMode}
          videoWorkspaceMode={videoWorkspaceMode}
          status={status}
          isFullscreen={isFullscreen}
          assetPanelCollapsed={assetPanelCollapsed}
          exportPanelCollapsed={exportPanelCollapsed}
          timelinePast={timelinePast}
          timelineFuture={timelineFuture}
          webPast={webPast}
          webFuture={webFuture}
          selectedNodes={
            videoWorkspaceMode === 'interactive'
              ? interactiveSegments.filter((segment) => segment.enabled)
              : selectedNodes
          }
          nodes={nodes}
          setWorkspaceMode={(mode) => {
            saveWorkspaceImmediately();
            setWorkspaceMode(mode);
          }}
          setVideoWorkspaceMode={setVideoWorkspaceMode}
          setError={setError}
          setProgress={setProgress}
          setSavedPath={setSavedPath}
          toggleFullscreen={toggleFullscreen}
          toggleAssetPanel={toggleAssetPanel}
          toggleExportPanel={toggleExportPanel}
          undoTimeline={undoTimeline}
          redoTimeline={redoTimeline}
          undoWeb={undoWeb}
          redoWeb={redoWeb}
          onExportClick={() => {
            if (workspaceMode === 'video' && videoWorkspaceMode === 'interactive') {
              exportInteractiveSegments();
              return;
            }
            setIsExportDialogOpen(true);
          }}
          onClose={closeRenderWorkspace}
        />

        {workspaceMode === 'video' ? (
          videoWorkspaceMode === 'interactive' ? (
            <InteractiveSegmentExportWorkspace
              language={language}
              segments={interactiveSegments}
              nodes={nodes}
              nodesById={storyNodeById}
              renderStyle={renderStyle}
              videoTextScaleMode={videoTextScaleMode}
              animationLeadSeconds={animationLeadSeconds}
              hideCharacterTags={hideCharacterTags}
              hideSceneTags={hideSceneTags}
              activeSegmentId={activeInteractiveSegmentId}
              status={status}
              exportFormat={exportFormat}
              frameRate={frameRate}
              resolutionIndex={resolutionIndex}
              resolutionWidth={resolutionWidth}
              resolutionHeight={resolutionHeight}
              outputDir={outputDir}
              outputDirError={outputDirError}
              progress={progress}
              error={error}
              progressValue={progressValue}
              savedPath={savedPath}
              defaultSeconds={defaultSeconds}
              onSelectSegment={setActiveInteractiveSegmentId}
              onSegmentsChange={setInteractiveSegments}
              onRescan={rescanInteractiveSegments}
              setExportFormat={setExportFormat}
              setFrameRate={setFrameRate}
              setResolutionIndex={setResolutionIndex}
              setResolutionWidth={setResolutionWidth}
              setResolutionHeight={setResolutionHeight}
              setOutputDir={setOutputDir}
              setOutputDirError={setOutputDirError}
              chooseOutputDir={chooseOutputDir}
            />
          ) : (
          <>
            <main className="min-h-0 min-w-0 flex overflow-hidden bg-[var(--vr-bg)]">
              <VideoAssetSidebar
                language={language}
                assetPanelWidth={assetPanelCollapsed ? 0 : assetPanelWidth}
                assetCardLayout={assetCardLayout}
                assetCardScale={assetCardScale}
                assetRegionFilter={assetRegionFilter}
                assetRegionOptions={assetRegionOptions}
                visibleAssetNodes={visibleAssetNodes}
                allAssetNodes={allAssetNodes}
                timelineIds={timelineIds}
                nodeRegionById={nodeRegionById}
                activePreviewNode={activePreviewNode}
                selectedAssetIds={selectedAssetIds}
                assetScrollInfo={assetScrollInfo}
                assetThumbTopPercent={assetThumbTopPercent}
                assetThumbHeightPercent={assetThumbHeightPercent}
                assetUploadInputRef={assetUploadInputRef}
                assetViewportRef={assetViewportRef}
                setAssetCardLayout={setAssetCardLayout}
                setAssetRegionFilter={setAssetRegionFilter}
                setActivePreviewId={setActivePreviewId}
                setAssetSelection={(ids) => {
                  setSelectedAssetIds(ids);
                }}
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
              {!assetPanelCollapsed && (
                <ResizeHandle
                  label={renderCopy(
                    language,
                    '调整素材栏宽度',
                    '素材欄の幅を調整',
                    'Resize asset panel',
                  )}
                  axis="x"
                  value={assetPanelWidth}
                  min={0}
                  max={assetPanelMax}
                  onChange={setAssetPanelWidthInteractive}
                  onDragEnd={commitAssetPanelWidth}
                />
              )}

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

              {!exportPanelCollapsed && (
                <ResizeHandle
                  label={renderCopy(
                    language,
                    '调整导出设置宽度',
                    '書き出し設定の幅を調整',
                    'Resize export settings',
                  )}
                  axis="x"
                  value={exportPanelWidth}
                  min={0}
                  max={exportPanelMax}
                  reverse
                  onChange={setExportPanelWidthInteractive}
                  onDragEnd={commitExportPanelWidth}
                />
              )}
              <VideoExportSettingsPanel
                language={language}
                exportPanelWidth={exportPanelCollapsed ? 0 : exportPanelWidth}
                exportSettingsMode={exportSettingsMode}
                setExportSettingsMode={setExportSettingsMode}
                status={status}
                exportFormat={exportFormat}
                setExportFormat={setExportFormat}
                resolutionIndex={resolutionIndex}
                setResolutionIndex={setResolutionIndex}
                resolutionWidth={resolutionWidth}
                setResolutionWidth={setResolutionWidth}
                resolutionHeight={resolutionHeight}
                setResolutionHeight={setResolutionHeight}
                frameRate={frameRate}
                setFrameRate={setFrameRate}
                outputDir={outputDir}
                setOutputDir={setOutputDir}
                outputDirError={outputDirError}
                setOutputDirError={setOutputDirError}
                chooseOutputDir={chooseOutputDir}
                renderStyle={renderStyle}
                updateRenderStyle={updateRenderStyle}
                videoTextScaleMode={videoTextScaleMode}
                setVideoTextScaleMode={setVideoTextScaleMode}
                speed={speed}
                setSpeed={setSpeed}
                selectedSpeechNodeCount={selectedSpeechNodes.length}
                selectedAudioClipCount={selectedAudioNodes.length}
                selectedAudioVolume={selectedAudioVolume}
                selectedAudioFadeIn={selectedAudioFadeIn}
                selectedAudioFadeOut={selectedAudioFadeOut}
                updateSelectedAudioSettings={updateSelectedAudioSettings}
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
                useGpuAcceleration={useGpuAcceleration}
                setUseGpuAcceleration={setUseGpuAcceleration}
                isWebGPUSupported={isWebGPUSupported()}
                hideCharacterTags={hideCharacterTags}
                setHideCharacterTags={setHideCharacterTags}
                hideSceneTags={hideSceneTags}
                setHideSceneTags={setHideSceneTags}
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
              keyShotIds={keyShotIds}
              addVideoTrack={addVideoTrack}
              addAudioTrack={addAudioTrack}
              removeVideoTrack={removeVideoTrack}
              removeAudioTrack={removeAudioTrack}
              removeTimelineNode={removeTimelineNode}
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
              pushTimelineHistory={pushTimelineHistory}
              snapTimelineTime={snapTimelineTime}
              setTimelineStartById={setTimelineStartById}
              setTimelineDurationById={setTimelineDurationById}
            />
          </>
          )
        ) : (
          <WebWorkspace
            nodes={nodes}
            edges={edges}
            language={language}
            webRenderStyle={renderStyle}
            webChoiceColor={webChoiceColor}
            webChoiceTextColor={webChoiceTextColor}
            webSettings={webSettings}
            webProjectName={webProjectName}
            progress={progress}
            error={error}
            progressValue={progressValue}
            savedPath={savedPath}
            updateWebSettings={updateWebSettings}
            updateWebChoiceTextColor={updateWebChoiceTextColor}
            updateWebChoiceColor={updateWebChoiceColor}
            updateWebRenderStyle={updateRenderStyle}
            callAIForTextResult={callAIForTextResult}
          />
        )}
      </div>
      {workspaceMode === 'video' && videoWorkspaceMode === 'timeline' && (
        <RenderContextMenu
          contextMenu={contextMenu}
          nodeById={nodeById}
          timelineMenuLabel={renderCopy(
            language,
            '时间线菜单',
            'タイムラインメニュー',
            'Timeline menu',
          )}
          assetMenuLabel={renderCopy(
            language,
            `素材批量菜单（${selectedAssetIds.length}）`,
            `素材一括メニュー（${selectedAssetIds.length}）`,
            `Asset batch menu (${selectedAssetIds.length})`,
          )}
          buildContextMenuSections={buildContextMenuSections}
          mediaIcon={mediaIcon}
          mediaKind={mediaKind}
          segmentDurationLabel={segmentDurationLabel}
          segmentTitle={segmentTitle}
          segmentText={segmentText}
        />
      )}
      {workspaceMode === 'video' && status === 'rendering' && (
        <RenderProgressModal
          language={language}
          progress={progress}
          progressValue={progressValue}
          cancelling={isCancellingRender}
          onCancel={cancelVideoRender}
        />
      )}
      {isExportDialogOpen && (
        <ExportDialog
          workspaceMode={workspaceMode}
          language={language}
          isDesktopApp={isDesktopApp}
          defaultVideoFileName={`galwriter-render-${Date.now()}`}
          defaultWebProjectName={defaultWebProjectName}
          videoOutputDir={outputDir}
          webOutputDir={webOutputDir}
          videoOutputDirError={outputDirError}
          webOutputDirError={webOutputDirError}
          webProjectName={webProjectName}
          frameRate={frameRate}
          exportFormat={exportFormat}
          onClose={() => setIsExportDialogOpen(false)}
          onConfirm={({ name, frameRate: chosenFrameRate, exportFormat: chosenFormat }) => {
            setIsExportDialogOpen(false);
            if (workspaceMode === 'video') {
              setFrameRate(chosenFrameRate);
              setExportFormat(chosenFormat);
              renderVideo({
                fileName: name,
                frameRate: chosenFrameRate,
                exportFormat: chosenFormat,
              });
            } else {
              exportWebProject();
            }
          }}
          onChooseVideoOutputDir={chooseOutputDir}
          onChooseWebOutputDir={chooseWebOutputDir}
          setVideoOutputDir={setOutputDir}
          setWebOutputDir={setWebOutputDir}
          setVideoOutputDirError={setOutputDirError}
          setWebOutputDirError={setWebOutputDirError}
          setWebProjectName={setWebProjectName}
        />
      )}
      <VideoNoticeModal notice={noticeModal} onClose={() => setNoticeModal(null)} />
    </div>
  );
}
