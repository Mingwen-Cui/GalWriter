import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultWebFlowView, normalizeWebFlowView } from '../src/components/render/web/webFlowView';
import { resizeFlowRegion, WebFlowRegion } from '../src/components/render/web/WebFlowRegion';
import { WebFlowViewInspector } from '../src/components/render/web/WebFlowViewInspector';
import type { WebExportSettings } from '../src/components/render/video/shared/types';
import { readWebTemplateFile } from '../src/components/render/web/webTemplateFiles';
import { splitWebExperienceTemplate } from '../src/components/render/web/webTemplateBundle';
import { buildFlowOverviewHomeElement, buildRehearsalFlowPageElements, buildRehearsalToolbarElements } from '../src/components/render/web/webExperienceTemplates';
import { decorateWebPageElements } from '../src/components/render/web/webThemeVisuals';

test('flow Home keeps the dialogue button diameter and remains circular after theming', () => {
  for (const [width, height] of [[1920, 1080], [1080, 1920], [1080, 1080]]) {
    const home = buildFlowOverviewHomeElement(width, height);
    const dialogueHome = buildRehearsalToolbarElements('zh', width, height).find(
      (element) => element.role === 'mainMenu',
    )!;
    assert.equal(home.height, dialogueHome.height);
    assert.equal(home.width, dialogueHome.width);
    assert.ok(Math.abs(home.width * width - home.height * height) < 0.001);
    assert.equal(home.x, 2);
    assert.equal(home.y, 2.4);
    assert.equal(home.textVisible, false);
    assert.ok(decorateWebPageElements([home])[0].borderRadius! >= 999);
  }
  assert.equal(buildRehearsalFlowPageElements('zh').filter((element) => element.role === 'mainMenu').length, 1);
});

test('the transparent region moves and resizes from every edge without leaving the canvas', () => {
  const initial = { ...defaultWebFlowView, x: 10, y: 15, width: 60, height: 50 };
  assert.deepEqual(resizeFlowRegion(initial, 'move', 90, -90), { ...initial, x: 40, y: 0 });
  const resized = resizeFlowRegion(initial, 'nw', 20, 10);
  assert.deepEqual([resized.x, resized.y, resized.width, resized.height], [30, 25, 40, 40]);
  const smallest = resizeFlowRegion(initial, 'se', -100, -100);
  assert.deepEqual([smallest.x, smallest.y, smallest.width, smallest.height], [10, 15, 5, 5]);
  assert.equal(normalizeWebFlowView({ ...initial, width: Infinity }).width, 90);
});

test('the range background is editor-only and the direction panel has no number inputs or reset button', () => {
  const render = (editable: boolean) =>
    renderToStaticMarkup(
      createElement(WebFlowRegion, {
        editable,
        selected: true,
        language: 'zh',
        onSelect() {},
        onChange() {},
        children: createElement('span', {}, 'graph'),
      }),
    );
  assert.match(render(true), /data-flow-region-background/);
  assert.match(render(true), /data-flow-region-handle="se"/);
  assert.doesNotMatch(render(false), /data-flow-region-background|data-flow-region-handle/);
  assert.match(render(false), /graph/);
  const panel = renderToStaticMarkup(
    createElement(WebFlowViewInspector, {
      settings: { flowOverviewLayoutDirection: 'right' } as WebExportSettings,
      language: 'zh',
      onChange() {},
    }),
  );
  assert.doesNotMatch(panel, /<input|重置|显示切换方向|显示适应流程图/);
});

test('split ZIP preserves flow direction, clipping region, hidden controls and bundled images', async () => {
  const region = { ...defaultWebFlowView, x: 8, y: 22, width: 80, height: 68 };
  const template = {
    settings: {
      canvasWidth: 1600,
      canvasHeight: 900,
      startMenuElements: [],
      flowOverviewView: region,
      flowOverviewLayoutDirection: 'left',
      flowOverviewElements: [
        {
          id: 'flow-minimap',
          kind: 'button',
          role: 'flowMinimap',
          x: 80,
          y: 75,
          width: 18,
          height: 20,
          textColor: '#730000',
        },
      ],
      flowOverviewBackgroundImageUrl: '../assets/image-1.png',
      flowOverviewControlsInitialized: true,
      surfaceAppearances: { flow: { fills: [{ imageUrl: 'assets/image-1.png' }] } },
    },
    choiceColor: '#625bf6',
  };
  const bundle = splitWebExperienceTemplate(template)!;
  assert.equal(bundle.manifest.pages.flow, 'pages/flow.json');
  const zip = new JSZip();
  zip.file('template.json', JSON.stringify(bundle.manifest));
  for (const [page, value] of Object.entries(bundle.pages))
    zip.file(`pages/${page}.json`, JSON.stringify(value));
  zip.file('assets/image-1.png', new Uint8Array([1, 2, 3]));
  const bytes = await zip.generateAsync({ type: 'arraybuffer' });
  const restored = await readWebTemplateFile({
    name: 'design.zip',
    arrayBuffer: async () => bytes,
    text: async () => '',
  });
  assert.deepEqual(restored.settings.flowOverviewView, region);
  assert.equal(restored.settings.flowOverviewLayoutDirection, 'left');
  assert.equal(restored.settings.canvasWidth, 1600);
  assert.equal(restored.settings.flowOverviewElements?.[0].textColor, '#730000');
  assert.equal(restored.settings.flowOverviewBackgroundImageUrl, 'data:image/png;base64,AQID');
  assert.equal(
    restored.settings.surfaceAppearances?.flow?.fills[0].imageUrl,
    'data:image/png;base64,AQID',
  );
});

test('single-page JSON can restore a flow design, while malformed canvas files are rejected', async () => {
  const value = {
    surface: 'flow',
    settings: { flowOverviewView: { ...defaultWebFlowView, width: 75 } },
  };
  const restored = await readWebTemplateFile({
    name: 'flow.json',
    text: async () => JSON.stringify(value),
    arrayBuffer: async () => new ArrayBuffer(0),
  });
  assert.equal(restored.surface, 'flow');
  assert.deepEqual(restored.settings, value.settings);
  await assert.rejects(
    readWebTemplateFile({
      name: 'bad.json',
      text: async () => JSON.stringify({ settings: { flowOverviewElements: [{ id: 'invalid' }] } }),
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
  );
});
