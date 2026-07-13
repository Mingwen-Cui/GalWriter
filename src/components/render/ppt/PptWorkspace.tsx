import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import {
  BookOpen, ChevronLeft, ChevronRight, Clock3, Eye, Grid2X2, ListOrdered,
  Maximize2, MonitorPlay, MousePointer2, Play, Presentation, Settings2,
  Sparkles, StickyNote, TimerReset, ZoomIn, ZoomOut,
} from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { pptSceneColors, resolvePptScenes } from './pptSceneResolver';
import { getPptCopy, type PptCopy } from './i18n';
import type { Language } from '../../../lib/i18n';
import type {
  PptAnimationDirection, PptAnimationEffect, PptAnimationStart, PptAnimationTarget,
  PptExportSettings, PptObjectAnimation, PptSlideTransition, PptTransitionEffect, RenderStyle, WebExportSettings,
} from '../video/shared/types';

type ViewMode = 'normal' | 'sorter' | 'reading';
type SidebarTab = 'timeline' | 'properties' | 'export';
type SlideItem = { id: string; title: string };
type Selection = { target: PptAnimationTarget; targetId?: string; label: string };
type Scene = ReturnType<typeof resolvePptScenes>[number];
const PptCopyContext = createContext<PptCopy | null>(null);
const usePptCopy = () => {
  const value = useContext(PptCopyContext);
  if (!value) throw new Error('PptCopyContext is missing.');
  return value;
};

const EFFECTS: Array<{ value: PptAnimationEffect; key: keyof PptCopy; glyph: string }> = [
  { value: 'none', key: 'noAnimation', glyph: '–' }, { value: 'appear', key: 'appear', glyph: '✦' },
  { value: 'fade', key: 'fade', glyph: '◌' }, { value: 'fly', key: 'fly', glyph: '↗' },
  { value: 'float', key: 'float', glyph: '↑' }, { value: 'wipe', key: 'wipe', glyph: '▸' },
  { value: 'zoom', key: 'zoom', glyph: '⌁' },
];
const effectLabel = (copy: PptCopy, effect: PptAnimationEffect) => copy[EFFECTS.find((item) => item.value === effect)?.key || 'noAnimation'];
const startLabel = (copy: PptCopy, start: PptAnimationStart) => copy[start === 'onClick' ? 'onClick' : start === 'withPrevious' ? 'withPrevious' : 'afterPrevious'];
const directionLabel = (copy: PptCopy, direction: PptAnimationDirection) => copy[direction === 'left' ? 'fromLeft' : direction === 'right' ? 'fromRight' : direction === 'up' ? 'fromTop' : 'fromBottom'];
const animationKey = (target: PptAnimationTarget, targetId?: string) => `${target}:${targetId || ''}`;
const DEFAULT_TRANSITION: PptSlideTransition = { effect: 'none', durationMs: 700, direction: 'left', advanceOnClick: true };
const TRANSITIONS: Array<{ value: PptTransitionEffect; key: keyof PptCopy; glyph: string }> = [
  { value: 'none', key: 'none', glyph: '□' }, { value: 'smooth', key: 'smooth', glyph: '◇' },
  { value: 'fade', key: 'fadeTransition', glyph: '◌' }, { value: 'push', key: 'push', glyph: '⇢' },
  { value: 'wipe', key: 'wipe', glyph: '▸' }, { value: 'split', key: 'split', glyph: '⇆' },
  { value: 'reveal', key: 'reveal', glyph: '▣' }, { value: 'cut', key: 'cut', glyph: '▰' },
  { value: 'randomBars', key: 'randomBars', glyph: '▥' },
];

type Props = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  language: Language;
  projectName: string;
  webSettings: WebExportSettings;
  renderStyle: RenderStyle;
  pptSettings: PptExportSettings;
  updatePptSettings: (patch: Partial<PptExportSettings>) => void;
  ribbonTab: 'animation' | 'transition';
};

