import { SurfaceLayers } from '../shared/paint/SurfaceLayers';
import type { CSSProperties, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { WebInlineText } from './WebInlineText';
import { ArrowRight, RotateCw } from 'lucide-react';

import { resolveKnownAppAssetUrl } from '../../../lib/appAssets';
import type { Language } from '../../../lib/i18n';
import type { WebExportSettings } from '../video/shared/types';
import { GradientCanvasControl } from './GradientCanvasControl';
import { formatWebText } from './i18n';
import { WebEditableElementFrame } from './WebEditableElementFrame';
import {
  webColorWithAlpha,
  webElementBoxStyle,
  webElementShadowStyle,
  webElementTextStrokeStyle,
  webElementTextPaintStyle,
  webImageFillBackgroundColor,
} from './webElementStyle';
import { gradientFromStops, normalizeGradientStops } from './webGradientStops';
import type {
  StartMenuAction,
  StartMenuElement,
  StartMenuResizeHandle,
} from './webPlaytestStartMenuTools';
import { readStartMenuImageFile } from './webPlaytestStartMenuTools';
import { WEB_BUTTON_MOTION_CSS, webButtonMotionStyle } from './webButtonMotion';

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
  gradientEditing?: 'text' | 'fill' | 'stroke' | null;
  imageCropEditing?: boolean;
  action: StartMenuAction | null;
  previewMode: 'edit' | 'test';
  editingStartMenuElementId: string | null;
  hasCustomStartMenuElements: boolean;
  settings: WebExportSettings;
  choiceColor: string;
  choiceTextColor: string;
  language: Language;
  dynamicText?: string;
  flowMinimap?: ReactNode;
  onEnsureStartMenuElements: () => void;
  onSelectElement: (id: string | null) => void;
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
  gradientEditing = null,
  imageCropEditing = false,
  action,
  previewMode,
  editingStartMenuElementId,
  hasCustomStartMenuElements,
  settings,
  choiceColor,
  choiceTextColor,
  language,
  dynamicText,
  flowMinimap,
  onEnsureStartMenuElements,
  onSelectElement,
  onSetEditingElement,
  onUpdateElement,
  onDeleteElement,
  onBeginDrag,
}: WebPlaytestStartMenuElementProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundImageDragRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const cropResizeRef = useRef<{
    centerX: number;
    centerY: number;
    distance: number;
    scale: number;
  } | null>(null);
  const [backgroundImageNaturalSize, setBackgroundImageNaturalSize] = useState({
    width: 0,
    height: 0,
  });
  const elementBackground =
    element.fillEnabled === false
      ? undefined
      : element.backgroundType === 'image'
        ? webImageFillBackgroundColor(element)
        : element.backgroundType === 'gradient'
          ? gradientFromStops(
              element.backgroundGradientShape,
              element.backgroundGradientAngle ?? 135,
              normalizeGradientStops(
                element.backgroundGradientStops,
                element.backgroundGradientStart || choiceColor,
                element.backgroundGradientEnd || '#0f172a',
              ),
              {
                startX: element.backgroundGradientStartX,
                startY: element.backgroundGradientStartY,
                endX: element.backgroundGradientEndX,
                endY: element.backgroundGradientEndY,
              },
            )
          : element.backgroundColor;
  const elementStyle: React.CSSProperties = {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    transform: `rotate(${element.rotation}deg) scale(${element.scale})`,
    opacity: element.visible
      ? element.backgroundType === 'gradient'
        ? 1
        : Math.max(0, Math.min(100, element.opacity ?? 100)) / 100
      : 0.34,
  };
  const elementBoxStyle = element.kind === 'button' ? webElementBoxStyle(element) : {};
  const { boxShadow: _baseBoxShadow, ...elementBoxStyleWithoutShadow } = elementBoxStyle;
  const buttonMotionStyle =
    element.kind === 'button'
      ? webButtonMotionStyle(element, typeof _baseBoxShadow === 'string' ? _baseBoxShadow : 'none')
      : {};
  const textElementStyle: CSSProperties = {
    ...textAlignStyle(element.textAlign),
    ...webElementShadowStyle(element, 'text'),
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    color: textColorWithAlpha(element.textColor, element.textColorAlpha),
    ...webElementTextStrokeStyle(element),
    letterSpacing: Number.isFinite(Number(element.letterSpacing))
      ? `${element.letterSpacing}px`
      : undefined,
    lineHeight: element.lineHeight,
    ...radiusStyle(element, 0),
    ...(element.textStrokeTarget === 'box' ? webElementBoxStyle(element) : {}),
    whiteSpace: 'pre-wrap',
  };

  const ensureAndSelect = () => {
    if (!hasCustomStartMenuElements) onEnsureStartMenuElements();
    onSelectElement(element.id);
  };
  const visibleText =
    element.textVisible === false
      ? ''
      : element.role === 'flowBranch' && dynamicText !== undefined
        ? dynamicText || element.text
        : element.text;
  const isEditingText = previewMode === 'edit' && editingStartMenuElementId === element.id;

  const openImagePicker = (event: React.MouseEvent<HTMLElement>) => {
    if (previewMode !== 'edit') return;
    event.preventDefault();
    event.stopPropagation();
    ensureAndSelect();
    imageInputRef.current?.click();
  };

  const content =
    element.textVisible === false ? null : (
      <WebInlineText
        value={element.text}
        displayValue={previewMode === 'edit' ? element.text : visibleText}
        editable={previewMode === 'edit'}
        editing={isEditingText}
        placeholder={formatWebText(
          language,
          'componentsrenderwebWebPlaytestStartMenuElementText218',
        )}
        style={webElementTextPaintStyle(element)}
        onStart={() => {
          ensureAndSelect();
          onSetEditingElement(element.id);
        }}
        onCommit={(text) => {
          onUpdateElement(element.id, { text });
          onSetEditingElement(null);
          onSelectElement(null);
        }}
        onCancel={() => {
          onSetEditingElement(null);
          onSelectElement(null);
        }}
      />
    );

  const startEditingText = (event: React.MouseEvent<HTMLElement>) => {
    if (previewMode !== 'edit' || (element.kind !== 'text' && element.kind !== 'button')) return;
    event.stopPropagation();
    if (isEditingText) return;
    ensureAndSelect();
    onSetEditingElement(element.id);
  };
  const functionLabel =
    element.role === 'continue'
      ? formatWebText(language, 'componentsrenderwebWebPlaytestStartMenuElementText230')
      : element.role === 'save'
        ? formatWebText(language, 'componentsrenderwebWebPlaytestStartMenuElementText232')
        : element.role === 'new'
          ? formatWebText(language, 'componentsrenderwebWebPlaytestStartMenuElementText234')
          : element.role === 'settings'
            ? formatWebText(language, 'componentsrenderwebWebPlaytestStartMenuElementText236')
            : element.role === 'flowOverview'
              ? language === 'zh'
                ? '流程图总览'
                : language === 'ja'
                  ? 'フロー概要'
                  : 'Flow overview'
              : element.role === 'flowDirection'
                ? language === 'zh'
                  ? '切换流程方向'
                  : language === 'ja'
                    ? 'フロー方向を切り替え'
                    : 'Cycle flow direction'
                : element.role === 'flowFitView'
                  ? language === 'zh'
                    ? '适应流程图'
                    : language === 'ja'
                      ? '全体を表示'
                      : 'Fit flow view'
                  : element.role === 'flowBranch'
                    ? language === 'zh'
                      ? '当前分支提示'
                      : language === 'ja'
                        ? '現在の分岐'
                        : 'Current branch'
                    : element.role === 'flowMinimap'
                      ? language === 'zh'
                        ? '流程图导航'
                        : language === 'ja'
                          ? 'フローミニマップ'
                          : 'Flow minimap'
                      : element.role === 'link'
                        ? formatWebText(
                            language,
                            'componentsrenderwebWebPlaytestStartMenuElementText238',
                          )
                        : element.role === 'volume'
                          ? formatWebText(
                              language,
                              'componentsrenderwebWebPlaytestStartMenuElementText240',
                            )
                          : formatWebText(
                              language,
                              'componentsrenderwebWebPlaytestStartMenuElementText241',
                            );

  const FlowControlIcon =
    element.role === 'flowDirection'
      ? ArrowRight
      : element.role === 'flowFitView'
        ? RotateCw
        : null;
  const isFlowIconControl = Boolean(FlowControlIcon && element.textVisible === false);
  const ButtonShell = previewMode === 'edit' ? 'div' : 'button';

  if (!element.visible && previewMode !== 'edit') return null;

  return (
    <div
      className={`absolute origin-center pointer-events-auto ${
        previewMode === 'edit'
          ? isEditingText
            ? 'cursor-text select-text'
            : 'cursor-grab touch-none select-none active:cursor-grabbing'
          : ''
      }`}
      data-selectable-element-id={element.id}
      style={{
        ...elementStyle,
        zIndex: selected ? 1000 : 20 + (element.zIndex ?? 0),
      }}
      onPointerDown={(event) => {
        if (isEditingText) {
          event.stopPropagation();
          return;
        }
        if (!imageCropEditing) onBeginDrag(event, element, 'move');
      }}
      onClick={(event) => {
        if (previewMode !== 'edit') return;
        event.stopPropagation();
        if (isEditingText) return;
        ensureAndSelect();
      }}
      onDoubleClick={startEditingText}
    >
      {element.kind === 'button' && <style>{WEB_BUTTON_MOTION_CSS}</style>}
      {previewMode === 'edit' && !isEditingText && element.kind === 'button' && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 -translate-y-[calc(100%+4px)] whitespace-nowrap rounded-full bg-slate-950/78 px-2 py-0.5 text-[10px] font-black text-white shadow backdrop-blur">
          {functionLabel}
        </div>
      )}
      {element.role === 'flowMinimap' && flowMinimap ? (
        <div className="h-full w-full pointer-events-auto">{flowMinimap}</div>
      ) : element.kind === 'image' ? (
        element.imageUrl ? (
          <>
            <img
              src={resolveKnownAppAssetUrl(element.imageUrl)}
              alt=""
              className="h-full w-full object-cover"
              style={{
                ...radiusStyle(element, 12),
                ...webElementBoxStyle(element),
                backgroundColor: element.imageBackgroundColor || 'transparent',
                mixBlendMode: element.blendMode as CSSProperties['mixBlendMode'],
              }}
              draggable={false}
              onDoubleClick={openImagePicker}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file)
                  readStartMenuImageFile(file, (imageUrl) =>
                    onUpdateElement(element.id, { imageUrl }),
                  );
                event.currentTarget.value = '';
              }}
            />
          </>
        ) : (
          <label
            className="grid h-full w-full cursor-pointer place-items-center border border-dashed border-white/35 bg-white/10 px-2 text-center text-[11px] font-black text-white/60"
            style={radiusStyle(element, 12)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={openImagePicker}
          >
            {formatWebText(language, 'componentsrenderwebWebPlaytestStartMenuElementText301')}
            <input
              ref={imageInputRef}
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
        <ButtonShell
          onPointerDown={(event) => {
            if (isEditingText) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            if (previewMode === 'edit' && !imageCropEditing) {
              event.preventDefault();
              event.stopPropagation();
              onBeginDrag(event, element, 'move');
              return;
            }
            if (
              !imageCropEditing ||
              previewMode !== 'edit' ||
              !selected ||
              element.backgroundType !== 'image' ||
              (element.backgroundImageFit || 'crop') !== 'crop'
            )
              return;
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            backgroundImageDragRef.current = {
              x: event.clientX,
              y: event.clientY,
              offsetX: element.backgroundImageOffsetX ?? 0,
              offsetY: element.backgroundImageOffsetY ?? 0,
            };
          }}
          onPointerMove={(event) => {
            const drag = backgroundImageDragRef.current;
            if (!drag) return;
            onUpdateElement(element.id, {
              backgroundImageOffsetX: drag.offsetX + event.clientX - drag.x,
              backgroundImageOffsetY: drag.offsetY + event.clientY - drag.y,
            });
          }}
          onPointerUp={(event) => {
            if (!backgroundImageDragRef.current) return;
            backgroundImageDragRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          disabled={previewMode !== 'edit' && Boolean(element.disabled || action?.disabled)}
          data-gw-button-motion="true"
          data-gw-button-motion-editing={previewMode === 'edit' ? 'true' : undefined}
          onClick={(event) => {
            if (previewMode === 'edit') {
              event.preventDefault();
              event.stopPropagation();
              if (isEditingText) return;
              ensureAndSelect();
              if (element.role === 'flowDirection' || element.role === 'flowFitView') {
                action?.onClick();
                return;
              }
              return;
            }
            action?.onClick();
          }}
          className={`relative h-full w-full rounded-lg border font-black transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#625BF6]/20 ${
            isFlowIconControl ? 'gw-flow-control' : ''
          } ${previewMode === 'edit' && selected ? 'overflow-visible' : 'overflow-hidden'} ${
            previewMode === 'test'
              ? element.role === 'continue'
                ? 'hover:-translate-y-0.5 hover:shadow-xl'
                : element.role === 'new' || element.role === 'save'
                  ? 'hover:-translate-x-1'
                  : 'hover:-translate-y-0.5'
              : ''
          } ${settings.startMenuTemplate === 'minimal' || element.backgroundType === 'gradient' ? 'bg-transparent backdrop-blur-0' : 'backdrop-blur-xl'} disabled:opacity-45`}
          style={{
            backgroundImage: element.backgroundType === 'gradient' ? elementBackground : undefined,
            backgroundColor:
              element.backgroundType === 'gradient'
                ? 'transparent'
                : element.backgroundType === 'image'
                  ? elementBackground || 'transparent'
                  : elementBackground || (element.primary ? `${choiceColor}e6` : undefined),
            color: textColorWithAlpha(
              element.textColor || (element.primary ? choiceTextColor : '#f8fafc'),
              element.textColorAlpha,
            ),
            display: 'flex',
            alignItems: 'center',
            justifyContent: element.textAlign === 'left' ? 'flex-start' : 'center',
            paddingInline: isFlowIconControl ? 0 : element.textAlign === 'left' ? 24 : 16,
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
            ...elementBoxStyleWithoutShadow,
            ...buttonMotionStyle,
            boxShadow: 'var(--gw-button-motion-base-shadow, none)',
            mixBlendMode: element.blendMode as CSSProperties['mixBlendMode'],
            ...(element.appearance
              ? { background: 'transparent', boxShadow: 'none', border: 0, outline: 0 }
              : {}),
          }}
        >
          {element.appearance && (
            <SurfaceLayers value={element.appearance} radius={element.borderRadius || 0} />
          )}

          {!element.appearance &&
            element.backgroundType === 'image' &&
            element.backgroundImageUrl && (
              <span
                className={`absolute inset-0 z-0 bg-no-repeat ${previewMode === 'edit' && selected && (element.backgroundImageFit || 'crop') === 'crop' ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                style={{
                  backgroundImage: `url("${resolveKnownAppAssetUrl(element.backgroundImageUrl).replace(/"/g, '\\"')}")`,
                  backgroundSize:
                    element.backgroundImageFit === 'fit'
                      ? 'contain'
                      : element.backgroundImageFit === 'max'
                        ? 'cover'
                        : `${element.backgroundImageScale ?? 100}%`,
                  backgroundPosition: `calc(50% + ${element.backgroundImageOffsetX ?? 0}px) calc(50% + ${element.backgroundImageOffsetY ?? 0}px)`,
                  opacity: Math.max(0, Math.min(100, element.backgroundImageAlpha ?? 100)) / 100,
                  transform: `rotate(${element.backgroundImageRotation ?? 0}deg)`,
                  transformOrigin: 'center',
                }}
              />
            )}
          {previewMode === 'edit' &&
            selected &&
            !isEditingText &&
            gradientEditing === 'fill' &&
            element.backgroundType === 'gradient' && (
              <GradientCanvasControl
                shape={element.backgroundGradientShape || 'linear'}
                angle={element.backgroundGradientAngle ?? 135}
                startX={element.backgroundGradientStartX}
                startY={element.backgroundGradientStartY}
                endX={element.backgroundGradientEndX}
                endY={element.backgroundGradientEndY}
                onGeometryChange={(geometry) =>
                  onUpdateElement(element.id, {
                    backgroundGradientStartX: geometry.startX,
                    backgroundGradientStartY: geometry.startY,
                    backgroundGradientEndX: geometry.endX,
                    backgroundGradientEndY: geometry.endY,
                    backgroundGradientAngle: geometry.angle,
                  })
                }
              />
            )}
          <span
            className={`relative z-[1] ${
              isFlowIconControl
                ? 'gw-flow-control-content flex h-full w-full items-center justify-center gap-1.5 overflow-hidden px-2'
                : ''
            }`}
          >
            {isFlowIconControl ? (
              <FlowControlIcon className="h-6 w-6" aria-hidden="true" />
            ) : (
              content
            )}
          </span>
        </ButtonShell>
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
      {previewMode === 'edit' &&
        selected &&
        !isEditingText &&
        gradientEditing === 'text' &&
        element.kind === 'text' &&
        element.textColorType === 'gradient' && (
          <GradientCanvasControl
            shape="linear"
            angle={element.textGradientAngle ?? 90}
            onGeometryChange={(geometry) =>
              onUpdateElement(element.id, {
                textGradientAngle: geometry.angle,
                textColorType: 'gradient',
              })
            }
          />
        )}
      {imageCropEditing && element.kind === 'button' && element.backgroundImageUrl && (
        <div className="pointer-events-none absolute inset-0 z-[40] overflow-visible">
          <div
            className="pointer-events-auto absolute cursor-move select-none"
            style={{
              left: `calc(50% + ${element.backgroundImageOffsetX ?? 0}px)`,
              top: `calc(50% + ${element.backgroundImageOffsetY ?? 0}px)`,
              width: `${element.backgroundImageScale ?? 100}%`,
              aspectRatio:
                backgroundImageNaturalSize.width && backgroundImageNaturalSize.height
                  ? `${backgroundImageNaturalSize.width} / ${backgroundImageNaturalSize.height}`
                  : undefined,
              transform: `translate(-50%, -50%) rotate(${element.backgroundImageRotation ?? 0}deg)`,
            }}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).dataset.cropHandle) return;
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              backgroundImageDragRef.current = {
                x: event.clientX,
                y: event.clientY,
                offsetX: element.backgroundImageOffsetX ?? 0,
                offsetY: element.backgroundImageOffsetY ?? 0,
              };
            }}
            onPointerMove={(event) => {
              const resize = cropResizeRef.current;
              if (resize) {
                const distance = Math.hypot(
                  event.clientX - resize.centerX,
                  event.clientY - resize.centerY,
                );
                onUpdateElement(element.id, {
                  backgroundImageScale: Math.max(
                    10,
                    Math.min(
                      400,
                      Math.round((resize.scale * distance) / Math.max(1, resize.distance)),
                    ),
                  ),
                });
                return;
              }
              const drag = backgroundImageDragRef.current;
              if (!drag) return;
              const scale = Math.max(0.1, element.scale || 1);
              onUpdateElement(element.id, {
                backgroundImageOffsetX: drag.offsetX + (event.clientX - drag.x) / scale,
                backgroundImageOffsetY: drag.offsetY + (event.clientY - drag.y) / scale,
              });
            }}
            onPointerUp={(event) => {
              backgroundImageDragRef.current = null;
              cropResizeRef.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              backgroundImageDragRef.current = null;
              cropResizeRef.current = null;
            }}
          >
            <img
              src={resolveKnownAppAssetUrl(element.backgroundImageUrl)}
              alt=""
              draggable={false}
              className="h-full w-full select-none object-fill opacity-50"
              onLoad={(event) =>
                setBackgroundImageNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
            />
            <div className="pointer-events-none absolute inset-0 z-20 border-2 border-indigo-400 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]" />
            {(
              [
                { position: 'left-0 top-0', transform: '-translate-x-1/2 -translate-y-1/2' },
                { position: 'right-0 top-0', transform: 'translate-x-1/2 -translate-y-1/2' },
                { position: 'right-0 bottom-0', transform: 'translate-x-1/2 translate-y-1/2' },
                { position: 'left-0 bottom-0', transform: '-translate-x-1/2 translate-y-1/2' },
              ] as const
            ).map(({ position, transform }) => (
              <button
                key={position}
                type="button"
                data-crop-handle="true"
                className={`absolute ${position} ${transform} z-30 h-4 w-4 rounded-full border-2 border-white bg-indigo-600 shadow-md`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const rect = event.currentTarget.parentElement?.getBoundingClientRect();
                  if (!rect) return;
                  event.currentTarget.parentElement?.setPointerCapture(event.pointerId);
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  cropResizeRef.current = {
                    centerX,
                    centerY,
                    distance: Math.hypot(event.clientX - centerX, event.clientY - centerY),
                    scale: element.backgroundImageScale ?? 100,
                  };
                }}
                aria-label={formatWebText(
                  language,
                  'componentsrenderwebWebPlaytestStartMenuElementText524',
                )}
              />
            ))}
            <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950/85 px-2 py-1 text-[10px] font-bold text-white shadow">
              {backgroundImageNaturalSize.width > 0
                ? `${backgroundImageNaturalSize.width} × ${backgroundImageNaturalSize.height} · `
                : ''}
              {Math.round(element.backgroundImageScale ?? 100)}%
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            <img
              src={resolveKnownAppAssetUrl(element.backgroundImageUrl)}
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                left: `calc(50% + ${element.backgroundImageOffsetX ?? 0}px)`,
                top: `calc(50% + ${element.backgroundImageOffsetY ?? 0}px)`,
                width: `${element.backgroundImageScale ?? 100}%`,
                aspectRatio:
                  backgroundImageNaturalSize.width && backgroundImageNaturalSize.height
                    ? `${backgroundImageNaturalSize.width} / ${backgroundImageNaturalSize.height}`
                    : undefined,
                transform: `translate(-50%, -50%) rotate(${element.backgroundImageRotation ?? 0}deg)`,
                opacity: Math.max(0, Math.min(100, element.backgroundImageAlpha ?? 100)) / 100,
              }}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 z-20 border-2 border-dashed border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.16)]" />
        </div>
      )}
      {previewMode === 'edit' && selected && !isEditingText && (
        <WebEditableElementFrame
          visible={!imageCropEditing && element.visible}
          onRotatePointerDown={(event) => onBeginDrag(event, element, 'rotate')}
          onToggleVisible={(event) => {
            event.stopPropagation();
            onUpdateElement(element.id, { visible: !element.visible });
          }}
          onDelete={(event) => {
            event.stopPropagation();
            onDeleteElement?.(element.id);
          }}
          onResizePointerDown={(event, handle) => onBeginDrag(event, element, 'resize', handle)}
        />
      )}
    </div>
  );
}
