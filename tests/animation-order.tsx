import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import JSZip from 'jszip';
import type { Node } from '@xyflow/react';
import { WebPlaytestPreview } from '../src/components/render/web/WebPlaytestPreview';
import { usePlaytestSettings } from '../src/editor-state/usePlaytestSettings';
import { PlayTestModal } from '../src/components/render/playtest/PlayTestModal';
import { DEFAULT_SHARED_CANVAS_SETTINGS } from '../src/components/render/canvas/canvasSettings';
import { DEFAULT_RENDER_STYLE } from '../src/components/render/video/VideoRenderModal/workspaceStorage';
import { buildInteractiveWebZipBlob } from '../src/components/render/web/webExport';
import {
  createCharacterPresentation,
  createScenePresentation,
  createInlinePresentationAction,
} from '../src/lib/presentation';
import type { PlayTestProps } from '../src/components/render/playtest/types';
import type { WebExportSettings } from '../src/components/render/video/shared/types';
import {
  DEFAULT_TYPEWRITER_INTERVAL_MS,
  migratePlaytestTypewriterSpeed,
  migratePlaytestTextPlayback,
} from '../src/lib/typewriterTiming';
import '../src/index.css';

const image = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="300"><rect x="10" width="100" height="300" fill="${color}"/></svg>`)}`;
const tag = (id: string) =>
  `<span data-mention-kind="character" data-mention-id="${id}" class="mention-chip">@actor</span>`;
