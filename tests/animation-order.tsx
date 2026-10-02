import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import JSZip from 'jszip';
import type { Node } from '@xyflow/react';
import { WebPlaytestPreview } from '../src/components/render/web/WebPlaytestPreview';
import { PlayTestModal } from '../src/components/render/playtest/PlayTestModal';
import { DEFAULT_SHARED_CANVAS_SETTINGS } from '../src/components/render/canvas/canvasSettings';
import { DEFAULT_RENDER_STYLE } from '../src/components/render/video/VideoRenderModal/workspaceStorage';
import { buildInteractiveWebZipBlob } from '../src/components/render/web/webExport';
import {
  createCharacterPresentation,
  createInlinePresentationAction,
} from '../src/lib/presentation';
import type { PlayTestProps } from '../src/components/render/playtest/types';
import type { WebExportSettings } from '../src/components/render/video/shared/types';
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
  bodyTypewriterMode: 'char' as const,
};
const noop = () => {};
function fixture(type: 'slide-left' | 'fade' | 'zoom') {
  const old = {
    ...createCharacterPresentation('old'),
    position: 'right' as const,
    enter: { type, duration: 300 },
    exit: { type: 'slide-left' as const, duration: 300 },
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
Object.assign(host.style, { width: '960px', height: '540px', position: 'relative' });
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
          text: (scope.querySelector('.typewriter-visible') || scope).textContent || '',
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
    ['待入场人物开场隐藏', before.length > 0 && before.every((row) => row.hidden)],
    ['第一行结束后人物入场且移动', entrance.some((row) => row.moving)],
    [
      '第二行只在入场结束后显示',
      second.length > 0 && trace.find((row) => row.text.includes('B'))?.opacity === 1,
    ],
    ['出场完成后保持隐藏', trace.at(-1)?.hidden === true],
  ];
  for (const [name, pass] of checks)
    report.textContent += `${pass ? 'PASS' : 'FAIL'} ${label}: ${name}\n`;
}
async function run() {
  for (const type of ['slide-left', 'fade', 'zoom'] as const) {
    const nodes = fixture(type);
    for (const surface of ['preview', 'web', 'export'] as const) {
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
          interactionMode: 'typewriter',
          setInteractionMode: noop,
          typewriterSpeed: 80,
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
        flushSync(() => root.render(<PlayTestModal {...props} />));
        await sample(document, document.body, `${surface}/${type}`);
      } else if (surface === 'web') {
        flushSync(() =>
          root.render(
            <WebPlaytestPreview
              nodes={nodes}
              edges={[]}
              language="zh"
              renderStyle={style}
              settings={settings}
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
        await sample(document, host, `${surface}/${type}`);
      } else {
        const blob = await buildInteractiveWebZipBlob(nodes, [], {
          language: 'zh',
          settings,
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
        await sample(frame.contentDocument!, frame.contentDocument!.body, `${surface}/${type}`);
        frame.remove();
      }
    }
  }
  report.textContent += 'DONE\n';
}
run().catch((error) => (report.textContent += `ERROR ${error.stack || error}`));
