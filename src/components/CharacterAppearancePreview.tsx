import React, { useEffect, useMemo, useRef } from 'react';

import {
  CHARACTER_APPEARANCE_CANVAS,
  DEFAULT_APPEARANCE_ADJUSTMENT,
  type AppearanceAdjustment,
  type CharacterAppearance,
  resolveAppearanceLayers,
} from '../lib/characterAppearance';

type Props = {
  appearance: CharacterAppearance;
  className?: string;
  /** A square face crop for compact card avatars. */
  mode?: 'full' | 'portrait' | 'sprite';
  adjustment?: Partial<AppearanceAdjustment>;
};

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(url));
  image.src = url;
});

export const renderCharacterAppearanceSpriteDataUrl = async (
  appearance: CharacterAppearance,
  adjustment?: Partial<AppearanceAdjustment>,
) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1536;
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  const calibrated = { ...DEFAULT_APPEARANCE_ADJUSTMENT, ...adjustment };
  const layers = resolveAppearanceLayers(appearance).sort((left, right) => {
    const order = { outfit: 0, face: 1, hair: 2 } as const;
    return order[left.id] - order[right.id];
  });
  const results = await Promise.allSettled(layers.map((layer) => loadImage(layer.url)));

  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    const layer = layers[index];
    if (layer.id === 'outfit') {
      context.drawImage(result.value, 0, 0, canvas.width, canvas.height);
      return;
    }
    const cropSize = Math.min(result.value.naturalWidth, result.value.naturalHeight);
    const headSize = 340 * (calibrated.spriteHeadScale / 100);
    const isHair = layer.id === 'hair';
    const hairOffsetRatio = headSize / (canvas.width * 0.78);
    context.drawImage(
      result.value,
      (result.value.naturalWidth - cropSize) / 2,
      0,
      cropSize,
      cropSize,
      (canvas.width - headSize) / 2 + calibrated.spriteHeadX + (isHair ? calibrated.hairX * hairOffsetRatio : 0),
      -30 + calibrated.spriteHeadY + (isHair ? calibrated.hairY * hairOffsetRatio : 0),
      headSize * (isHair ? calibrated.hairScale / 100 : 1),
      headSize * (isHair ? calibrated.hairScale / 100 : 1),
    );
  });

  return canvas.toDataURL('image/png');
};

/** Renders the selected face, body and hair as one transparent appearance. */
export function CharacterAppearancePreview({ appearance, className, mode = 'full', adjustment }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layers = useMemo(() => {
    const allLayers = resolveAppearanceLayers(appearance);
    if (mode === 'portrait') return allLayers.filter((layer) => layer.id !== 'outfit');
    if (mode === 'sprite') return [...allLayers].sort((left, right) => {
      const order = { outfit: 0, face: 1, hair: 2 } as const;
      return order[left.id] - order[right.id];
    });
    return allLayers;
  }, [appearance, mode]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const isPortrait = mode === 'portrait';
    const isSprite = mode === 'sprite';
    const calibrated = { ...DEFAULT_APPEARANCE_ADJUSTMENT, ...adjustment };
    canvas.width = isPortrait || isSprite ? 1024 : CHARACTER_APPEARANCE_CANVAS.width;
    canvas.height = isPortrait ? 1024 : isSprite ? 1536 : CHARACTER_APPEARANCE_CANVAS.height;
    context.clearRect(0, 0, canvas.width, canvas.height);

    Promise.allSettled(layers.map((layer) => loadImage(layer.url))).then((results) => {
      if (cancelled) return;
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const layer = layers[index];
        if (isPortrait) {
          const cropSize = Math.min(result.value.naturalWidth, result.value.naturalHeight);
          const portraitSize = Math.round(canvas.width * 0.78);
          const isHair = layer.id === 'hair';
          const layerSize = isHair ? portraitSize * (calibrated.hairScale / 100) : portraitSize;
          context.drawImage(
            result.value,
            (result.value.naturalWidth - cropSize) / 2,
            0,
            cropSize,
            cropSize,
            (canvas.width - layerSize) / 2 + (isHair ? calibrated.hairX : 0),
            canvas.height * 0.08 + (isHair ? calibrated.hairY : 0),
            layerSize,
            layerSize,
          );
          return;
        }
        if (isSprite) {
          if (layer.id === 'outfit') {
            context.drawImage(result.value, 0, 0, canvas.width, canvas.height);
            return;
          }
          const cropSize = Math.min(result.value.naturalWidth, result.value.naturalHeight);
          const faceSize = 340 * (calibrated.spriteHeadScale / 100);
          const isHair = layer.id === 'hair';
          const hairOffsetRatio = faceSize / (canvas.width * 0.78);
          context.drawImage(
            result.value,
            (result.value.naturalWidth - cropSize) / 2,
            0,
            cropSize,
            cropSize,
            (canvas.width - faceSize) / 2 + calibrated.spriteHeadX + (isHair ? calibrated.hairX * hairOffsetRatio : 0),
            -30 + calibrated.spriteHeadY + (isHair ? calibrated.hairY * hairOffsetRatio : 0),
            faceSize,
            faceSize,
          );
          return;
        }
        if (layer.id === 'face') {
          context.save();
          context.translate(appearance.faceTransform.offsetX, appearance.faceTransform.offsetY);
          context.translate(CHARACTER_APPEARANCE_CANVAS.faceAnchor.x, CHARACTER_APPEARANCE_CANVAS.faceAnchor.y);
          context.scale(appearance.faceTransform.scale, appearance.faceTransform.scale);
          context.translate(-CHARACTER_APPEARANCE_CANVAS.faceAnchor.x, -CHARACTER_APPEARANCE_CANVAS.faceAnchor.y);
          context.drawImage(result.value, 0, 0, canvas.width, canvas.height);
          context.restore();
          return;
        }
        context.drawImage(result.value, 0, 0, canvas.width, canvas.height);
      });
    });

    return () => { cancelled = true; };
  }, [appearance, layers, mode]);

  return <canvas ref={canvasRef} aria-label="Character appearance preview" className={className} />;
}
