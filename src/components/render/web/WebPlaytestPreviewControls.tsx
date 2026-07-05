import {
  Eye,
  EyeOff,
  House,
  ListMusic,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Undo2,
} from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

import { AudioPlaylistModal } from '../../AudioPlaylistModal';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';

export type PlayedAudio = {
  nodeId: string;
  title: string;
  url: string;
};

export function ChoiceButton({
  label,
  choiceColor,
  choiceTextColor,
  onClick,
}: {
  label: string;
  choiceColor: string;
  choiceTextColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 rounded-xl px-3.5 py-2.5 text-left text-xs font-black leading-snug shadow-lg shadow-black/15 transition-all hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:scale-[0.99]"
      style={{
        backgroundColor: `${choiceColor}cc`,
        border: `1px solid ${choiceColor}`,
        color: choiceTextColor,
      }}
    >
      {label}
    </button>
  );
}

export function ChoiceButtonsGroup({
  items,
  extraClass = '',
  choiceColor,
  choiceTextColor,
}: {
  items: { id: string; label: string; onClick: () => void }[];
  extraClass?: string;
  choiceColor: string;
  choiceTextColor: string;
}) {
  return (
    <div className={`grid gap-2 ${extraClass}`}>
      {items.map((item) => (
        <ChoiceButton
          key={item.id}
          label={item.label}
          choiceColor={choiceColor}
          choiceTextColor={choiceTextColor}
          onClick={item.onClick}
        />
      ))}
    </div>
  );
}

