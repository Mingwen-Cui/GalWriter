import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  buildArchivePageElements,
  buildSettingsPageElements,
  resolveArchivePageElements,
  resolveSettingsPageElements,
} from '../src/components/render/web/webMenuPageElements';
import { webShapeMarkup } from '../src/components/render/web/webShapes';

test('settings migrate only the complete untouched previous grid', () => {
  const positions: Record<string, number[]> = {
    title: [8, 16, 48, 10],
    back: [8, 29, 14, 7],
    mode: [8, 42, 26, 11],
    speed: [8, 56, 26, 15],
    textSize: [8, 74, 26, 15],
    preview: [8, 91, 26, 8],
    auto: [38, 42, 26, 11],
    animationSpeed: [38, 56, 26, 15],
    sound: [38, 74, 26, 11],
    controls: [38, 88, 26, 8],
    reset: [72, 88, 16, 8],
  };
  const previous = buildSettingsPageElements('zh', '#625bf6', '#fff')
    .filter((element) => positions[element.role || ''])
    .map((element) => {
      const [x, y, width, height] = positions[element.role!];
      return {
        ...element,
        x,
        y,
        width,
        height,
        text: element.role === 'speed' ? '打字间隔' : element.text,
      };
    });
  const migrated = resolveSettingsPageElements(
    { settingsPageElements: previous, settingsPageElementsInitialized: true },
    'zh',
    '#625bf6',
    '#fff',
  );
  assert.equal(migrated.find((element) => element.role === 'speed')?.text, '文字速度');
  assert.equal(migrated.find((element) => element.role === 'preview')?.width, 56);
  assert.equal(migrated.find((element) => element.id === 'settings-panel')?.kind, 'shape');
  const authored = previous.map((element) =>
    element.role === 'mode' ? { ...element, x: element.x + 1 } : element,
  );
  assert.equal(
    resolveSettingsPageElements(
      { settingsPageElements: authored, settingsPageElementsInitialized: true },
      'zh',
      '#625bf6',
      '#fff',
    ),
    authored,
  );
  assert.deepEqual(
    resolveSettingsPageElements(
      { settingsPageElements: [], settingsPageElementsInitialized: true },
      'zh',
      '#625bf6',
      '#fff',
    ),
    [],
  );
});

test('archive migrates the previous default without overwriting a moved layout', () => {
  const positions: Record<string, number[]> = {
    'archive-title': [8, 16, 30, 10],
    'archive-subtitle': [8, 28, 30, 5],
    'archive-back': [8, 35, 14, 7],
    'archive-slot': [8, 45, 30, 13],
    'archive-slot-continue': [8, 60, 20, 7],
    'archive-slot-delete': [30, 60, 8, 7],
    'archive-new': [8, 70, 30, 9],
  };
  const previous = buildArchivePageElements('zh', '#625bf6', '#fff')
    .filter((element) => positions[element.id])
    .map((element) => {
      const [x, y, width, height] = positions[element.id];
      return { ...element, x, y, width, height };
    });
  const migrated = resolveArchivePageElements(
    { archivePageElements: previous },
    'zh',
    '#625bf6',
    '#fff',
  );
  assert.equal(migrated.find((element) => element.id === 'archive-panel')?.kind, 'shape');
  assert.equal(migrated.find((element) => element.role === 'slot')?.width, 56);
  const authored = previous.map((element) =>
    element.role === 'slot' ? { ...element, width: 40 } : element,
  );
  assert.equal(
    resolveArchivePageElements({ archivePageElements: authored }, 'zh', '#625bf6', '#fff'),
    authored,
  );
});

test('shapes preserve layered paint when serialized into the offline player', () => {
  const element = buildSettingsPageElements('zh', '#625bf6', '#fff')[0];
  const compiled = ts.transpileModule(
    readFileSync(new URL('../src/components/render/web/webShapes.ts', import.meta.url), 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const compiledShape = new Function('exports', compiled + '; return exports.webShapeMarkup;')(
    {},
  ) as typeof webShapeMarkup;
  const serialized = new Function(
    `return (${compiledShape.toString()})`,
  )() as typeof webShapeMarkup;
  for (const shapeType of ['rectangle', 'rounded', 'ellipse', 'triangle', 'line'] as const) {
    const shape = {
      ...element,
      shapeType,
      appearance: {
        fills: [
          {
            id: 'test-fill',
            enabled: true,
            opacity: 75,
            type: 'gradient' as const,
            color: '#625bf6',
            gradientStart: '#625bf6',
            gradientEnd: '#c7d2fe',
            gradientAngle: 135,
            imageUrl: '',
            videoUrl: '',
            videoLoop: true,
            videoMuted: true,
            videoFit: 'crop' as const,
          },
        ],
        strokes: [
          {
            id: 'test-outline',
            enabled: true,
            color: '#4338ca',
            width: 3,
            position: 'inside' as const,
          },
        ],
        shadows: [],
      },
    };
    assert.equal(serialized(shape), webShapeMarkup(shape));
    assert.match(webShapeMarkup(shape), /linearGradient/);
    assert.match(webShapeMarkup(shape), /opacity="0.75"/);
    assert.match(webShapeMarkup(shape), /stroke-width="3"/);
  }
});

test('rectangle responds to unified and independent corner radii', () => {
  const rectangle = {
    ...buildSettingsPageElements('zh', '#625bf6', '#fff')[0],
    shapeType: 'rectangle' as const,
    width: 20,
    height: 20,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#625bf6',
  };
  assert.match(webShapeMarkup(rectangle), /rx="32"/);
  assert.match(webShapeMarkup(rectangle), /rx="31"/);
  assert.match(webShapeMarkup({ ...rectangle, borderRadius: 0 }), /rx="0"/);
  const corners = webShapeMarkup({
    ...rectangle,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 40,
  });
  assert.match(corners, /M 10 0 H 364 Q 384 0 384 20 V 186 Q 384 216 354 216 H 40/);
  assert.doesNotMatch(webShapeMarkup({ ...rectangle, borderRadius: -10 }), /rx="-/);
});
