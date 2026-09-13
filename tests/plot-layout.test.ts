import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node } from '@xyflow/react';
import {
  getNodePlacementBounds,
  rectsOverlap,
  resolveAssistantAppendLayoutOrigin,
} from '../src/components/story-editor/assistantCardPlacementLayout';
import {
  applyAssistantStoryTags,
  buildAssistantMentionReferencesFromNodes,
} from '../src/components/story-editor/assistantMentions';

test('new batches avoid entire backgrounds, groups and plot tools, including empty areas', () => {
  const nodes: Node[] = [
    {
      id: 'background',
      type: 'backgroundNode',
      position: { x: 0, y: 0 },
      style: { width: 900, height: 1200 },
      data: {},
    },
    {
      id: 'group',
      type: 'groupNode',
      position: { x: 1000, y: 0 },
      style: { width: 600, height: 700 },
      data: {},
    },
    {
      id: 'tool',
      type: 'plotStructureNode',
      position: { x: 1650, y: 0 },
      style: { width: 260, height: 500 },
      data: {},
    },
  ];
  const origin = resolveAssistantAppendLayoutOrigin({
    existingNodes: nodes,
    batchWidth: 900,
    batchHeight: 800,
    viewportCenter: { x: 100, y: 100 },
    spawnCursor: { x: 850, y: 50 },
  });
  const batch = {
    minX: origin.layoutLeft,
    minY: origin.layoutTop,
    maxX: origin.layoutLeft + 900,
    maxY: origin.layoutTop + 800,
  };
  assert.ok(nodes.every((node) => !rectsOverlap(batch, getNodePlacementBounds(node), 40)));
});

test('ordinary continuation tags bind the named character and inherited scene to existing nodes', () => {
  const nodes: Node[] = [
    {
      id: 'monk',
      type: 'characterNode',
      position: { x: 0, y: 0 },
      data: { characterName: '小和尚' },
    },
    { id: 'temple', type: 'sceneNode', position: { x: 0, y: 0 }, data: { sceneName: '山中寺庙' } },
  ];
  const refs = buildAssistantMentionReferencesFromNodes(nodes).map((ref) => ({
    ...ref,
    prependIfMissing: ref.id === 'temple',
  }));
  const tagged = applyAssistantStoryTags('小和尚抬头望向远山。', refs);
  assert.match(tagged.text, /data-mention-kind="character"/);
  assert.match(tagged.text, /data-mention-kind="scene"/);
  assert.equal(tagged.presentation?.scene?.sourceNodeId, 'temple');
  assert.equal(tagged.presentation?.characters[0].sourceNodeId, 'monk');
});
