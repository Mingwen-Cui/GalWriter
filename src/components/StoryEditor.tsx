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
import { useAutoSave } from '../editor-services/useAutoSave';
import { AIActionModal } from '../editor-shell/AIActionModal';
import { AssistantPanel } from '../editor-shell/AssistantPanel';
import { AutoSaveRecoveryModal } from '../editor-shell/AutoSaveRecoveryModal';
import { EditorHeader } from '../editor-shell/EditorHeader';
import { EditorLeftToolbar } from '../editor-shell/EditorLeftToolbar';
import { EditorRightToolbar } from '../editor-shell/EditorRightToolbar';
import { EditorToast } from '../editor-shell/EditorToast';
import { SaveProjectModal } from '../editor-shell/SaveProjectModal';
import {
  type AIButtonsConfig,
  type AIPromptsConfig,
  defaultAIButtonsConfig,
  defaultAIPrompts,
} from '../editor-state/editorConfig';
import { usePlaytestSettings } from '../editor-state/usePlaytestSettings';
import { Language, translations } from '../lib/i18n';
import {
  expandBackgroundToFitNodes,
  formatRegionStoryForPrompt,
  parseGeneratedPlotCards,
} from '../lib/plotStructure';
import { MemoizedAINode } from './AINode';
import { MemoizedBackgroundNode } from './BackgroundNode';
import { MemoizedBatchReplaceNode } from './BatchReplaceNode';
import { MemoizedCharacterNode } from './CharacterNode';
import { CustomEdge } from './CustomEdge';
import { MemoizedGroupNode } from './GroupNode';
import { MemoizedNumberConditionNode } from './NumberConditionNode';
import type { PlotStructureGenerateParams } from './PlotStructureNode';
import { MemoizedPlotStructureNode } from './PlotStructureNode';
import { MemoizedSceneNode } from './SceneNode';
import { MemoizedStoryNode } from './StoryNode';
import { MemoizedSummaryNode } from './SummaryNode';
import { MemoizedTextNode } from './TextNode';

