import type { CSSProperties } from 'react';

import type {
  WebButtonMotion,
  WebButtonMotionEasing,
  WebButtonMotionState,
  WebMenuElement,
} from '../video/shared/types';

export type ResolvedWebButtonMotionState = Required<WebButtonMotionState>;
export type ResolvedWebButtonMotion = Omit<Required<WebButtonMotion>, 'hover' | 'pressed'> & {
  hover: ResolvedWebButtonMotionState;
  pressed: ResolvedWebButtonMotionState;
};

export type WebButtonMotionPreset = 'none' | 'soft' | 'strong';

export const DEFAULT_WEB_BUTTON_MOTION: ResolvedWebButtonMotion = {
  hover: {
    enabled: true,
    scale: 1.03,
    translateX: 0,
    translateY: -2,
    rotate: 0,
    duration: 160,
    easing: 'ease-out',
    shadow: 'lift',
  },
  pressed: {
    enabled: true,
    scale: 0.96,
    translateX: 0,
    translateY: 1,
    rotate: 0,
    duration: 80,
    easing: 'ease-in',
    shadow: 'inset',
  },
  transformOrigin: 'center center',
};

export const buttonMotionForPreset = (preset: WebButtonMotionPreset): WebButtonMotion => {
  if (preset === 'none') {
    return {
      hover: {
        enabled: false,
        scale: 1,
        translateX: 0,
        translateY: 0,
        rotate: 0,
        duration: 120,
        easing: 'ease-out',
        shadow: 'none',
      },
      pressed: {
        enabled: false,
        scale: 1,
        translateX: 0,
        translateY: 0,
        rotate: 0,
        duration: 80,
        easing: 'ease-in',
        shadow: 'none',
      },
      transformOrigin: 'center center',
    };
  }
  if (preset === 'soft') {
    return {
      hover: {
        enabled: true,
        scale: 1.015,
        translateX: 0,
        translateY: -1,
        rotate: 0,
        duration: 140,
        easing: 'ease-out',
        shadow: 'lift',
      },
      pressed: {
        enabled: true,
        scale: 0.985,
        translateX: 0,
        translateY: 0,
        rotate: 0,
        duration: 90,
        easing: 'ease-in',
        shadow: 'inset',
      },
      transformOrigin: 'center center',
    };
  }
  return {
    hover: { ...DEFAULT_WEB_BUTTON_MOTION.hover },
    pressed: { ...DEFAULT_WEB_BUTTON_MOTION.pressed },
    transformOrigin: DEFAULT_WEB_BUTTON_MOTION.transformOrigin,
  };
};

export const resolveWebButtonMotionPreset = (value?: WebButtonMotion): WebButtonMotionPreset => {
  const motion = resolveWebButtonMotion(value);
  if (!motion.hover.enabled && !motion.pressed.enabled) return 'none';
  if (
    motion.hover.scale <= 1.02 &&
    Math.abs(motion.hover.translateY) <= 1 &&
    motion.pressed.scale >= 0.98
  )
    return 'soft';
  return 'strong';
};

const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

const easing = (value: WebButtonMotionEasing | undefined, fallback: WebButtonMotionEasing) =>
  value && ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'].includes(value)
    ? value
    : fallback;

const resolveState = (
  state: WebButtonMotionState | undefined,
  fallback: ResolvedWebButtonMotionState,
): ResolvedWebButtonMotionState => ({
  enabled: state?.enabled !== false,
  scale: clamp(Number(state?.scale), 0.85, 1.2, fallback.scale),
  translateX: clamp(Number(state?.translateX), -24, 24, fallback.translateX),
  translateY: clamp(Number(state?.translateY), -24, 24, fallback.translateY),
  rotate: clamp(Number(state?.rotate), -12, 12, fallback.rotate),
  duration: clamp(Number(state?.duration), 0, 1200, fallback.duration),
  easing: easing(state?.easing, fallback.easing),
  shadow: ['same', 'lift', 'inset', 'none'].includes(state?.shadow || '')
    ? (state?.shadow as Required<WebButtonMotionState>['shadow'])
    : fallback.shadow,
});

export const resolveWebButtonMotion = (value?: WebButtonMotion): ResolvedWebButtonMotion => ({
  hover: resolveState(value?.hover, DEFAULT_WEB_BUTTON_MOTION.hover),
  pressed: resolveState(value?.pressed, DEFAULT_WEB_BUTTON_MOTION.pressed),
  transformOrigin: value?.transformOrigin || DEFAULT_WEB_BUTTON_MOTION.transformOrigin,
});

const transformFor = (state: ResolvedWebButtonMotionState) =>
  `translate(${state.translateX}px, ${state.translateY}px) rotate(${state.rotate}deg) scale(${state.scale})`;