export function PptWorkspace({ nodes, edges, language, projectName, webSettings, renderStyle, pptSettings, updatePptSettings, ribbonTab }: Props) {
  const copy = getPptCopy(language);
  const scenes = useMemo(() => resolvePptScenes(nodes, edges, webSettings), [nodes, edges, webSettings]);
  const slides = useMemo<SlideItem[]>(() => [
    ...(pptSettings.includeCover ? [{ id: 'cover', title: projectName || copy.untitled }] : []),
    ...scenes.map((scene) => ({ id: scene.id, title: scene.title })),
  ], [pptSettings.includeCover, projectName, scenes]);
  const [selectedId, setSelectedId] = useState(() => slides[0]?.id || 'cover');
  const [selectedObject, setSelectedObject] = useState<Selection | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('timeline');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesHeight, setNotesHeight] = useState(150);
  const [zoom, setZoom] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<number | null>(null);
  const selectedIndex = Math.max(0, slides.findIndex((slide) => slide.id === selectedId));
  const scene = selectedId === 'cover' ? undefined : scenes.find((item) => item.id === selectedId) || scenes[0];
  const colors = pptSceneColors(renderStyle, webSettings);
  const animations = pptSettings.animations || {};
  const transitions = pptSettings.transitions || {};
  const currentAnimations = animations[selectedId] || [];
  const currentTransition = transitions[selectedId] || DEFAULT_TRANSITION;

  useEffect(() => {
    if (!slides.some((slide) => slide.id === selectedId)) setSelectedId(slides[0]?.id || 'cover');
  }, [selectedId, slides]);
  useEffect(() => () => { if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current); }, []);

  const selectSlide = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedObject(null);
    setSidebarTab('timeline');
    setIsPreviewing(false);
  }, []);
  const selectIndex = useCallback((index: number) => selectSlide(slides[Math.max(0, Math.min(slides.length - 1, index))]?.id || 'cover'), [selectSlide, slides]);
  const next = useCallback(() => selectIndex(selectedIndex + 1), [selectIndex, selectedIndex]);
  const previous = useCallback(() => selectIndex(selectedIndex - 1), [selectIndex, selectedIndex]);
  const selectObject = (selection: Selection) => {
    setSelectedObject(selection);
    setSidebarTab('properties');
  };
  const replaceTimeline = (nextTimeline: PptObjectAnimation[]) => {
    updatePptSettings({ animations: { ...animations, [selectedId]: nextTimeline } });
  };
  const updateTransition = (patch: Partial<PptSlideTransition>) => {
    updatePptSettings({ transitions: { ...transitions, [selectedId]: { ...currentTransition, ...patch } } });
  };
  const applyTransitionToAll = () => {
    updatePptSettings({ transitions: Object.fromEntries(slides.map((slide) => [slide.id, { ...currentTransition }])) });
  };
  const getAnimation = (selection = selectedObject) => selection
    ? currentAnimations.find((item) => animationKey(item.target, item.targetId) === animationKey(selection.target, selection.targetId))
    : undefined;
  const updateSelectedAnimation = (patch: Partial<PptObjectAnimation>) => {
    if (!selectedObject) return;
    const existing = getAnimation(selectedObject);
    const base: PptObjectAnimation = existing || {
      id: `${selectedId}-${animationKey(selectedObject.target, selectedObject.targetId)}`,
      target: selectedObject.target,
      targetId: selectedObject.targetId,
      effect: 'fade',
      start: currentAnimations.length ? 'afterPrevious' : 'onClick',
      durationMs: 500,
      delayMs: 0,
      direction: 'left',
    };
    const next = { ...base, ...patch };
    replaceTimeline(existing ? currentAnimations.map((item) => item.id === existing.id ? next : item) : [...currentAnimations, next]);
  };
  const applyEffect = (effect: PptAnimationEffect) => {
    if (!selectedObject) return;
    const existing = getAnimation();
    if (effect === 'none') {
      if (existing) replaceTimeline(currentAnimations.filter((item) => item.id !== existing.id));
      return;
    }
    updateSelectedAnimation({ effect });
  };
  const moveAnimation = (id: string, direction: -1 | 1) => {
    const index = currentAnimations.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= currentAnimations.length) return;
    const nextTimeline = [...currentAnimations];
    [nextTimeline[index], nextTimeline[target]] = [nextTimeline[target], nextTimeline[index]];
    replaceTimeline(nextTimeline);
  };
  const preview = () => {
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    setIsPreviewing(false);
    window.requestAnimationFrame(() => setIsPreviewing(true));
    const duration = currentAnimations.reduce((total, item) => total + item.durationMs + item.delayMs, 0) + 600;
    previewTimerRef.current = window.setTimeout(() => setIsPreviewing(false), Math.max(1000, duration));
  };
  const playFromStart = () => { selectIndex(0); setIsPlaying(true); };
  const closePlayer = async () => { if (document.fullscreenElement) await document.exitFullscreen(); setIsPlaying(false); };

  useEffect(() => {
    if (!isPlaying && viewMode !== 'reading') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(event.key) && (!isPlaying || currentTransition.advanceOnClick)) { event.preventDefault(); next(); }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); previous(); }
      if (event.key === 'Home') { event.preventDefault(); selectIndex(0); }
      if (event.key === 'End') { event.preventDefault(); selectIndex(slides.length - 1); }
      if (event.key === 'Escape' && isPlaying) void closePlayer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentTransition.advanceOnClick, isPlaying, next, previous, selectIndex, slides.length, viewMode]);
  useEffect(() => {
    if (!isPlaying || currentTransition.advanceAfterMs === undefined) return;
    const timeout = window.setTimeout(next, Math.max(0, currentTransition.advanceAfterMs));
    return () => window.clearTimeout(timeout);
  }, [currentTransition.advanceAfterMs, isPlaying, next, selectedId]);
  useEffect(() => {
    if (!isPlaying || document.fullscreenElement) return;
    playerRef.current?.requestFullscreen().catch(() => { /* Fullscreen is optional. */ });
  }, [isPlaying]);
  useEffect(() => {
    const onFullscreenChange = () => { if (!document.fullscreenElement) setIsPlaying(false); };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  const startNotesResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = notesHeight;
    const onMove = (moveEvent: PointerEvent) => setNotesHeight(Math.min(420, Math.max(92, startHeight + startY - moveEvent.clientY)));
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return <PptCopyContext.Provider value={copy}><main className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--vr-bg)] pb-9">
    <AnimationRibbon activeTab={ribbonTab} selected={selectedObject} animation={getAnimation()} onApply={applyEffect} onPreview={preview} onUpdate={updateSelectedAnimation} transition={currentTransition} onUpdateTransition={updateTransition} onApplyTransitionToAll={applyTransitionToAll} />
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {viewMode === 'normal' ? <SlideList slides={slides} selectedId={selectedId} timelines={animations} onSelect={selectSlide} /> : null}
      <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--vr-bg)]">
        {viewMode === 'sorter' ? <SlideSorter slides={slides} selectedId={selectedId} timelines={animations} onSelect={(id) => { selectSlide(id); setViewMode('normal'); }} /> : <div className={`flex h-full min-h-0 flex-col ${viewMode === 'reading' ? 'bg-slate-950' : ''}`}>
          <div className="min-h-0 flex-1 overflow-auto p-6 lg:p-10"><div className="mx-auto flex min-h-full max-w-5xl items-center justify-center"><div className="w-full transition-transform duration-150" style={{ transform: `scale(${zoom / 100})` }}><SlideCanvas key={selectedId} selectedId={selectedId} scene={scene} projectName={projectName} webSettings={webSettings} renderStyle={renderStyle} colors={colors} animations={currentAnimations} transition={currentTransition} selected={selectedObject} previewing={isPreviewing} onSelect={selectObject} /></div></div></div>
          {notesOpen ? <NotesPanel height={notesHeight} onResizeStart={startNotesResize} value={pptSettings.speakerNotes?.[selectedId]} onChange={(value) => updatePptSettings({ speakerNotes: { ...pptSettings.speakerNotes, [selectedId]: value } })} /> : null}
        </div>}
      </section>
      {viewMode === 'normal' ? <PptSidebar activeTab={sidebarTab} setActiveTab={setSidebarTab} selected={selectedObject} animation={getAnimation()} animations={currentAnimations} pptSettings={pptSettings} updatePptSettings={updatePptSettings} onSelectAnimation={(animation) => { setSelectedObject({ target: animation.target, targetId: animation.targetId, label: targetLabel(copy, animation, scene) }); setSidebarTab('properties'); }} onMove={moveAnimation} onDelete={(id) => replaceTimeline(currentAnimations.filter((item) => item.id !== id))} onPreview={preview} onUpdate={updateSelectedAnimation} /> : null}
    </div>
    {isPlaying ? <PlayerOverlay playerRef={playerRef} selectedId={selectedId} scene={scene} projectName={projectName} webSettings={webSettings} renderStyle={renderStyle} colors={colors} animations={currentAnimations} transition={currentTransition} selectedIndex={selectedIndex} total={slides.length} onNext={next} onPrevious={previous} onClose={closePlayer} /> : null}
    <PptFooterBar viewMode={viewMode} setViewMode={setViewMode} notesOpen={notesOpen} setNotesOpen={setNotesOpen} zoom={zoom} setZoom={setZoom} onFit={() => setZoom(92)} onPlay={playFromStart} />
  </main></PptCopyContext.Provider>;
}

