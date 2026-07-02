import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';

export type ZenSelectOption<T extends string> = {
  value: T;
  label: string;
};

export function ZenSelect<T extends string>({
  value,
  options,
  onChange,
  className = '',
  ariaLabel,
  menuMinWidth,
  menuTextScale = 1,
}: {
  value: T;
  options: ZenSelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
  menuMinWidth?: number;
  menuTextScale?: number;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ignoreOutsidePointerRef = useRef(false);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportGap = 8;
    const menuGap = 6;
    const preferredHeight = Math.min(320, window.innerHeight - viewportGap * 2);
    const spaceBelow = window.innerHeight - rect.bottom - viewportGap;
    const spaceAbove = rect.top - viewportGap;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(0, (openUp ? spaceAbove : spaceBelow) - menuGap);
    const maxHeight = Math.max(72, Math.min(preferredHeight, availableHeight));
    const desiredWidth = Math.min(
      Math.max(rect.width, menuMinWidth || rect.width),
      window.innerWidth - viewportGap * 2,
    );
    const left = Math.min(
      Math.max(viewportGap, rect.left),
      Math.max(viewportGap, window.innerWidth - desiredWidth - viewportGap),
    );

    setMenuStyle({
      left,
      width: desiredWidth,
      maxHeight,
      fontSize: `${13 * menuTextScale}px`,
      top: openUp ? undefined : rect.bottom + menuGap,
      bottom: openUp ? window.innerHeight - rect.top + menuGap : undefined,
    });
  }, [menuMinWidth, menuTextScale]);

  useLayoutEffect(() => {
    if (open) updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (ignoreOutsidePointerRef.current) return;
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const reposition = () => updateMenuPosition();
    window.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, updateMenuPosition]);

  return (
    <div ref={rootRef} className={`zen-editor-select relative ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onPointerDown={() => {
          ignoreOutsidePointerRef.current = true;
          window.setTimeout(() => {
            ignoreOutsidePointerRef.current = false;
          }, 0);
        }}
        onClick={() => setOpen((current) => !current)}
        className="zen-editor-animation-select zen-editor-select-trigger w-full"
      >
        <span className="whitespace-nowrap">{selected?.label || ''}</span>
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open &&
        mounted &&
        createPortal(
        <div
          ref={menuRef}
          className="zen-editor-select-menu"
          role="listbox"
          style={menuStyle}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`zen-editor-select-option ${active ? 'zen-editor-select-option-active' : ''}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
