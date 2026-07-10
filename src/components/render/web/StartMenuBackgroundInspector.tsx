import { ChevronDown, Image as ImageIcon, Palette } from 'lucide-react';
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
  const [open, setOpen] = useState(true);
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
    <div className="relative rounded-[22px] bg-sky-50/80 p-3 text-slate-900">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
        <div
          className="flex h-10 min-w-0 items-center gap-2 rounded-xl bg-sky-100 px-3 text-sm font-bold text-slate-900"
          title={text.group.fill}
          aria-label={text.group.fill}
        >
          <Palette className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{text.group.fill}</span>
        </div>
        <FillTabs
          value={settings.startMenuBackgroundType}
          text={text}
          onChange={(type) => {
            setBackgroundType(type);
            setOpenEditor(openEditor === type ? null : type);
          }}
        />
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="grid h-10 w-11 place-items-center rounded-xl bg-sky-100 text-slate-900"
          title={text.group.fill}
          aria-label={text.group.fill}
          aria-expanded={open}
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div className={open ? 'mt-3' : 'hidden'}>
        {showDescriptions && (
          <div className="mb-2 px-1 text-[10px] leading-4 text-slate-500">{text.group.fill}</div>
        )}
        <BackgroundPreview settings={settings} />
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

function FillTabs({
  value,
  text,
  onChange,
}: {
  value: BackgroundType;
  text: ReturnType<typeof renderObjectText>;
  onChange: (value: BackgroundType) => void;
}) {
  const options: Array<{ type: BackgroundType; label: string; icon: React.ReactNode }> = [
    { type: 'solid', label: text.option.solid, icon: <Palette className="h-3.5 w-3.5" /> },
    { type: 'gradient', label: text.option.gradient, icon: <GradientIcon /> },
    { type: 'image', label: text.option.image, icon: <ImageIcon className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
      {options.map(({ type, label, icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`flex h-10 min-w-0 items-center justify-center px-2 text-xs font-bold ${
            value === type ? 'bg-indigo-600 text-white' : 'text-slate-700'
          }`}
          title={label}
          aria-label={label}
          aria-pressed={value === type}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function BackgroundPreview({ settings }: { settings: WebExportSettings }) {
  const background =
    settings.startMenuBackgroundType === 'gradient'
      ? `linear-gradient(${settings.startMenuBackgroundGradientAngle}deg, ${settings.startMenuBackgroundGradientStart}, ${settings.startMenuBackgroundGradientEnd})`
      : settings.startMenuBackgroundType === 'image'
        ? `center / cover url("${settings.startMenuBackgroundImageUrl}")`
        : settings.startMenuBackgroundColor;
  return (
    <div className="h-10 rounded-xl border border-white/60 bg-white p-1">
      <div className="h-full rounded-lg" style={{ background }} />
    </div>
  );
}

function GradientIcon() {
  return (
    <span
      className="block h-3.5 w-3.5 rounded-full border border-current/30"
      style={{ background: 'linear-gradient(135deg, currentColor 0%, transparent 100%)' }}
      aria-hidden="true"
    />
  );
}