function AnimationRibbon({ activeTab, selected, animation, onApply, onPreview, onUpdate, transition, onUpdateTransition, onApplyTransitionToAll }: { activeTab: 'animation' | 'transition'; selected: Selection | null; animation?: PptObjectAnimation; onApply: (effect: PptAnimationEffect) => void; onPreview: () => void; onUpdate: (patch: Partial<PptObjectAnimation>) => void; transition: PptSlideTransition; onUpdateTransition: (patch: Partial<PptSlideTransition>) => void; onApplyTransitionToAll: () => void }) {
  const copy = usePptCopy();
  const disabled = !selected;
  return <header className="shrink-0 border-b border-[var(--vr-border)] bg-[var(--vr-surface-strong)] shadow-sm">
    {activeTab === 'transition' ? <TransitionControls transition={transition} onPreview={onPreview} onUpdate={onUpdateTransition} onApplyToAll={onApplyTransitionToAll} /> : <div className="flex min-h-[94px] items-stretch overflow-x-auto px-3">
      <RibbonGroup label={copy.preview}><button type="button" onClick={onPreview} className="ppt-ribbon-action"><Eye className="h-5 w-5" /><span>{copy.preview}</span></button></RibbonGroup>
      <RibbonGroup label={copy.animation}><div className="flex gap-1">{EFFECTS.map((item) => <button key={item.value} type="button" disabled={disabled} onClick={() => onApply(item.value)} className={`ppt-effect-button ${animation?.effect === item.value ? 'is-active' : ''}`}><span className="text-lg leading-none">{item.glyph}</span><span>{copy[item.key]}</span></button>)}</div></RibbonGroup>
      <RibbonGroup label={copy.effectOptions}><select disabled={disabled || animation?.effect === 'none'} value={animation?.direction || 'left'} onChange={(event) => onUpdate({ direction: event.target.value as PptAnimationDirection })} className="render-field min-w-24 text-xs"><option value="left">{copy.fromLeft}</option><option value="right">{copy.fromRight}</option><option value="up">{copy.fromTop}</option><option value="down">{copy.fromBottom}</option></select></RibbonGroup>
      <RibbonGroup label={copy.addAnimation}><button type="button" disabled={disabled} onClick={() => onApply(animation?.effect || 'fade')} className="ppt-ribbon-action"><Sparkles className="h-5 w-5" /><span>{copy.addAnimation}</span></button><button type="button" className="ppt-ribbon-action" title={copy.trigger} disabled><MousePointer2 className="h-5 w-5" /><span>{copy.trigger}</span></button></RibbonGroup>
      <RibbonGroup label={copy.timing}><div className="grid grid-cols-[auto_84px] items-center gap-x-2 gap-y-1.5 text-[11px] text-[var(--vr-text-muted)]"><label>{copy.start}</label><select disabled={disabled} value={animation?.start || 'onClick'} onChange={(event) => onUpdate({ start: event.target.value as PptAnimationStart })} className="render-field h-7 text-[11px]"><option value="onClick">{copy.onClick}</option><option value="withPrevious">{copy.withPrevious}</option><option value="afterPrevious">{copy.afterPrevious}</option></select><label>{copy.duration}</label><input disabled={disabled} type="number" min="0.1" max="10" step="0.1" value={(animation?.durationMs || 500) / 1000} onChange={(event) => onUpdate({ durationMs: Math.round(Math.max(0.1, Number(event.target.value || 0.5)) * 1000) })} className="render-field h-7 text-[11px]" /><label>{copy.delay}</label><input disabled={disabled} type="number" min="0" max="10" step="0.1" value={(animation?.delayMs || 0) / 1000} onChange={(event) => onUpdate({ delayMs: Math.round(Math.max(0, Number(event.target.value || 0)) * 1000) })} className="render-field h-7 text-[11px]" /></div></RibbonGroup>
    </div>}
  </header>;
}
function RibbonGroup({ label, children }: { label: string; children: ReactNode }) { return <section className="relative flex min-w-max items-center gap-2 border-r border-[var(--vr-border)] px-3 pb-5 pt-2 last:border-r-0"><div className="absolute inset-x-0 bottom-1 text-center text-[10px] font-medium text-[var(--vr-text-muted)]">{label}</div>{children}</section>; }
function TransitionControls({ transition, onPreview, onUpdate, onApplyToAll }: { transition: PptSlideTransition; onPreview: () => void; onUpdate: (patch: Partial<PptSlideTransition>) => void; onApplyToAll: () => void }) {
  const copy = usePptCopy();
  return <div className="flex min-h-[94px] items-stretch overflow-x-auto px-3"><RibbonGroup label={copy.preview}><button type="button" onClick={onPreview} className="ppt-ribbon-action"><Eye className="h-5 w-5" /><span>{copy.preview}</span></button></RibbonGroup><RibbonGroup label={copy.transitionToSlide}><div className="flex gap-1">{TRANSITIONS.map((item) => <button key={item.value} type="button" onClick={() => onUpdate({ effect: item.value })} className={`ppt-effect-button min-w-[62px] ${transition.effect === item.value ? 'is-active' : ''}`}><span className="text-lg leading-none">{item.glyph}</span><span>{copy[item.key]}</span></button>)}</div></RibbonGroup><RibbonGroup label={copy.effectOptions}><select disabled={transition.effect === 'none' || transition.effect === 'fade'} value={transition.direction} onChange={(event) => onUpdate({ direction: event.target.value as PptAnimationDirection })} className="render-field min-w-24 text-xs"><option value="left">{copy.fromLeft}</option><option value="right">{copy.fromRight}</option><option value="up">{copy.fromTop}</option><option value="down">{copy.fromBottom}</option></select></RibbonGroup><RibbonGroup label={copy.timing}><div className="grid grid-cols-[auto_94px] items-center gap-x-2 gap-y-1.5 text-[11px] text-[var(--vr-text-muted)]"><label>{copy.sound}</label><select disabled className="render-field h-7 text-[11px]"><option>{copy.noSound}</option></select><label>{copy.duration}</label><input type="number" min="0.1" max="10" step="0.1" value={(transition.durationMs / 1000).toFixed(1)} onChange={(event) => onUpdate({ durationMs: Math.round(Math.max(.1, Number(event.target.value || .7)) * 1000) })} className="render-field h-7 text-[11px]" /><label className="col-span-2 flex items-center gap-1.5"><input type="checkbox" checked={transition.advanceOnClick} onChange={(event) => onUpdate({ advanceOnClick: event.target.checked })} />{copy.clickMouse}</label><label className="col-span-2 flex items-center gap-1.5"><input type="checkbox" checked={transition.advanceAfterMs !== undefined} onChange={(event) => onUpdate({ advanceAfterMs: event.target.checked ? 0 : undefined })} />{copy.autoAdvance}</label>{transition.advanceAfterMs !== undefined ? <><label>{copy.autoTime}</label><input type="number" min="0" max="3600" step="0.1" value={(transition.advanceAfterMs / 1000).toFixed(1)} onChange={(event) => onUpdate({ advanceAfterMs: Math.max(0, Number(event.target.value || 0) * 1000) })} className="render-field h-7 text-[11px]" /></> : null}</div><button type="button" onClick={onApplyToAll} className="ppt-ribbon-action ml-1"><Presentation className="h-5 w-5" /><span>{copy.applyAll}</span></button></RibbonGroup></div>;
}

