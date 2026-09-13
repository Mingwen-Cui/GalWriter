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
  createAssistantFallbackScene,
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

const sceneReferences = [
  { id: 'mountain', kind: 'scene' as const, name: '很远很远的山峰' },
  { id: 'temple', kind: 'scene' as const, name: '山中寺庙', prependIfMissing: true },
  { id: 'gate', kind: 'scene' as const, name: '山门' },
  { id: 'monk', kind: 'character' as const, name: '小和尚' },
];

test('pure narration always inherits a scene without requiring a character name', () => {
  const tagged = applyAssistantStoryTags('石阶下传来接连的脚步声。', sceneReferences);
  assert.equal(tagged.presentation?.scene?.sourceNodeId, 'temple');
  assert.equal((tagged.text.match(/data-mention-kind="scene"/g) || []).length, 1);
  assert.equal(tagged.presentation?.characters.length, 0);
});

test('existing character markup gains the preferred scene and remains idempotent', () => {
  const tagged = applyAssistantStoryTags(
    '<span data-mention-kind="character" data-mention-name="小和尚">小和尚</span>抬头望去。',
    sceneReferences,
  );
  assert.equal(tagged.presentation?.scene?.sourceNodeId, 'temple');
  const repeated = applyAssistantStoryTags(tagged.text, sceneReferences);
  assert.equal(repeated.text, tagged.text);
  assert.equal(repeated.presentation?.scene?.sourceNodeId, 'temple');
});

test('an explicit new scene replaces the inherited scene without adding a stale scene tag', () => {
  const tagged = applyAssistantStoryTags('山门外传来脚步声。', sceneReferences);
  assert.equal(tagged.presentation?.scene?.sourceNodeId, 'gate');
  assert.equal((tagged.text.match(/data-mention-kind="scene"/g) || []).length, 1);
  assert.ok(!tagged.text.includes('山中寺庙'));
});

test('escaped scene names retain their binding without receiving duplicate tags', () => {
  const refs = [{ id: 'special', kind: 'scene' as const, name: '城门 & "路口"' }];
  const tagged = applyAssistantStoryTags('脚步声渐渐停了下来。', refs);
  const repeated = applyAssistantStoryTags(tagged.text, refs);
  assert.equal(repeated.text, tagged.text);
  assert.equal(repeated.presentation?.scene?.sourceNodeId, 'special');
});

test('a document without scenes gets an editable source outside existing content', () => {
  const nodes: Node[] = [
    {
      id: 'region',
      type: 'backgroundNode',
      position: { x: 0, y: 0 },
      style: { width: 1000, height: 900 },
      data: {},
    },
  ];
  const scene = createAssistantFallbackScene(nodes, 'zh');
  assert.ok(!rectsOverlap(getNodePlacementBounds(scene), getNodePlacementBounds(nodes[0]), 40));
  assert.equal(scene.type, 'sceneNode');
  const tagged = applyAssistantStoryTags(
    '夜色渐渐降临。',
    buildAssistantMentionReferencesFromNodes([...nodes, scene]),
  );
  assert.equal(tagged.presentation?.scene?.sourceNodeId, scene.id);
  assert.match(tagged.text, /data-mention-kind="scene"/);
});

test('unnamed scene cards remain valid references and current scene takes priority', () => {
  const nodes: Node[] = [
    { id: 'first', type: 'sceneNode', position: { x: 0, y: 0 }, data: { sceneName: '远处的小城' } },
    { id: 'current', type: 'sceneNode', position: { x: 500, y: 0 }, data: { sceneName: '' } },
  ];
  const tagged = applyAssistantStoryTags(
    '身后的声响停了下来。',
    buildAssistantMentionReferencesFromNodes(nodes, 'current'),
  );
  assert.equal(tagged.presentation?.scene?.sourceNodeId, 'current');
  assert.match(tagged.text, /未命名场景/);
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
