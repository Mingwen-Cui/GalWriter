import { Eye, EyeOff, RotateCw, Trash2 } from 'lucide-react';

import type { WebExportSettings } from '../video/shared/types';
import type {
  StartMenuAction,
  StartMenuElement,
  StartMenuResizeHandle,
} from './webPlaytestStartMenuTools';
import {
  getResizeHandleStyle,
  protectedStartMenuElementRoles,
  readStartMenuImageFile,
  resizeHandlePositionClass,
  resizeHandleShapeClass,
} from './webPlaytestStartMenuTools';

const resizeHandles: StartMenuResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type WebPlaytestStartMenuElementProps = {
  element: StartMenuElement;
  selected: boolean;
  action: StartMenuAction | null;
  previewMode: 'edit' | 'test';
  editingStartMenuElementId: string | null;
  hasCustomStartMenuElements: boolean;
  settings: WebExportSettings;
  choiceColor: string;
  choiceTextColor: string;
  t: (zh: string, ja: string, en: string) => string;
  onEnsureStartMenuElements: () => void;
  onSelectElement: (id: string) => void;
  onSetEditingElement: (id: string | null) => void;
  onUpdateElement: (id: string, patch: Partial<StartMenuElement>) => void;
  onDeleteElement?: (id: string) => void;
  onBeginDrag: (
    event: React.PointerEvent<HTMLElement>,
    element: StartMenuElement,
    type: 'move' | 'resize' | 'rotate',
    resizeHandle?: StartMenuResizeHandle,
  ) => void;
};

