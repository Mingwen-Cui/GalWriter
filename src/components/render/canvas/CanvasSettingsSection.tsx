import {
  ChevronDown,
  Eye,
  EyeOff,
  Link,
  Link2Off,
  MonitorPlay,
  PanelTop,
  Tags,
  Video,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import type { SharedCanvasSettings } from './canvasSettings';

type Props = {
  language: Language;
  value: SharedCanvasSettings;
  onChange: (patch: Partial<SharedCanvasSettings>) => void;
};

const copy = (language: Language, zh: string, ja: string, en: string) =>
  language === 'zh' ? zh : language === 'ja' ? ja : en;

export function CanvasSettingsSection({ language, value, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const updateResolution = (field: 'canvasWidth' | 'canvasHeight', next: number) => {
    const rounded = Math.round(next);
    if (!value.canvasRatioLocked) return onChange({ [field]: rounded });
    const ratio = value.canvasRatioWidth / Math.max(1, value.canvasRatioHeight);
    onChange(
      field === 'canvasWidth'
        ? { canvasWidth: rounded, canvasHeight: Math.round(rounded / ratio) }
        : { canvasHeight: rounded, canvasWidth: Math.round(rounded * ratio) },
    );
  };

  return (
    <section className="overflow-hidden rounded-xl border border-rose-300/35 bg-rose-50/10 shadow-sm dark:border-rose-300/20 dark:bg-rose-400/[0.04]">
      <div className="grid grid-cols-[1fr_auto_36px] items-center gap-2 border-b border-rose-300/20 bg-rose-200/15 px-2 py-2 dark:bg-rose-300/[0.06]">
        <div className="px-1 text-xs font-black text-rose-500 dark:text-rose-300">
          {copy(language, '画布', 'キャンバス', 'Canvas')}
        </div>
        <Segmented
          value={value.layoutMode}
          options={[
            ['classic', copy(language, '图文分离', '分離', 'Split')],
            ['immersive', copy(language, '图文合并', '統合', 'Merged')],
          ]}
          onChange={(layoutMode) => onChange({ layoutMode: layoutMode as SharedCanvasSettings['layoutMode'] })}
        />
        <button type="button" onClick={() => setCollapsed((current) => !current)} className="grid h-9 w-9 place-items-center rounded-lg bg-rose-200/25 text-rose-500 transition-colors hover:bg-rose-200/45 dark:text-rose-300" aria-label="Toggle canvas section">
          <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>
      </div>
      {!collapsed && (
        <div className="space-y-2 p-2">
          <div className="grid grid-cols-2 gap-2">
            <DragNumber label={copy(language, '宽度分辨率', '幅', 'Width')} value={value.canvasWidth} min={320} max={7680} onChange={(next) => updateResolution('canvasWidth', next)} />
            <DragNumber label={copy(language, '高度分辨率', '高さ', 'Height')} value={value.canvasHeight} min={180} max={4320} onChange={(next) => updateResolution('canvasHeight', next)} />
          </div>
          <div className="grid grid-cols-[1fr_42px_1fr] items-center gap-0">
            <DragNumber label={copy(language, '宽度比例', '横比率', 'Ratio W')} value={value.canvasRatioWidth} min={1} max={100} onChange={(canvasRatioWidth) => onChange({ canvasRatioWidth })} connected="right" />
            <button type="button" onClick={() => onChange({ canvasRatioLocked: !value.canvasRatioLocked })} className={`relative z-10 grid h-10 w-10 place-items-center justify-self-center rounded-lg border transition-colors ${value.canvasRatioLocked ? 'border-rose-400 bg-rose-400 text-white shadow-sm shadow-rose-300/30' : 'border-rose-300/35 bg-white text-rose-400 dark:bg-slate-900'}`} title={copy(language, '锁定宽高比', '縦横比を固定', 'Lock aspect ratio')}>
              {value.canvasRatioLocked ? <Link className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
            </button>
            <DragNumber label={copy(language, '高度比例', '縦比率', 'Ratio H')} value={value.canvasRatioHeight} min={1} max={100} onChange={(canvasRatioHeight) => onChange({ canvasRatioHeight })} connected="left" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Toggle icon={value.skipSingleChoicePopup ? EyeOff : Eye} label={copy(language, '单选自动跳过', '単一選択を省略', 'Skip single choice')} active={value.skipSingleChoicePopup} onClick={() => onChange({ skipSingleChoicePopup: !value.skipSingleChoicePopup })} />
            <Labeled label={copy(language, '选项位置', '選択肢位置', 'Choice position')} icon={<PanelTop className="h-3.5 w-3.5" />}>
              <Segmented value={value.choicesPosition} options={[["aboveText", copy(language, '上', '上', 'Top')], ["center", copy(language, '中', '中', 'Mid')], ["belowText", copy(language, '下', '下', 'Bot')]]} onChange={(choicesPosition) => onChange({ choicesPosition: choicesPosition as SharedCanvasSettings['choicesPosition'] })} compact />
            </Labeled>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Toggle icon={MonitorPlay} label={copy(language, '自动翻页', '自動進行', 'Auto advance')} active={value.autoAdvance} onClick={() => onChange({ autoAdvance: !value.autoAdvance })} />
            <Toggle icon={Video} label={copy(language, '视频自动播放', '動画自動再生', 'Video autoplay')} active={value.videoAutoPlay} onClick={() => onChange({ videoAutoPlay: !value.videoAutoPlay })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Toggle icon={Tags} label={copy(language, '隐藏人物标签', '人物タグを隠す', 'Hide character tags')} active={value.hideCharacterTags} onClick={() => onChange({ hideCharacterTags: !value.hideCharacterTags })} />
            <Toggle icon={Tags} label={copy(language, '隐藏场景标签', 'シーンタグを隠す', 'Hide scene tags')} active={value.hideSceneTags} onClick={() => onChange({ hideSceneTags: !value.hideSceneTags })} />
          </div>
        </div>
      )}
    </section>
  );
}

function DragNumber({ label, value, min, max, onChange, connected }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; connected?: 'left' | 'right' }) {
  const start = useRef<{ x: number; value: number } | null>(null);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next))));
  return (
    <label className={`relative flex h-12 min-w-0 cursor-ew-resize items-center gap-2 border border-rose-300/25 bg-white px-3 text-rose-950 shadow-sm dark:bg-slate-900 dark:text-rose-100 ${connected === 'right' ? 'rounded-l-xl border-r-0' : connected === 'left' ? 'rounded-r-xl border-l-0' : 'rounded-xl'}`} onPointerDown={(event) => { if ((event.target as HTMLElement).tagName === 'INPUT') return; start.current = { x: event.clientX, value }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!start.current) return; commit(start.current.value + (event.clientX - start.current.x)); }} onPointerUp={() => { start.current = null; }}>
      <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-rose-400">{label}</span>
      <input value={draft} inputMode="numeric" onChange={(event) => setDraft(event.target.value)} onBlur={() => commit(Number(draft))} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="w-16 bg-transparent text-right text-sm font-black outline-none" />
    </label>
  );
}

