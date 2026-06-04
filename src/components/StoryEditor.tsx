import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  PanOnScrollMode,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
} from '@xyflow/react';
import React, { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useAIActions } from '../editor-features/ai/useAIActions';
import {
  type AssistantCardDraft,
  useAssistantPanel,
} from '../editor-features/assistant/useAssistantPanel';
import { useCanvasDnD } from '../editor-features/canvas/useCanvasDnD';
import { useCanvasInteractions } from '../editor-features/canvas/useCanvasInteractions';
import {
  DEFAULT_IMAGE_API_URL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_STABLE_DIFFUSION_CFG_SCALE,
  DEFAULT_STABLE_DIFFUSION_SAMPLER,
  DEFAULT_STABLE_DIFFUSION_STEPS,
} from '../editor-features/media/imageGeneration';
import { useMediaActions } from '../editor-features/media/useMediaActions';
import { useNodeActions } from '../editor-features/node-actions/useNodeActions';
import {
  type ProjectSnapshotData,
  useProjectSerialization,
} from '../editor-features/project-io/useProjectSerialization';
import { SelectionMenu } from '../editor-features/selection-tools/SelectionMenu';
import { useSelectionActions } from '../editor-features/selection-tools/useSelectionActions';
import { useSelectionMenu } from '../editor-features/selection-tools/useSelectionMenu';
import { autosaveService } from '../editor-services/autosaveService';
import { localPersistenceService } from '../editor-services/localPersistenceService';
import { createProjectSerializer } from '../editor-services/projectSerializer';
import { createProjectThumbnail } from '../editor-services/projectThumbnail';
import { useAutoSave } from '../editor-services/useAutoSave';
import { AIActionModal } from '../editor-shell/AIActionModal';
import { AssistantPanel } from '../editor-shell/AssistantPanel';
import { AutoSaveRecoveryModal } from '../editor-shell/AutoSaveRecoveryModal';
import { EditorHeader } from '../editor-shell/EditorHeader';
import { EditorLeftToolbar } from '../editor-shell/EditorLeftToolbar';
import { EditorRightToolbar } from '../editor-shell/EditorRightToolbar';
import { EditorToast } from '../editor-shell/EditorToast';
import { ConfirmActionModal } from '../editor-shell/ConfirmActionModal';
import { ProjectSavePromptModal } from '../editor-shell/ProjectSavePromptModal';
import { SaveProjectModal } from '../editor-shell/SaveProjectModal';
import {
  type AssistantTask,
  type AIButtonsConfig,
  type AIPromptsConfig,
  defaultAIButtonsConfig,
  defaultAIPrompts,
} from '../editor-state/editorConfig';
import type {
  ImageAIProfile,
  ProjectAIProfilesExport,
  SavedAIProfile,
  CharacterNodeData,
  SceneNodeData,
  StoryTitlePlacement,
  StoryNodeData,
  TextAIProfile,
  VoiceAIProfile,
} from '../domain/project';
import { usePlaytestSettings } from '../editor-state/usePlaytestSettings';
import { Language, translations } from '../lib/i18n';
import {
  expandBackgroundToFitNodes,
  formatRegionStoryForPrompt,
  parseGeneratedPlotCards,
} from '../lib/plotStructure';
import { getTauriInvoke, isTauriRuntime } from '../lib/tauriRuntime';
import { MemoizedAINode } from './AINode';
import { MemoizedBackgroundNode } from './BackgroundNode';
import { MemoizedBatchReplaceNode } from './BatchReplaceNode';
import { MemoizedCharacterNode } from './CharacterNode';
import { CustomEdge } from './CustomEdge';
import { MemoizedGroupNode } from './GroupNode';
import { MemoizedNumberConditionNode } from './NumberConditionNode';
import type { PlotStructureGenerateParams } from './PlotStructureNode';
import { MemoizedPlotStructureNode } from './PlotStructureNode';
import { ProjectPickerModal } from './ProjectPickerModal';
import { MemoizedSceneNode } from './SceneNode';
import { MemoizedStoryNode } from './StoryNode';
import { MemoizedSummaryNode } from './SummaryNode';
import { MemoizedTextNode } from './TextNode';

const DEFAULT_TTS_API_URL = 'https://openapi.youdao.com/ttsapi';
const DEFAULT_TTS_MODEL = '';
const DEFAULT_TTS_VOICE = 'youxiaoqin';
const DEFAULT_TEXT_MODEL = 'deepseek-chat';
type CloseButtonBehavior = 'minimize' | 'quit';
const APP_TITLE = '交互式剧本编辑器';
const PROJECT_TITLE_PLACEHOLDER = '新建项目';
const DEFAULT_PROJECT_FILE_NAME = '新建项目';
type PendingProjectAction =
  | { type: 'create' }
  | { type: 'open'; projectId: string }
  | { type: 'import-new' }
  | { type: 'close-window' };

const syncCloseButtonBehavior = async (behavior: CloseButtonBehavior) => {
  try {
    if (!isTauriRuntime()) return;

    const invoke = await getTauriInvoke();
    await invoke('set_close_button_minimizes', {
      minimizeOnClose: behavior === 'minimize',
    });
  } catch (error) {
    if (isTauriRuntime()) {
      console.error('Failed to sync close button behavior:', error);
    }
  }
};
// 使用懒加载减少首屏体验
const PlayTestModal = lazy(() =>
  import('./PlayTestModal').then((module) => ({ default: module.PlayTestModal })),
);
const ZenEditor = lazy(() =>
  import('./ZenEditor').then((module) => ({ default: module.ZenEditor })),
);
const SettingsModal = lazy(() =>
  import('./SettingsModal').then((module) => ({ default: module.SettingsModal })),
);
const VideoRenderModal = lazy(() =>
  import('./VideoRenderModal').then((module) => ({ default: module.VideoRenderModal })),
);

const nodeTypes = {
  storyNode: MemoizedStoryNode,
  backgroundNode: MemoizedBackgroundNode,
  groupNode: MemoizedGroupNode,
  aiNode: MemoizedAINode,
  textNode: MemoizedTextNode,
  summaryNode: MemoizedSummaryNode,
  numberConditionNode: MemoizedNumberConditionNode,
  batchReplaceNode: MemoizedBatchReplaceNode,
  plotStructureNode: MemoizedPlotStructureNode,
  characterNode: MemoizedCharacterNode,
  sceneNode: MemoizedSceneNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

const defaultEdgeOptions = {
  type: 'customEdge',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: '#6366f1',
  },
  style: { strokeWidth: 3, stroke: '#6366f1' },
};

const INITIAL_NODES: Node[] = [
  {
    id: 'root',
    type: 'storyNode',
    position: { x: 400, y: 250 },
    style: { width: 300, height: 200 },
    data: {
      id: 'root',
      title: '开头',
      text: '从前有座山...',
      shape: 'rounded-rectangle',
      color: '#ffffff',
      isRoot: true,
    },
  },
];

const formatProjectTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const buildAutoProjectName = (timestamp = Date.now()) => `新建项目`;

const buildProfileId = () => uuidv4();
type AIProfileSeed = Partial<TextAIProfile> | Partial<ImageAIProfile> | Partial<VoiceAIProfile>;

const buildDefaultTextProfile = (): TextAIProfile => ({
  id: buildProfileId(),
  name: 'DeepSeek 文本',
  kind: 'text',
  provider: 'deepseek',
  apiKey: '',
  apiUrl: 'https://api.deepseek.com',
  model: DEFAULT_TEXT_MODEL,
  thinkingMode: false,
});

const buildDefaultImageProfile = (): ImageAIProfile => ({
  id: buildProfileId(),
  name: '豆包图片',
  kind: 'image',
  provider: 'doubao',
  apiKey: '',
  apiUrl: DEFAULT_IMAGE_API_URL,
  model: DEFAULT_IMAGE_MODEL,
  size: DEFAULT_IMAGE_SIZE,
  negativePrompt: '',
  steps: DEFAULT_STABLE_DIFFUSION_STEPS,
  cfgScale: DEFAULT_STABLE_DIFFUSION_CFG_SCALE,
  sampler: DEFAULT_STABLE_DIFFUSION_SAMPLER,
  seed: -1,
  restoreFaces: false,
  enableHr: false,
  hrScale: 2,
  denoisingStrength: 0.7,
});

const buildDefaultVoiceProfile = (): VoiceAIProfile => ({
  id: buildProfileId(),
  name: '系统语音',
  kind: 'voice',
  provider: 'system',
  apiKey: '',
  apiUrl: DEFAULT_TTS_API_URL,
  model: DEFAULT_TTS_MODEL,
  voice: DEFAULT_TTS_VOICE,
  appKey: '',
});

const getProjectDisplayName = (projectTitle: string, saveFileName: string) => {
  const normalizedTitle = projectTitle.trim();
  if (normalizedTitle) return normalizedTitle;

  const normalizedFileName = saveFileName.trim();
  if (normalizedFileName && normalizedFileName !== DEFAULT_PROJECT_FILE_NAME)
    return normalizedFileName;

  return '';
};

const getPersistedProjectName = (
  projectTitle: string,
  saveFileName: string,
  timestamp = Date.now(),
) => {
  const displayName = getProjectDisplayName(projectTitle, saveFileName);
  return displayName || buildAutoProjectName(timestamp);
};

const updateProfileList = (
  profiles: SavedAIProfile[],
  profileId: string,
  updater: (profile: SavedAIProfile) => SavedAIProfile,
) => profiles.map((profile) => (profile.id === profileId ? updater(profile) : profile));

const TITLE_HEIGHT = 36;

const replaceMentionNameInText = (html: string, oldName: string, newName: string) => {
  if (!oldName || oldName === newName || !html.includes(`@${oldName}`)) return html;

  const oldMention = `@${oldName}`;
  const newMention = `@${newName}`;

  if (typeof document === 'undefined') {
    return html.split(oldMention).join(newMention);
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    if (textNode.nodeValue?.includes(oldMention)) {
      textNode.nodeValue = textNode.nodeValue.split(oldMention).join(newMention);
    }
  });

  container.querySelectorAll<HTMLElement>('.mention-chip').forEach((mention) => {
    if (mention.dataset.mentionName === oldName) {
      mention.dataset.mentionName = newName;
    }
  });

  return container.innerHTML;
};

const getSettingRename = (node: Node, data: Record<string, unknown>) => {
  if (node.type === 'characterNode' && typeof data.characterName === 'string') {
    const oldName = ((node.data?.characterName as string) || '').trim();
    const newName = data.characterName.trim();
    if (oldName && newName && oldName !== newName) return { oldName, newName };
  }

  if (node.type === 'sceneNode' && typeof data.sceneName === 'string') {
    const oldName = ((node.data?.sceneName as string) || '').trim();
    const newName = data.sceneName.trim();
    if (oldName && newName && oldName !== newName) return { oldName, newName };
  }

  return null;
};

function SmartGuides({ hLines, vLines }: { hLines: number[]; vLines: number[] }) {
  const transform = useStore((state) => state.transform);
  if (vLines.length === 0 && hLines.length === 0) return null;
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {vLines.map((vLine, i) => (
        <line
          key={`v-${i}`}
          x1={vLine * transform[2] + transform[0]}
          y1={0}
          x2={vLine * transform[2] + transform[0]}
          y2="100%"
          stroke="#f43f5e"
          strokeWidth="1.5"
          strokeDasharray="5,5"
        />
      ))}
      {hLines.map((hLine, i) => (
        <line
          key={`h-${i}`}
          x1={0}
          y1={hLine * transform[2] + transform[1]}
          x2="100%"
          y2={hLine * transform[2] + transform[1]}
          stroke="#f43f5e"
          strokeWidth="1.5"
          strokeDasharray="5,5"
        />
      ))}
    </svg>
  );
}

/**
 * 获取媒体文件的原始尺尺寸 * @param url 媒体 URL (data: blob:)
 * @param type MIME 类型
 */
const getMediaDimensions = (
  url: string,
  type: string,
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    if (type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 400, height: 300 });
      img.src = url;
    } else if (type.startsWith('video/')) {
      const video = document.createElement('video');
      video.onloadedmetadata = () =>
        resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => resolve({ width: 400, height: 300 });
      video.src = url;
    } else {
      resolve({ width: 400, height: 200 }); // 音频或其他
    }
  });
};

