import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import type { PptObjectAnimation } from '../src/components/render/video/shared/types';
import { filterPptDisabledAnimations } from '../src/components/render/ppt/pptAnimationReset';
import {
  canDeletePptTimelineAnimation,
  deletePptTimelineAnimations,
  movePptTimelineAnimations,
  pptTimelineMarqueeIds,
  pptTimelineStarts,
  resizePptTimelineAnimation,
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

test('marquee selects overlapping clips and excludes hidden or unrelated clips', () => {
  const clips = [
    { id: 'enter', left: 10, right: 90, top: 20, bottom: 40 },
    { id: 'emphasis', left: 40, right: 120, top: 50, bottom: 70 },
    { id: 'exit', left: 150, right: 230, top: 80, bottom: 100 },
    { id: 'hidden', left: 0, right: 0, top: 0, bottom: 0 },
  ];
  assert.deepEqual(pptTimelineMarqueeIds({ left: 20, right: 70, top: 10, bottom: 65 }, clips), [
    'enter',
    'emphasis',
  ]);
  assert.deepEqual(pptTimelineMarqueeIds({ left: 200, right: 220, top: 90, bottom: 110 }, clips), [
    'exit',
  ]);
});

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

test('right edge adjusts duration and linked following tracks within duration limits', () => {
  const resized = resizePptTimelineAnimation(timeline, 'enter', 'right', 750);
  assert.equal(resized[0].durationMs, 1250);
  assert.equal(resized[0].delayMs, 0);
  assert.deepEqual(pptTimelineStarts(resized), [0, 1250, 1750]);
  assert.equal(resizePptTimelineAnimation(timeline, 'enter', 'right', -2000)[0].durationMs, 100);
  assert.equal(resizePptTimelineAnimation(timeline, 'enter', 'right', 20000)[0].durationMs, 10000);
  assert.equal(timeline[0].durationMs, 500);
});

test('left edge keeps end fixed and cannot exceed delay or minimum duration', () => {
  const delayed = timeline.map((item, index) => ({ ...item, delayMs: index === 0 ? 700 : 0 }));
  const resized = resizePptTimelineAnimation(delayed, 'enter', 'left', 200);
  assert.equal(resized[0].durationMs, 300);
  assert.equal(resized[0].delayMs, 900);
  assert.deepEqual(pptTimelineStarts(resized), [900, 1200, 1700]);
  const extended = resizePptTimelineAnimation(delayed, 'enter', 'left', -2000);
  assert.equal(extended[0].delayMs, 0);
  assert.equal(extended[0].durationMs, 1200);
  const shortened = resizePptTimelineAnimation(delayed, 'enter', 'left', 2000);
  assert.equal(shortened[0].durationMs, 100);
  assert.equal(shortened[0].delayMs, 1100);
});

test('dialogue presets stay protected after timing overrides and mixed batch deletion', () => {
  const preset = {
    ...timeline[0],
    id: 'style:scene:dialog-body:typewriter',
    target: 'dialog-body' as const,
    source: 'tag' as const,
  };
  assert.equal(canDeletePptTimelineAnimation(preset), false);
  const saved = savePptTimelineOverrides([], [preset]);
  assert.equal(canDeletePptTimelineAnimation(saved[0]), false);
  assert.equal(
    canDeletePptTimelineAnimation({ ...preset, id: 'manual-dialogue', source: 'manual' }),
    true,
  );
  const deleted = deletePptTimelineAnimations(saved, [saved[0], timeline[0]]);
  assert.equal(deleted.find((item) => item.id === preset.id)?.effect, 'line');
  assert.equal(deleted.find((item) => item.id === timeline[0].id)?.effect, 'none');
});

test('resized duration and delay are saved into native PowerPoint timing', async () => {
  const Constructor = (PptxGenJS as unknown as { default?: typeof PptxGenJS }).default || PptxGenJS;
  const pptx = new Constructor();
  pptx.addSlide().addText('Cover description', { objectName: 'ppt-cover-description' });
  const moved = movePptTimelineAnimations([timeline[0]], ['enter'], 700);
  const resized = resizePptTimelineAnimation(moved, 'enter', 'left', -300);
  const saved = savePptTimelineOverrides(
    [],
    resizePptTimelineAnimation(resized, 'enter', 'right', 200),
  );
  const output = await finalizePptxForPowerPoint(
    (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer,
    saved.map((animation) => ({ slideNumber: 1, objectName: 'ppt-cover-description', animation })),
  );
  const zip = await JSZip.loadAsync(output);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(xml, /<p:cond delay="400"\/>/);
  assert.match(xml, /<p:cTn[^>]*dur="1000"/);
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
