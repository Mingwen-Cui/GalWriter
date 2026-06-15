import type { Node } from '@xyflow/react';
import { useEffect, useMemo, useRef } from 'react';

import { resolveRegionBackgroundMusic } from './regionMusic';

const fadeAudio = (
  audio: HTMLAudioElement,
  from: number,
  to: number,
  seconds: number,
  onDone?: () => void,
) => {
  const duration = Math.max(0, seconds) * 1000;
  if (duration === 0) {
    audio.volume = to;
    onDone?.();
    return () => {};
  }

  const startedAt = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    audio.volume = from + (to - from) * progress;
    if (progress < 1) {
      frame = requestAnimationFrame(tick);
    } else {
      onDone?.();
    }
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
};

export const useRegionBackgroundMusic = (
  nodes: Node[],
  currentNode: Node | null | undefined,
  enabled = true,
) => {
  const match = useMemo(
    () => (enabled ? resolveRegionBackgroundMusic(nodes, currentNode) : null),
    [currentNode, enabled, nodes],
  );
  const activeRef = useRef<{
    key: string;
    audio: HTMLAudioElement;
    fadeOut: number;
    cancelFade?: () => void;
  } | null>(null);

  useEffect(() => {
    const nextKey = match ? `${match.regionId}:${match.music.url}` : '';
    const active = activeRef.current;

    if (active?.key === nextKey && match) {
      active.audio.loop = match.music.loop;
      active.audio.volume = match.music.volume;
      active.fadeOut = match.music.fadeOut;
      return;
    }

    const startNext = () => {
      if (!match) return;
      const audio = new Audio(match.music.url);
      audio.preload = 'auto';
      audio.loop = match.music.loop;
      audio.volume = match.music.fadeIn > 0 ? 0 : match.music.volume;
      const entry = {
        key: nextKey,
        audio,
        fadeOut: match.music.fadeOut,
        cancelFade: undefined as (() => void) | undefined,
      };
      activeRef.current = entry;
      audio.play().catch((error) => {
        console.info('Region background music autoplay was blocked', error);
      });
      entry.cancelFade = fadeAudio(audio, audio.volume, match.music.volume, match.music.fadeIn);
    };

    if (!active) {
      startNext();
      return;
    }

    active.cancelFade?.();
    active.cancelFade = fadeAudio(active.audio, active.audio.volume, 0, active.fadeOut, () => {
      active.audio.pause();
      active.audio.src = '';
      if (activeRef.current === active) activeRef.current = null;
      startNext();
    });
  }, [match]);

  useEffect(
    () => () => {
      const active = activeRef.current;
      if (!active) return;
      active.cancelFade?.();
      active.audio.pause();
      active.audio.src = '';
      activeRef.current = null;
    },
    [],
  );
};
