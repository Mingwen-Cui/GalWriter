import React from 'react';
import '../src/index.css';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Node } from '@xyflow/react';
import JSZip from 'jszip';
import { useRegionBackgroundMusic } from '../src/lib/useRegionBackgroundMusic';
import { useVideoExport } from '../src/components/render/video/VideoRenderModal/useVideoExport';
import { usePreviewAudio } from '../src/components/render/video/VideoRenderModal/usePreviewAudio';
import { buildRegionMusicSegments } from '../src/components/render/video/audio/regionMusicTrack';
import { buildAudioBuffer } from '../src/components/render/video/audio/audioTrack';
import { encodeWav } from '../src/components/render/video/shared/mediaUtils';
import { DEFAULT_RENDER_STYLE } from '../src/components/render/video/VideoRenderModal/workspaceStorage';
import { buildUniversalWebTemplate } from '../src/components/render/web/universalExperienceTemplate';
import { buildInteractiveWebZipBlob } from '../src/components/render/web/webExport';
import { buildPptxBuffer } from '../src/components/render/ppt/pptExport';

const resultEl = document.getElementById('results')!;
const results: string[] = [];
const assert = (condition: unknown, label: string) => { if (!condition) throw new Error(label); results.push(label); resultEl.textContent = results.join('\n'); };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const root = createRoot(document.getElementById('root')!);
const card = (id: string, x = 10): Node => ({ id, type: 'storyNode', position: { x, y: 10 }, measured: { width: 300, height: 200 }, data: { title: id, text: id, isRoot: id === 'a' } });
const a = card('a'), b = card('b'), outside = card('outside', 900);
const region: Node = { id: 'region', type: 'backgroundNode', position: { x: 0, y: 0 }, style: { width: 600, height: 400 }, data: { backgroundMusic: { url: 'a.mp3', name: 'Test BGM', loop: true, volume: 0.5, fadeIn: 0, fadeOut: 0.1 } } };
const other: Node = { ...region, id: 'other', position: { x: 800, y: 0 }, data: { backgroundMusic: { ...(region.data.backgroundMusic as any), url: 'b.mp3' } } };
let videoApi: ReturnType<typeof useVideoExport>;
let previewApi: ReturnType<typeof usePreviewAudio>;
const canvas = document.createElement('canvas');
function Hooks({ nodes, current }: { nodes: Node[]; current: Node | null }) {
  useRegionBackgroundMusic(nodes, current);
  previewApi = usePreviewAudio({ speed: 1, status: 'idle' });
  return null;
}
function Video({ nodes }: { nodes: Node[] }) {
  videoApi = useVideoExport({
    canvasRef: { current: canvas }, nodes, selectedNodes: [a, b, outside], activeAudioSegments: [],
    status: 'idle', language: 'en', isZh: false, isDesktopApp: false,
    resolution: { width: 320, height: 180 }, frameRate: 12, exportFormat: 'mp4', outputDir: '', speed: 1,
    renderStyle: DEFAULT_RENDER_STYLE,
    getNodeRenderDuration: async () => 2,
    getSegmentAudioSources: node => node.data.audioUrl ? [{ kind: 'voice', url: String(node.data.audioUrl) }] : [],
    drawFrame: async (ctx, node) => { ctx.fillStyle = node.id === 'outside' ? '#111' : '#456'; ctx.fillRect(0, 0, 320, 180); ctx.fillStyle = '#fff'; ctx.fillText(node.id, 20, 40); },
    setStatus() {}, setError(error: any) { if (typeof error === 'string' && error) throw new Error(error); }, setSavedPath() {}, setProgress() {}, setProgressValue() {},
  });
  return null;
}
const bytes = async (blob: Blob) => Array.from(new Uint8Array(await blob.arrayBuffer()));
const rms = (buffer: AudioBuffer, start: number, end: number) => {
  const data = buffer.getChannelData(0); let sum = 0, n = 0;
  for (let i = Math.round(start * buffer.sampleRate); i < Math.min(data.length, end * buffer.sampleRate); i++) { sum += data[i] ** 2; n++; }
  return Math.sqrt(sum / Math.max(1, n));
};

