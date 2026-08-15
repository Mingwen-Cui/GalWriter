import {
  Clock3,
  Info,
  ListOrdered,
  Pause,
  Play,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useRef, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { RenderObjectInspector } from '../video/objectInspector/RenderObjectInspector';
import type {
  PptAnimationDirection,
  PptAnimationStart,
  PptExportSettings,
  PptManualElement,
  PptManualSlide,
  PptObjectAnimation,
  PptSlideBackgroundStyle,
  PptTextBoxLayout,
  PptTextOverrideTarget,
  RenderStyle,
  WebExportSettings,
} from '../video/shared/types';
import { targetLabel } from './pptAnimationLabels';
import { usePptCopy } from './pptCopyContext';
import { PptCoverTextInspector } from './PptCoverTextInspector';
import { PptManualInspector } from './PptManualInspector';
import { PptSlideBackgroundInspector } from './PptSlideBackgroundInspector';
import type { Selection, VideoTimelineTrack } from './PptWorkspace';
import { directionLabel, effectLabel, startLabel } from './PptWorkspace';
import type { PptWorkspaceSidebarTab } from './pptWorkspaceModel';

type SidebarTab = PptWorkspaceSidebarTab;

export function PptSidebar({
  language,
  renderStyle,
  updateRenderStyle,
  activeTab,
  setActiveTab,
  selected: _selected,
  animation: _animation,
  animations,
  videoTrack,
  playheadMs,
  onPlayheadChange,
  pptSettings,
  updatePptSettings,
  onSelectAnimation,
  onSelectVideo,
  onMove,
  onDelete,
  onPreview,
  previewing,
  onPausePreview,
  onUpdate: _onUpdate,
  manualSlide,
  selectedManualElementId,
  coverTextBox,
  slides,
  backgroundSelected,
  currentSlideBackground,
  webSettings,
  onUpdateSlideBackground,
  onUpdateSlideBackgroundColor,
  onUpdateManualElement,
  onDeleteManualElement,
  onUpdateCoverText,
  onUpdateCoverTextBoxLayout,
}: {
  language: Language;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  selected: Selection | null;
  animation?: PptObjectAnimation;
  animations: PptObjectAnimation[];
  videoTrack?: VideoTimelineTrack;
  playheadMs: number;
  onPlayheadChange: (milliseconds: number) => void;
  pptSettings: PptExportSettings;
  updatePptSettings: (patch: Partial<PptExportSettings>) => void;
  onSelectAnimation: (animation: PptObjectAnimation) => void;
  onSelectVideo: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
  onPreview: () => void;
  previewing: boolean;
  onPausePreview: () => void;
  onUpdate: (patch: Partial<PptObjectAnimation>) => void;
  manualSlide?: PptManualSlide;
  selectedManualElementId?: string;
  coverTextBox?: {
    target: Extract<PptTextOverrideTarget, 'cover-title' | 'cover-subtitle' | 'cover-description'>;
    label: string;
    text: string;
    layout: PptTextBoxLayout;
  };
  slides: Array<{ id: string; title: string }>;
  backgroundSelected: boolean;
  currentSlideBackground: PptSlideBackgroundStyle;
  webSettings: WebExportSettings;
  onUpdateSlideBackground: (patch: Partial<PptSlideBackgroundStyle>) => void;
  onUpdateSlideBackgroundColor: (color: string) => void;
  onUpdateManualElement: (elementId: string, patch: Partial<PptManualElement>) => void;
  onDeleteManualElement: (elementId: string) => void;
  onUpdateCoverText: (
    target: Extract<PptTextOverrideTarget, 'cover-title' | 'cover-subtitle' | 'cover-description'>,
    text: string,
  ) => void;
  onUpdateCoverTextBoxLayout: (
    target: Extract<PptTextOverrideTarget, 'cover-title' | 'cover-subtitle' | 'cover-description'>,
    patch: Partial<PptTextBoxLayout>,
  ) => void;
}) {
  const copy = usePptCopy();
  const [animationPage, setAnimationPage] = useState<'details' | 'timeline'>('timeline');
  const [showParameterDescriptions, setShowParameterDescriptions] = useState(false);
  const selectAnimation = (item: PptObjectAnimation) => {
    onSelectAnimation(item);
  };
  const tabs = [
    { id: 'timeline', label: copy.animation, icon: ListOrdered },
    { id: 'style', label: copy.design, icon: Settings2 },
  ] as const;
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const showDescriptionToggle = activeTab === 'style';
  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-[var(--vr-border)] bg-[var(--vr-surface-strong)]">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--vr-border)] px-4 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
        <div className="flex min-w-0 items-center gap-2">
          <activeTabConfig.icon className="h-4 w-4 shrink-0 text-[var(--vr-accent)]" />
          <span className="truncate">{activeTabConfig.label}</span>
          {showDescriptionToggle ? (
            <button
              type="button"
              onClick={() => setShowParameterDescriptions((current) => !current)}
              className={`ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                showParameterDescriptions
                  ? 'bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]'
                  : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
              }`}
              title={
                showParameterDescriptions
                  ? copy.hideParameterDescriptions
                  : copy.showParameterDescriptions
              }
              aria-label={
                showParameterDescriptions
                  ? copy.hideParameterDescriptions
                  : copy.showParameterDescriptions
              }
              aria-pressed={showParameterDescriptions}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex h-8 shrink-0 rounded-lg bg-[var(--vr-surface-soft)] p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-black transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                  : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
              }`}
              title={tab.label}
              aria-label={tab.label}
              aria-pressed={activeTab === tab.id}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === 'timeline' ? (
          <>
            <div className="flex overflow-hidden rounded-xl border border-[var(--vr-border)] bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setAnimationPage('timeline')}
                className={`relative z-10 h-8 min-w-0 flex-1 rounded-lg px-3 text-[11px] font-black transition-colors ${animationPage === 'timeline' ? 'bg-[var(--vr-accent)] text-white shadow-sm' : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'}`}
                aria-pressed={animationPage === 'timeline'}
              >
                时间轴
              </button>
              <button
                type="button"
                onClick={() => setAnimationPage('details')}
                className={`relative z-10 h-8 min-w-0 flex-1 rounded-lg px-3 text-[11px] font-black transition-colors ${animationPage === 'details' ? 'bg-[var(--vr-accent)] text-white shadow-sm' : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'}`}
                aria-pressed={animationPage === 'details'}
              >
                动画详情
              </button>
            </div>
            <div className="mt-3">
              {animationPage === 'timeline' ? (
                <AnimationTimeline
                  mode="overview"
                  animations={animations}
                  videoTrack={videoTrack}
                  playheadMs={playheadMs}
                  onPlayheadChange={onPlayheadChange}
                  onSelect={selectAnimation}
                  onSelectVideo={onSelectVideo}
                  onMove={onMove}
                  onDelete={onDelete}
                  onPreview={onPreview}
                  previewing={previewing}
                  onPausePreview={onPausePreview}
                />
              ) : (
                <AnimationTimeline
                  mode="list"
                  animations={animations}
                  videoTrack={videoTrack}
                  playheadMs={playheadMs}
                  onPlayheadChange={onPlayheadChange}
                  onSelect={selectAnimation}
                  onSelectVideo={onSelectVideo}
                  onMove={onMove}
                  onDelete={onDelete}
                  onPreview={onPreview}
                  previewing={previewing}
                  onPausePreview={onPausePreview}
                />
              )}
            </div>
          </>
        ) : null}
        {activeTab === 'style' ? (
          backgroundSelected ? (
            <PptSlideBackgroundInspector
              language={language}
              webSettings={webSettings}
              pptSettings={pptSettings}
              background={currentSlideBackground}
              showDescriptions={showParameterDescriptions}
              onUpdateBackground={onUpdateSlideBackground}
              onUpdatePptSettings={updatePptSettings}
            />
          ) : manualSlide ? (
            <PptManualInspector
              copy={copy}
              language={language}
              slide={manualSlide}
              selectedElementId={selectedManualElementId}
              slides={slides}
              showDescriptions={showParameterDescriptions}
              onUpdateBackgroundColor={onUpdateSlideBackgroundColor}
              onUpdateElement={onUpdateManualElement}
              onDeleteElement={onDeleteManualElement}
            />
          ) : coverTextBox ? (
            <PptCoverTextInspector
              target={coverTextBox.target}
              text={coverTextBox.text}
              layout={coverTextBox.layout}
              language={language}
              showDescriptions={showParameterDescriptions}
              onUpdateText={onUpdateCoverText}
              onUpdateLayout={onUpdateCoverTextBoxLayout}
            />
          ) : (
            <>
              <RenderObjectInspector
                language={language}
                renderStyle={renderStyle}
                updateRenderStyle={updateRenderStyle}
                surface="web"
                hideObjectSelector
                showDescriptions={showParameterDescriptions}
              />
            </>
          )
        ) : null}
      </div>
    </aside>
  );
}
function AnimationTimeline({
  mode,
  animations,
  videoTrack,
  playheadMs,
  onPlayheadChange,
  onSelect,
  onSelectVideo,
  onMove,
  onDelete,
  onPreview,
  previewing,
  onPausePreview,
}: {
  mode: 'overview' | 'list';
  animations: PptObjectAnimation[];
  videoTrack?: VideoTimelineTrack;
  playheadMs: number;
  onPlayheadChange: (milliseconds: number) => void;
  onSelect: (animation: PptObjectAnimation) => void;
  onSelectVideo: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
  onPreview: () => void;
  previewing: boolean;
  onPausePreview: () => void;
}) {
  const copy = usePptCopy();
  const starts = animations.reduce<number[]>((values, item, index) => {
    const previousStart = values[index - 1] || 0;
    const previous = animations[index - 1];
    const start =
      item.start === 'withPrevious'
        ? previousStart + item.delayMs
        : previousStart + (previous?.durationMs || 0) + item.delayMs;
    values.push(start);
    return values;
  }, []);
  const totalMs = Math.max(
    1000,
    videoTrack?.durationMs || 0,
    ...animations.map((item, index) => starts[index] + item.durationMs),
  );
  const hasTracks = Boolean(videoTrack) || animations.length > 0;
  const timelineDurationMs = Math.max(3000, Math.ceil(totalMs / 1000) * 1000);
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
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
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
      {isOverview ? (
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-[var(--vr-text)]">{copy.animation}</h2>
          </div>
          <button
            type="button"
            onClick={previewing ? onPausePreview : onPreview}
            className="render-icon-button"
            title={previewing ? '暂停预览' : copy.playCurrentSlide}
          >
            {previewing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
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
                <div className="grid grid-cols-[84px_minmax(0,1fr)_42px] gap-2">
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
                  <div />
                </div>
                <div className="relative space-y-1.5 pt-2">
                  <span className="pointer-events-none absolute bottom-0 left-[92px] right-[50px] top-0 z-20">
                    <span
                      className="absolute inset-y-0 w-0.5 bg-[var(--vr-accent)]/90 shadow-[0_0_0_1px_rgba(255,255,255,0.7)]"
                      style={{ left: `${playheadPercent}%` }}
                    />
                  </span>
                  {videoTrack ? (
                    <div className="grid grid-cols-[84px_minmax(0,1fr)_42px] items-center gap-2">
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
                      <div />
                    </div>
                  ) : null}
                  {animations.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[84px_minmax(0,1fr)_42px] items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        className="flex min-w-0 items-center gap-1.5 text-left text-[11px] font-bold text-[var(--vr-text)]"
                        title={effectLabel(copy, item.effect)}
                        aria-label={`${copy[item.phase || 'enter']} · ${effectLabel(copy, item.effect)}`}
                      >
                        <span>{index + 1}.</span>
                        <span
                          aria-hidden="true"
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${phaseMarkerClass(item)}`}
                        />
                        <span className="truncate">{effectLabel(copy, item.effect)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        className={`relative h-8 overflow-hidden rounded border text-left ${
                          playheadMs >= starts[index] &&
                          playheadMs <= starts[index] + item.durationMs
                            ? phaseActiveClass(item)
                            : 'border-transparent bg-[var(--vr-border)]'
                        }`}
                        title={`${startLabel(copy, item.start)} · ${(item.durationMs / 1000).toFixed(1)} ${copy.seconds}`}
                      >
                        <span
                          className={`absolute inset-y-1 overflow-hidden rounded ${phaseMarkerClass(item)} text-white`}
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
                            {effectLabel(copy, item.effect)}
                          </strong>
                        </span>
                      </button>
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          className="ppt-mini-button"
                          onClick={() => onMove(item.id, -1)}
                          disabled={
                            item.source === 'tag' ||
                            index === 0 ||
                            animations[index - 1]?.source === 'tag'
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="ppt-mini-button"
                          onClick={() => onMove(item.id, 1)}
                          disabled={
                            item.source === 'tag' ||
                            index === animations.length - 1 ||
                            animations[index + 1]?.source === 'tag'
                          }
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  ref={navigatorRef}
                  className="relative ml-[94px] mr-[44px] mt-4 h-3 rounded-full bg-[var(--vr-border)]"
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
                        {effectLabel(copy, item.effect)} · {targetLabel(copy, item)}
                      </strong>
                      <small className="mt-1 block text-[10px] text-[var(--vr-text-muted)]">
                        {startLabel(copy, item.start)} · {directionLabel(copy, item.direction)} ·{' '}
                        {(item.durationMs / 1000).toFixed(1)} {copy.seconds}
                      </small>
                    </span>
                  </button>
                  <div className="mt-2 flex justify-end gap-1">
                    <button
                      type="button"
                      className="ppt-mini-button text-rose-500"
                      onClick={() => onDelete(item.id)}
                      disabled={item.source === 'tag'}
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
          {copy.noAnimationsHint}
        </div>
      )}
    </>
  );
}
function _ObjectProperties({
  selected,
  animation,
  onUpdate,
}: {
  selected: Selection | null;
  animation?: PptObjectAnimation;
  onUpdate: (patch: Partial<PptObjectAnimation>) => void;
}) {
  const copy = usePptCopy();
  if (!selected)
    return (
      <div className="rounded-lg border border-dashed border-[var(--vr-border)] px-4 py-8 text-center text-xs leading-5 text-[var(--vr-text-muted)]">
        {copy.selectedObjectHint}
      </div>
    );
  return (
    <>
      <div className="mb-5 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-black text-[var(--vr-text)]">{selected.label}</h2>
          <p className="text-xs text-[var(--vr-text-muted)]">
            {animation ? effectLabel(copy, animation.effect) : copy.noAnimationAdded}
          </p>
        </div>
      </div>
      {animation?.source === 'tag' ? (
        <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 text-xs leading-5 text-[var(--vr-text-muted)]">
          <strong className="block text-[var(--vr-text)]">由剧情标签驱动</strong>
          {startLabel(copy, animation.start)} · {effectLabel(copy, animation.effect)} ·{' '}
          {(animation.durationMs / 1000).toFixed(1)} {copy.seconds}
          <p className="mt-1">
            此处只展示该标签对应的 PPT 动画；编辑标签后，时间轴和导出会自动同步。
          </p>
        </div>
      ) : (
        <>
          <label className="mb-4 block text-xs font-bold text-[var(--vr-text-muted)]">
            {copy.start}
            <select
              value={animation?.start || 'onClick'}
              onChange={(event) => onUpdate({ start: event.target.value as PptAnimationStart })}
              className="render-field mt-1.5 w-full"
            >
              <option value="onClick">{copy.onClick}</option>
              <option value="withPrevious">{copy.withPrevious}</option>
              <option value="afterPrevious">{copy.afterPrevious}</option>
            </select>
          </label>
          <label className="mb-4 block text-xs font-bold text-[var(--vr-text-muted)]">
            {copy.effectOptions}
            <select
              value={animation?.direction || 'left'}
              onChange={(event) =>
                onUpdate({ direction: event.target.value as PptAnimationDirection })
              }
              className="render-field mt-1.5 w-full"
            >
              <option value="left">{copy.fromLeft}</option>
              <option value="right">{copy.fromRight}</option>
              <option value="up">{copy.fromTop}</option>
              <option value="down">{copy.fromBottom}</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-[var(--vr-text-muted)]">
              {copy.duration}
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={(animation?.durationMs || 500) / 1000}
                onChange={(event) =>
                  onUpdate({
                    durationMs: Math.round(Math.max(0.1, Number(event.target.value || 0.5)) * 1000),
                  })
                }
                className="render-field mt-1.5 w-full"
              />
            </label>
            <label className="text-xs font-bold text-[var(--vr-text-muted)]">
              {copy.delay}
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={(animation?.delayMs || 0) / 1000}
                onChange={(event) =>
                  onUpdate({
                    delayMs: Math.round(Math.max(0, Number(event.target.value || 0)) * 1000),
                  })
                }
                className="render-field mt-1.5 w-full"
              />
            </label>
          </div>
          <div className="mt-6 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 text-xs leading-5 text-[var(--vr-text-muted)]">
            <Clock3 className="mr-1 inline h-3.5 w-3.5" />
            {copy.animationPersistenceHint}
          </div>
        </>
      )}
    </>
  );
}
export function NotesPanel({
  height,
  onResizeStart,
  value,
  onChange,
}: {
  height: number;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <section
      className="relative shrink-0 border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)]"
      style={{ height }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={onResizeStart}
        className="absolute inset-x-0 top-0 z-10 h-2 -translate-y-1/2 cursor-row-resize before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-[var(--vr-border)] hover:before:border-[var(--vr-accent)]"
      />
      <textarea
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder="单击此处添加备注"
        className="h-full w-full resize-none bg-transparent px-4 py-3 text-base leading-7 text-[var(--vr-text)] outline-none placeholder:text-[var(--vr-text-muted)]"
      />
    </section>
  );
}
