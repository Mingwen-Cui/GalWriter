import type { Edge, Node } from '@xyflow/react';
import JSZip from 'jszip';

import {
  buildCodeProjectPreview,
  buildCodeProjectZip,
} from '../src/components/render/code/codeExport/exportProject';
import { selectConditionHandle } from '../src/components/render/code/codeExport/ir/graphSemantics';
import { normalizeProjectToIr } from '../src/components/render/code/codeExport/ir/normalizeProjectToIr';
import { normalizeRenpyExportSettings } from '../src/components/render/code/codeExport/model';
import type { CodeExportTarget } from '../src/components/render/code/codeExport/targets/targetTypes';

const assert = (value: unknown, message: string): asserts value => {
  if (!value) throw new Error(message);
};
const story = (
  id: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Node => ({
  id,
  type: 'storyNode',
  position: { x: 0, y: 0 },
  data: { id, title, text: body, ...data },
});
const edge = (
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
  label?: string,
): Edge => ({ id, source, target, sourceHandle, data: label ? { label } : undefined });

const png = 'data:image/png;base64,iVBORw0KGgo=';
const audio = 'data:audio/ogg;base64,T2dnUwACAAAAAAAAAABVDxA=';
const video = 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibQ==';
const nodes: Node[] = [
  {
    id: 'character-alice',
    type: 'characterNode',
    position: { x: -200, y: 0 },
    data: {
      id: 'character-alice',
      characterName: '爱丽丝',
      avatarUrl: png,
      outfits: [{ id: 'smile', name: 'smile', imageUrl: png }],
    },
  },
  story('root', '屋顶', '<p>你真的要离开吗？</p>', {
    isRoot: true,
    imageUrl: png,
    audioUrl: audio,
    videoUrl: video,
    presentation: {
      characters: [
        {
          sourceNodeId: 'character-alice',
          outfitId: 'smile',
          position: 'left',
          enter: { type: 'fade', duration: 0.3 },
        },
      ],
    },
  }),
  story('truth-path', '说出真相', '我会告诉你一切。'),
  story('silent-loop', '沉默', '风吹过屋顶。'),
  {
    id: 'score-check',
    type: 'numberConditionNode',
    position: { x: 0, y: 0 },
    data: {
      id: 'score-check',
      title: '真结局判断',
      threshold: 5,
      ranges: [{ id: 'low', min: 0, max: 4 }],
    },
  },
  story('normal-end', '普通结局', '还不够。'),
  story('true-end', '真结局', '我们一起离开。'),
  story('fallback-end', '回退结局', '故事结束。'),
];
const edges: Edge[] = [
  edge('edge-truth', 'root', 'truth-path', undefined, '告诉她真相'),
  edge('edge-silent', 'root', 'silent-loop', undefined, '沉默离开'),
  edge('edge-to-condition', 'truth-path', 'score-check'),
  edge('edge-loop', 'silent-loop', 'root'),
  edge('edge-low', 'score-check', 'normal-end', 'out-range-low'),
  edge('edge-gte', 'score-check', 'true-end', 'out-greater'),
  edge('edge-fallback', 'score-check', 'fallback-end', 'out-less-equal'),
];
const settings = normalizeRenpyExportSettings(nodes);
settings.characters[0].codeName = 'alice';
settings.nodes.root = {
  speakerId: 'character-alice',
  expression: 'smile',
  variableChanges: [{ variableId: 'gw_score', operation: 'add', value: 5 }],
};
settings.conditions['score-check'] = {
  variableId: 'gw_score',
  threshold: 5,
  ranges: [{ id: 'low', min: 0, max: 4 }],
};

const normalizedA = normalizeProjectToIr(nodes, edges, 'multi-engine-fixture', settings);
const normalizedB = normalizeProjectToIr(nodes, edges, 'multi-engine-fixture', settings);
assert(
  JSON.stringify(normalizedA.ir) === JSON.stringify(normalizedB.ir),
  'IR normalization is not deterministic',
);
assert(normalizedA.ir.metadata.entryNodeId === 'root', 'IR entry is incorrect');
const rootBlock = normalizedA.ir.chapters
  .flatMap((chapter) => chapter.blocks)
  .find((block) => block.nodeId === 'root');
assert(
  rootBlock?.control.kind === 'choice' && rootBlock.control.options[0].edgeId === 'edge-truth',
  'IR choice/edge trace is missing',
);
const conditionBlock = normalizedA.ir.chapters
  .flatMap((chapter) => chapter.blocks)
  .find((block) => block.nodeId === 'score-check');
assert(
  conditionBlock?.control.kind === 'condition' &&
    conditionBlock.control.branches.some((branch) => branch.condition.kind === 'range'),
  'IR range condition is missing',
);
assert(
  selectConditionHandle(4, 5, [{ id: 'low', min: 0, max: 4 }]) === 'out-range-low',
  'Range condition semantics failed',
);
assert(
  selectConditionHandle(5, 5, [{ id: 'low', min: 0, max: 4 }]) === 'out-greater',
  '>= condition semantics failed',
);
assert(
  selectConditionHandle(-1, 5, [{ id: 'low', min: 0, max: 4 }]) === 'out-less-equal',
  'Fallback condition semantics failed',
);

const expected: Record<CodeExportTarget, { extensions: string[]; tokens: string[] }> = {
  renpy: {
    extensions: ['.rpy'],
    tokens: ['label gw_', 'menu:', '$ gw_score += 5', '0 <= gw_score <= 4'],
  },
  tyrano: {
    extensions: ['.ks'],
    tokens: [
      '*gw_',
      '[glink ',
      '[eval exp="f.gw_score += 5"]',
      '[if exp="(f.gw_score >= 0 && f.gw_score <= 4)"]',
    ],
  },
  dialogic: {
    extensions: ['.dtl'],
    tokens: [
      'label gw_',
      '- 告诉她真相',
      'set {gw_score} += 5',
      'if {gw_score} >= 0 and {gw_score} <= 4:',
    ],
  },
  'ir-json': {
    extensions: ['.json'],
    tokens: ['"format": "galwriter-story-ir"', '"edgeId": "edge-loop"', '"kind": "range"'],
  },
};

for (const target of ['renpy', 'tyrano', 'dialogic', 'ir-json'] as const) {
  const preview = buildCodeProjectPreview(nodes, edges, 'multi-engine-fixture', settings, target);
  assert(
    !preview.diagnostics.some((item) => item.level === 'error'),
    `${target}: blocking diagnostics: ${preview.diagnostics.map((item) => item.message).join('; ')}`,
  );
  const combinedPreview = preview.files.map((file) => file.content).join('\n');
  expected[target].tokens.forEach((token) =>
    assert(combinedPreview.includes(token), `${target}: missing snapshot token ${token}`),
  );
  const result = await buildCodeProjectZip(nodes, edges, 'multi-engine-fixture', settings, target);
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const paths = Object.keys(zip.files)
    .filter((path) => !zip.files[path].dir)
    .sort();
  assert(
    paths.some((path) => expected[target].extensions.some((extension) => path.endsWith(extension))),
    `${target}: target script file missing`,
  );
  assert(paths.includes('CODE_EXPORT_REPORT.md'), `${target}: report missing`);
  const manifestPath = paths.find((path) => path.endsWith('galwriter_manifest.json'));
  assert(manifestPath, `${target}: manifest missing`);
  const manifest = JSON.parse(
    await zip.file(manifestPath)!.async('string'),
  ) as typeof preview.manifest;
  assert(
    manifest.target === target && Object.keys(manifest.nodes).length === 7,
    `${target}: manifest node mapping is incomplete`,
  );
  Object.values(manifest.nodes).forEach((mapping) =>
    assert(paths.includes(mapping.file), `${target}: mapped file ${mapping.file} missing`),
  );
  manifest.assets
    .flatMap((asset) => asset.targetPaths)
    .forEach((path) =>
      assert(paths.includes(path), `${target}: materialized asset ${path} missing`),
    );
}

process.stdout.write(
  'Multi-engine verification passed: deterministic IR, shared conditions, RenPy, TyranoScript, Dialogic 2, and IR JSON.\n',
);
