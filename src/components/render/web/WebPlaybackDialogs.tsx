import { useEffect, useRef } from 'react';
import type { Language } from '../../../lib/i18n';
import type { PlayerSettingsValues } from './playerSettingsPanel';
import {
  playbackSettingButtonConfig,
  type PlayerSettingsPanelConfig,
} from './playerSettingsPanelConfig';
import { PlayerSettingsPanel } from './WebPlayerSettingsPanel';
import {
  mountWebEnding,
  mountWebHistory,
  webPlaybackCopy,
  type WebHistoryEntry,
} from './webPlaybackUi';

export function WebPlaybackSettings({
  language,
  role,
  config,
  values,
  defaults,
  onChange,
  onClose,
}: {
  language: Language;
  role: string;
  config?: PlayerSettingsPanelConfig;
  values: PlayerSettingsValues;
  defaults: PlayerSettingsValues;
  onChange: (patch: Partial<PlayerSettingsValues>) => void;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    host.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      ref={host}
      className="gw-playback-settings"
      role="dialog"
      aria-modal="true"
      aria-label={
        language === 'zh' ? '播放设置' : language === 'ja' ? '再生設定' : 'Playback settings'
      }
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled)',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <PlayerSettingsPanel
        language={language}
        config={playbackSettingButtonConfig(config, role)}
        values={values}
        defaults={defaults}
        elements={[]}
        onChange={onChange}
        onClose={onClose}
      />
    </div>
  );
}

export function WebDialogueHistory({
  entries,
  language,
  onClose,
  onJump,
  onAudio,
}: {
  entries: WebHistoryEntry[];
  language: Language;
  onClose: () => void;
  onJump: (index: number) => void;
  onAudio: (index: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onClose, onJump, onAudio });
  callbacks.current = { onClose, onJump, onAudio };
  const latestEntries = useRef(entries);
  latestEntries.current = entries;
  useEffect(
    () =>
      mountWebHistory(
        host.current!,
        latestEntries.current,
        webPlaybackCopy(language),
        () => callbacks.current.onClose(),
        (index) => callbacks.current.onJump(index),
        (index) => callbacks.current.onAudio(index),
      ),
    [language],
  );
  return <div ref={host} />;
}

export function WebStoryEnding({
  language,
  hasMenu,
  onRestart,
  onClose,
}: {
  language: Language;
  hasMenu: boolean;
  onRestart: () => void;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onRestart, onClose });
  callbacks.current = { onRestart, onClose };
  useEffect(
    () =>
      mountWebEnding(
        host.current!,
        webPlaybackCopy(language),
        hasMenu,
        () => callbacks.current.onRestart(),
        () => callbacks.current.onClose(),
      ),
    [language, hasMenu],
  );
  return <div ref={host} />;
}
