import type { Node } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

import type {
  CharacterPresentation,
  InlinePresentationActionType,
  StoryPresentation,
} from '../../domain/project';
import type { Language } from '../../lib/i18n';
import {
  createCharacterPresentation,
  createInlinePresentationAction,
  createPresentationMotion,
  createScenePresentation,
  normalizeStoryPresentation,
} from '../../lib/presentation';
import { getNodePlacementBounds } from './assistantCardPlacementLayout';
import { AI_SCENE_CARD_LAYOUT_HEIGHT, SETTING_NODE_CARD_WIDTH } from './constants';

/** A real editable source for scene tags when a story starts without any scene settings. */
export const createAssistantFallbackScene = (
  nodes: Node[],
  language: Language,
  id = uuidv4(),
): Node => ({
  id,
  type: 'sceneNode',
  position: {
    x: Math.max(0, ...nodes.map((node) => getNodePlacementBounds(node).maxX)) + 120,
    y: nodes.length ? Math.min(...nodes.map((node) => node.position.y)) : 0,
  },
  style: { width: SETTING_NODE_CARD_WIDTH, height: AI_SCENE_CARD_LAYOUT_HEIGHT },
  data: {
    id,
    sceneName:
      language === 'zh' ? '默认场景' : language === 'ja' ? '既定のシーン' : 'Default scene',
    scenePresetEnabled: false,
  },
});

export type AssistantMentionReference = {
  id: string;
  kind: 'character' | 'scene';
  name: string;
  prependIfMissing?: boolean;
};

export type AssistantMentionUsage = {
  id: string;
  reference: AssistantMentionReference;
  placement: 'start' | 'end' | 'inline';
};

export const escapeAssistantStoryText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br />');

export const createAssistantMentionHtml = (
  kind: AssistantMentionReference['kind'],
  name: string,
  id: string,
) => {
  const safeName = escapeAssistantStoryText(name);
  return `<span class="mention-chip mention-chip-${kind}" data-mention-kind="${kind}" data-mention-name="${safeName}" data-mention-id="${id}" contenteditable="false" draggable="false">${safeName}</span>`;
};

export const hasAssistantPlainText = (value: string) => /[\p{L}\p{N}]/u.test(value);

export const insertAssistantMentionTags = (
  rawText: string,
  references: AssistantMentionReference[],
) => {
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
      text.includes(`data-mention-name="${escapeAssistantStoryText(reference.name)}"`),
    );
    const hasSceneTag = /data-mention-kind=["']scene["']/i.test(text);
    const fallbackScene =
      references.find((reference) => reference.kind === 'scene' && reference.prependIfMissing) ||
      references.find((reference) => reference.kind === 'scene');
    if (!hasSceneTag && fallbackScene) {
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
    !hasSceneTag && fallbackScene
      ? (() => {
          const id = uuidv4();
          usedReferences.push(fallbackScene);
          mentionUsages.push({ id, reference: fallbackScene, placement: 'start' });
          return createAssistantMentionHtml(fallbackScene.kind, fallbackScene.name, id);
        })()
      : '';

  const unusedReferences = references.filter(
    (reference) =>
      reference.kind === 'character' &&
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

export const buildAssistantMentionReferencesFromNodes = (
  nodes: Node[],
  preferredSceneId?: string,
): AssistantMentionReference[] =>
  nodes
    .map((node): AssistantMentionReference | null => {
      if (node.type === 'characterNode') {
        const name =
          typeof node.data?.characterName === 'string' ? node.data.characterName.trim() : '';
        return name ? { id: node.id, kind: 'character', name } : null;
      }
      if (node.type === 'sceneNode') {
        const name = typeof node.data?.sceneName === 'string' ? node.data.sceneName.trim() : '';
        return {
          id: node.id,
          kind: 'scene',
          name: name || '未命名场景',
          prependIfMissing: node.id === preferredSceneId,
        };
      }
      return null;
    })
    .filter((reference): reference is AssistantMentionReference => Boolean(reference));

export const buildAssistantStoryPresentation = (
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

export const applyAssistantStoryTags = (text: string, references: AssistantMentionReference[]) => {
  const taggedStoryText = insertAssistantMentionTags(text, references);
  return {
    text: taggedStoryText.html,
    presentation: buildAssistantStoryPresentation(taggedStoryText),
  };
};

export const resolveAssistantStorySceneMedia = (
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

export const readStoryMentionNames = (html: string, kind: 'character' | 'scene') => {
  const container = document.createElement('div');
  container.innerHTML = html;
  return new Set(
    Array.from(container.querySelectorAll<HTMLElement>(`[data-mention-kind="${kind}"]`))
      .map((element) => element.dataset.mentionName?.trim())
      .filter((name): name is string => Boolean(name)),
  );
};

export const syncPresentationWithStoryMentions = (
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