const DEFAULT_TTS_API_URL = 'https://openapi.youdao.com/ttsapi';
const DEFAULT_TTS_MODEL = '';
const DEFAULT_TTS_VOICE = 'youxiaoqin';
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
  const [edgeStyle, setEdgeStyle] = useState<'step' | 'bezier'>('bezier');
  const [showSettings, setShowSettings] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [imageApiKey, setImageApiKey] = useState('');
  const [imageApiUrl, setImageApiUrl] = useState(DEFAULT_IMAGE_API_URL);
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL);
  const [imageSize, setImageSize] = useState(DEFAULT_IMAGE_SIZE);
  const [ttsApiKey, setTtsApiKey] = useState('');
  const [ttsApiUrl, setTtsApiUrl] = useState(DEFAULT_TTS_API_URL);
  const [ttsModel, setTtsModel] = useState(DEFAULT_TTS_MODEL);
  const [ttsVoice, setTtsVoice] = useState(DEFAULT_TTS_VOICE);
  const [ttsProvider, setTtsProvider] = useState<'system' | 'youdao'>('system');
  const [ttsLoading, setTtsLoading] = useState(false);
  // NOTE: 'gemini' 使用 Google GenAI和deepseek' 使用 DeepSeek OpenAI 兼容接口
  const [aiProvider, setAiProvider] = useState<'gemini' | 'deepseek' | 'openai'>('deepseek');
  // NOTE: 思考模式仅在DeepSeek 时有效，使用 deepseek-reasoner 模型
  const [thinkingMode, setThinkingMode] = useState(false);
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
  const [presetColors, setPresetColors] = useState<string[]>(['#F9FAFB', '#0f1f39', '#fef3c7']);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [saveFileName, setSaveFileName] = useState('story-project');
  const [language, setLanguage] = useState<Language>('zh');
  const [projectTitle, setProjectTitle] = useState('交互式剧本编辑器');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
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
  } = usePlaytestSettings();

  const t = translations[language];
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedSnapshot = useRef<string>('');

  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [rightToolbarCollapsed, setRightToolbarCollapsed] = useState(false);

  const isMobile = flowWidth < 768;

  const [qqCopied, setQqCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow();
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  // NOTE: canvas 容器的 ref，用于挂载原生 drag-drop 监听器，绕过 React Flow 的内部事件拦截
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  // NOTE: 用 useCallback 包裹以保持稳定引用，避免依赖此函数的 useCallback 在每次渲染时重建
  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
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

        if (showTitles && !titleAlreadyAdded) {
          return {
            ...node,
            style: { ...node.style, height: currentHeight + TITLE_HEIGHT },
            data: { ...node.data, titleHeightAdded: true },
          };
        } else if (!showTitles && titleAlreadyAdded) {
          return {
            ...node,
            style: { ...node.style, height: Math.max(50, currentHeight - TITLE_HEIGHT) },
            data: { ...node.data, titleHeightAdded: false },
          };
        }
        return node;
      }),
    );
  }, [showTitles, setNodes]);

  const [history, setHistory] = useState<{
    past: { nodes: Node[]; edges: Edge[] }[];
    future: { nodes: Node[]; edges: Edge[] }[];
  }>({ past: [], future: [] });
  const lastHistoryState = useRef({ nodes: INITIAL_NODES, edges: [] as Edge[] });
  const isUndoRedoAction = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autosaveReady, setAutosaveReady] = useState(false);

  const editorProjectSettings = useMemo(
    () => ({
      canvasBg,
      edgeStyle,
      customApiKey,
      pasteAsPlainText,
      showNodeActions,
      showStats,
      presetColors,
      showTitles,
      generateLength,
      aiProvider,
      deepseekApiKey,
      openaiApiKey,
      imageApiKey,
      imageApiUrl,
      imageModel,
      imageSize,
      ttsApiKey,
      ttsApiUrl,
      ttsModel,
      ttsVoice,
      ttsProvider,
      thinkingMode,
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
    }),
    [
      aiButtonsConfig,
      aiPrompts,
      aiProvider,
      bubbleStyle,
      canvasBg,
      customApiKey,
      deepseekApiKey,
      edgeStyle,
      generateLength,
      imageApiKey,
      imageApiUrl,
      imageModel,
      imageSize,
      language,
      miniMapPosition,
      openaiApiKey,
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
      playTestTypewriterSpeed,
      playTestVideoAutoPlay,
      presetColors,
      projectTitle,
      scrollMode,
      selectionMenuLayout,
      showControls,
      showMiniMap,
      showNodeActions,
      showStats,
      showTitles,
      thinkingMode,
      theme,
      toolbarLayout,
      ttsApiKey,
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
      setCustomApiKey,
      setPasteAsPlainText,
      setShowNodeActions,
      setShowStats,
      setPresetColors,
      setShowTitles,
      setGenerateLength,
      setAiProvider,
      setDeepseekApiKey,
      setOpenaiApiKey,
      setImageApiKey,
      setImageApiUrl,
      setImageModel,
      setImageSize,
      setTtsApiKey,
      setTtsApiUrl,
      setTtsModel,
      setTtsVoice,
      setTtsProvider,
      setThinkingMode,
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
    }),
    [],
  );

  const { getProjectSnapshot, applyProjectData, confirmExportJSON, handleImportZIP } =
    useProjectSerialization({
      nodes,
      edges,
      settings: editorProjectSettings,
      settingsSetters: editorProjectSettingsSetters,
      saveFileName,
      setNodes,
      setEdges,
      setIsDirty,
      setShowSaveNameModal,
      lastSavedSnapshotRef: lastSavedSnapshot,
      showToast,
      defaultEdgeOptions,
      defaultAIPrompts,
      defaultAIButtonsConfig,
      clearAutoSave: async () => {
        const { clearAutoSave } = await import('../lib/db');
        await clearAutoSave();
      },
    });

  const { autoSaveData, showAutoSaveModal, discardAutoSave, recoverAutoSave } =
    useAutoSave<ProjectSnapshotData>({
      getProjectSnapshot,
      lastSavedSnapshotRef: lastSavedSnapshot,
      setIsDirty,
      applyRecoveredProject: async (projectData) => {
        await applyProjectData(projectData, { markSaved: true });
      },
      showToast,
      language,
      enabled: autosaveReady,
    });

  // Initialize snapshot and theme preference
  React.useEffect(() => {
    lastSavedSnapshot.current = getProjectSnapshot();
    setAutosaveReady(true);

    // Load theme from localStorage or system preference
    const savedTheme = localStorage.getItem('app-theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, [getProjectSnapshot]);

  // Update document theme attribute
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('app-theme', theme);
  }, [theme]);

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
    showTitles,
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
    handleAIGenerate: runAIGenerate,
    handleAIAnalyze: runAIAnalyze,
  } = useAIActions({
    nodes,
    edges,
    aiPrompts,
    aiProvider,
    deepseekApiKey,
    openaiApiKey,
    customApiKey,
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
    showTitles,
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
          data: { title: '分支', shape: 'square', color: '#ffffff', text: '' },
        };

        // 检查 sourceId 是否属于任何动态分组，若是则将新节点也加入分组
        const updatedNodes = nds.map((node) => {
          if (node.type === 'groupNode') {
            const childIds = (node.data.childIds as string[]) || [];
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
    showTitles,
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
            },
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
            },
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
          },
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
    assistantInput,
    setAssistantInput,
    assistantLoading,
    assistantListening,
    assistantTasks,
    activeAssistantTaskId,
    setActiveAssistantTaskId,
    assistantMessages,
    assistantMessagesRef,
    handleNewAssistantTask,
    handleCloseAssistantTask,
    handleAssistantSend,
    handleAssistantVoiceInput,
    toggleAssistantThought,
    handleAssistantResizePointerDown,
    handleAssistantResizePointerMove,
    handleAssistantResizePointerUp,
  } = useAssistantPanel({
    language,
    isMobile,
    flowWidth,
    selectedAssistantTargetNodes,
    nodes,
    callAIForTextResult,
    createAssistantCards,
  });

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
    (prompt: string) => {
      return callAIForText(prompt);
    },
    [callAIForText],
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
              },
            };

            currentX += 420;
            return node;
          });

          let updatedNodes = [...nds, ...newNodes];

          if (region?.type === 'dynamicGroup') {
            updatedNodes = updatedNodes.map((node) => {
              if (node.id !== region.id || node.type !== 'groupNode') return node;
              const childIds = (node.data.childIds as string[]) || [];
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

  const projectTitleInputUnits = useMemo(() => {
    const fallbackTitle = language === 'zh' ? '项目标题' : 'Project title';
    const title = projectTitle.trim() || fallbackTitle;
    return (Array.from(title) as string[]).reduce(
      (units: number, char: string) => units + (char.charCodeAt(0) > 255 ? 2 : 1),
      0,
    );
  }, [language, projectTitle]);

  const projectTitleInputWidth = `clamp(${isMobile ? '8rem' : '9rem'}, ${Math.min(Math.max(projectTitleInputUnits + 2, 10), 28)}ch, ${isMobile ? '13rem' : '18rem'})`;

  return (
    <div
      className={`relative w-full h-screen flex flex-col font-sans overflow-hidden text-slate-800 dark:text-slate-100 transition-colors duration-300 ${bubbleStyle === 'glass' ? 'bubble-glass-mode' : 'bubble-flat-mode'}`}
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
        projectTitle={projectTitle}
        projectTitleInputWidth={projectTitleInputWidth}
        language={language}
        authorLabel={t.author}
        isMobile={isMobile}
        isDirty={isDirty}
        canRenderVideo={canRenderVideo}
        assistantOpen={assistantOpen}
        jsonInputRef={jsonInputRef}
        setProjectTitle={setProjectTitle}
        setShowPlayTest={setShowPlayTest}
        setShowVideoRender={setShowVideoRender}
        setAssistantOpen={setAssistantOpen}
        handleExportJSON={handleExportJSON}
        handleImportZIP={handleImportZIP}
        t={t}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
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
            rightToolbarCollapsed={rightToolbarCollapsed}
            toolbarLayout={toolbarLayout}
            showTitles={showTitles}
            canvasBg={canvasBg}
            presetColors={presetColors}
            historyPastLength={history.past.length}
            historyFutureLength={history.future.length}
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
                  className={`toolbar-bubble-surface absolute ${miniMapPosition === 'left' ? 'left-4' : 'right-4'} bottom-4 z-[50] bg-[var(--toolbar-bg)] backdrop-blur-md border border-[var(--toolbar-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300`}
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
                  className={`toolbar-bubble-surface absolute ${miniMapPosition === 'left' ? 'left-4' : 'right-4'} bottom-4 z-[50] bg-[var(--toolbar-bg)] backdrop-blur-md border border-[var(--toolbar-border)] rounded-lg shadow-xl overflow-hidden p-0.5 animate-in slide-in-from-bottom-4 duration-300`}
                >
                  <Controls
                    showInteractive={false}
                    showZoom={true}
                    showFitView={true}
                    orientation="horizontal"
                    className="!static !m-0 !flex !flex-row !bg-transparent !border-none !shadow-none !gap-0"
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
          handleCloseAssistantTask={handleCloseAssistantTask}
          handleAssistantSend={handleAssistantSend}
          handleAssistantVoiceInput={handleAssistantVoiceInput}
          toggleAssistantThought={toggleAssistantThought}
          handleAssistantResizePointerDown={handleAssistantResizePointerDown}
          handleAssistantResizePointerMove={handleAssistantResizePointerMove}
          handleAssistantResizePointerUp={handleAssistantResizePointerUp}
          undo={undo}
          redo={redo}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          language={language}
        />
      </div>

      {!isMobile && showStats && (
        <footer className="h-8 bg-white dark:bg-black text-slate-500 dark:text-white border-t border-slate-100 dark:border-white/5 flex items-center justify-between px-4 text-[10px] font-bold tracking-wide z-20 shrink-0 transition-colors">
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-[var(--accent)]" /> {t.nodes}: {nodes.length}
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-[var(--accent)]" /> {t.paths}: {edges.length}
            </span>
          </div>
          <div className="opacity-60 font-medium">{footerHint}</div>
        </footer>
      )}

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
            onUndo={undo}
            onRedo={redo}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        <SettingsModal
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          language={language}
          setLanguage={setLanguage}
          theme={theme}
          setTheme={setTheme}
          bubbleStyle={bubbleStyle}
          setBubbleStyle={setBubbleStyle}
          canvasBg={canvasBg}
          setCanvasBg={setCanvasBg}
          presetColors={presetColors}
          setPresetColors={setPresetColors}
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
          showMiniMap={showMiniMap}
          setShowMiniMap={setShowMiniMap}
          miniMapPosition={miniMapPosition}
          setMiniMapPosition={setMiniMapPosition}
          showControls={showControls}
          setShowControls={setShowControls}
          aiProvider={aiProvider}
          setAiProvider={setAiProvider}
          customApiKey={customApiKey}
          setCustomApiKey={setCustomApiKey}
          deepseekApiKey={deepseekApiKey}
          setDeepseekApiKey={setDeepseekApiKey}
          openaiApiKey={openaiApiKey}
          setOpenaiApiKey={setOpenaiApiKey}
          imageApiKey={imageApiKey}
          setImageApiKey={setImageApiKey}
          imageApiUrl={imageApiUrl}
          setImageApiUrl={setImageApiUrl}
          imageModel={imageModel}
          setImageModel={setImageModel}
          imageSize={imageSize}
          setImageSize={setImageSize}
          ttsApiKey={ttsApiKey}
          setTtsApiKey={setTtsApiKey}
          ttsProvider={ttsProvider}
          setTtsProvider={setTtsProvider}
          ttsApiUrl={ttsApiUrl}
          setTtsApiUrl={setTtsApiUrl}
          ttsModel={ttsModel}
          setTtsModel={setTtsModel}
          ttsVoice={ttsVoice}
          setTtsVoice={setTtsVoice}
          generateLength={generateLength}
          setGenerateLength={setGenerateLength}
          thinkingMode={thinkingMode}
          setThinkingMode={setThinkingMode}
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
        />
      </Suspense>

      {/* 崩溃恢复弹窗 */}
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

      {/* 保存文件名弹窗 */}
      <SaveProjectModal
        visible={showSaveNameModal}
        saveFileName={saveFileName}
        onChangeFileName={setSaveFileName}
        onClose={() => setShowSaveNameModal(false)}
        onConfirm={confirmExportJSON}
        t={t}
      />

      {/* Zen Mode Overlay */}
      <Suspense fallback={null}>
        {zenModeNodeId &&
          (() => {
            const node = nodes.find((n) => n.id === zenModeNodeId);
            const characterTags = node
              ? nodes
                  .filter(
                    (n) => n.type === 'characterNode' && (n.data?.characterName as string)?.trim(),
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
                  .map((n) => ({ id: n.id, name: (n.data.characterName as string).trim() }))
              : [];
            const sceneTags = node
              ? nodes
                  .filter((n) => n.type === 'sceneNode' && (n.data?.sceneName as string)?.trim())
                  .filter((n) => {
                    const isGlobal = n.data?.isGlobal !== false;
                    const isConnected = edges.some(
                      (e) =>
                        (e.source === n.id && e.target === node.id) ||
                        (e.target === n.id && e.source === node.id),
                    );
                    return isGlobal || isConnected;
                  })
                  .map((n) => ({ id: n.id, name: (n.data.sceneName as string).trim() }))
              : [];
            return (
              <ZenEditor
                value={node?.data.text as string}
                imageUrl={node?.data.imageUrl as string}
                videoUrl={node?.data.videoUrl as string}
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
      <EditorToast message={toast.message} visible={toast.visible} />
    </div>
  );
}
