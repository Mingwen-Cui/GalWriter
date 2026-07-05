import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import { House, ListMusic, Lock, Maximize2, Minimize2, RotateCcw, Unlock } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import type {
  CharacterNodeData,
  CharacterPresentation,
  InlinePresentationAction,
  SceneNodeData,
  StoryPresentation,
} from '../../../domain/project';
import type { Language } from '../../../lib/i18n';
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
  getCharacterStagePosition,
  getPresentationExitDuration,
  getPresentationTransform,
  getSceneExitDelay,
  normalizeStoryPresentation,
} from '../../../lib/presentation';
import { useRegionBackgroundMusic } from '../../../lib/useRegionBackgroundMusic';
import { AudioPlaylistModal } from '../../AudioPlaylistModal';
import { VirtualPresentationStage } from '../../VirtualPresentationStage';
import {
  getNameplateCharacterCenterX,
  getNameplateCssBackground,
  getNameplateItems,
} from '../video/shared/nameplateRenderer';
import { renderCopy } from '../video/shared/renderCopy';
import {
  filterMentionTags,
  getNodeDisplayText,
  getNodeDisplayTitle,
  stripHtml,
} from '../video/shared/storyNodes';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';
import { buildArchivePageElements, buildSettingsPageElements } from './webMenuPageElements';
import { ChoiceButton, ControlsToggle } from './WebPlaytestPreviewControls';
import { WebPlaytestStartMenuElement } from './WebPlaytestStartMenuElement';
import type {
  StartMenuAction,
  StartMenuElement,
  StartMenuResizeHandle,
} from './webPlaytestStartMenuTools';
import {
  buildDefaultStartMenuElements,
  getResizeHandleStyle,
  getStartMenuPlacementBounds,
  resizeCursorByHandle,
  resizeHandlePositionClass,
  resizeHandleShapeClass,
  snapStartMenuBox,
  snapStartMenuValue,
} from './webPlaytestStartMenuTools';
import {
  buildBodyStyle,
  buildDialogueShellStyle,
  buildTitleStyle,
  colorInputValue,
  withAlpha,
} from './webPlaytestStyleTools';
import { WebPreviewMenuPages } from './WebPreviewMenuPages';

type WebPlaytestPreviewProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  language: Language;
  renderStyle: RenderStyle;
  choiceColor: string;
  choiceTextColor: string;
  settings: WebExportSettings;
  projectTitle: string;
  previewMode?: 'edit' | 'test';
  requestedSurface?: WebPreviewSurface;
  selectedStartMenuElementId?: string | null;
  onSurfaceChange?: (surface: WebPreviewSurface) => void;
  onSelectStartMenuElement?: (id: string | null) => void;
  onDeleteStartMenuElement?: (id: string) => void;
  onUpdateSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
  onUpdateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
};

