import { Palette } from 'lucide-react';
import { useState } from 'react';

import type { Language } from '../lib/i18n';
import { regionMusicCopy } from './i18n/region-music';
import { SolidColorPopover } from './render/video/objectInspector/ColorPopovers';
import { renderObjectText } from './render/video/objectInspector/i18n';
import { parseColorValue } from './render/video/shared/colorValue';
import { FloatingPopover } from './render/web/webStyleInspectorControls';

type RegionColorPickerProps = {
  color: string;
  language: Language;
  onChange: (color: string) => void;
};

export function RegionColorPicker({ color, language, onChange }: RegionColorPickerProps) {
  const [open, setOpen] = useState(false);
  const copy = regionMusicCopy(language);
  const parsedColor = parseColorValue(color);

  return (
    <div className="relative nodrag nopan" onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="grid h-5 w-5 place-items-center rounded-md border border-[var(--toolbar-border)] transition-transform hover:scale-110"
        style={{ backgroundColor: parsedColor.hex }}
        title={copy.color}
        aria-label={copy.color}
        aria-expanded={open}
      >
        <Palette className="h-3 w-3 text-white drop-shadow" />
      </button>
      {open && (
        <FloatingPopover popoverKey="solid" onClose={() => setOpen(false)} closeLabel={copy.close}>
          <SolidColorPopover
            tone="fill"
            text={renderObjectText(language).popover}
            color={parsedColor.hex}
            alpha={100}
            onColorChange={onChange}
            onAlphaChange={() => undefined}
          />
        </FloatingPopover>
      )}
    </div>
  );
}
