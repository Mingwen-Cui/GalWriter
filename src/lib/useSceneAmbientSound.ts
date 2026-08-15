import type { Node } from '@xyflow/react';
import { useEffect, useMemo, useRef } from 'react';

import type { SceneNodeData } from '../domain/project';
import { resolveSceneAmbientPresetUrl } from './sceneTemplates';

const fadeAudio = (audio: HTMLAudioElement, from: number, to: number, seconds: number, done?: () => void) => {
  const duration = Math.max(0, seconds) * 1000;
  if (!duration) {
    audio.volume = to;
    done?.();
    return () => {};
  }
  const startedAt = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    audio.volume = from + (to - from) * progress;
    if (progress < 1) frame = requestAnimationFrame(tick);
    else done?.();
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
};

const sceneForStory = (nodes: Node[], story: Node | null | undefined) => {
  const sourceNodeId = (story?.data?.presentation as { scene?: { sourceNodeId?: string } } | undefined)
    ?.scene?.sourceNodeId;
  const scene = sourceNodeId
    ? nodes.find((node) => node.id === sourceNodeId && node.type === 'sceneNode')
    : undefined;
  return scene?.data as SceneNodeData | undefined;
};

/** Plays optional scene ambience independently from the existing region BGM channel. */
export const useSceneAmbientSound = (
  nodes: Node[],
  currentStoryNode: Node | null | undefined,
  enabled = true,
) => {
  const scene = useMemo(() => sceneForStory(nodes, currentStoryNode), [currentStoryNode, nodes]);
  const activeRef = useRef<{ key: string; audio: HTMLAudioElement; cancelFade?: () => void } | null>(null);

  useEffect(() => {
    const sound = enabled && scene?.scenePresetEnabled ? scene.ambientSound : undefined;
    const key = sound?.enabled ? `${sound.source}:${sound.presetId || sound.libraryItemId || sound.url || ''}` : '';
    const active = activeRef.current;
    let cancelled = false;

    const stop = (entry: NonNullable<typeof activeRef.current>, after?: () => void) => {
      entry.cancelFade?.();
      entry.cancelFade = fadeAudio(entry.audio, entry.audio.volume, 0, scene?.ambientSound?.fadeOut ?? 0.8, () => {
        entry.audio.pause();
        entry.audio.src = '';
        if (activeRef.current === entry) activeRef.current = null;
        after?.();
      });
    };

    const start = async () => {
      if (!sound?.enabled) return;
      const url = sound.source === 'preset' ? await resolveSceneAmbientPresetUrl(sound) : sound.url;
      if (cancelled || !url) return;
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.loop = sound.loop !== false;
      const targetVolume = Math.max(0, Math.min(1, Number(sound.volume ?? 0.45)));
      audio.volume = sound.fadeIn > 0 ? 0 : targetVolume;
      activeRef.current = { key, audio };
      void audio.play().catch(() => undefined);
      activeRef.current.cancelFade = fadeAudio(audio, audio.volume, targetVolume, sound.fadeIn ?? 0.8);
    };

    if (active?.key === key && key) return;
    if (active) stop(active, () => void start());
    else void start();

    return () => {
      cancelled = true;
    };
  }, [enabled, scene]);

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
