import type { CSSProperties } from 'react';
import type React from 'react';
import { Lock, Unlock } from 'lucide-react';

import type { Language } from '../../../lib/i18n';
import { renderCopy } from '../video/shared/renderCopy';
import type { WebExportSettings } from '../video/shared/types';

type PlacementResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const placementResizeHandles: PlacementResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const resizeHandlePositionClass: Record<PlacementResizeHandle, string> = {
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
  s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  e: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2',
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2',
  se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
  sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
};
const resizeHandleShapeClass: Record<PlacementResizeHandle, string> = {
  n: 'h-2.5 w-12 rounded-full',
  s: 'h-2.5 w-12 rounded-full',
  e: 'h-12 w-2.5 rounded-full',
  w: 'h-12 w-2.5 rounded-full',
  ne: 'h-4 w-4 rounded-full',
  nw: 'h-4 w-4 rounded-full',
  se: 'h-4 w-4 rounded-full',
  sw: 'h-4 w-4 rounded-full',
};
const resizeCursorByHandle: Record<PlacementResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

const getResizeHandleStyle = (handle: PlacementResizeHandle): CSSProperties => {
  if (handle === 'n' || handle === 's') {
    return { width: 'min(72%, 120px)', minWidth: 24, cursor: resizeCursorByHandle[handle] };
  }
  if (handle === 'e' || handle === 'w') {
    return { height: 'min(72%, 120px)', minHeight: 24, cursor: resizeCursorByHandle[handle] };
  }
  return { cursor: resizeCursorByHandle[handle] };
};

type WebPreviewMenuPagesProps = {
  language: Language;
  settings: WebExportSettings;
  previewMode: 'edit' | 'test';
  selectedStartMenuElementId?: string | null;
  archiveOpen: boolean;
  settingsOpen: boolean;
  backgroundClass: string;
  backgroundStyle?: CSSProperties;
  boundsMinX: number;
  boundsMinY: number;
  boundsMaxX: number;
  boundsMaxY: number;
  choiceColor: string;
  choiceTextColor: string;
  previewControlsHidden: boolean;
  onCloseArchive: () => void;
  onCloseSettings: () => void;
  onNewGame: () => void;
  onToggleControls: () => void;
  onBeginBoundsDrag: (
    event: React.PointerEvent<HTMLElement>,
    type: 'move' | 'resize',
    resizeHandle?: PlacementResizeHandle,
  ) => void;
  onUpdateSettings: <K extends keyof WebExportSettings>(key: K, value: WebExportSettings[K]) => void;
};

