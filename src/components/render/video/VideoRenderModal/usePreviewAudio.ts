import { useCallback, useEffect, useRef } from 'react';

import type { RenderStatus } from '../shared/types';

export type PreviewAudioSegment = {
  key: string;
  audioUrl: string;
  localTime: number;
  loop?: boolean;
  volume?: number;
  duration?: number;
  fadeIn?: number;
  fadeOut?: number;
};

export const usePreviewAudio = ({
  status,
  speed,
}: {
  status: RenderStatus;
  speed: number;
}) => {
  const audioByKeyRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const syncVersionRef = useRef(0);
  const sourceByKeyRef = useRef<Map<string, string>>(new Map());

  const stopPreviewAudio = useCallback(() => {
    syncVersionRef.current++;
    audioByKeyRef.current.forEach((audio) => audio.pause());
    audioByKeyRef.current.clear();
    sourceByKeyRef.current.clear();
  }, []);

  const syncPreviewAudioSegments = useCallback(
    async (segments: PreviewAudioSegment[], shouldPlay: boolean) => {
      const version = ++syncVersionRef.current;
      if (status === 'rendering' || segments.length === 0) {
        stopPreviewAudio();
        return;
      }

      const desiredKeys = new Set(segments.map((segment) => segment.key));
      audioByKeyRef.current.forEach((audio, key) => {
        if (desiredKeys.has(key)) return;
        audio.pause();
        audioByKeyRef.current.delete(key);
        sourceByKeyRef.current.delete(key);
      });

      for (const segment of segments) {
        let audio = audioByKeyRef.current.get(segment.key);
        if (version !== syncVersionRef.current) return;
        if (!audio || sourceByKeyRef.current.get(segment.key) !== segment.audioUrl) {
          audio?.pause();
          audio = new Audio(segment.audioUrl);
          audio.crossOrigin = 'anonymous';
          audioByKeyRef.current.set(segment.key, audio);
          sourceByKeyRef.current.set(segment.key, segment.audioUrl);
        }

        audio.playbackRate = speed;
        audio.loop = segment.loop === true;
        const duration = Math.min(segment.duration ?? Infinity,
          !segment.loop && Number.isFinite(audio.duration) ? audio.duration : Infinity);
        const fadeTotal = (segment.fadeIn || 0) + (segment.fadeOut || 0);
        const fadeScale = fadeTotal > duration ? duration / fadeTotal : 1;
        const fadeIn = (segment.fadeIn || 0) * fadeScale;
        const fadeOut = (segment.fadeOut || 0) * fadeScale;
        audio.volume = Math.max(0, Math.min(1, segment.volume ?? 1)) * Math.max(0, Math.min(
          1, fadeIn > 0 ? segment.localTime / fadeIn : 1,
          fadeOut > 0 ? (duration - segment.localTime) / fadeOut : 1,
        ));
        const targetTime = Math.max(0, segment.localTime);
        const nextTime = Number.isFinite(audio.duration)
          ? segment.loop && audio.duration > 0
            ? targetTime % audio.duration
            : Math.min(audio.duration, targetTime)
          : targetTime;
        if (!shouldPlay || audio.paused || Math.abs(audio.currentTime - nextTime) > 0.35) {
          audio.currentTime = nextTime;
        }

        if (shouldPlay && !(Number.isFinite(audio.duration) && !segment.loop && targetTime >= audio.duration))
          await audio.play().catch(() => undefined);
        else audio.pause();
      }
    },
    [speed, status, stopPreviewAudio],
  );

  useEffect(() => stopPreviewAudio, [stopPreviewAudio]);

  return { stopPreviewAudio, syncPreviewAudioSegments };
};
