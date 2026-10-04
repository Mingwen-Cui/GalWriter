import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { WebMenuElement } from '../src/components/render/video/shared/types';
import {
  buildSettingsPageElements,
  resolveSettingsPageElements,
} from '../src/components/render/web/webMenuPageElements';
import {
  decorateWebPageElements,
  webThemePalettes,
} from '../src/components/render/web/webThemeVisuals';
import {
  mountPlayerSettings,
  playerSettingsDescription,
  playerSettingsMarkup,
  PLAYER_SETTINGS_CSS,
  type PlayerSettingsValues,
} from '../src/components/render/web/playerSettingsPanel';
import { WebEditableElementFrame } from '../src/components/render/web/WebEditableElementFrame';
import { webAppearance } from '../src/components/render/shared/paint/appearance';
import { webShapeMarkup } from '../src/components/render/web/webShapes';

test('settings upgrade the previous built-in layout once while preserving edited copy and added objects', () => {
  const defaults = buildSettingsPageElements('zh', '#625bf6', '#fff');
  const previous = defaults
    .filter((element) => element.id !== 'settings-background')
    .map(({ settingsLayoutVersion: _, ...element }) => ({
      ...element,
      settingsLayoutVersion: 2,
      x: 20,
      width: 26,
      text: element.role === 'animationSpeed' ? '动画速度' : element.text,
      ...(element.role === 'sound'
        ? { settingsDescription: '自己的声音说明', visible: false, locked: true }
        : {}),
    }));
  const custom: WebMenuElement = {
    ...defaults[0],
    id: 'my-caption',
    role: 'custom',
    text: '保留我的文字',
    x: 3,
  };
  const settings = {
    settingsPageElementsInitialized: true,
    settingsPageElements: [...previous, custom],
  };
  const next = resolveSettingsPageElements(settings, 'zh', '#625bf6', '#fff');
  assert.equal(next.find((element) => element.role === 'speed')?.width, 30);
  assert.equal(next.find((element) => element.role === 'animationSpeed')?.text, '转场与动效速度');
  assert.equal(
    next.find((element) => element.role === 'sound')?.settingsDescription,
    '自己的声音说明',
  );
  assert.equal(next.find((element) => element.role === 'sound')?.visible, false);
  assert.equal(next.find((element) => element.role === 'sound')?.locked, true);
  assert.equal(next.find((element) => element.role === 'sound')?.borderRadius, 0);
  const preview = next.find((element) => element.role === 'preview')!;
  assert.equal(preview.width, 84);
  assert.ok(preview.y + preview.height < next.find((element) => element.role === 'mode')!.y);
  const background = next.find((element) => element.id === 'settings-background')!;
  assert.equal(background.kind, 'shape');
  assert.equal(background.backgroundType, 'gradient');
  assert.ok(background.zIndex! < (next.find((element) => element.role === 'mode')!.zIndex || 0));
  assert.equal(
    next.find((element) => element.id === custom.id),
    custom,
  );
  const authored = next.map((element) =>
    element.role === 'speed' ? { ...element, x: 12 } : element,
  );
  assert.equal(
    resolveSettingsPageElements(
      { ...settings, settingsPageElements: authored },
      'zh',
      '#625bf6',
      '#fff',
    ),
    authored,
  );
});

