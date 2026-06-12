import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import { FolderOpen, Play, Settings } from 'lucide-react';

import type { Language } from '../../../lib/i18n';
import { DragSizeControl, RangeControl } from '../video/controls/RenderControls';
import { TEXT_ANIMATION_OPTIONS } from '../video/shared/constants';
import { renderCopy } from '../video/shared/renderCopy';
import type { RenderStyle, TextAnimation, WebExportSettings } from '../video/shared/types';
import { WebPlaytestPreview } from './WebPlaytestPreview';

type WebWorkspaceProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  language: Language;
  webRenderStyle: RenderStyle;
  webChoiceColor: string;
  webChoiceTextColor: string;
  webSettings: WebExportSettings;
  webProjectName: string;
  defaultWebProjectName: string;
  progress: string;
  error: string;
  progressValue: number;
  savedPath: string;
  outputDir: string;
  outputDirError: string;
  setWebProjectName: (value: string) => void;
  setOutputDir: (value: string) => void;
  setOutputDirError: (value: string) => void;
  chooseOutputDir: () => void;
  updateWebSettings: <K extends keyof WebExportSettings>(key: K, value: WebExportSettings[K]) => void;
  updateWebChoiceTextColor: (value: string) => void;
  updateWebChoiceColor: (value: string) => void;
  updateWebRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
};

