import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import { BookOpen, ChevronLeft, ChevronRight, Grid2X2, Link2, Minimize2, MonitorPlay, Presentation, ScanLine, Settings2, StickyNote, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { pptSceneColors, resolvePptScenes } from './pptSceneResolver';
import type { Language } from '../../../lib/i18n';
import { renderCopy } from '../video/shared/renderCopy';
import type { PptExportSettings, RenderStyle, WebExportSettings } from '../video/shared/types';

type ViewMode = 'normal' | 'sorter' | 'reading';
type SlideItem = { id: string; title: string };
type Props = { nodes: FlowNode[]; edges: FlowEdge[]; language: Language; projectName: string; webSettings: WebExportSettings; renderStyle: RenderStyle; pptSettings: PptExportSettings; updatePptSettings: (patch: Partial<PptExportSettings>) => void; };

export function PptWorkspace({ nodes, edges, language, projectName, webSettings, renderStyle, pptSettings, updatePptSettings }: Props) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const scenes = useMemo(() => resolvePptScenes(nodes, edges, webSettings), [nodes, edges, webSettings]);
  const slides = useMemo<SlideItem[]>(() => [
    ...(pptSettings.includeCover ? [{ id: 'cover', title: projectName || t('未命名项目', '無題のプロジェクト', 'Untitled project') }] : []),
    ...scenes.map((scene) => ({ id: scene.id, title: scene.title })),
  ], [pptSettings.includeCover, projectName, scenes, t]);
  const [selectedId, setSelectedId] = useState<string>(() => slides[0]?.id || 'cover');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesHeight, setNotesHeight] = useState(150);
  const [zoom, setZoom] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const wheelLockRef = useRef(0);
  const selectedIndex = Math.max(0, slides.findIndex((slide) => slide.id === selectedId));
  const scene = selectedId === 'cover' ? undefined : scenes.find((item) => item.id === selectedId) || scenes[0];
  const colors = pptSceneColors(renderStyle, webSettings);

  useEffect(() => {
    if (!slides.some((slide) => slide.id === selectedId)) setSelectedId(slides[0]?.id || 'cover');
  }, [selectedId, slides]);
  const selectIndex = useCallback((index: number) => setSelectedId(slides[Math.max(0, Math.min(slides.length - 1, index))]?.id || 'cover'), [slides]);
  const next = useCallback(() => selectIndex(selectedIndex + 1), [selectIndex, selectedIndex]);
  const previous = useCallback(() => selectIndex(selectedIndex - 1), [selectIndex, selectedIndex]);
  const handleWheel = (event: React.WheelEvent) => {
    if (viewMode !== 'reading') return;
    event.preventDefault();
    const now = Date.now();
    if (now - wheelLockRef.current < 320 || Math.abs(event.deltaY) < 14) return;
    wheelLockRef.current = now;
    event.deltaY > 0 ? next() : previous();
  };
  useEffect(() => {
    if (!isPlaying && viewMode !== 'reading') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(event.key)) { event.preventDefault(); next(); }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); previous(); }
      if (event.key === 'Home') { event.preventDefault(); selectIndex(0); }
      if (event.key === 'End') { event.preventDefault(); selectIndex(slides.length - 1); }
      if (event.key === 'Escape' && isPlaying) setIsPlaying(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, next, previous, selectIndex, slides.length, viewMode]);
  const playFromStart = () => {
    selectIndex(0);
    setIsPlaying(true);
  };
  useEffect(() => {
    if (!isPlaying || document.fullscreenElement) return;
    playerRef.current?.requestFullscreen().catch(() => { /* The overlay remains usable when fullscreen is unavailable. */ });
  }, [isPlaying]);
  useEffect(() => {
    const onFullscreenChange = () => { if (!document.fullscreenElement) setIsPlaying(false); };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  const closePlayer = async () => { if (document.fullscreenElement) await document.exitFullscreen(); setIsPlaying(false); };
  const startNotesResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = notesHeight;
    const onMove = (moveEvent: PointerEvent) => setNotesHeight(Math.min(420, Math.max(92, startHeight + startY - moveEvent.clientY)));
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return <main className="relative h-full min-h-0 min-w-0 flex overflow-hidden bg-[var(--vr-bg)] pb-9">
    {viewMode === 'normal' ? <SlideList slides={slides} selectedId={selectedId} onSelect={setSelectedId} /> : null}
    <section className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--vr-bg)]" onWheel={handleWheel}>
      {viewMode === 'sorter' ? <SlideSorter slides={slides} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setViewMode('normal'); }} /> : <div className={`flex h-full min-h-0 flex-col ${viewMode === 'reading' ? 'bg-slate-950' : ''}`}>
        <div className="min-h-0 flex-1 overflow-auto p-6 lg:p-10"><div className="mx-auto flex min-h-full max-w-5xl items-center justify-center"><div className="w-full transition-transform duration-150" style={{ transform: `scale(${zoom / 100})` }}><SlideCanvas selectedId={selectedId} scene={scene} projectName={projectName} webSettings={webSettings} renderStyle={renderStyle} colors={colors} /></div></div></div>
        {notesOpen ? <PptNotesPanel height={notesHeight} onResizeStart={startNotesResize} value={pptSettings.speakerNotes?.[selectedId]} onChange={(value) => updatePptSettings({ speakerNotes: { ...pptSettings.speakerNotes, [selectedId]: value } })} /> : null}
      </div>}
    </section>
    {viewMode === 'normal' ? <ExportRules t={t} pptSettings={pptSettings} updatePptSettings={updatePptSettings} /> : null}
    {isPlaying ? <PlayerOverlay playerRef={playerRef} selectedId={selectedId} scene={scene} projectName={projectName} webSettings={webSettings} renderStyle={renderStyle} colors={colors} selectedIndex={selectedIndex} total={slides.length} onNext={next} onPrevious={previous} onClose={closePlayer} /> : null}
    <div className="absolute inset-x-0 bottom-0 z-50 border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)] shadow-[0_-8px_20px_rgba(15,23,42,0.06)]"><PptFooterBar viewMode={viewMode} setViewMode={setViewMode} notesOpen={notesOpen} setNotesOpen={setNotesOpen} zoom={zoom} setZoom={setZoom} onFit={() => setZoom(92)} onPlay={playFromStart} /></div>
  </main>;
}

