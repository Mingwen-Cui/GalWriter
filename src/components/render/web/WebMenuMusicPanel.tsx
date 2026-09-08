import { Music2, Pause, Play, Upload, Trash2 } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import type { Language } from '../../../lib/i18n';
import type { WebExportSettings } from '../video/shared/types';
import { InspectorGroup } from '../shared/inspectors/InspectorControls';

type Props = {
  language: Language;
  settings: WebExportSettings;
  surface: 'start' | 'archive' | 'settings';
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
  showDescriptions?: boolean;
};
export function WebMenuMusicPanel({
  language,
  settings,
  surface,
  updateWebSettings: update,
}: Props) {
  const t = (zh: string, en: string, ja = en) =>
    language === 'zh' ? zh : language === 'ja' ? ja : en;
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const enabled =
    surface === 'start' ||
    (surface === 'archive'
      ? settings.startMenuMusicApplyToArchive
      : settings.startMenuMusicApplyToSettings);
  const setEnabled = (value: boolean) => {
    if (surface === 'archive') update('startMenuMusicApplyToArchive', value);
    if (surface === 'settings') update('startMenuMusicApplyToSettings', value);
  };
  useEffect(() => {
    if (audio.current)
      audio.current.volume = Math.max(0, Math.min(1, settings.startMenuMusicVolume / 100));
  }, [settings.startMenuMusicVolume]);
  useEffect(() => {
    setPlaying(false);
    setError('');
  }, [settings.startMenuBackgroundMusicUrl]);
  return (
    <InspectorGroup
      title={t('背景音乐', 'Background music', 'BGM')}
      icon={<Music2 size={14} />}
      tone="extra"
      secondary={null}
      titleActive={enabled}
      onTitleClick={surface === 'start' ? undefined : () => setEnabled(!enabled)}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--vr-surface-soft)] p-2">
          <button
            type="button"
            className="property-enable"
            disabled={!settings.startMenuBackgroundMusicUrl}
            aria-label={playing ? t('暂停试听', 'Pause') : t('试听', 'Preview')}
            onClick={async () => {
              if (!audio.current) return;
              if (playing) audio.current.pause();
              else
                try {
                  await audio.current.play();
                } catch {
                  setError(
                    t('无法播放此音频，请更换文件', 'Cannot play this audio. Choose another file.'),
                  );
                }
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <span className="min-w-0 flex-1 truncate text-xs">
            {settings.startMenuBackgroundMusicUrl
              ? t('已选择音乐', 'Music selected')
              : t('未添加音乐', 'No music')}
          </span>
          <label
            className="property-add cursor-pointer"
            title={t('上传或替换', 'Upload or replace')}
          >
            <Upload size={14} />
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () =>
                    update('startMenuBackgroundMusicUrl', String(reader.result || ''));
                  reader.readAsDataURL(file);
                }
                e.currentTarget.value = '';
              }}
            />
          </label>
          <button
            type="button"
            className="property-add"
            disabled={!settings.startMenuBackgroundMusicUrl}
            aria-label={t('移除音乐', 'Remove music')}
            onClick={() => update('startMenuBackgroundMusicUrl', '')}
          >
            <Trash2 size={14} />
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-500">
            {error}
          </p>
        )}
        <label className="block text-xs">
          <span className="flex justify-between">
            <span>{t('音量', 'Volume')}</span>
            <span>{settings.startMenuMusicVolume}%</span>
          </span>
          <input
            aria-label={t('音量', 'Volume')}
            type="range"
            min={0}
            max={100}
            value={settings.startMenuMusicVolume}
            className="mt-2 w-full accent-indigo-600"
            onChange={(e) => update('startMenuMusicVolume', Number(e.target.value))}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['startMenuMusicFadeIn', 'startMenuMusicFadeOut'] as const).map((key, i) => (
            <label key={key} className="text-xs text-[var(--vr-text-muted)]">
              {i === 0 ? t('淡入 · 秒', 'Fade in · s') : t('淡出 · 秒', 'Fade out · s')}
              <input
                type="number"
                className="property-select mt-1"
                min={0}
                max={10}
                step={0.5}
                value={settings[key]}
                onChange={(e) =>
                  update(key, Math.min(10, Math.max(0, Number(e.target.value) || 0)))
                }
              />
            </label>
          ))}
        </div>
        <label className="flex items-center justify-between text-xs">
          {t('循环播放', 'Loop playback')}
          <input
            type="checkbox"
            role="switch"
            checked={settings.startMenuMusicLoop}
            onChange={(e) => update('startMenuMusicLoop', e.target.checked)}
          />
        </label>
        {surface === 'start' && (
          <div className="space-y-2 border-t border-[var(--vr-border)] pt-2">
            {(['startMenuMusicApplyToSettings', 'startMenuMusicApplyToArchive'] as const).map(
              (key, i) => (
                <label key={key} className="flex items-center justify-between text-xs">
                  {i === 0
                    ? t('设置页沿用音乐', 'Use on settings page')
                    : t('存档页沿用音乐', 'Use on save page')}
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => update(key, e.target.checked)}
                  />
                </label>
              ),
            )}
          </div>
        )}
        <audio
          ref={audio}
          src={settings.startMenuBackgroundMusicUrl || undefined}
          loop={settings.startMenuMusicLoop}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>
    </InspectorGroup>
  );
}
