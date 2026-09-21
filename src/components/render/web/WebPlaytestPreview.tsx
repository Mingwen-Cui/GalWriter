import { resolveSettingsPageElements } from './webMenuPageElements';
import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import {
  Eye,
  EyeOff,
  House,
  History,
  Play,
  Pause,
  Settings,
  ListMusic,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { appearanceStyle } from '../shared/paint/appearanceStyle';
import { SurfaceLayers } from '../shared/paint/SurfaceLayers';

import type {
  CharacterNodeData,
  CharacterPresentation,
  InlinePresentationAction,
  SceneNodeData,
  StoryPresentation,
} from '../../../domain/project';
import { resolveKnownAppAssetUrl } from '../../../lib/appAssets';
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
  getPresentationExitDuration,
  getPresentationTransform,
  getSceneExitDelay,
  normalizeStoryPresentation,
} from '../../../lib/presentation';
import { getSceneVisualMediaStyle } from '../../../lib/sceneVisualStyle';
import { useRegionBackgroundMusic } from '../../../lib/useRegionBackgroundMusic';
import { useSceneAmbientSound } from '../../../lib/useSceneAmbientSound';
import { VirtualPresentationStage } from '../../VirtualPresentationStage';
import { getSceneBackgroundStyle, mergeSceneMediaStyle } from '../canvas/sceneCanvasStyle';
import { getNameplateItems } from '../video/shared/nameplateRenderer';
import { getRenderObjects, updateRenderObject } from '../video/shared/renderObjects';
import {
  filterMentionTags,
  getNodeDisplayText,
  getNodeDisplayTitle,
  stripHtml,
} from '../video/shared/storyNodes';
import type {
  RenderEditableObjectKind,
  RenderStyle,
  WebExportSettings,
  WebMenuElement,
} from '../video/shared/types';
import { formatWebText } from './i18n';
import { getSurfaceBackground } from './StartMenuBackgroundInspector';
import type { WebAlignmentGuideLine } from './webElementAlignmentGuides';
import {
  snapElementBoxToElementGuides,
  snapResizeBoxToElementGuides,
} from './webElementAlignmentGuides';
import { buildRehearsalToolbarElements, resolveWebToolbarElements } from './webExperienceTemplates';
import {
  getActiveWebSaveSlot,
  readWebSaveCollection,
  removeWebSaveSlot,
  upsertWebSaveSlot,
  type WebSaveCollection,
  type WebSaveSlot,
  writeWebSaveCollection,
} from './webExport/webSaveSlots';
import { gradientFromStops, normalizeGradientStops } from './webGradientStops';
import { buildArchivePageElements } from './webMenuPageElements';
import { WebPlaytestDialoguePanel } from './WebPlaytestDialoguePanel';
import { WebPlaytestMediaLayers } from './WebPlaytestMediaLayers';
import { WebPlaytestNameplates } from './WebPlaytestNameplates';
import type { PlayedAudio } from './WebPlaytestPreviewControls';
import {
  ChoiceButtonsGroup,
  PreviewAudioPlaylistModal,
  PreviewFloatingElementLayer,
  PreviewToolbar,
} from './WebPlaytestPreviewControls';
import { WebPlaytestStartMenuElement } from './WebPlaytestStartMenuElement';
import {
  WebStoryFlowGraph,
  type WebStoryFlowGraphControls,
  type WebStoryFlowGraphSnapshot,
} from './WebStoryFlowGraph';
import { InteractiveSegmentMinimap } from '../video/interactive/InteractiveSegmentMinimap';
import type {
  StartMenuAction,
  StartMenuElement,
  StartMenuResizeHandle,
} from './webPlaytestStartMenuTools';
import {
  buildDefaultStartMenuElements,
  getStartMenuPlacementBounds,
  resizeCursorByHandle,
} from './webPlaytestStartMenuTools';
import { buildDialogueShellStyle } from './webPlaytestStyleTools';
import { WebPreviewMenuPages } from './WebPreviewMenuPages';
import { type SplitEditorSelection, WebSplitLayoutEditor } from './WebSplitLayoutEditor';

import { WebDialogueHistory, WebStoryEnding, WebPlaybackSettings } from './WebPlaybackDialogs';
import type { PlayerSettingsValues } from './playerSettingsPanel';
import { playbackSettingButtonRoles } from './playerSettingsPanelConfig';
import { WEB_PLAYBACK_UI_CSS, webStoryTitle, webToolbarButtonLabel } from './webPlaybackUi';
import { arrangeToolbarRow, toolbarRowGap } from './webToolbarLayout';

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
  imageCropEditingElementId?: string | null;
  gradientEditingSurface?: WebPreviewSurface | null;
  gradientEditingElement?: { id: string; group: 'text' | 'fill' | 'stroke' } | null;
  onSurfaceChange?: (surface: WebPreviewSurface) => void;
  onSelectStartMenuElement?: (id: string | null) => void;
  onSelectStartMenuElements?: (ids: string[]) => void;
  onSelectFlowCard?: (id: string | null) => void;
  onDeleteStartMenuElement?: (id: string) => void;
  onUpdateSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
  onUpdateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  selectedCanvasObject?: 'scene' | 'background';
  onSelectCanvasObject?: (selection: 'scene' | 'background' | RenderEditableObjectKind) => void;
  testAction?: WebPlaytestTestAction | null;
  onTestStateChange?: (state: WebPlaytestTestState) => void;
  showTestDebugInfo?: boolean;
};

export type WebPreviewSurface = 'start' | 'archive' | 'settings' | 'flow' | 'game';

export type WebPlaytestTestState = {
  currentNodeId: string | null;
  currentNodeTitle: string;
  currentNodeType: string;
  entryCount: number;
  path: Array<{ id: string; title: string; type: string }>;
  nodeValues: Array<{ id: string; title: string; value: number }>;
  conditionResult: { total: number; label: string } | null;
  saves: Array<{ id: string; savedAt: number; title: string }>;
};

