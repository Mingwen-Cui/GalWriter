import type { Node as FlowNode } from '@xyflow/react';
import {
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  GitBranch,
  Layers3,
  Pause,
  Play,
  RefreshCw,
  Square,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import {
  EXPORT_FORMAT_OPTIONS,
  FRAME_RATE_OPTIONS,
  RESOLUTION_OPTIONS,
} from '../shared/constants';
import { loadVideo, seekVideo } from '../shared/mediaUtils';
import { renderCopy } from '../shared/renderCopy';
import { getNodeDisplayText, getNodeDisplayTitle, stripHtml } from '../shared/storyNodes';
import type { ExportFormat, RenderStatus, RenderStyle, VideoTextScaleMode } from '../shared/types';
import { drawRenderFrame } from '../preview/frameRenderer';
import type { InteractiveSegmentDraft } from './interactiveSegments';

type Props = {
  language: Language;
  segments: InteractiveSegmentDraft[];
  nodes: FlowNode[];
  nodesById: Map<string, FlowNode>;
  renderStyle: RenderStyle;
  videoTextScaleMode: VideoTextScaleMode;
  animationLeadSeconds: number;
  hideCharacterTags: boolean;
  hideSceneTags: boolean;
  activeSegmentId: string;
  status: RenderStatus;
  exportFormat: ExportFormat;
  frameRate: number;
  resolutionIndex: number;
  resolutionWidth: number;
  resolutionHeight: number;
  outputDir: string;
  outputDirError: string;
  progress: string;
  error: string;
  progressValue: number;
  savedPath: string;
  defaultSeconds: number;
  onSelectSegment: (id: string) => void;
  onSegmentsChange: (segments: InteractiveSegmentDraft[]) => void;
  onRescan: () => void;
  onExport: () => void;
  setExportFormat: (value: ExportFormat) => void;
  setFrameRate: (value: number) => void;
  setResolutionIndex: (value: number) => void;
  setResolutionWidth: (value: number) => void;
  setResolutionHeight: (value: number) => void;
  setOutputDir: (value: string) => void;
  setOutputDirError: (value: string) => void;
  chooseOutputDir: () => void;
};

const updateSegment = (
  segments: InteractiveSegmentDraft[],
  id: string,
  updater: (segment: InteractiveSegmentDraft) => InteractiveSegmentDraft,
) => segments.map((segment) => (segment.id === id ? updater(segment) : segment));

const segmentSummary = (segment: InteractiveSegmentDraft, nodesById: Map<string, FlowNode>) =>
  segment.nodeIds
    .map((id) => nodesById.get(id))
    .filter(Boolean)
    .map((node) => getNodeDisplayTitle(node))
    .join(' / ');

const segmentTextSummary = (segment: InteractiveSegmentDraft, nodesById: Map<string, FlowNode>) =>
  segment.nodeIds
    .map((id) => nodesById.get(id))
    .filter(Boolean)
    .map((node) => stripHtml(getNodeDisplayText(node)).trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 128);

const segmentMediaItems = (segment: InteractiveSegmentDraft, nodesById: Map<string, FlowNode>) =>
  segment.nodeIds
    .map((id) => nodesById.get(id))
    .filter(Boolean)
    .map((node) => ({
      id: node!.id,
      title: getNodeDisplayTitle(node),
      imageUrl: node!.data?.imageUrl as string | undefined,
      videoUrl: node!.data?.videoUrl as string | undefined,
    }))
    .filter((item) => item.imageUrl || item.videoUrl)
    .slice(0, 4);

const segmentPreviewItems = (segment: InteractiveSegmentDraft, nodesById: Map<string, FlowNode>) =>
  segment.nodeIds
    .map((id) => nodesById.get(id))
    .filter(Boolean)
    .map((node) => ({
      id: node!.id,
      title: getNodeDisplayTitle(node),
      text: stripHtml(getNodeDisplayText(node)).trim(),
      imageUrl: node!.data?.imageUrl as string | undefined,
      videoUrl: node!.data?.videoUrl as string | undefined,
    }));

const formatApproxDuration = (seconds: number) => {
  const safeSeconds = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, '0')}` : `${rest}s`;
};

const formatPlaybackTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const safeSeconds = Math.floor(seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const segmentLinkPath = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  cardWidth: number,
  cardHeight: number,
) => {
  const startX = from.x + cardWidth;
  const startY = from.y + cardHeight / 2;
  const endX = to.x;
  const endY = to.y + cardHeight / 2;
  const middleX = startX + Math.max(44, (endX - startX) / 2);
  return `M${startX},${startY} L${middleX},${startY} L${middleX},${endY} L${endX},${endY}`;
};

export function InteractiveSegmentExportWorkspace({
  language,
  segments,
  nodes,
  nodesById,
  renderStyle,
  videoTextScaleMode,
  animationLeadSeconds,
  hideCharacterTags,
  hideSceneTags,
  activeSegmentId,
  status,
  exportFormat,
  frameRate,
  resolutionIndex,
  resolutionWidth,
  resolutionHeight,
  outputDir,
  outputDirError,
  progress,
  error,
  progressValue,
  savedPath,
  defaultSeconds,
  onSelectSegment,
  onSegmentsChange,
  onRescan,
  onExport,
  setExportFormat,
  setFrameRate,
  setResolutionIndex,
  setResolutionWidth,
  setResolutionHeight,
  setOutputDir,
  setOutputDirError,
  chooseOutputDir,
}: Props) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const isRendering = status === 'rendering';
  const activeSegment = segments.find((segment) => segment.id === activeSegmentId) || segments[0];
  const enabledCount = segments.filter((segment) => segment.enabled).length;
  const choiceCount = segments.reduce((sum, segment) => sum + segment.choices.length, 0);
  const cardWidth = 280;
  const cardHeight = 218;
  const columnGap = 360;
  const rowGap = 278;
  const graphWidth = Math.max(1040, 90 + Math.min(3, Math.max(1, segments.length)) * columnGap);
  const graphHeight = Math.max(620, Math.ceil(segments.length / 3) * rowGap + 150);
  const positions = new Map(
    segments.map((segment, index) => [
      segment.id,
      {
        x: 70 + (index % 3) * columnGap,
        y: 82 + Math.floor(index / 3) * rowGap,
      },
    ]),
  );
  const minimapWidth = 172;
  const minimapHeight = 112;
  const minimapScale = Math.min(
    minimapWidth / Math.max(1, graphWidth),
    minimapHeight / Math.max(1, graphHeight),
  );
  const [previewSegmentId, setPreviewSegmentId] = useState('');
  const [previewItemIndex, setPreviewItemIndex] = useState(0);
  const [previewPosition, setPreviewPosition] = useState({ x: 96, y: 92 });
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    segmentId: string;
  } | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewRenderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRenderVideoRef = useRef<{ url: string; video: HTMLVideoElement } | null>(null);
  const previewDragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const previewSegment = segments.find((segment) => segment.id === previewSegmentId);
  const previewItems = previewSegment ? segmentPreviewItems(previewSegment, nodesById) : [];
  const previewItem = previewItems[Math.min(previewItemIndex, Math.max(0, previewItems.length - 1))];
  const previewNode = previewItem ? nodesById.get(previewItem.id) : undefined;
  const previewCardDuration = Math.max(0.1, defaultSeconds);
  const previewAspectRatio =
    resolutionWidth > 0 && resolutionHeight > 0 ? `${resolutionWidth} / ${resolutionHeight}` : '16 / 9';
  const graphLinks = segments.flatMap((segment) =>
    segment.choices.map((choice, index) => ({
      id: choice.id,
      fromSegmentId: segment.id,
      toSegmentId: choice.targetSegmentId,
      label: choice.label,
      isChoice: segment.choices.length > 1,
      index,
    })),
  );

  const setAllEnabled = (enabled: boolean) =>
    onSegmentsChange(segments.map((segment) => ({ ...segment, enabled, source: 'edited' })));
  const openPreview = (segmentId: string) => {
    onSelectSegment(segmentId);
    setPreviewSegmentId(segmentId);
    setPreviewItemIndex(0);
    setVideoProgress(0);
    setVideoDuration(Math.max(0.1, defaultSeconds));
    setVideoPlaying(true);
    setContextMenu(null);
  };
  const selectPreviewItem = (index: number) => {
    const maxIndex = Math.max(0, previewItems.length - 1);
    setPreviewItemIndex(Math.min(Math.max(0, index), maxIndex));
    setVideoProgress(0);
    setVideoDuration(Math.max(0.1, defaultSeconds));
  };
  const showPreviousPreviewItem = () => selectPreviewItem(previewItemIndex - 1);
  const showNextPreviewItem = () => selectPreviewItem(previewItemIndex + 1);
  const beginPreviewDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    previewDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragPreview = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = previewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const maxX = Math.max(16, window.innerWidth - drag.width - 16);
    const maxY = Math.max(16, window.innerHeight - drag.height - 16);
    const nextX = Math.min(Math.max(16, event.clientX - drag.offsetX), maxX);
    const nextY = Math.min(Math.max(16, event.clientY - drag.offsetY), maxY);
    setPreviewPosition({ x: nextX, y: nextY });
  };
  const endPreviewDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (previewDragRef.current?.pointerId === event.pointerId) {
      previewDragRef.current = null;
    }
  };
  const togglePreviewVideo = () => {
    setVideoPlaying((playing) => !playing);
  };
  const seekPreviewVideo = (value: number) => {
    setVideoProgress(Math.min(Math.max(0, value), previewCardDuration));
  };
  const toggleSegmentEnabled = (segmentId: string) => {
    onSegmentsChange(
      updateSegment(segments, segmentId, (segment) => ({
        ...segment,
        enabled: !segment.enabled,
        source: 'edited',
      })),
    );
  };
  const renameSegment = (segmentId: string, name: string) => {
    onSegmentsChange(
      updateSegment(segments, segmentId, (segment) => ({
        ...segment,
        name,
        source: 'edited',
      })),
    );
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    setVideoProgress(0);
    setVideoDuration(previewCardDuration);
  }, [previewItem?.id]);

  useEffect(() => {
    if (!previewSegment || !videoPlaying) return;
    let frame = 0;
    let previousTime = performance.now();
    const tick = (time: number) => {
      const delta = Math.max(0, (time - previousTime) / 1000);
      previousTime = time;
      setVideoProgress((progress) => Math.min(previewCardDuration, progress + delta));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [previewCardDuration, previewSegment, previewItemIndex, videoPlaying]);

  useEffect(() => {
    if (!previewSegment || !videoPlaying || videoProgress < previewCardDuration) return;
    if (previewItemIndex < previewItems.length - 1) {
      setPreviewItemIndex((index) => Math.min(index + 1, previewItems.length - 1));
      setVideoProgress(0);
      return;
    }
    setVideoPlaying(false);
  }, [previewCardDuration, previewItemIndex, previewItems.length, previewSegment, videoPlaying, videoProgress]);

  useEffect(() => {
    const canvas = previewRenderCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !previewNode) return;
    let cancelled = false;
    const width = Math.max(320, resolutionWidth || 1280);
    const height = Math.max(240, resolutionHeight || 720);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const draw = async () => {
      const videoUrl = previewNode.data?.videoUrl as string | undefined;
      let media:
        | {
            source: CanvasImageSource;
            width: number;
            height: number;
          }
        | undefined;
      if (videoUrl) {
        try {
          if (previewRenderVideoRef.current?.url !== videoUrl) {
            previewRenderVideoRef.current?.video.pause();
            previewRenderVideoRef.current = { url: videoUrl, video: await loadVideo(videoUrl) };
          }
          const video = previewRenderVideoRef.current.video;
          await seekVideo(video, videoProgress);
          media = {
            source: video,
            width: video.videoWidth || width,
            height: video.videoHeight || height,
          };
        } catch {
          media = undefined;
        }
      } else if (previewRenderVideoRef.current) {
        previewRenderVideoRef.current.video.pause();
        previewRenderVideoRef.current = null;
      }
      if (cancelled) return;
      await drawRenderFrame({
        ctx,
        node: previewNode,
        width,
        height,
        media,
        elapsed: videoProgress,
        duration: previewCardDuration,
        renderStyle,
        videoTextScaleMode,
        animationLeadSeconds,
        isZh: language === 'zh',
        nodes,
        hideCharacterTags,
        hideSceneTags,
      });
    };

    void draw().catch(() => {
      if (cancelled) return;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);
    });
    return () => {
      cancelled = true;
    };
  }, [
    animationLeadSeconds,
    hideCharacterTags,
    hideSceneTags,
    language,
    nodes,
    previewCardDuration,
    previewNode,
    renderStyle,
    resolutionHeight,
    resolutionWidth,
    videoProgress,
    videoTextScaleMode,
  ]);

  return (
    <main className="min-h-0 min-w-0 grid grid-cols-[minmax(0,1fr)_380px] overflow-hidden bg-[var(--vr-bg)]">
      <section className="relative min-h-0 min-w-0 overflow-auto">
        <div className="sticky left-0 top-0 z-10 flex items-center justify-between border-b border-[var(--vr-border)] bg-[var(--vr-bg)]/90 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-[var(--vr-text)]">
              <GitBranch className="h-4 w-4 text-[var(--vr-accent-strong)]" />
              {t('互动分段结构', 'インタラクティブ分割構造', 'Interactive segment map')}
            </div>
            <div className="mt-1 text-xs font-bold text-[var(--vr-text-muted)]">
              {t(
                `遇到选择点自动切断：${segments.length} 个视频片段，${choiceCount} 个选择跳转`,
                `選択地点で自動分割: ${segments.length} 個の動画セグメント、${choiceCount} 個の選択遷移`,
                `Cut at choices: ${segments.length} video segments, ${choiceCount} choice link(s)`,
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onRescan}
            disabled={isRendering}
            className="flex h-9 items-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 text-xs font-black text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-accent)]/50 hover:text-[var(--vr-accent-strong)] disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" />
            {t('重新识别', '再スキャン', 'Rescan')}
          </button>
        </div>

        <div className="relative p-6" style={{ width: graphWidth, height: graphHeight }}>
          <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <defs>
              <marker
                id="interactive-arrow"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L10,5 L0,10 Z" fill="currentColor" />
              </marker>
            </defs>
            {graphLinks.map((link) => {
              const fromSegment = segments.find((segment) => segment.id === link.fromSegmentId);
              const from = positions.get(link.fromSegmentId);
              if (!from) return null;
              const to = positions.get(link.toSegmentId);
              if (!to || !fromSegment) return null;
              const active =
                activeSegmentId === link.fromSegmentId || activeSegmentId === link.toSegmentId;
              const path = segmentLinkPath(from, to, cardWidth, cardHeight);
              const labelX = from.x + cardWidth + Math.max(72, (to.x - from.x - cardWidth) / 2);
              const labelY = from.y + cardHeight / 2 + (to.y > from.y ? 18 : -12) + link.index * 24;
              return (
                <g
                  key={link.id}
                  className={active ? 'text-[var(--vr-accent)]' : 'text-[var(--vr-border-strong)]'}
                >
                  <path
                    d={path}
                    fill="none"
                    stroke="var(--vr-bg)"
                    strokeWidth={active ? 8 : 6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.88"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={active ? 4 : 2.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={link.isChoice ? undefined : '7 7'}
                    markerEnd="url(#interactive-arrow)"
                    opacity={link.isChoice || active ? 1 : 0.78}
                  />
                  <circle
                    cx={from.x + cardWidth}
                    cy={from.y + cardHeight / 2}
                    r={active ? 4.5 : 3.5}
                    className="fill-current"
                    opacity={active ? 1 : 0.72}
                  />
                  <rect
                    x={labelX - 46}
                    y={labelY - 13}
                    width="92"
                    height="24"
                    rx="7"
                    className="fill-[var(--vr-surface-strong)] stroke-current"
                    strokeWidth={active ? 1.8 : 1}
                  />
                  <text
                    x={labelX}
                    y={labelY + 3}
                    textAnchor="middle"
                    className="fill-current text-[10px] font-black"
                  >
                    {(link.isChoice ? link.label : t('继续', '続き', 'Continue')).slice(0, 10)}
                  </text>
                </g>
              );
            })}
          </svg>

          {segments.map((segment) => {
            const position = positions.get(segment.id)!;
            const active = activeSegment?.id === segment.id;
            const mediaItems = segmentMediaItems(segment, nodesById);
            const summary = segmentTextSummary(segment, nodesById) || segmentSummary(segment, nodesById);
            const internalItems = [] as Array<{ id: string; title: string; hasMedia: boolean }>;
            const internalStep = 0;
            return (
              <div
                key={segment.id}
                role="button"
                tabIndex={0}
                onClick={() => openPreview(segment.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPreview(segment.id);
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onSelectSegment(segment.id);
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    segmentId: segment.id,
                  });
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.querySelectorAll('video').forEach((video) => {
                    video.currentTime = 0;
                    void video.play().catch(() => undefined);
                  });
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.querySelectorAll('video').forEach((video) => {
                    video.pause();
                    video.currentTime = 0;
                  });
                }}
                className={`absolute w-[280px] overflow-hidden rounded-lg border text-left shadow-sm transition-all ${
                  active
                    ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] ring-2 ring-[var(--vr-accent)]/20'
                    : 'border-[var(--vr-border)] bg-[var(--vr-surface-strong)] hover:border-[var(--vr-accent)]/50'
                } ${segment.enabled ? '' : 'opacity-50'}`}
                style={{ left: position.x, top: position.y, height: cardHeight }}
              >
                <div className="p-3">
                  <div className="flex items-center justify-end gap-2">
                    <span className="rounded-md bg-[var(--vr-surface-soft)] px-2 py-1 text-[10px] font-black text-[var(--vr-text-soft)]">
                      {formatApproxDuration(segment.nodeIds.length * defaultSeconds)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <input
                      value={segment.name}
                      onChange={(event) => renameSegment(segment.id, event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-sm font-black text-[var(--vr-text)] outline-none transition-colors focus:border-[var(--vr-accent)] focus:bg-[var(--vr-surface)]"
                      aria-label={t('视频名称', '動画名', 'Video name')}
                    />
                  </div>
                  <div className="mt-2 line-clamp-2 h-9 text-[11px] leading-[18px] text-[var(--vr-text-muted)]">
                    {summary}
                  </div>
                </div>
                <div className="hidden mx-2 mb-2 rounded-md border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 py-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-black text-[var(--vr-text-muted)]">
                    <span>{t('内部卡片关系', '内部カード関係', 'Internal card links')}</span>
                    <span>{segment.nodeIds.length}</span>
                  </div>
                  <div className="relative h-12">
                    {internalItems.length > 1 && (
                      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                        <defs>
                          <marker
                            id={`internal-arrow-${segment.id}`}
                            markerWidth="6"
                            markerHeight="6"
                            refX="5.5"
                            refY="3"
                            orient="auto"
                          >
                            <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
                          </marker>
                        </defs>
                        {internalItems.slice(0, -1).map((item, index) => (
                          <line
                            key={`${item.id}-line`}
                            x1={22 + index * internalStep}
                            y1="20"
                            x2={18 + (index + 1) * internalStep}
                            y2="20"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            markerEnd={`url(#internal-arrow-${segment.id})`}
                            className="text-[var(--vr-border-strong)]"
                            opacity="0.8"
                          />
                        ))}
                      </svg>
                    )}
                    {internalItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`absolute top-1 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-md border text-[10px] font-black ${
                          item.hasMedia
                            ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]'
                            : 'border-[var(--vr-border)] bg-[var(--vr-surface-strong)] text-[var(--vr-text-soft)]'
                        }`}
                        style={{ left: internalItems.length === 1 ? 18 : 18 + index * internalStep }}
                        title={item.title}
                      >
                        {index + 1}
                      </div>
                    ))}
                    {segment.nodeIds.length > internalItems.length && (
                      <div className="absolute right-0 top-2 rounded-md bg-[var(--vr-surface-strong)] px-2 py-1 text-[10px] font-black text-[var(--vr-text-muted)]">
                        +{segment.nodeIds.length - internalItems.length}
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-[var(--vr-border)] bg-black/10 p-2">
                  {mediaItems.length > 0 ? (
                    <div
                      className={`grid gap-1.5 ${
                        mediaItems.length === 1 ? 'grid-cols-1' : 'grid-cols-4'
                      }`}
                    >
                      {mediaItems.map((item) => (
                        <div
                          key={item.id}
                          className={`relative overflow-hidden rounded-md bg-[var(--vr-surface-soft)] ${
                            mediaItems.length === 1 ? 'h-[74px]' : 'h-[62px]'
                          }`}
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : item.videoUrl ? (
                            <video
                              src={item.videoUrl}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : null}
                          {item.videoUrl && (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPreview(segment.id);
                                }}
                                className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white shadow-lg transition-colors hover:bg-black/80"
                                aria-label={t('播放视频', '動画を再生', 'Play video')}
                              >
                                <Play className="h-4 w-4 translate-x-0.5" />
                              </button>
                              <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-white">
                                VIDEO
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-[74px] items-center justify-center rounded-md border border-dashed border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[11px] font-black text-[var(--vr-text-muted)]">
                      {t('文字片段', 'テキストセグメント', 'Text segment')}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-[var(--vr-text-muted)]">
                    <Layers3 className="h-3 w-3" />
                    {segment.choices.length > 0
                      ? `${segment.choices.length} choices -> ${segment.choices
                          .map((choice) => choice.targetSegmentId)
                          .join(', ')}`
                      : `${segment.nodeIds.length} clips / no outgoing choices`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden pointer-events-none absolute bottom-4 right-4 z-20 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-strong)]/90 p-2 shadow-xl backdrop-blur-xl">
          <div className="mb-1 text-[10px] font-black uppercase text-[var(--vr-text-muted)]">
            {t('小地图', 'ミニマップ', 'Minimap')}
          </div>
          <svg width={minimapWidth} height={minimapHeight} viewBox={`0 0 ${minimapWidth} ${minimapHeight}`}>
            <defs>
              <marker id="interactive-minimap-arrow" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                <path d="M0,0 L5,2.5 L0,5 Z" fill="currentColor" />
              </marker>
            </defs>
            {graphLinks.map((link) => {
              const from = positions.get(link.fromSegmentId);
              const to = positions.get(link.toSegmentId);
              if (!from || !to) return null;
              return (
                <line
                  key={link.id}
                  x1={(from.x + cardWidth / 2) * minimapScale}
                  y1={(from.y + cardHeight / 2) * minimapScale}
                  x2={(to.x + cardWidth / 2) * minimapScale}
                  y2={(to.y + cardHeight / 2) * minimapScale}
                  stroke="currentColor"
                  strokeWidth="1"
                  markerEnd="url(#interactive-minimap-arrow)"
                  className="text-[var(--vr-border-strong)]"
                  opacity={link.isChoice ? 0.85 : 0.45}
                />
              );
            })}
            {segments.map((segment) => {
              const position = positions.get(segment.id)!;
              const active = activeSegment?.id === segment.id;
              return (
                <rect
                  key={segment.id}
                  x={position.x * minimapScale}
                  y={position.y * minimapScale}
                  width={cardWidth * minimapScale}
                  height={cardHeight * minimapScale}
                  rx="2"
                  className={active ? 'fill-[var(--vr-accent)]' : 'fill-[var(--vr-text-muted)]'}
                  opacity={active ? 0.95 : 0.38}
                />
              );
            })}
          </svg>
        </div>
        {previewSegment && (
          <div
            className="fixed z-[580] max-h-[calc(100vh-32px)] w-[min(860px,calc(100vw-32px))] overflow-hidden rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-strong)] shadow-2xl"
            style={{ left: previewPosition.x, top: previewPosition.y }}
          >
            <div
              className="flex cursor-move touch-none select-none items-center justify-between border-b border-[var(--vr-border)] px-4 py-3"
              onPointerDown={beginPreviewDrag}
              onPointerMove={dragPreview}
              onPointerUp={endPreviewDrag}
              onPointerCancel={endPreviewDrag}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-[var(--vr-text)]">
                  {previewSegment.id} · {previewSegment.name}
                </div>
                <div className="mt-0.5 text-xs font-bold text-[var(--vr-text-muted)]">
                  {formatApproxDuration(previewSegment.nodeIds.length * defaultSeconds)} / {previewItems.length} cards
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSegmentId('')}
                onPointerDown={(event) => event.stopPropagation()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
                aria-label={t('关闭预览', 'プレビューを閉じる', 'Close preview')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid max-h-[calc(100vh-132px)] grid-cols-[minmax(0,1fr)_220px] gap-3 overflow-hidden p-3">
              <div className="min-h-0">
                <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-lg bg-black p-2">
                  <div
                    className="relative max-w-full overflow-hidden rounded-md bg-black"
                    style={{ aspectRatio: previewAspectRatio, height: 'min(38vh, 360px)' }}
                  >
                    {previewItem?.videoUrl ? (
                      <video
                        ref={previewVideoRef}
                        key={previewItem.id}
                        src={previewItem.videoUrl}
                        className="absolute inset-0 h-full w-full object-contain"
                        autoPlay={false}
                        muted
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration || 0)}
                        onTimeUpdate={(event) => setVideoProgress(event.currentTarget.currentTime || 0)}
                        onPlay={() => setVideoPlaying(true)}
                        onPause={() => setVideoPlaying(false)}
                        onEnded={() => {
                          setVideoPlaying(false);
                          if (previewItemIndex < previewItems.length - 1) showNextPreviewItem();
                        }}
                      />
                    ) : previewItem?.imageUrl ? (
                      <img
                        src={previewItem.imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                        draggable={false}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-bold text-white/70">
                        {previewItem?.text || t('这个片段没有媒体画面。', 'このセグメントにはメディアがありません。', 'This segment has no media preview.')}
                      </div>
                    )}
                    <canvas
                      ref={previewRenderCanvasRef}
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer object-contain"
                      onClick={togglePreviewVideo}
                      aria-label={videoPlaying ? t('暂停', '一時停止', 'Pause') : t('播放', '再生', 'Play')}
                    />
                    {previewItems.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={showPreviousPreviewItem}
                          disabled={previewItemIndex <= 0}
                          className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition-colors hover:bg-black/75 disabled:opacity-25"
                          aria-label={t('上一张剧情卡片', '前のストーリーカード', 'Previous story card')}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={showNextPreviewItem}
                          disabled={previewItemIndex >= previewItems.length - 1}
                          className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition-colors hover:bg-black/75 disabled:opacity-25"
                          aria-label={t('下一张剧情卡片', '次のストーリーカード', 'Next story card')}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    {!videoPlaying && (
                      <button
                        type="button"
                        onClick={togglePreviewVideo}
                        className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-xl transition-colors hover:bg-black/75"
                        aria-label={t('播放视频', '動画を再生', 'Play video')}
                      >
                        <Play className="h-7 w-7 translate-x-0.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 py-2">
                  {previewItem ? (
                    <div className="grid grid-cols-[30px_32px_42px_minmax(0,1fr)_42px_30px] items-center gap-2">
                      <button
                        type="button"
                        onClick={showPreviousPreviewItem}
                        disabled={previewItemIndex <= 0}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--vr-surface-strong)] text-[var(--vr-text-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35"
                        aria-label={t('上一张剧情卡片', '前のストーリーカード', 'Previous story card')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={togglePreviewVideo}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--vr-surface-strong)] text-[var(--vr-text-soft)] hover:text-[var(--vr-accent-strong)]"
                        aria-label={videoPlaying ? t('暂停', '一時停止', 'Pause') : t('播放', '再生', 'Play')}
                      >
                        {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <span className="text-[10px] font-black tabular-nums text-[var(--vr-text-muted)]">
                        {formatPlaybackTime(videoProgress)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(videoDuration, 0.01)}
                        step={0.01}
                        value={Math.min(videoProgress, Math.max(videoDuration, 0.01))}
                        onChange={(event) => seekPreviewVideo(Number(event.target.value))}
                        className="h-2 w-full accent-[var(--vr-accent)]"
                        aria-label={t('视频播放轴', '動画シークバー', 'Video timeline')}
                      />
                      <span className="text-right text-[10px] font-black tabular-nums text-[var(--vr-text-muted)]">
                        {formatPlaybackTime(videoDuration)}
                      </span>
                      <button
                        type="button"
                        onClick={showNextPreviewItem}
                        disabled={previewItemIndex >= previewItems.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--vr-surface-strong)] text-[var(--vr-text-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35"
                        aria-label={t('下一张剧情卡片', '次のストーリーカード', 'Next story card')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[30px_42px_minmax(0,1fr)_42px_30px] items-center gap-2">
                      <button
                        type="button"
                        onClick={showPreviousPreviewItem}
                        disabled={previewItemIndex <= 0}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--vr-surface-strong)] text-[var(--vr-text-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35"
                        aria-label={t('上一张剧情卡片', '前のストーリーカード', 'Previous story card')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-[10px] font-black tabular-nums text-[var(--vr-text-muted)]">
                        {previewItemIndex + 1}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, previewItems.length - 1)}
                        step={1}
                        value={previewItemIndex}
                        onChange={(event) => selectPreviewItem(Number(event.target.value))}
                        className="h-2 w-full accent-[var(--vr-accent)]"
                        aria-label={t('片段内部卡片轴', 'セグメント内カード軸', 'Segment card timeline')}
                      />
                      <span className="text-right text-[10px] font-black tabular-nums text-[var(--vr-text-muted)]">
                        {previewItems.length}
                      </span>
                      <button
                        type="button"
                        onClick={showNextPreviewItem}
                        disabled={previewItemIndex >= previewItems.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--vr-surface-strong)] text-[var(--vr-text-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35"
                        aria-label={t('下一张剧情卡片', '次のストーリーカード', 'Next story card')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="min-h-0 overflow-y-auto">
                <div className="mb-2 text-[10px] font-black uppercase text-[var(--vr-text-muted)]">
                  {t('片段内部卡片', 'セグメント内カード', 'Cards in segment')}
                </div>
                <div className="space-y-2">
                  {previewItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPreviewItemIndex(index)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        index === previewItemIndex
                          ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]'
                          : 'border-[var(--vr-border)] bg-[var(--vr-surface-soft)] hover:border-[var(--vr-accent)]/50'
                      }`}
                    >
                      <div className="truncate text-xs font-black text-[var(--vr-text)]">
                        {index + 1}. {item.title}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--vr-text-muted)]">
                        {item.text || (item.videoUrl ? 'Video' : item.imageUrl ? 'Image' : 'Text')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {contextMenu && (
          <div
            className="fixed z-[600] w-44 overflow-hidden rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-strong)] p-1 shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {[
              {
                label: t('预览片段', 'セグメントをプレビュー', 'Preview segment'),
                onClick: () => openPreview(contextMenu.segmentId),
              },
              {
                label: t('设为当前片段', '現在のセグメントにする', 'Select segment'),
                onClick: () => {
                  onSelectSegment(contextMenu.segmentId);
                  setContextMenu(null);
                },
              },
              {
                label: segments.find((segment) => segment.id === contextMenu.segmentId)?.enabled
                  ? t('跳过导出', '書き出しをスキップ', 'Skip export')
                  : t('加入导出', '書き出しに含める', 'Include in export'),
                onClick: () => {
                  toggleSegmentEnabled(contextMenu.segmentId);
                  setContextMenu(null);
                },
              },
              {
                label: t('重新识别结构', '構造を再スキャン', 'Rescan structure'),
                onClick: () => {
                  onRescan();
                  setContextMenu(null);
                },
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="block h-9 w-full rounded-md px-3 text-left text-xs font-black text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="min-h-0 overflow-y-auto border-l border-[var(--vr-border)] bg-[var(--vr-surface)] p-4">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-black text-[var(--vr-text)]">
              {t('互动分段导出', 'インタラクティブ分割書き出し', 'Interactive segment export')}
            </div>
            <div className="mt-1 text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
              {t(
                '按 B 站交互视频的素材方式，在选择点前结束当前视频，选择后跳到下一段。',
                '選択地点で現在の動画を終了し、選択後に次のセグメントへ進みます。',
                'Each video stops before a choice; each choice points to the next segment.',
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('片段', 'セグメント', 'Segments')} value={segments.length} />
            <Stat label={t('选择', '選択', 'Choices')} value={choiceCount} />
            <Stat label={t('导出', '書出し', 'Enabled')} value={enabledCount} />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAllEnabled(true)}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--vr-surface-soft)] text-xs font-black text-[var(--vr-text-soft)] hover:text-[var(--vr-accent-strong)]"
            >
              <CheckSquare className="h-4 w-4" />
              {t('全选', '全選択', 'All')}
            </button>
            <button
              type="button"
              onClick={() => setAllEnabled(false)}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--vr-surface-soft)] text-xs font-black text-[var(--vr-text-soft)] hover:text-[var(--vr-accent-strong)]"
            >
              <Square className="h-4 w-4" />
              {t('全不选', '選択解除', 'None')}
            </button>
          </div>

          {activeSegment && (
            <div className="space-y-3 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3">
              <label className="block text-[10px] font-black uppercase text-[var(--vr-text-muted)]">
                {t('当前片段', '現在のセグメント', 'Active segment')}
              </label>
              <input
                value={activeSegment.name}
                onChange={(event) =>
                  onSegmentsChange(
                    updateSegment(segments, activeSegment.id, (segment) => ({
                      ...segment,
                      name: event.target.value,
                      source: 'edited',
                    })),
                  )
                }
                className="h-9 w-full rounded-lg border border-transparent bg-[var(--vr-surface)] px-3 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
              />
              <button
                type="button"
                onClick={() =>
                  onSegmentsChange(
                    updateSegment(segments, activeSegment.id, (segment) => ({
                      ...segment,
                      enabled: !segment.enabled,
                      source: 'edited',
                    })),
                  )
                }
                className={`flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-black ${
                  activeSegment.enabled
                    ? 'bg-[var(--vr-accent)] text-white'
                    : 'bg-[var(--vr-surface)] text-[var(--vr-text-muted)]'
                }`}
              >
                {activeSegment.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {activeSegment.enabled
                  ? t('会导出这个片段', 'このセグメントを書き出す', 'Export this segment')
                  : t('跳过这个片段', 'このセグメントをスキップ', 'Skip this segment')}
              </button>

              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase text-[var(--vr-text-muted)]">
                  {t('选择跳转', '選択遷移', 'Choice targets')}
                </div>
                {activeSegment.choices.length === 0 ? (
                  <div className="rounded-lg bg-[var(--vr-surface)] px-3 py-2 text-xs font-bold text-[var(--vr-text-muted)]">
                    {t('这个片段没有后续选择。', 'このセグメントには選択がありません。', 'This segment has no choices.')}
                  </div>
                ) : (
                  activeSegment.choices.map((choice) => (
                    <div key={choice.id} className="grid grid-cols-[minmax(0,1fr)_132px] gap-2">
                      <input
                        value={choice.label}
                        onChange={(event) =>
                          onSegmentsChange(
                            updateSegment(segments, activeSegment.id, (segment) => ({
                              ...segment,
                              source: 'edited',
                              choices: segment.choices.map((item) =>
                                item.id === choice.id ? { ...item, label: event.target.value } : item,
                              ),
                            })),
                          )
                        }
                        className="h-9 min-w-0 rounded-lg border border-transparent bg-[var(--vr-surface)] px-2 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
                      />
                      <div className="relative">
                        <select
                          value={choice.targetSegmentId}
                          onChange={(event) =>
                            onSegmentsChange(
                              updateSegment(segments, activeSegment.id, (segment) => ({
                                ...segment,
                                source: 'edited',
                                choices: segment.choices.map((item) =>
                                  item.id === choice.id
                                    ? { ...item, targetSegmentId: event.target.value }
                                    : item,
                                ),
                              })),
                            )
                          }
                          className="h-9 w-full appearance-none rounded-lg border border-transparent bg-[var(--vr-surface)] pl-2 pr-7 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
                        >
                          {segments.map((segment) => (
                            <option key={segment.id} value={segment.id}>
                              {segment.id}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--vr-text-muted)]" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3">
            <div className="text-[10px] font-black uppercase text-[var(--vr-text-muted)]">
              {t('导出设置', '書き出し設定', 'Export settings')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SelectBox
                value={exportFormat}
                onChange={(value) => setExportFormat(value as ExportFormat)}
                options={EXPORT_FORMAT_OPTIONS}
              />
              <SelectBox
                value={String(frameRate)}
                onChange={(value) => setFrameRate(Number(value))}
                options={FRAME_RATE_OPTIONS.map((fps) => ({ value: String(fps), label: `${fps} fps` }))}
              />
            </div>
            <SelectBox
              value={String(resolutionIndex)}
              onChange={(value) => {
                const nextIndex = Number(value);
                const next = RESOLUTION_OPTIONS[nextIndex];
                setResolutionIndex(nextIndex);
                if (next) {
                  setResolutionWidth(next.width);
                  setResolutionHeight(next.height);
                }
              }}
              options={RESOLUTION_OPTIONS.map((option, index) => ({
                value: String(index),
                label: `${option.label} (${option.width}x${option.height})`,
              }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={320}
                max={7680}
                value={resolutionWidth}
                onChange={(event) => setResolutionWidth(Number(event.target.value))}
                className="h-9 rounded-lg border border-transparent bg-[var(--vr-surface)] px-2 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
              />
              <input
                type="number"
                min={240}
                max={4320}
                value={resolutionHeight}
                onChange={(event) => setResolutionHeight(Number(event.target.value))}
                className="h-9 rounded-lg border border-transparent bg-[var(--vr-surface)] px-2 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
              />
            </div>
            <div className="flex gap-2">
              <input
                value={outputDir}
                onChange={(event) => {
                  setOutputDir(event.target.value);
                  setOutputDirError('');
                }}
                placeholder={t('默认保存到下载目录', '既定ではダウンロードへ保存', 'Defaults to Downloads')}
                className={`h-9 min-w-0 flex-1 rounded-lg border bg-[var(--vr-surface)] px-2 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)] ${
                  outputDirError ? 'border-rose-400/70' : 'border-transparent'
                }`}
              />
              <button
                type="button"
                onClick={chooseOutputDir}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--vr-surface)] text-[var(--vr-text-soft)] hover:text-[var(--vr-accent-strong)]"
                title={t('选择保存文件夹', '保存フォルダーを選択', 'Choose folder')}
              >
                <FolderOpen className="h-4 w-4" />
              </button>
            </div>
            {outputDirError && <div className="text-xs font-bold text-rose-500">{outputDirError}</div>}
          </div>

          {(progress || error) && (
            <div className="space-y-2">
              {!error && (
                <div className="h-2 overflow-hidden rounded-full border border-[var(--vr-border)] bg-[var(--vr-surface-soft)]">
                  <div className="h-full bg-[var(--vr-accent)]" style={{ width: `${progressValue}%` }} />
                </div>
              )}
              <div className={`text-xs font-bold ${error ? 'text-rose-500' : 'text-[var(--vr-text-muted)]'}`}>
                {error || progress}
              </div>
            </div>
          )}
          {savedPath && (
            <div className="break-all rounded-lg border border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--vr-accent-strong)]">
              {t('最后保存到：', '最後の保存先: ', 'Last saved to: ')}
              {savedPath}
            </div>
          )}

          <button
            type="button"
            onClick={onExport}
            disabled={isRendering || enabledCount === 0}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--vr-accent)] px-4 text-sm font-black text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-45"
          >
            <Download className="h-4 w-4" />
            {t(
              `导出 ${enabledCount} 个互动片段`,
              `${enabledCount} 個のセグメントを書き出し`,
              `Export ${enabledCount} segment(s)`,
            )}
          </button>
        </div>
      </aside>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[var(--vr-surface-soft)] px-3 py-2">
      <div className="text-[10px] font-black uppercase text-[var(--vr-text-muted)]">{label}</div>
      <div className="mt-1 text-lg font-black text-[var(--vr-text)]">{value}</div>
    </div>
  );
}

function SelectBox({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-transparent bg-[var(--vr-surface)] pl-3 pr-8 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--vr-text-muted)]" />
    </div>
  );
}
