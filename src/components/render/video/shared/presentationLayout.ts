import { getRenderObjects } from './renderObjects';
import type { RenderStyle } from './types';

export type PresentationDialogueLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  padding: number;
  paddingX: number;
  paddingY: number;
};

export type PresentationDialogueLayoutOptions = {
  contentHeight?: number;
  topExtension?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const resolvePresentationTextScale = (canvasHeight: number) =>
  clamp(Math.max(1, canvasHeight) / 720, 0.25, 8);

/**
 * Resolves dialogue geometry in the project's own logical canvas, rather than
 * in a browser viewport. Consumers may scale that canvas however they need.
 * This keeps 16:9, portrait, square, and custom projects consistent.
 */
export const resolvePresentationDialogueLayout = (
  canvasWidth: number,
  canvasHeight: number,
  style: RenderStyle,
  options: PresentationDialogueLayoutOptions = {},
): PresentationDialogueLayout => {
  const object = getRenderObjects(style).dialogBox;
  const width = Math.max(1, canvasWidth);
  const height = Math.max(1, canvasHeight);
  const boxWidth = width * clamp(object.width / 100, 0.35, 1);
  const maxBoxHeight = height * clamp(object.height / 100, 0.16, 0.75);
  const basePadding = Math.max(20, Math.min(boxWidth, maxBoxHeight) * 0.09);
  const minDynamicHeight = Math.min(maxBoxHeight, Math.max(64, basePadding * 2.4));
  const dynamicHeight = Number.isFinite(options.contentHeight) && options.contentHeight !== undefined
    ? options.contentHeight + basePadding * 2
    : maxBoxHeight;
  const boxHeight = Math.min(maxBoxHeight, Math.max(minDynamicHeight, dynamicHeight));
  const centeredX = (width - boxWidth) / 2;
  const baseY = height - Math.max(24, height * 0.045) - boxHeight;
  const offsetX = clamp(object.x, -100, 100);
  const offsetY = clamp(object.y, -100, 100);
  const x = clamp(centeredX + centeredX * (offsetX / 100), 0, width - boxWidth);
  const y = clamp(
    baseY + (offsetY / 100) * (offsetY < 0 ? Math.max(0, baseY) : Math.max(0, height - boxHeight - baseY)),
    0,
    height - boxHeight,
  );
  const topExtension = Math.max(0, options.topExtension ?? 0);
  const extendedY = Math.max(0, y - topExtension);
  return {
    x,
    y: extendedY,
    width: boxWidth,
    height: boxHeight + (y - extendedY),
    padding: basePadding,
    paddingX: clamp(boxWidth * clamp((style.dialogTextPaddingX ?? 9) / 100, 0.02, 0.24), 12, boxWidth * 0.32),
    paddingY: basePadding,
  };
};

/** Converts a logical-canvas position back to the percentage offsets stored by the inspector. */
export const resolvePresentationDialogueOffsets = (
  canvasWidth: number,
  canvasHeight: number,
  style: RenderStyle,
  x: number,
  y: number,
): { x: number; y: number } => {
  const object = getRenderObjects(style).dialogBox;
  const width = Math.max(1, canvasWidth);
  const height = Math.max(1, canvasHeight);
  const boxWidth = width * clamp(object.width / 100, 0.35, 1);
  const boxHeight = height * clamp(object.height / 100, 0.16, 0.75);
  const centeredX = (width - boxWidth) / 2;
  const baseY = height - Math.max(24, height * 0.045) - boxHeight;
  const safeX = clamp(x, 0, width - boxWidth);
  const safeY = clamp(y, 0, height - boxHeight);
  const horizontalRange = Math.max(1, centeredX);
  const verticalRange = safeY < baseY ? Math.max(1, baseY) : Math.max(1, height - boxHeight - baseY);
  return {
    x: clamp(((safeX - centeredX) / horizontalRange) * 100, -100, 100),
    y: clamp(((safeY - baseY) / verticalRange) * 100, -100, 100),
  };
};
