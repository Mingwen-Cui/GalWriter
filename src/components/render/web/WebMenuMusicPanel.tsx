import { formatWebText } from './i18n';
import { ChevronDown, Music2, Repeat2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import type { WebExportSettings } from '../video/shared/types';

type WebMenuMusicPanelProps = {
  language: Language;
  settings: WebExportSettings;
  surface: 'start' | 'archive' | 'settings';
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
  showDescriptions?: boolean;
};

const readAudioFileAsDataUrl = (file: File, onReady: (value: string) => void) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') onReady(reader.result);
  };
  reader.readAsDataURL(file);
};

export function WebMenuMusicPanel({
  language,
  settings,
  surface,
  updateWebSettings,
  showDescriptions = false,
}: WebMenuMusicPanelProps) {
  const hasMusic = Boolean(settings.startMenuBackgroundMusicUrl);
  const [expanded, setExpanded] = useState(true);
  const volumeDb =
    settings.startMenuMusicVolume <= 0
      ? '-∞'
      : (20 * Math.log10(settings.startMenuMusicVolume / 100)).toFixed(1);
  const pageEnabled =
    surface === 'start'
      ? true
      : surface === 'archive'
        ? settings.startMenuMusicApplyToArchive
        : settings.startMenuMusicApplyToSettings;
  const setPageEnabled = (enabled: boolean) => {
    if (surface === 'archive') updateWebSettings('startMenuMusicApplyToArchive', enabled);
    if (surface === 'settings') updateWebSettings('startMenuMusicApplyToSettings', enabled);
  };
  const headerDescription = (label?: string) =>
    showDescriptions ? (
      <div className="mb-1 h-4 px-1 text-[10px] leading-4 text-slate-500">{label || '\u00a0'}</div>
    ) : null;

  return (
    <section className="relative rounded-[22px] bg-sky-50 p-3 dark:bg-sky-500/[0.08]">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
        <div>
          {headerDescription(formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText49'))}
          <button
            type="button"
            disabled={surface === 'start'}
            onClick={() => setPageEnabled(!pageEnabled)}
            aria-pressed={pageEnabled}
            className={`flex h-10 w-full min-w-0 items-center gap-2 rounded-xl px-3 text-left text-sm font-bold transition-colors ${
              pageEnabled
                ? 'bg-[var(--vr-accent)] text-white'
                : 'bg-sky-100 text-slate-900 hover:bg-sky-200 dark:bg-sky-400/15 dark:text-sky-50 dark:hover:bg-sky-400/25'
            } ${surface === 'start' ? 'cursor-default' : ''}`}
          >
            <Music2 className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">
              {formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText62')}
            </span>
          </button>
        </div>
        <div>
          {headerDescription(formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText66'))}
          <button
            type="button"
            className="flex h-10 w-full min-w-0 items-center gap-2 rounded-xl bg-sky-100 px-3 text-left text-sm font-bold text-slate-900 dark:bg-sky-400/15 dark:text-sky-50"
            title={formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText70')}
            aria-label={formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText71')}
          >
            <span className="min-w-0 truncate">
              {formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText73')}
            </span>
            <span className="ml-auto shrink-0 tabular-nums text-xs font-medium">{volumeDb} dB</span>
          </button>
        </div>
        <div>
          {headerDescription()}
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="grid h-10 w-11 place-items-center rounded-xl bg-sky-100 text-slate-900 dark:bg-sky-400/15 dark:text-sky-50"
            title={expanded ? 'Collapse' : 'Expand'}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            aria-expanded={expanded}
          >
            <ChevronDown
              className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className={`mt-3 grid gap-2.5 ${pageEnabled ? '' : 'pointer-events-none opacity-45'}`}>
          <div className="grid grid-cols-[minmax(0,1fr)_40px_40px] gap-2">
            {hasMusic ? (
              <div className="flex h-10 min-w-0 overflow-hidden rounded-xl bg-white text-slate-950 dark:bg-[var(--vr-surface)] dark:text-[var(--vr-text)]">
                <button
                  type="button"
                  onClick={() => updateWebSettings('startMenuBackgroundMusicUrl', '')}
                  className="grid h-10 w-10 shrink-0 place-items-center text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:text-[var(--vr-text-muted)]"
                  title={formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText101')}
                  aria-label={formatWebText(
                    language,
                    'componentsrenderwebWebMenuMusicPanelText102',
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <label className="flex h-10 min-w-0 flex-1 cursor-pointer items-center px-2 text-sm font-medium transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
                  <span className="min-w-0 flex-1 truncate">
                    {formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText107')}
                  </span>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3,.mp3"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file)
                        readAudioFileAsDataUrl(file, (value) =>
                          updateWebSettings('startMenuBackgroundMusicUrl', value),
                        );
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            ) : (
              <label className="flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-50 dark:bg-[var(--vr-surface)] dark:text-[var(--vr-text)] dark:hover:bg-white/5">
                <Music2 className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-[var(--vr-text-muted)]" />
                <span className="min-w-0 flex-1 truncate">
                  {formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText123')}
                </span>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,.mp3"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file)
                      readAudioFileAsDataUrl(file, (value) =>
                        updateWebSettings('startMenuBackgroundMusicUrl', value),
                      );
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => updateWebSettings('startMenuMusicLoop', !settings.startMenuMusicLoop)}
              aria-pressed={settings.startMenuMusicLoop}
              className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
                settings.startMenuMusicLoop
                  ? 'bg-[var(--vr-accent)] text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-[var(--vr-surface)] dark:text-[var(--vr-text-muted)] dark:hover:bg-white/5'
              }`}
              title={formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText145')}
              aria-label={formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText146')}
            >
              <Repeat2 className="h-4 w-4" />
            </button>
            <span className="h-10 w-10" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2">
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <MusicValueControl
                label={formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText156')}
                value={settings.startMenuMusicFadeIn}
                min={0}
                max={10}
                step={0.5}
                suffix="s"
                compact
                onChange={(value) => updateWebSettings('startMenuMusicFadeIn', value)}
              />
              <MusicValueControl
                label={formatWebText(language, 'componentsrenderwebWebMenuMusicPanelText166')}
                value={settings.startMenuMusicFadeOut}
                min={0}
                max={10}
                step={0.5}
                suffix="s"
                compact
                onChange={(value) => updateWebSettings('startMenuMusicFadeOut', value)}
              />
            </div>
            <span className="h-10 w-10" aria-hidden="true" />
          </div>
        </div>
      )}
    </section>
  );
}

function MusicValueControl({
  icon,
  label,
  value,
  min,
  max,
  step,
  suffix,
  compact = false,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  compact?: boolean;
  onChange: (value: number) => void;
}) {
  const dragRef = useRef<{ pointerId: number; startX: number; startValue: number } | null>(null);
  const decimals = String(step).includes('.') ? String(step).split('.')[1]?.length || 0 : 0;
  const [draft, setDraft] = useState(value.toFixed(decimals));

  useEffect(() => setDraft(value.toFixed(decimals)), [decimals, value]);

  const normalize = (next: number) => {
    const stepped = Math.round(next / step) * step;
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(decimals));
  };
  const commit = (next: number) => {
    if (Number.isFinite(next)) onChange(normalize(next));
    else setDraft(value.toFixed(decimals));
  };

  return (
    <div
      className={`grid h-10 min-w-0 items-center overflow-hidden rounded-xl bg-white text-slate-950 dark:bg-[var(--vr-surface)] dark:text-[var(--vr-text)] ${compact ? 'grid-cols-[minmax(0,1fr)_60px]' : 'grid-cols-[minmax(0,1fr)_76px]'}`}
    >
      <span className="flex min-w-0 items-center gap-2 px-3 text-sm font-medium">
        {icon && (
          <span className="shrink-0 text-slate-500 dark:text-[var(--vr-text-muted)]">{icon}</span>
        )}
        <span className="truncate">{label}</span>
      </span>
      <div
        className="flex h-full cursor-ew-resize touch-none select-none items-center border-l border-slate-100 px-2 transition-colors hover:bg-sky-50 dark:border-[var(--vr-border)] dark:hover:bg-white/5"
        title="可直接输入，或按住左右拖动调整"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startValue: value,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const delta = Math.round((event.clientX - drag.startX) / 6);
          if (delta !== 0) {
            event.preventDefault();
            commit(drag.startValue + delta * step);
          }
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          inputMode="decimal"
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => commit(Number(draft))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setDraft(value.toFixed(decimals));
          }}
          className="min-w-0 flex-1 bg-transparent text-right text-sm font-medium tabular-nums outline-none"
          aria-label={label}
        />
        <span className="ml-1 text-sm text-slate-400 dark:text-[var(--vr-text-muted)]">
          {suffix}
        </span>
      </div>
    </div>
  );
}