function SlideList({ slides, selectedId, timelines, onSelect }: { slides: SlideItem[]; selectedId: string; timelines: Record<string, PptObjectAnimation[]>; onSelect: (id: string) => void }) { return <aside className="w-56 shrink-0 overflow-y-auto border-r border-[var(--vr-border)] bg-[var(--vr-surface-strong)] p-3"><div className="mb-3 flex items-center gap-2 px-1 text-xs font-black text-[var(--vr-text)]"><Presentation className="h-4 w-4 text-[var(--vr-accent-strong)]" />幻灯片</div><div className="space-y-2">{slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => onSelect(slide.id)} className={`w-full rounded-lg border p-2 text-left transition-colors ${selectedId === slide.id ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] hover:bg-[var(--vr-surface-soft)]'}`}><div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-[var(--vr-text-muted)]"><span>{index + 1}</span><span className="truncate">{slide.id === 'cover' ? '封面' : '剧情页'}</span>{(timelines[slide.id]?.length || 0) > 0 ? <span className="ml-auto rounded bg-[var(--vr-accent)] px-1 text-white">{timelines[slide.id].length}</span> : null}</div><div className="aspect-video overflow-hidden rounded bg-slate-950 p-1.5"><div className="h-full rounded border border-white/20 bg-slate-800 px-1.5 py-2 text-[8px] font-bold text-white/90">{slide.title}</div></div></button>)}</div></aside>; }
function SlideSorter({ slides, selectedId, timelines, onSelect }: { slides: SlideItem[]; selectedId: string; timelines: Record<string, PptObjectAnimation[]>; onSelect: (id: string) => void }) { return <div className="h-full overflow-auto p-8"><div className="mx-auto grid max-w-5xl grid-cols-2 gap-5 lg:grid-cols-3">{slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => onSelect(slide.id)} className={`aspect-video rounded-xl border p-3 text-left shadow-sm ${selectedId === slide.id ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] bg-[var(--vr-surface-strong)] hover:bg-[var(--vr-surface-soft)]'}`}><span className="text-xs text-[var(--vr-text-muted)]">{index + 1}</span>{(timelines[slide.id]?.length || 0) > 0 ? <span className="ml-2 text-xs text-[var(--vr-accent-strong)]">{timelines[slide.id].length} 个动画</span> : null}<div className="mt-3 truncate text-sm font-black">{slide.title}</div></button>)}</div></div>; }

