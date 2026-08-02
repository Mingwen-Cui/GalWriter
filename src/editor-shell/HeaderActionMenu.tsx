import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface HeaderActionMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

interface HeaderActionMenuProps {
  icon: LucideIcon;
  label: string;
  ariaLabel: string;
  showLabel: boolean;
  items: HeaderActionMenuItem[];
  onTrigger: () => void;
  disabled?: boolean;
  triggerClassName?: string;
  indicator?: boolean;
  columns?: number;
}

const ITEM_WIDTH = 94;
const VIEWPORT_GAP = 12;

export function HeaderActionMenu({
  icon: TriggerIcon,
  label,
  ariaLabel,
  showLabel,
  items,
  onTrigger,
  disabled = false,
  triggerClassName = '',
  indicator = false,
  columns = items.length,
}: HeaderActionMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: VIEWPORT_GAP, top: 0 });

  const clearOpenTimer = () => {
    if (openTimerRef.current === null) return;
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = columns * ITEM_WIDTH + 16;
    const menuHeight = Math.ceil(items.length / columns) * 70 + 16;
    const maxLeft = Math.max(VIEWPORT_GAP, window.innerWidth - menuWidth - VIEWPORT_GAP);
    const centeredLeft = rect.left + rect.width / 2 - menuWidth / 2;
    const left = Math.min(Math.max(centeredLeft, VIEWPORT_GAP), maxLeft);
    const belowTop = rect.bottom + 8;
    const top =
      belowTop + menuHeight <= window.innerHeight - VIEWPORT_GAP
        ? belowTop
        : Math.max(VIEWPORT_GAP, rect.top - menuHeight - 8);
    setPosition({ left, top });
  };

  const openImmediately = () => {
    if (disabled) return;
    clearOpenTimer();
    clearCloseTimer();
    updatePosition();
    setOpen(true);
  };

  const scheduleOpen = () => {
    if (disabled) return;
    clearCloseTimer();
    if (open || openTimerRef.current !== null) return;
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      updatePosition();
      setOpen(true);
    }, 120);
  };

  const scheduleClose = () => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, 180);
  };

  const selectItem = (item: HeaderActionMenuItem) => {
    clearOpenTimer();
    clearCloseTimer();
    setOpen(false);
    item.onSelect();
  };

  useEffect(() => () => {
    clearOpenTimer();
    clearCloseTimer();
  });

  useEffect(() => {
    if (!open) return;
    const handleViewportChange = () => updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [columns, open, items.length]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onTrigger}
        onPointerEnter={scheduleOpen}
        onPointerLeave={scheduleClose}
        onFocus={openImmediately}
        onBlur={(event) => {
          if (menuRef.current?.contains(event.relatedTarget as Node | null)) return;
          scheduleClose();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          openImmediately();
          window.requestAnimationFrame(() => firstItemRef.current?.focus());
        }}
        disabled={disabled}
        className={triggerClassName}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <TriggerIcon className="h-4 w-4" />
        {showLabel && <span className="editor-header-action-label">{label}</span>}
        {indicator && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={ariaLabel}
            onPointerEnter={clearCloseTimer}
            onPointerLeave={scheduleClose}
            className="animate-in fade-in slide-in-from-top-1 fixed z-[10050] grid gap-1.5 rounded-2xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)]/95 p-2 shadow-2xl shadow-slate-950/20 backdrop-blur-xl duration-150 dark:shadow-black/40"
            style={{
              ...position,
              width: columns * ITEM_WIDTH + 16,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  ref={index === 0 ? firstItemRef : undefined}
                  type="button"
                  role="menuitem"
                  onClick={() => selectItem(item)}
                  className="flex h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 text-[var(--text-muted)] transition-colors hover:bg-indigo-500/12 hover:text-indigo-600 focus-visible:bg-indigo-500/12 focus-visible:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:hover:bg-indigo-400/15 dark:hover:text-indigo-300 dark:focus-visible:bg-indigo-400/15 dark:focus-visible:text-indigo-300"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                  <span className="w-full truncate text-[10px] font-black leading-3">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
