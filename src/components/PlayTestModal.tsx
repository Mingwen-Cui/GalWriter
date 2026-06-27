import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import {
  ChevronRight,
  Eye,
  EyeOff,
  FastForward,
  Layout,
  ListMusic,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  PlayCircle,
  RotateCcw,
  RotateCw,
  Settings,
  Sparkles,
  Sun,
  Timer,
  Type,
  Video,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { AudioPlaylistModal } from './AudioPlaylistModal';
import { RenderStyleSettingsSection } from './render/video/panels/render-style-settings-section';
import type { RenderStyle } from './render/video/shared/types';
import { PlaytestSettingsPanel } from './PlaytestSettingsPanel';
import type {
  CharacterNodeData,
  CharacterPresentation,
  InlinePresentationAction,
  SceneNodeData,
  StoryPresentation,
} from '../domain/project';
import { Language, translations } from '../lib/i18n';
import {
  clampCharacterLayer,
  getCharacterEnterDelay,
  getCharacterStagePosition,
  getPresentationExitDuration,
  getPresentationTransform,
  getSceneExitDelay,
  normalizeStoryPresentation,
} from '../lib/presentation';
import {
  buildInlinePlaybackSteps,
  inlineActionAnimation,
  inlineActionCssVars,
  inlineActionTransform,
} from '../lib/inlinePresentationPlayback';
import { useRegionBackgroundMusic } from '../lib/useRegionBackgroundMusic';
import { VirtualPresentationStage } from './VirtualPresentationStage';

type PlayedAudio = {
  nodeId: string;
  title: string;
  url: string;
};

const PLAYTEST_ROTATE_HINT_KEY = 'playtest-immersive-rotate-hint-dismissed';

function readRotateHintDismissed() {
  try {
    return window.localStorage.getItem(PLAYTEST_ROTATE_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function persistRotateHintDismissed() {
  try {
    window.localStorage.setItem(PLAYTEST_ROTATE_HINT_KEY, '1');
  } catch {
    // ignore storage failures
  }
}

// Helper: HTML-Aware Safe Slicing for Typewriter Effect
function sliceHtmlByTextLength(
  html: string,
  maxTextLength: number,
): { slicedHtml: string; totalTextLength: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild as HTMLElement;

  let currentTextLength = 0;

  function cloneNodeLimit(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent || '';
      const remaining = maxTextLength - currentTextLength;
      if (remaining <= 0) {
        return null;
      }
      if (textContent.length <= remaining) {
        currentTextLength += textContent.length;
        return document.createTextNode(textContent);
      } else {
        currentTextLength += remaining;
        return document.createTextNode(textContent.slice(0, remaining));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const clonedEl = el.cloneNode(false) as HTMLElement;

      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        const clonedChild = cloneNodeLimit(child);
        if (clonedChild) {
          clonedEl.appendChild(clonedChild);
        }
        if (currentTextLength >= maxTextLength) {
          break;
        }
      }
      const isVoidTag = ['br', 'img', 'hr', 'input'].includes(clonedEl.tagName.toLowerCase());
      if (clonedEl.childNodes.length > 0 || isVoidTag) {
        return clonedEl;
      }
      return null;
    }
    return null;
  }

  const resultContainer = document.createElement('div');
  if (container) {
    for (let i = 0; i < container.childNodes.length; i++) {
      const clonedChild = cloneNodeLimit(container.childNodes[i]);
      if (clonedChild) {
        resultContainer.appendChild(clonedChild);
      }
      if (currentTextLength >= maxTextLength) {
        break;
      }
    }
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const totalTextLength = tempDiv.textContent?.length || 0;

  return {
    slicedHtml: resultContainer.innerHTML,
    totalTextLength,
  };
}

interface PlayTestProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  choicesColumns: number;
  setChoicesColumns: (val: number) => void;
  videoAutoPlay: boolean;
  setVideoAutoPlay: (val: boolean) => void;
  layoutMode: 'classic' | 'immersive';
  setLayoutMode: (val: 'classic' | 'immersive') => void;

  interactionMode: string;
  setInteractionMode: (val: string) => void;
  typewriterSpeed: number;
  setTypewriterSpeed: (val: number) => void;
  choiceDelay: number;
  setChoiceDelay: (val: number) => void;

  choicesPosition: 'center' | 'aboveText' | 'belowText';
  setChoicesPosition: (val: 'center' | 'aboveText' | 'belowText') => void;
  blurBackground: boolean;
  setBlurBackground: (val: boolean) => void;
  blurText: boolean;
  setBlurText: (val: boolean) => void;
  skipSingleChoicePopup: boolean;
  setSkipSingleChoicePopup: (val: boolean) => void;
  autoAdvance: boolean;
  setAutoAdvance: (val: boolean) => void;
  autoAdvanceDelay: number;
  setAutoAdvanceDelay: (val: number) => void;
  hideCharacterTags: boolean;
  setHideCharacterTags: (val: boolean) => void;
  hideSceneTags: boolean;
  setHideSceneTags: (val: boolean) => void;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  isMobile?: boolean;
}

export function PlayTestModal({
  nodes,
  edges,
  onClose,
  language,
  onLanguageChange,
  isDarkMode,
  setIsDarkMode,
  choicesColumns,
  setChoicesColumns,
  videoAutoPlay,
  setVideoAutoPlay,
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
  setHideCharacterTags,
  hideSceneTags,
  setHideSceneTags,
  renderStyle,
  updateRenderStyle,
  isMobile = false,
}: PlayTestProps) {
  const t = translations[language];
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusButtonBottom, setFocusButtonBottom] = useState(24);
  const [backExitHintVisible, setBackExitHintVisible] = useState(false);
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth,
  );
  const [rotateHintDismissed, setRotateHintDismissed] = useState(readRotateHintDismissed);
  const mobileLandscapeActive = isMobile && layoutMode === 'immersive';
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
  const typewriterTimerRef = useRef<any>(null);
  const inlineActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timedTimerRef = useRef<any>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    () => normalizeStoryPresentation(currentNode?.data.presentation as StoryPresentation | undefined),
    [currentNode?.data.presentation],
  );
  const sceneSource = presentation.scene
    ? nodes.find((node) => node.id === presentation.scene?.sourceNodeId)
    : null;
  const sceneData = sceneSource?.data as SceneNodeData | undefined;
  const selectedSceneImage = presentation.scene?.imageId
    ? sceneData?.images?.find((image) => image.id === presentation.scene?.imageId)
    : undefined;
  const sceneVideoUrl =
    selectedSceneImage?.videoUrl || (currentNode?.data.videoUrl as string | undefined);
  const sceneImageUrl = sceneVideoUrl
    ? undefined
    : (currentNode?.data.imageUrl as string | undefined) ||
      selectedSceneImage?.imageUrl ||
      sceneData?.coverImageUrl;
  const sceneVideoStartTime = Math.max(0, presentation.scene?.videoStartTime || 0);
  const sceneVideoEndTime = presentation.scene?.videoEndTime;
  const sceneVideoMaxDuration = Math.max(0.1, presentation.scene?.videoMaxDuration || 30);
  const presentedCharacters = presentation.characters
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
  const rawTextHtml =
    currentNodeId !== 'THE_END' && currentNode ? (currentNode.data.text as string) || '' : '';
  const textHtml = React.useMemo(() => {
    if ((!hideCharacterTags && !hideSceneTags) || !rawTextHtml) return rawTextHtml;
    const container = document.createElement('div');
    container.innerHTML = rawTextHtml;
    if (hideCharacterTags) {
      container
        .querySelectorAll('[data-mention-kind="character"]')
        .forEach((node) => node.remove());
    }
    if (hideSceneTags) {
      container
        .querySelectorAll('[data-mention-kind="scene"], [data-mention-kind="video"]')
        .forEach((node) => node.remove());
    }
    return container.innerHTML;
  }, [hideCharacterTags, hideSceneTags, rawTextHtml]);

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
  };
  const dialogueFrameStyle: React.CSSProperties = {
    width:
      layoutMode === 'immersive'
        ? `min(${renderStyle.dialogWidth}%, calc(100% - 24px))`
        : `${renderStyle.dialogWidth}%`,
    maxHeight:
      layoutMode === 'immersive'
        ? `min(${Math.max(16, Math.min(75, renderStyle.dialogHeight || 34))}%, calc(100% - 96px))`
        : undefined,
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

      return language === 'zh'
        ? '未命名录音'
        : language === 'ja'
          ? '名称未設定の録音'
          : 'Untitled audio';
    },
    [language],
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
      setPresentationExiting(true);
      window.setTimeout(() => {
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

    if (currentNodeId === 'THE_END' || !currentNode) {
      setDisplayedHtml('');
      setAnimationCompleted(true);
      return;
    }

    if (interactionMode === 'immediate') {
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
          inlineActionTimerRef.current = setTimeout(() => {
            setActiveInlineAction(null);
            stepIndex += 1;
            playNext();
          }, Math.max(0, step.action.duration || 0));
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

    autoAdvanceTimerRef.current = setTimeout(
      () => {
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
    if (!animationCompleted) {
      if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
      if (timedTimerRef.current) clearTimeout(timedTimerRef.current);

      setDisplayedHtml(textHtml);
      setAnimationCompleted(true);
    } else {
      // 如果打字完毕，且开启了“单选项隐藏居中弹窗”的设置，并且当前没有多分支选项（<= 1个分支）
      if (choicesPosition === 'center' && skipSingleChoicePopup && outEdges.length <= 1) {
        const nextTarget = outEdges.length === 1 ? outEdges[0].target : 'THE_END';
        advanceToTarget(nextTarget);
      }
    }
  };

  const renderChoices = (isImmersive: boolean) => {
    if (!choicesReady) return null;

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
              let targetHandle = '';

              const matchedRange = ranges.find((r) => sum >= r.min && sum <= r.max);
              if (matchedRange) {
                targetHandle = `out-range-${matchedRange.id}`;
              } else {
                const threshold = (targetNode.data.threshold as number) || 0;
                targetHandle = sum > threshold ? 'out-greater' : 'out-less-equal';
              }

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
      containerRef.current
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch((err) => {
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
      setIsFullscreen(!!document.fullscreenElement);
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
    navigateToNode(rootId);
    setHistory([]);
  }, []);

  const handleBack = React.useCallback(() => {
    if (history.length === 0) return;

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
    navigateToNode(prev!);
  }, [history, navigateToNode, nodes]);

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
      navigateToNode(newRoot?.id || null);
      setHistory([]);
    }
  }, [nodes, currentNodeId]);

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
  const lastJumpedNode = useRef<string | null>(null);

  useEffect(() => {
    if (currentNodeId && currentNodeId !== 'THE_END' && currentNodeId !== lastJumpedNode.current) {
      const node = nodes.find((n) => n.id === currentNodeId);
      if (node && node.type === 'numberConditionNode') {
        lastJumpedNode.current = currentNodeId;
        // 计算历史中卡片的数值总和
        let sum = 0;
        for (const hId of history) {
          const prevNode = nodes.find((n) => n.id === hId);
          if (prevNode && typeof prevNode.data.nodeValue === 'number') {
            sum += prevNode.data.nodeValue;
          }
        }

        const ranges = (node.data.ranges as { id: string; min: number; max: number }[]) || [];
        let targetHandle = '';

        const matchedRange = ranges.find((r) => sum >= r.min && sum <= r.max);
        if (matchedRange) {
          targetHandle = `out-range-${matchedRange.id}`;
        } else {
          const threshold = (node.data.threshold as number) || 0;
          targetHandle = sum > threshold ? 'out-greater' : 'out-less-equal';
        }

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

  if (!currentNodeId) {
    return (
      <div
        className={`fixed inset-0 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-800'} z-[100] flex flex-col items-center justify-center p-6 text-center transition-colors duration-300`}
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
    );
  }

  if (!currentNode && currentNodeId !== 'THE_END') return null;

  // 如果是条件节点，它在后台自动运算并跳转，这里显示空或加载中
  if (currentNode && currentNode.type === 'numberConditionNode') {
    return (
      <div
        className={`fixed inset-0 ${isDarkMode ? 'bg-slate-950' : 'bg-white'} z-[100] flex items-center justify-center transition-colors duration-300`}
      >
        <div className="animate-pulse flex flex-col items-center">
          <Loader2
            className={`w-8 h-8 ${isDarkMode ? 'text-sky-400' : 'text-indigo-500'} animate-spin mb-4`}
          />
          <span
            className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
          >
            计算条件中...
          </span>
        </div>
      </div>
    );
  }

  const handleChoiceClick = (targetId: string) => {
    advanceToTarget(targetId);
  };

  const hasMedia = !!(sceneImageUrl || sceneVideoUrl || presentedCharacters.length);
  const sceneMotion = presentationExiting ? presentation.scene?.exit : presentation.scene?.enter;
  const sceneAnimationActive = presentationExiting || !presentationVisible;
  const activeSceneInlineAction =
    activeInlineAction?.kind === 'scene' &&
    activeInlineAction.sourceNodeId === presentation.scene?.sourceNodeId
      ? activeInlineAction
      : null;
  const presentationScale = presentation.scene?.scale || 1;
  const sceneObjectFit =
    presentation.scene?.cropMode === 'stretch'
        ? 'fill'
        : 'cover';
  const sceneStyle: React.CSSProperties = {
    objectFit: sceneObjectFit,
    objectPosition: `${50 + (presentation.scene?.offsetX || 0)}% ${
      50 + (presentation.scene?.offsetY || 0)
    }%`,
    opacity: sceneAnimationActive && sceneMotion?.type === 'fade' ? 0 : 1,
    transform:
      sceneAnimationActive && sceneMotion
        ? getPresentationTransform(sceneMotion.type, presentationExiting)
        : inlineActionTransform(activeSceneInlineAction) || 'none',
    animation: inlineActionAnimation(activeSceneInlineAction),
    ...inlineActionCssVars(activeSceneInlineAction),
    transitionProperty: 'opacity, transform',
    transitionDuration: `${sceneMotion?.type === 'none' ? 0 : sceneMotion?.duration || 0}ms`,
    transitionDelay: `${presentationExiting ? getSceneExitDelay(presentation) : 0}ms`,
    transitionTimingFunction: 'ease-out',
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
            : null;
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
              transform: `translate(-50%, 0) ${animationTransform} scale(${config.scale}) scaleX(${config.flipX ? -1 : 1}) ${inlineActionTransform(inlineAction)}`,
              animation: inlineActionAnimation(inlineAction),
              ...inlineActionCssVars(inlineAction),
              transformOrigin: 'center center',
              transitionProperty: 'opacity, transform',
              transitionDuration: `${motion.type === 'none' ? 0 : motion.duration}ms`,
              transitionDelay: `${presentationExiting ? 0 : getCharacterEnterDelay(presentation)}ms`,
              transitionTimingFunction: 'ease-out',
            }}
          />
        );
      })}
    </div>
  );

  const renderPlaytestSettingsPanel = () => {
    const darkPanel = isDarkMode;
    const panelTone = darkPanel
      ? 'border-white/10 bg-slate-950/45'
      : 'border-slate-200/80 bg-slate-100/70';
    const workspaceStyle = (darkPanel
      ? {
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
      : undefined) as React.CSSProperties | undefined;
    return (
      <div className="video-render-workspace space-y-4" style={workspaceStyle}>
        <PlaytestPanelTitle
          icon={Layout}
          title={
            language === 'zh'
              ? '测试参数'
              : language === 'ja'
                ? 'テスト設定'
                : 'Playtest Settings'
          }
        />

        <div className={`rounded-xl border p-2 ${panelTone}`}>
          <div className="grid grid-cols-3 gap-2">
            <PlaytestSettingCard
              icon={Layout}
              description={language === 'zh' ? '界面布局' : 'Layout'}
            >
              <PlaytestPillToggleGroup
                value={layoutMode}
                options={[
                  { value: 'classic', label: t.layoutClassic, icon: <LayoutClassicGlyph /> },
                  { value: 'immersive', label: t.layoutImmersive, icon: <LayoutImmersiveGlyph /> },
                ]}
                onChange={(value) => setLayoutMode(value as 'classic' | 'immersive')}
              />
            </PlaytestSettingCard>

            {layoutMode === 'classic' && (
              <PlaytestSettingCard
                icon={isDarkMode ? Moon : Sun}
                description={language === 'zh' ? '测试主题' : 'Theme'}
              >
                <PlaytestPillToggleGroup
                  value={isDarkMode ? 'dark' : 'light'}
                  options={[
                    { value: 'light', label: t.lightMode, icon: <Sun className="h-3.5 w-3.5" /> },
                    { value: 'dark', label: t.darkMode, icon: <Moon className="h-3.5 w-3.5" /> },
                  ]}
                  onChange={(value) => setIsDarkMode(value === 'dark')}
                />
              </PlaytestSettingCard>
            )}

            <PlaytestSettingCard description={language === 'zh' ? '选项位置' : 'Choice position'}>
              <PlaytestSegmentedGroup
                value={choicesPosition}
                options={[
                  { value: 'aboveText', label: language === 'zh' ? '上' : 'Top' },
                  { value: 'center', label: language === 'zh' ? '中' : 'Center' },
                  { value: 'belowText', label: language === 'zh' ? '下' : 'Bottom' },
                ]}
                onChange={(value) =>
                  setChoicesPosition(value as 'center' | 'aboveText' | 'belowText')
                }
              />
            </PlaytestSettingCard>

            {choicesPosition !== 'center' && (
              <PlaytestSettingCard description={language === 'zh' ? '选项列数' : 'Columns'}>
                <PlaytestSegmentedGroup
                  value={String(choicesColumns)}
                  options={[1, 2, 3].map((cols) => ({
                    value: String(cols),
                    label: t[`column${cols}` as keyof typeof t] as string,
                    icon: <ColumnDotsGlyph count={cols} />,
                  }))}
                  onChange={(value) => setChoicesColumns(Number(value) || 1)}
                />
              </PlaytestSettingCard>
            )}

            <PlaytestSettingCard icon={Sparkles} description={language === 'zh' ? '背景虚化' : 'Blur background'}>
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
              <PlaytestSettingCard icon={Type} description={language === 'zh' ? '文字虚化' : 'Blur text'}>
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
              <PlaytestSettingCard
                icon={<SingleChoicePopupGlyph />}
                description={language === 'zh' ? '单选弹窗' : 'Single popup'}
              >
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

            <PlaytestSettingCard icon={FastForward} description={language === 'zh' ? '自动翻页' : 'Auto advance'}>
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

            <PlaytestSettingCard
              icon={<CharacterTagGlyph />}
              description={language === 'zh' ? '人物标签' : 'Character tags'}
            >
              <PlaytestToggleButton
                active={hideCharacterTags}
                icon={
                  hideCharacterTags ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )
                }
                label={hideCharacterTags ? (language === 'zh' ? '隐藏' : 'Hide') : (language === 'zh' ? '显示' : 'Show')}
                onClick={() => setHideCharacterTags(!hideCharacterTags)}
              />
            </PlaytestSettingCard>

            <PlaytestSettingCard
              icon={<SceneTagGlyph />}
              description={language === 'zh' ? '场景标签' : 'Scene tags'}
            >
              <PlaytestToggleButton
                active={hideSceneTags}
                icon={
                  hideSceneTags ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )
                }
                label={hideSceneTags ? (language === 'zh' ? '隐藏' : 'Hide') : (language === 'zh' ? '显示' : 'Show')}
                onClick={() => setHideSceneTags(!hideSceneTags)}
              />
            </PlaytestSettingCard>
          </div>
        </div>

        <PlaytestPanelTitle
          icon={Settings}
          title={
            language === 'zh'
              ? '标题 / 正文 / 文字框'
              : language === 'ja'
                ? 'タイトル / 本文 / テキスト枠'
                : 'Title / Body / Text Box'
          }
        />
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
  };

  const classicFocusHidden =
    isFocusMode && mobileClassicLayout ? 'invisible pointer-events-none' : '';
  const hideEntireHeaderInFocusMode = isFocusMode && !mobileClassicLayout;
  const useInlineFocusButton = isMobile && layoutMode === 'immersive';
  const playtestHeaderToneClass =
    layoutMode === 'immersive'
      ? 'absolute top-0 left-0 right-0 bg-gradient-to-b from-black/75 via-black/40 to-transparent text-white border-b-0'
      : isDarkMode
        ? 'bg-slate-900 border-b border-white/10 text-white'
        : 'bg-white border-b border-slate-200 text-slate-800';

  const renderPlaytestTitle = () => (
    <div className="playtest-header-title flex min-w-0 items-center gap-2 md:gap-3">
      <PlayCircle
        className={`w-5 h-5 shrink-0 ${layoutMode === 'immersive' ? 'text-sky-400' : isDarkMode ? 'text-sky-400' : 'text-indigo-600'}`}
      />
      <span
        className={`truncate font-bold tracking-wide text-sm md:text-base ${mobileClassicLayout ? 'max-w-none' : 'max-w-[120px] md:max-w-none'} ${layoutMode === 'immersive' ? 'text-white drop-shadow-sm' : isDarkMode ? 'text-white' : 'text-slate-800'}`}
      >
        {t.playTestTitle}
      </span>
    </div>
  );

  const renderPlaytestBackButton = (extraClassName = '') => (
    <button
      onClick={handleBack}
      disabled={history.length === 0}
      className={`playtest-header-back flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 md:text-sm ${
        layoutMode === 'immersive'
          ? 'bg-white/15 text-white hover:bg-white/25 disabled:bg-white/5'
          : isDarkMode
            ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
      } disabled:scale-100 disabled:opacity-30 disabled:grayscale ${extraClassName}`}
      title={t.backHistory}
    >
      <RotateCcw className="h-3.5 w-3.5 md:h-4 md:w-4" />
      <span>{t.backHistory}</span>
    </button>
  );

  const renderPlaytestFocusButton = (className: string, style?: React.CSSProperties) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsFocusMode(!isFocusMode);
      }}
      className={`${className} rounded-full border p-3.5 shadow-xl backdrop-blur-lg transition-colors duration-200 active:scale-95 ${
        isFocusMode
          ? isDarkMode
            ? 'border-sky-500/40 bg-slate-800/80 text-sky-400 shadow-sky-950/20 hover:bg-slate-800'
            : 'border-sky-500/30 bg-black/80 text-sky-400 shadow-black/20 hover:bg-black'
          : isDarkMode
            ? 'border-white/10 bg-slate-900/20 text-slate-100 shadow-slate-950/30 hover:bg-slate-900/40 hover:text-white'
            : 'border-black/10 bg-white/20 text-slate-400 shadow-slate-200/30 hover:bg-white/40 hover:text-slate-900'
      }`}
      style={style}
      title={isFocusMode ? t.exitZenMode : t.enterZenMode}
    >
      {isFocusMode ? <EyeOff className="h-5 w-5 animate-pulse" /> : <Eye className="h-5 w-5" />}
    </button>
  );

  const renderPlaytestSecondaryActions = () => (
    <>
      <button
        onClick={() => setAutoAdvance(!autoAdvance)}
        className={`p-1.5 md:p-2 rounded-full transition-colors ${
          autoAdvance
            ? layoutMode === 'immersive'
              ? 'bg-sky-500/80 text-white'
              : isDarkMode
                ? 'bg-sky-500/30 text-sky-200'
                : 'bg-indigo-100 text-indigo-600'
            : layoutMode === 'immersive'
              ? 'bg-white/10 text-white hover:bg-white/20'
              : isDarkMode
                ? 'bg-white/10 text-white hover:bg-white/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
        title={language === 'zh' ? '自动翻页' : 'Auto advance'}
      >
        <FastForward className="w-5 h-5" />
      </button>

      <div className="relative">
        <button
          onClick={() => {
            setShowAudioPlaylist((visible) => !visible);
            setShowSettings(false);
          }}
          className={`p-1.5 md:p-2 rounded-full transition-colors ${
            showAudioPlaylist
              ? layoutMode === 'immersive'
                ? 'bg-white/25 text-white'
                : isDarkMode
                  ? 'bg-white/20 text-white'
                  : 'bg-indigo-100 text-indigo-600'
              : layoutMode === 'immersive'
                ? 'bg-white/10 text-white hover:bg-white/20'
                : isDarkMode
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          title={
            language === 'zh'
              ? '录音播放列表'
              : language === 'ja'
                ? '録音プレイリスト'
                : 'Audio playlist'
          }
        >
          <ListMusic className="w-5 h-5" />
        </button>

        <AudioPlaylistModal
          open={showAudioPlaylist}
          items={playedAudios}
          activeUrl={playlistAudioUrl}
          isPlaying={isPlaylistAudioPlaying}
          title={
            language === 'zh'
              ? '录音播放列表'
              : language === 'ja'
                ? '録音プレイリスト'
                : 'Audio playlist'
          }
          hint={
            language === 'zh'
              ? '最近听过的录音排在最上方'
              : language === 'ja'
                ? '最近聞いた録音を上に表示'
                : 'Most recently heard first'
          }
          emptyText={
            language === 'zh'
              ? '听过的录音会显示在这里'
              : language === 'ja'
                ? '再生した録音がここに表示されます'
                : 'Audio you have heard will appear here'
          }
          closeLabel={t.close}
          dark={isDarkMode || layoutMode === 'immersive'}
          onClose={() => setShowAudioPlaylist(false)}
          onToggleAudio={togglePlaylistAudio}
        />
      </div>

      <button
        onClick={toggleFullscreen}
        className={`p-1.5 md:p-2 rounded-full transition-colors ${
          layoutMode === 'immersive'
            ? 'bg-white/10 hover:bg-white/20 text-white'
            : isDarkMode
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
        }`}
        title={isFullscreen ? t.exitFullscreen : t.enterFullscreen}
      >
        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
      </button>

      <div className="relative">
        <button
          onClick={() => {
            setShowSettings(!showSettings);
            setShowAudioPlaylist(false);
          }}
          className={`p-1.5 md:p-2 rounded-full transition-colors ${
            showSettings
              ? layoutMode === 'immersive'
                ? 'bg-white/25 text-white'
                : isDarkMode
                  ? 'bg-white/20'
                  : 'bg-slate-200'
              : layoutMode === 'immersive'
                ? 'bg-white/10 text-white hover:bg-white/20'
                : isDarkMode
                  ? 'bg-white/10 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-sky-500/10 hover:text-sky-400'
          }`}
          title={t.layoutSettings}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div
        className={`hidden h-4 w-px md:block ${layoutMode === 'immersive' ? 'bg-white/20' : isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}
      />

      <button
        onClick={onClose}
        className={`p-1.5 md:p-2 rounded-full transition-colors ${
          layoutMode === 'immersive'
            ? 'bg-white/10 hover:bg-red-500/30 text-white'
            : isDarkMode
              ? 'bg-white/10 hover:bg-red-500/20 text-white'
              : 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600'
        }`}
      >
        <X className="w-5 h-5" />
      </button>
    </>
  );

  return (
    <div
      ref={containerRef}
      onClick={() => {
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        handleTextContainerClick();
      }}
      className={`fixed inset-0 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-800'} z-[100] overflow-hidden transition-colors duration-300 ${
        applyMobileLandscapeTransform ? 'playtest-mobile-landscape' : ''
      }`}
    >
      <div
        onClick={(event) => {
          event.stopPropagation();
          handleTextContainerClick();
        }}
        className={`playtest-modal-root absolute inset-0 flex origin-left transform-gpu flex-col overflow-hidden border transition-transform duration-200 ease-out ${
          showSettings && !isMobile ? 'scale-75' : 'scale-100'
        } ${
          showSettings
            ? isDarkMode
              ? 'border-white/15 shadow-black/40'
              : 'border-slate-200 shadow-slate-300/40'
            : 'border-transparent'
        }`}
      >
      {/* Header */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`playtest-header shrink-0 z-50 px-4 transition-all duration-300 md:px-6 ${
          hideEntireHeaderInFocusMode ? 'hidden' : ''
        } ${
          mobileClassicLayout
            ? 'playtest-header--classic-mobile flex flex-col gap-2 py-2'
            : 'playtest-header--compact-row flex min-h-14 items-center justify-between'
        } ${playtestHeaderToneClass}`}
      >
        {mobileClassicLayout ? (
          <>
            <div className="playtest-header-primary flex w-full min-h-10 items-center justify-between gap-2">
              {renderPlaytestTitle()}
              {renderPlaytestBackButton(classicFocusHidden)}
            </div>
            <div
              className={`playtest-header-actions playtest-header-actions-secondary flex w-full min-h-10 items-center justify-center gap-2 md:gap-4 ${classicFocusHidden}`}
            >
              {renderPlaytestSecondaryActions()}
            </div>
          </>
        ) : (
          <>
            {renderPlaytestTitle()}
            <div className="playtest-header-actions flex shrink-0 items-center gap-2 md:gap-4">
              {renderPlaytestBackButton()}
              {renderPlaytestSecondaryActions()}
            </div>
          </>
        )}
      </div>

      {backExitHintVisible && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[320] flex justify-center px-4">
          <div className="rounded-full bg-slate-950/88 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md">
            {language === 'zh'
              ? '再按一次返回退出测试'
              : language === 'ja'
                ? 'もう一度戻るとテストを終了します'
                : 'Press Back again to exit preview'}
          </div>
        </div>
      )}

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

      {/* Novel Container */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <div
          className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}
        >
          {currentNodeId === 'THE_END' ? (
            layoutMode === 'immersive' ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500 relative w-full h-full">
                {/* 全景背景渐变 */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900 z-0" />

                <div className="relative z-10 flex flex-col items-center max-w-md p-8 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl">
                  <div className="w-20 h-20 mb-6 rounded-full flex items-center justify-center bg-white/10 border border-white/20 text-sky-400 animate-pulse">
                    <PlayCircle className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
                    {t.storyEnd}
                  </h2>
                  <p className="text-slate-300 mb-8 max-w-sm">{t.branchEnded}</p>
                  <button
                    onClick={() => {
                      setHistory([]);
                      navigateToNode(root?.id || null);
                    }}
                    className="px-10 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-95 hover:scale-[1.03]"
                  >
                    {t.restart}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
                <div
                  className={`w-20 h-20 mb-6 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-sky-500/20 text-sky-400' : 'bg-indigo-100 text-indigo-600'}`}
                >
                  <PlayCircle className="w-10 h-10" />
                </div>
                <h2
                  className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'} mb-4 tracking-tight`}
                >
                  {t.storyEnd}
                </h2>
                <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-8 max-w-sm`}>
                  {t.branchEnded}
                </p>
                <button
                  onClick={() => {
                    setHistory([]);
                    navigateToNode(root?.id || null);
                  }}
                  className={`px-10 py-3 ${isDarkMode ? 'bg-sky-600 hover:bg-sky-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold rounded-xl shadow-lg transition-all active:scale-95`}
                >
                  {t.restart}
                </button>
              </div>
            )
          ) : layoutMode === 'immersive' ? (
            <div className="flex-1 flex flex-col min-h-0 relative w-full h-full">
              <div
                className="absolute inset-0 z-0 overflow-hidden"
                style={{ transform: `scale(${presentationScale})`, transformOrigin: 'center' }}
              >
                <div className="absolute inset-0 overflow-hidden w-full h-full select-none pointer-events-none">
                  {sceneImageUrl ? (
                    <img
                      src={sceneImageUrl}
                      draggable={false}
                      onDragStart={(event) => event.preventDefault()}
                      className="preview-media-safe w-full h-full"
                      style={sceneStyle}
                      alt="Scene Background"
                    />
                  ) : sceneVideoUrl ? (
                    <video
                      key={currentNodeId}
                      ref={videoRef}
                      src={sceneVideoUrl}
                      playsInline
                      muted
                      loop={false}
                      autoPlay={videoAutoPlay || waitsForBranchVideo}
                      onLoadedMetadata={(event) => {
                        event.currentTarget.currentTime = Math.min(
                          sceneVideoStartTime,
                          Math.max(0, event.currentTarget.duration || 0),
                        );
                      }}
                      onPlay={startVideoLimitTimer}
                      onPause={stopVideoLimitTimer}
                      onTimeUpdate={handleSceneVideoTimeUpdate}
                      onEnded={() => {
                        stopVideoLimitTimer();
                        setCurrentVideoEnded(true);
                      }}
                      className="w-full h-full"
                      style={sceneStyle}
                    />
                  ) : (
                    <div
                      className={`w-full h-full ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-950' : 'bg-gradient-to-br from-indigo-50 via-slate-100 to-indigo-100'}`}
                    />
                  )}
                </div>
                {renderPresentedCharacters()}
              </div>

              {/* 2. 悬浮的选项与对话框 */}
              <div
                className={`absolute inset-0 pointer-events-none ${
                  choicesPosition === 'center' && choicesReady && blurBackground
                    ? blurText
                      ? 'z-20'
                      : 'z-40'
                    : 'z-20'
                }`}
              >
                <div
                  className="pointer-events-auto absolute flex flex-col items-stretch justify-end gap-4"
                  style={dialogueFrameStyle}
                >
                  {/* 选项区域 - 文字上方 */}
                  {choicesPosition === 'aboveText' && renderChoices(true)}

                  {useInlineFocusButton &&
                    renderPlaytestFocusButton(
                      'playtest-focus-button-inline pointer-events-auto relative z-[30] mb-1 self-end',
                    )}

                  {/* 透明半透明对话框 */}
                  <div
                    ref={immersiveDialogueRef}
                    onClick={handleTextContainerClick}
                    className="pointer-events-auto relative w-full overflow-y-auto rounded-2xl border border-white/10 py-4 text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-6 duration-500"
                    style={dialogueShellStyle}
                  >
                    {currentNode?.data.audioUrl && (
                      <audio
                        key={currentNodeId}
                        ref={audioRef}
                        src={currentNode.data.audioUrl as string}
                        preload="auto"
                        onPlay={recordCurrentAudio}
                        onEnded={() => setCurrentAudioEnded(true)}
                        className="hidden"
                      />
                    )}

                    {renderStyle.titleVisible && currentTitle && (
                      <div className="mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={titleStyle}>
                        {currentTitle}
                      </div>
                    )}

                    <div
                      className="whitespace-pre-wrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] max-h-[150px] overflow-y-auto pr-1"
                      style={bodyStyle}
                    >
                      <div dangerouslySetInnerHTML={{ __html: displayedHtml || '' }} />
                    </div>

                    {false && !animationCompleted && (
                      <div className="absolute right-4 bottom-2 text-[10px] text-white/50 animate-pulse select-none">
                        {interactionMode === 'typewriter' &&
                          (language === 'zh' ? '点击跳过打字...' : 'Click to skip...')}
                        {interactionMode === 'timed' &&
                          (language === 'zh'
                            ? `选项将在 ${timeLeft}s 后出现`
                            : `Choices in ${timeLeft}s`)}
                        {interactionMode === 'clickToShow' &&
                          (language === 'zh'
                            ? '点击文本显示选项...'
                            : 'Click text to show options...')}
                      </div>
                    )}

                    {!animationCompleted && interactionMode === 'timed' && (
                      <div
                        className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-100"
                        style={{ width: `${(timeLeft / choiceDelay) * 100}%` }}
                      />
                    )}
                  </div>

                  {/* 选项区域 - 文字下方 */}
                  {choicesPosition === 'belowText' && renderChoices(true)}
                </div>
              </div>

              {/* 选项区域 - 画面中间 */}
              {choicesPosition === 'center' &&
                choicesReady &&
                !(skipSingleChoicePopup && outEdges.length <= 1) && (
                  <div
                    className={`absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/45 pointer-events-none animate-in fade-in duration-300 ${blurBackground ? 'backdrop-blur-[6px]' : 'backdrop-blur-none'}`}
                  >
                    <div className="w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden pointer-events-auto">
                      {renderChoices(true)}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            // 经典排版
            <div className="flex-1 flex flex-col min-h-0 relative">
              {/* 1. Media Area */}
              {hasMedia && (
                <div
                  className={`${
                    mobileClassicLayout
                      ? 'playtest-classic-mobile-media w-full shrink-0 aspect-video p-0'
                      : 'flex-1 min-h-0 p-2 md:p-6'
                  } flex items-center justify-center relative group overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}
                >
                  {/* Ambient Background Layer */}
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-1000">
                    {sceneImageUrl ? (
                      <img
                        src={sceneImageUrl}
                        draggable={false}
                        onDragStart={(event) => event.preventDefault()}
                        className="preview-media-safe w-full h-full object-cover blur-[60px] opacity-20 scale-125"
                        alt=""
                      />
                    ) : (
                      <div
                        className={`w-full h-full ${isDarkMode ? 'bg-gradient-radial from-sky-500/10' : 'bg-gradient-radial from-indigo-500/5'} to-transparent`}
                      />
                    )}
                  </div>

                  {/* Shared 1920x1080 presentation stage */}
                  <VirtualPresentationStage
                    fit={mobileClassicLayout ? 'width' : 'cover'}
                    className="relative z-10 h-full w-full animate-in zoom-in-95 duration-500"
                  >
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{
                        transform: `scale(${presentationScale})`,
                        transformOrigin: 'center',
                      }}
                    >
                      {sceneImageUrl && (
                        <img
                          src={sceneImageUrl}
                          alt="Scene"
                          draggable={false}
                          onDragStart={(event) => event.preventDefault()}
                          className="preview-media-safe h-full w-full"
                          style={{
                            ...sceneStyle,
                          }}
                        />
                      )}
                      {sceneVideoUrl && (
                        <video
                          key={currentNodeId}
                          ref={videoRef}
                          src={sceneVideoUrl}
                          controls
                          playsInline
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          autoPlay={videoAutoPlay || waitsForBranchVideo}
                          onLoadedMetadata={(event) => {
                            event.currentTarget.currentTime = Math.min(
                              sceneVideoStartTime,
                              Math.max(0, event.currentTarget.duration || 0),
                            );
                          }}
                          onPlay={startVideoLimitTimer}
                          onPause={stopVideoLimitTimer}
                          onTimeUpdate={handleSceneVideoTimeUpdate}
                          onEnded={() => {
                            stopVideoLimitTimer();
                            setCurrentVideoEnded(true);
                          }}
                          className="h-full w-full"
                          style={sceneStyle}
                        />
                      )}
                      {renderPresentedCharacters()}
                    </div>
                  </VirtualPresentationStage>

                  {/* 选项区域 - 画面的中间（非全屏且有媒体时挂载在画面内） */}
                  {choicesPosition === 'center' &&
                    !isFullscreen &&
                    choicesReady &&
                    !(skipSingleChoicePopup && outEdges.length <= 1) && (
                      <div
                        className={`absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/45 pointer-events-none animate-in fade-in duration-300 ${blurBackground ? 'backdrop-blur-[6px]' : 'backdrop-blur-none'}`}
                      >
                        <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto overflow-x-hidden pointer-events-auto p-4 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl">
                          {renderChoices(false)}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* 选项区域 - 文字上方 */}
              {choicesPosition === 'aboveText' && choicesReady && (
                <div
                  ref={choicesRef}
                  className={`p-4 md:p-6 lg:px-48 xl:px-64 ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-100 border-slate-200'} border-b shrink-0 z-40 shadow-sm`}
                >
                  {renderChoices(false)}
                </div>
              )}

              {/* 2. Text Area */}
              <div
                onClick={handleTextContainerClick}
                className={`${
                  !hasMedia
                    ? 'flex-1'
                    : mobileClassicLayout
                      ? 'playtest-classic-mobile-text flex-1 min-h-[42vh] shrink-0'
                      : 'h-32 md:h-48 shrink-0'
                } overflow-y-auto py-4 md:py-8 ${
                  mobileClassicLayout ? 'px-4' : 'px-6 md:px-12 lg:px-48 xl:px-64'
                } ${isDarkMode ? 'bg-slate-950/90' : 'bg-white/90'} backdrop-blur-xl border-t border-white/5 transition-all duration-300 relative ${
                  choicesPosition === 'center' && choicesReady && blurBackground
                    ? isFullscreen
                      ? blurText
                        ? 'z-20'
                        : 'z-40'
                      : blurText
                        ? 'z-20 blur-[5px] opacity-80'
                        : 'z-20'
                    : 'z-20'
                }`}
                style={{
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
                  borderTopLeftRadius: renderStyle.dialogRadius,
                  borderTopRightRadius: renderStyle.dialogRadius,
                  paddingLeft: `${Math.max(2, renderStyle.dialogTextPaddingX ?? 9)}%`,
                  paddingRight: `${Math.max(2, renderStyle.dialogTextPaddingX ?? 9)}%`,
                }}
              >
                {currentNode?.data.audioUrl && (
                  <audio
                    key={currentNodeId}
                    ref={audioRef}
                    src={currentNode.data.audioUrl as string}
                    preload="auto"
                    onPlay={recordCurrentAudio}
                    onEnded={() => setCurrentAudioEnded(true)}
                    className="hidden"
                  />
                )}
                {renderStyle.titleVisible && currentTitle && (
                  <div className="mb-2 drop-shadow-sm" style={titleStyle}>
                    {currentTitle}
                  </div>
                )}
                <div className="whitespace-pre-wrap drop-shadow-sm" style={bodyStyle}>
                  <div dangerouslySetInnerHTML={{ __html: displayedHtml || '' }} />
                </div>

                {false && !animationCompleted && (
                  <div className="absolute right-4 bottom-2 text-[10px] opacity-40 animate-pulse select-none">
                    {interactionMode === 'typewriter' &&
                      (language === 'zh' ? '点击跳过打字...' : 'Click to skip...')}
                    {interactionMode === 'timed' &&
                      (language === 'zh'
                        ? `选项将在 ${timeLeft}s 后出现`
                        : `Choices in ${timeLeft}s`)}
                    {interactionMode === 'clickToShow' &&
                      (language === 'zh' ? '点击文本显示选项...' : 'Click text to show options...')}
                  </div>
                )}

                {!animationCompleted && interactionMode === 'timed' && (
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-100"
                    style={{ width: `${(timeLeft / choiceDelay) * 100}%` }}
                  />
                )}
              </div>

              {/* 3. Choices Area - 文字下方 */}
              {choicesPosition === 'belowText' && choicesReady && (
                <div
                  ref={choicesRef}
                  className={`p-4 md:p-6 lg:px-48 xl:px-64 ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-100 border-slate-200'} border-t shrink-0 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]`}
                >
                  {renderChoices(false)}
                </div>
              )}

              {/* 选项区域 - 屏幕的中间（当全屏，或无媒体文件时挂载在整个视口中央） */}
              {choicesPosition === 'center' &&
                (isFullscreen || !hasMedia) &&
                choicesReady &&
                !(skipSingleChoicePopup && outEdges.length <= 1) && (
                  <div
                    className={`absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/45 pointer-events-none animate-in fade-in duration-300 ${blurBackground ? 'backdrop-blur-[6px]' : 'backdrop-blur-none'}`}
                  >
                    <div className="w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden pointer-events-auto p-4 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl">
                      {renderChoices(false)}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* 沉浸式模式切换按钮 */}
      {!useInlineFocusButton &&
        renderPlaytestFocusButton('fixed z-[260]', focusButtonStyle)}
      </div>

      {showSettings && (
        <aside
          onClick={(event) => event.stopPropagation()}
          className={`z-[130] shadow-2xl ${
            isMobile
              ? `playtest-settings-mobile fixed inset-0 flex flex-col ${
                  isDarkMode
                    ? 'bg-slate-950 text-white'
                    : 'bg-white text-slate-800'
                }`
              : `absolute bottom-0 right-0 top-0 w-[25vw] min-w-[360px] max-w-[520px] border-l p-4 ${
                  isDarkMode
                    ? 'border-white/10 bg-slate-950/96 text-white shadow-black/35'
                    : 'border-slate-200 bg-white text-slate-800 shadow-slate-300/35'
                }`
          }`}
        >
          {isMobile && (
            <div
              className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${
                isDarkMode ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <span className="text-sm font-bold">
                {language === 'zh' ? '测试设置' : language === 'ja' ? 'テスト設定' : 'Playtest Settings'}
              </span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors active:scale-95 ${
                  isDarkMode
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <X className="h-4 w-4" />
                {language === 'zh' ? '退出设置' : language === 'ja' ? '設定を閉じる' : 'Close'}
              </button>
            </div>
          )}
          <div className={`video-render-scroll flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'h-full pr-1'}`}>
            {renderPlaytestSettingsPanel()}
          </div>
        </aside>
      )}

      {showRotateHint && (
        <div
          className="playtest-rotate-hint fixed inset-0 z-[200] flex cursor-pointer items-center justify-center bg-black/75 px-6 backdrop-blur-sm"
          onClick={(event) => {
            event.stopPropagation();
            dismissRotateHint();
          }}
        >
          <div className="pointer-events-none max-w-xs text-center text-white">
            <RotateCw className="mx-auto mb-4 h-12 w-12 animate-pulse text-sky-300" />
            <p className="text-base font-bold leading-relaxed">
              {language === 'zh'
                ? '图文合并模式建议横屏体验'
                : language === 'ja'
                  ? '画像統合モードは横向き表示をおすすめします'
                  : 'Immersive mode works best in landscape'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/70">
              {language === 'zh'
                ? '请将手机旋转至横屏，或点击任意处继续'
                : language === 'ja'
                  ? '端末を横向きにするか、画面をタップして続行'
                  : 'Rotate your device, or tap anywhere to continue'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaytestPanelTitle({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--vr-accent)]" />
      <span className="truncate">{title}</span>
    </div>
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
        <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
          {description}
        </div>
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
            onClick={() => onChange(option.value)}
            className={`flex h-9 min-w-0 items-center justify-center gap-1 border-0 px-1 text-[10px] font-black transition-colors ${
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

function PlaytestToggleButton({
  active,
  icon,
  label,
  onClick,
  highlightActive = true,
}: {
  active: boolean;
  icon?: ReactNode;
  label?: string;
  onClick: () => void;
  highlightActive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full min-w-0 items-center justify-center gap-1 border-0 px-2 text-[10px] font-black transition-colors ${
        active && highlightActive
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

function ColumnDotsGlyph({ count }: { count: number }) {
  return (
    <span className="flex h-4 w-8 shrink-0 items-center justify-center gap-1">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className="h-1.5 w-1.5 rounded-full bg-current" />
      ))}
    </span>
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

