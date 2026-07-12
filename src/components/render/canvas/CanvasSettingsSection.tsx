import {
  ChevronDown,
  Eye,
  EyeOff,
  FastForward,
  Link,
  Link2Off,
  MoveHorizontal,
  MoveVertical,
  PanelTop,
  PlayCircle,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import type { SharedCanvasSettings } from './canvasSettings';
import { getCanvasText } from './i18n';

type Props = {
  language: Language;
  value: SharedCanvasSettings;
  onChange: (patch: Partial<SharedCanvasSettings>) => void;
  variant?: 'web' | 'video';
};

export function CanvasSettingsSection({ language, value, onChange, variant: _variant = 'web' }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const text = getCanvasText(language);
  const updateResolution = (field: 'canvasWidth' | 'canvasHeight', next: number) => {
    const rounded = Math.round(next);
    if (!value.canvasRatioLocked) return onChange({ [field]: rounded });
    const canvasWidth = field === 'canvasWidth' ? rounded : value.canvasWidth;
    const canvasHeight = field === 'canvasHeight' ? rounded : value.canvasHeight;
    const ratio = approximateRatio(canvasWidth, canvasHeight);
    onChange({
      [field]: rounded,
      canvasRatioWidth: ratio.width,
      canvasRatioHeight: ratio.height,
    });
  };
  const updateRatio = (field: 'canvasRatioWidth' | 'canvasRatioHeight', next: number) => {
    const rounded = Math.max(1, Math.round(next));
    if (!value.canvasRatioLocked) return onChange({ [field]: rounded });
    if (field === 'canvasRatioWidth') {
      onChange({
        canvasRatioWidth: rounded,
        canvasWidth: Math.min(7680, Math.max(320, Math.round(value.canvasHeight * rounded / Math.max(1, value.canvasRatioHeight)))),
      });
      return;
    }
    onChange({
      canvasRatioHeight: rounded,
      canvasHeight: Math.min(4320, Math.max(180, Math.round(value.canvasWidth * rounded / Math.max(1, value.canvasRatioWidth)))),
    });
  };
  const applyCommonRatio = (ratioWidth: number, ratioHeight: number) => {
    onChange({
      canvasRatioWidth: ratioWidth,
      canvasRatioHeight: ratioHeight,
      canvasHeight: Math.min(
        4320,
        Math.max(180, Math.round(value.canvasWidth * ratioHeight / ratioWidth)),
      ),
    });
  };

  return (
    <section className="relative rounded-[22px] bg-rose-50 p-3 dark:bg-rose-950/25">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
        <div className="flex h-10 min-w-0 items-center gap-2 rounded-xl bg-rose-100 px-3 text-sm font-bold text-slate-900 dark:bg-white/5 dark:text-[var(--vr-text)]">
          <CanvasGlyph />
          <span className="truncate">{text.title}</span>
        </div>
        <Segmented value={value.layoutMode} options={[["classic", text.split], ["immersive", text.merged]]} onChange={(layoutMode) => onChange({ layoutMode: layoutMode as SharedCanvasSettings['layoutMode'] })} />
        <button type="button" onClick={() => setCollapsed((current) => !current)} className="grid h-10 w-11 place-items-center rounded-xl bg-rose-100 text-slate-900 dark:bg-white/5 dark:text-[var(--vr-text)]" title={collapsed ? text.expand : text.collapse} aria-expanded={!collapsed}>
          <ChevronDown className={`h-5 w-5 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {!collapsed && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
            <DragNumber label={text.width} icon={MoveHorizontal} value={value.canvasWidth} min={320} max={7680} onChange={(next) => updateResolution('canvasWidth', next)} />
            <DragNumber label={text.height} icon={MoveVertical} value={value.canvasHeight} min={180} max={4320} onChange={(next) => updateResolution('canvasHeight', next)} />
            <div className="h-9 w-11" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
            <CompactRatioControl
              label={`${text.ratioWidth} / ${text.ratioHeight}`}
              width={value.canvasRatioWidth}
              height={value.canvasRatioHeight}
              locked={value.canvasRatioLocked}
              lockLabel={text.lockRatio}
              onWidthChange={(next) => updateRatio('canvasRatioWidth', next)}
              onHeightChange={(next) => updateRatio('canvasRatioHeight', next)}
              onToggleLock={() => onChange({ canvasRatioLocked: !value.canvasRatioLocked })}
            />
            <CommonRatioSelect
              language={language}
              width={value.canvasRatioWidth}
              height={value.canvasRatioHeight}
              onChange={applyCommonRatio}
            />
            <div className="h-9 w-11" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
            <SettingToggle label={text.skipSingle} icon={value.skipSingleChoicePopup ? EyeOff : Eye} active={value.skipSingleChoicePopup} onClick={() => onChange({ skipSingleChoicePopup: !value.skipSingleChoicePopup })} />
            <ChoicePosition label={text.choicePosition} labels={[text.top, text.middle, text.bottom]} value={value.choicesPosition} onChange={(choicesPosition) => onChange({ choicesPosition })} />
            <div className="h-9 w-11" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
            <SettingToggle label={text.autoAdvance} icon={value.autoAdvance ? FastForward : PlayCircle} active={value.autoAdvance} onClick={() => onChange({ autoAdvance: !value.autoAdvance })} />
            <SettingToggle label={text.videoAutoplay} icon={Video} active={value.videoAutoPlay} onClick={() => onChange({ videoAutoPlay: !value.videoAutoPlay })} />
            <div className="h-9 w-11" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
            <TagToggle label={text.hideCharacterTags} kind="character" active={value.hideCharacterTags} onClick={() => onChange({ hideCharacterTags: !value.hideCharacterTags })} />
            <TagToggle label={text.hideSceneTags} kind="scene" active={value.hideSceneTags} onClick={() => onChange({ hideSceneTags: !value.hideSceneTags })} />
            <div className="h-9 w-11" aria-hidden="true" />
          </div>
        </div>
      )}
    </section>
  );
}

const COMMON_RATIOS = [
  [16, 9],
  [4, 3],
  [3, 2],
  [21, 9],
  [1, 1],
  [9, 16],
] as const;

function CompactRatioControl({ label, width, height, locked, lockLabel, onWidthChange, onHeightChange, onToggleLock }: { label: string; width: number; height: number; locked: boolean; lockLabel: string; onWidthChange: (value: number) => void; onHeightChange: (value: number) => void; onToggleLock: () => void }) {
  return (
    <div className="space-y-1">
      <div className="truncate px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{label}</div>
      <div className="grid h-9 grid-cols-[minmax(0,1fr)_12px_minmax(0,1fr)_36px] items-center overflow-hidden rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text)]">
        <input type="number" min={1} max={100} value={width} onChange={(event) => onWidthChange(Number(event.target.value) || 1)} className="min-w-0 bg-transparent px-2 text-right text-sm tabular-nums outline-none" aria-label={label} />
        <span className="text-center text-sm text-[var(--vr-text-muted)]">:</span>
        <input type="number" min={1} max={100} value={height} onChange={(event) => onHeightChange(Number(event.target.value) || 1)} className="min-w-0 bg-transparent px-2 text-left text-sm tabular-nums outline-none" aria-label={label} />
        <button type="button" onClick={onToggleLock} className={`grid h-9 place-items-center border-l border-[var(--vr-border)] transition-colors ${locked ? 'bg-[var(--vr-accent)] text-white' : 'text-[var(--vr-text-muted)] hover:bg-white/5'}`} title={lockLabel} aria-pressed={locked}>
          {locked ? <Link className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function CommonRatioSelect({ language, width, height, onChange }: { language: Language; width: number; height: number; onChange: (width: number, height: number) => void }) {
  const label = language === 'zh' ? '常用比例' : language === 'ja' ? '一般的な比率' : 'Common ratios';
  const current = COMMON_RATIOS.some(([w, h]) => w === width && h === height) ? `${width}:${height}` : '';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div ref={rootRef} className="relative space-y-1">
      <div className="truncate px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{label}</div>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-9 w-full items-center gap-2 rounded-lg bg-[var(--vr-surface-soft)] px-3 text-sm text-[var(--vr-text)]" aria-label={label} aria-expanded={open}>
        <RatioCard width={width} height={height} />
        <span className="min-w-0 flex-1 truncate text-left">{current || `${width}:${height}`}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--vr-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {COMMON_RATIOS.map(([ratioWidth, ratioHeight]) => {
            const selected = ratioWidth === width && ratioHeight === height;
            return (
              <button key={`${ratioWidth}:${ratioHeight}`} type="button" onClick={() => { onChange(ratioWidth, ratioHeight); setOpen(false); }} className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors ${selected ? 'bg-[var(--vr-accent)] text-white' : 'text-[var(--vr-text)] hover:bg-[var(--vr-surface-soft)]'}`} aria-pressed={selected}>
                <RatioCard width={ratioWidth} height={ratioHeight} selected={selected} />
                <span className="font-medium tabular-nums">{ratioWidth}:{ratioHeight}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RatioCard({ width, height, selected = false }: { width: number; height: number; selected?: boolean }) {
  const landscape = width >= height;
  const longSide = 22;
  const shortSide = Math.max(8, Math.round(longSide * Math.min(width, height) / Math.max(width, height)));
  return (
    <span className="grid h-6 w-7 shrink-0 place-items-center" aria-hidden="true">
      <span className={`rounded-[2px] border-[1.5px] ${selected ? 'border-white' : 'border-[var(--vr-text-muted)]'}`} style={{ width: landscape ? longSide : shortSide, height: landscape ? shortSide : longSide }} />
    </span>
  );
}

function approximateRatio(width: number, height: number) {
  const target = Math.max(1, width) / Math.max(1, height);
  let best = { width: 1, height: 1, error: Number.POSITIVE_INFINITY };
  for (let ratioHeight = 1; ratioHeight <= 100; ratioHeight += 1) {
    const ratioWidth = Math.round(target * ratioHeight);
    if (ratioWidth < 1 || ratioWidth > 100) continue;
    const error = Math.abs(ratioWidth / ratioHeight - target);
    if (error < best.error) best = { width: ratioWidth, height: ratioHeight, error };
  }
  return { width: best.width, height: best.height };
}

function DragNumber({ label, icon: Icon, value, min, max, onChange, connected }: { label: string; icon?: LucideIcon; value: number; min: number; max: number; onChange: (value: number) => void; connected?: 'left' | 'right' }) {
  const start = useRef<{ x: number; value: number } | null>(null);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next))));
  const radius = connected === 'right' ? 'rounded-l-lg' : connected === 'left' ? 'rounded-r-lg' : 'rounded-lg';
  return (
    <div className="space-y-1">
      <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{label}</div>
      <div className={`grid h-9 items-center overflow-hidden bg-[var(--vr-surface-soft)] ${radius} ${Icon ? 'grid-cols-[28px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        {Icon && <div className="flex h-full items-center justify-center text-[var(--vr-text-muted)]"><Icon className="h-3.5 w-3.5" /></div>}
        <div className="flex h-full cursor-ew-resize select-none items-center justify-end px-3 text-[var(--vr-text)] hover:bg-white/5" onPointerDown={(event) => { if ((event.target as HTMLElement).tagName === 'INPUT') return; start.current = { x: event.clientX, value }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (start.current) commit(start.current.value + event.clientX - start.current.x); }} onPointerUp={() => { start.current = null; }}>
          <input value={draft} inputMode="numeric" onChange={(event) => setDraft(event.target.value)} onBlur={() => commit(Number(draft))} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="w-full bg-transparent text-right text-sm font-normal tabular-nums outline-none" />
        </div>
      </div>
    </div>
  );
}

function SettingToggle({ label, icon: Icon, active, onClick }: { label: string; icon: LucideIcon; active: boolean; onClick: () => void }) {
  return (
    <div className="space-y-1">
      <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{label}</div>
      <div className="grid h-9 grid-cols-[28px_minmax(0,1fr)] items-center overflow-hidden rounded-lg bg-[var(--vr-surface-soft)]">
        <div className="flex h-full items-center justify-center text-[var(--vr-text-muted)]"><Icon className="h-3.5 w-3.5" /></div>
        <button type="button" onClick={onClick} className={`flex h-9 w-full items-center justify-center transition-colors ${active ? 'bg-[var(--vr-accent)] text-white' : 'text-[var(--vr-text-soft)] hover:bg-white/5'}`} aria-pressed={active} title={label}>
          {active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function ChoicePosition({ label, labels, value, onChange }: { label: string; labels: string[]; value: SharedCanvasSettings['choicesPosition']; onChange: (value: SharedCanvasSettings['choicesPosition']) => void }) {
  const options: SharedCanvasSettings['choicesPosition'][] = ['aboveText', 'center', 'belowText'];
  return (
    <div className="space-y-1">
      <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{label}</div>
      <div className="grid h-9 grid-cols-[28px_minmax(0,1fr)] overflow-hidden rounded-lg bg-[var(--vr-surface-soft)]">
        <div className="flex items-center justify-center text-[var(--vr-text-muted)]"><PanelTop className="h-3.5 w-3.5" /></div>
        <div className="grid grid-cols-3">{options.map((option, index) => <button type="button" key={option} onClick={() => onChange(option)} className={`text-[10px] font-black ${value === option ? 'bg-[var(--vr-accent)] text-white' : 'text-[var(--vr-text-soft)]'}`}>{labels[index]}</button>)}</div>
      </div>
    </div>
  );
}

function TagToggle({ label, kind, active, onClick }: { label: string; kind: 'character' | 'scene'; active: boolean; onClick: () => void }) {
  return (
    <div className="space-y-1">
      <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{label}</div>
      <div className="grid h-9 grid-cols-[28px_minmax(0,1fr)] items-center overflow-hidden rounded-lg bg-[var(--vr-surface-soft)]">
        <div className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">{kind === 'character' ? <CharacterTagGlyph /> : <SceneTagGlyph />}</div>
        <button type="button" title={label} onClick={onClick} className={`flex h-9 w-full items-center justify-center transition-colors ${active ? 'bg-[var(--vr-accent)] text-white' : 'text-[var(--vr-text-soft)] hover:bg-white/5'}`} aria-pressed={active}>{active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
      </div>
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: string[][]; onChange: (value: string) => void }) {
  return <div className={`grid h-10 grid-cols-2 overflow-hidden rounded-xl bg-white dark:bg-[var(--vr-surface-soft)]`}>{options.map(([option, label]) => <button type="button" key={option} onClick={() => onChange(option)} className={`grid h-10 min-w-0 place-items-center text-[10px] font-black ${value === option ? 'bg-[var(--vr-accent)] text-white' : 'text-[var(--vr-text-soft)]'}`} aria-pressed={value === option} title={label}>{option === 'classic' ? <MoveHorizontal className="h-4 w-4" /> : <Link className="h-4 w-4" />}</button>)}</div>;
}

function CanvasGlyph() { return <span className="relative inline-flex h-4 w-4 items-center justify-center"><span className="h-3 w-4 rounded-[2px] border-[1.5px] border-current" /><span className="absolute bottom-0 h-[1.5px] w-1.5 rounded-full bg-current" /></span>; }
function CharacterTagGlyph() { return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"><path d="M8 4.5h8a2.5 2.5 0 0 1 2.5 2.5v10A2.5 2.5 0 0 1 16 19.5H8A2.5 2.5 0 0 1 5.5 17V7A2.5 2.5 0 0 1 8 4.5Z" /><circle cx="12" cy="10" r="2" /><path d="M8.5 16c.9-1.8 2.1-2.7 3.5-2.7s2.6.9 3.5 2.7" /></svg>; }
function SceneTagGlyph() { return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9"><rect x="4.5" y="5" width="15" height="14" rx="2.5" /><circle cx="9" cy="9.5" r="1.4" /><path d="M6.5 16l3.5-3.4 2.7 2.6 1.5-1.5 3.3 2.3" /></svg>; }
