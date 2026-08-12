import React, { useEffect, useRef } from 'react';

import {
  type AppearanceAdjustment,
  CHARACTER_APPEARANCE_CANVAS,
  CHARACTER_APPEARANCE_PORTRAIT_CROP,
  type CharacterAppearance,
  DEFAULT_APPEARANCE_ADJUSTMENT,
  resolveAppearanceLayers,
} from '../lib/characterAppearance';

type Props = {
  appearance: CharacterAppearance;
  className?: string;
  style?: React.CSSProperties;
  /** Browser preset assets are object URLs only after the user downloads them. */
  assetUrlOverrides?: Record<string, string>;
  /** A square, upper-body crop for compact card avatars. */
  mode?: 'full' | 'portrait' | 'sprite';
  adjustment?: Partial<AppearanceAdjustment>;
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(url));
    image.src = url;
  });

const drawAppearanceLayers = (
  context: CanvasRenderingContext2D,
  results: PromiseSettledResult<HTMLImageElement>[],
  layers: ReturnType<typeof resolveAppearanceLayers>,
  appearance: CharacterAppearance,
  adjustment: Partial<AppearanceAdjustment> | undefined,
  mode: NonNullable<Props['mode']>,
) => {
  const calibrated = { ...DEFAULT_APPEARANCE_ADJUSTMENT, ...adjustment };
  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    const layer = layers[index];
    const isHair = layer.id === 'backHair' || layer.id === 'frontHair';
    const isHead = layer.id === 'head';
    if (mode === 'portrait') {
      const crop = CHARACTER_APPEARANCE_PORTRAIT_CROP;
      const cropScale = context.canvas.width / crop.width;
      const scale = isHair
        ? calibrated.hairScale / 100
        : isHead
          ? appearance.faceTransform.scale * (calibrated.spriteHeadScale / 100)
          : 1;
      const offsetX = isHair
        ? calibrated.hairX
        : isHead
          ? appearance.faceTransform.offsetX + calibrated.spriteHeadX
          : 0;
      const offsetY = isHair
        ? calibrated.hairY
        : isHead
          ? appearance.faceTransform.offsetY + calibrated.spriteHeadY
          : 0;
      if (isHair || isHead) {
        context.save();
        context.translate(offsetX * cropScale, offsetY * cropScale);
        context.translate(context.canvas.width / 2, context.canvas.height / 2);
        context.scale(scale, scale);
        context.translate(-context.canvas.width / 2, -context.canvas.height / 2);
      }
      context.drawImage(
        result.value,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        context.canvas.width,
        context.canvas.height,
      );
      if (isHair || isHead) context.restore();
      return;
    }
    if (isHair || isHead) {
      const scale = isHair
        ? calibrated.hairScale / 100
        : appearance.faceTransform.scale * (calibrated.spriteHeadScale / 100);
      const offsetX = isHair
        ? calibrated.hairX
        : appearance.faceTransform.offsetX + calibrated.spriteHeadX;
      const offsetY = isHair
        ? calibrated.hairY
        : appearance.faceTransform.offsetY + calibrated.spriteHeadY;
      context.save();
      context.translate(offsetX, offsetY);
      context.translate(context.canvas.width / 2, context.canvas.height / 2);
      context.scale(scale, scale);
      context.translate(-context.canvas.width / 2, -context.canvas.height / 2);
      context.drawImage(result.value, 0, 0, context.canvas.width, context.canvas.height);
      context.restore();
      return;
    }
    context.drawImage(result.value, 0, 0, context.canvas.width, context.canvas.height);
  });
};

const resolveLayers = (
  appearance: CharacterAppearance,
  assetUrlOverrides?: Record<string, string>,
) =>
  resolveAppearanceLayers(appearance).map((layer) => ({
    ...layer,
    url: assetUrlOverrides?.[layer.url] || layer.url,
  }));

export const renderCharacterAppearanceSpriteDataUrl = async (
  appearance: CharacterAppearance,
  adjustment?: Partial<AppearanceAdjustment>,
  assetUrlOverrides?: Record<string, string>,
) => {
  const canvas = document.createElement('canvas');
  canvas.width = CHARACTER_APPEARANCE_CANVAS.width;
  canvas.height = CHARACTER_APPEARANCE_CANVAS.height;
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  const layers = resolveLayers(appearance, assetUrlOverrides);
  const results = await Promise.allSettled(layers.map((layer) => loadImage(layer.url)));
  drawAppearanceLayers(context, results, layers, appearance, adjustment, 'sprite');
  return canvas.toDataURL('image/png');
};

/** Renders the selected face, body and hair as one transparent appearance. */
export function CharacterAppearancePreview({
  appearance,
  className,
  style,
  mode = 'full',
  adjustment,
  assetUrlOverrides,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderInputRef = useRef<{
    appearance: CharacterAppearance;
    adjustment: Partial<AppearanceAdjustment> | undefined;
    layers: ReturnType<typeof resolveLayers>;
    mode: NonNullable<Props['mode']>;
  } | null>(null);
  const layers = resolveLayers(appearance, assetUrlOverrides);
  const renderSignature = [
    mode,
    ...layers.map((layer) => `${layer.id}:${layer.url}`),
    appearance.faceTransform.offsetX,
    appearance.faceTransform.offsetY,
    appearance.faceTransform.scale,
    adjustment?.hairX ?? '',
    adjustment?.hairY ?? '',
    adjustment?.hairScale ?? '',
    adjustment?.spriteHeadX ?? '',
    adjustment?.spriteHeadY ?? '',
    adjustment?.spriteHeadScale ?? '',
  ].join('|');
  renderInputRef.current = { appearance, adjustment, layers, mode };

  useEffect(() => {
    let cancelled = false;
    const renderInput = renderInputRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !renderInput) return;

    Promise.allSettled(renderInput.layers.map((layer) => loadImage(layer.url))).then((results) => {
      if (cancelled) return;
      // Do not clear the old drawing while assets are loading. This keeps a
      // stable character image through editor and playtest re-renders.
      canvas.width =
        renderInput.mode === 'portrait' ? 1024 : CHARACTER_APPEARANCE_CANVAS.width;
      canvas.height =
        renderInput.mode === 'portrait' ? 1024 : CHARACTER_APPEARANCE_CANVAS.height;
      drawAppearanceLayers(
        context,
        results,
        renderInput.layers,
        renderInput.appearance,
        renderInput.adjustment,
        renderInput.mode,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [renderSignature]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Character appearance preview"
      className={className}
      style={style}
    />
  );
}
