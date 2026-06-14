import {
  Handle,
  NodeProps,
  NodeResizer,
  NodeToolbar,
  Position,
  useReactFlow,
  useStore,
  useStoreApi,
  useUpdateNodeInternals,
  useViewport,
} from '@xyflow/react';
import {
  Bold,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  EyeOff,
  GitFork,
  Image as ImageIcon,
  Italic,
  Layers,
  List,
  Loader2,
  MapPin,
  Maximize,
  Mic,
  Palette,
  Play,
  Plus,
  Save,
  Sparkles,
  Square,
  StepForward,
  Trash2,
  Type,
  Underline,
  User,
  Volume2,
} from 'lucide-react';
import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
  CharacterNodeData,
  CharacterPresentation,
  PresentationAnimation,
  PresentationMotion,
  SceneFlowNode,
  ScenePresentation,
  StoryAudioClip,
  StoryCardVisualShape,
  StoryFlowNode,
  StoryNodeData,
} from '../domain/project';
import { Language, translations } from '../lib/i18n';
import {
  clampCharacterLayer,
  copyCharacterPresentationSettings,
  copyScenePresentationSettings,
  createCharacterPresentation,
  createScenePresentation,
  getCharacterStagePosition,
  getPresentationTransform,
  hasCharacterPresentationClipboard,
  hasScenePresentationClipboard,
  normalizeStoryPresentation,
  pasteCharacterPresentationSettings,
  pasteScenePresentationSettings,
} from '../lib/presentation';
import { NumberInput } from './NumberInput';
import { DurationInput } from './DurationInput';
import { DraggableNumberInput } from './DraggableNumberInput';
import { RichText, RichTextHandle } from './RichText';
import { VirtualPresentationStage } from './VirtualPresentationStage';

const COLORS = ['#ffffff', '#FE8A25', '#E64881', '#FD5C5C', '#1EC8CF'];
const SHAPES: StoryCardVisualShape[] = [
  'square',
  'rounded-rectangle',
  'diamond',
  'trapezoid',
  'hexagon',
];
const CARD_RADIUS = '12px';
const TITLE_HEIGHT = 36;

const getNumericSize = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^-?\d+(\.\d+)?px$/.test(trimmed) || /^-?\d+(\.\d+)?$/.test(trimmed)) {
      const parsed = Number.parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
  }

  return undefined;
};

const isLightColor = (color: string) => {
  const hex = color.replace('#', '');
  if (hex.length !== 3 && hex.length !== 6 && hex.length !== 8) return false;
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150; // 稍微放宽阈值以适应更多充满活力的颜色
};

const getReadableTextColor = (backgroundColor: string) =>
  isLightColor(backgroundColor) ? '#1e293b' : '#f8fafc';

// --- Helper Components & Styles for NodeToolbar ---
const ToolbarRow = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`flex items-center gap-1.5 px-1 ${className}`}>{children}</div>;

const ToolGroup = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`flex items-center gap-1 ${className}`}>{children}</div>;

const Separator = () => <div className="w-px h-4 bg-[var(--toolbar-border)]/50 mx-0.5 shrink-0" />;

const btnBase =
  'h-7 flex items-center justify-center rounded-md transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)] disabled:opacity-50';
const iconBtnBase = `${btnBase} w-7 p-1.5`;
const textBtnBase = `${btnBase} px-2 text-xs font-medium`;
const ANIMATION_OPTIONS: { value: PresentationAnimation; label: string }[] = [
  { value: 'none', label: '· 无动画' },
  { value: 'fade', label: '◇ 淡入淡出' },
  { value: 'slide-left', label: '← 向左滑动' },
  { value: 'slide-right', label: '→ 向右滑动' },
  { value: 'slide-up', label: '↑ 向上滑动' },
  { value: 'slide-down', label: '↓ 向下滑动' },
  { value: 'zoom', label: '↕ 缩放' },
];

