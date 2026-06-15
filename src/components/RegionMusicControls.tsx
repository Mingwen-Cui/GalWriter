import { Music, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { RegionBackgroundMusic } from '../domain/project';

type RegionMusicControlsProps = {
  value?: RegionBackgroundMusic;
  onChange: (value: RegionBackgroundMusic | undefined) => void;
};

type RegionMusicMenuProps = RegionMusicControlsProps & {
  active: boolean;
};

const DEFAULT_MUSIC: RegionBackgroundMusic = {
  url: '',
  loop: true,
  volume: 0.5,
  fadeIn: 1,
  fadeOut: 1,
};

export function RegionMusicControls({ value, onChange }: RegionMusicControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const music = value || DEFAULT_MUSIC;

  const update = (updates: Partial<RegionBackgroundMusic>) => {
    onChange({ ...music, ...updates });
  };

  return (
    <div
      className="nodrag nopan flex min-w-64 flex-col gap-2 rounded-xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] p-3 text-[11px] text-[var(--text-primary)] shadow-2xl"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2 font-bold">
        <Music className="h-4 w-4 text-indigo-500" />
        区域背景音乐
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          update({ url: URL.createObjectURL(file), name: file.name });
          event.target.value = '';
        }}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-500 px-2 py-1.5 font-bold text-white hover:bg-indigo-600"
        >
          <Upload className="h-3.5 w-3.5" />
          {value?.url ? '更换音乐' : '添加音乐'}
        </button>
        {value?.url && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10"
            title="移除背景音乐"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {value?.url && (
        <>
          <div className="truncate text-[10px] text-[var(--text-muted)]">
            {value.name || '已添加背景音乐'}
          </div>
          <label className="flex items-center justify-between gap-3">
            <span>循环播放</span>
            <input
              type="checkbox"
              checked={music.loop}
              onChange={(event) => update({ loop: event.target.checked })}
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12">音量</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={music.volume}
              onChange={(event) => update({ volume: Number(event.target.value) })}
              className="flex-1"
            />
            <span className="w-9 text-right">{Math.round(music.volume * 100)}%</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12">淡入</span>
            <input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={music.fadeIn}
              onChange={(event) => update({ fadeIn: Number(event.target.value) })}
              className="w-16 rounded border border-[var(--card-border)] bg-transparent px-1 py-0.5"
            />
            <span>秒</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12">淡出</span>
            <input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={music.fadeOut}
              onChange={(event) => update({ fadeOut: Number(event.target.value) })}
              className="w-16 rounded border border-[var(--card-border)] bg-transparent px-1 py-0.5"
            />
            <span>秒</span>
          </label>
        </>
      )}
    </div>
  );
}

export function RegionMusicMenu({ value, onChange, active }: RegionMusicMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target as globalThis.Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', closeMenu);
    return () => window.removeEventListener('pointerdown', closeMenu);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`nodrag nopan rounded-lg p-1.5 transition-colors hover:bg-[var(--app-bg)] ${
          active ? 'text-indigo-500' : 'text-[var(--text-secondary)]'
        }`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) {
            setPosition({
              left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
              top: Math.min(rect.bottom + 8, window.innerHeight - 300),
            });
          }
          setOpen((current) => !current);
        }}
        title="设置区域背景音乐"
      >
        <Music className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[10000]"
            style={{ left: position.left, top: position.top }}
          >
            <RegionMusicControls value={value} onChange={onChange} />
          </div>,
          document.body,
        )}
    </>
  );
}
