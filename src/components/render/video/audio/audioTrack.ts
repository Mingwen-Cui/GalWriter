import type { SegmentRenderInfo } from '../shared/types';
import { encodeWav, fetchArrayBuffer } from '../shared/mediaUtils';

export const buildAudioBuffer = async (
  segments: SegmentRenderInfo[],
  speed: number,
): Promise<AudioBuffer | undefined> => {
  const hasExplicitStart = segments.some((segment) => segment.startSecs !== undefined);
  const totalDuration = hasExplicitStart
    ? Math.max(
        0,
        ...segments.map((segment) => (segment.startSecs || 0) + segment.durationSecs),
      )
    : segments.reduce((sum, segment) => sum + segment.durationSecs, 0);
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
        const startAt = segment.startSecs ?? cursor;
        source.start(startAt, 0, Math.min(decoded.duration, segment.durationSecs * speed));
        hasAudio = true;
      } catch (error) {
        console.warn('Could not decode render audio track:', error);
      }
    }
    cursor += segment.durationSecs;
  }

  if (!hasAudio) return undefined;
  return context.startRendering();
};

export const buildAudioTrack = async (segments: SegmentRenderInfo[], speed: number) => {
  const audioBuffer = await buildAudioBuffer(segments, speed);
  if (!audioBuffer) return undefined;
  return encodeWav(audioBuffer);
};
