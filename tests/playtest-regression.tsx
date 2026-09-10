import type { Edge, Node } from '@xyflow/react';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  DEFAULT_SHARED_CANVAS_SETTINGS,
  type SharedCanvasSettings,
} from '../src/components/render/canvas/canvasSettings';
import { PlayTestModal } from '../src/components/render/playtest/PlayTestModal';
import type { PlayTestProps } from '../src/components/render/playtest/types';
import { DEFAULT_RENDER_STYLE } from '../src/components/render/video/VideoRenderModal/workspaceStorage';
import type { RenderStyle } from '../src/components/render/video/shared/types';
import { RichText } from '../src/components/RichText';
import type {
  InlinePresentationAction,
  PlaytestWindowSettings,
  StoryPresentation,
} from '../src/domain/project';
import {
  buildInlinePlaybackSteps,
  getInlineActionDuration,
  inlinePlaybackStateAtTime,
  latestPersistentInlineAction,
} from '../src/lib/inlinePresentationPlayback';
import {
  createCharacterPresentation,
  createInlinePresentationAction,
  createScenePresentation,
} from '../src/lib/presentation';
import '../src/index.css';

// Open /tests/playtest-regression.html with the normal Vite development server.
// This fixture only passes in-memory nodes and embedded SVGs into the actual player.
const svg = (body: string, width = 1600, height = 900) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`)}`;
const day = svg(
  '<rect width="1600" height="900" fill="#83d8e9"/><circle cx="1250" cy="180" r="90" fill="#fff0a8"/><path d="M0 580L330 230 650 590 960 320 1600 700V900H0Z" fill="#2d948b"/><rect y="690" width="1600" height="210" fill="#d6edb0"/><text x="65" y="110" font-size="62" font-family="sans-serif" fill="#164e63">SCENE A · DAY</text>',
);
const night = svg(
  '<rect width="1600" height="900" fill="#1e1b4b"/><circle cx="1230" cy="180" r="75" fill="#e0e7ff"/><path d="M0 580L330 230 650 590 960 320 1600 700V900H0Z" fill="#4338ca"/><rect y="690" width="1600" height="210" fill="#312e81"/><text x="65" y="110" font-size="62" font-family="sans-serif" fill="#e0e7ff">SCENE B · NIGHT</text>',
);
const character = (color: string, label: string) =>
  svg(
    `<circle cx="210" cy="115" r="85" fill="#ffdbc0"/><path d="M125 92Q135 -15 235 15Q315 35 296 105Q200 38 125 92" fill="#3f2b4e"/><circle cx="180" cy="111" r="7" fill="#312e81"/><circle cx="240" cy="111" r="7" fill="#312e81"/><path d="M185 147Q210 167 235 147" fill="none" stroke="#b45309" stroke-width="6"/><path d="M130 212Q210 190 290 212L356 570H64Z" fill="${color}"/><path d="M112 247L38 460M308 247L382 460" stroke="#ffdbc0" stroke-width="40" stroke-linecap="round"/><path d="M156 570L149 696M264 570L271 696" stroke="#312e81" stroke-width="48"/><text x="210" y="345" text-anchor="middle" font-size="35" font-family="sans-serif" fill="white">${label}</text>`,
    420,
    740,
  );
const blue = character('#2563eb', 'OUTFIT A');
const coral = character('#f97316', 'OUTFIT B');

const chip = (
  kind: 'character' | 'scene',
  id: string,
  name = kind === 'scene' ? '山中寺庙' : '小和尚',
) =>
  `<span class="mention-chip mention-chip-${kind}" contenteditable="false" data-mention-kind="${kind}" data-mention-id="${id}" data-mention-name="${name}">@${name}</span>`;
