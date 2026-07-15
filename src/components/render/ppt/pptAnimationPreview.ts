import type { PptAnimationTarget, PptObjectAnimation } from '../video/shared/types';

type TimedPptObjectAnimation = PptObjectAnimation & { timelineStartMs?: number };
const animationKey = (target: PptAnimationTarget, targetId?: string) => `${target}:${targetId || ''}`;

export const findAnimation = (
  animations: PptObjectAnimation[],
  target: PptAnimationTarget,
  targetId?: string,
) => animations.filter((item) => animationKey(item.target, item.targetId) === animationKey(target, targetId));

export const previewStyle = (
  animations: PptObjectAnimation[],
  previewing: boolean,
  previewAtMs?: number,
): React.CSSProperties => {
  if (!animations.length || (!previewing && previewAtMs === undefined)) return {};
  const animationName = (item: PptObjectAnimation) => {
    const phase = item.phase || 'enter';
    if (item.effect === 'line') return `ppt-line-${phase === 'exit' ? 'out-' : ''}${item.direction}`;
    const suffix = item.effect === 'fly' || item.effect === 'wipe' ? `-${item.direction}` : '';
    return `ppt-${item.effect}${suffix}`;
  };
  return {
    animation: animations
      .map((item) => {
        const start = (item as TimedPptObjectAnimation).timelineStartMs ?? item.delayMs;
        const delay = previewAtMs === undefined || previewing ? start : start - previewAtMs;
        return `${animationName(item)} ${item.durationMs}ms ease ${delay}ms both`;
      })
      .join(', '),
    animationPlayState: previewAtMs === undefined || previewing ? undefined : 'paused',
  };
};
