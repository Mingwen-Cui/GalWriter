import type { Edge, Node } from '@xyflow/react';
import JSZip from 'jszip';

import {
  buildRenpyProjectPreview,
  buildRenpyProjectZip,
} from '../src/components/render/code/codeExport/renpyExport';
import { normalizeRenpyExportSettings } from '../src/components/render/code/codeExport/model';

const story = (
  id: string,
  title: string,
  text: string,
  extra: Record<string, unknown> = {},
): Node => ({
  id,
  type: 'storyNode',
  position: { x: 0, y: 0 },
  data: { id, title, text, ...extra },
});
const condition = (
  id: string,
  threshold: number,
  ranges: Array<{ id: string; min: number; max: number }> = [],
): Node => ({
  id,
  type: 'numberConditionNode',
  position: { x: 0, y: 0 },
  data: { id, threshold, ranges },
});
const edge = (id: string, source: string, target: string, sourceHandle?: string): Edge => ({
  id,
  source,
  target,
  sourceHandle,
});
const assert = (value: unknown, message: string): asserts value => {
  if (!value) throw new Error(message);
};

const verifyZip = async (
  name: string,
  nodes: Node[],
  edges: Edge[],
  settings = normalizeRenpyExportSettings(nodes),
) => {
  const first = buildRenpyProjectPreview(nodes, edges, settings);
  const second = buildRenpyProjectPreview(nodes, edges, settings);
  assert(
    JSON.stringify(first.manifest) === JSON.stringify(second.manifest),
    `${name}: manifest is not stable`,
  );
  assert(
    !first.diagnostics.some((item) => item.level === 'error'),
    `${name}: blocking diagnostics: ${first.diagnostics.map((item) => item.message).join('; ')}`,
  );
  const result = await buildRenpyProjectZip(nodes, edges, name, settings);
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const paths = Object.keys(zip.files)
    .filter((path) => !zip.files[path].dir)
    .sort();
  assert(paths.includes('game/script.rpy'), `${name}: missing game/script.rpy`);
  assert(paths.includes('game/definitions.rpy'), `${name}: missing definitions.rpy`);
  assert(
    paths.some((path) => path.startsWith('game/scenes/') && path.endsWith('.rpy')),
    `${name}: missing scene file`,
  );
  assert(paths.includes('game/galwriter_manifest.json'), `${name}: missing manifest`);
  assert(paths.includes('CODE_EXPORT_REPORT.md'), `${name}: missing report`);
  const manifest = JSON.parse(
    await zip.file('game/galwriter_manifest.json')!.async('string'),
  ) as typeof first.manifest;
  Object.entries(manifest.nodes).forEach(([nodeId, mapping]) => {
    assert(paths.includes(mapping.file), `${name}: manifest file missing for ${nodeId}`);
    assert(mapping.label.startsWith('gw_'), `${name}: unstable label format for ${nodeId}`);
  });
  const sceneSource = (
    await Promise.all(
      paths
        .filter((path) => path.startsWith('game/scenes/'))
        .map((path) => zip.file(path)!.async('string')),
    )
  ).join('\n');
  const labels = new Set(
    [...sceneSource.matchAll(/^label\s+([A-Za-z_][A-Za-z0-9_]*):/gm)].map((match) => match[1]),
  );
  [...sceneSource.matchAll(/^\s+jump\s+([A-Za-z_][A-Za-z0-9_]*)/gm)].forEach((match) =>
    assert(labels.has(match[1]), `${name}: jump target ${match[1]} is missing`),
  );
  return { first, paths, sceneSource };
};

const singleNodes: Node[] = [
  {
    id: 'character-alice',
    type: 'characterNode',
    position: { x: 0, y: 0 },
    data: {
      id: 'character-alice',
      characterName: '爱丽丝',
      outfits: [{ id: 'smile', name: '微笑', imageUrl: 'data:image/png;base64,iVBORw0KGgo=' }],
    },
  },
  story('single-start', '相遇', '<p>你好。</p>', { isRoot: true }),
  story('single-end', '结束', '再见。'),
];
const singleSettings = normalizeRenpyExportSettings(singleNodes);
singleSettings.characters[0].codeName = 'alice';
singleSettings.nodes['single-start'] = { speakerId: 'character-alice', expression: '微笑' };
const singleResult = await verifyZip(
  'single-story',
  singleNodes,
  [edge('s1', 'single-start', 'single-end')],
  singleSettings,
);
assert(
  singleResult.sceneSource.includes('alice "你好。"'),
  'single-story: character dialogue was not emitted',
);
assert(
  singleResult.paths.some((path) => path.startsWith('game/images/')),
  'single-story: referenced sprite was not packaged',
);

const loopNodes = [
  story('loop-root', '起点', '选择。', { isRoot: true }),
  story('loop-a', '路线 A', '回来。'),
  story('loop-b', '路线 B', '结束。'),
];
await verifyZip('branch-loop', loopNodes, [
  edge('b1', 'loop-root', 'loop-a'),
  edge('b2', 'loop-root', 'loop-b'),
  edge('b3', 'loop-a', 'loop-root'),
]);

const variableNodes = [
  story('variable-root', '累计', '获得分数。', { isRoot: true, nodeValue: 2 }),
  condition('truth-check', 5, [{ id: 'low', min: 0, max: 4 }]),
  story('bad-ending', '普通结局', '还不够。'),
  story('true-ending', '真结局', '抵达真结局。'),
  story('fallback-ending', '回退结局', '回退。'),
];
const variableEdges = [
  edge('v1', 'variable-root', 'truth-check'),
  edge('v2', 'truth-check', 'bad-ending', 'out-range-low'),
  edge('v3', 'truth-check', 'true-ending', 'out-greater'),
  edge('v4', 'truth-check', 'fallback-ending', 'out-less-equal'),
];
const variableSettings = normalizeRenpyExportSettings(variableNodes);
variableSettings.nodes['variable-root'] = {
  variableChanges: [{ variableId: 'gw_score', operation: 'add', value: 5 }],
};
variableSettings.conditions['truth-check'] = { variableId: 'gw_score' };
variableSettings.splitMode = 'background';
const variableResult = await verifyZip(
  'variable-truth-ending',
  variableNodes,
  variableEdges,
  variableSettings,
);
assert(
  variableResult.sceneSource.includes('$ gw_score += 5'),
  'variable-truth-ending: variable change missing',
);
assert(
  variableResult.sceneSource.includes('0 <= gw_score <= 4'),
  'variable-truth-ending: interval condition missing',
);
assert(
  variableResult.sceneSource.includes('gw_score >= 5'),
  'variable-truth-ending: threshold condition missing',
);

process.stdout.write(
  'RenPy verification passed: single line, branch loop, and variable truth-ending ZIPs.\n',
);
