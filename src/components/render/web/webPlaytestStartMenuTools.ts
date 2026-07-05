import type { CSSProperties } from 'react';

import type { WebExportSettings } from '../video/shared/types';

export type StartMenuElement = WebExportSettings['startMenuElements'][number];
export type StartMenuResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type StartMenuAction = {
  key: string;
  label: string;
  disabled: boolean;
  primary: boolean;
  onClick: () => void;
};

export const resizeCursorByHandle: Record<StartMenuResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

export const resizeHandlePositionClass: Record<StartMenuResizeHandle, string> = {
  nw: '-left-1.5 -top-1.5',
  n: 'left-1/2 -top-1.5 -translate-x-1/2',
  ne: '-right-1.5 -top-1.5',
  e: '-right-1.5 top-1/2 -translate-y-1/2',
  se: '-bottom-1.5 -right-1.5',
  s: 'left-1/2 -bottom-1.5 -translate-x-1/2',
  sw: '-bottom-1.5 -left-1.5',
  w: '-left-1.5 top-1/2 -translate-y-1/2',
};

export const resizeHandleShapeClass: Record<StartMenuResizeHandle, string> = {
  nw: 'h-3 w-3 rounded-full',
  n: 'h-2 rounded-full',
  ne: 'h-3 w-3 rounded-full',
  e: 'w-2 rounded-full',
  se: 'h-3 w-3 rounded-full',
  s: 'h-2 rounded-full',
  sw: 'h-3 w-3 rounded-full',
  w: 'w-2 rounded-full',
};

export const getResizeHandleStyle = (handle: StartMenuResizeHandle): CSSProperties => {
  if (handle === 'n' || handle === 's') {
    return { width: 'min(72%, 120px)', minWidth: 24, cursor: resizeCursorByHandle[handle] };
  }
  if (handle === 'e' || handle === 'w') {
    return { height: 'min(72%, 120px)', minHeight: 24, cursor: resizeCursorByHandle[handle] };
  }
  return { cursor: resizeCursorByHandle[handle] };
};

export const readStartMenuImageFile = (file: File, onReady: (value: string) => void) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') onReady(reader.result);
  };
  reader.readAsDataURL(file);
};

export const protectedStartMenuElementRoles = new Set(['save', 'new', 'settings']);

export const buildDefaultStartMenuElements = ({
  settings,
  projectTitle,
  startMenuActions,
  choiceColor,
  choiceTextColor,
  defaultButtonX,
  defaultButtonY,
  defaultButtonWidth,
  buttonHeight,
  t,
}: {
  settings: WebExportSettings;
  projectTitle: string;
  startMenuActions: StartMenuAction[];
  choiceColor: string;
  choiceTextColor: string;
  defaultButtonX: number;
  defaultButtonY: number;
  defaultButtonWidth: number;
  buttonHeight: number;
  t: (zh: string, ja: string, en: string) => string;
}): StartMenuElement[] => {
  const textX = settings.startMenuButtonPosition === 'center' ? 22 : defaultButtonX;
  const elements: StartMenuElement[] = [
    {
      id: 'title',
      kind: 'text',
      role: 'title',
      text: projectTitle || t('开始', 'スタート', 'Start'),
      visible: true,
      x: textX,
      y: settings.startMenuButtonPosition === 'center' ? 30 : 50,
      width: settings.startMenuButtonPosition === 'center' ? 56 : 42,
      height: 12,
      scale: 1,
      rotation: 0,
      fontSize: 34,
      borderRadius: 0,
    },
    {
      id: 'subtitle',
      kind: 'text',
      role: 'subtitle',
      text: t('没有存档', 'セーブなし', 'No save'),
      visible: true,
      x: textX,
      y: settings.startMenuButtonPosition === 'center' ? 43 : 62,
      width: settings.startMenuButtonPosition === 'center' ? 56 : 42,
      height: 5,
      scale: 1,
      rotation: 0,
      fontSize: 13,
      borderRadius: 0,
    },
  ];

  startMenuActions.forEach((action, index) => {
    const horizontal = settings.startMenuButtonLayout === 'horizontal';
    elements.push({
      id: action.key,
      kind: 'button',
      role: action.key as StartMenuElement['role'],
      text: action.label,
      visible: true,
      x: horizontal ? defaultButtonX + index * (defaultButtonWidth + 2) : defaultButtonX,
      y: horizontal ? defaultButtonY : defaultButtonY + index * (buttonHeight + 2),
      width: defaultButtonWidth,
      height: buttonHeight,
      scale: 1,
      rotation: 0,
      primary: action.primary,
      disabled: action.disabled,
      fontSize:
        settings.startMenuButtonSize === 'large'
          ? 16
          : settings.startMenuButtonSize === 'compact'
            ? 12
            : 14,
      textColor: action.primary ? choiceTextColor : '#f8fafc',
      backgroundType: 'solid',
      backgroundColor: action.primary ? choiceColor : 'rgba(255,255,255,0.10)',
      backgroundGradientStart: choiceColor,
      backgroundGradientEnd: '#0f172a',
      backgroundGradientAngle: 135,
      borderColor: action.primary ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.16)',
      borderRadius: 12,
    });
  });

  return elements;
};

export const getStartMenuPlacementBounds = (settings: WebExportSettings) => {
  const minX = settings.startMenuPlacementMinX ?? 10;
  const minY = settings.startMenuPlacementMinY ?? 10;
  const maxX = settings.startMenuPlacementMaxX ?? 90;
  const maxY = settings.startMenuPlacementMaxY ?? 90;
  return {
    minX: Math.max(0, Math.min(94, minX)),
    minY: Math.max(0, Math.min(96, minY)),
    maxX: Math.max(minX + 6, Math.min(100, maxX)),
    maxY: Math.max(minY + 4, Math.min(100, maxY)),
  };
};

export const snapStartMenuValue = (value: number, guides: number[], tolerance: number) => {
  let best = value;
  let bestDelta = tolerance;
  guides.forEach((guide) => {
    const delta = Math.abs(value - guide);
    if (delta <= bestDelta) {
      best = guide;
      bestDelta = delta;
    }
  });
  return best;
};

export const snapStartMenuBox = ({
  x,
  y,
  width,
  height,
  rect,
  xGuides,
  yGuides,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  rect: DOMRect;
  xGuides: number[];
  yGuides: number[];
}) => {
  const toleranceX = (2 / rect.width) * 100;
  const toleranceY = (2 / rect.height) * 100;
  const snappedLeft = snapStartMenuValue(x, xGuides, toleranceX);
  const snappedCenterX = snapStartMenuValue(x + width / 2, xGuides, toleranceX) - width / 2;
  const snappedRight = snapStartMenuValue(x + width, xGuides, toleranceX) - width;
  const snappedTop = snapStartMenuValue(y, yGuides, toleranceY);
  const snappedCenterY = snapStartMenuValue(y + height / 2, yGuides, toleranceY) - height / 2;
  const snappedBottom = snapStartMenuValue(y + height, yGuides, toleranceY) - height;
  const nextX = [snappedLeft, snappedCenterX, snappedRight].reduce((best, candidate) =>
    Math.abs(candidate - x) < Math.abs(best - x) ? candidate : best,
  );
  const nextY = [snappedTop, snappedCenterY, snappedBottom].reduce((best, candidate) =>
    Math.abs(candidate - y) < Math.abs(best - y) ? candidate : best,
  );
  return { x: nextX, y: nextY };
};