const action = (
  id: string,
  kind: 'character' | 'scene',
  targetAssetId: string,
  sourceNodeId = kind === 'scene' ? 'fixture-scene' : 'fixture-character',
): InlinePresentationAction => ({
  ...createInlinePresentationAction({
    id,
    kind,
    sourceNodeId,
    name: kind === 'scene' ? '山中寺庙' : '小和尚',
  }),
  action: 'switch',
  targetAssetId,
  duration: 700,
});
const firstActions = [
  action('scene-night-1', 'scene', 'night'),
  action('character-coral-1', 'character', 'coral'),
  action('scene-day-1', 'scene', 'day'),
  action('character-blue-1', 'character', 'blue'),
];
const firstHtml = `<p><strong>夜色降临，${chip('scene', 'scene-night-1')}山寺变暗。</strong>小和尚${chip('character', 'character-coral-1')}换上橙色衣服。</p><p><em>天又亮了，${chip('scene', 'scene-day-1')}山寺恢复白天。</em>${chip('character', 'character-blue-1')}他穿回蓝衣。</p>`;
const secondActions = [
  action('scene-day-2', 'scene', 'day'),
  action('character-blue-2', 'character', 'blue'),
];
const secondHtml = `<p><strong>第二张：同一场景与人物，从夜景和橙衣重新入场。</strong></p><p>然后${chip('scene', 'scene-day-2')}天亮，${chip('character', 'character-blue-2')}衣服变蓝。</p>`;
const tagActions = [
  action('scene-only-night', 'scene', 'night'),
  action('scene-only-day', 'scene', 'day'),
  action('character-only-coral', 'character', 'coral'),
  action('character-only-blue', 'character', 'blue'),
];
const tagsOnlyHtml = `<p><strong>${chip('scene', 'scene-only-night')}${chip('scene', 'scene-only-day')}</strong>${chip('character', 'character-only-coral')}${chip('character', 'character-only-blue')}</p>`;
const presentation = (
  second: boolean,
  inlineActions: InlinePresentationAction[],
): StoryPresentation => ({
  scene: {
    ...createScenePresentation('fixture-scene'),
    imageId: second ? 'night' : 'day',
    cropMode: 'cover',
    enter: { type: second ? 'slide-left' : 'fade', duration: 650 },
    exit: { type: 'fade', duration: 550 },
  },
  characters: [
    {
      ...createCharacterPresentation('fixture-character'),
      outfitId: second ? 'coral' : 'blue',
      scale: 0.82,
      position: 'right',
      enter: { type: second ? 'fade' : 'slide-right', duration: 650 },
      exit: { type: 'slide-left', duration: 550 },
    },
  ],
  inlineActions,
});
const firstPresentation = presentation(false, firstActions);
const cards: Node[] = [
  {
    id: 'fixture-first',
    type: 'storyNode',
    position: { x: 0, y: 0 },
    data: {
      title: '1 · 嵌套标签 / 重复素材切换',
      text: firstHtml,
      presentation: firstPresentation,
      isRoot: true,
    },
  },
  {
    id: 'fixture-second',
    type: 'storyNode',
    position: { x: 0, y: 250 },
    data: {
      title: '2 · 同 source 的下一张剧情卡',
      text: secondHtml,
      presentation: presentation(true, secondActions),
    },
  },
  {
    id: 'fixture-tags',
    type: 'storyNode',
    position: { x: 0, y: 500 },
    data: {
      title: '3 · 无文字，隐藏标签仍执行四次动作',
      text: tagsOnlyHtml,
      presentation: presentation(false, tagActions),
    },
  },
];
const sourceNodes: Node[] = [
  {
    id: 'fixture-scene',
    type: 'sceneNode',
    position: { x: 500, y: 0 },
    data: {
      sceneName: '山中寺庙',
      coverImageUrl: day,
      images: [
        { id: 'day', name: '白天', imageUrl: day },
        { id: 'night', name: '夜晚', imageUrl: night },
      ],
    },
  },
  {
    id: 'fixture-character',
    type: 'characterNode',
    position: { x: 800, y: 0 },
    data: {
      characterName: '小和尚',
      traits: '',
      avatarUrl: blue,
      tagSpriteUrl: blue,
      outfits: [
        { id: 'blue', name: '蓝衣', imageUrl: blue },
        { id: 'coral', name: '橙衣', imageUrl: coral },
      ],
    },
  },
];
const edges: Edge[] = [
  { id: 'fixture-edge-1', source: 'fixture-first', target: 'fixture-second' },
  { id: 'fixture-edge-2', source: 'fixture-second', target: 'fixture-tags' },
];
const hiddenTags = { hideCharacterTags: true, hideSceneTags: true };
const getActions = (html: string, config: StoryPresentation) =>
  buildInlinePlaybackSteps(html, config, hiddenTags).flatMap((step) =>
    step.kind === 'action' ? [step.action] : [],
  );