export function WebPreviewMenuPages({
  language,
  settings,
  previewMode,
  selectedStartMenuElementId,
  archiveOpen,
  settingsOpen,
  backgroundClass,
  backgroundStyle,
  boundsMinX,
  boundsMinY,
  boundsMaxX,
  boundsMaxY,
  choiceColor,
  choiceTextColor,
  previewControlsHidden,
  onCloseArchive,
  onCloseSettings,
  onNewGame,
  onToggleControls,
  onBeginBoundsDrag,
  onUpdateSettings,
}: WebPreviewMenuPagesProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const primaryButtonStyle = {
    borderColor: 'rgba(255,255,255,0.22)',
    background: choiceColor,
    color: choiceTextColor,
  };
  const placementBoundsOverlay = (
    <PlacementBoundsOverlay
      settings={settings}
      previewMode={previewMode}
      selectedStartMenuElementId={selectedStartMenuElementId}
      boundsMinX={boundsMinX}
      boundsMinY={boundsMinY}
      boundsMaxX={boundsMaxX}
      boundsMaxY={boundsMaxY}
      t={t}
      onBeginBoundsDrag={onBeginBoundsDrag}
      onUpdateSettings={onUpdateSettings}
    />
  );

  return (
    <>
      {archiveOpen && (
        <div className={`absolute inset-0 z-50 text-white ${backgroundClass}`} style={backgroundStyle}>
          <div className="relative z-10 flex h-full flex-col bg-black/28 p-6 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-black tracking-wide">{t('存档', 'セーブ', 'Save')}</div>
              <button
                type="button"
                onClick={onCloseArchive}
                className="h-10 rounded-xl border border-white/14 bg-white/10 px-4 text-xs font-black text-white/82 transition-colors hover:bg-white/18 hover:text-white"
              >
                {t('返回', '戻る', 'Back')}
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="grid w-[min(520px,100%)] gap-3">
                <button
                  type="button"
                  className="grid min-h-20 gap-1 rounded-xl border px-4 py-4 text-left text-sm font-black transition-transform active:scale-[0.99]"
                  style={{
                    borderColor: 'rgba(255,255,255,0.16)',
                    background: 'rgba(255,255,255,0.10)',
                    color: '#f8fafc',
                  }}
                >
                  <span>{t('没有存档', 'セーブなし', 'No save')}</span>
                  <span className="text-xs font-bold text-white/50">
                    {t(
                      '导出后的网页会在这里显示上次进度。',
                      '書き出し後のWebでは前回の進行がここに表示されます。',
                      'Exported web builds show the last progress here.',
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onNewGame}
                  className="h-12 rounded-xl border px-4 text-sm font-black transition-transform hover:brightness-110 active:scale-[0.99]"
                  style={primaryButtonStyle}
                >
                  {t('新游戏', '新規ゲーム', 'New Game')}
                </button>
              </div>
            </div>
          </div>
          {placementBoundsOverlay}
        </div>
      )}
      {settingsOpen && (
        <div className={`absolute inset-0 z-50 text-white ${backgroundClass}`} style={backgroundStyle}>
          <div className="relative z-10 flex h-full flex-col bg-black/28 p-6 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-black tracking-wide">{t('设置', '設定', 'Settings')}</div>
              <button
                type="button"
                onClick={onCloseSettings}
                className="h-10 rounded-xl border border-white/14 bg-white/10 px-4 text-xs font-black text-white/82 transition-colors hover:bg-white/18 hover:text-white"
              >
                {t('返回', '戻る', 'Back')}
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="grid w-[min(520px,100%)] gap-3">
                <button
                  type="button"
                  onClick={() => onUpdateSettings('autoAdvance', !settings.autoAdvance)}
                  className="flex h-12 items-center justify-between rounded-xl border border-white/12 bg-white/10 px-4 text-sm font-black text-white/86 transition-colors hover:bg-white/16"
                >
                  <span>{t('自动播放', '自動再生', 'Auto play')}</span>
                  <span className={`h-5 w-10 rounded-full p-0.5 ${settings.autoAdvance ? 'bg-sky-500' : 'bg-white/18'}`}>
                    <span
                      className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                        settings.autoAdvance ? 'translate-x-5' : ''
                      }`}
                    />
                  </span>
                </button>
                <label className="grid gap-2 rounded-xl border border-white/12 bg-white/10 p-4">
                  <div className="flex items-center justify-between text-sm font-black text-white/86">
                    <span>{t('打字速度', 'テキスト速度', 'Text speed')}</span>
                    <span className="text-xs text-white/55">{settings.typewriterSpeed}ms</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={5}
                    value={settings.typewriterSpeed}
                    onChange={(event) => onUpdateSettings('typewriterSpeed', Number(event.target.value))}
                    className="w-full accent-sky-400"
                  />
                </label>
                <button
                  type="button"
                  onClick={onToggleControls}
                  className="flex h-12 items-center justify-between rounded-xl border px-4 text-sm font-black transition-transform hover:brightness-110 active:scale-[0.99]"
                  style={primaryButtonStyle}
                >
                  <span>{t('显示控制栏', '操作表示', 'Show controls')}</span>
                  <span>{previewControlsHidden ? t('关闭', 'オフ', 'Off') : t('开启', 'オン', 'On')}</span>
                </button>
              </div>
            </div>
          </div>
          {placementBoundsOverlay}
        </div>
      )}
    </>
  );
}

type PlacementBoundsOverlayProps = {
  settings: WebExportSettings;
  previewMode: 'edit' | 'test';
  selectedStartMenuElementId?: string | null;
  boundsMinX: number;
  boundsMinY: number;
  boundsMaxX: number;
  boundsMaxY: number;
  t: (zh: string, ja: string, en: string) => string;
  onBeginBoundsDrag: (
    event: React.PointerEvent<HTMLElement>,
    type: 'move' | 'resize',
    resizeHandle?: PlacementResizeHandle,
  ) => void;
  onUpdateSettings: <K extends keyof WebExportSettings>(key: K, value: WebExportSettings[K]) => void;
};

function PlacementBoundsOverlay({
  settings,
  previewMode,
  selectedStartMenuElementId,
  boundsMinX,
  boundsMinY,
  boundsMaxX,
  boundsMaxY,
  t,
  onBeginBoundsDrag,
  onUpdateSettings,
}: PlacementBoundsOverlayProps) {
  if (previewMode !== 'edit') return null;

  const canEditBounds = selectedStartMenuElementId === null;

  return (
    <div
      className={`absolute z-10 border-[2.5px] border-dashed shadow-[0_0_0_1px_rgba(0,0,0,0.12)] ${
        settings.startMenuPlacementBoundsLocked ? 'border-slate-400/65' : 'border-white/60'
      } ${
        canEditBounds && !settings.startMenuPlacementBoundsLocked
          ? 'cursor-grab active:cursor-grabbing pointer-events-auto'
          : canEditBounds
            ? 'pointer-events-auto'
            : 'pointer-events-none'
      }`}
      style={{
        left: `${boundsMinX}%`,
        top: `${boundsMinY}%`,
        width: `${boundsMaxX - boundsMinX}%`,
        height: `${boundsMaxY - boundsMinY}%`,
      }}
      onPointerDown={(event) => {
        if (canEditBounds && !settings.startMenuPlacementBoundsLocked) {
          onBeginBoundsDrag(event, 'move');
        }
      }}
      onClick={(event) => event.stopPropagation()}
      title={t('文字/图片范围', 'テキスト/画像範囲', 'Text/image bounds')}
    >
      {canEditBounds && (
        <button
          type="button"
          className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full border shadow transition-colors pointer-events-auto border-white/35 bg-slate-950/70 text-white hover:bg-slate-900"
          style={{
            borderColor: settings.startMenuPlacementBoundsLocked ? 'var(--vr-accent)' : undefined,
            backgroundColor: settings.startMenuPlacementBoundsLocked ? 'var(--vr-accent)' : undefined,
            color: settings.startMenuPlacementBoundsLocked ? '#ffffff' : undefined,
            zIndex: 30,
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onUpdateSettings('startMenuPlacementBoundsLocked', !settings.startMenuPlacementBoundsLocked);
          }}
          title={t('锁定文字/图片范围', 'テキスト/画像範囲をロック', 'Lock text/image bounds')}
          aria-label={t('锁定文字/图片范围', 'テキスト/画像範囲をロック', 'Lock text/image bounds')}
        >
          {settings.startMenuPlacementBoundsLocked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <Unlock className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      {canEditBounds &&
        !settings.startMenuPlacementBoundsLocked &&
        placementResizeHandles.map((handle) => (
          <button
            key={handle}
            type="button"
            className={`absolute border bg-white shadow pointer-events-auto ${
              settings.startMenuPlacementBoundsLocked ? 'border-amber-200' : 'border-white'
            } ${resizeHandlePositionClass[handle]} ${resizeHandleShapeClass[handle]}`}
            style={{
              ...getResizeHandleStyle(handle),
              zIndex: 30,
            }}
            onPointerDown={(event) => onBeginBoundsDrag(event, 'resize', handle)}
            onClick={(event) => event.stopPropagation()}
            aria-label={t('调整范围', '範囲を調整', 'Resize bounds')}
          />
        ))}
    </div>
  );
}
