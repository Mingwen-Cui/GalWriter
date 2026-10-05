import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExportWebFlow } from '../src/components/render/web/webExport/webExportFlow';
import type {
  WebExportNode,
  WebExportEdge,
} from '../src/components/render/web/webExport/webExportTypes';

const node = (id: string, isRoot = false): WebExportNode => ({
  id,
  type: 'storyNode',
  data: { title: id, isRoot, imageUrl: `./images/${id}.png` },
});
const edge = (source: string, target: string): WebExportEdge => ({
  id: `${source}-${target}`,
  source,
  target,
});

test('exported flow merges consecutive cards using the preview segmentation', () => {
  const nodes = [node('root', true), node('next'), node('end')];
  const flow = buildExportWebFlow(nodes, [edge('root', 'next'), edge('next', 'end')]);
  assert.equal(flow.nodes.length, 1);
  assert.deepEqual(flow.nodes[0].nodeIds, ['root', 'next', 'end']);
  assert.equal(flow.nodes[0].data.imageUrl, './images/root.png');
  assert.equal(flow.edges.length, 0);
  assert.equal(nodes.length, 3);
});

test('choices remain distinct and resolve through number conditions', () => {
  const condition: WebExportNode = { id: 'condition', type: 'numberConditionNode', data: {} };
  const flow = buildExportWebFlow(
    [node('root', true), node('next'), condition, node('left'), node('right')],
    [
      edge('root', 'next'),
      edge('next', 'condition'),
      edge('condition', 'left'),
      edge('condition', 'right'),
    ],
  );
  assert.deepEqual(
    flow.nodes.map((node) => node.id),
    ['root', 'left', 'right'],
  );
  assert.deepEqual(
    flow.edges.map((edge) => [edge.source, edge.target, edge.isChoice]),
    [
      ['root', 'left', true],
      ['root', 'right', true],
    ],
  );
});