export function WebPlaytestStartMenuElement({
  element,
  selected,
  action,
  previewMode,
  editingStartMenuElementId,
  hasCustomStartMenuElements,
  settings,
  choiceColor,
  choiceTextColor,
  t,
  onEnsureStartMenuElements,
  onSelectElement,
  onSetEditingElement,
  onUpdateElement,
  onDeleteElement,
  onBeginDrag,
}: WebPlaytestStartMenuElementProps) {
  if (!element.visible && previewMode !== 'edit') return null;

  const elementBackground =
    element.backgroundType === 'image' && element.backgroundImageUrl
      ? `center / cover url("${element.backgroundImageUrl.replace(/"/g, '\\"')}")`
      : element.backgroundType === 'gradient'
        ? `linear-gradient(${element.backgroundGradientAngle ?? 135}deg, ${element.backgroundGradientStart || choiceColor}, ${element.backgroundGradientEnd || '#0f172a'})`
        : element.backgroundColor;
  const elementStyle: React.CSSProperties = {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    transform: `rotate(${element.rotation}deg) scale(${element.scale})`,
    opacity: element.visible ? 1 : 0.34,
  };

  const ensureAndSelect = () => {
    if (!hasCustomStartMenuElements) onEnsureStartMenuElements();
    onSelectElement(element.id);
  };

  const content = (
    <span
      data-start-menu-text-id={element.id}
      contentEditable={previewMode === 'edit' && editingStartMenuElementId === element.id}
      suppressContentEditableWarning
      onDoubleClick={(event) => {
        if (previewMode !== 'edit') return;
        event.stopPropagation();
        event.preventDefault();
        ensureAndSelect();
        onSetEditingElement(element.id);
      }}
      onPointerDown={(event) => {
        if (previewMode === 'edit') event.stopPropagation();
      }}
      onBlur={(event) => {
        onUpdateElement(element.id, {
          text: event.currentTarget.textContent || '',
        });
        onSetEditingElement(null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className={`outline-none ${
        previewMode === 'edit' && editingStartMenuElementId !== element.id ? 'cursor-text' : ''
      } ${!element.text && previewMode === 'edit' ? 'min-h-[1em] min-w-10 rounded border border-dashed border-white/35 px-1 text-white/45' : ''}`}
    >
      {element.text ||
        (previewMode === 'edit' && editingStartMenuElementId !== element.id
          ? t('双击编辑', '編集', 'Edit')
          : '')}
    </span>
  );

  const startEditingText = (event: React.MouseEvent<HTMLElement>) => {
    if (previewMode !== 'edit' || (element.kind !== 'text' && element.kind !== 'button')) return;
    event.stopPropagation();
    event.preventDefault();
    ensureAndSelect();
    onSetEditingElement(element.id);
  };
  const canDeleteElement = !element.role || !protectedStartMenuElementRoles.has(element.role);

  return (
    <div
      className={`absolute origin-center pointer-events-auto ${previewMode === 'edit' ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{
        ...elementStyle,
        zIndex: selected ? 40 : 20,
      }}
      onPointerDown={(event) => onBeginDrag(event, element, 'move')}
      onClick={(event) => {
        if (previewMode !== 'edit') return;
        event.stopPropagation();
        ensureAndSelect();
      }}
      onDoubleClick={startEditingText}
    >
      {previewMode === 'edit' && element.kind === 'button' && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 max-w-full -translate-y-[calc(100%+4px)] truncate rounded-full bg-slate-950/78 px-2 py-0.5 text-[10px] font-black text-white shadow backdrop-blur">
          {action?.label || element.id}
        </div>
      )}
      {element.kind === 'image' ? (
        element.imageUrl ? (
          <img
            src={element.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ borderRadius: element.borderRadius ?? 12 }}
            draggable={false}
          />
        ) : (
          <label
            className="grid h-full w-full cursor-pointer place-items-center border border-dashed border-white/35 bg-white/10 px-2 text-center text-[11px] font-black text-white/60"
            style={{ borderRadius: element.borderRadius ?? 12 }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {t('选择图片', '画像 URL', 'Image')}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  readStartMenuImageFile(file, (value) =>
                    onUpdateElement(element.id, { imageUrl: value }),
                  );
                }
                event.currentTarget.value = '';
              }}
            />
          </label>
        )
      ) : element.kind === 'button' ? (
        <button
          type="button"
          disabled={previewMode !== 'edit' && Boolean(element.disabled && !action)}
          onClick={(event) => {
            if (editingStartMenuElementId === element.id) return;
            if (previewMode === 'edit') {
              event.preventDefault();
              return;
            }
            action?.onClick();
          }}
          className={`h-full w-full rounded-lg border font-black transition-transform ${
            element.primary
              ? 'border-white/24 text-white shadow-lg shadow-black/15'
              : 'border-white/16 bg-white/10 text-white'
          } ${settings.startMenuTemplate === 'minimal' ? 'bg-transparent backdrop-blur-0' : 'backdrop-blur-xl'} disabled:opacity-45`}
          style={{
            background: elementBackground || (element.primary ? `${choiceColor}e6` : undefined),
            color: element.textColor || (element.primary ? choiceTextColor : undefined),
            borderColor: element.borderColor,
            fontSize: element.fontSize,
            borderRadius: element.borderRadius ?? 12,
          }}
        >
          {content}
        </button>
      ) : (
        <div
          className={`flex h-full w-full items-center ${
            element.role === 'subtitle' ? 'text-white/68' : 'text-white'
          } ${element.role === 'title' ? 'font-black leading-[1.06] [text-shadow:0_12px_36px_rgba(0,0,0,0.55)]' : 'font-black'}`}
          style={{
            fontSize: element.fontSize,
            color: element.textColor,
            borderRadius: element.borderRadius ?? 0,
          }}
        >
          {content}
        </div>
      )}
      {previewMode === 'edit' && selected && (
        <>
          <div
            className="pointer-events-none absolute inset-0 ring-2 ring-sky-300"
            style={{
              borderRadius: element.borderRadius ?? (element.kind === 'text' ? 0 : 12),
            }}
          />
          <button
            type="button"
            className="absolute -right-8 -top-3 grid h-6 w-6 place-items-center rounded-full bg-sky-500 text-white shadow"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onUpdateElement(element.id, { visible: !element.visible });
            }}
            title={element.visible ? t('隐藏', '非表示', 'Hide') : t('显示', '表示', 'Show')}
          >
            {element.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          {canDeleteElement && (
            <button
              type="button"
              className="absolute -right-8 top-5 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white shadow"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteElement?.(element.id);
              }}
              title={t('删除', '削除', 'Delete')}
              aria-label={t('删除', '削除', 'Delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            className="absolute -left-8 -top-3 grid h-6 w-6 cursor-alias place-items-center rounded-full bg-white text-slate-900 shadow"
            style={{ cursor: 'alias' }}
            onPointerDown={(event) => onBeginDrag(event, element, 'rotate')}
            title={t('旋转', '回転', 'Rotate')}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          {resizeHandles.map((handle) => (
            <button
              key={handle}
              type="button"
              className={`absolute border border-sky-200 bg-white shadow ${resizeHandlePositionClass[handle]} ${resizeHandleShapeClass[handle]}`}
              style={getResizeHandleStyle(handle)}
              onPointerDown={(event) => onBeginDrag(event, element, 'resize', handle)}
              title={t('调整大小', 'リサイズ', 'Resize')}
              aria-label={t('调整大小', 'リサイズ', 'Resize')}
            />
          ))}
        </>
      )}
    </div>
  );
}
