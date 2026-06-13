import type { ExportFormat } from '../shared/types';

export type FrameRenderFn = (frameIndex: number, timestamp: number) => Promise<void>;

export type RenderVideoToBufferOptions = {
  canvas: HTMLCanvasElement;
  format: ExportFormat;
  frameRate: number;
  totalFrames: number;
  drawFrame: FrameRenderFn;
  audioBuffer?: AudioBuffer;
  onProgress?: (current: number, total: number) => void;
  signal?: AbortSignal;
};

export async function renderVideoToBuffer(
  options: RenderVideoToBufferOptions,
): Promise<Uint8Array> {
  const {
    Output,
    Mp4OutputFormat,
    MovOutputFormat,
    MkvOutputFormat,
    BufferTarget,
    CanvasSource,
    AudioBufferSource,
    QUALITY_HIGH,
  } = await import('mediabunny');

  const outputFormat =
    options.format === 'mov'
      ? new MovOutputFormat()
      : options.format === 'mkv'
        ? new MkvOutputFormat()
        : new Mp4OutputFormat();

  const target = new BufferTarget();
  const output = new Output({ format: outputFormat, target });

  const videoSource = new CanvasSource(options.canvas, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource);

  let audioSource: InstanceType<typeof AudioBufferSource> | undefined;
  if (options.audioBuffer) {
    audioSource = new AudioBufferSource({
      codec: 'aac',
      bitrate: 128000,
    });
    output.addAudioTrack(audioSource);
  }

  try {
    options.signal?.throwIfAborted();
    await output.start();

    for (let i = 0; i < options.totalFrames; i++) {
      options.signal?.throwIfAborted();
      const timestamp = i / options.frameRate;
      await options.drawFrame(i, timestamp);
      options.signal?.throwIfAborted();
      await videoSource.add(timestamp, 1 / options.frameRate);
      options.onProgress?.(i + 1, options.totalFrames);
    }

    videoSource.close();

    if (audioSource && options.audioBuffer) {
      options.signal?.throwIfAborted();
      await audioSource.add(options.audioBuffer);
      audioSource.close();
    }

    options.signal?.throwIfAborted();
    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw error;
  }

  if (!target.buffer) {
    throw new Error('Failed to generate video buffer: target buffer is null.');
  }

  return new Uint8Array(target.buffer);
}
