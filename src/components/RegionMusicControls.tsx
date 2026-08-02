import { Check, LibraryBig, Music, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { RegionBackgroundMusic } from '../domain/project';
import { registerBlobAsset } from '../lib/blobAssetRegistry';
import {
  deleteMusicLibraryItem,
  listMusicLibraryItems,
  type MusicLibraryItem,
  saveMusicLibraryItem,
} from '../lib/db';
import type { Language } from '../lib/i18n';
import { regionMusicCopy } from './i18n/region-music';

type RegionMusicControlsProps = {
  language: Language;
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

type PresetMusicTrack = {
  id: string;
  name: string;
  file: string;
  tags?: string[];
  loop?: boolean;
  volume?: number;
};

type PresetMusicManifest = {
  tracks?: PresetMusicTrack[];
};

type SavedMusicTrack = MusicLibraryItem & {
  url: string;
};

const PRESET_MUSIC_MANIFEST_URL = '/presets/music/manifest.json';
const musicLibraryUrls = new Map<string, string>();

function getPresetMusicUrl(file: string) {
  return `/presets/music/${file
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function getMusicLibraryUrl(item: MusicLibraryItem) {
  const existingUrl = musicLibraryUrls.get(item.id);
  if (existingUrl) return existingUrl;

  const url = registerBlobAsset(URL.createObjectURL(item.blob), item.blob);
  musicLibraryUrls.set(item.id, url);
  return url;
}

export function RegionMusicControls({
  language,
  value,
  onChange,
}: RegionMusicControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [presetTracks, setPresetTracks] = useState<PresetMusicTrack[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [libraryTracks, setLibraryTracks] = useState<SavedMusicTrack[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const copy = regionMusicCopy(language);
  const music = value || DEFAULT_MUSIC;

  const update = (updates: Partial<RegionBackgroundMusic>) => {
    onChange({ ...music, ...updates });
  };

  const stopPreview = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    previewAudioRef.current = null;
  };

  const previewUrl = (url: string, volume: number | undefined) => {
    stopPreview();
    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, volume ?? DEFAULT_MUSIC.volume));
    previewAudioRef.current = audio;
    void audio.play().catch(() => undefined);
  };

  const applyMusic = (
    url: string,
    name: string,
    options: Pick<Partial<RegionBackgroundMusic>, 'loop' | 'volume'> = {},
  ) => {
    stopPreview();
    onChange({
      ...DEFAULT_MUSIC,
      url,
      name,
      loop: options.loop ?? true,
      volume: Math.max(0, Math.min(1, options.volume ?? DEFAULT_MUSIC.volume)),
    });
  };

  const saveCurrentTrackToLibrary = async () => {
    if (!value?.url || isSavingToLibrary) return;
    setIsSavingToLibrary(true);

    try {
      const response = await fetch(value.url);
      const blob = await response.blob();
      if (!blob.size) throw new Error('Music file is empty');

      const timestamp = Date.now();
      const item: MusicLibraryItem = {
        id:
          globalThis.crypto?.randomUUID?.() ??
          `music-${timestamp}-${Math.random().toString(36).slice(2)}`,
        name: value.name?.trim() || `${copy.musicFallbackName} ${new Date(timestamp).toLocaleDateString()}`,
        blob,
        mimeType: blob.type || undefined,
        loop: music.loop,
        volume: music.volume,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await saveMusicLibraryItem(item);
      const savedTrack: SavedMusicTrack = { ...item, url: getMusicLibraryUrl(item) };
      setLibraryTracks((tracks) => [savedTrack, ...tracks]);
      onChange({ ...music, url: savedTrack.url, name: savedTrack.name });
    } catch (error) {
      console.error('Failed to save music to library', error);
    } finally {
      setIsSavingToLibrary(false);
    }
  };

  const removeSavedTrack = async (track: SavedMusicTrack) => {
    await deleteMusicLibraryItem(track.id);
    setLibraryTracks((tracks) => tracks.filter((item) => item.id !== track.id));
    if (value?.url === track.url) onChange(undefined);
    musicLibraryUrls.delete(track.id);
  };

  useEffect(() => {
    let cancelled = false;

    void fetch(PRESET_MUSIC_MANIFEST_URL)
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load music presets');
        return (await response.json()) as PresetMusicManifest;
      })
      .then((manifest) => {
        if (cancelled) return;
        setPresetTracks(
          (manifest.tracks ?? []).filter(
            (track): track is PresetMusicTrack => Boolean(track?.id && track.name && track.file),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setPresetTracks([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPresets(false);
      });

    return () => {
      cancelled = true;
      stopPreview();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void listMusicLibraryItems()
      .then((items) => {
        if (cancelled) return;
        setLibraryTracks(items.map((item) => ({ ...item, url: getMusicLibraryUrl(item) })));
      })
      .catch((error) => console.error('Failed to load music library', error))
      .finally(() => {
        if (!cancelled) setIsLoadingLibrary(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentPresetTrack = presetTracks.some(
    (track) => value?.url === getPresetMusicUrl(track.file),
  );
  const currentLibraryTrack = libraryTracks.some((track) => value?.url === track.url);

  return (
    <div
      className="nodrag nopan flex w-80 flex-col gap-2 rounded-xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] p-3 text-[11px] text-[var(--text-primary)] shadow-2xl"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2 font-bold">
        <Music className="h-4 w-4 text-indigo-500" />
        {copy.title}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          update({ url: registerBlobAsset(URL.createObjectURL(file), file), name: file.name });
          event.target.value = '';
        }}
      />

      <MusicTrackList
        title={copy.presetLibrary}
        countLabel={`${presetTracks.length} ${copy.tracks}`}
        loading={isLoadingPresets}
        loadingLabel={copy.loadingPresets}
        emptyLabel={copy.noPresets}
        tracks={presetTracks}
        isSelected={(track) => value?.url === getPresetMusicUrl(track.file)}
        onHover={(track) => previewUrl(getPresetMusicUrl(track.file), track.volume)}
        onApply={(track) =>
          applyMusic(getPresetMusicUrl(track.file), track.name, {
            loop: track.loop,
            volume: track.volume,
          })
        }
        onStopPreview={stopPreview}
        currentLabel={copy.current}
        useLabel={copy.useTrack}
      />

      <MusicTrackList
        title={copy.myLibrary}
        countLabel={`${libraryTracks.length} ${copy.tracks}`}
        loading={isLoadingLibrary}
        loadingLabel={copy.loadingLibrary}
        emptyLabel={copy.noLibrary}
        tracks={libraryTracks}
        isSelected={(track) => value?.url === track.url}
        onHover={(track) => previewUrl(track.url, track.volume)}
        onApply={(track) => applyMusic(track.url, track.name, track)}
        onStopPreview={stopPreview}
        currentLabel={copy.current}
        useLabel={copy.useTrack}
        itemSubtitle={copy.userMusic}
        onRemove={(track) => void removeSavedTrack(track)}
        removeLabel={copy.deleteFromLibrary}
        icon={<LibraryBig className="h-3 w-3 text-indigo-500" />}
        compact
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-500 px-2 py-1.5 font-bold text-white hover:bg-indigo-600"
        >
          <Upload className="h-3.5 w-3.5" />
          {value?.url ? copy.replaceMusic : copy.uploadMusic}
        </button>
        {value?.url && !isLoadingLibrary && !currentPresetTrack && !currentLibraryTrack && (
          <button
            type="button"
            onClick={() => void saveCurrentTrackToLibrary()}
            disabled={isSavingToLibrary}
            className="flex items-center justify-center gap-1 rounded-lg border border-indigo-500/35 px-2 py-1.5 font-bold text-indigo-500 transition-colors hover:bg-indigo-500/10 disabled:cursor-wait disabled:opacity-60"
            title={copy.saveToLibrary}
          >
            <Save className="h-3.5 w-3.5" />
            {isSavingToLibrary ? copy.saving : copy.saveToLibrary}
          </button>
        )}
        {value?.url && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10"
            title={copy.removeMusic}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {value?.url && (
        <>
          <div className="truncate text-[10px] text-[var(--text-muted)]">
            {value.name || copy.musicFallbackName}
          </div>
          <label className="flex items-center justify-between gap-3">
            <span>{copy.loop}</span>
            <input
              type="checkbox"
              checked={music.loop}
              onChange={(event) => update({ loop: event.target.checked })}
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12">{copy.volume}</span>
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
            <span className="w-12">{copy.fadeIn}</span>
            <input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={music.fadeIn}
              onChange={(event) => update({ fadeIn: Number(event.target.value) })}
              className="w-16 rounded border border-[var(--card-border)] bg-transparent px-1 py-0.5"
            />
            <span>{copy.seconds}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12">{copy.fadeOut}</span>
            <input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={music.fadeOut}
              onChange={(event) => update({ fadeOut: Number(event.target.value) })}
              className="w-16 rounded border border-[var(--card-border)] bg-transparent px-1 py-0.5"
            />
            <span>{copy.seconds}</span>
          </label>
        </>
      )}
    </div>
  );
}

function MusicTrackList<Track extends { id: string; name: string; tags?: string[] }>({
  title,
  countLabel,
  loading,
  loadingLabel,
  emptyLabel,
  tracks,
  isSelected,
  onHover,
  onApply,
  onStopPreview,
  currentLabel,
  useLabel,
  itemSubtitle,
  onRemove,
  removeLabel,
  icon,
  compact = false,
}: {
  title: string;
  countLabel: string;
  loading: boolean;
  loadingLabel: string;
  emptyLabel: string;
  tracks: Track[];
  isSelected: (track: Track) => boolean;
  onHover: (track: Track) => void;
  onApply: (track: Track) => void;
  onStopPreview: () => void;
  currentLabel: string;
  useLabel: string;
  itemSubtitle?: string;
  onRemove?: (track: Track) => void;
  removeLabel?: string;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)]/40 p-2">
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-[var(--text-secondary)]">
        <span className="flex items-center gap-1">{icon}{title}</span>
        {!loading && <span>{countLabel}</span>}
      </div>
      <div className={`${compact ? 'max-h-32' : 'max-h-44'} space-y-1 overflow-y-auto pr-0.5`}>
        {loading && (
          <div className="rounded-md px-2 py-2 text-center text-[10px] text-[var(--text-muted)]">
            {loadingLabel}
          </div>
        )}
        {!loading && tracks.length === 0 && (
          <div className="rounded-md px-2 py-2 text-center text-[10px] text-[var(--text-muted)]">
            {emptyLabel}
          </div>
        )}
        {tracks.map((track) => {
          const selected = isSelected(track);
          return (
            <div
              key={track.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-indigo-500/10"
              onMouseEnter={() => onHover(track)}
              onMouseLeave={onStopPreview}
            >
              <Music className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{track.name}</div>
                {(track.tags?.length || itemSubtitle) && (
                  <div className="truncate text-[9px] text-[var(--text-muted)]">
                    {track.tags?.join(' / ') || itemSubtitle}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onApply(track)}
                className={`rounded-md p-1 transition-colors ${
                  selected
                    ? 'bg-indigo-500 text-white'
                    : 'text-indigo-500 hover:bg-indigo-500/15'
                }`}
                title={selected ? currentLabel : useLabel}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              {onRemove && removeLabel && (
                <button
                  type="button"
                  onClick={() => onRemove(track)}
                  className="rounded-md p-1 text-red-500 transition-colors hover:bg-red-500/10"
                  title={removeLabel}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RegionMusicMenu({ language, value, onChange, active }: RegionMusicMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const copy = regionMusicCopy(language);

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
              left: Math.max(8, Math.min(rect.left, window.innerWidth - 336)),
              top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 680)),
            });
          }
          setOpen((current) => !current);
        }}
        title={copy.title}
      >
        <Music className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[10000] max-h-[calc(100vh-16px)] overflow-y-auto"
            style={{ left: position.left, top: position.top }}
          >
            <RegionMusicControls language={language} value={value} onChange={onChange} />
          </div>,
          document.body,
        )}
    </>
  );
}
