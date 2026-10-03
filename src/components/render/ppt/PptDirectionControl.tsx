import type { PptAnimationDirection, PptAnimationPhase } from '../video/shared/types';
import { usePptCopy } from './pptCopyContext';

const directions = ['left', 'right', 'up', 'down'] as const;
const entranceArrows = { left: '→', right: '←', up: '↓', down: '↑' } as const;
const exitArrows = { left: '←', right: '→', up: '↑', down: '↓' } as const;
const arrowPositions = {
  '↑': { row: 1, column: 2, rotation: 0 },
  '←': { row: 2, column: 1, rotation: -90 },
  '→': { row: 2, column: 3, rotation: 90 },
  '↓': { row: 3, column: 2, rotation: 180 },
};

export const pptDirectionArrow = (
  direction: PptAnimationDirection,
  phase: PptAnimationPhase = 'enter',
) => (phase === 'exit' ? exitArrows : entranceArrows)[direction];

export function PptDirectionControl({
  value,
  phase = 'enter',
  disabled = false,
  allowedDirections = directions,
  onChange,
}: {
  value: PptAnimationDirection;
  phase?: PptAnimationPhase;
  disabled?: boolean;
  allowedDirections?: readonly PptAnimationDirection[];
  onChange: (direction: PptAnimationDirection) => void;
}) {
  const copy = usePptCopy();
  const labels =
    phase === 'exit'
      ? { left: copy.toLeft, right: copy.toRight, up: copy.toTop, down: copy.toBottom }
      : { left: copy.fromLeft, right: copy.fromRight, up: copy.fromTop, down: copy.fromBottom };
  return (
    <div role="group" aria-label={copy.effectOptions} className="ppt-direction-control">
      <svg className="ppt-direction-pad" viewBox="0 0 88 88" aria-hidden="true">
        <path d="M35 1H53Q59 1 59 7V25Q59 29 63 29H81Q87 29 87 35V53Q87 59 81 59H63Q59 59 59 63V81Q59 87 53 87H35Q29 87 29 81V63Q29 59 25 59H7Q1 59 1 53V35Q1 29 7 29H25Q29 29 29 25V7Q29 1 35 1Z" />
      </svg>
      <span aria-hidden="true" className="ppt-direction-origin" />
      {directions.map((direction) => {
        const position = arrowPositions[pptDirectionArrow(direction, phase)];
        const unavailable = disabled || !allowedDirections.includes(direction);
        return (
          <button
            key={direction}
            type="button"
            disabled={unavailable}
            title={labels[direction]}
            aria-label={labels[direction]}
            aria-pressed={!unavailable && value === direction}
            onClick={() => onChange(direction)}
            className={`ppt-direction-button ${!unavailable && value === direction ? 'is-active' : ''}`}
            style={{ gridRow: position.row, gridColumn: position.column }}
          >
            <svg
              viewBox="0 0 32 32"
              aria-hidden="true"
              style={{ transform: `rotate(${position.rotation}deg)` }}
            >
              <path d="M9 20L16 13L23 20" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
