import {
  Box,
  CaseSensitive,
  Image,
  Link2,
  MoveHorizontal,
  MoveVertical,
  Palette,
  RotateCw,
  Trash2,
  Type,
} from 'lucide-react';

import type { PptManualElement, PptManualSlide } from '../video/shared/types';
import { ControlRow, InspectorGroup, NumberField } from '../web/webStyleInspectorControls';
import type { PptCopy } from './i18n';

export function PptManualInspector({
  copy,
  slide,
  selectedElementId,
  slides,
  onUpdateBackgroundColor,
  onUpdateElement,
  onDeleteElement,
}: {
  copy: PptCopy;
  slide: PptManualSlide;
  selectedElementId?: string;
  slides: Array<{ id: string; title: string }>;
  onUpdateBackgroundColor: (color: string) => void;
  onUpdateElement: (elementId: string, patch: Partial<PptManualElement>) => void;
  onDeleteElement: (elementId: string) => void;
}) {
  const element = slide.elements.find((item) => item.id === selectedElementId);
  if (!element) {
    return (
      <InspectorGroup
        title={copy.backgroundColor}
        icon={<Palette className="h-4 w-4" />}
        tone="fill"
        secondary={<div className="h-10 rounded-xl bg-white" aria-hidden="true" />}
      >
        <label className="grid h-10 grid-cols-[42px_minmax(0,1fr)] items-center overflow-hidden rounded-xl bg-white text-sm font-medium text-slate-900">
          <input
            type="color"
            value={slide.backgroundColor}
            onChange={(event) => onUpdateBackgroundColor(event.target.value)}
            className="h-full w-full border-0 bg-transparent p-1"
            aria-label={copy.backgroundColor}
          />
          <span className="min-w-0 truncate px-3 uppercase">{slide.backgroundColor}</span>
        </label>
      </InspectorGroup>
    );
  }
  const updateGeometry = (key: 'x' | 'y' | 'width' | 'height' | 'rotation', value: number) =>
    onUpdateElement(element.id, { [key]: Math.round(value) } as Partial<PptManualElement>);
  return (
    <div className="space-y-4">
      <InspectorGroup
        title="位置"
        icon={<Box className="h-4 w-4" />}
        tone="position"
        secondary={
          <NumberField
            icon={<RotateCw className="h-4 w-4" />}
            label="旋转"
            value={element.rotation || 0}
            min={-180}
            max={180}
            onChange={(value) => updateGeometry('rotation', value)}
          />
        }
      >
        <ControlRow>
          <NumberField
            icon={<MoveHorizontal className="h-4 w-4" />}
            label="X"
            value={element.x}
            min={0}
            max={1920}
            onChange={(value) => updateGeometry('x', value)}
          />
          <NumberField
            icon={<MoveVertical className="h-4 w-4" />}
            label="Y"
            value={element.y}
            min={0}
            max={1080}
            onChange={(value) => updateGeometry('y', value)}
          />
        </ControlRow>
        <ControlRow className="mt-2">
          <NumberField
            icon={<MoveHorizontal className="h-4 w-4" />}
            label="宽度"
            value={element.width}
            min={40}
            max={1920}
            onChange={(value) => updateGeometry('width', value)}
          />
          <NumberField
            icon={<MoveVertical className="h-4 w-4" />}
            label="高度"
            value={element.height}
            min={24}
            max={1080}
            onChange={(value) => updateGeometry('height', value)}
          />
        </ControlRow>
      </InspectorGroup>
      {(element.kind === 'text' || element.kind === 'button') && (
        <InspectorGroup
          title={element.kind === 'button' ? copy.buttonText : copy.elementText}
          icon={<Type className="h-4 w-4" />}
          tone="text"
          secondary={<div className="h-10 rounded-xl bg-white" aria-hidden="true" />}
        >
          <textarea
            value={element.text}
            onChange={(event) => onUpdateElement(element.id, { text: event.target.value })}
            className="min-h-20 w-full resize-y rounded-xl border-0 bg-white p-3 text-sm text-slate-900 outline-none ring-0"
          />
        </InspectorGroup>
      )}
      {element.kind === 'image' && (
        <InspectorGroup
          title={copy.image}
          icon={<Image className="h-4 w-4" />}
          tone="fill"
          secondary={<div className="h-10 rounded-xl bg-white" aria-hidden="true" />}
        >
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-600">
              <span className="mb-1 block">图片地址</span>
              <input
                type="url"
                value={element.src}
                onChange={(event) => onUpdateElement(element.id, { src: event.target.value })}
                className="h-10 w-full rounded-xl border-0 bg-white px-3 text-sm text-slate-900 outline-none"
                placeholder="https://"
              />
            </label>
            <label className="block text-[11px] font-bold text-slate-600">
              <span className="mb-1 block">图片说明</span>
              <input
                value={element.alt || ''}
                onChange={(event) => onUpdateElement(element.id, { alt: event.target.value })}
                className="h-10 w-full rounded-xl border-0 bg-white px-3 text-sm text-slate-900 outline-none"
              />
            </label>
          </div>
        </InspectorGroup>
      )}
      {element.kind === 'text' && (
        <InspectorGroup
          title="文字样式"
          icon={<CaseSensitive className="h-4 w-4" />}
          tone="fill"
          secondary={
            <label className="relative grid h-10 grid-cols-[42px_minmax(0,1fr)] items-center overflow-hidden rounded-xl bg-white text-sm text-slate-900">
              <input
                type="color"
                value={element.color}
                onChange={(event) => onUpdateElement(element.id, { color: event.target.value })}
                className="h-full w-full border-0 bg-transparent p-1"
                aria-label="文字颜色"
              />
              <span className="min-w-0 truncate px-2 uppercase">{element.color}</span>
            </label>
          }
        >
          <ControlRow>
            <NumberField
              icon={<CaseSensitive className="h-4 w-4" />}
              label="字号"
              value={element.fontSize}
              min={8}
              max={300}
              onChange={(value) => onUpdateElement(element.id, { fontSize: value })}
            />
            <label className="grid h-10 grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl bg-white px-3 text-[11px] font-bold text-slate-700">
              <span>加粗</span>
              <input
                type="checkbox"
                checked={Boolean(element.bold)}
                onChange={(event) => onUpdateElement(element.id, { bold: event.target.checked })}
              />
            </label>
          </ControlRow>
          <ControlRow className="mt-2">
            <input
              value={element.fontFamily || ''}
              onChange={(event) => onUpdateElement(element.id, { fontFamily: event.target.value })}
              className="h-10 min-w-0 rounded-xl border-0 bg-white px-3 text-sm text-slate-900 outline-none"
              placeholder="Microsoft YaHei"
              aria-label="字体"
            />
            <select
              value={element.align || 'center'}
              onChange={(event) =>
                onUpdateElement(element.id, {
                  align: event.target.value as 'left' | 'center' | 'right',
                })
              }
              className="h-10 rounded-xl border-0 bg-white px-3 text-sm text-slate-900 outline-none"
              aria-label="对齐"
            >
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
          </ControlRow>
        </InspectorGroup>
      )}
      {element.kind === 'button' && (
        <InspectorGroup
          title={copy.buttonStyle}
          icon={<Link2 className="h-4 w-4" />}
          tone="stroke"
          secondary={
            <select
              value={element.variant}
              onChange={(event) =>
                onUpdateElement(element.id, {
                  variant: event.target.value as typeof element.variant,
                })
              }
              className="h-10 w-full rounded-xl border-0 bg-white px-3 text-sm text-slate-900 outline-none"
              aria-label={copy.buttonStyle}
            >
              <option value="primary">{copy.primaryButton}</option>
              <option value="secondary">{copy.secondaryButton}</option>
              <option value="link">{copy.linkButton}</option>
            </select>
          }
        >
          <label className="block text-[11px] font-bold text-slate-600">
            <span className="mb-1 block">{copy.buttonAction}</span>
            <select
              value={element.action}
              onChange={(event) =>
                onUpdateElement(element.id, { action: event.target.value as typeof element.action })
              }
              className="h-10 w-full rounded-xl border-0 bg-white px-3 text-sm text-slate-900 outline-none"
            >
              <option value="none">{copy.noAction}</option>
              <option value="slide">{copy.jumpToSlide}</option>
              <option value="url">{copy.openLink}</option>
            </select>
          </label>
          {element.action === 'slide' && (
            <label className="mt-2 block text-[11px] font-bold text-slate-600">
              <span className="mb-1 block">{copy.targetSlide}</span>
              <select
                value={element.targetSlideId || ''}
                onChange={(event) =>
                  onUpdateElement(element.id, { targetSlideId: event.target.value || undefined })
                }
                className="h-10 w-full rounded-xl border-0 bg-white px-3 text-sm text-slate-900 outline-none"
              >
                <option value="">{copy.noAction}</option>
                {slides
                  .filter((item) => item.id !== slide.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {element.action === 'url' && (
            <label className="mt-2 block text-[11px] font-bold text-slate-600">
              <span className="mb-1 block">{copy.linkUrl}</span>
              <input
                type="url"
                value={element.url || ''}
                onChange={(event) => onUpdateElement(element.id, { url: event.target.value })}
                className="h-10 w-full rounded-xl border-0 bg-white px-3 text-sm text-slate-900 outline-none"
                placeholder="https://"
              />
            </label>
          )}
        </InspectorGroup>
      )}
      <button
        type="button"
        className="flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black text-rose-600 transition hover:bg-rose-50"
        onClick={() => onDeleteElement(element.id)}
      >
        <Trash2 className="h-4 w-4" />
        {copy.removeElement}
      </button>
    </div>
  );
}
