import type { CSSProperties } from 'react';

import type { WebExportSettings } from '../video/shared/types';
import { WebEditableElementFrame } from './WebEditableElementFrame';
import { linearGradientFromStops, normalizeGradientStops } from './webGradientStops';
import {
  webColorWithAlpha,
  webElementBoxStyle,
  webElementShadowStyle,
} from './webElementStyle';
import type {
  StartMenuAction,
  StartMenuElement,
  StartMenuResizeHandle,
} from './webPlaytestStartMenuTools';
import { protectedStartMenuElementRoles, readStartMenuImageFile } from './webPlaytestStartMenuTools';

const textColorWithAlpha = (color: string | undefined, alpha: number | undefined) => {
  return webColorWithAlpha(color, alpha, '#ffffff');
};

const textAlignStyle = (
  align: StartMenuElement['textAlign'],
): Pick<CSSProperties, 'justifyContent' | 'textAlign'> => {
  if (align === 'center') return { justifyContent: 'center', textAlign: 'center' };
  if (align === 'right') return { justifyContent: 'flex-end', textAlign: 'right' };
  return { justifyContent: 'flex-start', textAlign: 'left' };
};

const radiusStyle = (
  element: StartMenuElement,
  fallback: number,
): Pick<
  CSSProperties,
  | 'borderRadius'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderBottomRightRadius'
  | 'borderBottomLeftRadius'
> => {
  const base = element.borderRadius ?? fallback;
  return {
    borderRadius: base,
    borderTopLeftRadius: element.borderTopLeftRadius ?? base,
    borderTopRightRadius: element.borderTopRightRadius ?? base,
    borderBottomRightRadius: element.borderBottomRightRadius ?? base,
    borderBottomLeftRadius: element.borderBottomLeftRadius ?? base,
  };
};

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
    element.fillEnabled === false
      ? undefined
      : element.backgroundType === 'image' && element.backgroundImageUrl
      ? `center / cover url("${element.backgroundImageUrl.replace(/"/g, '\\"')}")`
      : element.backgroundType === 'gradient'
        ? linearGradientFromStops(
            element.backgroundGradientAngle ?? 135,
            normalizeGradientStops(
              element.backgroundGradientStops,
              element.backgroundGradientStart || choiceColor,
              element.backgroundGradientEnd || '#0f172a',
            ),
          )
        : element.backgroundColor;
  const elementStyle: React.CSSProperties = {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    transform: `rotate(${element.rotation}deg) scale(${element.scale})`,
    opacity: element.visible ? Math.max(0, Math.min(100, element.opacity ?? 100)) / 100 : 0.34,
  };
  const textElementStyle: CSSProperties = {
    ...textAlignStyle(element.textAlign),
    ...webElementShadowStyle(element, 'text'),
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    color: textColorWithAlpha(element.textColor, element.textColorAlpha),
    WebkitTextStroke:
      element.strokeEnabled !== false && (element.textStrokeWidth ?? 0) > 0
        ? `${element.textStrokeWidth}px ${element.textStrokeColor || '#000000'}`
        : undefined,
    letterSpacing: Number.isFinite(Number(element.letterSpacing))
      ? `${element.letterSpacing}px`
      : undefined,
    lineHeight: element.lineHeight,
    ...radiusStyle(element, 0),
    whiteSpace: 'pre-wrap',
  };

  const ensureAndSelect = () => {
    if (!hasCustomStartMenuElements) onEnsureStartMenuElements();
    onSelectElement(element.id);
  };
  const visibleText = element.textVisible === false ? '' : element.text;

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
      } ${!visibleText && element.textVisible !== false && previewMode === 'edit' ? 'min-h-[1em] min-w-10 rounded border border-dashed border-white/35 px-1 text-white/45' : ''}`}
    >
      {visibleText ||
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
      data-selectable-element-id={element.id}
      style={{
        ...elementStyle,
        zIndex: selected ? 1000 : 20 + (element.zIndex ?? 0),
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
            style={{
              ...radiusStyle(element, 12),
              ...webElementBoxStyle(element),
              mixBlendMode: element.blendMode as CSSProperties['mixBlendMode'],
            }}
            draggable={false}
          />
        ) : (
          <label
            className="grid h-full w-full cursor-pointer place-items-center border border-dashed border-white/35 bg-white/10 px-2 text-center text-[11px] font-black text-white/60"
            style={radiusStyle(element, 12)}
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
          className={`h-full w-full rounded-lg border font-black ${
            element.primary
              ? 'border-white/24 text-white shadow-lg shadow-black/15'
              : 'border-white/16 bg-white/10 text-white'
          } ${settings.startMenuTemplate === 'minimal' ? 'bg-transparent backdrop-blur-0' : 'backdrop-blur-xl'} disabled:opacity-45`}
          style={{
            background: elementBackground || (element.primary ? `${choiceColor}e6` : undefined),
            color: textColorWithAlpha(
              element.textColor || (element.primary ? choiceTextColor : '#f8fafc'),
              element.textColorAlpha,
            ),
            display: 'flex',
            alignItems: 'center',
            ...textAlignStyle(element.textAlign || 'center'),
            fontFamily: element.fontFamily,
            fontWeight: element.fontWeight,
            letterSpacing: Number.isFinite(Number(element.letterSpacing))
              ? `${element.letterSpacing}px`
              : undefined,
            lineHeight: element.lineHeight,
            whiteSpace: 'pre-wrap',
            fontSize: element.fontSize,
            ...radiusStyle(element, 12),
            ...webElementBoxStyle(element),
            mixBlendMode: element.blendMode as CSSProperties['mixBlendMode'],
          }}
        >
          {content}
        </button>
      ) : (
        <div
          className={`flex h-full w-full items-center ${
            element.role === 'subtitle' ? 'text-white/68' : 'text-white'
          } ${element.role === 'title' ? 'font-black leading-[1.06] [text-shadow:0_12px_36px_rgba(0,0,0,0.55)]' : 'font-black'}`}
          style={textElementStyle}
        >
          {content}
        </div>
      )}
      {previewMode === 'edit' && selected && (
        <WebEditableElementFrame
          visible={element.visible}
          onRotatePointerDown={(event) => onBeginDrag(event, element, 'rotate')}
          onToggleVisible={(event) => {
            event.stopPropagation();
            onUpdateElement(element.id, { visible: !element.visible });
          }}
          onDelete={
            canDeleteElement
              ? (event) => {
                  event.stopPropagation();
                  onDeleteElement?.(element.id);
                }
              : undefined
          }
          onResizePointerDown={(event, handle) => onBeginDrag(event, element, 'resize', handle)}
        />
      )}
    </div>
  );
}