export function WebWorkspace({
  nodes,
  edges,
  language,
  webRenderStyle,
  webChoiceColor,
  webChoiceTextColor,
  webSettings,
  webProjectName,
  defaultWebProjectName,
  progress,
  error,
  progressValue,
  savedPath,
  outputDir,
  outputDirError,
  setWebProjectName,
  setOutputDir,
  setOutputDirError,
  chooseOutputDir,
  updateWebSettings,
  updateWebChoiceTextColor,
  updateWebChoiceColor,
  updateWebRenderStyle,
}: WebWorkspaceProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);

  return (
    <main className="min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(300px,380px)] bg-[var(--vr-bg)]">
      <section className="min-h-0 min-w-0 bg-[var(--vr-surface-soft)] flex flex-col">
        <div className="grid h-12 grid-cols-[1fr_auto] items-center border-b border-[var(--vr-border)] px-4">
          <div className="flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
            <Play className="w-4 h-4 text-[var(--vr-accent)]" />
            {t('测试预览窗口', 'プレビューモニター', 'Preview Monitor')}
          </div>
          <div className="rounded bg-[var(--vr-surface)] px-2 py-1 text-[11px] font-black text-[var(--vr-text)]">
            HTML
          </div>
        </div>
        <div className="min-h-0 flex-1 p-4 xl:p-5">
          <WebPlaytestPreview
            nodes={nodes}
            edges={edges}
            language={language}
            renderStyle={webRenderStyle}
            choiceColor={webChoiceColor}
            choiceTextColor={webChoiceTextColor}
            settings={webSettings}
            projectTitle={webProjectName}
            onUpdateSettings={updateWebSettings}
            onUpdateRenderStyle={updateWebRenderStyle}
          />
        </div>
      </section>

      <aside className="min-h-0 border-l border-[var(--vr-border)] bg-[var(--vr-surface)] backdrop-blur-xl flex flex-col">
        <div className="h-12 px-4 border-b border-[var(--vr-border)] flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
          <Settings className="h-4 w-4 shrink-0 text-[var(--vr-accent)]" />
          <span className="truncate">{t('导出设置', '書き出し設定', 'Export Settings')}</span>
        </div>
        <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
              {t('作品题目', '作品タイトル', 'Project Title')}
            </div>
            <input
              type="text"
              value={webProjectName}
              onChange={(event) => setWebProjectName(event.target.value)}
              placeholder={defaultWebProjectName || 'galwriter-web'}
              className="h-10 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 text-sm font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]"
            />
          </div>

          <label className="space-y-1.5">
            <span className="text-[11px] font-black text-[var(--vr-text-soft)]">
              {t('导出位置', '書き出し先', 'Export location')}
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputDir}
                onChange={(event) => {
                  setOutputDir(event.target.value);
                  setOutputDirError('');
                }}
                placeholder={t('未指定时保存到系统下载目录', '未指定ならダウンロードに保存', 'Defaults to Downloads')}
                className={`min-w-0 flex-1 rounded-lg border bg-[var(--vr-surface-soft)] px-3 py-2 text-xs text-[var(--vr-text)] ${
                  outputDirError ? 'border-rose-400/70' : 'border-[var(--vr-border)]'
                }`}
              />
              <button
                type="button"
                onClick={chooseOutputDir}
                className="h-9 w-9 shrink-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                title={t('选择导出文件夹', '書き出しフォルダーを選択', 'Choose export folder')}
                aria-label={t('选择导出文件夹', '書き出しフォルダーを選択', 'Choose export folder')}
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

          <WebSegmentedSetting
            title={t('界面排版', 'レイアウト', 'Layout')}
            options={[
              { value: 'classic', label: t('经典排版', 'クラシック', 'Classic') },
              { value: 'immersive', label: t('沉浸全屏', '没入表示', 'Immersive') },
            ]}
            value={webSettings.layoutMode}
            onChange={(value) =>
              updateWebSettings('layoutMode', value as WebExportSettings['layoutMode'])
            }
          />

          <WebSegmentedSetting
            title={t('选项按钮位置', '選択肢の位置', 'Choice Position')}
            columns="grid-cols-3"
            options={[
              { value: 'center', label: t('画面中间', '中央', 'Center') },
              { value: 'aboveText', label: t('文字上方', '本文の上', 'Above') },
              { value: 'belowText', label: t('文字下方', '本文の下', 'Below') },
            ]}
            value={webSettings.choicesPosition}
            onChange={(value) =>
              updateWebSettings('choicesPosition', value as WebExportSettings['choicesPosition'])
            }
          />

          <WebSegmentedSetting
            title={t('选项弹出背景虚化', '選択肢背景ぼかし', 'Choice Backdrop Blur')}
            options={[
              { value: 'on', label: t('开启背景虚化', 'ぼかしオン', 'Blur On') },
              { value: 'off', label: t('关闭背景虚化', 'ぼかしオフ', 'Blur Off') },
            ]}
            value={webSettings.blurBackground ? 'on' : 'off'}
            onChange={(value) => updateWebSettings('blurBackground', value === 'on')}
          />

          <WebSegmentedSetting
            title={t('单选项时隐藏居中弹窗', '単一選択肢の中央ポップアップ', 'Single Choice Popup')}
            options={[
              { value: 'hide', label: t('隐藏', '非表示', 'Hide') },
              { value: 'show', label: t('显示弹窗选择', '表示', 'Show') },
            ]}
            value={webSettings.skipSingleChoicePopup ? 'hide' : 'show'}
            onChange={(value) => updateWebSettings('skipSingleChoicePopup', value === 'hide')}
          />

          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
              {t('剧情文本交互策略', '本文インタラクション', 'Text Interaction')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['typewriter', 'immediate'] as WebExportSettings['interactionMode'][]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateWebSettings('interactionMode', mode)}
                  className={`h-9 rounded-lg px-2 text-xs font-black transition-colors ${
                    webSettings.interactionMode === mode
                      ? 'bg-[var(--vr-accent)] text-white'
                      : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:text-[var(--vr-text)]'
                  }`}
                >
                  {mode === 'typewriter'
                    ? t('打字机效果', 'タイプライター', 'Typewriter')
                    : t('立即显示', '即時表示', 'Immediate')}
                </button>
              ))}
            </div>
            <label className="block rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 py-2">
              <RangeControl
                label={t('打字速度', 'タイプ速度', 'Type speed')}
                min={10}
                max={200}
                step={5}
                value={webSettings.typewriterSpeed}
                valueLabel={`${webSettings.typewriterSpeed} ms/${t('字', '文字', 'char')}`}
                disabled={webSettings.interactionMode !== 'typewriter'}
                onChange={(nextValue) =>
                  updateWebSettings('typewriterSpeed', Math.max(0, Math.round(nextValue)))
                }
              />
            </label>
          </div>

          <WebSegmentedSetting
            title={t('自动翻页', '自動進行', 'Auto Advance')}
            options={[
              { value: 'on', label: t('自动继续', '自動', 'On') },
              { value: 'off', label: t('手动翻页', '手動', 'Manual') },
            ]}
            value={webSettings.autoAdvance ? 'on' : 'off'}
            onChange={(value) => updateWebSettings('autoAdvance', value === 'on')}
          />

          <WebSegmentedSetting
            title={t('多媒体设置', 'メディア', 'Media')}
            options={[
              { value: 'auto', label: t('视频自动播放', '動画自動再生', 'Autoplay') },
              { value: 'manual', label: t('手动播放', '手動再生', 'Manual') },
            ]}
            value={webSettings.videoAutoPlay ? 'auto' : 'manual'}
            onChange={(value) => updateWebSettings('videoAutoPlay', value === 'auto')}
          />

          <WebSegmentedSetting
            title={t('人物标签', 'キャラクタータグ', 'Character Tags')}
            options={[
              { value: 'hide', label: t('默认隐藏', '非表示', 'Hidden') },
              { value: 'show', label: t('显示', '表示', 'Shown') },
            ]}
            value={webSettings.hideCharacterTags ? 'hide' : 'show'}
            onChange={(value) => updateWebSettings('hideCharacterTags', value === 'hide')}
          />

          <WebSegmentedSetting
            title={t('场景标签', 'シーンタグ', 'Scene Tags')}
            options={[
              { value: 'hide', label: t('默认隐藏', '非表示', 'Hidden') },
              { value: 'show', label: t('显示', '表示', 'Shown') },
            ]}
            value={webSettings.hideSceneTags ? 'hide' : 'show'}
            onChange={(value) => updateWebSettings('hideSceneTags', value === 'hide')}
          />

          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
              {t('按钮样式', 'ボタンスタイル', 'Button Style')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ColorField
                label={t('文字颜色', '文字色', 'Text color')}
                value={webChoiceTextColor}
                onChange={updateWebChoiceTextColor}
              />
              <ColorField
                label={t('背景颜色', '背景色', 'Background color')}
                value={webChoiceColor}
                onChange={updateWebChoiceColor}
              />
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
                  label={t(
                    '拖动调整网页正文字号，单击输入精确数字',
                    'ドラッグで Web 本文サイズを調整、クリックで数値入力',
                    'Drag to adjust web body size, click to type an exact value',
                  )}
                  value={webRenderStyle.bodyFontSize}
                  min={16}
                  max={96}
                  step={1}
                  onChange={(nextValue) => updateWebRenderStyle('bodyFontSize', nextValue)}
                />
              </label>
              <label className="min-w-0 space-y-1.5">
                <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
                  {t('动画', 'アニメーション', 'Animation')}
                </span>
                <select
                  value={webRenderStyle.bodyAnimation}
                  onChange={(event) =>
                    updateWebRenderStyle('bodyAnimation', event.target.value as TextAnimation)
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
              <ColorField
                label={t('颜色', '色', 'Color')}
                value={webRenderStyle.bodyColor}
                onChange={(value) => updateWebRenderStyle('bodyColor', value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
              {t('文本面板', 'テキストパネル', 'Text Panel')}
            </div>
            <ColorField
              label={t('面板背景', 'パネル背景', 'Panel background')}
              value={webRenderStyle.panelColor}
              onChange={(value) => updateWebRenderStyle('panelColor', value)}
            />
          </div>

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
              {t('已保存：', '保存済み: ', 'Saved: ')}
              {savedPath}
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}

function WebSegmentedSetting({
  title,
  options,
  value,
  onChange,
  columns = 'grid-cols-2',
}: {
  title: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
        {title}
      </div>
      <div className={`grid ${columns} gap-2`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`h-9 rounded-lg px-2 text-xs font-black transition-colors ${
              value === option.value
                ? 'bg-[var(--vr-accent)] text-white'
                : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:text-[var(--vr-text)]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 space-y-1.5">
      <span className="block truncate text-[11px] font-black text-[var(--vr-text-soft)]">
        {label}
      </span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-1 py-1"
      />
    </label>
  );
}
