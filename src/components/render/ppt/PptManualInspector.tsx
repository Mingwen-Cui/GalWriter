import { Trash2 } from 'lucide-react';

import type { PptManualElement, PptManualSlide } from '../video/shared/types';
import type { PptCopy } from './i18n';

export function PptManualInspector({
  copy,
  slide,
  selectedElementId,
  slides,
  onUpdateSlide,
  onUpdateElement,
  onDeleteElement,
}: {
  copy: PptCopy;
  slide: PptManualSlide;
  selectedElementId?: string;
  slides: Array<{ id: string; title: string }>;
  onUpdateSlide: (patch: Partial<PptManualSlide>) => void;
  onUpdateElement: (elementId: string, patch: Partial<PptManualElement>) => void;
  onDeleteElement: (elementId: string) => void;
}) {
  const element = slide.elements.find((item) => item.id === selectedElementId);
  if (!element) {
    return (
      <label className="block text-xs font-bold text-[var(--vr-text-muted)]">
        <span className="mb-1.5 block">{copy.backgroundColor}</span>
        <input
          type="color"
          value={slide.backgroundColor}
          onChange={(event) => onUpdateSlide({ backgroundColor: event.target.value })}
          className="h-10 w-full rounded-lg border border-[var(--vr-border)] bg-transparent p-1"
        />
      </label>
    );
  }
  return (
    <div className="space-y-4">
      {(element.kind === 'text' || element.kind === 'button') && (
        <label className="block text-xs font-bold text-[var(--vr-text-muted)]">
          <span className="mb-1.5 block">{element.kind === 'button' ? copy.buttonText : copy.elementText}</span>
          <textarea
            value={element.text}
            onChange={(event) => onUpdateElement(element.id, { text: event.target.value })}
            className="render-field min-h-20 w-full resize-y"
          />
        </label>
      )}
      {element.kind === 'button' && (
        <>
          <label className="block text-xs font-bold text-[var(--vr-text-muted)]">
            <span className="mb-1.5 block">{copy.buttonStyle}</span>
            <select
              value={element.variant}
              onChange={(event) => onUpdateElement(element.id, { variant: event.target.value as typeof element.variant })}
              className="render-field w-full"
            >
              <option value="primary">{copy.primaryButton}</option>
              <option value="secondary">{copy.secondaryButton}</option>
              <option value="link">{copy.linkButton}</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-[var(--vr-text-muted)]">
            <span className="mb-1.5 block">{copy.buttonAction}</span>
            <select
              value={element.action}
              onChange={(event) => onUpdateElement(element.id, { action: event.target.value as typeof element.action })}
              className="render-field w-full"
            >
              <option value="none">{copy.noAction}</option>
              <option value="slide">{copy.jumpToSlide}</option>
              <option value="url">{copy.openLink}</option>
            </select>
          </label>
          {element.action === 'slide' && (
            <label className="block text-xs font-bold text-[var(--vr-text-muted)]">
              <span className="mb-1.5 block">{copy.targetSlide}</span>
              <select
                value={element.targetSlideId || ''}
                onChange={(event) => onUpdateElement(element.id, { targetSlideId: event.target.value || undefined })}
                className="render-field w-full"
              >
                <option value="">{copy.noAction}</option>
                {slides.filter((item) => item.id !== slide.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          )}
          {element.action === 'url' && (
            <label className="block text-xs font-bold text-[var(--vr-text-muted)]">
              <span className="mb-1.5 block">{copy.linkUrl}</span>
              <input
                type="url"
                value={element.url || ''}
                onChange={(event) => onUpdateElement(element.id, { url: event.target.value })}
                className="render-field w-full"
                placeholder="https://"
              />
            </label>
          )}
        </>
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
