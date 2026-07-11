import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ChevronDown,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Palette,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

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
    { key: 'left', value: 'start', icon: <AlignHorizontalJustifyStart className="h-5 w-5" /> },
    {
      key: 'center-x',
      value: 'center',
      icon: <AlignHorizontalJustifyCenter className="h-5 w-5" />,
    },
    { key: 'right', value: 'end', icon: <AlignHorizontalJustifyEnd className="h-5 w-5" /> },
  ];

  const verticalItems: Array<{
    key: string;
    value: 'start' | 'center' | 'end';
    icon: React.ReactNode;
  }> = [
    { key: 'top', value: 'start', icon: <AlignVerticalJustifyStart className="h-5 w-5" /> },
    { key: 'center-y', value: 'center', icon: <AlignVerticalJustifyCenter className="h-5 w-5" /> },
    { key: 'bottom', value: 'end', icon: <AlignVerticalJustifyEnd className="h-5 w-5" /> },
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

export function FloatingPopover({ children }: { children: React.ReactNode }) {
  return <div className="absolute left-3 right-3 top-[calc(100%-4px)] z-[90]">{children}</div>;
}
