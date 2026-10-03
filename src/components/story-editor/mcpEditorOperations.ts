import type { Edge, Node } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

import { createCharacterPresentation, createScenePresentation } from '../../lib/presentation';
import { layoutMcpGeneratedCards } from './mcpGeneratedCardLayout';
import { getSettingRename, replaceMentionNameInText } from './nodeRename';
import { getStoryConnectionHandles } from './storyConnectionHandles';

type McpOperation = Record<string, unknown>;

const textFields: Record<string, string[]> = {
  storyNode: ['title', 'text', 'skip'],
  characterNode: [
    'characterName', 'identity', 'appearance', 'traits', 'personality', 'habits', 'speechStyle',
    'experience', 'relationships', 'notes', 'features', 'background', 'other',
  ],
  sceneNode: ['sceneName', 'description', 'location', 'items', 'atmosphere', 'time', 'weather', 'visual', 'sound', 'notes', 'other'],
  plotStructureNode: ['direction'],
};

const resolveMentionNode = (kind: 'character' | 'scene', name: string, nodes: Node[]) => {
  const matches = nodes.filter((node) => node.type === `${kind}Node` && getNodeName(node).trim() === name);
  if (matches.length > 1) throw new Error(`The ${kind} name '${name}' is ambiguous; rename one of the matching setting cards before tagging it.`);
  return matches[0];
};
const isDynamicGroupMember = (node: Node) => node.type !== 'backgroundNode' && node.type !== 'groupNode';
const booleanFields: Record<string, string[]> = {
  storyNode: ['hideTitleInPlayback', 'showTextOverlay'],
  characterNode: ['isGlobal', 'showPersonality', 'showFeatures', 'showBackground', 'showOther'],
  sceneNode: ['isGlobal', 'showLocation', 'showItems', 'showAtmosphere', 'showOther', 'scenePresetEnabled'],
  plotStructureNode: ['isMinimized'],
};

const getSceneMedia = (node: Node) => {
  const data = node.data as Record<string, unknown>;
  const images = Array.isArray(data.images) ? (data.images as Array<Record<string, unknown>>) : [];
  const imageUrl = (typeof data.coverImageUrl === 'string' ? data.coverImageUrl : undefined)
    || images.find((image) => typeof image.imageUrl === 'string')?.imageUrl as string | undefined;
  const videoUrl = imageUrl ? undefined : images.find((image) => typeof image.videoUrl === 'string')?.videoUrl as string | undefined;
  return { imageUrl, videoUrl };
};

const syncMcpStoryMentions = (story: Node, nodes: Node[]) => {
  const data = story.data as Record<string, unknown>;
  const html = typeof data.text === 'string' ? data.text : '';
  const documentBody = new DOMParser().parseFromString(html, 'text/html').body;
  const mentions = Array.from(documentBody.querySelectorAll<HTMLElement>('[data-mention-kind][data-mention-name]'))
    .map((element) => ({ kind: element.dataset.mentionKind, name: element.dataset.mentionName?.trim() || '' }))
    .filter((mention) => mention.name && (mention.kind === 'character' || mention.kind === 'scene'));
  const presentation = data.presentation && typeof data.presentation === 'object' && !Array.isArray(data.presentation)
    ? data.presentation as Record<string, unknown>
    : {};
  const existingCharacters = Array.isArray(presentation.characters)
    ? presentation.characters as Array<Record<string, unknown>>
    : [];
  const mentionedCharacters = mentions.filter((mention) => mention.kind === 'character')
    .map((mention) => resolveMentionNode('character', mention.name, nodes))
    .filter((node): node is Node => Boolean(node));
  const nextCharacters = mentionedCharacters.reduce<Array<Record<string, unknown>>>((result, node) => {
    if (result.some((item) => item.sourceNodeId === node.id)) return result;
    result.push(existingCharacters.find((item) => item.sourceNodeId === node.id) || createCharacterPresentation(node.id) as unknown as Record<string, unknown>);
    return result;
  }, []);

  const sceneMention = mentions.find((mention) => mention.kind === 'scene');
  const mentionedScene = sceneMention
    ? resolveMentionNode('scene', sceneMention.name, nodes)
    : undefined;
  const existingScene = presentation.scene && typeof presentation.scene === 'object'
    ? presentation.scene as Record<string, unknown>
    : undefined;
  let nextScene = existingScene;
  const mediaUpdates: Record<string, unknown> = {};
  if (mentionedScene && existingScene?.sourceNodeId !== mentionedScene.id) {
    const media = getSceneMedia(mentionedScene);
    nextScene = {
      ...createScenePresentation(
        mentionedScene.id,
        typeof existingScene?.previousImageUrl === 'string'
          ? existingScene.previousImageUrl
          : typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
        false,
        typeof existingScene?.previousShowTextOverlay === 'boolean'
          ? existingScene.previousShowTextOverlay
          : typeof data.showTextOverlay === 'boolean' ? data.showTextOverlay : undefined,
      ),
      previousVideoUrl: typeof existingScene?.previousVideoUrl === 'string'
        ? existingScene.previousVideoUrl
        : typeof data.videoUrl === 'string' ? data.videoUrl : undefined,
    } as unknown as Record<string, unknown>;
    mediaUpdates.imageUrl = media.imageUrl;
    mediaUpdates.videoUrl = media.videoUrl;
    mediaUpdates.showTextOverlay = true;
  } else if (!mentionedScene && existingScene) {
    nextScene = undefined;
    mediaUpdates.imageUrl = existingScene.previousImageUrl;
    mediaUpdates.videoUrl = existingScene.previousVideoUrl;
    mediaUpdates.showTextOverlay = existingScene.previousShowTextOverlay ?? data.showTextOverlay;
  }
  return {
    ...story,
    data: {
      ...data,
      ...mediaUpdates,
      presentation: { ...presentation, scene: nextScene, characters: nextCharacters },
    },
  };
};