const settings = {
  ...DEFAULT_SHARED_CANVAS_SETTINGS,
  canvasWidth: 960,
  canvasHeight: 540,
  showStartMenu: false,
  interactionMode: 'typewriter',
  typewriterSpeed: 80,
  animationSpeed: 1,
  hideCharacterTags: true,
  hideSceneTags: true,
  autoAdvance: false,
  textScale: 100,
  soundEnabled: false,
  previewToolbarElements: [],
  startMenuElements: [],
  archivePageElements: [],
  settingsPageElements: [],
  dialogueOverlayElements: [],
} as unknown as WebExportSettings;
const style = {
  ...DEFAULT_RENDER_STYLE,
  bodyAnimation: 'typewriter' as const,
  bodyTypewriterMode: 'character' as const,
};
const noop = () => {};
function fixture(
  type:
    | 'none'
    | 'slide-left'
    | 'slide-right'
    | 'slide-up'
    | 'slide-down'
    | 'fade'
    | 'zoom'
    | 'middle'
    | 'scene'
    | 'short',
) {
  const old = {
    ...createCharacterPresentation('old'),
    position: 'right' as const,
    enter: {
      type: type === 'middle' || type === 'scene' || type === 'short' ? 'none' : type,
      duration: 300,
    },
    exit: {
      type: type === 'middle' || type === 'scene' || type === 'short' ? 'none' : type,
      duration: 300,
    },
  };
  const young = {
    ...createCharacterPresentation('young'),
    position: 'left' as const,
    enter: { type: 'slide-right' as const, duration: 300 },
  };
  const enter = {
    ...createInlinePresentationAction({ id: 'old-enter', kind: 'character', sourceNodeId: 'old' }),
    timelinePhase: 'enter' as const,
    duration: 300,
  };
  const exit = { ...enter, id: 'old-exit', timelinePhase: 'exit' as const };
  return [
    {
      id: 'story',
      type: 'storyNode',
      position: { x: 0, y: 0 },
      data: {
        isRoot: true,
        title: '',
        text: `<p>AAA<br>${tag('old-enter')}BBB${tag('old-exit')}</p>`,
        imageUrl: image('#26374d'),
        presentation: { characters: [old, young], inlineActions: [enter, exit] },
      },
    },
    {
      id: 'old',
      type: 'characterNode',
      position: { x: 0, y: 0 },
      data: { characterName: 'old', avatarUrl: image('#ef4444') },
    },
    {
      id: 'young',
      type: 'characterNode',
      position: { x: 0, y: 0 },
      data: { characterName: 'young', avatarUrl: image('#3b82f6') },
    },
  ] as Node[];
}
const report = document.createElement('pre');
report.id = 'results';
document.body.append(report);
const host = document.getElementById('root')!;
Object.assign(host.style, { width: 'min(960px, 100%)', height: '540px', position: 'relative' });
const root = createRoot(host);
async function sample(doc: Document, scope: HTMLElement, label: string) {
  const trace: { text: string; hidden: boolean; moving: boolean; opacity: number }[] = [];
  const deadline = performance.now() + 3300;
  await new Promise<void>((resolve) => {
    const frame = () => {
      const actor = scope.querySelector<HTMLImageElement>('img[alt="old"]');
      if (actor) {
        const css = doc.defaultView!.getComputedStyle(actor);
        trace.push({
          text:
            scope.querySelector(
              '.typewriter-visible, [data-render-object="body"], [data-resolved-text="body"]',
            )?.textContent || '',
          hidden: css.visibility === 'hidden',
          moving: actor.getAnimations().some((animation) => animation.playState === 'running'),
          opacity: Number(css.opacity),
        });
      }
      if (performance.now() >= deadline) resolve();
      else requestAnimationFrame(frame);
    };
    frame();
  });
  const before = trace.filter((row) => !row.text.includes('AAA'));
  const entrance = trace.filter(
    (row) => row.text.includes('AAA') && !row.text.includes('B') && !row.hidden,
  );
  const second = trace.filter((row) => row.text.includes('BBB'));
  const checks = [
    [
      '文字逐字显示而非一次出现',
      trace.some((row) => /A(?!A)/.test(row.text) && !row.text.includes('AAA')) &&
        trace.some((row) => row.text.includes('AA') && !row.text.includes('AAA')),
    ],
    ['待入场人物开场隐藏', before.length > 0 && before.every((row) => row.hidden)],
    ['第一行结束后人物入场且移动', label.endsWith('/none') || entrance.some((row) => row.moving)],
    [
      '第二行只在入场结束后显示',
      second.length > 0 && trace.find((row) => row.text.includes('B'))?.opacity === 1,
    ],
    ['出场完成后保持隐藏', trace.at(-1)?.hidden === true],
  ];
  if (checks.some(([, pass]) => !pass))
    report.textContent +=
      'TRACE ' +
      label +
      ' ' +
      JSON.stringify(trace.filter((row) => row.text.includes('B')).slice(0, 8)) +
      '\n';
  for (const [name, pass] of checks)
    report.textContent += `${pass ? 'PASS' : 'FAIL'} ${label}: ${name}\n`;
}
async function sampleMiddle(doc: Document, scope: HTMLElement, label: string) {
  const rows: {
    marker: number;
    moving: boolean;
    rotate: string;
    opacity: number;
    filter: string;
    matrix: number[];
    anchorX: number;
    src: string;
    incoming: boolean;
  }[] = [];
  const deadline = performance.now() + 20000;
  await new Promise<void>((resolve) => {
    const frame = () => {
      const actor = scope.querySelector<HTMLImageElement>('img[alt="old"]');
      if (actor) {
        const css = doc.defaultView!.getComputedStyle(actor);
        const text =
          scope.querySelector(
            '.typewriter-visible, [data-render-object="body"], [data-resolved-text="body"]',
          )?.textContent || '';
        const markers = [...text.matchAll(/\|(\d+)\|/g)];
        const marker = markers.length ? Number(markers.at(-1)![1]) : -1;
        const matrix = new DOMMatrix(css.transform);
        rows.push({
          marker,
          moving: actor.getAnimations().some((animation) => animation.playState === 'running'),
          rotate: css.rotate,
          opacity: Number(css.opacity),
          filter: css.filter,
          matrix: [matrix.a, matrix.d, matrix.e, matrix.f],
          anchorX: parseFloat(css.width) / 2,
          src: actor.src,
          incoming: [...scope.querySelectorAll<HTMLImageElement>('img[alt=""]')].some(
            (img) =>
              img.src !== actor.src &&
              img.getAnimations().some((animation) => animation.playState === 'running'),
          ),
        });
      }
      if (rows.at(-1)?.marker === 12 || performance.now() >= deadline) resolve();
      else requestAnimationFrame(frame);
    };
    frame();
  });
  const final = rows.at(-1);
  const checks = [
    ['全部中场动作按文字顺序完成', final?.marker === 12],
    ...[0, 1, 2].map((marker) => {
      const state = rows.find((row) => row.marker === marker);

      return [
        `${['二维平移', '水平平移', '垂直平移'][marker]}到达设定位置`,
        Boolean(
          state &&
          Math.abs(state.matrix[2] + state.anchorX - (marker === 2 ? 0 : 24)) < 1 &&
          Math.abs(state.matrix[3] - (marker === 1 ? 0 : -16)) < 1,
        ),
      ] as const;
    }),
    ['缩放结束后仍保持放大', (final?.matrix[0] || 0) > 1.19],
    ['后续动作保留旋转', Math.abs(parseFloat(final?.rotate || '') - 20) < 0.1],
    ['后续动作保留透明度', Math.abs((final?.opacity || 0) - 0.6) < 0.01],
    ['后续动作保留亮度', final?.filter === 'brightness(0.8)'],
    [
      '左右抖动可连续触发两次',
      rows.some((row) => row.marker === 6 && row.moving) &&
        rows.some((row) => row.marker === 7 && row.moving),
    ],
    ['上下抖动实际播放', rows.some((row) => row.marker === 8 && row.moving)],
    ['闪烁实际播放', rows.some((row) => row.marker === 9 && row.moving)],
    ['换装过程中目标素材淡入', rows.some((row) => row.incoming)],
    ['换装后保留目标素材', Boolean(final?.src && final.src !== rows[0]?.src)],
  ];
  if (checks.some(([, pass]) => !pass))
    report.textContent +=
      'MIDDLE ' +
      label +
      ' ' +
      JSON.stringify([
        rows[0],
        ...[0, 1, 2].map((marker) => rows.find((row) => row.marker === marker)),
      ]) +
      '\n';
  for (const [name, pass] of checks)
    report.textContent += `${pass ? 'PASS' : 'FAIL'} ${label}: ${name}\n`;
}

