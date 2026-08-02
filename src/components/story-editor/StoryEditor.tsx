import { Edge, Node, useEdgesState, useNodesState, useReactFlow, useStore } from '@xyflow/react';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { AgentOverlay } from '../../agent/animation/AgentOverlay';
import { useAgentRuntime } from '../../agent/runtime/useAgentRuntime';
import type {
  BackgroundRemovalAIProfile,
  CharacterImageMode,
  ImageAIProfile,
  PlotStructureGenerateDirection,
  ProjectAIProfilesExport,
  SavedAIProfile,
  SceneImageMode,
  StoryNodeData,
  StoryTitlePlacement,
  TextAIProfile,
  TtsNarrationMode,
  VoiceAIProfile,
} from '../../domain/project';
import { useAIActions } from '../../editor-features/ai/useAIActions';
import { ttsService } from '../../editor-services/ttsService';
import { useCanvasDnD } from '../../editor-features/canvas/useCanvasDnD';
import { useCanvasInteractions } from '../../editor-features/canvas/useCanvasInteractions';
import {
  DEFAULT_IMAGE_API_URL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_STABLE_DIFFUSION_CFG_SCALE,
  DEFAULT_STABLE_DIFFUSION_SAMPLER,
  DEFAULT_STABLE_DIFFUSION_STEPS,
  isLocalStableDiffusionProvider,
} from '../../editor-features/media/imageGeneration';
import { useMediaActions } from '../../editor-features/media/useMediaActions';
import { useNodeActions } from '../../editor-features/node-actions/useNodeActions';
import { useSettingLibrary } from '../../editor-features/setting-library/useSettingLibrary';
import { useSelectionActions } from '../../editor-features/selection-tools/useSelectionActions';
import { useSelectionMenu } from '../../editor-features/selection-tools/useSelectionMenu';
import { localPersistenceService } from '../../editor-services/localPersistenceService';
import { createProjectThumbnail } from '../../editor-services/projectThumbnail';
import { AssistantPanel } from '../../editor-shell/AssistantPanel';
import { AutoSaveRecoveryModal } from '../../editor-shell/AutoSaveRecoveryModal';
import { ConfirmActionModal } from '../../editor-shell/ConfirmActionModal';
import { useDialog } from '../../editor-shell/DialogProvider';
import { EditorHeader } from '../../editor-shell/EditorHeader';
import { EditorLeftToolbar } from '../../editor-shell/EditorLeftToolbar';
import { EditorRightToolbar } from '../../editor-shell/EditorRightToolbar';
import { EditorToast } from '../../editor-shell/EditorToast';
import { assistantPanelCopy } from '../../editor-shell/i18n/assistant';
import { getSideToolbarStrings } from '../../editor-shell/i18n/side-toolbar';
import { ProjectSavePromptModal } from '../../editor-shell/ProjectSavePromptModal';
import { SaveProjectModal } from '../../editor-shell/SaveProjectModal';
import {
  type AIButtonsConfig,
  type AIGenerationBalance,
  type AIPromptsConfig,
  defaultAIButtonsConfig,
  defaultAIPrompts,
} from '../../editor-state/editorConfig';
import { usePlaytestSettings } from '../../editor-state/usePlaytestSettings';
import { useSharedRenderStyle } from '../../editor-state/useSharedRenderStyle';
import {
  HOSTED_IMAGE_PROXY_PROFILE,
  HOSTED_IMAGE_PROXY_PROFILE_ID,
  HOSTED_PROXY_PROFILE,
  HOSTED_PROXY_PROFILE_ID,
  HOSTED_VOICE_PROXY_PROFILE,
  HOSTED_VOICE_PROXY_PROFILE_ID,
} from '../../lib/hostedProxy';
import { translations } from '../../lib/i18n';
import { isTauriRuntime } from '../../lib/tauriRuntime';
import { htmlToSpeechText } from '../../lib/tts';
import { getPlatformVoiceOptions, getPlatformVoicePlaceholder } from '../../lib/voiceCatalog';
import { type ProjectExampleTemplate, ProjectPickerModal } from '../ProjectPickerModal';
import { useSharedCanvasSettings } from '../render/canvas/canvasSettings';
import type { PlayTestDisplayMode, PlaytestWindowLayer } from '../render/playtest/types';
import { RenderWorkspaceBootSkeleton } from '../render/video/RenderWorkspaceSkeleton';
import type { RenderWorkspaceLaunchIntent } from '../render/video/shared/types';
import {
  buildDefaultBackgroundRemovalProfile,
  buildDefaultImageProfile,
  buildDefaultTextProfile,
  buildDefaultVoiceProfile,
  updateProfileList,
} from './aiProfiles';
import { mixHexColor, resolveAccentColor } from './colorUtils';
import {
  AI_STORY_CARD_HEIGHT,
  APP_TITLE,
  type CloseButtonBehavior,
  DEFAULT_ARROW_CORNER_RADIUS,
  DEFAULT_ARROW_SIZE,
  DEFAULT_ARROW_TIP_ANGLE,
  DEFAULT_EDGE_COLOR,
  DEFAULT_PROJECT_FILE_NAME,
  DEFAULT_TEXT_MODEL,
  DEFAULT_TTS_API_URL,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE,
  MIN_STORY_CARD_HEIGHT,
  PROJECT_TITLE_PLACEHOLDER,
} from './constants';
import { EditorFooter } from './EditorFooter';
import { edgeTypes, nodeTypes } from './flowTypes';
import { formatStoryEditorText, getStoryEditorCopy } from './i18n';
import { createDefaultEdgeOptions, INITIAL_EDGES, INITIAL_NODES } from './initialGraph';
import { PlayTestModal, SettingsModal, VideoRenderModal } from './lazyModals';
import { getMediaDimensions, TITLE_HEIGHT } from './mediaDimensions';
import { getSettingRename, replaceMentionNameInText } from './nodeRename';
import { getPersistedProjectName } from './projectNames';
import { StoryCanvasWorkspace } from './StoryCanvasWorkspace';
import { StoryEditorZenOverlay } from './StoryEditorZenOverlay';
import { resolveSystemTheme } from './theme';
import type {
  AIProfileSeed,
  AIProfileUpdates,
  PendingProjectAction,
  StoryEditorProps,
  ThemePreference,
} from './types';
import { useAssistantSystem } from './useAssistantSystem';
import { useEditorFooterHint } from './useEditorFooterHint';
import { useEditorHistory } from './useEditorHistory';
import { useEditorKeyboardShortcuts } from './useEditorKeyboardShortcuts';
import { useEditorUtilityActions } from './useEditorUtilityActions';
import { useGraphPresentation } from './useGraphPresentation';
import { usePlotStructureGeneration } from './usePlotStructureGeneration';
import { useProjectManagement } from './useProjectManagement';
import { useRegionAssistantContext } from './useRegionAssistantContext';
import { useStoryNodeSpeechGeneration } from './useStoryNodeSpeechGeneration';
import { useStoryPresentationBindings } from './useStoryPresentationBindings';
import { syncCloseButtonBehavior } from './windowBehavior';