const ensurePresentationMentionTags = (story: Node, presentation: Record<string, unknown>, nodes: Node[]) => {
  const data = story.data as Record<string, unknown>;
  const currentText = typeof data.text === 'string' ? data.text : '';
  const body = new DOMParser().parseFromString(currentText, 'text/html').body;
  const present = new Set(Array.from(body.querySelectorAll<HTMLElement>('[data-mention-kind][data-mention-name]'))
    .map((element) => `${element.dataset.mentionKind}:${element.dataset.mentionName?.trim() || ''}`));
  const requested: Array<{ kind: 'character' | 'scene'; nodeId: string }> = [];
  const scene = presentation.scene;
  if (scene && typeof scene === 'object' && !Array.isArray(scene) && typeof (scene as Record<string, unknown>).sourceNodeId === 'string') {
    requested.push({ kind: 'scene', nodeId: (scene as Record<string, unknown>).sourceNodeId as string });
  }
  if (Array.isArray(presentation.characters)) {
    for (const item of presentation.characters) {
      if (item && typeof item === 'object' && !Array.isArray(item) && typeof (item as Record<string, unknown>).sourceNodeId === 'string') {
        requested.push({ kind: 'character', nodeId: (item as Record<string, unknown>).sourceNodeId as string });
      }
    }
  }
  const additions = requested.flatMap(({ kind, nodeId }) => {
    const target = nodes.find((node) => node.id === nodeId && node.type === `${kind}Node`);
    if (!target) throw new Error(`Cannot add a ${kind} tag: source node '${nodeId}' does not exist.`);
    const name = getNodeName(target).trim();
    const hasDuplicateNameReference = requested.some((item) => {
      if (item.kind !== kind || item.nodeId === nodeId) return false;
      const source = nodes.find((node) => node.id === item.nodeId);
      return source && getNodeName(source).trim() === name;
    });
    if (hasDuplicateNameReference) throw new Error(`Cannot tag both '${name}' setting cards because mentions resolve by name; rename one card first.`);
    if (!name || present.has(`${kind}:${name}`)) return [];
    present.add(`${kind}:${name}`);
    const safeName = escapeHtml(name);
    return [`<span class="mention-chip mention-chip-${kind}" data-mention-kind="${kind}" data-mention-name="${safeName}" data-mention-id="${uuidv4()}" contenteditable="false" draggable="false">${safeName}</span>`];
  });
  return additions.length ? `${additions.join('')}${body.innerHTML}` : currentText;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const getNodeName = (node: Node) => {
  const data = node.data as Record<string, unknown>;
  if (node.type === 'characterNode') return String(data.characterName || '');
  if (node.type === 'sceneNode') return String(data.sceneName || '');
  return String(data.title || '');
};

export const getMcpAssetCatalog = (nodes: Node[]) => {
  const assets: Array<{ id: string; nodeId: string; field: string; kind: string; name: string }> = [];
  const add = (node: Node, field: string, kind: string, value: unknown, name: string) => {
    if (typeof value !== 'string' || !value) return;
    assets.push({ id: `asset:${node.id}:${field}`, nodeId: node.id, field, kind, name: name || getNodeName(node) || field });
  };

  for (const node of nodes) {
    const data = node.data as Record<string, unknown>;
    const mappings: Array<[string, string]> = node.type === 'storyNode'
      ? [['imageUrl', 'image'], ['videoUrl', 'video'], ['audioUrl', 'audio']]
      : node.type === 'characterNode'
        ? [['avatarUrl', 'image'], ['threeViewUrl', 'image'], ['tagSpriteUrl', 'image']]
        : node.type === 'sceneNode'
          ? [['coverImageUrl', 'image']]
          : [];
    for (const [field, kind] of mappings) add(node, field, kind, data[field], field);
    if (node.type === 'sceneNode' && Array.isArray(data.images)) {
      for (const item of data.images) {
        if (!item || typeof item !== 'object') continue;
        const image = item as Record<string, unknown>;
        if (typeof image.id === 'string') {
          const name = String(image.name || image.id);
          add(node, `images:${image.id}`, 'image', image.imageUrl, name);
          add(node, `images:${image.id}:video`, 'video', image.videoUrl, name);
        }
      }
    }
  }
  return assets;
};

const sanitizeRichText = (html: string, nodes: Node[]) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI']);
  const clean = (parent: ParentNode): string => Array.from(parent.childNodes).map((child) => {
    if (child.nodeType === 3) return escapeHtml(child.textContent || '');
    if (!(child instanceof HTMLElement)) return '';
    if (child.tagName === 'SPAN' && child.dataset.mentionKind) {
      const kind = child.dataset.mentionKind;
      const name = child.dataset.mentionName || child.textContent?.trim() || '';
      if (kind !== 'character' && kind !== 'scene') return escapeHtml(name);
      const target = nodes.find((node) => node.type === `${kind}Node` && getNodeName(node) === name);
      if (!target) throw new Error(`Rich text mentions an unknown ${kind} '${name}'.`);
      resolveMentionNode(kind, name.trim(), nodes);
      const safeName = escapeHtml(name);
      return `<span class="mention-chip mention-chip-${kind}" data-mention-kind="${kind}" data-mention-name="${safeName}" data-mention-id="${uuidv4()}" contenteditable="false" draggable="false">${safeName}</span>`;
    }
    const contents = clean(child);
    if (!allowedTags.has(child.tagName)) return contents;
    if (child.tagName === 'BR') return '<br />';
    return `<${child.tagName.toLowerCase()}>${contents}</${child.tagName.toLowerCase()}>`;
  }).join('');
  return clean(doc.body);
};

const positionOf = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('position must contain finite x and y coordinates.');
  const { x, y } = value as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1_000_000 || Math.abs(y) > 1_000_000) {
    throw new Error('position.x and position.y must be finite numbers within ±1000000.');
  }
  return { x, y };
};

