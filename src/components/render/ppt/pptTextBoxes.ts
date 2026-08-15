import type {
  PptTextBoxLayout,
  PptTextOverrideTarget,
} from '../video/shared/types';

export const PPT_DEFAULT_TEXT_BOX_LAYOUTS: Record<PptTextOverrideTarget, PptTextBoxLayout> = {
  'cover-title': { x: 480, y: 390, width: 960, height: 130, rotation: 0, visible: true },
  'cover-subtitle': { x: 600, y: 545, width: 720, height: 56, rotation: 0, visible: true },
  'dialog-title': { x: 0, y: 0, width: 1920, height: 120, rotation: 0, visible: true },
  'dialog-body': { x: 0, y: 0, width: 1920, height: 360, rotation: 0, visible: true },
  nameplate: { x: 0, y: 0, width: 480, height: 80, rotation: 0, visible: true },
};

export const resolvePptTextBoxLayout = (
  layout: Partial<PptTextBoxLayout> | undefined,
  target: PptTextOverrideTarget,
): PptTextBoxLayout => ({ ...PPT_DEFAULT_TEXT_BOX_LAYOUTS[target], ...layout });