function SlideList({ slides, selectedId, onSelect }: { slides: SlideItem[]; selectedId: string; onSelect: (id: string) => void }) { return <aside className="w-56 shrink-0 overflow-y-auto border-r border-[var(--vr-border)] bg-[var(--vr-surface-strong)] p-3"><div className="mb-3 flex items-center gap-2 px-1 text-xs font-black text-[var(--vr-text)]"><Presentation className="h-4 w-4 text-[var(--vr-accent-strong)]" />幻灯片</div><div className="space-y-2">{slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => onSelect(slide.id)} className={`w-full rounded-lg border p-2 text-left transition-colors ${selectedId === slide.id ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] hover:bg-[var(--vr-surface-soft)]'}`}><div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-[var(--vr-text-muted)]"><span>{index + 1}</span><span className="truncate">{slide.id === 'cover' ? '封面' : '剧情页'}</span></div><div className="aspect-video overflow-hidden rounded bg-slate-950 p-1.5"><div className="h-full rounded border border-white/20 bg-slate-800 px-1.5 py-2 text-[8px] font-bold text-white/90">{slide.title}</div></div></button>)}</div></aside>; }
function SlideSorter({ slides, selectedId, onSelect }: { slides: SlideItem[]; selectedId: string; onSelect: (id: string) => void }) { return <div className="h-full overflow-auto p-8"><div className="mx-auto grid max-w-5xl grid-cols-2 gap-5 lg:grid-cols-3">{slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => onSelect(slide.id)} className={`aspect-video rounded-xl border p-3 text-left shadow-sm ${selectedId === slide.id ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] bg-[var(--vr-surface-strong)] hover:bg-[var(--vr-surface-soft)]'}`}><span className="text-xs text-[var(--vr-text-muted)]">{index + 1}</span><div className="mt-3 truncate text-sm font-black">{slide.title}</div></button>)}</div></div>; }
function SlideCanvas({ selectedId, scene, projectName, webSettings, renderStyle, colors }: { selectedId: string; scene: ReturnType<typeof resolvePptScenes>[number] | undefined; projectName: string; webSettings: WebExportSettings; renderStyle: RenderStyle; colors: ReturnType<typeof pptSceneColors> }) { return <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-2xl" style={{ backgroundColor: selectedId === 'cover' ? webSettings.startMenuBackgroundColor : colors.background }}>{selectedId === 'cover' ? <div className="grid h-full place-items-center bg-black/35 px-10 text-center"><div><h1 className="text-4xl font-black text-white" style={{ fontFamily: renderStyle.titleFontFamily }}>{projectName || 'GalWriter AI'}</h1><p className="mt-4 text-sm text-white/75">GalWriter AI</p></div></div> : scene ? <ScenePreview scene={scene} renderStyle={renderStyle} colors={colors} /> : null}</div>; }
function ScenePreview({ scene, renderStyle, colors }: { scene: ReturnType<typeof resolvePptScenes>[number]; renderStyle: RenderStyle; colors: ReturnType<typeof pptSceneColors> }) { const panelColor = `${colors.panel}${Math.round(((renderStyle.panelColorAlpha ?? 82) / 100) * 255).toString(16).padStart(2, '0')}`; return <>{scene.backgroundUrl ? <img src={scene.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}<div className="absolute inset-0 bg-black/10" />{scene.characters.map((character) => { const baseLeft = character.position === 'left' ? 24 : character.position === 'right' ? 76 : 50; return <img key={character.sourceNodeId} src={character.imageUrl} alt={character.name || ''} className="absolute h-[72%] max-w-[42%] object-contain" style={{ left: `calc(${baseLeft}% + ${character.offsetX / 10}%)`, bottom: `${character.offsetY / 10}%`, transform: `translateX(-50%) scaleX(${character.flipX ? -1 : 1}) scale(${character.scale || 1})`, transformOrigin: 'bottom center', zIndex: 10 + (character.layer || 1) }} />; })}<div className="absolute inset-x-[4%] bottom-[7%] z-40 rounded-xl px-6 py-4" style={{ backgroundColor: panelColor }}><div className="mb-1 text-sm font-black" style={{ color: colors.title, fontFamily: renderStyle.titleFontFamily }}>{scene.title}</div><div className="max-w-[68%] whitespace-pre-wrap text-sm leading-6" style={{ color: colors.body, fontFamily: renderStyle.bodyFontFamily }}>{scene.text}</div>{scene.choices.slice(0, 3).map((choice) => <span key={choice.label} className="ml-2 inline-flex rounded bg-indigo-500 px-2 py-1 text-[10px] font-bold text-white">{choice.label}</span>)}</div></>; }
function NotesPanel({ slideId: _slideId, scene, value, onChange }: { slideId: string; scene?: ReturnType<typeof resolvePptScenes>[number]; value?: string; onChange: (value: string) => void }) { const generated = scene ? `${scene.title}\n${scene.text}\n${scene.choices.map((choice) => `• ${choice.label}`).join('\n')}` : '封面页'; return <div className="shrink-0 border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)] px-5 py-3"><div className="mb-1 text-xs font-black text-[var(--vr-text)]">备注</div><textarea value={value ?? generated} onChange={(event) => onChange(event.target.value)} placeholder="输入此页的演讲备注…" className="h-24 w-full resize-y rounded-md border border-[var(--vr-border)] bg-[var(--vr-bg)] px-3 py-2 text-xs leading-5 text-[var(--vr-text)] outline-none placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]" /></div>; }
function PptNotesPanel({ height, onResizeStart, value, onChange }: { height: number; onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void; value?: string; onChange: (value: string) => void }) {
  return <section className="relative shrink-0 border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)]" style={{ height }}>
    <div role="separator" aria-orientation="horizontal" onPointerDown={onResizeStart} className="absolute inset-x-0 top-0 z-10 h-2 -translate-y-1/2 cursor-row-resize before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-[var(--vr-border)] hover:before:border-[var(--vr-accent)]" />
    <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="单击此处添加备注" className="h-full w-full resize-none bg-transparent px-4 py-3 text-base leading-7 text-[var(--vr-text)] outline-none placeholder:text-[var(--vr-text-muted)]" />
  </section>;
}

function PptFooterBar({ viewMode, setViewMode, notesOpen, setNotesOpen, zoom, setZoom, onFit, onPlay }: { viewMode: ViewMode; setViewMode: (value: ViewMode) => void; notesOpen: boolean; setNotesOpen: (value: boolean) => void; zoom: number; setZoom: (value: number) => void; onFit: () => void; onPlay: () => void }) {
  const button = (active: boolean) => `grid h-8 w-8 place-items-center rounded transition-colors ${active ? 'bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]'}`;
  return <footer className="flex h-9 items-center px-2 text-xs">
    <div className="ml-auto flex h-full items-center gap-1">
      <button type="button" onClick={() => setNotesOpen(!notesOpen)} className={`flex h-8 items-center gap-1.5 border-r border-[var(--vr-border)] px-2 font-bold ${notesOpen ? 'text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'}`}><StickyNote className="h-4 w-4" />备注</button>
      <button type="button" title="普通幻灯片浏览" className={button(viewMode === 'normal')} onClick={() => setViewMode('normal')}><Presentation className="h-4 w-4" /></button>
      <button type="button" title="幻灯片浏览" className={button(viewMode === 'sorter')} onClick={() => setViewMode('sorter')}><Grid2X2 className="h-4 w-4" /></button>
      <button type="button" title="阅读视图" className={button(viewMode === 'reading')} onClick={() => setViewMode('reading')}><BookOpen className="h-4 w-4" /></button>
      <button type="button" title="从零播放 PPT" className={button(false)} onClick={onPlay}><MonitorPlay className="h-4 w-4" /></button>
      <span className="mx-1 h-4 border-l border-[var(--vr-border)]" />
      <button type="button" title="缩小" className={button(false)} onClick={() => setZoom(Math.max(50, zoom - 10))}><ZoomOut className="h-4 w-4" /></button>
      <input aria-label="缩放比例" type="range" min="50" max="200" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-20 accent-[var(--vr-accent)]" />
      <button type="button" title="放大" className={button(false)} onClick={() => setZoom(Math.min(200, zoom + 10))}><ZoomIn className="h-4 w-4" /></button>
      <span className="w-10 text-center tabular-nums text-[var(--vr-text-muted)]">{zoom}%</span>
      <button type="button" title="按当前窗口调整 PPT 大小" className={button(false)} onClick={onFit}><ScanLine className="h-4 w-4" /></button>
    </div>
  </footer>;
}

function PptStatusBar({ t, viewMode, setViewMode, notesOpen, setNotesOpen, zoom, setZoom, onFit, onPlay }: { t: (zh: string, ja: string, en: string) => string; viewMode: ViewMode; setViewMode: (value: ViewMode) => void; notesOpen: boolean; setNotesOpen: (value: boolean) => void; zoom: number; setZoom: (value: number) => void; onFit: () => void; onPlay: () => void }) { const button = (active: boolean) => `grid h-8 w-8 place-items-center rounded transition-colors ${active ? 'bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]'}`; return <footer className="flex h-9 shrink-0 items-center justify-between border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)] px-2 text-xs"><button type="button" onClick={() => setNotesOpen(!notesOpen)} className="flex items-center gap-1.5 px-2 font-bold text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]"><StickyNote className="h-4 w-4" />备注</button><div className="flex h-full items-center gap-1 border-l border-[var(--vr-border)] pl-2"><button type="button" title="普通幻灯片浏览" className={button(viewMode === 'normal')} onClick={() => setViewMode('normal')}><Presentation className="h-4 w-4" /></button><button type="button" title="幻灯片浏览" className={button(viewMode === 'sorter')} onClick={() => setViewMode('sorter')}><Grid2X2 className="h-4 w-4" /></button><button type="button" title="阅读视图" className={button(viewMode === 'reading')} onClick={() => setViewMode('reading')}><BookOpen className="h-4 w-4" /></button><button type="button" title="从零播放 PPT" className={button(false)} onClick={onPlay}><MonitorPlay className="h-4 w-4" /></button><span className="mx-1 h-4 border-l border-[var(--vr-border)]" /><button type="button" title="缩小" className={button(false)} onClick={() => setZoom(Math.max(50, zoom - 10))}><ZoomOut className="h-4 w-4" /></button><input aria-label="缩放比例" type="range" min="50" max="200" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-20 accent-[var(--vr-accent)]" /><button type="button" title="放大" className={button(false)} onClick={() => setZoom(Math.min(200, zoom + 10))}><ZoomIn className="h-4 w-4" /></button><span className="w-10 text-center tabular-nums text-[var(--vr-text-muted)]">{zoom}%</span><button type="button" title="按当前窗口调整 PPT 大小" className={button(false)} onClick={onFit}><ScanLine className="h-4 w-4" /></button></div></footer>; }
function ExportRules({ t, pptSettings, updatePptSettings }: { t: (zh: string, ja: string, en: string) => string; pptSettings: PptExportSettings; updatePptSettings: (patch: Partial<PptExportSettings>) => void }) { return <aside className="w-72 shrink-0 overflow-y-auto border-l border-[var(--vr-border)] bg-[var(--vr-surface-strong)] p-4"><div className="mb-5 flex items-center gap-2 text-sm font-black"><Settings2 className="h-4 w-4 text-[var(--vr-accent-strong)]" />PPT 导出规则</div><Field label="页面比例"><select value={pptSettings.layout} onChange={(event) => updatePptSettings({ layout: event.target.value as PptExportSettings['layout'] })} className="render-field"><option value="LAYOUT_WIDE">16:9</option><option value="LAYOUT_STANDARD">4:3</option></select></Field><Field label="分支表现"><select value={pptSettings.branchMode} onChange={(event) => updatePptSettings({ branchMode: event.target.value as PptExportSettings['branchMode'] })} className="render-field"><option value="interactive">互动跳转</option><option value="linear">主线演示</option><option value="all">全部分支</option></select></Field><Toggle label="生成封面页" checked={pptSettings.includeCover} onChange={(includeCover) => updatePptSettings({ includeCover })} /><Toggle label="写入演讲备注" checked={pptSettings.includeNotes} onChange={(includeNotes) => updatePptSettings({ includeNotes })} /><div className="mt-6 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 text-xs leading-5 text-[var(--vr-text-muted)]"><div className="mb-1 flex items-center gap-1.5 font-bold text-[var(--vr-text)]"><Link2 className="h-3.5 w-3.5" />同源编辑</div>背景、角色、对话框、字体和选项均直接跟随网页设置。</div></aside>; }
function PlayerOverlay({ playerRef, selectedId, scene, projectName, webSettings, renderStyle, colors, selectedIndex, total, onNext, onPrevious, onClose }: { playerRef: React.RefObject<HTMLDivElement | null>; selectedId: string; scene?: ReturnType<typeof resolvePptScenes>[number]; projectName: string; webSettings: WebExportSettings; renderStyle: RenderStyle; colors: ReturnType<typeof pptSceneColors>; selectedIndex: number; total: number; onNext: () => void; onPrevious: () => void; onClose: () => void }) { return <div className="fixed inset-0 z-[500] grid place-items-center bg-black" ref={playerRef}><div className="relative flex h-full w-full items-center justify-center p-4"><div className="w-full max-w-[177vh]"><SlideCanvas selectedId={selectedId} scene={scene} projectName={projectName} webSettings={webSettings} renderStyle={renderStyle} colors={colors} /></div><div className="absolute bottom-5 left-5 text-xs font-bold text-white/70">{selectedIndex + 1} / {total}</div><div className="absolute bottom-4 right-4 flex items-center gap-2"><PlayerButton label="上一页" onClick={onPrevious}><ChevronLeft className="h-5 w-5" /></PlayerButton><PlayerButton label="下一页" onClick={onNext}><ChevronRight className="h-5 w-5" /></PlayerButton><PlayerButton label="退出播放" onClick={onClose}><Minimize2 className="h-5 w-5" /></PlayerButton></div></div></div>; }
function PlayerButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) { return <button type="button" title={label} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25">{children}</button>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="mb-4 block text-xs font-bold text-[var(--vr-text-muted)]"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 text-xs font-bold text-[var(--vr-text)]"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>; }