export type WebPreviewSurface = 'start' | 'archive' | 'settings' | 'game';

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
  previewMode = 'test',
  requestedSurface,
  selectedStartMenuElementId: controlledSelectedStartMenuElementId,
  onSurfaceChange,
  onSelectStartMenuElement,
  onDeleteStartMenuElement,
  onUpdateSettings,
  onUpdateRenderStyle: _onUpdateRenderStyle,
}: WebPlaytestPreviewProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const playableNodes = useMemo(
    () => nodes.filter((node) => node.type === 'storyNode' && !node.data?.hidden),
    [nodes],
  );
  const runtimeNodes = useMemo(
    () =>
      nodes.filter(
        (node) =>
          (node.type === 'storyNode' || node.type === 'numberConditionNode') && !node.data?.hidden,
      ),
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
  const [previewStartMenuOpen, setPreviewStartMenuOpen] = useState(settings.showStartMenu);
  const [previewStartSettingsOpen, setPreviewStartSettingsOpen] = useState(false);
  const [previewArchiveOpen, setPreviewArchiveOpen] = useState(false);
  const [displayedPreviewText, setDisplayedPreviewText] = useState('');
  const previewRootRef = useRef<HTMLDivElement>(null);
  const dialogueBoxRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement>(null);
  const currentVideoRef = useRef<HTMLVideoElement>(null);
  const playlistAudioRef = useRef<HTMLAudioElement>(null);
  const startMenuAudioRef = useRef<HTMLAudioElement>(null);
  const startMenuEditorRef = useRef<HTMLDivElement>(null);
  const startMenuEditDragRef = useRef<{
    type: 'move' | 'resize' | 'rotate';
    resizeHandle?: StartMenuResizeHandle;
    id: string;
    startClientX: number;
    startClientY: number;
    initial: StartMenuElement;
    rect: DOMRect;
    centerX?: number;
    centerY?: number;
    startAngle?: number;
  } | null>(null);
  const startMenuBoundsDragRef = useRef<{
    type: 'move' | 'resize';
    resizeHandle?: StartMenuResizeHandle;
    startClientX: number;
    startClientY: number;
    rect: DOMRect;
    initial: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    };
  } | null>(null);
  const imagePreloadRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [localSelectedStartMenuElementId, setLocalSelectedStartMenuElementId] = useState<
    string | null
  >(null);
  const [editingStartMenuElementId, setEditingStartMenuElementId] = useState<string | null>(null);
  const selectedStartMenuElementId =
    controlledSelectedStartMenuElementId !== undefined
      ? controlledSelectedStartMenuElementId
      : localSelectedStartMenuElementId;
  const setSelectedStartMenuElementId = React.useCallback(
    (id: string | null) => {
      setLocalSelectedStartMenuElementId(id);
      onSelectStartMenuElement?.(id);
    },
    [onSelectStartMenuElement],
  );
  React.useEffect(() => {
    if (!editingStartMenuElementId) return;
    const editor = startMenuEditorRef.current?.querySelector<HTMLElement>(
      `[data-start-menu-text-id="${editingStartMenuElementId}"]`,
    );
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editingStartMenuElementId]);
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
  const inlineActionTimerRef = useRef<any>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const playbackSessionRef = useRef(0);
  const lastJumpedNodeRef = useRef<string | null>(null);
  const autoAdvanceHoldNodeRef = useRef<string | null>(null);

  React.useEffect(() => {
    const audio = startMenuAudioRef.current;
    if (!audio) return;
    if (previewStartMenuOpen && settings.startMenuBackgroundMusicUrl) {
      audio.volume = 0.7;
      audio.play().catch(() => undefined);
      return;
    }
    audio.pause();
  }, [previewStartMenuOpen, settings.startMenuBackgroundMusicUrl]);

  const clearPlaybackTimers = React.useCallback(() => {
    if (inlineActionTimerRef.current) window.clearTimeout(inlineActionTimerRef.current);
    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    if (autoAdvanceTimerRef.current) window.clearTimeout(autoAdvanceTimerRef.current);
    inlineActionTimerRef.current = null;
    transitionTimerRef.current = null;
    autoAdvanceTimerRef.current = null;
    setPresentationExiting(false);
    setActiveInlineAction(null);
    setCompletedInlineActions([]);
  }, []);

  const restartPlaybackSession = React.useCallback(() => {
    playbackSessionRef.current += 1;
    clearPlaybackTimers();
    lastJumpedNodeRef.current = null;
  }, [clearPlaybackTimers]);

  const titleStyle = buildTitleStyle(renderStyle);
  const bodyStyle = buildBodyStyle(renderStyle);
  const dialogueShellStyle = buildDialogueShellStyle(renderStyle, settings.layoutMode);
  const dialogueOffsetX = Math.max(-100, Math.min(100, renderStyle.dialogOffsetX ?? 0));
  const dialogueCenter = 50 + dialogueOffsetX * 0.5;
  const dialogWidth = Math.max(0, Math.min(100, renderStyle.dialogWidth || 86));
  const dialogueRightSpace = Math.max(0, 100 - (dialogueCenter + dialogWidth / 2));
  const hasBottomRightSpace = settings.layoutMode !== 'immersive' || dialogueRightSpace >= 12;
  const [controlsToggleBottom, setControlsToggleBottom] = useState(24);
  const controlsToggleStyle: React.CSSProperties =
    settings.layoutMode === 'immersive'
      ? {
          right: 24,
          bottom: hasBottomRightSpace ? 24 : controlsToggleBottom,
        }
      : {};

  React.useLayoutEffect(() => {
    if (settings.layoutMode !== 'immersive' || hasBottomRightSpace) {
      setControlsToggleBottom(24);
      return;
    }
    const root = previewRootRef.current;
    const dialogue = dialogueBoxRef.current;
    if (!root || !dialogue) return;

    let frame = 0;
    const updatePosition = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect();
        const dialogueRect = dialogue.getBoundingClientRect();
        const nextBottom = Math.max(24, Math.ceil(rootRect.bottom - dialogueRect.top + 20));
        setControlsToggleBottom((current) =>
          Math.abs(current - nextBottom) > 1 ? nextBottom : current,
        );
      });
    };

    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(root);
    observer.observe(dialogue);
    window.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
    };
  }, [
    settings.layoutMode,
    settings.choicesPosition,
    hasBottomRightSpace,
    currentNodeId,
    displayedPreviewText,
    renderStyle.dialogWidth,
    renderStyle.dialogHeight,
    renderStyle.dialogOffsetX,
    renderStyle.dialogOffsetY,
    renderStyle.dialogTextPaddingX,
    renderStyle.bodyFontSize,
    renderStyle.titleFontSize,
    renderStyle.titleVisible,
  ]);

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
      current && (current === 'THE_END' || runtimeNodes.some((node) => node.id === current))
        ? current
        : root.id,
    );
  }, [root, runtimeNodes]);

  React.useEffect(() => {
    setPreviewStartSettingsOpen(false);
    setPreviewArchiveOpen(false);
    setPreviewStartMenuOpen(settings.showStartMenu);

    if (previewMode !== 'test') return;

    restartPlaybackSession();
    autoAdvanceHoldNodeRef.current = root?.id || null;
    setHistory([]);
    setCurrentNodeId(root?.id || null);
  }, [previewMode, restartPlaybackSession, root?.id, settings.showStartMenu]);

  React.useEffect(() => {
    if (previewMode !== 'edit' || !settings.showStartMenu || !requestedSurface) return;

    if (requestedSurface === 'game') {
      setPreviewStartSettingsOpen(false);
      setPreviewArchiveOpen(false);
      setPreviewStartMenuOpen(false);
      return;
    }

    setPreviewStartMenuOpen(true);
    setPreviewStartSettingsOpen(requestedSurface === 'settings');
    setPreviewArchiveOpen(requestedSurface === 'archive');
  }, [previewMode, requestedSurface, settings.showStartMenu]);

  React.useEffect(() => {
    const surface: WebPreviewSurface = previewStartMenuOpen
      ? previewStartSettingsOpen
        ? 'settings'
        : previewArchiveOpen
          ? 'archive'
          : 'start'
      : 'game';
    onSurfaceChange?.(surface);
  }, [onSurfaceChange, previewArchiveOpen, previewStartMenuOpen, previewStartSettingsOpen]);

  const currentNode =
    currentNodeId && currentNodeId !== 'THE_END'
      ? runtimeNodes.find((node) => node.id === currentNodeId)
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
  const presentation = useMemo(
    () =>
      normalizeStoryPresentation(currentNode?.data?.presentation as StoryPresentation | undefined),
    [currentNode?.data?.presentation],
  );
  const sceneSource = presentation.scene
    ? nodes.find((node) => node.id === presentation.scene?.sourceNodeId)
    : null;
  const sceneData =
    sceneSource?.type === 'sceneNode' ? (sceneSource.data as SceneNodeData) : undefined;
  const activeSceneSwitchAction = getInlineSwitchAction(
    'scene',
    presentation.scene?.sourceNodeId,
    null,
    completedSwitchActions,
  );
  const sceneMedia = resolveSceneMedia({
    data: sceneData,
    scene: presentation.scene,
    fallbackImageUrl: imageUrl,
    fallbackVideoUrl: videoUrl,
    switchAction: activeSceneSwitchAction,
  });
  const currentImageUrl = sceneMedia.videoUrl ? '' : sceneMedia.imageUrl || '';
  const currentVideoUrl = sceneMedia.videoUrl || '';

  React.useEffect(() => {
    if (!currentImageUrl || imagePreloadRef.current.has(currentImageUrl)) return;
    const image = new Image();
    image.src = currentImageUrl;
    imagePreloadRef.current.set(currentImageUrl, image);
  }, [currentImageUrl]);
  const presentedCharacters = useMemo(() => {
    if (!presentation.characters) return [];
    return presentation.characters
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
  }, [activeInlineAction, completedSwitchActions, presentation.characters, nodes]);
  const rawText = getNodeDisplayText(currentNode);
  const text = filterMentionTags(rawText, settings.hideCharacterTags, settings.hideSceneTags);
  const shouldHideCenteredSingleChoice =
    settings.choicesPosition === 'center' && settings.skipSingleChoicePopup && outEdges.length <= 1;
  const shouldShowChoices =
    !shouldHideCenteredSingleChoice && (animationDone || !settings.autoAdvance);
  const canClickContinue = outEdges.length <= 1;
  const hideCenteredTitle = false;
  const nameplateItems = useMemo(
    () => (currentNode ? getNameplateItems(currentNode, nodes) : []),
    [currentNode, nodes],
  );

  const renderNameplates = () => {
    if (!renderStyle.nameplateVisible || !nameplateItems.length) return null;
    const fontSize = Math.max(10, renderStyle.nameplateFontSize ?? 18);
    const scale = Math.max(0.5, Math.min(2, (renderStyle.nameplateScale ?? 100) / 100));
    const paddingX = Math.round(fontSize * 1.15 * scale);
    const paddingY = Math.round(fontSize * 0.42 * scale);
    const rowHeight = Math.ceil(fontSize + paddingY * 2 + Math.max(8, fontSize * 0.45));
    const textGap = renderStyle.nameplateTextGap ?? 8;
    const top = 0;
    const translateY = `calc(-100% - 8px + ${renderStyle.nameplateOffsetY ?? 0}px)`;
    const baseStyle: React.CSSProperties = {
      ...(renderStyle.nameplateInside
        ? { background: 'transparent' }
        : getNameplateCssBackground(renderStyle)),
      color: withAlpha(
        colorInputValue(renderStyle.nameplateTextColor),
        (renderStyle.nameplateTextColorAlpha ?? 100) / 100,
      ),
      fontFamily: renderStyle.nameplateFontFamily || renderStyle.titleFontFamily,
      fontSize,
      lineHeight: 1,
      padding: `${paddingY}px ${paddingX}px`,
      borderRadius: Math.max(0, renderStyle.nameplateRadius ?? 14),
      boxShadow: renderStyle.nameplateInside ? 'none' : '0 10px 24px rgba(0, 0, 0, 0.24)',
      textShadow: renderStyle.nameplateInside
        ? '0 1px 10px rgba(0, 0, 0, 0.42)'
        : '0 1px 8px rgba(0, 0, 0, 0.32)',
      whiteSpace: 'nowrap',
      maxWidth: 'min(44%, 220px)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    };

    if (!renderStyle.nameplateFollowCharacter) {
      if (renderStyle.nameplateInside) {
        return (
          <div
            className="pointer-events-none relative z-10 flex max-w-full justify-center gap-2"
            style={{
              minHeight: rowHeight,
              marginBottom: textGap,
              transform: `translate(${renderStyle.nameplateOffsetX ?? 0}px, ${renderStyle.nameplateOffsetY ?? 0}px)`,
            }}
          >
            {nameplateItems.map((item) => (
              <div key={item.sourceNodeId} className="font-black" style={baseStyle}>
                {item.name}
              </div>
            ))}
          </div>
        );
      }
      return (
        <div
          className="pointer-events-none absolute left-1/2 z-10 flex max-w-full gap-2"
          style={{
            top,
            transform: `translate(calc(-50% + ${renderStyle.nameplateOffsetX ?? 0}px), ${translateY})`,
          }}
        >
          {nameplateItems.map((item) => (
            <div key={item.sourceNodeId} className="font-black" style={baseStyle}>
              {item.name}
            </div>
          ))}
        </div>
      );
    }

    const dialogueLeft =
      50 + Math.max(-100, Math.min(100, renderStyle.dialogOffsetX ?? 0)) * 0.5 - dialogWidth / 2;
    if (renderStyle.nameplateInside) {
      return (
        <div
          className="pointer-events-none relative z-10"
          style={{ minHeight: rowHeight, marginBottom: textGap }}
        >
          {nameplateItems.map((item) => {
            const characterPercent = getNameplateCharacterCenterX(item.config, 100);
            const localLeft = Math.max(
              4,
              Math.min(96, ((characterPercent - dialogueLeft) / dialogWidth) * 100),
            );
            return (
              <div
                key={item.sourceNodeId}
                className="absolute top-0 font-black"
                style={{
                  ...baseStyle,
                  left: `${localLeft}%`,
                  transform: `translate(calc(-50% + ${renderStyle.nameplateOffsetX ?? 0}px), ${renderStyle.nameplateOffsetY ?? 0}px)`,
                }}
              >
                {item.name}
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
        {nameplateItems.map((item) => {
          const characterPercent = getNameplateCharacterCenterX(item.config, 100);
          const localLeft = Math.max(
            4,
            Math.min(96, ((characterPercent - dialogueLeft) / dialogWidth) * 100),
          );
          return (
            <div
              key={item.sourceNodeId}
              className="absolute top-0 font-black"
              style={{
                ...baseStyle,
                left: `${localLeft}%`,
                top,
                transform: `translate(calc(-50% + ${renderStyle.nameplateOffsetX ?? 0}px), ${translateY})`,
              }}
            >
              {item.name}
            </div>
          );
        })}
      </div>
    );
  };

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
    if (settings.autoAdvance && currentVideoUrl && currentVideoRef.current) {
      currentVideoRef.current.currentTime = 0;
      currentVideoRef.current.play().catch(() => {});
    }
  }, [audioUrl, currentNodeId, currentVideoUrl, settings.autoAdvance]);

  React.useEffect(() => {
    if (!playlistAudioUrl || !playlistAudioRef.current) return;
    playlistAudioRef.current.currentTime = 0;
    playlistAudioRef.current.play().catch((error) => {
      setIsPlaylistAudioPlaying(false);
      console.error('Web preview playlist playback failed', error);
    });
  }, [playlistAudioUrl]);

  const goTo = (targetId: string) => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (settings.layoutMode === 'classic') {
      if (currentNodeId) setHistory((prev) => [...prev, currentNodeId]);
      setCurrentNodeId(targetId);
      return;
    }
    if (presentationExiting) return;
    const exitDuration = getPresentationExitDuration(presentation);
    const sessionId = playbackSessionRef.current;
    setPresentationExiting(true);
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      if (sessionId !== playbackSessionRef.current) return;
      if (currentNodeId) setHistory((prev) => [...prev, currentNodeId]);
      setCurrentNodeId(targetId);
    }, exitDuration);
  };

  const handleChoiceClick = (targetId: string) => {
    autoAdvanceHoldNodeRef.current = null;
    goTo(targetId);
  };

  React.useEffect(() => {
    if (inlineActionTimerRef.current) window.clearTimeout(inlineActionTimerRef.current);
    setActiveInlineAction(null);
    setCompletedSwitchActions([]);
    setCompletedInlineActions([]);
    setAnimationDone(settings.interactionMode !== 'typewriter');
    if (settings.interactionMode !== 'typewriter') {
      const playbackSteps = buildInlinePlaybackSteps(rawText, presentation, {
        hideCharacterTags: settings.hideCharacterTags,
        hideSceneTags: settings.hideSceneTags,
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
      setDisplayedPreviewText(text);
      return;
    }
    const playbackSteps = buildInlinePlaybackSteps(rawText, presentation, {
      hideCharacterTags: settings.hideCharacterTags,
      hideSceneTags: settings.hideSceneTags,
    });
    let stepIndex = 0;
    let committedHtml = '';
    let timer = 0;
    setDisplayedPreviewText('');

    const playNext = () => {
      window.clearInterval(timer);
      const step = playbackSteps[stepIndex];
      if (!step) {
        setActiveInlineAction(null);
        setAnimationDone(true);
        setDisplayedPreviewText(committedHtml);
        return;
      }

      if (step.kind === 'action') {
        setActiveInlineAction(step.action);
        inlineActionTimerRef.current = window.setTimeout(
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

      const source = stripHtml(step.html);
      const revealUnits =
        renderStyle.bodyTypewriterMode === 'line'
          ? source.split(/(\n+)/)
          : renderStyle.bodyTypewriterMode === 'sentence' ||
              renderStyle.bodyTypewriterMode === 'word'
            ? source.match(/[^。！？.!?\n]+[。！？.!?]*|\n+/g) || Array.from(source)
            : Array.from(source);
      let index = 0;
      timer = window.setInterval(() => {
        index += 1;
        const visibleText = revealUnits.slice(0, index).join('');
        setDisplayedPreviewText(committedHtml + visibleText);
        if (index >= revealUnits.length) {
          window.clearInterval(timer);
          committedHtml += source;
          stepIndex += 1;
          playNext();
        }
      }, settings.typewriterSpeed);
    };
    playNext();
    return () => {
      window.clearInterval(timer);
      if (inlineActionTimerRef.current) window.clearTimeout(inlineActionTimerRef.current);
    };
  }, [
    currentNodeId,
    presentation,
    renderStyle.bodyTypewriterMode,
    settings.interactionMode,
    settings.hideCharacterTags,
    settings.hideSceneTags,
    settings.typewriterSpeed,
    rawText,
    text,
  ]);

  React.useEffect(() => {
    if (
      !settings.autoAdvance ||
      currentNodeId === 'THE_END' ||
      autoAdvanceHoldNodeRef.current === currentNodeId ||
      currentNode?.type === 'numberConditionNode' ||
      currentNode?.data?.skip === true ||
      outEdges.length > 1
    ) {
      return;
    }

    if (audioUrl || currentVideoUrl) {
      if ((!audioUrl || currentAudioEnded) && (!currentVideoUrl || currentVideoEnded)) {
        goTo(outEdges[0]?.target || 'THE_END');
      }
      return;
    }

    if (!animationDone) return;
    const sessionId = playbackSessionRef.current;
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      if (sessionId !== playbackSessionRef.current) return;
      goTo(outEdges[0]?.target || 'THE_END');
    }, 900);
    return () => {
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [
    animationDone,
    audioUrl,
    currentAudioEnded,
    currentNodeId,
    currentNode?.type,
    currentNode?.data?.skip,
    currentVideoEnded,
    outEdges,
    settings.autoAdvance,
    currentVideoUrl,
  ]);

  React.useLayoutEffect(() => {
    if (
      !currentNodeId ||
      currentNodeId === 'THE_END' ||
      currentNodeId === lastJumpedNodeRef.current
    ) {
      return;
    }
    const node = runtimeNodes.find((candidate) => candidate.id === currentNodeId);
    if (!node) return;

    if (node.type === 'numberConditionNode') {
      lastJumpedNodeRef.current = currentNodeId;
      const sum = history.reduce((total, nodeId) => {
        const historyNode = runtimeNodes.find((candidate) => candidate.id === nodeId);
        const value = historyNode?.data?.nodeValue;
        return total + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
      }, 0);
      const ranges = (node.data?.ranges as { id: string; min: number; max: number }[]) || [];
      const matchedRange = ranges.find(
        (range) => range.min <= range.max && sum >= range.min && sum <= range.max,
      );
      const threshold = typeof node.data?.threshold === 'number' ? node.data.threshold : 0;
      const sourceHandle = matchedRange
        ? `out-range-${matchedRange.id}`
        : sum >= threshold
          ? 'out-greater'
          : 'out-less-equal';
      const nextEdge = edges.find(
        (edge) => edge.source === currentNodeId && edge.sourceHandle === sourceHandle,
      );
      setHistory((previous) => [...previous, currentNodeId]);
      setCurrentNodeId(nextEdge?.target || 'THE_END');
      return;
    }

    if (node.data?.skip === true) {
      lastJumpedNodeRef.current = currentNodeId;
      const nextEdge = edges.find((edge) => edge.source === currentNodeId);
      setHistory((previous) => [...previous, currentNodeId]);
      setCurrentNodeId(nextEdge?.target || 'THE_END');
    }
  }, [currentNodeId, edges, history, runtimeNodes]);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsPreviewFullscreen(document.fullscreenElement === previewRootRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const continueFromText = () => {
    if (currentNodeId === 'THE_END' || !currentNode) return;
    autoAdvanceHoldNodeRef.current = null;
    if (!canClickContinue) return;
    goTo(outEdges[0]?.target || 'THE_END');
  };

  const reset = () => {
    restartPlaybackSession();
    autoAdvanceHoldNodeRef.current = root?.id || null;
    setHistory([]);
    setCurrentNodeId(root?.id || null);
  };

  const back = () => {
    restartPlaybackSession();
    setHistory((prev) => {
      const next = [...prev];
      let previous = next.pop();
      while (previous) {
        const previousNode = runtimeNodes.find((node) => node.id === previous);
        if (previousNode?.type === 'numberConditionNode' || previousNode?.data?.skip === true) {
          previous = next.pop();
          continue;
        }
        break;
      }
      if (previous) setCurrentNodeId(previous);
      else setCurrentNodeId(root?.id || null);
      return next;
    });
  };

  const returnToStartMenu = () => {
    if (!settings.showStartMenu) return;
    restartPlaybackSession();
    currentAudioRef.current?.pause();
    currentVideoRef.current?.pause();
    setShowAudioPlaylist(false);
    setPreviewStartSettingsOpen(false);
    setPreviewArchiveOpen(false);
    setPreviewStartMenuOpen(true);
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

  const startMenuButtonPositionClass =
    settings.startMenuButtonPosition === 'bottomLeft'
      ? 'items-end justify-items-start text-left'
      : settings.startMenuButtonPosition === 'bottomRight'
        ? 'items-end justify-items-end text-left'
        : 'place-items-center text-center';
  const startMenuBackgroundClass =
    settings.startMenuTemplate === 'minimal'
      ? 'bg-slate-950'
      : settings.startMenuTemplate === 'glass'
        ? 'bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(8,145,178,0.34)),radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.20),transparent_34%),#07111f]'
        : 'bg-[radial-gradient(circle_at_50%_18%,rgba(14,165,233,0.24),transparent_42%),linear-gradient(180deg,rgba(4,8,14,0.44),rgba(4,8,14,0.94)),#070b12]';
  const startMenuPanelSurfaceClass =
    settings.startMenuTemplate === 'glass'
      ? 'rounded-[18px] border border-white/16 bg-white/[0.08] p-6 shadow-2xl shadow-black/35 backdrop-blur-2xl'
      : '';
  const buttonHeight =
    settings.startMenuButtonSize === 'compact'
      ? 8
      : settings.startMenuButtonSize === 'large'
        ? 12
        : 10;
  const defaultButtonWidth = settings.startMenuButtonLayout === 'horizontal' ? 18 : 34;
  const defaultButtonY = settings.startMenuButtonPosition === 'center' ? 61 : 66;
  const defaultButtonX =
    settings.startMenuButtonPosition === 'bottomLeft'
      ? 8
      : settings.startMenuButtonPosition === 'bottomRight'
        ? 100 - 8 - defaultButtonWidth
        : 50 - defaultButtonWidth / 2;
  const startMenuActions = [
    settings.startMenuShowSave
      ? {
          key: 'save',
          label: t('存档', 'セーブ', 'Save'),
          disabled: true,
          primary: true,
          onClick: () => {
            setPreviewArchiveOpen(true);
            setPreviewStartSettingsOpen(false);
          },
        }
      : null,
    settings.startMenuShowNewGame ||
    (!settings.startMenuShowSave && !settings.startMenuShowSettings)
      ? {
          key: 'new',
          label: t('新游戏', '新規ゲーム', 'New Game'),
          disabled: false,
          primary: !settings.startMenuShowSave,
          onClick: () => {
            reset();
            setPreviewStartMenuOpen(false);
            setPreviewStartSettingsOpen(false);
            setPreviewArchiveOpen(false);
          },
        }
      : null,
    settings.startMenuShowSettings
      ? {
          key: 'settings',
          label: t('设置', '設定', 'Settings'),
          disabled: false,
          primary: false,
          onClick: () => {
            setPreviewStartSettingsOpen(true);
            setPreviewArchiveOpen(false);
          },
        }
      : null,
  ].filter((action): action is StartMenuAction => Boolean(action));
  const startMenuActionMap = new Map(startMenuActions.map((action) => [action.key, action]));
  const defaultStartMenuElements = React.useMemo<StartMenuElement[]>(
    () =>
      buildDefaultStartMenuElements({
        settings,
        projectTitle,
        startMenuActions,
        choiceColor,
        choiceTextColor,
        defaultButtonX,
        defaultButtonY,
        defaultButtonWidth,
        buttonHeight,
        t,
      }),
    [
      buttonHeight,
      choiceColor,
      choiceTextColor,
      defaultButtonWidth,
      defaultButtonX,
      defaultButtonY,
      projectTitle,
      settings,
      startMenuActions,
    ],
  );
  const startMenuElements =
    settings.startMenuElements && settings.startMenuElements.length > 0
      ? settings.startMenuElements
      : defaultStartMenuElements;
  const defaultArchivePageElements = React.useMemo(
    () => buildArchivePageElements(language, choiceColor, choiceTextColor),
    [choiceColor, choiceTextColor, language],
  );
  const defaultSettingsPageElements = React.useMemo(
    () => buildSettingsPageElements(language, choiceColor, choiceTextColor),
    [choiceColor, choiceTextColor, language],
  );
  const archivePageElements =
    settings.archivePageElements && settings.archivePageElements.length > 0
      ? settings.archivePageElements
      : defaultArchivePageElements;
  const settingsPageElements =
    settings.settingsPageElements && settings.settingsPageElements.length > 0
      ? settings.settingsPageElements
      : defaultSettingsPageElements;
  const visibleStartMenuActionRoles = new Set(
    startMenuElements
      .filter((element) => element.kind === 'button' && element.visible !== false && element.role)
      .map((element) => element.role),
  );
  const testStartMenuElements =
    previewMode === 'test'
      ? [
          ...startMenuElements,
          ...defaultStartMenuElements
            .filter(
              (element) =>
                element.kind === 'button' &&
                element.role &&
                startMenuActionMap.has(element.role) &&
                !visibleStartMenuActionRoles.has(element.role),
            )
            .map((element) => ({ ...element, id: `system-${element.id}` })),
        ]
      : startMenuElements;
  const startMenuPlacementBounds = React.useMemo(
    () => getStartMenuPlacementBounds(settings),
    [settings],
  );
  const getStartMenuSnapGuides = React.useCallback(
    (axis: 'x' | 'y', movingId: string, bounds: typeof startMenuPlacementBounds) => {
      const min = axis === 'x' ? bounds.minX : bounds.minY;
      const max = axis === 'x' ? bounds.maxX : bounds.maxY;
      const guides =
        settings.startMenuPlacementBoundsLocked && min >= 0 && max <= 100
          ? [min, min + (max - min) / 2, max, 50]
          : [50];
      startMenuElements.forEach((element) => {
        if (element.id === movingId || !element.visible) return;
        const start = axis === 'x' ? element.x : element.y;
        const size = axis === 'x' ? element.width : element.height;
        guides.push(start, start + size / 2, start + size);
      });
      return guides;
    },
    [settings.startMenuPlacementBoundsLocked, startMenuElements],
  );
  const commitStartMenuElements = React.useCallback(
    (next: StartMenuElement[]) => onUpdateSettings('startMenuElements', next),
    [onUpdateSettings],
  );
  const updateStartMenuElement = React.useCallback(
    (id: string, patch: Partial<StartMenuElement>) => {
      const source =
        settings.startMenuElements && settings.startMenuElements.length > 0
          ? settings.startMenuElements
          : defaultStartMenuElements;
      commitStartMenuElements(
        source.map((element) => (element.id === id ? { ...element, ...patch } : element)),
      );
    },
    [commitStartMenuElements, defaultStartMenuElements, settings.startMenuElements],
  );
  const beginStartMenuBoundsDrag = (
    event: React.PointerEvent<HTMLElement>,
    type: 'move' | 'resize',
    resizeHandle?: StartMenuResizeHandle,
  ) => {
    if (previewMode !== 'edit' || settings.startMenuPlacementBoundsLocked) return;
    const parentRect = startMenuEditorRef.current?.parentElement?.getBoundingClientRect();
    const rect = parentRect || startMenuEditorRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedStartMenuElementId(null);
    startMenuBoundsDragRef.current = {
      type,
      resizeHandle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      rect,
      initial: {
        minX: settings.startMenuPlacementMinX ?? 10,
        minY: settings.startMenuPlacementMinY ?? 10,
        maxX: settings.startMenuPlacementMaxX ?? 90,
        maxY: settings.startMenuPlacementMaxY ?? 90,
      },
    };
    document.body.style.cursor =
      type === 'resize' && resizeHandle ? resizeCursorByHandle[resizeHandle] : 'grabbing';
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const updateStartMenuBoundsDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = startMenuBoundsDragRef.current;
    if (!drag) return false;
    const dx = ((event.clientX - drag.startClientX) / drag.rect.width) * 100;
    const dy = ((event.clientY - drag.startClientY) / drag.rect.height) * 100;
    let minX = drag.initial.minX;
    let minY = drag.initial.minY;
    let maxX = drag.initial.maxX;
    let maxY = drag.initial.maxY;
    if (drag.type === 'move') {
      const width = maxX - minX;
      const height = maxY - minY;
      minX = Math.max(0, Math.min(100 - width, minX + dx));
      minY = Math.max(0, Math.min(100 - height, minY + dy));
      maxX = minX + width;
      maxY = minY + height;
    } else {
      const handle = drag.resizeHandle || 'se';
      if (handle.includes('w')) minX += dx;
      if (handle.includes('e')) maxX += dx;
      if (handle.includes('n')) minY += dy;
      if (handle.includes('s')) maxY += dy;
      minX = Math.max(0, Math.min(maxX - 6, minX));
      minY = Math.max(0, Math.min(maxY - 4, minY));
      maxX = Math.min(100, Math.max(minX + 6, maxX));
      maxY = Math.min(100, Math.max(minY + 4, maxY));
    }
    const nextMinX = Math.round(minX);
    const nextMinY = Math.round(minY);
    const nextMaxX = Math.round(maxX);
    const nextMaxY = Math.round(maxY);

    onUpdateSettings('startMenuPlacementMinX', nextMinX);
    onUpdateSettings('startMenuPlacementMinY', nextMinY);
    onUpdateSettings('startMenuPlacementMaxX', nextMaxX);
    onUpdateSettings('startMenuPlacementMaxY', nextMaxY);

    const pushElementsIntoBounds = (currentElements: StartMenuElement[]) =>
      currentElements.map((element) => {
        const newWidth = Math.max(6, Math.min(element.width, nextMaxX - nextMinX));
        const newHeight = Math.max(4, Math.min(element.height, nextMaxY - nextMinY));
        const newX = Math.max(nextMinX, Math.min(nextMaxX - newWidth, element.x));
        const newY = Math.max(nextMinY, Math.min(nextMaxY - newHeight, element.y));
        return {
          ...element,
          x: Number(newX.toFixed(2)),
          y: Number(newY.toFixed(2)),
          width: Number(newWidth.toFixed(2)),
          height: Number(newHeight.toFixed(2)),
        };
      });

    onUpdateSettings(
      'startMenuElements',
      pushElementsIntoBounds(
        settings.startMenuElements && settings.startMenuElements.length > 0
          ? settings.startMenuElements
          : defaultStartMenuElements,
      ),
    );

    return true;
  };
  const beginStartMenuEditDrag = (
    event: React.PointerEvent<HTMLElement>,
    element: StartMenuElement,
    type: 'move' | 'resize' | 'rotate',
    resizeHandle?: StartMenuResizeHandle,
  ) => {
    if (previewMode !== 'edit') return;
    const rect = startMenuEditorRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    if (!settings.startMenuElements?.length) commitStartMenuElements(defaultStartMenuElements);
    setSelectedStartMenuElementId(element.id);
    const centerX = rect.left + ((element.x + element.width / 2) / 100) * rect.width;
    const centerY = rect.top + ((element.y + element.height / 2) / 100) * rect.height;
    startMenuEditDragRef.current = {
      type,
      id: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initial: element,
      rect,
      resizeHandle,
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI),
    };
    document.body.style.cursor =
      type === 'resize' && resizeHandle
        ? resizeCursorByHandle[resizeHandle]
        : type === 'rotate'
          ? 'alias'
          : 'grabbing';
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleStartMenuEditPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (updateStartMenuBoundsDrag(event)) return;
    const drag = startMenuEditDragRef.current;
    if (!drag) return;
    const dx = ((event.clientX - drag.startClientX) / drag.rect.width) * 100;
    const dy = ((event.clientY - drag.startClientY) / drag.rect.height) * 100;
    const bounds = startMenuPlacementBounds;
    if (drag.type === 'move') {
      const snapped = snapStartMenuBox({
        x: drag.initial.x + dx,
        y: drag.initial.y + dy,
        width: drag.initial.width,
        height: drag.initial.height,
        rect: drag.rect,
        xGuides: getStartMenuSnapGuides('x', drag.id, bounds),
        yGuides: getStartMenuSnapGuides('y', drag.id, bounds),
      });
      updateStartMenuElement(drag.id, {
        x: Math.max(bounds.minX, Math.min(bounds.maxX - drag.initial.width, snapped.x)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY - drag.initial.height, snapped.y)),
      });
    } else if (drag.type === 'resize') {
      const handle = drag.resizeHandle || 'se';
      let nextX = drag.initial.x;
      let nextY = drag.initial.y;
      let nextWidth = drag.initial.width;
      let nextHeight = drag.initial.height;
      if (handle.includes('e')) nextWidth = drag.initial.width + dx;
      if (handle.includes('s')) nextHeight = drag.initial.height + dy;
      if (handle.includes('w')) {
        nextX = drag.initial.x + dx;
        nextWidth = drag.initial.width - dx;
      }
      if (handle.includes('n')) {
        nextY = drag.initial.y + dy;
        nextHeight = drag.initial.height - dy;
      }
      if (nextWidth < 6) {
        if (handle.includes('w')) nextX = drag.initial.x + drag.initial.width - 6;
        nextWidth = 6;
      }
      if (nextHeight < 4) {
        if (handle.includes('n')) nextY = drag.initial.y + drag.initial.height - 4;
        nextHeight = 4;
      }
      const xGuides = getStartMenuSnapGuides('x', drag.id, bounds);
      const yGuides = getStartMenuSnapGuides('y', drag.id, bounds);
      const toleranceX = (2 / drag.rect.width) * 100;
      const toleranceY = (2 / drag.rect.height) * 100;
      if (handle.includes('e')) {
        const snappedRight = snapStartMenuValue(nextX + nextWidth, xGuides, toleranceX);
        nextWidth += snappedRight - (nextX + nextWidth);
      }
      if (handle.includes('w')) {
        const snappedLeft = snapStartMenuValue(nextX, xGuides, toleranceX);
        nextWidth += nextX - snappedLeft;
        nextX = snappedLeft;
      }
      if (handle.includes('s')) {
        const snappedBottom = snapStartMenuValue(nextY + nextHeight, yGuides, toleranceY);
        nextHeight += snappedBottom - (nextY + nextHeight);
      }
      if (handle.includes('n')) {
        const snappedTop = snapStartMenuValue(nextY, yGuides, toleranceY);
        nextHeight += nextY - snappedTop;
        nextY = snappedTop;
      }
      if (nextWidth < 6) {
        if (handle.includes('w')) nextX = drag.initial.x + drag.initial.width - 6;
        nextWidth = 6;
      }
      if (nextHeight < 4) {
        if (handle.includes('n')) nextY = drag.initial.y + drag.initial.height - 4;
        nextHeight = 4;
      }
      nextX = Math.max(bounds.minX, Math.min(bounds.maxX - nextWidth, nextX));
      nextY = Math.max(bounds.minY, Math.min(bounds.maxY - nextHeight, nextY));
      updateStartMenuElement(drag.id, {
        x: nextX,
        y: nextY,
        width: Math.max(6, Math.min(bounds.maxX - nextX, nextWidth)),
        height: Math.max(4, Math.min(bounds.maxY - nextY, nextHeight)),
      });
    } else if (
      drag.centerX !== undefined &&
      drag.centerY !== undefined &&
      drag.startAngle !== undefined
    ) {
      const angle =
        Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX) * (180 / Math.PI);
      const rawRotation = drag.initial.rotation + angle - drag.startAngle;
      const nextRotation =
        event.shiftKey || event.ctrlKey ? Math.round(rawRotation / 5) * 5 : Math.round(rawRotation);
      updateStartMenuElement(drag.id, {
        rotation: nextRotation,
      });
    }
  };
  const stopStartMenuEditDrag = () => {
    startMenuEditDragRef.current = null;
    startMenuBoundsDragRef.current = null;
    document.body.style.cursor = '';
  };
  const startMenuBackgroundStyle: React.CSSProperties | undefined =
    settings.startMenuBackgroundType === 'image' && settings.startMenuBackgroundImageUrl
      ? {
          backgroundImage: `linear-gradient(180deg,rgba(4,8,14,0.28),rgba(4,8,14,0.72)),url("${settings.startMenuBackgroundImageUrl.replace(/"/g, '\\"')}")`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }
      : settings.startMenuBackgroundType === 'gradient'
        ? {
            background: `linear-gradient(${settings.startMenuBackgroundGradientAngle}deg, ${settings.startMenuBackgroundGradientStart}, ${settings.startMenuBackgroundGradientEnd})`,
          }
        : settings.startMenuBackgroundType === 'solid'
          ? { background: settings.startMenuBackgroundColor }
          : undefined;

  const renderStartMenuPreview = () => {
    if (!settings.showStartMenu || !previewStartMenuOpen) return null;
    const selectedGuideElement = startMenuElements.find(
      (element) => element.id === selectedStartMenuElementId,
    );
    const selectedGuideBounds = selectedGuideElement ? startMenuPlacementBounds : null;

    const boundsMinX = settings.startMenuPlacementMinX ?? 10;
    const boundsMinY = settings.startMenuPlacementMinY ?? 10;
    const boundsMaxX = settings.startMenuPlacementMaxX ?? 90;
    const boundsMaxY = settings.startMenuPlacementMaxY ?? 90;

    return (
      <div
        className={`absolute inset-0 z-40 grid text-white ${startMenuButtonPositionClass} ${startMenuBackgroundClass}`}
        style={startMenuBackgroundStyle}
        onPointerMove={handleStartMenuEditPointerMove}
        onPointerUp={stopStartMenuEditDrag}
        onPointerCancel={stopStartMenuEditDrag}
        onClick={() => {
          if (previewMode === 'edit') setSelectedStartMenuElementId(null);
        }}
      >
        {settings.startMenuBackgroundMusicUrl && (
          <audio
            ref={startMenuAudioRef}
            src={settings.startMenuBackgroundMusicUrl}
            preload="auto"
            loop
            className="hidden"
          />
        )}
        <div
          ref={startMenuEditorRef}
          className={`absolute overflow-hidden ${startMenuPanelSurfaceClass} ${
            previewMode === 'edit' && selectedStartMenuElementId === null
              ? 'pointer-events-none'
              : ''
          }`}
          style={{
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            zIndex: 20,
          }}
          onPointerMove={handleStartMenuEditPointerMove}
          onPointerUp={stopStartMenuEditDrag}
          onPointerCancel={stopStartMenuEditDrag}
          onClick={(event) => {
            if (previewMode === 'edit') {
              event.stopPropagation();
              setSelectedStartMenuElementId(null);
            }
          }}
        >
          {previewMode === 'edit' && (
            <div className="pointer-events-none absolute inset-0 text-[9px] font-black text-white/55">
              <div className="absolute left-1/2 top-0 h-full border-l border-cyan-300/35" />
              <div className="absolute left-0 top-1/2 w-full border-t border-cyan-300/35" />
              {selectedGuideBounds &&
                settings.startMenuPlacementBoundsLocked &&
                selectedGuideElement?.kind !== 'button' && (
                  <div
                    className="absolute border border-dashed border-amber-300/70 bg-amber-300/[0.04]"
                    style={{
                      left: `${selectedGuideBounds.minX}%`,
                      top: `${selectedGuideBounds.minY}%`,
                      width: `${selectedGuideBounds.maxX - selectedGuideBounds.minX}%`,
                      height: `${selectedGuideBounds.maxY - selectedGuideBounds.minY}%`,
                    }}
                  />
                )}
              {selectedGuideElement && (
                <>
                  <div
                    className="absolute top-0 h-full border-l border-sky-300/55"
                    style={{ left: `${selectedGuideElement.x}%` }}
                  />
                  <div
                    className="absolute top-0 h-full border-l border-sky-300/35"
                    style={{ left: `${selectedGuideElement.x + selectedGuideElement.width / 2}%` }}
                  />
                  <div
                    className="absolute top-0 h-full border-l border-sky-300/55"
                    style={{ left: `${selectedGuideElement.x + selectedGuideElement.width}%` }}
                  />
                  <div
                    className="absolute left-0 w-full border-t border-sky-300/55"
                    style={{ top: `${selectedGuideElement.y}%` }}
                  />
                  <div
                    className="absolute left-0 w-full border-t border-sky-300/35"
                    style={{ top: `${selectedGuideElement.y + selectedGuideElement.height / 2}%` }}
                  />
                  <div
                    className="absolute left-0 w-full border-t border-sky-300/55"
                    style={{ top: `${selectedGuideElement.y + selectedGuideElement.height}%` }}
                  />
                </>
              )}
            </div>
          )}

          {settings.startMenuTemplate !== 'minimal' && !settings.startMenuElements?.length && (
            <div
              className="absolute h-[68px] w-[68px] rounded-[18px] shadow-2xl shadow-black/30 bg-[radial-gradient(circle_at_42%_32%,rgba(255,255,255,0.78),transparent_18%),linear-gradient(135deg,var(--preview-choice-color,#0ea5e9),#0f172a)]"
              style={
                {
                  '--preview-choice-color': choiceColor,
                  left:
                    settings.startMenuButtonPosition === 'center'
                      ? 'calc(50% - 34px)'
                      : `${defaultButtonX}%`,
                  top: settings.startMenuButtonPosition === 'center' ? '16%' : '36%',
                } as React.CSSProperties
              }
            />
          )}
          {testStartMenuElements.map((element) => (
            <WebPlaytestStartMenuElement
              key={element.id}
              element={element}
              selected={selectedStartMenuElementId === element.id}
              action={
                element.kind === 'button' && element.role
                  ? startMenuActionMap.get(element.role) || null
                  : null
              }
              previewMode={previewMode}
              editingStartMenuElementId={editingStartMenuElementId}
              hasCustomStartMenuElements={Boolean(settings.startMenuElements?.length)}
              settings={settings}
              choiceColor={choiceColor}
              choiceTextColor={choiceTextColor}
              t={t}
              onEnsureStartMenuElements={() => commitStartMenuElements(defaultStartMenuElements)}
              onSelectElement={setSelectedStartMenuElementId}
              onSetEditingElement={setEditingStartMenuElementId}
              onUpdateElement={updateStartMenuElement}
              onDeleteElement={onDeleteStartMenuElement}
              onBeginDrag={beginStartMenuEditDrag}
            />
          ))}
        </div>
        {previewMode === 'edit' && (
          <div
            className={`absolute z-10 border-[2.5px] border-dashed shadow-[0_0_0_1px_rgba(0,0,0,0.12)] ${
              settings.startMenuPlacementBoundsLocked ? 'border-slate-400/65' : 'border-white/60'
            } ${
              selectedStartMenuElementId === null && !settings.startMenuPlacementBoundsLocked
                ? 'cursor-grab active:cursor-grabbing pointer-events-auto'
                : selectedStartMenuElementId === null
                  ? 'pointer-events-auto'
                  : 'pointer-events-none'
            }`}
            style={{
              left: `${boundsMinX}%`,
              top: `${boundsMinY}%`,
              width: `${boundsMaxX - boundsMinX}%`,
              height: `${boundsMaxY - boundsMinY}%`,
            }}
            onPointerDown={(event) => {
              if (selectedStartMenuElementId === null && !settings.startMenuPlacementBoundsLocked) {
                beginStartMenuBoundsDrag(event, 'move');
              }
            }}
            onClick={(event) => event.stopPropagation()}
            title={t('文字/图片范围', 'テキスト/画像範囲', 'Text/image bounds')}
          >
            {selectedStartMenuElementId === null && (
              <button
                type="button"
                className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full border shadow transition-colors pointer-events-auto border-white/35 bg-slate-950/70 text-white hover:bg-slate-900"
                style={{
                  borderColor: settings.startMenuPlacementBoundsLocked
                    ? 'var(--vr-accent)'
                    : undefined,
                  backgroundColor: settings.startMenuPlacementBoundsLocked
                    ? 'var(--vr-accent)'
                    : undefined,
                  color: settings.startMenuPlacementBoundsLocked ? '#ffffff' : undefined,
                  zIndex: 30,
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onUpdateSettings(
                    'startMenuPlacementBoundsLocked',
                    !settings.startMenuPlacementBoundsLocked,
                  );
                }}
                title={t(
                  '锁定文字/图片范围',
                  'テキスト/画像範囲をロック',
                  'Lock text/image bounds',
                )}
                aria-label={t(
                  '锁定文字/图片范围',
                  'テキスト/画像範囲をロック',
                  'Lock text/image bounds',
                )}
              >
                {settings.startMenuPlacementBoundsLocked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {selectedStartMenuElementId === null &&
              !settings.startMenuPlacementBoundsLocked &&
              (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as StartMenuResizeHandle[]).map(
                (handle) => (
                  <button
                    key={handle}
                    type="button"
                    className={`absolute border bg-white shadow pointer-events-auto ${
                      settings.startMenuPlacementBoundsLocked ? 'border-amber-200' : 'border-white'
                    } ${resizeHandlePositionClass[handle]} ${resizeHandleShapeClass[handle]}`}
                    style={{
                      ...getResizeHandleStyle(handle),
                      zIndex: 30,
                    }}
                    onPointerDown={(event) => beginStartMenuBoundsDrag(event, 'resize', handle)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={t('调整范围', '範囲を調整', 'Resize bounds')}
                  />
                ),
              )}
          </div>
        )}
        <WebPreviewMenuPages
          language={language}
          settings={settings}
          previewMode={previewMode}
          selectedStartMenuElementId={selectedStartMenuElementId}
          archiveOpen={previewArchiveOpen}
          settingsOpen={previewStartSettingsOpen}
          backgroundClass={startMenuBackgroundClass}
          backgroundStyle={startMenuBackgroundStyle}
          boundsMinX={boundsMinX}
          boundsMinY={boundsMinY}
          boundsMaxX={boundsMaxX}
          boundsMaxY={boundsMaxY}
          archiveElements={archivePageElements}
          settingsElements={settingsPageElements}
          choiceColor={choiceColor}
          choiceTextColor={choiceTextColor}
          previewControlsHidden={previewControlsHidden}
          onCloseArchive={() => setPreviewArchiveOpen(false)}
          onCloseSettings={() => setPreviewStartSettingsOpen(false)}
          onNewGame={() => {
            reset();
            setPreviewArchiveOpen(false);
            setPreviewStartMenuOpen(false);
          }}
          onToggleControls={() => setPreviewControlsHidden((current) => !current)}
          onSelectElement={setSelectedStartMenuElementId}
          onUpdateArchiveElement={(id, patch) => {
            const source = settings.archivePageElements?.length
              ? settings.archivePageElements
              : defaultArchivePageElements;
            onUpdateSettings(
              'archivePageElements',
              source.map((element) => (element.id === id ? { ...element, ...patch } : element)),
            );
          }}
          onUpdateSettingsElement={(id, patch) => {
            const source = settings.settingsPageElements?.length
              ? settings.settingsPageElements
              : defaultSettingsPageElements;
            onUpdateSettings(
              'settingsPageElements',
              source.map((element) => (element.id === id ? { ...element, ...patch } : element)),
            );
          }}
          onBeginBoundsDrag={beginStartMenuBoundsDrag}
          onUpdateSettings={onUpdateSettings}
        />
      </div>
    );
  };

  const renderChoiceButtons = (extraClass = '') => {
    if (!shouldShowChoices) return null;
    if (outEdges.length === 0) {
      return (
        <div className={`grid gap-2 ${extraClass}`}>
          <ChoiceButton
            label={t('剧本结束', 'シナリオ終了', 'The End')}
            choiceColor={choiceColor}
            choiceTextColor={choiceTextColor}
            onClick={() => handleChoiceClick('THE_END')}
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
              onClick={() => handleChoiceClick(edge.target)}
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
        {settings.showStartMenu && (
          <button
            type="button"
            onClick={returnToStartMenu}
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

  const renderAudioPlaylistModal = () => (
    <AudioPlaylistModal
      open={showAudioPlaylist}
      items={playedAudios}
      activeUrl={playlistAudioUrl}
      isPlaying={isPlaylistAudioPlaying}
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
      onClose={() => setShowAudioPlaylist(false)}
      onToggleAudio={togglePlaylistAudio}
    />
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
        {renderAudioPlaylistModal()}
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

  if (currentNode?.type === 'numberConditionNode') return null;

  const sceneMotion = presentationExiting ? presentation.scene?.exit : presentation.scene?.enter;
  const sceneAnimationActive =
    settings.layoutMode === 'immersive' && (presentationExiting || !presentationVisible);
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
  const sceneObjectFit =
    presentation.scene?.cropMode === 'contain'
      ? 'contain'
      : presentation.scene?.cropMode === 'stretch'
        ? 'fill'
        : 'cover';
  const finalObjectFit =
    settings.layoutMode === 'immersive' || settings.layoutMode === 'classic'
      ? 'cover'
      : presentation.scene?.cropMode
        ? sceneObjectFit
        : 'contain';
  const sceneStyle: React.CSSProperties = {
    objectFit: finalObjectFit as any,
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
    transitionDuration: activeSceneInlineAction
      ? `${sceneInlineDuration}ms`
      : settings.layoutMode === 'classic'
        ? '0ms'
        : `${sceneMotion?.type === 'none' ? 0 : sceneMotion?.duration || 0}ms`,
    transitionDelay:
      settings.layoutMode === 'classic' || !presentationExiting
        ? '0ms'
        : `${getSceneExitDelay(presentation)}ms`,
    transitionTimingFunction: 'ease-out',
  };

  const renderMediaLayers = () => (
    <div className="absolute inset-0 overflow-hidden">
      {currentImageUrl ? (
        <img
          key={`${currentNodeId}-${currentImageUrl}-${settings.layoutMode}`}
          src={currentImageUrl}
          alt=""
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          className="preview-media-safe h-full w-full"
          style={sceneStyle}
        />
      ) : currentVideoUrl ? (
        <video
          ref={currentVideoRef}
          src={currentVideoUrl}
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
            'This node has no image or video',
            'This node has no image or video',
            'This node has no image or video',
          )}
        </div>
      )}
      {presentedCharacters.length > 0 && (
        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
          {presentedCharacters.map(({ config, data, imageUrl }) => {
            const motion = presentationExiting ? config.exit : config.enter;
            const animationActive =
              settings.layoutMode === 'immersive' && (presentationExiting || !presentationVisible);
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
                  transitionDuration: inlineAction
                    ? `${inlineDuration}ms`
                    : settings.layoutMode === 'classic'
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
  );

  return (
    <div
      ref={previewRootRef}
      className="relative h-full min-h-[320px] overflow-hidden rounded-lg border border-white/10 bg-slate-950 text-white shadow-sm"
    >
      <style>
        {`@keyframes webPreviewFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes webPreviewSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}
      </style>
      {currentImageUrl && settings.layoutMode === 'immersive' && (
        <div
          className={`absolute inset-0 bg-cover bg-center opacity-35 scale-105 ${settings.blurBackground ? 'blur-sm' : ''}`}
          style={{ backgroundImage: `url("${currentImageUrl.replace(/"/g, '\\"')}")` }}
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
        {renderAudioPlaylistModal()}
        <div
          className={
            settings.layoutMode === 'immersive' ? 'absolute inset-0 p-0' : 'min-h-0 px-4 pt-4'
          }
        >
          <div
            className={`flex h-full min-h-0 items-center justify-center overflow-hidden relative ${
              settings.layoutMode === 'immersive'
                ? 'rounded-none'
                : 'rounded-t-lg border-x border-t border-white/10 bg-slate-950'
            }`}
            onClick={continueFromText}
          >
            {settings.layoutMode === 'classic' ? (
              <VirtualPresentationStage fit="cover" className="absolute inset-0 h-full w-full">
                {renderMediaLayers()}
              </VirtualPresentationStage>
            ) : (
              <div className="absolute inset-0 overflow-hidden">
                {currentImageUrl ? (
                  <img
                    key={`${currentNodeId}-${currentImageUrl}-${settings.layoutMode}`}
                    src={currentImageUrl}
                    alt=""
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    className="preview-media-safe h-full w-full"
                    style={sceneStyle}
                  />
                ) : currentVideoUrl ? (
                  <video
                    ref={currentVideoRef}
                    src={currentVideoUrl}
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
                      const inlineAction =
                        activeInlineAction?.kind === 'character' &&
                        activeInlineAction.sourceNodeId === config.sourceNodeId
                          ? activeInlineAction
                          : latestPersistentInlineAction(
                              completedInlineActions,
                              'character',
                              config.sourceNodeId,
                            );
                      const inlineDuration = inlineAction
                        ? Math.max(80, inlineAction.duration || 300)
                        : 0;
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
                            transitionDuration: inlineAction
                              ? `${inlineDuration}ms`
                              : settings.layoutMode === 'classic'
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
              ? 'pointer-events-none absolute z-20 flex items-end justify-center'
              : 'relative'
          }`}
          style={{
            width:
              settings.layoutMode === 'immersive'
                ? `min(${renderStyle.dialogWidth}%, calc(100% - 24px))`
                : `${renderStyle.dialogWidth}%`,
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
            ref={dialogueBoxRef}
            className={`pointer-events-auto relative w-full border-t border-white/10 py-4 ${
              settings.layoutMode === 'immersive'
                ? 'overflow-y-auto rounded-xl border border-white/12 shadow-2xl shadow-black/30 backdrop-blur-xl'
                : 'rounded-b-lg border-x border-b border-white/10 px-4 shadow-2xl shadow-black/20 backdrop-blur-xl'
            }`}
            style={dialogueShellStyle}
          >
            {renderNameplates()}
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
                    <span
                      className="absolute inset-0 block whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: displayedPreviewText || '' }}
                    />
                  </>
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: displayedPreviewText || '' }} />
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
        </div>
        <ControlsToggle
          label={controlsLabel}
          hidden={previewControlsHidden}
          onClick={() => setPreviewControlsHidden((prev) => !prev)}
          positionClass={
            settings.layoutMode === 'immersive'
              ? 'absolute pointer-events-auto'
              : 'absolute bottom-3 right-3'
          }
          style={controlsToggleStyle}
        />
      </div>
      {renderStartMenuPreview()}
    </div>
  );
}