export function StoryEditor({ appLanguage, onAppLanguageChange }: StoryEditorProps) {
  const nodeTypesMemo = useMemo(() => nodeTypes, []);
  const edgeTypesMemo = useMemo(() => edgeTypes, []);
  const { alert: showDialogAlert } = useDialog();
  const { getIntersectingNodes, getViewport, screenToFlowPosition } = useReactFlow();
  const { agentState, runAgentCardPlacement, startAgentWaiting, stopAgentWaiting } =
    useAgentRuntime();

  const [nodes, setNodes] = useNodesState<Node>(INITIAL_NODES);
  const [edges, setEdges] = useEdgesState<Edge>(INITIAL_EDGES);
  const [playTestDisplayMode, setPlayTestDisplayMode] = useState<PlayTestDisplayMode | null>(null);
  const [playTestWindowLayer, setPlayTestWindowLayer] = useState<PlaytestWindowLayer>('workspace');
  const [settingsPlaytestWindowSession, setSettingsPlaytestWindowSession] = useState<
    'none' | 'raised-existing' | 'opened-from-settings'
  >('none');
  const [showVideoRender, setShowVideoRender] = useState(false);
  const [renderLaunchIntent, setRenderLaunchIntent] = useState<RenderWorkspaceLaunchIntent>();
  const [canvasBg, setCanvasBg] = useState<string>('#F9FAFB');
  const [interactionMode, setInteractionMode] = useState<'select' | 'box'>('select');
  const [pendingCardPlacement, setPendingCardPlacement] = useState<
    'story' | 'background' | 'dynamicWrap' | 'bodyText' | 'headingText' | null
  >(null);
  const [cardPlacementStart, setCardPlacementStart] = useState<{
    flow: { x: number; y: number };
    screen: { x: number; y: number };
  } | null>(null);
  const [backgroundCardDragStart, setBackgroundCardDragStart] = useState<{
    flow: { x: number; y: number };
    screen: { x: number; y: number };
  } | null>(null);
  const [dynamicWrapDragStart, setDynamicWrapDragStart] = useState<{
    flow: { x: number; y: number };
    screen: { x: number; y: number };
  } | null>(null);
  const [showTitles, setShowTitles] = useState(true);
  const [storyTitlePlacement, setStoryTitlePlacement] = useState<StoryTitlePlacement>('inside');
  const [edgeStyle, setEdgeStyle] = useState<'step' | 'bezier'>('bezier');
  const [edgeColor, setEdgeColor] = useState(DEFAULT_EDGE_COLOR);
  const [arrowSize, setArrowSize] = useState(DEFAULT_ARROW_SIZE);
  const [arrowCornerRadius, setArrowCornerRadius] = useState(DEFAULT_ARROW_CORNER_RADIUS);
  const [arrowTipAngle, setArrowTipAngle] = useState(DEFAULT_ARROW_TIP_ANGLE);
  const [nodeHorizontalSpacing, setNodeHorizontalSpacing] = useState(120);
  const [nodeVerticalSpacing, setNodeVerticalSpacing] = useState(120);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    if (!showSettings) {
      setPlayTestWindowLayer('workspace');
      setSettingsPlaytestWindowSession('none');
    }
  }, [showSettings]);
  const [settingsAttention, setSettingsAttention] = useState(false);
  const [settingsAttentionTarget, setSettingsAttentionTarget] = useState<
    'text' | 'image' | 'background-removal' | 'voice' | null
  >(null);
  const [savedAIProfiles, setSavedAIProfiles] = useState<SavedAIProfile[]>([]);
  const [activeTextProfileId, setActiveTextProfileId] = useState<string | null>(null);
  const [activeImageProfileId, setActiveImageProfileId] = useState<string | null>(null);
  const [activeBackgroundRemovalProfileId, setActiveBackgroundRemovalProfileId] = useState<
    string | null
  >(null);
  const [activeVoiceProfileId, setActiveVoiceProfileId] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsNarrationMode, setTtsNarrationMode] = useState<TtsNarrationMode>('body');
  const [characterImageMode, setCharacterImageMode] =
    useState<CharacterImageMode>('transparent-sprite');
  const [hideStoryImageButtonWithTags, setHideStoryImageButtonWithTags] = useState(true);
  const [sceneImageMode, setSceneImageMode] = useState<SceneImageMode>('storyboard-16:9');
  const [plotStructureGenerateDirection, setPlotStructureGenerateDirection] =
    useState<PlotStructureGenerateDirection>('down');
  const [customAiPromptsEnabled, setCustomAiPromptsEnabled] = useState(false);
  const [aiPrompts, setAiPrompts] = useState<AIPromptsConfig>(defaultAIPrompts);
  const [aiButtonsConfig, setAiButtonsConfig] = useState<AIButtonsConfig>(defaultAIButtonsConfig);
  const [aiGenerationBalance, setAiGenerationBalance] = useState<AIGenerationBalance>('dialogue');
  const [opaqueAssistantMessagesInGlass, setOpaqueAssistantMessagesInGlass] = useState(false);
  const [opaqueFooterInGlass, setOpaqueFooterInGlass] = useState(false);

  const flowWidth = useStore((s) => s.width);
  const flowHeight = useStore((s) => s.height);
  const flowZoom = useStore((s) => s.transform[2]);
  const viewportWidth =
    typeof window === 'undefined' ? 1024 : window.visualViewport?.width || window.innerWidth;
  const effectiveFlowWidth = flowWidth > 0 ? flowWidth : viewportWidth;

  const getCenterPosition = useCallback(() => {
    const { x, y, zoom } = getViewport();
    return {
      x: (flowWidth / 2 - x) / zoom,
      y: (flowHeight / 2 - y) / zoom,
    };
  }, [flowHeight, flowWidth, getViewport]);
  const getViewportZoom = useCallback(() => getViewport().zoom, [getViewport]);
  // 右上角显示的思考过程文字，null 表示不显示
  const [, setThinkingContent] = useState<string | null>(null);
  const [generateLength, setGenerateLength] = useState<string>(
    () => getStoryEditorCopy(appLanguage).plotStandardDetail,
  );
  // AI 助手与禅模式共享当前剧情卡片上下文。
  const [zenModeNodeId, setZenModeNodeId] = useState<string | null>(null);
  const [horizontalGuides, setHorizontalGuides] = useState<number[]>([]);
  const [verticalGuides, setVerticalGuides] = useState<number[]>([]);

  const [scrollMode, setScrollMode] = useState<'zoom' | 'pan'>('zoom');
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [miniMapPosition, setMiniMapPosition] = useState<'left' | 'right'>('right');
  const [showControls, setShowControls] = useState(true);
  const [showHoverButtonAnimations, setShowHoverButtonAnimations] = useState(true);
  const [highlightedPath, setHighlightedPath] = useState<{
    nodes: Set<string>;
    edges: Set<string>;
    edgeColors: Map<string, string[]>;
    nodeStorylineNumbers: Map<string, number[]>;
  } | null>(null);
  const defaultEdgeOptions = useMemo(
    () => createDefaultEdgeOptions(edgeColor, arrowSize),
    [arrowSize, edgeColor],
  );

  const [pasteAsPlainText, setPasteAsPlainText] = useState(false);
  const [showNodeActions, setShowNodeActions] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showLastSavedTime, setShowLastSavedTime] = useState(true);
  const [showHeaderActionLabels, setShowHeaderActionLabels] = useState(true);
  const [showSideToolbarLabels, setShowSideToolbarLabels] = useState(true);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const [saveAssistantConversations, setSaveAssistantConversations] = useState(true);
  const [allowAssistantImageGeneration, setAllowAssistantImageGeneration] = useState(true);
  const [skipAssistantAgentAnimation, setSkipAssistantAgentAnimation] = useState(false);
  const [assistantMemorySkillEnabled, setAssistantMemorySkillEnabled] = useState(false);
  const [assistantMemoryNotes, setAssistantMemoryNotes] = useState<string[]>([]);
  const [accentColor, setAccentColor] = useState('');
  const [presetColors, setPresetColors] = useState<string[]>(['#F9FAFB', '#0f1f39', '#fef3c7']);
  const [showPresetColors, setShowPresetColors] = useState(true);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [includeApiProfilesInExport, setIncludeApiProfilesInExport] = useState(false);
  const [includeSettingLibraryInExport, setIncludeSettingLibraryInExport] = useState(false);
  const [showProjectHome, setShowProjectHome] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectFilePath, setCurrentProjectFilePath] = useState<string | null>(null);
  const [defaultProjectSaveDir, setDefaultProjectSaveDir] = useState<string | null>(null);
  const [startupProjectId, setStartupProjectId] = useState<string | null>(null);
  const [projectIdToLoad, setProjectIdToLoad] = useState<string | null>(null);
  const [pendingHomeProjectId, setPendingHomeProjectId] = useState<string | null>(null);
  const [projectListLoading, setProjectListLoading] = useState(true);
  const [projectSummaries, setProjectSummaries] = useState<
    Awaited<ReturnType<typeof localPersistenceService.listProjects>>
  >([]);
  const [exampleTemplates, setExampleTemplates] = useState<ProjectExampleTemplate[]>([]);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const [saveFileName, setSaveFileName] = useState(DEFAULT_PROJECT_FILE_NAME);
  const language = appLanguage;
  const [projectTitle, setProjectTitle] = useState('');
  const [currentProjectPersisted, setCurrentProjectPersisted] = useState(false);
  const [pendingProjectAction, setPendingProjectAction] = useState<PendingProjectAction | null>(
    null,
  );
  const [showProjectSavePrompt, setShowProjectSavePrompt] = useState(false);
  const [showAppClosePrompt, setShowAppClosePrompt] = useState(false);
  const [projectIdsPendingDeletion, setProjectIdsPendingDeletion] = useState<string[]>([]);
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveSystemTheme());
  const [closeButtonBehavior, setCloseButtonBehavior] = useState<CloseButtonBehavior>('quit');
  const [bubbleStyle, setBubbleStyle] = useState<'glass' | 'flat'>('glass');
  const [toolbarLayout, setToolbarLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [selectionMenuLayout, setSelectionMenuLayout] = useState<'horizontal' | 'vertical'>(
    'vertical',
  );
  const [cardToolbarScale, setCardToolbarScale] = useState(1);
  const {
    playTestDarkMode,
    setPlayTestDarkMode,
    playTestChoicesColumns,
    setPlayTestChoicesColumns,
    playTestVideoAutoPlay,
    setPlayTestVideoAutoPlay,
    playTestLayoutMode,
    setPlayTestLayoutMode,
    playTestInteractionMode,
    setPlayTestInteractionMode,
    playTestTypewriterSpeed,
    setPlayTestTypewriterSpeed,
    playTestChoiceDelay,
    setPlayTestChoiceDelay,
    playTestChoicesPosition,
    setPlayTestChoicesPosition,
    playTestBlurBackground,
    setPlayTestBlurBackground,
    playTestBlurText,
    setPlayTestBlurText,
    playTestSkipSingleChoicePopup,
    setPlayTestSkipSingleChoicePopup,
    playTestDimBackground,
    setPlayTestDimBackground,
    playTestAutoAdvance,
    setPlayTestAutoAdvance,
    playTestAutoAdvanceDelay,
    setPlayTestAutoAdvanceDelay,
    playTestHideCharacterTags,
    setPlayTestHideCharacterTags,
    playTestHideSceneTags,
    setPlayTestHideSceneTags,
    playTestWindowSettings,
    setPlayTestWindowSettings,
  } = usePlaytestSettings();
  const canvasWorkspaceKey = currentProjectId || currentProjectFilePath || 'draft';
  const sharedCanvas = useSharedCanvasSettings(canvasWorkspaceKey, {
    layoutMode: playTestLayoutMode,
    choicesPosition: playTestChoicesPosition,
    skipSingleChoicePopup: playTestSkipSingleChoicePopup,
    autoAdvance: playTestAutoAdvance,
    videoAutoPlay: playTestVideoAutoPlay,
    hideCharacterTags: playTestHideCharacterTags,
    hideSceneTags: playTestHideSceneTags,
  });
  const { sharedRenderStyle, setSharedRenderStyle, updateSharedRenderStyle } =
    useSharedRenderStyle();

  const t = translations[language];
  const storyEditorCopy = getStoryEditorCopy(language);
  const [isDirty, setIsDirtyRaw] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isProjectSnapshotSynced, setIsProjectSnapshotSynced] = useState(false);
  const lastSavedSnapshot = useRef<string>('');
  const pendingInitialSnapshotSyncProjectIdRef = useRef<string | null>(null);
  const pendingInitialSnapshotCandidateRef = useRef<string>('');
  const setIsDirty = setIsDirtyRaw;

  const activeTextProfile = useMemo(() => {
    if (!isTauriRuntime() && activeTextProfileId === HOSTED_PROXY_PROFILE_ID) {
      return HOSTED_PROXY_PROFILE;
    }

    return (
      savedAIProfiles.find(
        (profile): profile is TextAIProfile =>
          profile.kind === 'text' && profile.id === activeTextProfileId,
      ) ?? null
    );
  }, [activeTextProfileId, savedAIProfiles]);
  const activeImageProfile = useMemo(() => {
    if (!isTauriRuntime() && activeImageProfileId === HOSTED_IMAGE_PROXY_PROFILE_ID) {
      return HOSTED_IMAGE_PROXY_PROFILE;
    }

    return (
      savedAIProfiles.find(
        (profile): profile is ImageAIProfile =>
          profile.kind === 'image' && profile.id === activeImageProfileId,
      ) ?? null
    );
  }, [activeImageProfileId, savedAIProfiles]);
  const activeBackgroundRemovalProfile = useMemo(() => {
    return (
      savedAIProfiles.find(
        (profile): profile is BackgroundRemovalAIProfile =>
          profile.kind === 'background-removal' && profile.id === activeBackgroundRemovalProfileId,
      ) ?? null
    );
  }, [activeBackgroundRemovalProfileId, savedAIProfiles]);
  const activeVoiceProfile = useMemo(() => {
    if (!isTauriRuntime() && activeVoiceProfileId === HOSTED_VOICE_PROXY_PROFILE_ID) {
      return HOSTED_VOICE_PROXY_PROFILE;
    }

    return (
      savedAIProfiles.find(
        (profile): profile is VoiceAIProfile =>
          profile.kind === 'voice' && profile.id === activeVoiceProfileId,
      ) ?? null
    );
  }, [activeVoiceProfileId, savedAIProfiles]);

  const aiProvider = activeTextProfile?.provider ?? 'deepseek';
  const thinkingMode = activeTextProfile?.thinkingMode ?? false;
  const textApiKey = activeTextProfile?.apiKey ?? '';
  const imageApiKey = activeImageProfile?.apiKey ?? '';
  const imageApiUrl = activeImageProfile?.apiUrl ?? DEFAULT_IMAGE_API_URL;
  const imageModel = activeImageProfile?.model ?? DEFAULT_IMAGE_MODEL;
  const imageSize = activeImageProfile?.size ?? DEFAULT_IMAGE_SIZE;
  const imageProvider = activeImageProfile?.provider ?? 'doubao';
  const imageNegativePrompt = activeImageProfile?.negativePrompt ?? '';
  const imageSteps = activeImageProfile?.steps ?? DEFAULT_STABLE_DIFFUSION_STEPS;
  const imageCfgScale = activeImageProfile?.cfgScale ?? DEFAULT_STABLE_DIFFUSION_CFG_SCALE;
  const imageSampler = activeImageProfile?.sampler ?? DEFAULT_STABLE_DIFFUSION_SAMPLER;
  const imageSeed = activeImageProfile?.seed ?? -1;
  const imageRestoreFaces = activeImageProfile?.restoreFaces ?? false;
  const imageEnableHr = activeImageProfile?.enableHr ?? false;
  const imageHrScale = activeImageProfile?.hrScale ?? 2;
  const imageDenoisingStrength = activeImageProfile?.denoisingStrength ?? 0.7;
  const imageRemoveBackground = activeImageProfile?.removeBackground ?? false;
  const backgroundRemovalApiUrl = activeBackgroundRemovalProfile?.apiUrl ?? '';
  const backgroundRemovalApiKey = activeBackgroundRemovalProfile?.apiKey ?? '';
  const backgroundRemovalModel = activeBackgroundRemovalProfile?.model ?? '';
  const backgroundRemovalProvider = activeBackgroundRemovalProfile?.provider ?? 'custom';
  const ttsApiKey = activeVoiceProfile?.apiKey ?? '';
  const ttsApiUrl = activeVoiceProfile?.apiUrl ?? DEFAULT_TTS_API_URL;
  const ttsAppKey = activeVoiceProfile?.appKey ?? activeVoiceProfile?.model ?? DEFAULT_TTS_MODEL;
  const ttsAppSecret = activeVoiceProfile?.appSecret ?? '';
  const ttsModel = activeVoiceProfile?.model ?? DEFAULT_TTS_MODEL;
  const ttsVoice = activeVoiceProfile?.voice ?? DEFAULT_TTS_VOICE;
  const ttsProvider = activeVoiceProfile?.provider ?? 'system';
  const getExportedAIProfiles = useCallback((): ProjectAIProfilesExport | null => {
    const profiles = [
      activeTextProfile,
      activeImageProfile,
      activeBackgroundRemovalProfile,
      activeVoiceProfile,
    ].filter(
      (profile): profile is SavedAIProfile =>
        Boolean(profile) &&
        profile?.id !== HOSTED_PROXY_PROFILE_ID &&
        profile?.id !== HOSTED_IMAGE_PROXY_PROFILE_ID &&
        profile?.id !== HOSTED_VOICE_PROXY_PROFILE_ID,
    );

    if (profiles.length === 0) return null;

    const exportedProfileIds = new Set(profiles.map((profile) => profile.id));
    return {
      profiles,
      activeTextProfileId:
        activeTextProfileId && exportedProfileIds.has(activeTextProfileId)
          ? activeTextProfileId
          : null,
      activeImageProfileId:
        activeImageProfileId && exportedProfileIds.has(activeImageProfileId)
          ? activeImageProfileId
          : null,
      activeBackgroundRemovalProfileId:
        activeBackgroundRemovalProfileId && exportedProfileIds.has(activeBackgroundRemovalProfileId)
          ? activeBackgroundRemovalProfileId
          : null,
      activeVoiceProfileId:
        activeVoiceProfileId && exportedProfileIds.has(activeVoiceProfileId)
          ? activeVoiceProfileId
          : null,
      exportedAt: new Date().toISOString(),
    };
  }, [
    activeBackgroundRemovalProfile,
    activeBackgroundRemovalProfileId,
    activeImageProfile,
    activeImageProfileId,
    activeTextProfile,
    activeTextProfileId,
    activeVoiceProfile,
    activeVoiceProfileId,
  ]);

  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [rightToolbarCollapsed, setRightToolbarCollapsed] = useState(false);

  const forceMobileUi =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mobile') === '1';
  const isMobile = forceMobileUi || effectiveFlowWidth < 768;

  const selectionBoxRef = useRef<HTMLDivElement>(null);
  // NOTE: canvas 容器的 ref，用于挂载原生 drag-drop 监听器，绕过 React Flow 的内部事件拦截
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const createCurrentProjectThumbnail = useCallback(
    () =>
      Promise.resolve(
        createProjectThumbnail(nodes, edges, canvasBg, {
          showTitles,
          storyTitlePlacement,
        }),
      ),
    [canvasBg, edges, nodes, showTitles, storyTitlePlacement],
  );
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
    tone: 'success' | 'error';
  }>({
    message: '',
    visible: false,
    tone: 'success',
  });

  const handleCreateAIProfile = useCallback(
    async (
      kind: 'text' | 'image' | 'background-removal' | 'voice',
      initialProfile: AIProfileSeed = {},
    ) => {
      const baseProfile =
        kind === 'text'
          ? buildDefaultTextProfile()
          : kind === 'image'
            ? buildDefaultImageProfile()
            : kind === 'background-removal'
              ? buildDefaultBackgroundRemovalProfile()
              : buildDefaultVoiceProfile();
      const profile = Object.assign({}, baseProfile, initialProfile, {
        id: baseProfile.id,
        kind,
      }) as SavedAIProfile;
      setSavedAIProfiles((current) => [...current, profile]);
      if (kind === 'text') setActiveTextProfileId(profile.id);
      if (kind === 'image') setActiveImageProfileId(profile.id);
      if (kind === 'background-removal') setActiveBackgroundRemovalProfileId(profile.id);
      if (kind === 'voice') setActiveVoiceProfileId(profile.id);
      return profile.id;
    },
    [],
  );

  const handleUpdateAIProfile = useCallback(
    async (profileId: string, updates: AIProfileUpdates) => {
      if (
        profileId === HOSTED_PROXY_PROFILE_ID ||
        profileId === HOSTED_IMAGE_PROXY_PROFILE_ID ||
        profileId === HOSTED_VOICE_PROXY_PROFILE_ID
      )
        return;
      setSavedAIProfiles((current) =>
        updateProfileList(current, profileId, (profile) => Object.assign({}, profile, updates)),
      );
    },
    [],
  );

  const handleSelectAIProfile = useCallback(
    async (kind: 'text' | 'image' | 'background-removal' | 'voice', profileId: string) => {
      if (kind === 'text') setActiveTextProfileId(profileId);
      if (kind === 'image') setActiveImageProfileId(profileId);
      if (kind === 'background-removal') setActiveBackgroundRemovalProfileId(profileId);
      if (kind === 'voice') setActiveVoiceProfileId(profileId);
    },
    [],
  );

  const handleDeleteAIProfile = useCallback(
    async (profileId: string) => {
      if (
        profileId === HOSTED_PROXY_PROFILE_ID ||
        profileId === HOSTED_IMAGE_PROXY_PROFILE_ID ||
        profileId === HOSTED_VOICE_PROXY_PROFILE_ID
      )
        return;
      setSavedAIProfiles((current) => {
        const nextProfiles = current.filter((profile) => profile.id !== profileId);
        if (activeTextProfileId === profileId) {
          setActiveTextProfileId(
            nextProfiles.find((profile) => profile.kind === 'text')?.id ?? null,
          );
        }
        if (activeImageProfileId === profileId) {
          setActiveImageProfileId(
            nextProfiles.find((profile) => profile.kind === 'image')?.id ?? null,
          );
        }
        if (activeBackgroundRemovalProfileId === profileId) {
          setActiveBackgroundRemovalProfileId(
            nextProfiles.find((profile) => profile.kind === 'background-removal')?.id ?? null,
          );
        }
        if (activeVoiceProfileId === profileId) {
          setActiveVoiceProfileId(
            nextProfiles.find((profile) => profile.kind === 'voice')?.id ?? null,
          );
        }
        return nextProfiles;
      });
    },
    [
      activeBackgroundRemovalProfileId,
      activeImageProfileId,
      activeTextProfileId,
      activeVoiceProfileId,
    ],
  );

  const setImageSize = useCallback(
    (value: React.SetStateAction<string>) => {
      if (!activeImageProfileId || activeImageProfileId === HOSTED_IMAGE_PROXY_PROFILE_ID) return;

      setSavedAIProfiles((currentProfiles) => {
        const targetProfile = currentProfiles.find(
          (profile): profile is ImageAIProfile =>
            profile.kind === 'image' && profile.id === activeImageProfileId,
        );
        if (!targetProfile) return currentProfiles;

        const nextValue = typeof value === 'function' ? value(targetProfile.size) : value;
        return updateProfileList(currentProfiles, targetProfile.id, (profile) => ({
          ...profile,
          size: nextValue,
        })) as SavedAIProfile[];
      });
    },
    [activeImageProfileId],
  );

  // NOTE: 用 useCallback 包裹以保持稳定引用，避免依赖此函数的 useCallback 在每次渲染时重建
  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, visible: true, tone });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
  }, []);

  const {
    assistantContext: settingLibraryContext,
    deleteSettingLibrary,
    presetListItems,
    savedListItems,
    saveSettingLibrary,
    useSettingLibraryItem,
  } = useSettingLibrary({
    nodes,
    setNodes,
    getCenterPosition,
    language,
    showToast,
  });

  const { emailCopied, handleContactCopy, handleDownloadAssistantMemory, qqCopied } =
    useEditorUtilityActions({
      assistantMemoryNotes,
      assistantMemorySkillEnabled,
      projectTitle,
      saveFileName,
      showToast,
      storyEditorCopy,
    });

  // 卡片剪贴板
  const [nodeClipboard, setNodeClipboard] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);

  // NOTE: 选中的节点及框选菜单
  // 菜单使用 fixed 层渲染，并根据 ReactFlow 视口 transform + 画布容器 rect 计算屏幕坐标。
  // 这样无论右键框选后拖动画布、滚轮平移/缩放、MiniMap/Controls 改变视野，菜单都会跟着所选节点走。
  const canRenderVideo = true;
  const {
    selectedNodes,
    selectedAssistantTargetNodes,
    showSelectionMenu,
    selectionMenuRef,
    handleViewportMove,
  } = useSelectionMenu({
    nodes,
    getViewport,
    canvasWrapperRef,
  });
  const selectedPlaytestNodeId =
    selectedNodes.length === 1 && selectedNodes[0].type === 'storyNode'
      ? selectedNodes[0].id
      : null;

  // NOTE: 当全局标题显示状态切换时，自动调整带有媒体的卡片高度
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type !== 'storyNode') return node;
        const hasMedia = !!(node.data.imageUrl || node.data.videoUrl || node.data.audioUrl);
        if (!hasMedia) return node;

        const heightValue = node.style?.height ?? node.height ?? node.measured?.height;
        const parsedHeight =
          typeof heightValue === 'number' ? heightValue : Number.parseFloat(String(heightValue));
        const currentHeight = Number.isFinite(parsedHeight) ? parsedHeight : 200;
        const titleAlreadyAdded = node.data.titleHeightAdded === true;

        const shouldReserveTitleHeight = showTitles && storyTitlePlacement === 'inside';

        if (shouldReserveTitleHeight && !titleAlreadyAdded) {
          return {
            ...node,
            style: { ...node.style, height: currentHeight + TITLE_HEIGHT },
            data: { ...node.data, titleHeightAdded: true },
          };
        } else if (!shouldReserveTitleHeight && titleAlreadyAdded) {
          return {
            ...node,
            style: { ...node.style, height: Math.max(50, currentHeight - TITLE_HEIGHT) },
            data: { ...node.data, titleHeightAdded: false },
          };
        }
        return node;
      }),
    );
  }, [showTitles, storyTitlePlacement, setNodes]);

  const { history, setHistory, lastHistoryState, undo, redo } = useEditorHistory({
    edges,
    nodes,
    setEdges,
    setNodes,
  });
  const [didHydrateLocalState, setDidHydrateLocalState] = useState(false);
  // NOTE: ollama 和 hosted 均不需要用户填写 API Key，故不触发警告
  const missingTextApiKey =
    didHydrateLocalState &&
    activeTextProfile?.provider !== 'ollama' &&
    activeTextProfile?.provider !== 'hosted' &&
    !activeTextProfile?.apiKey.trim();
  const missingImageApiKey =
    didHydrateLocalState &&
    (!activeImageProfile ||
      (!isLocalStableDiffusionProvider(activeImageProfile.provider) &&
        activeImageProfile.provider !== 'hosted-image' &&
        !activeImageProfile.apiKey.trim()));
  const missingVoiceApiKey =
    didHydrateLocalState &&
    (!activeVoiceProfile ||
      (activeVoiceProfile.provider === 'youdao'
        ? !(activeVoiceProfile.appKey || activeVoiceProfile.model || '').trim() ||
          !activeVoiceProfile.apiKey.trim()
        : activeVoiceProfile.provider !== 'system' &&
          activeVoiceProfile.provider !== 'hosted-voice' &&
          !activeVoiceProfile.apiKey.trim()));
  const missingBackgroundRemovalApiKey =
    didHydrateLocalState &&
    (!activeBackgroundRemovalProfile ||
      (activeBackgroundRemovalProfile.provider !== 'local-rembg' &&
        (!activeBackgroundRemovalProfile.apiUrl.trim() ||
          !activeBackgroundRemovalProfile.apiKey.trim() ||
          (activeBackgroundRemovalProfile.provider !== 'custom' &&
            !activeBackgroundRemovalProfile.model.trim()))));
  const importModeRef = useRef<'replace' | 'new'>('replace');
  const requestSettingsAttention = useCallback(
    (target: 'text' | 'image' | 'background-removal' | 'voice') => {
      setSettingsAttentionTarget(target);
      setSettingsAttention(false);
      window.setTimeout(() => setSettingsAttention(true), 0);
      window.setTimeout(() => setSettingsAttention(false), 1800);
    },
    [],
  );
  const acknowledgeSettingsAttention = useCallback(() => {
    setSettingsAttentionTarget(null);
    setSettingsAttention(false);
  }, []);
  React.useEffect(() => {
    if (
      (settingsAttentionTarget === 'text' && !missingTextApiKey) ||
      (settingsAttentionTarget === 'image' && !missingImageApiKey) ||
      (settingsAttentionTarget === 'background-removal' && !missingBackgroundRemovalApiKey) ||
      (settingsAttentionTarget === 'voice' && !missingVoiceApiKey)
    ) {
      setSettingsAttentionTarget(null);
    }
  }, [
    missingBackgroundRemovalApiKey,
    missingImageApiKey,
    missingTextApiKey,
    missingVoiceApiKey,
    settingsAttentionTarget,
  ]);

  const editorProjectSettings = useMemo(
    () => ({
      canvasBg,
      edgeStyle,
      edgeColor,
      arrowSize,
      arrowCornerRadius,
      arrowTipAngle,
      nodeHorizontalSpacing,
      nodeVerticalSpacing,
      pasteAsPlainText,
      showNodeActions,
      showStats,
      saveAssistantConversations,
      allowAssistantImageGeneration,
      skipAssistantAgentAnimation,
      assistantMemorySkillEnabled,
      assistantMemoryNotes,
      opaqueAssistantMessagesInGlass,
      opaqueFooterInGlass,
      accentColor,
      presetColors,
      showPresetColors,
      showTitles,
      storyTitlePlacement,
      showLastSavedTime,
      showHeaderActionLabels,
      showSideToolbarLabels,
      generateLength,
      aiProvider,
      imageApiUrl,
      imageModel,
      imageSize,
      ttsApiUrl,
      ttsModel,
      ttsVoice,
      ttsProvider,
      ttsNarrationMode,
      thinkingMode,
      characterImageMode,
      hideStoryImageButtonWithTags,
      sceneImageMode,
      plotStructureGenerateDirection,
      aiGenerationBalance,
      customAiPromptsEnabled,
      aiPrompts,
      aiButtonsConfig,
      scrollMode,
      showMiniMap,
      miniMapPosition,
      showControls,
      showHoverButtonAnimations,
      projectTitle,
      toolbarLayout,
      selectionMenuLayout,
      cardToolbarScale,
      language,
      theme,
      bubbleStyle,
      playTestDarkMode,
      playTestChoicesColumns,
      playTestVideoAutoPlay,
      playTestLayoutMode,
      playTestInteractionMode,
      playTestTypewriterSpeed,
      playTestChoiceDelay,
      playTestChoicesPosition,
      playTestBlurBackground,
      playTestBlurText,
      playTestSkipSingleChoicePopup,
      playTestDimBackground,
      playTestAutoAdvance,
      playTestAutoAdvanceDelay,
      playTestHideCharacterTags,
      playTestHideSceneTags,
      playTestWindowSettings,
      sharedRenderStyle,
    }),
    [
      aiButtonsConfig,
      aiGenerationBalance,
      aiPrompts,
      aiProvider,
      arrowSize,
      arrowCornerRadius,
      arrowTipAngle,
      nodeHorizontalSpacing,
      nodeVerticalSpacing,
      accentColor,
      allowAssistantImageGeneration,
      assistantMemoryNotes,
      assistantMemorySkillEnabled,
      skipAssistantAgentAnimation,
      bubbleStyle,
      canvasBg,
      characterImageMode,
      edgeColor,
      hideStoryImageButtonWithTags,
      sceneImageMode,
      plotStructureGenerateDirection,
      customAiPromptsEnabled,
      edgeStyle,
      generateLength,
      opaqueAssistantMessagesInGlass,
      opaqueFooterInGlass,
      imageApiUrl,
      imageModel,
      imageSize,
      language,
      miniMapPosition,
      pasteAsPlainText,
      playTestBlurBackground,
      playTestBlurText,
      playTestChoiceDelay,
      playTestChoicesColumns,
      playTestChoicesPosition,
      playTestDarkMode,
      playTestDimBackground,
      playTestInteractionMode,
      playTestLayoutMode,
      playTestSkipSingleChoicePopup,
      playTestAutoAdvance,
      playTestAutoAdvanceDelay,
      playTestHideCharacterTags,
      playTestHideSceneTags,
      playTestWindowSettings,
      playTestTypewriterSpeed,
      playTestVideoAutoPlay,
      sharedRenderStyle,
      presetColors,
      projectTitle,
      saveAssistantConversations,
      scrollMode,
      cardToolbarScale,
      selectionMenuLayout,
      showControls,
      showHoverButtonAnimations,
      showMiniMap,
      showNodeActions,
      showPresetColors,
      showStats,
      showTitles,
      storyTitlePlacement,
      showLastSavedTime,
      showHeaderActionLabels,
      showSideToolbarLabels,
      thinkingMode,
      theme,
      toolbarLayout,
      ttsApiUrl,
      ttsModel,
      ttsNarrationMode,
      ttsProvider,
      ttsVoice,
    ],
  );

  const editorProjectSettingsSetters = useMemo(
    () => ({
      setCanvasBg,
      setEdgeStyle,
      setEdgeColor,
      setArrowSize,
      setArrowCornerRadius,
      setArrowTipAngle,
      setNodeHorizontalSpacing,
      setNodeVerticalSpacing,
      setPasteAsPlainText,
      setShowNodeActions,
      setShowStats,
      setSaveAssistantConversations,
      setAllowAssistantImageGeneration,
      setSkipAssistantAgentAnimation,
      setAssistantMemorySkillEnabled,
      setAssistantMemoryNotes,
      setOpaqueAssistantMessagesInGlass,
      setOpaqueFooterInGlass,
      setAccentColor,
      setPresetColors,
      setShowPresetColors,
      setShowTitles,
      setStoryTitlePlacement,
      setShowLastSavedTime,
      setShowHeaderActionLabels,
      setShowSideToolbarLabels,
      setGenerateLength,
      setTtsNarrationMode,
      setImageSize,
      setCharacterImageMode,
      setHideStoryImageButtonWithTags,
      setSceneImageMode,
      setPlotStructureGenerateDirection,
      setAiGenerationBalance,
      setCustomAiPromptsEnabled,
      setAiPrompts,
      setAiButtonsConfig,
      setScrollMode,
      setShowMiniMap,
      setMiniMapPosition,
      setShowControls,
      setShowHoverButtonAnimations,
      setProjectTitle,
      setToolbarLayout,
      setSelectionMenuLayout,
      setCardToolbarScale,
      setLanguage: onAppLanguageChange,
      setTheme,
      setBubbleStyle,
      setPlayTestDarkMode,
      setPlayTestChoicesColumns,
      setPlayTestVideoAutoPlay,
      setPlayTestLayoutMode,
      setPlayTestInteractionMode,
      setPlayTestTypewriterSpeed,
      setPlayTestChoiceDelay,
      setPlayTestChoicesPosition,
      setPlayTestBlurBackground,
      setPlayTestBlurText,
      setPlayTestSkipSingleChoicePopup,
      setPlayTestDimBackground,
      setPlayTestAutoAdvance,
      setPlayTestAutoAdvanceDelay,
      setPlayTestHideCharacterTags,
      setPlayTestHideSceneTags,
      setPlayTestWindowSettings,
      setSharedRenderStyle,
    }),
    [
      setCanvasBg,
      setEdgeStyle,
      setEdgeColor,
      setArrowSize,
      setArrowCornerRadius,
      setArrowTipAngle,
      setNodeHorizontalSpacing,
      setNodeVerticalSpacing,
      setPasteAsPlainText,
      setShowNodeActions,
      setShowStats,
      setSaveAssistantConversations,
      setAllowAssistantImageGeneration,
      setAssistantMemorySkillEnabled,
      setAssistantMemoryNotes,
      setOpaqueAssistantMessagesInGlass,
      setOpaqueFooterInGlass,
      setPresetColors,
      setShowPresetColors,
      setShowTitles,
      setStoryTitlePlacement,
      setGenerateLength,
      setTtsNarrationMode,
      setImageSize,
      setCustomAiPromptsEnabled,
      setAiPrompts,
      setAiButtonsConfig,
      setScrollMode,
      setShowMiniMap,
      setMiniMapPosition,
      setShowControls,
      setCardToolbarScale,
      setProjectTitle,
      setToolbarLayout,
      setSelectionMenuLayout,
      onAppLanguageChange,
      setTheme,
      setBubbleStyle,
      setPlayTestDarkMode,
      setPlayTestChoicesColumns,
      setPlayTestVideoAutoPlay,
      setPlayTestLayoutMode,
      setPlayTestInteractionMode,
      setPlayTestTypewriterSpeed,
      setPlayTestChoiceDelay,
      setPlayTestChoicesPosition,
      setPlayTestBlurBackground,
      setPlayTestBlurText,
      setPlayTestSkipSingleChoicePopup,
      setPlayTestDimBackground,
      setPlayTestAutoAdvance,
      setPlayTestAutoAdvanceDelay,
      setPlayTestHideCharacterTags,
      setPlayTestHideSceneTags,
      setPlayTestWindowSettings,
      setSharedRenderStyle,
    ],
  );

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateResolvedTheme = () => {
      setResolvedTheme(theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme);
    };

    updateResolvedTheme();
    mediaQuery.addEventListener('change', updateResolvedTheme);
    return () => {
      mediaQuery.removeEventListener('change', updateResolvedTheme);
    };
  }, [theme]);

  // Update document theme attribute
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    document.documentElement.style.colorScheme = resolvedTheme;

    const themeColor = resolvedTheme === 'dark' ? '#0d0d0f' : '#ffffff';
    let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = themeColor;
  }, [resolvedTheme]);

  React.useEffect(() => {
    if (!didHydrateLocalState) return;

    void localPersistenceService.saveTheme(theme);
  }, [didHydrateLocalState, theme]);

  const effectiveAccentColor = useMemo(
    () => resolveAccentColor(accentColor, resolvedTheme),
    [accentColor, resolvedTheme],
  );
  const editorAccentStyle = useMemo(
    () =>
      ({
        '--accent': effectiveAccentColor,
        '--accent-hover': mixHexColor(
          effectiveAccentColor,
          resolvedTheme === 'dark' ? '#ffffff' : '#000000',
          resolvedTheme === 'dark' ? 0.24 : 0.14,
        ),
      }) as React.CSSProperties,
    [effectiveAccentColor, resolvedTheme],
  );

  React.useEffect(() => {
    if (!didHydrateLocalState) return;

    void localPersistenceService.saveCloseButtonBehavior(closeButtonBehavior);
    void syncCloseButtonBehavior(closeButtonBehavior);
  }, [closeButtonBehavior, didHydrateLocalState]);

  React.useEffect(() => {
    if (!didHydrateLocalState) return;

    void localPersistenceService.saveAIProfiles({
      profiles: savedAIProfiles,
      activeTextProfileId:
        activeTextProfileId === HOSTED_PROXY_PROFILE_ID ? null : activeTextProfileId,
      activeImageProfileId:
        activeImageProfileId === HOSTED_IMAGE_PROXY_PROFILE_ID ? null : activeImageProfileId,
      activeBackgroundRemovalProfileId: activeBackgroundRemovalProfileId,
      activeVoiceProfileId:
        activeVoiceProfileId === HOSTED_VOICE_PROXY_PROFILE_ID ? null : activeVoiceProfileId,
    });
  }, [
    didHydrateLocalState,
    savedAIProfiles,
    activeTextProfileId,
    activeImageProfileId,
    activeBackgroundRemovalProfileId,
    activeVoiceProfileId,
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== id));
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    },
    [setEdges, setNodes],
  );

  const handleDeleteNodeOutputEdges = useCallback(
    (nodeId: string, sourceHandle: string) => {
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => edge.source !== nodeId || edge.sourceHandle !== sourceHandle),
      );
    },
    [setEdges],
  );

  useStoryPresentationBindings({
    edges,
    nodes,
    setNodes,
  });

  useCanvasDnD({
    canvasWrapperRef,
    getViewport,
    showTitles: showTitles && storyTitlePlacement === 'inside',
    language,
    titleHeight: TITLE_HEIGHT,
    getMediaDimensions,
    setNodes,
  });

  const {
    handleCopy,
    handlePaste,
    deleteSelected,
    hideSelected,
    arrangeSelected,
    handleGenerateSelectedSpeech,
    unhideAllNodes,
  } = useSelectionActions({
    nodes,
    edges,
    language,
    ttsLoading,
    ttsProvider,
    ttsApiKey,
    ttsApiUrl,
    ttsAppKey,
    ttsModel,
    ttsVoice,
    ttsNarrationMode,
    nodeClipboard,
    setNodeClipboard,
    setNodes,
    setEdges,
    setTtsLoading,
    getCenterPosition,
    showToast,
  });

  useEditorKeyboardShortcuts({
    deleteSelected,
    handleCopy,
    handlePaste,
    redo,
    showToast,
    textCopiedMessage: storyEditorCopy.textCopied,
    undo,
  });

  const handleUpdateNode = useCallback(
    (id: string, data: any) => {
      setNodes((nds) => {
        const renamedNode = nds.find((n) => n.id === id);
        const rename = renamedNode ? getSettingRename(renamedNode, data) : null;

        return nds.map((n) => {
          if (n.id === id) {
            if (data.isRoot) {
              return { ...n, data: { ...n.data, ...data, isRoot: true } };
            }
            return { ...n, data: { ...n.data, ...data } };
          } else if (data.isRoot) {
            return { ...n, data: { ...n.data, isRoot: false } };
          } else if (rename && n.type === 'storyNode' && typeof n.data?.text === 'string') {
            const nextText = replaceMentionNameInText(n.data.text, rename.oldName, rename.newName);
            if (nextText !== n.data.text) {
              return { ...n, data: { ...n.data, text: nextText } };
            }
          }
          return n;
        });
      });
    },
    [setNodes],
  );

  const handleGenerateStoryNodeSpeech = useStoryNodeSpeechGeneration({
    activeVoiceProfile,
    handleUpdateNode,
    nodes,
    requestSettingsAttention,
    setTtsLoading,
    showDialogAlert,
    showToast,
    storyEditorCopy,
    ttsApiKey,
    ttsApiUrl,
    ttsAppKey,
    ttsAppSecret,
    ttsLoading,
    ttsModel,
    ttsNarrationMode,
    ttsProvider,
    ttsVoice,
  });

  const {
    callAIForText,
    callAIForTextResult,
    callAIForTextStream,
    generateSetting,
    handleAIAnalyze: runAIAnalyze,
  } = useAIActions({
    nodes,
    edges,
    aiPrompts,
    aiProvider,
    textApiKey,
    textApiUrl: activeTextProfile?.apiUrl ?? '',
    textModel: activeTextProfile?.model ?? DEFAULT_TEXT_MODEL,
    thinkingMode,
    generateLength,
    aiGenerationBalance,
    handleUpdateNode,
    setNodes,
    setThinkingContent,
  });

  const {
    handleAddTextToImage,
    handleRemoveTextFromImage,
    handleGenerateSettingNodeImage,
    handleGenerateStoryNodeImage,
    handleRemoveCharacterImageBackground,
    handleExtractMedia,
  } = useMediaActions({
    nodes,
    edges,
    language,
    imageApiKey,
    imageApiUrl,
    imageModel,
    imageSize,
    imageProvider,
    imageNegativePrompt,
    imageSteps,
    imageCfgScale,
    imageSampler,
    imageSeed,
    imageRestoreFaces,
    imageEnableHr,
    imageHrScale,
    imageDenoisingStrength,
    imageRemoveBackground,
    backgroundRemovalApiUrl,
    backgroundRemovalApiKey,
    backgroundRemovalModel,
    backgroundRemovalProvider,
    sceneImageMode,
    showTitles: showTitles && storyTitlePlacement === 'inside',
    setImageSize,
    setNodes,
    showToast,
    onMissingImageApiKeyRequest: () => {
      requestSettingsAttention('image');
      showToast(storyEditorCopy.imageApiRequired);
    },
    onMissingBackgroundRemovalApiRequest: () => {
      requestSettingsAttention('background-removal');
    },
  });

  const handleAddConnectedNode = useCallback(
    (sourceId: string, side: string) => {
      // NOTE: 全部在 setNodes 函数式更新内部读取最新节点，消除对外部 nodes 的依赖，
      // 防止 nodes 变化导致此回调重建，进而引发 nodesWithCallbacks 重算的无限循环
      const newId = uuidv4();
      const horizontalSpacing = showNodeActions ? nodeHorizontalSpacing : 120;
      const verticalSpacing = showNodeActions ? nodeVerticalSpacing : 120;

      let targetHandle = 'left';

      setNodes((nds) => {
        const sourceNode = nds.find((n) => n.id === sourceId);
        if (!sourceNode) return nds;

        const srcW = sourceNode.measured?.width || 300;
        const srcH = sourceNode.measured?.height || AI_STORY_CARD_HEIGHT;

        let newX = sourceNode.position.x;
        let newY = sourceNode.position.y;

        if (side === 'top') {
          newY -= AI_STORY_CARD_HEIGHT + verticalSpacing;
          targetHandle = 'bottom';
        } else if (side === 'bottom') {
          newY += srcH + verticalSpacing;
          targetHandle = 'top';
        } else if (side === 'left') {
          newX -= 300 + horizontalSpacing;
          targetHandle = 'right';
        } else if (side === 'right') {
          newX += srcW + horizontalSpacing;
          targetHandle = 'left';
        }

        const initialBranch =
          sourceId === 'root' && side === 'bottom'
            ? nds.find((node) => node.id === 'initial-branch')
            : undefined;
        if (initialBranch) {
          const initialBranchWidthValue =
            initialBranch.measured?.width ?? initialBranch.style?.width ?? 300;
          const initialBranchWidth =
            typeof initialBranchWidthValue === 'number'
              ? initialBranchWidthValue
              : Number.parseFloat(initialBranchWidthValue) || 300;
          newX = initialBranch.position.x + initialBranchWidth + horizontalSpacing;
          newY = initialBranch.position.y;
        }

        const isOccupied = (x: number, y: number) =>
          nds.some((n) => Math.abs(n.position.x - x) < 50 && Math.abs(n.position.y - y) < 50);

        let attempts = 0;
        while (isOccupied(newX, newY) && attempts < 10) {
          if (side === 'bottom' || side === 'top') {
            newX += 300 + horizontalSpacing;
          } else {
            newY += AI_STORY_CARD_HEIGHT + verticalSpacing;
          }
          attempts++;
        }

        const newNode: Node = {
          id: newId,
          type: 'storyNode',
          position: { x: newX, y: newY },
          style: { width: 300, height: MIN_STORY_CARD_HEIGHT },
          data: {
            id: newId,
            title: storyEditorCopy.branchTitle,
            shape: 'square',
            color: '#ffffff',
            sizeMode: 'auto',
            text: '',
          } satisfies StoryNodeData,
        };

        // 检查 sourceId 是否属于任何动态分组，若是则将新节点也加入分组
        const updatedNodes = nds.map((node) => {
          if (node.type === 'groupNode') {
            const childIds = Array.isArray(node.data.childIds) ? node.data.childIds : [];
            if (childIds.includes(sourceId)) {
              return {
                ...node,
                data: { ...node.data, childIds: [...childIds, newId] },
              };
            }
          }
          return node;
        });

        return [...updatedNodes, newNode];
      });

      setEdges((eds) => [
        ...eds,
        {
          id: `e-${sourceId}-${newId}`,
          source: sourceId,
          sourceHandle: side,
          target: newId,
          targetHandle,
        },
      ]);
    },
    [nodeHorizontalSpacing, nodeVerticalSpacing, setNodes, setEdges, showNodeActions],
  );

  const {
    addNewShape,
    addNewTextNode,
    addNewHeadingTextNode,
    addNewSummaryNode,
    addNewNumberConditionNode,
    addNewBatchReplaceNode,
    addNewPlotStructureNode,
    addNewCharacterNode,
    addNewSceneNode,
    handleMediaUpload,
    addNewBackgroundCard,
    addNewDynamicWrap,
    wrapNodesWithDynamicGroup,
    wrapWithDynamicGroup,
    wrapSelectedWithBackground,
    convertBackgroundToDynamicGroup,
    convertDynamicGroupToBackground,
    connectSelectedToSummaryNode,
  } = useNodeActions({
    nodes,
    language,
    showTitles: showTitles && storyTitlePlacement === 'inside',
    titleHeight: TITLE_HEIGHT,
    getCenterPosition,
    getMediaDimensions,
    setNodes,
    setEdges,
    setShowSaveNameModal,
    dynamicWrapTitle: t.dynamicWrap,
    backgroundCardTitle: t.bgCard,
  });

  const startCardPlacement = useCallback(
    (kind: 'story' | 'background' | 'dynamicWrap' | 'bodyText' | 'headingText') => {
      setCardPlacementStart(null);
      setBackgroundCardDragStart(null);
      setDynamicWrapDragStart(null);
      setPendingCardPlacement(kind);
    },
    [],
  );

  const handleCardPlacement = useCallback(
    (event: React.MouseEvent) => {
      if (!pendingCardPlacement || isMobile) return;

      const placement = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (pendingCardPlacement === 'story') {
        addNewShape('square', placement);
        setPendingCardPlacement(null);
        return;
      }

      if (pendingCardPlacement === 'bodyText') {
        addNewTextNode(placement);
        setPendingCardPlacement(null);
        return;
      }

      if (pendingCardPlacement === 'headingText') {
        addNewHeadingTextNode(placement);
        setPendingCardPlacement(null);
        return;
      }

      if (pendingCardPlacement === 'dynamicWrap') return;

      if (!cardPlacementStart) {
        setCardPlacementStart({
          flow: placement,
          screen: { x: event.clientX, y: event.clientY },
        });
        return;
      }

      const selectionRect = {
        x: Math.min(cardPlacementStart.flow.x, placement.x),
        y: Math.min(cardPlacementStart.flow.y, placement.y),
        width: Math.abs(placement.x - cardPlacementStart.flow.x),
        height: Math.abs(placement.y - cardPlacementStart.flow.y),
      };

      if (pendingCardPlacement === 'background') {
        addNewBackgroundCard(selectionRect);
      } else {
        wrapNodesWithDynamicGroup(getIntersectingNodes(selectionRect, true).map((node) => node.id));
      }

      setPendingCardPlacement(null);
      setCardPlacementStart(null);
    },
    [
      addNewBackgroundCard,
      addNewShape,
      addNewHeadingTextNode,
      addNewTextNode,
      cardPlacementStart,
      getIntersectingNodes,
      isMobile,
      pendingCardPlacement,
      screenToFlowPosition,
      wrapNodesWithDynamicGroup,
    ],
  );

  const handleDynamicWrapSelectionStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (pendingCardPlacement !== 'dynamicWrap' || event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (!target.closest('.react-flow__pane')) return;

      event.preventDefault();
      event.stopPropagation();
      setDynamicWrapDragStart({
        flow: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        screen: { x: event.clientX, y: event.clientY },
      });
    },
    [pendingCardPlacement, screenToFlowPosition],
  );

  const handleBackgroundCardPlacementStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (pendingCardPlacement !== 'background' || event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (!target.closest('.react-flow__pane')) return;

      event.preventDefault();
      event.stopPropagation();
      setBackgroundCardDragStart({
        flow: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        screen: { x: event.clientX, y: event.clientY },
      });
    },
    [pendingCardPlacement, screenToFlowPosition],
  );

  const handleBackgroundCardPlacementEnd = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!backgroundCardDragStart || pendingCardPlacement !== 'background' || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const end = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const movedEnough =
        Math.abs(event.clientX - backgroundCardDragStart.screen.x) > 5 ||
        Math.abs(event.clientY - backgroundCardDragStart.screen.y) > 5;

      if (movedEnough) {
        addNewBackgroundCard({
          x: Math.min(backgroundCardDragStart.flow.x, end.x),
          y: Math.min(backgroundCardDragStart.flow.y, end.y),
          width: Math.abs(end.x - backgroundCardDragStart.flow.x),
          height: Math.abs(end.y - backgroundCardDragStart.flow.y),
        });
        setPendingCardPlacement(null);
        setCardPlacementStart(null);
      } else if (!cardPlacementStart) {
        setCardPlacementStart(backgroundCardDragStart);
      } else {
        addNewBackgroundCard({
          x: Math.min(cardPlacementStart.flow.x, backgroundCardDragStart.flow.x),
          y: Math.min(cardPlacementStart.flow.y, backgroundCardDragStart.flow.y),
          width: Math.abs(backgroundCardDragStart.flow.x - cardPlacementStart.flow.x),
          height: Math.abs(backgroundCardDragStart.flow.y - cardPlacementStart.flow.y),
        });
        setPendingCardPlacement(null);
        setCardPlacementStart(null);
      }

      setBackgroundCardDragStart(null);
    },
    [
      addNewBackgroundCard,
      backgroundCardDragStart,
      cardPlacementStart,
      pendingCardPlacement,
      screenToFlowPosition,
    ],
  );

  const handleDynamicWrapSelectionEnd = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!dynamicWrapDragStart || pendingCardPlacement !== 'dynamicWrap' || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const end = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const movedEnough =
        Math.abs(event.clientX - dynamicWrapDragStart.screen.x) > 5 ||
        Math.abs(event.clientY - dynamicWrapDragStart.screen.y) > 5;
      if (movedEnough) {
        wrapNodesWithDynamicGroup(
          getIntersectingNodes(
            {
              x: Math.min(dynamicWrapDragStart.flow.x, end.x),
              y: Math.min(dynamicWrapDragStart.flow.y, end.y),
              width: Math.abs(end.x - dynamicWrapDragStart.flow.x),
              height: Math.abs(end.y - dynamicWrapDragStart.flow.y),
            },
            true,
          ).map((node) => node.id),
        );
        setPendingCardPlacement(null);
      }
      setDynamicWrapDragStart(null);
    },
    [
      dynamicWrapDragStart,
      getIntersectingNodes,
      pendingCardPlacement,
      screenToFlowPosition,
      wrapNodesWithDynamicGroup,
    ],
  );

  useEffect(() => {
    if (isMobile) {
      setPendingCardPlacement(null);
      setCardPlacementStart(null);
      setBackgroundCardDragStart(null);
      setDynamicWrapDragStart(null);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!pendingCardPlacement) return;

    const cancelPlacement = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPendingCardPlacement(null);
        setCardPlacementStart(null);
        setBackgroundCardDragStart(null);
        setDynamicWrapDragStart(null);
      }
    };

    window.addEventListener('keydown', cancelPlacement);
    return () => window.removeEventListener('keydown', cancelPlacement);
  }, [pendingCardPlacement]);

  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges],
  );

  const toggleStorylineHighlight = useCallback(
    (nodeId: string | null) => {
      if (
        !nodeId ||
        (highlightedPath &&
          nodes.find((n) => n.id === nodeId)?.selected &&
          highlightedPath.nodes.has(nodeId))
      ) {
        setHighlightedPath(null);
        return;
      }

      const pathNodes = new Set<string>();
      const pathEdges = new Set<string>();
      const pathEdgeColors = new Map<string, string[]>();
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const incomingEdgesByTarget = new Map<string, typeof edges>();
      const outgoingEdgesBySource = new Map<string, typeof edges>();
      const storylineBranchColors = [
        '#f43f5e',
        '#14b8a6',
        '#f59e0b',
        '#8b5cf6',
        '#06b6d4',
        '#84cc16',
        '#ec4899',
        '#6366f1',
      ];
      const defaultStorylineColor = storylineBranchColors[0];
      const storylineNumberByColor = new Map(
        storylineBranchColors.map((color, index) => [color, index + 1]),
      );

      edges.forEach((edge) => {
        const incoming = incomingEdgesByTarget.get(edge.target) || [];
        incoming.push(edge);
        incomingEdgesByTarget.set(edge.target, incoming);

        const outgoing = outgoingEdgesBySource.get(edge.source) || [];
        outgoing.push(edge);
        outgoingEdgesBySource.set(edge.source, outgoing);
      });

      const maxSerialSumByNodeId = new Map<string, number>();
      const visitingSumNodes = new Set<string>();
      const getMaxSerialSumToNode = (id: string): number => {
        const cached = maxSerialSumByNodeId.get(id);
        if (typeof cached === 'number') return cached;
        if (visitingSumNodes.has(id)) return 0;

        visitingSumNodes.add(id);
        const node = nodeById.get(id);
        const ownValue =
          node && typeof node.data.nodeValue === 'number' && Number.isFinite(node.data.nodeValue)
            ? node.data.nodeValue
            : 0;
        const incomingEdges = incomingEdgesByTarget.get(id) || [];
        const maxUpstreamValue = incomingEdges.reduce(
          (maxValue, edge) => Math.max(maxValue, getMaxSerialSumToNode(edge.source)),
          0,
        );
        const total = ownValue + maxUpstreamValue;
        visitingSumNodes.delete(id);
        maxSerialSumByNodeId.set(id, total);
        return total;
      };

      const getNumberConditionInputTotal = (conditionNodeId: string) => {
        const directIncomingEdges = incomingEdgesByTarget.get(conditionNodeId) || [];
        return directIncomingEdges.reduce(
          (maxValue, edge) => Math.max(maxValue, getMaxSerialSumToNode(edge.source)),
          0,
        );
      };

      const getMaxSerialIncomingEdges = (id: string) => {
        const incomingEdges = incomingEdgesByTarget.get(id) || [];
        if (incomingEdges.length <= 1) return incomingEdges;
        const maxUpstreamValue = incomingEdges.reduce(
          (maxValue, edge) => Math.max(maxValue, getMaxSerialSumToNode(edge.source)),
          0,
        );
        return incomingEdges.filter(
          (edge) => getMaxSerialSumToNode(edge.source) === maxUpstreamValue,
        );
      };

      const getNumberConditionSourceHandleForTotal = (conditionNodeId: string, total: number) => {
        const currentNode = nodeById.get(conditionNodeId);
        if (currentNode?.type !== 'numberConditionNode') return null;

        const ranges =
          (currentNode.data.ranges as { id: string; min: number; max: number }[]) || [];
        const matchedRange = ranges.find(
          (range) => range.min <= range.max && total >= range.min && total <= range.max,
        );
        const threshold = (currentNode.data.threshold as number) || 0;
        return matchedRange
          ? `out-range-${matchedRange.id}`
          : total >= threshold
            ? 'out-greater'
            : 'out-less-equal';
      };

      const getActiveNumberConditionSourceHandle = (conditionNodeId: string) =>
        getNumberConditionSourceHandleForTotal(
          conditionNodeId,
          getNumberConditionInputTotal(conditionNodeId),
        );

      const getNodeValue = (id: string) => {
        const value = nodeById.get(id)?.data.nodeValue;
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
      };

      const getBranchColor = (branchIndex: number, currentPathColor: string) => {
        if (branchIndex <= 0) return currentPathColor;
        const alternateColors = storylineBranchColors.filter((item) => item !== currentPathColor);
        return alternateColors[(branchIndex - 1) % alternateColors.length];
      };

      type UpstreamTraceState = {
        nodes: string[];
        edges: Edge[];
        total: number;
      };

      const upstreamTraceStateCache = new Map<string, UpstreamTraceState[]>();
      const getUpstreamTraceStatesToNode = (
        id: string,
        visiting = new Set<string>(),
      ): UpstreamTraceState[] => {
        const cached = upstreamTraceStateCache.get(id);
        if (cached) return cached;
        if (visiting.has(id)) return [];

        visiting.add(id);
        const incomingEdges = incomingEdgesByTarget.get(id) || [];
        const ownValue = getNodeValue(id);
        const states =
          incomingEdges.length === 0
            ? [{ nodes: [id], edges: [], total: ownValue }]
            : incomingEdges.flatMap((edge) => {
                const sourceNode = nodeById.get(edge.source);
                if (sourceNode?.type === 'numberConditionNode') {
                  const requiredHandle =
                    edge.sourceHandle || getActiveNumberConditionSourceHandle(edge.source);
                  return getNumberConditionInputStatesForHandle(
                    edge.source,
                    requiredHandle,
                    new Set(visiting),
                  ).map((state) => ({
                    nodes: [...state.nodes, id],
                    edges: [...state.edges, edge],
                    total: state.total + ownValue,
                  }));
                }

                return getUpstreamTraceStatesToNode(edge.source, new Set(visiting)).map(
                  (state) => ({
                    nodes: [...state.nodes, id],
                    edges: [...state.edges, edge],
                    total: state.total + ownValue,
                  }),
                );
              });

        visiting.delete(id);
        upstreamTraceStateCache.set(id, states);
        return states;
      };

      const getNumberConditionInputStatesForHandle = (
        conditionNodeId: string,
        requiredHandle: string | null | undefined,
        visiting = new Set<string>(),
      ): UpstreamTraceState[] => {
        if (!requiredHandle || visiting.has(conditionNodeId)) return [];

        visiting.add(conditionNodeId);
        const states = (incomingEdgesByTarget.get(conditionNodeId) || []).flatMap((edge) =>
          getUpstreamTraceStatesToNode(edge.source, new Set(visiting))
            .filter(
              (state) =>
                getNumberConditionSourceHandleForTotal(conditionNodeId, state.total) ===
                requiredHandle,
            )
            .map((state) => ({
              nodes: [...state.nodes, conditionNodeId],
              edges: [...state.edges, edge],
              total: state.total,
            })),
        );
        visiting.delete(conditionNodeId);
        return states;
      };

      const addPathNode = (id: string) => {
        pathNodes.add(id);
      };

      const addPathEdge = (edge: Edge, color = defaultStorylineColor) => {
        pathEdges.add(edge.id);
        const colors = pathEdgeColors.get(edge.id) || [];
        if (!colors.includes(color)) {
          pathEdgeColors.set(edge.id, [...colors, color]);
        }
      };

      const addUpstreamTraceState = (state: UpstreamTraceState, color: string) => {
        state.nodes.forEach((stateNodeId) => addPathNode(stateNodeId));
        state.edges.forEach((stateEdge) => addPathEdge(stateEdge, color));
      };

      const traceUp = (id: string, maxSerialOnly = false, color = defaultStorylineColor) => {
        if (pathNodes.has(id)) return;
        addPathNode(id);
        const currentNode = nodeById.get(id);
        const shouldUseMaxSerialInput =
          maxSerialOnly || currentNode?.type === 'numberConditionNode';
        const incomingEdges = shouldUseMaxSerialInput
          ? getMaxSerialIncomingEdges(id)
          : incomingEdgesByTarget.get(id) || [];

        incomingEdges.forEach((edge, index) => {
          const sourceNode = nodeById.get(edge.source);
          if (sourceNode?.type === 'numberConditionNode') {
            addPathNode(edge.source);
            const requiredHandle =
              edge.sourceHandle || getActiveNumberConditionSourceHandle(edge.source);
            getNumberConditionInputStatesForHandle(edge.source, requiredHandle).forEach(
              (state, stateIndex) => {
                const stateColor = getBranchColor(index + stateIndex, color);
                addPathEdge(edge, stateColor);
                addUpstreamTraceState(state, stateColor);
              },
            );
            return;
          }

          addPathEdge(edge, color);
          traceUp(edge.source, shouldUseMaxSerialInput, color);
        });
      };

      const traceDown = (id: string) => {
        const visited = new Set<string>();
        const queue = [
          {
            id,
            color: defaultStorylineColor,
            total: nodeById.get(id)?.type === 'numberConditionNode' ? 0 : getNodeValue(id),
          },
        ];
        addPathNode(id);

        while (queue.length > 0) {
          const { id: currentId, color, total } = queue.shift()!;
          const visitKey = `${currentId}:${total}:${color}`;
          if (visited.has(visitKey)) continue;
          visited.add(visitKey);
          addPathNode(currentId);

          const currentNode = nodeById.get(currentId);
          const outgoingEdges =
            currentNode?.type === 'numberConditionNode'
              ? (outgoingEdgesBySource.get(currentId) || []).filter(
                  (edge) =>
                    edge.sourceHandle === getNumberConditionSourceHandleForTotal(currentId, total),
                )
              : outgoingEdgesBySource.get(currentId) || [];

          outgoingEdges.forEach((edge, index) => {
            const edgeColor =
              currentNode?.type === 'numberConditionNode' ? color : getBranchColor(index, color);
            const targetNode = nodeById.get(edge.target);
            const nextTotal =
              targetNode?.type === 'numberConditionNode'
                ? total
                : total + getNodeValue(edge.target);
            addPathEdge(edge, edgeColor);
            if (!visited.has(`${edge.target}:${nextTotal}:${edgeColor}`)) {
              queue.push({ id: edge.target, color: edgeColor, total: nextTotal });
            }
          });
        }
      };

      traceUp(nodeId);
      traceDown(nodeId);

      const nodeStorylineNumberSets = new Map<string, Set<number>>();
      const addNodeStorylineNumber = (id: string, number: number) => {
        const numbers = nodeStorylineNumberSets.get(id) || new Set<number>();
        numbers.add(number);
        nodeStorylineNumberSets.set(id, numbers);
      };

      pathEdges.forEach((edgeId) => {
        const edge = edges.find((item) => item.id === edgeId);
        if (!edge) return;
        (pathEdgeColors.get(edgeId) || [defaultStorylineColor]).forEach((color) => {
          const number = storylineNumberByColor.get(color) || 1;
          addNodeStorylineNumber(edge.source, number);
          addNodeStorylineNumber(edge.target, number);
        });
      });

      const nodeStorylineNumbers = new Map<string, number[]>();
      pathNodes.forEach((id) => {
        const numbers = [...(nodeStorylineNumberSets.get(id) || new Set([1]))].sort(
          (first, second) => first - second,
        );
        nodeStorylineNumbers.set(id, numbers);
      });

      setHighlightedPath({
        nodes: pathNodes,
        edges: pathEdges,
        edgeColors: pathEdgeColors,
        nodeStorylineNumbers,
      });
      showToast(storyEditorCopy.storylineTraced);
    },
    [nodes, edges, highlightedPath, showToast, storyEditorCopy.storylineTraced],
  );

  // NOTE: 卡片 AI 操作现在统一进入右侧助手，不再使用独立操作弹窗。
  // =========================================================================
  // Assistant System (extracted to useAssistantSystem)
  // =========================================================================
  const {
    assistantOpen,
    setAssistantOpen,
    assistantPanelWidth,
    assistantResizing,
    assistantInput,
    setAssistantInput,
    assistantInputContexts,
    setAssistantInputContexts,
    assistantLoading,
    assistantListening,
    assistantDocuments,
    assistantDocumentLoading,
    assistantArticleAnalysis,
    assistantTasks,
    activeAssistantTaskId,
    setAssistantTasks,
    setActiveAssistantTaskId,
    handleSelectAssistantTask,
    assistantMessages,
    assistantMessagesRef,
    handleNewAssistantTask,
    handleStartCardReview,
    handleRenameAssistantTask,
    handleRequestCloseAssistantTask,
    handleConfirmCloseAssistantTask,
    handleCancelCloseAssistantTask,
    assistantTaskPendingCloseId,
    handleAssistantSend,
    handleStopAssistantGeneration,
    handleAssistantOptionSelect,
    handleAssistantCandidateNodeSelect,
    handleStartAssistantFlow,
    handleAssistantDocumentUpload,
    handleRemoveAssistantDocument,
    handleAssistantVoiceInput,
    toggleAssistantThought,
    handleAssistantResizePointerDown,
    handleAssistantResizePointerMove,
    handleAssistantResizePointerUp,
    handleAssistantUndo,
    handleAssistantRedo,
    canAssistantUndo,
    canAssistantRedo,
    resetAssistantTasks,
    handleAssistantMessagePositionClick,
    miniMapOverlayStyle,
  } = useAssistantSystem({
    nodes,
    edges,
    setNodes,
    setEdges,
    getCenterPosition,
    getViewportZoom,
    language,
    isMobile,
    effectiveFlowWidth,
    bubbleStyle,
    miniMapPosition,
    runAgentCardPlacement,
    startAgentWaiting,
    stopAgentWaiting,
    handleGenerateSettingNodeImage,
    handleGenerateStoryNodeImage,
    callAIForTextResult,
    callAIForTextStream,
    allowAssistantImageGeneration,
    skipAssistantAgentAnimation,
    missingImageApiKey,
    missingTextApiKey,
    assistantMemorySkillEnabled,
    assistantMemoryNotes,
    setAssistantMemoryNotes,
    settingLibraryContext,
    selectedAssistantTargetNodes,
    showToast,
    requestSettingsAttention,
  });

  const handleAIButtonClick = useCallback(
    (nodeId: string) => {
      const targetNode = nodes.find(
        (node) =>
          node.id === nodeId &&
          (node.type === 'storyNode' || node.type === 'characterNode' || node.type === 'sceneNode'),
      );
      if (!targetNode) return;

      const incomingStoryIds = edges
        .filter((edge) => edge.target === nodeId)
        .map((edge) => edge.source);
      const outgoingStoryIds = edges
        .filter((edge) => edge.source === nodeId)
        .map((edge) => edge.target);
      const relatedStoryNodes = [
        ...nodes.filter((node) => incomingStoryIds.includes(node.id) && node.type === 'storyNode'),
        targetNode,
        ...nodes.filter((node) => outgoingStoryIds.includes(node.id) && node.type === 'storyNode'),
      ];
      const uniqueRelatedNodes = relatedStoryNodes.filter(
        (node, index, items) => items.findIndex((item) => item.id === node.id) === index,
      );
      const cardReviewCopy = assistantPanelCopy(language).cardReview;
      const targetTitle = String(
        targetNode.data?.title ||
          targetNode.data?.characterName ||
          targetNode.data?.sceneName ||
          cardReviewCopy.selectedCard,
      );
      const content = `${cardReviewCopy.adjacentContext}:\n${uniqueRelatedNodes
        .map((node) => {
          const title = String(
            node.data?.title || node.data?.characterName || node.data?.sceneName || '',
          );
          const text = htmlToSpeechText(
            String(node.data?.text || node.data?.description || node.data?.traits || ''),
          );
          const marker = node.id === nodeId ? '[TARGET]' : '[CONTEXT]';
          return `${marker} ${title}\n${text}`.trim();
        })
        .join('\n\n---\n\n')}`;
      const imageUrls = new Set<string>();
      const videoUrls = new Set<string>();
      uniqueRelatedNodes.forEach((node) => {
        const imageUrl = node.data?.imageUrl;
        const videoUrl = node.data?.videoUrl;
        if (typeof imageUrl === 'string' && imageUrl.trim()) imageUrls.add(imageUrl);
        if (typeof videoUrl === 'string' && videoUrl.trim()) videoUrls.add(videoUrl);
      });
      const targetPreviewImageUrl =
        typeof targetNode.data?.imageUrl === 'string' && targetNode.data.imageUrl.trim()
          ? targetNode.data.imageUrl
          : imageUrls.values().next().value;
      const targetPreviewText = htmlToSpeechText(
        String(
          targetNode.data?.text || targetNode.data?.description || targetNode.data?.traits || '',
        ),
      );

      void handleStartCardReview({
        id: `selection:${nodeId}`,
        title: targetTitle,
        content,
        cardCount: 1,
        source: 'selection',
        nodeIds: [nodeId],
        previewImageUrl: targetPreviewImageUrl,
        previewText: targetPreviewText,
        assetCounts: { images: imageUrls.size, videos: videoUrls.size },
      });
    },
    [edges, handleStartCardReview, language, nodes],
  );

  const handlePrefillAssistantFromRegion = useRegionAssistantContext({
    assistantInputContexts,
    backgroundLabel: t.bgCard,
    dynamicGroupLabel: t.dynamicWrap,
    edges,
    nodes,
    setAssistantInputContexts,
    setAssistantOpen,
    showToast,
    storyEditorCopy,
  });

  // =========================================================================
  // Project Management (extracted to useProjectManagement)
  // =========================================================================
  const {
    confirmExportJSON,
    handleImportZIP,
    autoSaveData,
    showAutoSaveModal,
    discardAutoSave,
    recoverAutoSave,
    loadExampleTemplates,
    handleApplySettingsToOtherProjects,
    saveCurrentProject,
    saveProjectAsCopy,
    handleCreateProject,
    handleRenameProject,
    handleDeleteProject,
    handleDeleteProjects,
    requestProjectAction,
    handleConfirmSaveCurrentProject,
    handleDiscardCurrentProjectChanges,
    handleCancelProjectAction,
    handleConfirmAppClose,
    handleCancelAppClose,
    handleExportProjectFromList,
    handleExportProjectsBundleFromList,
    handleOpenProject,
    handleSetStartupProject,
    handleImportProjectFromHome,
    handleImportExampleTemplate,
    handleDownloadExampleTemplate,
    openImportPicker,
    handleChooseDefaultProjectSaveLocation,
  } = useProjectManagement({
    nodes,
    edges,
    setNodes,
    setEdges,
    language,
    isMobile,
    editorProjectSettings,
    editorProjectSettingsSetters,
    savedAIProfiles,
    setSavedAIProfiles,
    activeTextProfileId,
    setActiveTextProfileId,
    activeImageProfileId,
    setActiveImageProfileId,
    activeBackgroundRemovalProfileId,
    setActiveBackgroundRemovalProfileId,
    activeVoiceProfileId,
    setActiveVoiceProfileId,
    getExportedAIProfiles,
    theme,
    setTheme,
    closeButtonBehavior,
    setCloseButtonBehavior,
    isDirty,
    setIsDirty,
    lastSavedSnapshot,
    setHistory,
    lastHistoryState,
    assistantTasks,
    activeAssistantTaskId,
    setAssistantTasks,
    setActiveAssistantTaskId,
    resetAssistantTasks,
    saveFileName,
    setSaveFileName,
    projectTitle,
    setProjectTitle,
    setShowSaveNameModal,
    setShowProjectHome,
    setProjectIdsPendingDeletion,
    setShowProjectSavePrompt,
    setShowAppClosePrompt,
    setProjectListLoading,
    setLastSavedTime,
    jsonInputRef,
    importModeRef,
    pendingInitialSnapshotSyncProjectIdRef,
    pendingInitialSnapshotCandidateRef,
    createCurrentProjectThumbnail,
    defaultProjectSaveDir,
    setDefaultProjectSaveDir,
    setStartupProjectId,
    defaultEdgeOptions,
    currentProjectId,
    setCurrentProjectId,
    currentProjectFilePath,
    setCurrentProjectFilePath,
    projectIdToLoad,
    setProjectIdToLoad,
    pendingHomeProjectId,
    setPendingHomeProjectId,
    currentProjectPersisted,
    setCurrentProjectPersisted,
    projectSummaries,
    setProjectSummaries,
    exampleTemplates,
    setExampleTemplates,
    examplesLoading,
    setExamplesLoading,
    examplesError,
    setExamplesError,
    pendingProjectAction,
    setPendingProjectAction,
    isProjectSnapshotSynced,
    setIsProjectSnapshotSynced,
    isSavingProject,
    setIsSavingProject,
    didHydrateLocalState,
    setDidHydrateLocalState,
    showToast,
  });

  const footerHint = useEditorFooterHint({
    assistantOpen,
    language,
    selectedNodes,
    defaultHint: t.footerHint,
  });

  const handleGenerateSettingText = useCallback(
    async (nodeId: string, type: 'character' | 'scene') => {
      await generateSetting(nodeId, type);
    },
    [generateSetting],
  );

  const characterVoiceOptions = useMemo(() => {
    const profiles = savedAIProfiles.filter(
      (profile): profile is VoiceAIProfile => profile.kind === 'voice',
    );
    if (activeVoiceProfile && !profiles.some((profile) => profile.id === activeVoiceProfile.id)) {
      profiles.push(activeVoiceProfile);
    }
    return profiles.map((profile) => ({
      id: profile.id,
      provider: profile.provider,
      defaultVoice: profile.voice,
      voiceOptions: getPlatformVoiceOptions(profile.provider, profile.voice),
      voicePlaceholder: getPlatformVoicePlaceholder(profile.provider),
      label: profile.voice ? `${profile.name} · ${profile.voice}` : profile.name,
    }));
  }, [activeVoiceProfile, savedAIProfiles]);

  const voicePreviewRequestCacheRef = useRef(new Map<string, Promise<Blob>>());

  const handlePreviewCharacterVoice = useCallback(
    async (nodeId: string, voiceProfileId?: string, voiceId?: string) => {
      const selectedProfile = voiceProfileId
        ? savedAIProfiles.find(
            (profile): profile is VoiceAIProfile =>
              profile.kind === 'voice' && profile.id === voiceProfileId,
          ) || (activeVoiceProfile?.id === voiceProfileId ? activeVoiceProfile : null)
        : activeVoiceProfile;
      if (!selectedProfile) {
        requestSettingsAttention('voice');
        showToast(
          language === 'zh' ? '请先在 AI 设置中配置语音 API' : 'Configure a voice API first',
          'error',
        );
        return;
      }

      const character = nodes.find((node) => node.id === nodeId && node.type === 'characterNode');
      const name = String(character?.data.characterName || '').trim();
      const isNewCharacter = !name || ['新角色', '新キャラクター', 'New Character'].includes(name);
      const previewText = isNewCharacter
        ? language === 'zh'
          ? '您好，可以听到吗？'
          : language === 'ja'
            ? 'こんにちは。聞こえますか？'
            : 'Hello, can you hear me?'
        : language === 'zh'
          ? `您好，我是${name}。`
          : language === 'ja'
            ? `こんにちは、${name}です。`
            : `Hello, I am ${name}.`;
      const resolvedVoice = voiceId?.trim() || selectedProfile.voice;
      const cacheKey = JSON.stringify({
        version: 1,
        profileId: selectedProfile.id,
        provider: selectedProfile.provider,
        apiUrl: selectedProfile.apiUrl,
        model: selectedProfile.model,
        voice: resolvedVoice,
        text: previewText,
      });

      const playPreview = async (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const player = new Audio(url);
        const releaseUrl = () => URL.revokeObjectURL(url);
        player.addEventListener('ended', releaseUrl, { once: true });
        player.addEventListener('error', releaseUrl, { once: true });
        try {
          await player.play();
        } catch (error) {
          releaseUrl();
          throw error;
        }
      };

      try {
        let blob: Blob | null = null;
        try {
          blob = await localPersistenceService.getVoicePreviewCache(cacheKey);
        } catch (error) {
          console.warn('Unable to read cached character voice preview:', error);
        }

        if (!blob) {
          let request = voicePreviewRequestCacheRef.current.get(cacheKey);
          if (!request) {
            request = ttsService
              .generate({
                text: previewText,
                provider: selectedProfile.provider,
                apiUrl: selectedProfile.apiUrl,
                apiKey: selectedProfile.apiKey,
                appKey: selectedProfile.appKey,
                appSecret: selectedProfile.appSecret || selectedProfile.apiKey,
                model: selectedProfile.model,
                voice: resolvedVoice,
              })
              .then((audio) => audio.blob);
            voicePreviewRequestCacheRef.current.set(cacheKey, request);
          }
          try {
            blob = await request;
            try {
              await localPersistenceService.saveVoicePreviewCache(cacheKey, blob);
            } catch (error) {
              console.warn('Unable to save character voice preview cache:', error);
            }
          } finally {
            voicePreviewRequestCacheRef.current.delete(cacheKey);
          }
        }

        await playPreview(blob);
      } catch (error) {
        console.error('Character voice preview failed:', error);
        showToast(
          language === 'zh' ? '音色试听失败，请检查语音 API 设置' : 'Voice preview failed',
          'error',
        );
      }
    },
    [activeVoiceProfile, language, nodes, requestSettingsAttention, savedAIProfiles, showToast],
  );

  const handlePlotStructureGenerate = usePlotStructureGeneration({
    callAIForText,
    generateLength,
    language,
    plotStructureGenerateDirection,
    setEdges,
    setNodes,
    showDialogAlert,
  });

  const handleAIAnalyze = useCallback(
    async (nodeId: string, mode: string = 'summary') => {
      try {
        await runAIAnalyze(nodeId, mode);
      } catch (error: any) {
        console.error('AI Analysis failed:', error);
        await showDialogAlert({
          title: storyEditorCopy.aiAnalysisFailed,
          description: error.message || storyEditorCopy.checkNetworkApi,
          tone: 'warning',
        });
      }
    },
    [runAIAnalyze, showDialogAlert, storyEditorCopy],
  );

  const {
    isRightDragging,
    setIsRightDragging,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    onEdgeContextMenu,
    onEdgeDoubleClick,
    onNodeDragStop,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    canvasTouchAction,
  } = useCanvasInteractions({
    nodes,
    interactionMode,
    selectionBoxRef,
    screenToFlowPosition,
    getIntersectingNodes,
    setNodes,
    setEdges,
    setHorizontalGuides,
    setVerticalGuides,
    defaultEdgeOptions,
    handleDeleteNode,
    handleUpdateNode,
  });

  // NOTE: 手机端上框选时，为了防止默认的页面滚动/缩放，需要阻止默认行为 (preventDefault)。
  // 由于现代浏览器在 React 事件系统中默认将 Touch 监听器注册为被动监听器 (passive: true)，
  // 导致在 onTouchMoveCapture 里 preventDefault() 会报错。
  // 因此，此处采用原生 addEventListener 并设置 passive: false 强制允许 preventDefault() 阻止滚动。
  useEffect(() => {
    const element = canvasWrapperRef.current;
    if (!element) return;

    const onTouchStart = (event: TouchEvent) => {
      handleTouchStart(event);
    };

    const onTouchMove = (event: TouchEvent) => {
      handleTouchMove(event);
    };

    const onTouchEnd = (event: TouchEvent) => {
      handleTouchEnd(event);
    };

    element.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    element.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    element.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });

    return () => {
      element.removeEventListener('touchstart', onTouchStart, { capture: true });
      element.removeEventListener('touchmove', onTouchMove, { capture: true });
      element.removeEventListener('touchend', onTouchEnd, { capture: true });
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const handleNodeClick = useCallback(
    async (event: React.MouseEvent, node: Node) => {
      const assistantCandidateKind = node.data?.assistantCandidateKind;
      if (assistantCandidateKind === 'article-role' || assistantCandidateKind === 'article-scene') {
        event.preventDefault();
        event.stopPropagation();
        if (assistantCandidateKind === 'article-role' && node.data?.assistantTemplateIsUserOwned) {
          setNodes((currentNodes) =>
            currentNodes.map((currentNode) => {
              const isSelectedCandidate = currentNode.id === node.id;
              if (!isSelectedCandidate) return { ...currentNode, selected: false };
              const {
                assistantCandidateKind: _assistantCandidateKind,
                assistantCandidateGroupId: _assistantCandidateGroupId,
                ...nextData
              } = currentNode.data;
              return {
                ...currentNode,
                selected: true,
                data: nextData,
              };
            }),
          );
          return;
        }
        setNodes((currentNodes) =>
          currentNodes.map((currentNode) => {
            const isSelectedCandidate = currentNode.id === node.id;
            if (!isSelectedCandidate) return { ...currentNode, selected: false };
            const {
              assistantCandidateKind: _assistantCandidateKind,
              assistantCandidateGroupId: _assistantCandidateGroupId,
              ...nextData
            } = currentNode.data;
            return {
              ...currentNode,
              selected: true,
              data: nextData,
            };
          }),
        );
        await handleAssistantCandidateNodeSelect(node.id);
        return;
      }
      if (!event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      setNodes((currentNodes) =>
        currentNodes.map((currentNode) =>
          currentNode.id === node.id && !currentNode.data?.locked
            ? { ...currentNode, selected: !currentNode.selected }
            : currentNode,
        ),
      );
    },
    [handleAssistantCandidateNodeSelect, setNodes],
  );

  const nodeRenderData = useMemo(
    () => ({
      canvasBg,
      showTitles,
      storyTitlePlacement,
      characterImageMode,
      hideStoryImageButtonWithTags,
      onUpdate: handleUpdateNode,
      onAddNode: handleAddConnectedNode,
      onDelete: handleDeleteNode,
      onDeleteOutputEdges: handleDeleteNodeOutputEdges,
      onZenMode: setZenModeNodeId,
      onAIGenerate: handleAIButtonClick,
      onAIAnalyze: handleAIAnalyze,
      onGenerateImage: handleGenerateStoryNodeImage,
      onGenerateSpeech: handleGenerateStoryNodeSpeech,
      onGenerateSettingImage: handleGenerateSettingNodeImage,
      onPreviewCharacterVoice: handlePreviewCharacterVoice,
      voiceOptions: characterVoiceOptions,
      onRemoveCharacterImageBackground: handleRemoveCharacterImageBackground,
      onAddTextToImage: handleAddTextToImage,
      onRemoveTextFromImage: handleRemoveTextFromImage,
      onExtractMedia: handleExtractMedia,
      onGenerateSettingText: handleGenerateSettingText,
      onSaveSettingLibrary: saveSettingLibrary,
      onUseSettingLibrary: useSettingLibraryItem,
      onDeleteSettingLibrary: deleteSettingLibrary,
      settingLibraryItems: savedListItems,
      settingLibraryPresets: presetListItems,
      onPlotStructureGenerate: handlePlotStructureGenerate,
      onConvertToGroup: convertBackgroundToDynamicGroup,
      onConvertToBackground: convertDynamicGroupToBackground,
      onSendToAssistant: handlePrefillAssistantFromRegion,
      onHighlightStoryline: toggleStorylineHighlight,
      pasteAsPlainText,
      showNodeActions,
      cardToolbarScale,
      language,
      theme,
    }),
    [
      canvasBg,
      showTitles,
      storyTitlePlacement,
      characterImageMode,
      hideStoryImageButtonWithTags,
      handleUpdateNode,
      handleAddConnectedNode,
      handleDeleteNode,
      handleDeleteNodeOutputEdges,
      handleAIButtonClick,
      handleAIAnalyze,
      handleGenerateStoryNodeImage,
      handleGenerateStoryNodeSpeech,
      handleGenerateSettingNodeImage,
      handlePreviewCharacterVoice,
      characterVoiceOptions,
      handleRemoveCharacterImageBackground,
      handleAddTextToImage,
      handleRemoveTextFromImage,
      handleExtractMedia,
      handleGenerateSettingText,
      saveSettingLibrary,
      useSettingLibraryItem,
      deleteSettingLibrary,
      savedListItems,
      presetListItems,
      handlePlotStructureGenerate,
      convertBackgroundToDynamicGroup,
      convertDynamicGroupToBackground,
      handlePrefillAssistantFromRegion,
      toggleStorylineHighlight,
      pasteAsPlainText,
      showNodeActions,
      cardToolbarScale,
      language,
      theme,
    ],
  );

  const handleReverseRenderedEdge = useCallback(
    (edge: Edge) => onEdgeDoubleClick(null as unknown as React.MouseEvent, edge),
    [onEdgeDoubleClick],
  );

  const { nodesWithCallbacks, edgesWithData } = useGraphPresentation({
    nodes,
    edges,
    nodeRenderData,
    aiLoadingNodeId: null,
    highlightedPath,
    edgeStyle,
    edgeColor,
    arrowSize,
    arrowCornerRadius,
    arrowTipAngle,
    isMobile,
    onDeleteEdge: handleEdgeDelete,
    onReverseEdge: handleReverseRenderedEdge,
  });

  return (
    <div
      className={`relative w-full h-screen flex flex-col font-sans overflow-hidden text-slate-800 dark:text-slate-100 transition-colors duration-300 ${bubbleStyle === 'glass' ? 'bubble-glass-mode' : 'bubble-flat-mode'} ${opaqueAssistantMessagesInGlass ? 'glass-opaque-assistant-messages' : ''} ${opaqueFooterInGlass ? 'glass-opaque-footer' : ''} ${showProjectHome ? 'pointer-events-auto' : ''}`}
      style={{ ...editorAccentStyle, backgroundColor: canvasBg }}
    >
      <style>{`
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: ${resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: ${resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};
      }
    `}</style>
      <EditorHeader
        appTitle={APP_TITLE}
        projectName={currentProjectId ? projectTitle.trim() : ''}
        projectNamePlaceholder={currentProjectId ? PROJECT_TITLE_PLACEHOLDER : ''}
        showLastSavedTime={showLastSavedTime}
        showActionLabels={showHeaderActionLabels}
        lastSavedTime={lastSavedTime}
        onProjectNameChange={setProjectTitle}
        onProjectNameCommit={async (nextName) => {
          if (!currentProjectId) return;
          await handleRenameProject(currentProjectId, nextName);
        }}
        language={language}
        bubbleStyle={bubbleStyle}
        isMobile={isMobile}
        isDirty={isDirty}
        isSavingProject={isSavingProject}
        canRenderVideo={canRenderVideo}
        assistantOpen={assistantOpen}
        jsonInputRef={jsonInputRef}
        onOpenPlayTest={(mode) => {
          setSettingsPlaytestWindowSession('none');
          setPlayTestWindowLayer('workspace');
          setPlayTestDisplayMode(mode);
        }}
        onOpenRenderWorkspace={(intent) => {
          setRenderLaunchIntent(intent);
          setShowVideoRender(true);
        }}
        setAssistantOpen={setAssistantOpen}
        openProjectHome={() => setShowProjectHome(true)}
        openImportPicker={openImportPicker}
        handleSaveProject={() => {
          void saveCurrentProject();
        }}
        handleSaveProjectCopy={() => {
          void saveProjectAsCopy();
        }}
        handleExportProject={() => {
          setShowSaveNameModal(true);
        }}
        handleCreateProject={() => {
          void handleCreateProject();
        }}
        handleImportZIP={handleImportZIP}
        t={t}
      />

      <div className="relative flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          <EditorLeftToolbar
            isMobile={isMobile}
            language={language}
            toolbarCollapsed={toolbarCollapsed}
            interactionMode={interactionMode}
            showHoverButtonAnimations={showHoverButtonAnimations}
            showSideToolbarLabels={showSideToolbarLabels}
            historyPastLength={history.past.length}
            historyFutureLength={history.future.length}
            hasHiddenNodes={nodes.some((node) => node.data?.hidden)}
            fileInputRef={fileInputRef}
            setToolbarCollapsed={setToolbarCollapsed}
            setInteractionMode={setInteractionMode}
            addNewShape={addNewShape}
            startCardPlacement={startCardPlacement}
            addNewBackgroundCard={addNewBackgroundCard}
            addNewDynamicWrap={addNewDynamicWrap}
            addNewCharacterNode={addNewCharacterNode}
            addNewSceneNode={addNewSceneNode}
            addNewPlotStructureNode={addNewPlotStructureNode}
            addNewSummaryNode={addNewSummaryNode}
            addNewBatchReplaceNode={addNewBatchReplaceNode}
            addNewNumberConditionNode={addNewNumberConditionNode}
            handleMediaUpload={handleMediaUpload}
            undo={undo}
            redo={redo}
            unhideAllNodes={unhideAllNodes}
            t={t}
          />

          <EditorRightToolbar
            isMobile={isMobile}
            language={language}
            assistantOpen={assistantOpen}
            assistantPanelWidth={assistantPanelWidth}
            assistantResizing={assistantResizing}
            bubbleStyle={bubbleStyle}
            rightToolbarCollapsed={rightToolbarCollapsed}
            toolbarLayout={toolbarLayout}
            showSideToolbarLabels={showSideToolbarLabels}
            showTitles={showTitles}
            storyTitlePlacement={storyTitlePlacement}
            canvasBg={canvasBg}
            presetColors={presetColors}
            showPresetColors={showPresetColors}
            historyPastLength={history.past.length}
            historyFutureLength={history.future.length}
            missingTextApiKey={missingTextApiKey}
            settingsAttention={settingsAttention}
            settingsAttentionTarget={settingsAttentionTarget}
            setAssistantOpen={setAssistantOpen}
            setRightToolbarCollapsed={setRightToolbarCollapsed}
            setShowSettings={setShowSettings}
            setShowTitles={setShowTitles}
            setStoryTitlePlacement={setStoryTitlePlacement}
            setCanvasBg={setCanvasBg}
            undo={undo}
            redo={redo}
            t={t}
          />

          <StoryCanvasWorkspace
            bubbleStyle={bubbleStyle}
            canvasTouchAction={canvasTouchAction}
            canvasWrapperRef={canvasWrapperRef}
            selectionBoxRef={selectionBoxRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            interactionMode={interactionMode}
            isRightDragging={isRightDragging}
            scrollMode={scrollMode}
            resolvedTheme={resolvedTheme}
            showMiniMap={showMiniMap}
            showControls={showControls}
            showStats={showStats}
            miniMapPosition={miniMapPosition}
            miniMapOverlayStyle={miniMapOverlayStyle}
            horizontalGuides={horizontalGuides}
            verticalGuides={verticalGuides}
            cardPlacementPreviewKind={pendingCardPlacement}
            cardPlacementPreviewTitle={
              pendingCardPlacement === 'bodyText'
                ? getSideToolbarStrings(language).bodyText
                : pendingCardPlacement === 'headingText'
                  ? getSideToolbarStrings(language).headingText
                  : storyEditorCopy.branchTitle
            }
            cardPlacementStartScreen={
              pendingCardPlacement === 'dynamicWrap'
                ? dynamicWrapDragStart?.screen
                : pendingCardPlacement === 'background'
                  ? (backgroundCardDragStart?.screen ?? cardPlacementStart?.screen)
                  : cardPlacementStart?.screen
            }
            storyCardPlacementPreviewScale={flowZoom}
            onBackgroundCardPlacementStart={handleBackgroundCardPlacementStart}
            onBackgroundCardPlacementEnd={handleBackgroundCardPlacementEnd}
            onDynamicWrapSelectionStart={handleDynamicWrapSelectionStart}
            onDynamicWrapSelectionEnd={handleDynamicWrapSelectionEnd}
            reactFlowProps={{
              className: `story-canvas-flow${
                pendingCardPlacement === 'story' ||
                pendingCardPlacement === 'bodyText' ||
                pendingCardPlacement === 'headingText'
                  ? ' story-canvas-flow--placing-card'
                  : pendingCardPlacement
                    ? ' story-canvas-flow--placing-region'
                    : ''
              }`,
              nodes: nodesWithCallbacks,
              edges: edgesWithData,
              onNodesChange,
              onEdgesChange,
              onConnect,
              isValidConnection,
              onEdgeDoubleClick,
              onNodeClick: handleNodeClick,
              onPaneClick: handleCardPlacement,
              onEdgeContextMenu,
              onNodeContextMenu: (event, node) => {
                event.preventDefault();
                if (
                  node.data?.locked &&
                  (node.type === 'backgroundNode' || node.type === 'groupNode')
                ) {
                  handleUpdateNode(node.id, { locked: false });
                }
              },
              onPaneContextMenu: (event) => event.preventDefault(),
              onSelectionEnd: () => setIsRightDragging(false),
              onMove: handleViewportMove,
              onNodeDragStop,
              nodeTypes: nodeTypesMemo,
              edgeTypes: edgeTypesMemo,
              defaultEdgeOptions,
            }}
            selectionMenuProps={
              showSelectionMenu
                ? {
                    selectionMenuRef,
                    selectionMenuLayout,
                    isMobile,
                    language,
                    ttsLoading,
                    onWrapDynamicGroup: wrapWithDynamicGroup,
                    onWrapBackground: wrapSelectedWithBackground,
                    onSendToAssistant: () =>
                      handlePrefillAssistantFromRegion(selectedNodes.map((node) => node.id)),
                    onArrange: arrangeSelected,
                    onBatchExport: connectSelectedToSummaryNode,
                    onNarrate: handleGenerateSelectedSpeech,
                    onDelete: deleteSelected,
                    onCopy: handleCopy,
                    onHide: hideSelected,
                  }
                : undefined
            }
          />
        </div>

        <AssistantPanel
          assistantOpen={assistantOpen}
          isMobile={isMobile}
          assistantPanelWidth={assistantPanelWidth}
          assistantLoading={assistantLoading}
          assistantListening={assistantListening}
          assistantDocuments={assistantDocuments}
          assistantDocumentLoading={assistantDocumentLoading}
          assistantArticleAnalysis={assistantArticleAnalysis}
          assistantInput={assistantInput}
          assistantInputContexts={assistantInputContexts}
          assistantTasks={assistantTasks}
          activeAssistantTaskId={activeAssistantTaskId}
          assistantMessages={assistantMessages}
          assistantMessagesRef={assistantMessagesRef}
          setAssistantOpen={setAssistantOpen}
          setAssistantInput={setAssistantInput}
          setAssistantInputContexts={setAssistantInputContexts}
          handleSelectAssistantTask={handleSelectAssistantTask}
          handleNewAssistantTask={handleNewAssistantTask}
          handleRenameAssistantTask={handleRenameAssistantTask}
          handleCloseAssistantTask={handleRequestCloseAssistantTask}
          handleAssistantSend={handleAssistantSend}
          handleStopAssistantGeneration={handleStopAssistantGeneration}
          handleAssistantOptionSelect={handleAssistantOptionSelect}
          handleStartAssistantFlow={handleStartAssistantFlow}
          handleAssistantDocumentUpload={handleAssistantDocumentUpload}
          handleRemoveAssistantDocument={handleRemoveAssistantDocument}
          handleAssistantVoiceInput={handleAssistantVoiceInput}
          toggleAssistantThought={toggleAssistantThought}
          handleAssistantResizePointerDown={handleAssistantResizePointerDown}
          handleAssistantResizePointerMove={handleAssistantResizePointerMove}
          handleAssistantResizePointerUp={handleAssistantResizePointerUp}
          handleAssistantUndo={handleAssistantUndo}
          handleAssistantRedo={handleAssistantRedo}
          canAssistantUndo={canAssistantUndo}
          canAssistantRedo={canAssistantRedo}
          onAssistantMessagePositionClick={handleAssistantMessagePositionClick}
          showStats={showStats}
          language={language}
        />
      </div>

      {!isMobile && showStats && (
        <EditorFooter
          nodeCount={nodes.length}
          pathCount={edges.length}
          selectedItemCount={selectedNodes.length}
          footerHint={footerHint}
          labels={{ nodes: t.nodes, paths: t.paths, selectedItems: t.selectedItems }}
        />
      )}

      {/* 剧本测试模态弹窗*/}
      <Suspense fallback={null}>
        {playTestDisplayMode && (
          <PlayTestModal
            nodes={nodes}
            edges={edges}
            displayMode={playTestDisplayMode}
            onDisplayModeChange={(mode) => {
              if (mode !== 'windowed') {
                setSettingsPlaytestWindowSession('none');
                setPlayTestWindowLayer('workspace');
              }
              setPlayTestDisplayMode(mode);
            }}
            windowLayer={playTestWindowLayer}
            windowSettings={playTestWindowSettings}
            setWindowSettings={setPlayTestWindowSettings}
            selectedNodeId={selectedPlaytestNodeId}
            onClose={() => {
              setSettingsPlaytestWindowSession('none');
              setPlayTestWindowLayer('workspace');
              setPlayTestDisplayMode(null);
            }}
            language={language}
            onLanguageChange={onAppLanguageChange}
            isDarkMode={resolvedTheme === 'dark'}
            choicesColumns={playTestChoicesColumns}
            setChoicesColumns={setPlayTestChoicesColumns}
            videoAutoPlay={sharedCanvas.settings.videoAutoPlay}
            setVideoAutoPlay={(videoAutoPlay) => sharedCanvas.update({ videoAutoPlay })}
            layoutMode={sharedCanvas.settings.layoutMode}
            setLayoutMode={(layoutMode) => sharedCanvas.update({ layoutMode })}
            interactionMode={playTestInteractionMode}
            setInteractionMode={setPlayTestInteractionMode}
            typewriterSpeed={playTestTypewriterSpeed}
            setTypewriterSpeed={setPlayTestTypewriterSpeed}
            choiceDelay={playTestChoiceDelay}
            setChoiceDelay={setPlayTestChoiceDelay}
            choicesPosition={sharedCanvas.settings.choicesPosition}
            setChoicesPosition={(choicesPosition) => sharedCanvas.update({ choicesPosition })}
            blurBackground={playTestBlurBackground}
            setBlurBackground={setPlayTestBlurBackground}
            blurText={playTestBlurText}
            setBlurText={setPlayTestBlurText}
            skipSingleChoicePopup={sharedCanvas.settings.skipSingleChoicePopup}
            setSkipSingleChoicePopup={(skipSingleChoicePopup) =>
              sharedCanvas.update({ skipSingleChoicePopup })
            }
            autoAdvance={sharedCanvas.settings.autoAdvance}
            setAutoAdvance={(autoAdvance) => sharedCanvas.update({ autoAdvance })}
            autoAdvanceDelay={playTestAutoAdvanceDelay}
            setAutoAdvanceDelay={setPlayTestAutoAdvanceDelay}
            hideCharacterTags={sharedCanvas.settings.hideCharacterTags}
            setHideCharacterTags={(hideCharacterTags) => sharedCanvas.update({ hideCharacterTags })}
            hideSceneTags={sharedCanvas.settings.hideSceneTags}
            setHideSceneTags={(hideSceneTags) => sharedCanvas.update({ hideSceneTags })}
            canvasSettings={sharedCanvas.settings}
            onCanvasSettingsChange={sharedCanvas.update}
            renderStyle={sharedRenderStyle}
            updateRenderStyle={updateSharedRenderStyle}
            isMobile={isMobile}
          />
        )}
      </Suspense>

      {/* 设置界面弹窗 */}
      <Suspense
        fallback={<RenderWorkspaceBootSkeleton onClose={() => setShowVideoRender(false)} />}
      >
        {canRenderVideo && showVideoRender && (
          <VideoRenderModal
            nodes={nodes}
            edges={edges}
            launchIntent={renderLaunchIntent}
            onClose={() => setShowVideoRender(false)}
            onUpdateNodeData={handleUpdateNode}
            language={language}
            workspaceKey={canvasWorkspaceKey}
            renderStyle={sharedRenderStyle}
            updateRenderStyle={updateSharedRenderStyle}
            callAIForTextResult={callAIForTextResult}
            voiceTtsConfig={{
              provider: ttsProvider,
              apiUrl: ttsApiUrl,
              apiKey: ttsApiKey,
              appKey: ttsAppKey,
              appSecret: ttsAppSecret || ttsApiKey,
              model: ttsModel,
              voice: ttsVoice,
            }}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        <SettingsModal
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          missingTextApiKey={missingTextApiKey}
          language={language}
          setLanguage={onAppLanguageChange}
          theme={theme}
          setTheme={setTheme}
          closeButtonBehavior={closeButtonBehavior}
          setCloseButtonBehavior={setCloseButtonBehavior}
          bubbleStyle={bubbleStyle}
          setBubbleStyle={setBubbleStyle}
          opaqueAssistantMessagesInGlass={opaqueAssistantMessagesInGlass}
          setOpaqueAssistantMessagesInGlass={setOpaqueAssistantMessagesInGlass}
          opaqueFooterInGlass={opaqueFooterInGlass}
          setOpaqueFooterInGlass={setOpaqueFooterInGlass}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          effectiveAccentColor={effectiveAccentColor}
          canvasBg={canvasBg}
          setCanvasBg={setCanvasBg}
          presetColors={presetColors}
          setPresetColors={setPresetColors}
          showPresetColors={showPresetColors}
          setShowPresetColors={setShowPresetColors}
          storyTitlePlacement={storyTitlePlacement}
          setStoryTitlePlacement={setStoryTitlePlacement}
          toolbarLayout={toolbarLayout}
          setToolbarLayout={setToolbarLayout}
          cardToolbarScale={cardToolbarScale}
          setCardToolbarScale={setCardToolbarScale}
          edgeStyle={edgeStyle}
          setEdgeStyle={setEdgeStyle}
          edgeColor={edgeColor}
          setEdgeColor={setEdgeColor}
          arrowSize={arrowSize}
          setArrowSize={setArrowSize}
          arrowCornerRadius={arrowCornerRadius}
          setArrowCornerRadius={setArrowCornerRadius}
          arrowTipAngle={arrowTipAngle}
          setArrowTipAngle={setArrowTipAngle}
          nodeHorizontalSpacing={nodeHorizontalSpacing}
          setNodeHorizontalSpacing={setNodeHorizontalSpacing}
          nodeVerticalSpacing={nodeVerticalSpacing}
          setNodeVerticalSpacing={setNodeVerticalSpacing}
          pasteAsPlainText={pasteAsPlainText}
          setPasteAsPlainText={setPasteAsPlainText}
          showNodeActions={showNodeActions}
          setShowNodeActions={setShowNodeActions}
          showStats={showStats}
          setShowStats={setShowStats}
          showLastSavedTime={showLastSavedTime}
          setShowLastSavedTime={setShowLastSavedTime}
          showHeaderActionLabels={showHeaderActionLabels}
          setShowHeaderActionLabels={setShowHeaderActionLabels}
          showSideToolbarLabels={showSideToolbarLabels}
          setShowSideToolbarLabels={setShowSideToolbarLabels}
          saveAssistantConversations={saveAssistantConversations}
          setSaveAssistantConversations={setSaveAssistantConversations}
          allowAssistantImageGeneration={allowAssistantImageGeneration}
          setAllowAssistantImageGeneration={setAllowAssistantImageGeneration}
          skipAssistantAgentAnimation={skipAssistantAgentAnimation}
          setSkipAssistantAgentAnimation={setSkipAssistantAgentAnimation}
          assistantMemorySkillEnabled={assistantMemorySkillEnabled}
          setAssistantMemorySkillEnabled={setAssistantMemorySkillEnabled}
          assistantMemoryNotes={assistantMemoryNotes}
          onDownloadAssistantMemory={handleDownloadAssistantMemory}
          showMiniMap={showMiniMap}
          setShowMiniMap={setShowMiniMap}
          miniMapPosition={miniMapPosition}
          setMiniMapPosition={setMiniMapPosition}
          showControls={showControls}
          setShowControls={setShowControls}
          showHoverButtonAnimations={showHoverButtonAnimations}
          setShowHoverButtonAnimations={setShowHoverButtonAnimations}
          ttsNarrationMode={ttsNarrationMode}
          setTtsNarrationMode={setTtsNarrationMode}
          savedAIProfiles={savedAIProfiles}
          activeTextProfileId={activeTextProfileId}
          activeImageProfileId={activeImageProfileId}
          activeBackgroundRemovalProfileId={activeBackgroundRemovalProfileId}
          activeVoiceProfileId={activeVoiceProfileId}
          settingsAttentionTarget={settingsAttentionTarget}
          onAcknowledgeSettingsAttention={acknowledgeSettingsAttention}
          projectSummaries={projectSummaries}
          currentProjectId={currentProjectId}
          onCreateAIProfile={handleCreateAIProfile}
          onUpdateAIProfile={handleUpdateAIProfile}
          onSelectAIProfile={handleSelectAIProfile}
          onDeleteAIProfile={handleDeleteAIProfile}
          generateLength={generateLength}
          setGenerateLength={setGenerateLength}
          hideStoryImageButtonWithTags={hideStoryImageButtonWithTags}
          setHideStoryImageButtonWithTags={setHideStoryImageButtonWithTags}
          sceneImageMode={sceneImageMode}
          setSceneImageMode={setSceneImageMode}
          plotStructureGenerateDirection={plotStructureGenerateDirection}
          setPlotStructureGenerateDirection={setPlotStructureGenerateDirection}
          aiGenerationBalance={aiGenerationBalance}
          setAiGenerationBalance={setAiGenerationBalance}
          customAiPromptsEnabled={customAiPromptsEnabled}
          setCustomAiPromptsEnabled={setCustomAiPromptsEnabled}
          aiPrompts={aiPrompts}
          setAiPrompts={setAiPrompts}
          aiButtonsConfig={aiButtonsConfig}
          setAiButtonsConfig={setAiButtonsConfig}
          handleContactCopy={handleContactCopy}
          qqCopied={qqCopied}
          emailCopied={emailCopied}
          playTestDarkMode={playTestDarkMode}
          setPlayTestDarkMode={setPlayTestDarkMode}
          playTestChoicesColumns={playTestChoicesColumns}
          setPlayTestChoicesColumns={setPlayTestChoicesColumns}
          playTestVideoAutoPlay={playTestVideoAutoPlay}
          setPlayTestVideoAutoPlay={setPlayTestVideoAutoPlay}
          playTestLayoutMode={playTestLayoutMode}
          setPlayTestLayoutMode={setPlayTestLayoutMode}
          playTestInteractionMode={playTestInteractionMode}
          setPlayTestInteractionMode={setPlayTestInteractionMode}
          playTestTypewriterSpeed={playTestTypewriterSpeed}
          setPlayTestTypewriterSpeed={setPlayTestTypewriterSpeed}
          playTestChoiceDelay={playTestChoiceDelay}
          setPlayTestChoiceDelay={setPlayTestChoiceDelay}
          playTestChoicesPosition={playTestChoicesPosition}
          setPlayTestChoicesPosition={setPlayTestChoicesPosition}
          playTestBlurBackground={playTestBlurBackground}
          setPlayTestBlurBackground={setPlayTestBlurBackground}
          playTestBlurText={playTestBlurText}
          setPlayTestBlurText={setPlayTestBlurText}
          playTestSkipSingleChoicePopup={playTestSkipSingleChoicePopup}
          setPlayTestSkipSingleChoicePopup={setPlayTestSkipSingleChoicePopup}
          playTestAutoAdvance={playTestAutoAdvance}
          setPlayTestAutoAdvance={setPlayTestAutoAdvance}
          playTestAutoAdvanceDelay={playTestAutoAdvanceDelay}
          setPlayTestAutoAdvanceDelay={setPlayTestAutoAdvanceDelay}
          playTestHideCharacterTags={playTestHideCharacterTags}
          setPlayTestHideCharacterTags={setPlayTestHideCharacterTags}
          playTestHideSceneTags={playTestHideSceneTags}
          setPlayTestHideSceneTags={setPlayTestHideSceneTags}
          playtestCanvasSettings={sharedCanvas.settings}
          onPlaytestCanvasSettingsChange={sharedCanvas.update}
          windowedPlaytestRaised={settingsPlaytestWindowSession !== 'none'}
          onToggleWindowedPlaytest={() => {
            if (settingsPlaytestWindowSession !== 'none' && playTestDisplayMode === 'windowed') {
              const shouldClose = settingsPlaytestWindowSession === 'opened-from-settings';
              setSettingsPlaytestWindowSession('none');
              setPlayTestWindowLayer('workspace');
              if (shouldClose) setPlayTestDisplayMode(null);
              return;
            }

            setSettingsPlaytestWindowSession(
              playTestDisplayMode === 'windowed' ? 'raised-existing' : 'opened-from-settings',
            );
            setPlayTestWindowLayer('above-settings');
            setPlayTestDisplayMode('windowed');
          }}
          renderStyle={sharedRenderStyle}
          updateRenderStyle={updateSharedRenderStyle}
          onApplySettingsToOtherProjects={handleApplySettingsToOtherProjects}
        />
      </Suspense>

      {/* 崩溃恢复弹窗 */}
      {/* 保存文件名弹窗 */}
      <AutoSaveRecoveryModal
        visible={showAutoSaveModal}
        timestamp={autoSaveData?.timestamp}
        language={language}
        onDiscard={() => {
          void discardAutoSave();
        }}
        onRecover={() => {
          void recoverAutoSave();
        }}
      />

      <SaveProjectModal
        visible={showSaveNameModal}
        saveFileName={saveFileName}
        includeApiProfiles={includeApiProfilesInExport}
        includeSettingLibrary={includeSettingLibraryInExport}
        onChangeFileName={setSaveFileName}
        onChangeIncludeApiProfiles={setIncludeApiProfilesInExport}
        onChangeIncludeSettingLibrary={setIncludeSettingLibraryInExport}
        onClose={() => setShowSaveNameModal(false)}
        onConfirm={() =>
          confirmExportJSON({
            includeApiProfiles: includeApiProfilesInExport,
            includeSettingLibrary: includeSettingLibraryInExport,
          })
        }
        t={t}
      />

      <ProjectSavePromptModal
        visible={showProjectSavePrompt}
        language={language}
        projectName={getPersistedProjectName(projectTitle, saveFileName)}
        onSave={() => {
          void handleConfirmSaveCurrentProject();
        }}
        onDiscard={() => {
          void handleDiscardCurrentProjectChanges();
        }}
        onCancel={handleCancelProjectAction}
      />

      <ConfirmActionModal
        visible={showAppClosePrompt}
        language={language}
        title={storyEditorCopy.quitTitle}
        description={storyEditorCopy.quitDescription}
        confirmLabel={storyEditorCopy.quitConfirm}
        cancelLabel={storyEditorCopy.cancel}
        tone="warning"
        onCancel={handleCancelAppClose}
        onConfirm={handleConfirmAppClose}
      />

      <ProjectPickerModal
        visible={showProjectHome}
        language={language}
        projects={projectSummaries}
        loading={projectListLoading}
        exampleTemplates={exampleTemplates}
        examplesLoading={examplesLoading}
        examplesError={examplesError}
        isMobile={isMobile}
        showCloseButton={Boolean(currentProjectId)}
        defaultProjectSaveDir={defaultProjectSaveDir}
        startupProjectId={startupProjectId}
        onClose={() => setShowProjectHome(false)}
        onCreateProject={() => {
          requestProjectAction({ type: 'create' });
        }}
        onOpenProject={(projectId) => {
          void handleOpenProject(projectId);
        }}
        onImportProject={handleImportProjectFromHome}
        onRefreshExamples={loadExampleTemplates}
        onImportExample={!isTauriRuntime() ? handleImportExampleTemplate : undefined}
        onDownloadExample={!isTauriRuntime() ? handleDownloadExampleTemplate : undefined}
        onChooseDefaultSaveLocation={handleChooseDefaultProjectSaveLocation}
        onSetStartupProject={handleSetStartupProject}
        onRenameProject={async (projectId, projectName) => {
          await handleRenameProject(projectId, projectName);
        }}
        onDeleteProject={async (projectId) => {
          setProjectIdsPendingDeletion([projectId]);
        }}
        onDeleteProjects={async (projectIds) => {
          setProjectIdsPendingDeletion(projectIds);
        }}
        onExportProject={handleExportProjectFromList}
        onExportProjectsBundle={handleExportProjectsBundleFromList}
      />

      <ConfirmActionModal
        visible={projectIdsPendingDeletion.length > 0}
        language={language}
        title={storyEditorCopy.deleteProjectTitle}
        description={
          projectIdsPendingDeletion.length > 1
            ? formatStoryEditorText(storyEditorCopy.deleteProjectsDescription, {
                count: projectIdsPendingDeletion.length,
              })
            : formatStoryEditorText(storyEditorCopy.deleteProjectDescription, {
                name:
                  projectSummaries.find((item) => item.id === projectIdsPendingDeletion[0])
                    ?.projectName || storyEditorCopy.untitledProject,
              })
        }
        confirmLabel={storyEditorCopy.deleteProjectConfirm}
        onCancel={() => setProjectIdsPendingDeletion([])}
        onConfirm={() => {
          const projectIds = projectIdsPendingDeletion;
          setProjectIdsPendingDeletion([]);
          const projectId = projectIds[0];
          if (projectIds.length > 1) {
            void handleDeleteProjects(projectIds);
          } else if (projectId) {
            void handleDeleteProject(projectId);
          }
        }}
      />

      <ConfirmActionModal
        visible={Boolean(assistantTaskPendingCloseId)}
        language={language}
        title={storyEditorCopy.closeConversationTitle}
        description={formatStoryEditorText(storyEditorCopy.closeConversationDescription, {
          name:
            assistantTasks.find((task) => task.id === assistantTaskPendingCloseId)?.title ||
            storyEditorCopy.unnamedConversation,
        })}
        confirmLabel={storyEditorCopy.closeConversationConfirm}
        tone="warning"
        onCancel={handleCancelCloseAssistantTask}
        onConfirm={handleConfirmCloseAssistantTask}
      />

      <StoryEditorZenOverlay
        nodes={nodes}
        edges={edges}
        zenModeNodeId={zenModeNodeId}
        aiLoadingNodeId={null}
        onAIGenerate={handleAIButtonClick}
        onGenerateImage={handleGenerateStoryNodeImage}
        onGenerateAudio={handleGenerateStoryNodeSpeech}
        onUpdateNode={handleUpdateNode}
        onClose={() => setZenModeNodeId(null)}
      />

      <AgentOverlay state={agentState} language={language} />

      {/* Global Toast Notification */}
      <EditorToast message={toast.message} visible={toast.visible} tone={toast.tone} />
    </div>
  );
}