export type WebPlaytestTestAction =
  | { id: number; type: 'restart' | 'clearSaves' }
  | { id: number; type: 'jump'; nodeId: string };

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
  imageCropEditingElementId = null,
  gradientEditingSurface = null,
  gradientEditingElement = null,
  onSurfaceChange,
  onSelectStartMenuElement,
  onSelectStartMenuElements,
  onSelectFlowCard,
  onDeleteStartMenuElement,
  onUpdateSettings,
  onUpdateRenderStyle: _onUpdateRenderStyle,
  selectedCanvasObject,
  onSelectCanvasObject,
  testAction = null,
  onTestStateChange,
  showTestDebugInfo = false,
}: WebPlaytestPreviewProps) {
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
  const [playbackSettingsButton, setPlaybackSettingsButton] = useState<WebMenuElement | null>(null);
  const playbackSettingsValues: PlayerSettingsValues = {
    autoAdvance: settings.autoAdvance,
    interactionMode: settings.interactionMode,
    typewriterSpeed: settings.typewriterSpeed,
    textScale: settings.textScale,
    animationSpeed: settings.animationSpeed,
    soundEnabled: settings.soundEnabled,
    controlsVisible: true,
  };
  const playbackSettingsDefaults = useRef(playbackSettingsValues);
  const [showDialogueHistory, setShowDialogueHistory] = useState(false);
  const [endingDismissed, setEndingDismissed] = useState(false);
  const endingImageRef = useRef('');
  const [history, setHistory] = useState<string[]>([]);
  const [conditionResult, setConditionResult] = useState<{ total: number; label: string } | null>(
    null,
  );
  const [previewSaves, setPreviewSaves] = useState<WebSaveCollection | null>(null);
  const [activePreviewSaveId, setActivePreviewSaveId] = useState<string | null>(null);
  const [previewGameStarted, setPreviewGameStarted] = useState(!settings.showStartMenu);
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
  const [flowOverviewOpen, setFlowOverviewOpen] = useState(false);
  const [flowActiveBranchLabel, setFlowActiveBranchLabel] = useState('');
  const [flowGraphSnapshot, setFlowGraphSnapshot] = useState<WebStoryFlowGraphSnapshot | null>(
    null,
  );
  // The editor's surface picker is controlled by the workspace. Do not let a
  // transient runtime page state hide that surface while applying a preset.
  const controlledEditSurface =
    previewMode === 'edit' && (settings.showStartMenu || requestedSurface === 'flow')
      ? requestedSurface
      : undefined;
  const isPreviewFlowOverviewOpen = controlledEditSurface
    ? controlledEditSurface === 'flow'
    : flowOverviewOpen;
  const isPreviewStartMenuOpen = controlledEditSurface
    ? controlledEditSurface !== 'game' && controlledEditSurface !== 'flow'
    : previewStartMenuOpen && !flowOverviewOpen;
  const isPreviewStartSettingsOpen = controlledEditSurface
    ? controlledEditSurface === 'settings'
    : previewStartSettingsOpen;
  const isPreviewArchiveOpen = controlledEditSurface
    ? controlledEditSurface === 'archive'
    : previewArchiveOpen;
  const [displayedPreviewText, setDisplayedPreviewText] = useState('');
  const previewRootRef = useRef<HTMLDivElement>(null);
  const dialogueBoxRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement>(null);
  const currentVideoRef = useRef<HTMLVideoElement>(null);
  const playlistAudioRef = useRef<HTMLAudioElement>(null);
  const startMenuAudioRef = useRef<HTMLAudioElement>(null);
  const flowGraphControlsRef = useRef<WebStoryFlowGraphControls | null>(null);
  const startMenuAudioFadeFrameRef = useRef<number | null>(null);
  const startMenuEditorRef = useRef<HTMLDivElement>(null);
  const startMenuEditDragRef = useRef<{
    pointerId: number;
    type: 'move' | 'resize' | 'rotate';
    resizeHandle?: StartMenuResizeHandle;
    id: string;
    startClientX: number;
    startClientY: number;
    initial: StartMenuElement;
    groupInitial?: StartMenuElement[];
    groupIds?: string[];
    rect: DOMRect;
    centerX?: number;
    centerY?: number;
    startAngle?: number;
  } | null>(null);
  const startMenuMarqueeRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    rect: DOMRect;
  } | null>(null);
  const startMenuMarqueeBoxRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const imagePreloadRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [localSelectedStartMenuElementId, setLocalSelectedStartMenuElementId] = useState<
    string | null
  >(null);
  const [editingStartMenuElementId, setEditingStartMenuElementId] = useState<string | null>(null);
  const [selectedStartMenuElementIds, setSelectedStartMenuElementIds] = useState<string[]>([]);
  const [startMenuMarqueeBox, setStartMenuMarqueeBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [activeStartMenuGuideLines, setActiveStartMenuGuideLines] = useState<
    WebAlignmentGuideLine[]
  >([]);
  const selectedStartMenuElementId =
    controlledSelectedStartMenuElementId !== undefined
      ? controlledSelectedStartMenuElementId
      : localSelectedStartMenuElementId;
  const setSelectedStartMenuElementId = React.useCallback(
    (id: string | null) => {
      setLocalSelectedStartMenuElementId(id);
      setSelectedStartMenuElementIds(id ? [id] : []);
      if (id) _onUpdateRenderStyle('selectedRenderObject', undefined);
      onSelectStartMenuElement?.(id);
    },
    [_onUpdateRenderStyle, onSelectStartMenuElement],
  );
  const selectRenderObject = React.useCallback(
    (kind: RenderEditableObjectKind) => {
      setSelectedStartMenuElementId(null);
      _onUpdateRenderStyle('selectedRenderObject', kind);
      onSelectCanvasObject?.(kind);
    },
    [_onUpdateRenderStyle, onSelectCanvasObject, setSelectedStartMenuElementId],
  );
  const moveRenderObject = React.useCallback(
    (kind: RenderEditableObjectKind, x: number, y: number) => {
      const nextObjects = updateRenderObject(renderStyle, kind, {
        x: Math.round(x),
        y: Math.round(y),
      });
      _onUpdateRenderStyle('renderObjects', nextObjects);
    },
    [_onUpdateRenderStyle, renderStyle],
  );
  const patchRenderObject = React.useCallback(
    (kind: RenderEditableObjectKind, patch: Parameters<typeof updateRenderObject>[2]) => {
      const nextObjects = updateRenderObject(renderStyle, kind, patch);
      _onUpdateRenderStyle('renderObjects', nextObjects);
    },
    [_onUpdateRenderStyle, renderStyle],
  );
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
    const fadeAudio = (from: number, to: number, seconds: number, done?: () => void) => {
      if (startMenuAudioFadeFrameRef.current !== null) {
        window.cancelAnimationFrame(startMenuAudioFadeFrameRef.current);
      }
      const duration = Math.max(0, Number(seconds) || 0) * 1000;
      if (!duration) {
        audio.volume = to;
        done?.();
        return;
      }
      const started = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / duration);
        audio.volume = from + (to - from) * progress;
        if (progress < 1) startMenuAudioFadeFrameRef.current = window.requestAnimationFrame(tick);
        else done?.();
      };
      startMenuAudioFadeFrameRef.current = window.requestAnimationFrame(tick);
    };
    const isFlowMusic = isPreviewFlowOverviewOpen;
    const musicUrl = isFlowMusic
      ? settings.flowOverviewBackgroundMusicUrl
      : settings.startMenuBackgroundMusicUrl;
    const musicVolume = isFlowMusic
      ? settings.flowOverviewMusicVolume
      : settings.startMenuMusicVolume;
    const musicFadeIn = isFlowMusic
      ? settings.flowOverviewMusicFadeIn
      : settings.startMenuMusicFadeIn;
    const musicFadeOut = isFlowMusic
      ? settings.flowOverviewMusicFadeOut
      : settings.startMenuMusicFadeOut;
    const musicLoop = isFlowMusic ? settings.flowOverviewMusicLoop : settings.startMenuMusicLoop;
    const targetVolume = Math.max(0, Math.min(1, (musicVolume ?? 70) / 100));
    const overlayStopsMusic =
      (isPreviewArchiveOpen && !settings.startMenuMusicApplyToArchive) ||
      (isPreviewStartSettingsOpen && !settings.startMenuMusicApplyToSettings);
    if ((isPreviewStartMenuOpen || isFlowMusic) && musicUrl && !overlayStopsMusic) {
      audio.loop = musicLoop !== false;
      audio.volume = Number(musicFadeIn) > 0 ? 0 : targetVolume;
      audio.play().catch(() => undefined);
      fadeAudio(audio.volume, targetVolume, musicFadeIn);
      return;
    }
    fadeAudio(audio.volume, 0, musicFadeOut, () => audio.pause());
  }, [
    isPreviewArchiveOpen,
    isPreviewFlowOverviewOpen,
    isPreviewStartMenuOpen,
    isPreviewStartSettingsOpen,
    settings.flowOverviewBackgroundMusicUrl,
    settings.flowOverviewMusicFadeIn,
    settings.flowOverviewMusicFadeOut,
    settings.flowOverviewMusicLoop,
    settings.flowOverviewMusicVolume,
    settings.startMenuBackgroundMusicUrl,
    settings.startMenuMusicApplyToArchive,
    settings.startMenuMusicApplyToSettings,
    settings.startMenuMusicFadeIn,
    settings.startMenuMusicFadeOut,
    settings.startMenuMusicLoop,
    settings.startMenuMusicVolume,
  ]);

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

  const animationRate = Math.max(0.5, Math.min(2, settings.animationSpeed ?? 1));
  const textScale = Math.max(0.7, Math.min(1.4, (settings.textScale ?? 100) / 100));
  const dialogueShellStyle = buildDialogueShellStyle(
    renderStyle,
    settings.canvasWidth,
    settings.canvasHeight,
  );
  const renderObjects = getRenderObjects(renderStyle);
  const dialogWidth = Math.max(0, Math.min(100, renderObjects.dialogBox.width || 86));

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

  const previousPreviewMode = useRef(previewMode);
  React.useEffect(() => {
    if (settings.showStartMenu) return;
    setPreviewStartMenuOpen(false);
    setPreviewStartSettingsOpen(false);
    setPreviewArchiveOpen(false);
    setFlowOverviewOpen(false);
    setPreviewGameStarted(true);
  }, [settings.showStartMenu]);
  React.useLayoutEffect(() => {
    const enteringTest = previewMode === 'test' && previousPreviewMode.current !== 'test';
    previousPreviewMode.current = previewMode;
    if (!enteringTest) return;
    const surface = settings.showStartMenu ? requestedSurface || 'start' : 'game';
    setPreviewStartMenuOpen(surface !== 'game' && surface !== 'flow');
    setPreviewStartSettingsOpen(surface === 'settings');
    setPreviewArchiveOpen(surface === 'archive');
    setFlowOverviewOpen(surface === 'flow');
    setPreviewGameStarted(surface === 'game');
  }, [previewMode, requestedSurface, settings.showStartMenu]);

  React.useEffect(() => {
    if (
      previewMode !== 'edit' ||
      (!settings.showStartMenu && requestedSurface !== 'flow') ||
      !requestedSurface
    )
      return;

    if (requestedSurface === 'game') {
      setPreviewGameStarted(true);
      setPreviewStartSettingsOpen(false);
      setPreviewArchiveOpen(false);
      setFlowOverviewOpen(false);
      setPreviewStartMenuOpen(false);
      return;
    }

    if (requestedSurface === 'flow') {
      setPreviewGameStarted(false);
      setPreviewStartSettingsOpen(false);
      setPreviewArchiveOpen(false);
      setFlowOverviewOpen(true);
      setPreviewStartMenuOpen(false);
      return;
    }

    setPreviewGameStarted(false);
    setFlowOverviewOpen(false);
    setPreviewStartMenuOpen(true);
    setPreviewStartSettingsOpen(requestedSurface === 'settings');
    setPreviewArchiveOpen(requestedSurface === 'archive');
  }, [previewMode, requestedSurface, settings.showStartMenu]);

  React.useEffect(() => {
    const surface: WebPreviewSurface = isPreviewFlowOverviewOpen
      ? 'flow'
      : isPreviewStartMenuOpen
        ? isPreviewStartSettingsOpen
          ? 'settings'
          : isPreviewArchiveOpen
            ? 'archive'
            : 'start'
        : 'game';
    onSurfaceChange?.(surface);
  }, [
    isPreviewArchiveOpen,
    isPreviewFlowOverviewOpen,
    isPreviewStartMenuOpen,
    isPreviewStartSettingsOpen,
    onSurfaceChange,
  ]);

  const currentNode =
    currentNodeId && currentNodeId !== 'THE_END'
      ? runtimeNodes.find((node) => node.id === currentNodeId)
      : null;
  const storySurfaceActive =
    !isPreviewStartMenuOpen &&
    !isPreviewStartSettingsOpen &&
    !isPreviewArchiveOpen &&
    !isPreviewFlowOverviewOpen &&
    (previewMode === 'edit' || previewGameStarted);
  const storyPlaybackActive =
    storySurfaceActive && !showDialogueHistory && !showAudioPlaylist && !playbackSettingsButton;
  const playbackPausedRef = useRef(!storyPlaybackActive);
  playbackPausedRef.current = !storyPlaybackActive;
  const lastMediaNodeRef = useRef<string | null>(null);
  React.useEffect(() => {
    if (storyPlaybackActive || !storySurfaceActive) return;
    const animations = new Set<Animation>();
    previewRootRef.current
      ?.querySelectorAll('[data-story-visual], [data-dialogue-box]')
      .forEach((element) => {
        element.getAnimations({ subtree: true }).forEach((animation) => {
          if (animation.playState === 'running') {
            animations.add(animation);
            animation.pause();
          }
        });
      });
    return () =>
      animations.forEach((animation) => {
        if (animation.playState === 'paused') animation.play();
      });
  }, [storyPlaybackActive, storySurfaceActive]);
  useRegionBackgroundMusic(
    nodes,
    storyPlaybackActive ? currentNode : null,
    storyPlaybackActive && currentNodeId !== 'THE_END',
    !settings.soundEnabled,
  );
  useSceneAmbientSound(
    nodes,
    storyPlaybackActive ? currentNode : null,
    storyPlaybackActive && currentNodeId !== 'THE_END',
    !settings.soundEnabled,
  );
  const outEdges = currentNodeId ? edges.filter((edge) => edge.source === currentNodeId) : [];
  const imageUrl = typeof currentNode?.data?.imageUrl === 'string' ? currentNode.data.imageUrl : '';
  const videoUrl = typeof currentNode?.data?.videoUrl === 'string' ? currentNode.data.videoUrl : '';
  const audioUrl = typeof currentNode?.data?.audioUrl === 'string' ? currentNode.data.audioUrl : '';
  const audioTitle =
    webStoryTitle(getNodeDisplayTitle(currentNode)) ||
    stripHtml(getNodeDisplayText(currentNode)).trim().replace(/\s+/g, ' ').slice(0, 42) ||
    formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText498');
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
  const activeSceneSwitchTransition =
    activeInlineAction?.kind === 'scene' &&
    activeInlineAction.action === 'switch' &&
    activeInlineAction.sourceNodeId === presentation.scene?.sourceNodeId
      ? activeInlineAction
      : null;
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
  const sceneSwitchMedia = activeSceneSwitchTransition
    ? resolveSceneMedia({
        data: sceneData,
        scene: presentation.scene,
        fallbackImageUrl: imageUrl,
        fallbackVideoUrl: videoUrl,
        switchAction: activeSceneSwitchTransition,
      })
    : null;
  const sceneSwitchImageUrl = sceneSwitchMedia?.videoUrl ? '' : sceneSwitchMedia?.imageUrl || '';
  const sceneSwitchDurationMs = activeSceneSwitchTransition
    ? Math.max(
        180,
        (activeSceneSwitchTransition.duration || 420) / Math.max(0.5, settings.animationSpeed ?? 1),
      )
    : undefined;

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
  React.useEffect(() => {
    if (currentNodeId !== 'THE_END') {
      endingImageRef.current = currentImageUrl;
      setEndingDismissed(false);
    }
  }, [currentImageUrl, currentNodeId]);
  const rawText = getNodeDisplayText(currentNode);
  const text = filterMentionTags(rawText, true, true);
  const shouldHideSingleChoice = settings.skipSingleChoicePopup && outEdges.length <= 1;
  const shouldShowChoices = !shouldHideSingleChoice && (animationDone || !settings.autoAdvance);
  const canClickContinue = outEdges.length <= 1;
  // A card title doubles as the label of a branch target, so playback visibility
  // must be separate from the stored title text.
  const hideCenteredTitle = currentNode?.data?.hideTitleInPlayback === true;
  const nameplateItems = useMemo(
    () => (currentNode ? getNameplateItems(currentNode, nodes) : []),
    [currentNode, nodes],
  );

  const renderNameplates = (
    onGuideLinesChange?: (lines: WebAlignmentGuideLine[]) => void,
    selectedRenderObjectKinds?: RenderEditableObjectKind[],
  ) => (
    <WebPlaytestNameplates
      items={nameplateItems}
      renderStyle={renderStyle}
      dialogWidth={dialogWidth}
      previewMode={previewMode}
      onSelectRenderObject={selectRenderObject}
      onMoveRenderObject={moveRenderObject}
      onUpdateRenderObject={patchRenderObject}
      onGuideLinesChange={onGuideLinesChange}
      selectedRenderObjectKinds={selectedRenderObjectKinds}
    />
  );

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
    if (!storyPlaybackActive) {
      if (!storySurfaceActive) restartPlaybackSession();
      currentAudioRef.current?.pause();
      currentVideoRef.current?.pause();
      return;
    }
    const nodeChanged = lastMediaNodeRef.current !== currentNodeId;
    lastMediaNodeRef.current = currentNodeId;
    if (storyPlaybackActive && audioUrl && currentAudioRef.current) {
      if (nodeChanged) currentAudioRef.current.currentTime = 0;
      currentAudioRef.current.play().catch(() => {
        // Browser autoplay policies may require the first playback to be user initiated.
      });
    }
    if (storyPlaybackActive && settings.autoAdvance && currentVideoUrl && currentVideoRef.current) {
      if (nodeChanged) currentVideoRef.current.currentTime = 0;
      currentVideoRef.current.play().catch(() => {});
    }
  }, [
    audioUrl,
    currentNodeId,
    currentVideoUrl,
    settings.autoAdvance,
    storyPlaybackActive,
    storySurfaceActive,
    restartPlaybackSession,
  ]);

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
    const exitDuration =
      getPresentationExitDuration(presentation) / Math.max(0.5, settings.animationSpeed ?? 1);
    const sessionId = playbackSessionRef.current;
    setPresentationExiting(true);
    const completeTransition = () => {
      if (sessionId !== playbackSessionRef.current) return;
      if (playbackPausedRef.current) {
        transitionTimerRef.current = window.setTimeout(completeTransition, 32);
        return;
      }
      transitionTimerRef.current = null;
      if (currentNodeId) setHistory((prev) => [...prev, currentNodeId]);
      setCurrentNodeId(targetId);
    };
    transitionTimerRef.current = window.setTimeout(completeTransition, exitDuration);
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
    if (!storySurfaceActive) {
      setDisplayedPreviewText(text);
      setAnimationDone(false);
      return;
    }
    const scheduleStep = (callback: () => void, delay: number) => {
      let remaining = delay;
      let previous = performance.now();
      const tick = () => {
        const now = performance.now();
        if (!playbackPausedRef.current) remaining -= now - previous;
        previous = now;
        if (remaining <= 0 && !playbackPausedRef.current) callback();
        else inlineActionTimerRef.current = window.setTimeout(tick, 32);
      };
      return window.setTimeout(tick, Math.min(32, Math.max(0, delay)));
    };
    if (settings.interactionMode !== 'typewriter') {
      const playbackSteps = buildInlinePlaybackSteps(rawText, presentation, {
        hideCharacterTags: settings.hideCharacterTags,
        hideSceneTags: settings.hideSceneTags,
      });
      const switchActions = playbackSteps
        .filter(
          (step): step is { kind: 'action'; action: InlinePresentationAction } =>
            step.kind === 'action',
        )
        .map((step) => step.action)
        .filter((action) => action.action === 'switch' && Boolean(action.targetAssetId));
      setCompletedInlineActions(
        playbackSteps
          .filter(
            (step): step is { kind: 'action'; action: InlinePresentationAction } =>
              step.kind === 'action',
          )
          .map((step) => step.action)
          .filter(
            (action) =>
              (isPersistentInlineAction(action) && action.action !== 'switch') ||
              Boolean(action.timelinePhase),
          ),
      );
      setDisplayedPreviewText(text);
      if (!switchActions.length) {
        setAnimationDone(true);
        return;
      }

      setAnimationDone(false);
      const playSwitch = (index: number) => {
        const action = switchActions[index];
        if (!action) {
          setActiveInlineAction(null);
          setAnimationDone(true);
          return;
        }
        setActiveInlineAction(action);
        const duration =
          Math.max(180, action.duration || 420) / Math.max(0.5, settings.animationSpeed ?? 1);
        inlineActionTimerRef.current = scheduleStep(() => {
          setActiveInlineAction(null);
          setCompletedSwitchActions((previous) => [...previous, action]);
          setCompletedInlineActions((previous) => [...previous, action]);
          playSwitch(index + 1);
        }, duration);
      };
      playSwitch(0);
      return () => {
        if (inlineActionTimerRef.current) window.clearTimeout(inlineActionTimerRef.current);
      };
    }
    setAnimationDone(false);
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
        inlineActionTimerRef.current = scheduleStep(
          () => {
            setActiveInlineAction(null);
            if (step.action.action === 'switch' && step.action.targetAssetId) {
              setCompletedSwitchActions((previous) => [...previous, step.action]);
            }
            if (isPersistentInlineAction(step.action) || step.action.timelinePhase) {
              setCompletedInlineActions((previous) => [...previous, step.action]);
            }
            stepIndex += 1;
            playNext();
          },
          Math.max(0, step.action.duration || 0) / Math.max(0.5, settings.animationSpeed ?? 1),
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
        if (playbackPausedRef.current) return;
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
    storySurfaceActive,
    currentNodeId,
    presentation,
    renderStyle.bodyTypewriterMode,
    settings.interactionMode,
    settings.hideCharacterTags,
    settings.hideSceneTags,
    settings.animationSpeed,
    settings.typewriterSpeed,
    rawText,
    text,
  ]);

  React.useEffect(() => {
    if (
      !storyPlaybackActive ||
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
    storyPlaybackActive,
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
      !storyPlaybackActive ||
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
      setConditionResult({
        total: sum,
        label: matchedRange
          ? `${matchedRange.min}–${matchedRange.max}`
          : sum >= threshold
            ? `≥ ${threshold}`
            : `< ${threshold}`,
      });
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
  }, [currentNodeId, edges, history, runtimeNodes, storyPlaybackActive]);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsPreviewFullscreen(Boolean(document.fullscreenElement?.contains(previewRootRef.current)));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  React.useEffect(() => {
    if (previewMode !== 'test') return;
    const nodeIds = new Set(runtimeNodes.map((node) => node.id));
    const collection = readWebSaveCollection(projectTitle, nodeIds);
    setPreviewSaves(collection);
    setActivePreviewSaveId(collection?.activeSlotId || null);
  }, [previewMode, projectTitle, runtimeNodes]);

  const savePreviewProgress = () => {
    if (
      previewMode !== 'test' ||
      !previewGameStarted ||
      !currentNodeId ||
      currentNodeId === 'THE_END'
    )
      return;
    const now = Date.now();
    const existing = getActiveWebSaveSlot(previewSaves);
    const slot: WebSaveSlot = {
      id: activePreviewSaveId || `save-${now}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: existing?.createdAt || now,
      savedAt: now,
      currentId: currentNodeId,
      history,
      settings: {
        autoAdvance: settings.autoAdvance,
        typewriterSpeed: settings.typewriterSpeed,
        textScale: settings.textScale,
        animationSpeed: settings.animationSpeed,
        soundEnabled: settings.soundEnabled,
      },
      controlsHidden: previewControlsHidden,
      playedAudios: playedAudios.map((audio) => audio.url),
    };
    const next = upsertWebSaveSlot(previewSaves, slot);
    setPreviewSaves(next);
    setActivePreviewSaveId(slot.id);
    writeWebSaveCollection(projectTitle, next);
  };

  const continuePreviewSave = () => {
    const save = getActiveWebSaveSlot(previewSaves);
    if (
      !save ||
      save.currentId === 'THE_END' ||
      !runtimeNodes.some((node) => node.id === save.currentId)
    )
      return;
    setCurrentNodeId(save.currentId);
    setHistory(save.history);
    onUpdateSettings('autoAdvance', save.settings.autoAdvance);
    onUpdateSettings('typewriterSpeed', save.settings.typewriterSpeed);
    onUpdateSettings('textScale', save.settings.textScale);
    onUpdateSettings('animationSpeed', save.settings.animationSpeed);
    onUpdateSettings('soundEnabled', save.settings.soundEnabled);
    setPreviewControlsHidden(save.controlsHidden);
    setActivePreviewSaveId(save.id);
    setPreviewGameStarted(true);
    setPreviewStartMenuOpen(false);
    setPreviewArchiveOpen(false);
  };

  const continueFromText = () => {
    if (!storyPlaybackActive || currentNodeId === 'THE_END' || !currentNode) return;
    autoAdvanceHoldNodeRef.current = null;
    if (!canClickContinue) return;
    goTo(outEdges[0]?.target || 'THE_END');
  };

  const reset = () => {
    setEndingDismissed(false);
    setShowDialogueHistory(false);
    setPlayedAudios([]);
    setPlaylistAudioUrl(null);
    restartPlaybackSession();
    autoAdvanceHoldNodeRef.current = root?.id || null;
    setHistory([]);
    setConditionResult(null);
    setCurrentNodeId(root?.id || null);
  };

  const consumedTestActionId = useRef<number | null>(null);
  React.useEffect(() => {
    if (!testAction || previewMode !== 'test' || consumedTestActionId.current === testAction.id)
      return;
    consumedTestActionId.current = testAction.id;
    if (testAction.type === 'restart') {
      reset();
      return;
    }
    if (testAction.type === 'jump') {
      if (!runtimeNodes.some((node) => node.id === testAction.nodeId)) return;
      restartPlaybackSession();
      autoAdvanceHoldNodeRef.current = testAction.nodeId;
      setHistory([]);
      setConditionResult(null);
      setCurrentNodeId(testAction.nodeId);
      setPreviewGameStarted(true);
      setPreviewStartMenuOpen(false);
      setPreviewArchiveOpen(false);
      return;
    }
    const empty: WebSaveCollection = { version: 2, activeSlotId: null, slots: [] };
    setPreviewSaves(empty);
    setActivePreviewSaveId(null);
    writeWebSaveCollection(projectTitle, empty);
  }, [previewMode, projectTitle, restartPlaybackSession, runtimeNodes, testAction]);

  React.useEffect(() => {
    if (previewMode !== 'test' || !onTestStateChange) return;
    const titleFor = (nodeId: string) => {
      const node = runtimeNodes.find((item) => item.id === nodeId);
      return (
        getNodeDisplayTitle(node) ||
        stripHtml(getNodeDisplayText(node)).trim().slice(0, 32) ||
        nodeId
      );
    };
    const pathIds = [...history, ...(currentNodeId ? [currentNodeId] : [])];
    onTestStateChange({
      currentNodeId,
      currentNodeTitle: currentNode
        ? titleFor(currentNode.id)
        : formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText1010'),
      currentNodeType: currentNode?.type || 'end',
      entryCount: pathIds.filter((id) => id === currentNodeId).length,
      path: pathIds.map((id) => {
        const node = runtimeNodes.find((item) => item.id === id);
        return { id, title: titleFor(id), type: node?.type || 'end' };
      }),
      nodeValues: history.flatMap((id) => {
        const node = runtimeNodes.find((item) => item.id === id);
        const value = node?.data?.nodeValue;
        return typeof value === 'number' && Number.isFinite(value)
          ? [{ id, title: titleFor(id), value }]
          : [];
      }),
      conditionResult,
      saves: (previewSaves?.slots || []).map((slot) => ({
        id: slot.id,
        savedAt: slot.savedAt,
        title: titleFor(slot.currentId),
      })),
    });
  }, [
    conditionResult,
    currentNode,
    currentNodeId,
    history,
    onTestStateChange,
    previewMode,
    previewSaves,
    runtimeNodes,
    language,
  ]);

  const startPreviewNewGame = () => {
    if (!root) return;
    const now = Date.now();
    setActivePreviewSaveId(`save-${now}-${Math.random().toString(36).slice(2, 8)}`);
    setPreviewGameStarted(true);
    setPreviewStartMenuOpen(false);
    setPreviewArchiveOpen(false);
    setFlowOverviewOpen(false);
    reset();
  };

  const startPreviewFromNode = (nodeId: string) => {
    const target = runtimeNodes.find((node) => node.id === nodeId);
    if (!target) return;
    restartPlaybackSession();
    setHistory([]);
    setCurrentNodeId(target.id);
    setEndingDismissed(false);
    setPreviewGameStarted(true);
    setPreviewStartMenuOpen(false);
    setPreviewStartSettingsOpen(false);
    setPreviewArchiveOpen(false);
    setFlowOverviewOpen(false);
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
    savePreviewProgress();
    restartPlaybackSession();
    currentAudioRef.current?.pause();
    currentVideoRef.current?.pause();
    setShowAudioPlaylist(false);
    setShowDialogueHistory(false);
    playlistAudioRef.current?.pause();
    setPreviewGameStarted(false);
    setPreviewStartSettingsOpen(false);
    setPreviewArchiveOpen(false);
    setFlowOverviewOpen(false);
    setPreviewStartMenuOpen(true);
  };

  const togglePreviewFullscreen = async () => {
    const previewRoot = previewRootRef.current;
    if (!previewRoot) return;
    const fullscreenHost =
      previewRoot.closest<HTMLElement>('[data-virtual-presentation-host]') || previewRoot;
    try {
      if (document.fullscreenElement === fullscreenHost) {
        await document.exitFullscreen();
        return;
      }
      await fullscreenHost.requestFullscreen();
    } catch (fullscreenError) {
      console.warn('Could not toggle web preview fullscreen:', fullscreenError);
    }
  };

  const openExternalLink = (element: WebMenuElement) => {
    const url = element.linkUrl?.trim();
    if (!url || !/^(https?:|mailto:|tel:)/i.test(url)) return;
    window.open(url, element.linkTarget || '_blank', 'noopener,noreferrer');
  };
  const applySharedButtonFunction = (element: WebMenuElement) => {
    if (element.id === 'toolbar-auto' && element.role === 'auto') {
      autoAdvanceHoldNodeRef.current = null;
      onUpdateSettings('autoAdvance', !settings.autoAdvance);
      return true;
    }
    if (!isPreviewStartMenuOpen && playbackSettingButtonRoles.includes(element.role || '')) {
      setShowAudioPlaylist(false);
      setShowDialogueHistory(false);
      playlistAudioRef.current?.pause();
      setPlaybackSettingsButton(element);
      return true;
    }
    if (element.role === 'link') {
      openExternalLink(element);
      return true;
    }
    if (element.role === 'volume') {
      onUpdateSettings(
        'startMenuMusicVolume',
        Math.max(0, Math.min(100, element.actionValue ?? 70)),
      );
      return true;
    }
    if (element.role === 'speed') {
      onUpdateSettings('typewriterSpeed', Math.max(10, Math.min(200, element.actionValue ?? 65)));
      return true;
    }
    if (element.role === 'textSize') {
      onUpdateSettings('textScale', Math.max(85, Math.min(130, element.actionValue ?? 100)));
      return true;
    }
    if (element.role === 'animationSpeed') {
      onUpdateSettings('animationSpeed', Math.max(0.5, Math.min(2, element.actionValue ?? 1)));
      return true;
    }
    if (element.role === 'sound') {
      onUpdateSettings('soundEnabled', !settings.soundEnabled);
      return true;
    }
    return false;
  };

  const startMenuButtonPositionClass =
    settings.startMenuButtonPosition === 'bottomLeft'
      ? 'items-end justify-items-start text-left'
      : settings.startMenuButtonPosition === 'bottomRight'
        ? 'items-end justify-items-end text-left'
        : 'place-items-center text-center';
  const startMenuBackgroundClass =
    settings.startMenuTemplate === 'minimal'
      ? 'bg-white'
      : settings.startMenuTemplate === 'glass'
        ? 'bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(238,242,255,0.88)),radial-gradient(circle_at_18%_22%,rgba(98,91,246,0.16),transparent_34%),#ffffff]'
        : 'bg-[radial-gradient(circle_at_16%_18%,rgba(98,91,246,0.16),transparent_36%),linear-gradient(135deg,#ffffff,#eef2ff)]';
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
  const activePreviewSave = getActiveWebSaveSlot(previewSaves);
  const canContinuePreviewSave = Boolean(
    activePreviewSave &&
    activePreviewSave.currentId !== 'THE_END' &&
    runtimeNodes.some((node) => node.id === activePreviewSave.currentId),
  );
  const startMenuActions = [
    {
      key: 'flowOverview',
      label: language === 'zh' ? '流程图总览' : language === 'ja' ? 'フロー概要' : 'Flow overview',
      disabled: false,
      primary: false,
      onClick: () => setFlowOverviewOpen(true),
    },
    previewMode === 'edit' || canContinuePreviewSave
      ? {
          key: 'continue',
          label: formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText1168'),
          disabled: !canContinuePreviewSave,
          primary: true,
          onClick: continuePreviewSave,
        }
      : null,
    settings.startMenuShowSave
      ? {
          key: 'save',
          label: formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText1177'),
          disabled: false,
          primary: false,
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
          label: formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText1190'),
          disabled: false,
          primary: !settings.startMenuShowSave,
          onClick: () => {
            if (!root) return;
            startPreviewNewGame();
            setPreviewStartMenuOpen(false);
            setPreviewStartSettingsOpen(false);
            setPreviewArchiveOpen(false);
          },
        }
      : null,
    settings.startMenuShowSettings
      ? {
          key: 'settings',
          label: formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText1205'),
          disabled: !settings.showStartMenu,
          primary: false,
          onClick: () => {
            setPreviewStartSettingsOpen(true);
            setPreviewArchiveOpen(false);
          },
        }
      : null,
  ].filter((action): action is StartMenuAction => Boolean(action));
  const startMenuActionMap = new Map(startMenuActions.map((action) => [action.key, action]));
  const getStartMenuElementAction = (element: StartMenuElement): StartMenuAction | null => {
    const existing = element.role ? startMenuActionMap.get(element.role) : null;
    if (existing) return existing;
    if (isPreviewFlowOverviewOpen && element.role === 'flowDirection') {
      return {
        key: element.role,
        label:
          language === 'zh'
            ? '切换流程方向'
            : language === 'ja'
              ? 'フロー方向を切り替え'
              : 'Cycle flow direction',
        disabled: false,
        primary: false,
        onClick: () => flowGraphControlsRef.current?.cycleDirection(),
      };
    }
    if (isPreviewFlowOverviewOpen && element.role === 'flowFitView') {
      return {
        key: element.role,
        label:
          language === 'zh' ? '适应流程图' : language === 'ja' ? '全体を表示' : 'Fit flow view',
        disabled: false,
        primary: false,
        onClick: () => flowGraphControlsRef.current?.fitView(),
      };
    }
    if (element.role === 'link' || element.role === 'volume') {
      return {
        key: element.role,
        label:
          element.text ||
          (element.role === 'link'
            ? formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText1224')
            : formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText1224_2')),
        disabled: element.role === 'link' && !element.linkUrl,
        primary: false,
        onClick: () => applySharedButtonFunction(element),
      };
    }
    return null;
  };
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
        language,
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
  const configuredStartMenuElements = (settings.startMenuElements || []).filter(
    (element) =>
      element.role !== 'flowDirection' &&
      element.role !== 'flowFitView' &&
      element.role !== 'flowBranch' &&
      element.role !== 'flowMinimap',
  );
  const hasMainMenuElements = configuredStartMenuElements.some(
    (element) => element.role !== 'flowOverview',
  );
  const rawStartMenuElements = hasMainMenuElements
    ? configuredStartMenuElements.some((element) => element.role === 'flowOverview')
      ? configuredStartMenuElements
      : [
          ...configuredStartMenuElements,
          ...defaultStartMenuElements
            .filter((element) => element.role === 'flowOverview')
            .map((element) => ({ ...element, id: `system-${element.id}` })),
        ]
    : defaultStartMenuElements;
  const startMenuElements = rawStartMenuElements.map((element) =>
    element.role === 'title' || element.role === 'subtitle'
      ? { ...element, textAlign: 'left' as const }
      : element,
  );
  const flowOverviewElements = settings.flowOverviewElements || [];
  const editableSurfaceElements = isPreviewFlowOverviewOpen
    ? flowOverviewElements
    : startMenuElements;
  const commitEditableSurfaceElements = React.useCallback(
    (next: StartMenuElement[]) =>
      onUpdateSettings(
        isPreviewFlowOverviewOpen ? 'flowOverviewElements' : 'startMenuElements',
        next,
      ),
    [isPreviewFlowOverviewOpen, onUpdateSettings],
  );
  const defaultArchivePageElements = React.useMemo(
    () => buildArchivePageElements(language, choiceColor, choiceTextColor),
    [choiceColor, choiceTextColor, language],
  );

  const archivePageElements =
    settings.archivePageElements && settings.archivePageElements.length > 0
      ? settings.archivePageElements
      : defaultArchivePageElements;
  const settingsPageElements = resolveSettingsPageElements(
    settings,
    language,
    choiceColor,
    choiceTextColor,
  );
  const defaultToolbarElements = React.useMemo<StartMenuElement[]>(
    () => buildRehearsalToolbarElements(language, settings.canvasWidth, settings.canvasHeight),
    [language, settings.canvasWidth, settings.canvasHeight],
  );
  const toolbarElements = resolveWebToolbarElements(
    settings.previewToolbarElements,
    language,
    settings.canvasWidth,
    settings.canvasHeight,
  );
  const updateToolbarElement = React.useCallback(
    (id: string, patch: Partial<StartMenuElement>) => {
      const source = resolveWebToolbarElements(
        settings.previewToolbarElements,
        language,
        settings.canvasWidth,
        settings.canvasHeight,
      );
      const updated = source.map((element) =>
        element.id === id ? { ...element, ...patch } : element,
      );
      const buttons = source.filter((element) => element.kind === 'button');
      const adjustLabels = ['text', 'textVisible', 'fontSize'].some((key) => key in patch);
      onUpdateSettings(
        'previewToolbarElements',
        adjustLabels && buttons.length
          ? arrangeToolbarRow(
              updated,
              settings.canvasWidth,
              settings.canvasHeight,
              toolbarRowGap(buttons),
              Math.max(...buttons.map((element) => element.x + element.width)),
              Math.min(...buttons.map((element) => element.y)),
            )
          : updated,
      );
    },
    [
      language,
      onUpdateSettings,
      settings.previewToolbarElements,
      settings.canvasWidth,
      settings.canvasHeight,
    ],
  );
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
  const commitStartMenuElements = React.useCallback(
    (next: StartMenuElement[]) => onUpdateSettings('startMenuElements', next),
    [onUpdateSettings],
  );
  const updateStartMenuElement = React.useCallback(
    (id: string, patch: Partial<StartMenuElement>) => {
      const source = isPreviewFlowOverviewOpen ? flowOverviewElements : rawStartMenuElements;
      commitEditableSurfaceElements(
        source.map((element) => (element.id === id ? { ...element, ...patch } : element)),
      );
    },
    [
      commitEditableSurfaceElements,
      flowOverviewElements,
      isPreviewFlowOverviewOpen,
      rawStartMenuElements,
    ],
  );
  const beginStartMenuEditDrag = (
    event: React.PointerEvent<HTMLElement>,
    element: StartMenuElement,
    type: 'move' | 'resize' | 'rotate',
    resizeHandle?: StartMenuResizeHandle,
  ) => {
    if (previewMode !== 'edit') return;
    if (event.button === 2) return;
    const rect = startMenuEditorRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    const source = isPreviewFlowOverviewOpen ? flowOverviewElements : rawStartMenuElements;
    if (!isPreviewFlowOverviewOpen && !settings.startMenuElements?.length)
      commitStartMenuElements(defaultStartMenuElements);
    const shouldMoveGroup =
      type === 'move' &&
      selectedStartMenuElementIds.length > 1 &&
      selectedStartMenuElementIds.includes(element.id);
    const groupIds = shouldMoveGroup ? selectedStartMenuElementIds : [element.id];
    const groupInitial = source.filter((item) => groupIds.includes(item.id));
    if (shouldMoveGroup) {
      setLocalSelectedStartMenuElementId(element.id);
      onSelectStartMenuElement?.(element.id);
    } else {
      setSelectedStartMenuElementId(element.id);
    }
    const centerX = rect.left + ((element.x + element.width / 2) / 100) * rect.width;
    const centerY = rect.top + ((element.y + element.height / 2) / 100) * rect.height;
    startMenuEditDragRef.current = {
      pointerId: event.pointerId,
      type,
      id: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initial: element,
      groupInitial,
      groupIds,
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
    startMenuEditorRef.current?.setPointerCapture?.(event.pointerId);
  };
  const beginStartMenuMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    // Editable elements stop propagation before this empty-canvas handler.
    // Use the primary button so a normal drag box-selects and a normal empty
    // click clears selection, rather than hiding multi-select behind right
    // click.
    if (previewMode !== 'edit' || event.button !== 0) return;
    const rect = startMenuEditorRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    startMenuMarqueeRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      rect,
    };
    const nextBox = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
      width: 0,
      height: 0,
    };
    startMenuMarqueeBoxRef.current = nextBox;
    setStartMenuMarqueeBox(nextBox);
    startMenuEditorRef.current?.setPointerCapture?.(event.pointerId);
  };
  const updateStartMenuMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    const marquee = startMenuMarqueeRef.current;
    if (!marquee) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = ((marquee.startClientX - marquee.rect.left) / marquee.rect.width) * 100;
    const startY = ((marquee.startClientY - marquee.rect.top) / marquee.rect.height) * 100;
    const currentX = ((event.clientX - marquee.rect.left) / marquee.rect.width) * 100;
    const currentY = ((event.clientY - marquee.rect.top) / marquee.rect.height) * 100;
    const left = Math.max(0, Math.min(startX, currentX));
    const top = Math.max(0, Math.min(startY, currentY));
    const right = Math.min(100, Math.max(startX, currentX));
    const bottom = Math.min(100, Math.max(startY, currentY));
    const nextBox = {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
    startMenuMarqueeBoxRef.current = nextBox;
    setStartMenuMarqueeBox(nextBox);
  };
  const finishStartMenuMarquee = (event?: React.PointerEvent<HTMLDivElement>) => {
    const marquee = startMenuMarqueeRef.current;
    const box = startMenuMarqueeBoxRef.current;
    if (!marquee || !box) return;
    event?.preventDefault();
    event?.stopPropagation();
    const selectedIds = editableSurfaceElements
      .filter((element) => {
        if (!element.visible && previewMode !== 'edit') return false;
        return (
          element.x < box.x + box.width &&
          element.x + element.width > box.x &&
          element.y < box.y + box.height &&
          element.y + element.height > box.y
        );
      })
      .map((element) => element.id);
    startMenuMarqueeRef.current = null;
    startMenuMarqueeBoxRef.current = null;
    setStartMenuMarqueeBox(null);
    setSelectedStartMenuElementIds(selectedIds);
    const activeId = selectedIds[selectedIds.length - 1] || null;
    setLocalSelectedStartMenuElementId(activeId);
    onSelectStartMenuElement?.(activeId);
    onSelectStartMenuElements?.(selectedIds);
  };
  const handleStartMenuEditPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startMenuMarqueeRef.current) {
      updateStartMenuMarquee(event);
      return;
    }
    const drag = startMenuEditDragRef.current;
    if (!drag) return;
    const dx = ((event.clientX - drag.startClientX) / drag.rect.width) * 100;
    const dy = ((event.clientY - drag.startClientY) / drag.rect.height) * 100;
    const bounds = isPreviewFlowOverviewOpen
      ? { minX: 0, minY: 0, maxX: 100, maxY: 100 }
      : startMenuPlacementBounds;
    if (drag.type === 'move') {
      const groupInitial =
        drag.groupInitial && drag.groupInitial.length > 0 ? drag.groupInitial : [drag.initial];
      const snapped = snapElementBoxToElementGuides({
        x: drag.initial.x + dx,
        y: drag.initial.y + dy,
        width: drag.initial.width,
        height: drag.initial.height,
        rect: drag.rect,
        elements: editableSurfaceElements,
        movingId: drag.id,
      });
      setActiveStartMenuGuideLines(snapped.lines);
      const rawGroupDx = snapped.x - drag.initial.x;
      const rawGroupDy = snapped.y - drag.initial.y;
      const groupLeft = Math.min(...groupInitial.map((item) => item.x));
      const groupTop = Math.min(...groupInitial.map((item) => item.y));
      const groupRight = Math.max(...groupInitial.map((item) => item.x + item.width));
      const groupBottom = Math.max(...groupInitial.map((item) => item.y + item.height));
      const groupDx = Math.max(
        bounds.minX - groupLeft,
        Math.min(bounds.maxX - groupRight, rawGroupDx),
      );
      const groupDy = Math.max(
        bounds.minY - groupTop,
        Math.min(bounds.maxY - groupBottom, rawGroupDy),
      );
      const movingIds = new Set(drag.groupIds || [drag.id]);
      const initialById = new Map(groupInitial.map((item) => [item.id, item]));
      // The flow overview shares this canvas editor with the start menu.  Its
      // elements live in a separate settings array, so committing through the
      // start-menu helper made a drag appear to succeed while immediately
      // repainting the unchanged flow element.
      commitEditableSurfaceElements(
        editableSurfaceElements.map((item) =>
          movingIds.has(item.id) && initialById.has(item.id)
            ? {
                ...item,
                x: initialById.get(item.id)!.x + groupDx,
                y: initialById.get(item.id)!.y + groupDy,
              }
            : item,
        ),
      );
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
      const snapped = snapResizeBoxToElementGuides({
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
        handle,
        rect: drag.rect,
        elements: editableSurfaceElements,
        movingId: drag.id,
      });
      nextX = snapped.x;
      nextY = snapped.y;
      nextWidth = snapped.width;
      nextHeight = snapped.height;
      setActiveStartMenuGuideLines(snapped.lines);
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
      setActiveStartMenuGuideLines([]);
    }
  };
  const stopStartMenuEditDrag = () => {
    if (startMenuMarqueeRef.current) {
      finishStartMenuMarquee();
      return;
    }
    startMenuEditDragRef.current = null;
    setActiveStartMenuGuideLines([]);
    document.body.style.cursor = '';
  };

  useEffect(() => {
    if (previewMode !== 'edit') return;
    const handleDocumentPointerMove = (event: PointerEvent) => {
      if (!startMenuEditDragRef.current && !startMenuMarqueeRef.current) return;
      handleStartMenuEditPointerMove(event as unknown as React.PointerEvent<HTMLDivElement>);
    };
    const handleDocumentPointerEnd = (event: PointerEvent) => {
      const dragPointerId = startMenuEditDragRef.current?.pointerId;
      const marqueePointerId = startMenuMarqueeRef.current?.pointerId;
      if (dragPointerId !== event.pointerId && marqueePointerId !== event.pointerId) return;
      stopStartMenuEditDrag();
      if (startMenuEditorRef.current?.hasPointerCapture(event.pointerId)) {
        startMenuEditorRef.current.releasePointerCapture(event.pointerId);
      }
    };
    document.addEventListener('pointermove', handleDocumentPointerMove);
    document.addEventListener('pointerup', handleDocumentPointerEnd);
    document.addEventListener('pointercancel', handleDocumentPointerEnd);
    return () => {
      document.removeEventListener('pointermove', handleDocumentPointerMove);
      document.removeEventListener('pointerup', handleDocumentPointerEnd);
      document.removeEventListener('pointercancel', handleDocumentPointerEnd);
    };
  }, [handleStartMenuEditPointerMove, previewMode]);
  const buildSurfaceBackgroundStyle = (
    surface: 'start' | 'archive' | 'settings' | 'game' | 'flow',
  ): React.CSSProperties | undefined => {
    if (settings.surfaceAppearances?.[surface])
      return surface === 'start' || surface === 'game'
        ? { background: 'transparent' }
        : appearanceStyle(settings.surfaceAppearances[surface]!);
    const background = getSurfaceBackground(settings, surface);
    return background.type === 'video' && !background.videoUrl
      ? { backgroundColor: '#000000' }
      : background.type === 'image' && background.imageUrl
        ? {
            backgroundImage: `url("${resolveKnownAppAssetUrl(background.imageUrl).replace(/"/g, '\\"')}")`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }
        : background.type === 'gradient'
          ? {
              backgroundImage: gradientFromStops(
                background.gradientShape,
                background.gradientAngle,
                normalizeGradientStops(
                  background.gradientStops,
                  background.gradientStart,
                  background.gradientEnd,
                  '#0f172a',
                  '#0891b2',
                ),
                surface === 'start'
                  ? {
                      startX: settings.startMenuBackgroundGradientStartX,
                      startY: settings.startMenuBackgroundGradientStartY,
                      endX: settings.startMenuBackgroundGradientEndX,
                      endY: settings.startMenuBackgroundGradientEndY,
                    }
                  : {
                      startX: background.gradientStartX,
                      startY: background.gradientStartY,
                      endX: background.gradientEndX,
                      endY: background.gradientEndY,
                    },
              ),
            }
          : background.type === 'solid'
            ? { backgroundColor: background.color }
            : undefined;
  };
  const startMenuBackgroundStyle = buildSurfaceBackgroundStyle('start');
  const archiveBackgroundStyle = buildSurfaceBackgroundStyle('archive');
  const settingsBackgroundStyle = buildSurfaceBackgroundStyle('settings');
  const dialogueBackgroundStyle = buildSurfaceBackgroundStyle('game');
  const flowOverviewBackgroundStyle = buildSurfaceBackgroundStyle('flow');

  const renderStartMenuPreview = () => {
    if (!settings.showStartMenu || !isPreviewStartMenuOpen) return null;
    const boundsMinX = settings.startMenuPlacementMinX ?? 10;
    const boundsMinY = settings.startMenuPlacementMinY ?? 10;
    const boundsMaxX = settings.startMenuPlacementMaxX ?? 90;
    const boundsMaxY = settings.startMenuPlacementMaxY ?? 90;

    return (
      <div
        className={`absolute inset-0 z-40 grid text-[#252A59] ${startMenuButtonPositionClass} ${startMenuBackgroundClass}`}
        style={startMenuBackgroundStyle}
      >
        {previewMode === 'edit' && gradientEditingSurface === 'start' && (
          <GradientCanvasControl
            shape={getSurfaceBackground(settings, 'start').gradientShape}
            angle={getSurfaceBackground(settings, 'start').gradientAngle}
            startX={settings.startMenuBackgroundGradientStartX}
            startY={settings.startMenuBackgroundGradientStartY}
            endX={settings.startMenuBackgroundGradientEndX}
            endY={settings.startMenuBackgroundGradientEndY}
            onGeometryChange={(geometry) => {
              onUpdateSettings('startMenuBackgroundGradientStartX', geometry.startX);
              onUpdateSettings('startMenuBackgroundGradientStartY', geometry.startY);
              onUpdateSettings('startMenuBackgroundGradientEndX', geometry.endX);
              onUpdateSettings('startMenuBackgroundGradientEndY', geometry.endY);
              onUpdateSettings('startMenuBackgroundGradientAngle', geometry.angle);
            }}
          />
        )}
        {settings.startMenuBackgroundMusicUrl && (
          <audio
            ref={startMenuAudioRef}
            muted={!settings.soundEnabled}
            src={settings.startMenuBackgroundMusicUrl}
            preload="auto"
            loop={settings.startMenuMusicLoop !== false}
            className="hidden"
          />
        )}
        {settings.surfaceAppearances?.start && (
          <SurfaceLayers muted={!settings.soundEnabled} value={settings.surfaceAppearances.start} />
        )}
        {!settings.surfaceAppearances?.start &&
          getSurfaceBackground(settings, 'start').type === 'video' &&
          getSurfaceBackground(settings, 'start').videoUrl && (
            <video
              src={getSurfaceBackground(settings, 'start').videoUrl}
              autoPlay
              playsInline
              loop={getSurfaceBackground(settings, 'start').videoLoop}
              muted={!settings.soundEnabled || getSurfaceBackground(settings, 'start').videoMuted}
              className={`pointer-events-none absolute inset-0 h-full w-full ${getSurfaceBackground(settings, 'start').videoFit === 'fit' ? 'object-contain' : 'object-cover'}`}
            />
          )}
        <div
          ref={startMenuEditorRef}
          className={`absolute overflow-hidden ${startMenuPanelSurfaceClass}`}
          style={{
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            zIndex: 20,
          }}
          onPointerDown={beginStartMenuMarquee}
          onContextMenu={(event) => {
            if (previewMode === 'edit') event.preventDefault();
          }}
          onClick={(event) => {
            // beginStartMenuEditDrag captures the pointer on this canvas.
            // Consequently the browser may dispatch the release click here
            // rather than on the original button/text/image. Keep that click
            // inside the start-menu editor so the surrounding preview canvas
            // cannot interpret it as a background click and clear selection.
            event.stopPropagation();
          }}
        >
          {previewMode === 'edit' && activeStartMenuGuideLines.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-30">
              {activeStartMenuGuideLines.map((line, index) => (
                <div
                  key={`${line.axis}-${line.value}-${index}`}
                  className={
                    line.axis === 'x'
                      ? 'absolute top-0 h-full border-l-[1.5px] border-dashed border-[#ef4444] shadow-[0_0_5px_rgba(239,68,68,0.42)]'
                      : 'absolute left-0 w-full border-t-[1.5px] border-dashed border-[#ef4444] shadow-[0_0_5px_rgba(239,68,68,0.42)]'
                  }
                  style={line.axis === 'x' ? { left: `${line.value}%` } : { top: `${line.value}%` }}
                />
              ))}
            </div>
          )}
          {previewMode === 'edit' && startMenuMarqueeBox && (
            <div
              className="pointer-events-none absolute z-[70] border border-sky-400 bg-sky-400/14 shadow-[0_0_0_1px_rgba(14,165,233,0.24)]"
              style={{
                left: `${startMenuMarqueeBox.x}%`,
                top: `${startMenuMarqueeBox.y}%`,
                width: `${startMenuMarqueeBox.width}%`,
                height: `${startMenuMarqueeBox.height}%`,
              }}
            />
          )}

          {testStartMenuElements.map((element) => (
            <WebPlaytestStartMenuElement
              key={element.id}
              element={element}
              selected={
                selectedStartMenuElementId === element.id ||
                selectedStartMenuElementIds.includes(element.id)
              }
              gradientEditing={
                gradientEditingElement?.id === element.id ? gradientEditingElement.group : null
              }
              imageCropEditing={imageCropEditingElementId === element.id}
              action={element.kind === 'button' ? getStartMenuElementAction(element) : null}
              previewMode={previewMode}
              editingStartMenuElementId={editingStartMenuElementId}
              hasCustomStartMenuElements={Boolean(settings.startMenuElements?.length)}
              settings={settings}
              choiceColor={choiceColor}
              choiceTextColor={choiceTextColor}
              language={language}
              onEnsureStartMenuElements={() => commitStartMenuElements(defaultStartMenuElements)}
              onSelectElement={setSelectedStartMenuElementId}
              onSetEditingElement={setEditingStartMenuElementId}
              onUpdateElement={updateStartMenuElement}
              onDeleteElement={onDeleteStartMenuElement}
              onBeginDrag={beginStartMenuEditDrag}
            />
          ))}
        </div>
        <WebPreviewMenuPages
          language={language}
          settings={settings}
          previewMode={previewMode}
          selectedStartMenuElementId={selectedStartMenuElementId}
          archiveOpen={isPreviewArchiveOpen}
          settingsOpen={isPreviewStartSettingsOpen}
          backgroundClass={startMenuBackgroundClass}
          archiveBackgroundStyle={archiveBackgroundStyle}
          settingsBackgroundStyle={settingsBackgroundStyle}
          boundsMinX={boundsMinX}
          boundsMinY={boundsMinY}
          boundsMaxX={boundsMaxX}
          boundsMaxY={boundsMaxY}
          archiveElements={archivePageElements}
          settingsElements={settingsPageElements}
          choiceColor={choiceColor}
          choiceTextColor={choiceTextColor}
          previewControlsHidden={previewControlsHidden}
          gradientEditingSurface={
            gradientEditingSurface === 'archive' || gradientEditingSurface === 'settings'
              ? gradientEditingSurface
              : null
          }
          gradientEditingElement={gradientEditingElement}
          onCloseArchive={() => setPreviewArchiveOpen(false)}
          onCloseSettings={() => setPreviewStartSettingsOpen(false)}
          onOpenSettings={() => {
            setPreviewArchiveOpen(false);
            setPreviewStartSettingsOpen(true);
          }}
          onNewGame={() => {
            if (!root) return;
            startPreviewNewGame();
            setPreviewArchiveOpen(false);
            setPreviewStartMenuOpen(false);
          }}
          saveSlots={previewSaves?.slots || []}
          onContinueSave={(slot) => {
            setCurrentNodeId(slot.currentId);
            setHistory(slot.history);
            setPreviewControlsHidden(slot.controlsHidden);
            setActivePreviewSaveId(slot.id);
            setPreviewArchiveOpen(false);
            setPreviewStartMenuOpen(false);
          }}
          onDeleteSave={(slotId) => {
            if (!previewSaves) return;
            const next = removeWebSaveSlot(previewSaves, slotId);
            setPreviewSaves(next);
            setActivePreviewSaveId(next.activeSlotId);
            writeWebSaveCollection(projectTitle, next);
          }}
          onToggleControls={() => setPreviewControlsHidden((current) => !current)}
          onButtonFunction={(element) => applySharedButtonFunction(element)}
          onSelectElement={setSelectedStartMenuElementId}
          onSelectElements={onSelectStartMenuElements}
          onUpdateArchiveElement={(id, patch) => {
            const source = settings.archivePageElements?.length
              ? settings.archivePageElements
              : defaultArchivePageElements;
            onUpdateSettings(
              'archivePageElements',
              source.map((element) => (element.id === id ? { ...element, ...patch } : element)),
            );
          }}
          onUpdateArchiveElements={(elements) => {
            onUpdateSettings('archivePageElements', elements);
          }}
          onUpdateSettingsElement={(id, patch) => {
            const source = settingsPageElements;
            onUpdateSettings(
              'settingsPageElements',
              source.map((element) => (element.id === id ? { ...element, ...patch } : element)),
            );
          }}
          onUpdateSettingsElements={(elements) => {
            onUpdateSettings('settingsPageElements', elements);
          }}
          onDeletePageElement={(page, id) => onDeleteStartMenuElement?.(`${page}:${id}`)}
          onUpdateSettings={onUpdateSettings}
        />
      </div>
    );
  };

  const renderFlowOverviewPreview = () => {
    if (!isPreviewFlowOverviewOpen) return null;
    const background = getSurfaceBackground(settings, 'flow');
    const flowMinimapElement = flowOverviewElements.find(
      (element) => element.role === 'flowMinimap',
    );
    const flowMinimap =
      flowGraphSnapshot && flowMinimapElement ? (
        <InteractiveSegmentMinimap
          language={language}
          ariaLabel={
            language === 'zh'
              ? '网页流程图导航'
              : language === 'ja'
                ? 'Webフローのナビゲーション'
                : 'Web flow navigation'
          }
          segments={flowGraphSnapshot.segments}
          graphLinks={flowGraphSnapshot.graphLinks}
          layoutDirection={flowGraphSnapshot.layoutDirection}
          renderPositions={flowGraphSnapshot.renderPositions}
          activeSegmentId={flowGraphSnapshot.activeSegmentId}
          graphWidth={flowGraphSnapshot.graphWidth}
          graphHeight={flowGraphSnapshot.graphHeight}
          cardWidth={208}
          cardHeight={132}
          cardSizes={flowGraphSnapshot.cardSizes}
          viewportPan={flowGraphSnapshot.viewportPan}
          viewportZoom={flowGraphSnapshot.viewportZoom}
          viewportSize={flowGraphSnapshot.viewportSize}
          lineOpacity={flowGraphSnapshot.lineOpacity}
          canZoomIn={flowGraphSnapshot.viewportZoom < 1.85}
          canZoomOut={flowGraphSnapshot.viewportZoom > 0.35}
          onViewportPanChange={flowGraphSnapshot.onViewportPanChange}
          onZoomIn={flowGraphSnapshot.onZoomIn}
          onZoomOut={flowGraphSnapshot.onZoomOut}
          onFitView={flowGraphSnapshot.onFitView}
          isFullscreen={false}
          onToggleFullscreen={() => undefined}
          showFullscreenToggle={false}
          width={settings.flowOverviewMinimapWidth}
          height={settings.flowOverviewMinimapHeight}
          embedded
          controlAppearance={flowMinimapElement}
          // In edit mode this surface is an element on the canvas: it must
          // yield pointer input to the parent so it can be selected, moved and
          // resized.  Navigation remains interactive in test mode.
          interactive={previewMode !== 'edit'}
        />
      ) : null;
    return (
      <div
        className="absolute inset-0 z-[80] overflow-hidden text-slate-900"
        style={flowOverviewBackgroundStyle}
        onClick={(event) => {
          if (previewMode === 'edit' && event.target === event.currentTarget) {
            setSelectedStartMenuElementId(null);
          }
        }}
      >
        {settings.flowOverviewBackgroundMusicUrl && (
          <audio
            ref={startMenuAudioRef}
            muted={!settings.soundEnabled}
            src={settings.flowOverviewBackgroundMusicUrl}
            preload="auto"
            loop={settings.flowOverviewMusicLoop !== false}
            className="hidden"
          />
        )}
        <SurfaceLayers muted={!settings.soundEnabled} value={settings.surfaceAppearances?.flow} />
        <div className="pointer-events-none absolute left-[8%] top-[3%] z-20 grid gap-1">
          <h2 className="m-0 text-[clamp(22px,2.1vw,34px)] font-black tracking-[-0.04em] text-[#252a59]">
            {language === 'zh' ? '剧情流程' : language === 'ja' ? 'ストーリーフロー' : 'Story flow'}
          </h2>
          <p className="m-0 text-[clamp(11px,1vw,15px)] font-semibold text-[#68719a]">
            {language === 'zh'
              ? '探索已解锁的故事路径'
              : language === 'ja'
                ? '解放された物語の道筋をたどる'
                : 'Explore the story paths you have unlocked'}
          </p>
        </div>
        {!settings.surfaceAppearances?.flow &&
          background.type === 'video' &&
          background.videoUrl && (
            <video
              src={background.videoUrl}
              autoPlay
              playsInline
              loop={background.videoLoop}
              muted={!settings.soundEnabled || background.videoMuted}
              className={`pointer-events-none absolute inset-0 h-full w-full ${background.videoFit === 'fit' ? 'object-contain' : 'object-cover'}`}
            />
          )}
        <div
          ref={startMenuEditorRef}
          className="absolute inset-0 z-10"
          onPointerDown={beginStartMenuMarquee}
          onContextMenu={(event) => {
            if (previewMode === 'edit') event.preventDefault();
          }}
          onClick={(event) => {
            // Dragging captures the pointer on this editor.  Browsers can
            // dispatch the release click here instead of on the original
            // flow control, so keep it from reaching the page backdrop and
            // clearing the just-selected element.
            event.stopPropagation();
          }}
        >
          <WebStoryFlowGraph
            language={language}
            nodes={nodes}
            edges={edges}
            minimapWidth={settings.flowOverviewMinimapWidth}
            minimapHeight={settings.flowOverviewMinimapHeight}
            transparentSurface
            controlsRef={flowGraphControlsRef}
            onSnapshot={setFlowGraphSnapshot}
            onSelectedCardChange={onSelectFlowCard}
            onActiveSegmentChange={setFlowActiveBranchLabel}
            layoutDirection={settings.flowOverviewLayoutDirection}
            onLayoutDirectionChange={(direction) =>
              onUpdateSettings('flowOverviewLayoutDirection', direction)
            }
            showHeader={false}
            showCurrentBranchIndicator={false}
            showMinimap={false}
            editable={previewMode === 'edit'}
            cardSizes={settings.flowOverviewCardSizes}
            onCardSizeChange={(segmentId, size) =>
              onUpdateSettings(
                'flowOverviewCardSizes',
                (() => {
                  const next = {
                    ...(settings.flowOverviewCardSizes || {}),
                    [segmentId]: size,
                  };
                  const segment = flowGraphSnapshot?.segments.find((item) => item.id === segmentId);
                  segment?.nodeIds.forEach((nodeId) => {
                    next[nodeId] = size;
                  });
                  return next;
                })(),
              )
            }
            showDirectionControl={
              !flowOverviewElements.some((element) => element.role === 'flowDirection')
            }
            showFitViewControl={
              !flowOverviewElements.some((element) => element.role === 'flowFitView')
            }
            onClose={previewMode === 'test' ? () => setFlowOverviewOpen(false) : undefined}
            onPlayFromNode={startPreviewFromNode}
          />
          {previewMode === 'edit' && activeStartMenuGuideLines.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-30">
              {activeStartMenuGuideLines.map((line, index) => (
                <div
                  key={`${line.axis}-${line.value}-${index}`}
                  className={
                    line.axis === 'x'
                      ? 'absolute top-0 h-full border-l-[1.5px] border-dashed border-[#ef4444]'
                      : 'absolute left-0 w-full border-t-[1.5px] border-dashed border-[#ef4444]'
                  }
                  style={line.axis === 'x' ? { left: `${line.value}%` } : { top: `${line.value}%` }}
                />
              ))}
            </div>
          )}
          {flowOverviewElements.map((element) => (
            <WebPlaytestStartMenuElement
              key={element.id}
              element={element}
              selected={
                selectedStartMenuElementId === element.id ||
                selectedStartMenuElementIds.includes(element.id)
              }
              gradientEditing={
                gradientEditingElement?.id === element.id ? gradientEditingElement.group : null
              }
              imageCropEditing={imageCropEditingElementId === element.id}
              action={element.kind === 'button' ? getStartMenuElementAction(element) : null}
              previewMode={previewMode}
              editingStartMenuElementId={editingStartMenuElementId}
              hasCustomStartMenuElements
              settings={settings}
              choiceColor={choiceColor}
              choiceTextColor={choiceTextColor}
              language={language}
              dynamicText={element.role === 'flowBranch' ? flowActiveBranchLabel : undefined}
              flowMinimap={element.role === 'flowMinimap' ? flowMinimap : undefined}
              onEnsureStartMenuElements={() => undefined}
              onSelectElement={setSelectedStartMenuElementId}
              onSetEditingElement={setEditingStartMenuElementId}
              onUpdateElement={updateStartMenuElement}
              onDeleteElement={onDeleteStartMenuElement}
              onBeginDrag={beginStartMenuEditDrag}
            />
          ))}
          {previewMode === 'edit' && startMenuMarqueeBox && (
            <div
              className="pointer-events-none absolute z-[70] border border-sky-400 bg-sky-400/14"
              style={{
                left: `${startMenuMarqueeBox.x}%`,
                top: `${startMenuMarqueeBox.y}%`,
                width: `${startMenuMarqueeBox.width}%`,
                height: `${startMenuMarqueeBox.height}%`,
              }}
            />
          )}
        </div>
      </div>
    );
  };

  const renderChoiceButtons = (extraClass = '') => {
    if (!shouldShowChoices) return null;
    if (outEdges.length === 0) {
      return (
        <ChoiceButtonsGroup
          items={[
            {
              id: 'THE_END',
              label: formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText1870'),
              onClick: () => handleChoiceClick('THE_END'),
            },
          ]}
          extraClass={extraClass}
          choiceColor={choiceColor}
          choiceTextColor={choiceTextColor}
          renderStyle={renderStyle}
          previewMode={previewMode}
          onSelectRenderObject={selectRenderObject}
        />
      );
    }
    return (
      <ChoiceButtonsGroup
        items={outEdges.map((edge, index) => {
          const target = playableNodes.find((node) => node.id === edge.target);
          const label =
            webStoryTitle(getNodeDisplayTitle(target)) ||
            edge.data?.label ||
            (outEdges.length === 1
              ? formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText1888')
              : `${formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText1889')} ${index + 1}`);
          return {
            id: edge.id,
            label: String(label),
            onClick: () => handleChoiceClick(edge.target),
          };
        })}
        extraClass={extraClass}
        choiceColor={choiceColor}
        choiceTextColor={choiceTextColor}
        renderStyle={renderStyle}
        previewMode={previewMode}
        onSelectRenderObject={selectRenderObject}
      />
    );
  };

  const renderPreviewToolbar = () => (
    <PreviewToolbar
      settings={settings}
      previewControlsHidden={previewControlsHidden}
      historyLength={history.length}
      showAudioPlaylist={showAudioPlaylist}
      playlistAudioUrl={playlistAudioUrl}
      playlistAudioRef={playlistAudioRef}
      isPreviewFullscreen={isPreviewFullscreen}
      previewMode={previewMode}
      toolbarElements={toolbarElements}
      selectedToolbarElementId={selectedStartMenuElementId}
      language={language}
      onSelectToolbarElement={(id) => {
        if (id && !settings.previewToolbarElements?.length) {
          onUpdateSettings('previewToolbarElements', defaultToolbarElements);
        }
        setSelectedStartMenuElementId(id);
        onSelectStartMenuElement?.(id);
      }}
      onUpdateToolbarElement={updateToolbarElement}
      onBack={back}
      onReturnToStartMenu={returnToStartMenu}
      onToggleAudioPlaylist={() => setShowAudioPlaylist((visible) => !visible)}
      onToggleFullscreen={togglePreviewFullscreen}
      onPlaylistAudioPlay={() => setIsPlaylistAudioPlaying(true)}
      onPlaylistAudioPause={() => setIsPlaylistAudioPlaying(false)}
      onPlaylistAudioEnded={() => setIsPlaylistAudioPlaying(false)}
    />
  );

  const renderFloatingElements = () => {
    const toolbarLayerElements = toolbarElements.filter(
      (element) =>
        (settings.showStartMenu || element.role !== 'mainMenu') &&
        (!previewControlsHidden || previewMode === 'edit' || element.role === 'controlsToggle'),
    );
    const dialogueOverlayElements = settings.dialogueOverlayElements || [];
    const floatingGuideElements = [...toolbarLayerElements, ...dialogueOverlayElements];

    return (
      <>
        <style>{WEB_PLAYBACK_UI_CSS}</style>
        {playbackSettingsButton && (
          <WebPlaybackSettings
            language={language}
            role={playbackSettingsButton.role || 'settings'}
            config={{
              ...settings.playerSettingsPanel,
              controls: {
                ...settings.playerSettingsPanel?.controls,
                [playbackSettingsButton.role || 'settings']: {
                  form: playbackSettingsButton.settingsControlForm,
                },
              },
            }}
            values={{ ...playbackSettingsValues, controlsVisible: !previewControlsHidden }}
            defaults={playbackSettingsDefaults.current}
            onClose={() => setPlaybackSettingsButton(null)}
            onChange={(patch) => {
              if (patch.controlsVisible !== undefined)
                setPreviewControlsHidden(!patch.controlsVisible);
              if (patch.autoAdvance !== undefined) {
                autoAdvanceHoldNodeRef.current = null;
                onUpdateSettings('autoAdvance', patch.autoAdvance);
              }
              if (patch.interactionMode !== undefined)
                onUpdateSettings('interactionMode', patch.interactionMode);
              if (patch.typewriterSpeed !== undefined)
                onUpdateSettings('typewriterSpeed', patch.typewriterSpeed);
              if (patch.textScale !== undefined) onUpdateSettings('textScale', patch.textScale);
              if (patch.animationSpeed !== undefined)
                onUpdateSettings('animationSpeed', patch.animationSpeed);
              if (patch.soundEnabled !== undefined)
                onUpdateSettings('soundEnabled', patch.soundEnabled);
            }}
          />
        )}
        <PreviewFloatingElementLayer
          elements={toolbarLayerElements}
          onSelectElements={onSelectStartMenuElements}
          guideElements={floatingGuideElements}
          selectedElementId={selectedStartMenuElementId}
          previewMode={previewMode}
          onSelectElement={(id) => {
            if (id && !settings.previewToolbarElements?.length) {
              onUpdateSettings('previewToolbarElements', defaultToolbarElements);
            }
            setSelectedStartMenuElementId(id);
            onSelectStartMenuElement?.(id);
          }}
          onUpdateElement={updateToolbarElement}
          onUpdateElements={(elements) => {
            const nextById = new Map(elements.map((element) => [element.id, element]));
            onUpdateSettings(
              'previewToolbarElements',
              toolbarElements.map((element) => nextById.get(element.id) || element),
            );
          }}
          getLabel={(element) =>
            webToolbarButtonLabel(
              element.role,
              element.text,
              language,
              isPreviewFullscreen,
              previewControlsHidden,
              settings.autoAdvance,
              element.id === 'toolbar-auto',
            )
          }
          getIcon={(element) =>
            element.role === 'auto' ? (
              settings.autoAdvance ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )
            ) : element.role === 'history' ? (
              <History className="h-4 w-4" />
            ) : element.role === 'audio' ? (
              <ListMusic className="h-3.5 w-3.5" />
            ) : element.role === 'fullscreen' ? (
              isPreviewFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )
            ) : element.role === 'return' ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : element.role === 'controlsToggle' ? (
              previewControlsHidden ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )
            ) : element.role === 'mainMenu' ? (
              <House className="h-3.5 w-3.5" />
            ) : element.kind === 'button' ? (
              <Settings className="h-4 w-4" />
            ) : null
          }
          isActive={(element) =>
            (element.role === 'audio' && showAudioPlaylist) ||
            (element.role === 'history' && showDialogueHistory) ||
            (element.id === 'toolbar-auto' && settings.autoAdvance) ||
            element.id === playbackSettingsButton?.id
          }
          isDisabled={(element) => element.role === 'return' && history.length === 0}
          onAction={(element) => {
            if (applySharedButtonFunction(element)) return;
            if (element.role === 'history') {
              setShowDialogueHistory(true);
              setShowAudioPlaylist(false);
            }
            if (element.role === 'audio') setShowAudioPlaylist((visible) => !visible);
            if (element.role === 'fullscreen') void togglePreviewFullscreen();
            if (element.role === 'return') back();
            if (element.role === 'mainMenu') returnToStartMenu();
            if (element.role === 'controlsToggle') setPreviewControlsHidden((prev) => !prev);
          }}
        />
        <PreviewFloatingElementLayer
          elements={dialogueOverlayElements}
          onAction={applySharedButtonFunction}
          guideElements={floatingGuideElements}
          selectedElementId={selectedStartMenuElementId}
          previewMode={previewMode}
          onSelectElement={(id) => {
            setSelectedStartMenuElementId(id);
            onSelectStartMenuElement?.(id);
          }}
          onUpdateElement={(id, patch) =>
            onUpdateSettings(
              'dialogueOverlayElements',
              (settings.dialogueOverlayElements || []).map((element) =>
                element.id === id ? { ...element, ...patch } : element,
              ),
            )
          }
          onUpdateElements={(elements) => {
            onUpdateSettings('dialogueOverlayElements', elements);
          }}
          onDoubleClickButton={(target) =>
            onUpdateSettings(
              'dialogueOverlayElements',
              (settings.dialogueOverlayElements || []).map((element) =>
                element.kind === 'button' && element.id !== target.id
                  ? { ...element, visible: false }
                  : element,
              ),
            )
          }
        />
      </>
    );
  };

  const dialoguePath = [
    ...history,
    ...(currentNodeId && currentNodeId !== 'THE_END' ? [currentNodeId] : []),
  ];
  const renderDialogueHistory = () =>
    showDialogueHistory && (
      <WebDialogueHistory
        language={language}
        entries={dialoguePath.flatMap((id, index) => {
          const node = runtimeNodes.find((item) => item.id === id);
          if (!node || node.type !== 'storyNode' || node.data?.skip === true) return [];
          return [
            {
              index,
              title: node.data?.hideTitleInPlayback ? '' : webStoryTitle(getNodeDisplayTitle(node)),
              text: stripHtml(filterMentionTags(getNodeDisplayText(node), true, true)),
              audioUrl: typeof node.data?.audioUrl === 'string' ? node.data.audioUrl : undefined,
            },
          ];
        })}
        onClose={() => {
          playlistAudioRef.current?.pause();
          setShowDialogueHistory(false);
        }}
        onJump={(index) => {
          restartPlaybackSession();
          playlistAudioRef.current?.pause();
          setHistory(dialoguePath.slice(0, index));
          autoAdvanceHoldNodeRef.current = dialoguePath[index];
          setCurrentNodeId(dialoguePath[index]);
          setShowDialogueHistory(false);
        }}
        onAudio={(index) => {
          const node = runtimeNodes.find((item) => item.id === dialoguePath[index]);
          if (typeof node?.data?.audioUrl === 'string')
            togglePlaylistAudio({
              nodeId: node.id,
              title: webStoryTitle(getNodeDisplayTitle(node)),
              url: node.data.audioUrl,
            });
        }}
      />
    );

  const renderAudioPlaylistModal = () => (
    <PreviewAudioPlaylistModal
      open={showAudioPlaylist}
      items={playedAudios}
      activeUrl={playlistAudioUrl}
      isPlaying={isPlaylistAudioPlaying}
      language={language}
      onClose={() => setShowAudioPlaylist(false)}
      onToggleAudio={togglePlaylistAudio}
      onJumpToNode={(nodeId) => {
        restartPlaybackSession();
        setHistory([]);
        setCurrentNodeId(nodeId);
      }}
      currentBranchNodeIds={[...history, ...(currentNodeId ? [currentNodeId] : [])]}
    />
  );

  if (!root) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-none border border-dashed border-[var(--vr-border-strong)] bg-[var(--vr-panel)] text-sm font-bold text-[var(--vr-text-muted)]">
        {formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText2045')}
      </div>
    );
  }

  // The start/menu surfaces are an editor overlay and must remain available
  // even after the story preview reaches its terminal node.
  if (currentNodeId === 'THE_END' && !isPreviewStartMenuOpen) {
    return (
      <div
        ref={previewRootRef}
        className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-none border border-white/10 bg-slate-950 text-white shadow-sm"
      >
        {renderPreviewToolbar()}
        {renderAudioPlaylistModal()}
        {renderDialogueHistory()}
        {renderFloatingElements()}
        {endingImageRef.current && (
          <img
            src={endingImageRef.current}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {!endingDismissed && (
          <WebStoryEnding
            language={language}
            hasMenu={settings.showStartMenu}
            onRestart={startPreviewNewGame}
            onClose={() =>
              settings.showStartMenu ? returnToStartMenu() : setEndingDismissed(true)
            }
          />
        )}
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
  const presentedSceneData = presentation.scene
    ? (nodes.find(
        (node) => node.id === presentation.scene?.sourceNodeId && node.type === 'sceneNode',
      )?.data as SceneNodeData | undefined)
    : undefined;
  const scenePresetEnabled = presentedSceneData?.scenePresetEnabled === true;
  const scenePresetVisualStyle = scenePresetEnabled ? presentedSceneData?.visualStyle : undefined;
  const sceneVisualMediaStyle = getSceneVisualMediaStyle(scenePresetVisualStyle);
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
  const baseSceneStyle: React.CSSProperties = {
    objectFit: finalObjectFit as any,
    objectPosition: '50% 50%',
    opacity: sceneAnimationActive && sceneMotion?.type === 'fade' ? 0 : 1,
    transform:
      [
        sceneMediaTransform,
        sceneVisualMediaStyle.transform,
        sceneAnimationActive && sceneMotion
          ? getPresentationTransform(sceneMotion.type, presentationExiting)
          : inlineActionTransform(activeSceneInlineAction),
      ]
        .filter(Boolean)
        .join(' ') || 'none',
    transformOrigin: 'center center',
    filter: sceneVisualMediaStyle.filter,
    animation: inlineActionAnimation(activeSceneInlineAction, animationRate),
    ...inlineActionCssVars(activeSceneInlineAction),
    transitionProperty: 'opacity, transform',
    transitionDuration: activeSceneInlineAction
      ? `${sceneInlineDuration / animationRate}ms`
      : settings.layoutMode === 'classic'
        ? '0ms'
        : `${(sceneMotion?.type === 'none' ? 0 : sceneMotion?.duration || 0) / animationRate}ms`,
    transitionDelay:
      settings.layoutMode === 'classic' || !presentationExiting
        ? '0ms'
        : `${getSceneExitDelay(presentation) / animationRate}ms`,
    transitionTimingFunction: 'ease-out',
  };
  const sceneStyle =
    settings.layoutMode === 'classic'
      ? mergeSceneMediaStyle(baseSceneStyle, settings)
      : baseSceneStyle;

  const renderMediaLayers = () => (
    <WebPlaytestMediaLayers
      playbackActive={storyPlaybackActive}
      currentNodeId={currentNodeId}
      currentImageUrl={currentImageUrl}
      currentVideoUrl={currentVideoUrl}
      sceneSwitchImageUrl={sceneSwitchImageUrl}
      sceneSwitchDurationMs={sceneSwitchDurationMs}
      currentVideoRef={currentVideoRef}
      settings={settings}
      sceneStyle={sceneStyle}
      presentedCharacters={presentedCharacters}
      presentation={presentation}
      presentationExiting={presentationExiting}
      presentationVisible={presentationVisible}
      activeInlineAction={activeInlineAction}
      completedInlineActions={completedInlineActions}
      emptyText={formatWebText(language, 'componentsrenderwebWebPlaytestPreviewText2153')}
      onVideoEnded={() => setCurrentVideoEnded(true)}
      sceneVisualStyle={scenePresetVisualStyle}
      scenePresetEnabled={scenePresetEnabled}
    />
  );

  return (
    <div
      ref={previewRootRef}
      className="relative h-full min-h-[320px] overflow-hidden rounded-none border border-white/10 bg-slate-950 text-white shadow-sm"
      style={
        settings.layoutMode === 'classic'
          ? { ...dialogueBackgroundStyle, ...getSceneBackgroundStyle(settings) }
          : dialogueBackgroundStyle
      }
      onClick={(event) => {
        if (previewMode === 'edit') {
          const target = event.target as HTMLElement;
          if (target.closest('[data-render-object], [data-split-layout-editor]')) return;
          setSelectedStartMenuElementId(null);
          onSelectCanvasObject?.(
            settings.layoutMode === 'classic' &&
              target.closest('[data-split-visual-group], [data-split-scene-surface]')
              ? 'scene'
              : 'background',
          );
          _onUpdateRenderStyle('selectedRenderObject', undefined);
        }
      }}
    >
      <SurfaceLayers muted={!settings.soundEnabled} value={settings.surfaceAppearances?.game} />
      <style>
        {`@keyframes webPreviewFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes webPreviewSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}
      </style>
      {previewMode === 'test' && showTestDebugInfo && (
        <div className="pointer-events-none absolute left-3 top-3 z-[90] rounded-lg bg-slate-950/80 px-2.5 py-2 font-mono text-[10px] leading-4 text-white shadow-lg">
          <div>node: {currentNodeId || 'none'}</div>
          <div>path: {history.length + (currentNodeId ? 1 : 0)}</div>
          {conditionResult && (
            <div>
              condition: {conditionResult.total} → {conditionResult.label}
            </div>
          )}
        </div>
      )}
      {previewMode === 'edit' &&
        gradientEditingSurface === 'game' &&
        getSurfaceBackground(settings, 'game').type === 'gradient' && (
          <GradientCanvasControl
            shape={getSurfaceBackground(settings, 'game').gradientShape}
            angle={getSurfaceBackground(settings, 'game').gradientAngle}
            startX={getSurfaceBackground(settings, 'game').gradientStartX}
            startY={getSurfaceBackground(settings, 'game').gradientStartY}
            endX={getSurfaceBackground(settings, 'game').gradientEndX}
            endY={getSurfaceBackground(settings, 'game').gradientEndY}
            onGeometryChange={(geometry) => {
              onUpdateSettings('dialogueBackgroundGradientStartX', geometry.startX);
              onUpdateSettings('dialogueBackgroundGradientStartY', geometry.startY);
              onUpdateSettings('dialogueBackgroundGradientEndX', geometry.endX);
              onUpdateSettings('dialogueBackgroundGradientEndY', geometry.endY);
              onUpdateSettings('dialogueBackgroundGradientAngle', geometry.angle);
            }}
          />
        )}
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
            : 'relative h-full bg-slate-950/45'
        }`}
      >
        {renderPreviewToolbar()}
        {renderAudioPlaylistModal()}
        {renderDialogueHistory()}
        {renderFloatingElements()}
        <div data-story-visual="true" className="absolute inset-0 min-h-0 p-0">
          <div
            className={`flex h-full min-h-0 items-center justify-center overflow-hidden relative ${
              settings.layoutMode === 'immersive' ? 'rounded-none' : 'bg-slate-950'
            }`}
            onClick={() => {
              if (previewMode === 'edit') return;
              continueFromText();
            }}
          >
            {settings.layoutMode === 'classic' ? (
              <VirtualPresentationStage fit="cover" className="absolute inset-0 h-full w-full">
                {renderMediaLayers()}
              </VirtualPresentationStage>
            ) : (
              renderMediaLayers()
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
        <WebPlaytestDialoguePanel
          dialogueBoxRef={dialogueBoxRef}
          currentNode={currentNode}
          currentNodeId={currentNodeId}
          text={text}
          displayedPreviewText={displayedPreviewText}
          audioUrl={audioUrl}
          currentAudioRef={currentAudioRef}
          settings={settings}
          renderStyle={renderStyle}
          dialogueShellStyle={dialogueShellStyle}
          hideCenteredTitle={hideCenteredTitle}
          nameplates={renderNameplates}
          aboveChoices={settings.choicesPosition === 'aboveText' && renderChoiceButtons('mb-3')}
          belowChoices={settings.choicesPosition === 'belowText' && renderChoiceButtons('mt-3')}
          previewMode={
            settings.layoutMode === 'classic' && previewMode === 'edit' ? 'test' : previewMode
          }
          onSelectRenderObject={selectRenderObject}
          onMoveRenderObject={moveRenderObject}
          onUpdateRenderObject={patchRenderObject}
          language={language}
          onContinueFromText={continueFromText}
          onRecordCurrentAudio={recordCurrentAudio}
          onCurrentAudioEnded={() => setCurrentAudioEnded(true)}
        />
      </div>
      {previewMode === 'edit' &&
        settings.layoutMode === 'classic' &&
        !isPreviewStartMenuOpen &&
        !isPreviewArchiveOpen &&
        !isPreviewStartSettingsOpen &&
        !selectedStartMenuElementId &&
        onSelectCanvasObject && (
          <WebSplitLayoutEditor
            rootRef={previewRootRef}
            selection={
              (selectedCanvasObject ||
                renderStyle.selectedRenderObject ||
                'scene') as SplitEditorSelection
            }
            onSelectionChange={onSelectCanvasObject}
            canvasSettings={settings}
            onCanvasSettingsChange={(patch) =>
              Object.entries(patch).forEach(([key, value]) =>
                onUpdateSettings(key as keyof WebExportSettings, value as never),
              )
            }
            renderStyle={renderStyle}
            onRenderStyleChange={_onUpdateRenderStyle}
          />
        )}
      {renderStartMenuPreview()}
      {renderFlowOverviewPreview()}
    </div>
  );
}

function GradientCanvasControl({
  shape,
  angle,
  startX,
  startY,
  endX,
  endY,
  onGeometryChange,
}: {
  shape: 'linear' | 'radial' | 'diamond';
  angle: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  onGeometryChange: (geometry: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    angle: number;
  }) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const radians = (angle * Math.PI) / 180;
  const safeStartX = startX ?? 50 - Math.sin(radians) * 25;
  const safeStartY = startY ?? 50 + Math.cos(radians) * 25;
  const safeEndX = endX ?? 50 + Math.sin(radians) * 25;
  const safeEndY = endY ?? 50 - Math.cos(radians) * 25;
  const radialDiameter = Math.max(
    12,
    Math.min(200, Math.hypot(safeEndX - safeStartX, safeEndY - safeStartY) * 2),
  );
  const updatePoint = (point: 'start' | 'end', clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    const nextStartX = point === 'start' ? x : safeStartX;
    const nextStartY = point === 'start' ? y : safeStartY;
    const nextEndX = point === 'end' ? x : safeEndX;
    const nextEndY = point === 'end' ? y : safeEndY;
    const nextAngle = Math.round(
      ((Math.atan2(nextEndY - nextStartY, nextEndX - nextStartX) * 180) / Math.PI + 90 + 360) % 360,
    );
    onGeometryChange({
      startX: nextStartX,
      startY: nextStartY,
      endX: nextEndX,
      endY: nextEndY,
      angle: nextAngle,
    });
  };
  const renderControlPoint = (point: 'start' | 'end') => {
    const x = point === 'start' ? safeStartX : safeEndX;
    const y = point === 'start' ? safeStartY : safeEndY;
    const isStart = point === 'start';
    return (
      <button
        key={point}
        type="button"
        className="pointer-events-auto absolute z-[10030] grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full bg-transparent"
        style={{ left: `${x}%`, top: `${y}%` }}
        aria-label={
          shape === 'radial'
            ? isStart
              ? 'Radial gradient center'
              : 'Radial gradient radius'
            : `Gradient ${point}`
        }
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          updatePoint(point, event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          event.stopPropagation();
          updatePoint(point, event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        <span
          className={`h-6 w-6 rounded-full border-[3px] border-white shadow-lg ${
            isStart ? 'bg-sky-500' : 'bg-indigo-600'
          }`}
        />
      </button>
    );
  };
  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-[10020]"
      data-gradient-canvas-control
    >
      <div className="absolute inset-0">
        {shape === 'radial' ? (
          <>
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              aria-hidden="true"
            >
              <line
                x1={`${safeStartX}%`}
                y1={`${safeStartY}%`}
                x2={`${safeEndX}%`}
                y2={`${safeEndY}%`}
                stroke="rgba(0,0,0,.45)"
                strokeWidth="4"
              />
              <line
                x1={`${safeStartX}%`}
                y1={`${safeStartY}%`}
                x2={`${safeEndX}%`}
                y2={`${safeEndY}%`}
                stroke="white"
                strokeWidth="2"
              />
            </svg>
            <span
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-white/90 shadow-[0_0_0_1px_#00000055]"
              style={{
                left: `${safeStartX}%`,
                top: `${safeStartY}%`,
                width: `${radialDiameter}%`,
                aspectRatio: '1',
              }}
            />
            {renderControlPoint('start')}
            {renderControlPoint('end')}
          </>
        ) : (
          <>
            <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
              <line
                x1={`${safeStartX}%`}
                y1={`${safeStartY}%`}
                x2={`${safeEndX}%`}
                y2={`${safeEndY}%`}
                stroke="rgba(0,0,0,.45)"
                strokeWidth="4"
              />
              <line
                x1={`${safeStartX}%`}
                y1={`${safeStartY}%`}
                x2={`${safeEndX}%`}
                y2={`${safeEndY}%`}
                stroke="white"
                strokeWidth="2"
              />
            </svg>
            {shape === 'diamond' && (
              <span
                className="absolute h-32 w-32 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-dashed border-white/85"
                style={{
                  left: `${(safeStartX + safeEndX) / 2}%`,
                  top: `${(safeStartY + safeEndY) / 2}%`,
                }}
              />
            )}
            {renderControlPoint('start')}
            {renderControlPoint('end')}
          </>
        )}
      </div>
    </div>
  );
}