test('settings controls retain transparent shells across themes and reset matches the back button', () => {
  const elements = buildSettingsPageElements('zh', '#625bf6', '#fff');
  assert.equal(
    elements.some((element) => element.id === 'settings-panel'),
    false,
  );
  const back = elements.find((element) => element.role === 'back')!;
  const reset = elements.find((element) => element.role === 'reset')!;
  assert.ok(back.borderRadius! > 0);
  assert.equal(elements.find((element) => element.id === 'settings-background')?.borderRadius, 61);
  const squareVersion = elements.map((element) => ({
    ...element, settingsLayoutVersion: 4, x: element.x + 1,
    borderRadius: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
  }));
  const restored = resolveSettingsPageElements(
    { settingsPageElements: squareVersion, settingsPageElementsInitialized: true },
    'zh', '#625bf6', '#fff',
  );
  assert.equal(restored.find((element) => element.role === 'back')?.borderTopLeftRadius, back.borderRadius);
  assert.equal(restored.find((element) => element.role === 'back')?.x, back.x + 1);
  assert.equal(restored.find((element) => element.id === 'settings-background')?.borderRadius, 61);
  assert.match(playerSettingsMarkup('zh', {}, elements.find((element) => element.role === 'mode')), /--ps-radius:10px/);
  for (const key of [
    'fontSize',
    'textAlign',
    'backgroundType',
    'backgroundGradientStart',
    'backgroundGradientEnd',
    'borderColor',
    'borderRadius',
    'shadowOpacity',
  ] as const) {
    assert.equal(reset[key], back[key], key);
  }
  for (const theme of Object.values(webThemePalettes)) {
    for (const element of decorateWebPageElements(elements, theme).filter(
      (item) => item.kind === 'button' && !['back', 'reset'].includes(item.role || ''),
    )) {
      assert.equal(element.fillEnabled, false);
      assert.equal(element.strokeEnabled, false);
      assert.equal(element.shadowEnabled, false);
      assert.equal(element.borderRadius, 0);
    }
  }
  assert.doesNotMatch(playerSettingsMarkup('zh'), /gw-ps-motion/);
  assert.match(
    PLAYER_SETTINGS_CSS,
    /\.gw-ps-preview p \{[^}]*background:#111827; color:#f8fafc;[^}]*border-radius:22px/,
  );
  assert.notEqual(
    playerSettingsDescription('zh', { role: 'speed' }),
    playerSettingsDescription('zh', { role: 'animationSpeed' }),
  );
});

test('saved settings background adopts the requested gradient once without moving or unlocking authored objects', () => {
  const defaults = buildSettingsPageElements('zh', '#625bf6', '#fff');
  const background = defaults.find((element) => element.id === 'settings-background')!;
  const oldBackground = {
    ...background, settingsLayoutVersion: 5, x: 7, width: 87, locked: true,
    borderRadius: 0, borderTopLeftRadius: 0,
    appearance: webAppearance(background),
  };
  oldBackground.appearance.fills[0].gradientAngle = 155;
  oldBackground.appearance.fills[0].opacity = 50;
  const original = defaults.map((element) => element.id === background.id ? oldBackground : element);
  const migrated = resolveSettingsPageElements({ settingsPageElements: original, settingsPageElementsInitialized: true }, 'zh', '#625bf6', '#fff');
  const next = migrated.find((element) => element.id === background.id)!;
  assert.equal(next.x, 7);
  assert.equal(next.width, 87);
  assert.equal(next.locked, true);
  assert.equal(next.opacity, 100);
  assert.equal(next.borderRadius, 61);
  assert.equal(next.borderTopLeftRadius, 61);
  assert.equal(next.backgroundGradientAngle, 270);
  const fill = webAppearance(next).fills[0];
  assert.equal(fill.opacity, 100);
  assert.equal(fill.gradientShape, 'linear');
  assert.equal(fill.gradientAngle, 270);
  assert.deepEqual(fill.gradientStops?.map(({ color, alpha, position }) => ({ color, alpha, position })), [
    { color: '#ffffff', alpha: 80, position: 0 },
    { color: '#e8ecf8', alpha: 94, position: 100 },
  ]);
  assert.match(webShapeMarkup(next), /stop-opacity="0.8"/);
  assert.match(webShapeMarkup(next), /stop-opacity="0.94"/);
  assert.equal(original.find((element) => element.id === background.id)?.appearance?.fills[0].gradientAngle, 155);
  for (const theme of Object.values(webThemePalettes)) {
    const themed = decorateWebPageElements(defaults, theme).find((element) => element.id === background.id)!;
    assert.equal(themed.borderRadius, 61);
    assert.equal(themed.backgroundGradientAngle, 270);
    assert.equal(themed.backgroundGradientStops?.[0].alpha, 80);
  }
  const authored = migrated.map((element) => element.id === background.id ? { ...element, borderRadius: 40 } : element);
  assert.equal(resolveSettingsPageElements({ settingsPageElements: authored, settingsPageElementsInitialized: true }, 'zh', '#625bf6', '#fff'), authored);
});

