import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import type { Node } from '@xyflow/react';

import { resolveRegionBackgroundMusic } from '../src/lib/regionMusic';
import { buildRegionMusicSegments } from '../src/components/render/video/audio/regionMusicTrack';
import { buildPptRegionMusicRuns, getPptRegionMusicWarnings } from '../src/components/render/ppt/pptRegionMusic';
import { finalizePptxForPowerPoint } from '../src/components/render/ppt/pptxCompatibility';
import type { PptExportSettings } from '../src/components/render/video/shared/types';

const story = (id: string, x = 0): Node => ({
  id, type: 'storyNode', position: { x, y: 0 }, measured: { width: 300, height: 200 }, data: {},
});
const region = (id: string, url = 'a.mp3'): Node => ({
  id, type: 'backgroundNode', position: { x: 0, y: 0 },
  style: { width: 500, height: 400 },
  data: { backgroundMusic: { url, loop: true, volume: 0.5, fadeIn: 0, fadeOut: 1 } },
});

test('region membership includes the last inside card and excludes the first outside card', () => {
  const nodes = [region('region'), story('last', 340), story('outside', 360)];
  assert.equal(resolveRegionBackgroundMusic(nodes, nodes[1])?.regionId, 'region');
  assert.equal(resolveRegionBackgroundMusic(nodes, nodes[2]), null);
});

