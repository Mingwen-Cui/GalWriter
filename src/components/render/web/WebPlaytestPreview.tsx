import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import { Eye, EyeOff, Maximize2, Minimize2, RotateCcw, Settings, Undo2 } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { renderCopy } from '../video/shared/renderCopy';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';
import {
  getNodeDisplayText,
  getNodeDisplayTitle,
  filterMentionTags,
  stripHtml,
  webAnimationStyle,
} from '../video/shared/storyNodes';
import {
  clampCharacterLayer,
  getCharacterStagePosition,
  normalizeStoryPresentation,
  getPresentationTransform,
} from '../../../lib/presentation';
import type {
  CharacterNodeData,
  CharacterPresentation,
  StoryPresentation,
} from '../../../domain/project';

type WebPlaytestPreviewProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  language: Language;
  renderStyle: RenderStyle;
  choiceColor: string;
  choiceTextColor: string;
  settings: WebExportSettings;
  projectTitle: string;
  onUpdateSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
  onUpdateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
};

export function WebPlaytestPreview({
  nodes,
  edges,
  language,
  renderStyle,
  choiceColor,
  choiceTextColor,
  settings,
  projectTitle,
  onUpdateSettings,
  onUpdateRenderStyle,
}: WebPlaytestPreviewProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const playableNodes = useMemo(
    () => nodes.filter((node) => node.type === 'storyNode' && !node.data?.hidden),
    [nodes],
  );
  const root = useMemo(
    () => playableNodes.find((node) => node.data?.isRoot) || playableNodes[0] || null,
    [playableNodes],
  );
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(() => root?.id || null);
  const [history, setHistory] = useState<string[]>([]);
  const [animationDone, setAnimationDone] = useState(settings.interactionMode !== 'typewriter');
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [showPreviewSettings, setShowPreviewSettings] = useState(false);
  const [previewControlsHidden, setPreviewControlsHidden] = useState(false);
  const [displayedPreviewText, setDisplayedPreviewText] = useState('');
  const previewRootRef = useRef<HTMLDivElement>(null);
  const [presentationVisible, setPresentationVisible] = useState(false);
  const [presentationExiting, setPresentationExiting] = useState(false);

  React.useEffect(() => {
    setPresentationExiting(false);
    setPresentationVisible(false);
    const frame = requestAnimationFrame(() => setPresentationVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [currentNodeId]);

  React.useEffect(() => {
    if (!root) {
      setCurrentNodeId(null);
      setHistory([]);
      return;
    }
    setCurrentNodeId((current) =>
      current && (current === 'THE_END' || playableNodes.some((node) => node.id === current))
        ? current
        : root.id,
    );
  }, [playableNodes, root]);

  const currentNode =
    currentNodeId && currentNodeId !== 'THE_END'
      ? playableNodes.find((node) => node.id === currentNodeId)
      : null;
  const outEdges = currentNodeId ? edges.filter((edge) => edge.source === currentNodeId) : [];
  const imageUrl = typeof currentNode?.data?.imageUrl === 'string' ? currentNode.data.imageUrl : '';
  const videoUrl = typeof currentNode?.data?.videoUrl === 'string' ? currentNode.data.videoUrl : '';
  const audioUrl = typeof currentNode?.data?.audioUrl === 'string' ? currentNode.data.audioUrl : '';
  const presentation = normalizeStoryPresentation(
    currentNode?.data?.presentation as StoryPresentation | undefined,
  );
  const presentedCharacters = useMemo(() => {
    if (!presentation.characters) return [];
    return presentation.characters
      .map((config) => {
        const source = nodes.find((node) => node.id === config.sourceNodeId);
        if (!source || source.type !== 'characterNode') return null;
        const characterData = source.data as CharacterNodeData;
        const outfit = config.outfitId
          ? characterData.outfits?.find((item) => item.id === config.outfitId)
          : characterData.outfits?.find((item) => item.imageUrl);
        const imageUrl = outfit?.imageUrl || characterData.avatarUrl;
        if (!imageUrl) return null;
        return { config, data: characterData, imageUrl };
      })
      .filter(
        (
          item,
        ): item is {
          config: CharacterPresentation;
          data: CharacterNodeData;
          imageUrl: string;
        } => Boolean(item),
      );
  }, [presentation.characters, nodes]);
  const text = filterMentionTags(
    getNodeDisplayText(currentNode),
    settings.hideCharacterTags,
    settings.hideSceneTags,
  );
  const shouldHideCenteredSingleChoice =
    settings.choicesPosition === 'center' && settings.skipSingleChoicePopup && outEdges.length <= 1;
  const shouldShowChoices =
    !shouldHideCenteredSingleChoice && (animationDone || !settings.autoAdvance);
  const canClickContinue = outEdges.length <= 1;

  const goTo = (targetId: string) => {
    if (presentationExiting) return;
    const exitDuration = Math.max(
      presentation.scene?.exit.type === 'none' ? 0 : presentation.scene?.exit.duration || 0,
      ...presentation.characters.map((char) =>
        char.exit.type === 'none' ? 0 : char.exit.duration || 0,
      ),
    );
    setPresentationExiting(true);
    window.setTimeout(() => {
      if (currentNodeId) setHistory((prev) => [...prev, currentNodeId]);
      setCurrentNodeId(targetId);
    }, exitDuration);
  };

  React.useEffect(() => {
    setAnimationDone(settings.interactionMode !== 'typewriter');
    if (settings.interactionMode !== 'typewriter') {
      setDisplayedPreviewText(text);
      return;
    }
    const source = stripHtml(text);
    let index = 0;
    setDisplayedPreviewText('');
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayedPreviewText(source.slice(0, index));
      if (index >= source.length) {
        window.clearInterval(timer);
        setAnimationDone(true);
      }
    }, settings.typewriterSpeed);
    return () => window.clearInterval(timer);
  }, [currentNodeId, settings.interactionMode, settings.typewriterSpeed, text]);

  React.useEffect(() => {
    if (!settings.autoAdvance || !animationDone || outEdges.length > 1) return;
    const timer = window.setTimeout(() => goTo(outEdges[0]?.target || 'THE_END'), 900);
    return () => window.clearTimeout(timer);
  }, [animationDone, currentNodeId, outEdges, settings.autoAdvance]);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsPreviewFullscreen(document.fullscreenElement === previewRootRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const continueFromText = () => {
    if (!canClickContinue) return;
    goTo(outEdges[0]?.target || 'THE_END');
  };

  const reset = () => {
    setHistory([]);
    setCurrentNodeId(root?.id || null);
  };

  const back = () => {
    setHistory((prev) => {
      const next = [...prev];
      const previous = next.pop();
      if (previous) setCurrentNodeId(previous);
      return next;
    });
  };

  const togglePreviewFullscreen = async () => {
    const previewRoot = previewRootRef.current;
    if (!previewRoot) return;
    try {
      if (document.fullscreenElement === previewRoot) {
        await document.exitFullscreen();
        return;
      }
      await previewRoot.requestFullscreen();
    } catch (fullscreenError) {
      console.warn('Could not toggle web preview fullscreen:', fullscreenError);
    }
  };

  const controlsLabel = previewControlsHidden
    ? t('显示上方按钮', '上部ボタンを表示', 'Show controls')
    : t('隐藏上方按钮', '上部ボタンを隠す', 'Hide controls');

  const renderChoiceButtons = (extraClass = '') => {
    if (!shouldShowChoices) return null;
    if (outEdges.length === 0) {
      return (
        <div className={`grid gap-2 ${extraClass}`}>
          <ChoiceButton
            label={t('剧本结束', 'シナリオ終了', 'The End')}
            choiceColor={choiceColor}
            choiceTextColor={choiceTextColor}
            onClick={() => goTo('THE_END')}
          />
        </div>
      );
    }
    return (
      <div className={`grid gap-2 ${extraClass}`}>
        {outEdges.map((edge, index) => {
          const target = playableNodes.find((node) => node.id === edge.target);
          const label =
            getNodeDisplayTitle(target) ||
            edge.data?.label ||
            (outEdges.length === 1
              ? t('继续', '続ける', 'Continue')
              : `${t('选项', '選択肢', 'Option')} ${index + 1}`);
          return (
            <ChoiceButton
              key={edge.id}
              label={String(label)}
              choiceColor={choiceColor}
              choiceTextColor={choiceTextColor}
              onClick={() => goTo(edge.target)}
            />
          );
        })}
      </div>
    );
  };

  const renderPreviewToolbar = (
    titleText = projectTitle || t('未命名作品', '無題の作品', 'Untitled Project'),
  ) => (
    <div
      className={`flex h-12 items-center justify-between px-3 transition-opacity ${
        settings.layoutMode === 'immersive'
          ? 'absolute left-0 right-0 top-0 z-30 border-b border-transparent bg-transparent shadow-none backdrop-blur-0'
          : 'border-b border-white/10 bg-gradient-to-b from-black/70 via-black/38 to-transparent shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-md'
      } ${previewControlsHidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <div className="min-w-0 flex items-center gap-2.5">
        <span className="truncate text-sm font-black text-white/88">{titleText}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={back}
          disabled={history.length === 0}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-white/12 px-3 text-xs font-black text-white transition-all hover:bg-white/20 active:scale-95 disabled:opacity-35 disabled:grayscale disabled:hover:bg-white/12 disabled:active:scale-100"
          title={t('返回上一页', '前に戻る', 'Back')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t('返回', '戻る', 'Back')}</span>
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPreviewSettings((prev) => !prev)}
            className={`grid h-8 w-8 place-items-center rounded-full transition-all active:scale-95 ${
              showPreviewSettings
                ? 'bg-white/24 text-white'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={t('预览设置', 'プレビュー設定', 'Preview settings')}
            aria-label={t('预览设置', 'プレビュー設定', 'Preview settings')}
          >
            <Settings className="h-4 w-4" />
          </button>
          {showPreviewSettings && (
            <PreviewSettingsPopover
              t={t}
              settings={settings}
              renderStyle={renderStyle}
              reset={() => {
                reset();
                setShowPreviewSettings(false);
              }}
              onUpdateSettings={onUpdateSettings}
              onUpdateRenderStyle={onUpdateRenderStyle}
            />
          )}
        </div>
        <button
          type="button"
          onClick={togglePreviewFullscreen}
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
    </div>
  );

  if (!root) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border border-dashed border-[var(--vr-border-strong)] bg-[var(--vr-panel)] text-sm font-bold text-[var(--vr-text-muted)]">
        {t(
          '没有可预览的剧本节点',
          'プレビューできるシナリオノードがありません',
          'No story nodes to preview',
        )}
      </div>
    );
  }

  if (currentNodeId === 'THE_END') {
    return (
      <div
        ref={previewRootRef}
        className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-white/10 bg-slate-950 text-white shadow-sm"
      >
        {renderPreviewToolbar()}
        <ControlsToggle
          label={controlsLabel}
          hidden={previewControlsHidden}
          onClick={() => setPreviewControlsHidden((prev) => !prev)}
          positionClass="absolute bottom-4 right-4"
        />
        <div className="grid flex-1 place-items-center p-6 text-center text-2xl font-black text-[var(--vr-text)]">
          {t('剧本结束', 'シナリオ終了', 'The End')}
        </div>
      </div>
    );
  }

  const sceneMotion = presentationExiting ? presentation.scene?.exit : presentation.scene?.enter;
  const sceneAnimationActive = presentationExiting || !presentationVisible;
  const sceneObjectFit =
    presentation.scene?.cropMode === 'contain'
      ? 'contain'
      : presentation.scene?.cropMode === 'stretch'
        ? 'fill'
        : 'cover';
  const finalObjectFit =
    settings.layoutMode === 'immersive'
      ? 'cover'
      : presentation.scene?.cropMode
        ? sceneObjectFit
        : 'contain';
  const sceneStyle: React.CSSProperties = {
    objectFit: finalObjectFit as any,
    objectPosition: `${50 + (presentation.scene?.offsetX || 0)}% ${
      50 + (presentation.scene?.offsetY || 0)
    }%`,
    opacity: sceneAnimationActive && sceneMotion?.type === 'fade' ? 0 : 1,
    transform: `scale(${presentation.scene?.scale || 1}) ${
      sceneAnimationActive && sceneMotion
        ? getPresentationTransform(sceneMotion.type, presentationExiting)
        : ''
    }`,
    transitionProperty: 'opacity, transform',
    transitionDuration: `${sceneMotion?.type === 'none' ? 0 : sceneMotion?.duration || 0}ms`,
    transitionTimingFunction: 'ease-out',
  };

  return (
    <div
      ref={previewRootRef}
      className="relative h-full min-h-[320px] overflow-hidden rounded-lg border border-white/10 bg-slate-950 text-white shadow-sm"
    >
      <style>
        {`@keyframes webPreviewFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes webPreviewSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}
      </style>
      {imageUrl && (
        <div
          className={`absolute inset-0 bg-cover bg-center opacity-35 scale-105 ${settings.blurBackground ? 'blur-sm' : ''}`}
          style={{ backgroundImage: `url("${imageUrl.replace(/"/g, '\\"')}")` }}
        />
      )}
      <div
        className={`z-10 ${
          settings.layoutMode === 'immersive'
            ? 'absolute inset-0 bg-transparent'
            : 'relative grid h-full grid-rows-[48px_minmax(0,1fr)_auto] bg-slate-950/45'
        }`}
      >
        {renderPreviewToolbar()}
        <div
          className={settings.layoutMode === 'immersive' ? 'absolute inset-0 p-0' : 'min-h-0 p-4'}
        >
          <div
            className={`flex h-full min-h-0 items-center justify-center overflow-hidden relative ${
              settings.layoutMode === 'immersive' ? 'rounded-none' : 'rounded-lg bg-black/35'
            }`}
            onClick={continueFromText}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full" style={sceneStyle} />
            ) : videoUrl ? (
              <video
                src={videoUrl}
                controls
                playsInline
                autoPlay={settings.videoAutoPlay}
                muted={settings.videoAutoPlay}
                className="h-full w-full"
                style={sceneStyle}
              />
            ) : (
              <div className="px-6 text-center text-sm font-bold text-white/45">
                {t(
                  '当前节点没有图片或视频',
                  '現在のノードに画像または動画がありません',
                  'This node has no image or video',
                )}
              </div>
            )}
            {presentedCharacters.length > 0 && (
              <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
                {presentedCharacters.map(({ config, data, imageUrl }) => {
                  const motion = presentationExiting ? config.exit : config.enter;
                  const animationActive = presentationExiting || !presentationVisible;
                  const animationTransform =
                    animationActive && motion
                      ? getPresentationTransform(motion.type, presentationExiting)
                      : '';
                  return (
                    <img
                      key={config.sourceNodeId}
                      src={imageUrl}
                      alt={data.characterName}
                      className="absolute max-h-[92%] max-w-[72%] w-auto object-contain object-bottom"
                      style={{
                        ...getCharacterStagePosition(config),
                        zIndex: clampCharacterLayer(config.layer),
                        opacity: animationActive && motion.type === 'fade' ? 0 : 1,
                        translate: '-50% 0',
                        transform: `${animationTransform} scale(${config.scale}) scaleX(${config.flipX ? -1 : 1})`,
                        transformOrigin: 'center center',
                        transitionProperty: 'opacity, transform',
                        transitionDuration: `${motion.type === 'none' ? 0 : motion.duration}ms`,
                        transitionTimingFunction: 'ease-out',
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {settings.choicesPosition === 'center' && shouldShowChoices && (
          <div
            className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ width: 'min(520px, calc(100% - 32px))' }}
          >
            {renderChoiceButtons()}
          </div>
        )}
        <div
          className={`${
            settings.layoutMode === 'immersive'
              ? 'pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-end justify-center'
              : 'relative'
          }`}
          style={{
            width:
              settings.layoutMode === 'immersive' ? 'min(960px, calc(100% - 112px))' : undefined,
            maxHeight: settings.layoutMode === 'immersive' ? 'calc(100% - 96px)' : undefined,
          }}
        >
          <div
            className={`pointer-events-auto relative w-full border-t border-white/10 p-4 ${
              settings.layoutMode === 'immersive'
                ? 'overflow-y-auto rounded-xl border border-white/12 bg-black/38 shadow-2xl shadow-black/30 backdrop-blur-xl'
                : ''
            }`}
            style={{
              backgroundColor:
                settings.layoutMode === 'immersive'
                  ? `${renderStyle.panelColor}cc`
                  : renderStyle.panelColor,
              maxHeight: settings.layoutMode === 'immersive' ? 'inherit' : undefined,
            }}
          >
            {settings.choicesPosition === 'aboveText' && renderChoiceButtons('mb-3')}
            <div
              key={`${currentNodeId}-body-${renderStyle.bodyAnimation}`}
              className="mt-2 text-sm leading-relaxed text-slate-200"
              style={{
                color: renderStyle.bodyColor,
                fontSize: renderStyle.bodyFontSize,
                ...webAnimationStyle(renderStyle.bodyAnimation),
              }}
              onClick={continueFromText}
            >
              {settings.interactionMode === 'typewriter' ? displayedPreviewText || '' : null}
              {settings.interactionMode !== 'typewriter' && (
                <span
                  dangerouslySetInnerHTML={{
                    __html: text || t('（无正文）', '（本文なし）', '(No body text)'),
                  }}
                />
              )}
            </div>
            {audioUrl && (
              <audio src={audioUrl} controls preload="metadata" className="mt-3 w-full" />
            )}
            {settings.choicesPosition === 'belowText' && renderChoiceButtons('mt-3')}
          </div>
          <ControlsToggle
            label={controlsLabel}
            hidden={previewControlsHidden}
            onClick={() => setPreviewControlsHidden((prev) => !prev)}
            positionClass={
              settings.layoutMode === 'immersive'
                ? 'pointer-events-auto static ml-3 shrink-0'
                : 'absolute left-full top-0 ml-3'
            }
          />
        </div>
      </div>
    </div>
  );
}

function ChoiceButton({
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

function ControlsToggle({
  label,
  hidden,
  onClick,
  positionClass,
}: {
  label: string;
  hidden: boolean;
  onClick: () => void;
  positionClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${positionClass} z-30 grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-black/35 text-white shadow-lg shadow-black/20 backdrop-blur-md transition-all hover:bg-black/55 active:scale-95`}
      title={label}
      aria-label={label}
    >
      {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

function PreviewSettingsPopover({
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
            { value: 'center', label: t('中间', '中央', 'Center') },
            { value: 'aboveText', label: t('上方', '上', 'Above') },
            { value: 'belowText', label: t('下方', '下', 'Below') },
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
            { value: 'on', label: t('自动', 'オン', 'On') },
            { value: 'off', label: t('手动', '手動', 'Manual') },
          ]}
          value={settings.autoAdvance ? 'on' : 'off'}
          onChange={(value) => onUpdateSettings('autoAdvance', value === 'on')}
        />
        <PreviewOptionGroup
          title={t('显示效果', '表示効果', 'Display')}
          options={[
            { value: 'backdrop', label: t('背景虚化', '背景ぼかし', 'Backdrop') },
            { value: 'skip', label: t('隐藏单选', '単一選択を隠す', 'Skip Single') },
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
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-white/45">
        {title}
      </div>
      <div className={`grid ${columns} gap-2`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`h-8 rounded-lg px-2 text-xs font-black transition-colors ${
              value === option.value
                ? 'bg-sky-500 text-white'
                : 'bg-white/10 text-white/75 hover:bg-white/16'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
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