const getText = (html: string, config: StoryPresentation) =>
  buildInlinePlaybackSteps(html, config, hiddenTags)
    .map((step) => (step.kind === 'text' ? step.html : ''))
    .join('');
const checks = [
  [
    '嵌套 p / strong / em 按顺序执行四次 switch',
    () =>
      getActions(firstHtml, firstPresentation)
        .map((item) => item.id)
        .join(',') === firstActions.map((item) => item.id).join(','),
  ],
  [
    '隐藏标签后保留完整段落、粗体与斜体正文',
    () => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = getText(firstHtml, firstPresentation);
      return (
        wrapper.querySelectorAll('p').length === 2 &&
        wrapper.querySelector('strong')?.textContent === '夜色降临，山寺变暗。' &&
        wrapper.querySelector('em')?.textContent === '天又亮了，山寺恢复白天。' &&
        !wrapper.querySelector('.mention-chip')
      );
    },
  ],
  [
    '只有隐藏标签，没有正文也保留全部四次动作',
    () =>
      getActions(tagsOnlyHtml, presentation(false, tagActions)).length === 4 &&
      !getText(tagsOnlyHtml, presentation(false, tagActions))
        .replace(/<[^>]*>/g, '')
        .trim(),
  ],
  [
    '同名、同 source、不同 mention ID 不借用已有动作',
    () =>
      getActions(`<p>之前${chip('character', 'unconfigured-mention')}之后</p>`, firstPresentation)
        .length === 0,
  ],
  [
    '同名、不同 source 按 mention ID 精确匹配',
    () => {
      const alternate = action('other-character-switch', 'character', 'blue', 'other-character');
      const matched = getActions(`<p>之前${chip('character', alternate.id)}之后</p>`, {
        ...firstPresentation,
        inlineActions: [...firstActions, alternate],
      });
      return matched.length === 1 && matched[0].sourceNodeId === 'other-character';
    },
  ],
  [
    '同一个 switch 标签重复出现时分别生成动作步骤',
    () =>
      getActions(
        `<p>${chip('scene', 'scene-night-1')}${chip('scene', 'scene-night-1')}</p>`,
        firstPresentation,
      ).length === 2,
  ],
  [
    'switch 时长统一限制为至少 180 ms',
    () => getInlineActionDuration({ ...firstActions[0], duration: 20 }) === 180,
  ],
  [
    '只有隐藏标签的时间轴仍在播放动作',
    () =>
      inlinePlaybackStateAtTime({
        html: tagsOnlyHtml,
        presentation: presentation(false, tagActions),
        elapsed: 0.1,
        duration: 5,
        options: hiddenTags,
      }).activeAction?.id === 'scene-only-night',
  ],
  [
    '换素材不会覆盖同一人物已经完成的持久位移动作',
    () => {
      const move: InlinePresentationAction = {
        ...firstActions[1],
        id: 'character-move',
        action: 'translate',
        offsetX: 30,
      };
      return (
        latestPersistentInlineAction([move, firstActions[1]], 'character', 'fixture-character')
          ?.id === move.id
      );
    },
  ],
  [
    '显示标签时，带动作的 text 步骤完整还原正文与可见 tag',
    () => {
      const normalize = (html: string) => {
        const container = document.createElement('div');
        container.innerHTML = html;
        return container.innerHTML;
      };
      const visibleHtml = buildInlinePlaybackSteps(firstHtml, firstPresentation, {
        hideCharacterTags: false,
        hideSceneTags: false,
      })
        .map((step) => (step.kind === 'text' ? step.html : ''))
        .join('');
      return normalize(visibleHtml) === normalize(firstHtml);
    },
  ],
] as const;

type AnimationSampleSession = {
  id: number;
  mode: string;
  start: string;
  duration: number;
  transitionWindowMs?: number;
};

