import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Boxes,
  Braces,
  Code2,
  FileCode2,
  Files,
  FileText,
  Film,
  Gamepad2,
  Play,
  PlusSquare,
  Presentation,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
  RenderWorkspaceLaunchIntent,
  RenderWorkspaceMode,
} from '../components/render/video/shared/types';
import type { Language } from '../lib/i18n';
import { exportQuickMenuCopy } from './i18n/export-quick-menu';

type ExportQuickMenuProps = {
  language: Language;
  onLaunch: (intent: RenderWorkspaceLaunchIntent) => void;
};

type MenuPosition = { left: number; top: number };

const MENU_WIDTH = 328;
const MENU_HEIGHT_ESTIMATE = 124;
const VIEWPORT_GAP = 12;

const DEFAULT_INTENTS: Record<RenderWorkspaceMode, RenderWorkspaceLaunchIntent> = {
  video: { workspaceMode: 'video', videoWorkspaceMode: 'timeline' },
  web: { workspaceMode: 'web', showStartMenu: true },
  ppt: { workspaceMode: 'ppt', entryMode: 'story' },
  code: { workspaceMode: 'code', codeTarget: 'renpy' },
};

export function ExportQuickMenu({ language, onLaunch }: ExportQuickMenuProps) {
  const copy = exportQuickMenuCopy(language);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const firstPrimaryRef = useRef<HTMLButtonElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<RenderWorkspaceMode>('video');
  const [position, setPosition] = useState<MenuPosition>({ left: VIEWPORT_GAP, top: 0 });
  const [lastIntent, setLastIntent] = useState<RenderWorkspaceLaunchIntent>(
    DEFAULT_INTENTS.video,
  );
  const [lastIntentByMode, setLastIntentByMode] = useState(DEFAULT_INTENTS);

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
    const maxLeft = Math.max(VIEWPORT_GAP, window.innerWidth - MENU_WIDTH - VIEWPORT_GAP);
    const centeredLeft = rect.left + rect.width / 2 - MENU_WIDTH / 2;
    const left = Math.min(Math.max(centeredLeft, VIEWPORT_GAP), maxLeft);
    const belowTop = rect.bottom + 8;
    const top =
      belowTop + MENU_HEIGHT_ESTIMATE <= window.innerHeight - VIEWPORT_GAP
        ? belowTop
        : Math.max(VIEWPORT_GAP, rect.top - MENU_HEIGHT_ESTIMATE - 8);
    setPosition({ left, top });
  };

  const openImmediately = () => {
    clearOpenTimer();
    clearCloseTimer();
    updatePosition();
    setOpen(true);
  };

  const scheduleOpen = () => {
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

  const launch = (intent: RenderWorkspaceLaunchIntent) => {
    clearOpenTimer();
    clearCloseTimer();
    setLastIntent(intent);
    setLastIntentByMode((current) => ({ ...current, [intent.workspaceMode]: intent }));
    setActiveMode(intent.workspaceMode);
    setOpen(false);
    onLaunch(intent);
  };

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
  );

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
  }, [open]);

  const primaryItems: Array<{
    mode: RenderWorkspaceMode;
    label: string;
    icon: LucideIcon;
  }> = [
    { mode: 'video', label: copy.video, icon: Film },
    { mode: 'web', label: copy.web, icon: FileText },
    { mode: 'ppt', label: copy.ppt, icon: Presentation },
    { mode: 'code', label: copy.code, icon: FileCode2 },
  ];

  const secondaryItems: Array<{
    label: string;
    icon: LucideIcon;
    intent: RenderWorkspaceLaunchIntent;
  }> =
    activeMode === 'video'
      ? [
          {
            label: copy.singleVideo,
            icon: Play,
            intent: { workspaceMode: 'video', videoWorkspaceMode: 'timeline' },
          },
          {
            label: copy.batchVideo,
            icon: Files,
            intent: { workspaceMode: 'video', videoWorkspaceMode: 'interactive' },
          },
        ]
      : activeMode === 'web'
        ? [
            {
              label: copy.withMenu,
              icon: Gamepad2,
              intent: { workspaceMode: 'web', showStartMenu: true },
            },
            {
              label: copy.withoutMenu,
              icon: Play,
              intent: { workspaceMode: 'web', showStartMenu: false },
            },
          ]
        : activeMode === 'ppt'
          ? [
              {
                label: copy.storyPpt,
                icon: BookOpen,
                intent: { workspaceMode: 'ppt', entryMode: 'story' },
              },
              {
                label: copy.manualPpt,
                icon: PlusSquare,
                intent: { workspaceMode: 'ppt', entryMode: 'manual' },
              },
            ]
          : [
              {
                label: copy.renpy,
                icon: Code2,
                intent: { workspaceMode: 'code', codeTarget: 'renpy' },
              },
              {
                label: copy.tyrano,
                icon: Braces,
                intent: { workspaceMode: 'code', codeTarget: 'tyrano' },
              },
              {
                label: copy.dialogic,
                icon: Boxes,
                intent: { workspaceMode: 'code', codeTarget: 'dialogic' },
              },
            ];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => launch(lastIntent)}
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
          window.requestAnimationFrame(() => firstPrimaryRef.current?.focus());
        }}
        className="header-glass-action header-glass-action-video flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white transition-colors hover:bg-sky-700"
        aria-label={copy.title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Film className="h-4 w-4" />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="animate-in fade-in slide-in-from-top-1 fixed z-[10050] w-[328px] overflow-hidden rounded-2xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)]/95 shadow-2xl shadow-slate-950/20 backdrop-blur-xl duration-150 dark:shadow-black/40"
            style={position}
            role="menu"
            aria-label={copy.title}
            onPointerEnter={clearCloseTimer}
            onPointerLeave={scheduleClose}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (menuRef.current?.contains(nextTarget) || triggerRef.current?.contains(nextTarget)) {
                return;
              }
              scheduleClose();
            }}
          >
            <div className="grid grid-cols-4 gap-1 p-2 pb-1.5">
              {primaryItems.map((item, index) => {
                const Icon = item.icon;
                const active = item.mode === activeMode;
                return (
                  <button
                    key={item.mode}
                    ref={index === 0 ? firstPrimaryRef : undefined}
                    type="button"
                    role="menuitem"
                    onPointerEnter={() => setActiveMode(item.mode)}
                    onFocus={() => setActiveMode(item.mode)}
                    onClick={() => launch(lastIntentByMode[item.mode])}
                    className={`flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 ${
                      active
                        ? 'bg-indigo-500/12 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300'
                        : 'text-[var(--text-muted)] hover:bg-slate-100 hover:text-[var(--text-primary)] dark:hover:bg-slate-800'
                    }`}
                    aria-current={active ? 'true' : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-[var(--toolbar-border)] p-2 pt-1.5">
              <div
                key={activeMode}
                className={`animate-in fade-in grid gap-1 duration-100 ${
                  secondaryItems.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
                }`}
              >
                {secondaryItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      onClick={() => launch(item.intent)}
                      className="flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-slate-100/80 px-2 text-[11px] font-bold text-[var(--text-secondary)] transition-[background-color,color,transform] hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:bg-slate-800/80 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-200"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
