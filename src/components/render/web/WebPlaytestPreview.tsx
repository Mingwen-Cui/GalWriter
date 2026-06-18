import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import {
  Eye,
  EyeOff,
  ListMusic,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Sparkles,
  RotateCcw,
  Undo2,
  X,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type {
  CharacterNodeData,
  CharacterPresentation,
  StoryPresentation,
} from '../../../domain/project';
import type { Language } from '../../../lib/i18n';
import {
  clampCharacterLayer,
  getCharacterEnterDelay,
  getCharacterStagePosition,
  getPresentationExitDuration,
  getPresentationTransform,
  getSceneExitDelay,
  normalizeStoryPresentation,
} from '../../../lib/presentation';
import { useRegionBackgroundMusic } from '../../../lib/useRegionBackgroundMusic';
import { renderCopy } from '../video/shared/renderCopy';
import {
  filterMentionTags,
  getNodeDisplayText,
  getNodeDisplayTitle,
  stripHtml,
  webAnimationStyle,
} from '../video/shared/storyNodes';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';

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

type PlayedAudio = {
  nodeId: string;
  title: string;
  url: string;
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
  const [showAudioPlaylist, setShowAudioPlaylist] = useState(false);
  const [playedAudios, setPlayedAudios] = useState<PlayedAudio[]>([]);
  const [playlistAudioUrl, setPlaylistAudioUrl] = useState<string | null>(null);
  const [isPlaylistAudioPlaying, setIsPlaylistAudioPlaying] = useState(false);
  const [currentAudioEnded, setCurrentAudioEnded] = useState(false);
  const [currentVideoEnded, setCurrentVideoEnded] = useState(false);
  const [previewControlsHidden, setPreviewControlsHidden] = useState(false);
  const [displayedPreviewText, setDisplayedPreviewText] = useState('');
  const previewRootRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement>(null);
  const currentVideoRef = useRef<HTMLVideoElement>(null);
  const playlistAudioRef = useRef<HTMLAudioElement>(null);
  const imagePreloadRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [presentationVisible, setPresentationVisible] = useState(false);
  const [presentationExiting, setPresentationExiting] = useState(false);

  const colorInputValue = (value: string, fallback = '#111827') => {
    const trimmed = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
    const rgba = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!rgba) return fallback;
    return `#${[rgba[1], rgba[2], rgba[3]]
      .map((channel) => Number(channel).toString(16).padStart(2, '0'))
      .join('')}`;
  };
  const withAlpha = (hex: string, alpha: number) => {
    const normalized = colorInputValue(hex);
    const red = Number.parseInt(normalized.slice(1, 3), 16);
    const green = Number.parseInt(normalized.slice(3, 5), 16);
    const blue = Number.parseInt(normalized.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  };
  const gradientStops =
    renderStyle.dialogGradientStops?.length >= 2
      ? [...renderStyle.dialogGradientStops].sort((a, b) => a.position - b.position)
      : [
          {
            color: colorInputValue(renderStyle.dialogGradientStartColor),
            alpha: 0,
            position: 0,
          },
          {
            color: colorInputValue(renderStyle.dialogGradientColor),
            alpha: 86,
            position: 100,
          },
        ];
  const dialogueBackgroundStyle = (): React.CSSProperties => {
    if (renderStyle.dialogBackgroundType === 'gradient') {
      const angle = Number.isFinite(renderStyle.dialogGradientAngle)
        ? renderStyle.dialogGradientAngle
        : 90;
      const stops = gradientStops
        .map((stop) => `${withAlpha(stop.color, stop.alpha / 100)} ${stop.position}%`)
        .join(', ');
      return { background: `linear-gradient(${angle}deg, ${stops})` };
    }
    if (renderStyle.dialogBackgroundType === 'image' && renderStyle.dialogImageUrl) {
      return {
        backgroundImage: `url("${renderStyle.dialogImageUrl.replace(/"/g, '\\"')}")`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      };
    }
    return {
      backgroundColor: withAlpha(renderStyle.panelColor, (renderStyle.panelColorAlpha ?? 82) / 100),
    };
  };
  const textStroke = (width: number, color: string) =>
    width > 0 ? `${width}px ${colorInputValue(color, '#000000')}` : undefined;
  const titleStyle: React.CSSProperties = {
    fontFamily: renderStyle.titleFontFamily,
    color: withAlpha(
      colorInputValue(renderStyle.titleColor),
      (renderStyle.titleColorAlpha ?? 100) / 100,
    ),
    WebkitTextStroke: textStroke(renderStyle.titleStrokeWidth, renderStyle.titleStrokeColor),
    fontSize: renderStyle.titleFontSize,
    letterSpacing: `${renderStyle.titleLetterSpacing ?? 0}px`,
    lineHeight: renderStyle.titleLineHeight,
    textAlign: renderStyle.titleAlign,
    overflowWrap: 'anywhere',
    ...webAnimationStyle(renderStyle.titleAnimation),
  };
  const bodyStyle: React.CSSProperties = {
    fontFamily: renderStyle.bodyFontFamily,
    color: withAlpha(
      colorInputValue(renderStyle.bodyColor),
      (renderStyle.bodyColorAlpha ?? 100) / 100,
    ),
    WebkitTextStroke: textStroke(renderStyle.bodyStrokeWidth, renderStyle.bodyStrokeColor),
    fontSize: renderStyle.bodyFontSize,
    letterSpacing: `${renderStyle.bodyLetterSpacing ?? 0}px`,
    lineHeight: renderStyle.bodyLineHeight,
    textAlign: renderStyle.bodyAlign,
    overflowWrap: 'anywhere',
    ...webAnimationStyle(renderStyle.bodyAnimation),
  };
  const dialogueShellStyle: React.CSSProperties = {
    ...(renderStyle.dialogVisible
      ? dialogueBackgroundStyle()
      : {
          background: 'transparent',
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          borderColor: 'transparent',
          boxShadow: 'none',
          backdropFilter: 'none',
        }),
    borderRadius: renderStyle.dialogRadius,
    maxHeight: settings.layoutMode === 'immersive' ? 'calc(100% - 96px)' : undefined,
    paddingLeft: `${Math.max(2, renderStyle.dialogTextPaddingX ?? 9)}%`,
    paddingRight: `${Math.max(2, renderStyle.dialogTextPaddingX ?? 9)}%`,
  };

  React.useEffect(() => {
    setPresentationExiting(false);
    setPresentationVisible(false);
    setCurrentAudioEnded(false);
    setCurrentVideoEnded(false);
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
  useRegionBackgroundMusic(nodes, currentNode, currentNodeId !== 'THE_END');
  const outEdges = currentNodeId ? edges.filter((edge) => edge.source === currentNodeId) : [];
  const imageUrl = typeof currentNode?.data?.imageUrl === 'string' ? currentNode.data.imageUrl : '';
  const videoUrl = typeof currentNode?.data?.videoUrl === 'string' ? currentNode.data.videoUrl : '';
  const audioUrl = typeof currentNode?.data?.audioUrl === 'string' ? currentNode.data.audioUrl : '';
  const audioTitle =
    getNodeDisplayTitle(currentNode) ||
    stripHtml(getNodeDisplayText(currentNode)).trim().replace(/\s+/g, ' ').slice(0, 42) ||
    t('未命名录音', '名称未設定の録音', 'Untitled audio');
  const presentation = normalizeStoryPresentation(
    currentNode?.data?.presentation as StoryPresentation | undefined,
  );

  React.useEffect(() => {
    if (!imageUrl || imagePreloadRef.current.has(imageUrl)) return;
    const image = new Image();
    image.src = imageUrl;
    imagePreloadRef.current.set(imageUrl, image);
  }, [imageUrl]);
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
  const hideCenteredTitle = false;

  const recordCurrentAudio = () => {
    if (!currentNode || !audioUrl) return;
    playlistAudioRef.current?.pause();
    setIsPlaylistAudioPlaying(false);
    const entry = {
      nodeId: currentNode.id,
      title: String(audioTitle),
      url: audioUrl,
    };
    setPlayedAudios((previous) => [
      entry,
      ...previous.filter((audio) => audio.nodeId !== entry.nodeId && audio.url !== entry.url),
    ]);
  };

  const togglePlaylistAudio = (audio: PlayedAudio) => {
    currentAudioRef.current?.pause();
    if (playlistAudioUrl === audio.url && playlistAudioRef.current) {
      if (playlistAudioRef.current.paused) {
        playlistAudioRef.current.play().catch((error) => {
          console.error('Web preview playlist playback failed', error);
        });
      } else {
        playlistAudioRef.current.pause();
      }
      return;
    }
    setPlaylistAudioUrl(audio.url);
  };

  React.useEffect(() => {
    if (audioUrl && currentAudioRef.current) {
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current.play().catch(() => {
        // Browser autoplay policies may require the first playback to be user initiated.
      });
    }
    if (settings.autoAdvance && videoUrl && currentVideoRef.current) {
      currentVideoRef.current.currentTime = 0;
      currentVideoRef.current.play().catch(() => {});
    }
  }, [audioUrl, currentNodeId, settings.autoAdvance, videoUrl]);

  React.useEffect(() => {
    if (!playlistAudioUrl || !playlistAudioRef.current) return;
    playlistAudioRef.current.currentTime = 0;
    playlistAudioRef.current.play().catch((error) => {
      setIsPlaylistAudioPlaying(false);
      console.error('Web preview playlist playback failed', error);
    });
  }, [playlistAudioUrl]);

  const goTo = (targetId: string) => {
    if (settings.layoutMode === 'classic') {
      if (currentNodeId) setHistory((prev) => [...prev, currentNodeId]);
      setCurrentNodeId(targetId);
      return;
    }
    if (presentationExiting) return;
    const exitDuration = getPresentationExitDuration(presentation);
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
    const revealUnits =
      renderStyle.bodyTypewriterMode === 'line'
        ? source.split(/(\n+)/)
        : renderStyle.bodyTypewriterMode === 'sentence' || renderStyle.bodyTypewriterMode === 'word'
          ? source.match(/[^。！？.!?\n]+[。！？.!?]*|\n+/g) || Array.from(source)
          : Array.from(source);
    let index = 0;
    setDisplayedPreviewText('');
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayedPreviewText(revealUnits.slice(0, index).join(''));
      if (index >= revealUnits.length) {
        window.clearInterval(timer);
        setAnimationDone(true);
      }
    }, settings.typewriterSpeed);
    return () => window.clearInterval(timer);
  }, [
    currentNodeId,
    renderStyle.bodyTypewriterMode,
    settings.interactionMode,
    settings.typewriterSpeed,
    text,
  ]);

  React.useEffect(() => {
    if (!settings.autoAdvance || outEdges.length > 1) return;

    if (audioUrl || videoUrl) {
      if ((!audioUrl || currentAudioEnded) && (!videoUrl || currentVideoEnded)) {
        goTo(outEdges[0]?.target || 'THE_END');
      }
      return;
    }

    if (!animationDone) return;
    const timer = window.setTimeout(() => goTo(outEdges[0]?.target || 'THE_END'), 900);
    return () => window.clearTimeout(timer);
  }, [
    animationDone,
    audioUrl,
    currentAudioEnded,
    currentNodeId,
    currentVideoEnded,
    outEdges,
    settings.autoAdvance,
    videoUrl,
  ]);

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
    titleText = projectTitle || t('网页标题', 'Webタイトル', 'Web Title'),
  ) => (
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
            onClick={() => {
              setShowAudioPlaylist((visible) => !visible);
            }}
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
          {showAudioPlaylist && (
            <div
              className="absolute right-0 top-10 z-[300] flex h-80 w-[min(320px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-slate-950/94 p-3 text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <div className="text-sm font-black">
                    {t('录音播放列表', '録音プレイリスト', 'Audio playlist')}
                  </div>
                  <div className="mt-0.5 text-[10px] text-white/45">
                    {t(
                      '最近听过的录音排在最上方',
                      '最近聞いた録音を上に表示',
                      'Most recently heard first',
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAudioPlaylist(false)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white"
                aria-label={t('关闭', '閉じる', 'Close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {playedAudios.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/15 px-6 text-center text-xs text-white/40">
                    {t(
                      '听过的录音会显示在这里',
                      '再生した録音がここに表示されます',
                      'Audio you have heard will appear here',
                    )}
                  </div>
                ) : (
                  playedAudios.map((audio) => {
                    const isActive = playlistAudioUrl === audio.url && isPlaylistAudioPlaying;
                    return (
                      <div
                        key={`${audio.nodeId}-${audio.url}`}
                        className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 ${
                          isActive
                            ? 'border-sky-400/50 bg-sky-500/15'
                            : 'border-white/10 bg-white/[0.05]'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate text-center text-xs font-bold text-white/85">
                          {audio.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePlaylistAudio(audio)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-500 text-white transition hover:bg-sky-400 active:scale-95"
                          aria-label={isActive ? 'Pause' : 'Play'}
                        >
                          {isActive ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="ml-0.5 h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
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
      {playlistAudioUrl && (
        <audio
          ref={playlistAudioRef}
          src={playlistAudioUrl}
          preload="auto"
          onPlay={() => setIsPlaylistAudioPlaying(true)}
          onPause={() => setIsPlaylistAudioPlaying(false)}
          onEnded={() => setIsPlaylistAudioPlaying(false)}
          className="hidden"
        />
      )}
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
  const sceneAnimationActive =
    settings.layoutMode === 'immersive' && (presentationExiting || !presentationVisible);
  const presentationScale = presentation.scene?.scale || 1;
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
    transform:
      sceneAnimationActive && sceneMotion
        ? getPresentationTransform(sceneMotion.type, presentationExiting)
        : 'none',
    transitionProperty: 'opacity, transform',
    transitionDuration:
      settings.layoutMode === 'classic'
        ? '0ms'
        : `${sceneMotion?.type === 'none' ? 0 : sceneMotion?.duration || 0}ms`,
    transitionDelay:
      settings.layoutMode === 'classic' || !presentationExiting
        ? '0ms'
        : `${getSceneExitDelay(presentation)}ms`,
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
      {imageUrl && settings.layoutMode === 'immersive' && (
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
              settings.layoutMode === 'immersive' ? 'rounded-none' : 'bg-transparent'
            }`}
            onClick={continueFromText}
          >
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ transform: `scale(${presentationScale})`, transformOrigin: 'center' }}
            >
              {imageUrl ? (
                <img
                  key={`${currentNodeId}-${imageUrl}-${settings.layoutMode}`}
                  src={imageUrl}
                  alt=""
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                  className={
                    settings.layoutMode === 'classic'
                      ? 'preview-media-safe block h-auto max-h-full w-auto max-w-full rounded-lg border border-white/10 object-contain shadow-lg transform-none animate-none transition-none'
                      : 'preview-media-safe h-full w-full'
                  }
                  style={
                    settings.layoutMode === 'classic'
                      ? {
                          objectFit: 'contain',
                          objectPosition: '50% 50%',
                          width: 'auto',
                          height: 'auto',
                          maxWidth: '100%',
                          maxHeight: '100%',
                          opacity: 1,
                          transform: 'none',
                          transition: 'none',
                          animation: 'none',
                        }
                      : sceneStyle
                  }
                />
              ) : videoUrl ? (
                <video
                  ref={currentVideoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  autoPlay={settings.videoAutoPlay || settings.autoAdvance}
                  muted={settings.videoAutoPlay}
                  onEnded={() => setCurrentVideoEnded(true)}
                  className="h-full w-full"
                  style={sceneStyle}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm font-bold text-white/45">
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
                    const animationActive =
                      settings.layoutMode === 'immersive' &&
                      (presentationExiting || !presentationVisible);
                    const animationTransform =
                      animationActive && motion
                        ? getPresentationTransform(motion.type, presentationExiting)
                        : '';
                    return (
                      <img
                        key={config.sourceNodeId}
                        src={imageUrl}
                        alt={data.characterName}
                        draggable={false}
                        onDragStart={(event) => event.preventDefault()}
                        className="preview-media-safe absolute max-h-[92%] max-w-[72%] w-auto object-contain object-bottom"
                        style={{
                          ...getCharacterStagePosition(config),
                          zIndex: clampCharacterLayer(config.layer),
                          opacity: animationActive && motion.type === 'fade' ? 0 : 1,
                          translate: '-50% 0',
                          transform: `${animationTransform} scale(${config.scale}) scaleX(${config.flipX ? -1 : 1})`,
                          transformOrigin: 'center center',
                          transitionProperty: 'opacity, transform',
                          transitionDuration:
                            settings.layoutMode === 'classic'
                              ? '0ms'
                              : `${motion.type === 'none' ? 0 : motion.duration}ms`,
                          transitionDelay:
                            settings.layoutMode === 'classic' || presentationExiting
                              ? '0ms'
                              : `${getCharacterEnterDelay(presentation)}ms`,
                          transitionTimingFunction: 'ease-out',
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
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
              ? 'pointer-events-none absolute z-20 flex items-end justify-center'
              : 'relative'
          }`}
          style={{
            width:
              settings.layoutMode === 'immersive'
                ? `min(${renderStyle.dialogWidth}%, calc(100% - 24px))`
                : `${renderStyle.dialogWidth}%`,
            height:
              settings.layoutMode === 'immersive' ? `${renderStyle.dialogHeight}%` : undefined,
            maxHeight: settings.layoutMode === 'immersive' ? 'calc(100% - 96px)' : undefined,
            left:
              settings.layoutMode === 'immersive'
                ? `${50 + Math.max(-100, Math.min(100, renderStyle.dialogOffsetX ?? 0)) * 0.5}%`
                : undefined,
            bottom:
              settings.layoutMode === 'immersive'
                ? `calc(4% - ${Math.max(-100, Math.min(100, renderStyle.dialogOffsetY ?? 0)) * 0.28}%)`
                : undefined,
            transform: settings.layoutMode === 'immersive' ? 'translateX(-50%)' : undefined,
            justifySelf: settings.layoutMode === 'classic' ? 'center' : undefined,
          }}
        >
          <div
            className={`pointer-events-auto relative w-full border-t border-white/10 py-4 ${
              settings.layoutMode === 'immersive'
                ? 'overflow-y-auto rounded-xl border border-white/12 shadow-2xl shadow-black/30 backdrop-blur-xl'
                : 'px-4 shadow-2xl shadow-black/20 backdrop-blur-xl'
            }`}
            style={dialogueShellStyle}
          >
            {settings.choicesPosition === 'aboveText' && renderChoiceButtons('mb-3')}
            {renderStyle.titleVisible && !hideCenteredTitle && (
              <h2
                key={`${currentNodeId}-title-${renderStyle.titleAnimation}`}
                className="mb-2 font-black"
                style={titleStyle}
              >
                {getNodeDisplayTitle(currentNode)}
              </h2>
            )}
            <div
              key={`${currentNodeId}-body-${renderStyle.bodyAnimation}`}
              className={`mt-2 text-sm leading-relaxed text-slate-200 ${
                settings.layoutMode === 'classic' && settings.interactionMode === 'typewriter'
                  ? 'relative'
                  : ''
              }`}
              style={bodyStyle}
              onClick={continueFromText}
            >
              {settings.interactionMode === 'typewriter' &&
                (settings.layoutMode === 'classic' ? (
                  <>
                    <span className="invisible block whitespace-pre-wrap" aria-hidden="true">
                      {stripHtml(text) || ' '}
                    </span>
                    <span className="absolute inset-0 block whitespace-pre-wrap">
                      {displayedPreviewText || ''}
                    </span>
                  </>
                ) : (
                  displayedPreviewText || ''
                ))}
              {settings.interactionMode !== 'typewriter' && (
                <span
                  dangerouslySetInnerHTML={{
                    __html: text || t('（无正文）', '（本文なし）', '(No body text)'),
                  }}
                />
              )}
            </div>
            {audioUrl && (
              <audio
                key={currentNodeId}
                ref={currentAudioRef}
                src={audioUrl}
                preload="auto"
                onPlay={recordCurrentAudio}
                onEnded={() => setCurrentAudioEnded(true)}
                className="hidden"
              />
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
                : 'absolute bottom-3 right-3'
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
        <PreviewOptionGroup
          title={t('人物标签', 'キャラタグ', 'Character Tags')}
          options={[
            { value: 'hide', label: t('隐藏', '非表示', 'Hide'), icon: <EyeOff className="h-3.5 w-3.5" /> },
            { value: 'show', label: t('显示', '表示', 'Show'), icon: <Eye className="h-3.5 w-3.5" /> },
          ]}
          value={settings.hideCharacterTags ? 'hide' : 'show'}
          onChange={(value) => onUpdateSettings('hideCharacterTags', value === 'hide')}
        />
        <PreviewOptionGroup
          title={t('场景标签', 'シーンタグ', 'Scene Tags')}
          options={[
            { value: 'hide', label: t('隐藏', '非表示', 'Hide'), icon: <EyeOff className="h-3.5 w-3.5" /> },
            { value: 'show', label: t('显示', '表示', 'Show'), icon: <Eye className="h-3.5 w-3.5" /> },
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
  options,
  value,
  onChange,
  columns = 'grid-cols-2',
}: {
  title: string;
  options: { value: string; label: string; icon?: ReactNode }[];
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

function ChoiceTopGlyph() {
  return (
    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-white/20 bg-white/10">
      <span className="flex h-2.5 w-2.5 flex-col items-center justify-between">
        <span className="h-0.5 w-2 rounded-full bg-white" />
        <span className="h-0.5 w-1.5 rounded-full bg-white/55" />
      </span>
    </span>
  );
}

function ChoiceMiddleGlyph() {
  return (
    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-white/20 bg-white/10">
      <span className="flex h-2.5 w-2.5 flex-col items-center justify-between">
        <span className="h-0.5 w-1.5 rounded-full bg-white/55" />
        <span className="h-0.5 w-2 rounded-full bg-white" />
        <span className="h-0.5 w-1.5 rounded-full bg-white/55" />
      </span>
    </span>
  );
}

function ChoiceBottomGlyph() {
  return (
    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-white/20 bg-white/10">
      <span className="flex h-2.5 w-2.5 flex-col items-center justify-between">
        <span className="h-0.5 w-1.5 rounded-full bg-white/55" />
        <span className="h-0.5 w-2 rounded-full bg-white" />
      </span>
    </span>
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
