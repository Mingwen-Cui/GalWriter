import { Cpu, FileDown, FolderOpen, Loader2, Mic, Music, Settings, Sparkles, Video, Zap } from 'lucide-react';

import { DragSizeControl, RangeControl } from '../controls/RenderControls';
import { ENCODER_OPTIONS, EXPORT_FORMAT_OPTIONS, FRAME_RATE_OPTIONS, RESOLUTION_OPTIONS, TEXT_ANIMATION_OPTIONS } from '../shared/constants';
import { clamp } from '../shared/mediaUtils';
import { renderCopy } from '../shared/renderCopy';
import type { ExportFormat, ExportSettingsMode, RenderStatus, RenderStyle, TextAnimation } from '../shared/types';
import { formatSeconds } from '../timeline/timelineUtils';
import type { Language } from '../../../../lib/i18n';

type VideoExportSettingsPanelProps = {
  language: Language;
  exportPanelWidth: number;
  exportSettingsMode: ExportSettingsMode;
  setExportSettingsMode: (value: ExportSettingsMode) => void;
  status: RenderStatus;
  exportFormat: ExportFormat;
  setExportFormat: (value: ExportFormat) => void;
  resolutionIndex: number;
  setResolutionIndex: (value: number) => void;
  frameRate: number;
  setFrameRate: (value: number) => void;
  encoder: string;
  setEncoder: (value: string) => void;
  outputDir: string;
  setOutputDir: (value: string) => void;
  outputDirError: string;
  setOutputDirError: (value: string) => void;
  chooseOutputDir: () => void;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  defaultSeconds: number;
  setDefaultSeconds: (value: number) => void;
  speed: number;
  setSpeed: (value: number) => void;
  estimatedDuration: number;
  fallbackEstimatedSeconds: number;
  animationLeadSeconds: number;
  setAnimationLeadSeconds: (value: number) => void;
  selectedSpeechNodeCount: number;
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
  isDesktopApp: boolean;
  useGpuAcceleration: boolean;
  setUseGpuAcceleration: (value: boolean) => void;
  isWebGPUSupported: boolean;
};

