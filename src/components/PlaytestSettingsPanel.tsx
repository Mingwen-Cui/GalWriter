import {
  Eye,
  EyeOff,
  FastForward,
  Layout,
  PlayCircle,
  Settings,
  Sparkles,
  Type,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import React from 'react';

import { Language, translations } from '../lib/i18n';
import { RenderStyleSettingsSection } from './render/video/panels/render-style-settings-section';
import type { RenderStyle } from './render/video/shared/types';

type PlaytestSettingsPanelProps = {
  language: Language;
  isDarkMode: boolean;
  choicesColumns: number;
  setChoicesColumns: (value: number) => void;
  videoAutoPlay: boolean;
  setVideoAutoPlay: (value: boolean) => void;
  layoutMode: 'classic' | 'immersive';
  setLayoutMode: (value: 'classic' | 'immersive') => void;
  choicesPosition: 'center' | 'aboveText' | 'belowText';
  setChoicesPosition: (value: 'center' | 'aboveText' | 'belowText') => void;
  blurBackground: boolean;
  setBlurBackground: (value: boolean) => void;
  blurText: boolean;
  setBlurText: (value: boolean) => void;
  skipSingleChoicePopup: boolean;
  setSkipSingleChoicePopup: (value: boolean) => void;
  autoAdvance: boolean;
  setAutoAdvance: (value: boolean) => void;
  hideCharacterTags: boolean;
  setHideCharacterTags: (value: boolean) => void;
  hideSceneTags: boolean;
  setHideSceneTags: (value: boolean) => void;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
};

export function PlaytestSettingsPanel({
  language,
  isDarkMode,
  choicesColumns,
  setChoicesColumns,
  videoAutoPlay,
  setVideoAutoPlay,
  layoutMode,
  setLayoutMode,
  choicesPosition,
  setChoicesPosition,
  blurBackground,
  setBlurBackground,
  blurText,
  setBlurText,
  skipSingleChoicePopup,
  setSkipSingleChoicePopup,
  autoAdvance,
  setAutoAdvance,
  hideCharacterTags,
  setHideCharacterTags,
  hideSceneTags,
  setHideSceneTags,
  renderStyle,
  updateRenderStyle,
}: PlaytestSettingsPanelProps) {
  const t = translations[language];
  React.useEffect(() => {
    if (layoutMode === 'immersive' && choicesPosition !== 'center') {
      setChoicesPosition('center');
    }
  }, [choicesPosition, layoutMode, setChoicesPosition]);

  const panelTone = isDarkMode
    ? 'border-[var(--vr-border)] bg-[var(--vr-panel)]'
    : 'border-[var(--vr-border)] bg-[var(--vr-surface)]';
  const workspaceStyle = (isDarkMode
    ? {
        '--vr-bg': 'var(--app-bg)',
        '--vr-surface': 'rgba(32, 37, 44, 0.92)',
        '--vr-surface-strong': '#20252c',
        '--vr-surface-soft': 'rgba(32, 37, 44, 0.86)',
        '--vr-panel': 'rgba(20, 20, 23, 0.9)',
        '--vr-border': 'rgba(255, 255, 255, 0.1)',
        '--vr-border-strong': 'rgba(255, 255, 255, 0.16)',
        '--vr-text': '#f4f4f5',
        '--vr-text-soft': '#c7c7cc',
        '--vr-text-muted': '#85858c',
        '--vr-accent-soft': 'color-mix(in srgb, var(--accent) 14%, transparent)',
      }
    : {
        '--vr-bg': 'var(--app-bg)',
        '--vr-surface': 'rgba(255, 255, 255, 0.92)',
        '--vr-surface-strong': '#ffffff',
        '--vr-surface-soft': 'rgba(248, 250, 252, 0.94)',
        '--vr-panel': 'rgba(255, 255, 255, 0.82)',
        '--vr-border': 'rgba(148, 163, 184, 0.32)',
        '--vr-border-strong': 'rgba(100, 116, 139, 0.38)',
        '--vr-text': '#172033',
        '--vr-text-soft': '#475569',
        '--vr-text-muted': '#8290a3',
        '--vr-accent-soft': 'color-mix(in srgb, var(--accent) 12%, transparent)',
      }) as React.CSSProperties;
  const uiCopy = {
    settingsTitle:
      language === 'zh' ? '\u6d4b\u8bd5\u53c2\u6570' : language === 'ja' ? 'Test Settings' : 'Playtest Settings',
    layout: language === 'zh' ? '\u754c\u9762\u5e03\u5c40' : language === 'ja' ? 'Layout' : 'Layout',
    splitDesc:
      language === 'zh'
        ? '\u753b\u9762\u4e0e\u6587\u672c\u5206\u533a\uff0c\u9002\u5408\u7a33\u5b9a\u9605\u8bfb'
        : 'Separate media and text for steady reading',
    mergedDesc:
      language === 'zh'
        ? '\u6587\u672c\u53e0\u5408\u5230\u753b\u9762\u4e0a\uff0c\u9002\u5408\u5168\u5c4f\u6f14\u51fa'
        : 'Merge text onto media for fullscreen presentation',
    choicePosition:
      language === 'zh' ? '\u9009\u9879\u4f4d\u7f6e' : 'Choice position',
    top: language === 'zh' ? '\u4e0a\u65b9' : 'Top',
    center: language === 'zh' ? '\u4e2d\u95f4' : 'Center',
    bottom: language === 'zh' ? '\u4e0b\u65b9' : 'Bottom',
    columns: language === 'zh' ? '\u9009\u9879\u5217\u6570' : 'Columns',
    blurBackground:
      language === 'zh' ? '\u80cc\u666f\u865a\u5316' : 'Blur background',
    blurText: language === 'zh' ? '\u6587\u5b57\u865a\u5316' : 'Blur text',
    singlePopup:
      language === 'zh' ? '\u5355\u9009\u5f39\u7a97' : 'Single popup',
    autoAdvance:
      language === 'zh' ? '\u81ea\u52a8\u7ffb\u9875' : 'Auto advance',
    characterTags:
      language === 'zh' ? '\u4eba\u7269\u6807\u7b7e' : 'Character tags',
    sceneTags: language === 'zh' ? '\u573a\u666f\u6807\u7b7e' : 'Scene tags',
    hide: language === 'zh' ? '\u9690\u85cf' : 'Hide',
    show: language === 'zh' ? '\u663e\u793a' : 'Show',
    styleTitle:
      language === 'zh'
        ? '\u6807\u9898 / \u6b63\u6587 / \u6587\u5b57\u6846'
        : 'Title / Body / Text Box',
  };

  return (
    <div className="video-render-workspace space-y-4" style={workspaceStyle}>
      <PlaytestPanelTitle icon={Layout} title={uiCopy.settingsTitle} />

      <div className={`rounded-xl border p-2 ${panelTone}`}>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 space-y-1">
            <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
              {uiCopy.layout}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LayoutChoiceButton
                active={layoutMode === 'classic'}
                title={t.layoutClassic}
                description={uiCopy.splitDesc}
                icon={<LayoutClassicGlyph />}
                onClick={() => setLayoutMode('classic')}
              />
              <LayoutChoiceButton
                active={layoutMode === 'immersive'}
                title={t.layoutImmersive}
                description={uiCopy.mergedDesc}
                icon={<LayoutImmersiveGlyph />}
                onClick={() => {
                  setLayoutMode('immersive');
                  setChoicesPosition('center');
                }}
              />
            </div>
          </div>

          <PlaytestSettingCard description={uiCopy.choicePosition}>
            <PlaytestSegmentedGroup
              value={choicesPosition}
              options={[
                { value: 'aboveText', label: uiCopy.top, disabled: layoutMode === 'immersive' },
                { value: 'center', label: uiCopy.center },
                { value: 'belowText', label: uiCopy.bottom, disabled: layoutMode === 'immersive' },
              ]}
              onChange={(value) =>
                setChoicesPosition(value as 'center' | 'aboveText' | 'belowText')
              }
            />
          </PlaytestSettingCard>

          {choicesPosition !== 'center' && (
            <PlaytestSettingCard description={uiCopy.columns}>
              <PlaytestSegmentedGroup
                value={String(choicesColumns)}
                options={[1, 2, 3].map((cols) => ({
                  value: String(cols),
                  label: t[`column${cols}` as keyof typeof t] as string,
                }))}
                onChange={(value) => setChoicesColumns(Number(value) || 1)}
              />
            </PlaytestSettingCard>
          )}

          <PlaytestSettingCard icon={Sparkles} description={uiCopy.blurBackground}>
            <PlaytestPillToggleGroup
              value={blurBackground ? 'on' : 'off'}
              options={[
                { value: 'on', label: 'Blur', icon: <BlurGlyph /> },
                { value: 'off', label: 'Clear', icon: <ClearGlyph /> },
              ]}
              onChange={(value) => setBlurBackground(value === 'on')}
            />
          </PlaytestSettingCard>

          {blurBackground && (
            <PlaytestSettingCard icon={Type} description={uiCopy.blurText}>
              <PlaytestPillToggleGroup
                value={blurText ? 'blur' : 'clear'}
                options={[
                  { value: 'blur', label: 'Blur', icon: <BlurGlyph /> },
                  { value: 'clear', label: 'Clear', icon: <ClearGlyph /> },
                ]}
                onChange={(value) => setBlurText(value === 'blur')}
              />
            </PlaytestSettingCard>
          )}

          {choicesPosition === 'center' && (
            <PlaytestSettingCard icon={<SingleChoicePopupGlyph />} description={uiCopy.singlePopup}>
              <PlaytestPillToggleGroup
                value={skipSingleChoicePopup ? 'hide' : 'show'}
                options={[
                  { value: 'hide', label: 'Hide', icon: <EyeOff className="h-3.5 w-3.5" /> },
                  { value: 'show', label: 'Show', icon: <Eye className="h-3.5 w-3.5" /> },
                ]}
                onChange={(value) => setSkipSingleChoicePopup(value === 'hide')}
              />
            </PlaytestSettingCard>
          )}

          <PlaytestSettingCard icon={FastForward} description={uiCopy.autoAdvance}>
            <PlaytestPillToggleGroup
              value={autoAdvance ? 'on' : 'off'}
              options={[
                { value: 'on', label: 'Auto', icon: <FastForward className="h-3.5 w-3.5" /> },
                { value: 'off', label: 'Manual', icon: <PlayCircle className="h-3.5 w-3.5" /> },
              ]}
              onChange={(value) => setAutoAdvance(value === 'on')}
            />
          </PlaytestSettingCard>

          <PlaytestSettingCard icon={Video} description={t.videoAutoPlay}>
            <PlaytestPillToggleGroup
              value={videoAutoPlay ? 'auto' : 'manual'}
              options={[
                { value: 'auto', label: 'Auto', icon: <FastForward className="h-3.5 w-3.5" /> },
                { value: 'manual', label: 'Manual', icon: <PlayCircle className="h-3.5 w-3.5" /> },
              ]}
              onChange={(value) => setVideoAutoPlay(value === 'auto')}
            />
          </PlaytestSettingCard>

          <PlaytestSettingCard icon={<CharacterTagGlyph />} description={uiCopy.characterTags}>
            <PlaytestToggleButton
              active={hideCharacterTags}
              icon={
                hideCharacterTags ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )
              }
              label={hideCharacterTags ? uiCopy.hide : uiCopy.show}
              onClick={() => setHideCharacterTags(!hideCharacterTags)}
            />
          </PlaytestSettingCard>

          <PlaytestSettingCard icon={<SceneTagGlyph />} description={uiCopy.sceneTags}>
            <PlaytestToggleButton
              active={hideSceneTags}
              icon={
                hideSceneTags ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )
              }
              label={hideSceneTags ? uiCopy.hide : uiCopy.show}
              onClick={() => setHideSceneTags(!hideSceneTags)}
            />
          </PlaytestSettingCard>
        </div>
      </div>

      <PlaytestPanelTitle icon={Settings} title={uiCopy.styleTitle} />
      <div className={`rounded-xl border p-2 ${panelTone}`}>
        <RenderStyleSettingsSection
          language={language}
          renderStyle={renderStyle}
          updateRenderStyle={updateRenderStyle}
          showDescriptions
        />
      </div>
    </div>
  );
}

function PlaytestPanelTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--vr-accent)]" />
      <span className="truncate">{title}</span>
    </div>
  );
}

function LayoutChoiceButton({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid min-h-[66px] grid-cols-[34px_minmax(0,1fr)] items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
        active
          ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] text-[var(--vr-text)] ring-1 ring-[var(--vr-accent)]/20'
          : 'border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-text)]'
      }`}
      aria-pressed={active}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          active ? 'bg-[var(--vr-accent)] text-white' : 'bg-[var(--vr-surface)] text-current'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-black">{title}</span>
        <span className="mt-0.5 block text-[10px] font-bold leading-3 text-[var(--vr-text-muted)]">
          {description}
        </span>
      </span>
    </button>
  );
}

function PlaytestSettingCard({
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
      {description && (
        <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>
      )}
      <div
        className={`grid h-9 items-center overflow-hidden rounded-lg bg-[var(--vr-surface-soft)] ${
          hasIcon ? 'grid-cols-[28px_minmax(0,1fr)]' : 'grid-cols-1'
        }`}
      >
        {Icon ? (
          <div className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
            {React.isValidElement(Icon)
              ? Icon
              : React.createElement(Icon as React.ElementType, { className: 'h-3.5 w-3.5' })}
          </div>
        ) : null}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

type PlaytestSegmentedOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

function PlaytestPillToggleGroup({
  value,
  options,
  onChange,
  columns = 'grid-cols-2',
}: {
  value: string;
  options: PlaytestSegmentedOption[];
  onChange: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className={`grid h-9 w-full min-w-0 overflow-hidden rounded-lg ${columns}`}>
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
                : 'text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-text)]'
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

function PlaytestSegmentedGroup({
  value,
  options,
  onChange,
  columns = 'grid-cols-3',
}: {
  value: string;
  options: PlaytestSegmentedOption[];
  onChange: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className={`grid h-9 w-full min-w-0 overflow-hidden rounded-lg ${columns}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (!option.disabled) onChange(option.value);
            }}
            disabled={option.disabled}
            className={`flex h-9 min-w-0 items-center justify-center gap-1 border-0 px-1 text-[10px] font-black transition-colors ${
              active
                ? 'bg-[var(--vr-accent)] text-white'
                : option.disabled
                  ? 'text-[var(--vr-text-muted)] opacity-35 grayscale'
                : 'text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-text)]'
            }`}
            title={option.label}
            aria-pressed={active}
            aria-disabled={option.disabled}
          >
            {option.icon}
            {option.icon ? null : <span className="truncate">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PlaytestToggleButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon?: ReactNode;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full min-w-0 items-center justify-center gap-1 border-0 px-2 text-[10px] font-black transition-colors ${
        active
          ? 'bg-[var(--vr-accent)] text-white'
          : 'text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-text)]'
      }`}
      aria-pressed={active}
    >
      {icon}
      {label ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

function LayoutClassicGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
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
      className="h-4 w-4 shrink-0"
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

function CharacterTagGlyph() {
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
      <path d="M8 4.5h8a2.5 2.5 0 0 1 2.5 2.5v10A2.5 2.5 0 0 1 16 19.5H8A2.5 2.5 0 0 1 5.5 17V7A2.5 2.5 0 0 1 8 4.5Z" />
      <circle cx="12" cy="10" r="2" />
      <path d="M8.5 16c.9-1.8 2.1-2.7 3.5-2.7s2.6.9 3.5 2.7" />
    </svg>
  );
}

function SceneTagGlyph() {
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
      <rect x="4.5" y="5" width="15" height="14" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.4" />
      <path d="M6.5 16l3.5-3.4 2.7 2.6 1.5-1.5 3.3 2.3" />
    </svg>
  );
}

function BlurGlyph() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-current/30">
      <span className="h-2 w-2 rounded-full bg-current/45 blur-[1px]" />
    </span>
  );
}

function ClearGlyph() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-current/35 bg-current/10">
      <span className="h-1.5 w-1.5 rounded-[2px] bg-current/70" />
    </span>
  );
}
