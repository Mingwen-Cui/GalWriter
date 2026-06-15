import type { Node as FlowNode } from '@xyflow/react';
import React, { useMemo, useRef, useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import { resolveRegionBackgroundMusic } from '../../../../lib/regionMusic';
import { buildInteractiveWebZipBlob, exportInteractiveWebZip } from '../../web/webExport';
import { WebWorkspace } from '../../web/WebWorkspace';
import { getAssetRegionOptions, getStoryNodeRegion } from '../assets/assetRegions';
import { buildAudioBuffer, buildAudioTrack } from '../audio/audioTrack';
import { makeTrackId, ResizeHandle } from '../controls/RenderControls';
import {
  chooseRenderOutputDir,
  getDefaultRenderDir,
  saveRenderedVideo,
  saveRenderedWebZip,
} from '../export/tauriRenderAdapter';
import { useWebExportSettings } from '../export/useWebExportSettings';
import { clearGPUTextCache, drawGPUFrame } from '../gpu/gpuFrameRenderer';
import {
  destroyWebGPU,
  getWebGPUCanvas,
  initWebGPU,
  isWebGPUSupported,
} from '../gpu/webgpuRenderer';
import { RenderContextMenu } from '../panels/RenderContextMenu';
import { RenderHeader } from '../panels/RenderHeader';
import { RenderProgressModal } from '../panels/RenderProgressModal';
import { VideoAssetSidebar } from '../panels/VideoAssetSidebar';
import { VideoExportSettingsPanel } from '../panels/VideoExportSettingsPanel';
import { VideoPreviewPanel } from '../panels/VideoPreviewPanel';
import { VideoTimelinePanel } from '../panels/VideoTimelinePanel';
import { drawRenderFrame } from '../preview/frameRenderer';
import {
  ASSET_CARD_MAX_SCALE,
  ASSET_CARD_MIN_SCALE,
  DEFAULT_VIDEO_BITRATE,
  EXPORT_FORMAT_OPTIONS,
  FRAME_RATE_OPTIONS,
  HEADER_HEIGHT,
  MIN_MAIN_HEIGHT,
  MIN_PREVIEW_WIDTH,
  PANEL_SIZE_LIMITS,
  RESOLUTION_OPTIONS,
  TIMELINE_PIXELS_PER_SECOND,
} from '../shared/constants';
import {
  clamp,
  isTauriRuntime,
  loadVideo,
  seekVideo,
  validDuration,
} from '../shared/mediaUtils';
import { renderCopy } from '../shared/renderCopy';
import { stripHtml } from '../shared/storyNodes';
import {
  getNodeDisplayTitle,
  getOrderedStoryNodes,
} from '../shared/storyNodes';
import type {
  AssetCardLayout,
  ExportFormat,
  ExportSettingsMode,
  RenderContextMenuState,
  RenderContextMenuTarget,
  RenderStatus,
  RenderStyle,
  RenderWorkspaceMode,
  SegmentRenderInfo,
  TimelineHistoryState,
  TimelineScaleMode,
  TimelineWheelMode,
  VideoRenderModalProps,
} from '../shared/types';
import {
  captureTimelineHistoryState,
  restoreTimelineHistoryState,
} from '../timeline/timelineHistory';
import { getTimelineTickSettings } from '../timeline/timelineUtils';
import {
  DEFAULT_RENDER_STYLE,
  DESKTOP_RELEASE_URL,
  clampPersistedNumber,
  isAssetCardLayout,
  isExportFormat,
  isExportSettingsMode,
  isRenderWorkspaceMode,
  isTimelineScaleMode,
  isTimelineWheelMode,
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
import { useMediaDurations } from './useMediaDurations';
import { usePreviewAudio } from './usePreviewAudio';
import { useWorkspaceInteractions } from './useWorkspaceInteractions';

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
    isRenderWorkspaceMode(persistedWorkspace?.workspaceMode)
      ? persistedWorkspace.workspaceMode
      : 'video',
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
  } = useWebExportSettings(defaultWebProjectName, status === 'rendering', {
    projectName: persistedWorkspace?.webProjectName,
    choiceColor: persistedWorkspace?.webChoiceColor,
    choiceTextColor: persistedWorkspace?.webChoiceTextColor,
    settings: persistedWorkspace?.webSettings,
    renderStyle: persistedWorkspace?.webRenderStyle,
    past: persistedWorkspace?.webPast,
    future: persistedWorkspace?.webFuture,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      new Set(Array.isArray(persistedWorkspace?.selectedIds) ? persistedWorkspace.selectedIds : []),
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
    clampPersistedNumber(persistedWorkspace?.resolutionIndex, 0, -1, RESOLUTION_OPTIONS.length - 1),
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
  const [outputDir, setOutputDir] = useState(() => persistedWorkspace?.outputDir || '');
  const [webOutputDir, setWebOutputDir] = useState(() => persistedWorkspace?.webOutputDir || '');
  const [renderStyle, setRenderStyle] = useState<RenderStyle>({
    ...DEFAULT_RENDER_STYLE,
    ...persistedWorkspace?.renderStyle,
  });
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
  const [isCancellingRender, setIsCancellingRender] = useState(false);
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
    isAssetCardLayout(persistedWorkspace?.assetCardLayout)
      ? persistedWorkspace.assetCardLayout
      : 'row',
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
  const modalRootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetUploadInputRef = useRef<HTMLInputElement>(null);
  const preservePreviewTimeOnNodeChangeRef = useRef(false);
  const previewVideoRef = useRef<{ url: string; video: HTMLVideoElement } | null>(null);
  const previewDrawIdRef = useRef(0);
  const timelineClipCounterRef = useRef(0);
  const renderAbortControllerRef = useRef<AbortController | null>(null);
  const latestWorkspaceSnapshotRef = useRef<{
    workspaceKey?: string;
    snapshot: PersistedRenderWorkspaceState;
  } | null>(null);
  const previousVideoPlacementRef = useRef<Record<string, { start: number; duration: number }>>(
    {},
  );
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
  const selectedNodes = useMemo(
    () => timelineNodes.filter((node) => selectedIds.has(node.id)),
    [timelineNodes, selectedIds],
  );
  const speechTagNames = useMemo(() => getSpeechTagNames(nodes), [nodes]);
  const getSpeechTextForNode = (node: FlowNode) =>
    buildSpeechTextForNode(node, speechTagNames);
  const canGenerateSpeechFromNode = (node: FlowNode) => Boolean(getSpeechTextForNode(node));
  const selectedSpeechNodes = selectedNodes.filter(canGenerateSpeechFromNode);
  const activePreviewNode = nodeById.get(activePreviewId) || selectedNodes[0] || allAssetNodes[0];
  const focusedPreviewNode = focusedPreviewId ? nodeById.get(focusedPreviewId) : undefined;
  const resolution = {
    label: `${resolutionWidth} x ${resolutionHeight}`,
    width: resolutionWidth,
    height: resolutionHeight,
  };
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
    webRenderStyle,
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

  const snapToTimelineClipEdges = (nodeId: string, wantedStart: number, duration: number) =>
    calculateTimelineClipEdgeSnap({
      nodeId,
      wantedStart,
      duration,
      enabled: timelineSnapEnabled,
      pixelsPerSecond: timelineMetrics.pixelsPerSecond,
      segments: timelineMetrics.segments,
      snapTime: snapTimelineTime,
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
      videoTrackIds,
      audioTrackIds,
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
      fallbackTrackId: audioTrackIds[0],
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
    const getValidTimelineIds = (ids: string[]) =>
      ids.filter((id) => validIds.has(timelineSourceById[id] || id));
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
      (prev) => new Set([...prev].filter((id) => validIds.has(timelineSourceById[id] || id))),
    );
    setActivePreviewId((prev) =>
      prev && validIds.has(timelineSourceById[prev] || prev) ? prev : allAssetNodes[0]?.id || '',
    );
    setTimelineStartById((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => validIds.has(timelineSourceById[id] || id)),
      ),
    );
    setTimelineDurationById((prev) =>
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
    videoTrackIds,
    audioTrackIds,
    timelineIds,
    timelineSourceById,
    timelineExcludedSourceIds,
  ]);

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
    videoTrackByNodeId,
    videoTrackIds,
    webChoiceColor,
    webChoiceTextColor,
    webFuture,
    webOutputDir,
    webPast,
    webProjectName,
    webRenderStyle,
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

  const removeTimelineNodes = (ids: string[]) => {
    const removedIds = new Set(ids.filter((id) => timelineIds.includes(id)));
    if (removedIds.size === 0) return;
    const remainingIds = timelineIds.filter((id) => !removedIds.has(id));
    const removedSourceIds = new Set(
      Array.from(removedIds).map((id) => timelineSourceById[id] || id),
    );
    const excludedSourceIds = Array.from(removedSourceIds).filter(
      (sourceId) =>
        !remainingIds.some(
          (timelineId) => (timelineSourceById[timelineId] || timelineId) === sourceId,
        ),
    );
    closeContextMenu();
    pushTimelineHistory();
    setTimelineIds(remainingIds);
    if (excludedSourceIds.length > 0) {
      setTimelineExcludedSourceIds((prev) => {
        const next = new Set(prev);
        excludedSourceIds.forEach((sourceId) => next.add(sourceId));
        return next;
      });
    }
    setTimelineSourceById((prev) => {
      return Object.fromEntries(
        Object.entries(prev).filter(([timelineId]) => !removedIds.has(timelineId)),
      );
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      removedIds.forEach((id) => next.delete(id));
      return next;
    });
    if (removedIds.has(activePreviewId)) {
      const nextNode = timelineNodes.find((node) => !removedIds.has(node.id)) || orderedNodes[0];
      setActivePreviewId(nextNode?.id || '');
    }
    if (removedIds.has(focusedPreviewId)) {
      setFocusedPreviewId('');
    }
    const removeMapEntries = <T,>(map: Record<string, T>) =>
      Object.fromEntries(Object.entries(map).filter(([id]) => !removedIds.has(id)));
    setVideoTrackByNodeId(removeMapEntries);
    setAudioTrackByNodeId(removeMapEntries);
    setTimelineStartById(removeMapEntries);
    setTimelineDurationById(removeMapEntries);
    setTimelineDataOverrides(removeMapEntries);
    setKeyShotIds((previous) => {
      const next = new Set(previous);
      removedIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const removeTimelineNode = (id: string) => removeTimelineNodes([id]);

  const useActualMediaDuration = async (node: FlowNode) => {
    if (!timelineIds.includes(node.id)) return;
    const duration = await getNodeMediaDuration(node);
    closeContextMenu();
    pushTimelineHistory();
    setTimelineDurationById((previous) => ({
      ...previous,
      [node.id]: Math.max(0.25, duration),
    }));
  };

  const separateTimelineAudio = (node: FlowNode) => {
    if (!timelineIds.includes(node.id) || !node.data?.videoUrl) return;
    const audioTimelineId = makeTimelineClipInstanceId(timelineSourceById[node.id] || node.id);
    const start = timelineMetricById.get(node.id)?.start || 0;
    const duration = timelineDurationById[node.id] || defaultSeconds;
    const audioTrackId = audioTrackByNodeId[node.id] || audioTrackIds[0] || 'audio-1';

    closeContextMenu();
    pushTimelineHistory();
    setTimelineIds((previous) => [...previous, audioTimelineId]);
    setTimelineSourceById((previous) => ({
      ...previous,
      [audioTimelineId]: timelineSourceById[node.id] || node.id,
    }));
    setTimelineDataOverrides((previous) => ({
      ...previous,
      [node.id]: {
        ...(previous[node.id] || {}),
        audioUrl: undefined,
        muteVideoAudio: true,
      },
      [audioTimelineId]: {
        videoUrl: undefined,
        imageUrl: undefined,
        text: '',
        audioUrl: node.data.videoUrl,
        title: `${segmentTitle(node)} - 音频`,
      },
    }));
    setTimelineStartById((previous) => ({ ...previous, [audioTimelineId]: start }));
    setTimelineDurationById((previous) => ({ ...previous, [audioTimelineId]: duration }));
    setAudioTrackByNodeId((previous) => ({
      ...previous,
      [audioTimelineId]: audioTrackId,
    }));
    setSelectedIds((previous) => new Set(previous).add(audioTimelineId));
  };

  const toggleKeyShot = (id: string) => {
    if (!timelineIds.includes(id)) return;
    closeContextMenu();
    pushTimelineHistory();
    setKeyShotIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const setTimelineNodesExported = (ids: string[], exported: boolean) => {
    const timelineIdSet = new Set(ids.filter((id) => timelineIds.includes(id)));
    if (timelineIdSet.size === 0) return;
    closeContextMenu();
    pushTimelineHistory();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      timelineIdSet.forEach((id) => {
        if (exported) next.add(id);
        else next.delete(id);
      });
      return next;
    });
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
    draggedTimelineIds?: string[],
  ) => {
    event.stopPropagation();
    const draggedAssetIds =
      trackKind && draggedTimelineIds?.includes(id) && draggedTimelineIds.length > 1
        ? draggedTimelineIds.filter((timelineId) => timelineIds.includes(timelineId))
        : !trackKind && selectedAssetIds.includes(id) && selectedAssetIds.length > 1
          ? selectedAssetIds
          : [id];
    event.dataTransfer.setData('application/x-galwriter-node', id);
    event.dataTransfer.setData('application/x-galwriter-nodes', JSON.stringify(draggedAssetIds));
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

  const handleTimelineDrop = async (
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
    let draggedAssetIds: string[] = [];
    try {
      const parsed = JSON.parse(
        event.dataTransfer.getData('application/x-galwriter-nodes') || '[]',
      );
      if (Array.isArray(parsed)) {
        draggedAssetIds = parsed.filter(
          (id): id is string =>
            typeof id === 'string' && (assetNodeById.has(id) || timelineNodeById.has(id)),
        );
      }
    } catch {
      draggedAssetIds = [];
    }
    const isTimelineClip = dragOrigin === 'timeline' && timelineIds.includes(draggedId);
    if (!isTimelineClip && !assetNodeById.has(draggedId)) return;
    let droppedTrackKind =
      trackKind ||
      (event.dataTransfer.getData('application/x-galwriter-track-kind') as 'video' | 'audio') ||
      'video';
    let droppedTrackId = trackId;
    if (dragOrigin === 'asset' && draggedAssetIds.length > 1) {
      const trackElement = (event.currentTarget as HTMLElement).closest(
        '[data-render-track-kind]',
      ) as HTMLElement | null;
      const rect = (trackElement || (event.currentTarget as HTMLElement)).getBoundingClientRect();
      const dropTime = Math.max(
        0,
        (event.clientX - rect.left) / Math.max(1, timelineMetrics.pixelsPerSecond),
      );
      const newIds = [];
      for (const sourceId of draggedAssetIds) {
        const sourceNode = assetNodeById.get(sourceId);
        if (!sourceNode) continue;
        newIds.push({
          sourceId,
          timelineId: makeTimelineClipInstanceId(sourceId),
          mediaDuration: await getNodeMediaDuration(sourceNode),
          placeholderOverrides: getTimelinePlaceholderOverrides(sourceNode),
        });
      }
      let cursor = dropTime;
      const startById: Record<string, number> = {};
      const durationById: Record<string, number> = {};
      newIds.forEach(({ timelineId, mediaDuration }) => {
        const duration = Math.max(0.25, mediaDuration / speed);
        startById[timelineId] = cursor;
        durationById[timelineId] = mediaDuration;
        cursor += duration;
      });
      const timelineDataOverridesById = Object.fromEntries(
        newIds
          .filter(({ placeholderOverrides }) => Object.keys(placeholderOverrides).length > 0)
          .map(({ timelineId, placeholderOverrides }) => [timelineId, placeholderOverrides]),
      );
      const targetVideoTrackId = droppedTrackId || videoTrackIds[0] || 'video-1';
      const targetAudioTrackId =
        droppedTrackKind === 'audio'
          ? droppedTrackId || audioTrackIds[0] || 'audio-1'
          : audioTrackIds[videoTrackIds.indexOf(targetVideoTrackId)] ||
            audioTrackIds[0] ||
            'audio-1';

      pushTimelineHistory();
      setTimelineIds((prev) => [...prev, ...newIds.map(({ timelineId }) => timelineId)]);
      setTimelineSourceById((prev) => ({
        ...prev,
        ...Object.fromEntries(newIds.map(({ timelineId, sourceId }) => [timelineId, sourceId])),
      }));
      setTimelineStartById((prev) => ({ ...prev, ...startById }));
      setTimelineDurationById((prev) => ({ ...prev, ...durationById }));
      setTimelineDataOverrides((prev) => ({ ...prev, ...timelineDataOverridesById }));
      setVideoTrackByNodeId((prev) => ({
        ...prev,
        ...Object.fromEntries(
          newIds
            .filter(({ sourceId }) => {
              const sourceNode = assetNodeById.get(sourceId);
              return droppedTrackKind !== 'audio' && !isAudioOnlyNode(sourceNode);
            })
            .map(({ timelineId }) => [timelineId, targetVideoTrackId]),
        ),
      }));
      setAudioTrackByNodeId((prev) => ({
        ...prev,
        ...Object.fromEntries(newIds.map(({ timelineId }) => [timelineId, targetAudioTrackId])),
      }));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        newIds.forEach(({ timelineId }) => next.add(timelineId));
        return next;
      });
      setActivePreviewId(newIds[0]?.timelineId || '');
      closeContextMenu();
      return;
    }
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
      const placeholderOverrides = isTimelineClip
        ? {}
        : getTimelinePlaceholderOverrides(draggedSourceNode);
      const duration = isTimelineClip
        ? timelineMetricById.get(draggedId)?.duration || Math.max(0.25, defaultSeconds / speed)
        : Math.max(0.25, defaultSeconds / speed);
      const droppedTime =
        (event.clientX - rect.left) / Math.max(1, timelineMetrics.pixelsPerSecond) -
        dragOffsetSeconds;
      const draggedTimelineClipIds =
        isTimelineClip && draggedAssetIds.includes(draggedId)
          ? draggedAssetIds.filter((id) => timelineMetricById.has(id))
          : [];

      if (draggedTimelineClipIds.length > 1) {
        const anchorStart = timelineMetricById.get(draggedId)?.start || 0;
        const desiredAnchorStart = snapTimelineTime(droppedTime);
        const rawDelta = desiredAnchorStart - anchorStart;
        const minimumStart = Math.min(
          ...draggedTimelineClipIds.map((id) => timelineMetricById.get(id)?.start || 0),
        );
        const delta = Math.max(rawDelta, -minimumStart);
        const nextStarts = Object.fromEntries(
          draggedTimelineClipIds.map((id) => [
            id,
            Math.max(0, (timelineMetricById.get(id)?.start || 0) + delta),
          ]),
        );

        pushTimelineHistory();
        setTimelineStartById((previous) => ({ ...previous, ...nextStarts }));

        if (droppedTrackKind === 'video' && droppedTrackId) {
          setVideoTrackByNodeId((previous) => ({ ...previous, [draggedId]: droppedTrackId! }));
          assignAudioTrackForVideoPlacement(
            draggedId,
            nextStarts[draggedId],
            timelineMetricById.get(draggedId)?.duration || Math.max(0.25, defaultSeconds / speed),
            droppedTrackId,
          );
        } else if (droppedTrackKind === 'audio' && droppedTrackId) {
          setAudioTrackByNodeId((previous) => ({ ...previous, [draggedId]: droppedTrackId! }));
        }

        if (draggedTimelineClipIds.includes(activePreviewId)) {
          preservePreviewTimeOnNodeChangeRef.current = true;
          setTimelinePreviewTime((previous) =>
            clamp(previous + delta, 0, timelineMetrics.totalDuration + Math.max(0, delta)),
          );
        }
        return;
      }

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
      if (Object.keys(placeholderOverrides).length > 0) {
        setTimelineDataOverrides((prev) => ({
          ...prev,
          [timelineId]: {
            ...(prev[timelineId] || {}),
            ...placeholderOverrides,
          },
        }));
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
      nodes,
      hideCharacterTags,
      hideSceneTags,
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

    await drawFrame(
      ctx,
      segment.node,
      width,
      height,
      undefined,
      localTime,
      segment.duration * speed,
    );
  };

  const renderVideo = async () => {
    if (selectedNodes.length === 0 || status === 'rendering') return;

    const canvas2d = canvasRef.current;
    const ctx2d = canvas2d?.getContext('2d');
    if (!canvas2d || !ctx2d) return;

    const abortController = new AbortController();
    renderAbortControllerRef.current = abortController;
    setIsCancellingRender(false);
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
    const throwIfRenderCancelled = () => abortController.signal.throwIfAborted();

    try {
      throwIfRenderCancelled();
      canvas.width = resolution.width;
      canvas.height = resolution.height;

      // 计算每个节点的渲染时长
      const nodeDurations: number[] = [];
      let totalDuration = 0;
      for (const node of selectedNodes) {
        throwIfRenderCancelled();
        const duration = await getNodeRenderDuration(node);
        nodeDurations.push(duration);
        totalDuration += duration;
      }

      const totalFrames = Math.max(1, Math.ceil(totalDuration * frameRate));

      // 准备时间线音频
      const audioSegments: SegmentRenderInfo[] = activeAudioSegments.flatMap((segment) =>
        getSegmentAudioSources(segment.node).map((source) => ({
          node: segment.node,
          startSecs: segment.start,
          durationSecs: segment.duration,
          audioUrl: source.url,
        })),
      );
      let regionCursor = 0;
      selectedNodes.forEach((node, index) => {
        const duration = nodeDurations[index];
        const match = resolveRegionBackgroundMusic(nodes, node);
        const previous = audioSegments[audioSegments.length - 1];
        const canExtend =
          match &&
          previous?.node.id === `region-music:${match.regionId}` &&
          previous.audioUrl === match.music.url &&
          previous.startSecs !== undefined &&
          previous.startSecs + previous.durationSecs === regionCursor;

        if (canExtend) {
          previous.durationSecs += duration;
          previous.fadeOut = match.music.fadeOut;
        } else if (match) {
          audioSegments.push({
            node: {
              id: `region-music:${match.regionId}`,
              type: 'regionMusic',
              position: { x: 0, y: 0 },
              data: {},
            },
            startSecs: regionCursor,
            durationSecs: duration,
            audioUrl: match.music.url,
            volume: match.music.volume,
            loop: match.music.loop,
            fadeIn: match.music.fadeIn,
            fadeOut: match.music.fadeOut,
          });
        }
        regionCursor += duration;
      });

      const audioBuffer = await buildAudioBuffer(audioSegments, speed, totalDuration);
      throwIfRenderCancelled();

      // 预加载视频资源
      const videoCache = new Map<string, HTMLVideoElement>();
      for (const node of selectedNodes) {
        throwIfRenderCancelled();
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
        throwIfRenderCancelled();
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
        throwIfRenderCancelled();
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
          nodes,
          hideCharacterTags,
          hideSceneTags,
        });

        setProgress(`${nodeIndex + 1}/${selectedNodes.length} ${String(node.data?.title || '')}`);
      };

      // 动态导入 mediabunny 编码器
      const { renderVideoToBuffer } = await import('../export/browserVideoEncoder');

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
        signal: abortController.signal,
      });

      throwIfRenderCancelled();
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
        const mimeType =
          exportFormat === 'mov'
            ? 'video/quicktime'
            : exportFormat === 'mkv'
              ? 'video/x-matroska'
              : 'video/mp4';
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
      if (renderError?.name === 'AbortError' || abortController.signal.aborted) {
        setStatus('idle');
        setError('');
        setProgressValue(0);
        setProgress(
          renderCopy(
            language,
            '渲染已取消',
            'レンダリングをキャンセルしました',
            'Render cancelled',
          ),
        );
        return;
      }
      console.error('Video render failed:', renderError);
      setStatus('error');
      setError(renderError?.message || (isZh ? '视频渲染失败' : 'Video render failed'));
    } finally {
      if (renderAbortControllerRef.current === abortController) {
        renderAbortControllerRef.current = null;
      }
      setIsCancellingRender(false);
      if (useGpu) {
        destroyWebGPU();
        clearGPUTextCache();
      }
    }
  };

  const cancelVideoRender = () => {
    const controller = renderAbortControllerRef.current;
    if (!controller || controller.signal.aborted) return;
    setIsCancellingRender(true);
    setProgress(
      renderCopy(
        language,
        '正在取消渲染...',
        'レンダリングをキャンセルしています...',
        'Cancelling render...',
      ),
    );
    controller.abort();
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
        const blob = await buildInteractiveWebZipBlob(nodes, edges, webExportOptions);
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
        await exportInteractiveWebZip(nodes, edges, webExportOptions);
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
    void syncPreviewAudioSegments(overlappingSegments, previewPlaying);
  }, [
    activeAudioSegments,
    activeTimelineTime,
    focusedPreviewNode,
    previewPlaying,
    previewTime,
    speed,
    status,
  ]);

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

  const mediaKind = getMediaKind;
  const mediaIcon = getMediaIcon;
  const segmentTitle = (node: FlowNode) =>
    getSegmentTitle(node, isZh ? '未命名片段' : 'Untitled segment');
  const segmentText = (node: FlowNode) =>
    getSegmentText(node, hideCharacterTags, hideSceneTags);
  const segmentDurationLabel = (node: FlowNode) =>
    getSegmentDurationLabel(node, defaultSeconds, {
      longestMedia: isZh ? '按音画较长时长' : 'Longest media length',
      video: isZh ? '按视频时长' : 'Video length',
      audio: isZh ? '按音频时长' : 'Audio length',
    });
  const getSelectedAssetsInCardOrder = () => {
    const visibleIndex = new Map(visibleAssetNodes.map((node, index) => [node.id, index]));
    return [...selectedAssetIds].sort(
      (a, b) =>
        (visibleIndex.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (visibleIndex.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
  };

  const sortSelectedAssetsByCardOrder = () => {
    setSelectedAssetIds(getSelectedAssetsInCardOrder());
    closeContextMenu();
  };

  const importSelectedAssetsToTimeline = async () => {
    const sourceIds = getSelectedAssetsInCardOrder().filter((id) => assetNodeById.has(id));
    if (sourceIds.length === 0 || status === 'rendering') return;

    const newClips = [];
    for (const sourceId of sourceIds) {
      const sourceNode = assetNodeById.get(sourceId);
      if (!sourceNode) continue;
      newClips.push({
        sourceId,
        timelineId: makeTimelineClipInstanceId(sourceId),
        mediaDuration: await getNodeMediaDuration(sourceNode),
      });
    }
    let cursor = timelineMetrics.totalDuration;
    const startById: Record<string, number> = {};
    const durationById: Record<string, number> = {};
    newClips.forEach(({ timelineId, mediaDuration }) => {
      const duration = Math.max(0.25, mediaDuration / speed);
      startById[timelineId] = cursor;
      durationById[timelineId] = mediaDuration;
      cursor += duration;
    });
    const videoTrackId = videoTrackIds[0] || 'video-1';
    const audioTrackId = audioTrackIds[0] || 'audio-1';

    pushTimelineHistory();
    setTimelineIds((prev) => [...prev, ...newClips.map(({ timelineId }) => timelineId)]);
    setTimelineSourceById((prev) => ({
      ...prev,
      ...Object.fromEntries(newClips.map(({ timelineId, sourceId }) => [timelineId, sourceId])),
    }));
    setTimelineStartById((prev) => ({ ...prev, ...startById }));
    setTimelineDurationById((prev) => ({ ...prev, ...durationById }));
    setVideoTrackByNodeId((prev) => ({
      ...prev,
      ...Object.fromEntries(
        newClips
          .filter(({ sourceId }) => !isAudioOnlyNode(assetNodeById.get(sourceId)))
          .map(({ timelineId }) => [timelineId, videoTrackId]),
      ),
    }));
    setAudioTrackByNodeId((prev) => ({
      ...prev,
      ...Object.fromEntries(newClips.map(({ timelineId }) => [timelineId, audioTrackId])),
    }));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      newClips.forEach(({ timelineId }) => next.add(timelineId));
      return next;
    });
    setSelectedAssetIds(sourceIds);
    setActivePreviewId(newClips[0]?.timelineId || '');
    closeContextMenu();
  };

  const removeUploadedAssets = (ids: string[]) => {
    const uploadedIds = new Set(
      ids.filter((id) => uploadedAssetNodes.some((node) => node.id === id)),
    );
    if (uploadedIds.size === 0) return;

    const timelineIdsToRemove = timelineIds.filter((timelineId) =>
      uploadedIds.has(timelineSourceById[timelineId] || timelineId),
    );
    closeContextMenu();
    setUploadedAssetNodes((prev) => {
      const removedNodes = prev.filter((node) => uploadedIds.has(node.id));
      removedNodes.forEach((node) => {
        [node.data?.imageUrl, node.data?.videoUrl, node.data?.audioUrl].forEach((url) => {
          if (typeof url === 'string') revokeTrackedObjectUrl(url);
        });
      });
      return prev.filter((node) => !uploadedIds.has(node.id));
    });
    if (timelineIdsToRemove.length > 0) {
      const removedTimelineIds = new Set(timelineIdsToRemove);
      const removeMapEntries = <T,>(map: Record<string, T>) =>
        Object.fromEntries(
          Object.entries(map).filter(([id]) => !removedTimelineIds.has(id)),
        ) as Record<string, T>;
      setTimelineIds((prev) => prev.filter((id) => !removedTimelineIds.has(id)));
      setTimelineSourceById(removeMapEntries);
      setVideoTrackByNodeId(removeMapEntries);
      setAudioTrackByNodeId(removeMapEntries);
      setTimelineStartById(removeMapEntries);
      setTimelineDurationById(removeMapEntries);
      setTimelineDataOverrides(removeMapEntries);
      setKeyShotIds((previous) => {
        const next = new Set(previous);
        removedTimelineIds.forEach((id) => next.delete(id));
        return next;
      });
    }
    setSelectedAssetIds((prev) => prev.filter((id) => !uploadedIds.has(id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      timelineIdsToRemove.forEach((id) => next.delete(id));
      return next;
    });
    if (uploadedIds.has(activePreviewId) || timelineIdsToRemove.includes(activePreviewId)) {
      setActivePreviewId(allAssetNodes.find((node) => !uploadedIds.has(node.id))?.id || '');
    }
    if (timelineIdsToRemove.includes(focusedPreviewId)) setFocusedPreviewId('');
  };

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
          setWorkspaceMode={(mode) => {
            saveWorkspaceImmediately();
            setWorkspaceMode(mode);
          }}
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
          onClose={closeRenderWorkspace}
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

              <ResizeHandle
                label={renderCopy(
                  language,
                  '调整素材卡片宽度',
                  '素材カードの幅を調整',
                  'Resize asset cards',
                )}
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
                label={renderCopy(
                  language,
                  '调整导出设置宽度',
                  '書き出し設定の幅を調整',
                  'Resize export settings',
                )}
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
      <VideoNoticeModal notice={noticeModal} onClose={() => setNoticeModal(null)} />
    </div>
  );
}