function Toggle({ icon: Icon, label, active, onClick }: { icon: typeof Eye; label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex h-11 min-w-0 items-center gap-2 rounded-xl border px-3 text-left text-[11px] font-black transition-colors ${active ? 'border-rose-400/60 bg-rose-400 text-white' : 'border-rose-300/25 bg-white text-slate-500 hover:bg-rose-50 dark:bg-slate-900 dark:text-slate-300'}`}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></button>;
}

function Labeled({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-xl border border-rose-300/25 bg-white p-1.5 dark:bg-slate-900"><div className="mb-1 flex items-center gap-1 px-1 text-[9px] font-bold text-rose-400">{icon}{label}</div>{children}</div>;
}

function Segmented({ value, options, onChange, compact = false }: { value: string; options: string[][]; onChange: (value: string) => void; compact?: boolean }) {
  return <div className={`grid overflow-hidden rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} ${compact ? 'h-7' : 'h-9'}`}>{options.map(([option, label]) => <button type="button" key={option} onClick={() => onChange(option)} className={`min-w-0 rounded-md px-2 text-[10px] font-black transition-colors ${value === option ? 'bg-rose-400 text-white shadow-sm' : 'text-slate-500 hover:text-rose-500 dark:text-slate-300'}`}>{label}</button>)}</div>;
}
