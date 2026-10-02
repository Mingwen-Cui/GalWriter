import type { Edge, Node } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

type McpOperation = Record<string, unknown>;

const textFields: Record<string, string[]> = {
  storyNode: ['title', 'text', 'skip'],
  characterNode: [
    'characterName', 'identity', 'appearance', 'traits', 'personality', 'habits', 'speechStyle',
    'experience', 'relationships', 'notes', 'features', 'background', 'other',
  ],
  sceneNode: ['sceneName', 'description', 'location', 'items', 'atmosphere', 'time', 'weather', 'visual', 'sound', 'notes', 'other'],
};
const booleanFields: Record<string, string[]> = {
  storyNode: ['hideTitleInPlayback', 'showTextOverlay'],
  characterNode: ['isGlobal', 'showPersonality', 'showFeatures', 'showBackground', 'showOther'],
  sceneNode: ['isGlobal', 'showLocation', 'showItems', 'showAtmosphere', 'showOther', 'scenePresetEnabled'],
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
        if (typeof image.id === 'string') add(node, `images:${image.id}`, 'image', image.imageUrl, String(image.name || image.id));
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
) => {
  if (!Array.isArray(operations) || operations.length < 1 || operations.length > 100) throw new Error('operations must contain between 1 and 100 supported edits.');
  let nextNodes = [...nodes];
  let nextEdges = [...edges];
  const created: string[] = [];
  const deleted: string[] = [];
  const changes: Array<{ type: string; nodeId?: string; sourceId?: string; targetId?: string }> = [];
  let changedCount = 0;

  for (const operation of operations) {
    if (!operation || typeof operation !== 'object' || typeof operation.type !== 'string') throw new Error('Each operation must have a supported type.');
    const nodeId = operation.node_id;
    if (operation.type === 'create_story_node' || operation.type === 'create_character_node' || operation.type === 'create_scene_node') {
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
      } else {
        const sceneName = operation.scene_name;
        if (typeof sceneName !== 'string' || !sceneName.trim() || sceneName.length > 200) throw new Error('scene_name must be a non-empty string of at most 200 characters.');
        node = { id, type: 'sceneNode', position, style: { width: 440 }, data: { id, sceneName: sceneName.trim(), description: '', scenePresetEnabled: false } };
      }
      nextNodes.push(node);
      created.push(id);
      changes.push({ type: operation.type, nodeId: id });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'update_node' || operation.type === 'update_story_node') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const current = nextNodes.find((node) => node.id === nodeId);
      if (!current) throw new Error(`Node '${nodeId}' was not found.`);
      if (operation.type === 'update_story_node' && current.type !== 'storyNode') throw new Error(`Node '${nodeId}' is not a story card.`);
      const fields = operation.fields;
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('fields must be an object.');
      const updates = fields as Record<string, unknown>;
      if (!Object.keys(updates).length) throw new Error('fields must include at least one supported field.');
      const allowedText = textFields[current.type || ''] || [];
      const allowedBoolean = booleanFields[current.type || ''] || [];
      const nextData = { ...current.data } as Record<string, unknown>;
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
        } else {
          throw new Error(`Field '${key}' is not writable for node type '${current.type}'.`);
        }
      }
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, data: nextData } : node);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'set_presentation') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const current = nextNodes.find((node) => node.id === nodeId && node.type === 'storyNode');
      if (!current) throw new Error(`Story node '${String(nodeId)}' was not found.`);
      const presentation = validatePresentation(operation.presentation, nextNodes);
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, presentation } } : node);
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
          const name = escapeHtml(getNodeName(target));
          return `<span class="mention-chip mention-chip-${segment.kind}" data-mention-kind="${segment.kind}" data-mention-name="${name}" data-mention-id="${uuidv4()}" contenteditable="false" draggable="false">${name}</span>`;
        }
        throw new Error('Each text segment must be text or a character/scene mention.');
      }).join('');
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, text: html } } : node);
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
      const sourceValue = asset.field.startsWith('images:')
        ? (sourceData.images as Array<Record<string, unknown>>).find((item) => item.id === asset.field.slice('images:'.length))?.imageUrl
        : sourceData[asset.field];
      if (typeof sourceValue !== 'string') throw new Error('The selected media asset is no longer available.');
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, [operation.field as string]: sourceValue } } : node);
      changes.push({ type: operation.type, nodeId });
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
      deleted.push(nodeId);
      changes.push({ type: operation.type, nodeId });
      changedCount += 1;
      continue;
    }

    if (operation.type === 'move_node') {
      if (typeof nodeId !== 'string') throw new Error('node_id must be a string.');
      const position = positionOf(operation.position);
      if (!nextNodes.some((node) => node.id === nodeId)) throw new Error(`Node '${nodeId}' was not found.`);
      nextNodes = nextNodes.map((node) => node.id === nodeId ? { ...node, position } : node);
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
        nextEdges.push({ id: `mcp-${uuidv4()}`, ...defaultEdge, source: sourceId, target: targetId, ...(typeof label === 'string' && label ? { label } : {}) });
      }
      changes.push({ type: operation.type, sourceId, targetId });
      changedCount += 1;
      continue;
    }
    throw new Error(`Unsupported story edit operation '${operation.type}'.`);
  }

  return {
    nodes: nextNodes,
    edges: nextEdges,
    changed: JSON.stringify(nodes) !== JSON.stringify(nextNodes) || JSON.stringify(edges) !== JSON.stringify(nextEdges),
    summary: { operationCount: operations.length, changedCount, changes, createdNodeIds: created, deletedNodeIds: deleted, nodeCount: nextNodes.length, edgeCount: nextEdges.length },
  };
};
