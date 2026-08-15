import type { CSSProperties } from 'react';

import type { SceneVisualStyle } from '../domain/project';
import { normalizeSceneVisualStyle } from './sceneTemplates';

const lightingFilter = (lighting: SceneVisualStyle['lighting'], strength: number) => {
  const amount = strength / 100;
  switch (lighting) {
    case 'warm-lamp':
      return `brightness(${1 + amount * 0.05}) sepia(${amount * 0.18}) saturate(${1 + amount * 0.12})`;
    case 'cool-fluorescent':
      return `brightness(${1 + amount * 0.04}) contrast(${1 + amount * 0.08}) saturate(${1 - amount * 0.08})`;
    case 'neon-side-light':
      return `brightness(${1 - amount * 0.04}) contrast(${1 + amount * 0.18}) saturate(${1 + amount * 0.28}) hue-rotate(${amount * 10}deg)`;
    case 'golden-hour':
      return `brightness(${1 + amount * 0.03}) sepia(${amount * 0.28}) saturate(${1 + amount * 0.16})`;
    case 'overcast-rain':
      return `brightness(${1 - amount * 0.1}) saturate(${1 - amount * 0.3}) contrast(${1 - amount * 0.04})`;
    case 'night-street':
      return `brightness(${1 - amount * 0.18}) contrast(${1 + amount * 0.13}) saturate(${1 + amount * 0.1}) hue-rotate(${amount * 7}deg)`;
    default:
      return '';
  }
};

const presetFilter = (filter: SceneVisualStyle['filter'], strength: number) => {
  const amount = strength / 100;
  switch (filter) {
    case 'clear':
      return `contrast(${1 + amount * 0.07}) saturate(${1 + amount * 0.06})`;
    case 'warm-film':
      return `sepia(${amount * 0.24}) contrast(${1 + amount * 0.07}) saturate(${1 + amount * 0.08})`;
    case 'cool-cinematic':
      return `contrast(${1 + amount * 0.14}) saturate(${1 - amount * 0.1}) hue-rotate(${amount * 4}deg)`;
    case 'neon':
      return `contrast(${1 + amount * 0.19}) saturate(${1 + amount * 0.34}) hue-rotate(${amount * 12}deg)`;
    case 'muted-rain':
      return `saturate(${1 - amount * 0.44}) contrast(${1 - amount * 0.08}) brightness(${1 - amount * 0.06})`;
    case 'night-blue':
      return `brightness(${1 - amount * 0.14}) contrast(${1 + amount * 0.12}) saturate(${1 - amount * 0.04}) hue-rotate(${amount * 15}deg)`;
    default:
      return '';
  }
};

/** Shared CSS/canvas filter recipe for every presentation target. */
export const getSceneVisualFilter = (style: SceneVisualStyle | undefined) => {
  if (!style) return 'none';
  const normalized = normalizeSceneVisualStyle(style);
  const values = [
    normalized.backgroundBlur > 0 ? `blur(${normalized.backgroundBlur}px)` : '',
    lightingFilter(normalized.lighting, normalized.intensity),
    presetFilter(normalized.filter, normalized.intensity),
  ].filter(Boolean);
  return values.length ? values.join(' ') : 'none';
};

export const getSceneVisualMediaStyle = (
  style: SceneVisualStyle | undefined,
): Pick<CSSProperties, 'filter' | 'transform'> => {
  if (!style) return { filter: 'none', transform: '' };
  const normalized = normalizeSceneVisualStyle(style);
  return {
    filter: getSceneVisualFilter(normalized),
    // A tiny overscan prevents blurred image edges from showing around the stage.
    transform: normalized.backgroundBlur > 0 ? `scale(${1 + Math.min(0.06, normalized.backgroundBlur / 100)})` : '',
  };
};
