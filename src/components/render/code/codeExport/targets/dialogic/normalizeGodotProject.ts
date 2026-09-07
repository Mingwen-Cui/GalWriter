import type { Edge, Node } from '@xyflow/react';

import type { CharacterNodeData, SceneNodeData, StoryPresentation } from '../../../../../../domain/project';
import { resolveCharacterImageUrl, resolveSceneMedia } from '../../../../../../lib/inlineAssetSwitch';
import { normalizeStoryPresentation } from '../../../../../../lib/presentation';
import { createAssetRegistry } from '../../assets';
import type { GalWriterIr, IrBlock } from '../../ir/irTypes';
import { normalizeProjectToIr } from '../../ir/normalizeProjectToIr';
import { richTextToPlainText } from '../../ir/richText';
import type { RenpyExportSettings } from '../../types';

export type GodotEvent = Record<string, unknown> & { kind: string };
export type GodotBlock = Omit<IrBlock, 'statements'> & {
  passive: boolean;
  statements: GodotEvent[];
  stage: { background: Record<string, unknown>; characters: Record<string, unknown>[] };
};
export type GodotIr = GalWriterIr & { godot: { blocks: GodotBlock[] } };

// Keep the shared exporters unchanged. Godot needs the original presentation data,
// which the interchange IR intentionally reduces to a small common feature set.
export const normalizeGodotProject = (
  nodes: Node[], edges: Edge[], projectName: string, settings?: Partial<RenpyExportSettings>,
) => {
  const normalized = normalizeProjectToIr(nodes, edges, projectName, settings);
  const ir = normalized.ir as GodotIr;
  const registry = createAssetRegistry();
  ir.assets.forEach((asset) => registry.entries.set(`${asset.kind}:${asset.source}`, asset));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const register = (source: string | undefined, kind: 'image' | 'audio' | 'video', id: string) =>
    source ? registry.register(source, kind, id, id) : '';
  const motion = (value?: { type: string; duration: number }) => ({
    type: value?.type || 'none',
    duration: value?.type && value.type !== 'none' ? Math.max(0, Number(value.duration) || 0) / 1000 : 0,
  });
  const blocks = ir.chapters.flatMap((chapter) => chapter.blocks).map((block): GodotBlock => {
    const node = byId.get(block.nodeId)!;
    const presentation = normalizeStoryPresentation(node.data.presentation as StoryPresentation | undefined);
    const sceneNode = byId.get(presentation.scene?.sourceNodeId || '');
    const media = resolveSceneMedia({
      data: sceneNode?.data as unknown as SceneNodeData | undefined,
      scene: presentation.scene,
      fallbackImageUrl: typeof node.data.imageUrl === 'string' ? node.data.imageUrl : undefined,
      fallbackVideoUrl: typeof node.data.videoUrl === 'string' ? node.data.videoUrl : undefined,
    });
    const background = {
      ...presentation.scene,
      assetPath: register(media.imageUrl, 'image', node.id),
      videoPath: register(media.videoUrl, 'video', node.id),
      enter: motion(presentation.scene?.enter), exit: motion(presentation.scene?.exit),
    };
    const characters: Record<string, unknown>[] = presentation.characters.map((config) => {
      const source = byId.get(config.sourceNodeId);
      const assetPath = source ? register(resolveCharacterImageUrl(source.data as unknown as CharacterNodeData, config), 'image', source.id) : '';
      return { ...config, assetPath, enter: motion(config.enter), exit: motion(config.exit) };
    });
    // An explicitly configured dialogue speaker can also supply the default portrait.
    block.statements.forEach((statement) => {
      if (statement.kind === 'character-show' && !characters.some((item) => item.sourceNodeId === statement.characterId)) {
        characters.push({ sourceNodeId: statement.characterId, assetPath: statement.assetPath, position: statement.position, enter: motion(), exit: motion() });
      }
    });
    const dialogue = block.statements.find((statement) => statement.kind === 'dialogue');
    const events: GodotEvent[] = [];
    const addText = (text: string) => text.split('\n').filter((line) => line.trim()).forEach((line) => {
      events.push({ kind: 'dialogue', text: line, speakerName: dialogue?.kind === 'dialogue' ? dialogue.speakerName || '' : '' });
    });
    const addAction = (id: string) => {
      const action = presentation.inlineActions?.find((item) => item.id === id);
      if (!action) return false;
      const source = byId.get(action.sourceNodeId);
      let assetPath = '';
      let videoPath = '';
      if (action.action === 'switch' && source) {
        if (action.kind === 'character') {
          const config = presentation.characters.find((item) => item.sourceNodeId === source.id);
          if (config) assetPath = register(resolveCharacterImageUrl(source.data as unknown as CharacterNodeData, config, action), 'image', source.id);
        } else {
          const switched = resolveSceneMedia({ data: source.data as unknown as SceneNodeData, scene: presentation.scene, switchAction: action });
          assetPath = register(switched.imageUrl, 'image', source.id);
          videoPath = register(switched.videoUrl, 'video', source.id);
        }
      }
      events.push({ ...action, kind: 'action', targetKind: action.kind, duration: Math.max(0, Number(action.duration) || 0) / 1000, assetPath, videoPath });
      return true;
    };
    const html = typeof node.data.text === 'string' ? node.data.text : '';
    if (typeof document !== 'undefined') {
      const root = document.createElement('div');
      root.innerHTML = html;
      let buffer = '';
      const flush = () => { addText(buffer); buffer = ''; };
      const visit = (element: ChildNode) => {
        if (element.nodeType === 3) { buffer += element.textContent || ''; return; }
        if (!(element instanceof HTMLElement)) return;
        if (element.dataset.mentionId && presentation.inlineActions?.some((item) => item.id === element.dataset.mentionId)) {
          flush(); addAction(element.dataset.mentionId); return;
        }
        if (element.dataset.mentionKind) return;
        if (element.tagName === 'BR') buffer += '\n';
        else {
          element.childNodes.forEach(visit);
          if (['P', 'DIV', 'LI'].includes(element.tagName)) buffer += '\n';
        }
      };
      root.childNodes.forEach(visit); flush();
    } else addText(richTextToPlainText(html));

    const audio = block.statements.filter((item) => item.kind === 'audio').map((item) => ({ ...item }) as GodotEvent);
    const clips = Array.isArray(node.data.audioClips) ? node.data.audioClips as { url?: string; skipped?: boolean }[] : [];
    if (!node.data.audioUrl && clips.some((clip) => clip.url && !clip.skipped)) {
      const queue = clips.filter((clip) => clip.url && !clip.skipped).map((clip) => register(clip.url, 'audio', node.id));
      audio.splice(0, audio.length, ...audio.filter((item) => item.channel !== 'voice'), { kind: 'audio', channel: 'voice', assetPath: queue[0], queue, loop: false });
    }
    const variableEvents = block.statements.filter((item) => item.kind === 'variable');
    const unhandled = block.statements.filter((item) => item.kind === 'todo' && !['inline-actions', 'complex-character-animation'].includes(item.feature));
    // Conditions and skipped cards never present dialogue or media.
    const skip = node.data.skip === true && node.type !== 'numberConditionNode';
    const control = skip && edges.find((edge) => edge.source === node.id && byId.has(edge.target))
      ? (() => {
          const edge = edges.find((item) => item.source === node.id && byId.has(item.target))!;
          const target = ir.chapters.flatMap((item) => item.blocks).find((item) => item.nodeId === edge.target);
          return target ? { kind: 'jump' as const, targetNodeId: target.nodeId, targetLabel: target.label, edgeId: edge.id } : block.control;
        })() : block.control;
    return { ...block, control, passive: node.type === 'numberConditionNode' || skip, statements: skip ? [...variableEvents, ...unhandled] : [...audio, ...events, ...variableEvents, ...unhandled], stage: node.type === 'numberConditionNode' || skip ? { background: {}, characters: [] } : { background, characters } };
  });
  // Remove handled common-IR TODOs and fix units in the optional interchange copy too.
  ir.chapters.forEach((chapter) => chapter.blocks.forEach((block) => {
    block.statements = block.statements.filter((item) => item.kind !== 'todo' || !['inline-actions', 'complex-character-animation'].includes(item.feature));
    block.statements.forEach((item) => { if ('transitionSeconds' in item) item.transitionSeconds /= 1000; });
  }));
  ir.assets = [...registry.entries.values()];
  ir.godot = { blocks };
  return { ...normalized, ir };
};
