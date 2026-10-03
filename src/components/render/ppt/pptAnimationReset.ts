import type { PptObjectAnimation, PptAnimationTarget } from '../video/shared/types';

export function clearPptObjectAnimations(
  animations: PptObjectAnimation[],
  slideId: string,
  target: PptAnimationTarget,
  targetId?: string,
): PptObjectAnimation[] {
  const retained = animations.filter(
    (item) => item.target !== target || item.targetId !== targetId,
  );
  // Persist explicit overrides so story-tag/default effects do not reappear on reopen or export.
  return [
    ...retained,
    ...(['enter', 'emphasis', 'exit'] as const).map((phase) => ({
      id: `${slideId}-${target}:${targetId || ''}-${phase}`,
      target,
      targetId,
      phase,
      source: 'manual' as const,
      effect: 'none' as const,
      start: 'withPrevious' as const,
      durationMs: 500,
      delayMs: 0,
      direction: 'left' as const,
    })),
  ];
}

export function filterPptDisabledAnimations(
  projected: PptObjectAnimation[],
  saved: PptObjectAnimation[],
) {
  return projected.filter(
    (item) =>
      !saved.some(
        (override) =>
          override.effect === 'none' &&
          override.target === item.target &&
          override.targetId === item.targetId &&
          (override.phase || 'enter') === (item.phase || 'enter'),
      ),
  );
}
