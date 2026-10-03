import type { CSSProperties } from 'react';

import type {
  PptAnimationDirection,
  PptSlideTransition,
  PptTransitionEffect,
} from '../video/shared/types';

// Microsoft Open XML: push/wipe use ST_TransitionSideDirectionType,
// reveal uses ST_TransitionLeftRightDirectionType, split uses orient + in/out,
// and randomBar uses horizontal/vertical. Cut/fade/morph have no direction.
export const PPT_TRANSITION_DIRECTIONS: Record<
  PptTransitionEffect,
  readonly PptAnimationDirection[]
> = {
  none: [],
  smooth: [],
  fade: [],
  cut: [],
  split: [],
  randomBars: [],
  push: ['left', 'right', 'up', 'down'],
  wipe: ['left', 'right', 'up', 'down'],
  reveal: ['left', 'right'],
};

export const normalizePptTransition = (transition: PptSlideTransition): PptSlideTransition => {
  const allowed = PPT_TRANSITION_DIRECTIONS[transition.effect];
  const direction =
    allowed.length && !allowed.includes(transition.direction) ? allowed[0] : transition.direction;
  // Preserve the axis of projects saved with the old four-arrow control.
  const horizontal = transition.direction === 'left' || transition.direction === 'right';
  return {
    ...transition,
    direction,
    orientation: transition.orientation || (horizontal ? 'horizontal' : 'vertical'),
    splitDirection: transition.splitDirection || 'out',
  };
};

export const pptTransitionPreviewStyle = (transition: PptSlideTransition): CSSProperties => {
  const value = normalizePptTransition(transition);
  if (value.effect === 'none') return {};
  let name = `ppt-transition-${value.effect}`;
  if (value.effect === 'push' || value.effect === 'wipe' || value.effect === 'reveal') {
    name += `-${value.direction}`;
  } else if (value.effect === 'split') {
    name += `-${value.orientation}-${value.splitDirection}`;
  } else if (value.effect === 'randomBars') {
    name = `ppt-transition-bars-${value.orientation}`;
  }
  return { animation: `${name} ${value.effect === 'cut' ? 1 : value.durationMs}ms ease both` };
};
