import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Eye,
  EyeOff,
  GripHorizontal,
  Image as ImageIcon,
  Palette,
  X,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { DragSizeControl } from '../video/controls/RenderControls';
import type { RenderFillType, TextAlign } from '../video/shared/types';

export const inspectorTone = {
  position: {
    section: 'bg-emerald-50',
    header: 'bg-emerald-100',
    toggle: 'bg-emerald-100 text-slate-900',
  },
  text: {
    section: 'bg-green-50',
    header: 'bg-green-100',
    toggle: 'bg-green-100 text-slate-900',
  },
  fill: {
    section: 'bg-sky-50',
    header: 'bg-sky-100',
    toggle: 'bg-sky-100 text-slate-900',
  },
  stroke: {
    section: 'bg-indigo-50',
    header: 'bg-indigo-100',
    toggle: 'bg-indigo-100 text-slate-900',
  },
  shadow: {
    section: 'bg-fuchsia-50',
    header: 'bg-fuchsia-100',
    toggle: 'bg-fuchsia-100 text-slate-900',
  },
  animation: {
    section: 'bg-pink-50',
    header: 'bg-pink-100',
    toggle: 'bg-pink-100 text-slate-900',
  },
  extra: {
    section: 'bg-slate-50',
    header: 'bg-slate-100',
    toggle: 'bg-slate-100 text-slate-900',
  },
};

export type InspectorTone = keyof typeof inspectorTone;