const validatePresentation = (value: unknown, nodes: Node[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('presentation must be an object.');
  const presentation = value as Record<string, unknown>;
  if (Object.keys(presentation).some((key) => !['scene', 'characters', 'inlineActions'].includes(key))) throw new Error('presentation contains unsupported fields.');
  const ensureSource = (sourceNodeId: unknown, expectedType: string) => {
    if (typeof sourceNodeId !== 'string' || !nodes.some((node) => node.id === sourceNodeId && node.type === expectedType)) {
      throw new Error(`Presentation source must reference an existing ${expectedType} card.`);
    }
  };
  const ensureKeys = (object: Record<string, unknown>, allowed: string[], label: string) => {
    const unsupported = Object.keys(object).find((key) => !allowed.includes(key));
    if (unsupported) throw new Error(`${label} contains unsupported field '${unsupported}'.`);
  };
  const finiteRange = (object: Record<string, unknown>, key: string, min: number, max: number) => {
    if (object[key] !== undefined && (typeof object[key] !== 'number' || !Number.isFinite(object[key]) || (object[key] as number) < min || (object[key] as number) > max)) {
      throw new Error(`presentation.${key} must be between ${min} and ${max}.`);
    }
  };
  const motion = (value: unknown) => {
    if (value === undefined) return;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Presentation motion must be an object.');
    const item = value as Record<string, unknown>;
    ensureKeys(item, ['type', 'duration'], 'Presentation motion');
    if (!['none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom'].includes(String(item.type))) throw new Error('Presentation motion type is invalid.');
    finiteRange(item, 'duration', 0, 60_000);
  };

  if (presentation.scene !== undefined && presentation.scene !== null) {
    const scene = presentation.scene as Record<string, unknown>;
    if (!scene || typeof scene !== 'object' || Array.isArray(scene)) throw new Error('presentation.scene must be an object or null.');
    ensureKeys(scene, ['sourceNodeId', 'linkedByEdge', 'imageId', 'cropMode', 'scale', 'offsetX', 'offsetY', 'layer', 'videoStartTime', 'videoEndTime', 'videoLoop', 'videoMaxDuration', 'enter', 'exit'], 'presentation.scene');
    ensureSource(scene.sourceNodeId, 'sceneNode');
    if (scene.linkedByEdge !== undefined && typeof scene.linkedByEdge !== 'boolean') throw new Error('presentation.scene.linkedByEdge must be a boolean.');
    if (scene.videoLoop !== undefined && typeof scene.videoLoop !== 'boolean') throw new Error('presentation.scene.videoLoop must be a boolean.');
    if (scene.imageId !== undefined) {
      const source = nodes.find((node) => node.id === scene.sourceNodeId)!;
      const images = (source.data as Record<string, unknown>).images;
      if (!Array.isArray(images) || !images.some((item) => item && typeof item === 'object' && (item as Record<string, unknown>).id === scene.imageId)) throw new Error('presentation.scene.imageId must reference an image on its scene card.');
    }
    if (scene.cropMode !== undefined && !['cover', 'contain', 'stretch'].includes(String(scene.cropMode))) throw new Error('presentation.scene.cropMode is invalid.');
    finiteRange(scene, 'scale', 0.1, 4);
    finiteRange(scene, 'offsetX', -1000, 1000);
    finiteRange(scene, 'offsetY', -1000, 1000);
    finiteRange(scene, 'layer', 1, 20);
    finiteRange(scene, 'videoStartTime', 0, 86_400);
    finiteRange(scene, 'videoEndTime', 0, 86_400);
    finiteRange(scene, 'videoMaxDuration', 0, 86_400);
    motion(scene.enter);
    motion(scene.exit);
  }
  if (presentation.characters !== undefined) {
    if (!Array.isArray(presentation.characters) || presentation.characters.length > 30) throw new Error('presentation.characters must be an array with at most 30 items.');
    for (const item of presentation.characters) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Each character presentation must be an object.');
      const character = item as Record<string, unknown>;
      ensureKeys(character, ['sourceNodeId', 'linkedByEdge', 'outfitId', 'position', 'offsetX', 'offsetY', 'scale', 'flipX', 'layer', 'enter', 'exit'], 'presentation.characters item');
      ensureSource(character.sourceNodeId, 'characterNode');
      if (character.linkedByEdge !== undefined && typeof character.linkedByEdge !== 'boolean') throw new Error('Character linkedByEdge must be a boolean.');
      if (character.flipX !== undefined && typeof character.flipX !== 'boolean') throw new Error('Character flipX must be a boolean.');
      if (character.outfitId !== undefined) {
        const source = nodes.find((node) => node.id === character.sourceNodeId)!;
        const outfits = (source.data as Record<string, unknown>).outfits;
        if (typeof character.outfitId !== 'string' || !Array.isArray(outfits) || !outfits.some((outfit) => outfit && typeof outfit === 'object' && (outfit as Record<string, unknown>).id === character.outfitId)) throw new Error('Character outfitId must reference an outfit on that character card.');
      }
      if (character.position !== undefined && !['left', 'center', 'right', 'custom'].includes(String(character.position))) throw new Error('Character presentation position is invalid.');
      finiteRange(character, 'offsetX', -1000, 1000);
      finiteRange(character, 'offsetY', -1000, 1000);
      finiteRange(character, 'scale', 0.1, 4);
      finiteRange(character, 'layer', 1, 20);
      motion(character.enter);
      motion(character.exit);
    }
  }
  if (presentation.inlineActions !== undefined && (!Array.isArray(presentation.inlineActions) || presentation.inlineActions.length > 100)) {
    throw new Error('presentation.inlineActions must be an array with at most 100 items.');
  }
  const actions = ((presentation.inlineActions || []) as unknown[]).map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Each presentation.inlineActions item must be an object.');
    const action = value as Record<string, unknown>;
    ensureKeys(action, ['id', 'kind', 'sourceNodeId', 'name', 'action', 'duration', 'strength', 'repeats', 'targetAssetId', 'offsetX', 'offsetY', 'scale', 'timelinePhase'], 'presentation.inlineActions item');
    if (typeof action.id !== 'string' || !action.id.trim() || action.id.length > 128) throw new Error('Inline action id must be a non-empty string of at most 128 characters.');
    if (action.kind !== 'character' && action.kind !== 'scene') throw new Error('Inline action kind must be character or scene.');
    ensureSource(action.sourceNodeId, `${action.kind}Node`);
    if (!['none', 'shake-x', 'shake-y', 'translate', 'translate-x', 'translate-y', 'scale', 'pulse', 'rotate', 'opacity', 'brightness', 'switch'].includes(String(action.action))) throw new Error('Inline action type is invalid.');
    for (const key of ['duration', 'strength', 'offsetX', 'offsetY', 'scale']) {
      if (typeof action[key] !== 'number' || !Number.isFinite(action[key])) throw new Error(`Inline action ${key} must be a finite number.`);
    }
    finiteRange(action, 'duration', 0, 60_000);
    finiteRange(action, 'strength', -10_000, 10_000);
    finiteRange(action, 'offsetX', -1000, 1000);
    finiteRange(action, 'offsetY', -1000, 1000);
    finiteRange(action, 'scale', 0.1, 10);
    if (action.repeats !== undefined) finiteRange(action, 'repeats', 0, 100);
    if (action.name !== undefined && (typeof action.name !== 'string' || action.name.length > 200)) throw new Error('Inline action name must be a string of at most 200 characters.');
    if (action.timelinePhase !== undefined && !['enter', 'inline', 'exit'].includes(String(action.timelinePhase))) throw new Error('Inline action timelinePhase is invalid.');
    if (action.targetAssetId !== undefined) {
      const source = nodes.find((node) => node.id === action.sourceNodeId)!;
      const data = source.data as Record<string, unknown>;
      const assets = action.kind === 'scene' ? data.images : data.outfits;
      if (typeof action.targetAssetId !== 'string' || !Array.isArray(assets) || !assets.some((asset) => asset && typeof asset === 'object' && (asset as Record<string, unknown>).id === action.targetAssetId)) throw new Error('Inline action targetAssetId must reference a media item on its source card.');
    }
    return action;
  });
  return { ...presentation, ...(presentation.inlineActions === undefined ? {} : { inlineActions: actions }) };
};

