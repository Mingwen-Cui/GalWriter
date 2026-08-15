import { Check, PaintBucket } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { PptCopy } from './i18n';

const SWATCHES = [
  '#020617',
  '#0f172a',
  '#1e293b',
  '#312e81',
  '#4c1d95',
  '#7f1d1d',
  '#14532d',
  '#0f766e',
  '#f8fafc',
];

const validColor = (value: string) => (/^#[\da-f]{6}$/i.test(value) ? value : '#020617');

export function PptSlideBackgroundMenu({
  position,
  backgroundColor,
  copy,
  onChange,
  onClose,
}: {
  position: { x: number; y: number };
  backgroundColor: string;
  copy: Pick<PptCopy, 'backgroundColor' | 'slideBackground' | 'currentSlideOnly'>;
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState(position);
  const color = validColor(backgroundColor);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const padding = 8;
    const pointerOffset = 8;
    const preferredX = position.x + pointerOffset;
    const preferredY = position.y + pointerOffset;
    const x =
      preferredX + rect.width <= window.innerWidth - padding
        ? preferredX
        : position.x - rect.width - pointerOffset;
    const y =
      preferredY + rect.height <= window.innerHeight - padding
        ? preferredY
        : position.y - rect.height - pointerOffset;
    setMenuPosition({
      x: Math.max(padding, Math.min(x, window.innerWidth - rect.width - padding)),
      y: Math.max(padding, Math.min(y, window.innerHeight - rect.height - padding)),
    });
  }, [position]);

  useEffect(() => {
    const close = () => onClose();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={copy.slideBackground}
      className="video-render-workspace fixed isolate z-[2147483647] w-64 rounded-xl border border-[var(--vr-border)] p-3 text-[var(--vr-text)] shadow-2xl"
      style={{
        left: menuPosition.x,
        top: menuPosition.y,
        backgroundColor: 'var(--vr-surface-strong, #ffffff)',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="mb-3 flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]">
          <PaintBucket className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-black">{copy.slideBackground}</div>
          <p className="mt-0.5 text-[11px] font-medium text-[var(--vr-text-muted)]">
            {copy.currentSlideOnly}
          </p>
        </div>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2.5 py-2 text-xs font-bold text-[var(--vr-text-soft)]">
        <span className="min-w-0 flex-1">{copy.backgroundColor}</span>
        <span className="font-mono text-[11px] uppercase text-[var(--vr-text-muted)]">{color}</span>
        <input
          type="color"
          aria-label={copy.backgroundColor}
          value={color}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        />
      </label>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label={copy.backgroundColor}>
        {SWATCHES.map((swatch) => {
          const selected = swatch.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              aria-pressed={selected}
              onClick={() => {
                onChange(swatch);
                onClose();
              }}
              className={`relative h-8 rounded-md border transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--vr-accent)] ${
                selected
                  ? 'border-[var(--vr-accent)] ring-1 ring-[var(--vr-accent)]'
                  : 'border-black/15'
              }`}
              style={{ backgroundColor: swatch }}
            >
              {selected ? (
                <Check
                  className={`absolute inset-0 m-auto h-4 w-4 ${
                    swatch === '#f8fafc' ? 'text-slate-900' : 'text-white'
                  }`}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