export function InspectorGroup({
  title,
  icon,
  tone,
  secondary,
  onTitleClick,
  titleActive = true,
  titlePressed,
  expandLabel = 'Expand',
  collapseLabel = 'Collapse',
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: InspectorTone;
  secondary: React.ReactNode;
  onTitleClick?: () => void;
  titleActive?: boolean;
  titlePressed?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const classes = inspectorTone[tone];

  return (
    <section className={`relative rounded-[22px] p-3 ${classes.section}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
        {onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            className={`flex h-10 min-w-0 items-center gap-2 rounded-xl px-3 text-left text-sm font-bold transition-colors ${
              titleActive ? `text-slate-900 ${classes.header}` : 'bg-white/60 text-slate-400'
            }`}
            title={title}
            aria-label={title}
            aria-pressed={titlePressed ?? titleActive}
          >
            <span className="shrink-0">{icon}</span>
            <span className="min-w-0 truncate">{title}</span>
          </button>
        ) : (
          <div
            className={`flex h-10 min-w-0 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-900 ${classes.header}`}
            title={title}
            aria-label={title}
          >
            <span className="shrink-0">{icon}</span>
            <span className="min-w-0 truncate">{title}</span>
          </div>
        )}
        <div className="min-w-0">{secondary}</div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`grid h-10 w-11 place-items-center rounded-xl ${classes.toggle}`}
          title={open ? collapseLabel : expandLabel}
          aria-label={open ? collapseLabel : expandLabel}
          aria-expanded={open}
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

export function ControlRow({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 ${className}`}>
      {children}
      <div className="h-10 w-11" aria-hidden="true" />
    </div>
  );
}

export function HeaderAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-normal text-slate-900"
      title={label}
      aria-label={label}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export function HeaderSelect({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label || options[0]?.label || '';
  return (
    <label
      className="relative grid h-10 min-w-0 grid-cols-[28px_minmax(0,1fr)_18px] items-center rounded-xl bg-white px-2 text-sm font-normal text-slate-900"
      title={label}
    >
      <span className="flex justify-center text-slate-900" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 truncate px-1">{selectedLabel}</span>
      <ChevronDown className="h-4 w-4 text-slate-900" aria-hidden="true" />
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VisibilityButton({
  visible,
  label,
  onClick,
}: {
  visible: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold ${
        visible ? 'bg-[#4f46e5] text-white' : 'bg-white text-slate-500'
      }`}
      title={label}
      aria-label={label}
      aria-pressed={visible}
    >
      {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export function NumberField({
  icon,
  label,
  description,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      {description && (
        <div className="px-1 text-[10px] leading-4 text-slate-500">{description}</div>
      )}
      <div
        className="grid h-10 grid-cols-[34px_minmax(0,1fr)] items-center overflow-hidden rounded-xl bg-white"
        title={label}
      >
        <span className="flex h-full items-center justify-center text-slate-600" aria-hidden="true">
          {icon}
        </span>
        <DragSizeControl
          label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          unit=""
          onChange={onChange}
          className="h-full rounded-l-none rounded-r-xl px-3 py-0"
          editingClassName="ring-inset"
        />
      </div>
    </div>
  );
}

export function AlignButtons({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (value: TextAlign) => void;
}) {
  const items: Array<{ value: TextAlign; label: string; icon: React.ReactNode }> = [
    { value: 'left', label: 'Left align', icon: <AlignLeft className="h-4 w-4" /> },
    { value: 'center', label: 'Center align', icon: <AlignCenter className="h-4 w-4" /> },
    { value: 'right', label: 'Right align', icon: <AlignRight className="h-4 w-4" /> },
  ];
  const safeValue = items.some((item) => item.value === value) ? value : 'left';
  return (
    <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`grid h-10 min-w-0 place-items-center ${
            safeValue === item.value ? 'bg-indigo-600 text-white' : 'text-slate-700'
          }`}
          title={item.label}
          aria-label={item.label}
          aria-pressed={safeValue === item.value}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

function PositionAlignIcon({ axis, value }: { axis: 'x' | 'y'; value: 'start' | 'center' | 'end' }) {
  const guide = value === 'start' ? 4 : value === 'center' ? 12 : 20;
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {axis === 'x' ? (
        <>
          <path d={`M${guide} 3v18`} opacity="0.78" />
          <rect x={value === 'start' ? 7 : value === 'center' ? 8 : 9} y="7" width="8" height="10" rx="2" />
          <path d={value === 'start' ? 'M4 12h3' : value === 'center' ? 'M8 12h8' : 'M17 12h3'} opacity="0.55" />
        </>
      ) : (
        <>
          <path d={`M3 ${guide}h18`} opacity="0.78" />
          <rect x="7" y={value === 'start' ? 7 : value === 'center' ? 8 : 9} width="10" height="8" rx="2" />
          <path d={value === 'start' ? 'M12 4v3' : value === 'center' ? 'M12 8v8' : 'M12 17v3'} opacity="0.55" />
        </>
      )}
    </svg>
  );
}

export function PositionAlignButtons({
  className = '',
  onAlign,
}: {
  className?: string;
  onAlign: (axis: 'x' | 'y', value: 'start' | 'center' | 'end') => void;
}) {
  const horizontalItems: Array<{
    key: string;
    value: 'start' | 'center' | 'end';
    icon: React.ReactNode;
  }> = [
    { key: 'left', value: 'start', icon: <PositionAlignIcon axis="x" value="start" /> },
    {
      key: 'center-x',
      value: 'center',
      icon: <PositionAlignIcon axis="x" value="center" />,
    },
    { key: 'right', value: 'end', icon: <PositionAlignIcon axis="x" value="end" /> },
  ];

  const verticalItems: Array<{
    key: string;
    value: 'start' | 'center' | 'end';
    icon: React.ReactNode;
  }> = [
    { key: 'top', value: 'start', icon: <PositionAlignIcon axis="y" value="start" /> },
    { key: 'center-y', value: 'center', icon: <PositionAlignIcon axis="y" value="center" /> },
    { key: 'bottom', value: 'end', icon: <PositionAlignIcon axis="y" value="end" /> },
  ];

  return (
    <div className={className}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
        <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
          {horizontalItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onAlign('x', item.value)}
              className="grid h-10 min-w-0 place-items-center text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
              title={item.key}
              aria-label={item.key}
            >
              {item.icon}
            </button>
          ))}
        </div>
        <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
          {verticalItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onAlign('y', item.value)}
              className="grid h-10 min-w-0 place-items-center text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
              title={item.key}
              aria-label={item.key}
            >
              {item.icon}
            </button>
          ))}
        </div>
        <div aria-hidden="true" />
      </div>
    </div>
  );
}

export function FillTabs<T extends RenderFillType>({
  value,
  labels,
  onChange,
}: {
  value: T;
  labels: { solid: string; gradient: string; image: string };
  onChange: (value: T) => void;
}) {
  const options: Array<{ type: T; label: string; icon: React.ReactNode }> = [
    { type: 'solid' as T, label: labels.solid, icon: <Palette className="h-3.5 w-3.5" /> },
    { type: 'gradient' as T, label: labels.gradient, icon: <GradientIcon /> },
    { type: 'image' as T, label: labels.image, icon: <ImageIcon className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
      {options.map(({ type, label, icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`flex h-10 min-w-0 items-center justify-center px-2 text-xs font-bold ${
            value === type ? 'bg-indigo-600 text-white' : 'text-slate-700'
          }`}
          title={label}
          aria-label={label}
          aria-pressed={value === type}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

export function GradientIcon() {
  return (
    <span
      className="block h-3.5 w-3.5 rounded-full border border-current/30"
      style={{ background: 'linear-gradient(135deg, currentColor 0%, transparent 100%)' }}
      aria-hidden="true"
    />
  );
}

export function FloatingPopover({
  children,
  className = '',
  popoverKey = 'style',
  onClose,
  closeLabel = 'Close',
}: {
  children: React.ReactNode;
  className?: string;
  popoverKey?: 'solid' | 'gradient' | 'image' | 'style';
  onClose?: () => void;
  closeLabel?: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const storageKey = `galwriter-inspector-popover-position:${popoverKey}`;
  const clampPosition = useCallback((left: number, top: number) => {
    const panel = panelRef.current;
    const width = panel?.offsetWidth || Math.min(390, window.innerWidth - 32);
    const height = panel?.offsetHeight || 240;
    const gap = 12;
    return {
      left: Math.max(gap, Math.min(left, window.innerWidth - width - gap)),
      top: Math.max(gap, Math.min(top, window.innerHeight - Math.min(height, window.innerHeight - gap * 2) - gap)),
    };
  }, []);
  const placePanel = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as { left?: number; top?: number } | null;
      if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) {
        setPosition(clampPosition(saved!.left!, saved!.top!));
        return;
      }
    } catch {
      // Ignore invalid saved coordinates.
    }
    const rect = anchor.getBoundingClientRect();
    const panelWidth = panelRef.current?.offsetWidth || Math.min(390, window.innerWidth - 32);
    setPosition(clampPosition(rect.left - panelWidth - 12, rect.top));
  }, [clampPosition, storageKey]);
  useLayoutEffect(() => placePanel(), [placePanel]);
  useEffect(() => {
    const keepVisible = () => setPosition((current) => current ? clampPosition(current.left, current.top) : current);
    window.addEventListener('resize', keepVisible);
    return () => window.removeEventListener('resize', keepVisible);
  }, [clampPosition]);
  useLayoutEffect(() => {
    if (!position || !panelRef.current) return;
    const next = clampPosition(position.left, position.top);
    if (next.left !== position.left || next.top !== position.top) setPosition(next);
  }, [children, clampPosition, position]);

  return (
    <>
      <div ref={anchorRef} className="absolute inset-x-0 top-0 h-0" aria-hidden="true" />
      {position && createPortal(
        <div ref={panelRef} className={`fixed z-[10050] ${popoverKey === 'solid' ? 'w-[min(340px,calc(100vw-24px))]' : 'w-[min(390px,calc(100vw-24px))]'} ${className}`} style={position} data-web-style-popover>
          <div
            className="relative flex h-7 cursor-grab touch-none items-center justify-center rounded-t-[22px] border border-b-0 border-slate-200 bg-white text-slate-400 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
            title="Drag"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: position.left, top: position.top };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              setPosition(clampPosition(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y));
            }}
            onPointerUp={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              dragRef.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              const next = clampPosition(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
              setPosition(next);
              try {
                window.localStorage.setItem(storageKey, JSON.stringify(next));
              } catch {
                // Position persistence is optional. Large embedded media can fill
                // localStorage; dragging the panel must still work in that case.
              }
            }}
            onPointerCancel={() => { dragRef.current = null; }}
          >
            <GripHorizontal className="h-4 w-4" aria-hidden="true" />
            {onClose && (
              <button
                type="button"
                className="absolute right-1 grid h-5 w-5 cursor-pointer place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                title={closeLabel}
                aria-label={closeLabel}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="[&>div]:rounded-t-none [&>div]:rounded-b-[22px]">{children}</div>
        </div>,
        document.body,
      )}
    </>
  );
}
