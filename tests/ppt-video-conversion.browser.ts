import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
} from 'mediabunny';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { toPowerPointMp4Blob } from '../src/components/render/ppt/pptVideoConversion';
import { toPptVideoData } from '../src/components/render/ppt/pptMedia';
import { registerBlobAsset } from '../src/lib/blobAssetRegistry';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const results = document.querySelector<HTMLPreElement>('#results')!;
const log = (message: string) => {
  results.textContent += `${message}\n`;
};

async function fixture(format: 'mp4' | 'webm' | 'mov', codec: 'avc' | 'vp8' | 'vp9', audio = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  const target = new BufferTarget();
  const output = new Output({
    target,
    format:
      format === 'webm'
        ? new WebMOutputFormat()
        : format === 'mov'
          ? new MovOutputFormat()
          : new Mp4OutputFormat(),
  });
  const videoSource = new CanvasSource(canvas, { codec, bitrate: 500000 });
  output.addVideoTrack(videoSource);
  const audioSource = audio
    ? new AudioBufferSource({ codec: format === 'webm' ? 'opus' : 'aac', bitrate: 128000 })
    : undefined;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = 'rgb(40, 140, 220)';
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = 'white';
    ctx.fillRect(i * 8, 60, 30, 30);
    await videoSource.add(i / 10, 0.1);
  }
  videoSource.close();
  if (audioSource) {
    const sound = new AudioBuffer({ numberOfChannels: 1, length: 96000, sampleRate: 48000 });
    const samples = sound.getChannelData(0);
    for (let i = 0; i < samples.length; i++)
      samples[i] = Math.sin((i * 2 * Math.PI * 440) / 48000) * 0.2;
    await audioSource.add(sound);
    audioSource.close();
  }
  await output.finalize();
  return new Blob([target.buffer!], {
    type: format === 'webm' ? 'video/webm' : format === 'mov' ? 'video/quicktime' : 'video/mp4',
  });
}

async function verify(blob: Blob, audio: boolean) {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    assert((await input.getFormat()).mimeType === 'video/mp4', 'wrong container');
    const video = await input.getPrimaryVideoTrack();
    const sound = await input.getPrimaryAudioTrack();
    assert(video?.codec === 'avc', 'video must be H.264');
    assert(audio ? sound?.codec === 'aac' : !sound, 'audio presence/codec changed');
    assert(Math.abs((await input.computeDuration()) - 2) < 0.1, 'duration changed');
    const frame = await new CanvasSink(video!).getCanvas(0.5);
    assert(
      frame && frame.canvas.width === 320 && frame.canvas.height === 180,
      'cannot decode output frame',
    );
    const pixel = frame!.canvas.getContext('2d')!.getImageData(300, 150, 1, 1).data;
    assert(pixel[2] > 150 && pixel[1] > 80, 'output frame lost its content');
    if (sound) {
      const buffer = await new AudioBufferSink(sound).getBuffer(0.5);
      assert(
        buffer && buffer.buffer.getChannelData(0).some((sample) => Math.abs(sample) > 0.05),
        'output is silent',
      );
    }
  } finally {
    input.dispose();
  }
}

document.querySelector<HTMLButtonElement>('#run')!.onclick = async () => {
  const button = document.querySelector<HTMLButtonElement>('#run')!;
  button.disabled = true;
  results.textContent = '';
  try {
    const compatible = await fixture('mp4', 'avc');
    const unchanged = await toPowerPointMp4Blob(compatible);
    assert(unchanged === compatible, 'compatible MP4 was rewritten');
    await verify(unchanged, true);
    log('PASS H.264/AAC MP4 keeps exact original bytes');
    const generic = await toPowerPointMp4Blob(
      new Blob([compatible], { type: 'application/octet-stream' }),
    );
    assert(
      generic.type === 'video/mp4' && generic.size === compatible.size,
      'generic MIME normalisation failed',
    );
    await verify(generic, true);
    log('PASS generic MIME is recognised by actual tracks');
    const webm = await fixture('webm', 'vp8');
    const converted = await toPowerPointMp4Blob(webm);
    await verify(converted, true);
    log('PASS WebM VP8/Opus -> MP4 H.264/AAC with picture, sound and duration');
    await verify(await toPowerPointMp4Blob(await fixture('webm', 'vp8', false)), false);
    log('PASS silent WebM remains silent with a working H.264 picture');
    await verify(await toPowerPointMp4Blob(await fixture('mp4', 'vp9')), true);
    log('PASS VP9 inside MP4 is transcoded instead of bypassed by extension');
    await verify(await toPowerPointMp4Blob(await fixture('mov', 'avc')), true);
    log('PASS H.264/AAC MOV is remuxed to MP4');
    // Exercise the bundled WASM fallback without changing browser settings.
    const nativeCheck = AudioEncoder.isConfigSupported;
    AudioEncoder.isConfigSupported = async (config) =>
      config.codec.startsWith('mp4a')
        ? { supported: false, config }
        : nativeCheck.call(AudioEncoder, config);
    try {
      await verify(await toPowerPointMp4Blob(webm), true);
    } finally {
      AudioEncoder.isConfigSupported = nativeCheck;
    }
    log('PASS bundled AAC WASM fallback retains sound without native AAC encoding');
    for (const blob of [new Blob([]), new Blob(['invalid'], { type: 'video/mp4' })]) {
      let rejected = false;
      try {
        await toPowerPointMp4Blob(blob);
      } catch {
        rejected = true;
      }
      assert(rejected, 'invalid video was accepted');
    }
    log('PASS empty and invalid media fail explicitly');
    let browserRejected = false;
    try {
      await toPowerPointMp4Blob(webm, false);
    } catch {
      browserRejected = true;
    }
    assert(browserRejected, 'browser conversion restriction changed');
    log('PASS browser export keeps its existing conversion restriction');

    // Test the desktop export route; any accidental Tauri/FFmpeg invocation fails.
    const runtime = window as Window & { __TAURI__?: unknown };
    const originalRuntime = runtime.__TAURI__;
    runtime.__TAURI__ = {
      core: {
        invoke: () => {
          throw new Error('Unexpected native invocation');
        },
      },
    };
    const url = URL.createObjectURL(webm);
    registerBlobAsset(url, webm);
    let data: string | undefined;
    try {
      data = await toPptVideoData(url);
    } finally {
      runtime.__TAURI__ = originalRuntime;
      URL.revokeObjectURL(url);
    }
    assert(data?.startsWith('data:video/mp4;base64,'), 'desktop export returned wrong MIME');
    const pptx = new PptxGenJS();
    pptx.addSlide().addMedia({ type: 'video', data: data!, x: 0, y: 0, w: 4, h: 2.25 });
    const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'arraybuffer' }));
    const embedded = Object.values(zip.files).find((file) =>
      /^ppt\/media\/.*\.mp4$/.test(file.name),
    );
    assert(embedded, 'PPTX contains no MP4');
    await verify(new Blob([await embedded!.async('arraybuffer')], { type: 'video/mp4' }), true);
    log('PASS desktop PPTX embeds decodable H.264/AAC with no native invocation');
    log(
      'ALL CHECKS PASSED (Chrome; packaged desktop and PowerPoint playback require separate validation)',
    );
  } catch (error) {
    log(`FAIL ${error instanceof Error ? error.stack : String(error)}`);
  } finally {
    button.disabled = false;
  }
};
