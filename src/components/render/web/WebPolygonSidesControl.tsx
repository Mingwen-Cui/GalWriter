import { ChevronsUpDown } from 'lucide-react';
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Language } from '../../../lib/i18n';

export function WebPolygonSidesControl({
  value,
  language,
  onChange,
}: {
  value: number;
  language: Language;
  onChange: (sides: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; y: number; value: number; latest: number } | null>(null);
  const label = language === 'zh' ? '边数' : language === 'ja' ? '辺の数' : 'Sides';
  const hint =
    language === 'zh'
      ? '上下拖动调整边数，双击输入'
      : language === 'ja'
        ? '上下にドラッグ・ダブルクリックで入力'
        : 'Drag up or down; double-click to enter';
  const bound = (next: number) => Math.max(3, Math.min(60, Math.round(next)));
  const commit = () => {
    if (draft.trim() && Number.isFinite(Number(draft))) onChange(bound(Number(draft)));
    setEditing(false);
  };
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const next = bound(active.value + Math.round((active.y - event.clientY) / 8));
    if (next !== active.latest) {
      active.latest = next;
      onChange(next);
    }
  };
  const points = Array.from({ length: value }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / value;
    return `${10 + Math.cos(angle) * 7},${10 + Math.sin(angle) * 7}`;
  }).join(' ');
  if (editing)
    return (
      <input
        type="number"
        min={3}
        max={60}
        step={1}
        autoFocus
        aria-label={label}
        className="h-8 w-[94px] rounded-lg border border-indigo-300 bg-white px-2 text-center text-xs font-semibold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-200"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setEditing(false);
          }
        }}
      />
    );
  return (
    <button
      type="button"
      aria-label={`${label} ${value}`}
      title={hint}
      className={`flex h-8 cursor-ns-resize touch-none select-none items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold text-indigo-700 shadow-[0_2px_8px_rgba(49,46,129,0.08)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-indigo-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        drag.current = { pointerId: event.pointerId, y: event.clientY, value, latest: value };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={move}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        move(event);
        drag.current = null;
        setDragging(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
        setDragging(false);
      }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDraft(String(value));
        setEditing(true);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          onChange(bound(value + (event.key === 'ArrowUp' ? 1 : -1)));
        }
      }}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
        <polygon
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <span className="tabular-nums">{value}</span>
      <ChevronsUpDown className="h-3 w-3 text-indigo-400" aria-hidden="true" />
    </button>
  );
}
