import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Image as ImageIcon,
  Palette,
  X,
} from 'lucide-react';
import type React from 'react';
import { createContext, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './inspector.css';
import type { Language } from '../../../../lib/i18n';

import { DragSizeControl } from '../../video/controls/RenderControls';
import type { RenderFillType, TextAlign } from '../../video/shared/types';

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
  showDescriptions = false,
  titleDescription,
  secondaryDescription,
  secondaryHasDescription = false,
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
  showDescriptions?: boolean;
  titleDescription?: string;
  secondaryDescription?: string;
  secondaryHasDescription?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(titleActive);
  return (
    <section className="property-section" data-inspector-group={tone}>
      <div className="property-section-header">
        <button
          type="button"
          className="property-section-title"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
          <span aria-hidden="true" className="property-section-icon">
            {icon}
          </span>
          <span>{title}</span>
        </button>
        {onTitleClick && (
          <button
            type="button"
            className="property-enable"
            onClick={() => {
              onTitleClick();
              setOpen(!titleActive);
            }}
            aria-label={title}
            role="switch"
            aria-checked={titlePressed ?? titleActive}
            title={title}
          >
            <span className="property-switch" data-on={titlePressed ?? titleActive}>
              <span />
            </span>
          </button>
        )}
      </div>
      {open && (
        <div className="property-section-body">
          {showDescriptions && titleDescription && (
            <p className="property-help">{titleDescription}</p>
          )}
          {secondary && (
            <div className="property-section-secondary">
              {showDescriptions && secondaryDescription && !secondaryHasDescription && (
                <div className="property-help">{secondaryDescription}</div>
              )}
              {secondary}
            </div>
          )}
          {children}
        </div>
      )}
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
  return <div className={`property-control-row ${className}`}>{children}</div>;
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
      className="flex h-8 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-normal text-slate-900"
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
      className="relative grid h-8 min-w-0 grid-cols-[28px_minmax(0,1fr)_18px] items-center rounded-md bg-white px-2 text-sm font-normal text-slate-900"
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
      className={`flex h-8 w-full min-w-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold ${
        visible ? 'bg-[#4f46e5] text-white' : 'bg-white text-slate-500'
      }`}
      title={label}
      aria-label={label}
      aria-pressed={visible}
    >
      <span className="property-switch" data-on={visible}>
        <span />
      </span>
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
  layout = icon ? 'stacked' : 'inline',
  action,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  layout?: 'stacked' | 'inline';
  action?: React.ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      {layout === 'stacked' && <div className="property-field-label">{label}</div>}
      {description && description !== label && <div className="property-help">{description}</div>}
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={`property-number grid h-8 min-w-0 flex-1 ${layout === 'inline' ? 'property-number-inline' : 'grid-cols-[26px_minmax(0,1fr)]'} items-center overflow-hidden rounded-md bg-white`}
          title={label}
        >
          {layout === 'inline' ? (
            <span className="min-w-0 truncate pl-3 text-xs text-[var(--inspector-muted)]">{label}</span>
          ) : (
            <span className="flex h-full items-center justify-center text-slate-600" aria-hidden="true">
              {icon}
            </span>
          )}
          <DragSizeControl
            label={label}
            value={value}
            min={min}
            max={max ?? Number.MAX_SAFE_INTEGER}
            step={step}
            unit=""
            onChange={onChange}
            className="h-full min-w-0 rounded-l-none rounded-r-md px-3 py-0"
            editingClassName="ring-inset"
          />
        </div>
        {action}
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
    <div className="grid h-8 grid-cols-3 overflow-hidden rounded-md bg-white">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`grid h-8 min-w-0 place-items-center ${
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

function PositionAlignIcon({
  axis,
  value,
}: {
  axis: 'x' | 'y';
  value: 'start' | 'center' | 'end';
}) {
  const guide = value === 'start' ? 4 : value === 'center' ? 12 : 20;
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {axis === 'x' ? (
        <>
          <path d={`M${guide} 3v18`} opacity="0.78" />
          <rect
            x={value === 'start' ? 7 : value === 'center' ? 8 : 9}
            y="7"
            width="8"
            height="10"
            rx="2"
          />
          <path
            d={value === 'start' ? 'M4 12h3' : value === 'center' ? 'M8 12h8' : 'M17 12h3'}
            opacity="0.55"
          />
        </>
      ) : (
        <>
          <path d={`M3 ${guide}h18`} opacity="0.78" />
          <rect
            x="7"
            y={value === 'start' ? 7 : value === 'center' ? 8 : 9}
            width="10"
            height="8"
            rx="2"
          />
          <path
            d={value === 'start' ? 'M12 4v3' : value === 'center' ? 'M12 8v8' : 'M12 17v3'}
            opacity="0.55"
          />
        </>
      )}
    </svg>
  );
}

export function PositionAlignButtons({
  className = '',
  onAlign,
  showDescriptions = false,
  horizontalLabel = '',
  verticalLabel = '',
}: {
  className?: string;
  onAlign: (axis: 'x' | 'y', value: 'start' | 'center' | 'end') => void;
  showDescriptions?: boolean;
  horizontalLabel?: string;
  verticalLabel?: string;
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
      {showDescriptions && (
        <div className="mb-1 grid h-4 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 px-1 text-[10px] leading-4 text-slate-500">
          <span className="truncate">{horizontalLabel}</span>
          <span className="truncate">{verticalLabel}</span>
          <span aria-hidden="true">{'\u00a0'}</span>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
        <div className="grid h-8 grid-cols-3 overflow-hidden rounded-md bg-white">
          {horizontalItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onAlign('x', item.value)}
              className="grid h-8 min-w-0 place-items-center text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
              title={item.key}
              aria-label={item.key}
            >
              {item.icon}
            </button>
          ))}
        </div>
        <div className="grid h-8 grid-cols-3 overflow-hidden rounded-md bg-white">
          {verticalItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onAlign('y', item.value)}
              className="grid h-8 min-w-0 place-items-center text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
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
    <div className="grid h-8 grid-cols-3 overflow-hidden rounded-md bg-white">
      {options.map(({ type, label, icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`flex h-8 min-w-0 items-center justify-center gap-1 px-2 text-xs font-bold ${
            value === type ? 'bg-indigo-600 text-white' : 'text-slate-700'
          }`}
          title={label}
          aria-label={label}
          aria-pressed={value === type}
        >
          {icon}
          <span className="truncate">{label}</span>
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

export const FloatingPopoverHeaderContext = createContext(false);

const popoverTitles = {
  zh: {
    solid: '纯色', gradient: '渐变', image: '图片', video: '视频',
    layers: '图层顺序', corners: '圆角', style: '样式',
  },
  en: {
    solid: 'Solid', gradient: 'Gradient', image: 'Image', video: 'Video',
    layers: 'Layer order', corners: 'Corner radius', style: 'Style',
  },
  ja: {
    solid: '単色', gradient: 'グラデーション', image: '画像', video: '動画',
    layers: 'レイヤー順序', corners: '角丸', style: 'スタイル',
  },
};

export function FloatingPopover({
  children,
  className = '',
  popoverKey = 'style',
  positionKey,
  title,
  language = 'zh',
  onClose,
  closeLabel,
}: {
  children: React.ReactNode;
  className?: string;
  popoverKey?: 'solid' | 'gradient' | 'image' | 'video' | 'layers' | 'corners' | 'style';
  positionKey?: string;
  title?: string;
  language?: Language;
  onClose?: () => void;
  closeLabel?: string;
}) {
  const titleId = useId();
  const heading = title || popoverTitles[language][popoverKey];
  const dismissLabel = closeLabel || { zh: '关闭', en: 'Close', ja: '閉じる' }[language];
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  // A type switch edits the current window; only a new window restores saved coordinates.
  const [storageKey] = useState(() => `galwriter-inspector-popover-position:${positionKey ?? popoverKey}`);
  const measuredInitialPosition = useRef(false);
  const clampPosition = useCallback((left: number, top: number) => {
    const panel = panelRef.current;
    const width = panel?.offsetWidth || Math.min(390, window.innerWidth - 32);
    const height = panel?.offsetHeight || 240;
    const gap = 12;
    return {
      left: Math.max(gap, Math.min(left, window.innerWidth - width - gap)),
      top: Math.max(
        gap,
        Math.min(top, window.innerHeight - Math.min(height, window.innerHeight - gap * 2) - gap),
      ),
    };
  }, []);
  const placePanel = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as {
        left?: number;
        top?: number;
      } | null;
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
    const keepVisible = () =>
      setPosition((current) => (current ? clampPosition(current.left, current.top) : current));
    window.addEventListener('resize', keepVisible);
    return () => window.removeEventListener('resize', keepVisible);
  }, [clampPosition]);
  useLayoutEffect(() => {
    if (!position || !panelRef.current || measuredInitialPosition.current) return;
    measuredInitialPosition.current = true;
    const next = clampPosition(position.left, position.top);
    if (next.left !== position.left || next.top !== position.top) setPosition(next);
  }, [clampPosition, position]);

  return (
    <>
      <div ref={anchorRef} className="absolute inset-x-0 top-0 h-0" aria-hidden="true" />
      {position &&
        createPortal(
          <div
            ref={panelRef}
            className={`property-floating-popover fixed z-[10050] w-[min(390px,calc(100vw-24px))] ${className}`}
            style={position}
            role="dialog"
            aria-labelledby={titleId}
            data-web-style-popover
          >
            <div
              className="property-floating-popover-header cursor-grab touch-none select-none active:cursor-grabbing"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                dragRef.current = {
                  pointerId: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                  left: position.left,
                  top: position.top,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                setPosition(
                  clampPosition(
                    drag.left + event.clientX - drag.x,
                    drag.top + event.clientY - drag.y,
                  ),
                );
              }}
              onPointerUp={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                dragRef.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
                const next = clampPosition(
                  drag.left + event.clientX - drag.x,
                  drag.top + event.clientY - drag.y,
                );
                setPosition(next);
                try {
                  window.localStorage.setItem(storageKey, JSON.stringify(next));
                } catch {
                  // Position persistence is optional. Large embedded media can fill
                  // localStorage; dragging the panel must still work in that case.
                }
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
              onLostPointerCapture={() => {
                dragRef.current = null;
              }}
            >
              <span id={titleId} className="min-w-0 flex-1 truncate">{heading}</span>
              {onClose && (
                <button
                  type="button"
                  className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-800 dark:hover:text-white"
                  title={dismissLabel}
                  aria-label={dismissLabel}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={onClose}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <FloatingPopoverHeaderContext.Provider value={true}>
              <div
                className="property-floating-popover-body"
                style={{ maxHeight: `max(32px, calc(100dvh - ${position.top + 64}px))`, overflowY: 'auto' }}
              >{children}</div>
            </FloatingPopoverHeaderContext.Provider>
          </div>,
          document.body,
        )}
    </>
  );
}
