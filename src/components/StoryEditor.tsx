import React, { useCallback, useMemo, useState, useRef, lazy, Suspense } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  MarkerType,
  useStore,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import {
  PlayCircle, Square, Diamond, Image as ImageIcon,
  Eye, EyeOff, Upload, Settings, Save, Undo2, Redo2, Layers, BrainCircuit,
  Languages, ChevronLeft, ChevronRight, ChevronDown, Menu, X, PlusCircle, FileArchive, Type,
  Mail, MessageCircle, Copy, Check, FileText, Calculator, Replace, UserCircle2, BookOpen, MapPin, Trash2, Volume2, Film
} from 'lucide-react';
import JSZip from 'jszip';
import { Language, translations } from '../lib/i18n';
import { MemoizedStoryNode } from './StoryNode';
import { MemoizedBackgroundNode } from './BackgroundNode';
import { MemoizedGroupNode } from './GroupNode';
import { MemoizedAINode } from './AINode';
import { MemoizedTextNode } from './TextNode';
import { MemoizedSummaryNode } from './SummaryNode';
import { MemoizedNumberConditionNode } from './NumberConditionNode';
import { MemoizedBatchReplaceNode } from './BatchReplaceNode';
import { MemoizedPlotStructureNode } from './PlotStructureNode';
import { MemoizedCharacterNode } from './CharacterNode';
import { MemoizedSceneNode } from './SceneNode';
import { exportPaths, downloadText, formatCharacterNodeText, formatSceneNodeText } from '../lib/export';
import {
  expandBackgroundToFitNodes,
  formatRegionStoryForPrompt,
  parseGeneratedPlotCards,
} from '../lib/plotStructure';
import type { PlotStructureGenerateParams } from './PlotStructureNode';
import { CustomEdge } from './CustomEdge';
import { saveAutoSave, getAutoSave, clearAutoSave } from '../lib/db';
import { generateSpeechAudio, htmlToSpeechText } from '../lib/tts';

const DEFAULT_IMAGE_API_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_IMAGE_MODEL = 'doubao-seedream-4-5-251128';
const DEFAULT_IMAGE_SIZE = '2K';
const DEFAULT_TTS_API_URL = 'https://api.openai.com/v1/audio/speech';
const DEFAULT_TTS_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_TTS_VOICE = 'alloy';
const SEEDREAM_DIMENSION_SIZE = '2048x2048';
const SEEDREAM_MIN_PIXELS = 3686400;

const normalizeImageModel = (url: string, model: string, apiKey = '') => {
  const rawModel = model.trim();
  const usesArk = /ark\.cn-beijing\.volces\.com/i.test(url.trim());
  const usesArkKey = /^ark-/i.test(apiKey.trim());

  if (!rawModel) return DEFAULT_IMAGE_MODEL;
  if ((usesArk || usesArkKey) && rawModel === 'gpt-image-1') return DEFAULT_IMAGE_MODEL;
  return rawModel;
};

const normalizeImageApiUrl = (url: string, model: string, apiKey = '') => {
  const rawUrl = url.trim();
  const usesSeedream = /doubao|seedream/i.test(model.trim());
  const usesArkKey = /^ark-/i.test(apiKey.trim());

  if (!rawUrl) return DEFAULT_IMAGE_API_URL;
  if ((usesSeedream || usesArkKey) && rawUrl === 'https://api.openai.com/v1/images/generations') return DEFAULT_IMAGE_API_URL;
  if (/ark\.cn-beijing\.volces\.com\/?$/.test(rawUrl)) return `${rawUrl.replace(/\/$/, '')}/api/v3/images/generations`;
  if (/\/api\/v3\/?$/.test(rawUrl)) return `${rawUrl.replace(/\/$/, '')}/images/generations`;
  return rawUrl;
};

const normalizeSeedreamSize = (size: string) => {
  const rawSize = size.trim();
  const sizeAliases: Record<string, string> = {
    '2k': '2K',
    '1:1': SEEDREAM_DIMENSION_SIZE,
    square: SEEDREAM_DIMENSION_SIZE,
  };

  const alias = sizeAliases[rawSize.toLowerCase()];
  if (alias) return alias;

  const match = rawSize.match(/^(\d{3,5})\s*[xX*]\s*(\d{3,5})$/);
  if (!match) return DEFAULT_IMAGE_SIZE;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_IMAGE_SIZE;
  }

  if (width * height >= SEEDREAM_MIN_PIXELS) return `${width}x${height}`;

  const scale = Math.sqrt(SEEDREAM_MIN_PIXELS / (width * height));
  const nextWidth = Math.ceil((width * scale) / 64) * 64;
  const nextHeight = Math.ceil((height * scale) / 64) * 64;
  return `${nextWidth}x${nextHeight}`;
};

type ImageReference = {
  url: string;
  label: string;
};

const getEdgeHandleForNode = (edge: Edge, nodeId: string) => {
  if (edge.source === nodeId) return edge.sourceHandle || '';
  if (edge.target === nodeId) return edge.targetHandle || '';
  return '';
};

const pushUniqueReference = (references: ImageReference[], seen: Set<string>, url: unknown, label: string) => {
  if (typeof url !== 'string') return;
  const trimmed = url.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  references.push({ url: trimmed, label });
};

const collectCharacterImageReferences = (
  node: Node,
  references: ImageReference[],
  seen: Set<string>,
  handleId = '',
  labelPrefix = ''
) => {
  const characterName = ((node.data.characterName as string) || '角色').trim();
  const labelName = labelPrefix ? `${labelPrefix}${characterName}` : characterName;
  const outfits = (node.data.outfits as { id: string; name?: string; imageUrl?: string }[]) || [];
  const outfitId = handleId.match(/^outfit-(?:in|out)-(.+)$/)?.[1];
  const connectedOutfit = outfitId ? outfits.find(outfit => outfit.id === outfitId) : null;

  if (connectedOutfit) {
    pushUniqueReference(references, seen, connectedOutfit.imageUrl, `${labelName} - ${connectedOutfit.name || '服装'}`);
    return;
  }

  pushUniqueReference(references, seen, node.data.avatarUrl, `${labelName} - 头像`);
  outfits.forEach(outfit => {
    pushUniqueReference(references, seen, outfit.imageUrl, `${labelName} - ${outfit.name || '服装'}`);
  });
};

const collectSceneImageReferences = (
  node: Node,
  references: ImageReference[],
  seen: Set<string>,
  handleId = '',
  labelPrefix = ''
) => {
  const sceneName = ((node.data.sceneName as string) || '场景').trim();
  const labelName = labelPrefix ? `${labelPrefix}${sceneName}` : sceneName;
  const images = (node.data.images as { id: string; name?: string; imageUrl?: string }[]) || [];
  const imageId = handleId.match(/^image-(?:in|out)-(.+)$/)?.[1];
  const connectedImage = imageId ? images.find(image => image.id === imageId) : null;

  if (connectedImage) {
    pushUniqueReference(references, seen, connectedImage.imageUrl, `${labelName} - ${connectedImage.name || '场景图'}`);
    return;
  }

  pushUniqueReference(references, seen, node.data.coverImageUrl, `${labelName} - 封面`);
  images.forEach(image => {
    pushUniqueReference(references, seen, image.imageUrl, `${labelName} - ${image.name || '场景图'}`);
  });
};

const getConnectedImageReferences = (allNodes: Node[], allEdges: Edge[], storyNodeId: string) => {
  const references: ImageReference[] = [];
  const seen = new Set<string>();
  const storyNode = allNodes.find(node => node.id === storyNodeId);
  const currentImageUrl = typeof storyNode?.data?.imageUrl === 'string' ? storyNode.data.imageUrl.trim() : '';
  if (currentImageUrl) {
    seen.add(currentImageUrl);
  }
  const connectedEdges = allEdges.filter(edge => edge.source === storyNodeId || edge.target === storyNodeId);
  const connectedNodeIds = new Set<string>();

  connectedEdges.forEach((edge) => {
    const connectedNodeId = edge.source === storyNodeId ? edge.target : edge.source;
    const connectedNode = allNodes.find(n => n.id === connectedNodeId);
    if (!connectedNode) return;
    connectedNodeIds.add(connectedNode.id);

    if (connectedNode.type === 'characterNode') {
      const characterName = ((connectedNode.data.characterName as string) || '角色').trim();
      const outfits = (connectedNode.data.outfits as { id: string; name?: string; imageUrl?: string }[]) || [];
      const handleId = getEdgeHandleForNode(edge, connectedNode.id);
      const outfitId = handleId.match(/^outfit-(?:in|out)-(.+)$/)?.[1];
      const connectedOutfit = outfitId ? outfits.find(outfit => outfit.id === outfitId) : null;

      if (connectedOutfit) {
        pushUniqueReference(references, seen, connectedOutfit.imageUrl, `${characterName} - ${connectedOutfit.name || '服装'}`);
      } else {
        pushUniqueReference(references, seen, connectedNode.data.avatarUrl, `${characterName} - 头像`);
        outfits.forEach(outfit => {
          pushUniqueReference(references, seen, outfit.imageUrl, `${characterName} - ${outfit.name || '服装'}`);
        });
      }
    }

    if (connectedNode.type === 'sceneNode') {
      const sceneName = ((connectedNode.data.sceneName as string) || '场景').trim();
      const images = (connectedNode.data.images as { id: string; name?: string; imageUrl?: string }[]) || [];
      const handleId = getEdgeHandleForNode(edge, connectedNode.id);
      const imageId = handleId.match(/^image-(?:in|out)-(.+)$/)?.[1];
      const connectedImage = imageId ? images.find(image => image.id === imageId) : null;

      if (connectedImage) {
        pushUniqueReference(references, seen, connectedImage.imageUrl, `${sceneName} - ${connectedImage.name || '场景图'}`);
      } else {
        pushUniqueReference(references, seen, connectedNode.data.coverImageUrl, `${sceneName} - 封面`);
        images.forEach(image => {
          pushUniqueReference(references, seen, image.imageUrl, `${sceneName} - ${image.name || '场景图'}`);
        });
      }
    }
  });

  if (references.length > 0) {
    return references.slice(0, 10);
  }

  allNodes.forEach((node) => {
    if (connectedNodeIds.has(node.id) || node.data?.isGlobal === false) return;

    if (node.type === 'characterNode') {
      collectCharacterImageReferences(node, references, seen, '', '全局人物: ');
    }

    if (node.type === 'sceneNode') {
      collectSceneImageReferences(node, references, seen, '', '全局场景: ');
    }
  });

  return references.slice(0, 10);
};

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('Failed to read reference image.'));
  reader.readAsDataURL(blob);
});

const toApiImageReference = async (url: string) => {
  if (/^data:image\//i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^blob:/i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to read local reference image: HTTP ${response.status}`);
    return blobToDataUrl(await response.blob());
  }
  return url;
};

const buildReferencePrompt = (references: ImageReference[]) => {
  if (references.length === 0) return '';

  const labels = references.map((reference, index) => `${index + 1}. ${reference.label}`).join('\n');
  return `\n\n参考图要求：已附加以下人物/场景参考图，请尽量保持人物脸型、发型、服装、色彩特征，以及场景空间布局和氛围一致。不要照搬水印或界面元素。\n${labels}`;
};

const buildImageGenerationRequest = (url: string, model: string, size: string, prompt: string, apiKey = '', referenceImages: string[] = []) => {
  const normalizedModel = normalizeImageModel(url, model, apiKey);
  const normalizedUrl = normalizeImageApiUrl(url, normalizedModel, apiKey);
  const usesSeedream = /doubao|seedream/i.test(normalizedModel) || /ark\.cn-beijing\.volces\.com/i.test(normalizedUrl);
  const localArkProxyUrl = (() => {
    if (typeof window === 'undefined') return '/api/ark-image';
    const origin = window.location.origin;
    const isViteDevOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):3000$/i.test(origin);
    return isViteDevOrigin ? '/api/ark-image' : 'http://127.0.0.1:3000/api/ark-image';
  })();
  const requestUrl = usesSeedream && /ark\.cn-beijing\.volces\.com/i.test(normalizedUrl) && import.meta.env.DEV
    ? localArkProxyUrl
    : normalizedUrl;
  const normalizedSize = usesSeedream ? normalizeSeedreamSize(size) : (size.trim() || '1024x1024');

  if (usesSeedream) {
    return {
      url: requestUrl,
      usesSeedream: true,
      body: {
        model: normalizedModel,
        prompt,
        ...(referenceImages.length > 0 ? { image: referenceImages } : {}),
        sequential_image_generation: 'disabled',
        response_format: 'url',
        size: normalizedSize,
        stream: false,
        watermark: true,
      },
    };
  }

  return {
    url: requestUrl,
    usesSeedream: false,
    body: {
      model: normalizedModel,
      prompt,
      size: normalizedSize,
      n: 1,
    },
  };
};

// 使用懒加载减少首屏体验
const PlayTestModal = lazy(() => import('./PlayTestModal').then(module => ({ default: module.PlayTestModal })));
const ZenEditor = lazy(() => import('./ZenEditor').then(module => ({ default: module.ZenEditor })));
const SettingsModal = lazy(() => import('./SettingsModal').then(module => ({ default: module.SettingsModal })));
const CharacterNode = lazy(() => import('./CharacterNode').then(module => ({ default: module.MemoizedCharacterNode })));
const VideoRenderModal = lazy(() => import('./VideoRenderModal').then(module => ({ default: module.VideoRenderModal })));


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

const isTauriRuntime = () => {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return !!runtimeWindow.__TAURI__ || !!runtimeWindow.__TAURI_INTERNALS__;
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
      id: 'root', title: "开头", text: "从前有座山...", shape: 'rounded-rectangle', color: '#ffffff', isRoot: true
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

function SmartGuides({ hLines, vLines }: { hLines: number[], vLines: number[] }) {
  const transform = useStore((state) => state.transform);
  if (vLines.length === 0 && hLines.length === 0) return null;
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1000 }}>
      {vLines.map((vLine, i) => (
        <line
          key={`v-${i}`}
          x1={vLine * transform[2] + transform[0]}
          y1={0}
          x2={vLine * transform[2] + transform[0]}
          y2="100%"
          stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="5,5"
        />
      ))}
      {hLines.map((hLine, i) => (
        <line
          key={`h-${i}`}
          x1={0}
          y1={hLine * transform[2] + transform[1]}
          x2="100%"
          y2={hLine * transform[2] + transform[1]}
          stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="5,5"
        />
      ))}
    </svg>
  );
}

// NOTE: 几何辅助函数 - 计算凸包 (Convex Hull)
function crossProduct(a: { x: number, y: number }, b: { x: number, y: number }, c: { x: number, y: number }) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * 获取媒体文件的原始尺尺寸 * @param url 媒体 URL (data: blob:)
 * @param type MIME 类型
 */
const getMediaDimensions = (url: string, type: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    if (type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 400, height: 300 });
      img.src = url;
    } else if (type.startsWith('video/')) {
      const video = document.createElement('video');
      video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => resolve({ width: 400, height: 300 });
      video.src = url;
    } else {
      resolve({ width: 400, height: 200 }); // 音频或其他
    }
  });
};