async function sampleShort(doc: Document, scope: HTMLElement, label: string) {
  const states = new Map<string, number>();
  const started = performance.now();
  await new Promise<void>((resolve) => {
    const frame = () => {
      const text =
        scope.querySelector('[data-render-object="body"], [data-resolved-text="body"]')
          ?.textContent || '';
      if (!states.has(text)) states.set(text, performance.now());
      if (performance.now() - started >= 1600) resolve();
      else requestAnimationFrame(frame);
    };
    frame();
  });
  const elapsed = (states.get('山里有座庙。') || 0) - (states.get('山') || 0);
  const checks = [
    [
      '短句每个字都实际逐个显示',
      ['山', '山里', '山里有', '山里有座', '山里有座庙', '山里有座庙。'].every((text) =>
        states.has(text),
      ),
    ],
    ['默认速度短句可观察播放', elapsed >= 500 && elapsed < 1200],
  ];
  for (const [name, pass] of checks)
    report.textContent += `${pass ? 'PASS' : 'FAIL'} ${label}: ${name} (${elapsed.toFixed(0)}ms)\n`;
}

async function sampleScene(doc: Document, scope: HTMLElement, label: string) {
  let samples = 0,
    maxError = 0;
  const deadline = performance.now() + 2300;
  await new Promise<void>((resolve) => {
    const frame = () => {
      const flash = scope.querySelector<HTMLElement>('.gal-scene-switch-flash');
      const reveal = scope.querySelector<HTMLElement>('.gal-scene-switch-reveal');
      if (flash && reveal) {
        const stage = reveal.getBoundingClientRect();
        const light = flash.getBoundingClientRect();
        const clip = doc.defaultView!.getComputedStyle(reveal).clipPath;
        const right = clip.match(/inset\([^ ]+ ([^ ]+)/)?.[1] || '0';
        const fraction = right.includes('%')
          ? parseFloat(right) / 100
          : parseFloat(right) / stage.width;
        const edge = stage.left + stage.width * (1 - fraction);
        maxError = Math.max(maxError, Math.abs(edge - (light.left + light.width / 2)));
        samples++;
      }
      if (performance.now() >= deadline) resolve();
      else requestAnimationFrame(frame);
    };
    frame();
  });
  report.textContent += `${samples > 3 && maxError < 2 ? 'PASS' : 'FAIL'} ${label}: 光效中心跟随切换边界 (${samples} 帧, 偏差 ${maxError.toFixed(2)}px)\n`;
}

type CaseType = Parameters<typeof fixture>[0];
function caseNodes(type: CaseType) {
  const nodes = fixture(type);
  if (type === 'short') {
    nodes[0].data.text = '<p>山里有座庙。</p>';
    nodes[0].data.presentation = { characters: [], inlineActions: [] };
  }
  if (type === 'middle') {
    const actions = [
      'translate',
      'translate-x',
      'translate-y',
      'scale',
      'rotate',
      'opacity',
      'brightness',
      'shake-x',
      'shake-x',
      'shake-y',
      'pulse',
      'switch',
      'none',
    ].map((action, index) => ({
      ...createInlinePresentationAction({
        id: `middle-${index}`,
        kind: 'character',
        sourceNodeId: 'old',
      }),
      action,
      timelinePhase: 'inline',
      duration: 240,
      offsetX: 24,
      offsetY: -16,
      scale: 1.2,
      strength: action === 'opacity' ? 60 : action === 'brightness' ? 80 : 20,
      repeats: 2,
      targetAssetId: action === 'switch' ? 'green' : undefined,
    }));
    const presentation = nodes[0].data.presentation as any;
    presentation.inlineActions = actions;
    presentation.characters[1].enter = { type: 'none', duration: 0 };
    nodes[0].data.text =
      '<p>AAA' + actions.map((action, index) => `${tag(action.id)}|${index}|`).join('') + '</p>';
    nodes[1].data.outfits = [
      { id: 'red', imageUrl: image('#ef4444') },
      { id: 'green', imageUrl: image('#22c55e') },
    ];
  }
  if (type === 'scene') {
    const action = {
      ...createInlinePresentationAction({
        id: 'scene-switch',
        kind: 'scene',
        sourceNodeId: 'scene',
      }),
      action: 'switch',
      targetAssetId: 'b',
      duration: 600,
    };
    const presentation = nodes[0].data.presentation as any;
    presentation.scene = { ...createScenePresentation('scene'), imageId: 'a' };
    presentation.characters = [];
    presentation.inlineActions = [action];
    nodes[0].data.text =
      '<p>AAA<span class="mention-chip" data-mention-kind="scene" data-mention-id="scene-switch">@scene</span>BBB</p>';
    nodes.push({
      id: 'scene',
      type: 'sceneNode',
      position: { x: 0, y: 0 },
      data: {
        images: [
          { id: 'a', imageUrl: image('#1e293b') },
          { id: 'b', imageUrl: image('#f97316') },
        ],
      },
    });
  }
  return nodes;
}
function DefaultSettingsPreview({ props }: { props: PlayTestProps }) {
  const settings = usePlaytestSettings();
  return (
    <PlayTestModal
      {...props}
      interactionMode={settings.playTestInteractionMode}
      typewriterSpeed={settings.playTestTypewriterSpeed}
    />
  );
}

async function mountSurface(nodes: Node[], surface: 'preview' | 'web' | 'export', speed = 80) {
  flushSync(() => root.render(null));
  if (surface === 'preview') {
    const props = {
      nodes,
      edges: [],
      onClose: noop,
      displayMode: 'windowed',
      onDisplayModeChange: noop,
      windowLayer: 'workspace',
      windowSettings: {
        bounds: null,
        mobileBounds: null,
        followSelectedCard: false,
        autoScaleOnHover: false,
      },
      setWindowSettings: noop,
      language: 'zh',
      onLanguageChange: noop,
      isDarkMode: true,
      choicesColumns: 1,
      setChoicesColumns: noop,
      videoAutoPlay: false,
      setVideoAutoPlay: noop,
      layoutMode: 'immersive',
      setLayoutMode: noop,
      interactionMode:
        surface === 'preview' && String(nodes[0].data.text).includes('山里有座庙')
          ? migratePlaytestTextPlayback('immediate', null)
          : 'typewriter',
      setInteractionMode: noop,
      typewriterSpeed: speed,
      setTypewriterSpeed: noop,
      choiceDelay: 0,
      setChoiceDelay: noop,
      choicesPosition: 'belowText',
      setChoicesPosition: noop,
      blurBackground: false,
      setBlurBackground: noop,
      blurText: false,
      setBlurText: noop,
      skipSingleChoicePopup: true,
      setSkipSingleChoicePopup: noop,
      autoAdvance: false,
      setAutoAdvance: noop,
      autoAdvanceDelay: 1,
      setAutoAdvanceDelay: noop,
      hideCharacterTags: true,
      setHideCharacterTags: noop,
      hideSceneTags: true,
      setHideSceneTags: noop,
      canvasSettings: {
        ...DEFAULT_SHARED_CANVAS_SETTINGS,
        canvasWidth: 960,
        canvasHeight: 540,
      },
      onCanvasSettingsChange: noop,
      renderStyle: style,
      updateRenderStyle: noop,
    } as PlayTestProps;
    flushSync(() =>
      root.render(
        String(nodes[0].data.text).includes('山里有座庙') ? (
          <DefaultSettingsPreview props={props} />
        ) : (
          <PlayTestModal {...props} />
        ),
      ),
    );

    return {
      doc: document,
      scope: document.body,
      cleanup: () => flushSync(() => root.render(null)),
    };
  } else if (surface === 'web') {
    flushSync(() =>
      root.render(
        <WebPlaytestPreview
          nodes={nodes}
          edges={[]}
          language="zh"
          renderStyle={style}
          settings={{ ...settings, typewriterSpeed: speed }}
          projectTitle=""
          choiceColor="#2563eb"
          choiceTextColor="#fff"
          onUpdateSettings={noop}
          onUpdateRenderStyle={noop}
          previewMode="test"
          requestedSurface="game"
        />,
      ),
    );

    return { doc: document, scope: host, cleanup: () => flushSync(() => root.render(null)) };
  } else {
    const blob = await buildInteractiveWebZipBlob(nodes, [], {
      language: 'zh',
      settings: { ...settings, typewriterSpeed: speed },
      style,
    });
    const zip = await JSZip.loadAsync(blob);
    let html = await zip.file('index.html')!.async('string');
    const content = await zip.file('content.js')!.async('string');
    html = html.replace('<script src="./content.js"></script>', `<script>${content}</script>`);
    for (const path of Object.keys(zip.files)) {
      if (path.startsWith('assets/') && !zip.files[path].dir) {
        const mime = path.endsWith('.svg')
          ? 'image/svg+xml'
          : path.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
        const data = `data:${mime};base64,${await zip.files[path].async('base64')}`;
        html = html.split(path).join(data);
      }
    }
    const frame = document.createElement('iframe');
    frame.width = '960';
    frame.height = '540';
    host.append(frame);
    html = html.replace(
      '<head>',
      `<head><script>window.addEventListener('error', (e) => { parent.document.getElementById('results').textContent += 'EXPORT ERROR LINE ' + e.lineno + ': ' + e.message + String.fromCharCode(10) + document.documentElement.outerHTML.split(String.fromCharCode(10)).slice(e.lineno-4,e.lineno+2).join(String.fromCharCode(10)); });</script>`,
    );
    const loaded = new Promise<void>((resolve) => (frame.onload = () => resolve()));
    frame.srcdoc = html;
    await loaded;

    return {
      doc: frame.contentDocument!,
      scope: frame.contentDocument!.body,
      cleanup: () => frame.remove(),
    };
  }
}

let generation = 0;
let cleanupCurrent: (() => void) | undefined;
const controls = document.createElement('div');
Object.assign(controls.style, {
  position: 'relative',
  zIndex: '2147483647',
  padding: '12px',
  background: 'white',
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
});
const heading = document.createElement('strong');
heading.textContent = '动画检查 · 点击重播可慢速观察逐字显示';
controls.append(heading);
document.body.prepend(controls);
const status = document.createElement('span');
controls.append(status);
async function manual(surface: 'preview' | 'web' | 'export') {
  generation++;
  cleanupCurrent?.();
  const nodes = caseNodes('slide-left');
  const presentation = nodes[0].data.presentation as any;
  presentation.characters.forEach((character: any) => (character.enter.duration = 800));
  presentation.inlineActions[0].duration = 800;
  presentation.inlineActions = [presentation.inlineActions[0]];
  nodes[0].data.text = `<p>小和尚：师父，山外的云好像一片海。<br>${tag('old-enter')}老和尚：心静下来，脚下的石阶也能通向远方。</p>`;
  status.textContent = `${surface} · 150ms/字 · 人物入场800ms`;
  const mounted = await mountSurface(nodes, surface, 150);
  cleanupCurrent = mounted.cleanup;
}
for (const [label, surface] of [
  ['预览慢速重播', 'preview'],
  ['网页慢速重播', 'web'],
  ['导出网页慢速重播', 'export'],
] as const) {
  const button = document.createElement('button');
  button.textContent = label;
  button.onclick = () => manual(surface);
  controls.append(button);
}
const shortButton = document.createElement('button');
shortButton.textContent = '短句逐字重播';
shortButton.onclick = async () => {
  generation++;
  cleanupCurrent?.();
  status.textContent = `preview · ${DEFAULT_TYPEWRITER_INTERVAL_MS}ms/字 · 山里有座庙。`;
  const mounted = await mountSurface(caseNodes('short'), 'preview', DEFAULT_TYPEWRITER_INTERVAL_MS);
  cleanupCurrent = mounted.cleanup;
};
controls.append(shortButton);
const button = document.createElement('button');
button.textContent = '运行全部自动回归';
button.onclick = () => run();
controls.append(button);
async function run() {
  const current = ++generation;
  report.textContent = '';
  for (const [name, pass] of [
    [
      '旧立即显示设置升级为逐字播放',
      migratePlaytestTextPlayback('immediate', null) === 'typewriter',
    ],
    ['之后主动选择立即显示仍保留', migratePlaytestTextPlayback('immediate', '3') === 'immediate'],
    ['旧默认速度升级', migratePlaytestTypewriterSpeed(30, null) === 120],
    ['升级后自选速度保留', migratePlaytestTypewriterSpeed(30, '3') === 30],
    ['已有自定义速度保留', migratePlaytestTypewriterSpeed(80, null) === 80],
  ])
    report.textContent += `${pass ? 'PASS' : 'FAIL'} 速度设置: ${name}\n`;
  for (const type of [
    'none',
    'slide-left',
    'slide-right',
    'slide-up',
    'slide-down',
    'fade',
    'zoom',
    'middle',
    'scene',
    'short',
  ] as const) {
    const nodes = caseNodes(type);
    if (
      new URLSearchParams(location.search).get('case') &&
      new URLSearchParams(location.search).get('case') !== type
    )
      continue;
    for (const surface of ['preview', 'web', 'export'] as const) {
      if (generation !== current) return;
      cleanupCurrent?.();
      status.textContent = `自动测试 ${surface}/${type}`;
      const mounted = await mountSurface(
        nodes,
        surface,
        type === 'short' ? DEFAULT_TYPEWRITER_INTERVAL_MS : 80,
      );
      cleanupCurrent = mounted.cleanup;
      await (
        type === 'middle'
          ? sampleMiddle
          : type === 'scene'
            ? sampleScene
            : type === 'short'
              ? sampleShort
              : sample
      )(mounted.doc, mounted.scope, `${surface}/${type}`);
    }
  }
  report.textContent += 'DONE\n';
  await manual('web');
}
(new URLSearchParams(location.search).has('auto') ? run() : manual('web')).catch(
  (error) => (report.textContent += `ERROR ${error.stack || error}`),
);

import.meta.hot?.dispose(() => {
  generation++;
  cleanupCurrent?.();
  root.unmount();
  controls.remove();
  report.remove();
});
