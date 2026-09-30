import type { Language } from '../../../lib/i18n';
import { formatWebText } from './i18n';
import { buttonMotionForPreset, type WebButtonMotionPreset } from './webButtonMotion';

export { buttonMotionForPreset };
export type { WebButtonMotionPreset };

export function ButtonMotionPresetControl({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: WebButtonMotionPreset;
  onChange: (value: WebButtonMotionPreset) => void;
}) {
  const prefix = 'componentsrenderwebStartMenuElementInspectorButtonMotion';
  const options: Array<{ value: WebButtonMotionPreset; label: string; hint: string }> = [
    {
      value: 'none',
      label: formatWebText(language, `${prefix}PresetNone` as Parameters<typeof formatWebText>[1]),
      hint: formatWebText(language, `${prefix}PresetNoneHint` as Parameters<typeof formatWebText>[1]),
    },
    {
      value: 'soft',
      label: formatWebText(language, `${prefix}PresetSoft` as Parameters<typeof formatWebText>[1]),
      hint: formatWebText(language, `${prefix}PresetSoftHint` as Parameters<typeof formatWebText>[1]),
    },
    {
      value: 'strong',
      label: formatWebText(language, `${prefix}PresetStrong` as Parameters<typeof formatWebText>[1]),
      hint: formatWebText(language, `${prefix}PresetStrongHint` as Parameters<typeof formatWebText>[1]),
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`min-h-14 rounded-xl border px-2 py-2 text-left transition-colors ${
            value === option.value
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
              : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50'
          }`}
          aria-pressed={value === option.value}
        >
          <span className="block text-xs font-bold">{option.label}</span>
          <span className="mt-1 block text-[10px] leading-4 text-slate-400">{option.hint}</span>
        </button>
      ))}
    </div>
  );
}
