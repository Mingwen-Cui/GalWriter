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
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { AgentOverlay } from '../agent/animation/AgentOverlay';
import type {
  AssistantCardDraft,
  AssistantCardPlacementMode,
  AssistantCardPlacementOptions,
} from '../agent/planning/agentCardDraft';
import { useAgentRuntime } from '../agent/runtime/useAgentRuntime';
import { useAIActions } from '../editor-features/ai/useAIActions';
import {
  type AssistantCardPlacementResult,
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
  isLocalStableDiffusionProvider,
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
import { localPersistenceService } from '../editor-services/localPersistenceService';
import { createProjectSerializer } from '../editor-services/projectSerializer';
import { createProjectThumbnail } from '../editor-services/projectThumbnail';
import { stableStringify } from '../lib/stableStringify';
import { ttsService } from '../editor-services/ttsService';
import { useAutoSave } from '../editor-services/useAutoSave';
import { AIActionModal } from '../editor-shell/AIActionModal';
import { AssistantPanel } from '../editor-shell/AssistantPanel';
import { AutoSaveRecoveryModal } from '../editor-shell/AutoSaveRecoveryModal';
import { EditorHeader } from '../editor-shell/EditorHeader';
import { EditorLeftToolbar } from '../editor-shell/EditorLeftToolbar';
import { EditorRightToolbar } from '../editor-shell/EditorRightToolbar';
import { EditorToast } from '../editor-shell/EditorToast';
import { ConfirmActionModal } from '../editor-shell/ConfirmActionModal';
import { useDialog } from '../editor-shell/DialogProvider';
import { ProjectSavePromptModal } from '../editor-shell/ProjectSavePromptModal';
import { SaveProjectModal } from '../editor-shell/SaveProjectModal';
import {
  type AssistantTask,
  type AIButtonsConfig,
  type AIGenerationBalance,
  type AIPromptsConfig,
  defaultAIButtonsConfig,
  defaultAIPrompts,
} from '../editor-state/editorConfig';
import type {
  BackgroundRemovalAIProfile,
  CharacterImageMode,
  ImageAIProfile,
  ProjectAIProfilesExport,
  SavedAIProfile,
  CharacterNodeData,
  CharacterPresentation,
  InlinePresentationActionType,
  SceneNodeData,
  SceneImageMode,
  NumberConditionNodeData,
  PlotStructureGenerateDirection,
  StoryAudioClip,
  StoryPresentation,
  StoryTitlePlacement,
  StoryNodeData,
  TextAIProfile,
  TtsNarrationMode,
  VoiceAIProfile,
} from '../domain/project';
import { usePlaytestSettings } from '../editor-state/usePlaytestSettings';
import { useSharedRenderStyle } from '../editor-state/useSharedRenderStyle';
import { Language, translations } from '../lib/i18n';
import {
  HOSTED_IMAGE_PROXY_PROFILE,
  HOSTED_IMAGE_PROXY_PROFILE_ID,
  HOSTED_PROXY_PROFILE,
  HOSTED_PROXY_PROFILE_ID,
  HOSTED_VOICE_PROXY_PROFILE,
  HOSTED_VOICE_PROXY_PROFILE_ID,
} from '../lib/hostedProxy';
import {
  createCharacterPresentation,
  createInlinePresentationAction,
  createPresentationMotion,
  createScenePresentation,
  normalizeStoryPresentation,
} from '../lib/presentation';
import {
  expandBackgroundToFitNodes,
  formatRegionStoryForPrompt,
  parseGeneratedPlotCards,
} from '../lib/plotStructure';
import { getTauriInvoke, isTauriRuntime } from '../lib/tauriRuntime';
import type { PlotStructureGenerateParams } from './PlotStructureNode';
import { ProjectPickerModal, type ProjectExampleTemplate } from './ProjectPickerModal';
import { nodeTypes, edgeTypes } from './story-editor/flowTypes';
import {
  PlayTestModal,
  SettingsModal,
  VideoRenderModal,
  ZenEditor,
} from './story-editor/lazyModals';
import { getSettingRename, replaceMentionNameInText } from './story-editor/nodeRename';
import { SmartGuides } from './story-editor/SmartGuides';
import { syncCloseButtonBehavior } from './story-editor/windowBehavior';

const DEFAULT_TTS_API_URL = 'https://openapi.youdao.com/ttsapi';
const DEFAULT_TTS_MODEL = '';
const DEFAULT_TTS_VOICE = 'youxiaoqin';
const DEFAULT_TEXT_MODEL = 'deepseek-chat';
type CloseButtonBehavior = 'minimize' | 'quit';
const APP_TITLE = '交互式剧本编辑器';
const PROJECT_TITLE_PLACEHOLDER = '新建项目';
const DEFAULT_PROJECT_FILE_NAME = '新建项目';
const AI_STORY_CARD_WIDTH = 300;
const AI_STORY_CARD_HEIGHT = 220;
const AI_SETTING_CARD_LAYOUT_HEIGHT = 430;
const AI_SETTING_CARD_LAYOUT_FIELD_HEIGHT = 92;
const DEFAULT_LIGHT_ACCENT_COLOR = '#4f46e5';
const DEFAULT_DARK_ACCENT_COLOR = '#54b9fb';
const DEFAULT_EDGE_COLOR = '#6366f1';
const DEFAULT_ARROW_SIZE = 20;
const DEFAULT_ARROW_CORNER_RADIUS = 2;
const DEFAULT_ARROW_TIP_ANGLE = 60;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_ROOT_STORY_TITLE = '开始';
const DEFAULT_ROOT_STORY_TEXT = '从前有座山';
const DEFAULT_ROOT_STORY_TEXT_VARIANTS = new Set([DEFAULT_ROOT_STORY_TEXT, '从前有一座山']);

const normalizeStoryPlainText = (value: unknown) =>
  String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, '')
    .replace(/[.。…]+$/g, '');

const isHexColor = (color: string) => HEX_COLOR_PATTERN.test(color);

const clampColorChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const mixHexColor = (color: string, target: '#000000' | '#ffffff', amount: number) => {
  if (!isHexColor(color)) return color;
  const sourceValue = Number.parseInt(color.slice(1), 16);
  const targetValue = Number.parseInt(target.slice(1), 16);
  const source = {
    r: (sourceValue >> 16) & 255,
    g: (sourceValue >> 8) & 255,
    b: sourceValue & 255,
  };
  const mixed = {
    r: clampColorChannel(source.r + (((targetValue >> 16) & 255) - source.r) * amount),
    g: clampColorChannel(source.g + (((targetValue >> 8) & 255) - source.g) * amount),
    b: clampColorChannel(source.b + ((targetValue & 255) - source.b) * amount),
  };

  return `#${[mixed.r, mixed.g, mixed.b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
};

const resolveAccentColor = (accentColor: string, resolvedTheme: 'light' | 'dark') =>
  isHexColor(accentColor)
    ? accentColor
    : resolvedTheme === 'dark'
      ? DEFAULT_DARK_ACCENT_COLOR
      : DEFAULT_LIGHT_ACCENT_COLOR;

const isDefaultInitialStoryNode = (node: Node) =>
  node.type === 'storyNode' &&
  node.id === 'root' &&
  String(node.data?.title || '') === DEFAULT_ROOT_STORY_TITLE &&
  DEFAULT_ROOT_STORY_TEXT_VARIANTS.has(normalizeStoryPlainText(node.data?.text));
type PendingProjectAction =
  | { type: 'create' }
  | { type: 'open'; projectId: string }
  | { type: 'import-new' }
  | { type: 'import-example'; template: ProjectExampleTemplate }
  | { type: 'close-window' };

const EXAMPLES_MANIFEST_URL = 'examples/manifest.json';

const resolveExampleAssetUrl = (path: string) => {
  if (/^(?:https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  if (typeof window === 'undefined') return path;
  return new URL(path, new URL(EXAMPLES_MANIFEST_URL, window.location.href)).toString();
};

const normalizeExampleTemplates = (manifest: unknown): ProjectExampleTemplate[] => {
  const examples = (manifest as { examples?: unknown })?.examples;
  if (!Array.isArray(examples)) return [];

  return examples
    .map((entry, index): ProjectExampleTemplate | null => {
      const item = entry as Record<string, unknown>;
      const file = typeof item.file === 'string' ? item.file.trim() : '';
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!file || !title) return null;

      const thumbnail = typeof item.thumbnail === 'string' ? item.thumbnail.trim() : '';
      const id =
        typeof item.id === 'string' && item.id.trim()
          ? item.id.trim()
          : `${file.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'template'}-${index}`;

      return {
        id,
        title,
        file: resolveExampleAssetUrl(file),
        description: typeof item.description === 'string' ? item.description.trim() : undefined,
        thumbnail: thumbnail ? resolveExampleAssetUrl(thumbnail) : undefined,
        sizeLabel: typeof item.sizeLabel === 'string' ? item.sizeLabel.trim() : undefined,
      } satisfies ProjectExampleTemplate;
    })
    .filter((entry): entry is ProjectExampleTemplate => Boolean(entry));
};

type AssistantMentionReference = {
  id: string;
  kind: 'character' | 'scene';
  name: string;
  prependIfMissing?: boolean;
};

type AssistantMentionUsage = {
  id: string;
  reference: AssistantMentionReference;
  placement: 'start' | 'end' | 'inline';
};

const escapeAssistantStoryText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br />');

const createAssistantMentionHtml = (
  kind: AssistantMentionReference['kind'],
  name: string,
  id: string,
) => {
  const safeName = escapeAssistantStoryText(name);
  return `<span class="mention-chip mention-chip-${kind}" data-mention-kind="${kind}" data-mention-name="${safeName}" data-mention-id="${id}" contenteditable="false" draggable="false">@${safeName}</span>`;
};

interface StoryEditorProps {
  appLanguage: Language;
  onAppLanguageChange: (language: Language) => void;
}

const hasAssistantPlainText = (value: string) => /[\p{L}\p{N}]/u.test(value);

const insertAssistantMentionTags = (rawText: string, references: AssistantMentionReference[]) => {
  const text = rawText.trim();
  const uniqueReferences = references
    .filter((reference) => reference.name.trim())
    .filter(
      (reference, index, list) =>
        list.findIndex((item) => item.kind === reference.kind && item.name === reference.name) ===
        index,
    )
    .sort((left, right) => right.name.length - left.name.length);

  if (!text || uniqueReferences.length === 0) {
    return {
      html: text,
      usedReferences: [] as AssistantMentionReference[],
      mentionUsages: [] as AssistantMentionUsage[],
    };
  }

  if (/data-mention-kind=/i.test(text)) {
    const usedReferences = uniqueReferences.filter((reference) =>
      text.includes(`data-mention-name="${reference.name}"`),
    );
    const hasCharacterTag = usedReferences.some((reference) => reference.kind === 'character');
    const hasSceneTag = usedReferences.some((reference) => reference.kind === 'scene');
    const fallbackScene =
      uniqueReferences.find(
        (reference) => reference.kind === 'scene' && reference.prependIfMissing,
      ) || uniqueReferences.find((reference) => reference.kind === 'scene');
    if (hasCharacterTag && !hasSceneTag && fallbackScene) {
      const id = uuidv4();
      return {
        html: `${createAssistantMentionHtml(fallbackScene.kind, fallbackScene.name, id)}${text}`,
        usedReferences: [fallbackScene, ...usedReferences],
        mentionUsages: [{ id, reference: fallbackScene, placement: 'start' }],
      };
    }
    return { html: text, usedReferences, mentionUsages: [] as AssistantMentionUsage[] };
  }

  const usedReferences: AssistantMentionReference[] = [];
  const mentionUsages: AssistantMentionUsage[] = [];
  let cursor = 0;
  let html = '';

  while (cursor < text.length) {
    const match = uniqueReferences
      .map((reference) => ({ reference, index: text.indexOf(reference.name, cursor) }))
      .filter((candidate) => candidate.index >= 0)
      .sort(
        (left, right) =>
          left.index - right.index || right.reference.name.length - left.reference.name.length,
      )[0];

    if (!match) {
      html += escapeAssistantStoryText(text.slice(cursor));
      break;
    }

    html += escapeAssistantStoryText(text.slice(cursor, match.index));
    const id = uuidv4();
    html += createAssistantMentionHtml(match.reference.kind, match.reference.name, id);
    if (
      !usedReferences.some(
        (used) => used.kind === match.reference.kind && used.name === match.reference.name,
      )
    ) {
      usedReferences.push(match.reference);
    }
    mentionUsages.push({
      id,
      reference: match.reference,
      placement: hasAssistantPlainText(text.slice(0, match.index))
        ? hasAssistantPlainText(text.slice(match.index + match.reference.name.length))
          ? 'inline'
          : 'end'
        : 'start',
    });
    cursor = match.index + match.reference.name.length;
  }

  const hasCharacterTag = usedReferences.some((reference) => reference.kind === 'character');
  const hasSceneTag = usedReferences.some((reference) => reference.kind === 'scene');
  const fallbackScene =
    references.find(
      (reference) =>
        reference.kind === 'scene' &&
        reference.prependIfMissing &&
        !usedReferences.some((used) => used.kind === 'scene' && used.name === reference.name),
    ) ||
    references.find(
      (reference) =>
        reference.kind === 'scene' &&
        !usedReferences.some((used) => used.kind === 'scene' && used.name === reference.name),
    );
  const forcedSceneTags =
    hasCharacterTag && !hasSceneTag && fallbackScene
      ? (() => {
          const id = uuidv4();
          usedReferences.push(fallbackScene);
          mentionUsages.push({ id, reference: fallbackScene, placement: 'start' });
          return createAssistantMentionHtml(fallbackScene.kind, fallbackScene.name, id);
        })()
      : '';

  const unusedReferences = references.filter(
    (reference) =>
      reference.prependIfMissing &&
      !usedReferences.some((used) => used.kind === reference.kind && used.name === reference.name),
  );
  const leadingTags = unusedReferences
    .slice(0, 4)
    .map((reference) => {
      const id = uuidv4();
      usedReferences.push(reference);
      mentionUsages.push({ id, reference, placement: 'start' });
      return createAssistantMentionHtml(reference.kind, reference.name, id);
    })
    .join('');

  return {
    html: leadingTags || forcedSceneTags ? `${forcedSceneTags}${leadingTags}${html}` : html,
    usedReferences,
    mentionUsages,
  };
};

const buildAssistantMentionReferencesFromNodes = (nodes: Node[]): AssistantMentionReference[] =>
  nodes
    .map((node): AssistantMentionReference | null => {
      if (node.type === 'characterNode') {
        const name =
          typeof node.data?.characterName === 'string' ? node.data.characterName.trim() : '';
        return name ? { id: node.id, kind: 'character', name } : null;
      }
      if (node.type === 'sceneNode') {
        const name = typeof node.data?.sceneName === 'string' ? node.data.sceneName.trim() : '';
        return name ? { id: node.id, kind: 'scene', name } : null;
      }
      return null;
    })
    .filter((reference): reference is AssistantMentionReference => Boolean(reference));

const buildAssistantStoryPresentation = (
  taggedStoryText: ReturnType<typeof insertAssistantMentionTags>,
) => {
  const taggedCharacters = taggedStoryText.usedReferences.filter(
    (reference) => reference.kind === 'character',
  );
  const taggedScene = taggedStoryText.usedReferences.find(
    (reference) => reference.kind === 'scene',
  );
  const characterPresentations: CharacterPresentation[] = taggedCharacters.map(
    (reference, characterIndex) => {
      const presentation = createCharacterPresentation(reference.id);
      const position =
        taggedCharacters.length === 1 ? 'center' : characterIndex % 2 === 0 ? 'left' : 'right';
      const enterType = position === 'right' ? 'slide-left' : 'slide-right';
      const exitType = position === 'right' ? 'slide-right' : 'slide-left';
      return {
        ...presentation,
        position,
        enter: createPresentationMotion(enterType, 520),
        exit: createPresentationMotion(exitType, 420),
      };
    },
  );
  const scenePresentation = taggedScene
    ? {
        ...createScenePresentation(taggedScene.id),
        enter: createPresentationMotion('fade', 500),
        exit: createPresentationMotion('fade', 420),
      }
    : undefined;
  const inlineActions = taggedStoryText.mentionUsages
    .filter((usage) => usage.placement === 'inline')
    .filter((usage) =>
      usage.reference.kind === 'character'
        ? characterPresentations.some((item) => item.sourceNodeId === usage.reference.id)
        : scenePresentation?.sourceNodeId === usage.reference.id,
    )
    .slice(0, 12)
    .map((usage, actionIndex) => ({
      ...createInlinePresentationAction({
        id: usage.id,
        kind: usage.reference.kind,
        sourceNodeId: usage.reference.id,
        name: usage.reference.name,
      }),
      action:
        usage.reference.kind === 'character'
          ? actionIndex % 3 === 0
            ? 'pulse'
            : 'shake-x'
          : ('scale' as InlinePresentationActionType),
    }));

  return characterPresentations.length > 0 || scenePresentation
    ? {
        characters: characterPresentations,
        ...(scenePresentation ? { scene: scenePresentation } : {}),
        inlineActions,
      }
    : undefined;
};

const applyAssistantStoryTags = (text: string, references: AssistantMentionReference[]) => {
  const taggedStoryText = insertAssistantMentionTags(text, references);
  return {
    text: taggedStoryText.html,
    presentation: buildAssistantStoryPresentation(taggedStoryText),
  };
};

const resolveAssistantStorySceneMedia = (
  presentation: StoryPresentation | undefined,
  nodes: Node[],
) => {
  const sceneSourceNodeId = presentation?.scene?.sourceNodeId;
  if (!sceneSourceNodeId) return {};

  const sceneNode = nodes.find(
    (node) => node.id === sceneSourceNodeId && node.type === 'sceneNode',
  );
  if (!sceneNode) return {};

  const sceneImages = Array.isArray(sceneNode.data.images)
    ? (sceneNode.data.images as Array<{
        id: string;
        imageUrl?: string;
        videoUrl?: string;
      }>)
    : [];
  const selectedMedia = presentation.scene?.imageId
    ? sceneImages.find((image) => image.id === presentation.scene?.imageId)
    : undefined;
  const firstVisualMedia = sceneImages.find((image) => image.imageUrl || image.videoUrl);
  const imageUrl =
    selectedMedia?.imageUrl ||
    (typeof sceneNode.data.coverImageUrl === 'string' ? sceneNode.data.coverImageUrl : undefined) ||
    firstVisualMedia?.imageUrl;
  const videoUrl = selectedMedia?.videoUrl || (!imageUrl ? firstVisualMedia?.videoUrl : undefined);

  return imageUrl || videoUrl
    ? {
        imageUrl,
        videoUrl,
        showTextOverlay: true,
      }
    : {};
};

const readStoryMentionNames = (html: string, kind: 'character' | 'scene') => {
  const container = document.createElement('div');
  container.innerHTML = html;
  return new Set(
    Array.from(container.querySelectorAll<HTMLElement>(`[data-mention-kind="${kind}"]`))
      .map((element) => element.dataset.mentionName?.trim())
      .filter((name): name is string => Boolean(name)),
  );
};

const syncPresentationWithStoryMentions = (
  text: string,
  presentation: ReturnType<typeof normalizeStoryPresentation>,
  nodes: Node[],
) => {
  const characterMentionNames = readStoryMentionNames(text, 'character');
  const sceneMentionNames = readStoryMentionNames(text, 'scene');
  const remainingCharacters = presentation.characters.filter((character) => {
    const sourceNode = nodes.find((node) => node.id === character.sourceNodeId);
    if (!sourceNode || sourceNode.type !== 'characterNode') return false;
    const name =
      typeof sourceNode.data.characterName === 'string' ? sourceNode.data.characterName.trim() : '';
    return Boolean(name && characterMentionNames.has(name));
  });
  const sceneSourceNode = presentation.scene
    ? nodes.find((node) => node.id === presentation.scene?.sourceNodeId)
    : undefined;
  const sceneName =
    sceneSourceNode?.type === 'sceneNode' && typeof sceneSourceNode.data.sceneName === 'string'
      ? sceneSourceNode.data.sceneName.trim()
      : '';
  const removedScene =
    presentation.scene && sceneName && !sceneMentionNames.has(sceneName)
      ? presentation.scene
      : undefined;

  return {
    presentation: {
      ...presentation,
      scene: removedScene ? undefined : presentation.scene,
      characters: remainingCharacters,
    },
    removedScene,
  };
};

// 使用懒加载减少首屏体验
const createDefaultEdgeOptions = (edgeColor: string, arrowSize: number) => ({
  type: 'customEdge',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: arrowSize,
    height: arrowSize,
    color: edgeColor,
  },
  style: { strokeWidth: 3, stroke: edgeColor },
});

const INITIAL_NODES: Node[] = [
  {
    id: 'root',
    type: 'storyNode',
    position: { x: 400, y: 250 },
    style: { width: 300, height: AI_STORY_CARD_HEIGHT },
    data: {
      id: 'root',
      title: DEFAULT_ROOT_STORY_TITLE,
      text: DEFAULT_ROOT_STORY_TEXT,
      shape: 'rounded-rectangle',
      color: '#ffffff',
      sizeMode: 'auto',
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
type AIProfileSeed =
  | Partial<TextAIProfile>
  | Partial<ImageAIProfile>
  | Partial<BackgroundRemovalAIProfile>
  | Partial<VoiceAIProfile>;
type AIProfileUpdates =
  | Partial<TextAIProfile>
  | Partial<ImageAIProfile>
  | Partial<BackgroundRemovalAIProfile>
  | Partial<VoiceAIProfile>;
type ThemePreference = 'light' | 'dark' | 'system';

const resolveSystemTheme = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

const PLOT_STRUCTURE_DIRECTION_CONFIG: Record<
  PlotStructureGenerateDirection,
  {
    sourceHandle: 'top' | 'right' | 'bottom' | 'left';
    targetHandle: 'top' | 'right' | 'bottom' | 'left';
    primaryStep: number;
    primaryDelta: number;
    primaryAxis: 'x' | 'y';
    collisionStep: number;
    collisionAxis: 'x' | 'y';
    label: string;
  }
> = {
  right: {
    sourceHandle: 'right',
    targetHandle: 'left',
    primaryStep: 420,
    primaryDelta: 420,
    primaryAxis: 'x',
    collisionStep: 220,
    collisionAxis: 'y',
    label: '向右',
  },
  left: {
    sourceHandle: 'left',
    targetHandle: 'right',
    primaryStep: 420,
    primaryDelta: -420,
    primaryAxis: 'x',
    collisionStep: 220,
    collisionAxis: 'y',
    label: '向左',
  },
  down: {
    sourceHandle: 'bottom',
    targetHandle: 'top',
    primaryStep: 320,
    primaryDelta: 320,
    primaryAxis: 'y',
    collisionStep: 420,
    collisionAxis: 'x',
    label: '向下',
  },
  up: {
    sourceHandle: 'top',
    targetHandle: 'bottom',
    primaryStep: 320,
    primaryDelta: -320,
    primaryAxis: 'y',
    collisionStep: 420,
    collisionAxis: 'x',
    label: '向上',
  },
};

const buildDefaultTextProfile = (): TextAIProfile => {
  // User-created profiles remain independent from the web-only hosted proxy.
  return {
    id: buildProfileId(),
    name: '',
    kind: 'text',
    provider: 'deepseek',
    apiKey: '',
    apiUrl: '',
    model: '',
    thinkingMode: false,
  };
};

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

const buildDefaultBackgroundRemovalProfile = (): BackgroundRemovalAIProfile => ({
  id: buildProfileId(),
  name: '去背景 AI',
  kind: 'background-removal',
  provider: 'custom',
  apiKey: '',
  apiUrl: 'api/proxy.php',
  model: '',
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
  appSecret: '',
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

export function StoryEditor({ appLanguage, onAppLanguageChange }: StoryEditorProps) {
  const nodeTypesMemo = useMemo(() => nodeTypes, []);
  const edgeTypesMemo = useMemo(() => edgeTypes, []);
  const { alert: showDialogAlert } = useDialog();
  const { agentState, runAgentCardPlacement, startAgentWaiting, stopAgentWaiting } =
    useAgentRuntime();

  const [nodes, setNodes] = useNodesState<Node>(INITIAL_NODES);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [showPlayTest, setShowPlayTest] = useState(false);
  const [showVideoRender, setShowVideoRender] = useState(false);
  const [canvasBg, setCanvasBg] = useState<string>('#F9FAFB');
  const [interactionMode, setInteractionMode] = useState<'select' | 'box'>('select');
  const [showTitles, setShowTitles] = useState(true);
  const [storyTitlePlacement, setStoryTitlePlacement] = useState<StoryTitlePlacement>('inside');
  const [edgeStyle, setEdgeStyle] = useState<'step' | 'bezier'>('bezier');
  const [edgeColor, setEdgeColor] = useState(DEFAULT_EDGE_COLOR);
  const [arrowSize, setArrowSize] = useState(DEFAULT_ARROW_SIZE);
  const [arrowCornerRadius, setArrowCornerRadius] = useState(DEFAULT_ARROW_CORNER_RADIUS);
  const [arrowTipAngle, setArrowTipAngle] = useState(DEFAULT_ARROW_TIP_ANGLE);
  const [showSettings, setShowSettings] = useState(false);
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

  const [tx, ty, tzoom] = useStore((s) => s.transform);
  const flowWidth = useStore((s) => s.width);
  const flowHeight = useStore((s) => s.height);
  const viewportWidth =
    typeof window === 'undefined' ? 1024 : window.visualViewport?.width || window.innerWidth;
  const effectiveFlowWidth = flowWidth > 0 ? flowWidth : viewportWidth;

  const getCenterPosition = useCallback(() => {
    return {
      x: (flowWidth / 2 - tx) / tzoom,
      y: (flowHeight / 2 - ty) / tzoom,
    };
  }, [tx, ty, tzoom, flowWidth, flowHeight]);
  // 右上角显示的思考过程文字，null 表示不显示
  const [, setThinkingContent] = useState<string | null>(null);
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
  const [miniMapPosition, setMiniMapPosition] = useState<'left' | 'right'>('right');
  const [showControls, setShowControls] = useState(true);
  const [showHoverButtonAnimations, setShowHoverButtonAnimations] = useState(true);
  const [highlightedPath, setHighlightedPath] = useState<{
    nodes: Set<string>;
    edges: Set<string>;
    edgeColors: Map<string, string[]>;
  } | null>(null);
  const defaultEdgeOptions = useMemo(
    () => createDefaultEdgeOptions(edgeColor, arrowSize),
    [arrowSize, edgeColor],
  );

  const [pasteAsPlainText, setPasteAsPlainText] = useState(false);
  const [showNodeActions, setShowNodeActions] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showLastSavedTime, setShowLastSavedTime] = useState(true);
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
  const [selectionMenuLayout, setSelectionMenuLayout] = useState<'horizontal' | 'vertical'>(() =>
    effectiveFlowWidth < 768 ? 'vertical' : 'horizontal',
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
  } = usePlaytestSettings();
  const { sharedRenderStyle, setSharedRenderStyle, updateSharedRenderStyle } =
    useSharedRenderStyle();

  const t = translations[language];
  const [isDirty, setIsDirtyRaw] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isProjectSnapshotSynced, setIsProjectSnapshotSynced] = useState(false);
  const isSavingProjectRef = useRef(false);
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
          profile.kind === 'background-removal' &&
          profile.id === activeBackgroundRemovalProfileId,
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
  const activeTextProfileName = activeTextProfile?.name ?? '';
  const activeImageProfileName = activeImageProfile?.name ?? '';
  const activeVoiceProfileName = activeVoiceProfile?.name ?? '';

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
        activeBackgroundRemovalProfileId &&
        exportedProfileIds.has(activeBackgroundRemovalProfileId)
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

  const [qqCopied, setQqCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const { screenToFlowPosition, getIntersectingNodes, setCenter, fitView } = useReactFlow();
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

  const handleDownloadAssistantMemory = useCallback(() => {
    const payload = {
      kind: 'galwriter-assistant-memory',
      version: 1,
      exportedAt: new Date().toISOString(),
      projectTitle: getProjectDisplayName(projectTitle, saveFileName) || DEFAULT_PROJECT_FILE_NAME,
      enabled: assistantMemorySkillEnabled,
      notes: assistantMemoryNotes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = (payload.projectTitle || 'galwriter')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-');
    link.href = url;
    link.download = `${safeTitle}-assistant-memory.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(language === 'zh' ? '偏好记忆已下载' : 'Assistant memory downloaded');
  }, [
    assistantMemoryNotes,
    assistantMemorySkillEnabled,
    language,
    projectTitle,
    saveFileName,
    showToast,
  ]);

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

  const [history, setHistory] = useState<{
    past: { nodes: Node[]; edges: Edge[] }[];
    future: { nodes: Node[]; edges: Edge[] }[];
  }>({ past: [], future: [] });
  const lastHistoryState = useRef({ nodes: INITIAL_NODES, edges: [] as Edge[] });
  const isUndoRedoAction = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      !activeBackgroundRemovalProfile.apiUrl.trim() ||
      !activeBackgroundRemovalProfile.apiKey.trim() ||
      (activeBackgroundRemovalProfile.provider !== 'custom' &&
        !activeBackgroundRemovalProfile.model.trim()));
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
      setSharedRenderStyle,
    }),
    [
      setCanvasBg,
      setEdgeStyle,
      setEdgeColor,
      setArrowSize,
      setArrowCornerRadius,
      setArrowTipAngle,
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
      activeBackgroundRemovalProfileId:
        activeBackgroundRemovalProfileId,
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

  React.useEffect(() => {
    setNodes((currentNodes) => {
      const nodeById = new Map(currentNodes.map((node) => [node.id, node]));
      let changed = false;

      const nextNodes = currentNodes.map((node) => {
        if (node.type !== 'storyNode') return node;

        const connectedEdges = edges.filter(
          (edge) => edge.source === node.id || edge.target === node.id,
        );
        const connectedSceneBinding = connectedEdges
          .map((edge) => {
            const connectedId = edge.source === node.id ? edge.target : edge.source;
            const connected = nodeById.get(connectedId);
            if (connected?.type !== 'sceneNode') return null;

            const sceneHandle = edge.source === connectedId ? edge.sourceHandle : edge.targetHandle;
            const imageId = sceneHandle?.match(/^image-(?:in|out)-(.+)$/)?.[1];
            const sceneImages = Array.isArray(connected.data.images)
              ? (connected.data.images as Array<{
                  id: string;
                  imageUrl?: string;
                  videoUrl?: string;
                }>)
              : [];
            const selectedMedia = imageId
              ? sceneImages.find(
                  (image) => image.id === imageId && (image.imageUrl || image.videoUrl),
                )
              : undefined;
            const imageUrl =
              selectedMedia?.imageUrl ||
              (!selectedMedia && typeof connected.data.coverImageUrl === 'string'
                ? connected.data.coverImageUrl
                : undefined);
            const videoUrl = selectedMedia?.videoUrl;
            if (!imageUrl && !videoUrl) return null;

            return {
              node: connected,
              imageId: selectedMedia?.id,
              imageUrl,
              videoUrl,
            };
          })
          .filter((binding): binding is NonNullable<typeof binding> => Boolean(binding))
          .sort((a, b) => Number(Boolean(b.imageId)) - Number(Boolean(a.imageId)))[0];
        const connectedCharacterBindings = connectedEdges
          .map((edge) => {
            const connectedId = edge.source === node.id ? edge.target : edge.source;
            const connected = nodeById.get(connectedId);
            if (connected?.type !== 'characterNode') return null;

            const characterHandle =
              edge.source === connectedId ? edge.sourceHandle : edge.targetHandle;
            const outfitId = characterHandle?.match(/^outfit-(?:in|out)-(.+)$/)?.[1];
            const outfits = Array.isArray(connected.data.outfits)
              ? (connected.data.outfits as Array<{ id: string }>)
              : [];

            return {
              node: connected,
              outfitId:
                outfitId && outfits.some((outfit) => outfit.id === outfitId) ? outfitId : undefined,
            };
          })
          .filter((binding): binding is NonNullable<typeof binding> => Boolean(binding));
        const connectedCharacterById = new Map<
          string,
          (typeof connectedCharacterBindings)[number]
        >();
        connectedCharacterBindings.forEach((binding) => {
          const existing = connectedCharacterById.get(binding.node.id);
          if (!existing || binding.outfitId) {
            connectedCharacterById.set(binding.node.id, binding);
          }
        });
        const presentation = normalizeStoryPresentation(node.data.presentation as any);
        let nextScene = presentation.scene;
        let nextImageUrl = node.data.imageUrl as string | undefined;
        let nextVideoUrl = node.data.videoUrl as string | undefined;
        let nextShowTextOverlay = node.data.showTextOverlay as boolean | undefined;

        if (connectedSceneBinding) {
          const connectedScene = connectedSceneBinding.node;
          const previousImageUrl =
            nextScene?.linkedByEdge && nextScene.previousImageUrl !== undefined
              ? nextScene.previousImageUrl
              : nextImageUrl;
          const previousVideoUrl =
            nextScene?.linkedByEdge && nextScene.previousVideoUrl !== undefined
              ? nextScene.previousVideoUrl
              : nextVideoUrl;
          nextScene = {
            ...(nextScene?.sourceNodeId === connectedScene.id
              ? nextScene
              : createScenePresentation(
                  connectedScene.id,
                  previousImageUrl,
                  true,
                  nextShowTextOverlay,
                )),
            sourceNodeId: connectedScene.id,
            linkedByEdge: true,
            imageId: connectedSceneBinding.imageId,
            previousImageUrl,
            previousVideoUrl,
            previousShowTextOverlay:
              nextScene?.linkedByEdge && nextScene.previousShowTextOverlay !== undefined
                ? nextScene.previousShowTextOverlay
                : nextShowTextOverlay,
          };
          nextImageUrl = connectedSceneBinding.imageUrl;
          nextVideoUrl = connectedSceneBinding.videoUrl;
          nextShowTextOverlay = true;
        } else if (nextScene?.linkedByEdge) {
          nextImageUrl = nextScene.previousImageUrl;
          nextVideoUrl = nextScene.previousVideoUrl;
          nextShowTextOverlay = nextScene.previousShowTextOverlay;
          nextScene = undefined;
        } else if (nextScene) {
          const taggedSceneMedia = resolveAssistantStorySceneMedia(presentation, currentNodes);
          if (taggedSceneMedia.imageUrl || taggedSceneMedia.videoUrl) {
            nextImageUrl = taggedSceneMedia.imageUrl;
            nextVideoUrl = taggedSceneMedia.videoUrl;
            nextShowTextOverlay = taggedSceneMedia.showTextOverlay;
          }
        }

        const connectedCharacterIds = new Set(connectedCharacterById.keys());
        const nextCharacters = presentation.characters
          .filter(
            (character) =>
              !character.linkedByEdge || connectedCharacterIds.has(character.sourceNodeId),
          )
          .map((character) => {
            const binding = connectedCharacterById.get(character.sourceNodeId);
            return binding
              ? { ...character, linkedByEdge: true, outfitId: binding.outfitId }
              : character;
          });
        connectedCharacterById.forEach((binding) => {
          if (!nextCharacters.some((item) => item.sourceNodeId === binding.node.id)) {
            nextCharacters.push({
              ...createCharacterPresentation(binding.node.id, true),
              outfitId: binding.outfitId,
            });
          }
        });

        const nextPresentation = {
          scene: nextScene,
          characters: nextCharacters,
          inlineActions: presentation.inlineActions,
        };
        if (
          nextImageUrl === node.data.imageUrl &&
          nextVideoUrl === node.data.videoUrl &&
          nextShowTextOverlay === node.data.showTextOverlay &&
          JSON.stringify(nextPresentation) === JSON.stringify(presentation)
        ) {
          return node;
        }

        changed = true;
        return {
          ...node,
          data: {
            ...node.data,
            imageUrl: nextImageUrl,
            videoUrl: nextVideoUrl,
            showTextOverlay: nextShowTextOverlay,
            presentation: nextPresentation,
          },
        };
      });

      return changed ? nextNodes : currentNodes;
    });
  }, [edges, nodes, setNodes]);

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

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();
      const activeElement = document.activeElement;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const hasInputSelection =
        (activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement) &&
        activeElement.selectionStart !== null &&
        activeElement.selectionEnd !== null &&
        activeElement.selectionStart !== activeElement.selectionEnd;
      const hasDocumentSelection = Boolean(window.getSelection()?.toString());

      if (modifier && key === 'c' && (hasInputSelection || hasDocumentSelection)) {
        showToast(
          language === 'zh'
            ? '已复制文本'
            : language === 'ja'
              ? 'テキストをコピーしました'
              : 'Text copied',
        );
        return;
      }

      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

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
  }, [undo, redo, handleCopy, handlePaste, deleteSelected, language, showToast]);

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

  const handleGenerateStoryNodeSpeech = useCallback(
    async (nodeId: string) => {
      if (ttsLoading) return;

      const node = nodes.find((item) => item.id === nodeId && item.type === 'storyNode');
      if (!node) return;

      const speechSegments = ttsService.buildSpeechSegments(
        String(node.data.title || ''),
        String(node.data.text || ''),
        ttsNarrationMode,
      );
      if (speechSegments.length === 0) return;
      const missingVoiceApiConfig =
        !activeVoiceProfile ||
        (ttsProvider === 'youdao'
          ? !ttsAppKey.trim() || !ttsApiKey.trim()
          : ttsProvider !== 'system' && ttsProvider !== 'hosted-voice' && !ttsApiKey.trim());
      if (missingVoiceApiConfig) {
        requestSettingsAttention('voice');
        showToast(
          language === 'zh'
            ? '请先在设置 > AI 配置 > 语音 AI 中连接语音 API'
            : language === 'ja'
              ? '設定 > AI設定 > Voice AI で音声APIを接続してください'
              : 'Connect a Voice AI API in Settings > AI Settings > Voice AI first',
        );
        return;
      }

      setTtsLoading(true);
      try {
        showToast(
          language === 'zh'
            ? '正在生成文字音频'
            : language === 'ja'
              ? '音声を生成中'
              : 'Generating audio',
        );
        const existingClips = Array.isArray(node.data.audioClips)
          ? node.data.audioClips
          : typeof node.data.audioUrl === 'string' && node.data.audioUrl
            ? [
                {
                  id: crypto.randomUUID(),
                  name:
                    language === 'zh'
                      ? '已有音频'
                      : language === 'ja'
                        ? '既存の音声'
                        : 'Existing audio',
                  url: node.data.audioUrl,
                  source: 'imported' as const,
                  createdAt: Date.now() - 1,
                },
              ]
            : [];
        const generatedClips: StoryAudioClip[] = [];
        for (const [index, segment] of speechSegments.entries()) {
          const audio = await ttsService.generate({
            text: segment.text,
            provider: ttsProvider,
            apiUrl: ttsApiUrl,
            apiKey: ttsApiKey,
            appKey: ttsAppKey,
            appSecret: ttsAppSecret || ttsApiKey,
            model: ttsModel,
            voice: ttsVoice,
          });
          generatedClips.push({
            id: crypto.randomUUID(),
            name:
              language === 'zh'
                ? `文字音频 ${existingClips.length + index + 1}`
                : language === 'ja'
                  ? `テキスト音声 ${existingClips.length + index + 1}`
                  : `Text audio ${existingClips.length + index + 1}`,
            url: audio.url,
            source: 'tts',
            createdAt: Date.now() + index,
            segmentId: segment.id,
            order: index,
          });
        }
        const nextClips = [...existingClips, ...generatedClips];
        handleUpdateNode(nodeId, {
          audioUrl: nextClips.find((clip) => !clip.skipped)?.url || generatedClips[0]?.url,
          audioClips: nextClips,
          ttsGenerated: true,
        });
        showToast(
          language === 'zh'
            ? '文字音频已生成'
            : language === 'ja'
              ? '音声を生成しました'
              : 'Audio generated',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('TTS generation failed:', error);
        await showDialogAlert({
          title:
            language === 'zh'
              ? '文字音频生成失败'
              : language === 'ja'
                ? '音声生成に失敗しました'
                : 'Audio generation failed',
          description: message,
          tone: 'warning',
        });
      } finally {
        setTtsLoading(false);
      }
    },
    [
      handleUpdateNode,
      language,
      nodes,
      activeVoiceProfile,
      requestSettingsAttention,
      showToast,
      ttsApiKey,
      ttsApiUrl,
      ttsAppKey,
      ttsAppSecret,
      ttsLoading,
      ttsModel,
      ttsNarrationMode,
      ttsProvider,
      ttsVoice,
      showDialogAlert,
    ],
  );

  const {
    callAIForText,
    callAIForTextResult,
    callAIForTextStream,
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
    characterImageMode,
    sceneImageMode,
    showTitles: showTitles && storyTitlePlacement === 'inside',
    setImageSize,
    setNodes,
    showToast,
    onMissingImageApiKeyRequest: () => {
      requestSettingsAttention('image');
      showToast(
        language === 'zh'
          ? '请先在设置 > AI 配置 > 图片 AI 中连接图片 API'
          : language === 'ja'
            ? '設定 > AI設定 > Image AI で画像APIを接続してください'
            : 'Connect an Image AI API in Settings > AI Settings > Image AI first',
      );
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
      const offsetDist = 120;

      let targetHandle = 'left';

      setNodes((nds) => {
        const sourceNode = nds.find((n) => n.id === sourceId);
        if (!sourceNode) return nds;

        const srcW = sourceNode.measured?.width || 300;
        const srcH = sourceNode.measured?.height || AI_STORY_CARD_HEIGHT;

        let newX = sourceNode.position.x;
        let newY = sourceNode.position.y;

        if (side === 'top') {
          newY -= AI_STORY_CARD_HEIGHT + offsetDist;
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
          style: { width: 300, height: AI_STORY_CARD_HEIGHT },
          data: {
            id: newId,
            title: '分支',
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

      const getNumberConditionSourceHandleForTotal = (
        conditionNodeId: string,
        total: number,
      ) => {
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

      const addPathNode = (id: string, color = defaultStorylineColor) => {
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
        state.nodes.forEach((stateNodeId) => addPathNode(stateNodeId, color));
        state.edges.forEach((stateEdge) => addPathEdge(stateEdge, color));
      };

      const traceUp = (id: string, maxSerialOnly = false, color = defaultStorylineColor) => {
        if (pathNodes.has(id)) return;
        addPathNode(id, color);
        const currentNode = nodeById.get(id);
        const shouldUseMaxSerialInput =
          maxSerialOnly || currentNode?.type === 'numberConditionNode';
        const incomingEdges = shouldUseMaxSerialInput
          ? getMaxSerialIncomingEdges(id)
          : incomingEdgesByTarget.get(id) || [];

        incomingEdges.forEach((edge, index) => {
          const sourceNode = nodeById.get(edge.source);
          if (sourceNode?.type === 'numberConditionNode') {
            addPathNode(edge.source, color);
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
          addPathNode(currentId, color);

          const currentNode = nodeById.get(currentId);
          const outgoingEdges =
            currentNode?.type === 'numberConditionNode'
              ? (outgoingEdgesBySource.get(currentId) || []).filter(
                  (edge) =>
                    edge.sourceHandle ===
                    getNumberConditionSourceHandleForTotal(currentId, total),
                )
              : outgoingEdgesBySource.get(currentId) || [];

          outgoingEdges.forEach((edge, index) => {
            const edgeColor =
              currentNode?.type === 'numberConditionNode'
                ? color
                : getBranchColor(index, color);
            const targetNode = nodeById.get(edge.target);
            const nextTotal =
              targetNode?.type === 'numberConditionNode' ? total : total + getNodeValue(edge.target);
            addPathEdge(edge, edgeColor);
            if (!visited.has(`${edge.target}:${nextTotal}:${edgeColor}`)) {
              queue.push({ id: edge.target, color: edgeColor, total: nextTotal });
            }
          });
        }
      };

      traceUp(nodeId);
      traceDown(nodeId);

      setHighlightedPath({
        nodes: pathNodes,
        edges: pathEdges,
        edgeColors: pathEdgeColors,
      });
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
        await showDialogAlert({
          title:
            language === 'zh'
              ? 'AI 生成失败'
              : language === 'ja'
                ? 'AI 生成に失敗しました'
                : 'AI generation failed',
          description:
            error.message ||
            (language === 'zh'
              ? '请检查 API 密钥和网络连接'
              : language === 'ja'
                ? 'API キーとネットワーク接続を確認してください'
                : 'Check your API key and network connection.'),
          tone: 'warning',
        });
      } finally {
        setAiLoadingNodeId(null);
      }
    },
    [language, runAIGenerate, showDialogAlert],
  );

  const executeAssistantCardPlacement = useCallback(
    (
      cards: AssistantCardDraft[],
      mode: AssistantCardPlacementMode = 'append',
      options?: AssistantCardPlacementOptions,
    ): AssistantCardPlacementResult => {
      const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
      const getDraftType = (
        card: AssistantCardDraft,
      ): 'story' | 'character' | 'scene' | 'number-condition' => {
        if (card.type === 'character' || card.type === 'scene' || card.type === 'story')
          return card.type;
        if (card.type === 'number-condition') return card.type;
        if (
          typeof card.threshold === 'number' ||
          (Array.isArray(card.ranges) && card.ranges.length > 0)
        )
          return 'number-condition';
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
          key: cleanText(card.key),
          title: cleanText(card.title),
          text: cleanText(card.text),
          nodeValue:
            typeof card.nodeValue === 'number' && Number.isFinite(card.nodeValue)
              ? card.nodeValue
              : undefined,
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
          threshold:
            typeof card.threshold === 'number' && Number.isFinite(card.threshold)
              ? card.threshold
              : undefined,
          ranges: Array.isArray(card.ranges)
            ? card.ranges
                .map((range) => ({
                  min: typeof range.min === 'number' && Number.isFinite(range.min) ? range.min : 0,
                  max: typeof range.max === 'number' && Number.isFinite(range.max) ? range.max : 0,
                }))
                .filter((range) => range.min <= range.max)
            : undefined,
          connectTo: Array.isArray(card.connectTo)
            ? card.connectTo.map(cleanText).filter(Boolean)
            : undefined,
          branchTargets: Array.isArray(card.branchTargets)
            ? card.branchTargets
                .map((branch) => ({
                  target: cleanText(branch.target),
                  handle: cleanText(branch.handle),
                  label: cleanText(branch.label),
                }))
                .filter((branch) => branch.target)
            : undefined,
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
          if (card.type === 'number-condition') {
            return (
              typeof card.threshold === 'number' ||
              (Array.isArray(card.ranges) && card.ranges.length > 0) ||
              card.title
            );
          }
          return card.text || card.title;
        });

      if (validCards.length === 0) return { count: 0 };

      const explicitFillTargetIds = new Set(options?.targetNodeIds || []);
      let selectedFillTargets = nodes.filter(
        (n) =>
          (explicitFillTargetIds.size > 0 ? explicitFillTargetIds.has(n.id) : n.selected) &&
          (n.type === 'storyNode' || n.type === 'characterNode' || n.type === 'sceneNode'),
      );
      const defaultInitialRootNode = nodes.find(isDefaultInitialStoryNode);
      const hasNonDefaultStoryNode = nodes.some(
        (node) => node.type === 'storyNode' && !isDefaultInitialStoryNode(node),
      );
      const shouldReplaceInitialRoot =
        mode === 'append' &&
        edges.length === 0 &&
        Boolean(defaultInitialRootNode) &&
        !hasNonDefaultStoryNode &&
        validCards.some((draft) => draft.type === 'story');
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
                title: node.data.isRoot ? node.data.title : draft.title || node.data.title,
                text: draft.text || node.data.text || '',
              },
            };
          }),
        );
      }
      const filledTargetNodeIds =
        mode === 'fill-selected' ? selectedFillTargets.map((node) => node.id) : [];

      const remainingCards = validCards.filter((_, index) => !usedDraftIndexes.has(index));
      if (remainingCards.length === 0) return { count: filledCount, nodeIds: filledTargetNodeIds };

      const selectedStories = nodes.filter((n) => n.selected && n.type === 'storyNode');
      const selectedCanvasTarget = nodes.find(
        (node) =>
          node.selected &&
          (node.type === 'storyNode' || node.type === 'characterNode' || node.type === 'sceneNode'),
      );
      const center = getCenterPosition();
      const targetNode =
        mode === 'bridge-to-target' && options?.targetNodeId
          ? nodes.find((node) => node.id === options.targetNodeId) || null
          : null;
      const terminalStories = nodes.filter(
        (node) =>
          node.type === 'storyNode' &&
          node.id !== targetNode?.id &&
          !(shouldReplaceInitialRoot && isDefaultInitialStoryNode(node)) &&
          node.data?.assistantFutureGoal !== true &&
          !edges.some(
            (edge) =>
              edge.source === node.id &&
              nodes.some(
                (candidate) => candidate.id === edge.target && candidate.type === 'storyNode',
              ),
          ),
      );
      const sourceNode =
        (mode === 'adjacent-revision' ? selectedCanvasTarget : null) ||
        selectedStories.find(
          (node) =>
            node.id !== targetNode?.id &&
            !(shouldReplaceInitialRoot && isDefaultInitialStoryNode(node)),
        ) ||
        terminalStories[terminalStories.length - 1] ||
        null;
      const getSettingCardLayoutHeight = (card: (typeof remainingCards)[number]) => {
        if (card.type === 'character') {
          const expandedFieldCount = [
            card.personality,
            card.features,
            card.background,
            card.other,
          ].filter(Boolean).length;
          return (
            AI_SETTING_CARD_LAYOUT_HEIGHT +
            Math.max(0, expandedFieldCount - 1) * AI_SETTING_CARD_LAYOUT_FIELD_HEIGHT
          );
        }

        if (card.type === 'scene') {
          const expandedFieldCount = [
            card.location,
            card.items,
            card.atmosphere,
            card.other,
          ].filter(Boolean).length;
          return (
            AI_SETTING_CARD_LAYOUT_HEIGHT +
            Math.max(0, expandedFieldCount - 1) * AI_SETTING_CARD_LAYOUT_FIELD_HEIGHT
          );
        }

        if (card.type === 'number-condition') {
          return 260 + Math.max(0, (card.ranges?.length || 0) - 1) * 56;
        }

        return AI_STORY_CARD_HEIGHT;
      };
      const cardLayouts = remainingCards.map((card) => ({
        width:
          card.type === 'story'
            ? AI_STORY_CARD_WIDTH
            : card.type === 'number-condition'
              ? 300
              : 280,
        height: getSettingCardLayoutHeight(card),
      }));
      const characterIndexes = remainingCards
        .map((card, index) => (card.type === 'character' ? index : -1))
        .filter((index) => index >= 0);
      const sceneIndexes = remainingCards
        .map((card, index) => (card.type === 'scene' ? index : -1))
        .filter((index) => index >= 0);
      const storyIndexes = remainingCards
        .map((card, index) => (card.type === 'story' ? index : -1))
        .filter((index) => index >= 0);
      const numberConditionIndexes = remainingCards
        .map((card, index) => (card.type === 'number-condition' ? index : -1))
        .filter((index) => index >= 0);
      const rootReplacementStoryIndex = shouldReplaceInitialRoot ? storyIndexes[0] : -1;
      const columnGap = 150;
      const rowGap = 200;
      const layoutColumns = [
        { type: 'character' as const, indexes: characterIndexes, width: 280 },
        { type: 'scene' as const, indexes: sceneIndexes, width: 280 },
        { type: 'story' as const, indexes: storyIndexes, width: 300 },
        { type: 'number-condition' as const, indexes: numberConditionIndexes, width: 300 },
      ].filter((column) => column.indexes.length > 0);
      const getColumnHeight = (indexes: number[]) =>
        indexes.reduce(
          (height, cardIndex, rowIndex) =>
            height + cardLayouts[cardIndex].height + (rowIndex > 0 ? rowGap : 0),
          0,
        );
      const totalLayoutWidth =
        layoutColumns.reduce((width, column) => width + column.width, 0) +
        Math.max(0, layoutColumns.length - 1) * columnGap;
      const maxColumnHeight = Math.max(
        0,
        ...layoutColumns.map((column) => getColumnHeight(column.indexes)),
      );
      const layoutLeft = center.x - totalLayoutWidth / 2;
      const layoutTop = center.y - maxColumnHeight / 2;
      const columnXByType = new Map<'character' | 'scene' | 'story' | 'number-condition', number>();
      layoutColumns.reduce((x, column) => {
        columnXByType.set(column.type, x);
        return x + column.width + columnGap;
      }, layoutLeft);
      const getVerticalColumnPosition = (columnIndexes: number[], cardIndex: number, x: number) => {
        const rowIndex = Math.max(0, columnIndexes.indexOf(cardIndex));
        const y =
          layoutTop +
          columnIndexes
            .slice(0, rowIndex)
            .reduce(
              (offset, previousIndex) => offset + cardLayouts[previousIndex].height + rowGap,
              0,
            );
        return { x, y };
      };

      const cardIds = remainingCards.map(() => uuidv4());
      const existingMentionReferences = buildAssistantMentionReferencesFromNodes(nodes);
      const generatedMentionReferences: AssistantMentionReference[] = remainingCards
        .map((card, index): AssistantMentionReference | null => {
          if (card.type === 'character') {
            const name =
              card.characterName || card.title || (language === 'zh' ? 'AI 角色' : 'AI Character');
            return { id: cardIds[index], kind: 'character' as const, name, prependIfMissing: true };
          }
          if (card.type === 'scene') {
            const name =
              card.sceneName || card.title || (language === 'zh' ? 'AI 场景' : 'AI Scene');
            return { id: cardIds[index], kind: 'scene' as const, name, prependIfMissing: true };
          }
          return null;
        })
        .filter((reference): reference is AssistantMentionReference => Boolean(reference));
      const assistantMentionReferences = [
        ...generatedMentionReferences,
        ...existingMentionReferences,
      ];

      const newNodes: Node[] = remainingCards.map((card, index) => {
        const id = cardIds[index];
        const layout = cardLayouts[index];
        let position =
          card.type === 'character'
            ? getVerticalColumnPosition(
                characterIndexes,
                index,
                columnXByType.get('character') ?? center.x - layout.width / 2,
              )
            : card.type === 'scene'
              ? getVerticalColumnPosition(
                  sceneIndexes,
                  index,
                  columnXByType.get('scene') ?? center.x - layout.width / 2,
                )
              : card.type === 'number-condition'
                ? getVerticalColumnPosition(
                    numberConditionIndexes,
                    index,
                    columnXByType.get('number-condition') ?? center.x - layout.width / 2,
                  )
                : getVerticalColumnPosition(
                    storyIndexes,
                    index,
                    columnXByType.get('story') ?? center.x - layout.width / 2,
                  );
        if (mode === 'adjacent-revision' && sourceNode) {
          position = {
            x: sourceNode.position.x + (sourceNode.measured?.width || 300) + 80,
            y: sourceNode.position.y + index * (layout.height + 60),
          };
        } else if (mode === 'future-targets') {
          const anchorX = sourceNode
            ? sourceNode.position.x - Math.max(0, remainingCards.length - 1) * 190
            : center.x - Math.max(0, remainingCards.length - 1) * 190;
          const anchorY = sourceNode
            ? sourceNode.position.y + (sourceNode.measured?.height || 200) + 300
            : center.y;
          position = { x: anchorX + index * 380, y: anchorY };
        } else if (mode === 'bridge-to-target' && sourceNode && targetNode) {
          const bridgeIndex =
            card.type === 'story' ? Math.max(0, storyIndexes.indexOf(index)) : index;
          position = {
            x: sourceNode.position.x,
            y:
              sourceNode.position.y +
              (sourceNode.measured?.height || (sourceNode.style?.height as number) || 200) +
              100 +
              bridgeIndex * 280,
          };
        }
        if (card.type === 'character') {
          return {
            id,
            type: 'characterNode',
            position,
            selected: true,
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
            position,
            selected: true,
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

        if (card.type === 'number-condition') {
          return {
            id,
            type: 'numberConditionNode',
            position,
            selected: true,
            data: {
              id,
              threshold: card.threshold ?? 0,
              ranges: card.ranges?.map((range) => ({
                id: uuidv4(),
                min: range.min,
                max: range.max,
              })),
            } satisfies NumberConditionNodeData,
          };
        }

        const taggedStory = applyAssistantStoryTags(card.text, assistantMentionReferences);
        const sceneMedia = resolveAssistantStorySceneMedia(taggedStory.presentation, nodes);

        return {
          id,
          type: 'storyNode',
          position,
          selected: true,
          style: { width: AI_STORY_CARD_WIDTH, height: AI_STORY_CARD_HEIGHT },
          data: {
            id,
            title: card.title || (language === 'zh' ? 'AI 剧情卡片' : 'AI Story Card'),
            text: taggedStory.text,
            shape: 'square',
            color: '#ffffff',
            sizeMode: 'auto',
            isRoot: index === rootReplacementStoryIndex,
            nodeValue: card.nodeValue,
            assistantFutureGoal: mode === 'future-targets',
            presentation: taggedStory.presentation,
            ...sceneMedia,
          } satisfies StoryNodeData,
        };
      });

      const storyNodesToLink = newNodes.filter((node) => node.type === 'storyNode');
      const numberConditionNodesToLink = newNodes.filter(
        (node) => node.type === 'numberConditionNode',
      );
      const flowNodesToLink =
        numberConditionNodesToLink.length > 0
          ? newNodes.filter(
              (node) => node.type === 'storyNode' || node.type === 'numberConditionNode',
            )
          : storyNodesToLink;
      const getFlowSourceHandle = (node: Node) =>
        node.type === 'numberConditionNode' ? 'out-greater' : 'bottom';
      const getFlowTargetHandle = (source: Node | null, target: Node) => {
        if (target.type === 'numberConditionNode') return 'in-top';
        if (source?.type === 'numberConditionNode') return 'left';
        return 'top';
      };
      const newEdges: Edge[] = [];
      const hasExplicitConnections = remainingCards.some(
        (card) => (card.connectTo?.length || 0) > 0 || (card.branchTargets?.length || 0) > 0,
      );
      const isEndingDraft = (card: (typeof remainingCards)[number]) => {
        if (card.type !== 'story') return false;
        const searchable = `${card.key || ''} ${card.title || ''} ${card.text || ''}`;
        return /ending|good\s*end|bad\s*end|true\s*end|\u7ed3\u5c40|\u771f\u7ed3\u5c40|\u597d\u7ed3\u5c40|\u574f\u7ed3\u5c40/i.test(
          searchable,
        );
      };
      const inferredEndingIndexes = remainingCards
        .map((card, index) => (isEndingDraft(card) ? index : -1))
        .filter((index) => index >= 0);
      const inferredEndingNodes = inferredEndingIndexes
        .map((index) => newNodes[index])
        .filter((node): node is Node => Boolean(node) && node.type === 'storyNode');
      const firstEndingIndex = inferredEndingIndexes[0] ?? -1;
      const inferredBranchSource =
        !hasExplicitConnections && inferredEndingNodes.length >= 2
          ? newNodes
              .slice(0, Math.max(0, firstEndingIndex))
              .reverse()
              .find((node) => node.type === 'storyNode') || sourceNode
          : null;
      if (inferredBranchSource && inferredEndingNodes.length >= 2) {
        const branchWidth = 380;
        const branchTop =
          inferredBranchSource.position.y +
          (inferredBranchSource.measured?.height ||
            (inferredBranchSource.style?.height as number) ||
            200) +
          260;
        const branchLeft =
          inferredBranchSource.position.x - ((inferredEndingNodes.length - 1) * branchWidth) / 2;
        inferredEndingNodes.forEach((node, index) => {
          node.position = {
            x: branchLeft + index * branchWidth,
            y: branchTop,
          };
        });
      }
      const nodeByDraftRef = new Map<string, Node>();
      remainingCards.forEach((card, index) => {
        const node = newNodes[index];
        if (!node || (node.type !== 'storyNode' && node.type !== 'numberConditionNode')) return;
        [card.key, card.title].filter(Boolean).forEach((ref) => {
          nodeByDraftRef.set(String(ref).trim().toLowerCase(), node);
        });
      });
      const resolveDraftNode = (ref: string) =>
        nodeByDraftRef.get(ref.trim().toLowerCase()) || null;
      const normalizeBranchHandle = (source: Node, handle?: string) => {
        if (source.type !== 'numberConditionNode') return handle === 'right' ? 'right' : 'bottom';
        const normalized = (handle || '').trim().toLowerCase();
        if (normalized === 'less' || normalized === 'less-equal' || normalized === 'lt') {
          return 'out-less-equal';
        }
        if (normalized.startsWith('range:')) {
          const rangeIndex = Number.parseInt(normalized.slice(6), 10);
          const ranges = (source.data.ranges as Array<{ id: string }> | undefined) || [];
          return ranges[rangeIndex]?.id ? `out-range-${ranges[rangeIndex].id}` : 'out-greater';
        }
        if (normalized.startsWith('out-')) return normalized;
        return 'out-greater';
      };
      const pushFlowEdge = (source: Node, target: Node, sourceHandle: string, label?: string) => {
        newEdges.push({
          id: `e-${source.id}-${target.id}-${newEdges.length}`,
          source: source.id,
          sourceHandle,
          target: target.id,
          targetHandle: getFlowTargetHandle(source, target),
          type: 'customEdge',
          data: label ? { label } : undefined,
        });
      };

      if (inferredBranchSource && inferredEndingNodes.length >= 2 && mode !== 'adjacent-revision') {
        const preBranchNodes = flowNodesToLink.filter((node) => {
          const nodeIndex = newNodes.findIndex((candidate) => candidate.id === node.id);
          return (
            nodeIndex >= 0 && nodeIndex < firstEndingIndex && node.id !== inferredBranchSource.id
          );
        });
        if (sourceNode && preBranchNodes[0]) {
          pushFlowEdge(sourceNode, preBranchNodes[0], 'bottom');
        }
        for (let index = 0; index < preBranchNodes.length - 1; index += 1) {
          pushFlowEdge(
            preBranchNodes[index],
            preBranchNodes[index + 1],
            getFlowSourceHandle(preBranchNodes[index]),
          );
        }
        if (
          sourceNode &&
          inferredBranchSource.id !== sourceNode.id &&
          preBranchNodes.length === 0
        ) {
          pushFlowEdge(sourceNode, inferredBranchSource, 'bottom');
        }
        inferredEndingNodes.forEach((endingNode, index) => {
          pushFlowEdge(
            inferredBranchSource,
            endingNode,
            inferredBranchSource.type === 'storyNode'
              ? 'bottom'
              : getFlowSourceHandle(inferredBranchSource),
            (endingNode.data.title as string | undefined) ||
              `${language === 'zh' ? '结局' : 'Ending'} ${index + 1}`,
          );
        });
      } else if (hasExplicitConnections && mode !== 'adjacent-revision') {
        if (sourceNode && flowNodesToLink[0]) {
          pushFlowEdge(sourceNode, flowNodesToLink[0], 'bottom');
        }
        remainingCards.forEach((card, index) => {
          const sourceFlowNode = newNodes[index];
          if (
            !sourceFlowNode ||
            (sourceFlowNode.type !== 'storyNode' && sourceFlowNode.type !== 'numberConditionNode')
          ) {
            return;
          }
          (card.connectTo || []).forEach((targetRef) => {
            const targetFlowNode = resolveDraftNode(targetRef);
            if (targetFlowNode) {
              pushFlowEdge(sourceFlowNode, targetFlowNode, getFlowSourceHandle(sourceFlowNode));
            }
          });
          (card.branchTargets || []).forEach((branch) => {
            const targetFlowNode = resolveDraftNode(branch.target);
            if (targetFlowNode) {
              pushFlowEdge(
                sourceFlowNode,
                targetFlowNode,
                normalizeBranchHandle(sourceFlowNode, branch.handle),
                branch.label,
              );
            }
          });
        });
      } else {
        if (
          sourceNode &&
          flowNodesToLink[0] &&
          mode !== 'future-targets' &&
          mode !== 'adjacent-revision'
        ) {
          newEdges.push({
            id: `e-${sourceNode.id}-${flowNodesToLink[0].id}`,
            source: sourceNode.id,
            sourceHandle: 'bottom',
            target: flowNodesToLink[0].id,
            targetHandle: getFlowTargetHandle(sourceNode, flowNodesToLink[0]),
            type: 'customEdge',
          });
        }
        for (
          let i = 0;
          mode !== 'future-targets' &&
          mode !== 'adjacent-revision' &&
          i < flowNodesToLink.length - 1;
          i += 1
        ) {
          const sourceFlowNode = flowNodesToLink[i];
          const targetFlowNode = flowNodesToLink[i + 1];
          newEdges.push({
            id: `e-${sourceFlowNode.id}-${targetFlowNode.id}`,
            source: sourceFlowNode.id,
            sourceHandle: getFlowSourceHandle(sourceFlowNode),
            target: targetFlowNode.id,
            targetHandle: getFlowTargetHandle(sourceFlowNode, targetFlowNode),
            type: 'customEdge',
          });
        }
      }
      if (mode === 'bridge-to-target' && targetNode && flowNodesToLink.length > 0) {
        const lastBridgeNode = flowNodesToLink[flowNodesToLink.length - 1];
        newEdges.push({
          id: `e-${lastBridgeNode.id}-${targetNode.id}`,
          source: lastBridgeNode.id,
          sourceHandle: getFlowSourceHandle(lastBridgeNode),
          target: targetNode.id,
          targetHandle: getFlowTargetHandle(lastBridgeNode, targetNode),
          type: 'customEdge',
        });
      }

      const bridgeTargetPosition =
        mode === 'bridge-to-target' && sourceNode && targetNode
          ? {
              x: sourceNode.position.x,
              y:
                sourceNode.position.y +
                (sourceNode.measured?.height || (sourceNode.style?.height as number) || 200) +
                100 +
                storyNodesToLink.length * 280,
            }
          : null;
      setNodes((nds) => [
        ...nds
          .map((node) => ({
            ...node,
            selected: false,
            data: shouldReplaceInitialRoot ? { ...node.data, isRoot: false } : node.data,
            position:
              bridgeTargetPosition && node.id === targetNode?.id
                ? bridgeTargetPosition
                : node.position,
          }))
          .filter((node) => !(shouldReplaceInitialRoot && isDefaultInitialStoryNode(node))),
        ...newNodes,
      ]);
      if (newEdges.length > 0) setEdges((eds) => [...eds, ...newEdges]);
      return {
        count: filledCount + remainingCards.length,
        position: { x: center.x, y: center.y, zoom: tzoom },
        nodeIds: [...filledTargetNodeIds, ...newNodes.map((node) => node.id)],
      };
    },
    [edges, nodes, setNodes, setEdges, getCenterPosition, language, tzoom],
  );

  const getAgentDraftType = useCallback(
    (card: AssistantCardDraft): 'story' | 'character' | 'scene' | 'number-condition' => {
      const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
      if (
        card.type === 'character' ||
        card.type === 'scene' ||
        card.type === 'story' ||
        card.type === 'number-condition'
      ) {
        return card.type;
      }
      if (
        typeof card.threshold === 'number' ||
        (Array.isArray(card.ranges) && card.ranges.length > 0)
      ) {
        return 'number-condition';
      }
      if (
        cleanText(card.characterName) ||
        cleanText(card.personality) ||
        cleanText(card.features) ||
        cleanText(card.background)
      ) {
        return 'character';
      }
      if (
        cleanText(card.sceneName) ||
        cleanText(card.location) ||
        cleanText(card.items) ||
        cleanText(card.atmosphere)
      ) {
        return 'scene';
      }
      return 'story';
    },
    [],
  );

  const createAgentSkeletonCards = useCallback(
    (cards: AssistantCardDraft[]): AssistantCardDraft[] =>
      cards.map((card) => {
        const type = getAgentDraftType(card);
        const graphMetadata = {
          key: card.key || card.title,
          connectTo: card.connectTo,
          branchTargets: card.branchTargets,
        };
        if (type === 'character') {
          return {
            type,
            ...graphMetadata,
            characterName: language === 'zh' ? 'AI 角色' : 'AI Character',
            traits: '',
          };
        }
        if (type === 'scene') {
          return {
            type,
            ...graphMetadata,
            sceneName: language === 'zh' ? 'AI 场景' : 'AI Scene',
            description: '',
          };
        }
        if (type === 'number-condition') {
          return {
            type,
            ...graphMetadata,
            title: card.title,
            threshold: card.threshold,
            ranges: card.ranges,
          };
        }
        return {
          type,
          ...graphMetadata,
          title: language === 'zh' ? 'AI 剧情卡片' : 'AI Story Card',
          text: '',
        };
      }),
    [getAgentDraftType, language],
  );

  const getAgentFieldValue = useCallback(
    (card: AssistantCardDraft, fieldKey?: string) => {
      if (!fieldKey) return '';
      const type = getAgentDraftType(card);
      if (type === 'character') {
        const values: Record<string, string | undefined> = {
          'character-name': card.characterName || card.title,
          traits: card.traits || card.text,
          personality: card.personality,
          features: card.features,
          background: card.background,
          other: card.other,
        };
        return values[fieldKey] || '';
      }
      if (type === 'scene') {
        const values: Record<string, string | undefined> = {
          'scene-name': card.sceneName || card.title,
          description: card.description || card.text,
          location: card.location,
          items: card.items,
          atmosphere: card.atmosphere,
          other: card.other,
        };
        return values[fieldKey] || '';
      }
      const values: Record<string, string | undefined> = {
        title: card.title,
        'story-text': card.text,
      };
      return values[fieldKey] || '';
    },
    [getAgentDraftType],
  );

  const applyAgentFieldValue = useCallback(
    (nodeId: string, fieldKey: string | undefined, value: string, finalized = false) => {
      if (!fieldKey) return;
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== nodeId) return node;

          if (node.type === 'characterNode') {
            const updates: Record<string, unknown> = {};
            if (fieldKey === 'character-name') updates.characterName = value;
            if (fieldKey === 'traits') updates.traits = value;
            if (fieldKey === 'personality') {
              updates.personality = value;
              updates.showPersonality = true;
            }
            if (fieldKey === 'features') {
              updates.features = value;
              updates.showFeatures = true;
            }
            if (fieldKey === 'background') {
              updates.background = value;
              updates.showBackground = true;
            }
            if (fieldKey === 'other') {
              updates.other = value;
              updates.showOther = true;
            }
            return { ...node, data: { ...node.data, ...updates } };
          }

          if (node.type === 'sceneNode') {
            const updates: Record<string, unknown> = {};
            if (fieldKey === 'scene-name') updates.sceneName = value;
            if (fieldKey === 'description') updates.description = value;
            if (fieldKey === 'location') {
              updates.location = value;
              updates.showLocation = true;
            }
            if (fieldKey === 'items') {
              updates.items = value;
              updates.showItems = true;
            }
            if (fieldKey === 'atmosphere') {
              updates.atmosphere = value;
              updates.showAtmosphere = true;
            }
            if (fieldKey === 'other') {
              updates.other = value;
              updates.showOther = true;
            }
            return { ...node, data: { ...node.data, ...updates } };
          }

          if (node.type === 'storyNode') {
            if (fieldKey === 'title') {
              return { ...node, data: { ...node.data, title: value } };
            }
            if (fieldKey === 'story-text') {
              if (!finalized) {
                return { ...node, data: { ...node.data, text: value } };
              }
              const taggedStory = applyAssistantStoryTags(
                value,
                buildAssistantMentionReferencesFromNodes(currentNodes),
              );
              const sceneMedia = resolveAssistantStorySceneMedia(
                taggedStory.presentation,
                currentNodes,
              );
              return {
                ...node,
                data: {
                  ...node.data,
                  text: taggedStory.text,
                  ...(taggedStory.presentation ? { presentation: taggedStory.presentation } : {}),
                  ...sceneMedia,
                },
              };
            }
          }

          return node;
        }),
      );
    },
    [setNodes],
  );

  const prepareAgentFields = useCallback(
    (nodeIds: string[] | undefined, cards: AssistantCardDraft[]) => {
      if (!nodeIds || nodeIds.length === 0) return;
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const cardIndex = nodeIds.indexOf(node.id);
          if (cardIndex < 0) return node;

          const card = cards[cardIndex];
          if (!card) return node;

          if (node.type === 'characterNode') {
            return {
              ...node,
              data: {
                ...node.data,
                showPersonality: !!(card.personality || node.data.showPersonality),
                showFeatures: !!(card.features || node.data.showFeatures),
                showBackground: !!(card.background || node.data.showBackground),
                showOther: !!(card.other || node.data.showOther),
              },
            };
          }

          if (node.type === 'sceneNode') {
            return {
              ...node,
              data: {
                ...node.data,
                showLocation: !!(card.location || node.data.showLocation),
                showItems: !!(card.items || node.data.showItems),
                showAtmosphere: !!(card.atmosphere || node.data.showAtmosphere),
                showOther: !!(card.other || node.data.showOther),
              },
            };
          }

          return node;
        }),
      );
    },
    [setNodes],
  );

  const typeAgentFieldValue = useCallback(
    async (
      nodeId: string | undefined,
      fieldKey: string | undefined,
      value: string,
      shouldSkip: () => boolean,
    ) => {
      if (!nodeId || !fieldKey || !value) return;
      if (shouldSkip()) {
        applyAgentFieldValue(nodeId, fieldKey, value, true);
        return;
      }

      const maxSteps = 80;
      const stride = Math.max(1, Math.ceil(value.length / maxSteps));
      for (let index = stride; index < value.length; index += stride) {
        if (shouldSkip()) break;
        applyAgentFieldValue(nodeId, fieldKey, value.slice(0, index));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 18));
      }
      applyAgentFieldValue(nodeId, fieldKey, value, true);
    },
    [applyAgentFieldValue],
  );

  const createAssistantCards = useCallback(
    async (
      cards: AssistantCardDraft[],
      mode: AssistantCardPlacementMode = 'append',
      options?: AssistantCardPlacementOptions,
    ): Promise<AssistantCardPlacementResult> => {
      const selectedCount =
        options?.targetNodeIds?.length ??
        nodes.filter(
          (node) =>
            node.selected &&
            (node.type === 'storyNode' ||
              node.type === 'characterNode' ||
              node.type === 'sceneNode'),
        ).length;

      const placement = await runAgentCardPlacement({
        cards,
        mode,
        options,
        selectedCount,
        skipAnimation: skipAssistantAgentAnimation,
        execute: () => {
          if (mode === 'fill-selected' && options?.targetNodeIds?.length) {
            const placement = {
              count: Math.min(cards.length, options.targetNodeIds.length),
              nodeIds: options.targetNodeIds,
            };
            prepareAgentFields(placement.nodeIds, cards);
            return placement;
          }

          if (mode === 'fill-selected' && selectedCount > 0) {
            const placement = {
              count: Math.min(cards.length, selectedCount),
              nodeIds: nodes
                .filter(
                  (node) =>
                    node.selected &&
                    (node.type === 'storyNode' ||
                      node.type === 'characterNode' ||
                      node.type === 'sceneNode'),
                )
                .map((node) => node.id),
            };
            prepareAgentFields(placement.nodeIds, cards);
            return placement;
          }
          const placement = executeAssistantCardPlacement(
            createAgentSkeletonCards(cards),
            mode,
            options,
          );
          prepareAgentFields(placement.nodeIds, cards);
          return placement;
        },
        applyStep: async (step, result, shouldSkip) => {
          if (step.type !== 'type-field' || typeof step.cardIndex !== 'number') return;
          const card = cards[step.cardIndex];
          const value = getAgentFieldValue(card, step.fieldKey);
          await typeAgentFieldValue(
            result.nodeIds?.[step.cardIndex],
            step.fieldKey,
            value,
            shouldSkip,
          );
        },
      });

      const imageRequests = cards
        .map((card, index) => ({ card, index, type: getAgentDraftType(card) }))
        .filter(({ card }) => card.generateImage === true);

      if (imageRequests.length > 0 && !allowAssistantImageGeneration) {
        showToast(
          language === 'zh'
            ? 'AI 助手图片生成已在设置中关闭'
            : language === 'ja'
              ? 'AIアシスタントの画像生成は設定で無効になっています'
              : 'AI assistant image generation is disabled in settings',
        );
      } else if (imageRequests.length > 0 && missingImageApiKey) {
        requestSettingsAttention('image');
        showToast(
          language === 'zh'
            ? '请先在设置 > AI 配置 > 图片 AI 中连接图片 API'
            : language === 'ja'
              ? '設定 > AI設定 > Image AI で画像APIを接続してください'
              : 'Connect an Image AI API in Settings > AI Settings > Image AI first',
        );
      } else if (imageRequests.length > 0) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        for (const request of imageRequests) {
          const nodeId = placement.nodeIds?.[request.index];
          if (!nodeId) continue;
          if (request.type === 'character' || request.type === 'scene') {
            await handleGenerateSettingNodeImage(nodeId, request.type);
          } else {
            await handleGenerateStoryNodeImage(nodeId);
          }
        }
      }

      return placement;
    },
    [
      allowAssistantImageGeneration,
      createAgentSkeletonCards,
      executeAssistantCardPlacement,
      getAgentFieldValue,
      getAgentDraftType,
      handleGenerateSettingNodeImage,
      handleGenerateStoryNodeImage,
      language,
      missingImageApiKey,
      nodes,
      prepareAgentFields,
      requestSettingsAttention,
      runAgentCardPlacement,
      skipAssistantAgentAnimation,
      showToast,
      typeAgentFieldValue,
    ],
  );

  const updateStreamingAssistantCards = useCallback(
    (nodeIds: string[] | undefined, cards: AssistantCardDraft[]) => {
      if (!nodeIds || nodeIds.length === 0 || cards.length === 0) return;
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const cardIndex = nodeIds.indexOf(node.id);
          if (cardIndex < 0) return node;
          const card = cards[cardIndex];
          if (!card) return node;
          const type = getAgentDraftType(card);

          if (node.type === 'characterNode' && type === 'character') {
            return {
              ...node,
              data: {
                ...node.data,
                characterName: card.characterName || card.title || node.data.characterName,
                traits: card.traits || card.text || node.data.traits || '',
                personality: card.personality || node.data.personality || '',
                features: card.features || node.data.features || '',
                background: card.background || node.data.background || '',
                other: card.other || node.data.other || '',
                showPersonality: !!(card.personality || node.data.showPersonality),
                showFeatures: !!(card.features || node.data.showFeatures),
                showBackground: !!(card.background || node.data.showBackground),
                showOther: !!(card.other || node.data.showOther),
              },
            };
          }

          if (node.type === 'sceneNode' && type === 'scene') {
            return {
              ...node,
              data: {
                ...node.data,
                sceneName: card.sceneName || card.title || node.data.sceneName,
                description: card.description || card.text || node.data.description || '',
                location: card.location || node.data.location || '',
                items: card.items || node.data.items || '',
                atmosphere: card.atmosphere || node.data.atmosphere || '',
                other: card.other || node.data.other || '',
                showLocation: !!(card.location || node.data.showLocation),
                showItems: !!(card.items || node.data.showItems),
                showAtmosphere: !!(card.atmosphere || node.data.showAtmosphere),
                showOther: !!(card.other || node.data.showOther),
              },
            };
          }

          if (node.type === 'numberConditionNode' && type === 'number-condition') {
            const currentData = node.data as NumberConditionNodeData;
            return {
              ...node,
              data: {
                ...currentData,
                threshold: card.threshold ?? currentData.threshold ?? 0,
                ranges:
                  card.ranges?.map((range) => ({
                    id: uuidv4(),
                    min: range.min,
                    max: range.max,
                  })) || currentData.ranges,
              } satisfies NumberConditionNodeData,
            };
          }

          if (node.type !== 'storyNode' || type !== 'story') return node;

          const taggedStory = applyAssistantStoryTags(
            card.text || '',
            buildAssistantMentionReferencesFromNodes(currentNodes),
          );
          const sceneMedia = resolveAssistantStorySceneMedia(
            taggedStory.presentation,
            currentNodes,
          );
          return {
            ...node,
            data: {
              ...node.data,
              title: card.title || node.data.title,
              text: taggedStory.text,
              nodeValue: card.nodeValue,
              ...(taggedStory.presentation ? { presentation: taggedStory.presentation } : {}),
              ...sceneMedia,
            },
          };
        }),
      );
    },
    [getAgentDraftType, setNodes],
  );

  const handleGenerateAssistantImagesForNodes = useCallback(
    async (nodeIds: string[]) => {
      const visualNodes = nodeIds
        .map((nodeId) => nodes.find((node) => node.id === nodeId))
        .filter(
          (node): node is Node =>
            Boolean(node) && (node?.type === 'characterNode' || node?.type === 'sceneNode'),
        );

      if (visualNodes.length === 0) return;

      if (!allowAssistantImageGeneration) {
        showToast(
          language === 'zh'
            ? 'AI 助手图片生成已在设置中关闭'
            : language === 'ja'
              ? 'AIアシスタントの画像生成は設定で無効になっています'
              : 'AI assistant image generation is disabled in settings',
        );
        return;
      }

      if (missingImageApiKey) {
        requestSettingsAttention('image');
        showToast(
          language === 'zh'
            ? '请先在设置 > AI 配置 > 图片 AI 中连接图片 API'
            : language === 'ja'
              ? '設定 > AI設定 > Image AI で画像APIを接続してください'
              : 'Connect an Image AI API in Settings > AI Settings > Image AI first',
        );
        return;
      }

      for (const node of visualNodes) {
        await handleGenerateSettingNodeImage(
          node.id,
          node.type === 'characterNode' ? 'character' : 'scene',
        );
      }
    },
    [
      allowAssistantImageGeneration,
      handleGenerateSettingNodeImage,
      language,
      missingImageApiKey,
      nodes,
      requestSettingsAttention,
      showToast,
    ],
  );

  const handleAssistantMessagePositionClick = useCallback(
    (target: { position?: { x: number; y: number; zoom?: number }; nodeIds?: string[] }) => {
      const targetIds = new Set(target.nodeIds || []);
      const targetNodes = nodes.filter((node) => targetIds.has(node.id));

      if (targetNodes.length > 0) {
        setNodes((currentNodes) =>
          currentNodes.map((node) => ({
            ...node,
            selected: targetIds.has(node.id),
          })),
        );
        void fitView({
          nodes: targetNodes,
          padding: 0.3,
          duration: 450,
          maxZoom: 1.2,
        });
        return;
      }

      if (!target.position) return;
      void setCenter(target.position.x, target.position.y, {
        zoom: target.position.zoom ?? tzoom,
        duration: 450,
      });
    },
    [fitView, nodes, setCenter, setNodes, tzoom],
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
    handleAssistantOptionSelect,
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
  } = useAssistantPanel({
    language,
    isMobile,
    flowWidth: effectiveFlowWidth,
    selectedAssistantTargetNodes,
    nodes,
    callAIForTextResult,
    callAIForTextStream,
    createAssistantCards,
    updateStreamingAssistantCards,
    onGenerateAssistantImagesRequest: handleGenerateAssistantImagesForNodes,
    startAgentWaiting: skipAssistantAgentAnimation ? undefined : startAgentWaiting,
    stopAgentWaiting,
    hasTextApiKey: !missingTextApiKey,
    onMissingTextApiKeyRequest: () => {
      requestSettingsAttention('text');
    },
    assistantMemorySkillEnabled,
    assistantMemoryNotes,
    setAssistantMemoryNotes,
  });
  const miniMapOverlayStyle =
    !isMobile && bubbleStyle === 'glass' && assistantOpen && miniMapPosition === 'right'
      ? { right: assistantPanelWidth + 16 }
      : undefined;

  const { getProjectSnapshot, applyProjectData, confirmExportJSON, importProjectFile, handleImportZIP } =
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

  const loadExampleTemplates = useCallback(async () => {
    if (isTauriRuntime()) return;

    setExamplesLoading(true);
    setExamplesError(null);
    try {
      const response = await fetch(EXAMPLES_MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setExampleTemplates(normalizeExampleTemplates(await response.json()));
    } catch (error) {
      console.warn('Failed to load example templates', error);
      setExampleTemplates([]);
      setExamplesError(
        language === 'zh'
          ? '没有读取到 examples/manifest.json。上传模板 ZIP 后，请同时上传模板清单。'
          : 'Could not load examples/manifest.json. Upload the template manifest with your ZIP files.',
      );
    } finally {
      setExamplesLoading(false);
    }
  }, [language]);

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

    pendingInitialSnapshotSyncProjectIdRef.current = projectId;
    pendingInitialSnapshotCandidateRef.current = '';
    setIsProjectSnapshotSynced(false);
    setCurrentProjectId(projectId);
    setCurrentProjectFilePath(projectFilePath);
      setSaveFileName(projectName.trim() || DEFAULT_PROJECT_FILE_NAME);
      setProjectTitle(projectData.settings?.projectTitle?.trim() || '');
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
      enabled: Boolean(didHydrateLocalState && currentProjectId && isProjectSnapshotSynced),
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
    lastSavedSnapshot.current = stableStringify(blankSnapshot);
    setIsDirty(false);
    setIsProjectSnapshotSynced(true);
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
      lastSavedSnapshot.current = stableStringify(snapshot);
      setIsDirty(false);
      setIsProjectSnapshotSynced(true);
      await clearAutoSave();
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
    clearAutoSave,
    projectTitle,
    refreshProjectSummaries,
    saveFileName,
    showToast,
  ]);

  React.useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (!modifier || event.key.toLowerCase() !== 's' || event.altKey) return;

      event.preventDefault();
      event.stopPropagation();
      void saveCurrentProject();
    };

    document.addEventListener('keydown', handleSaveShortcut, true);
    return () => document.removeEventListener('keydown', handleSaveShortcut, true);
  }, [saveCurrentProject]);

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
    lastSavedSnapshot.current = stableStringify(emptyProject);
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

      if (action.type === 'import-example') {
        try {
          importModeRef.current = 'new';
          const response = await fetch(action.template.file, { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const fileName =
            action.template.file.split('/').pop()?.split('?')[0] || `${action.template.id}.zip`;
          await importProjectFile(
            new File([blob], fileName, { type: blob.type || 'application/zip' }),
          );
        } catch (error) {
          console.error('Failed to import example template', error);
          showToast(
            language === 'zh' ? '模板导入失败，请检查 examples 文件。' : 'Template import failed.',
            'error',
          );
        }
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
    [handleCreateProject, importProjectFile, language, showToast],
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

  React.useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlistenCloseRequest: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        if (cancelled) return;
        unlistenCloseRequest = await listen('galwriter-close-requested', () => {
          if (isDirty) {
            requestProjectAction({ type: 'close-window' });
            return;
          }

          setShowAppClosePrompt(true);
        });
      } catch (error) {
        console.error('Failed to listen for app close requests:', error);
      }
    })();

    return () => {
      cancelled = true;
      void unlistenCloseRequest?.();
    };
  }, [isDirty, requestProjectAction]);

  React.useEffect(() => {
    if (isTauriRuntime()) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleConfirmAppClose = useCallback(() => {
    setShowAppClosePrompt(false);
    void performPendingProjectAction({ type: 'close-window' });
  }, [performPendingProjectAction]);

  const handleCancelAppClose = useCallback(() => {
    setShowAppClosePrompt(false);
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
              {
                showTitles: project.projectData.settings?.showTitles,
                storyTitlePlacement: project.projectData.settings?.storyTitlePlacement,
              },
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
                    {
                      showTitles: project.projectData.settings?.showTitles,
                      storyTitlePlacement: project.projectData.settings?.storyTitlePlacement,
                    },
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

  const handleImportExampleTemplate = useCallback(
    (template: ProjectExampleTemplate) => {
      requestProjectAction({ type: 'import-example', template });
    },
    [requestProjectAction],
  );

  const handleDownloadExampleTemplate = useCallback((template: ProjectExampleTemplate) => {
    const link = document.createElement('a');
    link.href = template.file;
    link.download = template.file.split('/').pop()?.split('?')[0] || `${template.id}.zip`;
    link.rel = 'noopener';
    link.click();
  }, []);

  const openImportPicker = useCallback(() => {
    importModeRef.current = 'replace';
    jsonInputRef.current?.click();
  }, []);

  const handleChooseDefaultProjectSaveLocation = useCallback(async () => {
    if (!isTauriRuntime()) {
      showToast(
        language === 'zh'
          ? '默认保存位置仅在桌面端可设置'
          : 'Default save location can only be set in the app',
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
        setShowProjectHome(!isMobile && projects.length > 0);
        setDefaultProjectSaveDir(appSettings.defaultProjectSaveDir || null);
        if (!isTauriRuntime()) {
          void loadExampleTemplates();
        }

        setSavedAIProfiles(savedProfilesState.profiles);
        const savedTextProfileId = savedProfilesState.activeTextProfileId;
        const shouldUseHostedProxyByDefault = !isTauriRuntime() && !import.meta.env.DEV;
        setActiveTextProfileId(
          shouldUseHostedProxyByDefault ? HOSTED_PROXY_PROFILE_ID : savedTextProfileId,
        );
        setActiveImageProfileId(
          shouldUseHostedProxyByDefault
            ? HOSTED_IMAGE_PROXY_PROFILE_ID
            : savedProfilesState.activeImageProfileId,
        );
        setActiveBackgroundRemovalProfileId(
          savedProfilesState.activeBackgroundRemovalProfileId ?? null,
        );
        setActiveVoiceProfileId(
          shouldUseHostedProxyByDefault
            ? HOSTED_VOICE_PROXY_PROFILE_ID
            : savedProfilesState.activeVoiceProfileId,
        );

        setTheme(appSettings.theme ?? 'system');
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
  }, [loadExampleTemplates]);

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
      pendingInitialSnapshotSyncProjectIdRef.current = null;
      pendingInitialSnapshotCandidateRef.current = '';
      setIsDirty(false);
      setIsProjectSnapshotSynced(true);
      return;
    }

    const currentSnapshot = getProjectSnapshot();
    const savedSnapshot = lastSavedSnapshot.current;
    if (pendingInitialSnapshotSyncProjectIdRef.current === currentProjectId) {
      if (pendingInitialSnapshotCandidateRef.current === currentSnapshot) {
        lastSavedSnapshot.current = currentSnapshot;
        pendingInitialSnapshotSyncProjectIdRef.current = null;
        pendingInitialSnapshotCandidateRef.current = '';
        setIsProjectSnapshotSynced(true);
      } else {
        pendingInitialSnapshotCandidateRef.current = currentSnapshot;
        setIsProjectSnapshotSynced(false);
      }
      setIsDirty(false);
      return;
    }

    setIsProjectSnapshotSynced(true);
    setIsDirty(currentSnapshot !== savedSnapshot);
  }, [currentProjectId, getProjectSnapshot]);

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
      const layoutDirection = plotStructureGenerateDirection;
      const layoutConfig = PLOT_STRUCTURE_DIRECTION_CONFIG[layoutDirection];

      if (regionStoryNodes.length === 0) {
        await showDialogAlert({
          title: language === 'zh' ? '无法生成剧情' : language === 'ja' ? '生成できません' : 'Unable to generate',
          description:
            language === 'zh'
              ? '区域内没有找到可续写的剧情卡片'
              : language === 'ja'
                ? 'エリア内に続きから生成できるストーリーカードがありません'
                : 'No story cards were found in this area to continue from.',
          tone: 'warning',
        });
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

剧情卡片生成方向：
${layoutConfig.label}

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
          await showDialogAlert({
            title:
              language === 'zh'
                ? '解析失败'
                : language === 'ja'
                  ? '解析に失敗しました'
                  : 'Parsing failed',
            description:
              language === 'zh'
                ? 'AI 返回内容无法解析，请重试'
                : language === 'ja'
                  ? 'AI の返答を解析できませんでした。もう一度お試しください'
                  : 'The AI response could not be parsed. Please try again.',
            tone: 'warning',
          });
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
            sourceHandle: layoutConfig.sourceHandle,
            target: newIds[i],
            targetHandle: layoutConfig.targetHandle,
            type: 'customEdge',
          });
          sourceId = newIds[i];
        }

        setNodes((nds) => {
          const lastNode = nds.find((n) => n.id === lastNodeId);
          if (!lastNode) return nds;

          const srcW = lastNode.measured?.width || (lastNode.style?.width as number) || 300;
          const srcH = lastNode.measured?.height || (lastNode.style?.height as number) || 200;
          const cardWidth = 300;
          const cardHeight = 200;
          const offsetDist = 120;
          const startPosition =
            layoutConfig.primaryAxis === 'x'
              ? {
                  x:
                    layoutDirection === 'left'
                      ? lastNode.position.x - cardWidth - offsetDist
                      : lastNode.position.x + srcW + offsetDist,
                  y: lastNode.position.y,
                }
              : {
                  x: lastNode.position.x,
                  y:
                    layoutDirection === 'up'
                      ? lastNode.position.y - cardHeight - offsetDist
                      : lastNode.position.y + srcH + offsetDist,
                };
          let currentX = startPosition.x;
          let currentY = startPosition.y;

          const newNodes: Node[] = cards.map((card, index) => {
            const newId = newIds[index];
            const isOccupied = (x: number, y: number) =>
              nds.some((n) => Math.abs(n.position.x - x) < 50 && Math.abs(n.position.y - y) < 50);

            let attempts = 0;
            while (isOccupied(currentX, currentY) && attempts < 10) {
              if (layoutConfig.collisionAxis === 'x') {
                currentX += layoutConfig.collisionStep;
              } else {
                currentY += layoutConfig.collisionStep;
              }
              attempts++;
            }

            const node: Node = {
              id: newId,
              type: 'storyNode',
              position: { x: currentX, y: currentY },
              style: { width: cardWidth, height: cardHeight },
              data: {
                id: newId,
                title: card.title,
                text: card.text,
                shape: 'square',
                color: '#ffffff',
                sizeMode: 'auto',
              } satisfies StoryNodeData,
            };

            if (layoutConfig.primaryAxis === 'x') {
              currentX += layoutConfig.primaryDelta;
            } else {
              currentY += layoutConfig.primaryDelta;
            }
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
        await showDialogAlert({
          title:
            language === 'zh'
              ? '剧情生成失败'
              : language === 'ja'
                ? 'プロット生成に失敗しました'
                : 'Plot generation failed',
          description:
            error.message ||
            (language === 'zh'
              ? '请检查 API 密钥和网络连接'
              : language === 'ja'
                ? 'API キーとネットワーク接続を確認してください'
                : 'Check your API key and network connection.'),
          tone: 'warning',
        });
      }
    },
    [callAIForText, generateLength, language, plotStructureGenerateDirection, setEdges, setNodes, showDialogAlert],
  );

  const handleAIAnalyze = useCallback(
    async (nodeId: string, mode: string = 'summary') => {
      try {
        await runAIAnalyze(nodeId, mode);
      } catch (error: any) {
        console.error('AI Analysis failed:', error);
        await showDialogAlert({
          title:
            language === 'zh'
              ? 'AI 分析失败'
              : language === 'ja'
                ? 'AI 分析に失敗しました'
                : 'AI analysis failed',
          description:
            error.message ||
            (language === 'zh'
              ? '请检查网络和 API 配置'
              : language === 'ja'
                ? 'ネットワークと API 配置を確認してください'
                : 'Check your network and API configuration.'),
          tone: 'warning',
        });
      }
    },
    [language, runAIAnalyze, showDialogAlert],
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
    (event: React.MouseEvent, node: Node) => {
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
    [setNodes],
  );

  // Bind callbacks to nodes and edges on render
  const nodesWithCallbacks = useMemo<Node[]>(() => {
    return nodes.map((n) => {
      const isHighlighted = highlightedPath?.nodes.has(n.id);
      return {
        ...n,
        hidden: !!n.data?.hidden,
        draggable: !n.data?.locked,
        selectable: !n.data?.locked,
        data: {
          ...n.data,
          canvasBg,
          showTitles,
          storyTitlePlacement,
          isAILoading: aiLoadingNodeId === n.id,
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
          onRemoveCharacterImageBackground: handleRemoveCharacterImageBackground,
          onAddTextToImage: handleAddTextToImage,
          onRemoveTextFromImage: handleRemoveTextFromImage,
          onExtractMedia: handleExtractMedia,
          onGenerateSettingText: handleGenerateSettingText,
          onPlotStructureGenerate: handlePlotStructureGenerate,
          onHighlightStoryline: toggleStorylineHighlight,
          isHighlighted,
          pasteAsPlainText,
          showNodeActions,
          cardToolbarScale,
          language,
          theme,
        },
        style: {
          ...n.style,
          opacity: highlightedPath ? (isHighlighted ? 1 : 0.15) : 1,
          filter: highlightedPath && !isHighlighted ? 'grayscale(0.8) blur(1px)' : 'none',
          // NOTE: 极其重要：不要在这里使用 transition: all，否则拖拽时 transform 会有延迟，导致不跟手
          transition: 'opacity 0.5s ease-in-out, filter 0.5s ease-in-out',
        },
      };
    });
    // NOTE: 补充 highlightedPath、handleAIAnalyze、toggleStorylineHighlight 为正确依赖，
    // 防止闭包过期导致这些引用读到旧值
  }, [
    nodes,
    canvasBg,
    showTitles,
    storyTitlePlacement,
    aiLoadingNodeId,
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
    handleRemoveCharacterImageBackground,
    handleAddTextToImage,
    handleRemoveTextFromImage,
    handleExtractMedia,
    handleGenerateSettingText,
    handlePlotStructureGenerate,
    toggleStorylineHighlight,
    highlightedPath,
    pasteAsPlainText,
    showNodeActions,
    cardToolbarScale,
    language,
    theme,
    bubbleStyle,
  ]);

  const edgesWithData = useMemo(() => {
    const hiddenNodeIds = new Set(nodes.filter((n) => n.data?.hidden).map((n) => n.id));

    return edges.map((e) => {
      const isHighlighted = highlightedPath?.edges.has(e.id);
      const highlightColors = highlightedPath?.edgeColors.get(e.id) || ['#f43f5e'];
      const highlightColor = highlightColors[0] || '#f43f5e';
      const isHiddenByNode = hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target);
      const markerEnd = typeof e.markerEnd === 'object' && e.markerEnd ? e.markerEnd : {};

      return {
        ...e,
        hidden: isHiddenByNode,
        type: 'customEdge',
        markerEnd: {
          ...markerEnd,
          type: MarkerType.ArrowClosed,
          width: arrowSize,
          height: arrowSize,
          color: isHighlighted ? highlightColor : edgeColor,
        },
        data: {
          ...e.data,
          edgeStyle,
          arrowSize,
          arrowCornerRadius,
          arrowTipAngle,
          edgeColor: isHighlighted ? highlightColor : edgeColor,
          edgeColors: isHighlighted ? highlightColors : undefined,
          onDelete: handleEdgeDelete,
          onReverse: () => onEdgeDoubleClick(null as any, e),
          isHighlighted,
          // NOTE: 传递 isMobile，以便 CustomEdge 能识别并执行手机端长按删除逻辑
          isMobile,
        },
        style: {
          ...e.style,
          stroke: isHighlighted ? highlightColor : edgeColor,
          strokeWidth: isHighlighted ? 6 : e.style?.strokeWidth || 3,
          opacity: highlightedPath ? (isHighlighted ? 1 : 0.1) : 1,
          // NOTE: 同理，连线也只针对样式属性过渡，防止 transform 延迟
          transition:
            'stroke 0.5s ease-in-out, stroke-width 0.5s ease-in-out, opacity 0.5s ease-in-out',
        },
        animated: highlightedPath ? false : e.animated,
      };
    });
  }, [
    arrowSize,
    arrowCornerRadius,
    arrowTipAngle,
    edgeColor,
    edges,
    nodes,
    edgeStyle,
    handleEdgeDelete,
    highlightedPath,
    isMobile,
    onEdgeDoubleClick,
  ]);

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
            interactionMode={interactionMode}
            showHoverButtonAnimations={showHoverButtonAnimations}
            historyPastLength={history.past.length}
            historyFutureLength={history.future.length}
            hasHiddenNodes={nodes.some((node) => node.data?.hidden)}
            fileInputRef={fileInputRef}
            setToolbarCollapsed={setToolbarCollapsed}
            setInteractionMode={setInteractionMode}
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
            settingsAttentionTarget={settingsAttentionTarget}
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
            style={{ touchAction: canvasTouchAction }}
          >
            {/* NOTE: 自定义框选框，仅在右键拖拽时显示 */}
            <div
              ref={selectionBoxRef}
              className="fixed pointer-events-none z-[9999] border-2 border-dashed border-indigo-500 bg-indigo-500/10 rounded-sm"
              style={{ display: 'none' }}
            />
            <ReactFlow
              className="story-canvas-flow"
              nodes={nodesWithCallbacks}
              edges={edgesWithData}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onNodeClick={handleNodeClick}
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
                color={resolvedTheme === 'dark' ? '#334155' : '#cbd5e1'}
                gap={24}
                size={1}
              />
              {showMiniMap && (
                <div
                  className={`canvas-bottom-overlay ${showStats ? '' : 'canvas-bottom-overlay-no-footer'} toolbar-bubble-surface absolute ${miniMapPosition === 'left' ? 'left-4' : 'right-4'} bottom-4 z-[50] bg-[var(--toolbar-bg)] backdrop-blur-md border border-[var(--toolbar-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300`}
                  style={miniMapOverlayStyle}
                >
                  <div className="minimap-clip w-full overflow-hidden rounded-t-xl">
                    <MiniMap
                      pannable={true}
                      zoomable={true}
                      className="!static !block !bg-transparent !border-none !m-0"
                      nodeColor={bubbleStyle === 'glass' ? 'rgba(255, 255, 255, 0.38)' : '#dbeafe'}
                      nodeStrokeColor={
                        bubbleStyle === 'glass' ? 'rgba(255, 255, 255, 0.78)' : '#4f46e5'
                      }
                      nodeBorderRadius={6}
                      maskColor={
                        bubbleStyle === 'glass'
                          ? resolvedTheme === 'dark'
                            ? 'rgba(0, 0, 0, 0.3)'
                            : 'rgba(0, 0, 0, 0.08)'
                          : resolvedTheme === 'dark'
                            ? 'rgba(84, 185, 251, 0.12)'
                            : 'rgba(79, 70, 229, 0.08)'
                      }
                      style={{ height: 120, width: 160 }}
                    />
                  </div>
                  {showControls && (
                    <div className="minimap-controls border-t border-[var(--toolbar-border)] flex items-center h-8 w-full bg-transparent">
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
                  style={miniMapOverlayStyle}
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
              isMobile={isMobile}
              language={language}
              ttsLoading={ttsLoading}
              onWrapDynamicGroup={wrapWithDynamicGroup}
              onWrapBackground={wrapSelectedWithBackground}
              onArrange={arrangeSelected}
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
        <footer className="editor-footer h-8 bg-white dark:bg-black text-slate-500 dark:text-white border-t border-slate-100 dark:border-white/5 flex items-center justify-between px-4 text-[10px] font-bold tracking-wide z-20 shrink-0 transition-colors">
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
            onLanguageChange={onAppLanguageChange}
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
            autoAdvance={playTestAutoAdvance}
            setAutoAdvance={setPlayTestAutoAdvance}
            autoAdvanceDelay={playTestAutoAdvanceDelay}
            setAutoAdvanceDelay={setPlayTestAutoAdvanceDelay}
            hideCharacterTags={playTestHideCharacterTags}
            setHideCharacterTags={setPlayTestHideCharacterTags}
            hideSceneTags={playTestHideSceneTags}
            setHideSceneTags={setPlayTestHideSceneTags}
            renderStyle={sharedRenderStyle}
            updateRenderStyle={updateSharedRenderStyle}
            isMobile={isMobile}
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
            onUpdateNodeData={handleUpdateNode}
            language={language}
            workspaceKey={currentProjectId || currentProjectFilePath || 'draft'}
            renderStyle={sharedRenderStyle}
            updateRenderStyle={updateSharedRenderStyle}
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
          selectionMenuLayout={selectionMenuLayout}
          setSelectionMenuLayout={setSelectionMenuLayout}
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
          characterImageMode={characterImageMode}
          setCharacterImageMode={setCharacterImageMode}
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

      <ConfirmActionModal
        visible={showAppClosePrompt}
        language={language}
        title={language === 'zh' ? '退出应用？' : language === 'ja' ? 'アプリを終了しますか？' : 'Quit app?'}
        description={
          language === 'zh'
            ? '确定要关闭 GalWriter AI 吗？'
            : language === 'ja'
              ? 'GalWriter AI を終了しますか？'
              : 'Are you sure you want to quit GalWriter AI?'
        }
        confirmLabel={language === 'zh' ? '退出应用' : language === 'ja' ? '終了' : 'Quit'}
        cancelLabel={language === 'zh' ? '取消' : language === 'ja' ? 'キャンセル' : 'Cancel'}
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
            const zenPresentation = normalizeStoryPresentation(node?.data.presentation as any);
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
                    const isPresented = zenPresentation.characters.some(
                      (item) => item.sourceNodeId === n.id,
                    );
                    return isGlobal || isConnected || isPresented;
                  })
                  .map((n) => {
                    const config = zenPresentation.characters.find(
                      (item) => item.sourceNodeId === n.id,
                    );
                    const outfits = Array.isArray(n.data.outfits) ? n.data.outfits : [];
                    const outfit = config?.outfitId
                      ? outfits.find((item: any) => item.id === config.outfitId)
                      : outfits.find((item: any) => item.imageUrl);
                    return {
                      id: n.id,
                      name: String(n.data.characterName).trim(),
                      imageUrl:
                        (outfit as { imageUrl?: string } | undefined)?.imageUrl ||
                        (typeof n.data.avatarUrl === 'string' ? n.data.avatarUrl : undefined),
                    };
                  })
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
                    const isPresented = zenPresentation.scene?.sourceNodeId === n.id;
                    return isGlobal || isConnected || isPresented;
                  })
                  .map((n) => ({ id: n.id, name: String(n.data.sceneName).trim() }))
              : [];
            const presentationScene = zenPresentation.scene
              ? nodes.find((n) => n.id === zenPresentation.scene?.sourceNodeId)
              : undefined;
            const presentationSceneImages = Array.isArray(presentationScene?.data.images)
              ? (presentationScene.data.images as Array<{
                  id: string;
                  imageUrl?: string;
                  videoUrl?: string;
                }>)
              : [];
            const selectedPresentationSceneMedia = zenPresentation.scene?.imageId
              ? presentationSceneImages.find((image) => image.id === zenPresentation.scene?.imageId)
              : undefined;
            const zenVideoUrl =
              selectedPresentationSceneMedia?.videoUrl ||
              (typeof node?.data.videoUrl === 'string' ? node.data.videoUrl : undefined);
            const zenImageUrl = zenVideoUrl
              ? undefined
              : (typeof node?.data.imageUrl === 'string' ? node.data.imageUrl : undefined) ||
                selectedPresentationSceneMedia?.imageUrl ||
                (typeof presentationScene?.data.coverImageUrl === 'string'
                  ? presentationScene.data.coverImageUrl
                  : '');
            const handleZenPresentationChange = (presentation: StoryPresentation) => {
              const nextPresentation = normalizeStoryPresentation(presentation);
              const updates: Partial<StoryNodeData> = { presentation: nextPresentation };
              if (nextPresentation.scene) {
                Object.assign(updates, resolveAssistantStorySceneMedia(nextPresentation, nodes));
              } else if (zenPresentation.scene) {
                updates.imageUrl = zenPresentation.scene.previousImageUrl;
                updates.videoUrl = zenPresentation.scene.previousVideoUrl;
                updates.showTextOverlay =
                  zenPresentation.scene.previousShowTextOverlay ??
                  (node?.data.showTextOverlay as boolean | undefined);
              }
              handleUpdateNode(zenModeNodeId, updates);
            };
            const handleZenTextChange = (val: string) => {
              const synced = syncPresentationWithStoryMentions(val, zenPresentation, nodes);
              const updates: Partial<StoryNodeData> = {
                text: val,
                presentation: synced.presentation,
              };
              if (synced.removedScene) {
                updates.imageUrl = synced.removedScene.previousImageUrl;
                updates.videoUrl = synced.removedScene.previousVideoUrl;
                updates.showTextOverlay =
                  synced.removedScene.previousShowTextOverlay ??
                  (node?.data.showTextOverlay as boolean | undefined);
              }
              handleUpdateNode(zenModeNodeId, updates);
            };
            return (
              <ZenEditor
                nodeId={zenModeNodeId}
                value={typeof node?.data.text === 'string' ? node.data.text : ''}
                imageUrl={zenImageUrl}
                videoUrl={zenVideoUrl}
                audioUrl={typeof node?.data.audioUrl === 'string' ? node.data.audioUrl : ''}
                audioClips={
                  Array.isArray(node?.data.audioClips)
                    ? (node.data.audioClips as StoryAudioClip[])
                    : []
                }
                characterTags={characterTags}
                sceneTags={sceneTags}
                presentation={zenPresentation}
                isAILoading={aiLoadingNodeId === zenModeNodeId}
                onAIGenerate={() => handleAIButtonClick(zenModeNodeId)}
                onGenerateImage={() => handleGenerateStoryNodeImage(zenModeNodeId)}
                onGenerateAudio={() => handleGenerateStoryNodeSpeech(zenModeNodeId)}
                onAudioClipsChange={(audioClips) => {
                  const firstPlayable = audioClips.find((clip) => !clip.skipped);
                  handleUpdateNode(zenModeNodeId, {
                    audioClips,
                    audioUrl: firstPlayable?.url,
                  });
                }}
                onChange={handleZenTextChange}
                onPresentationChange={handleZenPresentationChange}
                onClose={() => setZenModeNodeId(null)}
              />
            );
          })()}
      </Suspense>

      <AgentOverlay state={agentState} language={language} />

      {/* Global Toast Notification */}
      <EditorToast message={toast.message} visible={toast.visible} tone={toast.tone} />
    </div>
  );
}
