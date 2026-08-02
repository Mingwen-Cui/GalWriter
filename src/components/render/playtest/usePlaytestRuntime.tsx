import type { Node as FlowNode } from '@xyflow/react';
import { ChevronRight } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type {
  CharacterNodeData,
  CharacterPresentation,
  InlinePresentationAction,
  SceneNodeData,
  StoryPresentation,
} from '../../../domain/project';
import { translations } from '../../../lib/i18n';
import {
  getInlineSwitchAction,
  resolveCharacterImageUrl,
  resolveSceneMedia,
} from '../../../lib/inlineAssetSwitch';
import {
  buildInlinePlaybackSteps,
  inlineActionAnimation,
  inlineActionCssVars,
  inlineActionTransform,
  isPersistentInlineAction,
  latestPersistentInlineAction,
} from '../../../lib/inlinePresentationPlayback';
import {
  clampCharacterLayer,
  getCharacterEnterDelay,
  getCharacterStageBounds,
  getPresentationExitDuration,
  getPresentationTransform,
  getSceneExitDelay,
  normalizeStoryPresentation,
} from '../../../lib/presentation';
import { useRegionBackgroundMusic } from '../../../lib/useRegionBackgroundMusic';
import { mergeSceneMediaStyle } from '../canvas/sceneCanvasStyle';
import { selectConditionHandle } from '../code/codeExport/ir/graphSemantics';
import { getRenderObjects } from '../video/shared/renderObjects';

type PlayedAudio = {
  nodeId: string;
  title: string;
  url: string;
};

