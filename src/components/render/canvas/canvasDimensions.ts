import { normalizeSharedCanvasSettings, type SharedCanvasSettings } from './canvasSettings';

export const canvasRatio = (width: number, height: number) => {
  let a = Math.max(1, Math.round(width));
  let b = Math.max(1, Math.round(height));
  while (b) [a, b] = [b, a % b];
  const w = Math.round(width / a), h = Math.round(height / a);
  // Ratio controls accept 1..100. Keep an accurate bounded approximation for custom sizes.
  if (w <= 100 && h <= 100) return {canvasRatioWidth: w, canvasRatioHeight: h};
  let best = {canvasRatioWidth: 16, canvasRatioHeight: 9}, error = Infinity;
  for (let y = 1; y <= 100; y++) {
    const x = Math.max(1, Math.min(100, Math.round(width / height * y)));
    const distance = Math.abs(x / y - width / height);
    if (distance < error) { best = {canvasRatioWidth: x, canvasRatioHeight: y}; error = distance; }
  }
  return best;
};

/** A size edit is a single patch; locking preserves the aspect, never just the ratio label. */
export function resizeCanvas(value: SharedCanvasSettings, field: 'canvasWidth' | 'canvasHeight', next: number): Partial<SharedCanvasSettings> {
  if (!Number.isFinite(next) || next <= 0) return {};
  let width = field === 'canvasWidth' ? next : value.canvasWidth;
  let height = field === 'canvasHeight' ? next : value.canvasHeight;
  if (value.canvasRatioLocked) {
    const ratio = value.canvasRatioWidth / value.canvasRatioHeight;
    if (field === 'canvasWidth') height = width / ratio;
    else width = height * ratio;
    const scale = Math.min(1, 7680 / width, 4320 / height);
    width *= scale; height *= scale;
    const minScale = Math.max(1, 320 / width, 180 / height);
    width *= minScale; height *= minScale;
  }
  const normalized = normalizeSharedCanvasSettings({...value, canvasWidth: width, canvasHeight: height});
  return {canvasWidth: normalized.canvasWidth, canvasHeight: normalized.canvasHeight, ...canvasRatio(normalized.canvasWidth, normalized.canvasHeight)};
}

export function migrateVideoCanvasSettings(previous?: {
  videoCanvasSettings?: Partial<SharedCanvasSettings>;
  webSettings?: Partial<SharedCanvasSettings>;
  resolutionWidth?: number; resolutionHeight?: number;
} | null): SharedCanvasSettings {
  if (previous?.videoCanvasSettings) return normalizeSharedCanvasSettings(previous.videoCanvasSettings);
  const canvasWidth = previous?.resolutionWidth || 1920;
  const canvasHeight = previous?.resolutionHeight || 1080;
  return normalizeSharedCanvasSettings({...previous?.webSettings, canvasWidth, canvasHeight, ...canvasRatio(canvasWidth, canvasHeight)});
}
