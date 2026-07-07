import { Music, Trash2, Upload, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Language } from '../../../lib/i18n';
import { renderCopy } from '../video/shared/renderCopy';
import type { WebExportSettings } from '../video/shared/types';

type WebMenuMusicPanelProps = {
  language: Language;
  settings: WebExportSettings;
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
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
  updateWebSettings,
}: WebMenuMusicPanelProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const hasMusic = Boolean(settings.startMenuBackgroundMusicUrl);

  return (
    <div className="grid gap-2 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)]/70 p-2">
      <div className="flex items-center justify-between gap-2">
        <label className="flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-start gap-2 rounded-lg border border-transparent bg-[var(--vr-surface)] px-3 text-left text-[11px] font-bold text-[var(--vr-text-soft)] transition-colors hover:border-indigo-500/25 hover:bg-white/5 hover:text-[var(--vr-text)]">
          <Upload className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">
            {hasMusic
              ? t('更换音乐', 'BGM変更', 'Replace music')
              : t('选择音乐', 'BGM選択', 'Choose music')}
          </span>
          <input
            type="file"
            accept="audio/mpeg,audio/mp3,.mp3"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                readAudioFileAsDataUrl(file, (value) =>
                  updateWebSettings('startMenuBackgroundMusicUrl', value),
                );
              }
              event.currentTarget.value = '';
            }}
          />
        </label>
        {hasMusic && (
          <button
            type="button"
            onClick={() => updateWebSettings('startMenuBackgroundMusicUrl', '')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-500 transition-colors hover:bg-rose-500/15"
            title={t('移除音乐', 'BGM削除', 'Remove music')}
            aria-label={t('移除音乐', 'BGM削除', 'Remove music')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <MusicRange
        icon={<Volume2 className="h-3.5 w-3.5" />}
        label={t('音量', '音量', 'Volume')}
        value={settings.startMenuMusicVolume}
        min={0}
        max={100}
        step={1}
        suffix="%"
        onChange={(value) => updateWebSettings('startMenuMusicVolume', value)}
      />
      <MusicRange
        icon={<Music className="h-3.5 w-3.5" />}
        label={t('淡入', 'フェードイン', 'Fade in')}
        value={settings.startMenuMusicFadeIn}
        min={0}
        max={10}
        step={0.5}
        suffix="s"
        onChange={(value) => updateWebSettings('startMenuMusicFadeIn', value)}
      />
      <MusicRange
        icon={<Music className="h-3.5 w-3.5" />}
        label={t('淡出', 'フェードアウト', 'Fade out')}
        value={settings.startMenuMusicFadeOut}
        min={0}
        max={10}
        step={0.5}
        suffix="s"
        onChange={(value) => updateWebSettings('startMenuMusicFadeOut', value)}
      />

      <div className="grid grid-cols-3 gap-2">
        <ToggleButton
          label={t('循环', 'ループ', 'Loop')}
          active={settings.startMenuMusicLoop}
          onClick={() => updateWebSettings('startMenuMusicLoop', !settings.startMenuMusicLoop)}
        />
        <ToggleButton
          label={t('存档页', 'セーブ画面', 'Save page')}
          active={settings.startMenuMusicApplyToArchive}
          onClick={() =>
            updateWebSettings(
              'startMenuMusicApplyToArchive',
              !settings.startMenuMusicApplyToArchive,
            )
          }
        />
        <ToggleButton
          label={t('设置页', '設定画面', 'Settings')}
          active={settings.startMenuMusicApplyToSettings}
          onClick={() =>
            updateWebSettings(
              'startMenuMusicApplyToSettings',
              !settings.startMenuMusicApplyToSettings,
            )
          }
        />
      </div>
    </div>
  );
}

function MusicRange({
  icon,
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 rounded-lg bg-[var(--vr-surface)] px-3 py-2 text-[11px] text-[var(--vr-text-soft)]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 font-bold">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <span className="font-black text-[var(--vr-text)]">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-2 w-full accent-indigo-500"
      />
    </label>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-lg px-2 text-[11px] font-black transition-colors ${
        active
          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950/15'
          : 'bg-[var(--vr-surface)] text-[var(--vr-text-soft)] hover:text-[var(--vr-text)]'
      }`}
    >
      <span className="block truncate">{label}</span>
    </button>
  );
}