function useAnimationSamples(session: AnimationSampleSession | null) {
  const [summary, setSummary] = useState('尚未采样');
  useEffect(() => {
    if (!session) return;
    const startedAt = performance.now();
    const sceneReveals = new Set<Element>();
    const sceneFlashes = new Set<Element>();
    const characterTargets = new Set<Element>();
    const clipSamples = new Set<string>();
    const characterOpacitySamples = new Set<string>();
    const entrySceneOpacitySamples = new Set<string>();
    const entryCharacterOpacitySamples = new Set<string>();
    const entryCharacterTransforms = new Set<string>();
    const entrySceneTransforms = new Set<string>();
    let frames = 0;
    let sceneIntermediateFrames = 0;
    let characterIntermediateFrames = 0;
    let nextFrame = 0;
    let lastPublish = -1000;
    const addSample = (collection: Set<string>, value: string) => {
      if (collection.size < 5) collection.add(value);
    };
    const labelImage = (image: HTMLImageElement) => {
      const source = image.currentSrc || image.src;
      if (source === day) return 'SCENE A / DAY';
      if (source === night) return 'SCENE B / NIGHT';
      if (source === blue) return 'OUTFIT A / BLUE';
      if (source === coral) return 'OUTFIT B / ORANGE';
      return image.alt || '其他图片';
    };
    const isVisibleImage = (image: HTMLImageElement) => {
      const bounds = image.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return false;
      let element: HTMLElement | null = image;
      while (element && !element.classList.contains('fixture-player')) {
        const style = getComputedStyle(element);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          Number(style.opacity) < 0.01
        )
          return false;
        element = element.parentElement;
      }
      return true;
    };
    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - startedAt;
      const player = document.querySelector('.fixture-player');
      if (player) {
        player.querySelectorAll('.gal-scene-switch-reveal').forEach((element) => {
          sceneReveals.add(element);
          const clip = getComputedStyle(element).clipPath;
          const rightInset = Number(clip.match(/inset\(\S+\s+([\d.]+)%/)?.[1]);
          if (rightInset > 0.01 && rightInset < 99.99) {
            sceneIntermediateFrames += 1;
            addSample(clipSamples, clip);
          }
        });
        player
          .querySelectorAll('.gal-scene-switch-flash')
          .forEach((element) => sceneFlashes.add(element));
        player.querySelectorAll('img.gal-character-switch-target').forEach((element) => {
          characterTargets.add(element);
          const opacity = Number(getComputedStyle(element).opacity);
          if (opacity > 0.001 && opacity < 0.999) {
            characterIntermediateFrames += 1;
            addSample(characterOpacitySamples, opacity.toFixed(3));
          }
        });
        // Observe computed transition values, including a wrapper if the player
        // animates a character group rather than its base image.
        if (elapsed < (session.transitionWindowMs ?? 2000)) {
          const sceneImage = player.querySelector<HTMLImageElement>('img[alt="Scene Background"]');
          const characterImage = Array.from(
            player.querySelectorAll<HTMLImageElement>('img[alt="小和尚"]'),
          ).find((image) => !image.classList.contains('gal-character-switch-target'));
          for (const [kind, image] of [
            ['scene', sceneImage],
            ['character', characterImage],
          ] as const) {
            let element: HTMLElement | null | undefined = image;
            for (let depth = 0; element && depth < 3; depth += 1, element = element.parentElement) {
              const style = getComputedStyle(element);
              if (
                !style.transitionDuration.split(',').some((value) => Number.parseFloat(value) > 0)
              )
                continue;
              const opacity = Number(style.opacity);
              if (opacity > 0.001 && opacity < 0.999) {
                addSample(
                  kind === 'scene' ? entrySceneOpacitySamples : entryCharacterOpacitySamples,
                  opacity.toFixed(3),
                );
              }
              if (style.transform !== 'none') {
                addSample(
                  kind === 'scene' ? entrySceneTransforms : entryCharacterTransforms,
                  style.transform,
                );
              }
            }
          }
        }
      }
      const finished = elapsed >= session.duration;
      if (finished || elapsed - lastPublish >= 250) {
        lastPublish = elapsed;
        const finalImages = player
          ? Array.from(player.querySelectorAll<HTMLImageElement>('img'))
              .filter(
                (image) =>
                  isVisibleImage(image) && !image.classList.contains('gal-scene-switch-flash'),
              )
              .map(labelImage)
          : [];
        setSummary(
          [
            `${finished ? '采样完成' : '采样中'} ${session.mode} / ${session.start} · ${(Math.min(elapsed, session.duration) / 1000).toFixed(1)}s / ${(session.duration / 1000).toFixed(1)}s · ${frames}帧`,
            `scene reveal=${sceneReveals.size}, flash=${sceneFlashes.size}, clipPath中间帧=${sceneIntermediateFrames} [${Array.from(clipSamples).slice(0, 2).join(' → ') || '无'}]`,
            `character target=${characterTargets.size}, opacity中间帧=${characterIntermediateFrames} [${Array.from(characterOpacitySamples).join(', ') || '无'}]`,
            `${session.transitionWindowMs ? '换页' : '入场'} scene opacity=[${Array.from(entrySceneOpacitySamples).join(', ') || '无'}], transform变化=${entrySceneTransforms.size}; character opacity=[${Array.from(entryCharacterOpacitySamples).join(', ') || '无'}], transform变化=${entryCharacterTransforms.size}`,
            `${session.transitionWindowMs ? '换页' : '入场'} transform样本: ${Array.from(entryCharacterTransforms).slice(0, 2).join(' → ') || Array.from(entrySceneTransforms).slice(0, 2).join(' → ') || '无'}`,
            `${finished ? '最终素材' : '当前素材'}: ${Array.from(new Set(finalImages)).join(' | ') || '无可见图片'}`,
          ].join('\n'),
        );
      }
      if (!finished) nextFrame = requestAnimationFrame(tick);
    };
    setSummary(`准备采样 ${session.mode} / ${session.start}`);
    nextFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(nextFrame);
  }, [session]);
  return summary;
}

