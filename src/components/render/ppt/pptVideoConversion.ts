/** Materialise PowerPoint's recommended MP4 / H.264 / AAC combination locally. */
export async function toPowerPointMp4Blob(blob: Blob, allowConversion = true): Promise<Blob> {
  if (!blob.size) throw new Error('PPT video conversion received an empty file.');

  const {
    Input,
    ALL_FORMATS,
    BlobSource,
    Mp4InputFormat,
    Output,
    Mp4OutputFormat,
    BufferTarget,
    Conversion,
    canEncodeAudio,
  } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  let output: InstanceType<typeof Output> | undefined;
  try {
    const [format, video, audioTracks] = await Promise.all([
      input.getFormat(),
      input.getPrimaryVideoTrack(),
      input.getAudioTracks(),
    ]);
    if (!video) throw new Error('The source has no video track.');

    // MIME and extension alone cannot distinguish H.264 from HEVC, VP9 or AV1.
    // Already-compatible MP4s keep their exact bytes and require no encoders.
    if (
      format instanceof Mp4InputFormat &&
      video.codec === 'avc' &&
      audioTracks.every((track) => track.codec === 'aac')
    ) {
      return blob.type === 'video/mp4' ? blob : new Blob([blob], { type: 'video/mp4' });
    }
    if (!allowConversion) {
      throw new Error(
        'PPT video export in the browser supports MP4 (H.264/AAC) only. Use the desktop app to convert this video automatically.',
      );
    }

    const audio = await input.getPrimaryAudioTrack();
    if (
      audio &&
      audio.codec !== 'aac' &&
      !(await canEncodeAudio('aac', {
        numberOfChannels: Math.min(audio.numberOfChannels, 2),
        sampleRate: 48000,
        bitrate: 128000,
      }))
    ) {
      // The WASM encoder ships with the app; it needs no installed FFmpeg or CDN.
      const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
      registerAacEncoder();
    }

    const target = new BufferTarget();
    output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      showWarnings: false,
      video:
        video.codec === 'avc'
          ? { codec: 'avc' }
          : {
              codec: 'avc',
              width: Math.ceil(video.displayWidth / 2) * 2,
              height: Math.ceil(video.displayHeight / 2) * 2,
              fit: 'contain',
              allowRotationMetadata: false,
            },
      audio:
        audio?.codec === 'aac'
          ? { codec: 'aac' }
          : {
              codec: 'aac',
              numberOfChannels: Math.min(audio?.numberOfChannels ?? 2, 2),
              sampleRate: 48000,
              bitrate: 128000,
            },
    });
    // Mediabunny can otherwise succeed with just audio or silently drop sound.
    if (!conversion.isValid || conversion.discardedTracks.length) {
      const details = conversion.discardedTracks
        .map(({ track, reason }) => `${track.type} (${track.codec ?? 'unknown'}): ${reason}`)
        .join('; ');
      throw new Error(
        `This environment cannot convert every video/audio track to H.264/AAC MP4${details ? ` (${details})` : ''}.`,
      );
    }
    await conversion.execute();
    if (!target.buffer?.byteLength) throw new Error('The video conversion returned no data.');
    return new Blob([target.buffer], { type: 'video/mp4' });
  } catch (error) {
    await output?.cancel().catch(() => undefined);
    throw new Error(
      `Could not prepare the video for PowerPoint: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    input.dispose();
  }
}
