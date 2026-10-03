import { Pause, Play, Repeat2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import type { PptObjectAnimation } from '../video/shared/types';
import { targetLabel } from './pptAnimationLabels';
import { usePptCopy } from './pptCopyContext';
import { pptDirectionArrow } from './PptDirectionControl';
import {
  canDeletePptTimelineAnimation,
  movePptTimelineAnimations,
  pptTimelineMarqueeIds,
  pptTimelineStarts,
  resizePptTimelineAnimation,
} from './pptTimelineEdits';
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
  onResizeAnimation,
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
  onResizeAnimation: (id: string, edge: 'left' | 'right', deltaMs: number) => void;
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
    mode: 'move' | 'left' | 'right';
    id: string;
    animations: PptObjectAnimation[];
    deltaMs: number;
    moved: boolean;
  } | null>(null);
  const suppressClipClickRef = useRef(false);
  const suppressMarqueeClickRef = useRef(false);
  const marqueeRef = useRef<{
    x: number;
    y: number;
    initial: Set<string>;
    additive: boolean;
    moved: boolean;
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const visibleAnimations = dragPreview || animations;
  const starts = pptTimelineStarts(visibleAnimations);
  const selectedAnimationIds = animations
    .filter((item) => selectedIds.has(item.id))
    .map((item) => item.id);
  const deletableSelectedIds = animations
    .filter((item) => selectedIds.has(item.id) && canDeletePptTimelineAnimation(item))
    .map((item) => item.id);
  const toggleSelection = (id: string) =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectClip = (event: React.MouseEvent, item: PptObjectAnimation) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey) toggleSelection(item.id);
    else setSelectedIds(new Set([item.id]));
    onSelect(item);
  };
  const beginMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-ppt-animation-clip]'))
      return;
    const button = (event.target as HTMLElement).closest('button');
    if (button && !button.hasAttribute('data-ppt-timeline-track')) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    marqueeRef.current = {
      x: event.clientX,
      y: event.clientY,
      initial: new Set(selectedIds),
      additive: event.ctrlKey || event.metaKey || event.shiftKey,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (button) {
      const item = animations.find((entry) => entry.id === button.dataset.pptTimelineTrack);
      if (item) {
        setSelectedIds(new Set([item.id]));
        onSelect(item);
      }
    } else if (!marqueeRef.current.additive) setSelectedIds(new Set());
  };
  const updateMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = marqueeRef.current;
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3 && !drag.moved) return;
    drag.moved = true;
    const bounds = event.currentTarget.getBoundingClientRect();
    const box = {
      left: Math.min(drag.x, event.clientX),
      right: Math.max(drag.x, event.clientX),
      top: Math.min(drag.y, event.clientY),
      bottom: Math.max(drag.y, event.clientY),
    };
    setMarquee({
      left: box.left - bounds.left,
      top: box.top - bounds.top,
      width: box.right - box.left,
      height: box.bottom - box.top,
    });
    const clips = [
      ...event.currentTarget.querySelectorAll<HTMLElement>('[data-ppt-animation-clip]'),
    ].map((clip) => ({
      id: clip.dataset.pptAnimationClip!,
      ...(() => {
        const rect = clip.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      })(),
    }));
    setSelectedIds(
      new Set([...(drag.additive ? drag.initial : []), ...pptTimelineMarqueeIds(box, clips)]),
    );
  };
  const endMarquee = (event: React.PointerEvent<HTMLDivElement>, cancel = false) => {
    const drag = marqueeRef.current;
    if (!drag) return;
    marqueeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancel) setSelectedIds(drag.initial);
    suppressMarqueeClickRef.current = drag.moved;
    setMarquee(null);
  };
  const beginClipDrag = (event: React.PointerEvent<HTMLSpanElement>, item: PptObjectAnimation) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget
      .closest<HTMLElement>('[data-ppt-timeline-tracks]')
      ?.focus({ preventScroll: true });
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
      mode:
        ((event.target as HTMLElement).closest<HTMLElement>('[data-ppt-animation-resize]')?.dataset
          .pptAnimationResize as 'left' | 'right' | undefined) || 'move',
      id: item.id,
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
    setDragPreview(
      drag.mode === 'move'
        ? movePptTimelineAnimations(drag.animations, drag.ids, drag.deltaMs)
        : resizePptTimelineAnimation(drag.animations, drag.id, drag.mode, drag.deltaMs),
    );
  };
  const endClipDrag = (event: React.PointerEvent<HTMLSpanElement>, cancel = false) => {
    const drag = clipDragRef.current;
    clipDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDragPreview(null);
    suppressClipClickRef.current = Boolean(drag?.moved);
    if (!cancel && drag?.moved) {
      if (drag.mode === 'move') onMoveAnimations(drag.ids, drag.deltaMs);
      else onResizeAnimation(drag.id, drag.mode, drag.deltaMs);
    }
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
      width: `max(24px, ${((visibleEnd - visibleStart) / viewportDurationMs) * 100}%)`,
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
          <span>{copy.dragAnimationDelay}</span>
          {deletableSelectedIds.length ? (
            <button
              type="button"
              className="ppt-mini-button ml-auto text-rose-500"
              onClick={() => {
                onDeleteAnimations(deletableSelectedIds);
                setSelectedIds(new Set());
              }}
            >
              {copy.delete} ({deletableSelectedIds.length})
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
                <div
                  className="relative select-none space-y-1.5 pb-3 pt-2 outline-none"
                  data-ppt-timeline-tracks
                  tabIndex={0}
                  aria-label={copy.animation}
                  onPointerDownCapture={beginMarquee}
                  onPointerMove={updateMarquee}
                  onPointerUp={(event) => endMarquee(event)}
                  onPointerCancel={(event) => endMarquee(event, true)}
                  onClickCapture={(event) => {
                    if (suppressMarqueeClickRef.current) {
                      suppressMarqueeClickRef.current = false;
                      event.stopPropagation();
                      event.preventDefault();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.key === 'Delete' || event.key === 'Backspace') &&
                      deletableSelectedIds.length
                    ) {
                      event.preventDefault();
                      onDeleteAnimations(deletableSelectedIds);
                      setSelectedIds(new Set());
                    }
                  }}
                >
                  {marquee ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute z-40 border border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]"
                      style={marquee}
                    />
                  ) : null}
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
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_20px] items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => selectClip(event, item)}
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
                        {canDeletePptTimelineAnimation(item) ? (
                          <button
                            type="button"
                            className="grid h-5 w-5 place-items-center rounded text-rose-500 hover:bg-rose-500/10"
                            title={copy.delete}
                            aria-label={`${copy.delete} ${copy.animation} ${index + 1}`}
                            onClick={() => onDelete(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        ) : (
                          <span aria-hidden="true" />
                        )}
                      </div>
                      <button
                        type="button"
                        data-ppt-timeline-track={item.id}
                        aria-pressed={selectedIds.has(item.id)}
                        onClick={(event) => {
                          if (suppressClipClickRef.current) {
                            suppressClipClickRef.current = false;
                            return;
                          }
                          if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                          setSelectedIds(new Set([item.id]));
                          onSelect(item);
                        }}
                        className={`relative h-8 overflow-hidden rounded border text-left ${selectedIds.has(item.id) ? 'ring-2 ring-[var(--vr-accent)]' : ''} ${
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
                          className={`absolute inset-y-1 cursor-grab touch-none overflow-hidden rounded active:cursor-grabbing ${phaseMarkerClass(item)} text-white`}
                          onPointerDown={(event) => beginClipDrag(event, item)}
                          onPointerMove={moveClipDrag}
                          onPointerUp={(event) => endClipDrag(event)}
                          onPointerCancel={(event) => endClipDrag(event, true)}
                          style={clipStyle(starts[index], item.durationMs)}
                        >
                          {starts[index] >= viewportStartMs ? (
                            <span
                              data-ppt-animation-resize="left"
                              className="absolute inset-y-0 left-0 z-30 flex w-2 cursor-ew-resize items-center justify-center bg-black/10 hover:bg-black/25"
                              title={copy.resizeAnimationStart}
                            >
                              <i className="h-3 w-0.5 rounded bg-white/90" />
                            </span>
                          ) : null}
                          {starts[index] + item.durationMs <=
                          viewportStartMs + viewportDurationMs ? (
                            <span
                              data-ppt-animation-resize="right"
                              className="absolute inset-y-0 right-0 z-30 flex w-2 cursor-ew-resize items-center justify-center bg-black/10 hover:bg-black/25"
                              title={copy.resizeAnimationEnd}
                            >
                              <i className="h-3 w-0.5 rounded bg-white/90" />
                            </span>
                          ) : null}
                          <span className="absolute inset-x-1 bottom-1 grid h-1.5 grid-cols-8 gap-px opacity-65">
                            {Array.from({ length: 8 }, (_, frame) => (
                              <i
                                key={frame}
                                className="rounded-sm bg-white/80"
                                style={animationFrameStyle(item, frame)}
                              />
                            ))}
                          </span>
                          <strong className="relative z-10 block truncate px-3 text-[10px] leading-5 text-white">
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
                  {canDeletePptTimelineAnimation(item) ? (
                    <div className="mt-2 flex justify-end gap-1">
                      <button
                        type="button"
                        className="ppt-mini-button text-rose-500"
                        onClick={() => onDelete(item.id)}
                      >
                        {copy.delete}
                      </button>
                    </div>
                  ) : null}
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
