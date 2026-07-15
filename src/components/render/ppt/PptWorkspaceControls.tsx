import { Eye, MousePointer2, Presentation, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { VirtualPresentationStage } from '../../VirtualPresentationStage';
import type {
  PptAnimationDirection,
  PptAnimationEffect,
  PptAnimationPhase,
  PptAnimationStart,
  PptManualSlide,
  PptObjectAnimation,
  PptSlideTransition,
  RenderStyle,
  WebExportSettings,
} from '../video/shared/types';
import { usePptCopy } from './pptCopyContext';
import { pptSceneColors } from './pptSceneResolver';
import type { Scene, Selection, SlideItem } from './PptWorkspace';
import {
  DEFAULT_TRANSITION,
  EMPHASIS_EFFECTS,
  PHASES,
  SlideCanvas,
  TRANSITIONS,
} from './PptWorkspace';
import {
  PPT_CONTENT_HEIGHT,
  PPT_CONTENT_WIDTH,
  type PptCanvasLayout,
  pptCanvasViewportClass,
} from './pptWorkspaceModel';

export function AnimationRibbon({
  activeTab,
  selected,
  phase,
  setPhase,
  animation,
  onApply,
  onPreview,
  onUpdate,
  transition,
  onUpdateTransition,
  onApplyTransitionToAll,
}: {
  activeTab: 'animation' | 'transition';
  selected: Selection | null;
  phase: PptAnimationPhase;
  setPhase: (phase: PptAnimationPhase) => void;
  animation?: PptObjectAnimation;
  onApply: (effect: PptAnimationEffect) => void;
  onPreview: () => void;
  onUpdate: (patch: Partial<PptObjectAnimation>) => void;
  transition: PptSlideTransition;
  onUpdateTransition: (patch: Partial<PptSlideTransition>) => void;
  onApplyTransitionToAll: () => void;
}) {
  const copy = usePptCopy();
  const disabled = !selected;
  return (
    <header className="ppt-ribbon-shell">
      {activeTab === 'transition' ? (
        <TransitionControls
          transition={transition}
          onPreview={onPreview}
          onUpdate={onUpdateTransition}
          onApplyToAll={onApplyTransitionToAll}
        />
      ) : (
        <div className="ppt-ribbon">
          <RibbonGroup label={copy.preview}>
            <button type="button" onClick={onPreview} className="ppt-ribbon-action">
              <Eye className="h-5 w-5" />
              <span>{copy.preview}</span>
            </button>
          </RibbonGroup>
          <RibbonGroup label={copy.animation}>
            <div className="flex gap-1">
              {PHASES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPhase(item.value)}
                  className={`ppt-effect-button min-w-[54px] ${phase === item.value ? 'is-active' : ''}`}
                >
                  <span>{copy[item.key]}</span>
                </button>
              ))}
            </div>
          </RibbonGroup>
          <RibbonGroup
            label={
              phase === 'emphasis'
                ? copy.emphasisEffects
                : phase === 'enter'
                  ? copy.entrancePath
                  : copy.exitPath
            }
          >
            <div className="flex gap-1">
              {phase === 'emphasis' ? (
                EMPHASIS_EFFECTS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onApply(item.value)}
                    className={`ppt-effect-button min-w-[60px] ${animation?.effect === item.value ? 'is-active' : ''}`}
                  >
                    <span className="text-lg leading-none">{item.glyph}</span>
                    <span>{copy[item.key]}</span>
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onApply('line')}
                  className={`ppt-effect-button min-w-[72px] ${animation?.effect === 'line' ? 'is-active' : ''}`}
                >
                  <span className="text-lg leading-none">↔</span>
                  <span>{copy.line}</span>
                </button>
              )}
            </div>
          </RibbonGroup>
          <RibbonGroup label={copy.effectOptions}>
            <select
              disabled={disabled || phase === 'emphasis'}
              value={animation?.direction || 'left'}
              onChange={(event) =>
                onUpdate({ direction: event.target.value as PptAnimationDirection })
              }
              className="render-field min-w-24 text-xs"
            >
              <option value="left">{copy.fromLeft}</option>
              <option value="right">{copy.fromRight}</option>
              <option value="up">{copy.fromTop}</option>
              <option value="down">{copy.fromBottom}</option>
            </select>
          </RibbonGroup>
          <RibbonGroup label={copy.addAnimation}>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onApply(animation?.effect || (phase === 'emphasis' ? 'pulse' : 'line'))
              }
              className="ppt-ribbon-action"
            >
              <Sparkles className="h-5 w-5" />
              <span>{copy.addAnimation}</span>
            </button>
            <button type="button" className="ppt-ribbon-action" title={copy.trigger} disabled>
              <MousePointer2 className="h-5 w-5" />
              <span>{copy.trigger}</span>
            </button>
          </RibbonGroup>
          <RibbonGroup label={copy.timing}>
            <div className="grid grid-cols-[auto_84px] items-center gap-x-2 gap-y-1.5 text-[11px] text-[var(--vr-text-muted)]">
              <label>{copy.start}</label>
              <select
                disabled={disabled}
                value={animation?.start || 'onClick'}
                onChange={(event) => onUpdate({ start: event.target.value as PptAnimationStart })}
                className="render-field h-7 text-[11px]"
              >
                <option value="onClick">{copy.onClick}</option>
                <option value="withPrevious">{copy.withPrevious}</option>
                <option value="afterPrevious">{copy.afterPrevious}</option>
              </select>
              <label>{copy.duration}</label>
              <input
                disabled={disabled}
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
                className="render-field h-7 text-[11px]"
              />
              <label>{copy.delay}</label>
              <input
                disabled={disabled}
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
                className="render-field h-7 text-[11px]"
              />
            </div>
          </RibbonGroup>
        </div>
      )}
    </header>
  );
}
function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="relative flex min-w-max items-center gap-2 border-r border-[var(--vr-border)] px-3 pb-5 pt-2 last:border-r-0">
      <div className="absolute inset-x-0 bottom-1 text-center text-[10px] font-medium text-[var(--vr-text-muted)]">
        {label}
      </div>
      {children}
    </section>
  );
}
function TransitionControls({
  transition,
  onPreview,
  onUpdate,
  onApplyToAll,
}: {
  transition: PptSlideTransition;
  onPreview: () => void;
  onUpdate: (patch: Partial<PptSlideTransition>) => void;
  onApplyToAll: () => void;
}) {
  const copy = usePptCopy();
  return (
    <div className="ppt-ribbon">
      <RibbonGroup label={copy.preview}>
        <button type="button" onClick={onPreview} className="ppt-ribbon-action">
          <Eye className="h-5 w-5" />
          <span>{copy.preview}</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label={copy.transitionToSlide}>
        <div className="flex gap-1">
          {TRANSITIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onUpdate({ effect: item.value })}
              className={`ppt-effect-button min-w-[62px] ${transition.effect === item.value ? 'is-active' : ''}`}
            >
              <span className="text-lg leading-none">{item.glyph}</span>
              <span>{copy[item.key]}</span>
            </button>
          ))}
        </div>
      </RibbonGroup>
      <RibbonGroup label={copy.effectOptions}>
        <select
          disabled={transition.effect === 'none' || transition.effect === 'fade'}
          value={transition.direction}
          onChange={(event) => onUpdate({ direction: event.target.value as PptAnimationDirection })}
          className="render-field min-w-24 text-xs"
        >
          <option value="left">{copy.fromLeft}</option>
          <option value="right">{copy.fromRight}</option>
          <option value="up">{copy.fromTop}</option>
          <option value="down">{copy.fromBottom}</option>
        </select>
      </RibbonGroup>
      <RibbonGroup label={copy.timing}>
        <div className="grid grid-cols-[auto_94px] items-center gap-x-2 gap-y-1.5 text-[11px] text-[var(--vr-text-muted)]">
          <label>{copy.sound}</label>
          <select disabled className="render-field h-7 text-[11px]">
            <option>{copy.noSound}</option>
          </select>
          <label>{copy.duration}</label>
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={(transition.durationMs / 1000).toFixed(1)}
            onChange={(event) =>
              onUpdate({
                durationMs: Math.round(Math.max(0.1, Number(event.target.value || 0.7)) * 1000),
              })
            }
            className="render-field h-7 text-[11px]"
          />
          <label className="col-span-2 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={transition.advanceOnClick}
              onChange={(event) => onUpdate({ advanceOnClick: event.target.checked })}
            />
            {copy.clickMouse}
          </label>
          <label className="col-span-2 flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={transition.advanceAfterMs !== undefined}
              onChange={(event) =>
                onUpdate({ advanceAfterMs: event.target.checked ? 0 : undefined })
              }
            />
            {copy.autoAdvance}
          </label>
          {transition.advanceAfterMs !== undefined ? (
            <>
              <label>{copy.autoTime}</label>
              <input
                type="number"
                min="0"
                max="3600"
                step="0.1"
                value={(transition.advanceAfterMs / 1000).toFixed(1)}
                onChange={(event) =>
                  onUpdate({ advanceAfterMs: Math.max(0, Number(event.target.value || 0) * 1000) })
                }
                className="render-field h-7 text-[11px]"
              />
            </>
          ) : null}
        </div>
        <button type="button" onClick={onApplyToAll} className="ppt-ribbon-action ml-1">
          <Presentation className="h-5 w-5" />
          <span>{copy.applyAll}</span>
        </button>
      </RibbonGroup>
    </div>
  );
}

