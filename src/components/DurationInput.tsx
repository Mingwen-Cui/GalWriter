import React, { useRef } from 'react';

type DurationInputProps = {
  value: number;
  onChange: (value: number) => void;
};

export function DurationInput({ value, onChange }: DurationInputProps) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startValue: number;
    lastSteps: number;
  } | null>(null);

  const commitValue = (nextValue: number) => {
    onChange(Math.max(0, Math.round(nextValue / 100) * 100));
  };

  return (
    <div
      className="flex w-full cursor-ew-resize items-center rounded-lg bg-[var(--app-bg)]"
      title="按住鼠标左右拖动，每次调整 100ms"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.button !== 0) return;
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startValue: value,
          lastSteps: 0,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const steps = Math.trunc((event.clientX - drag.startX) / 4);
        if (steps === drag.lastSteps) return;
        drag.lastSteps = steps;
        commitValue(drag.startValue + steps * 100);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      <input
        type="number"
        min="0"
        step="100"
        value={value}
        onChange={(event) => commitValue(Number(event.target.value))}
        className="min-w-0 flex-1 cursor-ew-resize border-0 bg-transparent p-2 text-right outline-none focus:border-0 focus:outline-none focus-visible:outline-none"
      />
      <span className="pr-2 text-[10px] font-bold text-[var(--text-muted)]">MS</span>
    </div>
  );
}
