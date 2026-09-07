import type JSZip from 'jszip';

import { resolveKnownAppAssetUrl } from '../../../../../../lib/appAssets';
import type { AssetEntry } from '../../types';

type PackedAudio = { path: string; rate: number; channels: number; frames: number };
type PackedMedia = { kind: string; path?: string; audio?: PackedAudio; frames?: string[]; fps?: number; duration?: number };

const canvasBlob = (canvas: HTMLCanvasElement | OffscreenCanvas, type: string, quality?: number): Promise<Blob> => {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image encoding failed.')), type, quality));
};

// Raw PCM has no import/codec dependency in Godot. The runtime constructs an
// AudioStreamWAV with this metadata, including after an executable is exported.
const packAudio = (zip: JSZip, id: string, buffer: AudioBuffer): PackedAudio => {
  const channels = Math.min(2, buffer.numberOfChannels);
  const bytes = new ArrayBuffer(buffer.length * channels * 2);
  const view = new DataView(bytes);
  for (let channel = 0; channel < channels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < samples.length; index++) {
      const value = Math.max(-1, Math.min(1, samples[index]));
      view.setInt16((index * channels + channel) * 2, value < 0 ? value * 32768 : value * 32767, true);
    }
  }
  const path = `assets/godot/${id}.gwpcm`;
  zip.file(path, bytes);
  return { path: `res://${path}`, rate: buffer.sampleRate, channels, frames: buffer.length };
};

export const packageGodotAssets = async (zip: JSZip, assets: AssetEntry[]) => {
  const media: Record<string, PackedMedia> = {};
  const audioContext = new OfflineAudioContext(2, 1, 48000);
  // Sequential conversion bounds decoder memory; never silently omit a failed asset.
  for (const asset of assets.filter((item) => item.referenced)) {
    try {
      const response = await fetch(resolveKnownAppAssetUrl(asset.source));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      // Retain editable original media alongside the portable playback assets.
      zip.file(`assets/${asset.path}`, await blob.arrayBuffer());
      if (asset.kind === 'image') {
        const bitmap = await createImageBitmap(blob);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Cannot create image canvas.');
          context.drawImage(bitmap, 0, 0);
          const path = `assets/godot/${asset.id}.gwimage`;
          zip.file(path, await (await canvasBlob(canvas, 'image/png')).arrayBuffer());
          media[asset.path] = { kind: 'image', path: `res://${path}` };
        } finally { bitmap.close(); }
      } else if (asset.kind === 'audio') {
        media[asset.path] = { kind: 'audio', audio: packAudio(zip, asset.id, await audioContext.decodeAudioData(await blob.arrayBuffer())) };
      } else {
        const { Input, BlobSource, ALL_FORMATS, CanvasSink, AudioBufferSink } = await import('mediabunny');
        const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
        try {
          const video = await input.getPrimaryVideoTrack();
          if (!video || !await video.canDecode()) throw new Error('This browser cannot decode the video codec.');
          const duration = await video.computeDuration();
          if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid video duration.');
          const fps = 24;
          const sink = new CanvasSink(video, { width: Math.min(1280, video.displayWidth), poolSize: 1 });
          const frames: string[] = [];
          const timestamps = (function* () { for (let index = 0; index < Math.ceil(duration * fps); index++) yield index / fps; })();
          let firstFrame: string | undefined;
          for await (const frame of sink.canvasesAtTimestamps(timestamps)) {
            if (!frame) { frames.push(frames.at(-1) || ''); continue; }
            const path = `assets/godot/${asset.id}/${frames.length.toString().padStart(7, '0')}.gwframe`;
            zip.file(path, await (await canvasBlob(frame.canvas, 'image/jpeg', 0.9)).arrayBuffer());
            const resourcePath = `res://${path}`;
            firstFrame ||= resourcePath;
            frames.push(resourcePath);
          }
          if (!firstFrame) throw new Error('Video contains no decodable frames.');
          for (let index = 0; index < frames.length && !frames[index]; index++) frames[index] = firstFrame;
          let audio: PackedAudio | undefined;
          const track = await input.getPrimaryAudioTrack();
          if (track) {
            if (!await track.canDecode()) throw new Error('This browser cannot decode the video audio codec.');
            // Keep track timestamps, including initial silence, synchronized with video.
            const mixed = audioContext.createBuffer(2, Math.max(1, Math.ceil(duration * 48000)), 48000);
            for await (const chunk of new AudioBufferSink(track).buffers(0, duration)) {
              const from = Math.max(0, Math.ceil(chunk.timestamp * 48000));
              const end = Math.min(mixed.length, Math.ceil((chunk.timestamp + chunk.duration) * 48000));
              for (let channel = 0; channel < 2; channel++) {
                const source = chunk.buffer.getChannelData(Math.min(channel, chunk.buffer.numberOfChannels - 1));
                const target = mixed.getChannelData(channel);
                for (let index = from; index < end; index++) {
                  const offset = Math.floor((index / 48000 - chunk.timestamp) * chunk.buffer.sampleRate);
                  target[index] = source[Math.max(0, Math.min(source.length - 1, offset))] || 0;
                }
              }
            }
            audio = packAudio(zip, `${asset.id}-soundtrack`, mixed);
          }
          media[asset.path] = { kind: 'video', frames, fps, duration, audio };
        } finally { input.dispose(); }
      }
    } catch (error) {
      throw new Error(`Godot 素材转换失败（节点 ${asset.sourceNodeIds.join(', ')}，${asset.path}）：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  zip.file('game/media.json', `${JSON.stringify(media)}\n`);
};
