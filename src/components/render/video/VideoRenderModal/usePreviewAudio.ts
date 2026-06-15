import { useCallback, useEffect, useRef } from 'react';

import type { RenderStatus } from '../shared/types';

export type PreviewAudioSegment = {
  key: string;
  audioUrl: string;
  localTime: number;
};

export const usePreviewAudio = ({
  status,
  speed,
}: {
  status: RenderStatus;
  speed: number;
}) => {
  const audioByKeyRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const stopPreviewAudio = useCallback(() => {
    audioByKeyRef.current.forEach((audio) => audio.pause());
    audioByKeyRef.current.clear();
  }, []);

  const syncPreviewAudioSegments = useCallback(
    async (segments: PreviewAudioSegment[], shouldPlay: boolean) => {
      if (status === 'rendering' || segments.length === 0) {
        stopPreviewAudio();
        return;
      }

      const desiredKeys = new Set(segments.map((segment) => segment.key));
      audioByKeyRef.current.forEach((audio, key) => {
        if (desiredKeys.has(key)) return;
        audio.pause();
        audioByKeyRef.current.delete(key);
      });

      for (const segment of segments) {
        let audio = audioByKeyRef.current.get(segment.key);
        if (!audio || audio.src !== segment.audioUrl) {
          audio?.pause();
          audio = new Audio(segment.audioUrl);
          audio.crossOrigin = 'anonymous';
          audioByKeyRef.current.set(segment.key, audio);
        }

        audio.playbackRate = speed;
        const targetTime = Math.max(0, segment.localTime);
        const nextTime = Number.isFinite(audio.duration)
          ? Math.min(Math.max(0, audio.duration - 0.05), targetTime)
          : targetTime;
        if (!shouldPlay || audio.paused || Math.abs(audio.currentTime - nextTime) > 0.35) {
          audio.currentTime = nextTime;
        }

        if (shouldPlay) await audio.play().catch(() => undefined);
        else audio.pause();
      }
    },
    [speed, status, stopPreviewAudio],
  );

  useEffect(() => stopPreviewAudio, [stopPreviewAudio]);

  return { stopPreviewAudio, syncPreviewAudioSegments };
};
