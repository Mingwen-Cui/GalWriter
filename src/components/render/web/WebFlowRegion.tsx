import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { Language } from '../../../lib/i18n';
import { normalizeWebFlowView, type WebFlowView } from './webFlowView';

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
const handles: Handle[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function resizeFlowRegion(
  view: WebFlowView,
  handle: Handle,
  dx: number,
  dy: number,
): WebFlowView {
  if (handle === 'move')
    return {
      ...view,
      x: clamp(view.x + dx, 0, 100 - view.width),
      y: clamp(view.y + dy, 0, 100 - view.height),
    };
  let left = view.x,
    top = view.y,
    right = left + view.width,
    bottom = top + view.height;
  if (handle.includes('w')) left = clamp(left + dx, 0, right - 5);
  if (handle.includes('e')) right = clamp(right + dx, left + 5, 100);
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - 5);
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + 5, 100);
  return { ...view, x: left, y: top, width: right - left, height: bottom - top };
}

/** An invisible clipping box. Only its selection border exists in edit mode. */
export function WebFlowRegion({
  view: value,
  editable,
  selected,
  language,
  onSelect,
  onChange,
  children,
}: {
  view?: WebFlowView;
  editable: boolean;
  selected: boolean;
  language: Language;
  onSelect: () => void;
  onChange: (view: WebFlowView) => void;
  children: ReactNode;
}) {
  const [view, setView] = useState(() => normalizeWebFlowView(value));
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    view: WebFlowView;
    handle: Handle;
  } | null>(null);
  const latest = useRef(view);
  latest.current = view;
  useEffect(() => {
    if (!drag.current) setView(normalizeWebFlowView(value));
  }, [value]);
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (!editable || event.button !== 0 || event.altKey) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>('[data-flow-region-handle]')?.dataset
      .flowRegionHandle as Handle | undefined;
    if (!handle && target.closest('button, [role="button"], input, textarea')) return;
    const parent = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!parent?.width || !parent.height) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: parent.width,
      height: parent.height,
      view,
      handle: handle || 'move',
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const next = resizeFlowRegion(
      current.view,
      current.handle,
      ((event.clientX - current.x) / current.width) * 100,
      ((event.clientY - current.y) / current.height) * 100,
    );
    latest.current = next;
    setView(next);
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    drag.current = null;
    if (event.type === 'pointercancel') setView(current.view);
    else if (
      current.view.x !== latest.current.x ||
      current.view.y !== latest.current.y ||
      current.view.width !== latest.current.width ||
      current.view.height !== latest.current.height
    )
      onChange(latest.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const title =
    language === 'zh'
      ? '流程图显示范围'
      : language === 'ja'
        ? 'フローの表示範囲'
        : 'Flow display region';
  return (
    <div
      data-flow-region
      className="absolute touch-none"
      style={{
        left: `${view.x}%`,
        top: `${view.y}%`,
        width: `${view.width}%`,
        height: `${view.height}%`,
      }}
      onPointerDownCapture={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {editable && (
        <div
          data-flow-region-background
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(rgba(148, 163, 184, 0.18) 0.7px, transparent 0.7px), linear-gradient(145deg, #f8fafc, #eff6ff)',
            backgroundSize: '22px 22px, 100% 100%',
          }}
        />
      )}
      {children}
      {editable && selected && (
        <div className="pointer-events-none absolute inset-0 z-[60] border border-indigo-400">
          <span
            data-flow-region-handle="move"
            className="pointer-events-auto absolute left-3 top-2 cursor-move rounded bg-white/90 px-2 py-1 text-[11px] text-indigo-600 shadow-sm"
          >
            {title}
          </span>
          {handles.map((handle) => (
            <span
              key={handle}
              data-flow-region-handle={handle}
              aria-label={`${title} ${handle}`}
              className="pointer-events-auto absolute h-2.5 w-2.5 border border-indigo-500 bg-white"
              style={{
                left: handle.includes('w') ? 0 : handle.includes('e') ? '100%' : '50%',
                top: handle.includes('n') ? 0 : handle.includes('s') ? '100%' : '50%',
                transform: 'translate(-50%, -50%)',
                cursor: `${handle}-resize`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
