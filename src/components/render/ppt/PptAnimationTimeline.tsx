import { Pause, Play, Repeat2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import type { PptObjectAnimation } from '../video/shared/types';
import { targetLabel } from './pptAnimationLabels';
import { usePptCopy } from './pptCopyContext';
import { pptDirectionArrow } from './PptDirectionControl';
import { movePptTimelineAnimations, pptTimelineStarts } from './pptTimelineEdits';
import type { VideoTimelineTrack } from './PptWorkspace';
import { effectLabel, startLabel } from './PptWorkspace';
import { PPT_TIMELINE_MIN_DURATION_MS } from './pptWorkspaceModel';
export function AnimationTimeline({
  mode,
  emptyLabel,
  animations,
  videoTrack,
  playheadMs,
  onPlayheadChange,
  onSelect,
  onSelectVideo,
  onDelete,
  onDeleteAnimations,
  onMoveAnimations,
  onPreview,
  previewing,
  loopPreview,
  onToggleLoopPreview,
  onPausePreview,
}: {
  mode: 'overview' | 'list';
  emptyLabel?: string;
  animations: PptObjectAnimation[];
  videoTrack?: VideoTimelineTrack;
  playheadMs: number;
  onPlayheadChange: (milliseconds: number) => void;
  onSelect: (animation: PptObjectAnimation) => void;
  onSelectVideo: () => void;
  onDelete: (id: string) => void;
  onDeleteAnimations: (ids: string[]) => void;
  onMoveAnimations: (ids: string[], deltaMs: number) => void;
  onPreview: () => void;
  previewing: boolean;
  loopPreview: boolean;
  onToggleLoopPreview: () => void;
  onPausePreview: () => void;
}) {
  const copy = usePptCopy();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [dragPreview, setDragPreview] = useState<PptObjectAnimation[] | null>(null);
  const clipDragRef = useRef<{
    x: number;
    width: number;
    duration: number;
    ids: string[];
    animations: PptObjectAnimation[];
    deltaMs: number;
    moved: boolean;
  } | null>(null);
  const suppressClipClickRef = useRef(false);
  const visibleAnimations = dragPreview || animations;
  const starts = pptTimelineStarts(visibleAnimations);
  const selectedAnimationIds = animations
    .filter((item) => selectedIds.has(item.id))
    .map((item) => item.id);
  const toggleSelection = (id: string) =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const beginClipDrag = (event: React.PointerEvent<HTMLSpanElement>, item: PptObjectAnimation) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      toggleSelection(item.id);
      return;
    }
    const ids = selectedIds.has(item.id) ? selectedAnimationIds : [item.id];
    setSelectedIds(new Set(ids));
    onSelect(item);
    onPausePreview();
    const width = event.currentTarget.parentElement!.getBoundingClientRect().width;
    clipDragRef.current = {
      x: event.clientX,
      width,
      duration: viewportDurationMs,
      ids,
      animations,
      deltaMs: 0,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveClipDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    const drag = clipDragRef.current;
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (Math.abs(event.clientX - drag.x) < 3 && !drag.moved) return;
    drag.moved = true;
    drag.deltaMs =
      Math.round((((event.clientX - drag.x) / Math.max(1, drag.width)) * drag.duration) / 50) * 50;
    setDragPreview(movePptTimelineAnimations(drag.animations, drag.ids, drag.deltaMs));
  };
  const endClipDrag = (event: React.PointerEvent<HTMLSpanElement>, cancel = false) => {
    const drag = clipDragRef.current;
    clipDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDragPreview(null);
    suppressClipClickRef.current = Boolean(drag?.moved);
    if (!cancel && drag?.moved) onMoveAnimations(drag.ids, drag.deltaMs);
  };
  const totalMs = Math.max(
    videoTrack?.durationMs || 0,
    ...visibleAnimations.map((item, index) => starts[index] + item.durationMs),
  );
  const hasTracks = Boolean(videoTrack) || animations.length > 0;
  const timelineDurationMs = clipDragRef.current
    ? Math.max(
        PPT_TIMELINE_MIN_DURATION_MS,
        ...pptTimelineStarts(animations).map(
          (start, index) => start + animations[index].durationMs,
        ),
        videoTrack?.durationMs || 0,
      )
    : Math.max(PPT_TIMELINE_MIN_DURATION_MS, totalMs);
  const [timelineViewport, setTimelineViewport] = useState({ start: 0, end: 1 });
  const navigatorRef = useRef<HTMLDivElement>(null);
  const navigatorDragRef = useRef<{
    mode: 'pan' | 'start' | 'end';
    x: number;
    start: number;
    end: number;
  } | null>(null);
  const viewportStartMs = timelineViewport.start * timelineDurationMs;
  const viewportDurationMs = (timelineViewport.end - timelineViewport.start) * timelineDurationMs;
  const movePlayhead = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onPlayheadChange(Math.round(viewportStartMs + ratio * viewportDurationMs));
  };
  const beginSeek = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    movePlayhead(event);
  };
  const continueSeek = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) movePlayhead(event);
  };
  const endSeek = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const beginNavigatorDrag = (
    event: React.PointerEvent<HTMLElement>,
    mode: 'pan' | 'start' | 'end',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    navigatorDragRef.current = {
      mode,
      x: event.clientX,
      start: timelineViewport.start,
      end: timelineViewport.end,
    };
  };
  const updateNavigatorDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = navigatorDragRef.current;
    const rect = navigatorRef.current?.getBoundingClientRect();
    if (!drag || !rect || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const delta = (event.clientX - drag.x) / rect.width;
    const minWindow = 0.14;
    if (drag.mode === 'pan') {
      const width = drag.end - drag.start;
      const start = Math.min(1 - width, Math.max(0, drag.start + delta));
      setTimelineViewport({ start, end: start + width });
      return;
    }
    if (drag.mode === 'start') {
      setTimelineViewport({
        start: Math.min(drag.end - minWindow, Math.max(0, drag.start + delta)),
        end: drag.end,
      });
      return;
    }
    setTimelineViewport({
      start: drag.start,
      end: Math.max(drag.start + minWindow, Math.min(1, drag.end + delta)),
    });
  };
  const endNavigatorDrag = (event: React.PointerEvent<HTMLElement>) => {
    navigatorDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const formatTime = (milliseconds: number) => {
    const safeMilliseconds = Math.max(0, milliseconds);
    const totalSeconds = safeMilliseconds / 1000;
    if (timelineDurationMs < 60_000) return `${totalSeconds.toFixed(1)}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    const formattedSeconds = Number.isInteger(remainingSeconds)
      ? String(remainingSeconds).padStart(2, '0')
      : remainingSeconds.toFixed(1).padStart(4, '0');
    return `${minutes}:${formattedSeconds}`;
  };
  const timelineTicks = Array.from({ length: 5 }, (_, index) =>
    Math.round(viewportStartMs + (viewportDurationMs / 4) * index),
  );
  const playheadPercent =
    ((Math.min(
      timelineViewport.end,
      Math.max(timelineViewport.start, playheadMs / timelineDurationMs),
    ) -
      timelineViewport.start) /
      (timelineViewport.end - timelineViewport.start)) *
    100;
  const clipStyle = (startMs: number, durationMs: number) => {
    const endMs = startMs + durationMs;
    const visibleStart = Math.max(viewportStartMs, startMs);
    const visibleEnd = Math.min(viewportStartMs + viewportDurationMs, endMs);
    if (visibleEnd <= visibleStart) return { display: 'none' as const };
    return {
      left: `${((visibleStart - viewportStartMs) / viewportDurationMs) * 100}%`,
      width: `${Math.max(3, ((visibleEnd - visibleStart) / viewportDurationMs) * 100)}%`,
    };
  };
  const animationFrameStyle = (item: PptObjectAnimation, frame: number): React.CSSProperties => {
    const progress = (frame + 1) / 8;
    const reverse = (item.phase || 'enter') === 'exit';
    const amount = reverse ? progress : 1 - progress;
    if (item.effect === 'line' || item.effect === 'fly')
      return { opacity: 0.3 + progress * 0.7, transform: `translateX(${amount * -9}px)` };
    if (item.effect === 'zoom' || item.effect === 'growShrink')
      return { opacity: 0.35 + progress * 0.65, transform: `scale(${0.72 + progress * 0.28})` };
    if (item.effect === 'fade' || item.effect === 'appear')
      return { opacity: reverse ? 1 - progress * 0.72 : 0.28 + progress * 0.72 };
    if (item.effect === 'spin' || item.effect === 'wiggle')
      return { opacity: 0.5 + progress * 0.5, transform: `rotate(${(progress - 0.5) * 12}deg)` };
    return { opacity: 0.45 + Math.abs(Math.sin(progress * Math.PI)) * 0.55 };
  };
  const phaseMarkerClass = (item: PptObjectAnimation) => {
    switch (item.phase || 'enter') {
      case 'exit':
        return 'bg-rose-500';
      case 'emphasis':
        return 'bg-blue-500';
      default:
        return 'bg-emerald-500';
    }
  };
  const phaseActiveClass = (item: PptObjectAnimation) => {
    switch (item.phase || 'enter') {
      case 'exit':
        return 'border-rose-500 bg-rose-500/10';
      case 'emphasis':
        return 'border-blue-500 bg-blue-500/10';
      default:
        return 'border-emerald-500 bg-emerald-500/10';
    }
  };
  const isOverview = mode === 'overview';
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-[var(--vr-text)]">{copy.animation}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLoopPreview}
            aria-pressed={loopPreview}
            title={copy.loopPreview}
            className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-bold ${loopPreview ? 'bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)]'}`}
          >
            <Repeat2 className="h-4 w-4" />
            {copy.loopPreview}
          </button>
          <button
            type="button"
            onClick={previewing ? onPausePreview : onPreview}
            className="render-icon-button"
            title={previewing ? copy.pausePreview : copy.playCurrentSlide}
            aria-label={previewing ? copy.pausePreview : copy.playCurrentSlide}
          >
            {previewing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {animations.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--vr-text-muted)]">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              aria-label={copy.selectAllAnimations}
              checked={selectedAnimationIds.length === animations.length}
              onChange={(event) =>
                setSelectedIds(
                  new Set(event.target.checked ? animations.map((item) => item.id) : []),
                )
              }
            />
            {copy.selectAllAnimations}
          </label>
          <span>{copy.dragAnimationDelay}</span>
          {selectedAnimationIds.length ? (
            <button
              type="button"
              className="ppt-mini-button ml-auto text-rose-500"
              onClick={() => {
                onDeleteAnimations(selectedAnimationIds);
                setSelectedIds(new Set());
              }}
            >
              {copy.delete} ({selectedAnimationIds.length})
            </button>
          ) : null}
        </div>
      ) : null}
      {hasTracks ? (
        <div className="space-y-3">
          {isOverview ? (
            <div className="overflow-hidden rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2">
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-[var(--vr-text-muted)]">
                  <span>播放头</span>
                  <output className="rounded bg-[var(--vr-accent-soft)] px-1.5 py-0.5 text-[var(--vr-accent-strong)]">
                    {formatTime(playheadMs)}
                  </output>
                </div>
                <div className="grid grid-cols-[108px_minmax(0,1fr)] gap-2">
                  <div />
                  <div
                    className="relative h-10 cursor-ew-resize select-none border-y border-[var(--vr-border)] bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(25%_-_1px),var(--vr-border)_calc(25%_-_1px),var(--vr-border)_25%)]"
                    onPointerDown={beginSeek}
                    onPointerMove={continueSeek}
                    onPointerUp={endSeek}
                    onPointerCancel={endSeek}
                    aria-label="拖动播放头定位动画时间"
                  >
                    {timelineTicks.map((tick) => (
                      <span
                        key={tick}
                        className="absolute top-1 text-[10px] font-bold text-[var(--vr-text-muted)]"
                        style={{
                          left: `${((tick - viewportStartMs) / viewportDurationMs) * 100}%`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        {formatTime(tick)}
                      </span>
                    ))}
                    <span
                      className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-[var(--vr-accent)] shadow-[0_0_0_1px_rgba(255,255,255,0.7)]"
                      style={{ left: `${playheadPercent}%` }}
                    >
                      <span className="absolute -left-3 -top-1 rounded bg-[var(--vr-accent)] px-1.5 py-0.5 text-[10px] font-black text-white">
                        {formatTime(playheadMs)}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="relative space-y-1.5 pt-2">
                  <span className="pointer-events-none absolute bottom-0 left-[116px] right-0 top-0 z-20">
                    <span
                      className="absolute inset-y-0 w-0.5 bg-[var(--vr-accent)]/90 shadow-[0_0_0_1px_rgba(255,255,255,0.7)]"
                      style={{ left: `${playheadPercent}%` }}
                    />
                  </span>
                  {videoTrack ? (
                    <div className="grid grid-cols-[108px_minmax(0,1fr)] items-center gap-2">
                      <button
                        type="button"
                        onClick={onSelectVideo}
                        className="flex min-w-0 items-center gap-1.5 text-left text-[11px] font-bold text-[var(--vr-text)]"
                        title="视频"
                      >
                        <span
                          aria-hidden="true"
                          className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded bg-violet-500 text-[9px] text-white"
                        >
                          ▶
                        </span>
                        <span className="truncate">视频</span>
                      </button>
                      <button
                        type="button"
                        onClick={onSelectVideo}
                        className={`relative h-8 overflow-hidden rounded border text-left ${
                          playheadMs <=
                          (videoTrack.loop ? timelineDurationMs : videoTrack.durationMs)
                            ? 'border-violet-500 bg-violet-500/10'
                            : 'border-transparent bg-[var(--vr-border)]'
                        }`}
                        title={videoTrack.loop ? '视频 · 循环播放' : '视频 · 播放一次'}
                      >
                        <span
                          className="absolute inset-y-1 overflow-hidden rounded bg-violet-500 text-white"
                          style={clipStyle(
                            0,
                            videoTrack.loop ? timelineDurationMs : videoTrack.durationMs,
                          )}
                        >
                          <span className="absolute inset-x-1 bottom-1 grid h-1.5 grid-cols-12 gap-px opacity-65">
                            {Array.from({ length: 12 }, (_, frame) => (
                              <i
                                key={frame}
                                className="rounded-sm bg-white/80"
                                style={{ opacity: 0.38 + (frame % 3) * 0.2 }}
                              />
                            ))}
                          </span>
                          <strong className="relative z-10 block truncate px-2 text-[10px] leading-5 text-white">
                            {videoTrack.loop ? '视频 · 循环播放' : '视频 · 播放一次'}
                          </strong>
                        </span>
                      </button>
                    </div>
                  ) : null}
                  {visibleAnimations.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[108px_minmax(0,1fr)] items-center gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        <input
                          type="checkbox"
                          className="shrink-0"
                          aria-label={`${copy.selectAnimation} ${index + 1}`}
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelection(item.id)}
                        />
                        <button
                          type="button"
                          onClick={() => onSelect(item)}
                          className="flex min-w-0 items-center gap-1.5 text-left text-[11px] font-bold text-[var(--vr-text)]"
                          title={`${targetLabel(copy, item)} · ${effectLabel(copy, item.effect, item.action)} · ${startLabel(copy, item.start)} · 开始于 ${(starts[index] / 1000).toFixed(1)}s`}
                          aria-label={`${targetLabel(copy, item)} · ${copy[item.phase || 'enter']} · ${effectLabel(copy, item.effect, item.action)} · 开始于 ${(starts[index] / 1000).toFixed(1)} 秒`}
                        >
                          <span>{index + 1}.</span>
                          <span
                            aria-hidden="true"
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${phaseMarkerClass(item)}`}
                          />
                          <span className="grid min-w-0 leading-tight">
                            <span className="truncate">
                              {item.target === 'dialog-body' || item.target === 'dialog-title'
                                ? `${targetLabel(copy, item)} · ${effectLabel(copy, item.effect, item.action)}`
                                : effectLabel(copy, item.effect, item.action)}
                            </span>
                            <span className="text-[9px] font-semibold text-[var(--vr-text-muted)]">
                              开始 {(starts[index] / 1000).toFixed(1)}s
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded p-1 text-rose-500 hover:bg-rose-500/10"
                          title={copy.delete}
                          aria-label={`${copy.delete} ${copy.animation} ${index + 1}`}
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          if (suppressClipClickRef.current) {
                            suppressClipClickRef.current = false;
                            return;
                          }
                          if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                          onSelect(item);
                        }}
                        className={`relative h-8 overflow-hidden rounded border text-left ${
                          selectedIds.has(item.id) ||
                          (playheadMs >= starts[index] &&
                            playheadMs <= starts[index] + item.durationMs)
                            ? phaseActiveClass(item)
                            : 'border-transparent bg-[var(--vr-border)]'
                        }`}
                        title={`${startLabel(copy, item.start)} · 开始于 ${(starts[index] / 1000).toFixed(1)}s · 持续 ${(item.durationMs / 1000).toFixed(1)} ${copy.seconds}`}
                      >
                        <span
                          data-ppt-animation-clip={item.id}
                          className={`absolute inset-y-1 cursor-ew-resize touch-none overflow-hidden rounded ${phaseMarkerClass(item)} text-white`}
                          onPointerDown={(event) => beginClipDrag(event, item)}
                          onPointerMove={moveClipDrag}
                          onPointerUp={(event) => endClipDrag(event)}
                          onPointerCancel={(event) => endClipDrag(event, true)}
                          style={clipStyle(starts[index], item.durationMs)}
                        >
                          <span className="absolute inset-x-1 bottom-1 grid h-1.5 grid-cols-8 gap-px opacity-65">
                            {Array.from({ length: 8 }, (_, frame) => (
                              <i
                                key={frame}
                                className="rounded-sm bg-white/80"
                                style={animationFrameStyle(item, frame)}
                              />
                            ))}
                          </span>
                          <strong className="relative z-10 block truncate px-2 text-[10px] leading-5 text-white">
                            {effectLabel(copy, item.effect, item.action)}
                          </strong>
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
                <div
                  ref={navigatorRef}
                  className="relative ml-[116px] mt-4 h-3 rounded-full bg-[var(--vr-border)]"
                  aria-label="时间轴缩放和滚动范围"
                >
                  <div
                    className="absolute inset-y-0 cursor-grab rounded-full bg-[var(--vr-accent-soft)] active:cursor-grabbing"
                    style={{
                      left: `${timelineViewport.start * 100}%`,
                      width: `${(timelineViewport.end - timelineViewport.start) * 100}%`,
                    }}
                    onPointerDown={(event) => beginNavigatorDrag(event, 'pan')}
                    onPointerMove={updateNavigatorDrag}
                    onPointerUp={endNavigatorDrag}
                    onPointerCancel={endNavigatorDrag}
                    title="拖动移动时间轴视图"
                  >
                    <span className="pointer-events-none absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[var(--vr-accent)]/60" />
                    <button
                      type="button"
                      className="absolute left-0 top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[var(--vr-surface-strong)] bg-[var(--vr-accent)] shadow-sm"
                      onPointerDown={(event) => beginNavigatorDrag(event, 'start')}
                      onPointerMove={updateNavigatorDrag}
                      onPointerUp={endNavigatorDrag}
                      onPointerCancel={endNavigatorDrag}
                      title="拖动缩放时间轴左边界"
                      aria-label="拖动缩放时间轴左边界"
                    />
                    <button
                      type="button"
                      className="absolute right-0 top-1/2 z-10 h-4 w-4 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[var(--vr-surface-strong)] bg-[var(--vr-accent)] shadow-sm"
                      onPointerDown={(event) => beginNavigatorDrag(event, 'end')}
                      onPointerMove={updateNavigatorDrag}
                      onPointerUp={endNavigatorDrag}
                      onPointerCancel={endNavigatorDrag}
                      title="拖动缩放时间轴右边界"
                      aria-label="拖动缩放时间轴右边界"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {!isOverview ? (
            <div className="space-y-2">
              {videoTrack ? (
                <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-2.5">
                  <button
                    type="button"
                    onClick={onSelectVideo}
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-violet-500 text-[10px] font-black text-white">
                      ▶
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-xs text-[var(--vr-text)]">视频</strong>
                      <small className="mt-1 block text-[10px] text-[var(--vr-text-muted)]">
                        {videoTrack.loop ? '循环播放' : '播放一次'} ·{' '}
                        {(videoTrack.durationMs / 1000).toFixed(1)} {copy.seconds}
                      </small>
                    </span>
                  </button>
                </div>
              ) : null}
              {animations.map((item, index) => (
                <div
                  key={`${item.id}-details`}
                  className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2.5"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-black text-white ${phaseMarkerClass(item)}`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-xs text-[var(--vr-text)]">
                        {effectLabel(copy, item.effect, item.action)} · {targetLabel(copy, item)}
                      </strong>
                      <small className="mt-1 block text-[10px] text-[var(--vr-text-muted)]">
                        {startLabel(copy, item.start)} ·{' '}
                        {pptDirectionArrow(item.direction, item.phase)} ·{' '}
                        {(item.durationMs / 1000).toFixed(1)} {copy.seconds}
                      </small>
                    </span>
                  </button>
                  <div className="mt-2 flex justify-end gap-1">
                    <button
                      type="button"
                      className="ppt-mini-button text-rose-500"
                      onClick={() => onDelete(item.id)}
                    >
                      {copy.delete}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--vr-border)] px-4 py-8 text-center text-xs leading-5 text-[var(--vr-text-muted)]">
          {emptyLabel || copy.noAnimationsHint}
        </div>
      )}
    </>
  );
}
