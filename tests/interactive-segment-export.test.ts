import assert from 'node:assert/strict';
import test from 'node:test';

import { selectExportedInteractiveSegmentStructure } from '../src/components/render/video/interactive/InteractiveSegmentExportOrder';
import type { InteractiveSegmentDraft } from '../src/components/render/video/interactive/interactiveSegments';

const segment = (
  id: string,
  enabled: boolean,
  choices: InteractiveSegmentDraft['choices'] = [],
): InteractiveSegmentDraft => ({
  id,
  name: id,
  enabled,
  source: 'edited',
  nodeIds: [`node-${id}`],
  choices,
});

test('route map contains only successfully exported clips and links between them', () => {
  const segments = [
    segment('start', true, [
      { id: 'to-disabled', label: 'disabled', targetSegmentId: 'disabled', targetNodeId: 'n2' },
      { id: 'to-missing', label: 'missing', targetSegmentId: 'empty', targetNodeId: 'n3' },
      { id: 'to-next', label: 'next', targetSegmentId: 'next', targetNodeId: 'n4' },
    ]),
    segment('disabled', false),
    segment('empty', true),
    segment('next', true),
  ];

  const structure = selectExportedInteractiveSegmentStructure(
    segments,
    ['start', 'disabled', 'empty', 'next'],
    ['start', 'next'],
  );

  assert.deepEqual(
    structure.segments.map(({ id }) => id),
    ['start', 'next'],
  );
  assert.deepEqual(structure.exportOrderIds, ['start', 'next']);
  assert.deepEqual(
    structure.graphLinks.map(({ toSegmentId }) => toSegmentId),
    ['next'],
  );
});