export function StoryNode({ id, data, selected }: NodeProps<StoryFlowNode>) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const richTextRef = useRef<RichTextHandle>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'encoding'>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const text = data.text || '';
  const title = data.title ?? '';
  const shape: StoryCardVisualShape = data.shape || 'square';
  const color = data.color || COLORS[0];
  const imageUrl = data.imageUrl;
  const videoUrl = data.videoUrl;
  const audioUrl = data.audioUrl;
  const storyPresentation = normalizeStoryPresentation(data.presentation);
  const hasScenePresentationImage = Boolean(storyPresentation.scene && imageUrl);
  const hasScenePresentationVideo = Boolean(storyPresentation.scene && videoUrl && !imageUrl);
  const hasVisualMedia = !!((imageUrl && !hasScenePresentationImage) || videoUrl);
  const plainSpeechText = String(text)
    .replace(/<[^>]*>/g, '')
    .trim();
  const objectFit = !data.objectFit || data.objectFit === 'contain' ? 'playtest' : data.objectFit;
  const mediaScale = typeof data.mediaScale === 'number' ? data.mediaScale : 1;
  const mediaOffsetX = typeof data.mediaOffsetX === 'number' ? data.mediaOffsetX : 0;
  const mediaOffsetY = typeof data.mediaOffsetY === 'number' ? data.mediaOffsetY : 0;
  const activeMediaScale = storyPresentation.scene?.scale ?? mediaScale;
  const mediaStyle: React.CSSProperties = {
    objectFit: objectFit === 'fill' ? 'fill' : objectFit === 'cover' ? 'cover' : 'contain',
    objectPosition: '50% 50%',
  };
  const lang = (data.language as Language) || 'zh';
  const t = translations[lang];
  const showTitles = data.showTitles !== false;
  const storyTitlePlacement =
    ((data.storyTitlePlacement as string) === 'outside'
      ? 'outside-right'
      : data.storyTitlePlacement) ?? 'inside';
  const showTitleInside = showTitles && storyTitlePlacement === 'inside';
  const showTitleOutside = showTitles && storyTitlePlacement !== 'inside';
  const isRoot = data.isRoot === true;
  const { zoom } = useViewport();
  const presentationMenuScale = Math.min(zoom, 1.25);
  const storeApi = useStoreApi();
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [presentationMenu, setPresentationMenu] = useState<{
    kind: 'character' | 'scene';
    sourceNodeId: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const presentationMenuRef = useRef<HTMLDivElement>(null);
  const [presentationMenuPosition, setPresentationMenuPosition] = useState({ left: 12, top: 12 });
  const previewFrameRef = useRef<number | null>(null);
  const [presentationPreview, setPresentationPreview] = useState<{
    kind: 'character' | 'scene';
    sourceNodeId: string;
    phase: 'enter' | 'exit';
    active: boolean;
    nonce: number;
  } | null>(null);
  const [presentationResetUndo, setPresentationResetUndo] = useState<{
    kind: 'character' | 'scene';
    sourceNodeId: string;
    value: CharacterPresentation | ScenePresentation;
  } | null>(null);
  const [, setPresentationClipboardVersion] = useState(0);

  // NOTE: 演出设置模板接口定义
  interface CharacterTemplate {
    id: string;
    name: string;
    settings: {
      position: 'left' | 'center' | 'right' | 'custom';
      offsetX: number;
      offsetY: number;
      scale: number;
      flipX: boolean;
      layer: number;
      enter: PresentationMotion;
      exit: PresentationMotion;
    };
  }

  interface SceneTemplate {
    id: string;
    name: string;
    settings: {
      cropMode: 'cover' | 'contain' | 'stretch';
      scale: number;
      offsetX: number;
      offsetY: number;
      enter: PresentationMotion;
      exit: PresentationMotion;
    };
  }

  const [characterTemplates, setCharacterTemplates] = useState<CharacterTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('galwriter-char-templates');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [sceneTemplates, setSceneTemplates] = useState<SceneTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('galwriter-scene-templates');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse scene templates:', error);
      return [];
    }
  });

  const [showCharacterTemplateList, setShowCharacterTemplateList] = useState(false);
  const [showSceneTemplateList, setShowSceneTemplateList] = useState(false);

  useLayoutEffect(() => {
    if (!presentationMenu) return;

    const updatePosition = () => {
      const menu = presentationMenuRef.current;
      if (!menu) return;
      const margin = 12;
      const { width, height } = menu.getBoundingClientRect();
      setPresentationMenuPosition({
        left: Math.max(margin, Math.min(presentationMenu.x, window.innerWidth - width - margin)),
        top: Math.max(margin, Math.min(presentationMenu.y, window.innerHeight - height - margin)),
      });
    };

    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
    };
  }, [presentationMenu, showCharacterTemplateList, showSceneTemplateList, presentationMenuScale]);

  // NOTE: 新建角色模板处理
  const handleCreateCharacterTemplate = (config: CharacterPresentation) => {
    const {
      sourceNodeId: _sourceNodeId,
      linkedByEdge: _linkedByEdge,
      outfitId: _outfitId,
      ...settings
    } = config;
    let currentTemplates: CharacterTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-char-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse character templates:', error);
    }
    const newTemplate: CharacterTemplate = {
      id: Date.now().toString(),
      name: `${presentationMenu?.name || '角色'}-模板-${currentTemplates.length + 1}`,
      settings,
    };
    const nextTemplates = [...currentTemplates, newTemplate];
    setCharacterTemplates(nextTemplates);
    localStorage.setItem('galwriter-char-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
    setShowCharacterTemplateList(true);
  };

  // NOTE: 新建场景模板处理
  const handleCreateSceneTemplate = (config: ScenePresentation) => {
    const {
      sourceNodeId: _sourceNodeId,
      linkedByEdge: _linkedByEdge,
      imageId: _imageId,
      previousImageUrl: _previousImageUrl,
      previousShowTextOverlay: _previousShowTextOverlay,
      ...settings
    } = config;
    let currentTemplates: SceneTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-scene-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse scene templates:', error);
    }
    const newTemplate: SceneTemplate = {
      id: Date.now().toString(),
      name: `${presentationMenu?.name || '场景'}-模板-${currentTemplates.length + 1}`,
      settings,
    };
    const nextTemplates = [...currentTemplates, newTemplate];
    setSceneTemplates(nextTemplates);
    localStorage.setItem('galwriter-scene-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
    setShowSceneTemplateList(true);
  };

  // NOTE: 重命名角色模板
  const handleRenameCharacterTemplate = (tplId: string, newName: string) => {
    let currentTemplates: CharacterTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-char-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse character templates:', error);
    }
    const nextTemplates = currentTemplates.map((t) =>
      t.id === tplId ? { ...t, name: newName } : t,
    );
    setCharacterTemplates(nextTemplates);
    localStorage.setItem('galwriter-char-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
  };

  // NOTE: 重命名场景模板
  const handleRenameSceneTemplate = (tplId: string, newName: string) => {
    let currentTemplates: SceneTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-scene-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse scene templates:', error);
    }
    const nextTemplates = currentTemplates.map((t) =>
      t.id === tplId ? { ...t, name: newName } : t,
    );
    setSceneTemplates(nextTemplates);
    localStorage.setItem('galwriter-scene-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
  };

  // NOTE: 删除角色模板
  const handleDeleteCharacterTemplate = (tplId: string) => {
    let currentTemplates: CharacterTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-char-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse character templates:', error);
    }
    const nextTemplates = currentTemplates.filter((t) => t.id !== tplId);
    setCharacterTemplates(nextTemplates);
    localStorage.setItem('galwriter-char-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
  };

  // NOTE: 删除场景模板
  const handleDeleteSceneTemplate = (tplId: string) => {
    let currentTemplates: SceneTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-scene-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse scene templates:', error);
    }
    const nextTemplates = currentTemplates.filter((t) => t.id !== tplId);
    setSceneTemplates(nextTemplates);
    localStorage.setItem('galwriter-scene-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
  };

  // NOTE: 应用角色模板
  const handleApplyCharacterTemplate = (tpl: CharacterTemplate) => {
    if (!presentationMenu) return;
    updateCharacterPresentation(
      presentationMenu.sourceNodeId,
      (current) => ({
        ...current,
        ...structuredClone(tpl.settings),
      }),
      'enter',
    );
  };

  // NOTE: 应用场景模板
  const handleApplySceneTemplate = (tpl: SceneTemplate) => {
    if (!presentationMenu) return;
    updateScenePresentation(
      presentationMenu.sourceNodeId,
      (current) => ({
        ...current,
        ...structuredClone(tpl.settings),
      }),
      'enter',
    );
  };

  // NOTE: 监听模板数据同步事件以同步全局跨卡片模板列表
  useEffect(() => {
    const handleSync = () => {
      try {
        const storedChar = localStorage.getItem('galwriter-char-templates');
        setCharacterTemplates(storedChar ? JSON.parse(storedChar) : []);
      } catch (error) {
        console.error('Failed to sync character templates:', error);
      }
      try {
        const storedScene = localStorage.getItem('galwriter-scene-templates');
        setSceneTemplates(storedScene ? JSON.parse(storedScene) : []);
      } catch (error) {
        console.error('Failed to sync scene templates:', error);
      }
    };
    window.addEventListener('galwriter-templates-changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('galwriter-templates-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const outsideTitleBackground = useStore(
    useCallback(
      (state) => {
        const canvasBg =
          typeof data.canvasBg === 'string' && data.canvasBg.trim() ? data.canvasBg : '#F9FAFB';
        const selfNode = state.nodes.find((node) => node.id === id);
        if (!selfNode) return canvasBg;

        const selfInternal = state.nodeLookup?.get?.(id);
        const selfPosition = selfInternal?.internals?.positionAbsolute ?? selfNode.position;
        const selfWidth =
          selfInternal?.measured?.width ??
          selfNode.measured?.width ??
          getNumericSize(selfNode.style?.width) ??
          300;
        const titlePoint = {
          x:
            storyTitlePlacement === 'outside-left'
              ? selfPosition.x + 1
              : selfPosition.x + selfWidth - 1,
          y: selfPosition.y - TITLE_HEIGHT / 2,
        };

        let matchedColor = canvasBg;
        let matchedZ = Number.NEGATIVE_INFINITY;

        state.nodes.forEach((node) => {
          if (node.id === id || (node.type !== 'backgroundNode' && node.type !== 'groupNode')) {
            return;
          }

          const internal = state.nodeLookup?.get?.(node.id);
          const position = internal?.internals?.positionAbsolute ?? node.position;
          const width =
            internal?.measured?.width ?? node.measured?.width ?? getNumericSize(node.style?.width);
          const height =
            internal?.measured?.height ??
            node.measured?.height ??
            getNumericSize(node.style?.height);

          if (!width || !height) return;

          const contains =
            titlePoint.x >= position.x &&
            titlePoint.x <= position.x + width &&
            titlePoint.y >= position.y &&
            titlePoint.y <= position.y + height;

          if (!contains) return;

          const zIndex = getNumericSize(node.style?.zIndex) ?? 0;
          if (zIndex < matchedZ) return;

          const candidateColor = typeof node.data?.color === 'string' ? node.data.color : '';
          matchedColor = candidateColor || matchedColor;
          matchedZ = zIndex;
        });

        return matchedColor;
      },
      [data.canvasBg, id, storyTitlePlacement],
    ),
  );

  const isDefaultColor = color === '#ffffff';
  // 使用 CSS 变量实现主题感知，这样切换主题时无需 React 重绘即可瞬间响应
  const nodeBg = isDefaultColor ? 'var(--card-bg)' : color;
  const nodeText = isDefaultColor
    ? 'var(--text-primary)'
    : isLightColor(color)
      ? '#1e293b'
      : '#f8fafc';

  // 判断是否显示富文本工具（只有在显示文本编辑器时才显示）
  const showRichTextTools = !hasVisualMedia || data.showTextOverlay;

  const updateNodeData = useCallback(
    (updates: Partial<StoryNodeData>) => {
      data.onUpdate?.(id, updates);
    },
    [data, id],
  );

  const updateMediaDisplayMode = (mode: StoryNodeData['objectFit']) => {
    if (!storyPresentation.scene) {
      updateNodeData({ objectFit: mode });
      return;
    }

    const cropMode = mode === 'playtest' ? 'contain' : mode === 'fill' ? 'stretch' : 'cover';
    updateNodeData({
      objectFit: mode,
      presentation: {
        ...storyPresentation,
        scene: {
          ...storyPresentation.scene,
          cropMode,
        },
      },
    });
  };

  const updateMediaTransform = (
    updates: Partial<Pick<StoryNodeData, 'mediaScale' | 'mediaOffsetX' | 'mediaOffsetY'>>,
  ) => {
    if (!storyPresentation.scene) {
      updateNodeData(updates);
      return;
    }

    updateNodeData({
      ...updates,
      presentation: {
        ...storyPresentation,
        scene: {
          ...storyPresentation.scene,
          ...(updates.mediaScale !== undefined ? { scale: updates.mediaScale } : {}),
          ...(updates.mediaOffsetX !== undefined ? { offsetX: updates.mediaOffsetX } : {}),
          ...(updates.mediaOffsetY !== undefined ? { offsetY: updates.mediaOffsetY } : {}),
        },
      },
    });
  };

  const syncImageNodeHeight = useCallback(
    (dimensions: { width: number; height: number } | null) => {
      if (
        !imageUrl ||
        hasScenePresentationImage ||
        data.showTextOverlay ||
        !dimensions?.width ||
        !dimensions?.height
      )
        return;

      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

          const currentWidth =
            getNumericSize(node.style?.width) ??
            getNumericSize((node as any).width) ??
            getNumericSize((node as any).measured?.width) ??
            300;
          const currentHeight =
            getNumericSize(node.style?.height) ??
            getNumericSize((node as any).height) ??
            getNumericSize((node as any).measured?.height) ??
            200;
          const imageHeight = (dimensions.height / dimensions.width) * currentWidth;
          const targetHeight = Math.max(
            50,
            Math.ceil(imageHeight + (showTitleInside ? TITLE_HEIGHT : 0)),
          );
          const titleHeightAdded = showTitleInside;

          if (
            Math.abs(currentHeight - targetHeight) < 1 &&
            node.data?.titleHeightAdded === titleHeightAdded
          ) {
            return node;
          }

          return {
            ...node,
            style: {
              ...node.style,
              height: targetHeight,
            },
            data: {
              ...node.data,
              titleHeightAdded,
            },
          };
        }),
      );

      requestAnimationFrame(() => {
        updateNodeInternals(id);
      });
    },
    [
      data.showTextOverlay,
      hasScenePresentationImage,
      id,
      imageUrl,
      setNodes,
      showTitleInside,
      updateNodeInternals,
    ],
  );

  useLayoutEffect(() => {
    syncImageNodeHeight(imageDimensions);
  }, [imageDimensions, syncImageNodeHeight]);

  useEffect(
    () => () => {
      if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
    },
    [],
  );

  const handleTextChange = (newHtml: string) => {
    updateNodeData({ text: newHtml });
  };

  const getPresentation = () => normalizeStoryPresentation(data.presentation);

  const replayPresentation = (
    kind: 'character' | 'scene',
    sourceNodeId: string,
    phase: 'enter' | 'exit' = 'enter',
    motionOverride?: PresentationMotion,
  ) => {
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
    const presentation = getPresentation();
    const motion =
      motionOverride ||
      (kind === 'character'
        ? presentation.characters.find((item) => item.sourceNodeId === sourceNodeId)?.[phase]
        : presentation.scene?.sourceNodeId === sourceNodeId
          ? presentation.scene[phase]
          : undefined);
    if (!motion || motion.type === 'none' || motion.duration <= 0) {
      setPresentationPreview(null);
      previewFrameRef.current = null;
      return;
    }
    setPresentationPreview({
      kind,
      sourceNodeId,
      phase,
      active: false,
      nonce: Date.now(),
    });
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = requestAnimationFrame(() => {
        setPresentationPreview((current) =>
          current && current.kind === kind && current.sourceNodeId === sourceNodeId
            ? { ...current, active: true }
            : current,
        );
        previewFrameRef.current = null;
      });
    });
  };

  const updateCharacterPresentation = (
    sourceNodeId: string,
    updater: (current: CharacterPresentation) => CharacterPresentation,
    _previewPhase: 'enter' | 'exit' = 'enter',
    preserveResetUndo = false,
  ) => {
    const presentation = getPresentation();
    const current =
      presentation.characters.find((item) => item.sourceNodeId === sourceNodeId) ||
      createCharacterPresentation(sourceNodeId);
    const next = updater(current);
    updateNodeData({
      presentation: {
        ...presentation,
        characters: [
          ...presentation.characters.filter((item) => item.sourceNodeId !== sourceNodeId),
          next,
        ],
      },
    });
    if (!preserveResetUndo) setPresentationResetUndo(null);
  };

  const updateScenePresentation = (
    sourceNodeId: string,
    updater: (current: ScenePresentation) => ScenePresentation,
    _previewPhase: 'enter' | 'exit' = 'enter',
    preserveResetUndo = false,
  ) => {
    const presentation = getPresentation();
    const current =
      presentation.scene?.sourceNodeId === sourceNodeId
        ? presentation.scene
        : createScenePresentation(sourceNodeId, imageUrl);
    const next = updater(current);
    updateNodeData({
      presentation: {
        ...presentation,
        scene: next,
      },
    });
    if (!preserveResetUndo) setPresentationResetUndo(null);
  };

  const handleMentionContextMenu = (
    event: React.MouseEvent<HTMLSpanElement>,
    mention: { kind: 'character' | 'scene'; name: string },
  ) => {
    const allNodes = storeApi.getState().nodes;
    const presentation = getPresentation();
    const boundSourceIds =
      mention.kind === 'character'
        ? presentation.characters.map((character) => character.sourceNodeId)
        : presentation.scene?.sourceNodeId
          ? [presentation.scene.sourceNodeId]
          : [];
    const sourceNode =
      allNodes.find(
        (node) =>
          boundSourceIds.includes(node.id) &&
          (mention.kind === 'character'
            ? node.type === 'characterNode' && node.data.characterName === mention.name
            : node.type === 'sceneNode' && node.data.sceneName === mention.name),
      ) ||
      allNodes.find((node) =>
        mention.kind === 'character'
          ? node.type === 'characterNode' && node.data.characterName === mention.name
          : node.type === 'sceneNode' && node.data.sceneName === mention.name,
      );
    if (!sourceNode) return;

    if (mention.kind === 'scene') {
      if (presentation.scene?.sourceNodeId !== sourceNode.id) {
        updateNodeData({
          imageUrl: (sourceNode.data.coverImageUrl as string | undefined) || imageUrl,
          showTextOverlay: true,
          presentation: {
            ...presentation,
            scene: createScenePresentation(sourceNode.id, imageUrl, false, data.showTextOverlay),
          },
        });
      }
    } else {
      if (!presentation.characters.some((item) => item.sourceNodeId === sourceNode.id)) {
        updateNodeData({
          presentation: {
            ...presentation,
            characters: [...presentation.characters, createCharacterPresentation(sourceNode.id)],
          },
        });
      }
    }

    setPresentationMenu({
      kind: mention.kind,
      sourceNodeId: sourceNode.id,
      name: mention.name,
      x: event.clientX,
      y: event.clientY,
    });
    replayPresentation(mention.kind, sourceNode.id, 'enter');
  };

  const handleGenerateImage = async () => {
    if (!data.onGenerateImage || isGeneratingImage) return;
    setIsGeneratingImage(true);
    try {
      await data.onGenerateImage(id);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateSpeech = async () => {
    if (!data.onGenerateSpeech || isGeneratingSpeech || !plainSpeechText) return;
    setIsGeneratingSpeech(true);
    try {
      await data.onGenerateSpeech(id);
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const stopRecordingTracks = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const startRecording = async () => {
    if (recordingState !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const recording = new Blob(recordingChunksRef.current, {
          type: mimeType || recorder.mimeType || 'audio/webm',
        });
        recordingChunksRef.current = [];
        recorderRef.current = null;
        stopRecordingTracks();

        if (recording.size === 0) {
          setRecordingState('idle');
          return;
        }

        setRecordingState('encoding');
        try {
          const { convertRecordingToMp3 } = await import('../lib/audioRecording');
          const mp3 = await convertRecordingToMp3(recording);
          const url = URL.createObjectURL(mp3);
          const latestNode = storeApi.getState().nodes.find((node) => node.id === id);
          const latestData = latestNode?.data as StoryNodeData | undefined;
          const existingClips: StoryAudioClip[] = Array.isArray(latestData?.audioClips)
            ? latestData.audioClips
            : latestData?.audioUrl
              ? [
                  {
                    id: crypto.randomUUID(),
                    name: lang === 'zh' ? '已有音频' : 'Existing audio',
                    url: latestData.audioUrl,
                    source: 'imported',
                    createdAt: Date.now() - 1,
                  },
                ]
              : [];
          const clip: StoryAudioClip = {
            id: crypto.randomUUID(),
            name:
              lang === 'zh'
                ? `录音 ${new Date().toLocaleTimeString()}`
                : `Recording ${new Date().toLocaleTimeString()}`,
            url,
            source: 'recording',
            createdAt: Date.now(),
          };
          updateNodeData({
            audioUrl: url,
            audioClips: [...existingClips, clip],
          });
        } catch (error) {
          console.error('Failed to encode recording as MP3:', error);
          alert(
            lang === 'zh' ? '录音转 MP3 失败，请重试。' : 'Failed to convert recording to MP3.',
          );
        } finally {
          setRecordingState('idle');
        }
      };

      recorder.start(250);
      setRecordingState('recording');
    } catch (error) {
      recorderRef.current = null;
      recordingChunksRef.current = [];
      stopRecordingTracks();
      setRecordingState('idle');
      const message = error instanceof Error ? error.message : '';
      alert(
        lang === 'zh'
          ? `无法开始录音${message ? `：${message}` : '。'}`
          : `Unable to start recording${message ? `: ${message}` : '.'}`,
      );
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      stopRecordingTracks();
    },
    [],
  );

  const handleDownloadImage = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!imageUrl) return;

    const plainTitle = title.replace(/<[^>]*>/g, '').trim() || (lang === 'zh' ? '图片' : 'image');
    const safeTitle = plainTitle.replace(/[\\/:*?"<>|]/g, '_');
    const extension = imageUrl.match(/^data:image\/([^;]+)/i)?.[1]?.replace('jpeg', 'jpg') || 'png';
    const link = document.createElement('a');
    link.download = `${safeTitle}.${extension}`;

    try {
      if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
        link.href = imageUrl;
      } else {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        link.href = URL.createObjectURL(blob);
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (link.href.startsWith('blob:')) URL.revokeObjectURL(link.href);
    } catch {
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const showNodeActions = data.showNodeActions !== false;
  const handleClasses = `!w-3 !h-3 !bg-blue-400 !border-2 !border-[var(--card-bg)] !rounded-full transition-all z-40 hover:!scale-150 hover:!bg-blue-500 cursor-crosshair shadow-sm ${showNodeActions ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}`;
  const addBtnClasses = `absolute w-6 h-6 bg-[var(--card-bg)] border border-[var(--card-border)] text-blue-500 hover:text-white rounded-full shadow-md hover:bg-blue-500 transition-all z-50 flex items-center justify-center ${showNodeActions ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}`;

  const getClipPath = (s: StoryCardVisualShape) => {
    switch (s) {
      case 'circle':
        return 'circle(50% at 50% 50%)';
      case 'diamond':
        return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      case 'trapezoid':
        return 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)';
      case 'hexagon':
        return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
      case 'rounded-rectangle':
        return undefined;
      default:
        return undefined;
    }
  };

  const dynamicPaddingClasses = () => {
    switch (shape) {
      case 'diamond':
        return 'p-12'; // 增加边距以确保文字在菱形中心
      case 'circle':
        return 'p-8';
      case 'hexagon':
        return 'px-8 py-4';
      default:
        return showTitleInside ? 'p-3 pt-0' : 'p-3';
    }
  };

  const selectionCount = useStore((state) => {
    return state.nodes.filter((n) => n.selected).length;
  });

  const mentionableCharacters = useStore(
    useCallback(
      (state) => {
        const chars: { id: string; name: string }[] = [];
        for (const n of state.nodes) {
          if (n.type !== 'characterNode') continue;
          const name = typeof n.data?.characterName === 'string' ? n.data.characterName.trim() : '';
          if (!name) continue;
          const isGlobal = n.data?.isGlobal !== false;
          const isConnected = state.edges.some(
            (e) => (e.source === n.id && e.target === id) || (e.target === n.id && e.source === id),
          );
          if (isGlobal || isConnected) chars.push({ id: n.id, name });
        }
        return chars;
      },
      [id],
    ),
  ) as { id: string; name: string }[];

  const mentionableScenes = useStore(
    useCallback(
      (state) => {
        const scenes: { id: string; name: string }[] = [];
        for (const n of state.nodes as SceneFlowNode[]) {
          if (n.type !== 'sceneNode') continue;
          const name = n.data?.sceneName?.trim();
          if (!name) continue;
          const isGlobal = n.data?.isGlobal !== false;
          const isConnected = state.edges.some(
            (e) => (e.source === n.id && e.target === id) || (e.target === n.id && e.source === id),
          );
          if (isGlobal || isConnected) scenes.push({ id: n.id, name });
        }
        return scenes;
      },
      [id],
    ),
  ) as { id: string; name: string }[];

  const insertCharacterMention = (name: string) => {
    richTextRef.current?.insertMention('character', name);
  };

  const insertSceneMention = (name: string) => {
    richTextRef.current?.insertMention('scene', name);
  };

  const presentedCharacters = useStore(
    useCallback(
      (state) =>
        storyPresentation.characters
          .map((config) => {
            const source = state.nodes.find((node) => node.id === config.sourceNodeId);
            if (!source || source.type !== 'characterNode') return null;
            const characterData = source.data as CharacterNodeData;
            const outfit = config.outfitId
              ? characterData.outfits?.find((item) => item.id === config.outfitId)
              : characterData.outfits?.find((item) => item.imageUrl);
            const characterImageUrl = outfit?.imageUrl || characterData.avatarUrl;
            if (!characterImageUrl) return null;
            return {
              config,
              imageUrl: characterImageUrl,
              name: characterData.characterName,
            };
          })
          .filter(Boolean) as {
          config: CharacterPresentation;
          imageUrl: string;
          name: string;
        }[],
      [storyPresentation.characters],
    ),
  );

  const isPreviewAnimatedState = (kind: 'character' | 'scene', sourceNodeId: string) => {
    if (
      !presentationPreview ||
      presentationPreview.kind !== kind ||
      presentationPreview.sourceNodeId !== sourceNodeId
    ) {
      return false;
    }
    return presentationPreview.phase === 'exit'
      ? presentationPreview.active
      : !presentationPreview.active;
  };

  return (
    <div className="w-full h-full relative group min-w-[100px] min-h-[50px]">
      {isRoot && (
        <div className="absolute -top-3 -left-3 z-50 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
          <Play className="w-3 h-4" /> 开始
        </div>
      )}
      {data.skip && (
        <div
          className={`absolute -top-3 ${isRoot ? 'left-10' : '-left-3'} z-50 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1`}
        >
          <StepForward className="w-3 h-4" /> 暂时跳过
        </div>
      )}
      <NodeResizer
        minWidth={100}
        minHeight={50}
        isVisible={selected && selectionCount === 1}
        lineClassName="!border-blue-500 !border-2"
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-blue-500 !rounded-sm"
      />

      {/* Floating Toolbar for styles & actions */}
      <NodeToolbar isVisible={selected && selectionCount === 1} position={Position.Top} offset={15}>
        <div style={{ transform: `scale(${zoom * 0.6})`, transformOrigin: 'bottom center' }}>
          <div
            className="toolbar-bubble-surface nodrag nopan nowheel bg-[var(--toolbar-bg)] backdrop-blur-md p-2 rounded-xl flex flex-col gap-1.5 shadow-2xl border border-[var(--toolbar-border)] w-max max-w-[90vw] toolbar-animate"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            {/* 第一行：颜色、形状、文字工具、视图 - 完全扁平化以实现平均散开分布 */}
            <ToolbarRow className="w-full justify-between gap-0">
              {/* 预设颜色按钮 */}
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateNodeData({ color: c })}
                  className={`w-5 h-5 rounded-full border border-[var(--toolbar-border)] transition-transform hover:scale-110 shrink-0 ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--toolbar-bg)]' : ''}`}
                  style={{ backgroundColor: c }}
                  title={c === '#ffffff' ? '白色' : '更改颜色'}
                />
              ))}

              {/* 自定义颜色按钮 */}
              <button
                onClick={() => colorInputRef.current?.click()}
                className={`w-5 h-5 rounded-full border border-[var(--toolbar-border)] transition-transform hover:scale-110 shrink-0 flex items-center justify-center overflow-hidden relative ${!COLORS.includes(color) ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--toolbar-bg)]' : ''}`}
                style={{
                  background: !COLORS.includes(color)
                    ? color
                    : 'linear-gradient(45deg, #f093fb 0%, #f5576c 100%)',
                }}
                title="自定义颜色"
              >
                <Palette
                  className={`w-3 h-3 ${!COLORS.includes(color) ? 'text-white mix-blend-difference' : 'text-white'}`}
                />
                <input
                  ref={colorInputRef}
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  value={COLORS.includes(color) ? '#ffffff' : color}
                  onChange={(e) => updateNodeData({ color: e.target.value })}
                />
              </button>

              <Separator />

              {/* 形状按钮 */}
              {SHAPES.map((s) => (
                <button
                  key={s}
                  onClick={() => updateNodeData({ shape: s })}
                  className={`w-7 h-7 flex items-center justify-center transition-transform hover:scale-110 shrink-0 rounded-md hover:bg-[var(--app-bg)] ${shape === s ? 'text-blue-400' : 'text-[var(--text-primary)]/80'}`}
                  title={`形状: ${s}`}
                >
                  <div
                    className="w-4 h-4 bg-current"
                    style={{ clipPath: getClipPath(s), borderRadius: s === 'square' ? '2px' : 0 }}
                  />
                </button>
              ))}

              {showRichTextTools && (
                <>
                  <Separator />

                  {/* 文字工具按钮 */}
                  <button
                    onClick={() => document.execCommand('bold', false, '')}
                    className={iconBtnBase}
                    title={t.boldText}
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => document.execCommand('italic', false, '')}
                    className={iconBtnBase}
                    title={t.italicText}
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => document.execCommand('underline', false, '')}
                    className={iconBtnBase}
                    title={t.underlineText}
                  >
                    <Underline className="w-4 h-4" />
                  </button>

                  <Separator />

                  {/* 视图按钮 */}
                  <button
                    onClick={() => {
                      if (recordingState === 'recording') {
                        stopRecording();
                      } else {
                        void startRecording();
                      }
                    }}
                    disabled={recordingState === 'encoding'}
                    className={`${iconBtnBase} ${
                      recordingState === 'recording'
                        ? 'bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 hover:text-rose-500'
                        : 'text-rose-500 hover:text-rose-500'
                    } disabled:opacity-100`}
                    title={
                      recordingState === 'recording'
                        ? lang === 'zh'
                          ? '停止录音并保存 MP3'
                          : 'Stop and save MP3'
                        : recordingState === 'encoding'
                          ? lang === 'zh'
                            ? '正在生成 MP3'
                            : 'Creating MP3'
                          : lang === 'zh'
                            ? '开始录音'
                            : 'Start recording'
                    }
                  >
                    {recordingState === 'encoding' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : recordingState === 'recording' ? (
                      <Square className="w-4 h-4 fill-current" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>
                  {plainSpeechText && (
                    <button
                      onClick={handleGenerateSpeech}
                      disabled={isGeneratingSpeech}
                      className={`${iconBtnBase} text-sky-600 disabled:opacity-100`}
                      title={lang === 'zh' ? '文字转音频' : 'Text to audio'}
                    >
                      {isGeneratingSpeech ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </>
              )}
            </ToolbarRow>

            <div className="h-px w-full bg-[var(--toolbar-border)]/30" />

            {/* 已连接人物：插入 @角色名 */}
            {showRichTextTools && mentionableCharacters.length > 0 && (
              <>
                <ToolbarRow className="flex-wrap justify-start gap-1">
                  <ToolGroup className="gap-1 shrink-0">
                    <User className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  </ToolGroup>
                  {mentionableCharacters.map((char) => (
                    <button
                      key={char.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onDoubleClick={(event) => event.preventDefault()}
                      onDragStart={(event) => event.preventDefault()}
                      onClick={() => insertCharacterMention(char.name)}
                      className={`${textBtnBase} select-none bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 hover:text-indigo-400 border border-indigo-500/20`}
                      title={`插入 @${char.name}`}
                    >
                      @{char.name}
                    </button>
                  ))}
                </ToolbarRow>
                <div className="h-px w-full bg-[var(--toolbar-border)]/30" />
              </>
            )}

            {/* 媒体适配行 */}
            {/* Connected/global scenes: insert @scene name */}
            {showRichTextTools && mentionableScenes.length > 0 && (
              <>
                <ToolbarRow className="flex-wrap justify-start gap-1">
                  <ToolGroup className="gap-1 shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  </ToolGroup>
                  {mentionableScenes.map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onDoubleClick={(event) => event.preventDefault()}
                      onDragStart={(event) => event.preventDefault()}
                      onClick={() => insertSceneMention(scene.name)}
                      className={`${textBtnBase} select-none bg-blue-800/10 text-blue-700 hover:bg-blue-800/20 hover:text-blue-800 border border-blue-800/20 dark:text-blue-300 dark:hover:text-blue-200`}
                      title={`插入 @${scene.name}`}
                    >
                      @{scene.name}
                    </button>
                  ))}
                </ToolbarRow>
                <div className="h-px w-full bg-[var(--toolbar-border)]/30" />
              </>
            )}

            {(imageUrl || videoUrl) && (
              <>
                <ToolbarRow>
                  <ToolGroup>
                    <span className="text-[9px] text-[var(--text-muted)] px-1 uppercase font-black tracking-tighter shrink-0">
                      {t.objectFit}
                    </span>
                  </ToolGroup>

                  <Separator />

                  <ToolGroup className="gap-1 flex-wrap">
                    <button
                      onClick={() => updateMediaDisplayMode('cover')}
                      className={`${textBtnBase} ${objectFit === 'cover' ? 'bg-indigo-500 text-white hover:bg-indigo-600 hover:text-white' : ''}`}
                    >
                      {t.crop}
                    </button>
                    <button
                      onClick={() => updateMediaDisplayMode('fill')}
                      className={`${textBtnBase} ${objectFit === 'fill' ? 'bg-indigo-500 text-white hover:bg-indigo-600 hover:text-white' : ''}`}
                    >
                      {t.fill}
                    </button>
                    <button
                      onClick={() => updateMediaDisplayMode('playtest')}
                      className={`${textBtnBase} ${objectFit === 'playtest' ? 'bg-indigo-500 text-white hover:bg-indigo-600 hover:text-white' : ''}`}
                    >
                      {lang === 'zh' ? '测试剧本' : lang === 'ja' ? 'テストプレイ' : 'Playtest'}
                    </button>
                    {objectFit === 'playtest' && (
                      <div className="flex items-center gap-1.5 ml-1">
                        <span className="text-[9px] font-bold text-[var(--text-muted)] shrink-0">
                          {lang === 'zh' ? '缩放' : 'Scale'} {Math.round(activeMediaScale * 100)}%
                        </span>
                        <input
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.05"
                          value={activeMediaScale}
                          onChange={(event) =>
                            updateMediaTransform({ mediaScale: Number(event.target.value) })
                          }
                          className="w-32 shrink-0 h-1 accent-indigo-500"
                        />
                      </div>
                    )}
                  </ToolGroup>

                  <Separator />

                  <ToolGroup>
                    {/* NOTE: 当卡片中渲染了场景演出的照片背景时，隐藏下载图片、提取媒体以及隐藏/移除文字的按钮，以防止在此类演出状态下误操作原始媒体。 */}
                    {imageUrl && !hasScenePresentationImage && (
                      <button
                        onClick={handleDownloadImage}
                        className={`${iconBtnBase} bg-emerald-50 text-emerald-600 hover:bg-emerald-100`}
                        title={lang === 'zh' ? '下载图片' : 'Download Image'}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    {(!data.showTextOverlay || text.replace(/<[^>]*>/g, '').trim() === '') && (
                      <button
                        onClick={() => data.onAddTextToImage?.(id)}
                        className={`${iconBtnBase} bg-indigo-50 text-indigo-600 hover:bg-indigo-100`}
                        title={lang === 'zh' ? '在卡片中添加/显示文字' : 'Add/Show text in card'}
                      >
                        <Type className="w-4 h-4" />
                      </button>
                    )}
                    {data.showTextOverlay &&
                      text.replace(/<[^>]*>/g, '').trim() !== '' &&
                      !hasScenePresentationImage && (
                        <button
                          onClick={() => data.onExtractMedia?.(id)}
                          className={`${iconBtnBase} bg-amber-50 text-amber-600 hover:bg-amber-100 ml-0.5`}
                          title={
                            lang === 'zh' ? '从卡片中提取照片/视频' : 'Extract media from card'
                          }
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                      )}
                    {data.showTextOverlay && !hasScenePresentationImage && (
                      <button
                        onClick={() => data.onRemoveTextFromImage?.(id)}
                        className={`${iconBtnBase} bg-rose-50 text-rose-600 hover:bg-rose-100 ml-0.5`}
                        title={lang === 'zh' ? '移除/隐藏卡片文字' : 'Remove/Hide text from card'}
                      >
                        <Eraser className="w-4 h-4" />
                      </button>
                    )}
                  </ToolGroup>
                </ToolbarRow>
                <div className="h-px w-full bg-[var(--toolbar-border)]/30" />
              </>
            )}

            {/* 第二行：核心功能 */}
            <ToolbarRow>
              {/* 节点状态组 */}
              <ToolGroup>
                <button
                  onClick={() => updateNodeData({ isRoot: true })}
                  className={`${textBtnBase} ${isRoot ? 'bg-emerald-500/20 text-emerald-500 font-bold hover:bg-emerald-500/30' : ''}`}
                >
                  起点
                </button>
              </ToolGroup>

              <Separator />

              {/* 数值组 */}
              <ToolGroup className="gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)] font-black uppercase shrink-0">
                  数值
                </span>
                <NumberInput
                  value={(data.nodeValue as number) || 0}
                  onChange={(val) => updateNodeData({ nodeValue: val })}
                  accentColor="indigo"
                  className="gap-1"
                />
              </ToolGroup>

              <Separator />

              {/* 线路/流程组 */}
              <ToolGroup>
                <button
                  onClick={() => data.onHighlightStoryline?.(id)}
                  className={`${iconBtnBase} ${data.isHighlighted ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)] hover:bg-rose-600 hover:text-white' : ''}`}
                  title={t.showStoryline}
                >
                  <GitFork className={`w-4 h-4 ${data.isHighlighted ? 'animate-pulse' : ''}`} />
                </button>
                <button
                  onClick={() => updateNodeData({ skip: !data.skip })}
                  className={`${iconBtnBase} ${data.skip ? 'bg-emerald-500/20 text-emerald-500 shadow-inner font-bold hover:bg-emerald-500/30' : ''}`}
                  title={t.skipForNow}
                >
                  <StepForward className="w-4 h-4" />
                </button>
              </ToolGroup>

              <Separator />
              {/* 可见性组 */}
              <ToolGroup>
                <button
                  onClick={() => updateNodeData({ hidden: true })}
                  className={iconBtnBase}
                  title={t.hideNode}
                >
                  <EyeOff className="w-4 h-4" />
                </button>
                {showRichTextTools && (
                  <button
                    onClick={() => data.onZenMode?.(id)}
                    className={`${iconBtnBase} bg-emerald-50 text-emerald-600 hover:bg-emerald-100`}
                    title={lang === 'zh' ? '专注模式' : 'Zen Mode'}
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                )}
              </ToolGroup>

              {!isRoot && (
                <>
                  <Separator />
                  <ToolGroup>
                    <button
                      onClick={() => data.onDelete?.(id)}
                      className={`${iconBtnBase} text-red-400 hover:text-red-300 hover:bg-red-500/10`}
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </ToolGroup>
                </>
              )}
            </ToolbarRow>
          </div>
        </div>
      </NodeToolbar>

      {showTitleOutside && (
        <input
          type="text"
          value={title}
          onChange={(e) => updateNodeData({ title: e.target.value })}
          onFocus={(e) => e.target.select()}
          className={`nodrag absolute -top-7 z-20 h-6 w-40 max-w-full border-0 bg-transparent px-0 text-[11px] font-bold uppercase tracking-widest shadow-none outline-none cursor-text ${
            storyTitlePlacement === 'outside-left' ? 'left-0 text-left' : 'right-0 text-right'
          }`}
          style={{
            color: getReadableTextColor(outsideTitleBackground),
            textShadow: isLightColor(outsideTitleBackground)
              ? '0 1px 2px rgba(255, 255, 255, 0.35)'
              : '0 1px 2px rgba(15, 23, 42, 0.55)',
          }}
          placeholder="标题..."
        />
      )}

      <div
        className={`w-full h-full flex flex-col items-center ${imageUrl || videoUrl || audioUrl ? 'justify-start' : 'justify-center'} shadow-sm relative overflow-hidden border-2 transition-[border-color,ring,shadow,background-color] duration-300 ${selected ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-lg' : 'border-[var(--card-border)]'}`}
        style={{
          backgroundColor: nodeBg,
          color: nodeText,
          clipPath: getClipPath(shape),
          borderRadius: shape === 'square' || shape === 'rounded-rectangle' ? CARD_RADIUS : '0',
        }}
      >
        {showTitleInside && (
          <div
            className={`w-full flex justify-center py-2 z-20 relative shrink-0 ${imageUrl || videoUrl || audioUrl ? 'backdrop-blur-sm border-b border-[var(--card-border)]/30' : 'mb-2'}`}
            style={{
              backgroundColor:
                imageUrl || videoUrl || audioUrl
                  ? isDefaultColor
                    ? 'rgba(var(--card-bg-rgb), 0.6)'
                    : `${color}99`
                  : 'transparent',
            }}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => updateNodeData({ title: e.target.value })}
              onFocus={(e) => e.target.select()}
              className={`nodrag w-[50%] text-[11px] font-bold uppercase tracking-widest bg-transparent px-2 rounded outline-none border border-transparent hover:border-[var(--card-border)] focus:border-blue-500 transition-colors text-center pb-0.5 cursor-text ${imageUrl || videoUrl || audioUrl ? 'py-1' : ''}`}
              style={{ color: nodeText }}
              placeholder="标题..."
            />
          </div>
        )}

        <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
          {(hasScenePresentationImage ||
            hasScenePresentationVideo ||
            presentedCharacters.length > 0) && (
            <VirtualPresentationStage
              fit="cover"
              className="relative z-0 h-[52%] w-full shrink-0 pointer-events-none bg-slate-950"
            >
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  transform: `scale(${objectFit === 'playtest' ? activeMediaScale : 1})`,
                  transformOrigin: 'center',
                }}
              >
                {hasScenePresentationImage && (
                  <img
                    key={`scene-preview-${presentationPreview?.nonce || 0}`}
                    src={imageUrl}
                    className="absolute inset-0 z-0 h-full w-full pointer-events-none"
                    style={{
                      ...mediaStyle,
                      transform:
                        [
                          storyPresentation.scene &&
                          isPreviewAnimatedState('scene', storyPresentation.scene.sourceNodeId)
                            ? getPresentationTransform(
                                storyPresentation.scene[
                                  presentationPreview?.phase === 'exit' ? 'exit' : 'enter'
                                ].type,
                                presentationPreview?.phase === 'exit',
                              )
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ') || 'none',
                      opacity:
                        storyPresentation.scene &&
                        isPreviewAnimatedState('scene', storyPresentation.scene.sourceNodeId) &&
                        storyPresentation.scene[
                          presentationPreview?.phase === 'exit' ? 'exit' : 'enter'
                        ].type === 'fade'
                          ? 0
                          : 1,
                      transition:
                        storyPresentation.scene &&
                        presentationPreview?.kind === 'scene' &&
                        presentationPreview.sourceNodeId === storyPresentation.scene.sourceNodeId
                          ? `transform ${storyPresentation.scene[presentationPreview.phase].duration}ms ease, opacity ${storyPresentation.scene[presentationPreview.phase].duration}ms ease`
                          : undefined,
                    }}
                    alt=""
                  />
                )}
                {hasScenePresentationVideo && (
                  <video
                    key={`scene-video-preview-${presentationPreview?.nonce || 0}`}
                    src={videoUrl}
                    className="absolute inset-0 z-0 h-full w-full pointer-events-none"
                    style={mediaStyle}
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                )}
                {presentedCharacters.map(({ config, imageUrl: characterImageUrl, name }) => {
                  const previewMatches =
                    presentationPreview?.kind === 'character' &&
                    presentationPreview.sourceNodeId === config.sourceNodeId;
                  const phase = presentationPreview?.phase === 'exit' ? 'exit' : 'enter';
                  const motion = config[phase];
                  const animated = isPreviewAnimatedState('character', config.sourceNodeId);
                  return (
                    <img
                      key={`${config.sourceNodeId}-${presentationPreview?.nonce || 0}`}
                      src={characterImageUrl}
                      alt={name}
                      className="absolute max-h-[92%] max-w-[72%] object-contain object-bottom"
                      style={{
                        ...getCharacterStagePosition(config),
                        zIndex: clampCharacterLayer(config.layer),
                        opacity: animated && motion.type === 'fade' ? 0 : 1,
                        translate: '-50% 0',
                        transform: `${
                          animated ? getPresentationTransform(motion.type, phase === 'exit') : ''
                        } scale(${config.scale}) scaleX(${config.flipX ? -1 : 1})`,
                        transformOrigin: 'center center',
                        transition:
                          previewMatches && motion.type !== 'none' && motion.duration > 0
                            ? `transform ${motion.duration}ms ease, opacity ${motion.duration}ms ease`
                            : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </VirtualPresentationStage>
          )}
          {imageUrl && !hasScenePresentationImage ? (
            <img
              src={imageUrl}
              className={`w-full ${data.showTextOverlay ? 'h-1/2' : 'flex-1'} object-cover pointer-events-none`}
              style={mediaStyle}
              onLoad={(event) => {
                const image = event.currentTarget;
                setImageDimensions({
                  width: image.naturalWidth || image.width,
                  height: image.naturalHeight || image.height,
                });
              }}
              alt="node"
              loading="lazy"
            />
          ) : videoUrl && !hasScenePresentationVideo ? (
            <div className={`w-full ${data.showTextOverlay ? 'h-1/2' : 'flex-1'} relative`}>
              {zoom < 0.3 ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/10 text-slate-400">
                  <Play className="w-8 h-8 opacity-40" />
                  <span className="text-[10px] mt-2 font-bold opacity-40">放大以查看视频</span>
                </div>
              ) : (
                <video
                  src={videoUrl}
                  controls
                  preload="metadata"
                  playsInline
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  className="w-full h-full object-cover nodrag"
                  style={mediaStyle}
                />
              )}
            </div>
          ) : audioUrl && !showRichTextTools ? (
            <div
              className="w-full flex-1 flex flex-col items-center justify-center nodrag"
              style={{ backgroundColor: nodeBg }}
            >
              {zoom < 0.3 ? (
                <div className="text-2xl opacity-40">🎵</div>
              ) : (
                <>
                  <div className="text-4xl mb-2">🎵</div>
                  <audio src={audioUrl} controls preload="none" className="w-[80%]" />
                </>
              )}
            </div>
          ) : null}

          {audioUrl && (imageUrl || videoUrl || showRichTextTools) && (
            <div className="order-last w-full shrink-0 px-3 py-2 border-t border-[var(--card-border)]/30 bg-[var(--card-bg)]/85 backdrop-blur-sm nodrag">
              {zoom < 0.3 ? (
                <div className="text-center text-lg opacity-40">Audio</div>
              ) : (
                <audio src={audioUrl} controls preload="metadata" className="w-full h-8" />
              )}
            </div>
          )}

          {showRichTextTools && (
            <div
              className={`relative z-0 w-full flex-1 flex flex-col items-center justify-center ${dynamicPaddingClasses()} ${
                (imageUrl && !hasScenePresentationImage) || videoUrl
                  ? 'border-t border-[var(--card-border)]/30'
                  : ''
              }`}
              style={{
                backgroundColor: hasScenePresentationImage
                  ? isDefaultColor
                    ? 'rgb(var(--card-bg-rgb))'
                    : color
                  : nodeBg,
                ...(hasScenePresentationImage || presentedCharacters.length > 0
                  ? { flex: '0 0 48%' }
                  : {}),
              }}
            >
              <div
                className={`w-full h-full flex flex-col items-center justify-center ${shape === 'diamond' ? 'scale-[0.8]' : ''}`}
              >
                <RichText
                  ref={richTextRef}
                  value={text}
                  onChange={handleTextChange}
                  pasteAsPlainText={!!data.pasteAsPlainText}
                  className={`w-full h-full resize-none bg-transparent text-sm leading-relaxed relative z-10 break-words cursor-text ${shape === 'square' || shape === 'rounded-rectangle' ? 'text-left' : 'text-center'}`}
                  style={{ color: nodeText }}
                  onMentionContextMenu={handleMentionContextMenu}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Generate Button - Always visible at top for image nodes, or bottom for text nodes */}
      <button
        onClick={() => data.onAIGenerate?.(id)}
        disabled={!!data.isAILoading}
        className={`absolute z-50 p-1.5 bg-[var(--card-bg)]/80 backdrop-blur-md text-indigo-500 hover:bg-indigo-500 hover:text-white border border-[var(--card-border)] rounded-md transition-all opacity-0 group-hover:opacity-100 disabled:opacity-100 shadow-lg ${imageUrl || videoUrl ? 'bottom-2 right-2' : 'bottom-2 right-2'}`}
        title="AI 操作"
      >
        {data.isAILoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
      </button>

      {presentationMenu &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999]"
            onMouseDown={() => setPresentationMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setPresentationMenu(null);
            }}
          >
            <div
              ref={presentationMenuRef}
              className="absolute w-72 max-h-[calc(100vh-24px)] overflow-y-auto rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-[var(--text-primary)] shadow-2xl"
              style={{
                left: presentationMenuPosition.left,
                top: presentationMenuPosition.top,
                maxHeight: (window.innerHeight - 24) / presentationMenuScale,
                transform: `scale(${presentationMenuScale})`,
                transformOrigin: 'top left',
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                type="button"
                onClick={() => {
                  const canRestore =
                    presentationResetUndo?.kind === presentationMenu.kind &&
                    presentationResetUndo.sourceNodeId === presentationMenu.sourceNodeId;
                  if (canRestore) {
                    if (presentationMenu.kind === 'character') {
                      const previous = presentationResetUndo.value as CharacterPresentation;
                      updateCharacterPresentation(
                        presentationMenu.sourceNodeId,
                        () => previous,
                        'enter',
                        true,
                      );
                    } else {
                      const previous = presentationResetUndo.value as ScenePresentation;
                      updateScenePresentation(
                        presentationMenu.sourceNodeId,
                        () => previous,
                        'enter',
                        true,
                      );
                    }
                    setPresentationResetUndo(null);
                    return;
                  }

                  if (presentationMenu.kind === 'character') {
                    const current =
                      getPresentation().characters.find(
                        (item) => item.sourceNodeId === presentationMenu.sourceNodeId,
                      ) || createCharacterPresentation(presentationMenu.sourceNodeId);
                    setPresentationResetUndo({
                      kind: 'character',
                      sourceNodeId: presentationMenu.sourceNodeId,
                      value: structuredClone(current),
                    });
                    updateCharacterPresentation(
                      presentationMenu.sourceNodeId,
                      (current) => ({
                        ...createCharacterPresentation(presentationMenu.sourceNodeId),
                        linkedByEdge: current.linkedByEdge,
                        outfitId: current.outfitId,
                      }),
                      'enter',
                      true,
                    );
                  } else {
                    const current =
                      getPresentation().scene?.sourceNodeId === presentationMenu.sourceNodeId
                        ? getPresentation().scene!
                        : createScenePresentation(presentationMenu.sourceNodeId, imageUrl);
                    setPresentationResetUndo({
                      kind: 'scene',
                      sourceNodeId: presentationMenu.sourceNodeId,
                      value: structuredClone(current),
                    });
                    updateScenePresentation(
                      presentationMenu.sourceNodeId,
                      (current) => ({
                        ...createScenePresentation(presentationMenu.sourceNodeId),
                        linkedByEdge: current.linkedByEdge,
                        imageId: current.imageId,
                        previousImageUrl: current.previousImageUrl,
                        previousShowTextOverlay: current.previousShowTextOverlay,
                      }),
                      'enter',
                      true,
                    );
                  }
                }}
                className={`absolute right-3 top-3 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors ${
                  presentationResetUndo?.kind === presentationMenu.kind &&
                  presentationResetUndo.sourceNodeId === presentationMenu.sourceNodeId
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white'
                }`}
                title={
                  presentationResetUndo?.kind === presentationMenu.kind &&
                  presentationResetUndo.sourceNodeId === presentationMenu.sourceNodeId
                    ? '还原清零前的演出设置'
                    : '恢复默认演出设置'
                }
              >
                {presentationResetUndo?.kind === presentationMenu.kind &&
                presentationResetUndo.sourceNodeId === presentationMenu.sourceNodeId
                  ? '还原'
                  : '清零'}
              </button>
              <div className="mb-3 pr-12 text-sm font-black">
                {presentationMenu.kind === 'character' ? '人物演出' : '场景演出'}：
                {presentationMenu.name}
              </div>

              {presentationMenu.kind === 'character'
                ? (() => {
                    const presentation = getPresentation();
                    const current =
                      presentation.characters.find(
                        (item) => item.sourceNodeId === presentationMenu.sourceNodeId,
                      ) || createCharacterPresentation(presentationMenu.sourceNodeId);
                    return (
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between bg-[var(--app-bg)] rounded-lg p-1.5 border border-[var(--card-border)]/40 gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                copyCharacterPresentationSettings(current);
                                setPresentationClipboardVersion((version) => version + 1);
                              }}
                              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors flex items-center justify-center"
                              title="复制设置"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={!hasCharacterPresentationClipboard()}
                              onClick={() =>
                                updateCharacterPresentation(
                                  presentationMenu.sourceNodeId,
                                  pasteCharacterPresentationSettings,
                                )
                              }
                              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-[var(--text-secondary)] disabled:hover:bg-transparent flex items-center justify-center"
                              title="粘贴设置"
                            >
                              <ClipboardPaste className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="w-px h-4 bg-[var(--card-border)]/40 shrink-0" />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCreateCharacterTemplate(current)}
                              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors flex items-center justify-center"
                              title="新建模板"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setShowCharacterTemplateList(!showCharacterTemplateList)
                              }
                              className={`p-1.5 rounded-md transition-colors flex items-center justify-center ${showCharacterTemplateList ? 'text-indigo-500 bg-indigo-500/10' : 'text-[var(--text-secondary)] hover:text-indigo-500 hover:bg-indigo-500/10'}`}
                              title="模板列表"
                            >
                              <List className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {showCharacterTemplateList && (
                          <div className="mt-2 border border-[var(--card-border)]/40 rounded-lg bg-[var(--app-bg)]/50 p-2 space-y-1.5 max-h-48 overflow-y-auto">
                            <div className="text-[10px] font-bold text-[var(--text-muted)] px-1 flex justify-between items-center">
                              <span>已存人物模板</span>
                              {characterTemplates.length === 0 && (
                                <span className="font-normal">暂无模板</span>
                              )}
                            </div>
                            {characterTemplates.map((tpl) => (
                              <div
                                key={tpl.id}
                                className="flex items-center justify-between gap-1.5 bg-[var(--card-bg)] p-1.5 rounded border border-[var(--card-border)]/30 hover:border-indigo-500/30 transition-colors"
                              >
                                <input
                                  type="text"
                                  value={tpl.name}
                                  onChange={(e) =>
                                    handleRenameCharacterTemplate(tpl.id, e.target.value)
                                  }
                                  className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none border-b border-transparent focus:border-indigo-500/50 pb-0.5 px-0.5"
                                  placeholder="模板名称"
                                />
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleApplyCharacterTemplate(tpl)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-colors"
                                    title="应用模板"
                                  >
                                    使用
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCharacterTemplate(tpl.id)}
                                    className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                    title="删除模板"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              replayPresentation(
                                'character',
                                presentationMenu.sourceNodeId,
                                'enter',
                              )
                            }
                            className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-2 font-bold text-blue-500 outline-none hover:bg-blue-500 hover:text-white focus:outline-none focus-visible:outline-none"
                          >
                            预览入场
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              replayPresentation('character', presentationMenu.sourceNodeId, 'exit')
                            }
                            className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 font-bold text-rose-500 outline-none hover:bg-rose-500 hover:text-white focus:outline-none focus-visible:outline-none"
                          >
                            预览出场
                          </button>
                        </div>
                        <div className="flex w-full gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateCharacterPresentation(
                                presentationMenu.sourceNodeId,
                                (item) => ({
                                  ...item,
                                  position: 'left',
                                }),
                              )
                            }
                            className={`flex-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${
                              current.position === 'left'
                                ? 'border-indigo-500 bg-indigo-500 text-white'
                                : 'border-[var(--card-border)] bg-[var(--app-bg)] hover:border-indigo-500/50 hover:bg-indigo-500/10'
                            }`}
                          >
                            左边
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateCharacterPresentation(
                                presentationMenu.sourceNodeId,
                                (item) => ({
                                  ...item,
                                  position: 'center',
                                }),
                              )
                            }
                            className={`flex-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${
                              current.position === 'center'
                                ? 'border-indigo-500 bg-indigo-500 text-white'
                                : 'border-[var(--card-border)] bg-[var(--app-bg)] hover:border-indigo-500/50 hover:bg-indigo-500/10'
                            }`}
                          >
                            中间
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateCharacterPresentation(
                                presentationMenu.sourceNodeId,
                                (item) => ({
                                  ...item,
                                  position: 'right',
                                }),
                              )
                            }
                            className={`flex-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${
                              current.position === 'right'
                                ? 'border-indigo-500 bg-indigo-500 text-white'
                                : 'border-[var(--card-border)] bg-[var(--app-bg)] hover:border-indigo-500/50 hover:bg-indigo-500/10'
                            }`}
                          >
                            右边
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 font-bold">水平偏移</span>
                          <div className="min-w-0 flex-1">
                            <DraggableNumberInput
                              value={current.offsetX}
                              onChange={(value) =>
                                updateCharacterPresentation(
                                  presentationMenu.sourceNodeId,
                                  (item) => ({ ...item, offsetX: value }),
                                )
                              }
                            />
                          </div>
                          <span className="shrink-0 font-bold">垂直偏移</span>
                          <div className="min-w-0 flex-1">
                            <DraggableNumberInput
                              value={current.offsetY}
                              onChange={(value) =>
                                updateCharacterPresentation(
                                  presentationMenu.sourceNodeId,
                                  (item) => ({ ...item, offsetY: value }),
                                )
                              }
                            />
                          </div>
                        </div>
                        {presentation.characters.length > 1 && (
                          <label className="flex items-center gap-2">
                            <span className="shrink-0 font-bold">Z轴</span>
                            <div className="w-20">
                              <DraggableNumberInput
                                value={clampCharacterLayer(current.layer)}
                                min={1}
                                max={20}
                                unit={null}
                                onChange={(value) =>
                                  updateCharacterPresentation(
                                    presentationMenu.sourceNodeId,
                                    (item) => ({
                                      ...item,
                                      layer: clampCharacterLayer(value),
                                    }),
                                  )
                                }
                              />
                            </div>
                          </label>
                        )}
                        <label className="flex items-center gap-2">
                          <span className="shrink-0 font-bold">
                            缩放：{Math.round(current.scale * 100)}%
                          </span>
                          <input
                            type="range"
                            min="0.4"
                            max="2"
                            step="0.05"
                            value={current.scale}
                            onChange={(event) =>
                              updateCharacterPresentation(
                                presentationMenu.sourceNodeId,
                                (item) => ({
                                  ...item,
                                  scale: Number(event.target.value),
                                }),
                              )
                            }
                            className="min-w-0 flex-1"
                          />
                        </label>
                        {(['enter', 'exit'] as const).map((phase) => (
                          <div key={phase} className="flex items-center gap-2">
                            <span className="shrink-0 font-bold">
                              {phase === 'enter' ? '入场动画' : '出场动画'}
                            </span>
                            <label className="min-w-0 flex-1">
                              <select
                                value={current[phase].type}
                                onChange={(event) =>
                                  updateCharacterPresentation(
                                    presentationMenu.sourceNodeId,
                                    (item) => ({
                                      ...item,
                                      [phase]: {
                                        ...item[phase],
                                        type: event.target.value as PresentationAnimation,
                                      },
                                    }),
                                    phase,
                                  )
                                }
                                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2"
                              >
                                {ANIMATION_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <span className="shrink-0 font-bold">时长</span>
                            <label className="w-[72px] shrink-0">
                              <DurationInput
                                value={current[phase].duration}
                                onChange={(duration) =>
                                  updateCharacterPresentation(
                                    presentationMenu.sourceNodeId,
                                    (item) => ({
                                      ...item,
                                      [phase]: {
                                        ...item[phase],
                                        duration,
                                      },
                                    }),
                                    phase,
                                  )
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                : (() => {
                    const presentation = getPresentation();
                    const current =
                      presentation.scene?.sourceNodeId === presentationMenu.sourceNodeId
                        ? presentation.scene
                        : createScenePresentation(presentationMenu.sourceNodeId, imageUrl);
                    return (
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between bg-[var(--app-bg)] rounded-lg p-1.5 border border-[var(--card-border)]/40 gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                copyScenePresentationSettings(current);
                                setPresentationClipboardVersion((version) => version + 1);
                              }}
                              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-500/10 transition-colors flex items-center justify-center"
                              title="复制设置"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={!hasScenePresentationClipboard()}
                              onClick={() =>
                                updateScenePresentation(
                                  presentationMenu.sourceNodeId,
                                  pasteScenePresentationSettings,
                                )
                              }
                              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-500/10 transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-[var(--text-secondary)] disabled:hover:bg-transparent flex items-center justify-center"
                              title="粘贴设置"
                            >
                              <ClipboardPaste className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="w-px h-4 bg-[var(--card-border)]/40 shrink-0" />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCreateSceneTemplate(current)}
                              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-500/10 transition-colors flex items-center justify-center"
                              title="新建模板"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowSceneTemplateList(!showSceneTemplateList)}
                              className={`p-1.5 rounded-md transition-colors flex items-center justify-center ${showSceneTemplateList ? 'text-blue-500 bg-blue-500/10' : 'text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-500/10'}`}
                              title="模板列表"
                            >
                              <List className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {showSceneTemplateList && (
                          <div className="mt-2 border border-[var(--card-border)]/40 rounded-lg bg-[var(--app-bg)]/50 p-2 space-y-1.5 max-h-48 overflow-y-auto">
                            <div className="text-[10px] font-bold text-[var(--text-muted)] px-1 flex justify-between items-center">
                              <span>已存场景模板</span>
                              {sceneTemplates.length === 0 && (
                                <span className="font-normal">暂无模板</span>
                              )}
                            </div>
                            {sceneTemplates.map((tpl) => (
                              <div
                                key={tpl.id}
                                className="flex items-center justify-between gap-1.5 bg-[var(--card-bg)] p-1.5 rounded border border-[var(--card-border)]/30 hover:border-blue-500/30 transition-colors"
                              >
                                <input
                                  type="text"
                                  value={tpl.name}
                                  onChange={(e) =>
                                    handleRenameSceneTemplate(tpl.id, e.target.value)
                                  }
                                  className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none border-b border-transparent focus:border-blue-500/50 pb-0.5 px-0.5"
                                  placeholder="模板名称"
                                />
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleApplySceneTemplate(tpl)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
                                    title="应用模板"
                                  >
                                    使用
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSceneTemplate(tpl.id)}
                                    className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                    title="删除模板"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              replayPresentation('scene', presentationMenu.sourceNodeId, 'enter')
                            }
                            className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-2 font-bold text-blue-500 outline-none hover:bg-blue-500 hover:text-white focus:outline-none focus-visible:outline-none"
                          >
                            预览入场
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              replayPresentation('scene', presentationMenu.sourceNodeId, 'exit')
                            }
                            className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 font-bold text-rose-500 outline-none hover:bg-rose-500 hover:text-white focus:outline-none focus-visible:outline-none"
                          >
                            预览出场
                          </button>
                        </div>
                        <div className="flex w-full gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateScenePresentation(presentationMenu.sourceNodeId, (item) => ({
                                ...item,
                                cropMode: 'cover',
                              }))
                            }
                            className={`flex-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${
                              current.cropMode === 'cover'
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : 'border-[var(--card-border)] bg-[var(--app-bg)] hover:border-blue-500/50 hover:bg-blue-500/10'
                            }`}
                          >
                            覆盖裁切
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateScenePresentation(presentationMenu.sourceNodeId, (item) => ({
                                ...item,
                                cropMode: 'contain',
                              }))
                            }
                            className={`flex-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${
                              current.cropMode === 'contain'
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : 'border-[var(--card-border)] bg-[var(--app-bg)] hover:border-blue-500/50 hover:bg-blue-500/10'
                            }`}
                          >
                            完整显示
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateScenePresentation(presentationMenu.sourceNodeId, (item) => ({
                                ...item,
                                cropMode: 'stretch',
                              }))
                            }
                            className={`flex-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${
                              current.cropMode === 'stretch'
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : 'border-[var(--card-border)] bg-[var(--app-bg)] hover:border-blue-500/50 hover:bg-blue-500/10'
                            }`}
                          >
                            拉伸填充
                          </button>
                        </div>
                        <label className="flex items-center gap-2">
                          <span className="shrink-0 font-bold">
                            缩放：{Math.round(current.scale * 100)}%
                          </span>
                          <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.05"
                            value={current.scale}
                            onChange={(event) =>
                              updateScenePresentation(presentationMenu.sourceNodeId, (item) => ({
                                ...item,
                                scale: Number(event.target.value),
                              }))
                            }
                            className="min-w-0 flex-1"
                          />
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 font-bold">水平偏移</span>
                          <div className="min-w-0 flex-1">
                            <DraggableNumberInput
                              value={current.offsetX}
                              onChange={(value) =>
                                updateScenePresentation(presentationMenu.sourceNodeId, (item) => ({
                                  ...item,
                                  offsetX: value,
                                }))
                              }
                            />
                          </div>
                          <span className="shrink-0 font-bold">垂直偏移</span>
                          <div className="min-w-0 flex-1">
                            <DraggableNumberInput
                              value={current.offsetY}
                              onChange={(value) =>
                                updateScenePresentation(presentationMenu.sourceNodeId, (item) => ({
                                  ...item,
                                  offsetY: value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        {(['enter', 'exit'] as const).map((phase) => (
                          <div key={phase} className="flex items-center gap-2">
                            <span className="shrink-0 font-bold">
                              {phase === 'enter' ? '入场动画' : '出场动画'}
                            </span>
                            <label className="min-w-0 flex-1">
                              <select
                                value={current[phase].type}
                                onChange={(event) =>
                                  updateScenePresentation(
                                    presentationMenu.sourceNodeId,
                                    (item) => ({
                                      ...item,
                                      [phase]: {
                                        ...item[phase],
                                        type: event.target.value as PresentationAnimation,
                                      },
                                    }),
                                    phase,
                                  )
                                }
                                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2"
                              >
                                {ANIMATION_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <span className="shrink-0 font-bold">时长</span>
                            <label className="w-[72px] shrink-0">
                              <DurationInput
                                value={current[phase].duration}
                                onChange={(duration) =>
                                  updateScenePresentation(
                                    presentationMenu.sourceNodeId,
                                    (item) => ({
                                      ...item,
                                      [phase]: {
                                        ...item[phase],
                                        duration,
                                      },
                                    }),
                                    phase,
                                  )
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
            </div>
          </div>,
          document.body,
        )}

      <button
        onClick={handleGenerateImage}
        disabled={isGeneratingImage}
        className="absolute z-50 p-1.5 bg-[var(--card-bg)]/80 backdrop-blur-md text-blue-500 hover:bg-blue-500 hover:text-white border border-[var(--card-border)] rounded-md transition-all opacity-0 group-hover:opacity-100 disabled:opacity-100 shadow-lg bottom-2 right-11"
        title={lang === 'zh' ? '生成图片' : 'Generate Image'}
      >
        {isGeneratingImage ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ImageIcon className="w-4 h-4" />
        )}
      </button>

      {/* TOP */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className={`${handleClasses} -top-1.5`}
      />
      <button
        onClick={() => data.onAddNode?.(id, 'top')}
        className={`${addBtnClasses} -top-8 left-1/2 -translate-x-1/2`}
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* RIGHT */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`${handleClasses} -right-1.5`}
      />
      <button
        onClick={() => data.onAddNode?.(id, 'right')}
        className={`${addBtnClasses} top-1/2 -right-8 -translate-y-1/2`}
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* BOTTOM */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`${handleClasses} -bottom-1.5`}
      />
      <button
        onClick={() => data.onAddNode?.(id, 'bottom')}
        className={`${addBtnClasses} -bottom-8 left-1/2 -translate-x-1/2`}
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* LEFT */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className={`${handleClasses} -left-1.5`}
      />
      <button
        onClick={() => data.onAddNode?.(id, 'left')}
        className={`${addBtnClasses} top-1/2 -left-8 -translate-y-1/2`}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

export const MemoizedStoryNode = memo(StoryNode);
