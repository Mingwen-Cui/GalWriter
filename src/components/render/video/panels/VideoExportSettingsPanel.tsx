import { FolderOpen, Info, Loader2, Mic, Music, Settings, Sparkles, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatVideoText } from '../i18n';

import type { Language } from '../../../../lib/i18n';
import { type SharedCanvasSettings } from '../../canvas/canvasSettings';
import { CanvasSettingsSection } from '../../canvas/CanvasSettingsSection';
import { RangeControl } from '../controls/RenderControls';
import type { ExportSettingsMode, RenderStyle } from '../shared/types';
import { RenderObjectSettingsSection } from './render-object-settings-section';

type VideoExportSettingsPanelProps = {
  language: Language;
  exportPanelWidth: number;
  exportSettingsMode: ExportSettingsMode;
  setExportSettingsMode: (value: ExportSettingsMode) => void;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  selectedSpeechNodeCount: number;
  selectedAudioClipCount: number;
  selectedAudioVolume?: number;
  selectedAudioFadeIn?: number;
  selectedAudioFadeOut?: number;
  updateSelectedAudioSettings: (key: 'volume' | 'fadeIn' | 'fadeOut', value: number) => void;
  audioBusy: boolean;
  audioMessage: string;
  isRecordingVoiceover: boolean;
  generateAudioFromSelectedText: () => void;
  startVoiceoverRecording: () => void;
  stopVoiceoverRecording: () => void;
  assetUploadInputRef: React.RefObject<HTMLInputElement | null>;
  progress: string;
  error: string;
  progressValue: number;
  savedPath: string;
  canvasSettings: SharedCanvasSettings;
  onCanvasSettingsChange: (patch: Partial<SharedCanvasSettings>) => void;
  showCanvasSettings: boolean;
};

