import { encodeWav, fetchArrayBuffer } from '../shared/mediaUtils';
import type { SegmentRenderInfo } from '../shared/types';

export const buildAudioBuffer = async (
  segments: SegmentRenderInfo[],
  speed: number,
  targetDuration?: number,
): Promise<AudioBuffer | undefined> => {
  const hasExplicitStart = segments.some((segment) => segment.startSecs !== undefined);
  const contentDuration = hasExplicitStart
    ? Math.max(0, ...segments.map((segment) => (segment.startSecs || 0) + segment.durationSecs))
    : segments.reduce((sum, segment) => sum + segment.durationSecs, 0);
  const totalDuration = targetDuration && targetDuration > 0 ? targetDuration : contentDuration;
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
        const gain = context.createGain();
        source.buffer = decoded;
        source.playbackRate.value = speed;
        source.loop = segment.loop === true;
        source.connect(gain);
        gain.connect(context.destination);
        const startAt = segment.startSecs ?? cursor;
        const remainingDuration = Math.max(0, totalDuration - startAt);
        const playbackDuration = Math.min(segment.durationSecs, remainingDuration);
        const sourceDuration = segment.loop
          ? playbackDuration * speed
          : Math.min(decoded.duration, playbackDuration * speed);
        if (sourceDuration <= 0) continue;
        const volume = Math.min(1, Math.max(0, segment.volume ?? 1));
        const fadeIn = Math.min(playbackDuration, Math.max(0, segment.fadeIn ?? 0));
        const fadeOut = Math.min(playbackDuration, Math.max(0, segment.fadeOut ?? 0));
        gain.gain.setValueAtTime(fadeIn > 0 ? 0 : volume, startAt);
        if (fadeIn > 0) {
          gain.gain.linearRampToValueAtTime(volume, startAt + fadeIn);
        }
        if (fadeOut > 0) {
          const fadeOutAt = Math.max(startAt + fadeIn, startAt + playbackDuration - fadeOut);
          gain.gain.setValueAtTime(volume, fadeOutAt);
          gain.gain.linearRampToValueAtTime(0, startAt + playbackDuration);
        }
        source.start(startAt, 0, sourceDuration);
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

export const buildAudioTrack = async (
  segments: SegmentRenderInfo[],
  speed: number,
  targetDuration?: number,
) => {
  const audioBuffer = await buildAudioBuffer(segments, speed, targetDuration);
  if (!audioBuffer) return undefined;
  return encodeWav(audioBuffer);
};