const shadowFor = (state: ResolvedWebButtonMotionState, baseShadow: string, fallback: string) => {
  if (state.shadow === 'none') return 'none';
  if (state.shadow === 'same') return baseShadow || 'none';
  if (state.shadow === 'lift') return '0 16px 32px rgba(15, 23, 42, 0.24)';
  if (state.shadow === 'inset') return 'inset 0 2px 7px rgba(15, 23, 42, 0.2)';
  return fallback;
};

export const webButtonMotionStyle = (
  element: WebMenuElement,
  baseShadow: string,
): CSSProperties => {
  const motion = resolveWebButtonMotion(element.buttonMotion);
  const shadowMode = element.buttonShadowMode || 'always';
  const visibleBaseShadow = shadowMode === 'always' ? baseShadow : 'none';
  const motionBaseShadow = shadowMode === 'none' ? 'none' : baseShadow;
  const identityTransform = 'translate(0px, 0px) rotate(0deg) scale(1)';
  const hoverTransform = motion.hover.enabled ? transformFor(motion.hover) : identityTransform;
  const pressedTransform = motion.pressed.enabled
    ? transformFor(motion.pressed)
    : identityTransform;
  const hoverShadow = shadowMode === 'none'
    ? 'none'
    : motion.hover.enabled
    ? shadowFor(motion.hover, motionBaseShadow, 'none')
    : baseShadow || 'none';
  const pressedShadow = shadowMode === 'none'
    ? 'none'
    : motion.pressed.enabled
    ? shadowFor(motion.pressed, motionBaseShadow, 'none')
    : baseShadow || 'none';
  const style = {
    '--gw-button-motion-origin': motion.transformOrigin,
    '--gw-button-motion-hover-transform': hoverTransform,
    '--gw-button-motion-pressed-transform': pressedTransform,
    '--gw-button-motion-hover-duration': `${motion.hover.duration}ms`,
    '--gw-button-motion-pressed-duration': `${motion.pressed.duration}ms`,
    '--gw-button-motion-hover-easing': motion.hover.easing,
    '--gw-button-motion-pressed-easing': motion.pressed.easing,
    '--gw-button-motion-hover-filter': motion.hover.enabled
      ? 'brightness(1.06) saturate(1.05)'
      : 'none',
    '--gw-button-motion-base-shadow': visibleBaseShadow || 'none',
    '--gw-button-motion-hover-shadow': hoverShadow,
    '--gw-button-motion-pressed-shadow': pressedShadow,
  } as CSSProperties;
  return style;
};

export const WEB_BUTTON_MOTION_CSS = `
[data-gw-button-motion="true"] {
  transform-origin: var(--gw-button-motion-origin, center center);
  box-shadow: var(--gw-button-motion-base-shadow, none);
  transform: var(--gw-button-layout-transform, translate(0px, 0px) rotate(0deg) scale(1));
  transition: transform var(--gw-button-motion-hover-duration, 160ms) var(--gw-button-motion-hover-easing, ease-out), box-shadow var(--gw-button-motion-hover-duration, 160ms) var(--gw-button-motion-hover-easing, ease-out);
}
[data-gw-button-motion="true"]:hover {
  transform: var(--gw-button-layout-transform, translate(0px, 0px) rotate(0deg) scale(1)) var(--gw-button-motion-hover-transform, translate(0px, 0px) rotate(0deg) scale(1)) !important;
  filter: var(--gw-button-motion-hover-filter, none) !important;
  box-shadow: var(--gw-button-motion-hover-shadow, var(--gw-button-motion-base-shadow, none)) !important;
}
[data-gw-button-motion="true"]:active {
  transform: var(--gw-button-layout-transform, translate(0px, 0px) rotate(0deg) scale(1)) var(--gw-button-motion-pressed-transform, translate(0px, 0px) rotate(0deg) scale(1)) !important;
  box-shadow: var(--gw-button-motion-pressed-shadow, var(--gw-button-motion-base-shadow, none)) !important;
  transition-duration: var(--gw-button-motion-pressed-duration, 80ms);
  transition-timing-function: var(--gw-button-motion-pressed-easing, ease-in);
}
[data-gw-button-motion-editing="true"]:hover,
[data-gw-button-motion-editing="true"]:active {
  transform: var(--gw-button-layout-transform, translate(0px, 0px) rotate(0deg) scale(1)) !important;
  filter: none !important;
  box-shadow: var(--gw-button-motion-base-shadow, none) !important;
}
@media (prefers-reduced-motion: reduce) {
  [data-gw-button-motion="true"] {
    transition-duration: 0.01ms !important;
  }
}
`;
