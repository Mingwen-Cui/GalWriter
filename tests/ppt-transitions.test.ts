import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import type { PptSlideTransition } from '../src/components/render/video/shared/types';
import { normalizePptTransition } from '../src/components/render/ppt/pptTransitions';
import { finalizePptxForPowerPoint } from '../src/components/render/ppt/pptxCompatibility';

const base: PptSlideTransition = {
  effect: 'none',
  direction: 'left',
  durationMs: 700,
  advanceOnClick: false,
  advanceAfterMs: 2500,
};

test('old direction settings keep their axis and reject unsupported reveal directions', () => {
  assert.equal(
    normalizePptTransition({ ...base, effect: 'randomBars', direction: 'up' }).orientation,
    'vertical',
  );
  assert.equal(
    normalizePptTransition({ ...base, effect: 'split', direction: 'right' }).orientation,
    'horizontal',
  );
  assert.equal(
    normalizePptTransition({ ...base, effect: 'reveal', direction: 'down' }).direction,
    'left',
  );
});

test('PowerPoint package contains native transitions for every allowed option, before animation timing', async () => {
  const cases: Array<[Partial<PptSlideTransition>, string]> = [
    [{ effect: 'none' }, ''],
    [{ effect: 'smooth' }, '<p159:morph option="byObject"/>'],
    [{ effect: 'fade' }, '<p:fade/>'],
    [{ effect: 'cut' }, '<p:cut/>'],
    ...(['push', 'wipe'] as const).flatMap((effect) =>
      (['left', 'right', 'up', 'down'] as const).map(
        (direction): [Partial<PptSlideTransition>, string] => [
          { effect, direction },
          `<p:${effect} dir="${{ left: 'r', right: 'l', up: 'd', down: 'u' }[direction]}"/>`,
        ],
      ),
    ),
    ...(['horizontal', 'vertical'] as const).flatMap((orientation) =>
      (['in', 'out'] as const).map((splitDirection): [Partial<PptSlideTransition>, string] => [
        { effect: 'split', orientation, splitDirection },
        `<p:split orient="${orientation === 'horizontal' ? 'horz' : 'vert'}" dir="${splitDirection}"/>`,
      ]),
    ),
    [{ effect: 'randomBars', orientation: 'horizontal' }, '<p:randomBar dir="horz"/>'],
    [{ effect: 'randomBars', orientation: 'vertical' }, '<p:randomBar dir="vert"/>'],
    [{ effect: 'reveal', direction: 'left' }, '<p14:reveal dir="l" thruBlk="0"/>'],
    [{ effect: 'reveal', direction: 'right' }, '<p14:reveal dir="r" thruBlk="0"/>'],
  ];
  const Constructor = (PptxGenJS as unknown as { default?: typeof PptxGenJS }).default || PptxGenJS;
  const pptx = new Constructor();
  cases.forEach(() => pptx.addSlide().addText('Native transition', { objectName: 'target' }));
  const buffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  const output = await finalizePptxForPowerPoint(
    buffer,
    [
      {
        slideNumber: 1,
        objectName: 'target',
        animation: {
          id: 'test',
          target: 'cover-title',
          phase: 'enter',
          effect: 'line',
          start: 'withPrevious',
          durationMs: 500,
          delayMs: 0,
          direction: 'left',
        },
      },
    ],
    [],
    [],
    cases.map(([patch], index) => ({ slideNumber: index + 1, transition: { ...base, ...patch } })),
  );
  const zip = await JSZip.loadAsync(output);
  for (const [index, [patch, fragment]] of cases.entries()) {
    const xml = await zip.file(`ppt/slides/slide${index + 1}.xml`)!.async('string');
    assert.ok(
      xml.includes(fragment),
      `${patch.effect} ${patch.direction || patch.orientation || ''}`,
    );
    assert.ok(xml.includes('p14:dur="700"'));
    assert.ok(xml.includes('advClick="0" advTm="2500"'));
    assert.equal((xml.match(/<mc:AlternateContent /g) || []).length, 1);
    assert.ok(xml.indexOf('<mc:AlternateContent') > xml.indexOf('</p:cSld>'));
    if (index === 0) assert.ok(xml.indexOf('<mc:AlternateContent') < xml.indexOf('<p:timing>'));
    if (patch.effect === 'smooth' || patch.effect === 'reveal') {
      assert.ok(
        xml.includes('<mc:Fallback><p:transition spd="med" advClick="0" advTm="2500"><p:fade/>'),
      );
    }
  }
});