function getConvexHull(points: { x: number, y: number }[]) {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
  const upper = [];
  for (const p of sorted) {
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const lower = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  upper.pop();
  lower.pop();
  return upper.concat(lower);
}

export interface AIPromptsConfig {
  basePrompt: string;
  continue: string;
  creative: string;
  rewrite: string;
  interpolate: string;
  sceneOnly: string;
  dialogueOnly: string;
  analyzeStructure: string;
  analyzeSuggestions: string;
  analyzeDirection: string;
  analyzeSolution: string;
  analyzeSummary: string;
}

// NOTE: 用户可在设置中控制 AI 续写弹窗中各按钮的显隐
export interface AIButtonsConfig {
  continue: boolean;
  creative: boolean;
  rewrite: boolean;
  interpolate: boolean;
  scene_only: boolean;
  dialogue_only: boolean;
}

export const defaultAIButtonsConfig: AIButtonsConfig = {
  continue: true,
  creative: true,
  rewrite: true,
  interpolate: true,
  scene_only: true,
  dialogue_only: true,
};

export const defaultAIPrompts: AIPromptsConfig = {
  basePrompt: "你是一位专业的互动剧本创作者，正在协助创作一部视觉小说。\n\n前文语境：\n{{contextText}}\n\n当前片段：\n{{currentText}}\n\n",
  continue: "请根据前文，自然地续写当前片段，{{generateLength}}。只返回续写内容，不要包含多余说明。",
  creative: "请根据前文，提供一种与原文风格不同的创意方向续写，{{generateLength}}。只返回续写内容，不要包含多余说明。",
  rewrite: "请对当前片段进行改写，保留核心含义但优化文笔与节奏，{{generateLength}}。只返回改写内容，不要包含多余说明。",
  interpolate: "你是一位专业的互动剧本创作者。正在协助补充剧情片段。\n\n前文：\n{{contextText}}\n\n后文：\n{{nextText}}\n\n当前正在补充的片段（可选参考）：\n{{currentText}}\n\n请在前后文之间补充一段承上启下的剧情，{{generateLength}}。只返回补充内容，不要包含多余说明。",
  sceneOnly: "请根据前文，只增加场景和环境的描写，不要包含任何人物对话，{{generateLength}}。只返回扩写后的内容，不要包含多余说明。",
  dialogueOnly: "请根据前文，只增加人物之间的对话，不要包含场景和动作描写，{{generateLength}}。只返回扩写后的内容，不要包含多余说明。",
  analyzeStructure: "你是一位剧本结构分析师。请分析以下剧本片段的剧情结构，并用 \"卡片A -> 卡片B -> 卡片C\" 的箭头形式清晰地展示剧情推进过程。指出其中的节奏起伏和转折点。\n\n剧本内容：\n{{combinedText}}",
  analyzeSuggestions: "你是一位创意策划。请根据以下剧本片段，提供至少3个后续剧情发展的构思建议，要求具有戏剧冲突和意想不到的转折。\n\n剧本内容：\n{{combinedText}}",
  analyzeDirection: "你是一位文学导师。请分析以下剧本片段的风格和基调，并为下文的写作提供明确的方向指导（包括遣词造句、氛围营造和人物动机）。\n\n剧本内容：\n{{combinedText}}",
  analyzeSolution: "你是一位专业的剧本顾问。以下是剧本片段：\n{{combinedText}}\n\n刚才的分析结果指出了如下问题或要点：\n{{previousResult}}\n\n请针对上述分析指出的问题或要点，提供具体的、可操作的剧本修改方案和对应的解法。直接返回解法建议，不要重复已有内容。",
  analyzeSummary: "你是一位资深的剧本编辑和逻辑分析师。以下是剧本中的多个片段，请对它们进行汇总分析，指出其中的逻辑漏洞、文笔风格的连贯性，并给出后续剧情发展的建议。\n\n剧本片段：\n{{combinedText}}\n\n请直接返回分析报告，不要包含多余说明。"
};

export function StoryEditor() {
  const nodeTypesMemo = useMemo(() => nodeTypes, []);
  const edgeTypesMemo = useMemo(() => edgeTypes, []);

  const [nodes, setNodes] = useNodesState(INITIAL_NODES);
  const [edges, setEdges] = useEdgesState([]);
  const [showPlayTest, setShowPlayTest] = useState(false);
  const [showVideoRender, setShowVideoRender] = useState(false);
  const [canvasBg, setCanvasBg] = useState<string>('#F9FAFB');
  // false = default loose connection mode, true = we can enforce something else if we want, but ReactFlow naturally uses Select on drag.
  const [interactionMode, setInteractionMode] = useState<'select' | 'box'>('select');
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
  const [showControls, setShowControls] = useState(true);
  const [highlightedPath, setHighlightedPath] = useState<{ nodes: Set<string>, edges: Set<string> } | null>(null);

  const [pasteAsPlainText, setPasteAsPlainText] = useState(false);
  const [showNodeActions, setShowNodeActions] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [presetColors, setPresetColors] = useState<string[]>(['#F9FAFB', '#0f1f39', '#fef3c7']);
  const [showGuide, setShowGuide] = useState(false);
  const [dontShowGuideAgain, setDontShowGuideAgain] = useState(false);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [saveFileName, setSaveFileName] = useState('story-project');
  const [language, setLanguage] = useState<Language>('zh');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toolbarLayout, setToolbarLayout] = useState<'vertical' | 'horizontal' | 'topbar'>('vertical');
  const [selectionMenuLayout, setSelectionMenuLayout] = useState<'horizontal' | 'vertical'>('horizontal');

  const [playTestDarkMode, setPlayTestDarkMode] = useState(() => {
    const saved = localStorage.getItem('playtest-dark-mode');
    return saved === 'true';
  });
  const [playTestChoicesColumns, setPlayTestChoicesColumns] = useState<number>(() => {
    const saved = localStorage.getItem('playtest-columns');
    return saved ? parseInt(saved) : 1;
  });
  const [playTestVideoAutoPlay, setPlayTestVideoAutoPlay] = useState(() => {
    const saved = localStorage.getItem('playtest-video-autoplay');
    return saved === null ? true : saved === 'true';
  });
  const [playTestLayoutMode, setPlayTestLayoutMode] = useState<'classic' | 'immersive'>(() => {
    const saved = localStorage.getItem('playtest-layout-mode');
    return (saved === 'classic' || saved === 'immersive') ? saved : 'classic';
  });

  const [playTestInteractionMode, setPlayTestInteractionMode] = useState<string>(() => {
    const saved = localStorage.getItem('playtest-interaction-mode');
    return saved || 'immediate';
  });
  const [playTestTypewriterSpeed, setPlayTestTypewriterSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('playtest-typewriter-speed');
    return saved ? parseInt(saved) : 30;
  });
  const [playTestChoiceDelay, setPlayTestChoiceDelay] = useState<number>(() => {
    const saved = localStorage.getItem('playtest-choice-delay');
    return saved ? parseInt(saved) : 2;
  });
  const [playTestChoicesPosition, setPlayTestChoicesPosition] = useState<'center' | 'aboveText' | 'belowText'>(() => {
    const saved = localStorage.getItem('playtest-choices-position');
    return (saved as 'center' | 'aboveText' | 'belowText') || 'belowText';
  });
  const [playTestBlurBackground, setPlayTestBlurBackground] = useState<boolean>(() => {
    const saved = localStorage.getItem('playtest-blur-background');
    return saved === null ? true : saved === 'true';
  });
  const [playTestBlurText, setPlayTestBlurText] = useState<boolean>(() => {
    const saved = localStorage.getItem('playtest-blur-text');
    return saved === 'true';
  });
  const [playTestSkipSingleChoicePopup, setPlayTestSkipSingleChoicePopup] = useState<boolean>(() => {
    const saved = localStorage.getItem('playtest-skip-single-choice-popup');
    return saved === null ? true : saved === 'true';
  });
  const [playTestDimBackground, setPlayTestDimBackground] = useState<boolean>(() => {
    const saved = localStorage.getItem('playtest-dim-background');
    return saved === null ? true : saved === 'true';
  });

  const t = translations[language];
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedSnapshot = useRef<string>('');

  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [rightToolbarCollapsed, setRightToolbarCollapsed] = useState(false);

  // Auto-save states
  const [showAutoSaveModal, setShowAutoSaveModal] = useState(false);
  const autoSaveDataRef = useRef<{ snapshot: string, timestamp: number } | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();

  const isMobile = flowWidth < 768;

  const [qqCopied, setQqCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [isRightDragging, setIsRightDragging] = useState(false);
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow();
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  // NOTE: canvas 容器的 ref，用于挂载原生 drag-drop 监听器，绕过 React Flow 的内部事件拦截
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<{ x: number, y: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  // NOTE: 用 useCallback 包裹以保持稳定引用，避免依赖此函数的 useCallback 在每次渲染时重建
  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
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
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
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
  const [nodeClipboard, setNodeClipboard] = useState<{ nodes: Node[], edges: Edge[] } | null>(null);

  // NOTE: 选中的节点及框选菜单
  // 菜单使用 fixed 层渲染，并根据 ReactFlow 视口 transform + 画布容器 rect 计算屏幕坐标。
  // 这样无论右键框选后拖动画布、滚轮平移/缩放、MiniMap/Controls 改变视野，菜单都会跟着所选节点走。
  const selectedNodes = useMemo(() => nodes.filter(n => n.selected), [nodes]);
  const showSelectionMenu = selectedNodes.length >= 2;
  const canRenderVideo = useMemo(() => isTauriRuntime(), []);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const selectionBoundsRef = useRef<{ minX: number; minY: number; maxX: number } | null>(null);
  const selectionMenuRafRef = useRef<number | null>(null);
  const transformRef = useRef<[number, number, number]>([tx, ty, tzoom]);
  transformRef.current = [tx, ty, tzoom];

  const computeSelectionBounds = useCallback((nodesToMeasure: Node[]) => {
    if (nodesToMeasure.length < 2) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity;
    nodesToMeasure.forEach(n => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + (n.measured?.width || (n.style?.width as number) || 300));
    });
    return { minX, minY, maxX };
  }, []);

  const updateSelectionMenuPosition = useCallback((transform?: [number, number, number]) => {
    const el = selectionMenuRef.current;
    const bounds = selectionBoundsRef.current;
    const wrapper = canvasWrapperRef.current;
    if (!el || !bounds || !wrapper) return;

    const [tX, tY, zoom] = transform ?? transformRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const centerX = bounds.minX + (bounds.maxX - bounds.minX) / 2;

    // ReactFlow 的 transform 是相对画布容器的，所以这里必须加上 wrapperRect。
    // 菜单自身使用 translate(-50%, -100%)，保证水平居中并停在选区上方。
    const screenX = wrapperRect.left + centerX * zoom + tX;
    const screenY = wrapperRect.top + bounds.minY * zoom + tY - 12;

    el.style.setProperty('--selection-menu-x', `${screenX}px`);
    el.style.setProperty('--selection-menu-y', `${screenY}px`);
  }, []);

  const scheduleSelectionMenuPosition = useCallback((transform?: [number, number, number]) => {
    if (selectionMenuRafRef.current !== null) {
      cancelAnimationFrame(selectionMenuRafRef.current);
    }
    selectionMenuRafRef.current = requestAnimationFrame(() => {
      selectionMenuRafRef.current = null;
      updateSelectionMenuPosition(transform);
    });
  }, [updateSelectionMenuPosition]);

  React.useLayoutEffect(() => {
    selectionBoundsRef.current = computeSelectionBounds(selectedNodes);
    if (showSelectionMenu) {
      scheduleSelectionMenuPosition();
    }
  }, [selectedNodes, showSelectionMenu, computeSelectionBounds, scheduleSelectionMenuPosition]);

  React.useEffect(() => {
    if (showSelectionMenu) {
      scheduleSelectionMenuPosition([tx, ty, tzoom]);
    }
  }, [tx, ty, tzoom, showSelectionMenu, scheduleSelectionMenuPosition]);

  React.useEffect(() => {
    if (!showSelectionMenu) return;
    const handleResize = () => scheduleSelectionMenuPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showSelectionMenu, scheduleSelectionMenuPosition]);

  React.useEffect(() => {
    return () => {
      if (selectionMenuRafRef.current !== null) {
        cancelAnimationFrame(selectionMenuRafRef.current);
      }
    };
  }, []);

  const handleViewportMove = useCallback((_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
    if (selectionBoundsRef.current) {
      scheduleSelectionMenuPosition([viewport.x, viewport.y, viewport.zoom]);
    }
  }, [scheduleSelectionMenuPosition]);

  const getProjectSnapshot = useCallback(() => {
    const simpleNodes = nodes.map(n => ({
      id: n.id,
      position: n.position,
      type: n.type,
      style: n.style,
      data: { ...n.data },
      width: n.measured?.width || n.width,
      height: n.measured?.height || n.height
    }));
    const simpleEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      data: { label: e.data?.label || '' }
    }));
    const settings = {
      canvasBg,
      edgeStyle,
      customApiKey,
      pasteAsPlainText,
      showNodeActions,
      showStats,
      presetColors,
      showTitles,
      generateLength,
      // NOTE: AI 接口配置一并导出，方便跨设备迁移
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
      thinkingMode,
      aiPrompts,
      aiButtonsConfig,
      scrollMode,
      showMiniMap,
      showControls,

      toolbarLayout,
      selectionMenuLayout,
      language,
      theme,
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
    };
    return JSON.stringify({ nodes: simpleNodes, edges: simpleEdges, settings });
  }, [nodes, edges, canvasBg, edgeStyle, customApiKey, pasteAsPlainText, showNodeActions, showStats, presetColors, showTitles, generateLength, aiProvider, deepseekApiKey, openaiApiKey, imageApiKey, imageApiUrl, imageModel, imageSize, ttsApiKey, ttsApiUrl, ttsModel, ttsVoice, thinkingMode, aiPrompts, aiButtonsConfig, scrollMode, showMiniMap, showControls, toolbarLayout, selectionMenuLayout, language, theme, playTestDarkMode, playTestChoicesColumns, playTestVideoAutoPlay, playTestLayoutMode, playTestInteractionMode, playTestTypewriterSpeed, playTestChoiceDelay, playTestChoicesPosition, playTestBlurBackground, playTestBlurText, playTestSkipSingleChoicePopup, playTestDimBackground]);

  // NOTE: 当全局标题显示状态切换时，自动调整带有媒体的卡片高度
  React.useEffect(() => {
    setNodes(nds => nds.map(node => {
      if (node.type !== 'storyNode') return node;
      const hasMedia = !!(node.data.imageUrl || node.data.videoUrl || node.data.audioUrl);
      if (!hasMedia) return node;

      const currentHeight = (node.style?.height as number) || 200;
      const titleAlreadyAdded = node.data.titleHeightAdded === true;

      if (showTitles && !titleAlreadyAdded) {
        return {
          ...node,
          style: { ...node.style, height: currentHeight + TITLE_HEIGHT },
          data: { ...node.data, titleHeightAdded: true }
        };
      } else if (!showTitles && titleAlreadyAdded) {
        return {
          ...node,
          style: { ...node.style, height: Math.max(50, currentHeight - TITLE_HEIGHT) },
          data: { ...node.data, titleHeightAdded: false }
        };
      }
      return node;
    }));
  }, [showTitles, setNodes]);

  const [history, setHistory] = useState<{ past: { nodes: Node[], edges: Edge[] }[], future: { nodes: Node[], edges: Edge[] }[] }>({ past: [], future: [] });
  const lastHistoryState = useRef({ nodes: INITIAL_NODES, edges: [] as Edge[] });
  const isUndoRedoAction = useRef(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Cookie helpers
  const setCookie = (name: string, value: string, days: number) => {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "; expires=" + date.toUTCString();
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  };

  const getCookie = (name: string) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  };

  // Initialize snapshot and guide preference
  React.useEffect(() => {
    // 启动时检查是否有自动保存的数据
    getAutoSave().then(data => {
      if (data) {
        autoSaveDataRef.current = data;
        setShowAutoSaveModal(true);
      }
    });

    lastSavedSnapshot.current = getProjectSnapshot();

    // Check guide preference from Cookie
    const skipGuide = getCookie('skip_novice_guide') === 'true';
    if (!skipGuide) {
      setShowGuide(true);
    }

    // Load theme from localStorage or system preference
    const savedTheme = localStorage.getItem('app-theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  // Synchronize playtest settings to localStorage
  React.useEffect(() => {
    localStorage.setItem('playtest-dark-mode', String(playTestDarkMode));
  }, [playTestDarkMode]);

  React.useEffect(() => {
    localStorage.setItem('playtest-columns', String(playTestChoicesColumns));
  }, [playTestChoicesColumns]);

  React.useEffect(() => {
    localStorage.setItem('playtest-video-autoplay', String(playTestVideoAutoPlay));
  }, [playTestVideoAutoPlay]);

  React.useEffect(() => {
    localStorage.setItem('playtest-layout-mode', playTestLayoutMode);
  }, [playTestLayoutMode]);



  React.useEffect(() => {
    localStorage.setItem('playtest-interaction-mode', playTestInteractionMode);
  }, [playTestInteractionMode]);

  React.useEffect(() => {
    localStorage.setItem('playtest-typewriter-speed', String(playTestTypewriterSpeed));
  }, [playTestTypewriterSpeed]);

  React.useEffect(() => {
    localStorage.setItem('playtest-choice-delay', String(playTestChoiceDelay));
  }, [playTestChoiceDelay]);

  React.useEffect(() => {
    localStorage.setItem('playtest-choices-position', playTestChoicesPosition);
  }, [playTestChoicesPosition]);

  React.useEffect(() => {
    localStorage.setItem('playtest-blur-background', String(playTestBlurBackground));
  }, [playTestBlurBackground]);

  React.useEffect(() => {
    localStorage.setItem('playtest-blur-text', String(playTestBlurText));
  }, [playTestBlurText]);

  React.useEffect(() => {
    localStorage.setItem('playtest-skip-single-choice-popup', String(playTestSkipSingleChoicePopup));
  }, [playTestSkipSingleChoicePopup]);

  React.useEffect(() => {
    localStorage.setItem('playtest-dim-background', String(playTestDimBackground));
  }, [playTestDimBackground]);

  // Update document theme attribute
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const closeGuide = () => {
    if (dontShowGuideAgain) {
      setCookie('skip_novice_guide', 'true', 365);
    }
    setShowGuide(false);
  };

  // Track isDirty and trigger Auto-save
  React.useEffect(() => {
    const currentSnapshot = getProjectSnapshot();
    const isNowDirty = currentSnapshot !== lastSavedSnapshot.current;
    setIsDirty(isNowDirty);

    if (isNowDirty) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        await saveAutoSave(currentSnapshot);
      }, 5000);
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [getProjectSnapshot]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Deep equal check for history
      if (JSON.stringify(lastHistoryState.current) !== JSON.stringify({ nodes, edges })) {
        setHistory(h => ({
          past: [...h.past, lastHistoryState.current].slice(-50),
          future: []
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

  // NOTE: 全局阻止拖拽文件时的浏览器默认行为（防止意外打开文件）
  // HACK: canvas 区域内的 drop 由原生捕获阶段监听器处理，此处需放行以避免干扰
  React.useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      // 如果目标在 react-flow 容器内，放行给 canvas 的捕获阶段处理器
      if ((e.target as HTMLElement)?.closest('.react-flow')) return;
      e.preventDefault();
    };
    const handleGlobalDrop = (e: DragEvent) => {
      if ((e.target as HTMLElement)?.closest('.react-flow')) return;
      e.preventDefault();
    };
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  // NOTE: 使用原生 DOM 捕获阶段监听器处理文件从桌面/文件夹拖入画布
  // 必须在捕获阶段注册，才能在 React Flow 内部的 dragover 拦截之前先行处理，
  // 确保浏览器的 dropEffect 被正确设置为 'copy'，从而允许 drop 事件触发。
  React.useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;

    const handleNativeDragOver = (e: DragEvent) => {
      // 只有从 OS 拖入文件时才拦截（包含 Files 类型）
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const handleNativeDrop = async (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      // 计算落点在 Flow 坐标系中的位置
      const rfEl = el.querySelector('.react-flow__renderer') ?? el;
      const bounds = rfEl.getBoundingClientRect();
      const dropX = (e.clientX - bounds.left - tx) / tzoom;
      const dropY = (e.clientY - bounds.top - ty) / tzoom;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
          continue;
        }

        // 使用 blob URL，高效且支持大文件/视频
        const url = URL.createObjectURL(file);
        const newId = uuidv4();

        let mediaData: Record<string, string> = {};
        let title = language === 'zh' ? '导入文件' : 'Import File';

        const { width, height } = await getMediaDimensions(url, file.type);
        let displayWidth = 400;
        let displayHeight = (height / width) * displayWidth;

        if (displayHeight > 500) {
          displayHeight = 500;
          displayWidth = (width / height) * displayHeight;
        }

        if (file.type.startsWith('image/')) {
          mediaData = { imageUrl: url };
          title = language === 'zh' ? '导入图片' : 'Import Image';
        } else if (file.type.startsWith('video/')) {
          mediaData = { videoUrl: url };
          title = language === 'zh' ? '导入视频' : 'Import Video';
        } else if (file.type.startsWith('audio/')) {
          mediaData = { audioUrl: url };
          title = language === 'zh' ? '导入音频' : 'Import Audio';
          displayWidth = 300;
          displayHeight = 150;
        }

        const newNode: Node = {
          id: newId,
          type: 'storyNode',
          position: {
            x: dropX + (i * 30) - (displayWidth / 2),
            y: dropY + (i * 30) - (displayHeight / 2),
          },
          style: { width: displayWidth, height: displayHeight + (showTitles ? TITLE_HEIGHT : 0) },
          data: {
            id: newId,
            title,
            shape: 'square',
            color: '#ffffff',
            text: '',
            titleHeightAdded: showTitles,
            ...mediaData,
          },
        };

        setNodes((nds) => [...nds, newNode]);
      }
    };

    // 注册为捕获阶段，优先于 React Flow 内部事件处理
    el.addEventListener('dragover', handleNativeDragOver, { capture: true });
    el.addEventListener('drop', handleNativeDrop, { capture: true });

    return () => {
      el.removeEventListener('dragover', handleNativeDragOver, { capture: true });
      el.removeEventListener('drop', handleNativeDrop, { capture: true });
    };
  }, [tx, ty, tzoom, setNodes, showTitles, language]);

  // NOTE: 全局阻止编辑器区域的右键菜单，确保框选体验不被系统菜单干扰
  React.useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 如果点击React Flow 容器或其子元素内，则阻止默认菜单
      if (target.closest('.react-flow')) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => document.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, []);

  // NOTE: 动态分组实时更新逻辑
  React.useEffect(() => {
    const groupNodes = nodes.filter(n => n.type === 'groupNode');
    if (groupNodes.length === 0) return;

    const timer = setTimeout(() => {
      let hasChanges = false;
      const newNodes = nodes.map(gn => {
        if (gn.type !== 'groupNode') return gn;

        const childIds = (gn.data.childIds as string[]) || [];
        if (childIds.length === 0) return gn;

        const children = nodes.filter(n => childIds.includes(n.id));
        if (children.length === 0) return gn;

        // 1. 收集所有子节点的四个角点  
        const points: { x: number, y: number }[] = [];
        const padding = 20;

        children.forEach(c => {
          const { x, y } = c.position;
          const w = c.measured?.width || (typeof c.style?.width === 'number' ? c.style.width : 300);
          const h = c.measured?.height || (typeof c.style?.height === 'number' ? c.style.height : 200);

          points.push({ x: x - padding, y: y - padding });
          points.push({ x: x + w + padding, y: y - padding });
          points.push({ x: x + w + padding, y: y + h + padding });
          points.push({ x: x - padding, y: y + h + padding });
        });

        // 2. 计算凸包
        const hull = getConvexHull(points);

        // 3. 计算凸包的包围盒作为 Node 的基本尺寸
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        hull.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });

        // 增加取整处理，防止亚像素导致的无限循环
        const targetX = Math.round(minX * 10) / 10;
        const targetY = Math.round(minY * 10) / 10;
        const targetW = Math.round((maxX - minX) * 10) / 10;
        const targetH = Math.round((maxY - minY) * 10) / 10;

        const relativeHull = hull.map(p => ({
          x: Math.round((p.x - targetX) * 10) / 10,
          y: Math.round((p.y - targetY) * 10) / 10
        }));

        // 检查是否有实质性变化    
        const diffX = Math.abs(gn.position.x - targetX);
        const diffY = Math.abs(gn.position.y - targetY);
        const diffW = Math.abs((gn.style?.width as number || 0) - targetW);
        const diffH = Math.abs((gn.style?.height as number || 0) - targetH);

        let isHullDifferent = false;
        const oldHull = gn.data.hullPoints as { x: number, y: number }[] || [];
        if (oldHull.length !== relativeHull.length) {
          isHullDifferent = true;
        } else {
          for (let i = 0; i < oldHull.length; i++) {
            if (Math.abs(oldHull[i].x - relativeHull[i].x) > 2 || Math.abs(oldHull[i].y - relativeHull[i].y) > 2) {
              isHullDifferent = true;
              break;
            }
          }
        }

        // 将阈值提高到 2px，并使用宽容度的凸包比对，彻底切断可能导致的无限重绘循环
        if (diffX >= 2 || diffY >= 2 || diffW >= 2 || diffH >= 2 || isHullDifferent) {
          hasChanges = true;
          return {
            ...gn,
            position: { x: targetX, y: targetY },
            style: { ...gn.style, width: targetW, height: targetH },
            data: { ...gn.data, hullPoints: relativeHull }
          };
        }
        return gn;
      });

      if (hasChanges) {
        setNodes(newNodes);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [nodes, setNodes]);


  const undo = useCallback(() => {
    setHistory(h => {
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
    setHistory(h => {
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

  const handleCopy = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) return;

    // 找出选中节点之间的连线    
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const selectedEdges = edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));

    setNodeClipboard({ nodes: selectedNodes, edges: selectedEdges });
    showToast(language === 'zh' ? `已复制${selectedNodes.length} 个节点` : `${selectedNodes.length} nodes copied`);
  }, [nodes, edges, language]);

  const handlePaste = useCallback(async () => {
    // 1. 优先尝试粘贴内部剪贴板中的卡片    
    if (nodeClipboard && nodeClipboard.nodes.length > 0) {
      const idMap: Record<string, string> = {};
      const center = getCenterPosition();

      // 计算选中节点组的中心点    
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodeClipboard.nodes.forEach(n => {
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + (n.measured?.width || 300));
        maxY = Math.max(maxY, n.position.y + (n.measured?.height || 200));
      });
      const groupCenterX = (minX + maxX) / 2;
      const groupCenterY = (minY + maxY) / 2;

      // 计算偏移量，将组中心对齐到当前视口中间    
      const offsetX = center.x - groupCenterX;
      const offsetY = center.y - groupCenterY;

      const newNodes = nodeClipboard.nodes.map(n => {
        const newId = uuidv4();
        idMap[n.id] = newId;
        return {
          ...n,
          id: newId,
          position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
          selected: true,
          data: {
            ...n.data,
            id: newId,
            isRoot: false // 粘贴后的卡片自动消除起点标记
          }
        };
      });

      const newEdges = nodeClipboard.edges.map(e => ({
        ...e,
        id: uuidv4(),
        source: idMap[e.source],
        target: idMap[e.target]
      }));

      setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), ...newNodes]);
      setEdges(eds => [...eds, ...newEdges]);
      return;
    }

    // 2. 内部剪贴板为空，尝试从系统剪贴板读取文本创建新卡片  
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
        showToast(language === 'zh' ? '当前环境不支持直接读取剪贴板，请使用快捷键 Ctrl+V' : 'Clipboard reading is not supported, please use Ctrl+V');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const center = getCenterPosition();
        const newId = uuidv4();
        const newNode: Node = {
          id: newId,
          type: 'storyNode',
          position: { x: center.x - 150, y: center.y - 100 },
          style: { width: 300, height: 200 },
          data: {
            id: newId,
            title: "粘贴卡片",
            shape: 'square',
            color: '#ffffff',
            text: text.trim()
          },
        };
        setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), newNode]);
      }
    } catch (err) {
      console.warn("Failed to read system clipboard", err);
    }
  }, [nodeClipboard, getCenterPosition, setNodes, setEdges]);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  /**
   * 删除当前所有选中的节点和连线   */
  const deleteSelected = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    const selectedEdges = edges.filter(e => e.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    // 过滤掉受保护的节点（如起点）
    const nodeIdsToDelete = new Set(
      selectedNodes
        .filter(n => !n.data?.isRoot)
        .map(n => n.id)
    );

    const edgeIdsToDelete = new Set(selectedEdges.map(e => e.id));

    if (nodeIdsToDelete.size === 0 && edgeIdsToDelete.size === 0) {
      if (selectedNodes.length > 0) {
        showToast(language === 'zh' ? '起点节点受保护，无法删除' : 'Root node is protected and cannot be deleted');
      }
      return;
    }

    setNodes((nds) => nds.filter((n) => !nodeIdsToDelete.has(n.id)));
    setEdges((eds) => eds.filter((e) =>
      !edgeIdsToDelete.has(e.id) &&
      !nodeIdsToDelete.has(e.source) &&
      !nodeIdsToDelete.has(e.target)
    ));

    const totalDeleted = nodeIdsToDelete.size + edgeIdsToDelete.size;
    showToast(language === 'zh' ? `已删除${totalDeleted} 个项目` : `Deleted ${totalDeleted} items`);
  }, [nodes, edges, language, setNodes, setEdges]);

  /**
   * 隐藏当前所有选中的节点
   */
  const hideSelected = useCallback(() => {
    const selectedNodeIds = nodes
      .filter(n => n.selected)
      .map(n => n.id);

    if (selectedNodeIds.length === 0) return;

    const selectedIdSet = new Set(selectedNodeIds);

    setNodes(nds => nds.map(n => {
      if (!selectedIdSet.has(n.id)) return n;

      return {
        ...n,
        selected: false,
        data: {
          ...n.data,
          hidden: true,
        },
      };
    }));

    showToast(language === 'zh' ? `已隐藏${selectedNodeIds.length} 个卡片` : `${selectedNodeIds.length} cards hidden`);
  }, [nodes, setNodes, language, showToast]);

  const handleGenerateSelectedSpeech = useCallback(async () => {
    if (ttsLoading) return;
    const storyNodes = nodes
      .filter(n => n.selected && n.type === 'storyNode')
      .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));

    if (storyNodes.length === 0) {
      showToast(language === 'zh' ? '请先框选需要朗读的剧情卡片' : 'Select story cards to narrate first');
      return;
    }

    setTtsLoading(true);
    try {
      for (let index = 0; index < storyNodes.length; index += 1) {
        const node = storyNodes[index];
        const titleText = htmlToSpeechText(String(node.data.title || ''));
        const bodyText = htmlToSpeechText(String(node.data.text || ''));
        const speechText = [titleText, bodyText].filter(Boolean).join('\n\n').trim();
        if (!speechText) continue;

        showToast(language === 'zh'
          ? `正在生成朗读音频 ${index + 1}/${storyNodes.length}`
          : `Generating narration ${index + 1}/${storyNodes.length}`);

        const audio = await generateSpeechAudio(speechText, {
          apiUrl: ttsApiUrl,
          apiKey: ttsApiKey,
          model: ttsModel,
          voice: ttsVoice,
        });

        setNodes(nds => nds.map(n => n.id === node.id ? {
          ...n,
          data: {
            ...n.data,
            audioUrl: audio.url,
            ttsGenerated: true,
          },
        } : n));
      }

      showToast(language === 'zh' ? '朗读音频已生成并关联到卡片' : 'Narration audio generated and attached');
    } catch (error: any) {
      console.error('TTS generation failed:', error);
      alert(`${language === 'zh' ? '朗读音频生成失败' : 'Narration generation failed'}: ${error.message || 'Unknown error'}`);
    } finally {
      setTtsLoading(false);
    }
  }, [nodes, language, setNodes, showToast, ttsApiKey, ttsApiUrl, ttsModel, ttsVoice, ttsLoading]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
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


  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const snapDistance = 15;

    const positionChanges = changes.filter((c: any) => c.type === 'position' && c.position);
    const dimensionChanges = changes.filter((c: any) => c.type === 'dimensions' && c.dimensions);

    // NOTE: 无位置/尺寸变化时直接应用，不触发辅助线计算，避免多余 setState
    if (positionChanges.length === 0 && dimensionChanges.length === 0) {
      setNodes((nds) => applyNodeChanges(changes, nds));
      return;
    }

    // NOTE: 使用函数式 setNodes 读取最新节点，消除对外部 nodes 变量的直接依赖，
    // 从而打断 nodes→onNodesChange→nodesWithCallbacks→ReactFlow store→onNodesChange 的循环链路
    setNodes((nds) => {
      const hLines: number[] = [];
      const vLines: number[] = [];
      const nodeMap = new Map(nds.map(n => [n.id, n]));

      const updatedChanges = changes.map((change: any) => {
        if (change.type === 'position' && change.position) {
          const targetX = change.position.x;
          const targetY = change.position.y;
          let snapX = targetX;
          let snapY = targetY;
          let minDx = snapDistance;
          let minDy = snapDistance;

          const movingNode = nodeMap.get(change.id);
          if (!movingNode) return change;

          const movingW = movingNode.measured?.width || (movingNode.style?.width as number) || 300;
          const movingH = movingNode.measured?.height || (movingNode.style?.height as number) || 200;

          for (const n of nds) {
            if (n.id === change.id) continue;
            const nX = n.position.x;
            const nY = n.position.y;
            const nW = n.measured?.width || (n.style?.width as number) || 300;
            const nH = n.measured?.height || (n.style?.height as number) || 200;

            const xTargets = [nX, nX + nW];
            const movingXTargets = [targetX, targetX + movingW];
            for (const xt of xTargets) {
              for (const mxt of movingXTargets) {
                const diff = Math.abs(xt - mxt);
                if (diff < minDx) {
                  minDx = diff;
                  snapX = (mxt === targetX) ? xt : xt - movingW;
                  if (!vLines.includes(xt)) vLines.push(xt);
                } else if (diff < snapDistance) {
                  if (!vLines.includes(xt)) vLines.push(xt);
                }
              }
            }

            const yTargets = [nY, nY + nH];
            const movingYTargets = [targetY, targetY + movingH];
            for (const yt of yTargets) {
              for (const myt of movingYTargets) {
                const diff = Math.abs(yt - myt);
                if (diff < minDy) {
                  minDy = diff;
                  snapY = (myt === targetY) ? yt : yt - movingH;
                  if (!hLines.includes(yt)) hLines.push(yt);
                } else if (diff < snapDistance) {
                  if (!hLines.includes(yt)) hLines.push(yt);
                }
              }
            }
          }
          return {
            ...change,
            position: { x: snapX, y: snapY },
            positionAbsolute: change.positionAbsolute ? { x: snapX, y: snapY } : undefined
          };
        } else if (change.type === 'dimensions' && change.dimensions) {
          const targetNode = nodeMap.get(change.id);
          if (targetNode) {
            const x = targetNode.position.x;
            const y = targetNode.position.y;
            const w = change.dimensions.width;
            const h = change.dimensions.height;
            for (const n of nds) {
              if (n.id === change.id) continue;
              const nX = n.position.x;
              const nY = n.position.y;
              const nW = n.measured?.width || (n.style?.width as number) || 300;
              const nH = n.measured?.height || (n.style?.height as number) || 200;
              if (Math.abs(nX - x) < snapDistance && !vLines.includes(nX)) vLines.push(nX);
              if (Math.abs(nX + nW - x) < snapDistance && !vLines.includes(nX + nW)) vLines.push(nX + nW);
              if (Math.abs(nX - (x + w)) < snapDistance && !vLines.includes(nX)) vLines.push(nX);
              if (Math.abs(nX + nW - (x + w)) < snapDistance && !vLines.includes(nX + nW)) vLines.push(nX + nW);
              if (Math.abs(nY - y) < snapDistance && !hLines.includes(nY)) hLines.push(nY);
              if (Math.abs(nY + nH - y) < snapDistance && !hLines.includes(nY + nH)) hLines.push(nY + nH);
              if (Math.abs(nY - (y + h)) < snapDistance && !hLines.includes(nY)) hLines.push(nY);
              if (Math.abs(nY + nH - (y + h)) < snapDistance && !hLines.includes(nY + nH)) hLines.push(nY + nH);
            }
          }
        }
        return change;
      });

      const isInteracting = changes.some((c: any) =>
        (c.type === 'position' && c.dragging) ||
        (c.type === 'dimensions' && c.resizing)
      );

      // NOTE: 只在真正有辅助线变化时才更新，避免每次 dimensions 事件都 setState([])
      if (isInteracting) {
        setHorizontalGuides(hLines);
        setVerticalGuides(vLines);
      } else {
        // 只在当前有辅助线时才清空，防止每帧都触发空数组的 setState
        setHorizontalGuides(prev => prev.length > 0 ? [] : prev);
        setVerticalGuides(prev => prev.length > 0 ? [] : prev);
      }

      return applyNodeChanges(updatedChanges, nds);
    });
  }, [setNodes]);


  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, id: uuidv4(), ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setEdges(eds => eds.filter(e => e.id !== edge.id));
  }, [setEdges]);

  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setEdges(eds => eds.map(e => {
      if (e.id === edge.id) {
        return { ...e, source: e.target, target: e.source, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle };
      }
      return e;
    }));
  }, [setEdges]);

  const handleUpdateNode = useCallback((id: string, data: any) => {
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
  }, [setNodes]);

  const handleAddTextToImage = useCallback((id: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          // 如果还没有文本，设置一个初始文本，并强制显示文本区域          
          const currentText = n.data.text as string || '';
          return {
            ...n,
            data: {
              ...n.data,
              text: currentText || (language === 'zh' ? '在此处输入描述文本...' : 'Enter description here...'),
              showTextOverlay: true
            },
            // 增加一点高度给文本区域
            style: { ...n.style, height: ((n.style?.height as number) || 200) + 100 }
          };
        }
        return n;
      })
    );
  }, [setNodes, language]);

  const handleRemoveTextFromImage = useCallback((id: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              showTextOverlay: false
            },
            // 减少高度
            style: { ...n.style, height: Math.max(100, ((n.style?.height as number) || 200) - 100) }
          };
        }
        return n;
      })
    );
  }, [setNodes]);

  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    return (doc.body.textContent || '').trim();
  };

  const requestGeneratedImage = useCallback(async (prompt: string) => {
    if (!imageApiKey.trim()) {
      alert(language === 'zh' ? '请先在设置中填写图片生成 API 密钥。' : 'Configure the image generation API key in Settings first.');
      return null;
    }

    const imageRequest = buildImageGenerationRequest(imageApiUrl, imageModel, imageSize, prompt, imageApiKey);
    const imageRequestBody = JSON.stringify(imageRequest.body);
    const imageRequestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${imageApiKey.trim()}`,
    };
    const sendImageRequest = (url: string) => fetch(url, {
      method: 'POST',
      headers: imageRequestHeaders,
      body: imageRequestBody,
    });

    let response: Response;
    let activeImageRequestUrl = imageRequest.url;
    try {
      response = await sendImageRequest(activeImageRequestUrl);
    } catch (fetchError) {
      const fallbackArkProxyUrl = typeof window !== 'undefined' && /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):3000$/i.test(window.location.origin)
        ? '/api/ark-image'
        : 'http://127.0.0.1:3000/api/ark-image';
      const canRetryArkProxy = imageRequest.usesSeedream && imageRequest.url !== fallbackArkProxyUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http');
      if (!canRetryArkProxy) {
        throw new Error(`${language === 'zh' ? '图片请求无法发送' : 'Image request could not be sent'} (${imageRequest.url}). ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }
      activeImageRequestUrl = fallbackArkProxyUrl;
      response = await sendImageRequest(activeImageRequestUrl);
    }

    if (!response.ok) {
      const errText = await response.text();
      const shouldRetrySeedreamSize =
        imageRequest.usesSeedream &&
        /InvalidParameter|size|pixels/i.test(errText) &&
        imageRequest.body.size !== SEEDREAM_DIMENSION_SIZE;

      if (shouldRetrySeedreamSize) {
        response = await fetch(activeImageRequestUrl, {
          method: 'POST',
          headers: imageRequestHeaders,
          body: JSON.stringify({
            ...imageRequest.body,
            size: SEEDREAM_DIMENSION_SIZE,
          }),
        });

        if (response.ok) {
          setImageSize(SEEDREAM_DIMENSION_SIZE);
        } else {
          const retryErrText = await response.text();
          throw new Error(retryErrText || errText || `HTTP ${response.status}`);
        }
      } else {
        throw new Error(errText || `HTTP ${response.status}`);
      }
    }

    const result = await response.json();
    const imageData = result?.data?.[0];
    const imageSrc = imageData?.b64_json
      ? `data:image/png;base64,${imageData.b64_json}`
      : imageData?.url;

    if (!imageSrc) {
      throw new Error(language === 'zh' ? '图片 API 没有返回可用图片。' : 'Image API returned no usable image.');
    }

    return imageSrc as string;
  }, [imageApiKey, imageApiUrl, imageModel, imageSize, language, setImageSize]);

  const handleGenerateSettingNodeImage = useCallback(async (id: string, type: 'character' | 'scene') => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    try {
      const titleText = type === 'character'
        ? ((node.data.characterName as string) || (language === 'zh' ? '未命名角色' : 'Unnamed Character'))
        : ((node.data.sceneName as string) || (language === 'zh' ? '未命名场景' : 'Unnamed Scene'));
      const bodyText = type === 'character'
        ? formatCharacterNodeText(node.data as Record<string, unknown>)
        : formatSceneNodeText(node.data as Record<string, unknown>);
      const basePrompt = [titleText, bodyText].filter(Boolean).join('\n\n').trim();

      if (!basePrompt) {
        alert(language === 'zh' ? '请先填写人物或场景设定。' : 'Fill in the character or scene setting first.');
        return;
      }

      const prompt = type === 'character'
        ? `Create a polished visual novel character design sheet with three views (front, side, back) in one image. Keep the same character consistent across all views. No text labels, no UI, clean neutral background. Character setting:\n\n${basePrompt}`
        : `Create a polished visual novel scene concept image from this setting. Focus on the environment, spatial layout, mood, props, lighting, and color palette. No text labels, no UI. Scene setting:\n\n${basePrompt}`;

      const imageSrc = await requestGeneratedImage(prompt);
      if (!imageSrc) return;

      setNodes((nds) => nds.map((n) => {
        if (n.id !== id) return n;

        if (type === 'character') {
          const generatedOutfitId = (n.data.generatedSettingImageId as string) || uuidv4();
          const currentOutfits = ((n.data.outfits as any[]) || []);
          const generatedOutfitName = language === 'zh' ? 'AI 三视图' : 'AI Three-view';
          const hasGeneratedOutfit = currentOutfits.some(outfit => outfit.id === generatedOutfitId);
          const nextOutfits = hasGeneratedOutfit
            ? currentOutfits.map(outfit => outfit.id === generatedOutfitId ? { ...outfit, name: outfit.name || generatedOutfitName, imageUrl: imageSrc } : outfit)
            : [{ id: generatedOutfitId, name: generatedOutfitName, imageUrl: imageSrc }, ...currentOutfits];

          return {
            ...n,
            data: {
              ...n.data,
              avatarUrl: imageSrc,
              outfits: nextOutfits,
              generatedSettingImageId: generatedOutfitId,
            },
          };
        }

        const generatedImageId = (n.data.generatedSettingImageId as string) || uuidv4();
        const currentImages = ((n.data.images as any[]) || []);
        const generatedImageName = language === 'zh' ? 'AI 场景图' : 'AI Scene Image';
        const hasGeneratedImage = currentImages.some(image => image.id === generatedImageId);
        const nextImages = hasGeneratedImage
          ? currentImages.map(image => image.id === generatedImageId ? { ...image, name: image.name || generatedImageName, imageUrl: imageSrc } : image)
          : [{ id: generatedImageId, name: generatedImageName, imageUrl: imageSrc }, ...currentImages];

        return {
          ...n,
          data: {
            ...n.data,
            coverImageUrl: imageSrc,
            images: nextImages,
            generatedSettingImageId: generatedImageId,
          },
        };
      }));

      showToast(type === 'character'
        ? (language === 'zh' ? '人物三视图已生成' : 'Character three-view generated')
        : (language === 'zh' ? '场景图片已生成' : 'Scene image generated'));
    } catch (error: any) {
      console.error('Setting image generation failed:', error);
      alert(`${language === 'zh' ? '图片生成失败' : 'Image generation failed'}: ${error.message || 'Unknown error'}`);
    }
  }, [nodes, language, requestGeneratedImage, setNodes, showToast]);

  const handleGenerateStoryNodeImage = useCallback(async (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    const titleText = stripHtml((node.data.title as string) || '');
    const bodyText = stripHtml((node.data.text as string) || '');
    const basePrompt = [titleText, bodyText].filter(Boolean).join('\n\n').trim();
    if (!basePrompt) {
      alert(language === 'zh' ? '请先在普通卡片里输入图片提示词。' : 'Enter an image prompt in the story card first.');
      return;
    }
    if (!imageApiKey.trim()) {
      alert(language === 'zh' ? '请先在设置中填写图片生成 API 密钥。' : 'Configure the image generation API key in Settings first.');
      return;
    }

    try {
      const imageReferences = getConnectedImageReferences(nodes, edges, id);
      const convertedReferences = (
        await Promise.allSettled(
          imageReferences.map(async reference => ({
            ...reference,
            apiImage: await toApiImageReference(reference.url),
          }))
        )
      )
        .filter((result): result is PromiseFulfilledResult<ImageReference & { apiImage: string }> => result.status === 'fulfilled' && !!result.value.apiImage)
        .map(result => result.value);
      const apiReferenceImages = convertedReferences.map(reference => reference.apiImage);
      const prompt = `${basePrompt}${buildReferencePrompt(convertedReferences)}`;
      const imageRequest = buildImageGenerationRequest(imageApiUrl, imageModel, imageSize, prompt, imageApiKey, apiReferenceImages);
      const imageRequestBody = JSON.stringify(imageRequest.body);
      const imageRequestHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${imageApiKey.trim()}`,
      };
      const sendImageRequest = (url: string) => fetch(url, {
        method: 'POST',
        headers: imageRequestHeaders,
        body: imageRequestBody,
      });

      let response: Response;
      let activeImageRequestUrl = imageRequest.url;
      try {
        response = await sendImageRequest(activeImageRequestUrl);
      } catch (fetchError) {
        const fallbackArkProxyUrl = typeof window !== 'undefined' && /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):3000$/i.test(window.location.origin)
          ? '/api/ark-image'
          : 'http://127.0.0.1:3000/api/ark-image';
        const canRetryArkProxy = imageRequest.usesSeedream && imageRequest.url !== fallbackArkProxyUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http');
        if (!canRetryArkProxy) {
          throw new Error(`${language === 'zh' ? '图片请求无法发送' : 'Image request could not be sent'} (${imageRequest.url}). ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
        }
        activeImageRequestUrl = fallbackArkProxyUrl;
        response = await sendImageRequest(activeImageRequestUrl);
      }

      if (!response.ok) {
        const errText = await response.text();
        const shouldRetrySeedreamSize =
          imageRequest.usesSeedream &&
          /InvalidParameter|size|pixels/i.test(errText) &&
          imageRequest.body.size !== SEEDREAM_DIMENSION_SIZE;

        if (shouldRetrySeedreamSize) {
          response = await fetch(activeImageRequestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${imageApiKey.trim()}`,
            },
            body: JSON.stringify({
              ...imageRequest.body,
              size: SEEDREAM_DIMENSION_SIZE,
            }),
          });

          if (response.ok) {
            setImageSize(SEEDREAM_DIMENSION_SIZE);
          } else {
            const retryErrText = await response.text();
            throw new Error(retryErrText || errText || `HTTP ${response.status}`);
          }
        } else {
          throw new Error(errText || `HTTP ${response.status}`);
        }
      }

      const result = await response.json();
      const imageData = result?.data?.[0];
      const imageSrc = imageData?.b64_json
        ? `data:image/png;base64,${imageData.b64_json}`
        : imageData?.url;

      if (!imageSrc) {
        throw new Error(language === 'zh' ? '图片 API 没有返回可用图片。' : 'Image API returned no usable image.');
      }

      const currentHeight = (node.style?.height as number) || 200;
      const currentWidth = (node.style?.width as number) || 280;
      const previousImageUrl = node.data.imageUrl as string | undefined;
      const nextHeight = Math.max(currentHeight, 260);

      setNodes((nds) => {
        const nextNodes = nds.map((n) => {
          if (n.id !== id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              imageUrl: imageSrc,
              videoUrl: undefined,
              audioUrl: undefined,
              objectFit: n.data.objectFit || 'cover',
              showTextOverlay: true,
              titleHeightAdded: showTitles,
            },
            style: {
              ...n.style,
              height: nextHeight,
            },
          };
        });

        if (!previousImageUrl) return nextNodes;

        const extractedId = uuidv4();
        const extractedNode: Node = {
          id: extractedId,
          type: 'storyNode',
          position: {
            x: node.position.x + currentWidth + 40,
            y: node.position.y,
          },
          style: { width: currentWidth, height: currentHeight },
          data: {
            id: extractedId,
            title: language === 'zh' ? '旧图片' : 'Previous Image',
            shape: 'square',
            color: '#ffffff',
            text: '',
            imageUrl: previousImageUrl,
            objectFit: node.data.objectFit || 'cover',
            showTextOverlay: false,
            titleHeightAdded: showTitles,
          },
        };

        return [...nextNodes, extractedNode];
      });
      showToast(language === 'zh' ? '图片已生成到当前卡片' : 'Image generated into the current card');
    } catch (error: any) {
      console.error('Image generation failed:', error);
      alert(`${language === 'zh' ? '图片生成失败' : 'Image generation failed'}: ${error.message || 'Unknown error'}`);
    }
  }, [nodes, edges, imageApiKey, imageApiUrl, imageModel, imageSize, language, setNodes, showTitles, showToast]);

  const handleExtractMedia = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    const extractedMedia: { url: string, type: string }[] = [];

    // 1. 检查原生媒体属性    
    if (node.data.imageUrl) extractedMedia.push({ url: node.data.imageUrl as string, type: 'image' });
    if (node.data.videoUrl) extractedMedia.push({ url: node.data.videoUrl as string, type: 'video' });
    if (node.data.audioUrl) extractedMedia.push({ url: node.data.audioUrl as string, type: 'audio' });

    // 2. 检查文本中嵌入的媒体标签    
    const text = node.data.text as string || '';
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    const videoRegex = /<video[^>]+src="([^">]+)"/g;
    let match;

    while ((match = imgRegex.exec(text)) !== null) {
      if (!extractedMedia.find(m => m.url === match![1])) {
        extractedMedia.push({ url: match[1], type: 'image' });
      }
    }
    while ((match = videoRegex.exec(text)) !== null) {
      if (!extractedMedia.find(m => m.url === match![1])) {
        extractedMedia.push({ url: match[1], type: 'video' });
      }
    }

    if (extractedMedia.length === 0) return;

    // 清理原节点内标签   
    const cleanText = text
      .replace(/<img[^>]+>/g, '')
      .replace(/<video[^>]+>.*?<\/video>/g, '')
      .replace(/<video[^>]+>/g, '')
      .trim();

    handleUpdateNode(id, {
      imageUrl: undefined,
      videoUrl: undefined,
      audioUrl: undefined,
      showTextOverlay: false,
      text: cleanText,
      // 还原高度
      style: { ...node.style, height: 200 }
    });

    // 创建新节点
    const newNodes: Node[] = extractedMedia.map((media, index) => {
      const newId = uuidv4();
      const displayWidth = 300;
      const displayHeight = 200;
      return {
        id: newId,
        type: 'storyNode',
        position: {
          x: node.position.x + (index + 1) * 320,
          y: node.position.y
        },
        style: { width: displayWidth, height: displayHeight + (showTitles ? TITLE_HEIGHT : 0) },
        data: {
          id: newId,
          title: media.type === 'image' ? '提取图片' : '提取视频',
          imageUrl: media.type === 'image' ? media.url : undefined,
          videoUrl: media.type === 'video' ? media.url : undefined,
          audioUrl: media.type === 'audio' ? media.url : undefined,
          titleHeightAdded: showTitles,
          showTitles
        }
      };
    });

    setNodes(nds => [...nds, ...newNodes]);
  }, [nodes, showTitles, handleUpdateNode, setNodes]);


  const handleAddConnectedNode = useCallback((sourceId: string, side: string) => {
    // NOTE: 全部在 setNodes 函数式更新内部读取最新节点，消除对外部 nodes 的依赖，
    // 防止 nodes 变化导致此回调重建，进而引发 nodesWithCallbacks 重算的无限循环
    const newId = uuidv4();
    const offsetDist = 120;

    let targetHandle = 'left';

    setNodes(nds => {
      const sourceNode = nds.find(n => n.id === sourceId);
      if (!sourceNode) return nds;

      const srcW = sourceNode.measured?.width || 300;
      const srcH = sourceNode.measured?.height || 200;

      let newX = sourceNode.position.x;
      let newY = sourceNode.position.y;

      if (side === 'top') {
        newY -= (200 + offsetDist);
        targetHandle = 'bottom';
      } else if (side === 'bottom') {
        newY += (srcH + offsetDist);
        targetHandle = 'top';
      } else if (side === 'left') {
        newX -= (300 + offsetDist);
        targetHandle = 'right';
      } else if (side === 'right') {
        newX += (srcW + offsetDist);
        targetHandle = 'left';
      }

      const isOccupied = (x: number, y: number) =>
        nds.some(n => Math.abs(n.position.x - x) < 50 && Math.abs(n.position.y - y) < 50);

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
        data: { title: "分支", shape: 'square', color: '#ffffff', text: "" },
      };

      // 检查 sourceId 是否属于任何动态分组，若是则将新节点也加入分组
      const updatedNodes = nds.map(node => {
        if (node.type === 'groupNode') {
          const childIds = (node.data.childIds as string[]) || [];
          if (childIds.includes(sourceId)) {
            return {
              ...node,
              data: { ...node.data, childIds: [...childIds, newId] }
            };
          }
        }
        return node;
      });

      return [...updatedNodes, newNode];
    });

    setEdges(eds => [...eds, { id: `e-${sourceId}-${newId}`, source: sourceId, sourceHandle: side, target: newId, targetHandle }]);
  }, [setNodes, setEdges]);

  const addNewShape = (shape: 'square' | 'diamond' | 'rounded-rectangle') => {
    const center = getCenterPosition();
    let newX = center.x - 150;
    let newY = center.y - 100;

    const isOccupied = (x: number, y: number, currentNodes: Node[]) => {
      return currentNodes.some(n => Math.abs(n.position.x - x) < 50 && Math.abs(n.position.y - y) < 50);
    };

    let attempts = 0;
    while (isOccupied(newX, newY, nodes) && attempts < 10) {
      newX += 320;
      if (attempts > 3) newY += 220;
      attempts++;
    }

    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'storyNode',
      position: { x: newX, y: newY },
      style: { width: 300, height: 200 },
      data: {
        id: newId,
        title: shape === 'square' ? '分支' : shape === 'diamond' ? '判断' : '状态',
        shape,
        color: '#ffffff',
        text: ""
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addNewBackground = () => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'backgroundNode',
      position: { x: center.x - 300, y: center.y - 200 },
      dragHandle: '.custom-drag-handle',
      style: { width: 600, height: 400, zIndex: -1 },
      data: { id: newId, title: '背景区域', color: '#f1f5f9' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addNewAIHub = () => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'aiNode',
      position: { x: center.x - 128, y: center.y - 100 },
      data: { id: newId, title: 'AI 剧情分析' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addNewTextNode = () => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'textNode',
      position: { x: center.x - 100, y: center.y - 30 },
      selected: true,
      data: {
        id: newId,
        content: language === 'zh' ? '在此处输入文本?..' : 'Enter text here...',
        fontSize: 24,
        color: '#334155',
        fontFamily: 'system-ui, sans-serif',
        isBold: false,
        initialEditing: true
      },
      style: { width: 200, height: 60 },
    };
    setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), newNode]);
  };

  const addNewSummaryNode = () => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'summaryNode',
      position: { x: center.x - 175, y: center.y - 100 },
      data: { id: newId },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addNewNumberConditionNode = () => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'numberConditionNode',
      position: { x: center.x - 125, y: center.y - 100 },
      data: { id: newId, threshold: 0 },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addNewBatchReplaceNode = () => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'batchReplaceNode',
      position: { x: center.x - 160, y: center.y - 100 },
      data: { id: newId },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addNewPlotStructureNode = () => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'plotStructureNode',
      position: { x: center.x - 130, y: center.y - 100 },
      data: { id: newId, cardCount: 3, detailLevel: 'standard', direction: '' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addNewCharacterNode = () => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'characterNode',
      position: { x: center.x - 140, y: center.y - 150 },
      data: { id: newId, characterName: '新角色', traits: '' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addNewSceneNode = () => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'sceneNode',
      position: { x: center.x - 140, y: center.y - 150 },
      data: { id: newId, sceneName: language === 'zh' ? '新场景' : 'New Scene', description: '' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const center = getCenterPosition();
    const fileArray = Array.from(files);

    // 使用 Promise.all 处理所有文件，确保顺序和状态同步    
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const url = URL.createObjectURL(file);
      const newId = uuidv4();

      let mediaData = {};
      let title = language === 'zh' ? '媒体' : 'Media';

      // NOTE: 根据媒体原始比例调整卡片尺寸
      const { width, height } = await getMediaDimensions(url, file.type);
      let displayWidth = 400;
      let displayHeight = (height / width) * displayWidth;

      // 限制高度不要太大
      if (displayHeight > 500) {
        displayHeight = 500;
        displayWidth = (width / height) * displayHeight;
      }

      if (file.type.startsWith('image/')) {
        mediaData = { imageUrl: url };
        title = language === 'zh' ? '图片' : 'Image';
      } else if (file.type.startsWith('video/')) {
        mediaData = { videoUrl: url };
        title = language === 'zh' ? '视频' : 'Video';
      } else if (file.type.startsWith('audio/')) {
        mediaData = { audioUrl: url };
        title = language === 'zh' ? '音频' : 'Audio';
        displayWidth = 300;
        displayHeight = 150;
      }

      const newNode: Node = {
        id: newId,
        type: 'storyNode',
        position: {
          x: center.x - displayWidth / 2 + (i * 30),
          y: center.y - displayHeight / 2 + (i * 30)
        },
        style: { width: displayWidth, height: displayHeight + (showTitles ? TITLE_HEIGHT : 0) },
        data: {
          id: newId,
          title: title,
          shape: 'square',
          color: '#ffffff',
          text: "",
          titleHeightAdded: showTitles,
          ...mediaData
        },
      };
      setNodes((nds) => [...nds, newNode]);
    }

    e.target.value = ''; // Reset input
  };


  const handleExportAll = () => {
    const text = exportPaths(nodes as any, edges);
    downloadText(text, 'all_endings.md');
  };

  const handleExportJSON = () => {
    setShowSaveNameModal(true);
  };

  // Helper: Convert base64 to Blob
  const base64ToBlob = (base64: string) => {
    const parts = base64.split(';base64,');
    if (parts.length !== 2) return null;
    const contentType = parts[0].split(':')[1];
    const byteCharacters = atob(parts[1]);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  // Helper: Convert any URL (data: or blob:) to Blob
  const urlToBlob = async (url: string) => {
    if (!url) return null;
    if (url.startsWith('data:')) return base64ToBlob(url);
    if (url.startsWith('blob:')) {
      try {
        const resp = await fetch(url);
        return await resp.blob();
      } catch (e) {
        console.error("Failed to fetch blob URL", e);
        return null;
      }
    }
    return null;
  };

  // Helper: Process HTML text to extract inline media
  const processHtmlMedia = async (html: string, zip: JSZip, assetsFolder: JSZip | null, nodeId: string) => {
    if (!html) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements = doc.querySelectorAll('img, video, source, audio');
    let index = 0;

    for (const el of Array.from(elements)) {
      const src = el.getAttribute('src');
      if (src && (src.startsWith('data:') || src.startsWith('blob:'))) {
        const blob = await urlToBlob(src);
        if (blob) {
          const type = blob.type.split('/')[0];
          const ext = blob.type.split('/')[1] || 'bin';
          const fileName = `inline_${nodeId}_${type}_${index++}.${ext}`;
          assetsFolder?.file(fileName, blob);
          el.setAttribute('src', `assets/${fileName}`);
        }
      }
    }
    return doc.body.innerHTML;
  };

  // Helper: Restore HTML text inline media from ZIP
  const restoreHtmlMedia = async (html: string, zip: JSZip | null) => {
    if (!html || !zip) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements = doc.querySelectorAll('img, video, source, audio');

    for (const el of Array.from(elements)) {
      const src = el.getAttribute('src');
      if (src && src.startsWith('assets/')) {
        const assetFile = zip.file(src);
        if (assetFile) {
          const blob = await assetFile.async("blob");
          el.setAttribute('src', URL.createObjectURL(blob));
        }
      }
    }
    return doc.body.innerHTML;
  };

  const confirmExportZIP = async () => {
    try {
      const zip = new JSZip();
      const projectData = JSON.parse(getProjectSnapshot());
      const assetsFolder = zip.folder("assets");

      // Process nodes to extract media
      const processedNodes = await Promise.all(projectData.nodes.map(async (node: any) => {
        const newNode = { ...node, data: { ...node.data } };
        const mediaFields = ['imageUrl', 'videoUrl', 'audioUrl'];

        for (const field of mediaFields) {
          const value = newNode.data[field];
          if (value && (value.startsWith('data:') || value.startsWith('blob:'))) {
            const blob = await urlToBlob(value);
            if (blob) {
              const extension = blob.type.split('/')[1] || 'bin';
              const fileName = `media_${node.id}_${field}.${extension}`;
              assetsFolder?.file(fileName, blob);
              newNode.data[field] = `assets/${fileName}`;
            }
          }
        }

        // 2. Process inline media in HTML text
        if (newNode.data.text) {
          newNode.data.text = await processHtmlMedia(newNode.data.text, zip, assetsFolder, node.id);
        }
        if (newNode.data.content) {
          newNode.data.content = await processHtmlMedia(newNode.data.content, zip, assetsFolder, node.id);
        }

        return newNode;
      }));

      projectData.nodes = processedNodes;
      zip.file("project.json", JSON.stringify(projectData, null, 2));

      const content = await zip.generateAsync({ type: "blob" });
      const fileName = saveFileName.endsWith('.zip') ? saveFileName : `${saveFileName}.zip`;

      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      lastSavedSnapshot.current = JSON.stringify(projectData);
      setIsDirty(false);
      setShowSaveNameModal(false);

      // 手动保存成功后清除自动保存缓存
      await clearAutoSave();

      showToast(language === 'zh' ? '剧本工程已保存为 ZIP 文件' : 'Project saved as ZIP');
    } catch (error: any) {
      console.error("Export failed:", error);
      alert(language === 'zh' ? `导出失败: ${error.message}` : `Export failed: ${error.message}`);
    }
  };

  // Keep confirmExportJSON for backward compatibility or rename it
  const confirmExportJSON = confirmExportZIP;

  // NOTE: 批量操作逻辑 - 动态包裹（新设计）
  const wrapWithDynamicGroup = useCallback(() => {
    const selected = nodes.filter(n => n.selected && n.type !== 'backgroundNode' && n.type !== 'groupNode');
    if (selected.length === 0) return;

    const childIds = selected.map(n => n.id);
    const newId = uuidv4();

    // 初始位置和大小由后续useEffect 自动计算，这里给个大
    const newNode: Node = {
      id: newId,
      type: 'groupNode',
      position: { x: 0, y: 0 },
      selectable: true,
      draggable: true,
      data: { id: newId, title: t.dynamicWrap, color: '#6366f1', childIds },
      style: { width: 100, height: 100, zIndex: -2 },
    };

    setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
  }, [nodes, setNodes, t.dynamicWrap]);

  // NOTE: 批量操作逻辑 - 静态背景卡片（取代原逻辑）
  const wrapSelectedWithBackground = useCallback(() => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selected.forEach(n => {
      const { x, y } = n.position;
      const w = n.measured?.width || 300;
      const h = n.measured?.height || 200;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    const padding = 60;
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'backgroundNode',
      position: { x: minX - padding, y: minY - padding },
      dragHandle: '.custom-drag-handle',
      style: { width: (maxX - minX) + padding * 2, height: (maxY - minY) + padding * 2, zIndex: -3 },
      data: { id: newId, title: t.bgCard, color: '#f1f5f9' },
    };

    setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), newNode]);
  }, [nodes, setNodes, t.bgCard]);

  const connectSelectedToAIHub = useCallback(() => {
    const selected = nodes.filter(n => n.selected && n.type !== 'backgroundNode');
    if (selected.length === 0) return;

    let maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    selected.forEach(n => {
      const { x, y } = n.position;
      const w = n.measured?.width || 300;
      const h = n.measured?.height || 200;
      maxX = Math.max(maxX, x + w);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + h);
    });

    const newId = uuidv4();
    const hubX = maxX + 150;
    const hubY = minY + (maxY - minY) / 2 - 50;

    const newNode: Node = {
      id: newId,
      type: 'aiNode',
      position: { x: hubX, y: hubY },
      data: {
        id: newId, title: 'AI 汇总分析',
      },
      style: { width: 220, height: 100 },
    };

    const newEdges = selected.map(n => ({
      id: `e-${n.id}-${newId}`,
      source: n.id,
      target: newId,
      type: 'customEdge'
    }));

    setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), newNode]);
    setEdges(eds => [...eds, ...newEdges]);
  }, [nodes, setNodes, setEdges]);

  const connectSelectedToSummaryNode = useCallback(() => {
    const selected = nodes.filter(n => n.selected && n.type !== 'backgroundNode' && n.type !== 'summaryNode');
    if (selected.length === 0) return;

    let maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    selected.forEach(n => {
      const { x, y } = n.position;
      const w = n.measured?.width || 300;
      const h = n.measured?.height || 200;
      maxX = Math.max(maxX, x + w);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + h);
    });

    const newId = uuidv4();
    const hubX = maxX + 150;
    const hubY = minY + (maxY - minY) / 2 - 125;

    const newNode: Node = {
      id: newId,
      type: 'summaryNode',
      position: { x: hubX, y: hubY },
      data: { id: newId },
    };

    const newEdges = selected.map(n => ({
      id: `e-${n.id}-${newId}`,
      source: n.id,
      target: newId,
      type: 'customEdge'
    }));

    setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), newNode]);
    setEdges(eds => [...eds, ...newEdges]);
  }, [nodes, setNodes, setEdges]);

  const handleImportZIP = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isDirty) {
      if (!window.confirm("当前项目有未保存的更改，导入新文件将覆盖当前内容。确定要继续吗？")) {
        e.target.value = '';
        return;
      }
    }

    try {
      let data: any;
      let zip: JSZip | null = null;

      if (file.name.endsWith('.json')) {
        // Legacy JSON support
        const text = await file.text();
        data = JSON.parse(text);
      } else {
        // New ZIP support
        zip = await JSZip.loadAsync(file);
        const projectJsonFile = zip.file("project.json");
        if (!projectJsonFile) throw new Error("Invalid project: project.json not found");
        const projectJsonStr = await projectJsonFile.async("string");
        data = JSON.parse(projectJsonStr);
      }

      if (data.nodes && data.edges) {
        // Restore media URLs
        const restoredNodes = await Promise.all(data.nodes.map(async (node: any) => {
          const newNode = {
            ...node,
            data: { ...node.data },
            dragHandle: node.type === 'backgroundNode' ? '.custom-drag-handle' : node.dragHandle
          };

          const mediaFields = ['imageUrl', 'videoUrl', 'audioUrl'];
          for (const field of mediaFields) {
            const value = newNode.data[field];
            if (value && value.startsWith('assets/') && zip) {
              const assetFile = zip.file(value);
              if (assetFile) {
                const blob = await assetFile.async("blob");
                newNode.data[field] = URL.createObjectURL(blob);
              }
            }
          }

          // 2. Restore inline media in HTML text
          if (newNode.data.text) {
            newNode.data.text = await restoreHtmlMedia(newNode.data.text, zip);
          }
          if (newNode.data.content) {
            newNode.data.content = await restoreHtmlMedia(newNode.data.content, zip);
          }

          return newNode;
        }));

        setNodes(restoredNodes);
        const restoredEdges = data.edges.map((edge: any) => ({
          ...edge,
          type: 'customEdge',
          markerEnd: defaultEdgeOptions.markerEnd,
          style: defaultEdgeOptions.style
        }));
        setEdges(restoredEdges);

        // Apply settings
        if (data.settings) {
          if (data.settings.canvasBg) setCanvasBg(data.settings.canvasBg);
          if (data.settings.edgeStyle) setEdgeStyle(data.settings.edgeStyle);
          if (data.settings.customApiKey) setCustomApiKey(data.settings.customApiKey);
          if (data.settings.pasteAsPlainText !== undefined) setPasteAsPlainText(data.settings.pasteAsPlainText);
          if (data.settings.showNodeActions !== undefined) setShowNodeActions(data.settings.showNodeActions);
          if (data.settings.showStats !== undefined) setShowStats(data.settings.showStats);
          if (data.settings.presetColors) setPresetColors(data.settings.presetColors);
          if (data.settings.showTitles !== undefined) setShowTitles(data.settings.showTitles);
          if (data.settings.generateLength) setGenerateLength(data.settings.generateLength);
          if (data.settings.aiProvider) setAiProvider(data.settings.aiProvider);
          if (data.settings.deepseekApiKey) setDeepseekApiKey(data.settings.deepseekApiKey);
          if (data.settings.openaiApiKey) setOpenaiApiKey(data.settings.openaiApiKey);
          if (data.settings.imageApiKey) setImageApiKey(data.settings.imageApiKey);
          if (data.settings.imageApiUrl) setImageApiUrl(data.settings.imageApiUrl);
          if (data.settings.imageModel) setImageModel(data.settings.imageModel);
          if (data.settings.imageSize) setImageSize(data.settings.imageSize);
          if (data.settings.ttsApiKey) setTtsApiKey(data.settings.ttsApiKey);
          if (data.settings.ttsApiUrl) setTtsApiUrl(data.settings.ttsApiUrl);
          if (data.settings.ttsModel) setTtsModel(data.settings.ttsModel);
          if (data.settings.ttsVoice) setTtsVoice(data.settings.ttsVoice);
          if (data.settings.thinkingMode !== undefined) setThinkingMode(data.settings.thinkingMode);
          if (data.settings.aiPrompts) setAiPrompts({ ...defaultAIPrompts, ...data.settings.aiPrompts });
          if (data.settings.aiButtonsConfig) setAiButtonsConfig({ ...defaultAIButtonsConfig, ...data.settings.aiButtonsConfig });
          if (data.settings.showMiniMap !== undefined) setShowMiniMap(data.settings.showMiniMap);
          if (data.settings.showControls !== undefined) setShowControls(data.settings.showControls);
          if (data.settings.scrollMode) setScrollMode(data.settings.scrollMode);
          if (data.settings.toolbarLayout) setToolbarLayout(data.settings.toolbarLayout);
          if (data.settings.selectionMenuLayout) setSelectionMenuLayout(data.settings.selectionMenuLayout);
          if (data.settings.language) setLanguage(data.settings.language);
          if (data.settings.theme) setTheme(data.settings.theme);
          if (data.settings.playTestDarkMode !== undefined) setPlayTestDarkMode(data.settings.playTestDarkMode);
          if (data.settings.playTestChoicesColumns !== undefined) setPlayTestChoicesColumns(data.settings.playTestChoicesColumns);
          if (data.settings.playTestVideoAutoPlay !== undefined) setPlayTestVideoAutoPlay(data.settings.playTestVideoAutoPlay);
          if (data.settings.playTestLayoutMode) setPlayTestLayoutMode(data.settings.playTestLayoutMode);

          if (data.settings.playTestInteractionMode) setPlayTestInteractionMode(data.settings.playTestInteractionMode);
          if (data.settings.playTestTypewriterSpeed !== undefined) setPlayTestTypewriterSpeed(data.settings.playTestTypewriterSpeed);
          if (data.settings.playTestChoiceDelay !== undefined) setPlayTestChoiceDelay(data.settings.playTestChoiceDelay);
          if (data.settings.playTestChoicesPosition) setPlayTestChoicesPosition(data.settings.playTestChoicesPosition);
          if (data.settings.playTestBlurBackground !== undefined) setPlayTestBlurBackground(data.settings.playTestBlurBackground);
          if (data.settings.playTestBlurText !== undefined) setPlayTestBlurText(data.settings.playTestBlurText);
          if (data.settings.playTestSkipSingleChoicePopup !== undefined) setPlayTestSkipSingleChoicePopup(data.settings.playTestSkipSingleChoicePopup);
          if (data.settings.playTestDimBackground !== undefined) setPlayTestDimBackground(data.settings.playTestDimBackground);
        }

        lastSavedSnapshot.current = JSON.stringify(data);
        setIsDirty(false);
      }
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to load project. The file is corrupted or invalid.");
    }
    e.target.value = '';
  };

  const handleEdgeDelete = useCallback((edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
  }, [setEdges]);

  const toggleStorylineHighlight = useCallback((nodeId: string | null) => {
    if (!nodeId || (highlightedPath && nodes.find(n => n.id === nodeId)?.selected && highlightedPath.nodes.has(nodeId))) {
      setHighlightedPath(null);
      return;
    }

    const pathNodes = new Set<string>();
    const pathEdges = new Set<string>();

    const traceUp = (id: string) => {
      if (pathNodes.has(id)) return;
      pathNodes.add(id);
      edges.forEach(e => {
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

        edges.forEach(e => {
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
  }, [nodes, edges, highlightedPath, language, showToast]);

  const unhideAllNodes = useCallback(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, hidden: false }
    })));
    showToast(language === 'zh' ? '已恢复所有隐藏卡片' : 'All cards restored');
  }, [setNodes, language, showToast]);

  // NOTE: 获取人物设定上下文
  const buildCharacterContext = useCallback((nodeId: string): string => {
    const globalCharacters = nodes.filter(n => n.type === 'characterNode' && n.data?.isGlobal !== false);

    const pathNodes = new Set<string>();
    let currentId: string | null = nodeId;
    while (currentId && !pathNodes.has(currentId)) {
      pathNodes.add(currentId);
      const incomingEdge = edges.find(e => e.target === currentId);
      currentId = incomingEdge ? incomingEdge.source : null;
    }

    const linkedCharacters = nodes.filter(n =>
      n.type === 'characterNode' &&
      n.data?.isGlobal === false &&
      edges.some(e => e.source === n.id && pathNodes.has(e.target))
    );

    const activeChars = Array.from(new Set([...globalCharacters, ...linkedCharacters]));
    if (activeChars.length === 0) return '';

    return "\n【已知角色设定】\n" + activeChars.map(c =>
      `角色：${c.data.characterName || '未命名'}\n设定：${formatCharacterNodeText(c.data as Record<string, unknown>)}`
    ).join("\n---\n") + "\n";
  }, [nodes, edges]);

  // NOTE: 获取场景设定上下文
  const buildSceneContext = useCallback((nodeId: string): string => {
    const globalScenes = nodes.filter(n => n.type === 'sceneNode' && n.data?.isGlobal !== false);

    const pathNodes = new Set<string>();
    let currentId: string | null = nodeId;
    while (currentId && !pathNodes.has(currentId)) {
      pathNodes.add(currentId);
      const incomingEdge = edges.find(e => e.target === currentId);
      currentId = incomingEdge ? incomingEdge.source : null;
    }

    const linkedScenes = nodes.filter(n =>
      n.type === 'sceneNode' &&
      n.data?.isGlobal === false &&
      edges.some(e => e.source === n.id && pathNodes.has(e.target))
    );

    const activeScenes = Array.from(new Set([...globalScenes, ...linkedScenes]));
    if (activeScenes.length === 0) return '';

    return "\n【已知场景设定】\n" + activeScenes.map(s =>
      `场景：${s.data.sceneName || '未命名'}\n设定：${formatSceneNodeText(s.data as Record<string, unknown>)}`
    ).join("\n---\n") + "\n";
  }, [nodes, edges]);

  // NOTE: 构建前文上下文，沿边向上追溯父节点文本
  const buildContextText = useCallback((nodeId: string): string => {
    let currentId: string | null = nodeId;
    const pathHistory: string[] = [];
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const incomingEdge = edges.find(e => e.target === currentId);
      const parentNode = incomingEdge ? nodes.find(n => n.id === incomingEdge.source) : null;
      if (parentNode && parentNode.type === 'storyNode') {
        const label = incomingEdge?.data?.label ? `[选择: ${incomingEdge.data.label}]` : '';
        pathHistory.unshift(`${parentNode.data.text} ${label}`);
      }
      currentId = parentNode ? parentNode.id : null;
    }
    return pathHistory.join('\n\n');
  }, [nodes, edges]);

  // NOTE: 根据 action 类型生成不同的中文提示词
  const buildPrompt = useCallback((action: 'continue' | 'creative' | 'rewrite' | 'interpolate' | 'scene_only' | 'dialogue_only', contextText: string, currentText: string, nextText?: string): string => {
    let base = aiPrompts.basePrompt
      .replace('{{contextText}}', contextText || '')
      .replace('{{currentText}}', currentText || '');

    let specificPrompt = '';
    if (action === 'continue') specificPrompt = aiPrompts.continue;
    else if (action === 'creative') specificPrompt = aiPrompts.creative;
    else if (action === 'rewrite') specificPrompt = aiPrompts.rewrite;
    else if (action === 'scene_only') specificPrompt = aiPrompts.sceneOnly;
    else if (action === 'dialogue_only') specificPrompt = aiPrompts.dialogueOnly;
    else if (action === 'interpolate') {
      specificPrompt = aiPrompts.interpolate
        .replace('{{contextText}}', contextText || '')
        .replace('{{currentText}}', currentText || '')
        .replace('{{nextText}}', nextText || '');
      return specificPrompt.replace('{{generateLength}}', generateLength);
    }

    return base + specificPrompt.replace('{{generateLength}}', generateLength);
  }, [aiPrompts, generateLength]);

  // NOTE: 用户点击AI按钮时先弹出选项弹窗
  const handleAIButtonClick = useCallback((nodeId: string) => {
    setPendingAINodeId(nodeId);
    setShowAIActionModal(true);
  }, []);

  // NOTE: 调用后端 PHP 代理接口
  const callAIProxy = async (provider: 'gemini' | 'deepseek', prompt: string, options: any) => {
    let response;
    try {
      response = await fetch('./api/proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, prompt, options }),
      });
    } catch (e) {
      throw new Error('无法连接到代理接口，请检查PHP 后端是否已正确部署并运行');
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error(`代理接口返回了无效格式(HTTP ${response.status})。请检查?./api/proxy.php 是否存在。`);
    }

    if (!response.ok || data.error) {
      throw new Error(data.error || `代理接口请求失败(HTTP ${response.status})`);
    }
    return data;
  };

  // NOTE: 用户在弹窗中选择操作后执行AI生成
  const handleAIGenerate = useCallback(async (nodeId: string, action: 'continue' | 'creative' | 'rewrite' | 'interpolate' | 'scene_only' | 'dialogue_only') => {
    const targetNode = nodes.find(n => n.id === nodeId);
    if (!targetNode) return;

    setShowAIActionModal(false);
    setPendingAINodeId(null);
    setAiLoadingNodeId(nodeId);

    try {
      const contextText = buildContextText(nodeId);
      const charContext = buildCharacterContext(nodeId);
      const sceneContext = buildSceneContext(nodeId);
      const currentText = (targetNode.data.text as string || '').trim();

      let nextText = '';
      if (action === 'interpolate') {
        const outgoingEdges = edges.filter(e => e.source === nodeId);
        const children = outgoingEdges.map(e => nodes.find(n => n.id === e.target)).filter(Boolean);
        nextText = children.map(c => c?.data.text).join('\n\n---\n\n');
      }

      // Inject character & scene context into contextText
      const settingContext = [charContext, sceneContext].filter(Boolean).join('\n');
      const finalContextText = settingContext ? `${settingContext}\n\n${contextText}` : contextText;
      const prompt = buildPrompt(action, finalContextText, currentText, nextText);

      let newText = '';

      if (aiProvider === 'deepseek') {
        const key = deepseekApiKey;
        if (key && key.trim() !== '') {
          // 用户提供了自己的 Key，直接调用        
          const model = thinkingMode ? 'deepseek-reasoner' : 'deepseek-chat';
          const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              stream: false,
            }),
          });
          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`DeepSeek API 错误: ${errText}`);
          }
          const data = await response.json();
          const choice = data.choices?.[0];
          const reasoning: string | null = choice?.message?.reasoning_content || null;
          newText = choice?.message?.content || '';

          if (thinkingMode && reasoning) {
            setThinkingContent(reasoning);
            setTimeout(() => setThinkingContent(null), 8000);
          }
        } else {
          // 使用管理员代理(密钥存储在服务器的php-backend/api/config.php)
          const data = await callAIProxy('deepseek', prompt, { thinkingMode });
          newText = data.content;
          if (thinkingMode && data.reasoning) {
            setThinkingContent(data.reasoning);
            setTimeout(() => setThinkingContent(null), 8000);
          }
        }
      } else if (aiProvider === 'openai') {
        const key = openaiApiKey;
        if (key && key.trim() !== '') {
          const model = 'gpt-4o';
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              stream: false,
            }),
          });
          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenAI API 错误: ${errText}`);
          }
          const data = await response.json();
          newText = data.choices?.[0]?.message?.content || '';
        } else {
          const data = await callAIProxy('openai', prompt, {});
          newText = data.content;
        }
      } else {
        // Gemini
        const key = customApiKey;
        if (key && key.trim() !== '') {
          // 用户提供了自己的 Key，直接调用          
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey: key });
          const response = await ai.models.generateContent({
            model: thinkingMode ? 'gemini-2.0-flash-thinking-exp' : 'gemini-2.0-flash',
            contents: prompt,
          });
          newText = response.text || '';
        } else {
          // 使用管理员代理(密钥存储在服务器的php-backend/api/config.php)
          const data = await callAIProxy('gemini', prompt, { thinkingMode });
          newText = data.content;
        }
      }

      const updatedText = currentText ? `${currentText}\n\n${newText}` : newText;
      handleUpdateNode(nodeId, { text: updatedText });
    } catch (error: any) {
      console.error('AI Generation failed:', error);
      alert(`AI 生成失败: ${error.message || '请检查API 密钥和网络连接'}`);
    } finally {
      setAiLoadingNodeId(null);
    }
  }, [nodes, edges, aiProvider, deepseekApiKey, customApiKey, openaiApiKey, thinkingMode, buildContextText, buildCharacterContext, buildSceneContext, handleUpdateNode, buildPrompt]);

  const callAIForText = useCallback(async (prompt: string): Promise<string> => {
    if (aiProvider === 'deepseek') {
      const key = deepseekApiKey;
      if (key && key.trim() !== '') {
        const model = thinkingMode ? 'deepseek-reasoner' : 'deepseek-chat';
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
          }),
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`DeepSeek API 错误: ${errText}`);
        }
        const data = await response.json();
        const choice = data.choices?.[0];
        if (thinkingMode && choice?.message?.reasoning_content) {
          setThinkingContent(choice.message.reasoning_content);
          setTimeout(() => setThinkingContent(null), 8000);
        }
        return choice?.message?.content || '';
      }
      const data = await callAIProxy('deepseek', prompt, { thinkingMode });
      if (thinkingMode && data.reasoning) {
        setThinkingContent(data.reasoning);
        setTimeout(() => setThinkingContent(null), 8000);
      }
      return data.content || '';
    }

    if (aiProvider === 'openai') {
      const key = openaiApiKey;
      if (key && key.trim() !== '') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            stream: false,
          }),
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI API 错误: ${errText}`);
        }
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      }
      const data = await callAIProxy('openai', prompt, {});
      return data.content || '';
    }

    const key = customApiKey;
    if (key && key.trim() !== '') {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: thinkingMode ? 'gemini-2.0-flash-thinking-exp' : 'gemini-2.0-flash',
        contents: prompt,
      });
      return response.text || '';
    }
    const data = await callAIProxy('gemini', prompt, { thinkingMode });
    return data.content || '';
  }, [aiProvider, deepseekApiKey, openaiApiKey, customApiKey, thinkingMode]);

  const handleGenerateSettingText = useCallback((prompt: string) => {
    return callAIForText(prompt);
  }, [callAIForText]);

  const handlePlotStructureGenerate = useCallback(async (params: PlotStructureGenerateParams) => {
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
  }, [callAIForText, generateLength, setNodes, setEdges]);

  // NOTE: 全局 AI 汇总分析
  const handleAIAnalyze = useCallback(async (nodeId: string, mode: string = 'summary') => {
    const aiNode = nodes.find(n => n.id === nodeId);
    if (!aiNode) return;

    // 找到所有指向该 AI 节点的边
    const incomingEdges = edges.filter(e => e.target === nodeId);
    const inputNodes = incomingEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean);

    if (inputNodes.length === 0) {
      alert('请先将剧本节点连接到 AI 分析节点的左侧输入点');
      return;
    }

    const combinedText = inputNodes.map(n => `【${n?.data.title}】\n${n?.data.text}`).join('\n\n---\n\n');

    let prompt = '';
    if (mode === 'structure') {
      prompt = aiPrompts.analyzeStructure.replace('{{combinedText}}', combinedText);
    } else if (mode === 'suggestions') {
      prompt = aiPrompts.analyzeSuggestions.replace('{{combinedText}}', combinedText);
    } else if (mode === 'direction') {
      prompt = aiPrompts.analyzeDirection.replace('{{combinedText}}', combinedText);
    } else if (mode === 'solution') {
      const previousResult = aiNode.data.result as string || '';
      prompt = aiPrompts.analyzeSolution.replace('{{combinedText}}', combinedText).replace('{{previousResult}}', previousResult);
    } else {
      prompt = aiPrompts.analyzeSummary.replace('{{combinedText}}', combinedText);
    }

    try {
      let result = '';
      if (aiProvider === 'deepseek') {
        const key = deepseekApiKey;
        if (key && key.trim() !== '') {
          const model = thinkingMode ? 'deepseek-reasoner' : 'deepseek-chat';
          const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              stream: false,
            }),
          });
          const data = await response.json();
          result = data.choices?.[0]?.message?.content || '';
        } else {
          // 使用管理员代理(密钥存储在服务器:php-backend/api/config.php)
          const data = await callAIProxy('deepseek', prompt, { thinkingMode });
          result = data.content;
        }
      } else if (aiProvider === 'openai') {
        const key = openaiApiKey;
        if (key && key.trim() !== '') {
          const model = 'gpt-4o';
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              stream: false,
            }),
          });
          const data = await response.json();
          result = data.choices?.[0]?.message?.content || '';
        } else {
          const data = await callAIProxy('openai', prompt, {});
          result = data.content;
        }
      } else {
        const key = customApiKey;
        if (key && key.trim() !== '') {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey: key });
          const response = await ai.models.generateContent({
            model: thinkingMode ? 'gemini-2.0-flash-thinking-exp' : 'gemini-2.0-flash',
            contents: prompt,
          });
          result = response.text || '';
        } else {
          // 使用管理员代理(密钥存储在服务器:php-backend/api/config.php)
          const data = await callAIProxy('gemini', prompt, { thinkingMode });
          result = data.content;
        }
      }
      // 更新当前 AI 节点的结点
      let finalResult = result;
      if (mode === 'solution') {
        const previousResult = aiNode.data.result as string || '';
        finalResult = previousResult + '\n\n---\n\n### 💡 修改解法\n\n' + result;
      }
      handleUpdateNode(nodeId, { result: finalResult });

      // NOTE: 自动流转逻辑 - 如果 AI 节点后面连接点StoryNode，则同步结果
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      if (outgoingEdges.length > 0) {
        setNodes(nds => nds.map(node => {
          const edge = outgoingEdges.find(e => e.target === node.id);
          if (edge && node.type === 'storyNode') {
            const oldText = (node.data.text as string || '').trim();
            const divider = oldText ? '<br/><br/><hr/><br/>' : '';
            const modeLabel = mode === 'structure' ? '结构分析' : mode === 'suggestions' ? '构思建议' : mode === 'direction' ? '写作方向' : mode === 'solution' ? '修改解法' : '汇总报告';

            // 简单的 Markdown → HTML
            const formattedResult = result
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\n/g, '<br/>');

            return {
              ...node,
              data: {
                ...node.data,
                text: `${oldText}${divider}<strong style="color: #6366f1;">💡 AI ${modeLabel}</strong><br/>${formattedResult}`
              }
            };
          }
          return node;
        }));
      }
    } catch (error: any) {
      console.error('AI Analysis failed:', error);
      alert(`AI 分析失败: ${error.message || '请检查网络和 API 配置'}`);
    }
  }, [nodes, edges, aiProvider, deepseekApiKey, customApiKey, openaiApiKey, thinkingMode, handleUpdateNode, setNodes, aiPrompts]);

  // NOTE: 处理“图片卡片拖入文字卡片”的逻辑
  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    // 只有当拖拽的是媒体节点时才触   
    const mediaUrl = node.data.imageUrl || node.data.videoUrl || node.data.audioUrl;
    if (node.type === 'storyNode' && mediaUrl) {
      const nx = node.position.x;
      const ny = node.position.y;

      // 寻找被覆盖的目标节点
      const targetNode = nodes.find(n =>
        n.id !== node.id &&
        (n.type === 'storyNode' || n.type === 'aiNode') &&
        !n.data.imageUrl && !n.data.videoUrl && !n.data.audioUrl &&
        nx > n.position.x && nx < n.position.x + (n.measured?.width || 300) &&
        ny > n.position.y && ny < n.position.y + (n.measured?.height || 200)
      );

      if (targetNode) {
        if (targetNode.type === 'aiNode') {
          // AI 节点直接设置为背景媒体          
          handleUpdateNode(targetNode.id, {
            imageUrl: node.data.imageUrl,
            videoUrl: node.data.videoUrl,
            objectFit: 'cover'
          });
        } else {
          // NOTE: 重构：当媒体拖入普通节点时，将其转换为原生媒体卡片格式
          handleUpdateNode(targetNode.id, {
            imageUrl: node.data.imageUrl || undefined,
            videoUrl: node.data.videoUrl || undefined,
            audioUrl: node.data.audioUrl || undefined,
            showTextOverlay: true, // 保持文字可见
            // 自动增加高度以容纳媒体            
            style: {
              ...targetNode.style,
              height: ((targetNode.measured?.height || targetNode.style?.height as number || 200)) + 200
            }
          });
        }
        handleDeleteNode(node.id);
      }
    }
  }, [nodes, handleUpdateNode, handleDeleteNode]);

  // NOTE: 处理从桌面/文件夹拖拽媒体文件到画布
  // HACK: 使用 URL.createObjectURL 代替 FileReader.readAsDataURL，
  //       后者对大文件（尤其视频）会把整个文件转成 base64 导致极慢或内存溢出。
  //       createObjectURL 仅创建一个轻量级的 blob: 引用，与工具栏上传逻辑保持一致。
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    // 计算拖拽落点相对于 Flow 坐标系的位置
    const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
    if (!reactFlowBounds) return;

    const dropX = (event.clientX - reactFlowBounds.left - tx) / tzoom;
    const dropY = (event.clientY - reactFlowBounds.top - ty) / tzoom;

    // NOTE: 用 IIFE async 包裹，避免在循环中因闭包捕获陈旧 index 导致位置偏差
    const processFiles = async () => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
          continue;
        }

        // 使用 blob URL，高效且支持大文件/视频
        const url = URL.createObjectURL(file);
        const newId = uuidv4();

        let mediaData: Record<string, string> = {};
        let title = language === 'zh' ? '导入文件' : 'Import File';

        // NOTE: 根据媒体原始比例调整卡片尺寸，保持视觉一致
        const { width, height } = await getMediaDimensions(url, file.type);
        let displayWidth = 400;
        let displayHeight = (height / width) * displayWidth;

        if (displayHeight > 500) {
          displayHeight = 500;
          displayWidth = (width / height) * displayHeight;
        }

        if (file.type.startsWith('image/')) {
          mediaData = { imageUrl: url };
          title = language === 'zh' ? '导入图片' : 'Import Image';
        } else if (file.type.startsWith('video/')) {
          mediaData = { videoUrl: url };
          title = language === 'zh' ? '导入视频' : 'Import Video';
        } else if (file.type.startsWith('audio/')) {
          mediaData = { audioUrl: url };
          title = language === 'zh' ? '导入音频' : 'Import Audio';
          displayWidth = 300;
          displayHeight = 150;
        }

        const newNode: Node = {
          id: newId,
          type: 'storyNode',
          // 多文件时按 30px 阶梯错开，避免完全叠加
          position: {
            x: dropX + (i * 30) - (displayWidth / 2),
            y: dropY + (i * 30) - (displayHeight / 2),
          },
          style: { width: displayWidth, height: displayHeight + (showTitles ? TITLE_HEIGHT : 0) },
          data: {
            id: newId,
            title,
            shape: 'square',
            color: '#ffffff',
            text: '',
            titleHeightAdded: showTitles,
            ...mediaData,
          },
        };

        // NOTE: 每个文件独立 setNodes，避免批量更新时 async 竞态覆盖
        setNodes((nds) => [...nds, newNode]);
      }
    };

    processFiles();
  }, [tx, ty, tzoom, setNodes, showTitles, language]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const startSelection = useCallback((x: number, y: number) => {
    setIsRightDragging(true);
    startPosRef.current = { x, y };
    if (selectionBoxRef.current) {
      selectionBoxRef.current.style.display = 'none';
      selectionBoxRef.current.style.width = '0px';
      selectionBoxRef.current.style.height = '0px';
    }
  }, []);

  const updateSelection = useCallback((x: number, y: number) => {
    if (isRightDragging && startPosRef.current && selectionBoxRef.current) {
      const left = Math.min(x, startPosRef.current.x);
      const top = Math.min(y, startPosRef.current.y);
      const w = Math.abs(x - startPosRef.current.x);
      const h = Math.abs(y - startPosRef.current.y);

      selectionBoxRef.current.style.left = `${left}px`;
      selectionBoxRef.current.style.top = `${top}px`;
      selectionBoxRef.current.style.width = `${w}px`;
      selectionBoxRef.current.style.height = `${h}px`;

      if (w > 5 || h > 5) {
        selectionBoxRef.current.style.display = 'block';
      }
    }
  }, [isRightDragging]);

  const endSelection = useCallback((x: number, y: number) => {
    if (isRightDragging && startPosRef.current) {
      const dx = Math.abs(x - startPosRef.current.x);
      const dy = Math.abs(y - startPosRef.current.y);

      if (dx > 5 || dy > 5) {
        const start = screenToFlowPosition({ x: startPosRef.current.x, y: startPosRef.current.y });
        const end = screenToFlowPosition({ x, y });

        const rect = {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.abs(start.x - end.x),
          height: Math.abs(start.y - end.y),
        };

        const nodesInRect = getIntersectingNodes(rect, true);
        const nodeIds = new Set(nodesInRect.map(n => n.id));

        setNodes(nds => nds.map(n => ({
          ...n,
          selected: nodeIds.has(n.id) && !n.data?.locked
        })));
      }
    }

    if (selectionBoxRef.current) {
      selectionBoxRef.current.style.display = 'none';
    }
    setIsRightDragging(false);
    startPosRef.current = null;
  }, [isRightDragging, screenToFlowPosition, getIntersectingNodes, setNodes]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // NOTE: 右键点击 OR 在框选模式下左键点击 OR 按住 Shift 左键点击
    if (e.button === 2 || (interactionMode === 'box' && e.button === 0) || (e.shiftKey && e.button === 0)) {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, [contenteditable="true"]')) return;
      startSelection(e.clientX, e.clientY);
    }
  }, [interactionMode, startSelection]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    updateSelection(e.clientX, e.clientY);
  }, [updateSelection]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    endSelection(e.clientX, e.clientY);
  }, [endSelection]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // 手机端仅在框选模式下触发自定义框
    if (interactionMode === 'box' && e.touches.length === 1) {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, [contenteditable="true"]')) return;
      const touch = e.touches[0];
      startSelection(touch.clientX, touch.clientY);
    }
  }, [interactionMode, startSelection]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRightDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      updateSelection(touch.clientX, touch.clientY);
    }
  }, [isRightDragging, updateSelection]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isRightDragging && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      endSelection(touch.clientX, touch.clientY);
    }
  }, [isRightDragging, endSelection]);

  // Bind callbacks to nodes and edges on render
  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(n => {
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
          filter: highlightedPath && !highlightedPath.nodes.has(n.id) ? 'grayscale(0.8) blur(1px)' : 'none',
          // NOTE: 极其重要：不要在这里使用 transition: all，否则拖拽时 transform 会有延迟，导致不跟手
          transition: 'opacity 0.5s ease-in-out, filter 0.5s ease-in-out',
        }
      };
    });
    // NOTE: 补充 highlightedPath、handleAIAnalyze、toggleStorylineHighlight 为正确依赖，
    // 防止闭包过期导致这些引用读到旧值
  }, [nodes, showTitles, aiLoadingNodeId, handleUpdateNode, handleAddConnectedNode, handleDeleteNode, handleAIButtonClick, handleAIAnalyze, handleGenerateStoryNodeImage, handleGenerateSettingNodeImage, handleAddTextToImage, handleRemoveTextFromImage, handleExtractMedia, handleGenerateSettingText, handlePlotStructureGenerate, toggleStorylineHighlight, highlightedPath, pasteAsPlainText, showNodeActions, language, theme]);

  const edgesWithData = useMemo(() => {
    const hiddenNodeIds = new Set(
      nodes
        .filter(n => n.data?.hidden)
        .map(n => n.id)
    );

    return edges.map(e => {
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
          stroke: isHighlighted ? '#f43f5e' : (e.style?.stroke || '#6366f1'),
          strokeWidth: isHighlighted ? 6 : (e.style?.strokeWidth || 3),
          opacity: highlightedPath ? (isHighlighted ? 1 : 0.1) : 1,
          // NOTE: 同理，连线也只针对样式属性过渡，防止 transform 延迟          
          transition: 'stroke 0.5s ease-in-out, stroke-width 0.5s ease-in-out, opacity 0.5s ease-in-out',
        },
        animated: isHighlighted || e.animated,
      };
    });
  }, [edges, nodes, edgeStyle, handleEdgeDelete, highlightedPath]);

  return (
    <div className="w-full h-screen flex flex-col font-sans overflow-hidden text-slate-800 dark:text-slate-100 transition-colors duration-300" style={{ backgroundColor: canvasBg }}>
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
      <header className="h-14 border-b border-[var(--header-border)] bg-[var(--header-bg)] flex items-center justify-between px-6 z-20 shrink-0 shadow-sm relative">
        <div className="flex items-center gap-3">
          <img src="./icon.png" className="w-8 h-8 rounded shadow-sm shrink-0 theme-invert" alt="Logo" />
          {!isMobile && (
            <h1 className="text-lg font-normal tracking-tight whitespace-nowrap">
              <span className="text-slate-900 dark:text-white">{t.editorTitle}</span>
              <span className="text-slate-400 dark:text-slate-500 text-xs ml-2">{t.author}</span>
            </h1>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-3">
          {toolbarLayout === 'topbar' && !isMobile && (
            <div className="flex items-center gap-1 mr-4 bg-[var(--app-bg)]/50 p-1 rounded-lg border border-[var(--header-border)]">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-md hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm text-[var(--icon-color)] transition-all"
                title={t.settings}
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowTitles(!showTitles)}
                className="p-2 rounded-md hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm text-[var(--icon-color)] transition-all"
                title={showTitles ? t.hideTitles : t.showTitles}
              >
                {showTitles ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>

              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

              <button
                onClick={undo}
                disabled={history.past.length === 0}
                className="p-2 rounded-md hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm text-[var(--icon-color)] transition-all disabled:opacity-30"
                title="撤销 (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>

              <button
                onClick={redo}
                disabled={history.future.length === 0}
                className="p-2 rounded-md hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm text-[var(--icon-color)] transition-all disabled:opacity-30"
                title="重做 (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

              <div className="flex items-center gap-1.5 px-1">
                {presetColors.map((color, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCanvasBg(color)}
                    className={`w-4 h-4 rounded-full ${canvasBg === color ? 'ring-2 ring-indigo-500 ring-offset-1' : ''} border border-slate-200 dark:border-slate-700 transition-all hover:scale-110`}
                    style={{ backgroundColor: color }}
                    title={`${language === 'zh' ? '背景颜色' : 'BG Color'} ${idx + 1}`}
                  ></button>
                ))}
              </div>
            </div>
          )}

          {isMobile && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-slate-50 dark:bg-slate-800/50 text-[var(--icon-color)] rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center shadow-sm transition-colors border border-slate-200 dark:border-slate-700"
              title={t.settings}
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowPlayTest(true)}
            className="p-2 md:px-4 md:py-2 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-md hover:bg-slate-900 dark:hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all active:scale-95"
            title={t.playTest}
          >
            <PlayCircle className="w-4 h-4" />
            {!isMobile && t.playTest}
          </button>

          {canRenderVideo && (
            <button
              onClick={() => setShowVideoRender(true)}
              className="p-2 md:px-4 md:py-2 bg-sky-600 text-white text-sm font-bold rounded-md hover:bg-sky-700 flex items-center gap-2 shadow-sm transition-all active:scale-95"
              title={language === 'zh' ? '渲染视频' : 'Render Video'}
            >
              <Film className="w-4 h-4" />
              {!isMobile && (language === 'zh' ? '渲染视频' : 'Render')}
            </button>
          )}

          <button
            onClick={handleExportJSON}
            className={`p-2 rounded-md flex items-center shadow-sm transition-colors border ${isDirty ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-white border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-50 dark:bg-slate-800/50 text-[var(--icon-color)] border-slate-200 dark:border-slate-700'} hover:bg-indigo-100 dark:hover:bg-slate-700`}
            title={isDirty ? (language === 'zh' ? "有未保存的更改 - 点击保存" : "Unsaved changes - Click to save") : t.save}
          >
            <Save className="w-4 h-4" />
            {isDirty && <span className="ml-1 md:ml-1.5 text-[10px] font-bold">{t.unsaved}</span>}
          </button>

          <button
            onClick={() => jsonInputRef.current?.click()}
            className="p-2 bg-slate-50 dark:bg-slate-800/50 text-[var(--icon-color)] rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center shadow-sm transition-colors border border-slate-200 dark:border-slate-700"
            title={t.import}
          >
            <Upload className="w-4 h-4" />
          </button>
          <input type="file" accept=".zip,.json" className="hidden" ref={jsonInputRef} onChange={handleImportZIP} />
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        {/* Floating Toolbar */}
        <div
          className={`absolute ${isMobile ? 'top-20 left-4' : 'top-6 left-6'} z-20 flex flex-col gap-2 bg-[var(--toolbar-bg)] backdrop-blur p-1 rounded-2xl shadow-xl border border-[var(--toolbar-border)] transition-all duration-500 ease-in-out w-[52px] ${toolbarCollapsed ? 'h-12 overflow-hidden' : ''}`}
        >
          <button
            onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
            className="p-2.5 flex items-center justify-center text-slate-400 dark:text-slate-200 hover:text-slate-600 dark:hover:text-white transition-colors duration-300 shrink-0 mx-auto"
            title={toolbarCollapsed ? (language === 'zh' ? '展开工具栏' : 'Expand Toolbar') : (language === 'zh' ? '折叠工具栏' : 'Collapse Toolbar')}
          >
            <div className={`transition-transform duration-500 ${toolbarCollapsed ? 'rotate-0' : 'rotate-180'}`}>
              <ChevronDown className="w-6 h-6" />
            </div>
          </button>

          {!toolbarCollapsed && (
            <div className="flex flex-col gap-2 pb-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors group relative"
                onClick={() => addNewShape('square')}
                title={t.toolSquare}
              >
                <Square strokeWidth={3} className="w-5 h-5" />
              </button>

              <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                onClick={() => addNewTextNode()}
                title={t.toolText}
              >
                <Type strokeWidth={2.5} className="w-5 h-5" />
              </button>

              <div className="h-px bg-[var(--toolbar-border)]/50 w-full my-1"></div>

              {/* <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                onClick={() => addNewBackground()}
                title={t.toolBg}
              >
                <Layers strokeWidth={2.5} className="w-5 h-5" />
              </button>

              <div className="h-px bg-[var(--toolbar-border)]/50 w-full my-1"></div> */}

              <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                onClick={() => addNewCharacterNode()}
                title={language === 'zh' ? '添加人物卡片' : 'Add Character Card'}
              >
                <UserCircle2 strokeWidth={2.5} className="w-5 h-5" />
              </button>

              <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                onClick={() => addNewSceneNode()}
                title={t.toolScene}
              >
                <MapPin strokeWidth={2.5} className="w-5 h-5" />
              </button>

              <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                onClick={() => addNewPlotStructureNode()}
                title={t.toolPlotStructure}
              >
                <BookOpen strokeWidth={2.5} className="w-5 h-5" />
              </button>

              <div className="h-px bg-[var(--toolbar-border)]/50 w-full my-1"></div>

              <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                onClick={() => addNewSummaryNode()}
                title={language === 'zh' ? '文本转换/汇总' : 'Text Summary'}
              >
                <FileText strokeWidth={2.5} className="w-5 h-5" />
              </button>

              <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                onClick={() => addNewBatchReplaceNode()}
                title={t.toolBatchReplace}
              >
                <Replace strokeWidth={2.5} className="w-5 h-5" />
              </button>

              <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                onClick={() => addNewNumberConditionNode()}
                title={language === 'zh' ? '数字判断卡片' : 'Number Condition'}
              >
                <Calculator strokeWidth={2.5} className="w-5 h-5" />
              </button>

              <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                onClick={() => addNewAIHub()}
                title={t.toolAIHub}
              >
                <BrainCircuit strokeWidth={2.5} className="w-5 h-5" />
              </button>

              <div className="h-px bg-[var(--toolbar-border)]/50 w-full my-1"></div>

              <button
                className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                onClick={() => fileInputRef.current?.click()}
                title={t.toolMedia}
              >
                <ImageIcon strokeWidth={2.5} className="w-5 h-5" />
              </button>


              {isMobile && (
                <>
                  <div className="h-px bg-slate-100 w-full my-1"></div>
                  <button
                    onClick={undo}
                    disabled={history.past.length === 0}
                    className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors disabled:opacity-30"
                    title="Undo"
                  >
                    <Undo2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={redo}
                    disabled={history.future.length === 0}
                    className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors disabled:opacity-30"
                    title="Redo"
                  >
                    <Redo2 className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          )}
          <input type="file" accept="image/*,video/*,audio/*" className="hidden" ref={fileInputRef} onChange={handleMediaUpload} multiple />

          {nodes.some(n => n.data?.hidden) && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center">
              <button
                className="p-2.5 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors animate-pulse"
                onClick={unhideAllNodes}
                title={t.unhideAll}
              >
                <Eye className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Floating Toolbar */}
        {!isMobile && toolbarLayout !== 'topbar' && (
          <div
            className={`absolute top-6 right-6 z-20 flex ${toolbarLayout === 'horizontal' ? 'flex-row-reverse' : 'flex-col'} gap-2 bg-[var(--toolbar-bg)] backdrop-blur p-1.5 rounded-2xl shadow-xl border border-[var(--toolbar-border)] transition-all duration-500 ease-in-out ${toolbarLayout === 'horizontal' ? 'h-[52px]' : 'w-[52px]'} ${rightToolbarCollapsed ? (toolbarLayout === 'horizontal' ? 'w-12 overflow-hidden' : 'h-12 overflow-hidden') : ''}`}
          >
            <button
              onClick={() => setRightToolbarCollapsed(!rightToolbarCollapsed)}
              className={`${toolbarLayout === 'horizontal' ? 'w-10 h-10' : 'w-10 h-10'} flex items-center justify-center text-slate-400 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-white transition-all duration-300 shrink-0 mx-auto`}
              title={rightToolbarCollapsed ? (language === 'zh' ? '展开工具栏' : 'Expand Toolbar') : (language === 'zh' ? '折叠工具栏' : 'Collapse Toolbar')}
            >
              <div className={`transition-transform duration-500 ${rightToolbarCollapsed ? 'rotate-0' : (toolbarLayout === 'horizontal' ? '-rotate-90' : 'rotate-180')}`}>
                <ChevronDown className="w-6 h-6" />
              </div>
            </button>

            {!rightToolbarCollapsed && (
              <div className={`flex ${toolbarLayout === 'horizontal' ? 'flex-row-reverse items-center pr-2' : 'flex-col pb-2'} gap-2 animate-in fade-in slide-in-from-top-2 duration-300`}>
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--icon-color)] transition-colors"
                  title={t.settings}
                >
                  <Settings className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setShowTitles(!showTitles)}
                  className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors"
                  title={showTitles ? t.hideTitles : t.showTitles}
                >
                  {showTitles ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>

                <div className="h-px bg-[var(--toolbar-border)]/50 w-full my-1"></div>

                <button
                  onClick={undo}
                  disabled={history.past.length === 0}
                  className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors disabled:opacity-30"
                  title="撤销 (Ctrl+Z)"
                >
                  <Undo2 className="w-5 h-5" />
                </button>

                <button
                  onClick={redo}
                  disabled={history.future.length === 0}
                  className="p-2.5 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--icon-color)] transition-colors disabled:opacity-30"
                  title="重做 (Ctrl+Y)"
                >
                  <Redo2 className="w-5 h-5" />
                </button>

                <div className="h-px bg-[var(--toolbar-border)]/50 w-full my-1"></div>

                <div className={`flex ${toolbarLayout === 'horizontal' ? 'flex-row' : 'flex-col'} items-center gap-2 py-1`}>
                  {presetColors.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCanvasBg(color)}
                      className={`w-6 h-6 rounded-full ${canvasBg === color ? 'ring-2 ring-indigo-500 ring-offset-2' : ''} border border-slate-200 dark:border-slate-700 transition-all hover:scale-110`}
                      style={{ backgroundColor: color }}
                      title={`${language === 'zh' ? '背景颜色' : 'BG Color'} ${idx + 1}`}
                    ></button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div
          ref={canvasWrapperRef}
          className="w-full h-full relative"
          onMouseDownCapture={handleMouseDown}
          onMouseMoveCapture={handleMouseMove}
          onMouseUpCapture={handleMouseUp}
          onTouchStartCapture={handleTouchStart}
          onTouchMoveCapture={handleTouchMove}
          onTouchEndCapture={handleTouchEnd}
          style={{ touchAction: (interactionMode === 'box' || isRightDragging) ? 'none' : 'auto' }}
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
              if (node.data?.locked && (node.type === 'backgroundNode' || node.type === 'groupNode')) {
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
            panOnDrag={isRightDragging ? false : (interactionMode === 'select' ? [0] : false)}
            selectionOnDrag={false}
            selectionMode="partial"
            panOnScroll={scrollMode === 'pan'}
            zoomOnScroll={scrollMode === 'zoom'}
            panOnScrollMode={scrollMode === 'pan' ? 'vertical' : undefined}
            selectionKeyCode="Shift"
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
            fitView
            minZoom={0.1}
            maxZoom={1.5}
          >
            <Background variant={BackgroundVariant.Dots} color={theme === 'dark' ? '#334155' : '#cbd5e1'} gap={24} size={1} />
            {showMiniMap && (
              <div className="absolute right-4 bottom-4 z-[50] bg-[var(--toolbar-bg)] backdrop-blur-md border border-[var(--toolbar-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                <MiniMap
                  pannable={true}
                  zoomable={true}
                  className="!static !bg-transparent !border-none !m-0"
                  style={{ height: 120, width: 160 }}
                />
                {showControls && (
                  <div className="border-t border-[var(--toolbar-border)] flex items-center h-8 bg-[var(--app-bg)]/30 backdrop-blur-sm">
                    <Controls
                      showInteractive={false}
                      showZoom={true}
                      showFit={true}
                      showLock={false}
                      orientation="horizontal"
                      className="!static !m-0 !flex !flex-row !bg-transparent !border-none !shadow-none !gap-0 !w-full !justify-around !items-center !h-full !p-0"
                    />
                  </div>
                )}
              </div>
            )}
            {!showMiniMap && showControls && (
              <div className="absolute right-4 bottom-4 z-[50] bg-[var(--toolbar-bg)] backdrop-blur-md border border-[var(--toolbar-border)] rounded-lg shadow-xl overflow-hidden p-0.5 animate-in slide-in-from-bottom-4 duration-300">
                <Controls
                  showInteractive={false}
                  showZoom={true}
                  showFit={true}
                  showLock={false}
                  orientation="horizontal"
                  className="!static !m-0 !flex !flex-row !bg-transparent !border-none !shadow-none !gap-0"
                />
              </div>
            )}
            <SmartGuides hLines={horizontalGuides} vLines={verticalGuides} />
          </ReactFlow>
        </div>

        {/* Selection Context Menu */}
        {showSelectionMenu && (
          <div
            ref={selectionMenuRef}
            className={`fixed left-0 top-0 z-[100] flex ${selectionMenuLayout === 'horizontal' ? 'items-center gap-1 flex-nowrap shrink-0' : 'flex-col gap-1 w-40'} bg-[var(--toolbar-bg)] backdrop-blur-md p-1.5 rounded-xl shadow-2xl border border-[var(--toolbar-border)]`}
            style={{ transform: 'translate3d(var(--selection-menu-x, -9999px), var(--selection-menu-y, -9999px), 0) translate(-50%, -100%)', willChange: 'transform' }}
          >
            <button
              onClick={wrapWithDynamicGroup}
              className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${selectionMenuLayout === 'vertical' ? 'w-full' : ''}`}
              title={t.dynamicWrap}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className={selectionMenuLayout === 'horizontal' ? 'whitespace-nowrap' : ''}>{t.dynamicWrap}</span>
            </button>

            {selectionMenuLayout === 'horizontal' ? (
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
            ) : (
              <div className="h-px w-full bg-slate-200 dark:bg-slate-700 my-0.5" />
            )}

            <button
              onClick={wrapSelectedWithBackground}
              className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-white hover:text-indigo-600 dark:hover:text-[var(--accent)] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${selectionMenuLayout === 'vertical' ? 'w-full' : ''}`}
              title={t.bgCard}
            >
              <Square className="w-4 h-4 shrink-0" />
              <span className={selectionMenuLayout === 'horizontal' ? 'whitespace-nowrap' : ''}>{t.bgCard}</span>
            </button>

            {selectionMenuLayout === 'horizontal' ? (
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
            ) : (
              <div className="h-px w-full bg-slate-200 dark:bg-slate-700 my-0.5" />
            )}

            <button
              onClick={connectSelectedToAIHub}
              className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-white hover:text-indigo-600 dark:hover:text-[var(--accent)] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${selectionMenuLayout === 'vertical' ? 'w-full' : ''}`}
              title={t.connectToAIHub}
            >
              <BrainCircuit className="w-4 h-4 shrink-0" />
              <span className={selectionMenuLayout === 'horizontal' ? 'whitespace-nowrap' : ''}>{t.connectToAIHub}</span>
            </button>

            {selectionMenuLayout === 'horizontal' ? (
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
            ) : (
              <div className="h-px w-full bg-slate-200 dark:bg-slate-700 my-0.5" />
            )}

            <button
              onClick={connectSelectedToSummaryNode}
              className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-[var(--icon-color)] hover:text-indigo-600 dark:hover:text-[var(--accent)] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${selectionMenuLayout === 'vertical' ? 'w-full' : ''}`}
              title={language === 'zh' ? '批量文本导出' : 'Batch Export'}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className={selectionMenuLayout === 'horizontal' ? 'whitespace-nowrap' : ''}>{language === 'zh' ? '批量文本导出' : 'Batch Export'}</span>
            </button>


            {selectionMenuLayout === 'horizontal' ? (
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
            ) : (
              <div className="h-px w-full bg-slate-200 dark:bg-slate-700 my-0.5" />
            )}

            <button
              onClick={handleGenerateSelectedSpeech}
              disabled={ttsLoading}
              className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg transition-all shrink-0 disabled:opacity-50 ${selectionMenuLayout === 'vertical' ? 'w-full' : ''}`}
              title={language === 'zh' ? '生成朗读音频' : 'Generate narration audio'}
            >
              <Volume2 className={`w-4 h-4 shrink-0 ${ttsLoading ? 'animate-pulse' : ''}`} />
              <span className={selectionMenuLayout === 'horizontal' ? 'whitespace-nowrap' : ''}>{language === 'zh' ? '生成朗读音频' : 'Narration'}</span>
            </button>

            {selectionMenuLayout === 'horizontal' ? (
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
            ) : (
              <div className="h-px w-full bg-slate-200 dark:bg-slate-700 my-0.5" />
            )}

            <button
              onClick={deleteSelected}
              className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all shrink-0 ${selectionMenuLayout === 'vertical' ? 'w-full' : ''}`}
              title={language === 'zh' ? '删除' : 'Delete'}
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span className={selectionMenuLayout === 'horizontal' ? 'whitespace-nowrap' : ''}>{language === 'zh' ? '删除' : 'Delete'}</span>
            </button>

            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-white hover:text-indigo-600 dark:hover:text-[var(--accent)] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${selectionMenuLayout === 'vertical' ? 'w-full' : ''}`}
              title={language === 'zh' ? '复制' : 'Copy'}
            >
              <Copy className="w-4 h-4 shrink-0" />
              <span className={selectionMenuLayout === 'horizontal' ? 'whitespace-nowrap' : ''}>{language === 'zh' ? '复制' : 'Copy'}</span>
            </button>

            <button
              onClick={hideSelected}
              className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-white hover:text-indigo-600 dark:hover:text-[var(--accent)] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${selectionMenuLayout === 'vertical' ? 'w-full' : ''}`}
              title={language === 'zh' ? '隐藏' : 'Hide'}
            >
              <EyeOff className="w-4 h-4 shrink-0" />
              <span className={selectionMenuLayout === 'horizontal' ? 'whitespace-nowrap' : ''}>{language === 'zh' ? '隐藏' : 'Hide'}</span>
            </button>
          </div>
        )}
      </div>

      {!isMobile && showStats && (
        <footer className="h-8 bg-white dark:bg-black text-slate-500 dark:text-white border-t border-slate-100 dark:border-white/5 flex items-center justify-between px-4 text-[10px] font-bold tracking-wide z-20 shrink-0 transition-colors">
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-[var(--accent)]" /> {t.nodes}: {nodes.length}</span>
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-[var(--accent)]" /> {t.paths}: {edges.length}</span>
          </div>
          <div className="opacity-60 font-medium">
            {t.footerHint}
          </div>
        </footer>
      )}

      {/* 思考内容右上角浮层：DeepSeek思考模式下短暂显示 */}
      {thinkingContent && (
        <div
          className="fixed top-20 right-20 z-[500] max-w-sm w-80 bg-slate-900/95 border border-indigo-500/40 rounded-xl shadow-2xl p-4 backdrop-blur-md animate-in slide-in-from-right-4 duration-300"
          style={{ maxHeight: '50vh', overflowY: 'auto' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-indigo-300 text-xs font-semibold uppercase tracking-wider">{language === 'zh' ? 'AI 思考中...' : 'AI Thinking...'}</span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{thinkingContent}</p>
        </div>
      )}

      {/* AI 操作选择弹窗 */}
      {showAIActionModal && pendingAINodeId && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-[300] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => { setShowAIActionModal(false); setPendingAINodeId(null); }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 md:p-6 w-full max-w-sm animate-in slide-in-from-bottom-4 duration-300 border border-transparent dark:border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">{t.aiAssistant}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">{t.aiChooseMethod}</p>
            <div className="flex flex-col gap-3">
              {/* NOTE: 根据用户在设置中配置的 aiButtonsConfig 动态显示/隐藏各按钮 */}
              {aiButtonsConfig.continue && (
                <button
                  id="ai-action-continue"
                  onClick={() => handleAIGenerate(pendingAINodeId, 'continue')}
                  className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all text-left group"
                >
                  <span className="text-xl mt-0.5">✍️</span>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{t.aiContinue}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.aiContinueDesc}</div>
                  </div>
                </button>
              )}
              {aiButtonsConfig.creative && (
                <button
                  id="ai-action-creative"
                  onClick={() => handleAIGenerate(pendingAINodeId, 'creative')}
                  className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 border-purple-100 dark:border-purple-900/50 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all text-left group"
                >
                  <span className="text-xl mt-0.5">💡</span>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-purple-700 dark:group-hover:text-purple-400">{t.aiCreative}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.aiCreativeDesc}</div>
                  </div>
                </button>
              )}
              {aiButtonsConfig.rewrite && (
                <button
                  id="ai-action-rewrite"
                  onClick={() => handleAIGenerate(pendingAINodeId, 'rewrite')}
                  className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 border-amber-100 dark:border-amber-900/50 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all text-left group"
                >
                  <span className="text-xl mt-0.5">🔄</span>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-amber-700 dark:group-hover:text-amber-400">{t.aiRewrite}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.aiRewriteDesc}</div>
                  </div>
                </button>
              )}
              {aiButtonsConfig.interpolate && (
                <button
                  id="ai-action-interpolate"
                  onClick={() => handleAIGenerate(pendingAINodeId, 'interpolate')}
                  className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 border-green-100 dark:border-green-900/50 hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/30 transition-all text-left group"
                >
                  <span className="text-xl mt-0.5">🧩</span>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-green-700 dark:group-hover:text-green-400">{t.aiInterpolate}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.aiInterpolateDesc}</div>
                  </div>
                </button>
              )}
              {aiButtonsConfig.scene_only && (
                <button
                  id="ai-action-scene"
                  onClick={() => handleAIGenerate(pendingAINodeId, 'scene_only')}
                  className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 border-sky-100 dark:border-sky-900/50 hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-all text-left group"
                >
                  <span className="text-xl mt-0.5">🏞</span>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-sky-700 dark:group-hover:text-sky-400">{t.aiSceneOnly}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.aiSceneOnlyDesc}</div>
                  </div>
                </button>
              )}
              {aiButtonsConfig.dialogue_only && (
                <button
                  id="ai-action-dialogue"
                  onClick={() => handleAIGenerate(pendingAINodeId, 'dialogue_only')}
                  className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 border-rose-100 dark:border-rose-900/50 hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all text-left group"
                >
                  <span className="text-xl mt-0.5">💬</span>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-rose-700 dark:group-hover:text-rose-400">{t.aiDialogueOnly}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.aiDialogueOnlyDesc}</div>
                  </div>
                </button>
              )}
            </div>
            <button
              onClick={() => { setShowAIActionModal(false); setPendingAINodeId(null); }}
              className="mt-4 w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

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
      {showAutoSaveModal && autoSaveDataRef.current && (
        <div className="fixed inset-0 bg-slate-900/60 z-[1200] flex items-center justify-center backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] p-10 w-full max-w-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center">
            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
              <FileArchive className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{language === 'zh' ? '发现未保存的进度' : 'Unsaved Progress Found'}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 text-center leading-relaxed">
              {language === 'zh'
                ? `系统检测到异常退出前有未保存的进度（${new Date(autoSaveDataRef.current.timestamp).toLocaleTimeString()}）。是否恢复？`
                : `Detected unsaved progress from ${new Date(autoSaveDataRef.current.timestamp).toLocaleTimeString()}. Do you want to recover it?`}
            </p>

            <div className="flex gap-4 w-full">
              <button
                onClick={async () => {
                  await clearAutoSave();
                  setShowAutoSaveModal(false);
                }}
                className="flex-1 py-3 rounded-xl border-2 border-slate-100 text-slate-400 font-bold hover:bg-slate-50 transition-all"
              >
                {language === 'zh' ? '放弃进度' : 'Discard'}
              </button>
              <button
                onClick={() => {
                  try {
                    const data = JSON.parse(autoSaveDataRef.current!.snapshot);
                    setNodes(data.nodes);
                    setEdges(data.edges.map((edge: any) => ({
                      ...edge,
                      type: 'customEdge',
                      markerEnd: defaultEdgeOptions.markerEnd,
                      style: defaultEdgeOptions.style
                    })));
                    if (data.settings) {
                      if (data.settings.canvasBg) setCanvasBg(data.settings.canvasBg);
                      if (data.settings.edgeStyle) setEdgeStyle(data.settings.edgeStyle);
                      if (data.settings.customApiKey) setCustomApiKey(data.settings.customApiKey);
                      if (data.settings.pasteAsPlainText !== undefined) setPasteAsPlainText(data.settings.pasteAsPlainText);
                      if (data.settings.showNodeActions !== undefined) setShowNodeActions(data.settings.showNodeActions);
                      if (data.settings.showStats !== undefined) setShowStats(data.settings.showStats);
                      if (data.settings.presetColors) setPresetColors(data.settings.presetColors);
                      if (data.settings.showTitles !== undefined) setShowTitles(data.settings.showTitles);
                      if (data.settings.generateLength) setGenerateLength(data.settings.generateLength);
                      if (data.settings.aiProvider) setAiProvider(data.settings.aiProvider);
                      if (data.settings.deepseekApiKey) setDeepseekApiKey(data.settings.deepseekApiKey);
                      if (data.settings.openaiApiKey) setOpenaiApiKey(data.settings.openaiApiKey);
                      if (data.settings.imageApiKey) setImageApiKey(data.settings.imageApiKey);
                      if (data.settings.imageApiUrl) setImageApiUrl(data.settings.imageApiUrl);
                      if (data.settings.imageModel) setImageModel(data.settings.imageModel);
                      if (data.settings.imageSize) setImageSize(data.settings.imageSize);
                      if (data.settings.ttsApiKey) setTtsApiKey(data.settings.ttsApiKey);
                      if (data.settings.ttsApiUrl) setTtsApiUrl(data.settings.ttsApiUrl);
                      if (data.settings.ttsModel) setTtsModel(data.settings.ttsModel);
                      if (data.settings.ttsVoice) setTtsVoice(data.settings.ttsVoice);
                      if (data.settings.thinkingMode !== undefined) setThinkingMode(data.settings.thinkingMode);
                      if (data.settings.showMiniMap !== undefined) setShowMiniMap(data.settings.showMiniMap);
                      if (data.settings.showControls !== undefined) setShowControls(data.settings.showControls);
                      if (data.settings.scrollMode) setScrollMode(data.settings.scrollMode);
                      if (data.settings.toolbarLayout) setToolbarLayout(data.settings.toolbarLayout);
                      if (data.settings.selectionMenuLayout) setSelectionMenuLayout(data.settings.selectionMenuLayout);
                      if (data.settings.language) setLanguage(data.settings.language);
                      if (data.settings.theme) setTheme(data.settings.theme);
                      if (data.settings.playTestDarkMode !== undefined) setPlayTestDarkMode(data.settings.playTestDarkMode);
                      if (data.settings.playTestChoicesColumns !== undefined) setPlayTestChoicesColumns(data.settings.playTestChoicesColumns);
                      if (data.settings.playTestVideoAutoPlay !== undefined) setPlayTestVideoAutoPlay(data.settings.playTestVideoAutoPlay);
                      if (data.settings.playTestLayoutMode) setPlayTestLayoutMode(data.settings.playTestLayoutMode);

                      if (data.settings.playTestInteractionMode) setPlayTestInteractionMode(data.settings.playTestInteractionMode);
                      if (data.settings.playTestTypewriterSpeed !== undefined) setPlayTestTypewriterSpeed(data.settings.playTestTypewriterSpeed);
                      if (data.settings.playTestChoiceDelay !== undefined) setPlayTestChoiceDelay(data.settings.playTestChoiceDelay);
                      if (data.settings.playTestChoicesPosition) setPlayTestChoicesPosition(data.settings.playTestChoicesPosition);
                      if (data.settings.playTestBlurBackground !== undefined) setPlayTestBlurBackground(data.settings.playTestBlurBackground);
                      if (data.settings.playTestBlurText !== undefined) setPlayTestBlurText(data.settings.playTestBlurText);
                      if (data.settings.playTestSkipSingleChoicePopup !== undefined) setPlayTestSkipSingleChoicePopup(data.settings.playTestSkipSingleChoicePopup);
                      if (data.settings.playTestDimBackground !== undefined) setPlayTestDimBackground(data.settings.playTestDimBackground);
                    }
                    showToast(language === 'zh' ? '已恢复进度，请记得手动保存' : 'Progress recovered, please remember to save');
                  } catch (e) {
                    console.error("Failed to restore autosave", e);
                  }
                  setShowAutoSaveModal(false);
                }}
                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                {language === 'zh' ? '恢复进度' : 'Recover'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 保存文件名弹窗 */}
      {showSaveNameModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[1200] flex items-center justify-center backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] p-10 w-full max-w-sm animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800 flex flex-col items-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
              <Save className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">{t.exportProject}</h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs mb-8 text-center leading-relaxed">
              {t.saveProjectDesc}
            </p>

            <div className="w-full space-y-6">
              <div>
                <div className="relative group">
                  <input
                    type="text"
                    value={saveFileName}
                    onChange={(e) => setSaveFileName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmExportJSON()}
                    className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all pr-20 text-slate-700 dark:text-slate-200 font-bold text-lg"
                    placeholder={t.projectName}
                    autoFocus
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-base group-focus-within:text-indigo-400">.json</span>
                </div>
              </div>

              <div className="flex gap-4 w-full">
                <button
                  onClick={() => setShowSaveNameModal(false)}
                  className="flex-1 py-4 rounded-2xl border-2 border-slate-100 text-slate-400 font-bold hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-95"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={confirmExportJSON}
                  className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                >
                  {t.confirmSave}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zen Mode Overlay */}
      <Suspense fallback={null}>
        {zenModeNodeId && (() => {
          const node = nodes.find(n => n.id === zenModeNodeId);
          const characterTags = node
            ? nodes
              .filter(n => n.type === 'characterNode' && (n.data?.characterName as string)?.trim())
              .filter(n => {
                const isGlobal = n.data?.isGlobal !== false;
                const isConnected = edges.some(
                  e =>
                    (e.source === n.id && e.target === node.id) ||
                    (e.target === n.id && e.source === node.id)
                );
                return isGlobal || isConnected;
              })
              .map(n => ({ id: n.id, name: (n.data.characterName as string).trim() }))
            : [];
          const sceneTags = node
            ? nodes
              .filter(n => n.type === 'sceneNode' && (n.data?.sceneName as string)?.trim())
              .filter(n => {
                const isGlobal = n.data?.isGlobal !== false;
                const isConnected = edges.some(
                  e =>
                    (e.source === n.id && e.target === node.id) ||
                    (e.target === n.id && e.source === node.id)
                );
                return isGlobal || isConnected;
              })
              .map(n => ({ id: n.id, name: (n.data.sceneName as string).trim() }))
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
              onChange={val => handleUpdateNode(zenModeNodeId, { text: val })}
              onClose={() => setZenModeNodeId(null)}
            />
          );
        })()}
      </Suspense>

      {/* Global Toast Notification */}
      <div
        className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[3000] px-6 py-3 bg-slate-800 text-white text-sm font-bold rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 transition-all duration-500 ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'}`}
      >
        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
          <Check className="w-4 h-4 text-white" />
        </div>
        {toast.message}
      </div>
    </div>
  );
}
