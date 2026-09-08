import { ArrowDown, ArrowUp, Layers, Link2, Unlink2 } from 'lucide-react';
import { useState } from 'react';
import type { Language } from '../../../../lib/i18n';
import { FloatingPopover, NumberField } from './InspectorControls';

export type LayerEntry = { id: string; name: string; z: number };
export function LayerOrderMenu({
  language,
  items,
  selectedId,
  onSelect,
  onChange,
}: {
  language: Language;
  items: LayerEntry[];
  selectedId: string;
  onSelect?: (id: string) => void;
  onChange: (id: string, z: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);
  const sorted = [...items].sort((a, b) => b.z - a.z || a.id.localeCompare(b.id));
  const move = (id: string, delta: number) => {
    const index = sorted.findIndex((v) => v.id === id);
    const to = index + delta;
    if (to < 0 || to >= sorted.length) return;
    const neighbor = sorted[to];
    const beyond = sorted[to + delta];
    const z = beyond && beyond.z !== neighbor.z ? (neighbor.z + beyond.z) / 2 : neighbor.z - delta;
    onChange(id, z);
  };
  return (
    <>
      <button
        type="button"
        className="property-add"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Layers size={14} />
        {t('图层 · Z 轴', 'Layers · Z order')}
        <span className="ml-auto">{items.length}</span>
      </button>
      {open && (
        <FloatingPopover popoverKey="layers" onClose={() => setOpen(false)}>
          <div className="property-editor-popover">
            <div className="property-popover-heading">{t('图层顺序', 'Layer order')}</div>
            <p className="mb-3 text-xs opacity-50">
              {t('上方元素位于前景', 'Top items are in front')}
            </p>
            <div className="max-h-80 overflow-auto">
              {sorted.map((item, index) => (
                <div key={item.id} className="effect-row" data-selected={item.id === selectedId}>
                  <button className="effect-name" type="button" onClick={() => onSelect?.(item.id)}>
                    {item.name}
                  </button>
                  <input
                    className="w-14 bg-transparent text-right text-xs"
                    type="number"
                    value={item.z}
                    aria-label={`${item.name} Z`}
                    onChange={(e) => onChange(item.id, Number(e.target.value) || 0)}
                  />
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={t('上移', 'Move up')}
                    onClick={() => move(item.id, -1)}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={index === sorted.length - 1}
                    aria-label={t('下移', 'Move down')}
                    onClick={() => move(item.id, 1)}
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </FloatingPopover>
      )}
    </>
  );
}
export function CornerEditor({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: [number, number, number, number];
  onChange: (value: [number, number, number, number]) => void;
}) {
  const [linked, setLinked] = useState(value.every((v) => v === value[0]));
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);
  const labels = [
    t('左上', 'Top left'),
    t('右上', 'Top right'),
    t('右下', 'Bottom right'),
    t('左下', 'Bottom left'),
  ];
  return (
    <div className="property-editor-popover">
      <div className="property-popover-heading">
        {t('圆角', 'Corner radius')}
        <button
          type="button"
          className="property-add ml-auto"
          aria-pressed={linked}
          onClick={() => {
            setLinked(!linked);
            if (!linked) onChange([value[0], value[0], value[0], value[0]]);
          }}
        >
          {linked ? <Link2 size={14} /> : <Unlink2 size={14} />}{' '}
          {linked ? t('统一', 'Linked') : t('独立', 'Independent')}
        </button>
      </div>
      <div className="corner-editor-grid">
        {[0, 1, 3, 2].map((i) => (
          <NumberField
            key={i}
            label={`${labels[i]} · px`}
            value={value[i]}
            min={0}
            max={999}
            onChange={(n) => {
              const next = [...value] as typeof value;
              next[i] = n;
              onChange(linked ? [n, n, n, n] : next);
            }}
          />
        ))}
      </div>
      <div
        className="corner-preview"
        style={{ borderRadius: value.map((v) => `${Math.min(v, 45)}px`).join(' ') }}
      />
    </div>
  );
}
