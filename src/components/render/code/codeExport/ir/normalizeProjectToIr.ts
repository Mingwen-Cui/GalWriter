import type { Edge, Node } from '@xyflow/react';

import { resolveRegionBackgroundMusic } from '../../../../../lib/regionMusic';
import { createAssetRegistry } from '../assets';
import { normalizeRenpyExportSettings, variableInitialValue } from '../model';
import type { CodeDiagnostic, RenpyExportSettings } from '../types';
import { chapterForNode, runtimeGraph, stableLabelForNode } from './graphSemantics';
import type { GalWriterIr, IrBlock, IrChapter, IrControl, IrStatement } from './irTypes';
import { richTextToPlainText } from './richText';

const text = (node: Node | undefined, key: string) =>
  typeof node?.data?.[key] === 'string' ? String(node.data[key]).trim() : '';
const position = (value: unknown): 'left' | 'center' | 'right' =>
  value === 'left' || value === 'right' ? value : 'center';

export const normalizeProjectToIr = (
  nodes: Node[],
  edges: Edge[],
  projectName: string,
  inputSettings?: Partial<RenpyExportSettings>,
): { ir: GalWriterIr; diagnostics: CodeDiagnostic[] } => {
  const settings = normalizeRenpyExportSettings(nodes, inputSettings);
  const diagnostics: CodeDiagnostic[] = [];
  const graph = runtimeGraph(nodes, edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const variableById = new Map(settings.variables.map((variable) => [variable.id, variable]));
  const characterById = new Map(
    settings.characters.map((character) => [character.sourceNodeId, character]),
  );
  const assets = createAssetRegistry();

  settings.characters.forEach((character) => {
    if (character.defaultSprite)
      assets.register(
        character.defaultSprite,
        'image',
        character.sourceNodeId,
        `${character.codeName}-default`,
        false,
      );
    Object.entries(character.expressions).forEach(([expression, source]) =>
      assets.register(
        source,
        'image',
        character.sourceNodeId,
        `${character.codeName}-${expression}`,
        false,
      ),
    );
  });
  nodes
    .filter((node) => node.type === 'sceneNode')
    .forEach((node) => {
      const images = Array.isArray(node.data?.images)
        ? (node.data.images as Array<{ name?: string; imageUrl?: string; videoUrl?: string }>)
        : [];
      if (text(node, 'coverImageUrl'))
        assets.register(text(node, 'coverImageUrl'), 'image', node.id, `${node.id}-cover`, false);
      images.forEach((item) => {
        if (item.imageUrl)
          assets.register(
            item.imageUrl,
            'image',
            node.id,
            `${node.id}-${item.name || 'image'}`,
            false,
          );
        if (item.videoUrl)
          assets.register(
            item.videoUrl,
            'video',
            node.id,
            `${node.id}-${item.name || 'video'}`,
            false,
          );
      });
    });

  const chapters = new Map<string, IrChapter>();
  graph.runtimeNodes.forEach((node) => {
    const chapterInfo = chapterForNode(node, nodes, settings);
    const chapter = chapters.get(chapterInfo.id) || { ...chapterInfo, blocks: [] };
    chapters.set(chapterInfo.id, chapter);
    const statements: IrStatement[] = [
      {
        kind: 'comment',
        text: `[GalWriter node: ${node.id}] ${text(node, 'title')}`,
        nodeId: node.id,
      },
    ];
    const outgoing = graph.outgoing.get(node.id) || [];
    let control: IrControl;

    if (node.type === 'numberConditionNode') {
      const configured = settings.conditions[node.id];
      const variable =
        variableById.get(configured?.variableId || 'gw_score') || variableById.get('gw_score');
      const threshold =
        typeof configured?.threshold === 'number'
          ? configured.threshold
          : typeof node.data.threshold === 'number'
            ? node.data.threshold
            : 0;
      const rawRanges = configured?.ranges || node.data.ranges;
      const ranges = Array.isArray(rawRanges)
        ? rawRanges.filter(
            (item): item is { id: string; min: number; max: number } =>
              !!item &&
              typeof item.id === 'string' &&
              typeof item.min === 'number' &&
              typeof item.max === 'number',
          )
        : [];
      const branches: Extract<IrControl, { kind: 'condition' }>['branches'] = [];
      if (!variable)
        statements.push({
          kind: 'todo',
          feature: 'missing-variable',
          detail: 'Condition references a missing variable.',
          nodeId: node.id,
        });
      else {
        ranges.forEach((range) => {
          const edge = outgoing.find((item) => item.sourceHandle === `out-range-${range.id}`);
          if (edge)
            branches.push({
              condition: {
                kind: 'range',
                variableId: variable.id,
                codeName: variable.codeName,
                min: range.min,
                max: range.max,
              },
              targetLabel: stableLabelForNode(edge.target),
              targetNodeId: edge.target,
              edgeId: edge.id,
            });
          else
            statements.push({
              kind: 'todo',
              feature: 'missing-condition-output',
              detail: `Range ${range.min}..${range.max} has no connected output.`,
              nodeId: node.id,
            });
        });
        const greater = outgoing.find((item) => item.sourceHandle === 'out-greater');
        const fallback = outgoing.find((item) => item.sourceHandle === 'out-less-equal');
        if (greater)
          branches.push({
            condition: {
              kind: 'gte',
              variableId: variable.id,
              codeName: variable.codeName,
              value: threshold,
            },
            targetLabel: stableLabelForNode(greater.target),
            targetNodeId: greater.target,
            edgeId: greater.id,
          });
        else
          statements.push({
            kind: 'todo',
            feature: 'missing-condition-output',
            detail: `The >= ${threshold} output is not connected.`,
            nodeId: node.id,
          });
        if (fallback)
          branches.push({
            condition: { kind: 'else' },
            targetLabel: stableLabelForNode(fallback.target),
            targetNodeId: fallback.target,
            edgeId: fallback.id,
          });
        else
          statements.push({
            kind: 'todo',
            feature: 'missing-condition-output',
            detail: 'The fallback <= output is not connected.',
            nodeId: node.id,
          });
      }
      control = { kind: 'condition', branches };
    } else {
      const presentation = node.data.presentation as
        | {
            scene?: { sourceNodeId?: string; imageId?: string; enter?: { duration?: number } };
            characters?: Array<{
              sourceNodeId?: string;
              outfitId?: string;
              position?: string;
              enter?: { duration?: number; type?: string };
            }>;
            inlineActions?: unknown[];
          }
        | undefined;
      const sceneNode = presentation?.scene?.sourceNodeId
        ? nodeById.get(presentation.scene.sourceNodeId)
        : undefined;
      const sceneImages = Array.isArray(sceneNode?.data?.images)
        ? (sceneNode.data.images as Array<{ id?: string; imageUrl?: string; videoUrl?: string }>)
        : [];
      const selectedScene =
        sceneImages.find((item) => item.id === presentation?.scene?.imageId) ||
        sceneImages.find((item) => item.imageUrl || item.videoUrl);
      const imageUrl =
        selectedScene?.imageUrl || text(sceneNode, 'coverImageUrl') || text(node, 'imageUrl');
      const videoUrl = selectedScene?.videoUrl || text(node, 'videoUrl');
      if (imageUrl)
        statements.push({
          kind: 'background',
          assetPath: assets.register(imageUrl, 'image', node.id, text(node, 'title') || node.id),
          transitionSeconds: Math.max(0, Number(presentation?.scene?.enter?.duration || 0.5)),
          nodeId: node.id,
        });
      if (videoUrl)
        statements.push({
          kind: 'video',
          assetPath: assets.register(videoUrl, 'video', node.id, text(node, 'title') || node.id),
          nodeId: node.id,
        });
      const clips = Array.isArray(node.data.audioClips)
        ? (node.data.audioClips as Array<{ name?: string; url?: string; skipped?: boolean }>)
        : [];
      clips.forEach((clip) => {
        if (clip.url)
          assets.register(clip.url, 'audio', node.id, `${node.id}-${clip.name || 'voice'}`, false);
      });
      const voiceUrl =
        text(node, 'audioUrl') || clips.find((clip) => !clip.skipped && clip.url)?.url || '';
      if (voiceUrl)
        statements.push({
          kind: 'audio',
          channel: 'voice',
          assetPath: assets.register(voiceUrl, 'audio', node.id, `${node.id}-voice`),
          loop: false,
          nodeId: node.id,
        });
      const music = resolveRegionBackgroundMusic(nodes, node);
      if (music?.music.url)
        statements.push({
          kind: 'audio',
          channel: 'bgm',
          assetPath: assets.register(music.music.url, 'audio', node.id, `bgm-${music.regionId}`),
          loop: music.music.loop !== false,
          nodeId: node.id,
        });

      const shown = new Set<string>();
      presentation?.characters?.forEach((item) => {
        if (!item.sourceNodeId) return;
        const source = nodeById.get(item.sourceNodeId);
        const character = characterById.get(item.sourceNodeId);
        if (!source || !character) return;
        const outfits = Array.isArray(source.data?.outfits)
          ? (source.data.outfits as Array<{ id?: string; name?: string; imageUrl?: string }>)
          : [];
        const outfit =
          outfits.find((candidate) => candidate.id === item.outfitId) ||
          outfits.find((candidate) => candidate.imageUrl);
        const sprite = outfit?.imageUrl || character.defaultSprite;
        if (!sprite) return;
        shown.add(character.sourceNodeId);
        statements.push({
          kind: 'character-show',
          characterId: character.sourceNodeId,
          codeName: character.codeName,
          displayName: character.displayName,
          expression: outfit?.name,
          assetPath: assets.register(
            sprite,
            'image',
            character.sourceNodeId,
            `${character.codeName}-${outfit?.name || 'default'}`,
          ),
          position: position(item.position),
          transitionSeconds: Math.max(0, Number(item.enter?.duration || 0.3)),
          nodeId: node.id,
        });
        if (
          item.enter?.type &&
          !['none', 'fade', 'slide-left', 'slide-right'].includes(item.enter.type)
        )
          statements.push({
            kind: 'todo',
            feature: 'complex-character-animation',
            detail: `Entrance animation “${item.enter.type}” requires target-specific manual tuning.`,
            nodeId: node.id,
          });
      });
      const nodeConfig = settings.nodes[node.id] || {};
      const speaker = nodeConfig.speakerId ? characterById.get(nodeConfig.speakerId) : undefined;
      if (speaker && !shown.has(speaker.sourceNodeId)) {
        const sprite =
          (nodeConfig.expression && speaker.expressions[nodeConfig.expression]) ||
          speaker.defaultSprite;
        if (sprite)
          statements.push({
            kind: 'character-show',
            characterId: speaker.sourceNodeId,
            codeName: speaker.codeName,
            displayName: speaker.displayName,
            expression: nodeConfig.expression,
            assetPath: assets.register(
              sprite,
              'image',
              speaker.sourceNodeId,
              `${speaker.codeName}-${nodeConfig.expression || 'default'}`,
            ),
            position: 'center',
            transitionSeconds: 0.3,
            nodeId: node.id,
          });
      }
      richTextToPlainText(node.data.text)
        .split('\n')
        .filter(Boolean)
        .forEach((line) =>
          statements.push({
            kind: 'dialogue',
            speakerId: speaker?.sourceNodeId,
            speakerCode: speaker?.codeName,
            speakerName: speaker?.displayName,
            expression: nodeConfig.expression,
            text: line,
            nodeId: node.id,
          }),
        );
      const changes = [...(nodeConfig.variableChanges || [])];
      if (
        typeof node.data.nodeValue === 'number' &&
        node.data.nodeValue !== 0 &&
        !changes.some((change) => change.variableId === 'gw_score')
      )
        changes.push({ variableId: 'gw_score', operation: 'add', value: node.data.nodeValue });
      changes.forEach((change) => {
        const variable = variableById.get(change.variableId);
        if (variable)
          statements.push({
            kind: 'variable',
            variableId: variable.id,
            codeName: variable.codeName,
            variableType: variable.type,
            operation: change.operation,
            value: change.value,
            nodeId: node.id,
          });
        else
          statements.push({
            kind: 'todo',
            feature: 'missing-variable',
            detail: `Variable ${change.variableId} does not exist.`,
            nodeId: node.id,
          });
      });
      if (presentation?.inlineActions?.length)
        statements.push({
          kind: 'todo',
          feature: 'inline-actions',
          detail: `${presentation.inlineActions.length} complex inline action(s) are not represented in the core IR.`,
          nodeId: node.id,
        });

      if (outgoing.length === 0) control = { kind: 'return' };
      else if (outgoing.length === 1)
        control = {
          kind: 'jump',
          targetLabel: stableLabelForNode(outgoing[0].target),
          targetNodeId: outgoing[0].target,
          edgeId: outgoing[0].id,
        };
      else
        control = {
          kind: 'choice',
          options: outgoing.map((edge, index) => ({
            text:
              text({ data: edge.data } as Node, 'label') ||
              text(nodeById.get(edge.target), 'title') ||
              `Option ${index + 1}`,
            targetLabel: stableLabelForNode(edge.target),
            targetNodeId: edge.target,
            edgeId: edge.id,
          })),
        };
    }
    const block: IrBlock = {
      nodeId: node.id,
      label: stableLabelForNode(node.id),
      title: text(node, 'title'),
      chapterId: chapter.id,
      statements,
      control,
    };
    chapter.blocks.push(block);
  });

  edges
    .filter((edge) => !graph.runtimeIds.has(edge.source) || !graph.runtimeIds.has(edge.target))
    .forEach((edge) =>
      diagnostics.push({
        id: `invalid-edge-${edge.id}`,
        level: 'warning',
        message: 'Connection points to a hidden or non-runtime node and is not part of the IR.',
        nodeId: edge.source,
      }),
    );
  const assetList = [...assets.entries.values()];
  const ir: GalWriterIr = {
    format: 'galwriter-story-ir',
    version: 1,
    metadata: {
      projectName,
      entryNodeId: graph.entry?.id || null,
      entryLabel: graph.entry ? stableLabelForNode(graph.entry.id) : null,
      generatedBy: 'GalWriter AI',
    },
    characters: settings.characters.map((character) => ({
      sourceNodeId: character.sourceNodeId,
      codeName: character.codeName,
      displayName: character.displayName,
      abbreviation: character.abbreviation,
      defaultSpritePath: character.defaultSprite
        ? assets.register(
            character.defaultSprite,
            'image',
            character.sourceNodeId,
            `${character.codeName}-default`,
            false,
          )
        : undefined,
      expressions: Object.fromEntries(
        Object.entries(character.expressions).map(([name, source]) => [
          name,
          assets.register(
            source,
            'image',
            character.sourceNodeId,
            `${character.codeName}-${name}`,
            false,
          ),
        ]),
      ),
    })),
    variables: settings.variables.map((variable) => ({
      id: variable.id,
      codeName: variable.codeName,
      displayName: variable.displayName,
      type: variable.type,
      initialValue: variableInitialValue(variable),
    })),
    chapters: [...chapters.values()],
    assets: assetList,
    settings,
  };
  return { ir, diagnostics };
};