export function ControlsToggle({
  label,
  hidden,
  onClick,
  positionClass,
  style,
}: {
  label: string;
  hidden: boolean;
  onClick: () => void;
  positionClass: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${positionClass} z-30 grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-black/35 text-white shadow-lg shadow-black/20 backdrop-blur-md transition-colors hover:bg-black/55 active:scale-95`}
      style={style}
      title={label}
      aria-label={label}
    >
      {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

export function PreviewToolbar({
  titleText,
  settings,
  previewControlsHidden,
  historyLength,
  showAudioPlaylist,
  playlistAudioUrl,
  playlistAudioRef,
  isPreviewFullscreen,
  t,
  onBack,
  onReturnToStartMenu,
  onToggleAudioPlaylist,
  onToggleFullscreen,
  onPlaylistAudioPlay,
  onPlaylistAudioPause,
  onPlaylistAudioEnded,
}: {
  titleText: string;
  settings: WebExportSettings;
  previewControlsHidden: boolean;
  historyLength: number;
  showAudioPlaylist: boolean;
  playlistAudioUrl: string | null;
  playlistAudioRef: RefObject<HTMLAudioElement | null>;
  isPreviewFullscreen: boolean;
  t: (zh: string, ja: string, en: string) => string;
  onBack: () => void;
  onReturnToStartMenu: () => void;
  onToggleAudioPlaylist: () => void;
  onToggleFullscreen: () => void;
  onPlaylistAudioPlay: () => void;
  onPlaylistAudioPause: () => void;
  onPlaylistAudioEnded: () => void;
}) {
  return (
    <div
      className={`relative z-[200] flex h-12 items-center justify-between overflow-visible px-3 transition-opacity ${
        settings.layoutMode === 'immersive'
          ? 'absolute left-0 right-0 top-0 border-b border-transparent bg-transparent shadow-none backdrop-blur-0'
          : 'border-b border-white/10 bg-gradient-to-b from-black/70 via-black/38 to-transparent shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-md'
      } ${previewControlsHidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <div className="min-w-0 flex items-center gap-2.5">
        <span className="truncate text-sm font-black text-white/88">{titleText}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={historyLength === 0}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-white/12 px-3 text-xs font-black text-white transition-all hover:bg-white/20 active:scale-95 disabled:opacity-35 disabled:grayscale disabled:hover:bg-white/12 disabled:active:scale-100"
          title={t('返回上一页', '前に戻る', 'Back')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t('返回', '戻る', 'Back')}</span>
        </button>
        {settings.showStartMenu && (
          <button
            type="button"
            onClick={onReturnToStartMenu}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-white/12 px-3 text-xs font-black text-white transition-all hover:bg-white/20 active:scale-95"
            title={t('返回主界面', 'メイン画面へ戻る', 'Main menu')}
          >
            <House className="h-3.5 w-3.5" />
            <span>{t('主界面', 'メイン', 'Menu')}</span>
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleAudioPlaylist}
            className={`grid h-8 w-8 place-items-center rounded-full transition-all active:scale-95 ${
              showAudioPlaylist
                ? 'bg-sky-500/35 text-sky-100'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={t('录音播放列表', '録音プレイリスト', 'Audio playlist')}
            aria-label={t('录音播放列表', '録音プレイリスト', 'Audio playlist')}
          >
            <ListMusic className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="grid h-8 w-8 place-items-center rounded-full bg-sky-500/22 text-sky-100 transition-all hover:bg-sky-500/34 active:scale-95"
          title={
            isPreviewFullscreen
              ? t('退出测试全屏', 'テスト全画面を終了', 'Exit test fullscreen')
              : t('测试全屏', 'テスト全画面', 'Test fullscreen')
          }
          aria-label={
            isPreviewFullscreen
              ? t('退出测试全屏', 'テスト全画面を終了', 'Exit test fullscreen')
              : t('测试全屏', 'テスト全画面', 'Test fullscreen')
          }
        >
          {isPreviewFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      </div>
      {playlistAudioUrl && (
        <audio
          ref={playlistAudioRef}
          src={playlistAudioUrl}
          preload="auto"
          onPlay={onPlaylistAudioPlay}
          onPause={onPlaylistAudioPause}
          onEnded={onPlaylistAudioEnded}
          className="hidden"
        />
      )}
    </div>
  );
}

export function PreviewAudioPlaylistModal({
  open,
  items,
  activeUrl,
  isPlaying,
  t,
  onClose,
  onToggleAudio,
}: {
  open: boolean;
  items: PlayedAudio[];
  activeUrl: string | null;
  isPlaying: boolean;
  t: (zh: string, ja: string, en: string) => string;
  onClose: () => void;
  onToggleAudio: (audio: PlayedAudio) => void;
}) {
  return (
    <AudioPlaylistModal
      open={open}
      items={items}
      activeUrl={activeUrl}
      isPlaying={isPlaying}
      title={t('录音播放列表', '録音プレイリスト', 'Audio playlist')}
      hint={t('最近听过的录音排在最上方', '最近聞いた録音を上に表示', 'Most recently heard first')}
      emptyText={t(
        '听过的录音会显示在这里',
        '再生した録音がここに表示されます',
        'Audio you have heard will appear here',
      )}
      closeLabel={t('关闭', '閉じる', 'Close')}
      dark
      scope="container"
      onClose={onClose}
      onToggleAudio={onToggleAudio}
    />
  );
}

export function PreviewSettingsPopover({
  t,
  settings,
  renderStyle,
  reset,
  onUpdateSettings,
  onUpdateRenderStyle,
}: {
  t: (zh: string, ja: string, en: string) => string;
  settings: WebExportSettings;
  renderStyle: RenderStyle;
  reset: () => void;
  onUpdateSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
  onUpdateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
}) {
  return (
    <div
      className="absolute right-0 top-10 z-40 w-[min(560px,calc(100vw-2rem))] max-h-[min(72vh,560px)] overflow-y-auto rounded-2xl border border-white/12 bg-slate-950/94 p-4 text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={reset}
        className="mb-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-black text-white/82 transition-colors hover:bg-white/16 hover:text-white"
      >
        <Undo2 className="h-4 w-4" />
        <span>{t('重置预览', 'プレビューをリセット', 'Reset preview')}</span>
      </button>
      <div className="grid gap-3 md:grid-cols-2">
        <PreviewOptionGroup
          title={t('界面排版', 'レイアウト', 'Layout')}
          options={[
            { value: 'classic', label: t('经典', 'クラシック', 'Classic') },
            { value: 'immersive', label: t('沉浸', '没入', 'Immersive') },
          ]}
          value={settings.layoutMode}
          onChange={(value) =>
            onUpdateSettings('layoutMode', value as WebExportSettings['layoutMode'])
          }
        />
        <PreviewOptionGroup
          title={t('选项位置', '選択肢の位置', 'Choice Position')}
          columns="grid-cols-3"
          options={[
            { value: 'aboveText', label: t('上', '上', 'Above') },
            { value: 'center', label: t('中', '中', 'Center') },
            { value: 'belowText', label: t('下', '下', 'Below') },
          ]}
          value={settings.choicesPosition}
          onChange={(value) =>
            onUpdateSettings('choicesPosition', value as WebExportSettings['choicesPosition'])
          }
        />
        <PreviewOptionGroup
          title={t('交互', 'インタラクション', 'Interaction')}
          options={[
            { value: 'typewriter', label: t('打字机', 'タイプライター', 'Typewriter') },
            { value: 'immediate', label: t('立即显示', '即時表示', 'Immediate') },
          ]}
          value={settings.interactionMode}
          onChange={(value) =>
            onUpdateSettings('interactionMode', value as WebExportSettings['interactionMode'])
          }
        />
        <PreviewOptionGroup
          title={t('自动翻页', '自動進行', 'Auto Advance')}
          options={[
            { value: 'on', label: t('自动', '自動', 'On') },
            { value: 'off', label: t('手动', '手動', 'Manual') },
          ]}
          value={settings.autoAdvance ? 'on' : 'off'}
          onChange={(value) => onUpdateSettings('autoAdvance', value === 'on')}
        />
        <PreviewOptionGroup
          title={t('显示效果', '表示効果', 'Display')}
          options={[
            {
              value: 'backdrop',
              label: t('背景虚化', '背景ぼかし', 'Backdrop'),
              icon: <BlurGlyph />,
            },
            {
              value: 'skip',
              label: t('隐藏单选', '単一選択を隠す', 'Skip Single'),
              icon: <SingleChoicePopupGlyph />,
            },
          ]}
          value={
            settings.blurBackground ? 'backdrop' : settings.skipSingleChoicePopup ? 'skip' : ''
          }
          onChange={(value) => {
            if (value === 'backdrop') onUpdateSettings('blurBackground', !settings.blurBackground);
            if (value === 'skip') {
              onUpdateSettings('skipSingleChoicePopup', !settings.skipSingleChoicePopup);
            }
          }}
        />
        <PreviewOptionGroup
          title={t('媒体', 'メディア', 'Media')}
          options={[
            { value: 'autoplay', label: t('视频自动播放', '動画自動再生', 'Video Autoplay') },
          ]}
          value={settings.videoAutoPlay ? 'autoplay' : ''}
          onChange={() => onUpdateSettings('videoAutoPlay', !settings.videoAutoPlay)}
        />
        <PreviewOptionGroup
          title={t('人物标签', 'キャラタグ', 'Character Tags')}
          titleIcon={<CharacterTagGlyph />}
          options={[
            {
              value: 'hide',
              label: t('隐藏', '非表示', 'Hide'),
              icon: <EyeOff className="h-3.5 w-3.5" />,
            },
            {
              value: 'show',
              label: t('显示', '表示', 'Show'),
              icon: <Eye className="h-3.5 w-3.5" />,
            },
          ]}
          value={settings.hideCharacterTags ? 'hide' : 'show'}
          onChange={(value) => onUpdateSettings('hideCharacterTags', value === 'hide')}
        />
        <PreviewOptionGroup
          title={t('场景标签', 'シーンタグ', 'Scene Tags')}
          titleIcon={<SceneTagGlyph />}
          options={[
            {
              value: 'hide',
              label: t('隐藏', '非表示', 'Hide'),
              icon: <EyeOff className="h-3.5 w-3.5" />,
            },
            {
              value: 'show',
              label: t('显示', '表示', 'Show'),
              icon: <Eye className="h-3.5 w-3.5" />,
            },
          ]}
          value={settings.hideSceneTags ? 'hide' : 'show'}
          onChange={(value) => onUpdateSettings('hideSceneTags', value === 'hide')}
        />
        <PreviewRange
          label={t('标题字号', 'タイトルサイズ', 'Title Size')}
          value={renderStyle.titleFontSize}
          min={18}
          max={120}
          onChange={(value) => onUpdateRenderStyle('titleFontSize', value)}
        />
        <PreviewRange
          label={t('正文字号', '本文サイズ', 'Body Size')}
          value={renderStyle.bodyFontSize}
          min={16}
          max={96}
          onChange={(value) => onUpdateRenderStyle('bodyFontSize', value)}
        />
      </div>
    </div>
  );
}

function PreviewOptionGroup({
  title,
  titleIcon,
  options,
  value,
  onChange,
  columns = 'grid-cols-2',
}: {
  title: string;
  titleIcon?: ReactNode;
  options: { value: string; label: string; icon?: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-white/45">
        {titleIcon}
        {title}
      </div>
      <div className={`grid ${columns} gap-2`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            title={option.label}
            className={`h-8 rounded-lg px-2 text-xs font-black transition-colors ${
              value === option.value
                ? 'bg-sky-500 text-white'
                : 'bg-white/10 text-white/75 hover:bg-white/16'
            }`}
          >
            {option.icon}
            {option.icon ? null : option.label}
          </button>
        ))}
      </div>
    </div>
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

function SceneTagGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
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
    <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-white/20 bg-white/10">
      <Sparkles className="h-2.5 w-2.5" />
      <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-white/30 blur-[1px]" />
    </span>
  );
}

function PreviewRange({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center justify-between text-xs font-black text-white/75">
        <span>{label}</span>
        <span>{value}px</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-sky-400"
      />
    </label>
  );
}
