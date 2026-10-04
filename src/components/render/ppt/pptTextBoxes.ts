import type { PptTextBoxLayout, PptTextOverrideTarget } from '../video/shared/types';

export const PPT_DEFAULT_TEXT_BOX_LAYOUTS: Record<PptTextOverrideTarget, PptTextBoxLayout> = {
  'cover-title': {
    x: 170, y: 320, width: 620, height: 220, rotation: 0, visible: true,
    webStyle: { fontSize: 84, fontWeight: 800, textColor: '#252a49', textAlign: 'left', lineHeight: 1.15, letterSpacing: 1.5 },
  },
  'cover-subtitle': {
    x: 172, y: 784, width: 526, height: 48, rotation: 0, visible: true,
    webStyle: { fontSize: 22, fontWeight: 400, textColor: '#777c97', textAlign: 'left', lineHeight: 1.4 },
  },
  'cover-description': {
    x: 172, y: 588, width: 610, height: 112, rotation: 0, visible: true,
    webStyle: { fontSize: 30, fontWeight: 400, textColor: '#5f6684', textAlign: 'left', lineHeight: 1.6 },
  },
  'dialog-title': { x: 0, y: 0, width: 1920, height: 120, rotation: 0, visible: true },
  'dialog-body': { x: 0, y: 0, width: 1920, height: 360, rotation: 0, visible: true },
  nameplate: { x: 0, y: 0, width: 480, height: 80, rotation: 0, visible: true },
};

const previousCoverFrames = {
  'cover-title': [160, 330, 720, 130],
  'cover-subtitle': [160, 485, 620, 56],
  'cover-description': [160, 555, 660, 90],
} as const;

export const resolvePptTextBoxLayout = (
  layout: Partial<PptTextBoxLayout> | undefined,
  target: PptTextOverrideTarget,
): PptTextBoxLayout => {
  const defaults = PPT_DEFAULT_TEXT_BOX_LAYOUTS[target];
  const previous = previousCoverFrames[target as keyof typeof previousCoverFrames];
  const untouchedPrevious = previous && layout && !layout.webStyle && !layout.rotation &&
    [layout.x, layout.y, layout.width, layout.height].every((value, index) => value === previous[index]);
  if (untouchedPrevious) return { ...defaults, visible: layout.visible ?? defaults.visible };
  return {
    ...defaults, ...layout,
    ...(defaults.webStyle || layout?.webStyle
      ? { webStyle: { ...defaults.webStyle, ...layout?.webStyle } }
      : {}),
  };
};
