import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { test } from 'node:test';
import { placementGeometry } from '../src/components/render/web/webElementPlacement';
import {
  constrainWebShapeSize,
  webShapeCatalog,
  webShapeCornerRadiusPatch,
  webShapeMarkup,
  webShapeVertices,
} from '../src/components/render/web/webShapes';
import type { WebMenuElement } from '../src/components/render/video/shared/types';

const shape: WebMenuElement = {
  id: 'geometry',
  kind: 'shape',
  shapeType: 'polygon',
  polygonSides: 3,
  role: 'custom',
  text: '',
  visible: true,
  x: 30,
  y: 20,
  width: 30,
  height: 30,
  scale: 1,
  rotation: 0,
  borderRadius: 0,
};
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);

test('dragging one radius handle updates all corners to the same value', () => {
  const square = webShapeCornerRadiusPatch(
    { ...shape, shapeType: 'rectangle', borderTopLeftRadius: 12, borderTopRightRadius: 1 },
    24,
  );
  assert.deepEqual(
    [
      square.borderTopLeftRadius,
      square.borderTopRightRadius,
      square.borderBottomRightRadius,
      square.borderBottomLeftRadius,
    ],
    [24, 24, 24, 24],
  );
  for (const polygonSides of [3, 5, 12]) {
    const polygon = webShapeCornerRadiusPatch(
      { ...shape, polygonSides, polygonCornerRadii: [1, 2, 3] },
      18,
    );
    assert.deepEqual(polygon.polygonCornerRadii, Array(polygonSides).fill(18));
    assert.equal(polygon.borderRadius, 18);
  }
});

test('placement follows the cursor center and keeps square/equilateral proportions on a wide canvas', () => {
  for (const end of [null, { x: 70, y: 62 }, { x: 20, y: 10 }]) {
    for (const shapeType of ['rectangle', 'ellipse', 'polygon'] as const) {
      const geometry = placementGeometry(
        { kind: 'shape', shapeType },
        { x: 50, y: 40 },
        end,
        1920,
        1080,
      );
      near(geometry.x + geometry.width / 2, 50);
      near(geometry.y + geometry.height / 2, 40);
      near(
        (geometry.height * 1080) / (geometry.width * 1920),
        shapeType === 'polygon' ? Math.sqrt(3) / 2 : 1,
      );
    }
  }
});

test('two-point line geometry retains both exact endpoints after rotation', () => {
  for (const end of [
    { x: 80, y: 75 },
    { x: 10, y: 15 },
    { x: 35, y: 80 },
  ]) {
    const start = { x: 35, y: 25 };
    const line = placementGeometry({ kind: 'shape', shapeType: 'line' }, start, end, 1920, 1080);
    const radians = (line.rotation! * Math.PI) / 180;
    const half = (line.width * 1920) / 200;
    const cx = ((line.x + line.width / 2) * 1920) / 100,
      cy = ((line.y + line.height / 2) * 1080) / 100;
    near(cx - Math.cos(radians) * half, (start.x * 1920) / 100);
    near(cy - Math.sin(radians) * half, (start.y * 1080) / 100);
    near(cx + Math.cos(radians) * half, (end.x * 1920) / 100);
    near(cy + Math.sin(radians) * half, (end.y * 1080) / 100);
  }
});

test('polygon vertices remain regular in differently shaped bounding boxes', () => {
  for (const count of [3, 4, 5, 6, 12, 60]) {
    const vertices = webShapeVertices({ ...shape, polygonSides: count }, 500, 180);
    const lengths = vertices.map((point, index) => {
      const next = vertices[(index + 1) % count];
      return Math.hypot(point.x - next.x, point.y - next.y);
    });
    lengths.forEach((length) => near(length, lengths[0]));
  }
});

test('independent polygon roundings create true arcs and export without external dependencies', () => {
  const rounded = { ...shape, polygonSides: 5, polygonCornerRadii: [18, 0, 0, 0, 0] };
  const markup = webShapeMarkup(rounded, 1920, 1080);
  assert.equal((markup.match(/A /g) || []).length, 1);
  assert.ok(!markup.includes('NaN') && !markup.includes('Infinity'));
  // Compile without tsx's function-name instrumentation, as the production bundle does.
  const { code } = transformSync(
    readFileSync(new URL('../src/components/render/web/webShapes.ts', import.meta.url), 'utf8'),
    { loader: 'ts', format: 'cjs', keepNames: false },
  );
  const compiled = { exports: {} as { webShapeMarkup?: typeof webShapeMarkup } };
  new Function('module', 'exports', code)(compiled, compiled.exports);
  const serialized = new Function(`return (${compiled.exports.webShapeMarkup!.toString()})`)();
  assert.equal(serialized(rounded, 1920, 1080), markup);
  assert.ok(
    webShapeMarkup({ ...rounded, polygonCornerRadii: [9999, 9999, 9999, 9999, 9999] }).includes(
      '<path',
    ),
  );
});

test('shape resizing keeps its ratio and opposite corner, while legacy shapes remain available', () => {
  const square = {
    ...shape,
    shapeType: 'rectangle' as const,
    width: 20,
    height: (20 * 1920) / 1080,
  };
  const patch = constrainWebShapeSize(square, { width: 30, height: 10 }, 1920, 1080, 'nw');
  near(patch.width! * 1920, patch.height! * 1080);
  near(patch.x! + patch.width!, square.x + square.width);
  near(patch.y! + patch.height!, square.y + square.height);
  const fullPatch = constrainWebShapeSize(
    square,
    { ...square, width: 30, height: 10 },
    1920,
    1080,
    'nw',
  );
  near(fullPatch.x! + fullPatch.width!, square.x + square.width);
  near(fullPatch.y! + fullPatch.height!, square.y + square.height);
  assert.deepEqual(
    webShapeCatalog('zh').map((item) => item.type),
    ['rectangle', 'ellipse', 'polygon', 'line'],
  );
  assert.ok(webShapeMarkup({ ...shape, shapeType: 'rounded', borderRadius: 18 }).includes('<rect'));
  assert.ok(webShapeMarkup({ ...shape, shapeType: 'triangle' }).includes('<path'));
});
