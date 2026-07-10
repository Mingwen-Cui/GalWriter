import type React from 'react';

import {
  getNameplateCharacterCenterX,
  getNameplateCssBackground,
} from '../video/shared/nameplateRenderer';
import { getRenderObjects } from '../video/shared/renderObjects';
import type {
  RenderEditableObject,
  RenderEditableObjectKind,
  RenderStyle,
} from '../video/shared/types';
import { WebEditableElementFrame, type WebEditableResizeHandle } from './WebEditableElementFrame';
import {
  collectPixelGuideBoxes,
  type PixelGuideLine,
  snapPixelBoxToGuides,
} from './webPixelAlignmentGuides';
import { colorInputValue, withAlpha } from './webPlaytestStyleTools';

type NameplateItem = ReturnType<
  typeof import('../video/shared/nameplateRenderer').getNameplateItems
>[number];

type WebPlaytestNameplatesProps = {
  items: NameplateItem[];
  renderStyle: RenderStyle;
  dialogWidth: number;
  previewMode?: 'edit' | 'test';
  onSelectRenderObject?: (kind: RenderEditableObjectKind) => void;
  onMoveRenderObject?: (kind: RenderEditableObjectKind, x: number, y: number) => void;
  onUpdateRenderObject?: (
    kind: RenderEditableObjectKind,
    patch: Partial<RenderEditableObject>,
  ) => void;
  onGuideLinesChange?: (lines: PixelGuideLine[]) => void;
};