function SlideCanvas({ selectedId, scene, projectName, webSettings, renderStyle, colors, animations, transition, selected, previewing, onSelect }: { selectedId: string; scene?: Scene; projectName: string; webSettings: WebExportSettings; renderStyle: RenderStyle; colors: ReturnType<typeof pptSceneColors>; animations: PptObjectAnimation[]; transition: PptSlideTransition; selected: Selection | null; previewing: boolean; onSelect: (selection: Selection) => void }) { const transitionStyle = transition.effect === 'none' ? undefined : { animationDuration: `${transition.durationMs}ms` }; return <div className={`ppt-slide-canvas ppt-transition-${transition.effect} relative aspect-video w-full overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-2xl`} style={{ backgroundColor: selectedId === 'cover' ? webSettings.startMenuBackgroundColor : colors.background, ...transitionStyle }}>{selectedId === 'cover' ? <CoverPreview projectName={projectName} selected={selected} animations={animations} previewing={previewing} onSelect={onSelect} /> : scene ? <ScenePreview scene={scene} renderStyle={renderStyle} colors={colors} selected={selected} animations={animations} previewing={previewing} onSelect={onSelect} /> : null}</div>; }

function CoverPreview({ projectName, selected, animations, previewing, onSelect }: { projectName: string; selected: Selection | null; animations: PptObjectAnimation[]; previewing: boolean; onSelect: (selection: Selection) => void }) { return <div className="grid h-full place-items-center bg-black/35 px-10 text-center"><div><Selectable selection={{ target: 'cover-title', label: '封面标题' }} selected={selected} animation={findAnimation(animations, 'cover-title')} previewing={previewing} onSelect={onSelect}><h1 className="text-4xl font-black text-white">{projectName || 'GalWriter AI'}</h1></Selectable><Selectable selection={{ target: 'cover-subtitle', label: '封面副标题' }} selected={selected} animation={findAnimation(animations, 'cover-subtitle')} previewing={previewing} onSelect={onSelect}><p className="mt-4 text-sm text-white/75">由 GalWriter AI 生成</p></Selectable></div></div>; }