export const applyMcpOperations = (
  nodes: Node[],
  edges: Edge[],
  operations: McpOperation[],
  defaultEdge: Partial<Edge> = { type: 'customEdge' },
  layoutOptions: { direction?: unknown; language?: string } = {},
) => {
  if (!Array.isArray(operations) || operations.length < 1 || operations.length > 100) throw new Error('operations must contain between 1 and 100 supported edits.');
  let nextNodes = [...nodes];
  let nextEdges = [...edges];
  const created: string[] = [];
  const deleted: string[] = [];
  const changes: Array<{ type: string; nodeId?: string; sourceId?: string; targetId?: string; storyId?: string; settingId?: string; settingType?: string; assetType?: string; field?: string; mimeType?: string; mediaType?: string; memberCount?: number; bytes?: number }> = [];
  const storyTextChangedIds = new Set<string>();
  let changedCount = 0;

  for (const operation of operations) {
    if (!operation || typeof operation !== 'object' || typeof operation.type !== 'string') throw new Error('Each operation must have a supported type.');
    const nodeId = operation.node_id;
    if (operation.type === 'create_background_region') {
      if (!Array.isArray(operation.node_ids) || operation.node_ids.length < 1 || operation.node_ids.length > 100) throw new Error('node_ids must contain between 1 and 100 card IDs.');
      const childIds = Array.from(new Set(operation.node_ids.filter((id): id is string => typeof id === 'string')));
      if (childIds.length !== operation.node_ids.length) throw new Error('node_ids must contain unique string IDs.');
      const children = childIds.map((id) => nextNodes.find((node) => node.id === id));
      if (children.some((node) => !node || ['backgroundNode', 'groupNode', 'batchReplaceNode', 'plotStructureNode', 'aiNode'].includes(node.type || ''))) {
        throw new Error('Every background-region member must be an existing canvas content card, not another region or utility card.');
      }
      const padding = operation.padding ?? 60;
      if (typeof padding !== 'number' || !Number.isFinite(padding) || padding < 0 || padding > 500) throw new Error('padding must be between 0 and 500.');
      const bounds = children.reduce((result, node) => {
        const item = node!;
        const widthValue = item.measured?.width ?? item.width ?? item.style?.width ?? (item.type === 'characterNode' || item.type === 'sceneNode' ? 440 : 300);
        const heightValue = item.measured?.height ?? item.height ?? item.style?.height ?? (item.type === 'storyNode' ? 200 : 240);
        const width = typeof widthValue === 'number' ? widthValue : Number.parseFloat(String(widthValue)) || 300;
        const height = typeof heightValue === 'number' ? heightValue : Number.parseFloat(String(heightValue)) || 200;
        return {
          left: Math.min(result.left, item.position.x),
          top: Math.min(result.top, item.position.y),
          right: Math.max(result.right, item.position.x + width),
          bottom: Math.max(result.bottom, item.position.y + height),
        };
      }, { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: 0, bottom: 0 });
      const id = typeof operation.node_id === 'string' && operation.node_id.trim() ? operation.node_id.trim() : uuidv4();
      if (id.length > 128 || nextNodes.some((node) => node.id === id)) throw new Error(`Node ID '${id}' is empty, too long, or already in use.`);
      const title = typeof operation.title === 'string' && operation.title.trim()
        ? operation.title.trim()
        : layoutOptions.language === 'zh' ? '新建分组' : layoutOptions.language === 'ja' ? '新しい領域' : 'New Region';
      if (title.length > 200) throw new Error('title must be at most 200 characters.');
      const color = operation.color ?? '#f1f5f9';
      if (typeof color !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color)) throw new Error('color must be a 3- or 6-digit hex color.');
      const node: Node = {
        id,
        type: 'backgroundNode',
        position: { x: bounds.left - padding, y: bounds.top - padding },
        dragHandle: '.custom-drag-handle',
        style: { width: Math.max(200, bounds.right - bounds.left + padding * 2), height: Math.max(150, bounds.bottom - bounds.top + padding * 2), zIndex: -3 },
        data: { id, title, color },
      };
      nextNodes.push(node);
      created.push(id);
      changes.push({ type: operation.type, nodeId: id });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'update_background_region') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const current = nextNodes.find((node) => node.id === nodeId && node.type === 'backgroundNode');
      if (!current) throw new Error(`Background region '${nodeId}' was not found.`);
      if (!operation.fields || typeof operation.fields !== 'object' || Array.isArray(operation.fields)) throw new Error('fields must be an object.');
      const fields = operation.fields as Record<string, unknown>;
      if (!Object.keys(fields).length || Object.keys(fields).some((key) => !['title', 'color', 'width', 'height'].includes(key))) throw new Error('Background-region fields must include title, color, width, or height only.');
      const data = { ...current.data } as Record<string, unknown>;
      const style = { ...(current.style || {}) } as NonNullable<Node['style']>;
      for (const [key, value] of Object.entries(fields)) {
        if (key === 'title') {
          if (typeof value !== 'string' || value.length > 200) throw new Error('title must be a string of at most 200 characters.');
          data.title = value;
        } else if (key === 'color') {
          if (typeof value !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) throw new Error('color must be a 3- or 6-digit hex color.');
          data.color = value;
        } else {
          if (typeof value !== 'number' || !Number.isFinite(value) || value < (key === 'width' ? 200 : 150) || value > 10_000) throw new Error(`${key} must be between ${key === 'width' ? 200 : 150} and 10000.`);
          style[key as 'width' | 'height'] = value;
        }
      }
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, data, style } : node);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'delete_background_region') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      if (!nextNodes.some((node) => node.id === nodeId && node.type === 'backgroundNode')) throw new Error(`Background region '${nodeId}' was not found.`);
      nextNodes = nextNodes.filter((node) => node.id !== nodeId);
      nextEdges = nextEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
      deleted.push(nodeId);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'create_dynamic_group') {
      if (!Array.isArray(operation.node_ids) || operation.node_ids.length < 1 || operation.node_ids.length > 100) throw new Error('node_ids must contain between 1 and 100 card IDs.');
      const childIds = operation.node_ids.filter((id): id is string => typeof id === 'string');
      if (childIds.length !== operation.node_ids.length || new Set(childIds).size !== childIds.length) throw new Error('node_ids must contain unique string IDs.');
      const children = childIds.map((id) => nextNodes.find((node) => node.id === id));
      if (children.some((node) => !node || !isDynamicGroupMember(node))) throw new Error('Every group member must be an existing canvas card; background regions and other groups cannot be nested.');
      const id = typeof operation.node_id === 'string' && operation.node_id.trim() ? operation.node_id.trim() : uuidv4();
      if (id.length > 128 || nextNodes.some((node) => node.id === id)) throw new Error(`Node ID '${id}' is empty, too long, or already in use.`);
      const title = typeof operation.title === 'string' && operation.title.trim() ? operation.title.trim() : '动态包裹';
      if (title.length > 200) throw new Error('title must be a string of at most 200 characters.');
      const color = operation.color ?? '#6366f1';
      if (typeof color !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color)) throw new Error('color must be a 3- or 6-digit hex color.');
      if (operation.gap !== undefined && (typeof operation.gap !== 'number' || !Number.isFinite(operation.gap) || operation.gap < 0 || operation.gap > 500)) throw new Error('gap must be between 0 and 500.');
      const groupNode: Node = {
        id,
        type: 'groupNode',
        position: { x: 0, y: 0 },
        selectable: true,
        draggable: true,
        style: { width: 100, height: 100, zIndex: -2 },
        data: { id, title, color, childIds, ...(operation.gap === undefined ? {} : { gap: operation.gap }) },
      };
      nextNodes.push(groupNode);
      created.push(id);
      changes.push({ type: operation.type, nodeId: id, memberCount: childIds.length });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'update_dynamic_group') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const group = nextNodes.find((node) => node.id === nodeId && node.type === 'groupNode');
      if (!group) throw new Error(`Dynamic group '${nodeId}' was not found.`);
      if (!operation.fields || typeof operation.fields !== 'object' || Array.isArray(operation.fields)) throw new Error('fields must be an object.');
      const fields = operation.fields as Record<string, unknown>;
      if (!Object.keys(fields).length || Object.keys(fields).some((key) => !['title', 'color', 'gap'].includes(key))) throw new Error('Dynamic-group fields may include title, color, or gap only. Change membership with the group-member tools.');
      const data = { ...group.data } as Record<string, unknown>;
      for (const [key, value] of Object.entries(fields)) {
        if (key === 'title') {
          if (typeof value !== 'string' || value.length > 200) throw new Error('title must be a string of at most 200 characters.');
          data.title = value;
        } else if (key === 'color') {
          if (typeof value !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) throw new Error('color must be a 3- or 6-digit hex color.');
          data.color = value;
        } else {
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 500) throw new Error('gap must be between 0 and 500.');
          data.gap = value;
        }
      }
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, data } : node);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'add_dynamic_group_members' || operation.type === 'remove_dynamic_group_members') {
      if (typeof nodeId !== 'string') throw new Error('node_id must identify a dynamic group.');
      const group = nextNodes.find((node) => node.id === nodeId && node.type === 'groupNode');
      if (!group) throw new Error(`Dynamic group '${nodeId}' was not found.`);
      if (!Array.isArray(operation.node_ids) || operation.node_ids.length < 1 || operation.node_ids.length > 100) throw new Error('node_ids must contain between 1 and 100 card IDs.');
      const requestedIds = operation.node_ids.filter((id): id is string => typeof id === 'string');
      if (requestedIds.length !== operation.node_ids.length || new Set(requestedIds).size !== requestedIds.length) throw new Error('node_ids must contain unique string IDs.');
      const requestedNodes = requestedIds.map((id) => nextNodes.find((node) => node.id === id));
      if (requestedNodes.some((node) => !node || !isDynamicGroupMember(node))) throw new Error('Every member must be an existing card; background regions and other groups cannot be nested.');
      const currentIds = Array.isArray(group.data.childIds) ? group.data.childIds.filter((id): id is string => typeof id === 'string') : [];
      const nextIds = operation.type === 'add_dynamic_group_members'
        ? Array.from(new Set([...currentIds, ...requestedIds]))
        : currentIds.filter((id) => !requestedIds.includes(id));
      if (operation.type === 'remove_dynamic_group_members' && nextIds.length === 0) throw new Error('A dynamic group must retain at least one member. Remove the group wrapper with delete_dynamic_group instead.');
      if (nextIds.length > 100) throw new Error('A dynamic group can contain at most 100 cards.');
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, childIds: nextIds } } : node);
      changes.push({ type: operation.type, nodeId, memberCount: requestedIds.length });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'delete_dynamic_group') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      if (!nextNodes.some((node) => node.id === nodeId && node.type === 'groupNode')) throw new Error(`Dynamic group '${nodeId}' was not found.`);
      nextNodes = nextNodes.filter((node) => node.id !== nodeId);
      nextEdges = nextEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
      deleted.push(nodeId);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'convert_background_to_dynamic_group') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const background = nextNodes.find((node) => node.id === nodeId && node.type === 'backgroundNode');
      if (!background) throw new Error(`Background region '${nodeId}' was not found.`);
      const width = typeof background.style?.width === 'number' ? background.style.width : 600;
      const height = typeof background.style?.height === 'number' ? background.style.height : 400;
      const children = nextNodes.filter((node) => {
        if (!isDynamicGroupMember(node)) return false;
        const nodeWidth = node.measured?.width || (typeof node.style?.width === 'number' ? node.style.width : 300);
        const nodeHeight = node.measured?.height || (typeof node.style?.height === 'number' ? node.style.height : 200);
        const centerX = node.position.x + nodeWidth / 2;
        const centerY = node.position.y + nodeHeight / 2;
        return centerX >= background.position.x && centerX <= background.position.x + width && centerY >= background.position.y && centerY <= background.position.y + height;
      });
      if (!children.length) throw new Error('No cards are inside this background region.');
      nextNodes = nextNodes.map((node) => node.id === nodeId ? {
        ...node, type: 'groupNode', position: { x: 0, y: 0 }, draggable: true, dragHandle: undefined,
        style: { ...node.style, width: 100, height: 100, zIndex: -2 },
        data: { ...node.data, childIds: children.map((child) => child.id) },
      } : node);
      changes.push({ type: operation.type, nodeId, memberCount: children.length });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'convert_dynamic_group_to_background') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const group = nextNodes.find((node) => node.id === nodeId && node.type === 'groupNode');
      if (!group) throw new Error(`Dynamic group '${nodeId}' was not found.`);
      const childIds = Array.isArray(group.data.childIds) ? group.data.childIds.filter((id): id is string => typeof id === 'string') : [];
      const children = nextNodes.filter((node) => childIds.includes(node.id) && isDynamicGroupMember(node));
      if (!children.length) throw new Error(`Dynamic group '${nodeId}' has no valid member cards.`);
      const bounds = children.reduce((result, child) => {
        const width = child.measured?.width || (typeof child.style?.width === 'number' ? child.style.width : 300);
        const height = child.measured?.height || (typeof child.style?.height === 'number' ? child.style.height : 200);
        return { left: Math.min(result.left, child.position.x), top: Math.min(result.top, child.position.y), right: Math.max(result.right, child.position.x + width), bottom: Math.max(result.bottom, child.position.y + height) };
      }, { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: 0, bottom: 0 });
      const padding = 60;
      const { childIds: _childIds, hullPoints: _hullPoints, ...data } = group.data as Record<string, unknown>;
      nextNodes = nextNodes.map((node) => node.id === nodeId ? {
        ...node, type: 'backgroundNode', position: { x: bounds.left - padding, y: bounds.top - padding }, dragHandle: '.custom-drag-handle',
        style: { ...node.style, width: Math.max(200, bounds.right - bounds.left + padding * 2), height: Math.max(150, bounds.bottom - bounds.top + padding * 2), zIndex: -3 },
        data,
      } : node);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'create_story_node' || operation.type === 'create_character_node' || operation.type === 'create_scene_node' || operation.type === 'create_plot_structure_node') {
      const id = typeof operation.node_id === 'string' ? operation.node_id.trim() : uuidv4();
      if (!id || id.length > 128 || nextNodes.some((node) => node.id === id)) throw new Error(`Node ID '${id}' is empty, too long, or already in use.`);
      const position = positionOf(operation.position);
      let node: Node;
      if (operation.type === 'create_story_node') {
        const title = operation.title;
        const text = operation.text;
        if (typeof title !== 'string' || !title.trim() || title.length > 500) throw new Error('Story title must be a non-empty string of at most 500 characters.');
        if (typeof text !== 'string' || text.length > 100_000) throw new Error('Story text must be a string of at most 100000 characters.');
        node = { id, type: 'storyNode', position, style: { width: 300 }, data: { id, title: title.trim(), text: escapeHtml(text).replace(/\r?\n/g, '<br />'), shape: 'rounded-rectangle', color: '#ffffff', sizeMode: 'auto' } };
      } else if (operation.type === 'create_character_node') {
        const characterName = operation.character_name;
        if (typeof characterName !== 'string' || !characterName.trim() || characterName.length > 200) throw new Error('character_name must be a non-empty string of at most 200 characters.');
        node = { id, type: 'characterNode', position, style: { width: 440 }, data: { id, characterName: characterName.trim(), traits: '' } };
      } else if (operation.type === 'create_scene_node') {
        const sceneName = operation.scene_name;
        if (typeof sceneName !== 'string' || !sceneName.trim() || sceneName.length > 200) throw new Error('scene_name must be a non-empty string of at most 200 characters.');
        node = { id, type: 'sceneNode', position, style: { width: 440 }, data: { id, sceneName: sceneName.trim(), description: '', scenePresetEnabled: false } };
      } else {
        const direction = operation.direction;
        const creationMode = operation.creation_mode ?? 'continue';
        const detailLevel = operation.detail_level ?? 'standard';
        const cardCount = operation.card_count ?? 3;
        if (typeof direction !== 'string' || direction.length > 20_000) throw new Error('direction must be a string of at most 20000 characters.');
        if (creationMode !== 'continue' && creationMode !== 'play') throw new Error('creation_mode must be continue or play.');
        if (!['brief', 'standard', 'detailed'].includes(String(detailLevel))) throw new Error('detail_level must be brief, standard, or detailed.');
        if (typeof cardCount !== 'number' || !Number.isInteger(cardCount) || cardCount < 1 || cardCount > 20) throw new Error('card_count must be an integer between 1 and 20.');
        node = { id, type: 'plotStructureNode', position, data: { id, creationMode, cardCount, detailLevel, direction } };
      }
      nextNodes.push(node);
      created.push(id);
      changes.push({ type: operation.type, nodeId: id });
      changedCount += 1;
      continue;
    }

    if (['update_node', 'update_story_node', 'update_character_node', 'update_scene_node', 'update_plot_structure_node'].includes(operation.type)) {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const current = nextNodes.find((node) => node.id === nodeId);
      if (!current) throw new Error(`Node '${nodeId}' was not found.`);
      const expectedType: Record<string, string> = {
        update_story_node: 'storyNode',
        update_character_node: 'characterNode',
        update_scene_node: 'sceneNode',
        update_plot_structure_node: 'plotStructureNode',
      };
      if (expectedType[operation.type] && current.type !== expectedType[operation.type]) {
        throw new Error(`Node '${nodeId}' is not a ${expectedType[operation.type]} card.`);
      }
      const fields = operation.fields;
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('fields must be an object.');
      const updates = fields as Record<string, unknown>;
      if (!Object.keys(updates).length) throw new Error('fields must include at least one supported field.');
      const allowedText = textFields[current.type || ''] || [];
      const allowedBoolean = booleanFields[current.type || ''] || [];
      const nextData = { ...current.data } as Record<string, unknown>;
      const rename = getSettingRename(current, updates);
      for (const [key, value] of Object.entries(updates)) {
        if (operation.type === 'update_story_node' && !['title', 'text', 'text_html'].includes(key)) throw new Error(`Field '${key}' is not writable with update_story_node.`);
        if (key === 'text_html' && current.type === 'storyNode') {
          if (typeof value !== 'string' || value.length > 100_000) throw new Error('text_html must be a string of at most 100000 characters.');
          nextData.text = sanitizeRichText(value, nextNodes);
        } else if (allowedText.includes(key)) {
          if (key === 'skip' && typeof value === 'boolean') nextData[key] = value;
          else if (typeof value === 'string' && value.length <= (key === 'text' ? 100_000 : 20_000)) {
            nextData[key] = key === 'text' ? escapeHtml(value).replace(/\r?\n/g, '<br />') : value;
          } else throw new Error(`Field '${key}' must be a valid string or boolean within its size limit.`);
        } else if (allowedBoolean.includes(key)) {
          if (typeof value !== 'boolean') throw new Error(`Field '${key}' must be a boolean.`);
          nextData[key] = value;
        } else if (current.type === 'storyNode' && key === 'shape') {
          if (!['square', 'rounded-rectangle', 'diamond', 'trapezoid', 'hexagon', 'circle'].includes(String(value))) throw new Error('shape is invalid.');
          nextData.shape = value;
        } else if (current.type === 'storyNode' && key === 'color') {
          if (typeof value !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) throw new Error('color must be a 3- or 6-digit hex color.');
          nextData.color = value;
        } else if (current.type === 'sceneNode' && key === 'sceneEnvironment') {
          if (value !== 'indoor' && value !== 'outdoor') throw new Error('sceneEnvironment must be indoor or outdoor.');
          nextData.sceneEnvironment = value;
        } else if (current.type === 'sceneNode' && key === 'visualStyle') {
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('visualStyle must be a validated visual-style object.');
          const style = value as Record<string, unknown>;
          if (!['natural-daylight', 'warm-lamp', 'cool-fluorescent', 'neon-side-light', 'golden-hour', 'overcast-rain', 'night-street'].includes(String(style.lighting))) throw new Error('visualStyle.lighting is invalid.');
          if (!['none', 'clear', 'warm-film', 'cool-cinematic', 'neon', 'muted-rain', 'night-blue'].includes(String(style.filter))) throw new Error('visualStyle.filter is invalid.');
          if (typeof style.backgroundBlur !== 'number' || style.backgroundBlur < 0 || style.backgroundBlur > 100 || typeof style.intensity !== 'number' || style.intensity < 0 || style.intensity > 100) throw new Error('visualStyle backgroundBlur and intensity must be between 0 and 100.');
          nextData.visualStyle = { lighting: style.lighting, filter: style.filter, backgroundBlur: style.backgroundBlur, intensity: style.intensity };
        } else if (current.type === 'plotStructureNode' && key === 'creationMode') {
          if (value !== 'continue' && value !== 'play') throw new Error('creationMode must be continue or play.');
          nextData.creationMode = value;
        } else if (current.type === 'plotStructureNode' && key === 'detailLevel') {
          if (!['brief', 'standard', 'detailed'].includes(String(value))) throw new Error('detailLevel must be brief, standard, or detailed.');
          nextData.detailLevel = value;
        } else if (current.type === 'plotStructureNode' && ['choiceInterval', 'prefetchCount', 'cardCount'].includes(key)) {
          const bounds: Record<string, [number, number]> = { choiceInterval: [1, 12], prefetchCount: [1, 3], cardCount: [1, 20] };
          const [min, max] = bounds[key];
          if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error(`${key} must be an integer between ${min} and ${max}.`);
          nextData[key] = value;
        } else {
          throw new Error(`Field '${key}' is not writable for node type '${current.type}'.`);
        }
      }
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, data: nextData } : node);
      if (rename) {
        nextNodes = nextNodes.map((node) => {
          if (node.type !== 'storyNode' || typeof node.data.text !== 'string') return node;
          const text = replaceMentionNameInText(node.data.text, rename.oldName, rename.newName);
          return text === node.data.text ? node : { ...node, data: { ...node.data, text } };
        });
      }
      if (current.type === 'storyNode' && ('text' in updates || 'text_html' in updates)) storyTextChangedIds.add(nodeId);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'set_presentation') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const current = nextNodes.find((node) => node.id === nodeId && node.type === 'storyNode');
      if (!current) throw new Error(`Story node '${String(nodeId)}' was not found.`);
      const presentation = validatePresentation(operation.presentation, nextNodes);
      nextNodes = nextNodes.map((node) => node.id === nodeId ? {
        ...node,
        data: { ...node.data, text: ensurePresentationMentionTags(node, presentation, nextNodes), presentation },
      } : node);
      storyTextChangedIds.add(nodeId);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'set_text_segments') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const current = nextNodes.find((node) => node.id === nodeId && node.type === 'storyNode');
      if (!current) throw new Error(`Story node '${String(nodeId)}' was not found.`);
      if (!Array.isArray(operation.segments) || operation.segments.length > 2000) throw new Error('segments must be an array of at most 2000 items.');
      let textLength = 0;
      const html = (operation.segments as Array<Record<string, unknown>>).map((segment) => {
        if (!segment || typeof segment !== 'object' || Array.isArray(segment)) throw new Error('Each text segment must be an object.');
        if (segment.type === 'text' && typeof segment.text === 'string') {
          if (Object.keys(segment).some((key) => !['type', 'text', 'format'].includes(key))) throw new Error('Text segment contains unsupported fields.');
          textLength += segment.text.length;
          if (textLength > 100_000) throw new Error('Combined story text must be at most 100000 characters.');
          const text = escapeHtml(segment.text).replace(/\r?\n/g, '<br />');
          if (segment.format === undefined || segment.format === 'plain') return text;
          if (segment.format === 'bold') return `<strong>${text}</strong>`;
          if (segment.format === 'italic') return `<em>${text}</em>`;
          if (segment.format === 'underline') return `<u>${text}</u>`;
          throw new Error('Text segment format must be plain, bold, italic, or underline.');
        }
        if (segment.type === 'mention' && typeof segment.node_id === 'string' && (segment.kind === 'character' || segment.kind === 'scene')) {
          if (Object.keys(segment).some((key) => !['type', 'node_id', 'kind'].includes(key))) throw new Error('Mention segment contains unsupported fields.');
          const target = nextNodes.find((node) => node.id === segment.node_id && node.type === `${segment.kind}Node`);
          if (!target) throw new Error(`Mention target '${segment.node_id}' is not an existing ${segment.kind} card.`);
          resolveMentionNode(segment.kind, getNodeName(target).trim(), nextNodes);
          const name = escapeHtml(getNodeName(target));
          return `<span class="mention-chip mention-chip-${segment.kind}" data-mention-kind="${segment.kind}" data-mention-name="${name}" data-mention-id="${uuidv4()}" contenteditable="false" draggable="false">${name}</span>`;
        }
        throw new Error('Each text segment must be text or a character/scene mention.');
      }).join('');
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, text: html } } : node);
      storyTextChangedIds.add(nodeId);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'set_media') {
      if (typeof nodeId !== 'string' || typeof operation.asset_id !== 'string' || typeof operation.field !== 'string') throw new Error('node_id, field, and asset_id must be strings.');
      const target = nextNodes.find((node) => node.id === nodeId);
      if (!target) throw new Error(`Node '${nodeId}' was not found.`);
      const targetKind: Record<string, string[]> = {
        storyNode: ['imageUrl', 'videoUrl', 'audioUrl'],
        characterNode: ['avatarUrl', 'threeViewUrl', 'tagSpriteUrl'],
        sceneNode: ['coverImageUrl'],
      };
      const kindForField: Record<string, string> = { imageUrl: 'image', coverImageUrl: 'image', avatarUrl: 'image', threeViewUrl: 'image', tagSpriteUrl: 'image', videoUrl: 'video', audioUrl: 'audio' };
      if (!(targetKind[target.type || ''] || []).includes(operation.field)) throw new Error(`Media field '${operation.field}' is not writable for this node type.`);
      const catalog = getMcpAssetCatalog(nextNodes);
      const asset = catalog.find((item) => item.id === operation.asset_id && item.kind === kindForField[operation.field as string]);
      if (!asset) throw new Error(`Compatible project media asset '${operation.asset_id}' was not found.`);
      const source = nextNodes.find((node) => node.id === asset.nodeId)!;
      const sourceData = source.data as Record<string, unknown>;
      const nestedVideo = asset.field.match(/^images:(.*):video$/);
      const sourceValue = nestedVideo
        ? (sourceData.images as Array<Record<string, unknown>>).find((item) => item.id === nestedVideo[1])?.videoUrl
        : asset.field.startsWith('images:')
          ? (sourceData.images as Array<Record<string, unknown>>).find((item) => item.id === asset.field.slice('images:'.length))?.imageUrl
          : sourceData[asset.field];
      if (typeof sourceValue !== 'string') throw new Error('The selected media asset is no longer available.');
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, [operation.field as string]: sourceValue } } : node);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'import_project_node_image') {
      if (typeof nodeId !== 'string' || typeof operation.asset_type !== 'string' || typeof operation.image_data !== 'string') {
        throw new Error('node_id, asset_type, and image_data are required.');
      }
      const target = nextNodes.find((node) => node.id === nodeId);
      if (!target || (target.type !== 'characterNode' && target.type !== 'sceneNode')) {
        throw new Error(`Node '${nodeId}' is not an existing character or scene card.`);
      }
      const assetType = operation.asset_type;
      const fieldByType: Record<string, string> = target.type === 'characterNode'
        ? { portrait: 'avatarUrl', 'three-view': 'threeViewUrl', 'tag-sprite': 'tagSpriteUrl' }
        : { background: 'coverImageUrl' };
      const field = fieldByType[assetType];
      if (!field) throw new Error(`asset_type '${assetType}' is not supported for this card.`);

      let imageData = operation.image_data.trim();
      let mimeType = typeof operation.mime_type === 'string' ? operation.mime_type.toLowerCase() : 'image/png';
      const dataUrlMatch = imageData.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i);
      if (dataUrlMatch) {
        mimeType = dataUrlMatch[1].toLowerCase();
        imageData = dataUrlMatch[2];
      }
      imageData = imageData.replace(/\s/g, '');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
        throw new Error('mime_type must be image/png, image/jpeg, or image/webp.');
      }
      if (!imageData || imageData.length > 11_184_812 || imageData.length % 4 !== 0 || !/^[a-z0-9+/]+={0,2}$/i.test(imageData)) {
        throw new Error('image_data must be valid base64 and no larger than 8 MB decoded.');
      }
      let decodedSize = 0;
      let decodedImage = '';
      try {
        decodedImage = atob(imageData);
        decodedSize = decodedImage.length;
      } catch {
        throw new Error('image_data is not valid base64.');
      }
      if (decodedSize === 0 || decodedSize > 8 * 1024 * 1024) {
        throw new Error('Generated image must be between 1 byte and 8 MB.');
      }
      const hasBytes = (...bytes: number[]) => bytes.every((byte, index) => decodedImage.charCodeAt(index) === byte);
      const hasImageSignature = mimeType === 'image/png'
        ? hasBytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
        : mimeType === 'image/jpeg'
          ? hasBytes(0xff, 0xd8, 0xff)
          : decodedImage.length >= 12 && decodedImage.slice(0, 4) === 'RIFF' && decodedImage.slice(8, 12) === 'WEBP';
      if (!hasImageSignature) throw new Error(`image_data contents do not match ${mimeType}.`);

      const dataUrl = `data:${mimeType};base64,${imageData}`;
      nextNodes = nextNodes.map((node) => {
        if (node.id !== nodeId) return node;
        const data = { ...node.data } as Record<string, unknown>;
        if (target.type === 'sceneNode') {
          const images = Array.isArray(data.images) ? [...data.images as Array<Record<string, unknown>>] : [];
          const oldCover = typeof data.coverImageUrl === 'string' ? data.coverImageUrl : '';
          if (oldCover && oldCover !== dataUrl && !images.some((image) => image.imageUrl === oldCover)) {
            images.unshift({
              id: uuidv4(),
              name: layoutOptions.language === 'zh' ? '上一张场景图片' : layoutOptions.language === 'ja' ? '前のシーン画像' : 'Previous Scene Image',
              imageUrl: oldCover,
            });
          }
          data.images = images;
        }
        data[field] = dataUrl;
        data.generatedSettingImageId = undefined;
        return { ...node, data };
      });
      changes.push({ type: operation.type, nodeId, assetType, field, mimeType, bytes: decodedSize });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'import_project_media') {
      if (typeof nodeId !== 'string' || typeof operation.field !== 'string' || typeof operation.mime_type !== 'string' || typeof operation.media_url !== 'string') {
        throw new Error('node_id, field, mime_type, and media_url are required.');
      }
      const target = nextNodes.find((node) => node.id === nodeId);
      if (!target) throw new Error(`Node '${nodeId}' was not found.`);
      const targetFields: Record<string, string[]> = {
        storyNode: ['imageUrl', 'videoUrl', 'audioUrl'],
        characterNode: ['avatarUrl', 'threeViewUrl', 'tagSpriteUrl'],
        sceneNode: ['coverImageUrl'],
      };
      const field = operation.field;
      if (!(targetFields[target.type || ''] || []).includes(field)) throw new Error(`Media field '${field}' is not supported for this card type.`);
      const kind = operation.mime_type.startsWith('image/') ? 'image'
        : operation.mime_type.startsWith('audio/') ? 'audio'
          : operation.mime_type.startsWith('video/') ? 'video' : null;
      const expectedKind: Record<string, string> = {
        imageUrl: 'image', videoUrl: 'video', audioUrl: 'audio', avatarUrl: 'image',
        threeViewUrl: 'image', tagSpriteUrl: 'image', coverImageUrl: 'image',
      };
      if (!kind || expectedKind[field] !== kind) throw new Error(`mime_type '${operation.mime_type}' is not compatible with field '${field}'.`);
      if (!operation.media_url.startsWith('blob:')) throw new Error('Imported media must use an editor-managed local blob URL.');
      nextNodes = nextNodes.map((node) => node.id === nodeId
        ? { ...node, data: { ...node.data, [field]: operation.media_url } }
        : node);
      changes.push({ type: operation.type, nodeId, field, mediaType: kind });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'clear_media') {
      if (typeof nodeId !== 'string' || typeof operation.field !== 'string') throw new Error('node_id and field must be strings.');
      const target = nextNodes.find((node) => node.id === nodeId);
      if (!target) throw new Error(`Node '${nodeId}' was not found.`);
      const targetKind: Record<string, string[]> = {
        storyNode: ['imageUrl', 'videoUrl', 'audioUrl'],
        characterNode: ['avatarUrl', 'threeViewUrl', 'tagSpriteUrl'],
        sceneNode: ['coverImageUrl'],
      };
      if (!(targetKind[target.type || ''] || []).includes(operation.field)) throw new Error(`Media field '${operation.field}' is not writable for this node type.`);
      nextNodes = nextNodes.map((node) => {
        if (node.id !== nodeId) return node;
        const data = { ...node.data } as Record<string, unknown>;
        delete data[operation.field as string];
        return { ...node, data };
      });
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'delete_story_node') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const current = nextNodes.find((node) => node.id === nodeId);
      if (!current) throw new Error(`Node '${nodeId}' was not found.`);
      if (current.type !== 'storyNode') throw new Error(`Node '${nodeId}' is not a story card.`);
      if ((current.data as Record<string, unknown>).isRoot === true) throw new Error('The root story card cannot be deleted.');
      nextNodes = nextNodes.filter((node) => node.id !== nodeId);
      nextEdges = nextEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
      nextNodes = nextNodes.map((node) => node.type === 'groupNode' && Array.isArray(node.data.childIds)
        ? { ...node, data: { ...node.data, childIds: node.data.childIds.filter((id) => id !== nodeId) } }
        : node);
      deleted.push(...nextNodes.filter((node) => node.type === 'groupNode' && Array.isArray(node.data.childIds) && node.data.childIds.length === 0).map((node) => node.id));
      nextNodes = nextNodes.filter((node) => node.type !== 'groupNode' || (Array.isArray(node.data.childIds) && node.data.childIds.length > 0));
      deleted.push(nodeId);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'delete_project_node') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const current = nextNodes.find((node) => node.id === nodeId);
      if (!current) throw new Error(`Node '${nodeId}' was not found.`);
      if (!['storyNode', 'characterNode', 'sceneNode', 'plotStructureNode'].includes(current.type || '')) {
        throw new Error(`Node '${nodeId}' is not a deletable story, character, scene, or plot-structure card.`);
      }
      if (current.type === 'storyNode' && (current.data as Record<string, unknown>).isRoot === true) {
        throw new Error('The root story card is protected. Update it to become the first card of the new story instead.');
      }
      nextNodes = nextNodes.filter((node) => node.id !== nodeId);
      nextEdges = nextEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
      nextNodes = nextNodes.map((node) => node.type === 'groupNode' && Array.isArray(node.data.childIds)
        ? { ...node, data: { ...node.data, childIds: node.data.childIds.filter((id) => id !== nodeId) } }
        : node);
      deleted.push(...nextNodes.filter((node) => node.type === 'groupNode' && Array.isArray(node.data.childIds) && node.data.childIds.length === 0).map((node) => node.id));
      nextNodes = nextNodes.filter((node) => node.type !== 'groupNode' || (Array.isArray(node.data.childIds) && node.data.childIds.length > 0));
      deleted.push(nodeId);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'move_node' || operation.type === 'move_dynamic_group') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const position = positionOf(operation.position);
      if (!nextNodes.some((node) => node.id === nodeId)) throw new Error(`Node '${nodeId}' was not found.`);
      const current = nextNodes.find((node) => node.id === nodeId)!;
      if (operation.type === 'move_dynamic_group' && current.type !== 'groupNode') throw new Error(`Node '${nodeId}' is not a dynamic group.`);
      if (current.type === 'groupNode') {
        const childIds = Array.isArray(current.data.childIds) ? current.data.childIds.filter((id): id is string => typeof id === 'string') : [];
        if (!childIds.length) throw new Error(`Dynamic group '${nodeId}' has no member cards to move.`);
        const childIdSet = new Set(childIds);
        const children = nextNodes.filter((node) => childIdSet.has(node.id));
        const groupOrigin = {
          x: Math.min(...children.map((node) => node.position.x)) - 20,
          y: Math.min(...children.map((node) => node.position.y)) - 20,
        };
        const deltaX = position.x - groupOrigin.x;
        const deltaY = position.y - groupOrigin.y;
        nextNodes = nextNodes.map((node) => childIdSet.has(node.id)
          ? { ...node, position: { x: node.position.x + deltaX, y: node.position.y + deltaY } }
          : node.id === nodeId ? { ...node, position } : node);
      } else {
        nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, position } : node);
      }
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'connect_story_nodes' || operation.type === 'disconnect_story_nodes') {
      const sourceId = operation.source_id;
      const targetId = operation.target_id;
      if (typeof sourceId !== 'string' || typeof targetId !== 'string' || !sourceId.trim() || !targetId.trim()) throw new Error('source_id and target_id must be non-empty strings.');
      if (sourceId === targetId) throw new Error('A story card cannot connect to itself.');
      for (const id of [sourceId, targetId]) {
        const node = nextNodes.find((item) => item.id === id);
        if (!node) throw new Error(`Story node '${id}' was not found.`);
        if (node.type !== 'storyNode') throw new Error(`Node '${id}' is not a story card.`);
      }
      if (operation.type === 'disconnect_story_nodes') {
        const before = nextEdges.length;
        nextEdges = nextEdges.filter((edge) => edge.source !== sourceId || edge.target !== targetId);
        if (nextEdges.length === before) throw new Error('No directed link exists between these story cards.');
      } else {
        if (nextEdges.some((edge) => edge.source === sourceId && edge.target === targetId)) throw new Error('A link between these story cards already exists.');
        const label = operation.label;
        if (label !== undefined && (typeof label !== 'string' || label.length > 500)) throw new Error('label must be a string of at most 500 characters.');
        const sourceNode = nextNodes.find((node) => node.id === sourceId)!;
        const targetNode = nextNodes.find((node) => node.id === targetId)!;
        const { sourceHandle, targetHandle } = getStoryConnectionHandles(sourceNode, targetNode);
        nextEdges.push({ id: `mcp-${uuidv4()}`, ...defaultEdge, source: sourceId, sourceHandle, target: targetId, targetHandle, ...(typeof label === 'string' && label ? { label } : {}) });
      }
      changes.push({ type: operation.type, sourceId, targetId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'connect_story_setting' || operation.type === 'disconnect_story_setting') {
      const firstId = operation.source_id;
      const secondId = operation.target_id;
      if (typeof firstId !== 'string' || typeof secondId !== 'string' || !firstId.trim() || !secondId.trim()) throw new Error('source_id and target_id must be non-empty strings.');
      if (firstId === secondId) throw new Error('A card cannot be associated with itself.');
      const first = nextNodes.find((node) => node.id === firstId);
      const second = nextNodes.find((node) => node.id === secondId);
      if (!first || !second) throw new Error('Both relationship endpoint cards must exist.');
      const story = first.type === 'storyNode' ? first : second.type === 'storyNode' ? second : null;
      const setting = story === first ? second : story === second ? first : null;
      if (!story || (setting?.type !== 'characterNode' && setting?.type !== 'sceneNode')) {
        throw new Error('Presentation associations require one story card and one character or scene card.');
      }
      const isSamePair = (edge: Edge) =>
        (edge.source === story.id && edge.target === setting.id) ||
        (edge.source === setting.id && edge.target === story.id);
      if (operation.type === 'disconnect_story_setting') {
        const before = nextEdges.length;
        nextEdges = nextEdges.filter((edge) => !isSamePair(edge));
        if (nextEdges.length === before) throw new Error('No presentation association exists between these cards.');
      } else {
        if (nextEdges.some(isSamePair)) throw new Error('A relationship between these cards already exists.');
        const { sourceHandle, targetHandle } = getStoryConnectionHandles(story, setting);
        nextEdges.push({
          id: `mcp-${uuidv4()}`,
          ...defaultEdge,
          source: story.id,
          sourceHandle,
          target: setting.id,
          targetHandle,
          data: { mcpRelation: 'presentation' },
        });
      }
      changes.push({ type: operation.type, storyId: story.id, settingId: setting.id, settingType: setting.type });
      changedCount += 1;
      continue;
    }
    throw new Error(`Unsupported story edit operation '${operation.type}'.`);
  }

  if (storyTextChangedIds.size) {
    nextNodes = nextNodes.map((node) => storyTextChangedIds.has(node.id) && node.type === 'storyNode'
      ? syncMcpStoryMentions(node, nextNodes)
      : node);
  }

  const requestedDirection = layoutOptions.direction ?? operations.find(
    (operation) => operation.layout_direction !== undefined,
  )?.layout_direction;
  const generatedLayout = layoutMcpGeneratedCards(
    nextNodes,
    nextEdges,
    created,
    requestedDirection,
    layoutOptions.language || 'zh',
    operations
      .filter((operation) => operation.type === 'move_node' && typeof operation.node_id === 'string')
      .map((operation) => operation.node_id as string)
      .filter((id) => created.includes(id)),
  );
  nextNodes = [...generatedLayout.nodes, ...generatedLayout.backgrounds];
  const generatedIds = new Set(created);
  if (generatedIds.size > 0) {
    const nodesById = new Map(nextNodes.map((node) => [node.id, node]));
    nextEdges = nextEdges.map((edge) => {
      if (!generatedIds.has(edge.source) && !generatedIds.has(edge.target)) return edge;
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (source?.type !== 'storyNode' || target?.type !== 'storyNode') return edge;
      return { ...edge, ...getStoryConnectionHandles(source, target) };
    });
  }

  return {
    nodes: nextNodes,
    edges: nextEdges,
    changed: JSON.stringify(nodes) !== JSON.stringify(nextNodes) || JSON.stringify(edges) !== JSON.stringify(nextEdges),
    summary: {
      operationCount: operations.length,
      changedCount,
      changes,
      createdNodeIds: created,
      layoutBackgroundIds: generatedLayout.backgrounds.map((node) => node.id),
      deletedNodeIds: deleted,
      nodeCount: nextNodes.length,
      edgeCount: nextEdges.length,
    },
  };
};