export function StoryEditor() {
  const nodeTypesMemo = useMemo(() => nodeTypes, []);
  const edgeTypesMemo = useMemo(() => edgeTypes, []);

  const [nodes, setNodes] = useNodesState<Node>(INITIAL_NODES);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [showPlayTest, setShowPlayTest] = useState(false);
  const [showVideoRender, setShowVideoRender] = useState(false);
  const [canvasBg, setCanvasBg] = useState<string>('#F9FAFB');
  const [interactionMode] = useState<'select' | 'box'>('select');
  const [showTitles, setShowTitles] = useState(true);
  const [storyTitlePlacement, setStoryTitlePlacement] = useState<StoryTitlePlacement>('inside');
  const [edgeStyle, setEdgeStyle] = useState<'step' | 'bezier'>('bezier');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsAttention, setSettingsAttention] = useState(false);
  const [savedAIProfiles, setSavedAIProfiles] = useState<SavedAIProfile[]>([]);
  const [activeTextProfileId, setActiveTextProfileId] = useState<string | null>(null);
  const [activeImageProfileId, setActiveImageProfileId] = useState<string | null>(null);
  const [activeVoiceProfileId, setActiveVoiceProfileId] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [customAiPromptsEnabled, setCustomAiPromptsEnabled] = useState(false);
  const [aiPrompts, setAiPrompts] = useState<AIPromptsConfig>(defaultAIPrompts);
  const [aiButtonsConfig, setAiButtonsConfig] = useState<AIButtonsConfig>(defaultAIButtonsConfig);

  const [tx, ty, tzoom] = useStore((s) => s.transform);
  const flowWidth = useStore((s) => s.width);
  const flowHeight = useStore((s) => s.height);

  const getCenterPosition = useCallback(() => {
    return {
      x: (flowWidth / 2 - tx) / tzoom,
      y: (flowHeight / 2 - ty) / tzoom,
    };
  }, [tx, ty, tzoom, flowWidth, flowHeight]);
  // 右上角显示的思考过程文字，null 表示不显示
  const [thinkingContent, setThinkingContent] = useState<string | null>(null);
  const [generateLength, setGenerateLength] = useState<string>('2-3句话');
  // AI续写操作选择弹窗状态
  const [showAIActionModal, setShowAIActionModal] = useState(false);
  const [pendingAINodeId, setPendingAINodeId] = useState<string | null>(null);
  const [zenModeNodeId, setZenModeNodeId] = useState<string | null>(null);
  const [aiLoadingNodeId, setAiLoadingNodeId] = useState<string | null>(null);
  const [horizontalGuides, setHorizontalGuides] = useState<number[]>([]);
  const [verticalGuides, setVerticalGuides] = useState<number[]>([]);

  const [scrollMode, setScrollMode] = useState<'zoom' | 'pan'>('zoom');
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [miniMapPosition, setMiniMapPosition] = useState<'left' | 'right'>('left');
  const [showControls, setShowControls] = useState(true);
  const [highlightedPath, setHighlightedPath] = useState<{
    nodes: Set<string>;
    edges: Set<string>;
  } | null>(null);

  const [pasteAsPlainText, setPasteAsPlainText] = useState(false);
  const [showNodeActions, setShowNodeActions] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showLastSavedTime, setShowLastSavedTime] = useState(true);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const [saveAssistantConversations, setSaveAssistantConversations] = useState(true);
  const [presetColors, setPresetColors] = useState<string[]>(['#F9FAFB', '#0f1f39', '#fef3c7']);
  const [showPresetColors, setShowPresetColors] = useState(true);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [includeApiProfilesInExport, setIncludeApiProfilesInExport] = useState(false);
  const [showProjectHome, setShowProjectHome] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectFilePath, setCurrentProjectFilePath] = useState<string | null>(null);
  const [defaultProjectSaveDir, setDefaultProjectSaveDir] = useState<string | null>(null);
  const [projectIdToLoad, setProjectIdToLoad] = useState<string | null>(null);
  const [pendingHomeProjectId, setPendingHomeProjectId] = useState<string | null>(null);
  const [projectListLoading, setProjectListLoading] = useState(true);
  const [projectSummaries, setProjectSummaries] = useState<
    Awaited<ReturnType<typeof localPersistenceService.listProjects>>
  >([]);
  const [saveFileName, setSaveFileName] = useState(DEFAULT_PROJECT_FILE_NAME);
  const [language, setLanguage] = useState<Language>('zh');
  const [projectTitle, setProjectTitle] = useState('');
  const [currentProjectPersisted, setCurrentProjectPersisted] = useState(false);
  const [pendingProjectAction, setPendingProjectAction] = useState<PendingProjectAction | null>(
    null,
  );
  const [showProjectSavePrompt, setShowProjectSavePrompt] = useState(false);
  const [projectIdsPendingDeletion, setProjectIdsPendingDeletion] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [closeButtonBehavior, setCloseButtonBehavior] = useState<CloseButtonBehavior>('quit');
  const [bubbleStyle, setBubbleStyle] = useState<'glass' | 'flat'>('glass');
  const [toolbarLayout, setToolbarLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [selectionMenuLayout, setSelectionMenuLayout] = useState<'horizontal' | 'vertical'>(
    'horizontal',
  );
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
  } = usePlaytestSettings();

  const t = translations[language];
  const [isDirty, setIsDirty] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const isSavingProjectRef = useRef(false);
  const lastSavedSnapshot = useRef<string>('');

  const activeTextProfile = useMemo(
    () =>
      savedAIProfiles.find(
        (profile): profile is TextAIProfile =>
          profile.kind === 'text' && profile.id === activeTextProfileId,
      ) ?? null,
    [activeTextProfileId, savedAIProfiles],
  );
  const activeImageProfile = useMemo(
    () =>
      savedAIProfiles.find(
        (profile): profile is ImageAIProfile =>
          profile.kind === 'image' && profile.id === activeImageProfileId,
      ) ?? null,
    [activeImageProfileId, savedAIProfiles],
  );
  const activeVoiceProfile = useMemo(
    () =>
      savedAIProfiles.find(
        (profile): profile is VoiceAIProfile =>
          profile.kind === 'voice' && profile.id === activeVoiceProfileId,
      ) ?? null,
    [activeVoiceProfileId, savedAIProfiles],
  );

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
  const ttsApiKey = activeVoiceProfile?.apiKey ?? '';
  const ttsApiUrl = activeVoiceProfile?.apiUrl ?? DEFAULT_TTS_API_URL;
  const ttsModel = activeVoiceProfile?.model ?? DEFAULT_TTS_MODEL;
  const ttsVoice = activeVoiceProfile?.voice ?? DEFAULT_TTS_VOICE;
  const ttsProvider = activeVoiceProfile?.provider ?? 'system';
  const activeTextProfileName = activeTextProfile?.name ?? '';
  const activeImageProfileName = activeImageProfile?.name ?? '';
  const activeVoiceProfileName = activeVoiceProfile?.name ?? '';

  const getExportedAIProfiles = useCallback((): ProjectAIProfilesExport | null => {
    const profiles = [activeTextProfile, activeImageProfile, activeVoiceProfile].filter(
      (profile): profile is SavedAIProfile => Boolean(profile),
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
      activeVoiceProfileId:
        activeVoiceProfileId && exportedProfileIds.has(activeVoiceProfileId)
          ? activeVoiceProfileId
          : null,
      exportedAt: new Date().toISOString(),
    };
  }, [
    activeImageProfile,
    activeImageProfileId,
    activeTextProfile,
    activeTextProfileId,
    activeVoiceProfile,
    activeVoiceProfileId,
  ]);

  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [rightToolbarCollapsed, setRightToolbarCollapsed] = useState(false);

  const isMobile = flowWidth < 768;

  const [qqCopied, setQqCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow();
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  // NOTE: canvas 容器的 ref，用于挂载原生 drag-drop 监听器，绕过 React Flow 的内部事件拦截
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const createCurrentProjectThumbnail = useCallback(
    () => Promise.resolve(createProjectThumbnail(nodes, edges, canvasBg)),
    [canvasBg, edges, nodes],
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
    async (kind: 'text' | 'image' | 'voice', initialProfile: AIProfileSeed = {}) => {
      const baseProfile =
        kind === 'text'
          ? buildDefaultTextProfile()
          : kind === 'image'
            ? buildDefaultImageProfile()
            : buildDefaultVoiceProfile();
      const profile = Object.assign({}, baseProfile, initialProfile, {
        id: baseProfile.id,
        kind,
      }) as SavedAIProfile;
      setSavedAIProfiles((current) => [...current, profile]);
      if (kind === 'text') setActiveTextProfileId(profile.id);
      if (kind === 'image') setActiveImageProfileId(profile.id);
      if (kind === 'voice') setActiveVoiceProfileId(profile.id);
      return profile.id;
    },
    [],
  );

  const handleUpdateAIProfile = useCallback(
    async (
      profileId: string,
      updates: Partial<TextAIProfile & ImageAIProfile & VoiceAIProfile>,
    ) => {
      setSavedAIProfiles((current) =>
        updateProfileList(current, profileId, (profile) => Object.assign({}, profile, updates)),
      );
    },
    [],
  );

  const handleSelectAIProfile = useCallback(
    async (kind: 'text' | 'image' | 'voice', profileId: string) => {
      if (kind === 'text') setActiveTextProfileId(profileId);
      if (kind === 'image') setActiveImageProfileId(profileId);
      if (kind === 'voice') setActiveVoiceProfileId(profileId);
    },
    [],
  );

  const handleDeleteAIProfile = useCallback(
    async (profileId: string) => {
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
        if (activeVoiceProfileId === profileId) {
          setActiveVoiceProfileId(
            nextProfiles.find((profile) => profile.kind === 'voice')?.id ?? null,
          );
        }
        return nextProfiles;
      });
    },
    [activeImageProfileId, activeTextProfileId, activeVoiceProfileId],
  );

  const setImageSize = useCallback(
    (value: React.SetStateAction<string>) => {
      if (!activeImageProfileId) return;

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

  const handleContactCopy = (text: string, type: 'qq' | 'email') => {
    const performCopy = async () => {
      // 1. 尝试使用现代 Clipboard API (需要HTTPS/localhost)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (err) {
          console.error('Modern copy failed', err);
        }
      }

      // 2. 备选方案：传统 textarea 复制(兼容性更强
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        console.error('Fallback copy failed', err);
        return false;
      }
    };

    performCopy().then((success) => {
      if (success) {
        showToast(language === 'zh' ? '复制成功！' : 'Copied to clipboard!');
        if (type === 'qq') {
          setQqCopied(true);
          setTimeout(() => setQqCopied(false), 2000);
        } else {
          setEmailCopied(true);
          setTimeout(() => setEmailCopied(false), 2000);
        }
      }
    });
  };

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
    tx,
    ty,
    tzoom,
    canvasWrapperRef,
  });

  // NOTE: 当全局标题显示状态切换时，自动调整带有媒体的卡片高度
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type !== 'storyNode') return node;
        const hasMedia = !!(node.data.imageUrl || node.data.videoUrl || node.data.audioUrl);
        if (!hasMedia) return node;

        const currentHeight = (node.style?.height as number) || 200;
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

  const [history, setHistory] = useState<{
    past: { nodes: Node[]; edges: Edge[] }[];
    future: { nodes: Node[]; edges: Edge[] }[];
  }>({ past: [], future: [] });
  const lastHistoryState = useRef({ nodes: INITIAL_NODES, edges: [] as Edge[] });
  const isUndoRedoAction = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [didHydrateLocalState, setDidHydrateLocalState] = useState(false);
  const missingTextApiKey = didHydrateLocalState && !activeTextProfile?.apiKey.trim();
  const importModeRef = useRef<'replace' | 'new'>('replace');

  const editorProjectSettings = useMemo(
    () => ({
      canvasBg,
      edgeStyle,
      pasteAsPlainText,
      showNodeActions,
      showStats,
      saveAssistantConversations,
      presetColors,
      showPresetColors,
      showTitles,
      storyTitlePlacement,
      showLastSavedTime,
      generateLength,
      aiProvider,
      imageApiUrl,
      imageModel,
      imageSize,
      ttsApiUrl,
      ttsModel,
      ttsVoice,
      ttsProvider,
      thinkingMode,
      customAiPromptsEnabled,
      aiPrompts,
      aiButtonsConfig,
      scrollMode,
      showMiniMap,
      miniMapPosition,
      showControls,
      projectTitle,
      toolbarLayout,
      selectionMenuLayout,
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
    }),
    [
      aiButtonsConfig,
      aiPrompts,
      aiProvider,
      bubbleStyle,
      canvasBg,
      customAiPromptsEnabled,
      edgeStyle,
      generateLength,
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
      playTestTypewriterSpeed,
      playTestVideoAutoPlay,
      presetColors,
      projectTitle,
      saveAssistantConversations,
      scrollMode,
      selectionMenuLayout,
      showControls,
      showMiniMap,
      showNodeActions,
      showPresetColors,
      showStats,
      showTitles,
      storyTitlePlacement,
      showLastSavedTime,
      thinkingMode,
      theme,
      toolbarLayout,
      ttsApiUrl,
      ttsModel,
      ttsProvider,
      ttsVoice,
    ],
  );

  const editorProjectSettingsSetters = useMemo(
    () => ({
      setCanvasBg,
      setEdgeStyle,
      setPasteAsPlainText,
      setShowNodeActions,
      setShowStats,
      setSaveAssistantConversations,
      setPresetColors,
      setShowPresetColors,
      setShowTitles,
      setStoryTitlePlacement,
      setShowLastSavedTime,
      setGenerateLength,
      setImageSize,
      setCustomAiPromptsEnabled,
      setAiPrompts,
      setAiButtonsConfig,
      setScrollMode,
      setShowMiniMap,
      setMiniMapPosition,
      setShowControls,
      setProjectTitle,
      setToolbarLayout,
      setSelectionMenuLayout,
      setLanguage,
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
    }),
    [
      setCanvasBg,
      setEdgeStyle,
      setPasteAsPlainText,
      setShowNodeActions,
      setShowStats,
      setSaveAssistantConversations,
      setPresetColors,
      setShowPresetColors,
      setShowTitles,
      setStoryTitlePlacement,
      setGenerateLength,
      setImageSize,
      setCustomAiPromptsEnabled,
      setAiPrompts,
      setAiButtonsConfig,
      setScrollMode,
      setShowMiniMap,
      setMiniMapPosition,
      setShowControls,
      setProjectTitle,
      setToolbarLayout,
      setSelectionMenuLayout,
      setLanguage,
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
    ],
  );

  // Update document theme attribute
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  React.useEffect(() => {
    if (!didHydrateLocalState) return;

    void localPersistenceService.saveTheme(theme);
  }, [didHydrateLocalState, theme]);

  React.useEffect(() => {
    if (!didHydrateLocalState) return;

    void localPersistenceService.saveCloseButtonBehavior(closeButtonBehavior);
    void syncCloseButtonBehavior(closeButtonBehavior);
  }, [closeButtonBehavior, didHydrateLocalState]);

  React.useEffect(() => {
    if (!didHydrateLocalState) return;

    void localPersistenceService.saveAIProfiles({
      profiles: savedAIProfiles,
      activeTextProfileId,
      activeImageProfileId,
      activeVoiceProfileId,
    });
  }, [
    didHydrateLocalState,
    savedAIProfiles,
    activeTextProfileId,
    activeImageProfileId,
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

  React.useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Deep equal check for history
      if (JSON.stringify(lastHistoryState.current) !== JSON.stringify({ nodes, edges })) {
        setHistory((h) => ({
          past: [...h.past, lastHistoryState.current].slice(-50),
          future: [],
        }));
        lastHistoryState.current = { nodes, edges };
      }
    }, 800);
  }, [nodes, edges]);

  // 页面关闭/刷新前的提醒
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = t.dirtyWarning;
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useCanvasDnD({
    canvasWrapperRef,
    tx,
    ty,
    tzoom,
    showTitles: showTitles && storyTitlePlacement === 'inside',
    language,
    titleHeight: TITLE_HEIGHT,
    getMediaDimensions,
    setNodes,
  });

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      const newPast = h.past.slice(0, -1);
      isUndoRedoAction.current = true;
      setNodes(previous.nodes);
      setEdges(previous.edges);
      lastHistoryState.current = previous;
      return { past: newPast, future: [{ nodes, edges }, ...h.future] };
    });
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      const newFuture = h.future.slice(1);
      isUndoRedoAction.current = true;
      setNodes(next.nodes);
      setEdges(next.edges);
      lastHistoryState.current = next;
      return { past: [...h.past, { nodes, edges }], future: newFuture };
    });
  }, [nodes, edges, setNodes, setEdges]);

  const {
    handleCopy,
    handlePaste,
    deleteSelected,
    hideSelected,
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
    ttsModel,
    ttsVoice,
    nodeClipboard,
    setNodeClipboard,
    setNodes,
    setEdges,
    setTtsLoading,
    getCenterPosition,
    showToast,
  });

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      if (modifier && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (modifier && key === 'y') {
        e.preventDefault();
        redo();
      } else if (modifier && key === 'c') {
        handleCopy();
      } else if (modifier && key === 'v') {
        e.preventDefault();
        handlePaste();
      } else if (key === 'delete' || key === 'backspace') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          e.preventDefault();
          deleteSelected();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleCopy, handlePaste, deleteSelected]);

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

  const {
    callAIForText,
    callAIForTextResult,
    generateSetting,
    handleAIGenerate: runAIGenerate,
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
    handleUpdateNode,
    setNodes,
    setThinkingContent,
  });

  const {
    handleAddTextToImage,
    handleRemoveTextFromImage,
    handleGenerateSettingNodeImage,
    handleGenerateStoryNodeImage,
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
    showTitles: showTitles && storyTitlePlacement === 'inside',
    setImageSize,
    setNodes,
    showToast,
  });

  const handleAddConnectedNode = useCallback(
    (sourceId: string, side: string) => {
      // NOTE: 全部在 setNodes 函数式更新内部读取最新节点，消除对外部 nodes 的依赖，
      // 防止 nodes 变化导致此回调重建，进而引发 nodesWithCallbacks 重算的无限循环
      const newId = uuidv4();
      const offsetDist = 120;

      let targetHandle = 'left';

      setNodes((nds) => {
        const sourceNode = nds.find((n) => n.id === sourceId);
        if (!sourceNode) return nds;

        const srcW = sourceNode.measured?.width || 300;
        const srcH = sourceNode.measured?.height || 200;

        let newX = sourceNode.position.x;
        let newY = sourceNode.position.y;

        if (side === 'top') {
          newY -= 200 + offsetDist;
          targetHandle = 'bottom';
        } else if (side === 'bottom') {
          newY += srcH + offsetDist;
          targetHandle = 'top';
        } else if (side === 'left') {
          newX -= 300 + offsetDist;
          targetHandle = 'right';
        } else if (side === 'right') {
          newX += srcW + offsetDist;
          targetHandle = 'left';
        }

        const isOccupied = (x: number, y: number) =>
          nds.some((n) => Math.abs(n.position.x - x) < 50 && Math.abs(n.position.y - y) < 50);

        let attempts = 0;
        while (isOccupied(newX, newY) && attempts < 10) {
          if (side === 'bottom' || side === 'top') {
            newX += 320;
          } else {
            newY += 220;
          }
          attempts++;
        }

        const newNode: Node = {
          id: newId,
          type: 'storyNode',
          position: { x: newX, y: newY },
          style: { width: 300, height: 200 },
          data: {
            id: newId,
            title: '分支',
            shape: 'square',
            color: '#ffffff',
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
    [setNodes, setEdges],
  );

  const {
    addNewShape,
    addNewTextNode,
    addNewSummaryNode,
    addNewNumberConditionNode,
    addNewBatchReplaceNode,
    addNewPlotStructureNode,
    addNewCharacterNode,
    addNewSceneNode,
    handleMediaUpload,
    handleExportJSON,
    wrapWithDynamicGroup,
    wrapSelectedWithBackground,
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

      const traceUp = (id: string) => {
        if (pathNodes.has(id)) return;
        pathNodes.add(id);
        edges.forEach((e) => {
          if (e.target === id) {
            pathEdges.add(e.id);
            traceUp(e.source);
          }
        });
      };

      const traceDown = (id: string) => {
        const visited = new Set<string>();
        const queue = [id];
        pathNodes.add(id);

        while (queue.length > 0) {
          const currentId = queue.shift()!;
          if (visited.has(currentId)) continue;
          visited.add(currentId);
          pathNodes.add(currentId);

          edges.forEach((e) => {
            if (e.source === currentId) {
              pathEdges.add(e.id);
              if (!visited.has(e.target)) {
                queue.push(e.target);
              }
            }
          });
        }
      };

      traceUp(nodeId);
      traceDown(nodeId);

      setHighlightedPath({ nodes: pathNodes, edges: pathEdges });
      showToast(language === 'zh' ? '已追踪当前故事线' : 'Storyline traced');
    },
    [nodes, edges, highlightedPath, language, showToast],
  );

  // NOTE: 用户点击AI按钮时先弹出选项弹窗
  const handleAIButtonClick = useCallback((nodeId: string) => {
    setPendingAINodeId(nodeId);
    setShowAIActionModal(true);
  }, []);

  const handleAIGenerate = useCallback(
    async (
      nodeId: string,
      action: 'continue' | 'creative' | 'rewrite' | 'interpolate' | 'scene_only' | 'dialogue_only',
    ) => {
      setShowAIActionModal(false);
      setPendingAINodeId(null);
      setAiLoadingNodeId(nodeId);

      try {
        await runAIGenerate(nodeId, action);
      } catch (error: any) {
        console.error('AI Generation failed:', error);
        alert(`AI 生成失败: ${error.message || '请检查API 密钥和网络连接'}`);
      } finally {
        setAiLoadingNodeId(null);
      }
    },
    [runAIGenerate],
  );

  const createAssistantCards = useCallback(
    (cards: AssistantCardDraft[], mode: 'append' | 'fill-selected' = 'append') => {
      const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
      const getDraftType = (card: AssistantCardDraft): 'story' | 'character' | 'scene' => {
        if (card.type === 'character' || card.type === 'scene' || card.type === 'story')
          return card.type;
        if (
          cleanText(card.characterName) ||
          cleanText(card.personality) ||
          cleanText(card.features) ||
          cleanText(card.background)
        )
          return 'character';
        if (
          cleanText(card.sceneName) ||
          cleanText(card.location) ||
          cleanText(card.items) ||
          cleanText(card.atmosphere)
        )
          return 'scene';
        return 'story';
      };

      const validCards = cards
        .map((card) => ({
          ...card,
          type: getDraftType(card),
          title: cleanText(card.title),
          text: cleanText(card.text),
          characterName: cleanText(card.characterName),
          traits: cleanText(card.traits),
          personality: cleanText(card.personality),
          features: cleanText(card.features),
          background: cleanText(card.background),
          sceneName: cleanText(card.sceneName),
          description: cleanText(card.description),
          location: cleanText(card.location),
          items: cleanText(card.items),
          atmosphere: cleanText(card.atmosphere),
          other: cleanText(card.other),
        }))
        .filter((card) => {
          if (card.type === 'character') {
            return (
              card.characterName ||
              card.traits ||
              card.personality ||
              card.features ||
              card.background ||
              card.other ||
              card.title ||
              card.text
            );
          }
          if (card.type === 'scene') {
            return (
              card.sceneName ||
              card.description ||
              card.location ||
              card.items ||
              card.atmosphere ||
              card.other ||
              card.title ||
              card.text
            );
          }
          return card.text || card.title;
        });

      if (validCards.length === 0) return 0;

      const selectedFillTargets = nodes.filter(
        (n) =>
          n.selected &&
          (n.type === 'storyNode' || n.type === 'characterNode' || n.type === 'sceneNode'),
      );
      const usedDraftIndexes = new Set<number>();
      const usedTargetIds = new Set<string>();
      let filledCount = 0;

      if (mode === 'fill-selected' && selectedFillTargets.length > 0) {
        setNodes((nds) =>
          nds.map((node) => {
            if (
              !selectedFillTargets.some((target) => target.id === node.id) ||
              usedTargetIds.has(node.id)
            )
              return node;
            const compatibleType =
              node.type === 'characterNode'
                ? 'character'
                : node.type === 'sceneNode'
                  ? 'scene'
                  : 'story';
            const draftIndex = validCards.findIndex(
              (draft, index) => draft.type === compatibleType && !usedDraftIndexes.has(index),
            );
            if (draftIndex === -1) return node;

            const draft = validCards[draftIndex];
            usedDraftIndexes.add(draftIndex);
            usedTargetIds.add(node.id);
            filledCount += 1;

            if (compatibleType === 'character') {
              return {
                ...node,
                data: {
                  ...node.data,
                  characterName: draft.characterName || draft.title || node.data.characterName,
                  traits: draft.traits || draft.text || node.data.traits || '',
                  personality: draft.personality || node.data.personality || '',
                  features: draft.features || node.data.features || '',
                  background: draft.background || node.data.background || '',
                  other: draft.other || node.data.other || '',
                  showPersonality: !!(draft.personality || node.data.showPersonality),
                  showFeatures: !!(draft.features || node.data.showFeatures),
                  showBackground: !!(draft.background || node.data.showBackground),
                  showOther: !!(draft.other || node.data.showOther),
                },
              };
            }

            if (compatibleType === 'scene') {
              return {
                ...node,
                data: {
                  ...node.data,
                  sceneName: draft.sceneName || draft.title || node.data.sceneName,
                  description: draft.description || draft.text || node.data.description || '',
                  location: draft.location || node.data.location || '',
                  items: draft.items || node.data.items || '',
                  atmosphere: draft.atmosphere || node.data.atmosphere || '',
                  other: draft.other || node.data.other || '',
                  showLocation: !!(draft.location || node.data.showLocation),
                  showItems: !!(draft.items || node.data.showItems),
                  showAtmosphere: !!(draft.atmosphere || node.data.showAtmosphere),
                  showOther: !!(draft.other || node.data.showOther),
                },
              };
            }

            return {
              ...node,
              data: {
                ...node.data,
                title: draft.title || node.data.title,
                text: draft.text || node.data.text || '',
              },
            };
          }),
        );
      }

      const remainingCards = validCards.filter((_, index) => !usedDraftIndexes.has(index));
      if (remainingCards.length === 0) return filledCount;

      const selectedStories = nodes.filter((n) => n.selected && n.type === 'storyNode');
      const selectedTargets =
        selectedFillTargets.length > 0 ? selectedFillTargets : selectedStories;
      const anchorNodes =
        selectedTargets.length > 0
          ? selectedTargets
          : nodes.filter(
              (n) => n.type === 'storyNode' || n.type === 'characterNode' || n.type === 'sceneNode',
            );
      const center = getCenterPosition();
      const sourceNode = selectedStories[0] || null;
      const sourceWidth = sourceNode
        ? sourceNode.measured?.width || (sourceNode.style?.width as number) || 300
        : 300;
      const baseX = sourceNode ? sourceNode.position.x + sourceWidth / 2 - 150 : center.x - 150;
      const baseY = anchorNodes.length
        ? Math.max(
            ...anchorNodes.map(
              (n) => n.position.y + (n.measured?.height || (n.style?.height as number) || 220),
            ),
          ) + 120
        : center.y - 100;

      const newNodes: Node[] = remainingCards.map((card, index) => {
        const id = uuidv4();
        if (card.type === 'character') {
          return {
            id,
            type: 'characterNode',
            position: { x: baseX, y: baseY + index * 420 },
            selected: index === 0,
            style: { width: 280, height: 420, minHeight: 420 },
            data: {
              id,
              characterName:
                card.characterName ||
                card.title ||
                (language === 'zh' ? 'AI 角色' : 'AI Character'),
              traits: card.traits || card.text || '',
              personality: card.personality || '',
              features: card.features || '',
              background: card.background || '',
              other: card.other || '',
              showPersonality: !!card.personality,
              showFeatures: !!card.features,
              showBackground: !!card.background,
              showOther: !!card.other,
            } satisfies CharacterNodeData,
          };
        }

        if (card.type === 'scene') {
          return {
            id,
            type: 'sceneNode',
            position: { x: baseX, y: baseY + index * 420 },
            selected: index === 0,
            style: { width: 280, height: 420, minHeight: 420 },
            data: {
              id,
              sceneName:
                card.sceneName || card.title || (language === 'zh' ? 'AI 场景' : 'AI Scene'),
              description: card.description || card.text || '',
              location: card.location || '',
              items: card.items || '',
              atmosphere: card.atmosphere || '',
              other: card.other || '',
              showLocation: !!card.location,
              showItems: !!card.items,
              showAtmosphere: !!card.atmosphere,
              showOther: !!card.other,
            } satisfies SceneNodeData,
          };
        }

        return {
          id,
          type: 'storyNode',
          position: { x: baseX, y: baseY + index * 280 },
          selected: index === 0,
          style: { width: 300, height: 200 },
          data: {
            id,
            title: card.title || (language === 'zh' ? 'AI 剧情卡片' : 'AI Story Card'),
            text: card.text,
            shape: 'square',
            color: '#ffffff',
          } satisfies StoryNodeData,
        };
      });

      const storyNodesToLink = newNodes.filter((node) => node.type === 'storyNode');
      const newEdges: Edge[] = [];
      if (sourceNode && storyNodesToLink[0]) {
        newEdges.push({
          id: `e-${sourceNode.id}-${storyNodesToLink[0].id}`,
          source: sourceNode.id,
          sourceHandle: 'bottom',
          target: storyNodesToLink[0].id,
          targetHandle: 'top',
          type: 'customEdge',
        });
      }
      for (let i = 0; i < storyNodesToLink.length - 1; i += 1) {
        newEdges.push({
          id: `e-${storyNodesToLink[i].id}-${storyNodesToLink[i + 1].id}`,
          source: storyNodesToLink[i].id,
          sourceHandle: 'bottom',
          target: storyNodesToLink[i + 1].id,
          targetHandle: 'top',
          type: 'customEdge',
        });
      }

      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
      if (newEdges.length > 0) setEdges((eds) => [...eds, ...newEdges]);
      return filledCount + remainingCards.length;
    },
    [nodes, setNodes, setEdges, getCenterPosition, language],
  );

  const {
    assistantOpen,
    setAssistantOpen,
    assistantPanelWidth,
    assistantResizing,
    assistantInput,
    setAssistantInput,
    assistantLoading,
    assistantListening,
    assistantDocuments,
    assistantDocumentLoading,
    assistantTasks,
    setAssistantTasks,
    activeAssistantTaskId,
    setActiveAssistantTaskId,
    assistantMessages,
    assistantMessagesRef,
    handleNewAssistantTask,
    handleRenameAssistantTask,
    handleRequestCloseAssistantTask,
    handleConfirmCloseAssistantTask,
    handleCancelCloseAssistantTask,
    assistantTaskPendingCloseId,
    handleAssistantSend,
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
  } = useAssistantPanel({
    language,
    isMobile,
    flowWidth,
    selectedAssistantTargetNodes,
    nodes,
    callAIForTextResult,
    createAssistantCards,
    hasTextApiKey: !missingTextApiKey,
    onMissingTextApiKeyRequest: () => {
      setSettingsAttention(true);
      window.setTimeout(() => setSettingsAttention(false), 1800);
    },
  });

  const { getProjectSnapshot, applyProjectData, confirmExportJSON, handleImportZIP } =
    useProjectSerialization({
      nodes,
      edges,
      settings: editorProjectSettings,
      settingsSetters: editorProjectSettingsSetters,
      assistantTasks,
      activeAssistantTaskId,
      setAssistantTasks,
      setActiveAssistantTaskId,
      saveFileName,
      currentProjectId,
      currentProjectFilePath,
      defaultProjectSaveDir,
      setNodes,
      setEdges,
      setIsDirty,
      setShowSaveNameModal,
      lastSavedSnapshotRef: lastSavedSnapshot,
      showToast,
      getProjectThumbnailDataUrl: createCurrentProjectThumbnail,
      getExportedAIProfiles,
      onProjectFilePathSaved: async (filePath) => {
        setCurrentProjectFilePath(filePath);
        if (currentProjectId) {
          await localPersistenceService.saveProjectFilePath(currentProjectId, filePath);
        }
      },
      onImportedProject: async ({
        projectData,
        suggestedProjectName,
        replaceCurrentProject,
        zip,
        thumbnailDataUrl,
      }) => {
        const restoredProjectData = zip
          ? await createProjectSerializer({
              defaultEdgeOptions,
              defaultAIPrompts,
              defaultAIButtonsConfig,
            }).restoreImportedProject(projectData, zip)
          : projectData;
        const shouldReplaceCurrentProject =
          replaceCurrentProject && currentProjectId && importModeRef.current !== 'new';

        if (shouldReplaceCurrentProject) {
          await restoreProjectSession(currentProjectId, restoredProjectData, suggestedProjectName);
          importModeRef.current = 'replace';
          return true;
        }

        const nextProjectId = uuidv4();
        const normalizedName = suggestedProjectName.trim() || DEFAULT_PROJECT_FILE_NAME;
        await restoreProjectSession(nextProjectId, restoredProjectData, normalizedName);
        await localPersistenceService.saveLocalProject({
          id: nextProjectId,
          projectName: normalizedName,
          projectData: restoredProjectData,
          updatedAt: Date.now(),
          thumbnailDataUrl: thumbnailDataUrl ?? null,
        });
        importModeRef.current = 'replace';
        await refreshProjectSummaries();
        return true;
      },
      defaultEdgeOptions,
      defaultAIPrompts,
      defaultAIButtonsConfig,
    });

  const refreshProjectSummaries = useCallback(async () => {
    const projects = await localPersistenceService.listProjects();
    setProjectSummaries(projects);
  }, []);

  const handleApplySettingsToOtherProjects = useCallback(
    async (targetProjectIds: string[]) => {
      try {
        const updatedCount = await localPersistenceService.applySettingsToOtherProjects(
          editorProjectSettings,
          currentProjectId,
          targetProjectIds,
        );
        await refreshProjectSummaries();

        showToast(
          language === 'zh'
            ? updatedCount > 0
              ? `已应用到 ${updatedCount} 个其他项目`
              : '没有可应用的其他项目'
            : updatedCount > 0
              ? `Applied to ${updatedCount} other project${updatedCount === 1 ? '' : 's'}`
              : 'No other projects to apply',
        );
      } catch (error) {
        console.error('Failed to apply settings to other projects:', error);
        showToast(
          language === 'zh' ? '应用到其他项目失败' : 'Failed to apply settings to other projects',
          'error',
        );
      }
    },
    [currentProjectId, editorProjectSettings, language, refreshProjectSummaries, showToast],
  );

  const restoreProjectSession = useCallback(
    async (
      projectId: string,
      projectData: ProjectSnapshotData,
      projectName: string,
      options?: { fromHome?: boolean; updatedAt?: number },
    ) => {
      await applyProjectData(projectData, { markSaved: true });
      const projectFilePath = await localPersistenceService.getProjectFilePath(projectId);

      setCurrentProjectId(projectId);
      setCurrentProjectFilePath(projectFilePath);
      setSaveFileName(projectName.trim() || DEFAULT_PROJECT_FILE_NAME);
      const nextProjectTitle =
        projectData.settings?.projectTitle?.trim() ||
        (projectName.trim() && projectName.trim() !== DEFAULT_PROJECT_FILE_NAME ? projectName : '');
      setProjectTitle(nextProjectTitle);
      setLastSavedTime(options?.updatedAt || null);
      setCurrentProjectPersisted(true);
      resetAssistantTasks(projectData.assistantTasks, projectData.activeAssistantTaskId || null);
      lastHistoryState.current = {
        nodes: projectData.nodes as Node[],
        edges: projectData.edges as Edge[],
      };
      setHistory({ past: [], future: [] });
      setShowProjectHome(false);
      await localPersistenceService.saveLastProjectId(projectId);
      if (options?.fromHome) {
        showToast(language === 'zh' ? '已打开本地项目' : 'Project opened');
      }
    },
    [applyProjectData, language, resetAssistantTasks, showToast],
  );

  const { autoSaveData, showAutoSaveModal, discardAutoSave, recoverAutoSave, clearAutoSave } =
    useAutoSave<ProjectSnapshotData>({
      projectId: currentProjectId,
      getProjectSnapshot,
      lastSavedSnapshotRef: lastSavedSnapshot,
      setIsDirty,
      applyRecoveredProject: async (projectData) => {
        await applyProjectData(projectData, { markSaved: false });
        lastHistoryState.current = {
          nodes: projectData.nodes as Node[],
          edges: projectData.edges as Edge[],
        };
        setHistory({ past: [], future: [] });
        setIsDirty(true);
      },
      showToast,
      language,
      enabled: Boolean(didHydrateLocalState && currentProjectId),
    });

  const resetEditorToBlankState = useCallback(() => {
    const blankNodes = INITIAL_NODES.map((node) => ({ ...node, data: { ...node.data } })) as Node[];
    const blankSnapshot = {
      nodes: blankNodes,
      edges: [] as Edge[],
      settings: {
        ...editorProjectSettings,
        projectTitle: '',
      },
      assistantTasks: undefined,
      activeAssistantTaskId: undefined,
    } as ProjectSnapshotData;

    setCurrentProjectId(null);
    setCurrentProjectFilePath(null);
    setProjectIdToLoad(null);
    setPendingHomeProjectId(null);
    setCurrentProjectPersisted(false);
    setSaveFileName(DEFAULT_PROJECT_FILE_NAME);
    setProjectTitle('');
    resetAssistantTasks(undefined, null);
    setNodes(blankNodes);
    setEdges([]);
    lastHistoryState.current = { nodes: blankNodes, edges: [] as Edge[] };
    setHistory({ past: [], future: [] });
    lastSavedSnapshot.current = JSON.stringify(blankSnapshot);
    setIsDirty(false);
  }, [editorProjectSettings, resetAssistantTasks, setEdges, setNodes]);

  const saveCurrentProject = useCallback(async () => {
    if (isSavingProjectRef.current) return false;

    isSavingProjectRef.current = true;
    setIsSavingProject(true);

    try {
      const savedAt = Date.now();
      const projectId = currentProjectId ?? uuidv4();
      const snapshot = JSON.parse(getProjectSnapshot()) as ProjectSnapshotData;
      const persistedProjectName = getPersistedProjectName(projectTitle, saveFileName, savedAt);
      const persistedProjectTitle = projectTitle.trim() || persistedProjectName;

      snapshot.settings = {
        ...snapshot.settings,
        projectTitle: persistedProjectTitle,
      };

      const thumbnailDataUrl = await createCurrentProjectThumbnail();
      await localPersistenceService.saveLocalProject({
        id: projectId,
        projectName: persistedProjectName,
        projectData: snapshot,
        updatedAt: savedAt,
        thumbnailDataUrl,
      });

      setCurrentProjectId(projectId);
      setCurrentProjectPersisted(true);
      setSaveFileName(persistedProjectName);
      setProjectTitle(persistedProjectTitle);
      setLastSavedTime(savedAt);
      lastSavedSnapshot.current = JSON.stringify(snapshot);
      setIsDirty(false);
      await autosaveService.clearForProject(projectId);
      await refreshProjectSummaries();
      showToast(language === 'zh' ? '项目已保存到本地' : 'Project saved locally');
      return true;
    } catch (error) {
      console.error('Failed to save project:', error);
      const message = error instanceof Error ? error.message : String(error);
      showToast(language === 'zh' ? `保存失败: ${message}` : `Save failed: ${message}`);
      return false;
    } finally {
      isSavingProjectRef.current = false;
      setIsSavingProject(false);
    }
  }, [
    currentProjectId,
    createCurrentProjectThumbnail,
    getProjectSnapshot,
    language,
    projectTitle,
    refreshProjectSummaries,
    saveFileName,
    showToast,
  ]);

  const handleCreateProject = useCallback(async () => {
    const projectId = uuidv4();
    const projectName = DEFAULT_PROJECT_FILE_NAME;
    const emptyProject = {
      nodes: INITIAL_NODES.map((node) => ({ ...node, data: { ...node.data } })) as Node[],
      edges: [] as Edge[],
      settings: {
        ...editorProjectSettings,
        projectTitle: '',
      },
      assistantTasks: undefined,
      activeAssistantTaskId: undefined,
    } as ProjectSnapshotData;

    await restoreProjectSession(projectId, emptyProject, projectName);
    lastSavedSnapshot.current = JSON.stringify(emptyProject);
    setCurrentProjectPersisted(false);
    setPendingHomeProjectId(null);
    setProjectIdToLoad(null);
  }, [editorProjectSettings, refreshProjectSummaries, restoreProjectSession]);

  const handleRenameProject = useCallback(
    async (projectId: string, nextName: string) => {
      const normalizedName = nextName.trim();

      const persistedName = normalizedName || buildAutoProjectName();
      await localPersistenceService.renameProject(projectId, persistedName);
      if (projectId === currentProjectId) {
        setSaveFileName(persistedName);
        setProjectTitle(persistedName);
      }
      await refreshProjectSummaries();
    },
    [currentProjectId, refreshProjectSummaries],
  );

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await localPersistenceService.deleteProject(projectId);

      if (projectId === currentProjectId) {
        resetEditorToBlankState();
        setShowProjectHome(true);
      }

      await refreshProjectSummaries();
    },
    [currentProjectId, refreshProjectSummaries, resetEditorToBlankState],
  );

  const handleDeleteProjects = useCallback(
    async (projectIds: string[]) => {
      const uniqueProjectIds = Array.from(new Set(projectIds));
      if (uniqueProjectIds.length === 0) return;

      await Promise.all(
        uniqueProjectIds.map((projectId) => localPersistenceService.deleteProject(projectId)),
      );

      if (currentProjectId && uniqueProjectIds.includes(currentProjectId)) {
        resetEditorToBlankState();
        setShowProjectHome(true);
      }

      await refreshProjectSummaries();
    },
    [currentProjectId, refreshProjectSummaries, resetEditorToBlankState],
  );

  const performPendingProjectAction = useCallback(
    async (action: PendingProjectAction | null) => {
      if (!action) return;

      if (action.type === 'create') {
        await handleCreateProject();
        return;
      }

      if (action.type === 'open') {
        setPendingHomeProjectId(action.projectId);
        setProjectIdToLoad(action.projectId);
        return;
      }

      if (action.type === 'import-new') {
        importModeRef.current = 'new';
        jsonInputRef.current?.click();
        return;
      }

      if (action.type === 'close-window') {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().destroy();
          return;
        } catch (error) {
          console.warn('Failed to close Tauri window, falling back to browser close', error);
        }

        window.close();
      }
    },
    [handleCreateProject],
  );

  const requestProjectAction = useCallback(
    (action: PendingProjectAction) => {
      if (!isDirty) {
        void performPendingProjectAction(action);
        return;
      }

      setPendingProjectAction(action);
      setShowProjectSavePrompt(true);
    },
    [isDirty, performPendingProjectAction],
  );

  const handleConfirmSaveCurrentProject = useCallback(async () => {
    const action = pendingProjectAction;
    setShowProjectSavePrompt(false);
    setPendingProjectAction(null);
    const didSave = await saveCurrentProject();
    if (!didSave) return;
    await performPendingProjectAction(action);
  }, [pendingProjectAction, performPendingProjectAction, saveCurrentProject]);

  const handleDiscardCurrentProjectChanges = useCallback(async () => {
    const action = pendingProjectAction;
    setShowProjectSavePrompt(false);
    setPendingProjectAction(null);
    await clearAutoSave();

    if (currentProjectId && currentProjectPersisted) {
      const savedProject = await localPersistenceService.loadProject(currentProjectId);
      if (savedProject) {
        await restoreProjectSession(
          savedProject.id,
          savedProject.projectData,
          savedProject.projectName,
          { updatedAt: savedProject.updatedAt },
        );
      } else {
        resetEditorToBlankState();
      }
    } else {
      resetEditorToBlankState();
    }

    await performPendingProjectAction(action);
  }, [
    clearAutoSave,
    currentProjectId,
    currentProjectPersisted,
    pendingProjectAction,
    performPendingProjectAction,
    resetEditorToBlankState,
    restoreProjectSession,
  ]);

  const handleCancelProjectAction = useCallback(() => {
    setShowProjectSavePrompt(false);
    setPendingProjectAction(null);
  }, []);

  const handleExportProjectFromList = useCallback(
    async (projectId: string) => {
      try {
        const project = await localPersistenceService.loadProject(projectId);
        if (!project) {
          showToast(language === 'zh' ? '找不到要导出的项目' : 'Project not found for export');
          return;
        }
        const serializer = createProjectSerializer({
          defaultEdgeOptions,
          defaultAIPrompts,
          defaultAIButtonsConfig,
        });
        const filePath = await localPersistenceService.getProjectFilePath(projectId);
        const result = await serializer.exportZip({
          projectData: project.projectData,
          fileName: project.projectName,
          filePath,
          thumbnailDataUrl:
            project.thumbnailDataUrl ??
            createProjectThumbnail(
              project.projectData.nodes as Node[],
              project.projectData.edges as Edge[],
              project.projectData.settings?.canvasBg,
            ),
          defaultSaveDir: defaultProjectSaveDir,
        });
        if (result.canceled) return;
        if (result.filePath) {
          await localPersistenceService.saveProjectFilePath(projectId, result.filePath);
          if (projectId === currentProjectId) {
            setCurrentProjectFilePath(result.filePath);
          }
        }
        window.setTimeout(() => {
          const savedLocation = result.filePath
            ? result.filePath
            : language === 'zh'
              ? '浏览器下载文件夹'
              : 'your browser downloads folder';
          showToast(
            language === 'zh'
              ? `ZIP 备份已导出到：${savedLocation}`
              : `ZIP backup exported to: ${savedLocation}`,
          );
        }, 0);
        showToast(language === 'zh' ? '项目导出成功' : 'Project exported successfully');
      } catch (e) {
        console.error(e);
        showToast(language === 'zh' ? '导出失败' : 'Export failed');
      }
    },
    [currentProjectId, defaultProjectSaveDir, language, showToast],
  );

  const handleExportProjectsBundleFromList = useCallback(
    async (projectIds: string[]) => {
      try {
        const serializer = createProjectSerializer({
          defaultEdgeOptions,
          defaultAIPrompts,
          defaultAIButtonsConfig,
        });
        const projects = (
          await Promise.all(
            projectIds.map(async (projectId) => {
              const project = await localPersistenceService.loadProject(projectId);
              if (!project) return null;
              return {
                projectData: project.projectData,
                projectName: project.projectName,
                thumbnailDataUrl:
                  project.thumbnailDataUrl ??
                  createProjectThumbnail(
                    project.projectData.nodes as Node[],
                    project.projectData.edges as Edge[],
                    project.projectData.settings?.canvasBg,
                  ),
              };
            }),
          )
        ).filter((project): project is NonNullable<typeof project> => Boolean(project));

        if (projects.length === 0) {
          showToast(language === 'zh' ? '找不到要导出的项目' : 'Projects not found for export');
          return;
        }

        const result = await serializer.exportProjectBundle({
          projects,
          fileName: `GalWriter项目整合包-${new Date().toISOString().slice(0, 10)}.zip`,
          defaultSaveDir: defaultProjectSaveDir,
        });
        if (result.canceled) return;
        window.setTimeout(() => {
          const savedLocation = result.filePath
            ? result.filePath
            : language === 'zh'
              ? '浏览器下载文件夹'
              : 'your browser downloads folder';
          showToast(
            language === 'zh'
              ? `ZIP 整合包已导出到：${savedLocation}`
              : `ZIP bundle exported to: ${savedLocation}`,
          );
        }, 0);
        showToast(
          language === 'zh' ? '项目整合包导出成功' : 'Project bundle exported successfully',
        );
      } catch (e) {
        console.error(e);
        showToast(language === 'zh' ? '整合包导出失败' : 'Bundle export failed');
      }
    },
    [defaultProjectSaveDir, language, showToast],
  );

  const handleOpenProject = useCallback(
    async (projectId: string) => {
      requestProjectAction({ type: 'open', projectId });
    },
    [requestProjectAction],
  );

  const handleImportProjectFromHome = useCallback(() => {
    requestProjectAction({ type: 'import-new' });
  }, [requestProjectAction]);

  const openImportPicker = useCallback(() => {
    importModeRef.current = 'replace';
    jsonInputRef.current?.click();
  }, []);

  const handleChooseDefaultProjectSaveLocation = useCallback(async () => {
    if (!isTauriRuntime()) {
      showToast(
        language === 'zh'
          ? '默认保存位置仅在桌面端可设置'
          : 'Default save location can only be set in the desktop app',
        'error',
      );
      return;
    }

    try {
      const invoke = await getTauriInvoke();
      const result = (await invoke('choose_project_default_save_dir', {
        initialDir: defaultProjectSaveDir,
      })) as { path?: string | null } | undefined;

      if (!result?.path) return;
      setDefaultProjectSaveDir(result.path);
      await localPersistenceService.saveDefaultProjectSaveDir(result.path);
      showToast(language === 'zh' ? '默认保存位置已更新' : 'Default save location updated');
    } catch (error) {
      console.error('Failed to choose default project save location:', error);
      showToast(language === 'zh' ? '设置默认保存位置失败' : 'Failed to set default save location');
    }
  }, [defaultProjectSaveDir, language, showToast]);

  React.useEffect(() => {
    let cancelled = false;

    const hydrateLocalState = async () => {
      try {
        const [appSettings, savedProfilesState, projects] = await Promise.all([
          localPersistenceService.loadAppSettings(),
          localPersistenceService.loadAIProfiles(),
          localPersistenceService.listProjects(),
        ]);

        if (cancelled) return;
        setProjectSummaries(projects);
        setProjectListLoading(false);
        setShowProjectHome(projects.length > 0);
        setDefaultProjectSaveDir(appSettings.defaultProjectSaveDir || null);

        setSavedAIProfiles(savedProfilesState.profiles);
        setActiveTextProfileId(savedProfilesState.activeTextProfileId);
        setActiveImageProfileId(savedProfilesState.activeImageProfileId);
        setActiveVoiceProfileId(savedProfilesState.activeVoiceProfileId);

        if (appSettings.theme) {
          setTheme(appSettings.theme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          setTheme('dark');
        }
        setCloseButtonBehavior(appSettings.closeButtonBehavior);
        void syncCloseButtonBehavior(appSettings.closeButtonBehavior);
      } catch (error) {
        console.error('Failed to hydrate local editor state', error);
      } finally {
        if (!cancelled) {
          setDidHydrateLocalState(true);
        }
      }
    };

    void hydrateLocalState();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!didHydrateLocalState || !projectIdToLoad) return;

    let cancelled = false;

    const loadSelectedProject = async () => {
      const project = await localPersistenceService.loadProject(projectIdToLoad);
      if (!project || cancelled) return;

      await restoreProjectSession(project.id, project.projectData, project.projectName, {
        fromHome: pendingHomeProjectId === project.id,
        updatedAt: project.updatedAt,
      });
      if (!cancelled) {
        setPendingHomeProjectId(null);
        setProjectIdToLoad(null);
        await refreshProjectSummaries();
      }
    };

    void loadSelectedProject();

    return () => {
      cancelled = true;
    };
  }, [
    didHydrateLocalState,
    pendingHomeProjectId,
    projectIdToLoad,
    refreshProjectSummaries,
    restoreProjectSession,
  ]);

  React.useEffect(() => {
    if (!currentProjectId) {
      setIsDirty(false);
      return;
    }

    const snapshot = getProjectSnapshot();
    setIsDirty(snapshot !== lastSavedSnapshot.current);
  }, [assistantTasks, currentProjectId, edges, getProjectSnapshot, nodes, projectTitle]);

  const footerHint = useMemo(() => {
    if (assistantOpen) {
      return language === 'zh'
        ? 'AI 生成内容仅供参考，请结合自己的剧情判断使用。'
        : 'AI-generated content is for reference only; review it against your own story. Save important settings and project work regularly to avoid losing changes.';
    }

    const selectedType =
      selectedNodes.length === 1
        ? selectedNodes[0].type
        : selectedNodes.length > 1
          ? 'multi'
          : 'default';
    const hints: Record<string, string> =
      language === 'zh'
        ? {
            storyNode:
              '剧情卡片可以编辑标题、正文和分支选项。拖动卡片边缘的连接点，可以把剧情路径串起来。',
            characterNode:
              '人物卡片用于整理角色名、性格、特点和背景。勾选显示项后，卡片会把对应设定展示在画布上。',
            sceneNode:
              '场景卡片用于记录地点、物品、氛围和补充描述。勾选显示项后，卡片会把对应场景信息展示在画布上。',
            plotStructureNode:
              '剧情结构卡片会根据背景区域里的卡片生成后续剧情。先把它放进背景区域，再填写方向和生成数量。',
            summaryNode:
              '文本汇总卡片可以整理连接进来的剧情内容。调整编号、箭头和标题选项，可以改变输出格式。',
            batchReplaceNode:
              '批量替换卡片会处理背景区域内的文本内容。先设置查找和替换规则，再对目标区域执行。',
            numberConditionNode:
              '数字判断卡片用于按数值条件分出路径。设置阈值后，把不同结果连接到后续剧情。',
            textNode: '文字标签适合做章节标注和画布说明。双击文字可以快速编辑内容。',
            backgroundNode:
              '背景区域可以把相关卡片包在一起管理。点击锁定按钮可以切换是否允许移动和调整。',
            groupNode: '分组区域用于整理一组相关卡片。拖动区域可以移动整组内容的位置。',
            aiNode:
              'AI 汇总分析卡片会读取连接进来的剧情卡片。把需要分析的内容用箭头连入它，再执行汇总。',
            multi:
              '已选中多张卡片，可以一起拖动或使用框选菜单整理。批量操作前请确认选中的范围是否正确。',
            default: t.footerHint,
          }
        : {
            storyNode:
              'Story cards let you edit titles, body text, and branch choices. Drag connection handles to link the story path.',
            characterNode:
              'Character cards organize names, personalities, traits, and backstory. Toggle visible fields to show those details on the canvas.',
            sceneNode:
              'Scene cards record locations, items, atmosphere, and extra description. Toggle visible fields to show those scene details on the canvas.',
            plotStructureNode:
              'Plot structure cards generate continuations from cards inside a background area. Place one inside the area, then set direction and card count.',
            summaryNode:
              'Summary cards collect connected story content. Change numbering, arrows, and title options to adjust the output format.',
            batchReplaceNode:
              'Batch replace cards process text inside a background area. Set find and replace rules before running it on the target area.',
            numberConditionNode:
              'Number condition cards split paths by numeric rules. Set the threshold, then connect each result to the next story step.',
            textNode:
              'Text labels are useful for chapter marks and canvas notes. Double-click the text to edit it quickly.',
            backgroundNode:
              'Background areas group related cards together. Use the lock button to switch whether it can move and resize.',
            groupNode:
              'Group areas organize a set of related cards. Drag the area to move the grouped content together.',
            aiNode:
              'AI summary cards read story cards connected into them. Connect the content you want analyzed, then run the summary.',
            multi:
              'Multiple cards are selected, so you can drag or organize them together. Check the selected range before using batch actions.',
            default: t.footerHint,
          };

    return hints[selectedType || 'default'] || hints.default;
  }, [assistantOpen, language, selectedNodes, t.footerHint]);

  const handleGenerateSettingText = useCallback(
    async (nodeId: string, type: 'character' | 'scene') => {
      await generateSetting(nodeId, type);
    },
    [generateSetting],
  );

  const handlePlotStructureGenerate = useCallback(
    async (params: PlotStructureGenerateParams) => {
      const { toolNodeId, cardCount, detailLevel, direction, regionStoryNodes, region } = params;

      if (regionStoryNodes.length === 0) {
        alert('区域内没有找到可续写的剧情卡片');
        return;
      }

      const existingContent = formatRegionStoryForPrompt(regionStoryNodes);
      const detailText =
        detailLevel === 'brief'
          ? '每段 1-3 句话，简洁推进剧情'
          : detailLevel === 'detailed'
            ? '每段详细展开，包含场景描写、动作和人物对话'
            : generateLength;

      const prompt = `你是一位专业的互动剧本/视觉小说创作者。

以下是区域内已有剧情（按顺序排列）：
${existingContent}

用户希望的后续发展方向：
${direction}

请根据上述内容和发展方向，生成 ${cardCount} 张后续剧情卡片。
详细程度要求：${detailText}

请严格按以下格式返回，每张卡片以 ### 标题 开头，正文换行后直接写内容。不要包含其他说明：
### 卡片标题
正文内容

### 卡片标题
正文内容`;

      try {
        const result = await callAIForText(prompt);
        const cards = parseGeneratedPlotCards(result).slice(0, cardCount);

        if (cards.length === 0) {
          alert('AI 返回内容无法解析，请重试');
          return;
        }

        const lastNodeId = regionStoryNodes[regionStoryNodes.length - 1].id;
        const newIds = cards.map(() => uuidv4());
        const newEdges: Edge[] = [];
        let sourceId = lastNodeId;

        for (let i = 0; i < cards.length; i++) {
          newEdges.push({
            id: `e-${sourceId}-${newIds[i]}`,
            source: sourceId,
            sourceHandle: 'right',
            target: newIds[i],
            targetHandle: 'left',
            type: 'customEdge',
          });
          sourceId = newIds[i];
        }

        setNodes((nds) => {
          const lastNode = nds.find((n) => n.id === lastNodeId);
          if (!lastNode) return nds;

          const srcW = lastNode.measured?.width || (lastNode.style?.width as number) || 300;
          const offsetDist = 120;
          let currentX = lastNode.position.x + srcW + offsetDist;
          let currentY = lastNode.position.y;

          const newNodes: Node[] = cards.map((card, index) => {
            const newId = newIds[index];
            const isOccupied = (x: number, y: number) =>
              nds.some((n) => Math.abs(n.position.x - x) < 50 && Math.abs(n.position.y - y) < 50);

            let attempts = 0;
            while (isOccupied(currentX, currentY) && attempts < 10) {
              currentY += 220;
              attempts++;
            }

            const node: Node = {
              id: newId,
              type: 'storyNode',
              position: { x: currentX, y: currentY },
              style: { width: 300, height: 200 },
              data: {
                id: newId,
                title: card.title,
                text: card.text,
                shape: 'square',
                color: '#ffffff',
              } satisfies StoryNodeData,
            };

            currentX += 420;
            return node;
          });

          let updatedNodes = [...nds, ...newNodes];

          if (region?.type === 'dynamicGroup') {
            updatedNodes = updatedNodes.map((node) => {
              if (node.id !== region.id || node.type !== 'groupNode') return node;
              const childIds = Array.isArray(node.data.childIds) ? node.data.childIds : [];
              const mergedChildIds = Array.from(new Set([...childIds, ...newIds]));
              return {
                ...node,
                data: { ...node.data, childIds: mergedChildIds },
              };
            });
          }

          if (region?.type === 'background') {
            const containedIds = [
              ...regionStoryNodes.map((item) => item.id),
              toolNodeId,
              ...newIds,
            ];
            updatedNodes = expandBackgroundToFitNodes(updatedNodes, region.id, containedIds);
          }

          return updatedNodes;
        });

        setEdges((eds) => [...eds, ...newEdges]);
      } catch (error: any) {
        console.error('Plot structure generation failed:', error);
        alert(`剧情生成失败: ${error.message || '请检查 API 密钥和网络连接'}`);
      }
    },
    [callAIForText, generateLength, setNodes, setEdges],
  );

  const handleAIAnalyze = useCallback(
    async (nodeId: string, mode: string = 'summary') => {
      try {
        await runAIAnalyze(nodeId, mode);
      } catch (error: any) {
        console.error('AI Analysis failed:', error);
        alert(`AI 分析失败: ${error.message || '请检查网络和 API 配置'}`);
      }
    },
    [runAIAnalyze],
  );

  const {
    isRightDragging,
    setIsRightDragging,
    onNodesChange,
    onEdgesChange,
    onConnect,
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

  // Bind callbacks to nodes and edges on render
  const nodesWithCallbacks = useMemo<Node[]>(() => {
    return nodes.map((n) => {
      return {
        ...n,
        hidden: !!n.data?.hidden,
        draggable: !n.data?.locked,
        selectable: !n.data?.locked,
        data: {
          ...n.data,
          showTitles,
          storyTitlePlacement,
          isAILoading: aiLoadingNodeId === n.id,
          onUpdate: handleUpdateNode,
          onAddNode: handleAddConnectedNode,
          onDelete: handleDeleteNode,
          onZenMode: setZenModeNodeId,
          onAIGenerate: handleAIButtonClick,
          onAIAnalyze: handleAIAnalyze,
          onGenerateImage: handleGenerateStoryNodeImage,
          onGenerateSettingImage: handleGenerateSettingNodeImage,
          onAddTextToImage: handleAddTextToImage,
          onRemoveTextFromImage: handleRemoveTextFromImage,
          onExtractMedia: handleExtractMedia,
          onGenerateSettingText: handleGenerateSettingText,
          onPlotStructureGenerate: handlePlotStructureGenerate,
          onHighlightStoryline: toggleStorylineHighlight,
          isHighlighted: highlightedPath?.nodes.has(n.id),
          pasteAsPlainText,
          showNodeActions,
          language,
          theme,
        },
        style: {
          ...n.style,
          opacity: highlightedPath ? (highlightedPath.nodes.has(n.id) ? 1 : 0.15) : 1,
          filter:
            highlightedPath && !highlightedPath.nodes.has(n.id)
              ? 'grayscale(0.8) blur(1px)'
              : 'none',
          // NOTE: 极其重要：不要在这里使用 transition: all，否则拖拽时 transform 会有延迟，导致不跟手
          transition: 'opacity 0.5s ease-in-out, filter 0.5s ease-in-out',
        },
      };
    });
    // NOTE: 补充 highlightedPath、handleAIAnalyze、toggleStorylineHighlight 为正确依赖，
    // 防止闭包过期导致这些引用读到旧值
  }, [
    nodes,
    showTitles,
    storyTitlePlacement,
    aiLoadingNodeId,
    handleUpdateNode,
    handleAddConnectedNode,
    handleDeleteNode,
    handleAIButtonClick,
    handleAIAnalyze,
    handleGenerateStoryNodeImage,
    handleGenerateSettingNodeImage,
    handleAddTextToImage,
    handleRemoveTextFromImage,
    handleExtractMedia,
    handleGenerateSettingText,
    handlePlotStructureGenerate,
    toggleStorylineHighlight,
    highlightedPath,
    pasteAsPlainText,
    showNodeActions,
    language,
    theme,
    bubbleStyle,
  ]);

  const edgesWithData = useMemo(() => {
    const hiddenNodeIds = new Set(nodes.filter((n) => n.data?.hidden).map((n) => n.id));

    return edges.map((e) => {
      const isHighlighted = highlightedPath?.edges.has(e.id);
      const isHiddenByNode = hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target);

      return {
        ...e,
        hidden: isHiddenByNode,
        type: 'customEdge',
        data: {
          ...e.data,
          edgeStyle,
          onDelete: handleEdgeDelete,
          isHighlighted,
        },
        style: {
          ...e.style,
          stroke: isHighlighted ? '#f43f5e' : e.style?.stroke || '#6366f1',
          strokeWidth: isHighlighted ? 6 : e.style?.strokeWidth || 3,
          opacity: highlightedPath ? (isHighlighted ? 1 : 0.1) : 1,
          // NOTE: 同理，连线也只针对样式属性过渡，防止 transform 延迟
          transition:
            'stroke 0.5s ease-in-out, stroke-width 0.5s ease-in-out, opacity 0.5s ease-in-out',
        },
        animated: isHighlighted || e.animated,
      };
    });
  }, [edges, nodes, edgeStyle, handleEdgeDelete, highlightedPath]);

  return (
    <div
      className={`relative w-full h-screen flex flex-col font-sans overflow-hidden text-slate-800 dark:text-slate-100 transition-colors duration-300 ${bubbleStyle === 'glass' ? 'bubble-glass-mode' : 'bubble-flat-mode'} ${showProjectHome ? 'pointer-events-auto' : ''}`}
      style={{ backgroundColor: canvasBg }}
    >
      <style>{`
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};
      }
    `}</style>
      <EditorHeader
        appTitle={APP_TITLE}
        projectName={currentProjectId ? projectTitle.trim() : ''}
        projectNamePlaceholder={currentProjectId ? PROJECT_TITLE_PLACEHOLDER : ''}
        showLastSavedTime={showLastSavedTime}
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
        setShowPlayTest={setShowPlayTest}
        setShowVideoRender={setShowVideoRender}
        setAssistantOpen={setAssistantOpen}
        openProjectHome={() => setShowProjectHome(true)}
        openImportPicker={openImportPicker}
        handleSaveProject={() => {
          void saveCurrentProject();
        }}
        handleExportProject={() => {
          setShowSaveNameModal(true);
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
            historyPastLength={history.past.length}
            historyFutureLength={history.future.length}
            hasHiddenNodes={nodes.some((node) => node.data?.hidden)}
            fileInputRef={fileInputRef}
            setToolbarCollapsed={setToolbarCollapsed}
            addNewShape={addNewShape}
            addNewTextNode={addNewTextNode}
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
            showTitles={showTitles}
            canvasBg={canvasBg}
            presetColors={presetColors}
            showPresetColors={showPresetColors}
            historyPastLength={history.past.length}
            historyFutureLength={history.future.length}
            missingTextApiKey={missingTextApiKey}
            settingsAttention={settingsAttention}
            setAssistantOpen={setAssistantOpen}
            setRightToolbarCollapsed={setRightToolbarCollapsed}
            setShowSettings={setShowSettings}
            setShowTitles={setShowTitles}
            setCanvasBg={setCanvasBg}
            undo={undo}
            redo={redo}
            t={t}
          />

          <div
            ref={canvasWrapperRef}
            className={`w-full h-full relative ${bubbleStyle === 'glass' ? 'bubble-glass-mode' : 'bubble-flat-mode'}`}
            onMouseDownCapture={handleMouseDown}
            onMouseMoveCapture={handleMouseMove}
            onMouseUpCapture={handleMouseUp}
            onTouchStartCapture={handleTouchStart}
            onTouchMoveCapture={handleTouchMove}
            onTouchEndCapture={handleTouchEnd}
            style={{ touchAction: canvasTouchAction }}
          >
            {/* NOTE: 自定义框选框，仅在右键拖拽时显示 */}
            <div
              ref={selectionBoxRef}
              className="fixed pointer-events-none z-[9999] border-2 border-dashed border-indigo-500 bg-indigo-500/10 rounded-sm"
              style={{ display: 'none' }}
            />
            <ReactFlow
              nodes={nodesWithCallbacks}
              edges={edgesWithData}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onEdgeContextMenu={onEdgeContextMenu}
              onNodeContextMenu={(event, node) => {
                // 默认阻止所有节点的右键菜单，除非是特定解锁逻辑
                event.preventDefault();
                if (
                  node.data?.locked &&
                  (node.type === 'backgroundNode' || node.type === 'groupNode')
                ) {
                  handleUpdateNode(node.id, { locked: false });
                }
              }}
              onPaneContextMenu={(e) => {
                // NOTE: 阻止右键菜单，确保右键拖拽时能正常触发框选
                e.preventDefault();
              }}
              onSelectionEnd={() => {
                setIsRightDragging(false);
              }}
              onMove={handleViewportMove}
              onNodeDragStop={onNodeDragStop}
              // NOTE: 文件拖入由 canvasWrapperRef 上的原生捕获阶段监听器处理，此处无需重复
              nodeTypes={nodeTypesMemo}
              edgeTypes={edgeTypesMemo}
              connectionMode={ConnectionMode.Loose}
              defaultEdgeOptions={defaultEdgeOptions}
              panOnDrag={isRightDragging ? false : interactionMode === 'select' ? [0] : false}
              selectionOnDrag={false}
              selectionMode={SelectionMode.Partial}
              panOnScroll={scrollMode === 'pan'}
              zoomOnScroll={scrollMode === 'zoom'}
              panOnScrollMode={scrollMode === 'pan' ? PanOnScrollMode.Vertical : undefined}
              selectionKeyCode="Shift"
              deleteKeyCode={null}
              proOptions={{ hideAttribution: true }}
              fitView
              minZoom={0.1}
              maxZoom={1.5}
            >
              <Background
                variant={BackgroundVariant.Dots}
                color={theme === 'dark' ? '#334155' : '#cbd5e1'}
                gap={24}
                size={1}
              />
              {showMiniMap && (
                <div
                  className={`canvas-bottom-overlay ${showStats ? '' : 'canvas-bottom-overlay-no-footer'} toolbar-bubble-surface absolute ${miniMapPosition === 'left' ? 'left-4' : 'right-4'} bottom-4 z-[50] bg-[var(--toolbar-bg)] backdrop-blur-md border border-[var(--toolbar-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300`}
                >
                  <MiniMap
                    pannable={true}
                    zoomable={true}
                    className="!static !bg-transparent !border-none !m-0"
                    nodeColor={
                      bubbleStyle === 'glass' ? 'rgba(255, 255, 255, 0.38)' : 'var(--card-bg)'
                    }
                    nodeStrokeColor={
                      bubbleStyle === 'glass' ? 'rgba(255, 255, 255, 0.78)' : 'var(--card-border)'
                    }
                    nodeBorderRadius={6}
                    maskColor={
                      bubbleStyle === 'glass'
                        ? theme === 'dark'
                          ? 'rgba(0, 0, 0, 0.3)'
                          : 'rgba(0, 0, 0, 0.08)'
                        : undefined
                    }
                    style={{ height: 120, width: 160 }}
                  />
                  {showControls && (
                    <div className="border-t border-[var(--toolbar-border)] flex items-center h-8 w-full bg-transparent">
                      <Controls
                        showInteractive={false}
                        showZoom={true}
                        showFitView={true}
                        orientation="horizontal"
                        className="!static !m-0 !flex !flex-row !bg-transparent !border-none !shadow-none !gap-0 !w-full !justify-around !items-center !h-full !p-0"
                      />
                    </div>
                  )}
                </div>
              )}
              {!showMiniMap && showControls && (
                <div
                  className={`canvas-bottom-overlay ${showStats ? '' : 'canvas-bottom-overlay-no-footer'} toolbar-bubble-surface absolute ${miniMapPosition === 'left' ? 'left-4' : 'right-4'} bottom-4 z-[50] h-8 w-40 bg-[var(--toolbar-bg)] backdrop-blur-md border border-[var(--toolbar-border)] rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300`}
                >
                  <Controls
                    showInteractive={false}
                    showZoom={true}
                    showFitView={true}
                    orientation="horizontal"
                    className="!static !m-0 !flex !flex-row !bg-transparent !border-none !shadow-none !gap-0 !w-full !justify-around !items-center !h-full !p-0"
                  />
                </div>
              )}
              <SmartGuides hLines={horizontalGuides} vLines={verticalGuides} />
            </ReactFlow>
          </div>

          {showSelectionMenu && (
            <SelectionMenu
              selectionMenuRef={selectionMenuRef}
              selectionMenuLayout={selectionMenuLayout}
              language={language}
              ttsLoading={ttsLoading}
              onWrapDynamicGroup={wrapWithDynamicGroup}
              onWrapBackground={wrapSelectedWithBackground}
              onBatchExport={connectSelectedToSummaryNode}
              onNarrate={handleGenerateSelectedSpeech}
              onDelete={deleteSelected}
              onCopy={handleCopy}
              onHide={hideSelected}
            />
          )}
        </div>

        <AssistantPanel
          assistantOpen={assistantOpen}
          isMobile={isMobile}
          assistantPanelWidth={assistantPanelWidth}
          assistantLoading={assistantLoading}
          assistantListening={assistantListening}
          assistantDocuments={assistantDocuments}
          assistantDocumentLoading={assistantDocumentLoading}
          assistantInput={assistantInput}
          selectedAssistantTargetNodesCount={selectedAssistantTargetNodes.length}
          assistantTasks={assistantTasks}
          activeAssistantTaskId={activeAssistantTaskId}
          assistantMessages={assistantMessages}
          assistantMessagesRef={assistantMessagesRef}
          setAssistantOpen={setAssistantOpen}
          setAssistantInput={setAssistantInput}
          setActiveAssistantTaskId={setActiveAssistantTaskId}
          handleNewAssistantTask={handleNewAssistantTask}
          handleRenameAssistantTask={handleRenameAssistantTask}
          handleCloseAssistantTask={handleRequestCloseAssistantTask}
          handleAssistantSend={handleAssistantSend}
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
          showStats={showStats}
          language={language}
        />
        {!isMobile && showStats && (
          <footer className="editor-footer h-8 bg-white dark:bg-black text-slate-500 dark:text-white border-t border-slate-100 dark:border-white/5 flex items-center justify-between px-4 text-[10px] font-bold tracking-wide z-20 shrink-0 transition-colors">
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[var(--accent)]" /> {t.nodes}:{' '}
                {nodes.length}
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[var(--accent)]" /> {t.paths}:{' '}
                {edges.length}
              </span>
            </div>
            <div className="opacity-60 font-medium">{footerHint}</div>
          </footer>
        )}
      </div>

      {/* 思考内容右上角浮层：DeepSeek思考模式下短暂显示 */}
      {false && thinkingContent && (
        <div
          className="fixed top-20 right-20 z-[500] max-w-sm w-80 bg-slate-900/95 border border-indigo-500/40 rounded-xl shadow-2xl p-4 backdrop-blur-md animate-in slide-in-from-right-4 duration-300"
          style={{ maxHeight: '50vh', overflowY: 'auto' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              {language === 'zh' ? 'AI 思考中...' : 'AI Thinking...'}
            </span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
            {thinkingContent}
          </p>
        </div>
      )}

      {/* AI 操作选择弹窗 */}
      <AIActionModal
        visible={showAIActionModal}
        pendingAINodeId={pendingAINodeId}
        aiButtonsConfig={aiButtonsConfig}
        language={language}
        onClose={() => {
          setShowAIActionModal(false);
          setPendingAINodeId(null);
        }}
        onGenerate={(nodeId, action) => {
          void handleAIGenerate(nodeId, action);
        }}
        t={t}
      />

      {/* 剧本测试模态弹窗*/}
      <Suspense fallback={null}>
        {showPlayTest && (
          <PlayTestModal
            nodes={nodes}
            edges={edges}
            onClose={() => setShowPlayTest(false)}
            language={language}
            onLanguageChange={setLanguage}
            isDarkMode={playTestDarkMode}
            setIsDarkMode={setPlayTestDarkMode}
            choicesColumns={playTestChoicesColumns}
            setChoicesColumns={setPlayTestChoicesColumns}
            videoAutoPlay={playTestVideoAutoPlay}
            setVideoAutoPlay={setPlayTestVideoAutoPlay}
            layoutMode={playTestLayoutMode}
            setLayoutMode={setPlayTestLayoutMode}
            interactionMode={playTestInteractionMode}
            setInteractionMode={setPlayTestInteractionMode}
            typewriterSpeed={playTestTypewriterSpeed}
            setTypewriterSpeed={setPlayTestTypewriterSpeed}
            choiceDelay={playTestChoiceDelay}
            setChoiceDelay={setPlayTestChoiceDelay}
            choicesPosition={playTestChoicesPosition}
            setChoicesPosition={setPlayTestChoicesPosition}
            blurBackground={playTestBlurBackground}
            setBlurBackground={setPlayTestBlurBackground}
            blurText={playTestBlurText}
            setBlurText={setPlayTestBlurText}
            skipSingleChoicePopup={playTestSkipSingleChoicePopup}
            setSkipSingleChoicePopup={setPlayTestSkipSingleChoicePopup}
            dimBackground={playTestDimBackground}
            setDimBackground={setPlayTestDimBackground}
            autoAdvance={playTestAutoAdvance}
            setAutoAdvance={setPlayTestAutoAdvance}
            autoAdvanceDelay={playTestAutoAdvanceDelay}
            setAutoAdvanceDelay={setPlayTestAutoAdvanceDelay}
          />
        )}
      </Suspense>

      {/* 设置界面弹窗 */}
      <Suspense fallback={null}>
        {canRenderVideo && showVideoRender && (
          <VideoRenderModal
            nodes={nodes}
            edges={edges}
            onClose={() => setShowVideoRender(false)}
            language={language}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        <SettingsModal
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          missingTextApiKey={missingTextApiKey}
          language={language}
          setLanguage={setLanguage}
          theme={theme}
          setTheme={setTheme}
          closeButtonBehavior={closeButtonBehavior}
          setCloseButtonBehavior={setCloseButtonBehavior}
          bubbleStyle={bubbleStyle}
          setBubbleStyle={setBubbleStyle}
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
          selectionMenuLayout={selectionMenuLayout}
          setSelectionMenuLayout={setSelectionMenuLayout}
          edgeStyle={edgeStyle}
          setEdgeStyle={setEdgeStyle}
          pasteAsPlainText={pasteAsPlainText}
          setPasteAsPlainText={setPasteAsPlainText}
          showNodeActions={showNodeActions}
          setShowNodeActions={setShowNodeActions}
          showStats={showStats}
          setShowStats={setShowStats}
          showLastSavedTime={showLastSavedTime}
          setShowLastSavedTime={setShowLastSavedTime}
          saveAssistantConversations={saveAssistantConversations}
          setSaveAssistantConversations={setSaveAssistantConversations}
          showMiniMap={showMiniMap}
          setShowMiniMap={setShowMiniMap}
          miniMapPosition={miniMapPosition}
          setMiniMapPosition={setMiniMapPosition}
          showControls={showControls}
          setShowControls={setShowControls}
          savedAIProfiles={savedAIProfiles}
          activeTextProfileId={activeTextProfileId}
          activeImageProfileId={activeImageProfileId}
          activeVoiceProfileId={activeVoiceProfileId}
          projectSummaries={projectSummaries}
          currentProjectId={currentProjectId}
          onCreateAIProfile={handleCreateAIProfile}
          onUpdateAIProfile={handleUpdateAIProfile}
          onSelectAIProfile={handleSelectAIProfile}
          onDeleteAIProfile={handleDeleteAIProfile}
          generateLength={generateLength}
          setGenerateLength={setGenerateLength}
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
          playTestDimBackground={playTestDimBackground}
          setPlayTestDimBackground={setPlayTestDimBackground}
          playTestAutoAdvance={playTestAutoAdvance}
          setPlayTestAutoAdvance={setPlayTestAutoAdvance}
          playTestAutoAdvanceDelay={playTestAutoAdvanceDelay}
          setPlayTestAutoAdvanceDelay={setPlayTestAutoAdvanceDelay}
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
        onChangeFileName={setSaveFileName}
        onChangeIncludeApiProfiles={setIncludeApiProfilesInExport}
        onClose={() => setShowSaveNameModal(false)}
        onConfirm={() => confirmExportJSON({ includeApiProfiles: includeApiProfilesInExport })}
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

      <ProjectPickerModal
        visible={showProjectHome}
        language={language}
        projects={projectSummaries}
        loading={projectListLoading}
        showCloseButton={Boolean(currentProjectId)}
        defaultProjectSaveDir={defaultProjectSaveDir}
        onClose={() => setShowProjectHome(false)}
        onCreateProject={() => {
          requestProjectAction({ type: 'create' });
        }}
        onOpenProject={(projectId) => {
          void handleOpenProject(projectId);
        }}
        onImportProject={handleImportProjectFromHome}
        onChooseDefaultSaveLocation={handleChooseDefaultProjectSaveLocation}
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
        title={language === 'zh' ? '删除项目？' : 'Delete project?'}
        description={
          projectIdsPendingDeletion.length > 1
            ? language === 'zh'
              ? `确定要删除这 ${projectIdsPendingDeletion.length} 个项目吗？此操作不可撤销。`
              : `Delete these ${projectIdsPendingDeletion.length} projects? This cannot be undone.`
            : language === 'zh'
              ? `确定要删除项目「${
                  projectSummaries.find((item) => item.id === projectIdsPendingDeletion[0])
                    ?.projectName || '未命名项目'
                }」吗？此操作不可撤销。`
              : `Delete "${
                  projectSummaries.find((item) => item.id === projectIdsPendingDeletion[0])
                    ?.projectName || 'Untitled project'
                }"? This cannot be undone.`
        }
        confirmLabel={language === 'zh' ? '删除项目' : 'Delete project'}
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
        title={language === 'zh' ? '关闭对话？' : 'Close conversation?'}
        description={
          language === 'zh'
            ? `确定要关闭「${
                assistantTasks.find((task) => task.id === assistantTaskPendingCloseId)?.title ||
                '这个对话'
              }」吗？`
            : `Close "${
                assistantTasks.find((task) => task.id === assistantTaskPendingCloseId)?.title ||
                'this conversation'
              }"?`
        }
        confirmLabel={language === 'zh' ? '关闭对话' : 'Close conversation'}
        tone="warning"
        onCancel={handleCancelCloseAssistantTask}
        onConfirm={handleConfirmCloseAssistantTask}
      />

      {/* Zen Mode Overlay */}
      <Suspense fallback={null}>
        {zenModeNodeId &&
          (() => {
            const node = nodes.find((n) => n.id === zenModeNodeId);
            const characterTags = node
              ? nodes
                  .filter(
                    (n) =>
                      n.type === 'characterNode' &&
                      typeof n.data.characterName === 'string' &&
                      n.data.characterName.trim().length > 0,
                  )
                  .filter((n) => {
                    const isGlobal = n.data?.isGlobal !== false;
                    const isConnected = edges.some(
                      (e) =>
                        (e.source === n.id && e.target === node.id) ||
                        (e.target === n.id && e.source === node.id),
                    );
                    return isGlobal || isConnected;
                  })
                  .map((n) => ({ id: n.id, name: String(n.data.characterName).trim() }))
              : [];
            const sceneTags = node
              ? nodes
                  .filter(
                    (n) =>
                      n.type === 'sceneNode' &&
                      typeof n.data.sceneName === 'string' &&
                      n.data.sceneName.trim().length > 0,
                  )
                  .filter((n) => {
                    const isGlobal = n.data?.isGlobal !== false;
                    const isConnected = edges.some(
                      (e) =>
                        (e.source === n.id && e.target === node.id) ||
                        (e.target === n.id && e.source === node.id),
                    );
                    return isGlobal || isConnected;
                  })
                  .map((n) => ({ id: n.id, name: String(n.data.sceneName).trim() }))
              : [];
            return (
              <ZenEditor
                value={typeof node?.data.text === 'string' ? node.data.text : ''}
                imageUrl={typeof node?.data.imageUrl === 'string' ? node.data.imageUrl : ''}
                videoUrl={typeof node?.data.videoUrl === 'string' ? node.data.videoUrl : ''}
                characterTags={characterTags}
                sceneTags={sceneTags}
                isAILoading={aiLoadingNodeId === zenModeNodeId}
                onAIGenerate={() => handleAIButtonClick(zenModeNodeId)}
                onGenerateImage={() => handleGenerateStoryNodeImage(zenModeNodeId)}
                onChange={(val) => handleUpdateNode(zenModeNodeId, { text: val })}
                onClose={() => setZenModeNodeId(null)}
              />
            );
          })()}
      </Suspense>

      {/* Global Toast Notification */}
      <EditorToast message={toast.message} visible={toast.visible} tone={toast.tone} />
    </div>
  );
}