function SlideTransitionIndicator({ transition }: { transition?: PptSlideTransition }) {
  const copy = usePptCopy();
  if (!transition || transition.effect === 'none') return null;
  const item = TRANSITIONS.find((entry) => entry.value === transition.effect);
  if (!item) return null;
  const label = copy[item.key];
  return (
    <span
      title={`${copy.transition}: ${label}`}
      aria-label={`${copy.transition}: ${label}`}
      className="grid h-4 w-4 shrink-0 place-items-center text-xs leading-none text-[var(--vr-text-muted)]"
    >
      {item.glyph}
    </span>
  );
}
type ThumbnailProps = {
  slide: SlideItem;
  scenes: Scene[];
  projectName: string;
  webSettings: WebExportSettings;
  renderStyle: RenderStyle;
  colors: ReturnType<typeof pptSceneColors>;
  animations: PptObjectAnimation[];
  transition: PptSlideTransition;
  layout: PptCanvasLayout;
  manualSlides: PptManualSlide[];
};
function SlideThumbnail({
  slide,
  scenes,
  projectName,
  webSettings,
  renderStyle,
  colors,
  animations,
  transition,
  layout,
  manualSlides,
}: ThumbnailProps) {
  const scene = slide.sceneId ? scenes.find((item) => item.id === slide.sceneId) : undefined;
  const manualSlide = slide.manualSlideId
    ? manualSlides.find((item) => item.id === slide.manualSlideId)
    : undefined;
  return (
    <div
      className={`pointer-events-none relative overflow-hidden rounded bg-slate-950 ${pptCanvasViewportClass(layout)}`}
    >
      <VirtualPresentationStage
        fit="contain"
        width={PPT_CONTENT_WIDTH}
        height={PPT_CONTENT_HEIGHT}
        className="absolute inset-0 h-full w-full"
      >
        <SlideCanvas
          selectedId={slide.id}
          isChoiceSlide={slide.kind === 'choice'}
          scene={scene}
          manualSlide={manualSlide}
          projectName={projectName}
          webSettings={webSettings}
          renderStyle={renderStyle}
          colors={colors}
          animations={animations}
          transition={transition}
          selected={null}
          previewing={false}
          onSelect={() => undefined}
        />
      </VirtualPresentationStage>
    </div>
  );
}
export function SlideList({
  slides,
  scenes,
  selectedId,
  timelines,
  transitions,
  projectName,
  webSettings,
  renderStyle,
  colors,
  onSelect,
  layout,
  manualSlides,
}: {
  slides: SlideItem[];
  scenes: Scene[];
  selectedId: string;
  timelines: Record<string, PptObjectAnimation[]>;
  transitions: Record<string, PptSlideTransition>;
  projectName: string;
  webSettings: WebExportSettings;
  renderStyle: RenderStyle;
  colors: ReturnType<typeof pptSceneColors>;
  onSelect: (id: string) => void;
  layout: PptCanvasLayout;
  manualSlides: PptManualSlide[];
}) {
  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-[var(--vr-border)] bg-[var(--vr-surface-strong)] p-3">
      <div className="mb-3 flex items-center gap-2 px-1 text-xs font-black text-[var(--vr-text)]">
        <Presentation className="h-4 w-4 text-[var(--vr-accent-strong)]" />
        幻灯片
      </div>
      <div className="space-y-3">
        {slides.map((slide, index) => (
          <div key={slide.id} className="flex items-start gap-2">
            <div
              className={`flex w-4 shrink-0 flex-col items-center gap-1 pt-0.5 text-sm leading-none ${selectedId === slide.id ? 'text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)]'}`}
            >
              <span>{index + 1}</span>
              <SlideTransitionIndicator transition={transitions[slide.id]} />
            </div>
            <button
              type="button"
              onClick={() => onSelect(slide.id)}
              className={`min-w-0 flex-1 rounded-lg border p-2 text-left transition-colors ${selectedId === slide.id ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] hover:bg-[var(--vr-surface-soft)]'}`}
            >
              <SlideThumbnail
                slide={slide}
                scenes={scenes}
                projectName={projectName}
                webSettings={webSettings}
                renderStyle={renderStyle}
                colors={colors}
                animations={timelines[slide.id] || []}
                transition={transitions[slide.id] || DEFAULT_TRANSITION}
                layout={layout}
                manualSlides={manualSlides}
              />
              {(timelines[slide.id]?.length || 0) > 0 ? (
                <div className="mt-1 text-right text-[10px] font-bold text-[var(--vr-accent-strong)]">
                  {timelines[slide.id].length} 个动画
                </div>
              ) : null}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
export function SlideSorter({
  slides,
  scenes,
  selectedId,
  timelines,
  transitions,
  projectName,
  webSettings,
  renderStyle,
  colors,
  onSelect,
  layout,
  manualSlides,
}: {
  slides: SlideItem[];
  scenes: Scene[];
  selectedId: string;
  timelines: Record<string, PptObjectAnimation[]>;
  transitions: Record<string, PptSlideTransition>;
  projectName: string;
  webSettings: WebExportSettings;
  renderStyle: RenderStyle;
  colors: ReturnType<typeof pptSceneColors>;
  onSelect: (id: string) => void;
  layout: PptCanvasLayout;
  manualSlides: PptManualSlide[];
}) {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-5 lg:grid-cols-3">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => onSelect(slide.id)}
            className={`rounded-xl border p-3 text-left shadow-sm ${selectedId === slide.id ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] bg-[var(--vr-surface-strong)] hover:bg-[var(--vr-surface-soft)]'}`}
          >
            <div className="mb-3 flex items-center gap-1.5">
              <span className="text-xs text-[var(--vr-text-muted)]">{index + 1}</span>
              <SlideTransitionIndicator transition={transitions[slide.id]} />
              {(timelines[slide.id]?.length || 0) > 0 ? (
                <span className="text-xs text-[var(--vr-accent-strong)]">
                  {timelines[slide.id].length} 个动画
                </span>
              ) : null}
            </div>
            <SlideThumbnail
              slide={slide}
              scenes={scenes}
              projectName={projectName}
              webSettings={webSettings}
              renderStyle={renderStyle}
              colors={colors}
              animations={timelines[slide.id] || []}
              transition={transitions[slide.id] || DEFAULT_TRANSITION}
              layout={layout}
              manualSlides={manualSlides}
            />
            <div className="mt-2 truncate text-sm font-black">{slide.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
