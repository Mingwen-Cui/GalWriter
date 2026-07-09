import { Palette } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import type { Language } from '../../../lib/i18n';
import {
  GradientPopover,
  ImageFillPopover,
  SolidColorPopover,
} from '../video/objectInspector/ColorPopovers';
import { renderObjectText } from '../video/objectInspector/i18n';
import type { WebExportSettings } from '../video/shared/types';
import { normalizeGradientStops } from './webGradientStops';

type StartMenuBackgroundInspectorProps = {
  settings: WebExportSettings;
  language: Language;
  showDescriptions: boolean;
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
};

type BackgroundType = WebExportSettings['startMenuBackgroundType'];

const BLANK_BACKGROUND_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='white'/%3E%3C/svg%3E";

export function StartMenuBackgroundInspector({
  settings,
  language,
  showDescriptions,
  updateWebSettings,
}: StartMenuBackgroundInspectorProps) {
  const text = renderObjectText(language);
  const [openEditor, setOpenEditor] = useState<BackgroundType | null>(null);
  const gradientStops = normalizeGradientStops(
    settings.startMenuBackgroundGradientStops,
    settings.startMenuBackgroundGradientStart,
    settings.startMenuBackgroundGradientEnd,
    '#0f172a',
    '#0891b2',
  );

  const setBackgroundType = (value: BackgroundType) => {
    updateWebSettings('startMenuBackgroundType', value);
    if (value === 'image' && !settings.startMenuBackgroundImageUrl) {
      updateWebSettings('startMenuBackgroundImageUrl', BLANK_BACKGROUND_IMAGE);
    }
  };

  return (
    <div className="relative grid gap-2 rounded-xl bg-sky-50 p-3 text-slate-900">
      {showDescriptions && (
        <div className="px-1 text-[10px] font-bold text-slate-500">
          {text.group.fill}
        </div>
      )}
      <div className="grid grid-cols-3 overflow-hidden rounded-lg bg-white">
        {(['solid', 'gradient', 'image'] as BackgroundType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setBackgroundType(type);
              setOpenEditor(openEditor === type ? null : type);
            }}
            className={`flex h-9 items-center justify-center gap-1 text-xs font-bold ${
              settings.startMenuBackgroundType === type
                ? 'bg-indigo-600 text-white'
                : 'text-slate-700'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            {type === 'solid'
              ? text.option.solid
              : type === 'gradient'
                ? text.option.gradient
                : text.option.image}
          </button>
        ))}
      </div>
      {openEditor === 'solid' && (
        <FloatingPopover>
          <SolidColorPopover
            tone="fill"
            text={text.popover}
            color={settings.startMenuBackgroundColor}
            alpha={100}
            onColorChange={(value) => updateWebSettings('startMenuBackgroundColor', value)}
            onAlphaChange={() => undefined}
          />
        </FloatingPopover>
      )}
      {openEditor === 'gradient' && (
        <FloatingPopover>
          <GradientPopover
            tone="fill"
            text={text.popover}
            angle={settings.startMenuBackgroundGradientAngle}
            stops={gradientStops}
            onAngleChange={(value) => updateWebSettings('startMenuBackgroundGradientAngle', value)}
            onStopsChange={(stops) => {
              const sorted = [...stops].sort((a, b) => a.position - b.position);
              const start = sorted[0];
              const end = sorted[sorted.length - 1];
              updateWebSettings('startMenuBackgroundGradientStops', sorted);
              if (start) updateWebSettings('startMenuBackgroundGradientStart', start.color);
              if (end) updateWebSettings('startMenuBackgroundGradientEnd', end.color);
            }}
          />
        </FloatingPopover>
      )}
      {openEditor === 'image' && (
        <FloatingPopover>
          <ImageFillPopover
            tone="fill"
            text={text.popover}
            value={{
              imageUrl: settings.startMenuBackgroundImageUrl,
              imageFit: 'crop',
              imageAngle: 0,
              imageAlpha: 100,
            }}
            onChange={(updates) => {
              if (updates.imageUrl !== undefined) {
                updateWebSettings('startMenuBackgroundImageUrl', updates.imageUrl);
              }
            }}
          />
        </FloatingPopover>
      )}
    </div>
  );
}

function FloatingPopover({ children }: { children: React.ReactNode }) {
  return <div className="absolute left-3 right-3 top-[calc(100%-4px)] z-[80]">{children}</div>;
}
