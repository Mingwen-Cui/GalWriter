import type { TimelineScaleMode } from '../shared/types';

export const formatSeconds = (seconds: number, precision = 0) => {
  const safeSeconds = Math.max(0, seconds);
  if (precision <= 0) {
    const roundedSeconds = Math.round(safeSeconds);
    const minutes = Math.floor(roundedSeconds / 60);
    const rest = roundedSeconds % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }
  const roundedSeconds = Number(safeSeconds.toFixed(precision));
  const minutes = Math.floor(roundedSeconds / 60);
  const rest = roundedSeconds - minutes * 60;
  const fixedRest = rest.toFixed(precision);
  const [whole, decimal = ''] = fixedRest.split('.');
  return `${minutes}:${whole.padStart(2, '0')}.${decimal}`;
};

export const getTimelineTickSettings = (
  pixelsPerSecond: number,
  scaleMode: TimelineScaleMode,
  frameRate: number,
) => {
  const minimumLabelGapPx = scaleMode === 'frames' ? 72 : 64;
  const minimumSecondsPerTick = minimumLabelGapPx / Math.max(1, pixelsPerSecond);
  const secondSteps = [
    1 / 60,
    1 / 30,
    1 / 24,
    1 / 12,
    0.1,
    0.2,
    0.25,
    0.5,
    1,
    2,
    5,
    10,
    15,
    30,
    60,
  ];

  if (scaleMode === 'frames') {
    const framesPerTick = Math.max(1, Math.ceil(minimumSecondsPerTick * frameRate));
    return {
      step: framesPerTick / frameRate,
      precision: 0,
    };
  }

  const step = secondSteps.find((candidate) => candidate >= minimumSecondsPerTick) || 120;
  return {
    step,
    precision: step < 1 ? Math.min(2, Math.ceil(-Math.log10(step))) : 0,
  };
};

export const getTimelineSegmentLayout = (start: number, duration: number, pixelsPerSecond: number) => {
  return {
    left: start * pixelsPerSecond,
    width: Math.max(0, duration * pixelsPerSecond),
  };
};
