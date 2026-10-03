import assert from 'node:assert/strict';
import test from 'node:test';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import {
  createPptShape,
  constrainPptShape,
  addPptShape,
} from '../src/components/render/ppt/pptShapes';
import {
  toPptManualElementPatch,
  toPptWebInspectorElement,
} from '../src/components/render/ppt/pptWebInspectorAdapter';
import { placementGeometry } from '../src/components/render/web/webElementPlacement';
import {
  clearPptObjectAnimations,
  filterPptDisabledAnimations,
} from '../src/components/render/ppt/pptAnimationReset';
import type { PptObjectAnimation } from '../src/components/render/video/shared/types';

test('PPT side-count and corner updates persist through the Web inspector adapter', () => {
  const shape = createPptShape(
    'polygon',
    placementGeometry({ kind: 'shape', shapeType: 'polygon' }, { x: 50, y: 50 }, null, 1920, 1080),
  );
  const patch = toPptManualElementPatch(shape, {
    polygonSides: 6,
    borderRadius: 24,
    polygonCornerRadii: Array(6).fill(24),
  });
  const result = { ...shape, ...constrainPptShape(shape, patch, 1080), kind: 'shape' as const };
  assert.equal(result.webStyle?.polygonSides, 6);
  assert.deepEqual(result.webStyle?.polygonCornerRadii, Array(6).fill(24));
  assert.ok(Math.abs(result.height / result.width - 2 / Math.sqrt(3)) < 0.01);
  assert.equal(toPptWebInspectorElement(result).polygonSides, 6);
});

test('PPT normalized coordinates keep circles round on wide and standard slides', () => {
  for (const canvasHeight of [1080, 1440]) {
    const shape = createPptShape(
      'ellipse',
      placementGeometry(
        { kind: 'shape', shapeType: 'ellipse' },
        { x: 50, y: 50 },
        null,
        1920,
        canvasHeight,
      ),
    );
    assert.ok(Math.abs(shape.width - (shape.height * canvasHeight) / 1080) < 1e-8);
    const patch = constrainPptShape(shape, { width: 300 }, canvasHeight);
    assert.ok(Math.abs(patch.width! - (patch.height! * canvasHeight) / 1080) < 1);
  }
});

test('rounded polygon export embeds the shared vector and links it from slide XML', async () => {
  const Constructor = (PptxGenJS as unknown as { default?: typeof PptxGenJS }).default || PptxGenJS;
  const ppt = new Constructor();
  const slide = ppt.addSlide();
  const shape = createPptShape('polygon', { x: 25, y: 25, width: 20, height: 30, rotation: 30 });
  shape.webStyle = {
    ...shape.webStyle,
    polygonSides: 5,
    borderRadius: 24,
    polygonCornerRadii: Array(5).fill(24),
  };
  addPptShape(slide, shape, { x: 2, y: 2, w: 2, h: 3 }, 1080);
  const buffer = await ppt.write({ outputType: 'nodebuffer' });
  const zip = await JSZip.loadAsync(buffer as Buffer);
  const svgs = Object.keys(zip.files).filter((name) => name.endsWith('.svg'));
  assert.equal(svgs.length, 1);
  assert.match(await zip.file(svgs[0])!.async('string'), /A 24/);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(xml, /svgBlip/);
  assert.match(xml, new RegExp(shape.id));
  assert.match(xml, /rot="1800000"/);
});

test('No animation suppresses projected effects while preserving other objects', () => {
  const effects: PptObjectAnimation[] = [
    {
      id: 'actor',
      target: 'character',
      targetId: 'actor',
      phase: 'enter',
      effect: 'line',
      source: 'tag',
      start: 'withPrevious',
      durationMs: 500,
    },
    {
      id: 'title',
      target: 'dialog-title',
      phase: 'enter',
      effect: 'fade',
      start: 'withPrevious',
      durationMs: 500,
    },
  ];
  const cleared = clearPptObjectAnimations(
    effects.filter((item) => item.source !== 'tag'),
    'slide',
    'character',
    'actor',
  );
  assert.equal(cleared.filter((item) => item.effect === 'none').length, 3);
  assert.deepEqual(
    filterPptDisabledAnimations(effects, cleared).map((item) => item.id),
    ['title'],
  );
});
