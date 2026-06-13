import { FileDown, FolderOpen, Loader2, Mic, Music, Settings, Sparkles, Video } from 'lucide-react';

import { DragSizeControl, RangeControl } from '../controls/RenderControls';
import {
  EXPORT_FORMAT_OPTIONS,
  FRAME_RATE_OPTIONS,
  RESOLUTION_OPTIONS,
  TEXT_ANIMATION_OPTIONS,
} from '../shared/constants';
import { clamp } from '../shared/mediaUtils';
import { renderCopy } from '../shared/renderCopy';
import type {
  ExportFormat,
  ExportSettingsMode,
  RenderStatus,
  RenderStyle,
  TextAnimation,
} from '../shared/types';
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
  resolutionWidth: number;
  setResolutionWidth: (value: number) => void;
  resolutionHeight: number;
  setResolutionHeight: (value: number) => void;
  frameRate: number;
  setFrameRate: (value: number) => void;
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
  useGpuAcceleration: boolean;
  setUseGpuAcceleration: (value: boolean) => void;
  isWebGPUSupported: boolean;
  hideCharacterTags: boolean;
  setHideCharacterTags: (value: boolean) => void;
  hideSceneTags: boolean;
  setHideSceneTags: (value: boolean) => void;
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
  resolutionWidth,
  setResolutionWidth,
  resolutionHeight,
  setResolutionHeight,
  frameRate,
  setFrameRate,
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
  useGpuAcceleration,
  setUseGpuAcceleration,
  isWebGPUSupported,
  hideCharacterTags,
  setHideCharacterTags,
  hideSceneTags,
  setHideSceneTags,
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
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-black transition-colors ${
                exportSettingsMode === mode
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
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('视频参数', '動画パラメータ', 'Video')}
              </div>
              <div className="space-y-2 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2">
                <label className="block min-w-0">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('分辨率模板', '解像度テンプレート', 'Resolution preset')}
                  </span>
                  <select
                    value={resolutionIndex}
                    onChange={(e) => {
                      const nextIndex = Number(e.target.value);
                      setResolutionIndex(nextIndex);
                      const preset = RESOLUTION_OPTIONS[nextIndex];
                      if (preset) {
                        setResolutionWidth(preset.width);
                        setResolutionHeight(preset.height);
                      }
                    }}
                    className="mt-1 w-full min-w-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-2 py-2 text-xs font-bold text-[var(--vr-text)]"
                  >
                    <option value={-1}>
                      {t(
                        `自定义 ${resolutionWidth} x ${resolutionHeight}`,
                        `カスタム ${resolutionWidth} x ${resolutionHeight}`,
                        `Custom ${resolutionWidth} x ${resolutionHeight}`,
                      )}
                    </option>
                    {RESOLUTION_OPTIONS.map((option, index) => (
                      <option key={option.label} value={index}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <label className="min-w-0">
                    <span className="mb-1 block truncate text-[10px] font-black text-[var(--vr-text-muted)]">
                      {t('宽度', '幅', 'Width')}
                    </span>
                    <DragSizeControl
                      label={t(
                        '左右拖动调整视频宽度',
                        '左右にドラッグして動画幅を調整',
                        'Drag horizontally to adjust video width',
                      )}
                      value={resolutionWidth}
                      min={320}
                      max={7680}
                      step={2}
                      onChange={(value) => {
                        setResolutionIndex(-1);
                        setResolutionWidth(value);
                      }}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block truncate text-[10px] font-black text-[var(--vr-text-muted)]">
                      {t('高度', '高さ', 'Height')}
                    </span>
                    <DragSizeControl
                      label={t(
                        '左右拖动调整视频高度',
                        '左右にドラッグして動画高さを調整',
                        'Drag horizontally to adjust video height',
                      )}
                      value={resolutionHeight}
                      min={240}
                      max={4320}
                      step={2}
                      onChange={(value) => {
                        setResolutionIndex(-1);
                        setResolutionHeight(value);
                      }}
                    />
                  </label>
                  <label className="min-w-0">
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
                  <label className="min-w-0">
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
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('文字样式', 'テキストスタイル', 'Text Style')}
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[52px_88px_minmax(112px,1fr)_44px] items-end gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-2">
                  <span className="mb-0.5 rounded-lg bg-indigo-500/10 px-2 py-2 text-center text-[11px] font-black text-indigo-500">
                    {t('标题', 'タイトル', 'Title')}
                  </span>
                  <label className="min-w-0">
                    <span className="mb-1 block text-[9px] font-black text-[var(--vr-text-muted)]">
                      {t('字号', 'サイズ', 'Size')}
                    </span>
                    <DragSizeControl
                      label={t(
                        '拖动调整标题字号，单击输入精确数字',
                        'ドラッグでタイトルサイズを調整、クリックで数値入力',
                        'Drag to adjust title size, click to type an exact value',
                      )}
                      value={renderStyle.titleFontSize}
                      min={18}
                      max={120}
                      step={1}
                      onChange={(nextValue) => updateRenderStyle('titleFontSize', nextValue)}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-[9px] font-black text-[var(--vr-text-muted)]">
                      {t('动画 / 打字', 'アニメ / タイプ', 'Animation / Type')}
                    </span>
                    <select
                      value={renderStyle.titleAnimation}
                      onChange={(e) =>
                        updateRenderStyle('titleAnimation', e.target.value as TextAnimation)
                      }
                      className="h-9 w-full min-w-0 rounded-lg border border-indigo-500/20 bg-[var(--vr-surface)] px-2 text-xs font-bold text-[var(--vr-text)]"
                    >
                      {TEXT_ANIMATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {renderCopy(language, option.zh, option.ja, option.en)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-center text-[9px] font-black text-[var(--vr-text-muted)]">
                      {t('颜色', '色', 'Color')}
                    </span>
                    <input
                      type="color"
                      value={renderStyle.titleColor}
                      onChange={(e) => updateRenderStyle('titleColor', e.target.value)}
                      className="h-9 w-full rounded-lg border border-indigo-500/20 bg-[var(--vr-surface)] p-1"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-[52px_88px_minmax(112px,1fr)_44px] items-end gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-2">
                  <span className="mb-0.5 rounded-lg bg-blue-500/10 px-2 py-2 text-center text-[11px] font-black text-blue-500">
                    {t('正文', '本文', 'Body')}
                  </span>
                  <label className="min-w-0">
                    <span className="mb-1 block text-[9px] font-black text-[var(--vr-text-muted)]">
                      {t('字号', 'サイズ', 'Size')}
                    </span>
                    <DragSizeControl
                      label={t(
                        '拖动调整正文字号，单击输入精确数字',
                        'ドラッグで本文サイズを調整、クリックで数値入力',
                        'Drag to adjust body size, click to type an exact value',
                      )}
                      value={renderStyle.bodyFontSize}
                      min={16}
                      max={96}
                      step={1}
                      onChange={(nextValue) => updateRenderStyle('bodyFontSize', nextValue)}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-[9px] font-black text-[var(--vr-text-muted)]">
                      {t('动画 / 打字', 'アニメ / タイプ', 'Animation / Type')}
                    </span>
                    <select
                      value={renderStyle.bodyAnimation}
                      onChange={(e) =>
                        updateRenderStyle('bodyAnimation', e.target.value as TextAnimation)
                      }
                      className="h-9 w-full min-w-0 rounded-lg border border-blue-500/20 bg-[var(--vr-surface)] px-2 text-xs font-bold text-[var(--vr-text)]"
                    >
                      {TEXT_ANIMATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {renderCopy(language, option.zh, option.ja, option.en)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-center text-[9px] font-black text-[var(--vr-text-muted)]">
                      {t('颜色', '色', 'Color')}
                    </span>
                    <input
                      type="color"
                      value={renderStyle.bodyColor}
                      onChange={(e) => updateRenderStyle('bodyColor', e.target.value)}
                      className="h-9 w-full rounded-lg border border-blue-500/20 bg-[var(--vr-surface)] p-1"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('导出细节', '書き出し詳細', 'Export Details')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                    {t('无音频视频长度', '音声なし動画の長さ', 'No-audio video length')}
                  </span>
                  <DragSizeControl
                    label={t(
                      '左右拖动调整无音频视频长度',
                      '左右にドラッグして音声なし動画の長さを調整',
                      'Drag horizontally to adjust no-audio video length',
                    )}
                    value={defaultSeconds}
                    min={1}
                    max={30}
                    step={1}
                    unit="s"
                    onChange={setDefaultSeconds}
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

            <div className="order-last flex items-center gap-3">
              <div className="shrink-0 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('渲染加速', 'レンダリング加速', 'Render Acceleration')}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setUseGpuAcceleration(false)}
                  disabled={!isWebGPUSupported}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition-colors ${
                    !useGpuAcceleration
                      ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                      : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                  } ${!isWebGPUSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={t(
                    '使用 2D Canvas 渲染（最稳定）',
                    '2D Canvas レンダリング（最も安定）',
                    '2D Canvas rendering (most stable)',
                  )}
                >
                  2D Canvas
                </button>
                <button
                  type="button"
                  onClick={() => isWebGPUSupported && setUseGpuAcceleration(true)}
                  disabled={!isWebGPUSupported}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition-colors ${
                    useGpuAcceleration
                      ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                      : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                  } ${!isWebGPUSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={
                    isWebGPUSupported
                      ? t(
                          '使用 WebGPU 加速渲染（实验性）',
                          'WebGPU 加速レンダリング（実験的）',
                          'WebGPU accelerated rendering (experimental)',
                        )
                      : t(
                          '当前浏览器不支持 WebGPU',
                          'このブラウザは WebGPU をサポートしていません',
                          'WebGPU is not supported in this browser',
                        )
                  }
                >
                  GPU
                  {!isWebGPUSupported && (
                    <span className="ml-0.5 text-[9px] opacity-70">
                      {t('(不支持)', '(未対応)', '(Unsupported)')}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('标签显示', 'タグ表示', 'Tag Display')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHideCharacterTags(!hideCharacterTags)}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition-colors ${
                    hideCharacterTags
                      ? 'bg-[var(--vr-accent)] text-white'
                      : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)]'
                  }`}
                >
                  {t('隐藏人物标签', '人物タグを非表示', 'Hide character tags')}
                </button>
                <button
                  type="button"
                  onClick={() => setHideSceneTags(!hideSceneTags)}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition-colors ${
                    hideSceneTags
                      ? 'bg-[var(--vr-accent)] text-white'
                      : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)]'
                  }`}
                >
                  {t('隐藏场景标签', 'シーンタグを非表示', 'Hide scene tags')}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3">
              <span className="mt-2.5 shrink-0 text-[11px] font-black text-[var(--vr-text-soft)]">
                {t('保存位置', '保存先', 'Save location')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outputDir}
                    onChange={(e) => {
                      setOutputDir(e.target.value);
                      setOutputDirError('');
                    }}
                    placeholder={t(
                      '默认保存到系统下载目录',
                      '未指定ならダウンロードへ保存',
                      'Defaults to Downloads',
                    )}
                    className={`min-w-0 flex-1 rounded-lg border bg-[var(--vr-surface-soft)] px-3 py-2 text-xs text-[var(--vr-text)] ${
                      outputDirError ? 'border-rose-400/70' : 'border-[var(--vr-border)]'
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
                  <span className="mt-1 block text-[11px] font-bold text-rose-500 dark:text-rose-400">
                    {outputDirError}
                  </span>
                )}
              </div>
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
                  <span className="truncate">
                    {t('上传音频', '音声をアップロード', 'Upload audio')}
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
