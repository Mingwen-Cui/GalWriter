import type { PptAnimationTarget, PptObjectAnimation } from '../video/shared/types';

type TimedPptObjectAnimation = PptObjectAnimation & { timelineStartMs?: number };
const animationKey = (target: PptAnimationTarget, targetId?: string) =>
  `${target}:${targetId || ''}`;

export const findAnimation = (
  animations: PptObjectAnimation[],
  target: PptAnimationTarget,
  targetId?: string,
) =>
  animations.filter(
    (item) => animationKey(item.target, item.targetId) === animationKey(target, targetId),
  );

/**
 * A nameplate belongs to the character that supplies its displayed name.
 * Keep an explicit nameplate animation authoritative, otherwise project the
 * speaker character's animation onto the nameplate so both objects enter and
 * leave together.
 */
export const syncNameplateAnimations = (
  animations: PptObjectAnimation[],
  speakerCharacterId?: string,
) => {
  if (!speakerCharacterId || animations.some((item) => item.target === 'nameplate')) {
    return animations;
  }
  return animations.flatMap((item) => {
    if (item.target !== 'character' || item.targetId !== speakerCharacterId) return [item];
    return [
      item,
      {
        ...item,
        id: `${item.id}:nameplate`,
        source: 'tag' as const,
        target: 'nameplate' as const,
        targetId: undefined,
        start: item.phase === 'enter' ? 'withPrevious' : item.start,
      },
    ];
  });
};

export const previewStyle = (
  animations: PptObjectAnimation[],
  previewing: boolean,
  previewAtMs?: number,
): React.CSSProperties => {
  if (!animations.length || (!previewing && previewAtMs === undefined)) return {};
  const animationName = (item: PptObjectAnimation) => {
    const phase = item.phase || 'enter';
    if (phase === 'emphasis' && item.action) {
      const middleNames: Record<string, string> = {
        'shake-x': 'ppt-middle-shake-x',
        'shake-y': 'ppt-middle-shake-y',
        translate: 'ppt-middle-translate',
        scale: 'ppt-middle-scale',
        pulse: 'ppt-middle-pulse',
        rotate: 'ppt-middle-rotate',
        opacity: 'ppt-middle-opacity',
        brightness: 'ppt-middle-brightness',
        switch: 'ppt-middle-switch',
      };
      return middleNames[item.action] || `ppt-${item.effect}`;
    }
    if (item.effect === 'line')
      return `ppt-line-${phase === 'exit' ? 'out-' : ''}${item.direction}`;
    const out = phase === 'exit' ? '-out' : '';
    const suffix = item.effect === 'fly' || item.effect === 'wipe' ? `-${item.direction}` : '';
    if (item.effect === 'fade' || item.effect === 'appear' || item.effect === 'zoom')
      return `ppt-${item.effect}${out}`;
    if (item.effect === 'fly' || item.effect === 'wipe') return `ppt-${item.effect}${out}${suffix}`;
    return `ppt-${item.effect}${suffix}`;
  };
  const cssVariables: Record<string, string> = {};
  return {
    animation: animations
      .map((item) => {
        const start = (item as TimedPptObjectAnimation).timelineStartMs ?? item.delayMs;
        const delay = previewAtMs === undefined || previewing ? start : start - previewAtMs;
        const repeats = item.phase === 'emphasis' ? Math.max(1, Math.round(item.repeats || 1)) : 1;
        const duration = Math.max(1, Math.round(item.durationMs / repeats));
        const strength = Math.max(0, Math.min(100, item.strength ?? 10));
        cssVariables['--inline-action-strength'] = `${Math.max(0, item.strength ?? 10)}px`;
        cssVariables['--inline-action-opacity'] = String(strength / 100);
        cssVariables['--inline-action-brightness'] = String(strength / 100);
        if (item.action === 'translate') {
          cssVariables['--ppt-action-x'] = `${item.offsetX || item.strength || 12}px`;
          cssVariables['--ppt-action-y'] = `${item.offsetY || 8}px`;
        }
        if (item.action === 'scale')
          cssVariables['--ppt-action-scale'] = String(item.scale || 1.08);
        if (item.action === 'rotate')
          cssVariables['--ppt-action-rotation'] = `${item.strength || 15}deg`;
        if (item.action === 'opacity')
          cssVariables['--ppt-action-opacity'] = String(strength / 100);
        if (item.action === 'brightness')
          cssVariables['--ppt-action-brightness'] = String(strength / 100);
        return `${animationName(item)} ${duration}ms ease ${delay}ms ${repeats} both`;
      })
      .join(', '),
    animationPlayState: previewAtMs === undefined || previewing ? undefined : 'paused',
    ...cssVariables,
  };
};
