import type { SegmentRenderInfo } from '../shared/types';
import { encodeWav, fetchArrayBuffer } from '../shared/mediaUtils';

export const buildAudioTrack = async (segments: SegmentRenderInfo[], speed: number) => {
  const totalDuration = segments.reduce((sum, segment) => sum + segment.durationSecs, 0);
  if (totalDuration <= 0) return undefined;

  const sampleRate = 48000;
  const context = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);
  let cursor = 0;
  let hasAudio = false;

  for (const segment of segments) {
    const mediaUrl = segment.audioUrl || segment.videoUrl;
    if (mediaUrl) {
      try {
        const bytes = await fetchArrayBuffer(mediaUrl);
        const decoded = await context.decodeAudioData(bytes.slice(0));
        const source = context.createBufferSource();
        source.buffer = decoded;
        source.playbackRate.value = speed;
        source.connect(context.destination);
        source.start(cursor, 0, Math.min(decoded.duration, segment.durationSecs * speed));
        hasAudio = true;
      } catch (error) {
        console.warn('Could not decode render audio track:', error);
      }
    }
    cursor += segment.durationSecs;
  }

  if (!hasAudio) return undefined;
  const rendered = await context.startRendering();
  return encodeWav(rendered);
};