export function VideoExportSettingsPanel({
  language,
  exportPanelWidth,
  exportSettingsMode,
  setExportSettingsMode,
  renderStyle,
  updateRenderStyle,
  selectedSpeechNodeCount,
  selectedAudioClipCount,
  selectedAudioVolume = 0,
  selectedAudioFadeIn = 0,
  selectedAudioFadeOut = 0,
  updateSelectedAudioSettings,
  audioBusy,
  audioMessage,
  isRecordingVoiceover,
  generateAudioFromSelectedText,
  startVoiceoverRecording,
  stopVoiceoverRecording,
  assetUploadInputRef,
  progress,
  error,
  progressValue,
  savedPath,
  canvasSettings,
  onCanvasSettingsChange,
  showCanvasSettings,
}: VideoExportSettingsPanelProps) {
  const [showSettingDescriptions, setShowSettingDescriptions] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('galwriter-video-export-setting-descriptions');
    return stored === 'true';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      'galwriter-video-export-setting-descriptions',
      String(showSettingDescriptions),
    );
  }, [showSettingDescriptions]);
  return (
    <aside
      className="ml-auto min-h-0 border-l border-[var(--vr-border)] bg-[var(--vr-surface)] backdrop-blur-xl flex flex-col shrink-0 overflow-hidden"
      style={{ width: exportPanelWidth }}
    >
      <div className="h-12 px-4 border-b border-[var(--vr-border)] flex items-center justify-between gap-3 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
        <div className="min-w-0 flex items-center gap-2">
          <Settings className="h-4 w-4 shrink-0 text-[var(--vr-accent)]" />
          <span className="truncate">
            {formatVideoText(
              language,
              'componentsrendervideopanelsVideoExportSettingsPanelText742',
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowSettingDescriptions((current) => !current)}
            className={`ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
              showSettingDescriptions
                ? 'bg-[var(--vr-surface)] text-[var(--vr-text)] ring-1 ring-[var(--vr-border)]'
                : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
            }`}
            title={
              showSettingDescriptions
                ? formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText753',
                  )
                : formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText754',
                  )
            }
            aria-label={
              showSettingDescriptions
                ? formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText758',
                  )
                : formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText759',
                  )
            }
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex h-8 shrink-0 rounded-lg bg-[var(--vr-surface-soft)] p-0.5">
          {(['video', 'audio'] as ExportSettingsMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setExportSettingsMode(mode)}
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-black transition-colors ${
                exportSettingsMode === mode
                  ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                  : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
              }`}
              title={
                mode === 'video'
                  ? formatVideoText(
                      language,
                      'componentsrendervideopanelsVideoExportSettingsPanelText778',
                    )
                  : formatVideoText(
                      language,
                      'componentsrendervideopanelsVideoExportSettingsPanelText779',
                    )
              }
              aria-pressed={exportSettingsMode === mode}
            >
              {mode === 'video' ? (
                <Video className="h-3.5 w-3.5" />
              ) : (
                <Music className="h-3.5 w-3.5" />
              )}
              {mode === 'video'
                ? formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText788',
                  )
                : formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText788_2',
                  )}
            </button>
          ))}
        </div>
      </div>
      <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {exportSettingsMode === 'video' ? (
          <div className="property-inspector flex flex-col gap-1">
            {showCanvasSettings && (
              <CanvasSettingsSection
                language={language}
                showDescriptions={showSettingDescriptions}
                variant="video"
                value={canvasSettings}
                onChange={onCanvasSettingsChange}
              />
            )}

            <RenderObjectSettingsSection
              language={language}
              renderStyle={renderStyle}
              updateRenderStyle={updateRenderStyle}
              canvasSettings={canvasSettings}
              onCanvasSettingsChange={onCanvasSettingsChange}
              surface="video"
              showDescriptions={showSettingDescriptions}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {formatVideoText(
                  language,
                  'componentsrendervideopanelsVideoExportSettingsPanelText846',
                )}
              </div>
              <div className="space-y-3 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3">
                <p className="text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
                  {selectedAudioClipCount > 0
                    ? formatVideoText(
                        language,
                        'componentsrendervideopanelsVideoExportSettingsPanelText851',
                        selectedAudioClipCount,
                      )
                    : formatVideoText(
                        language,
                        'componentsrendervideopanelsVideoExportSettingsPanelText856',
                      )}
                </p>
                <RangeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText863',
                  )}
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedAudioVolume}
                  valueLabel={`${Math.round(selectedAudioVolume * 100)}%`}
                  disabled={selectedAudioClipCount === 0}
                  onChange={(value) => updateSelectedAudioSettings('volume', value)}
                />
                <RangeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText873',
                  )}
                  min={0}
                  max={10}
                  step={0.1}
                  value={selectedAudioFadeIn}
                  valueLabel={`${Number(selectedAudioFadeIn).toFixed(1)}s`}
                  disabled={selectedAudioClipCount === 0}
                  onChange={(value) => updateSelectedAudioSettings('fadeIn', value)}
                />
                <RangeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText883',
                  )}
                  min={0}
                  max={10}
                  step={0.1}
                  value={selectedAudioFadeOut}
                  valueLabel={`${Number(selectedAudioFadeOut).toFixed(1)}s`}
                  disabled={selectedAudioClipCount === 0}
                  onChange={(value) => updateSelectedAudioSettings('fadeOut', value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {formatVideoText(
                  language,
                  'componentsrendervideopanelsVideoExportSettingsPanelText897',
                )}
              </div>
              <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 space-y-3">
                <p className="text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
                  {formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText901',
                    selectedSpeechNodeCount,
                  )}
                </p>
                <button
                  type="button"
                  onClick={generateAudioFromSelectedText}
                  disabled={audioBusy || selectedSpeechNodeCount === 0}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[var(--vr-accent)] px-3 text-xs font-black text-white transition-colors hover:bg-[var(--vr-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {audioBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText918',
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {formatVideoText(
                  language,
                  'componentsrendervideopanelsVideoExportSettingsPanelText925',
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => assetUploadInputRef.current?.click()}
                  className="flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 text-xs font-black text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {formatVideoText(
                      language,
                      'componentsrendervideopanelsVideoExportSettingsPanelText935',
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={isRecordingVoiceover ? stopVoiceoverRecording : startVoiceoverRecording}
                  className={`flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition-colors ${
                    isRecordingVoiceover
                      ? 'bg-rose-500 text-white hover:bg-rose-600'
                      : 'border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]'
                  }`}
                >
                  <Mic className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {isRecordingVoiceover
                      ? formatVideoText(
                          language,
                          'componentsrendervideopanelsVideoExportSettingsPanelText950',
                        )
                      : formatVideoText(
                          language,
                          'componentsrendervideopanelsVideoExportSettingsPanelText951',
                        )}
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 py-2 text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
              {audioMessage ||
                formatVideoText(
                  language,
                  'componentsrendervideopanelsVideoExportSettingsPanelText959',
                )}
            </div>
          </div>
        )}

        {(progress || error) && (
          <div className="space-y-2">
            {!error && (
              <div className="h-2 rounded-full bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] overflow-hidden">
                <div
                  className="h-full bg-[var(--vr-accent)] transition-all"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            )}
            <p
              className={`text-xs font-bold ${error ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--vr-text-muted)]'}`}
            >
              {error || progress}
            </p>
          </div>
        )}
        {savedPath && (
          <div className="rounded-lg border border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--vr-accent-strong)] break-all">
            {formatVideoText(
              language,
              'componentsrendervideopanelsVideoExportSettingsPanelText987',
            )}
            {savedPath}
          </div>
        )}
      </div>
    </aside>
  );
}
