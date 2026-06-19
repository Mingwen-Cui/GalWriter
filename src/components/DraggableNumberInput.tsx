import React, { useRef } from 'react';

export function DraggableNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals,
  unit = 'PX',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  unit?: string | null;
}) {
  const dragRef = useRef<{ pointerId: number; startX: number; startValue: number } | null>(null);
  const resolvedDecimals =
    decimals ?? (step.toString().includes('.') ? step.toString().split('.')[1]?.length || 0 : 0);
  const commitValue = (nextValue: number) => {
    const stepped = Math.round(nextValue / step) * step;
    const bounded = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, stepped));
    onChange(Number(bounded.toFixed(resolvedDecimals)));
  };

  return (
    <div className="flex w-full items-center rounded-lg bg-[var(--app-bg)]">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value).toFixed(resolvedDecimals)}
        title="可直接输入，或按住鼠标左右拖动调整"
        onChange={(event) => commitValue(Number(event.target.value))}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startValue: value,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const delta = Math.round((event.clientX - drag.startX) / 4);
          if (delta !== 0) {
            event.preventDefault();
            commitValue(drag.startValue + delta * step);
          }
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        className="min-w-0 flex-1 cursor-ew-resize border-0 bg-transparent p-2 text-right outline-none focus:border-0 focus:outline-none focus-visible:outline-none"
      />
      {unit && <span className="pr-2 text-[10px] font-bold text-[var(--text-muted)]">{unit}</span>}
    </div>
  );
}