async function run() {
  const RealAudio = window.Audio;
  const tracks: any[] = [];
  class FakeAudio {
    src: string; paused = true; ended = false; volume = 1; loop = false; currentTime = 0; duration = 1; plays = 0;
    constructor(url: string) { this.src = url; tracks.push(this); }
    play() { this.paused = false; this.plays++; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  window.Audio = FakeAudio as any;
  const show = (current: Node | null, nodes = [region, a, b, outside, other]) => flushSync(() => root.render(<Hooks nodes={nodes} current={current} />));
  show(a); show(b);
  assert(tracks.length === 1 && !tracks[0].paused, 'React playback: adjacent cards keep the same BGM');
  show(outside); await wait(30); show(a); await wait(150);
  assert(tracks.length === 1 && !tracks[0].paused && tracks[0].volume === 0.5, 'React playback: A → B → A cancels stale transition');
  tracks[0].paused = true; tracks[0].ended = true;
  const nonloopRegion = { ...region, data: { backgroundMusic: { ...(region.data.backgroundMusic as any), loop: false } } };
  const plays = tracks[0].plays;
  show(b, [nonloopRegion, a, b]);
  assert(tracks[0].plays === plays, 'React playback: finished non-looping BGM stays stopped');
  const nextRegion = { ...other, data: { backgroundMusic: { ...(other.data.backgroundMusic as any), fadeOut: 0.1 } } };
  show(outside, [region, a, b, outside, nextRegion]); await wait(30);
  show({ ...outside }, [region, a, b, outside, nextRegion]); await wait(85);
  assert(tracks.length === 2 && tracks[0].paused && !tracks[1].paused, 'React playback: adjacent destination cards do not postpone the BGM switch');
  // Preview audio uses relative URLs in the real timeline. Its cache must not recreate them each frame.
  await previewApi.syncPreviewAudioSegments([{ key: 'preview', audioUrl: '/tone.wav', localTime: 0.2, loop: true, volume: 0.3 }], true);
  const preview = tracks.at(-1); preview.src = 'http://127.0.0.1:3011/tone.wav';
  await previewApi.syncPreviewAudioSegments([{ key: 'preview', audioUrl: '/tone.wav', localTime: 2.8, loop: true, volume: 0.3 }], true);
  assert(tracks.at(-1) === preview && Math.abs(preview.currentTime - 0.8) < 0.001 && preview.volume === 0.3, 'Video preview: relative URL cache, loop seek and BGM volume');
  flushSync(() => root.render(null));
  assert(tracks.every(track => track.paused), 'React unmount: all audio stops');
  window.Audio = RealAudio;

  const context = new OfflineAudioContext(1, 48000 * 8, 48000);
  const tone = context.createBuffer(1, 48000 * 8, 48000);
  const channel = tone.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.sin(2 * Math.PI * 220 * i / 48000) * (0.1 + 0.4 * i / channel.length);
  const toneUrl = URL.createObjectURL(new Blob([new Uint8Array(encodeWav(tone))], { type: 'audio/wav' }));
  const silence = context.createBuffer(1, 48000 * 2, 48000);
  const silenceUrl = URL.createObjectURL(new Blob([new Uint8Array(encodeWav(silence))], { type: 'audio/wav' }));
  a.data.audioUrl = silenceUrl; b.data.audioUrl = silenceUrl;
  region.data.backgroundMusic = { url: toneUrl, name: 'Test BGM', loop: true, volume: 0.5, fadeIn: 0, fadeOut: 0 };
  const nodes = [region, a, b, outside];
  const metrics = [a, b, outside].map((node, i) => ({ node, start: i * 2, duration: 2, end: i * 2 + 2 }));
  const bgm = buildRegionMusicSegments(nodes, metrics);
  const mixed = await buildAudioBuffer(bgm, 1, 6);
  assert(mixed && rms(mixed, 2.4, 2.6) > rms(mixed, 0.4, 0.6) * 1.6 && rms(mixed, 4.2, 5.8) === 0, 'Offline PCM: continuous BGM increases across card boundary and is silent outside');
  const fast = await buildAudioBuffer([{ ...bgm[0], durationSecs: 2 }], 2, 3);
  assert(fast && rms(fast, 1, 1.5) > 0 && rms(fast, 2.2, 2.8) === 0, 'Offline PCM: 2× speed preserves the BGM end boundary');
  const shortFade = await buildAudioBuffer([{ ...bgm[0], durationSecs: 0.5, fadeIn: 1, fadeOut: 1 }], 1, 1);
  assert(shortFade && rms(shortFade, 0.2, 0.3) > rms(shortFade, 0.01, 0.02) * 4 && rms(shortFade, 0.6, 0.9) === 0, 'Offline PCM: short clips have valid fade envelopes');

  flushSync(() => root.render(<Video nodes={nodes} />));
  const mp4 = await videoApi.renderVideo({ returnBytes: true });
  assert(mp4 && mp4.length > 1000, 'Actual single-video export: MP4 bytes generated');
  const { Input, BufferSource, ALL_FORMATS, AudioBufferSink } = await import('mediabunny');
  const input = new Input({ source: new BufferSource(mp4!), formats: ALL_FORMATS });
  const audioTrack = await input.getPrimaryAudioTrack();
  assert(audioTrack && Math.abs(await input.computeDuration() - 6) < 0.1, 'Actual MP4: AAC audio track and six-second video');
  const sink = new AudioBufferSink(audioTrack!);
  let before = 0, after = 0, tail = 0;
  for await (const sample of sink.buffers()) {
    if (sample.timestamp >= 0.4 && sample.timestamp < 0.6) before = Math.max(before, rms(sample.buffer, 0, sample.buffer.duration));
    if (sample.timestamp >= 2.4 && sample.timestamp < 2.6) after = Math.max(after, rms(sample.buffer, 0, sample.buffer.duration));
    if (sample.timestamp >= 4.2 && sample.timestamp < 5.8) tail = Math.max(tail, rms(sample.buffer, 0, sample.buffer.duration));
  }
  assert(after > before * 1.5 && tail < 0.001, 'Decoded exported MP4: BGM does not restart on card two and stops at four seconds');
  input.dispose();

  const template = buildUniversalWebTemplate('en', 'BGM boundary test');
  const settings: any = { ...template.settings, canvasWidth: 1920, canvasHeight: 1080, showStartMenu: false, autoAdvance: false, interactionMode: 'click', typewriterEnabled: false, startMenuBackgroundImageUrl: '', startMenuBackgroundMusicUrl: '', flowOverviewBackgroundMusicUrl: '', sceneBackgroundImageUrl: '', startMenuElements: [], settingsPageElements: [], archivePageElements: [] };
  const edges = [{ id: 'a-b', source: 'a', target: 'b' }, { id: 'b-outside', source: 'b', target: 'outside' }];
  const zipBlob = await buildInteractiveWebZipBlob(nodes, edges, { language: 'en', projectName: 'BGM boundary test', settings, style: { ...DEFAULT_RENDER_STYLE, choiceColor: '#fff', choiceTextColor: '#000' } });
  const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
  assert(Object.keys(zip.files).some(path => /audio\//.test(path)) && !!zip.file('index.html'), 'Actual Web ZIP: packaged BGM audio and standalone player');
  const pptSettings: any = { layout: 'LAYOUT_WIDE', branchMode: 'linear', density: 'balanced', includeCover: false, includeNotes: false };
  const pptx = await buildPptxBuffer({ nodes, edges, projectName: 'BGM boundary test', settings, style: DEFAULT_RENDER_STYLE, pptSettings, language: 'en' });
  const pptZip = await JSZip.loadAsync(pptx);
  const firstSlide = await pptZip.file('ppt/slides/slide1.xml')!.async('string');
  assert(firstSlide.includes('<p:audio') && firstSlide.includes('numSld="2"') && !(await pptZip.file('ppt/slides/slide3.xml')!.async('string')).includes('<p:audio'), 'Actual PPTX: BGM is embedded for slides one and two, outside slide has no BGM');
  const { VideoRenderModal } = await import('../src/components/render/video/VideoRenderModal/VideoRenderModal');
  const { writeRenderWorkspaceState } = await import('../src/components/render/video/VideoRenderModal/workspaceStorage');
  writeRenderWorkspaceState('bgm-test', { workspaceMode: 'video', defaultSeconds: 2, pptSettings, timelineIds: ['a', 'b', 'outside'], selectedIds: ['a', 'b', 'outside'], timelineDurationById: { a: 2, b: 2, outside: 2 }, timelineStartById: { a: 0, b: 2, outside: 4 } });
  let workspaceApi: any;
  flushSync(() => root.render(<VideoRenderModal nodes={nodes} edges={edges} language="zh" workspaceKey="bgm-test" renderStyle={DEFAULT_RENDER_STYLE} updateRenderStyle={() => {}} onClose={() => {}} onMcpWorkspaceApiChange={api => { workspaceApi = api; }} />));
  await wait(300);
  const clips = document.querySelectorAll('[data-region-music-clip-id]');
  assert(clips.length === 1 && clips[0].textContent?.includes('Test BGM') && clips[0].textContent?.includes('0:04'), 'Single-video workspace: BGM automatically appears as one continuous four-second audio clip');
  flushSync(() => workspaceApi.openWorkspace({ workspaceMode: 'ppt', entryMode: 'story' }));
  await wait(300);
  const nativeClick = HTMLAnchorElement.prototype.click;
  let captured: Promise<ArrayBuffer> | undefined;
  HTMLAnchorElement.prototype.click = function() { captured = fetch(this.href).then(response => response.arrayBuffer()); };
  try {
    const exported = await workspaceApi.exportPptx({ story_node_ids: ['a', 'b', 'outside'], project_name: 'Scoped BGM test' });
    const scopedZip = captured ? await JSZip.loadAsync(await captured) : null;
    assert(exported?.exported && scopedZip && (await scopedZip.file('ppt/slides/slide1.xml')!.async('string')).includes('<p:audio'), 'MCP selected-path PPT export: retains the background card so BGM is not dropped');
  } finally { HTMLAnchorElement.prototype.click = nativeClick; }
  const { PptExportDialog } = await import('../src/components/render/video/panels/PptExportDialog');
  const { getPptRegionMusicWarnings } = await import('../src/components/render/ppt/pptRegionMusic');
  const warnings = getPptRegionMusicWarnings([region, other, a, b, outside], edges, pptSettings, 'zh');
  flushSync(() => root.render(<PptExportDialog language="zh" isDesktopApp={false} projectName="BGM test" defaultProjectName="BGM test" outputDir="" outputDirError="" settings={pptSettings} warnings={warnings} onClose={() => {}} onConfirm={() => {}} onProjectNameChange={() => {}} onSettingsChange={() => {}} onChooseOutputDir={() => {}} />));
  assert(document.querySelector('[role="status"]')?.textContent?.includes('同时播放'), 'PPT export dialog: visible compatibility warning for multiple BGM or other audio');
  (window as any).__bgmResults = { results, files: { 'region-music.mp4': Array.from(mp4!), 'region-music-web.zip': await bytes(zipBlob), 'region-music.pptx': Array.from(new Uint8Array(pptx)) } };
  resultEl.textContent += '\nALL PASSED';
}
run().catch(error => { resultEl.textContent += '\nFAILED: ' + error.stack; (window as any).__bgmError = error.stack; });
