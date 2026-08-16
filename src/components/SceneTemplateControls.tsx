import { ChevronDown, ImagePlus, Loader2, Upload, Volume2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { SceneEnvironment, SceneNodeData } from '../domain/project';
import { registerBlobAsset } from '../lib/blobAssetRegistry';
import { type MusicLibraryItem, saveMusicLibraryItem } from '../lib/db';
import {
  ambientSoundFromPreset,
  createNoneSceneVisualStyle,
  downloadSceneAmbientPreset,
  getSceneBackgroundAssetUrl,
  getSceneBackgroundPresets,
  getSceneVisualTemplates,
  isSameSceneBackgroundUrl,
  isSceneLightingNone,
  listSceneAmbientPresets,
  type PresetAmbientTrack,
  type SceneBackgroundPreset,
  type SceneVisualTemplate,
} from '../lib/sceneTemplates';

type SceneTemplateControlsProps = {
  data: Pick<
    SceneNodeData,
    'sceneEnvironment' | 'scenePresetEnabled' | 'visualStyle' | 'ambientSound' | 'coverImageUrl'
  >;
  onChange: (
    updates: Pick<
      SceneNodeData,
      'sceneEnvironment' | 'scenePresetEnabled' | 'visualStyle' | 'ambientSound'
    >,
  ) => void;
  onSelectSceneImage: (imageUrl: string) => void;
  onUploadSceneImage: (file: File) => void;
  language: 'zh' | 'en' | 'ja';
};

type OpenMenu = 'sceneImage' | 'lighting' | 'sound' | null;

const label = (language: SceneTemplateControlsProps['language'], zh: string, en: string) =>
  language === 'zh' ? zh : en;

const hasOwn = <Key extends PropertyKey>(value: object, key: Key) =>
  Object.prototype.hasOwnProperty.call(value, key);

const visualPreviewClass: Record<string, string> = {
  'indoor-window-daylight': 'from-sky-100 via-blue-50 to-amber-100',
  'indoor-warm-lamp': 'from-amber-100 via-orange-200 to-stone-300',
  'indoor-cool-fluorescent': 'from-slate-100 via-cyan-100 to-blue-200',
  'indoor-neon-room': 'from-indigo-950 via-fuchsia-600 to-cyan-300',
  'outdoor-clear-day': 'from-sky-300 via-blue-100 to-emerald-200',
  'outdoor-golden-hour': 'from-orange-400 via-amber-200 to-rose-200',
  'outdoor-overcast-rain': 'from-slate-500 via-blue-300 to-slate-200',
  'outdoor-night-street': 'from-slate-950 via-indigo-800 to-fuchsia-500',
};

const musicPreviewClass = [
  'from-sky-500 to-indigo-800',
  'from-amber-400 to-rose-700',
  'from-emerald-400 to-cyan-800',
  'from-violet-500 to-fuchsia-800',
];

/** Compact scene-preset row. Both selection menus expand to a four-column image grid. */
export function SceneTemplateControls({
  data,
  onChange,
  onSelectSceneImage,
  onUploadSceneImage,
  language,
}: SceneTemplateControlsProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const soundUploadInputRef = useRef<HTMLInputElement>(null);
  const sceneImageUploadInputRef = useRef<HTMLInputElement>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [tracks, setTracks] = useState<PresetAmbientTrack[]>([]);
  const [downloadingSoundId, setDownloadingSoundId] = useState<string | null>(null);
  const [hiddenSceneImageIds, setHiddenSceneImageIds] = useState<Set<string>>(() => new Set());
  const environment = data.sceneEnvironment || 'indoor';
  const enabled = data.scenePresetEnabled === true;
  const templates = getSceneVisualTemplates(environment);
  const sceneImages = getSceneBackgroundPresets(environment).filter(
    (item) => !hiddenSceneImageIds.has(item.id),
  );
  const selectedTemplate = templates.find((item) => item.id === data.visualStyle?.templateId);
  const lightingIsNone = isSceneLightingNone(data.visualStyle);
  const selectedPresetId = data.ambientSound?.source === 'preset' ? data.ambientSound.presetId || '' : '';
  const selectedSoundName = data.ambientSound?.name || label(language, '背景音', 'Ambience');
  const selectedSceneImage = sceneImages.find((item) =>
    isSameSceneBackgroundUrl(data.coverImageUrl, item.assetPath),
  );
  const lightingTitle = lightingIsNone
    ? label(language, '无打光', 'No lighting')
    : selectedTemplate?.name || label(language, '打光', 'Lighting');

  useEffect(() => {
    let cancelled = false;
    void listSceneAmbientPresets(environment).then((items) => {
      if (!cancelled) setTracks(items);
    });
    return () => {
      cancelled = true;
    };
  }, [environment]);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (controlsRef.current?.contains(event.target as Node)) return;
      setOpenMenu(null);
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, []);

  const apply = (
    updates: Partial<
      Pick<SceneNodeData, 'sceneEnvironment' | 'scenePresetEnabled' | 'visualStyle' | 'ambientSound'>
    >,
  ) =>
    onChange({
      sceneEnvironment: hasOwn(updates, 'sceneEnvironment') ? updates.sceneEnvironment : environment,
      scenePresetEnabled: hasOwn(updates, 'scenePresetEnabled') ? updates.scenePresetEnabled : enabled,
      visualStyle: hasOwn(updates, 'visualStyle') ? updates.visualStyle : data.visualStyle,
      ambientSound: hasOwn(updates, 'ambientSound') ? updates.ambientSound : data.ambientSound,
    });

  const chooseEnvironment = (next: SceneEnvironment) => {
    apply({
      sceneEnvironment: next,
      visualStyle: createNoneSceneVisualStyle(),
    });
  };

  const chooseVisual = (template: SceneVisualTemplate | null) => {
    apply({
      visualStyle: template ? { ...template.style } : createNoneSceneVisualStyle(),
    });
    setOpenMenu(null);
  };

  const chooseSceneImage = (preset: SceneBackgroundPreset) => {
    onSelectSceneImage(getSceneBackgroundAssetUrl(preset.assetPath));
    setOpenMenu(null);
  };

  const chooseSound = async (track: PresetAmbientTrack) => {
    if (downloadingSoundId) return;
    setDownloadingSoundId(track.id);
    try {
      const result = await downloadSceneAmbientPreset(track.id);
      if (result) apply({ ambientSound: ambientSoundFromPreset(result.track, result.sourceUrl, true) });
      setOpenMenu(null);
    } finally {
      setDownloadingSoundId(null);
    }
  };

  const uploadSound = async (file: File) => {
    const now = Date.now();
    const item: MusicLibraryItem = {
      id: globalThis.crypto?.randomUUID?.() ?? `scene-ambient-${now}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      blob: file,
      mimeType: file.type || undefined,
      loop: true,
      volume: 0.45,
      createdAt: now,
      updatedAt: now,
    };
    await saveMusicLibraryItem(item);
    const url = registerBlobAsset(URL.createObjectURL(file), file);
    apply({
      ambientSound: {
        enabled: true,
        source: 'library',
        libraryItemId: item.id,
        url,
        name: item.name,
        loop: true,
        volume: 0.45,
        fadeIn: 0.8,
        fadeOut: 0.8,
      },
    });
    setOpenMenu(null);
  };

  const menuButtonClass =
    'flex h-5 shrink-0 items-center gap-0 rounded border border-blue-200 bg-white/80 px-0.5 text-[9px] text-[var(--text-secondary)] transition-colors hover:border-blue-400 dark:border-blue-800 dark:bg-slate-900';

  return (
    <div
      ref={controlsRef}
      className="nodrag relative mt-1 flex min-w-0 flex-nowrap items-center gap-1.5 whitespace-nowrap text-[10px] font-medium text-blue-800"
    >
      <div
        className="inline-flex h-5 shrink-0 overflow-hidden rounded border border-blue-200 bg-white/80 dark:border-blue-800 dark:bg-slate-900"
        role="group"
        aria-label={label(language, '场景类别', 'Scene environment')}
      >
        {(['indoor', 'outdoor'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => chooseEnvironment(item)}
            aria-pressed={environment === item}
            className={`px-1.5 text-[9px] transition-colors ${
              environment === item
                ? 'bg-blue-700 text-white'
                : 'text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50'
            }`}
          >
            {item === 'indoor' ? label(language, '室内', 'Indoor') : label(language, '室外', 'Outdoor')}
          </button>
        ))}
      </div>

      {!enabled ? (
        <button
          type="button"
          onClick={() =>
            apply({
              scenePresetEnabled: true,
              visualStyle: data.visualStyle?.templateId
                ? data.visualStyle
                : createNoneSceneVisualStyle(),
            })
          }
          className="h-5 shrink-0 rounded-md border border-blue-200 bg-blue-50/70 px-1.5 text-[9px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30"
        >
          {label(language, '启用背景预设', 'Enable background preset')}
        </button>
      ) : (
        <>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenMenu((menu) => (menu === 'sceneImage' ? null : 'sceneImage'))}
              className={menuButtonClass}
              aria-expanded={openMenu === 'sceneImage'}
              title={selectedSceneImage?.label || label(language, '场景图', 'Scene image')}
            >
              <span>{label(language, '场景图', 'Scene')}</span>
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {openMenu === 'sceneImage' ? (
              <div className="absolute left-0 top-[calc(100%+5px)] z-[120] w-[276px] rounded-lg border border-blue-200 bg-[var(--card-bg)] p-1.5 shadow-xl dark:border-blue-800">
                <div className="grid grid-cols-4 gap-1">
                  {sceneImages.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => chooseSceneImage(preset)}
                      className={`relative min-w-0 overflow-hidden rounded-md border p-1 text-center transition-colors ${
                        selectedSceneImage?.id === preset.id
                          ? 'border-blue-400 bg-blue-500/10 text-blue-700'
                          : 'border-transparent hover:border-blue-200 hover:bg-blue-50 dark:hover:border-blue-800 dark:hover:bg-slate-800'
                      }`}
                      title={preset.label}
                    >
                      <img
                        src={getSceneBackgroundAssetUrl(preset.assetPath)}
                        alt={preset.label}
                        loading="lazy"
                        onError={() => {
                          setHiddenSceneImageIds((current) => {
                            if (current.has(preset.id)) return current;
                            const next = new Set(current);
                            next.add(preset.id);
                            return next;
                          });
                        }}
                        className="mx-auto h-12 w-full object-cover"
                      />
                      <span className="mt-0.5 block truncate text-[9px] leading-3">{preset.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => sceneImageUploadInputRef.current?.click()}
                    className="relative min-w-0 overflow-hidden rounded-md border border-dashed border-blue-300 p-1 text-center text-blue-700 transition-colors hover:border-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-950/40"
                  >
                    <span className="flex h-12 items-center justify-center bg-blue-50/70 dark:bg-blue-950/30">
                      <Upload className="h-3.5 w-3.5" />
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] leading-3">
                      {label(language, '上传', 'Upload')}
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenMenu((menu) => (menu === 'lighting' ? null : 'lighting'))}
              className={menuButtonClass}
              aria-expanded={openMenu === 'lighting'}
              title={lightingTitle}
            >
              <span>{label(language, '打光', 'Lighting')}</span>
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {openMenu === 'lighting' ? (
              <div className="absolute left-0 top-[calc(100%+5px)] z-[120] w-[276px] rounded-lg border border-blue-200 bg-[var(--card-bg)] p-1.5 shadow-xl dark:border-blue-800">
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => chooseVisual(null)}
                    className={`relative min-w-0 overflow-hidden rounded-md border p-1 text-center transition-colors ${
                      lightingIsNone
                        ? 'border-blue-400 bg-blue-500/10 text-blue-700'
                        : 'border-transparent hover:border-blue-200 hover:bg-blue-50 dark:hover:border-blue-800 dark:hover:bg-slate-800'
                    }`}
                    title={label(language, '无打光', 'No lighting')}
                  >
                    <span className="flex h-12 items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-900">
                      <X className="h-3.5 w-3.5" />
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] leading-3">
                      {label(language, '无', 'None')}
                    </span>
                  </button>
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => chooseVisual(template)}
                      className={`relative min-w-0 overflow-hidden rounded-md border p-1 text-center transition-colors ${
                        !lightingIsNone && selectedTemplate?.id === template.id
                          ? 'border-blue-400 bg-blue-500/10 text-blue-700'
                          : 'border-transparent hover:border-blue-200 hover:bg-blue-50 dark:hover:border-blue-800 dark:hover:bg-slate-800'
                      }`}
                      title={template.description}
                    >
                      {template.previewUrl ? (
                        <img src={template.previewUrl} alt="" className="mx-auto h-12 w-full object-cover" />
                      ) : (
                        <span
                          className={`flex h-12 w-full items-center justify-center bg-gradient-to-br ${
                            visualPreviewClass[template.id] || 'from-blue-100 to-blue-300'
                          }`}
                        >
                          <ImagePlus className="h-3.5 w-3.5 text-white/80" />
                        </span>
                      )}
                      <span className="mt-0.5 block truncate text-[9px] leading-3">
                        {template.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenMenu((menu) => (menu === 'sound' ? null : 'sound'))}
              className={menuButtonClass}
              aria-expanded={openMenu === 'sound'}
              title={selectedSoundName}
            >
              <span>{label(language, '背景音', 'Ambience')}</span>
              {downloadingSoundId ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ChevronDown className="h-2.5 w-2.5" />}
            </button>
            {openMenu === 'sound' ? (
              <div className="absolute left-0 top-[calc(100%+5px)] z-[120] w-[276px] rounded-lg border border-blue-200 bg-[var(--card-bg)] p-1.5 shadow-xl dark:border-blue-800">
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      apply({ ambientSound: undefined });
                      setOpenMenu(null);
                    }}
                    className={`relative min-w-0 overflow-hidden rounded-md border p-1 text-center transition-colors ${
                      !data.ambientSound ? 'border-blue-400 bg-blue-500/10 text-blue-700' : 'border-transparent hover:border-blue-200 hover:bg-blue-50 dark:hover:border-blue-800 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex h-12 items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-900">
                      <Volume2 className="h-3.5 w-3.5" />
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] leading-3">
                      {label(language, '无背景音', 'None')}
                    </span>
                  </button>
                  {tracks.map((track, index) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => void chooseSound(track)}
                      disabled={downloadingSoundId !== null}
                      className={`relative min-w-0 overflow-hidden rounded-md border p-1 text-center transition-colors disabled:opacity-60 ${
                        selectedPresetId === track.id
                          ? 'border-blue-400 bg-blue-500/10 text-blue-700'
                          : 'border-transparent hover:border-blue-200 hover:bg-blue-50 dark:hover:border-blue-800 dark:hover:bg-slate-800'
                      }`}
                    >
                      {track.coverUrl ? (
                        <img src={track.coverUrl} alt="" className="mx-auto h-12 w-full object-cover" />
                      ) : (
                        <span
                          className={`flex h-12 items-center justify-center bg-gradient-to-br ${
                            musicPreviewClass[index % musicPreviewClass.length]
                          }`}
                        >
                          {downloadingSoundId === track.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5 text-white/90" />
                          )}
                        </span>
                      )}
                      <span className="mt-0.5 block truncate text-[9px] leading-3">
                        {track.name}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => soundUploadInputRef.current?.click()}
                    className="relative min-w-0 overflow-hidden rounded-md border border-dashed border-blue-300 p-1 text-center text-blue-700 transition-colors hover:border-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-950/40"
                  >
                    <span className="flex h-12 items-center justify-center bg-blue-50/70 dark:bg-blue-950/30">
                      <ImagePlus className="h-3.5 w-3.5" />
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] leading-3">
                      {label(language, '上传', 'Upload')}
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <input
            ref={sceneImageUploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onUploadSceneImage(file);
                setOpenMenu(null);
              }
              event.target.value = '';
            }}
          />
          <input
            ref={soundUploadInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadSound(file);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => apply({ scenePresetEnabled: false })}
            className="h-5 shrink-0 rounded px-1 text-[9px] text-[var(--text-muted)] transition-colors hover:bg-[var(--app-bg)] hover:text-red-500"
            title={label(language, '关闭背景预设', 'Disable background preset')}
          >
            {label(language, '关闭预设', 'Close preset')}
          </button>
        </>
      )}
    </div>
  );
}
