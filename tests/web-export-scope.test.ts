import assert from 'node:assert/strict';
import test from 'node:test';
import type { Edge, Node } from '@xyflow/react';
import { playableWebScope } from '../src/components/render/web/webExport/webExportScope';

const node = (id: string, data = {}, type = 'storyNode'): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});
const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

test('all playable branches survive while hidden and disconnected cards are omitted', () => {
  const nodes = [
    node('unused'),
    node('root', { isRoot: true }),
    node('condition', {}, 'numberConditionNode'),
    node('left'),
    node('right'),
    node('skip', { skip: true }),
    node('hidden', { hidden: true }),
    node('character', {}, 'characterNode'),
  ];
  const edges = [
    edge('root', 'condition'),
    edge('condition', 'left'),
    edge('condition', 'right'),
    edge('left', 'skip'),
    edge('skip', 'root'),
    edge('root', 'hidden'),
    edge('root', 'character'),
  ];
  const scope = playableWebScope(nodes, edges);
  assert.deepEqual(
    scope.nodes.map((node) => node.id),
    ['root', 'condition', 'left', 'right', 'skip'],
  );
  assert.equal(scope.edges.length, 5);
  assert.equal(nodes.length, 8);
});

test('fallback entry follows player order and traversal handles dangling edges', () => {
  const scope = playableWebScope(
    [node('hidden', { hidden: true }), node('first'), node('next'), node('unreachable')],
    [edge('first', 'missing'), edge('first', 'next')],
  );
  assert.deepEqual(
    scope.nodes.map((node) => node.id),
    ['first', 'next'],
  );
  assert.deepEqual(
    scope.edges.map((edge) => edge.target),
    ['next'],
  );
});
