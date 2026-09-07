import { Link2, Palette, Trash2 } from 'lucide-react';

import type { Language } from '../../../lib/i18n';
import type { PptManualElement, PptManualSlide } from '../video/shared/types';
import { StartMenuElementInspector } from '../web/StartMenuElementInspector';
import { InspectorGroup } from '../shared/inspectors/InspectorControls';
import type { PptCopy } from './i18n';
import { toPptManualElementPatch, toPptWebInspectorElement } from './pptWebInspectorAdapter';

export function PptManualInspector({
  copy,
  language,
  slide,
  selectedElementId,
  slides,
  showDescriptions,
  onUpdateBackgroundColor,
  onUpdateElement,
  onDeleteElement,
}: {
  copy: PptCopy;
  language: Language;
  slide: PptManualSlide;
  selectedElementId?: string;
  slides: Array<{ id: string; title: string }>;
  showDescriptions: boolean;
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

  return (
    <div className="space-y-3 text-[12px] text-slate-900">
      <StartMenuElementInspector
        element={toPptWebInspectorElement(element)}
        language={language}
        showDescriptions={showDescriptions}
        buttonFunctions={element.kind === 'button' ? ['custom', 'link'] : undefined}
        onUpdate={(patch) => onUpdateElement(element.id, toPptManualElementPatch(element, patch))}
      />
      {element.kind === 'button' && (
        <InspectorGroup
          title={copy.buttonAction}
          icon={<Link2 className="h-3.5 w-3.5" />}
          tone="position"
          secondary={
            <select
              value={element.action}
              onChange={(event) =>
                onUpdateElement(element.id, {
                  action: event.target.value as typeof element.action,
                })
              }
              className="h-10 w-full rounded-xl border-0 bg-white px-3 text-sm text-slate-900 outline-none"
              aria-label={copy.buttonAction}
            >
              <option value="none">{copy.noAction}</option>
              <option value="slide">{copy.jumpToSlide}</option>
              <option value="url">{copy.openLink}</option>
            </select>
          }
        >
          {element.action === 'slide' ? (
            <label className="block space-y-1 px-1 text-[10px] font-bold text-slate-500">
              <span>{copy.targetSlide}</span>
              <select
                value={element.targetSlideId || ''}
                onChange={(event) =>
                  onUpdateElement(element.id, { targetSlideId: event.target.value || undefined })
                }
                className="h-10 w-full rounded-xl border-0 bg-white px-3 text-sm font-normal text-slate-900 outline-none"
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
          ) : element.action === 'url' ? (
            <label className="block space-y-1 px-1 text-[10px] font-bold text-slate-500">
              <span>{copy.linkUrl}</span>
              <input
                type="url"
                value={element.url || ''}
                onChange={(event) => onUpdateElement(element.id, { url: event.target.value })}
                className="h-10 w-full rounded-xl border-0 bg-white px-3 text-sm font-normal text-slate-900 outline-none"
                placeholder="https://"
              />
            </label>
          ) : (
            <p className="px-1 text-xs leading-5 text-slate-500">{copy.noAction}</p>
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