// Exercise the actual script shipped inside the exported HTML, including its fade scheduler.
const exportedPlayer = () => {
  const file = readFileSync(new URL('../src/components/render/web/webExport/webExportHtml.ts', import.meta.url), 'utf8');
  const script = file.slice(file.indexOf('    function fadeRegionAudio('), file.indexOf('    function fadeSceneAmbient('));
  let now = 0;
  let frameId = 0;
  const frames = new Map<number, (time: number) => void>();
  const audios: any[] = [];
  class Audio {
    src: string; paused = true; ended = false; volume = 1; _musicLevel = 1; plays = 0;
    constructor(src: string) { this.src = src; audios.push(this); }
    play() { this.paused = false; this.ended = false; this.plays++; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const context = vm.createContext({
    Audio, performance: { now: () => now },
    requestAnimationFrame: (fn: (time: number) => void) => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    window: { addEventListener() {}, removeEventListener() {} },
    settings: { soundEnabled: true },
    setMusicLevel: (audio: any, level: number) => { audio._musicLevel = level; audio.volume = level; },
  });
  vm.runInContext('let regionAudio = null, regionAudioKey = "", regionFadeFrame = 0, regionUnlockCleanup = null;\n' + script, context);
  const music = (url: string, overrides = {}) => ({ url, regionId: url, loop: true, volume: 0.5, fadeIn: 0, fadeOut: 1, ...overrides });
  return {
    audios, music,
    sync: (value: unknown) => context.syncRegionMusic(value),
    advance: (ms: number) => { now += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); },
  };
};

test('exported Web: A -> B -> A before fade completes never starts stale B', () => {
  const player = exportedPlayer();
  player.sync(player.music('a.mp3'));
  player.sync(player.music('b.mp3'));
  player.advance(200);
  player.sync(player.music('a.mp3'));
  player.advance(1500);
  assert.equal(player.audios.length, 1);
  assert.equal(player.audios[0].paused, false);
  assert.equal(player.audios[0].volume, 0.5);
});

test('exported Web: same-region card changes do not restart a finished non-looping track', () => {
  const player = exportedPlayer();
  const music = player.music('a.mp3', { loop: false });
  player.sync(music);
  player.audios[0].paused = true;
  player.audios[0].ended = true;
  player.sync(music);
  assert.equal(player.audios[0].plays, 1);
});

test('exported Web: rapid A -> B -> outside leaves all tracks stopped', () => {
  const player = exportedPlayer();
  player.sync(player.music('a.mp3'));
  player.sync(player.music('b.mp3'));
  player.advance(200);
  player.sync(null);
  player.advance(1500);
  assert.equal(player.audios.length, 1);
  assert.ok(player.audios.every(audio => audio.paused));
});

test('exported Web: cards at the same destination do not postpone the outgoing fade', () => {
  const player = exportedPlayer();
  player.sync(player.music('a.mp3'));
  player.sync(player.music('b.mp3'));
  player.advance(200);
  player.sync(player.music('b.mp3'));
  player.advance(800);
  assert.equal(player.audios[0].paused, true);
  assert.equal(player.audios[1]?.src, 'b.mp3');
  player.sync(null);
  player.advance(200);
  player.sync(null);
  player.advance(800);
  assert.ok(player.audios.every(audio => audio.paused));
});

const metric = (node: Node, start: number, duration = 2) => ({ node, start, duration, end: start + duration });
const pptSettings = { branchMode: 'linear' } as PptExportSettings;

test('video: voice audio on every card does not split continuous region music', () => {
  const cards = [story('a'), story('b'), story('outside', 600)];
  cards.forEach(card => { card.data.audioUrl = 'voice.wav'; });
  const segments = buildRegionMusicSegments([region('region'), ...cards], cards.map((card, i) => metric(card, i * 2)));
  assert.equal(segments.length, 1);
  assert.equal(segments[0].startSecs, 0);
  assert.equal(segments[0].durationSecs, 4);
  assert.equal(segments[0].loop, true);
});

test('video: gaps and leaving/reentering a region produce separate BGM runs', () => {
  const a = story('a'), outside = story('outside', 600), b = story('b');
  const nodes = [region('region'), a, outside, b];
  const segments = buildRegionMusicSegments(nodes, [metric(a, 0), metric(outside, 2), metric(b, 4), metric(b, 8)]);
  assert.deepEqual(segments.map(segment => [segment.startSecs, segment.durationSecs]), [[0, 2], [4, 2], [8, 2]]);
});

test('video: overlapping cards in one region share one BGM instead of doubling its volume', () => {
  const a = story('a'), b = story('b');
  const segments = buildRegionMusicSegments([region('region'), a, b], [metric(a, 0, 4), metric(b, 2, 4), metric(a, 3, 1)]);
  assert.deepEqual(segments.map(segment => [segment.startSecs, segment.durationSecs]), [[0, 6]]);
});

test('video: cloned group cards retain original group membership', () => {
  const a = story('a');
  const group = { ...region('group'), type: 'groupNode', data: { ...region('group').data, childIds: ['a'] } };
  const clone = { ...a, id: 'a::clip-1', position: { x: 900, y: 900 }, data: { timelineSourceNodeId: 'a' } };
  assert.equal(buildRegionMusicSegments([a, group], [metric(clone, 0)])[0]?.node.data.regionId, 'group');
});

test('video: same URL in different regions remains two runs', () => {
  const a = story('a'), b = story('b', 700);
  const secondRegion = { ...region('second'), position: { x: 700, y: 0 } };
  assert.equal(buildRegionMusicSegments([a, b, region('first'), secondRegion], [metric(a, 0), metric(b, 2)]).length, 2);
});

test('PPT: BGM runs respect final slide order, manual pages, hidden pages and region exit', () => {
  const nodes = [region('region'), story('a'), story('b'), story('outside', 600)];
  const runs = buildPptRegionMusicRuns(nodes, ['b', 'a', 'manual', 'outside', 'b'], pptSettings);
  assert.deepEqual(runs.map(run => [run.slideId, run.slideCount]), [['b', 2], ['b', 1]]);
  const hidden = buildPptRegionMusicRuns(nodes, ['a', 'outside', 'b'], { ...pptSettings, hiddenSlideIds: ['outside'] });
  assert.deepEqual(hidden.map(run => [run.slideId, run.slideCount]), [['a', 2]]);
});

test('PPT: interactive pages and choices have their own bounded BGM', () => {
  const runs = buildPptRegionMusicRuns([region('region'), story('a'), story('b')], ['a', 'choice:a', 'b'], { branchMode: 'interactive' } as PptExportSettings);
  assert.deepEqual(runs.map(run => [run.slideId, run.slideCount]), [['a', 1], ['choice:a', 1], ['b', 1]]);
});

test('PPT: compatibility messages are localised and absent when no exported BGM is present', () => {
  const a = story('a'), b = story('b', 700);
  const nodes = [region('first'), { ...region('second'), position: { x: 700, y: 0 } }, a, b];
  for (const language of ['zh', 'en', 'ja'] as const) {
    assert.equal(getPptRegionMusicWarnings(nodes, [], pptSettings, language).length, 2);
    assert.equal(getPptRegionMusicWarnings(nodes, [], { ...pptSettings, deletedSlideIds: ['a', 'b'] }, language).length, 0);
  }
});

test('PPT: embedded BGM has native autoplay, loop, volume and a bounded cross-slide range', async () => {
  const Constructor = (PptxGenJS as any).default || PptxGenJS;
  const pptx = new Constructor();
  const slide = pptx.addSlide();
  slide.addText('Title');
  slide.addText('Body');
  slide.addText('Footer');
  slide.addMedia({ type: 'audio', data: 'audio/wav;base64,UklGRgQAAABXQVZF', extn: 'wav', objectName: 'region-bgm', x: -1, y: -1, w: 0.2, h: 0.2 });
  pptx.addSlide().addText('Same region');
  pptx.addSlide().addText('Outside');
  const buffer = await finalizePptxForPowerPoint(await pptx.write({ outputType: 'arraybuffer' }), [], [], [], [], [{ slideNumber: 1, objectName: 'region-bgm', loop: true, volume: 0.4, slideCount: 2 }]);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(xml, /<p:audio isNarration="0">/);
  assert.match(xml, /<a:audioFile r:link=/);
  assert.doesNotMatch(xml, /<a:videoFile/);
  const shapeIds = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(match => match[1]);
  assert.equal(new Set(shapeIds).size, shapeIds.length);
  assert.match(xml, /vol="40000" numSld="2"/);
  assert.match(xml, /repeatCount="indefinite"/);
  assert.match(xml, /nodeType="withEffect"><p:stCondLst><p:cond delay="0"/);
  assert.match(await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string'), /relationships\/audio/);
  assert.ok(Object.keys(zip.files).some(path => /ppt\/media\/.*\.wav$/.test(path)));
  assert.doesNotMatch(await zip.file('ppt/slides/slide3.xml')!.async('string'), /<p:audio/);
});