function Fixture() {
  const [open, setOpen] = useState(false);
  const [restart, setRestart] = useState(0);
  const [start, setStart] = useState('fixture-first');
  const [interactionMode, setInteractionMode] = useState('typewriter');
  const [sampleSession, setSampleSession] = useState<AnimationSampleSession | null>(null);
  const sampleSummary = useAnimationSamples(sampleSession);
  const [richTextExample, setRichTextExample] = useState(firstHtml);
  const [selectedTag, setSelectedTag] = useState('点击任一 tag，可检查标签点击事件。');
  const [canvasSettings, setCanvasSettings] = useState<SharedCanvasSettings>({
    ...DEFAULT_SHARED_CANVAS_SETTINGS,
    sceneScale: 100,
    sceneOffsetY: 0,
  });
  const [renderStyle, setRenderStyle] = useState<RenderStyle>({ ...DEFAULT_RENDER_STYLE });
  const [windowSettings, setWindowSettings] = useState<PlaytestWindowSettings>({
    bounds: null,
    mobileBounds: null,
    followSelectedCard: false,
    autoScaleOnHover: false,
  });
  const [settings, setSettings] = useState({
    choicesColumns: 1,
    typewriterSpeed: 26,
    choiceDelay: 2,
    blurBackground: false,
    blurText: false,
    autoAdvanceDelay: 1.5,
  });
  const nodes = useMemo(
    () => [
      ...cards.map((card) => ({ ...card, data: { ...card.data, isRoot: card.id === start } })),
      ...sourceNodes,
    ],
    [start],
  );
  const patchCanvas = (patch: Partial<SharedCanvasSettings>) =>
    setCanvasSettings((previous) => ({ ...previous, ...patch }));
  const patchSettings = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) =>
    setSettings((previous) => ({ ...previous, [key]: value }));
  const sampleCurrentRun = () => {
    const card = cards.find((item) => item.id === start)!;
    const config = card.data.presentation as StoryPresentation;
    const html = String(card.data.text);
    const characters = getText(html, config).replace(/<[^>]*>/g, '').length;
    const actionDuration = getActions(html, config).reduce(
      (sum, item) => sum + getInlineActionDuration(item),
      0,
    );
    const typingDuration =
      interactionMode === 'typewriter' ? characters * settings.typewriterSpeed : 0;
    setRestart((value) => value + 1);
    setOpen(true);
    setSampleSession({
      id: Date.now(),
      mode: interactionMode,
      start,
      duration: Math.max(
        8000,
        actionDuration + typingDuration + 3500,
        settings.choiceDelay * 1000 + 4000,
      ),
    });
  };
  const results = checks.map(([name, check]) => {
    try {
      return { name, pass: Boolean(check()), error: '' };
    } catch (error) {
      return { name, pass: false, error: String(error) };
    }
  });
  const props: PlayTestProps = {
    nodes,
    edges,
    onClose: () => {
      setSampleSession(null);
      setOpen(false);
    },
    displayMode: 'fullscreen',
    onDisplayModeChange: () => undefined,
    windowLayer: 'workspace',
    windowSettings,
    setWindowSettings,
    language: 'zh',
    onLanguageChange: () => undefined,
    isDarkMode: true,
    ...settings,
    choicesColumns: settings.choicesColumns,
    setChoicesColumns: (value) => patchSettings('choicesColumns', value),
    videoAutoPlay: false,
    setVideoAutoPlay: (value) => patchCanvas({ videoAutoPlay: value }),
    layoutMode: canvasSettings.layoutMode,
    setLayoutMode: (value) => patchCanvas({ layoutMode: value }),
    interactionMode,
    setInteractionMode,
    setTypewriterSpeed: (value) => patchSettings('typewriterSpeed', value),
    setChoiceDelay: (value) => patchSettings('choiceDelay', value),
    choicesPosition: canvasSettings.choicesPosition,
    setChoicesPosition: (value) => patchCanvas({ choicesPosition: value }),
    setBlurBackground: (value) => patchSettings('blurBackground', value),
    setBlurText: (value) => patchSettings('blurText', value),
    skipSingleChoicePopup: canvasSettings.skipSingleChoicePopup,
    setSkipSingleChoicePopup: (value) => patchCanvas({ skipSingleChoicePopup: value }),
    autoAdvance: canvasSettings.autoAdvance,
    setAutoAdvance: (value) => patchCanvas({ autoAdvance: value }),
    setAutoAdvanceDelay: (value) => patchSettings('autoAdvanceDelay', value),
    hideCharacterTags: canvasSettings.hideCharacterTags,
    setHideCharacterTags: (value) => patchCanvas({ hideCharacterTags: value }),
    hideSceneTags: canvasSettings.hideSceneTags,
    setHideSceneTags: (value) => patchCanvas({ hideSceneTags: value }),
    canvasSettings,
    onCanvasSettingsChange: patchCanvas,
    renderStyle,
    updateRenderStyle: (key, value) =>
      setRenderStyle((previous) => ({ ...previous, [key]: value })),
  };
  return (
    <>
      <style>{`
      body { margin: 0; background: #eef2ff; color: #172554; font: 15px/1.6 system-ui, sans-serif; }
      .fixture-controls { position: fixed; z-index: 2147483647; inset: 0 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 18px; background: #ffffffed; border-bottom: 1px solid #c7d2fe; color: #172554; font-size: 13px; }
      .fixture-controls select, .fixture-controls button { border: 1px solid #c7d2fe; border-radius: 8px; background: white; color: #172554; padding: 5px 10px; cursor: pointer; }
      .fixture-controls .fixture-primary { background: #4f46e5; color: white; }
      .fixture-samples { flex-basis: 100%; margin: 0; border-top: 1px solid #c7d2fe; padding-top: 6px; white-space: pre-wrap; font: 11px/1.35 ui-monospace, monospace; }
      .fixture-tag-example { background: white; color: #172554; border: 1px solid #c7d2fe; border-radius: 14px; padding: 18px; }
      .fixture-tag-example[data-theme="dark"] { background: #0f172a; color: #e2e8f0; margin-top: 12px; }
      .fixture-report { max-width: 960px; padding: 100px 24px 40px; margin: auto; }
      .fixture-report h1 { font-size: 28px; font-weight: 800; margin-bottom: 16px; }
      .fixture-report h2 { font-size: 18px; font-weight: 700; margin: 25px 0 10px; }
      .fixture-report li { margin: 8px 0; }
      .fixture-report table { width: 100%; border-collapse: collapse; margin: 14px 0; background: white; }
      .fixture-report td { padding: 12px 16px; border-bottom: 1px solid #e0e7ff; }
      .fixture-player { position: fixed; z-index: 1000; inset: 58px 0 0; }
    `}</style>
      <div className="fixture-controls">
        <strong>动画回归夹具</strong>
        <label>
          模式{' '}
          <select
            aria-label="播放模式"
            value={interactionMode}
            onChange={(event) => {
              setSampleSession(null);
              setInteractionMode(event.target.value);
              setRestart((value) => value + 1);
            }}
          >
            {['immediate', 'typewriter', 'timed', 'clickToShow'].map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </select>
        </label>
        <label>
          起点{' '}
          <select
            aria-label="起始卡片"
            value={start}
            onChange={(event) => {
              setSampleSession(null);
              setStart(event.target.value);
              setRestart((value) => value + 1);
            }}
          >
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {String(card.data.title)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={canvasSettings.hideCharacterTags && canvasSettings.hideSceneTags}
            onChange={(event) =>
              patchCanvas({
                hideCharacterTags: event.target.checked,
                hideSceneTags: event.target.checked,
              })
            }
          />{' '}
          隐藏标签
        </label>
        <button
          className="fixture-primary"
          onClick={() => {
            setSampleSession(null);
            setRestart((value) => value + 1);
            setOpen(true);
          }}
        >
          {open ? '重启当前夹具' : '打开实际测试播放器'}
        </button>
        <button className="fixture-primary" onClick={sampleCurrentRun}>
          采样本轮动画
        </button>
        <button
          disabled={!open}
          onClick={() =>
            setSampleSession({
              id: Date.now(),
              mode: interactionMode,
              start: '当前播放器后续操作',
              duration: 8000,
              transitionWindowMs: 8000,
            })
          }
        >
          只采样后续操作
        </button>
        {open && (
          <button
            onClick={() => {
              setSampleSession(null);
              setOpen(false);
            }}
          >
            查看断言
          </button>
        )}
        <span data-testid="assertion-summary">
          断言 {results.filter((result) => result.pass).length}/{results.length}
        </span>
        {sampleSession && sampleSummary !== '尚未采样' && (
          <output
            className="fixture-samples"
            data-testid="animation-sample-summary"
            aria-live="polite"
          >
            {sampleSummary}
          </output>
        )}
      </div>
      <main className="fixture-report">
        <h1>剧情卡切换与行内 tag 动作</h1>
        <p>
          使用生产 PlayTestModal、默认渲染样式、两组内嵌 SVG 素材。无真实项目数据，无 AI
          调用。更换模式或起点会从头重播。
        </p>
        <h2>观察顺序</h2>
        <ol>
          <li>
            第一张：白天与蓝衣入场；段落内的场景与人物依次切到夜景、橙衣，再回到白天、蓝衣。粗体与斜体正文保留。
          </li>
          <li>
            点击进入第二张：旧人物先滑出、旧场景淡出；同一 source
            的夜景与橙衣重新入场，然后切回白天与蓝衣。
          </li>
          <li>
            第三张没有任何正文：隐藏的嵌套标签仍依次执行夜景 → 白天、橙衣 →
            蓝衣。动作完成后才能继续。
          </li>
          <li>
            每种模式分别重播；动作中点击对话区、快速后退或重启，检查旧动作计时器不会污染新一轮播放。
          </li>
        </ol>
        <h2>真实 RichText 标签视觉小样</h2>
        <p>{selectedTag}</p>
        <div className="fixture-tag-example" data-theme="light">
          <RichText
            value={richTextExample}
            onChange={setRichTextExample}
            onMentionContextMenu={(_event, mention) =>
              setSelectedTag(
                `已点击 ${mention.kind}: ${mention.name} / ${mention.id} / ${mention.placement}`,
              )
            }
          />
        </div>
        <div className="fixture-tag-example" data-theme="dark">
          <RichText
            value={richTextExample}
            onChange={setRichTextExample}
            onMentionContextMenu={(_event, mention) =>
              setSelectedTag(
                `已点击 ${mention.kind}: ${mention.name} / ${mention.id} / ${mention.placement}`,
              )
            }
          />
        </div>
        <h2>同步解析断言</h2>
        <table>
          <tbody>
            {results.map((result) => (
              <tr key={result.name} data-testid="parser-assertion" data-pass={result.pass}>
                <td style={{ color: result.pass ? '#047857' : '#b91c1c', fontWeight: 800 }}>
                  {result.pass ? 'PASS' : 'FAIL'}
                </td>
                <td>
                  {result.name}
                  {result.error && <pre>{result.error}</pre>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
      {open && (
        <div className="fixture-player">
          <PlayTestModal key={`${start}-${interactionMode}-${restart}`} {...props} />
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
