import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import type { PptObjectAnimation } from '../src/components/render/video/shared/types';
import { filterPptDisabledAnimations } from '../src/components/render/ppt/pptAnimationReset';
import {
  deletePptTimelineAnimations,
  movePptTimelineAnimations,
  pptTimelineStarts,
  savePptTimelineOverrides,
} from '../src/components/render/ppt/pptTimelineEdits';
import { finalizePptxForPowerPoint } from '../src/components/render/ppt/pptxCompatibility';

const timeline: PptObjectAnimation[] = (['enter', 'emphasis', 'exit'] as const).map(
  (phase, index) => ({
    id: phase,
    target: 'cover-description',
    phase,
    source: 'manual',
    effect: 'line',
    start: index === 0 ? 'withPrevious' : 'afterPrevious',
    durationMs: 500,
    delayMs: 0,
    direction: 'left',
  }),
);

test('group drag moves all three phases equally without multiplying their delay', () => {
  const moved = movePptTimelineAnimations(
    timeline,
    timeline.map((item) => item.id),
    1200,
  );
  assert.deepEqual(pptTimelineStarts(moved), [1200, 1700, 2200]);
  assert.deepEqual(
    moved.map((item) => item.delayMs),
    [1200, 0, 0],
  );
  const left = movePptTimelineAnimations(
    moved,
    moved.map((item) => item.id),
    -2000,
  );
  assert.deepEqual(pptTimelineStarts(left), [0, 500, 1000]);
  assert.ok(left.every((item) => item.delayMs >= 0));
});

test('drag absorbs gaps of unselected tracks and keeps untouched tracks where possible', () => {
  const spaced = timeline.map((item, index) => ({ ...item, delayMs: index === 1 ? 2000 : 0 }));
  const moved = movePptTimelineAnimations(spaced, ['enter'], 800);
  assert.deepEqual(pptTimelineStarts(moved), [800, 2500, 3000]);
  assert.deepEqual(
    moved.map((item) => item.delayMs),
    [800, 1200, 0],
  );
});

test('single and batch deletion suppress persisted and projected phases on reopen', () => {
  const tag = { ...timeline[1], source: 'tag' as const };
  const saved = deletePptTimelineAnimations(
    timeline.filter((item) => item.id !== tag.id),
    [tag],
  );
  assert.deepEqual(
    filterPptDisabledAnimations(timeline, saved).map((item) => item.phase),
    ['enter', 'exit'],
  );
  const allDeleted = deletePptTimelineAnimations(saved, [timeline[0], timeline[2]]);
  assert.equal(filterPptDisabledAnimations(timeline, allDeleted).length, 0);
  assert.ok(allDeleted.every((item) => item.effect === 'none' && item.source === 'manual'));
});

test('group drag and deleted phases are reflected in native PowerPoint timing XML', async () => {
  const Constructor = (PptxGenJS as unknown as { default?: typeof PptxGenJS }).default || PptxGenJS;
  const pptx = new Constructor();
  const slide = pptx.addSlide();
  slide.addText('Cover description', { objectName: 'ppt-cover-description' });
  const moved = movePptTimelineAnimations(
    timeline,
    timeline.map((item) => item.id),
    1200,
  );
  const saved = deletePptTimelineAnimations(savePptTimelineOverrides([], moved), [moved[2]]);
  const buffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  const output = await finalizePptxForPowerPoint(
    buffer,
    saved.map((animation) => ({ slideNumber: 1, objectName: 'ppt-cover-description', animation })),
  );
  const zip = await JSZip.loadAsync(output);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(xml, /<p:cond delay="1200"\/>/);
  assert.equal((xml.match(/presetClass="entr"/g) || []).length, 1);
  assert.equal((xml.match(/presetClass="emph"/g) || []).length, 1);
  assert.equal((xml.match(/presetClass="exit"/g) || []).length, 0);
  assert.equal((xml.match(/<p:animMotion /g) || []).length, 2);
});
