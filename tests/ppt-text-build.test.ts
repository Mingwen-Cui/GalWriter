import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';

import type { PptObjectAnimation } from '../src/components/render/video/shared/types';
import { previewStyle } from '../src/components/render/ppt/pptAnimationPreview';
import {
  pptTextLinePreview,
  pptTextLineTiming,
  wrapPptTextLines,
} from '../src/components/render/ppt/pptTextBuild';
import { finalizePptxForPowerPoint } from '../src/components/render/ppt/pptxCompatibility';

const build: PptObjectAnimation = {
  id: 'text-build',
  target: 'manual-text',
  targetId: 'text-1',
  source: 'manual',
  phase: 'enter',
  effect: 'wipe',
  start: 'onClick',
  durationMs: 1800,
  delayMs: 200,
  direction: 'left',
  textBuild: { mode: 'line-wipe', lineGapMs: 150 },
};

test('ordinary text wraps into lines without losing empty paragraphs or unicode characters', () => {
  assert.deepEqual(
    wrapPptTextLines('甲乙丙丁\r\n\n🌕🌙', 2, (text) => Array.from(text).length),
    ['甲乙', '丙丁', '', '🌕🌙'],
  );
});

test('line reveals and pauses stay inside the authored duration, including short clips', () => {
  assert.deepEqual(pptTextLineTiming(build, 3, 1), { durationMs: 500, offsetMs: 650 });
  const last = pptTextLineTiming(build, 3, 2);
  assert.equal(last.offsetMs + last.durationMs, 1800);
  const short = pptTextLineTiming({ ...build, durationMs: 100 }, 3, 2);
  assert.equal(short.offsetMs + short.durationMs, 100);
});

test('line preview reveals one line at a time and ordinary motion remains independent', () => {
  assert.equal(pptTextLinePreview(build, 3, 0, 450).clipPath, 'inset(0 50% 0 0)');
  assert.equal(pptTextLinePreview(build, 3, 1, 450).clipPath, 'inset(0 100% 0 0)');
  assert.deepEqual(pptTextLinePreview(build, 3, 0), {});
  assert.equal(previewStyle([build], true, 0).animation, '');
  assert.match(
    String(previewStyle([{ ...build, effect: 'line', textBuild: undefined }], true).animation),
    /ppt-line-left/,
  );
});

test('native ordinary text builds target editable paragraphs, preserve click and delay, and use unique timing ids', async () => {
  const Constructor = (PptxGenJS as unknown as { default?: typeof PptxGenJS }).default || PptxGenJS;
  const pptx = new Constructor();
  const slide = pptx.addSlide();
  slide.addText('Other text', { objectName: 'other' });
  slide.addText('第一行\n第二行\n第三行', { objectName: 'ppt-manual-text-text-1' });
  slide.addText('封面标题', { objectName: 'ppt-cover-title' });
  const output = await finalizePptxForPowerPoint(
    (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer,
    [
      { slideNumber: 1, objectName: 'ppt-manual-text-text-1', animation: build },
      {
        slideNumber: 1,
        objectName: 'ppt-cover-title',
        animation: {
          ...build,
          id: 'cover',
          target: 'cover-title',
          effect: 'line',
          textBuild: undefined,
          start: 'afterPrevious',
        },
      },
    ],
  );
  const zip = await JSZip.loadAsync(output);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.equal((xml.match(/filter="wipe\(left\)"/g) || []).length, 3);
  for (let paragraph = 0; paragraph < 3; paragraph++)
    assert.match(xml, new RegExp(`<p:pRg st="${paragraph}" end="${paragraph}"/>`));
  assert.match(xml, /<p:cond delay="650"\/>/);
  assert.match(xml, /<p:cond delay="1300"\/>/);
  assert.match(xml, /<p:cond delay="200"\/>/);
  assert.match(xml, /nodeType="clickEffect"/);
  assert.match(xml, /<p:bldP spid="3" grpId="0" build="p" animBg="0"\/>/);
  assert.equal((xml.match(/<p:animMotion /g) || []).length, 1);
  const ids = [...xml.matchAll(/<p:cTn id="(\d+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(xml, /第一行/);
  assert.match(xml, /第三行/);
});
