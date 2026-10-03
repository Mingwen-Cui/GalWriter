import type { PptObjectAnimation } from '../video/shared/types';

export const pptTimelineStarts = (animations: PptObjectAnimation[]) => {
  let previousStart = 0;
  let previousDuration = 0;
  return animations.map((animation) => {
    const start =
      previousStart +
      (animation.start === 'withPrevious' ? 0 : previousDuration) +
      animation.delayMs;
    previousStart = start;
    previousDuration = animation.durationMs;
    return start;
  });
};

// Move the selected clips by the same amount. Rebase relative delays so moving
// three consecutive effects does not apply the offset three times. Dependent
// effects follow their predecessor when their existing gap cannot absorb it.
export const movePptTimelineAnimations = (
  animations: PptObjectAnimation[],
  ids: string[],
  deltaMs: number,
) => {
  const selected = new Set(ids);
  const starts = pptTimelineStarts(animations);
  const chosen = starts.filter((_, index) => selected.has(animations[index].id));
  if (!chosen.length) return animations;
  const delta = Math.max(-Math.min(...chosen), Math.round(deltaMs));
  let previousStart = 0;
  let previousDuration = 0;
  return animations.map((animation, index) => {
    const base = previousStart + (animation.start === 'withPrevious' ? 0 : previousDuration);
    const desired = starts[index] + (selected.has(animation.id) ? delta : 0);
    const delayMs = Math.max(0, Math.round(desired - base));
    previousStart = base + delayMs;
    previousDuration = animation.durationMs;
    return delayMs === animation.delayMs ? animation : { ...animation, delayMs };
  });
};

export const savePptTimelineOverrides = (
  saved: PptObjectAnimation[],
  changes: PptObjectAnimation[],
) => {
  const key = (item: PptObjectAnimation) =>
    `${item.target}:${item.targetId || ''}:${item.phase || 'enter'}`;
  const overrides = new Map(saved.map((item) => [key(item), item]));
  changes.forEach((item) => {
    const { timelineStartMs: _timelineStartMs, ...authored } = item as PptObjectAnimation & {
      timelineStartMs?: number;
    };
    overrides.set(key(item), { ...authored, source: 'manual' });
  });
  return [...overrides.values()];
};

export const deletePptTimelineAnimations = (
  saved: PptObjectAnimation[],
  removed: PptObjectAnimation[],
) =>
  // Explicit phase overrides also suppress tag/default effects after reopening.
  savePptTimelineOverrides(
    saved,
    removed.map((item) => ({ ...item, effect: 'none' })),
  );