import { getPlaytestText } from './i18n';
import {
  persistRotateHintDismissed,
  readRotateHintDismissed,
  sliceHtmlByTextLength,
} from './playtestUtils';
import type { PlayTestProps } from './types';
export function usePlaytestRuntime({
  nodes,
  edges,
  onClose,
  language,
  onLanguageChange: _onLanguageChange,
  isDarkMode,
  choicesColumns,
  setChoicesColumns,
  videoAutoPlay,
  setVideoAutoPlay: _setVideoAutoPlay,
  layoutMode,
  setLayoutMode,

  interactionMode,
  setInteractionMode,
  typewriterSpeed,
  setTypewriterSpeed,
  choiceDelay,
  setChoiceDelay,

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
  autoAdvanceDelay,
  setAutoAdvanceDelay,
  hideCharacterTags,
  setHideCharacterTags: _setHideCharacterTags,
  hideSceneTags,
  setHideSceneTags: _setHideSceneTags,
  canvasSettings,
  onCanvasSettingsChange,
  renderStyle,
  updateRenderStyle,
  isMobile = false,
}: PlayTestProps) {
  const t = translations[language];
  const playtestText = getPlaytestText(language);
  const root = nodes.find((n) => n.data.isRoot) || nodes[0];
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(root?.id || null);
  const [history, setHistory] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playlistAudioRef = useRef<HTMLAudioElement>(null);
  const audioPreloadRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const choicesRef = useRef<HTMLDivElement>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showAudioPlaylist, setShowAudioPlaylist] = useState(false);
  const [playedAudios, setPlayedAudios] = useState<PlayedAudio[]>([]);
  const [playlistAudioUrl, setPlaylistAudioUrl] = useState<string | null>(null);
  const [isPlaylistAudioPlaying, setIsPlaylistAudioPlaying] = useState(false);
  const [currentAudioEnded, setCurrentAudioEnded] = useState(false);
  const [currentVideoEnded, setCurrentVideoEnded] = useState(false);
  const [mediaStatusNodeId, setMediaStatusNodeId] = useState<string | null>(currentNodeId);

  const containerRef = useRef<HTMLDivElement>(null);
  const immersiveDialogueRef = useRef<HTMLDivElement>(null);
  const restoreSettingsAfterFullscreenRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusButtonBottom, setFocusButtonBottom] = useState(24);
  const [backExitHintVisible, setBackExitHintVisible] = useState(false);
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth,
  );
  const [rotateHintDismissed, setRotateHintDismissed] = useState(readRotateHintDismissed);
  const mobileLandscapeActive = isMobile && layoutMode === 'immersive';
  const mobileImmersiveLayout = isMobile && layoutMode === 'immersive';
  const applyMobileLandscapeTransform = mobileLandscapeActive && isPortrait;
  const dismissRotateHint = React.useCallback(() => {
    setRotateHintDismissed(true);
    persistRotateHintDismissed();
  }, []);
  const showRotateHint =
    mobileLandscapeActive && isPortrait && !rotateHintDismissed && !showSettings;
  const mobileClassicLayout = isMobile && layoutMode === 'classic';
  const lastSystemBackRef = useRef(0);
  const systemBackStateRef = useRef({
    showSettings: false,
    showAudioPlaylist: false,
    historyLength: 0,
    handleBack: () => {},
    onClose: () => {},
  });

  // 新增：文本呈现打字机与定时显现状态
  const [displayedHtml, setDisplayedHtml] = useState('');
  const [animationCompleted, setAnimationCompleted] = useState(interactionMode === 'immediate');
  const [timeLeft, setTimeLeft] = useState(0);
  const [presentationVisible, setPresentationVisible] = useState(false);
  const [presentationExiting, setPresentationExiting] = useState(false);
  const [activeInlineAction, setActiveInlineAction] = useState<InlinePresentationAction | null>(
    null,
  );
  const [completedSwitchActions, setCompletedSwitchActions] = useState<InlinePresentationAction[]>(
    [],
  );
  const [completedInlineActions, setCompletedInlineActions] = useState<InlinePresentationAction[]>(
    [],
  );
  const typewriterTimerRef = useRef<any>(null);
  const inlineActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timedTimerRef = useRef<any>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastJumpedNode = useRef<string | null>(null);
  const autoAdvanceHoldNodeRef = useRef<string | null>(null);
  const playbackSessionRef = useRef(0);
  const [playbackSession, setPlaybackSession] = useState(0);

  const clearPendingPlaybackTimers = React.useCallback(() => {
    if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
    if (inlineActionTimerRef.current) clearTimeout(inlineActionTimerRef.current);
    if (timedTimerRef.current) clearTimeout(timedTimerRef.current);
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    typewriterTimerRef.current = null;
    inlineActionTimerRef.current = null;
    timedTimerRef.current = null;
    autoAdvanceTimerRef.current = null;
    transitionTimerRef.current = null;
    setPresentationExiting(false);
    setActiveInlineAction(null);
    setCompletedInlineActions([]);
  }, []);

  const restartPlaybackSession = React.useCallback(() => {
    playbackSessionRef.current += 1;
    setPlaybackSession((session) => session + 1);
    clearPendingPlaybackTimers();
    lastJumpedNode.current = null;
  }, [clearPendingPlaybackTimers]);

  /**
   * 跳转到指定节点并重置动画完成状态，避免切换时按钮闪烁
   * @param nodeId 目标节点 ID
   */
  const navigateToNode = React.useCallback(
    (nodeId: string | null) => {
      setCurrentNodeId(nodeId);
      if (interactionMode !== 'immediate') {
        setAnimationCompleted(false);
      } else {
        setAnimationCompleted(true);
      }
    },
    [interactionMode],
  );

  const currentNode = nodes.find((n) => n.id === currentNodeId);
  const currentTitle =
    currentNodeId !== 'THE_END' && currentNode && typeof currentNode.data.title === 'string'
      ? currentNode.data.title.trim()
      : '';
  useRegionBackgroundMusic(nodes, currentNode, currentNodeId !== 'THE_END');
  const presentation = React.useMemo(
    () =>
      normalizeStoryPresentation(currentNode?.data.presentation as StoryPresentation | undefined),
    [currentNode?.data.presentation],
  );
  const sceneSource = presentation.scene
    ? nodes.find((node) => node.id === presentation.scene?.sourceNodeId)
    : null;
  const sceneData = sceneSource?.data as SceneNodeData | undefined;
  const selectedSceneImage = presentation.scene?.imageId
    ? sceneData?.images?.find((image) => image.id === presentation.scene?.imageId)
    : undefined;
  const activeSceneSwitchAction = getInlineSwitchAction(
    'scene',
    presentation.scene?.sourceNodeId,
    null,
    completedSwitchActions,
  );
  const sceneMedia = resolveSceneMedia({
    data: sceneData,
    scene: presentation.scene,
    fallbackImageUrl:
      (currentNode?.data.imageUrl as string | undefined) || selectedSceneImage?.imageUrl,
    fallbackVideoUrl:
      selectedSceneImage?.videoUrl || (currentNode?.data.videoUrl as string | undefined),
    switchAction: activeSceneSwitchAction,
  });
  const sceneVideoUrl = sceneMedia.videoUrl;
  const sceneImageUrl = sceneVideoUrl ? undefined : sceneMedia.imageUrl;
  const sceneVideoStartTime = Math.max(0, presentation.scene?.videoStartTime || 0);
  const sceneVideoEndTime = presentation.scene?.videoEndTime;
  const sceneVideoMaxDuration = Math.max(0.1, presentation.scene?.videoMaxDuration || 30);
  const presentedCharacters = presentation.characters
    .map((config) => {
      const source = nodes.find((node) => node.id === config.sourceNodeId);
      if (!source || source.type !== 'characterNode') return null;
      const characterData = source.data as CharacterNodeData;
      const imageUrl = resolveCharacterImageUrl(
        characterData,
        config,
        getInlineSwitchAction('character', config.sourceNodeId, null, completedSwitchActions),
      );
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
  const rawTextHtml =
    currentNodeId !== 'THE_END' && currentNode ? (currentNode.data.text as string) || '' : '';
  const textHtml = React.useMemo(() => {
    if (!rawTextHtml) return rawTextHtml;
    const container = document.createElement('div');
    container.innerHTML = rawTextHtml;
    container.querySelectorAll('[data-mention-kind="character"]').forEach((node) => node.remove());
    container
      .querySelectorAll('[data-mention-kind="scene"], [data-mention-kind="video"]')
      .forEach((node) => node.remove());
    return container.innerHTML;
  }, [rawTextHtml]);

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

  const textStroke = (width: number, color: string) =>
    width > 0 ? `${width}px ${colorInputValue(color, '#000000')}` : undefined;

  const dialogueBackgroundStyle = (): React.CSSProperties => {
    const gradientStops =
      renderStyle.dialogGradientStops?.length >= 2
        ? [...renderStyle.dialogGradientStops].sort((a, b) => a.position - b.position)
        : [
            { color: colorInputValue(renderStyle.dialogGradientStartColor), alpha: 0, position: 0 },
            { color: colorInputValue(renderStyle.dialogGradientColor), alpha: 86, position: 100 },
          ];

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

  const renderObjects = getRenderObjects(renderStyle);
  const titleObject = renderObjects.title;
  const bodyObject = renderObjects.body;
  const dialogObject = renderObjects.dialogBox;

  const titleStyle: React.CSSProperties = {
    display: titleObject.visible ? undefined : 'none',
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
    width: `${titleObject.width}%`,
    minHeight: `${titleObject.height}px`,
    transform: `translate(${titleObject.x}px, ${titleObject.y}px) rotate(${titleObject.rotation}deg) scale(${titleObject.flipX ? -1 : 1}, ${titleObject.flipY ? -1 : 1})`,
  };

  const bodyStyle: React.CSSProperties = {
    display: bodyObject.visible ? undefined : 'none',
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
    width: `${bodyObject.width}%`,
    minHeight: `${bodyObject.height}px`,
    transform: `translate(${bodyObject.x}px, ${bodyObject.y}px) rotate(${bodyObject.rotation}deg) scale(${bodyObject.flipX ? -1 : 1}, ${bodyObject.flipY ? -1 : 1})`,
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
    paddingLeft: `${Math.max(2, renderStyle.dialogTextPaddingX ?? 9)}%`,
    paddingRight: `${Math.max(2, renderStyle.dialogTextPaddingX ?? 9)}%`,
    transform: `rotate(${dialogObject.rotation}deg) scale(${dialogObject.flipX ? -1 : 1}, ${dialogObject.flipY ? -1 : 1})`,
  };
  const dialogueFrameStyle: React.CSSProperties = {
    width:
      layoutMode === 'immersive'
        ? `min(${renderStyle.dialogWidth}%, calc(100% - 24px))`
        : `${renderStyle.dialogWidth}%`,
    left:
      layoutMode === 'immersive'
        ? `${50 + Math.max(-100, Math.min(100, renderStyle.dialogOffsetX ?? 0)) * 0.5}%`
        : undefined,
    bottom:
      layoutMode === 'immersive'
        ? `calc(4% - ${Math.max(-100, Math.min(100, renderStyle.dialogOffsetY ?? 0)) * 0.28}%)`
        : undefined,
    transform: layoutMode === 'immersive' ? 'translateX(-50%)' : undefined,
  };
  const renderObjectSelectionClass = (kind: keyof typeof renderObjects) =>
    showSettings && renderStyle.selectedRenderObject === kind
      ? 'playtest-render-selection'
      : showSettings
        ? 'outline outline-1 outline-indigo-400/30'
        : '';
  const selectRenderObject = (event: React.MouseEvent, kind: keyof typeof renderObjects) => {
    if (!showSettings) return;
    event.stopPropagation();
    updateRenderStyle('selectedRenderObject', kind);
  };
  const dialogueOffsetX = Math.max(-100, Math.min(100, renderStyle.dialogOffsetX ?? 0));
  const dialogueCenter = 50 + dialogueOffsetX * 0.5;
  const dialogWidth = Math.max(0, Math.min(100, renderStyle.dialogWidth || 86));
  const dialogueRightSpace = Math.max(0, 100 - (dialogueCenter + dialogWidth / 2));
  const hasBottomRightSpace = layoutMode !== 'immersive' || dialogueRightSpace >= 12;
  const focusButtonStyle: React.CSSProperties = hasBottomRightSpace
    ? {
        right: '24px',
        bottom: '24px',
      }
    : {
        right: '24px',
        bottom: `${focusButtonBottom}px`,
      };

  React.useLayoutEffect(() => {
    if (layoutMode !== 'immersive' || hasBottomRightSpace) {
      setFocusButtonBottom(24);
      return;
    }
    const element = immersiveDialogueRef.current;
    if (!element) return;

    let frame = 0;
    const updatePosition = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const nextBottom = Math.max(24, Math.ceil(viewportHeight - rect.top + 20));
        setFocusButtonBottom((current) =>
          Math.abs(current - nextBottom) > 1 ? nextBottom : current,
        );
      });
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(element);
    window.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
    };
  }, [
    layoutMode,
    hasBottomRightSpace,
    currentNodeId,
    displayedHtml,
    choicesPosition,
    renderStyle.dialogWidth,
    renderStyle.dialogHeight,
    renderStyle.dialogOffsetX,
    renderStyle.dialogOffsetY,
    renderStyle.dialogTextPaddingX,
    renderStyle.bodyFontSize,
    renderStyle.titleFontSize,
    renderStyle.titleVisible,
  ]);

  const getAudioTitle = React.useCallback(
    (node: FlowNode) => {
      const title = typeof node.data.title === 'string' ? node.data.title.trim() : '';
      if (title) return title;

      const container = document.createElement('div');
      container.innerHTML = typeof node.data.text === 'string' ? node.data.text : '';
      const text = container.textContent?.trim().replace(/\s+/g, ' ') || '';
      if (text) return text.slice(0, 42);

      return playtestText.untitledAudio;
    },
    [playtestText.untitledAudio],
  );

  const recordCurrentAudio = React.useCallback(() => {
    if (!currentNode || typeof currentNode.data.audioUrl !== 'string') return;
    const url = currentNode.data.audioUrl.trim();
    if (!url) return;

    playlistAudioRef.current?.pause();
    setIsPlaylistAudioPlaying(false);
    const entry = {
      nodeId: currentNode.id,
      title: getAudioTitle(currentNode),
      url,
    };
    setPlayedAudios((previous) => [
      entry,
      ...previous.filter((audio) => audio.nodeId !== entry.nodeId && audio.url !== entry.url),
    ]);
  }, [currentNode, getAudioTitle]);

  const togglePlaylistAudio = (audio: PlayedAudio) => {
    audioRef.current?.pause();

    if (playlistAudioUrl === audio.url && playlistAudioRef.current) {
      if (playlistAudioRef.current.paused) {
        playlistAudioRef.current.play().catch((error) => {
          console.error('Playlist audio playback failed', error);
        });
      } else {
        playlistAudioRef.current.pause();
      }
      return;
    }

    setPlaylistAudioUrl(audio.url);
  };

  useEffect(() => {
    if (!playlistAudioUrl || !playlistAudioRef.current) return;
    playlistAudioRef.current.currentTime = 0;
    playlistAudioRef.current.play().catch((error) => {
      setIsPlaylistAudioPlaying(false);
      console.error('Playlist audio playback failed', error);
    });
  }, [playlistAudioUrl]);

  const outEdges = edges.filter((e) => e.source === currentNodeId);
  const waitsForBranchVideo = outEdges.length > 1 && Boolean(sceneVideoUrl);
  const choicesReady = animationCompleted && (!waitsForBranchVideo || currentVideoEnded);
  const autoAdvanceTarget = outEdges.length === 1 ? outEdges[0].target : 'THE_END';
  const advanceToTarget = React.useCallback(
    (targetId: string) => {
      if (presentationExiting) return;
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      const exitDuration = getPresentationExitDuration(presentation);
      const sessionId = playbackSessionRef.current;
      setPresentationExiting(true);
      transitionTimerRef.current = setTimeout(() => {
        transitionTimerRef.current = null;
        if (sessionId !== playbackSessionRef.current) return;
        setHistory((prev) => [...prev, currentNodeId || '']);
        navigateToNode(targetId);
      }, exitDuration);
    },
    [currentNodeId, navigateToNode, presentation, presentationExiting],
  );

  useEffect(() => {
    setPresentationExiting(false);
    setPresentationVisible(false);
    setCurrentAudioEnded(false);
    setCurrentVideoEnded(false);
    setMediaStatusNodeId(currentNodeId);
    if (videoStopTimerRef.current) {
      clearTimeout(videoStopTimerRef.current);
      videoStopTimerRef.current = null;
    }
    const frame = requestAnimationFrame(() => setPresentationVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [currentNodeId]);

  const stopVideoLimitTimer = () => {
    if (!videoStopTimerRef.current) return;
    clearTimeout(videoStopTimerRef.current);
    videoStopTimerRef.current = null;
  };

  const startVideoLimitTimer = () => {
    stopVideoLimitTimer();
    videoStopTimerRef.current = setTimeout(() => {
      videoRef.current?.pause();
      setCurrentVideoEnded(true);
      videoStopTimerRef.current = null;
    }, sceneVideoMaxDuration * 1000);
  };

  const handleSceneVideoTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    const endTime =
      sceneVideoEndTime && sceneVideoEndTime > sceneVideoStartTime
        ? Math.min(sceneVideoEndTime, video.duration || sceneVideoEndTime)
        : video.duration;
    if (!Number.isFinite(endTime) || video.currentTime < endTime) return;

    if (presentation.scene?.videoLoop) {
      video.currentTime = Math.min(sceneVideoStartTime, Math.max(0, video.duration || 0));
      void video.play();
      return;
    }

    video.pause();
    video.currentTime = endTime;
    stopVideoLimitTimer();
    setCurrentVideoEnded(true);
  };

  // 触发打字机或延时逻辑
  useEffect(() => {
    if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
    if (inlineActionTimerRef.current) clearTimeout(inlineActionTimerRef.current);
    if (timedTimerRef.current) clearTimeout(timedTimerRef.current);
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setActiveInlineAction(null);
    setCompletedSwitchActions([]);
    setCompletedInlineActions([]);

    if (currentNodeId === 'THE_END' || !currentNode) {
      setDisplayedHtml('');
      setAnimationCompleted(true);
      return;
    }

    if (interactionMode === 'immediate') {
      const playbackSteps = buildInlinePlaybackSteps(rawTextHtml, presentation, {
        hideCharacterTags,
        hideSceneTags,
      });
      setCompletedSwitchActions(
        playbackSteps
          .filter(
            (step): step is { kind: 'action'; action: InlinePresentationAction } =>
              step.kind === 'action',
          )
          .map((step) => step.action)
          .filter((action) => action.action === 'switch' && Boolean(action.targetAssetId)),
      );
      setCompletedInlineActions(
        playbackSteps
          .filter(
            (step): step is { kind: 'action'; action: InlinePresentationAction } =>
              step.kind === 'action',
          )
          .map((step) => step.action)
          .filter(isPersistentInlineAction),
      );
      setDisplayedHtml(textHtml);
      setAnimationCompleted(true);
    } else if (interactionMode === 'typewriter') {
      setAnimationCompleted(false);
      const playbackSteps = buildInlinePlaybackSteps(rawTextHtml, presentation, {
        hideCharacterTags,
        hideSceneTags,
      });
      const fullHtml = playbackSteps
        .filter((step): step is { kind: 'text'; html: string } => step.kind === 'text')
        .map((step) => step.html)
        .join('');
      const { totalTextLength } = sliceHtmlByTextLength(fullHtml, 9999);
      if (totalTextLength === 0) {
        setDisplayedHtml(fullHtml);
        setAnimationCompleted(true);
        return;
      }

      let stepIndex = 0;
      let currentSegmentLen = 0;
      let committedHtml = '';
      setDisplayedHtml('');

      const playNext = () => {
        if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
        const step = playbackSteps[stepIndex];
        if (!step) {
          setActiveInlineAction(null);
          setDisplayedHtml(committedHtml);
          setAnimationCompleted(true);
          return;
        }

        if (step.kind === 'action') {
          setActiveInlineAction(step.action);
          inlineActionTimerRef.current = setTimeout(
            () => {
              setActiveInlineAction(null);
              if (step.action.action === 'switch' && step.action.targetAssetId) {
                setCompletedSwitchActions((previous) => [...previous, step.action]);
              }
              if (isPersistentInlineAction(step.action)) {
                setCompletedInlineActions((previous) => [...previous, step.action]);
              }
              stepIndex += 1;
              playNext();
            },
            Math.max(0, step.action.duration || 0),
          );
          return;
        }

        const { totalTextLength: segmentLength } = sliceHtmlByTextLength(step.html, 9999);
        if (segmentLength === 0) {
          committedHtml += step.html;
          stepIndex += 1;
          playNext();
          return;
        }
        currentSegmentLen = 0;
        typewriterTimerRef.current = setInterval(() => {
          currentSegmentLen += 1;
          const { slicedHtml } = sliceHtmlByTextLength(step.html, currentSegmentLen);
          setDisplayedHtml(committedHtml + slicedHtml);
          if (currentSegmentLen >= segmentLength) {
            if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
            committedHtml += step.html;
            stepIndex += 1;
            playNext();
          }
        }, typewriterSpeed);
      };

      playNext();
    } else if (interactionMode === 'timed') {
      setDisplayedHtml(textHtml);
      setAnimationCompleted(false);
      setTimeLeft(choiceDelay);

      const intervalTick = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0.1) {
            clearInterval(intervalTick);
            return 0;
          }
          return Number((prev - 0.1).toFixed(1));
        });
      }, 100);

      timedTimerRef.current = setTimeout(() => {
        clearInterval(intervalTick);
        setAnimationCompleted(true);
      }, choiceDelay * 1000);

      return () => {
        clearInterval(intervalTick);
        if (timedTimerRef.current) clearTimeout(timedTimerRef.current);
      };
    } else if (interactionMode === 'clickToShow') {
      setDisplayedHtml(textHtml);
      setAnimationCompleted(false);
    }

    return () => {
      if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
      if (inlineActionTimerRef.current) clearTimeout(inlineActionTimerRef.current);
      if (timedTimerRef.current) clearTimeout(timedTimerRef.current);
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [
    currentNodeId,
    rawTextHtml,
    textHtml,
    interactionMode,
    typewriterSpeed,
    choiceDelay,
    hideCharacterTags,
    hideSceneTags,
    presentation,
    playbackSession,
  ]);

  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    const hasAudio =
      typeof currentNode?.data.audioUrl === 'string' && currentNode.data.audioUrl.trim();
    const hasVideo =
      typeof sceneVideoUrl === 'string' &&
      sceneVideoUrl.trim() &&
      (layoutMode === 'classic' || !sceneImageUrl);

    if (
      !autoAdvance ||
      !currentNode ||
      currentNodeId === 'THE_END' ||
      autoAdvanceHoldNodeRef.current === currentNodeId ||
      currentNode.type === 'numberConditionNode' ||
      currentNode.data.skip === true ||
      outEdges.length > 1
    ) {
      return;
    }

    if (hasAudio || hasVideo) {
      if (mediaStatusNodeId !== currentNodeId) return;
      if ((!hasAudio || currentAudioEnded) && (!hasVideo || currentVideoEnded)) {
        advanceToTarget(autoAdvanceTarget);
      }
      return;
    }

    if (!animationCompleted) return;

    const sessionId = playbackSessionRef.current;
    autoAdvanceTimerRef.current = setTimeout(
      () => {
        if (sessionId !== playbackSessionRef.current) return;
        advanceToTarget(autoAdvanceTarget);
      },
      Math.max(0, autoAdvanceDelay) * 1000,
    );

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [
    advanceToTarget,
    animationCompleted,
    autoAdvance,
    autoAdvanceDelay,
    autoAdvanceTarget,
    currentNode,
    currentNodeId,
    currentAudioEnded,
    currentVideoEnded,
    mediaStatusNodeId,
    layoutMode,
    sceneImageUrl,
    sceneVideoUrl,
    outEdges.length,
  ]);

  const handleTextContainerClick = () => {
    if (currentNodeId === 'THE_END' || !currentNode) return;
    autoAdvanceHoldNodeRef.current = null;
    if (!animationCompleted) {
      if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
      if (timedTimerRef.current) clearTimeout(timedTimerRef.current);

      setDisplayedHtml(textHtml);
      setAnimationCompleted(true);
    } else {
      // 如果打字完毕，且开启了“单选项隐藏居中弹窗”的设置，并且当前没有多分支选项（<= 1个分支）
      if (skipSingleChoicePopup && outEdges.length <= 1) {
        const nextTarget = outEdges.length === 1 ? outEdges[0].target : 'THE_END';
        advanceToTarget(nextTarget);
      }
    }
  };

  const renderChoices = (isImmersive: boolean) => {
    if (!choicesReady) return null;
    if (skipSingleChoicePopup && outEdges.length <= 1) return null;

    const effectiveCols = choicesPosition === 'center' ? 1 : choicesColumns;
    const gridClass = `grid ${effectiveCols === 1 ? 'grid-cols-1' : effectiveCols === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-3 w-full mb-1 animate-in fade-in duration-300 ${
      choicesPosition === 'center' ? 'px-3 py-3' : ''
    }`;

    return (
      <div className={gridClass} onClick={(e) => e.stopPropagation()}>
        {outEdges.length > 0 ? (
          outEdges.map((edge, index) => {
            let targetNode = nodes.find((n) => n.id === edge.target);

            if (targetNode?.type === 'numberConditionNode') {
              let sum = 0;
              for (const hId of [...history, currentNodeId]) {
                const prevNode = nodes.find((n) => n.id === hId);
                if (prevNode && typeof prevNode.data.nodeValue === 'number') {
                  sum += prevNode.data.nodeValue;
                }
              }
              const ranges =
                (targetNode.data.ranges as { id: string; min: number; max: number }[]) || [];
              const threshold = (targetNode.data.threshold as number) || 0;
              const targetHandle = selectConditionHandle(sum, threshold, ranges);

              const condEdges = edges.filter((e) => e.source === targetNode!.id);
              const condEdge = condEdges.find((e) => e.sourceHandle === targetHandle);

              if (condEdge) {
                const finalTarget = nodes.find((n) => n.id === condEdge.target);
                if (finalTarget) {
                  targetNode = finalTarget;
                }
              }
            }

            while (targetNode && targetNode.data.skip === true) {
              const nextEdges = edges.filter((e) => e.source === targetNode!.id);
              if (nextEdges.length > 0) {
                const nextTarget = nodes.find((n) => n.id === nextEdges[0].target);
                if (nextTarget) {
                  targetNode = nextTarget;
                } else {
                  break;
                }
              } else {
                targetNode = undefined;
                break;
              }
            }

            const targetTitle = targetNode?.data?.title as string | undefined;
            const nodeColor = (targetNode?.data.color as string) || '#ffffff';
            const isWhite =
              nodeColor.toLowerCase() === '#ffffff' || nodeColor.toLowerCase() === 'white';

            const defaultLabel = outEdges.length === 1 ? t.continue : `${t.option} ${index + 1}`;
            const label = targetTitle || edge.data?.label || defaultLabel;

            if (isImmersive) {
              let customBg = 'rgba(255, 255, 255, 0.15)';
              if (!isWhite && nodeColor.startsWith('#')) {
                if (nodeColor.length === 7) {
                  customBg = `${nodeColor}55`; // 33% opacity
                } else if (nodeColor.length === 4) {
                  customBg = `${nodeColor}5`;
                } else {
                  customBg = nodeColor;
                }
              }

              const btnClass = `w-full px-5 py-3.5 rounded-xl border backdrop-blur-md transition-all hover:scale-[1.02] active:scale-[0.98] group flex items-center shadow-lg hover:shadow-xl hover:brightness-110 text-white ${
                choicesPosition === 'center'
                  ? 'text-center justify-center'
                  : 'text-left justify-between'
              }`;

              return (
                <button
                  key={edge.id}
                  onClick={() => handleChoiceClick(edge.target)}
                  className={btnClass}
                  style={{
                    backgroundColor: customBg,
                    borderColor: isWhite ? 'rgba(255, 255, 255, 0.25)' : nodeColor,
                  }}
                >
                  <span className="font-bold text-sm md:text-base tracking-wide drop-shadow-sm">
                    {label as string}
                  </span>
                  {choicesPosition !== 'center' && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 group-hover:bg-white/20 transition-all">
                      <ChevronRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  )}
                </button>
              );
            } else {
              const btnClass = `w-full px-6 py-4 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] group flex items-center shadow-sm hover:shadow-md ${
                choicesPosition === 'center'
                  ? 'text-center justify-center'
                  : 'text-left justify-between'
              } ${isDarkMode && isWhite ? 'hover:bg-white/5' : ''}`;

              return (
                <button
                  key={edge.id}
                  onClick={() => handleChoiceClick(edge.target)}
                  className={btnClass}
                  style={{
                    backgroundColor: isDarkMode && isWhite ? '#1e293b' : nodeColor,
                    borderColor: isWhite ? (isDarkMode ? '#334155' : '#e2e8f0') : nodeColor,
                    color: isWhite ? (isDarkMode ? '#f1f5f9' : '#334155') : '#1e293b',
                  }}
                >
                  <span className="font-bold text-sm md:text-base tracking-wide">
                    {label as string}
                  </span>
                  {choicesPosition !== 'center' && (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isWhite ? (isDarkMode ? 'bg-white/10' : 'bg-slate-200/50') : 'bg-black/10'}`}
                    >
                      <ChevronRight className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  )}
                </button>
              );
            }
          })
        ) : isImmersive ? (
          <button
            onClick={() => handleChoiceClick('THE_END')}
            className={`w-full px-6 py-4 rounded-xl border border-white/20 bg-black/40 hover:bg-black/60 backdrop-blur-md transition-all group flex items-center text-slate-300 ${
              choicesPosition === 'center'
                ? 'text-center justify-center'
                : 'text-left justify-between'
            }`}
          >
            <span className="font-bold italic text-sm md:text-base">{t.draftEnded}</span>
            {choicesPosition !== 'center' && (
              <ChevronRight className="w-5 h-5 text-slate-400 animate-pulse" />
            )}
          </button>
        ) : (
          <button
            onClick={() => handleChoiceClick('THE_END')}
            className={`w-full px-8 py-5 rounded-2xl border-2 border-dashed transition-all group flex items-center ${
              choicesPosition === 'center'
                ? 'text-center justify-center'
                : 'text-left justify-between'
            } ${isDarkMode ? 'border-white/20 hover:border-sky-500/50 hover:bg-sky-500/10 text-slate-400' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-600'}`}
          >
            <span className="font-bold italic text-base">{t.draftEnded}</span>
            {choicesPosition !== 'center' && (
              <ChevronRight
                className={`w-6 h-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} animate-pulse`}
              />
            )}
          </button>
        )}
      </div>
    );
  };

  const toggleFullscreen = () => {
    dismissRotateHint();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      restoreSettingsAfterFullscreenRef.current = showSettings;
      if (showSettings) setShowSettings(false);
      containerRef.current
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch((err) => {
          if (restoreSettingsAfterFullscreenRef.current) {
            restoreSettingsAfterFullscreenRef.current = false;
            setShowSettings(true);
          }
          console.error('Fullscreen error:', err);
        });
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
        })
        .catch((err) => {
          console.error('Fullscreen error:', err);
        });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenActive = !!document.fullscreenElement;
      setIsFullscreen(fullscreenActive);
      if (!fullscreenActive && restoreSettingsAfterFullscreenRef.current) {
        restoreSettingsAfterFullscreenRef.current = false;
        setShowSettings(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const updateOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  useEffect(() => {
    if (!isPortrait) {
      dismissRotateHint();
    }
  }, [dismissRotateHint, isPortrait]);

  useEffect(() => {
    if (layoutMode === 'immersive' && choicesPosition !== 'center') {
      setChoicesPosition('center');
    }
  }, [choicesPosition, layoutMode, setChoicesPosition]);

  useEffect(() => {
    if (!applyMobileLandscapeTransform) {
      return undefined;
    }

    document.body.classList.add('playtest-mobile-landscape-active');
    const orientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
      unlock?: () => void;
    };
    orientation.lock?.('landscape').catch(() => undefined);

    return () => {
      document.body.classList.remove('playtest-mobile-landscape-active');
      orientation.unlock?.();
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [applyMobileLandscapeTransform]);

  useEffect(() => {
    const rootId = (nodes.find((n) => n.data.isRoot) || nodes[0])?.id || null;
    restartPlaybackSession();
    navigateToNode(rootId);
    setHistory([]);
  }, []);

  const handleBack = React.useCallback(() => {
    if (history.length === 0) return;

    restartPlaybackSession();
    const newHistory = [...history];
    let prev = newHistory.pop();

    // Skip auto-jump nodes when going back, so Back lands on a visible story step.
    while (prev) {
      const prevNode = nodes.find((n) => n.id === prev);
      if (prevNode?.type === 'numberConditionNode' || prevNode?.data.skip === true) {
        if (newHistory.length > 0) {
          prev = newHistory.pop();
        } else {
          const rootNode = nodes.find((n) => n.data.isRoot) || nodes[0];
          prev = rootNode?.id;
          break;
        }
      } else {
        break;
      }
    }

    setHistory(newHistory);
    lastJumpedNode.current = null;
    navigateToNode(prev!);
  }, [history, navigateToNode, nodes, restartPlaybackSession]);

  const restartPlaytest = React.useCallback(() => {
    restartPlaybackSession();
    const rootId = root?.id || null;
    autoAdvanceHoldNodeRef.current = rootId;
    setHistory([]);
    navigateToNode(rootId);
  }, [navigateToNode, restartPlaybackSession, root?.id]);

  const showNodeAsCurrentPage = React.useCallback(
    (nodeId: string) => {
      const targetNode = nodes.find((node) => node.id === nodeId && node.type === 'storyNode');
      if (!targetNode) return;

      restartPlaybackSession();
      autoAdvanceHoldNodeRef.current = nodeId;
      setHistory([]);
      navigateToNode(nodeId);
    },
    [navigateToNode, nodes, restartPlaybackSession],
  );

  const handleRestartClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      restartPlaytest();
    },
    [restartPlaytest],
  );

  useEffect(() => {
    systemBackStateRef.current = {
      showSettings,
      showAudioPlaylist,
      historyLength: history.length,
      handleBack,
      onClose,
    };
  }, [handleBack, history.length, onClose, showAudioPlaylist, showSettings]);

  useEffect(() => {
    const stateKey = 'galwriter-playtest-back-stop';
    window.history.pushState({ [stateKey]: true }, '');

    const handlePopState = () => {
      const latest = systemBackStateRef.current;

      if (latest.showSettings) {
        setShowSettings(false);
        window.history.pushState({ [stateKey]: true }, '');
        return;
      }

      if (latest.showAudioPlaylist) {
        setShowAudioPlaylist(false);
        window.history.pushState({ [stateKey]: true }, '');
        return;
      }

      if (latest.historyLength > 0) {
        latest.handleBack();
        window.history.pushState({ [stateKey]: true }, '');
        return;
      }

      const now = Date.now();
      if (now - lastSystemBackRef.current < 1600) {
        latest.onClose();
        return;
      }

      lastSystemBackRef.current = now;
      setBackExitHintVisible(true);
      window.history.pushState({ [stateKey]: true }, '');
      window.setTimeout(() => setBackExitHintVisible(false), 1600);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (
      currentNodeId !== 'THE_END' &&
      currentNodeId &&
      !nodes.find((n) => n.id === currentNodeId)
    ) {
      const newRoot = nodes.find((n) => n.data.isRoot) || nodes[0];
      restartPlaybackSession();
      navigateToNode(newRoot?.id || null);
      setHistory([]);
    }
  }, [nodes, currentNodeId, navigateToNode, restartPlaybackSession]);

  useEffect(() => {
    if (currentNodeId === 'THE_END') {
      lastJumpedNode.current = null;
    }
  }, [currentNodeId]);

  useEffect(() => {
    if (currentNodeId && currentNodeId !== 'THE_END') {
      if ((videoAutoPlay || autoAdvance || waitsForBranchVideo) && videoRef.current) {
        // Try to play with sound first
        videoRef.current.play().catch(() => {
          // If failed (browser restriction), play muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch((e) => console.error('Muted autoplay failed', e));
          }
        });
      }
      // Also autoplay audio if it exists, as it's often background music or narration
      if ((videoAutoPlay || autoAdvance) && audioRef.current) {
        audioRef.current.play().catch((e) => console.log('Audio autoplay blocked', e));
      }
    }
  }, [autoAdvance, currentNodeId, videoAutoPlay, waitsForBranchVideo]);

  useEffect(() => {
    if (!currentNodeId || currentNodeId === 'THE_END') return;

    const preloadAudio = (url: unknown) => {
      if (typeof url !== 'string' || !url.trim() || audioPreloadRef.current.has(url)) return;
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.load();
      audioPreloadRef.current.set(url, audio);
    };

    const preloadNodeAudio = (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      preloadAudio(node?.data.audioUrl);
    };

    preloadNodeAudio(currentNodeId);
    edges
      .filter((edge) => edge.source === currentNodeId)
      .forEach((edge) => preloadNodeAudio(edge.target));
  }, [currentNodeId, nodes, edges]);

  // 自动跳过数字判断卡片
  useLayoutEffect(() => {
    if (currentNodeId && currentNodeId !== 'THE_END' && currentNodeId !== lastJumpedNode.current) {
      const node = nodes.find((n) => n.id === currentNodeId);
      if (node && node.type === 'numberConditionNode') {
        lastJumpedNode.current = currentNodeId;
        let sum = 0;
        for (const hId of history) {
          const prevNode = nodes.find((n) => n.id === hId);
          if (prevNode && typeof prevNode.data.nodeValue === 'number') {
            sum += prevNode.data.nodeValue;
          }
        }

        const ranges = (node.data.ranges as { id: string; min: number; max: number }[]) || [];
        const threshold = (node.data.threshold as number) || 0;
        const targetHandle = selectConditionHandle(sum, threshold, ranges);

        const outEdges = edges.filter((e) => e.source === currentNodeId);
        const validEdges = outEdges.filter((e) => e.sourceHandle === targetHandle);

        if (validEdges.length > 0) {
          const nextId = validEdges[0].target;
          setHistory((prev) => [...prev, currentNodeId]);
          navigateToNode(nextId);
        } else {
          setHistory((prev) => [...prev, currentNodeId]);
          navigateToNode('THE_END');
        }
      }
    }
  }, [currentNodeId, nodes, edges, history]);

  // 自动跳过标记了 skip 的普通卡片
  useEffect(() => {
    if (currentNodeId && currentNodeId !== 'THE_END' && currentNodeId !== lastJumpedNode.current) {
      const node = nodes.find((n) => n.id === currentNodeId);
      if (node && node.data.skip === true) {
        lastJumpedNode.current = currentNodeId;
        const outEdges = edges.filter((e) => e.source === currentNodeId);
        if (outEdges.length > 0) {
          const nextId = outEdges[0].target;
          setHistory((prev) => [...prev, currentNodeId]);
          navigateToNode(nextId);
        } else {
          setHistory((prev) => [...prev, currentNodeId]);
          navigateToNode('THE_END');
        }
      }
    }
  }, [currentNodeId, nodes, edges]);

  const emptyState = !currentNodeId ? (
    <div
      className={`flex h-full w-full flex-col items-center justify-center p-6 text-center transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-800'}`}
    >
      <div className="max-w-md">
        <h2 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
          {t.noScript}
        </h2>
        <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-8`}>
          {t.createStartNode}
        </p>
        <button
          onClick={onClose}
          className={`px-8 py-3 ${isDarkMode ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-900/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'} text-white rounded-xl font-medium shadow-lg transition-all active:scale-95`}
        >
          {t.close}
        </button>
      </div>
    </div>
  ) : null;

  const handleChoiceClick = (targetId: string) => {
    autoAdvanceHoldNodeRef.current = null;
    advanceToTarget(targetId);
  };

  const hasMedia = !!(sceneImageUrl || sceneVideoUrl || presentedCharacters.length);
  const sceneMotion = presentationExiting ? presentation.scene?.exit : presentation.scene?.enter;
  const sceneAnimationActive = presentationExiting || !presentationVisible;
  const activeSceneInlineAction =
    activeInlineAction?.kind === 'scene' &&
    activeInlineAction.sourceNodeId === presentation.scene?.sourceNodeId
      ? activeInlineAction
      : latestPersistentInlineAction(
          completedInlineActions,
          'scene',
          presentation.scene?.sourceNodeId,
        );
  const sceneInlineDuration = activeSceneInlineAction
    ? Math.max(80, activeSceneInlineAction.duration || 300)
    : 0;
  const sceneMediaTransform = presentation.scene
    ? `translate(${presentation.scene.offsetX || 0}%, ${presentation.scene.offsetY || 0}%) scale(${
        presentation.scene.scale || 1
      })`
    : '';
  const sceneObjectFit = presentation.scene?.cropMode === 'stretch' ? 'fill' : 'cover';
  const baseSceneStyle: React.CSSProperties = {
    objectFit: sceneObjectFit,
    objectPosition: '50% 50%',
    opacity: sceneAnimationActive && sceneMotion?.type === 'fade' ? 0 : 1,
    transform:
      [
        sceneMediaTransform,
        sceneAnimationActive && sceneMotion
          ? getPresentationTransform(sceneMotion.type, presentationExiting)
          : inlineActionTransform(activeSceneInlineAction),
      ]
        .filter(Boolean)
        .join(' ') || 'none',
    transformOrigin: 'center center',
    animation: inlineActionAnimation(activeSceneInlineAction),
    ...inlineActionCssVars(activeSceneInlineAction),
    transitionProperty: 'opacity, transform',
    transitionDuration: `${
      activeSceneInlineAction
        ? sceneInlineDuration
        : sceneMotion?.type === 'none'
          ? 0
          : sceneMotion?.duration || 0
    }ms`,
    transitionDelay: `${presentationExiting ? getSceneExitDelay(presentation) : 0}ms`,
    transitionTimingFunction: 'ease-out',
  };
  const sceneStyle =
    layoutMode === 'classic'
      ? mergeSceneMediaStyle(baseSceneStyle, canvasSettings)
      : baseSceneStyle;
  const presentationStageAspect = canvasSettings.canvasWidth / canvasSettings.canvasHeight;
  const classicMediaContainerStyle: React.CSSProperties | undefined = mobileClassicLayout
    ? undefined
    : { containerType: 'size' };
  const classicMediaFrameStyle: React.CSSProperties | undefined = mobileClassicLayout
    ? undefined
    : {
        aspectRatio: `${canvasSettings.canvasWidth} / ${canvasSettings.canvasHeight}`,
        height: `min(100%, calc(100cqw / ${presentationStageAspect}))`,
        width: `min(100%, calc(100cqh * ${presentationStageAspect}))`,
      };

  const renderPresentedCharacters = (constrainToClassicStage = false) => (
    <div
      className={`absolute inset-y-0 z-10 overflow-hidden pointer-events-none ${
        constrainToClassicStage
          ? 'left-1/2 w-full max-w-[1200px] -translate-x-1/2'
          : 'left-0 right-0'
      }`}
    >
      {presentedCharacters.map(({ config, data, imageUrl }) => {
        const motion = presentationExiting ? config.exit : config.enter;
        const animationActive = presentationExiting || !presentationVisible;
        const animationTransform =
          animationActive && motion
            ? getPresentationTransform(motion.type, presentationExiting)
            : '';
        const inlineAction =
          activeInlineAction?.kind === 'character' &&
          activeInlineAction.sourceNodeId === config.sourceNodeId
            ? activeInlineAction
            : latestPersistentInlineAction(
                completedInlineActions,
                'character',
                config.sourceNodeId,
              );
        const inlineDuration = inlineAction ? Math.max(80, inlineAction.duration || 300) : 0;
        return (
          <img
            key={config.sourceNodeId}
            src={imageUrl}
            alt={data.characterName}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            className="preview-media-safe absolute w-auto object-contain object-bottom"
            style={{
              ...getCharacterStageBounds(config),
              zIndex: clampCharacterLayer(config.layer),
              opacity: animationActive && motion.type === 'fade' ? 0 : 1,
              transform: `translate(-50%, 0) ${animationTransform} scale(${config.scale}) scaleX(${config.flipX ? -1 : 1}) ${inlineActionTransform(inlineAction)}`,
              animation: inlineActionAnimation(inlineAction),
              ...inlineActionCssVars(inlineAction),
              transformOrigin: 'bottom center',
              transitionProperty: 'opacity, transform',
              transitionDuration: `${inlineAction ? inlineDuration : motion.type === 'none' ? 0 : motion.duration}ms`,
              transitionDelay: `${presentationExiting ? 0 : getCharacterEnterDelay(presentation)}ms`,
              transitionTimingFunction: 'ease-out',
            }}
          />
        );
      })}
    </div>
  );

  return {
    nodes,
    edges,
    onClose,
    language,
    onLanguageChange: _onLanguageChange,
    isDarkMode,
    choicesColumns,
    setChoicesColumns,
    videoAutoPlay,
    setVideoAutoPlay: _setVideoAutoPlay,
    layoutMode,
    setLayoutMode,
    interactionMode,
    setInteractionMode,
    typewriterSpeed,
    setTypewriterSpeed,
    choiceDelay,
    setChoiceDelay,
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
    autoAdvanceDelay,
    setAutoAdvanceDelay,
    hideCharacterTags,
    setHideCharacterTags: _setHideCharacterTags,
    hideSceneTags,
    setHideSceneTags: _setHideSceneTags,
    canvasSettings,
    onCanvasSettingsChange,
    renderStyle,
    updateRenderStyle,
    isMobile,
    t,
    root,
    videoRef,
    videoStopTimerRef,
    audioRef,
    playlistAudioRef,
    audioPreloadRef,
    choicesRef,
    containerRef,
    immersiveDialogueRef,
    mobileLandscapeActive,
    mobileImmersiveLayout,
    applyMobileLandscapeTransform,
    dismissRotateHint,
    showRotateHint,
    mobileClassicLayout,
    lastSystemBackRef,
    systemBackStateRef,
    typewriterTimerRef,
    inlineActionTimerRef,
    timedTimerRef,
    autoAdvanceTimerRef,
    transitionTimerRef,
    lastJumpedNode,
    autoAdvanceHoldNodeRef,
    playbackSessionRef,
    clearPendingPlaybackTimers,
    restartPlaybackSession,
    navigateToNode,
    showNodeAsCurrentPage,
    currentNode,
    currentTitle,
    presentation,
    sceneSource,
    sceneData,
    selectedSceneImage,
    activeSceneSwitchAction,
    sceneMedia,
    sceneVideoUrl,
    sceneImageUrl,
    sceneVideoStartTime,
    sceneVideoEndTime,
    sceneVideoMaxDuration,
    presentedCharacters,
    rawTextHtml,
    textHtml,
    colorInputValue,
    withAlpha,
    textStroke,
    dialogueBackgroundStyle,
    renderObjects,
    titleObject,
    bodyObject,
    dialogObject,
    renderObjectSelectionClass,
    selectRenderObject,
    dialogueOffsetX,
    dialogueCenter,
    dialogWidth,
    dialogueRightSpace,
    hasBottomRightSpace,
    getAudioTitle,
    recordCurrentAudio,
    togglePlaylistAudio,
    outEdges,
    waitsForBranchVideo,
    choicesReady,
    autoAdvanceTarget,
    advanceToTarget,
    stopVideoLimitTimer,
    startVideoLimitTimer,
    handleSceneVideoTimeUpdate,
    handleTextContainerClick,
    renderChoices,
    toggleFullscreen,
    handleBack,
    restartPlaytest,
    handleRestartClick,
    handleChoiceClick,
    hasMedia,
    sceneMotion,
    sceneAnimationActive,
    activeSceneInlineAction,
    sceneInlineDuration,
    sceneMediaTransform,
    sceneObjectFit,
    sceneStyle,
    presentationStageAspect,
    renderPresentedCharacters,
    currentNodeId,
    setCurrentNodeId,
    history,
    setHistory,
    showSettings,
    setShowSettings,
    showAudioPlaylist,
    setShowAudioPlaylist,
    playedAudios,
    setPlayedAudios,
    playlistAudioUrl,
    setPlaylistAudioUrl,
    isPlaylistAudioPlaying,
    setIsPlaylistAudioPlaying,
    currentAudioEnded,
    setCurrentAudioEnded,
    currentVideoEnded,
    setCurrentVideoEnded,
    mediaStatusNodeId,
    setMediaStatusNodeId,
    isFullscreen,
    setIsFullscreen,
    isFocusMode,
    setIsFocusMode,
    focusButtonBottom,
    setFocusButtonBottom,
    backExitHintVisible,
    setBackExitHintVisible,
    isPortrait,
    setIsPortrait,
    rotateHintDismissed,
    setRotateHintDismissed,
    displayedHtml,
    setDisplayedHtml,
    animationCompleted,
    setAnimationCompleted,
    timeLeft,
    setTimeLeft,
    presentationVisible,
    setPresentationVisible,
    presentationExiting,
    setPresentationExiting,
    activeInlineAction,
    setActiveInlineAction,
    completedSwitchActions,
    setCompletedSwitchActions,
    completedInlineActions,
    setCompletedInlineActions,
    playbackSession,
    setPlaybackSession,
    emptyState,
    titleStyle,
    bodyStyle,
    dialogueShellStyle,
    dialogueFrameStyle,
    focusButtonStyle,
    classicMediaContainerStyle,
    classicMediaFrameStyle,
  };
}