function ScenePreview({ scene, renderStyle, colors, selected, animations, previewing, onSelect }: { scene: Scene; renderStyle: RenderStyle; colors: ReturnType<typeof pptSceneColors>; selected: Selection | null; animations: PptObjectAnimation[]; previewing: boolean; onSelect: (selection: Selection) => void }) { const panelColor = `${colors.panel}${Math.round(((renderStyle.panelColorAlpha ?? 82) / 100) * 255).toString(16).padStart(2, '0')}`; return <><Selectable className="absolute inset-0" selection={{ target: 'background', label: '场景背景' }} selected={selected} animation={findAnimation(animations, 'background')} previewing={previewing} onSelect={onSelect}>{scene.backgroundUrl ? <img src={scene.backgroundUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full" />}</Selectable><div className="pointer-events-none absolute inset-0 bg-black/10" />{scene.characters.map((character) => { const baseLeft = character.position === 'left' ? 24 : character.position === 'right' ? 76 : 50; const selection = { target: 'character' as const, targetId: character.sourceNodeId, label: `角色：${character.name || '未命名'}` }; return <Selectable key={character.sourceNodeId} className="absolute h-[72%] max-w-[42%]" selection={selection} selected={selected} animation={findAnimation(animations, 'character', character.sourceNodeId)} previewing={previewing} onSelect={onSelect} style={{ left: `calc(${baseLeft}% + ${character.offsetX / 10}%)`, bottom: `${character.offsetY / 10}%`, transform: `translateX(-50%) scaleX(${character.flipX ? -1 : 1}) scale(${character.scale || 1})`, transformOrigin: 'bottom center', zIndex: 10 + (character.layer || 1) }}><img src={character.imageUrl} alt={character.name || ''} className="h-full w-full object-contain" /></Selectable>; })}<Selectable className="absolute inset-x-[4%] bottom-[7%] z-40 rounded-xl" selection={{ target: 'dialog-panel', label: '对话框' }} selected={selected} animation={findAnimation(animations, 'dialog-panel')} previewing={previewing} onSelect={onSelect}><div className="rounded-xl px-6 py-4" style={{ backgroundColor: panelColor }}><Selectable selection={{ target: 'dialog-title', label: '对话标题' }} selected={selected} animation={findAnimation(animations, 'dialog-title')} previewing={previewing} onSelect={onSelect}><div className="mb-1 text-sm font-black" style={{ color: colors.title, fontFamily: renderStyle.titleFontFamily }}>{scene.title}</div></Selectable><Selectable selection={{ target: 'dialog-body', label: '对话正文' }} selected={selected} animation={findAnimation(animations, 'dialog-body')} previewing={previewing} onSelect={onSelect}><div className="max-w-[68%] whitespace-pre-wrap text-sm leading-6" style={{ color: colors.body, fontFamily: renderStyle.bodyFontFamily }}>{scene.text}</div></Selectable>{scene.choices.slice(0, 3).map((choice, index) => <Selectable key={`${choice.label}-${index}`} className="ml-2 inline-flex" selection={{ target: 'choice', targetId: String(index), label: `选项 ${index + 1}` }} selected={selected} animation={findAnimation(animations, 'choice', String(index))} previewing={previewing} onSelect={onSelect}><span className="inline-flex rounded bg-indigo-500 px-2 py-1 text-[10px] font-bold text-white">{choice.label}</span></Selectable>)}</div></Selectable></>; }

function Selectable({ selection, selected, animation, previewing, onSelect, className = '', style, children }: { selection: Selection; selected: Selection | null; animation?: PptObjectAnimation; previewing: boolean; onSelect: (selection: Selection) => void; className?: string; style?: React.CSSProperties; children: ReactNode }) { const active = selected && animationKey(selected.target, selected.targetId) === animationKey(selection.target, selection.targetId); return <div role="button" tabIndex={0} aria-label={`选择${selection.label}`} onClick={(event) => { event.stopPropagation(); onSelect(selection); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(selection); } }} className={`ppt-selectable ${active ? 'is-selected' : ''} ${className}`} style={{ ...style, ...previewStyle(animation, previewing) }}>{children}{animation ? <span className="ppt-animation-index">✦</span> : null}</div>; }
function findAnimation(animations: PptObjectAnimation[], target: PptAnimationTarget, targetId?: string) { return animations.find((item) => animationKey(item.target, item.targetId) === animationKey(target, targetId)); }
function previewStyle(animation: PptObjectAnimation | undefined, previewing: boolean): React.CSSProperties { if (!animation || !previewing) return {}; const suffix = animation.effect === 'fly' || animation.effect === 'wipe' ? `-${animation.direction}` : ''; return { animation: `ppt-${animation.effect}${suffix} ${animation.durationMs}ms ease ${animation.delayMs}ms both` }; }
function targetLabel(copy: PptCopy, animation: PptObjectAnimation, scene?: Scene) { if (animation.target === 'character') return `${copy.character}：${scene?.characters.find((item) => item.sourceNodeId === animation.targetId)?.name || copy.unnamed}`; if (animation.target === 'choice') return `${copy.choice} ${Number(animation.targetId || 0) + 1}`; return ({ background: copy.background, 'dialog-panel': copy.dialogPanel, 'dialog-title': copy.dialogTitle, 'dialog-body': copy.dialogBody, 'cover-title': copy.coverTitle, 'cover-subtitle': copy.coverSubtitle } as Record<string, string>)[animation.target] || copy.objectProperties; }

function PptSidebar({ activeTab, setActiveTab, selected, animation, animations, pptSettings, updatePptSettings, onSelectAnimation, onMove, onDelete, onPreview, onUpdate }: { activeTab: SidebarTab; setActiveTab: (tab: SidebarTab) => void; selected: Selection | null; animation?: PptObjectAnimation; animations: PptObjectAnimation[]; pptSettings: PptExportSettings; updatePptSettings: (patch: Partial<PptExportSettings>) => void; onSelectAnimation: (animation: PptObjectAnimation) => void; onMove: (id: string, direction: -1 | 1) => void; onDelete: (id: string) => void; onPreview: () => void; onUpdate: (patch: Partial<PptObjectAnimation>) => void }) { return <aside className="flex w-[328px] shrink-0 flex-col border-l border-[var(--vr-border)] bg-[var(--vr-surface-strong)]"><div className="flex border-b border-[var(--vr-border)]">{([{ id: 'timeline', label: '动画窗格', icon: ListOrdered }, { id: 'properties', label: '对象属性', icon: Settings2 }, { id: 'export', label: '导出规则', icon: Presentation }] as const).map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-3 text-xs font-bold ${activeTab === tab.id ? 'border-[var(--vr-accent)] text-[var(--vr-accent-strong)]' : 'border-transparent text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'}`}><tab.icon className="h-3.5 w-3.5" />{tab.label}</button>)}</div><div className="min-h-0 flex-1 overflow-y-auto p-4">{activeTab === 'timeline' ? <AnimationTimeline animations={animations} onSelect={onSelectAnimation} onMove={onMove} onDelete={onDelete} onPreview={onPreview} /> : null}{activeTab === 'properties' ? <ObjectProperties selected={selected} animation={animation} onUpdate={onUpdate} /> : null}{activeTab === 'export' ? <ExportRules pptSettings={pptSettings} updatePptSettings={updatePptSettings} /> : null}</div></aside>; }
function AnimationTimeline({ animations, onSelect, onMove, onDelete, onPreview }: { animations: PptObjectAnimation[]; onSelect: (animation: PptObjectAnimation) => void; onMove: (id: string, direction: -1 | 1) => void; onDelete: (id: string) => void; onPreview: () => void }) { const copy = usePptCopy(); return <><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-black text-[var(--vr-text)]">{copy.animationPane}</h2><p className="mt-1 text-xs text-[var(--vr-text-muted)]">{copy.playCurrentSlide}</p></div><button type="button" onClick={onPreview} className="render-icon-button" title={copy.playCurrentSlide}><Play className="h-4 w-4" /></button></div>{animations.length ? <div className="space-y-2">{animations.map((item, index) => <div key={item.id} className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2.5"><button type="button" onClick={() => onSelect(item)} className="flex w-full items-start gap-2 text-left"><span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[var(--vr-accent)] text-[10px] font-black text-white">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[var(--vr-text)]">{targetLabel(copy, item)} · {effectLabel(copy, item.effect)}</strong><small className="mt-1 block text-[10px] text-[var(--vr-text-muted)]">{startLabel(copy, item.start)} · {directionLabel(copy, item.direction)} · {(item.durationMs / 1000).toFixed(1)} {copy.seconds}</small></span></button><div className="mt-2 flex justify-end gap-1"><button type="button" className="ppt-mini-button" onClick={() => onMove(item.id, -1)} disabled={index === 0}>↑</button><button type="button" className="ppt-mini-button" onClick={() => onMove(item.id, 1)} disabled={index === animations.length - 1}>↓</button><button type="button" className="ppt-mini-button text-rose-500" onClick={() => onDelete(item.id)}>{copy.delete}</button></div></div>)}</div> : <div className="rounded-lg border border-dashed border-[var(--vr-border)] px-4 py-8 text-center text-xs leading-5 text-[var(--vr-text-muted)]">{copy.noAnimationsHint}</div>}</> }
function ObjectProperties({ selected, animation, onUpdate }: { selected: Selection | null; animation?: PptObjectAnimation; onUpdate: (patch: Partial<PptObjectAnimation>) => void }) { const copy = usePptCopy(); if (!selected) return <div className="rounded-lg border border-dashed border-[var(--vr-border)] px-4 py-8 text-center text-xs leading-5 text-[var(--vr-text-muted)]">{copy.selectedObjectHint}</div>; return <><div className="mb-5 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]"><Sparkles className="h-4 w-4" /></span><div><h2 className="text-sm font-black text-[var(--vr-text)]">{selected.label}</h2><p className="text-xs text-[var(--vr-text-muted)]">{animation ? effectLabel(copy, animation.effect) : copy.noAnimationAdded}</p></div></div><label className="mb-4 block text-xs font-bold text-[var(--vr-text-muted)]">{copy.start}<select value={animation?.start || 'onClick'} onChange={(event) => onUpdate({ start: event.target.value as PptAnimationStart })} className="render-field mt-1.5 w-full"><option value="onClick">{copy.onClick}</option><option value="withPrevious">{copy.withPrevious}</option><option value="afterPrevious">{copy.afterPrevious}</option></select></label><label className="mb-4 block text-xs font-bold text-[var(--vr-text-muted)]">{copy.effectOptions}<select value={animation?.direction || 'left'} onChange={(event) => onUpdate({ direction: event.target.value as PptAnimationDirection })} className="render-field mt-1.5 w-full"><option value="left">{copy.fromLeft}</option><option value="right">{copy.fromRight}</option><option value="up">{copy.fromTop}</option><option value="down">{copy.fromBottom}</option></select></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-[var(--vr-text-muted)]">{copy.duration}<input type="number" min="0.1" max="10" step="0.1" value={(animation?.durationMs || 500) / 1000} onChange={(event) => onUpdate({ durationMs: Math.round(Math.max(.1, Number(event.target.value || .5)) * 1000) })} className="render-field mt-1.5 w-full" /></label><label className="text-xs font-bold text-[var(--vr-text-muted)]">{copy.delay}<input type="number" min="0" max="10" step="0.1" value={(animation?.delayMs || 0) / 1000} onChange={(event) => onUpdate({ delayMs: Math.round(Math.max(0, Number(event.target.value || 0)) * 1000) })} className="render-field mt-1.5 w-full" /></label></div><div className="mt-6 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 text-xs leading-5 text-[var(--vr-text-muted)]"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{copy.animationPersistenceHint}</div></>; }
function ExportRules({ pptSettings, updatePptSettings }: { pptSettings: PptExportSettings; updatePptSettings: (patch: Partial<PptExportSettings>) => void }) { return <><h2 className="mb-5 flex items-center gap-2 text-sm font-black text-[var(--vr-text)]"><Settings2 className="h-4 w-4 text-[var(--vr-accent-strong)]" />PPT 导出规则</h2><Field label="页面比例"><select value={pptSettings.layout} onChange={(event) => updatePptSettings({ layout: event.target.value as PptExportSettings['layout'] })} className="render-field"><option value="LAYOUT_WIDE">16:9</option><option value="LAYOUT_STANDARD">4:3</option></select></Field><Field label="分支表现"><select value={pptSettings.branchMode} onChange={(event) => updatePptSettings({ branchMode: event.target.value as PptExportSettings['branchMode'] })} className="render-field"><option value="interactive">互动跳转</option><option value="linear">主线演示</option><option value="all">全部分支</option></select></Field><Toggle label="生成封面页" checked={pptSettings.includeCover} onChange={(includeCover) => updatePptSettings({ includeCover })} /><Toggle label="写入演讲备注" checked={pptSettings.includeNotes} onChange={(includeNotes) => updatePptSettings({ includeNotes })} /><div className="mt-6 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 text-xs leading-5 text-[var(--vr-text-muted)]">背景、角色、对话框、字体与选项均与网页设置同步；动画以独立时间线保存。</div></>; }
function NotesPanel({ height, onResizeStart, value, onChange }: { height: number; onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void; value?: string; onChange: (value: string) => void }) { return <section className="relative shrink-0 border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)]" style={{ height }}><div role="separator" aria-orientation="horizontal" onPointerDown={onResizeStart} className="absolute inset-x-0 top-0 z-10 h-2 -translate-y-1/2 cursor-row-resize before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-[var(--vr-border)] hover:before:border-[var(--vr-accent)]" /><textarea value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="单击此处添加备注" className="h-full w-full resize-none bg-transparent px-4 py-3 text-base leading-7 text-[var(--vr-text)] outline-none placeholder:text-[var(--vr-text-muted)]" /></section>; }
function PptFooterBar({ viewMode, setViewMode, notesOpen, setNotesOpen, zoom, setZoom, onFit, onPlay }: { viewMode: ViewMode; setViewMode: (value: ViewMode) => void; notesOpen: boolean; setNotesOpen: (value: boolean) => void; zoom: number; setZoom: (value: number) => void; onFit: () => void; onPlay: () => void }) { const button = (active: boolean) => `grid h-8 w-8 place-items-center rounded transition-colors ${active ? 'bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]'}`; return <footer className="absolute inset-x-0 bottom-0 z-50 flex h-9 items-center border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)] px-2 text-xs shadow-[0_-8px_20px_rgba(15,23,42,0.06)]"><button type="button" onClick={() => setNotesOpen(!notesOpen)} className={`flex h-8 items-center gap-1.5 border-r border-[var(--vr-border)] px-2 font-bold ${notesOpen ? 'text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'}`}><StickyNote className="h-4 w-4" />备注</button><div className="ml-auto flex h-full items-center gap-1"><button type="button" title="普通视图" className={button(viewMode === 'normal')} onClick={() => setViewMode('normal')}><Presentation className="h-4 w-4" /></button><button type="button" title="幻灯片浏览" className={button(viewMode === 'sorter')} onClick={() => setViewMode('sorter')}><Grid2X2 className="h-4 w-4" /></button><button type="button" title="阅读视图" className={button(viewMode === 'reading')} onClick={() => setViewMode('reading')}><BookOpen className="h-4 w-4" /></button><button type="button" title="从头播放" className={button(false)} onClick={onPlay}><MonitorPlay className="h-4 w-4" /></button><span className="mx-1 h-4 border-l border-[var(--vr-border)]" /><button type="button" title="缩小" className={button(false)} onClick={() => setZoom(Math.max(50, zoom - 10))}><ZoomOut className="h-4 w-4" /></button><input aria-label="缩放比例" type="range" min="50" max="200" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-20 accent-[var(--vr-accent)]" /><button type="button" title="放大" className={button(false)} onClick={() => setZoom(Math.min(200, zoom + 10))}><ZoomIn className="h-4 w-4" /></button><span className="w-10 text-center tabular-nums text-[var(--vr-text-muted)]">{zoom}%</span><button type="button" title="适应窗口" className={button(false)} onClick={onFit}><Maximize2 className="h-4 w-4" /></button></div></footer>; }
function PlayerOverlay({ playerRef, selectedId, scene, projectName, webSettings, renderStyle, colors, animations, transition, selectedIndex, total, onNext, onPrevious, onClose }: { playerRef: React.RefObject<HTMLDivElement | null>; selectedId: string; scene?: Scene; projectName: string; webSettings: WebExportSettings; renderStyle: RenderStyle; colors: ReturnType<typeof pptSceneColors>; animations: PptObjectAnimation[]; transition: PptSlideTransition; selectedIndex: number; total: number; onNext: () => void; onPrevious: () => void; onClose: () => void }) { return <div className="fixed inset-0 z-[500] grid place-items-center bg-black" ref={playerRef}><div className="relative flex h-full w-full items-center justify-center p-4"><div className="w-full max-w-[177vh]"><SlideCanvas key={selectedId} selectedId={selectedId} scene={scene} projectName={projectName} webSettings={webSettings} renderStyle={renderStyle} colors={colors} animations={animations} transition={transition} selected={null} previewing onSelect={() => undefined} /></div><div className="absolute bottom-5 left-5 text-xs font-bold text-white/70">{selectedIndex + 1} / {total}</div><div className="absolute bottom-4 right-4 flex items-center gap-2"><PlayerButton label="上一页" onClick={onPrevious}><ChevronLeft className="h-5 w-5" /></PlayerButton><PlayerButton label="下一页" onClick={onNext}><ChevronRight className="h-5 w-5" /></PlayerButton><PlayerButton label="退出播放" onClick={onClose}><TimerReset className="h-5 w-5" /></PlayerButton></div></div></div>; }
function PlayerButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) { return <button type="button" title={label} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25">{children}</button>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="mb-4 block text-xs font-bold text-[var(--vr-text-muted)]"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 text-xs font-bold text-[var(--vr-text)]"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>; }
