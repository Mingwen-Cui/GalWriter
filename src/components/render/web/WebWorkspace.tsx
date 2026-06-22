import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { ReactNode } from 'react';
import {
  FileText,
  FolderOpen,
  Gamepad2,
  Eye,
  EyeOff,
  Info,
  LayoutTemplate,
  Hand,
  MousePointerClick,
  Palette,
  Play,
  Settings,
  Sparkles,
  RotateCw,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createElement, isValidElement, useEffect, useState } from 'react';
 
import type { Language } from '../../../lib/i18n';
import { DragSizeControl } from '../video/controls/RenderControls';
import { RenderStyleSettingsSection } from '../video/panels/render-style-settings-section';
import { renderCopy } from '../video/shared/renderCopy';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';
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
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
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
  const [showSettingDescriptions, setShowSettingDescriptions] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('galwriter-web-export-setting-descriptions');
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      'galwriter-web-export-setting-descriptions',
      String(showSettingDescriptions),
    );
  }, [showSettingDescriptions]);

  return (
    <main className="min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(300px,380px)] bg-[var(--vr-bg)]">
      <section className="min-h-0 min-w-0 bg-[var(--vr-surface-soft)] flex flex-col">
        <div className="grid h-12 grid-cols-[1fr_auto] items-center border-b border-[var(--vr-border)] px-4">
          <div className="flex min-w-0 items-center gap-2 text-xs font-black tracking-wide text-[var(--vr-text-soft)]">
            <Play className="w-4 h-4 text-[var(--vr-accent)]" />
            <span className="truncate">{webProjectName || defaultWebProjectName || t('网页标题', 'Webタイトル', 'Web Title')}</span>
          </div>
          <div className="rounded bg-[var(--vr-surface)] px-2 py-1 text-[11px] font-black text-[var(--vr-text)]">
            网页
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
        <div className="h-12 px-4 border-b border-[var(--vr-border)] flex items-center justify-between gap-3 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
          <div className="flex min-w-0 items-center gap-2">
            <Settings className="h-4 w-4 shrink-0 text-[var(--vr-accent)]" />
            <span className="truncate">导出设置</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSettingDescriptions((current) => !current)}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
              showSettingDescriptions
                ? 'bg-[var(--vr-surface)] text-[var(--vr-text)] ring-1 ring-[var(--vr-border)]'
                : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
            }`}
            title={
              showSettingDescriptions
                ? t('隐藏参数说明', '説明を非表示', 'Hide descriptions')
                : t('显示参数说明', '説明を表示', 'Show descriptions')
            }
            aria-label={
              showSettingDescriptions
                ? t('隐藏参数说明', '説明を非表示', 'Hide descriptions')
                : t('显示参数说明', '説明を表示', 'Show descriptions')
            }
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          <WebPanelTitle
            icon={FileText}
            title="网页导出设置"
          />
          <div className="space-y-2 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2">
            <input
              type="text"
              value={webProjectName}
              onChange={(event) => setWebProjectName(event.target.value)}
              placeholder={defaultWebProjectName || 'galwriter-web'}
              className="h-10 w-full rounded-lg border border-transparent bg-[var(--vr-surface)] px-3 text-sm font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]"
              aria-label="Project title"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={outputDir}
                onChange={(event) => {
                  setOutputDir(event.target.value);
                  setOutputDirError('');
                }}
                placeholder="Defaults to Downloads"
                className={`min-w-0 flex-1 rounded-lg border bg-[var(--vr-surface)] px-3 py-2 text-xs text-[var(--vr-text)] outline-none ${
                  outputDirError ? 'border-rose-400/70' : 'border-transparent'
                }`}
                aria-label="Export location"
              />
              <button
                type="button"
                onClick={chooseOutputDir}
                className="h-9 w-9 shrink-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                title="Choose export folder"
                aria-label="Choose export folder"
              >
                <FolderOpen className="mx-auto h-4 w-4" />
              </button>
            </div>
            {outputDirError && (
              <span className="block text-[11px] font-bold text-rose-500 dark:text-rose-400">
                {outputDirError}
              </span>
            )}
          </div>

          <WebPanelTitle icon={LayoutTemplate} title="网页参数" />
          <div className="space-y-2 rounded-xl border border-[var(--vr-border)] bg-slate-200/60 p-2 dark:bg-slate-800/60">
            <div className="grid grid-cols-3 gap-2">
              <WebSettingCard
                icon={LayoutTemplate}
                description={
                  showSettingDescriptions
                    ? t('网页布局', 'Webレイアウト', 'Web layout')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.layoutMode}
                  options={[
                    { value: 'classic', label: 'Split', icon: <LayoutClassicGlyph /> },
                    { value: 'immersive', label: 'Immersive', icon: <LayoutImmersiveGlyph /> },
                  ]}
                  onChange={(value) =>
                    updateWebSettings('layoutMode', value as WebExportSettings['layoutMode'])
                  }
                />
              </WebSettingCard>
              <WebSettingCard
                description={
                  showSettingDescriptions
                    ? t('选项位置', '選択肢の位置', 'Choice position')
                    : undefined
                }
              >
                <WebSegmentedGroup
                  value={webSettings.choicesPosition}
                  options={[
                    { value: 'aboveText', label: '上' },
                    { value: 'center', label: '中' },
                    { value: 'belowText', label: '下' },
                  ]}
                  onChange={(value) =>
                    updateWebSettings('choicesPosition', value as WebExportSettings['choicesPosition'])
                  }
                />
              </WebSettingCard>
              <WebSettingCard
                icon={Sparkles}
                description={
                  showSettingDescriptions
                    ? t('背景虚化', '背景をぼかす', 'Blur background')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.blurBackground ? 'on' : 'off'}
                  options={[
                    { value: 'on', label: 'Blur', icon: <BlurGlyph /> },
                    { value: 'off', label: 'Clear', icon: <ClearGlyph /> },
                  ]}
                  onChange={(value) => updateWebSettings('blurBackground', value === 'on')}
                />
              </WebSettingCard>
              <WebSettingCard
                icon={<SingleChoicePopupGlyph />}
                description={
                  showSettingDescriptions
                    ? t('隐藏单选弹窗', '単一選択のポップアップを隠す', 'Hide single-choice popups')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.skipSingleChoicePopup ? 'hide' : 'show'}
                  options={[
                    { value: 'hide', label: 'Hide', icon: <EyeOff className="h-3.5 w-3.5" /> },
                    { value: 'show', label: 'Show', icon: <Eye className="h-3.5 w-3.5" /> },
                  ]}
                  onChange={(value) => updateWebSettings('skipSingleChoicePopup', value === 'hide')}
                />
              </WebSettingCard>
              <WebSettingCard
                icon={Gamepad2}
                description={
                  showSettingDescriptions
                    ? t('自动翻页', '自動で進む', 'Auto advance')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.autoAdvance ? 'on' : 'off'}
                  options={[
                    { value: 'on', label: 'Auto', icon: <RotateCw className="h-3.5 w-3.5" /> },
                    { value: 'off', label: 'Manual', icon: <Hand className="h-3.5 w-3.5" /> },
                  ]}
                  onChange={(value) => updateWebSettings('autoAdvance', value === 'on')}
                />
              </WebSettingCard>
              <WebSettingCard
                icon={Video}
                description={
                  showSettingDescriptions
                    ? t('自动播放视频', '動画を自動再生する', 'Autoplay videos')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.videoAutoPlay ? 'auto' : 'manual'}
                  options={[
                    { value: 'auto', label: 'Auto', icon: <RotateCw className="h-3.5 w-3.5" /> },
                    { value: 'manual', label: 'Manual', icon: <Hand className="h-3.5 w-3.5" /> },
                  ]}
                  onChange={(value) => updateWebSettings('videoAutoPlay', value === 'auto')}
                />
              </WebSettingCard>
            </div>
          </div>
          <WebPanelTitle icon={Palette} title="文字样式" />
          <RenderStyleSettingsSection
            language={language}
            renderStyle={webRenderStyle}
            updateRenderStyle={updateWebRenderStyle}
            showDescriptions={showSettingDescriptions}
          />

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
                className={`text-xs font-bold ${
                  error ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--vr-text-muted)]'
                }`}
              >
                {error || progress}
              </p>
            </div>
          )}
          {savedPath && (
            <div className="rounded-lg border border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--vr-accent-strong)] break-all">
              Saved:
              {savedPath}
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}

const isReactNodeIcon = (icon: LucideIcon | ReactNode): icon is ReactNode => isValidElement(icon);

const createIconElement = (Icon: LucideIcon) => createElement(Icon, { className: 'h-3.5 w-3.5' });

function SingleChoicePopupGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <rect x="4.5" y="5" width="15" height="11.5" rx="2.5" />
      <path d="M9 20l3-3.5 3 3.5" />
      <path d="M8.5 9h7" />
      <path d="M8.5 12.5h4" />
    </svg>
  );
}

function WebPanelTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[var(--vr-accent)]" />
        <span className="truncate">{title}</span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function WebSettingCard({
  icon: Icon,
  description,
  children,
}: {
  icon?: LucideIcon | ReactNode;
  description?: string;
  children: ReactNode;
}) {
  const hasIcon = Boolean(Icon);
  return (
    <div className="space-y-1">
      {description && <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>}
      <div
        className={`grid h-9 items-center rounded-lg bg-[var(--vr-surface-soft)] ${
          hasIcon ? 'grid-cols-[28px_minmax(0,1fr)]' : 'grid-cols-1'
        }`}
      >
        {Icon ? (
          <div className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
            {isReactNodeIcon(Icon)
              ? Icon
              : createIconElement(Icon as LucideIcon)}
          </div>
        ) : null}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

type SegmentedOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

function WebPillToggleGroup({
  value,
  options,
  onChange,
  columns = 'grid-cols-2',
}: {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className={`grid h-9 w-full overflow-hidden rounded-lg ${columns} min-w-0`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex h-9 min-w-0 items-center justify-center gap-1 border-0 px-2 text-[10px] font-black transition-colors ${
              active
                ? 'bg-[var(--vr-accent)] text-white'
                : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'
            }`}
            title={option.label}
            aria-pressed={active}
          >
            {option.icon}
            {option.icon ? null : <span className="truncate">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function WebSegmentedGroup({
  value,
  options,
  onChange,
  columns = 'grid-cols-3',
}: {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className={`grid h-9 w-full overflow-hidden rounded-lg ${columns} min-w-0`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex h-9 w-full min-w-0 items-center justify-center gap-1 border-0 px-1 text-[10px] font-black transition-colors ${
              active
                ? 'bg-[var(--vr-accent)] text-white'
                : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'
            }`}
            title={option.label}
            aria-pressed={active}
          >
            {option.icon}
            {option.icon ? null : <span className="truncate">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function LayoutClassicGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <rect x="4" y="3.5" width="16" height="8" rx="2.5" />
      <path d="M7 15h10" />
      <path d="M7 18h7" />
      <path d="M7 21h9" />
    </svg>
  );
}

function LayoutImmersiveGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <path d="M7 14.5h10" />
      <path d="M7 17.5h7" />
      <path d="M8.5 7.5h7" />
      <path d="M8.5 10.5h4" />
    </svg>
  );
}

function VideoPointerGlyph() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-current/35 bg-current/10">
      <Video className="h-2.5 w-2.5" />
      <MousePointerClick className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5" />
    </span>
  );
}

function ChoicePositionGlyph({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-current/35 bg-current/10">
      {children}
    </span>
  );
}

function ChoiceTopGlyph() {
  return (
    <ChoicePositionGlyph>
      <span className="flex h-2.5 w-2.5 flex-col items-center justify-between">
        <span className="h-0.5 w-2 rounded-full bg-current" />
        <span className="h-0.5 w-1.5 rounded-full bg-current/55" />
      </span>
    </ChoicePositionGlyph>
  );
}

function ChoiceMiddleGlyph() {
  return (
    <ChoicePositionGlyph>
      <span className="flex h-2.5 w-2.5 flex-col items-center justify-between">
        <span className="h-0.5 w-1.5 rounded-full bg-current/55" />
        <span className="h-0.5 w-2 rounded-full bg-current" />
        <span className="h-0.5 w-1.5 rounded-full bg-current/55" />
      </span>
    </ChoicePositionGlyph>
  );
}

function ChoiceBottomGlyph() {
  return (
    <ChoicePositionGlyph>
      <span className="flex h-2.5 w-2.5 flex-col items-center justify-between">
        <span className="h-0.5 w-1.5 rounded-full bg-current/55" />
        <span className="h-0.5 w-2 rounded-full bg-current" />
      </span>
    </ChoicePositionGlyph>
  );
}

function BlurGlyph() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-current/35 bg-current/10">
      <Sparkles className="h-2.5 w-2.5" />
      <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-current/30 blur-[1px]" />
    </span>
  );
}

function ClearGlyph() {
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-current/35 bg-current/10">
      <span className="h-2.5 w-2.5 rounded-[3px] border border-current/55" />
    </span>
  );
}

function SpeedControl({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className={disabled ? 'opacity-45' : ''}>
      <DragSizeControl
        label={label}
        value={value}
        min={10}
        max={200}
        step={5}
        unit="ms"
        onChange={onChange}
      />
    </div>
  );
}