export function WebPlaytestNameplates({
  items,
  renderStyle,
  dialogWidth,
  previewMode = 'test',
  onSelectRenderObject,
  onMoveRenderObject,
  onUpdateRenderObject,
  onGuideLinesChange,
}: WebPlaytestNameplatesProps) {
  const objects = getRenderObjects(renderStyle);
  const nameplateObject = objects.nameplate;
  if (!nameplateObject.visible || !items.length) return null;

  const dialogObject = objects.dialogBox;
  const fontSize = Math.max(10, renderStyle.nameplateFontSize ?? 18);
  const scale = Math.max(0.5, Math.min(2, (renderStyle.nameplateScale ?? 100) / 100));
  const paddingX = Math.round(fontSize * 1.15 * scale);
  const paddingY = Math.round(fontSize * 0.42 * scale);
  const rowHeight = Math.ceil(fontSize + paddingY * 2 + Math.max(8, fontSize * 0.45));
  const textGap = renderStyle.nameplateTextGap ?? 8;
  const top = 0;
  const translateY = `calc(-100% - 8px + ${renderStyle.nameplateOffsetY ?? 0}px)`;
  const baseStyle: React.CSSProperties = {
    ...(renderStyle.nameplateInside
      ? { background: 'transparent' }
      : getNameplateCssBackground(renderStyle)),
    color: withAlpha(
      colorInputValue(renderStyle.nameplateTextColor),
      (renderStyle.nameplateTextColorAlpha ?? 100) / 100,
    ),
    fontFamily: renderStyle.nameplateFontFamily || renderStyle.titleFontFamily,
    fontSize,
    lineHeight: 1,
    padding: `${paddingY}px ${paddingX}px`,
    borderRadius: Math.max(0, renderStyle.nameplateRadius ?? 14),
    boxShadow: renderStyle.nameplateInside ? 'none' : '0 10px 24px rgba(0, 0, 0, 0.24)',
    textShadow: renderStyle.nameplateInside
      ? '0 1px 10px rgba(0, 0, 0, 0.42)'
      : '0 1px 8px rgba(0, 0, 0, 0.32)',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: nameplateObject.width ? `${Math.max(55, nameplateObject.width)}px` : undefined,
    height: nameplateObject.height ? `${Math.max(8, nameplateObject.height)}px` : undefined,
    minHeight: nameplateObject.height ? `${Math.max(8, nameplateObject.height)}px` : undefined,
    maxWidth: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
  const editClass =
    previewMode === 'edit'
      ? renderStyle.selectedRenderObject === 'nameplate'
        ? 'ring-2 ring-indigo-500'
        : 'outline outline-1 outline-indigo-400/40'
      : '';
  const selectNameplate = (event: React.MouseEvent) => {
    if (previewMode !== 'edit') return;
    event.stopPropagation();
    onSelectRenderObject?.('nameplate');
  };
  const startNameplateDrag = (event: React.PointerEvent) => {
    if (previewMode !== 'edit' || !onMoveRenderObject) return;
    event.stopPropagation();
    event.preventDefault();
    document.body.style.cursor = 'grabbing';
    onSelectRenderObject?.('nameplate');
    const object = getRenderObjects(renderStyle).nameplate;
    const container = event.currentTarget.closest<HTMLElement>('[data-dialogue-box]');
    const containerRect = container?.getBoundingClientRect();
    const targetRect = event.currentTarget.getBoundingClientRect();
    const targetStartX = containerRect ? targetRect.left - containerRect.left : 0;
    const targetStartY = containerRect ? targetRect.top - containerRect.top : 0;
    const guideBoxes = container ? collectPixelGuideBoxes(container, 'nameplate') : [];
    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = object.x;
    const initialY = object.y;
    const move = (moveEvent: PointerEvent) => {
      let nextX = initialX + moveEvent.clientX - startX;
      let nextY = initialY + moveEvent.clientY - startY;
      if (containerRect && guideBoxes.length > 0) {
        const snapped = snapPixelBoxToGuides({
          x: targetStartX + moveEvent.clientX - startX,
          y: targetStartY + moveEvent.clientY - startY,
          width: targetRect.width,
          height: targetRect.height,
          boxes: guideBoxes,
        });
        nextX = initialX + snapped.x - targetStartX;
        nextY = initialY + snapped.y - targetStartY;
        onGuideLinesChange?.(snapped.lines);
      } else {
        onGuideLinesChange?.([]);
      }
      onMoveRenderObject('nameplate', nextX, nextY);
    };
    const end = () => {
      document.body.style.cursor = '';
      onGuideLinesChange?.([]);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const startNameplateResize = (
    event: React.PointerEvent<HTMLElement>,
    handle: WebEditableResizeHandle,
  ) => {
    if (previewMode !== 'edit' || !onUpdateRenderObject) return;
    event.preventDefault();
    event.stopPropagation();
    document.body.style.cursor =
      handle === 'n' || handle === 's'
        ? 'ns-resize'
        : handle === 'e' || handle === 'w'
          ? 'ew-resize'
          : handle === 'ne' || handle === 'sw'
            ? 'nesw-resize'
            : 'nwse-resize';
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = getRenderObjects(renderStyle).nameplate;
    const target = event.currentTarget.closest<HTMLElement>('[data-render-object="nameplate"]');
    const targetRect = target?.getBoundingClientRect();
    const widthUnitPerPx =
      targetRect && targetRect.width > 0 ? initial.width / targetRect.width : 1;
    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) * widthUnitPerPx;
      const dy = moveEvent.clientY - startY;
      let nextX = initial.x;
      let nextY = initial.y;
      let nextWidth = initial.width;
      let nextHeight = initial.height;
      if (handle.includes('e')) nextWidth = initial.width + dx;
      if (handle.includes('s')) nextHeight = initial.height + dy;
      if (handle.includes('w')) {
        nextX = initial.x + moveEvent.clientX - startX;
        nextWidth = initial.width - dx;
      }
      if (handle.includes('n')) {
        nextY = initial.y + dy;
        nextHeight = initial.height - dy;
      }
      if (nextWidth < 55) {
        if (handle.includes('w')) nextX = initial.x + (initial.width - 55) / widthUnitPerPx;
        nextWidth = 55;
      }
      if (nextHeight < 8) {
        if (handle.includes('n')) nextY = initial.y + initial.height - 8;
        nextHeight = 8;
      }
      onUpdateRenderObject('nameplate', {
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    };
    const end = () => {
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const renderSelectedFrame = () =>
    previewMode === 'edit' &&
    renderStyle.selectedRenderObject === 'nameplate' &&
    onUpdateRenderObject ? (
      <WebEditableElementFrame
        visible={nameplateObject.visible}
        onRotatePointerDown={(event) => event.stopPropagation()}
        onToggleVisible={(event) => {
          event.stopPropagation();
          onUpdateRenderObject('nameplate', { visible: !nameplateObject.visible });
        }}
        onResizePointerDown={startNameplateResize}
      />
    ) : null;

  if (!renderStyle.nameplateFollowCharacter) {
    if (renderStyle.nameplateInside) {
      return (
        <div
          className="pointer-events-none relative z-10 flex max-w-full justify-center gap-2"
          style={{
            minHeight: rowHeight,
            marginBottom: textGap,
            transform: `translate(${renderStyle.nameplateOffsetX ?? 0}px, ${renderStyle.nameplateOffsetY ?? 0}px)`,
          }}
        >
          {items.map((item) => (
            <div
              key={item.sourceNodeId}
              className={`pointer-events-auto relative cursor-grab font-black ${editClass}`}
              data-render-object="nameplate"
              style={baseStyle}
              onClick={selectNameplate}
              onPointerDown={startNameplateDrag}
            >
              {item.name}
              {renderSelectedFrame()}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div
        className="pointer-events-none absolute left-1/2 z-10 flex max-w-full gap-2"
        style={{
          top,
          transform: `translate(calc(-50% + ${renderStyle.nameplateOffsetX ?? 0}px), ${translateY})`,
        }}
      >
        {items.map((item) => (
          <div
            key={item.sourceNodeId}
            className={`pointer-events-auto relative cursor-grab font-black ${editClass}`}
            data-render-object="nameplate"
            style={baseStyle}
            onClick={selectNameplate}
            onPointerDown={startNameplateDrag}
          >
            {item.name}
            {renderSelectedFrame()}
          </div>
        ))}
      </div>
    );
  }

  const dialogueLeft =
    50 + Math.max(-100, Math.min(100, dialogObject.x ?? 0)) * 0.5 - dialogWidth / 2;
  if (renderStyle.nameplateInside) {
    return (
      <div
        className="pointer-events-none relative z-10"
        style={{ minHeight: rowHeight, marginBottom: textGap }}
      >
        {items.map((item) => {
          const characterPercent = getNameplateCharacterCenterX(item.config, 100);
          const localLeft = Math.max(
            4,
            Math.min(96, ((characterPercent - dialogueLeft) / dialogWidth) * 100),
          );
          return (
            <div
              key={item.sourceNodeId}
              className={`pointer-events-auto absolute top-0 cursor-grab font-black ${editClass}`}
              data-render-object="nameplate"
              style={{
                ...baseStyle,
                left: `${localLeft}%`,
                transform: `translate(calc(-50% + ${renderStyle.nameplateOffsetX ?? 0}px), ${renderStyle.nameplateOffsetY ?? 0}px)`,
              }}
              onClick={selectNameplate}
              onPointerDown={startNameplateDrag}
            >
              {item.name}
              {renderSelectedFrame()}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
      {items.map((item) => {
        const characterPercent = getNameplateCharacterCenterX(item.config, 100);
        const localLeft = Math.max(
          4,
          Math.min(96, ((characterPercent - dialogueLeft) / dialogWidth) * 100),
        );
        return (
          <div
            key={item.sourceNodeId}
            className={`pointer-events-auto absolute top-0 cursor-grab font-black ${editClass}`}
            data-render-object="nameplate"
            style={{
              ...baseStyle,
              left: `${localLeft}%`,
              top,
              transform: `translate(calc(-50% + ${renderStyle.nameplateOffsetX ?? 0}px), ${translateY})`,
            }}
            onClick={selectNameplate}
            onPointerDown={startNameplateDrag}
          >
            {item.name}
            {renderSelectedFrame()}
          </div>
        );
      })}
    </div>
  );
}