test('serialized export controller preserves custom and empty descriptions without overriding the black preview, and reset still works', () => {
  const compiled = ts.transpileModule(
    readFileSync(
      new URL('../src/components/render/web/playerSettingsPanel.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    },
  ).outputText;
  const controller = new Function('exports', compiled + '; return exports.mountPlayerSettings;')(
    {},
  );
  const serialized = new Function(
    `return (${controller.toString()});`,
  )() as typeof mountPlayerSettings;
  const values: PlayerSettingsValues = {
    autoAdvance: false,
    interactionMode: 'immediate',
    typewriterSpeed: 80,
    textScale: 100,
    animationSpeed: 1,
    soundEnabled: true,
    controlsVisible: true,
  };
  const label = { dataset: {}, textContent: '' };
  const hint = { textContent: '' };
  const sample = {
    dataset: { sample: '试读文字' },
    textContent: '',
    style: {} as Record<string, string>,
  };
  const row = {
    dataset: { settingRole: 'sound', panelState: '' },
    hidden: false,
    querySelector: (selector: string) =>
      selector === '[data-role-label]' ? label : selector === '[data-role-hint]' ? hint : null,
    querySelectorAll: () => [],
  };
  const panel = {
    dataset: {},
    querySelector: (selector: string) => (selector === '[data-sample]' ? sample : null),
    querySelectorAll: (selector: string) => (selector === '[data-setting-role]' ? [row] : []),
  };
  const listeners = new Map<string, (event: unknown) => void>();
  const root = {
    querySelector: () => panel,
    addEventListener: (event: string, callback: (event: unknown) => void) =>
      listeners.set(event, callback),
    removeEventListener: (event: string) => listeners.delete(event),
  } as unknown as HTMLElement;
  const changes: Partial<PlayerSettingsValues>[] = [];
  for (const description of ['自己的说明 <b>原样保存</b>', '']) {
    const metadata = JSON.parse(
      JSON.stringify([{ role: 'sound', text: '声音', settingsDescription: description }]),
    );
    const mounted = serialized(
      root,
      values,
      { ...values, soundEnabled: false },
      (patch) => changes.push(patch),
      () => {},
      metadata,
      { panelColor: '#111827', bodyColor: '#fff', bodyFontSize: 32 },
    );
    assert.equal(hint.textContent, description);
    assert.equal(sample.textContent, '试读文字');
    assert.equal(sample.style.backgroundColor, undefined);
    assert.equal(sample.style.color, undefined);
    mounted.sync({ ...values, animationSpeed: 2 });
    assert.equal(sample.textContent, '试读文字');
    listeners.get('click')!({
      target: { closest: () => ({ disabled: false, dataset: { action: 'reset' } }) },
    });
    assert.equal(changes.at(-1)?.soundEnabled, false);
    mounted.destroy();
    assert.equal(listeners.size, 0);
  }
});

test('locked objects expose an unlock button and hide movement handles', () => {
  const noop = () => {};
  const props = {
    visible: true,
    onRotatePointerDown: noop,
    onToggleVisible: noop,
    onResizePointerDown: noop,
    onToggleLocked: noop,
  };
  const locked = renderToStaticMarkup(
    createElement(WebEditableElementFrame, { ...props, locked: true }),
  );
  assert.match(locked, /aria-label="解锁"/);
  assert.doesNotMatch(locked, /data-editable-frame-control="(?:rotate|resize)"/);
  const unlocked = renderToStaticMarkup(
    createElement(WebEditableElementFrame, { ...props, locked: false }),
  );
  assert.match(unlocked, /aria-label="锁定"/);
  assert.match(unlocked, /data-editable-frame-control="resize"/);
});
