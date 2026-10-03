import type { PptObjectAnimation } from '../video/shared/types';

/** Share line partitioning between editable preview text and native PPT text. */
export const wrapPptTextLines = (
  text: string,
  width: number,
  measure: (text: string) => number,
) => {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const character of Array.from(paragraph)) {
      if (line && measure(line + character) > Math.max(1, width)) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
    lines.push(line);
  }
  return lines;
};

/** Fit all line reveals and pauses inside the authored timeline duration. */
export const pptTextLineTiming = (animation: PptObjectAnimation, count: number, index: number) => {
  const lines = Math.max(1, count);
  const total = Math.max(lines, animation.durationMs);
  const gap =
    lines > 1
      ? Math.min(Math.max(0, animation.textBuild?.lineGapMs || 0), (total - lines) / (lines - 1))
      : 0;
  const durationMs = (total - gap * (lines - 1)) / lines;
  return { durationMs, offsetMs: index * (durationMs + gap) };
};

export const pptTextLinePreview = (
  animation: PptObjectAnimation | undefined,
  count: number,
  index: number,
  previewAtMs?: number,
) => {
  if (!animation?.textBuild || previewAtMs === undefined) return {};
  const start =
    (animation as PptObjectAnimation & { timelineStartMs?: number }).timelineStartMs ??
    animation.delayMs;
  const timing = pptTextLineTiming(animation, count, index);
  const progress = Math.max(
    0,
    Math.min(1, (previewAtMs - start - timing.offsetMs) / timing.durationMs),
  );
  const hidden = `${(1 - progress) * 100}%`;
  const edges =
    animation.direction === 'right'
      ? `0 0 0 ${hidden}`
      : animation.direction === 'up'
        ? `${hidden} 0 0 0`
        : animation.direction === 'down'
          ? `0 0 ${hidden} 0`
          : `0 ${hidden} 0 0`;
  return { clipPath: `inset(${edges})` };
};

export const wrapPptExportText = (
  text: string,
  options: {
    w?: number | string;
    fontSize?: number;
    fontFace?: string;
    bold?: boolean;
    charSpacing?: number;
  },
) => {
  if (typeof document === 'undefined') return text;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return text;
  // Measure in points so widths and fonts share the native PPT coordinate unit.
  ctx.font = `${options.bold ? 700 : 400} ${options.fontSize || 18}px ${options.fontFace || 'Arial'}`;
  ctx.letterSpacing = `${options.charSpacing || 0}px`;
  return wrapPptTextLines(
    text,
    (typeof options.w === 'number' ? options.w : 1) * 72,
    (value) => ctx.measureText(value).width,
  ).join('\n');
};
