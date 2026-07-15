import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Maximize2,
  MonitorPlay,
  Presentation,
  StickyNote,
  TimerReset,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { VirtualPresentationStage } from '../../VirtualPresentationStage';
import type { PptManualSlide, PptObjectAnimation, PptSlideTransition, RenderStyle, WebExportSettings } from '../video/shared/types';
import { pptSceneColors } from './pptSceneResolver';
import type { Scene } from './PptWorkspace';
import { SlideCanvas } from './PptWorkspace';
import { PPT_CONTENT_HEIGHT, PPT_CONTENT_WIDTH, type PptCanvasLayout, pptCanvasViewportClass, type PptWorkspaceViewMode } from './pptWorkspaceModel';

type ViewMode = PptWorkspaceViewMode;

export function PptFooterBar({
  viewMode,
  setViewMode,
  notesOpen,
  setNotesOpen,
  zoom,
  setZoom,
  onFit,
  onPlay,
}: {
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  notesOpen: boolean;
  setNotesOpen: (value: boolean) => void;
  zoom: number;
  setZoom: (value: number) => void;
  onFit: () => void;
  onPlay: () => void;
}) {
  const button = (active: boolean) =>
    `grid h-8 w-8 place-items-center rounded transition-colors ${active ? 'bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]'}`;
  return (
    <footer className="absolute inset-x-0 bottom-0 z-50 flex h-9 items-center border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)] px-2 text-xs shadow-[0_-8px_20px_rgba(15,23,42,0.06)]">
      <button
        type="button"
        onClick={() => setNotesOpen(!notesOpen)}
        className={`flex h-8 items-center gap-1.5 border-r border-[var(--vr-border)] px-2 font-bold ${notesOpen ? 'text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'}`}
      >
        <StickyNote className="h-4 w-4" />
        备注
      </button>
      <div className="ml-auto flex h-full items-center gap-1">
        <button
          type="button"
          title="普通视图"
          className={button(viewMode === 'normal')}
          onClick={() => setViewMode('normal')}
        >
          <Presentation className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="幻灯片浏览"
          className={button(viewMode === 'sorter')}
          onClick={() => setViewMode('sorter')}
        >
          <Grid2X2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="阅读视图"
          className={button(viewMode === 'reading')}
          onClick={() => setViewMode('reading')}
        >
          <BookOpen className="h-4 w-4" />
        </button>
        <button type="button" title="从头播放" className={button(false)} onClick={onPlay}>
          <MonitorPlay className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 border-l border-[var(--vr-border)]" />
        <button
          type="button"
          title="缩小"
          className={button(false)}
          onClick={() => setZoom(Math.max(50, zoom - 10))}
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <input
          aria-label="缩放比例"
          type="range"
          min="50"
          max="200"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="w-20 accent-[var(--vr-accent)]"
        />
        <button
          type="button"
          title="放大"
          className={button(false)}
          onClick={() => setZoom(Math.min(200, zoom + 10))}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="w-10 text-center tabular-nums text-[var(--vr-text-muted)]">{zoom}%</span>
        <button type="button" title="适应窗口" className={button(false)} onClick={onFit}>
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </footer>
  );
}
export function PlayerOverlay({
  playerRef,
  selectedId,
  isChoiceSlide,
  scene,
  manualSlide,
  videoLoop,
  projectName,
  webSettings,
  renderStyle,
  colors,
  animations,
  transition,
  layout,
  selectedIndex,
  total,
  onNext,
  onPrevious,
  onClose,
  onChoose,
}: {
  playerRef: React.RefObject<HTMLDivElement | null>;
  selectedId: string;
  isChoiceSlide?: boolean;
  scene?: Scene;
  manualSlide?: PptManualSlide;
  videoLoop: boolean;
  projectName: string;
  webSettings: WebExportSettings;
  renderStyle: RenderStyle;
  colors: ReturnType<typeof pptSceneColors>;
  animations: PptObjectAnimation[];
  transition: PptSlideTransition;
  layout: PptCanvasLayout;
  selectedIndex: number;
  total: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onChoose: (targetId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[500] grid place-items-center bg-black" ref={playerRef}>
      <div className="relative flex h-full w-full items-center justify-center p-4">
        <div
          className={`relative w-full overflow-hidden bg-slate-950 ${pptCanvasViewportClass(layout)} ${layout === 'LAYOUT_STANDARD' ? 'max-w-[133vh]' : 'max-w-[177vh]'}`}
        >
          <VirtualPresentationStage
            fit="contain"
            width={PPT_CONTENT_WIDTH}
            height={PPT_CONTENT_HEIGHT}
            className="absolute inset-0 h-full w-full"
          >
            <SlideCanvas
              key={selectedId}
              selectedId={selectedId}
              isChoiceSlide={isChoiceSlide}
              scene={scene}
              manualSlide={manualSlide}
              videoLoop={videoLoop}
              projectName={projectName}
              webSettings={webSettings}
              renderStyle={renderStyle}
              colors={colors}
              animations={animations}
              transition={transition}
              selected={null}
              previewing
              onSelect={() => undefined}
              onChoose={onChoose}
            />
          </VirtualPresentationStage>
        </div>
        <div className="absolute bottom-5 left-5 text-xs font-bold text-white/70">
          {selectedIndex + 1} / {total}
        </div>
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <PlayerButton label="上一页" onClick={onPrevious}>
            <ChevronLeft className="h-5 w-5" />
          </PlayerButton>
          {!isChoiceSlide ? (
            <PlayerButton label="下一页" onClick={onNext}>
              <ChevronRight className="h-5 w-5" />
            </PlayerButton>
          ) : null}
          <PlayerButton label="退出播放" onClick={onClose}>
            <TimerReset className="h-5 w-5" />
          </PlayerButton>
        </div>
      </div>
    </div>
  );
}
function PlayerButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
    >
      {children}
    </button>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-4 block text-xs font-bold text-[var(--vr-text-muted)]">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 text-xs font-bold text-[var(--vr-text)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