export function VideoExportSettingsPanel({
  language,
  exportPanelWidth,
  exportSettingsMode,
  setExportSettingsMode,
  status,
  exportFormat,
  setExportFormat,
  resolutionIndex,
  setResolutionIndex,
  frameRate,
  setFrameRate,
  encoder,
  setEncoder,
  outputDir,
  setOutputDir,
  outputDirError,
  setOutputDirError,
  chooseOutputDir,
  renderStyle,
  updateRenderStyle,
  defaultSeconds,
  setDefaultSeconds,
  speed,
  setSpeed,
  estimatedDuration,
  fallbackEstimatedSeconds,
  animationLeadSeconds,
  setAnimationLeadSeconds,
  selectedSpeechNodeCount,
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
  isDesktopApp,
  useGpuAcceleration,
  setUseGpuAcceleration,
  isWebGPUSupported,
}: VideoExportSettingsPanelProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);

  return (
    <aside
      className="min-h-0 border-l border-[var(--vr-border)] bg-[var(--vr-surface)] backdrop-blur-xl flex flex-col shrink-0"
      style={{ width: exportPanelWidth }}
    >
      <div className="h-12 px-4 border-b border-[var(--vr-border)] flex items-center justify-between gap-3 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
        <div className="min-w-0 flex items-center gap-2">
          <Settings className="h-4 w-4 shrink-0 text-[var(--vr-accent)]" />
          <span className="truncate">{t('导出设置', '書き出し設定', 'Export Settings')}</span>
        </div>
        <div className="flex h-8 shrink-0 rounded-lg bg-[var(--vr-surface-soft)] p-0.5">
          {(['video', 'audio'] as ExportSettingsMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setExportSettingsMode(mode)}
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-black transition-colors ${exportSettingsMode === mode
                  ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                  : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                }`}
              title={
                mode === 'video'
                  ? t('切换到导出设置', '書き出し設定を表示', 'Show export settings')
                  : t('切换到音频设置', '音声設定を表示', 'Show audio settings')
              }
              aria-pressed={exportSettingsMode === mode}
            >
              {mode === 'video' ? (
                <Video className="h-3.5 w-3.5" />
              ) : (
                <Music className="h-3.5 w-3.5" />
              )}
              {mode === 'video' ? t('视频', '動画', 'Video') : t('音频', '音声', 'Audio')}
            </button>
          ))}
        </div>
      </div>
      <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {exportSettingsMode === 'video' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('视频参数', '動画パラメータ', 'Video')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('分辨率', '解像度', 'Resolution')}
                  </span>
                  <select
                    value={resolutionIndex}
                    onChange={(e) => setResolutionIndex(Number(e.target.value))}
                    className="w-full min-w-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 py-2 text-xs text-[var(--vr-text)]"
                  >
                    {RESOLUTION_OPTIONS.map((option, index) => (
                      <option key={option.label} value={index}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('帧率', 'フレームレート', 'FPS')}
                  </span>
                  <select
                    value={frameRate}
                    onChange={(e) => setFrameRate(Number(e.target.value) || 30)}
                    className="w-full min-w-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 py-2 text-xs text-[var(--vr-text)]"
                  >
                    {FRAME_RATE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option} fps
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('格式', '形式', 'Format')}
                  </span>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                    className="w-full min-w-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 py-2 text-xs text-[var(--vr-text)]"
                  >
                    {EXPORT_FORMAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                        {!isDesktopApp && option.value !== 'webm'
                          ? ` ${t('桌面版', 'デスクトップ版', 'Desktop')}`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {!isDesktopApp && exportFormat !== 'webm' && (
                    <span className="block text-[10px] font-bold leading-4 text-amber-500">
                      {t(
                        '该格式需要APP端内置 FFmpeg，网页端只能导出 WebM。',
                        'この形式はデスクトップ版の内蔵 FFmpeg が必要です。Web 版は WebM のみ直接書き出せます。',
                        'This format needs the app with bundled FFmpeg. Web can only export WebM.',
                      )}
                    </span>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('标题样式', 'タイトルスタイル', 'Title Style')}
              </div>
              <div className="grid grid-cols-[1fr_1fr_56px] gap-2">
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('字号', 'サイズ', 'Size')}
                  </span>
                  <DragSizeControl
                    label={
                      t(
                        '拖动调整标题字号，单击输入精确数字',
                        'ドラッグでタイトルサイズを調整、クリックで数値入力',
                        'Drag to adjust title size, click to type an exact value',
                      )
                    }
                    value={renderStyle.titleFontSize}
                    min={18}
                    max={120}
                    step={1}
                    onChange={(nextValue) => updateRenderStyle('titleFontSize', nextValue)}
                  />
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('动画', 'アニメーション', 'Animation')}
                  </span>
                  <select
                    value={renderStyle.titleAnimation}
                    onChange={(e) =>
                      updateRenderStyle('titleAnimation', e.target.value as TextAnimation)
                    }
                    className="w-full min-w-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 py-2 text-xs text-[var(--vr-text)]"
                  >
                    {TEXT_ANIMATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {renderCopy(language, option.zh, option.ja, option.en)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('颜色', '色', 'Color')}
                  </span>
                  <input
                    type="color"
                    value={renderStyle.titleColor}
                    onChange={(e) => updateRenderStyle('titleColor', e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-1 py-1"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('正文样式', '本文スタイル', 'Body Style')}
              </div>
              <div className="grid grid-cols-[1fr_1fr_56px] gap-2">
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('字号', 'サイズ', 'Size')}
                  </span>
                  <DragSizeControl
                    label={
                      t(
                        '拖动调整正文字号，单击输入精确数字',
                        'ドラッグで本文サイズを調整、クリックで数値入力',
                        'Drag to adjust body size, click to type an exact value',
                      )
                    }
                    value={renderStyle.bodyFontSize}
                    min={16}
                    max={96}
                    step={1}
                    onChange={(nextValue) => updateRenderStyle('bodyFontSize', nextValue)}
                  />
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('动画', 'アニメーション', 'Animation')}
                  </span>
                  <select
                    value={renderStyle.bodyAnimation}
                    onChange={(e) =>
                      updateRenderStyle('bodyAnimation', e.target.value as TextAnimation)
                    }
                    className="w-full min-w-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 py-2 text-xs text-[var(--vr-text)]"
                  >
                    {TEXT_ANIMATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {renderCopy(language, option.zh, option.ja, option.en)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('颜色', '色', 'Color')}
                  </span>
                  <input
                    type="color"
                    value={renderStyle.bodyColor}
                    onChange={(e) => updateRenderStyle('bodyColor', e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-1 py-1"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('导出细节', '書き出し詳細', 'Export Details')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('编码器', 'エンコーダー', 'Encoder')}
                  </span>
                  <select
                    value={encoder}
                    onChange={(e) => setEncoder(e.target.value)}
                    className="w-full min-w-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 py-2 text-xs text-[var(--vr-text)]"
                  >
                    {ENCODER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('无音频', '音声なし', 'No audio')}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    value={defaultSeconds}
                    onChange={(e) =>
                      setDefaultSeconds(clamp(Number(e.target.value) || 4, 1, 30))
                    }
                    className="w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 py-2 text-xs text-[var(--vr-text)]"
                  />
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('底色', 'パネル色', 'Panel')}
                  </span>
                  <input
                    type="color"
                    value={renderStyle.panelColor}
                    onChange={(e) => updateRenderStyle('panelColor', e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-1 py-1"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('播放倍速', '再生速度', 'Playback speed')}
                  </span>
                  <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 py-2">
                    <RangeControl
                      label={t('速度', '速度', 'Speed')}
                      min={0.25}
                      max={3}
                      step={0.25}
                      value={speed}
                      valueLabel={`${speed.toFixed(2)}x · ${t('预计', '推定', 'Est.')} ${formatSeconds(estimatedDuration || fallbackEstimatedSeconds)}`}
                      onChange={(nextValue) => setSpeed(Math.max(0.25, nextValue || 1))}
                    />
                  </div>
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('提前完成动画(秒)', 'アニメを早めに完了(秒)', 'Finish animation early')}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.1"
                    value={animationLeadSeconds}
                    onChange={(e) =>
                      setAnimationLeadSeconds(clamp(Number(e.target.value) || 0, 0, 30))
                    }
                    className="w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 py-2 text-xs text-[var(--vr-text)]"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('渲染加速', 'レンダリング加速', 'Render Acceleration')}
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setUseGpuAcceleration(false)}
                  disabled={!isWebGPUSupported}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition-colors ${!useGpuAcceleration
                      ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                      : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                    } ${!isWebGPUSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={t('使用 2D Canvas 渲染（最稳定）', '2D Canvas レンダリング（最も安定）', '2D Canvas rendering (most stable)')}
                >
                  <Cpu className="h-3.5 w-3.5" />
                  2D Canvas
                </button>
                <button
                  type="button"
                  onClick={() => isWebGPUSupported && setUseGpuAcceleration(true)}
                  disabled={!isWebGPUSupported}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition-colors ${useGpuAcceleration
                      ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                      : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                    } ${!isWebGPUSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={
                    isWebGPUSupported
                      ? t('使用 WebGPU 加速渲染（实验性）', 'WebGPU 加速レンダリング（実験的）', 'WebGPU accelerated rendering (experimental)')
                      : t('当前浏览器不支持 WebGPU', 'このブラウザは WebGPU をサポートしていません', 'WebGPU is not supported in this browser')
                  }
                >
                  <Zap className="h-3.5 w-3.5" />
                  GPU
                  {!isWebGPUSupported && (
                    <span className="ml-0.5 text-[9px] opacity-70">
                      {t('(不支持)', '(未対応)', '(Unsupported)')}
                    </span>
                  )}
                </button>
              </div>
              {isWebGPUSupported && (
                <p className="text-[10px] font-bold leading-4 text-[var(--vr-text-muted)]">
                  {t(
                    'GPU 加速为实验性功能。如遇问题请切回 2D Canvas。',
                    'GPU 加速は実験的機能です。問題がある場合は 2D Canvas に切り替えてください。',
                    'GPU acceleration is experimental. Switch back to 2D Canvas if you encounter issues.',
                  )}
                </p>
              )}
            </div>

            <label className="space-y-1.5">
              <span className="text-[11px] font-black text-[var(--vr-text-soft)]">
                {t('保存位置', '保存先', 'Save location')}
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={outputDir}
                  onChange={(e) => {
                    setOutputDir(e.target.value);
                    setOutputDirError('');
                  }}
                  placeholder={t('默认保存到系统下载目录', '未指定ならダウンロードへ保存', 'Defaults to Downloads')}
                  className={`min-w-0 flex-1 rounded-lg border bg-[var(--vr-surface-soft)] px-3 py-2 text-xs text-[var(--vr-text)] ${outputDirError ? 'border-rose-400/70' : 'border-[var(--vr-border)]'
                    }`}
                />
                <button
                  type="button"
                  onClick={chooseOutputDir}
                  className="h-9 w-9 shrink-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                  title={t('选择保存文件夹', '保存フォルダーを選択', 'Choose save folder')}
                  aria-label={t('选择保存文件夹', '保存フォルダーを選択', 'Choose save folder')}
                >
                  <FolderOpen className="mx-auto h-4 w-4" />
                </button>
              </div>
              {outputDirError && (
                <span className="block text-[11px] font-bold text-rose-500 dark:text-rose-400">
                  {outputDirError}
                </span>
              )}
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('文字转音频', 'テキストから音声', 'Text to Audio')}
              </div>
              <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 space-y-3">
                <p className="text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
                  {t(
                    `将当前选中的 ${selectedSpeechNodeCount} 个非视频片段文字生成音频素材。`,
                    `選択中の ${selectedSpeechNodeCount} 個の非動画セグメントから音声素材を作成します。`,
                    `Create an audio asset from ${selectedSpeechNodeCount} selected non-video segment(s).`,
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
                  {t('生成语音', '音声を生成', 'Generate speech')}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('用户配音', 'ボイスオーバー', 'Voiceover')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => assetUploadInputRef.current?.click()}
                  className="flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 text-xs font-black text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t('上传音频', '音声をアップロード', 'Upload audio')}</span>
                </button>
                <button
                  type="button"
                  onClick={isRecordingVoiceover ? stopVoiceoverRecording : startVoiceoverRecording}
                  className={`flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition-colors ${isRecordingVoiceover
                      ? 'bg-rose-500 text-white hover:bg-rose-600'
                      : 'border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]'
                    }`}
                >
                  <Mic className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {isRecordingVoiceover
                      ? t('停止录音', '録音を停止', 'Stop')
                      : t('录制配音', '録音', 'Record')}
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 py-2 text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
              {audioMessage ||
                t(
                  '生成或上传后，音频会出现在左侧素材栏，可拖到下方音频轨。',
                  '生成またはアップロードした音声は左側の素材パネルに表示され、音声トラックへドラッグできます。',
                  'Generated or uploaded audio appears in the left assets panel and can be dragged to an audio track.',
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
            {t('已保存到：', '保存先: ', 'Saved to: ')}
            {savedPath}
          </div>
        )}
      </div>
    </aside>
  );
}
