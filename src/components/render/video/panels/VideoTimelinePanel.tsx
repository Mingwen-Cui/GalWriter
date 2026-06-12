import type { Node as FlowNode } from '@xyflow/react';
import {
  Clock,
  Magnet,
  MoveHorizontal,
  MoveVertical,
  Music,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { ResizeHandle } from '../controls/RenderControls';
import { PANEL_SIZE_LIMITS, TIMELINE_LABEL_WIDTH } from '../shared/constants';
import { renderCopy } from '../shared/renderCopy';
import type {
  RenderStatus,
  TimelineScaleMode,
  TimelineSegmentMetric,
  TimelineWheelMode,
} from '../shared/types';
import { formatSeconds, getTimelineSegmentLayout } from '../timeline/timelineUtils';
import type { Language } from '../../../../lib/i18n';

type VideoTimelinePanelProps = {
  language: Language;
  timelineHeight: number;
  timelineMax: number;
  setTimelineHeight: (value: number) => void;
  status: RenderStatus;
  previewPlaying: boolean;
  setPreviewPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  activeTimelineTime: number;
  activeTimelineFrame: number;
  timelineMetrics: {
    segments: TimelineSegmentMetric[];
    totalDuration: number;
    displayDuration: number;
    width: number;
    pixelsPerSecond: number;
  };
  timelineSnapEnabled: boolean;
  setTimelineSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  timelineWheelMode: TimelineWheelMode;
  setTimelineWheelMode: (value: TimelineWheelMode) => void;
  timelineViewportRef: React.RefObject<HTMLDivElement | null>;
  syncTimelineScrollInfo: () => void;
  handleTimelineDrop: (
    event: React.DragEvent<HTMLElement>,
    targetId?: string,
    trackId?: string,
    trackKind?: 'video' | 'audio',
  ) => void;
  openContextMenu: (event: React.MouseEvent<HTMLElement>, target: any) => void;
  timelineScaleMode: TimelineScaleMode;
  setTimelineScaleMode: (value: TimelineScaleMode) => void;
  timelineScrubSurfaceRef: React.RefObject<HTMLDivElement | null>;
  handleTimelineScrubStart: (event: React.PointerEvent<HTMLElement>) => void;
  handleTimelineScrubMove: (event: React.PointerEvent<HTMLElement>) => void;
  handleTimelineScrubEnd: (event: React.PointerEvent<HTMLElement>) => void;
  timelineTicks: number[];
  frameRate: number;
  timelineTickSettings: { step: number; precision: number };
  timelinePlayheadLeft: number;
  videoTrackIds: string[];
  audioTrackIds: string[];
  videoTrackByNodeId: Record<string, string>;
  audioTrackByNodeId: Record<string, string>;
  timelineNodes: FlowNode[];
  timelineMetricById: Map<string, TimelineSegmentMetric>;
  selectedIds: Set<string>;
  focusedPreviewId: string;
  addVideoTrack: () => void;
  addAudioTrack: () => void;
  removeVideoTrack: (trackId: string) => void;
  removeAudioTrack: (trackId: string) => void;
  removeTimelineNode: (id: string) => void;
  onBoxSelectTimelineNodes: (ids: string[], additive: boolean) => void;
  handleAssetDragStart: (
    event: React.DragEvent<HTMLElement>,
    id: string,
    kind?: 'video' | 'audio',
    offsetSeconds?: number,
  ) => void;
  focusTimelineSegment: (nodeId: string) => void;
  segmentTitle: (node: FlowNode) => string;
  mediaKind: (node: FlowNode) => string;
  seekTimelineTime: (
    time: number,
    options?: { keepPlaying?: boolean; preserveFocus?: boolean },
  ) => void;
  setFocusedPreviewId: (value: string) => void;
  segmentText: (node: FlowNode) => string;
  handleTimelinePlayheadGrabStart: (event: React.PointerEvent<HTMLElement>) => void;
  handleTimelinePlayheadGrabMove: (event: React.PointerEvent<HTMLElement>) => void;
  timelineThumbLeftPercent: number;
  timelineThumbWidthPercent: number;
  handleTimelineScrollThumbStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleTimelineScrollThumbMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleTimelineScrollThumbEnd: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleTimelineScaleHandleStart: (
    event: React.PointerEvent<HTMLButtonElement>,
    side: 'left' | 'right',
  ) => void;
  handleTimelineScaleHandleMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleTimelineScaleHandleEnd: (event: React.PointerEvent<HTMLButtonElement>) => void;
};

export function VideoTimelinePanel({
  language,
  timelineHeight,
  timelineMax,
  setTimelineHeight,
  status,
  previewPlaying,
  setPreviewPlaying,
  activeTimelineTime,
  activeTimelineFrame,
  timelineMetrics,
  timelineSnapEnabled,
  setTimelineSnapEnabled,
  timelineWheelMode,
  setTimelineWheelMode,
  timelineViewportRef,
  syncTimelineScrollInfo,
  handleTimelineDrop,
  openContextMenu,
  timelineScaleMode,
  setTimelineScaleMode,
  timelineScrubSurfaceRef,
  handleTimelineScrubStart,
  handleTimelineScrubMove,
  handleTimelineScrubEnd,
  timelineTicks,
  frameRate,
  timelineTickSettings,
  timelinePlayheadLeft,
  videoTrackIds,
  audioTrackIds,
  videoTrackByNodeId,
  audioTrackByNodeId,
  timelineNodes,
  timelineMetricById,
  selectedIds,
  focusedPreviewId,
  addVideoTrack,
  addAudioTrack,
  removeVideoTrack,
  removeAudioTrack,
  removeTimelineNode,
  onBoxSelectTimelineNodes,
  handleAssetDragStart,
  focusTimelineSegment,
  segmentTitle,
  mediaKind,
  seekTimelineTime,
  setFocusedPreviewId,
  segmentText,
  handleTimelinePlayheadGrabStart,
  handleTimelinePlayheadGrabMove,
  timelineThumbLeftPercent,
  timelineThumbWidthPercent,
  handleTimelineScrollThumbStart,
  handleTimelineScrollThumbMove,
  handleTimelineScrollThumbEnd,
  handleTimelineScaleHandleStart,
  handleTimelineScaleHandleMove,
  handleTimelineScaleHandleEnd,
}: VideoTimelinePanelProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const selectionDragRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    additive: boolean;
    pointerId: number;
    button: number;
  } | null>(null);
  const suppressNextContextMenuRef = useRef(false);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const getSelectionRect = (box: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }) => ({
    left: Math.min(box.startX, box.currentX),
    top: Math.min(box.startY, box.currentY),
    right: Math.max(box.startX, box.currentX),
    bottom: Math.max(box.startY, box.currentY),
  });

  const selectClipsInBox = (box: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    additive: boolean;
  }) => {
    const rect = getSelectionRect(box);
    const ids = Array.from(
      timelineViewportRef.current?.querySelectorAll<HTMLElement>('[data-timeline-clip-id]') || [],
    )
      .filter((element) => {
        const clipRect = element.getBoundingClientRect();
        return (
          clipRect.left <= rect.right &&
          clipRect.right >= rect.left &&
          clipRect.top <= rect.bottom &&
          clipRect.bottom >= rect.top
        );
      })
      .map((element) => element.dataset.timelineClipId)
      .filter((id): id is string => Boolean(id));

    const selectedBoxIds = Array.from(new Set(ids));
    onBoxSelectTimelineNodes(selectedBoxIds, box.additive);
    return selectedBoxIds;
  };

  const handleBoxSelectPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (status === 'rendering' || event.button !== 2) return;
    const target = event.target as HTMLElement;
    if (
      target.closest(
        'button,input,select,textarea,[draggable="true"],[data-timeline-no-box-select]',
      )
    ) {
      return;
    }
    event.preventDefault();
    const box = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      additive: event.shiftKey || event.ctrlKey || event.metaKey,
      pointerId: event.pointerId,
      button: event.button,
    };
    selectionDragRef.current = box;
    setSelectionBox(box);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleBoxSelectPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = selectionDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = { ...drag, currentX: event.clientX, currentY: event.clientY };
    selectionDragRef.current = next;
    setSelectionBox(next);
  };

  const handleBoxSelectPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = selectionDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    selectionDragRef.current = null;
    setSelectionBox(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const width = Math.abs(drag.currentX - drag.startX);
    const height = Math.abs(drag.currentY - drag.startY);
    if (drag.button === 2 && (width >= 5 || height >= 5)) {
      suppressNextContextMenuRef.current = true;
    }
    if (width < 5 && height < 5) return;
    const ids = selectClipsInBox(drag);
    if (drag.button === 2 && ids.length > 0) {
      openContextMenu(event as unknown as React.MouseEvent<HTMLElement>, {
        kind: 'empty',
        selectedNodeIds: ids,
      });
    }
  };

  const handleTimelinePanelContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (suppressNextContextMenuRef.current) {
      suppressNextContextMenuRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    openContextMenu(event, { kind: 'empty' });
  };

  const suppressBoxSelectContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (!suppressNextContextMenuRef.current) return;
    suppressNextContextMenuRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <section
      className="relative min-h-0 border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)]/95 grid grid-rows-[44px_minmax(0,1fr)_24px]"
      onContextMenuCapture={suppressBoxSelectContextMenu}
      onContextMenu={handleTimelinePanelContextMenu}
    >
      <div className="absolute inset-x-0 top-0">
        <ResizeHandle
          label={t(
            '调整视频编辑时间线高度',
            '編集タイムラインの高さを調整',
            'Resize editing timeline',
          )}
          axis="y"
          value={timelineHeight}
          min={PANEL_SIZE_LIMITS.timeline.min}
          max={timelineMax}
          reverse
          onChange={setTimelineHeight}
        />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--vr-border)] px-4">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
          <Clock className="w-4 h-4 text-[var(--vr-accent)]" />
          {t('视频编辑时间线', '編集タイムライン', 'Editing Timeline')}
        </div>
        <div className="flex justify-center gap-1.5">
          <button
            type="button"
            onClick={() => seekTimelineTime(0)}
            disabled={timelineNodes.length === 0 || status === 'rendering'}
            className="h-8 w-8 rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] flex items-center justify-center hover:bg-[var(--vr-accent-soft)] disabled:opacity-40"
            title={t('跳到开头', '先頭へ移動', 'Jump to start')}
            aria-label={t('跳到时间线开头', 'タイムラインの先頭へ移動', 'Jump to timeline start')}
          >
            <span className="text-xs font-black">|&lt;</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeTimelineTime >= timelineMetrics.totalDuration - 0.001) {
                seekTimelineTime(0, { keepPlaying: true });
              }
              setPreviewPlaying((prev) => !prev);
            }}
            disabled={timelineNodes.length === 0 || status === 'rendering'}
            className="h-8 w-8 rounded-lg bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)] flex items-center justify-center hover:bg-[var(--vr-surface-soft)] disabled:opacity-40"
            title={
              previewPlaying
                ? t('暂停时间线', 'タイムラインを一時停止', 'Pause timeline')
                : t('播放时间线', 'タイムラインを再生', 'Play timeline')
            }
          >
            {previewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => seekTimelineTime(timelineMetrics.totalDuration)}
            disabled={timelineNodes.length === 0 || status === 'rendering'}
            className="h-8 w-8 rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] flex items-center justify-center hover:bg-[var(--vr-accent-soft)] disabled:opacity-40"
            title={t('跳到结尾', '末尾へ移動', 'Jump to end')}
            aria-label={t('跳到时间线结尾', 'タイムラインの末尾へ移動', 'Jump to timeline end')}
          >
            <span className="text-xs font-black">&gt;|</span>
          </button>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setTimelineSnapEnabled((prev) => !prev)}
            className={`flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-black transition-colors ${
              timelineSnapEnabled
                ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
            }`}
            title={
              timelineSnapEnabled
                ? t('吸附已开启', 'スナップ有効', 'Snapping on')
                : t('吸附已关闭', 'スナップ無効', 'Snapping off')
            }
            aria-pressed={timelineSnapEnabled}
          >
            <Magnet className="w-3.5 h-3.5" />
            {t('吸附', 'スナップ', 'Snap')}
          </button>
          <div className="flex h-8 rounded-lg bg-[var(--vr-surface-soft)] p-0.5">
            {(['vertical', 'horizontal'] as TimelineWheelMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTimelineWheelMode(mode)}
                className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs font-black transition-colors ${
                  timelineWheelMode === mode
                    ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                    : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                }`}
                title={
                  mode === 'vertical'
                    ? t(
                        '鼠标滚轮上下滚动时间线区域',
                        'ホイールで縦スクロール',
                        'Mouse wheel scrolls vertically',
                      )
                    : t(
                        '鼠标滚轮左右移动时间线',
                        'ホイールで横スクロール',
                        'Mouse wheel scrolls horizontally',
                      )
                }
              >
                {mode === 'vertical' ? (
                  <MoveVertical className="w-3.5 h-3.5" />
                ) : (
                  <MoveHorizontal className="w-3.5 h-3.5" />
                )}
                {mode === 'vertical' ? t('上下', '縦', 'Y') : t('左右', '横', 'X')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        ref={timelineViewportRef}
        className="min-h-0 overflow-y-auto overflow-x-hidden p-4"
        onScroll={syncTimelineScrollInfo}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event) => handleTimelineDrop(event)}
      >
        <div className="min-w-max space-y-3">
          <div
            className="sticky -top-4 z-30 -mx-4 grid gap-3 bg-[var(--vr-surface)]/95 px-4 backdrop-blur"
            style={{ gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px minmax(0, 1fr)` }}
          >
            <div className="flex h-8 items-center justify-end">
              <div className="flex h-7 rounded-lg bg-[var(--vr-surface-soft)] p-0.5">
                {(['seconds', 'frames'] as TimelineScaleMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTimelineScaleMode(mode)}
                    className={`h-6 min-w-8 rounded-md px-1.5 text-[10px] font-black transition-colors ${
                      timelineScaleMode === mode
                        ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                        : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                    }`}
                    title={
                      mode === 'seconds'
                        ? t('按秒数显示比例尺', '秒でルーラーを表示', 'Show ruler in seconds')
                        : t('按帧数显示比例尺', 'フレームでルーラーを表示', 'Show ruler in frames')
                    }
                  >
                    {mode === 'seconds' ? t('秒', '秒', 'Sec') : t('帧', 'フレーム', 'Frm')}
                  </button>
                ))}
              </div>
            </div>
            <div
              ref={timelineScrubSurfaceRef}
              className="relative h-8 cursor-ew-resize rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)]"
              style={{ width: timelineMetrics.width }}
              onPointerDown={handleTimelineScrubStart}
              onPointerMove={handleTimelineScrubMove}
              onPointerUp={handleTimelineScrubEnd}
              onPointerCancel={handleTimelineScrubEnd}
              onContextMenu={(event) => openContextMenu(event, { kind: 'empty' })}
              title={t(
                '拖动或点击移动播放条',
                'ドラッグまたはクリックで再生位置を移動',
                'Drag or click to move playhead',
              )}
            >
              {timelineTicks.map((time) => {
                const left = time * timelineMetrics.pixelsPerSecond;
                const label =
                  timelineScaleMode === 'frames'
                    ? `${Math.round(time * frameRate)}f`
                    : formatSeconds(time, timelineTickSettings.precision);
                return (
                  <div
                    key={`${time}-${timelineScaleMode}`}
                    className="absolute top-0 h-full border-l border-[var(--vr-border-strong)]"
                    style={{ left }}
                  >
                    <span className="absolute left-1 top-1 text-[10px] font-black text-[var(--vr-text-muted)] whitespace-nowrap">
                      {label}
                    </span>
                  </div>
                );
              })}
              <div
                className="absolute inset-y-0 w-0.5 bg-[var(--vr-accent)] shadow-[0_0_0_1px_rgba(255,255,255,0.45)]"
                style={{ left: timelinePlayheadLeft }}
              />
            </div>
          </div>
          <div
            className="relative"
            onPointerDown={handleBoxSelectPointerDown}
            onPointerMove={handleBoxSelectPointerMove}
            onPointerUp={handleBoxSelectPointerEnd}
            onPointerCancel={handleBoxSelectPointerEnd}
          >
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-20"
              style={{ left: TIMELINE_LABEL_WIDTH + 12 + timelinePlayheadLeft }}
            >
              <div className="h-full w-0.5 bg-[var(--vr-accent)] shadow-[0_0_0_1px_rgba(255,255,255,0.45)]" />
            </div>
            <div className="space-y-0">
              <div
                className="grid items-center"
                style={{ gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px minmax(0, 1fr)` }}
              >
                <button
                  type="button"
                  onClick={addVideoTrack}
                  className="h-7 rounded-none bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] flex items-center justify-center"
                  title={t('新增视频轨', '動画トラックを追加', 'Add video track')}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <div />
              </div>
              {[...videoTrackIds].reverse().map((trackId) => {
                const trackIndex = videoTrackIds.indexOf(trackId);
                const trackNodes = timelineNodes.filter(
                  (node) =>
                    (videoTrackByNodeId[node.id] || videoTrackIds[0]) === trackId &&
                    Boolean(node.data?.videoUrl || node.data?.imageUrl || segmentText(node)) &&
                    !(
                      node.data?.audioUrl &&
                      !node.data?.videoUrl &&
                      !node.data?.imageUrl &&
                      !segmentText(node)
                    ),
                );
                const trackMetrics = trackNodes
                  .map((node) => timelineMetricById.get(node.id))
                  .filter(Boolean) as TimelineSegmentMetric[];
                return (
                  <div
                    key={trackId}
                    className="relative grid items-center"
                    style={{ gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px minmax(0, 1fr)` }}
                  >
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 z-0 border border-[var(--vr-video-track-border)] bg-[var(--vr-video-track-bg)]"
                      style={{ width: TIMELINE_LABEL_WIDTH + timelineMetrics.width }}
                    />
                    <div className="relative z-10 flex items-center gap-1 px-3 text-[11px] font-black text-sky-600 dark:text-sky-300">
                      <span className="min-w-0 truncate">
                        {`${t('视频轨', '動画トラック', 'Video')} ${trackIndex + 1}`}
                      </span>
                      {videoTrackIds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVideoTrack(trackId)}
                          className="shrink-0 w-5 h-5 rounded text-[var(--vr-text-muted)] hover:text-rose-500 hover:bg-[var(--vr-danger-soft)] flex items-center justify-center"
                          title={t('删除视频轨', '動画トラックを削除', 'Delete video track')}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div
                      data-render-track-kind="video"
                      className="relative z-10 min-h-20 overflow-hidden rounded-none bg-transparent"
                      style={{ width: timelineMetrics.width }}
                      onContextMenu={(event) =>
                        openContextMenu(event, { kind: 'empty', trackId, trackKind: 'video' })
                      }
                      onClick={() => setFocusedPreviewId('')}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(event) => handleTimelineDrop(event, undefined, trackId, 'video')}
                    >
                      {trackMetrics.map((metric) => {
                        const node = metric.node;
                        const enabled = selectedIds.has(node.id);
                        const segmentLayout = getTimelineSegmentLayout(
                          metric.start,
                          metric.duration,
                          timelineMetrics.pixelsPerSecond,
                        );
                        return (
                          <div
                            data-timeline-clip-id={node.id}
                            key={`${trackId}-${node.id}`}
                            draggable
                            onDragStart={(event) =>
                              handleAssetDragStart(
                                event,
                                node.id,
                                'video',
                                (event.clientX - event.currentTarget.getBoundingClientRect().left) /
                                  Math.max(1, timelineMetrics.pixelsPerSecond),
                              )
                            }
                            onDragOver={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              event.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(event) => handleTimelineDrop(event, node.id, trackId, 'video')}
                            onClick={(event) => {
                              event.stopPropagation();
                              focusTimelineSegment(node.id);
                            }}
                            onContextMenu={(event) =>
                              openContextMenu(event, {
                                kind: 'timeline',
                                nodeId: node.id,
                                trackId,
                                trackKind: 'video',
                              })
                            }
                            className={`absolute top-0 h-20 min-w-0 overflow-hidden rounded-none border p-2 cursor-grab active:cursor-grabbing transition-colors ${enabled ? 'border-[var(--vr-video-clip-border)] bg-[var(--vr-video-clip-bg)]' : 'border-[var(--vr-video-track-border)] bg-[var(--vr-panel)] opacity-60'} ${focusedPreviewId === node.id ? 'ring-2 ring-[var(--vr-video-clip-border)]/40' : ''}`}
                            style={{
                              left: segmentLayout.left,
                              width: segmentLayout.width,
                            }}
                          >
                            {node.data?.imageUrl ? (
                              <img
                                src={node.data.imageUrl as string}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                                draggable={false}
                              />
                            ) : node.data?.videoUrl ? (
                              <video
                                src={node.data.videoUrl as string}
                                className="absolute inset-0 h-full w-full object-cover"
                                muted
                                playsInline
                                draggable={false}
                              />
                            ) : null}
                            {(node.data?.imageUrl || node.data?.videoUrl) && (
                              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/65" />
                            )}
                            <div className="relative z-10 flex items-center justify-end">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeTimelineNode(node.id);
                                  }}
                                  onDragStart={(event) => event.preventDefault()}
                                  className={`w-5 h-5 rounded flex items-center justify-center ${
                                    node.data?.imageUrl || node.data?.videoUrl
                                      ? 'bg-black/45 text-white hover:bg-rose-500 hover:text-white'
                                      : 'text-[var(--vr-text-muted)] hover:text-rose-500 hover:bg-[var(--vr-danger-soft)]'
                                  }`}
                                  title={t(
                                    '从时间线删除',
                                    'タイムラインから削除',
                                    'Remove from timeline',
                                  )}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div
                              className={`relative z-10 mt-2 flex items-center gap-1.5 text-[11px] font-black ${
                                node.data?.imageUrl || node.data?.videoUrl
                                  ? 'text-white drop-shadow'
                                  : 'text-[var(--vr-text)]'
                              }`}
                            >
                              <span className="truncate">{segmentTitle(node)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {trackNodes.length === 0 ? (
                        <div
                          className="h-20 rounded-none border border-dashed border-[var(--vr-video-track-border)] flex items-center justify-center text-xs font-bold text-[var(--vr-text-muted)]"
                          style={{ width: timelineMetrics.width }}
                        >
                          {t(
                            '把左侧素材拖到这里',
                            '左側の素材をここへドラッグ',
                            'Drag assets here',
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <div className="relative h-4">
                <div
                  className="pointer-events-none absolute left-0 top-1/2 z-30 h-0.5 -translate-y-1/2 rounded-full bg-[var(--vr-border-strong)]"
                  style={{ width: TIMELINE_LABEL_WIDTH + 12 + timelineMetrics.width }}
                />
                <div
                  className="absolute top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none"
                  data-timeline-no-box-select
                  style={{ left: TIMELINE_LABEL_WIDTH + 12 + timelinePlayheadLeft }}
                  onPointerDown={handleTimelinePlayheadGrabStart}
                  onPointerMove={handleTimelinePlayheadGrabMove}
                  onPointerUp={handleTimelineScrubEnd}
                  onPointerCancel={handleTimelineScrubEnd}
                  title={t(
                    '拖动调整播放条',
                    'ドラッグして再生位置を調整',
                    'Drag to adjust playhead',
                  )}
                >
                  <div className="relative rounded-md bg-[var(--vr-accent)] px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm whitespace-nowrap">
                    <span
                      className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-0.5 -translate-y-1/2 rounded-full bg-[var(--vr-border-strong)]"
                      aria-hidden="true"
                    />
                    <span className="relative z-20">
                      {timelineScaleMode === 'frames'
                        ? `${activeTimelineFrame}f`
                        : formatSeconds(activeTimelineTime)}
                    </span>
                  </div>
                </div>
              </div>
              {audioTrackIds.map((trackId, trackIndex) => {
                const trackNodes = timelineNodes.filter(
                  (node) =>
                    (audioTrackByNodeId[node.id] || audioTrackIds[0]) === trackId &&
                    Boolean(node.data?.audioUrl || node.data?.videoUrl),
                );
                const trackMetrics = trackNodes
                  .map((node) => timelineMetricById.get(node.id))
                  .filter(Boolean) as TimelineSegmentMetric[];
                return (
                  <div
                    key={trackId}
                    className="relative grid items-center"
                    style={{ gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px minmax(0, 1fr)` }}
                  >
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 z-0 border border-[var(--vr-audio-track-border)] bg-[var(--vr-audio-track-bg)]"
                      style={{ width: TIMELINE_LABEL_WIDTH + timelineMetrics.width }}
                    />
                    <div className="relative z-10 flex items-center gap-1 px-3 text-[11px] font-black text-violet-600 dark:text-violet-300">
                      <span className="min-w-0 truncate">
                        {`${t('音频轨', '音声トラック', 'Audio')} ${trackIndex + 1}`}
                      </span>
                      {audioTrackIds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAudioTrack(trackId)}
                          className="shrink-0 w-5 h-5 rounded text-[var(--vr-text-muted)] hover:text-rose-500 hover:bg-[var(--vr-danger-soft)] flex items-center justify-center"
                          title={t('删除音频轨', '音声トラックを削除', 'Delete audio track')}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div
                      data-render-track-kind="audio"
                      className="relative z-10 min-h-12 overflow-hidden rounded-none bg-transparent"
                      style={{ width: timelineMetrics.width }}
                      onContextMenu={(event) =>
                        openContextMenu(event, { kind: 'empty', trackId, trackKind: 'audio' })
                      }
                      onClick={() => setFocusedPreviewId('')}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(event) => handleTimelineDrop(event, undefined, trackId, 'audio')}
                    >
                      {trackMetrics.map((metric) => {
                        const node = metric.node;
                        const audioText = segmentText(node) || segmentTitle(node);
                        const segmentLayout = getTimelineSegmentLayout(
                          metric.start,
                          metric.duration,
                          timelineMetrics.pixelsPerSecond,
                        );
                        return (
                          <button
                            data-timeline-clip-id={node.id}
                            key={`${trackId}-${node.id}-audio`}
                            type="button"
                            draggable
                            onDragStart={(event) =>
                              handleAssetDragStart(
                                event,
                                node.id,
                                'audio',
                                (event.clientX - event.currentTarget.getBoundingClientRect().left) /
                                  Math.max(1, timelineMetrics.pixelsPerSecond),
                              )
                            }
                            onDragOver={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              event.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(event) => handleTimelineDrop(event, node.id, trackId, 'audio')}
                            onContextMenu={(event) =>
                              openContextMenu(event, {
                                kind: 'audio',
                                nodeId: node.id,
                                trackId,
                                trackKind: 'audio',
                              })
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              focusTimelineSegment(node.id);
                            }}
                            className={`absolute top-0 h-12 min-w-0 overflow-hidden rounded-none border px-3 text-left transition-colors ${selectedIds.has(node.id) ? 'border-[var(--vr-audio-clip-border)] bg-[var(--vr-audio-clip-bg)]' : 'border-[var(--vr-audio-track-border)] bg-[var(--vr-panel)] opacity-55'} ${focusedPreviewId === node.id ? 'ring-2 ring-[var(--vr-audio-clip-border)]/40' : ''}`}
                            style={{
                              left: segmentLayout.left,
                              width: segmentLayout.width,
                            }}
                          >
                            <div className="flex items-center gap-2 text-[11px] font-black text-[var(--vr-text)]">
                              <span className="truncate">{audioText}</span>
                            </div>
                          </button>
                        );
                      })}
                      {trackNodes.length === 0 ? (
                        <div
                          className="h-12 rounded-none border border-dashed border-[var(--vr-audio-track-border)] flex items-center justify-center text-xs font-bold text-[var(--vr-text-muted)]"
                          style={{ width: timelineMetrics.width }}
                        >
                          {t(
                            '把音频片段拖到这里',
                            '音声クリップをここへドラッグ',
                            'Drag audio clips here',
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <div
                className="grid items-center"
                style={{ gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px minmax(0, 1fr)` }}
              >
                <button
                  type="button"
                  onClick={addAudioTrack}
                  className="h-7 rounded-none bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] flex items-center justify-center"
                  title={t('新增音频轨', '音声トラックを追加', 'Add audio track')}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <div />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex h-6 items-center border-t border-[var(--vr-border)] bg-[var(--vr-surface)] px-4">
        <div className="flex h-full w-full items-center">
          <div className="relative h-2 w-full rounded-full bg-slate-200">
            <div
              className="absolute inset-y-1 rounded-full bg-[var(--vr-accent-soft)]"
              style={{
                left: `${timelineThumbLeftPercent}%`,
                width: `${timelineThumbWidthPercent}%`,
              }}
            />
            <div
              className="absolute inset-y-0 cursor-grab active:cursor-grabbing"
              style={{
                left: `${timelineThumbLeftPercent}%`,
                width: `${timelineThumbWidthPercent}%`,
              }}
              onPointerDown={handleTimelineScrollThumbStart}
              onPointerMove={handleTimelineScrollThumbMove}
              onPointerUp={handleTimelineScrollThumbEnd}
              onPointerCancel={handleTimelineScrollThumbEnd}
              title={t(
                '拖动移动时间线视野',
                'ドラッグしてタイムライン表示を移動',
                'Drag to scroll timeline',
              )}
            >
              <div className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[var(--vr-accent)]/50" />
              <button
                type="button"
                className="absolute left-0 top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[var(--vr-surface-strong)] bg-[var(--vr-accent)] shadow-sm outline-none transition-[width,height,filter] hover:h-5 hover:w-5 hover:brightness-110 active:h-5 active:w-5"
                onPointerDown={(event) => handleTimelineScaleHandleStart(event, 'left')}
                onPointerMove={handleTimelineScaleHandleMove}
                onPointerUp={handleTimelineScaleHandleEnd}
                onPointerCancel={handleTimelineScaleHandleEnd}
                title={t(
                  '拖动调整可视窗口宽度',
                  'ドラッグして表示範囲の幅を調整',
                  'Drag to resize timeline window',
                )}
                aria-label={t(
                  '调整时间轴缩放左手柄',
                  'タイムライン倍率の左ハンドルを調整',
                  'Adjust timeline scale left handle',
                )}
              />
              <button
                type="button"
                className="absolute right-0 top-1/2 z-10 h-4 w-4 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[var(--vr-surface-strong)] bg-[var(--vr-accent)] shadow-sm outline-none transition-[width,height,filter] hover:h-5 hover:w-5 hover:brightness-110 active:h-5 active:w-5"
                onPointerDown={(event) => handleTimelineScaleHandleStart(event, 'right')}
                onPointerMove={handleTimelineScaleHandleMove}
                onPointerUp={handleTimelineScaleHandleEnd}
                onPointerCancel={handleTimelineScaleHandleEnd}
                title={t(
                  '拖动调整可视窗口宽度',
                  'ドラッグして表示範囲の幅を調整',
                  'Drag to resize timeline window',
                )}
                aria-label={t(
                  '调整时间轴缩放右手柄',
                  'タイムライン倍率の右ハンドルを調整',
                  'Adjust timeline scale right handle',
                )}
              />
            </div>
          </div>
        </div>
      </div>
      {selectionBox && (
        <div
          className="pointer-events-none fixed z-[9999] rounded border border-[var(--vr-accent)] bg-[var(--vr-accent)]/15 shadow-[0_0_0_1px_rgba(255,255,255,0.35)_inset]"
          style={{
            left: getSelectionRect(selectionBox).left,
            top: getSelectionRect(selectionBox).top,
            width: getSelectionRect(selectionBox).right - getSelectionRect(selectionBox).left,
            height: getSelectionRect(selectionBox).bottom - getSelectionRect(selectionBox).top,
          }}
        />
      )}
    </section>
  );
}
