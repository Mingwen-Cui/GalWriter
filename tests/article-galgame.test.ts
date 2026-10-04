import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node } from '@xyflow/react';
import { prepareArticleGalgameCards } from '../src/editor-features/assistant/articleGalgameCards';
import { arrangeArticleGalgameNodes } from '../src/components/story-editor/articleGalgameLayout';

test('story-only model output gets a real scene and character/scene references', () => {
  const cards = prepareArticleGalgameCards([
    { type: 'character', characterName: '不应替换的角色' },
    { type: 'story', text: '先理解什么是反馈。' },
    { type: 'story', text: '用一个例子解释反馈。' },
    { type: 'story', text: '回顾今天的重点。' },
  ], { characterName: '宋清和', chapters: ['导入', '解释', '回顾'] });
  assert.equal(cards[0].type, 'scene');
  assert.equal(cards[0].generateImage, false);
  assert.ok(!cards.some((card) => card.type === 'character'));
  const stories = cards.slice(1);
  assert.deepEqual(stories.map((card) => card.chapterTitle), ['导入', '解释', '回顾']);
  assert.ok(stories.every((card) => card.text?.includes('宋清和') && card.text.includes('安静教室')));
  assert.deepEqual(stories[0].connectTo, [stories[1].key]);
  assert.deepEqual(stories[1].connectTo, [stories[2].key]);
});

test('valid teaching choices retain their labels and converge', () => {
  const cards = prepareArticleGalgameCards([
    { type: 'story', key: 'question', text: '你想先看哪个例子？', branchTargets: [
      { target: 'a', label: '看生活中的例子' }, { target: 'b', label: '看工作中的例子' },
    ] },
    { type: 'story', key: 'a', text: '这是生活中的反馈。', connectTo: ['summary'] },
    { type: 'story', key: 'b', text: '这是工作中的反馈。', connectTo: ['summary'] },
    { type: 'story', key: 'summary', text: '两种例子都说明反馈改变行动。' },
  ], { characterName: '宋清和', useScene: false });
  assert.equal(cards[0].branchTargets?.length, 2);
  assert.equal(cards[0].branchTargets?.[0].label, '看生活中的例子');
  assert.deepEqual(cards[1].connectTo, [cards[3].key]);
  assert.deepEqual(cards[2].connectTo, [cards[3].key]);
});

test('broken, backwards and skipped links cannot leave unreachable chapters', () => {
  const cards = prepareArticleGalgameCards([
    { type: 'story', key: 'one', chapterTitle: '导入', text: '导入', connectTo: ['last'] },
    { type: 'story', key: 'two', chapterTitle: '解释', text: '解释', connectTo: ['missing', 'one'] },
    { type: 'story', key: 'last', chapterTitle: '回顾', text: '回顾' },
  ], { characterName: '宋清和', useScene: false });
  assert.deepEqual(cards[0].connectTo, [cards[1].key]);
  assert.deepEqual(cards[1].connectTo, [cards[2].key]);
  assert.deepEqual(cards[2].connectTo, []);
});

test('missing story output fails instead of reporting success', () => {
  assert.throws(() => prepareArticleGalgameCards([{ type: 'scene', sceneName: '教室' }],
    { characterName: '宋清和' }), /没有收到有效剧情卡/);
});

test('completed batch selects its actor, scene and chapter regions and arranges a downward flow', () => {
  const cards = prepareArticleGalgameCards([
    { type: 'story', key: 'q', chapterTitle: '导入', text: '问题', branchTargets: [
      { target: 'a', label: '看例子' }, { target: 'b', label: '看解释' },
    ] },
    { type: 'story', key: 'a', chapterTitle: '导入', text: '例子', connectTo: ['end'] },
    { type: 'story', key: 'b', chapterTitle: '导入', text: '解释', connectTo: ['end'] },
    { type: 'story', key: 'end', chapterTitle: '回顾', text: '回顾' },
  ], { characterName: '宋清和' });
  const ids = cards.map((_, index) => `generated-${index}`);
  const nodes: Node[] = [
    { id: 'old', type: 'storyNode', position: { x: 0, y: 0 }, data: {}, selected: true },
    { id: 'actor', type: 'characterNode', position: { x: 600, y: 0 }, data: {} },
    ...cards.map((card, index) => ({ id: ids[index], type: card.type === 'scene' ? 'sceneNode' : 'storyNode',
      position: { x: 900 + index * 500, y: 100 }, data: {}, style: { width: 300, height: 260 } })),
    { id: 'chapter-one', type: 'groupNode', position: { x: 0, y: 0 },
      data: { assistantAutoFitChildIds: ids.slice(1, 4), assistantAutoFitPadding: 56 } },
    { id: 'chapter-two', type: 'groupNode', position: { x: 0, y: 0 },
      data: { assistantAutoFitChildIds: [ids[4]], assistantAutoFitPadding: 56 } },
  ];
  const batch = { cards, nodeIds: ids, setupNodeIds: ['actor'] };
  const arranged = arrangeArticleGalgameNodes(nodes, batch);
  const byId = new Map(arranged.map((node) => [node.id, node]));
  assert.equal(byId.get('old')?.selected, false);
  assert.deepEqual(byId.get('old')?.position, { x: 0, y: 0 });
  assert.ok(arranged.filter((node) => node.id !== 'old').every((node) => node.selected));
  assert.ok(byId.get(ids[1])!.position.y < byId.get(ids[2])!.position.y);
  assert.equal(byId.get(ids[2])!.position.y, byId.get(ids[3])!.position.y);
  assert.notEqual(byId.get(ids[2])!.position.x, byId.get(ids[3])!.position.x);
  const firstRegion = byId.get('chapter-one')!;
  const lastRegion = byId.get('chapter-two')!;
  assert.ok(firstRegion.position.y + Number(firstRegion.style?.height) < lastRegion.position.y);
  assert.deepEqual(arrangeArticleGalgameNodes(arranged, batch).map((node) => node.position),
    arranged.map((node) => node.position));
});
