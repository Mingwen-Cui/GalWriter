import { ArrowDown, ArrowUp, Layers, Link2, Unlink2 } from 'lucide-react';
import { useContext, useState } from 'react';
import type { Language } from '../../../../lib/i18n';
import { FloatingPopover, FloatingPopoverHeaderContext, NumberField } from './InspectorControls';

export type LayerEntry = { id: string; name: string; z: number };
export type LayerChange = { id: string; z: number };
export const LAYER_ORDER_EXCEPTION = 999;

const compareLayerEntries = (a: LayerEntry, b: LayerEntry) => b.z - a.z || a.id.localeCompare(b.id);

/**
 * Returns a dense layer order while preserving the current front-to-back order.
 * 999 is reserved as the single explicit out-of-band layer value.
 */
export const normalizeLayerEntries = (items: LayerEntry[]) => {
  const sorted = [...items].sort(compareLayerEntries);
  const special = sorted.find((item) => item.z === LAYER_ORDER_EXCEPTION);
  const regular = sorted.filter((item) => item.id !== special?.id);
  const normalized = new Map<string, number>();
  if (special) normalized.set(special.id, LAYER_ORDER_EXCEPTION);
  regular.forEach((item, index) => {
    normalized.set(item.id, regular.length - 1 - index);
  });
  return items.map((item) => ({ ...item, z: normalized.get(item.id) ?? 0 }));
};

/**
 * Moves an item to a requested Z value and returns changes for every affected
 * item so the collection remains unique and contiguous.
 */
export const getLayerOrderChanges = (
  items: LayerEntry[],
  selectedId: string,
  requestedZ: number,
): LayerChange[] => {
  if (items.length === 0) return [];
  const normalized = normalizeLayerEntries(items);
  const selected = normalized.find((item) => item.id === selectedId);
  if (!selected) return [];
  const special = normalized.find((item) => item.z === LAYER_ORDER_EXCEPTION);
  const wantsException = Math.round(requestedZ) === LAYER_ORDER_EXCEPTION;

  if (wantsException) {
    const regular = normalized.filter((item) => item.id !== selectedId).sort(compareLayerEntries);
    return [
      { id: selectedId, z: LAYER_ORDER_EXCEPTION },
      ...regular.map((item, index) => ({ id: item.id, z: regular.length - 1 - index })),
    ];
  }

  const specialId = special?.id === selectedId ? undefined : special?.id;
  const regular = normalized
    .filter((item) => item.id !== selectedId && item.id !== specialId)
    .sort(compareLayerEntries);
  const regularCount = normalized.length - (specialId ? 1 : 0);
  const target = Math.min(
    regularCount - 1,
    Math.max(0, Number.isFinite(requestedZ) ? Math.round(requestedZ) : 0),
  );
  const insertAt = regularCount - 1 - target;
  const ordered = [...regular];
  ordered.splice(insertAt, 0, selected);

  return [
    ...ordered.map((item, index) => ({ id: item.id, z: regularCount - 1 - index })),
    ...(specialId ? [{ id: specialId, z: LAYER_ORDER_EXCEPTION }] : []),
  ];
};

export function LayerOrderMenu({
  language,
  items,
  selectedId,
  onSelect,
  onChange,
  onReorder,
  className = '',
}: {
  language: Language;
  items: LayerEntry[];
  selectedId: string;
  onSelect?: (id: string) => void;
  onChange: (id: string, z: number) => void;
  onReorder?: (changes: LayerChange[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);
  const sorted = normalizeLayerEntries(items).sort(compareLayerEntries);
  const openMenu = () => {
    if (!open && onReorder) {
      const normalized = normalizeLayerEntries(items);
      const changes = normalized
        .filter((item, index) => item.z !== items[index]?.z)
        .map((item) => ({ id: item.id, z: item.z }));
      if (changes.length > 0) onReorder(changes);
    }
    setOpen(!open);
  };
  const commitZ = (id: string, z: number) => {
    const changes = getLayerOrderChanges(items, id, z);
    if (onReorder && changes.length > 0) onReorder(changes);
    else changes.forEach((change) => onChange(change.id, change.z));
  };
  const move = (id: string, delta: number) => {
    const index = sorted.findIndex((v) => v.id === id);
    const to = index + delta;
    if (to < 0 || to >= sorted.length) return;
    const neighbor = sorted[to];
    commitZ(id, neighbor.z);
  };
  return (
    <>
      <button
        type="button"
        className={`property-add ${className}`}
        onClick={openMenu}
        aria-expanded={open}
      >
        <Layers size={14} />
        {t('图层 · Z 轴', 'Layers · Z order')}
        <span className="ml-auto">{items.length}</span>
      </button>
      {open && (
        <FloatingPopover language={language} popoverKey="layers" onClose={() => setOpen(false)}>
          <div className="property-editor-popover">
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
                    type="text"
                    inputMode="numeric"
                    value={drafts[item.id] ?? String(item.z)}
                    aria-label={`${item.name} Z`}
                    min={0}
                    max={LAYER_ORDER_EXCEPTION}
                    onFocus={() =>
                      setDrafts((current) => ({ ...current, [item.id]: String(item.z) }))
                    }
                    onChange={(e) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: e.target.value.replace(/[^\d]/g, '').slice(0, 3),
                      }))
                    }
                    onBlur={(e) => {
                      commitZ(item.id, Number(e.currentTarget.value));
                      setDrafts((current) => {
                        const next = { ...current };
                        delete next[item.id];
                        return next;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        setDrafts((current) => {
                          const next = { ...current };
                          delete next[item.id];
                          return next;
                        });
                        e.currentTarget.blur();
                      }
                    }}
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
  const hasPopoverHeader = useContext(FloatingPopoverHeaderContext);
  const [linked, setLinked] = useState(value.every((v) => v === value[0]));
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);
  const labels = [
    t('左上', 'Top left'),
    t('右上', 'Top right'),
    t('右下', 'Bottom right'),
    t('左下', 'Bottom left'),
  ];
  const renderCorner = (i: number) => (
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
  );
  return (
    <div className="property-editor-popover">
      <div className="property-popover-heading">
        {!hasPopoverHeader && t('圆角', 'Corner radius')}
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
      <div className="corner-editor-grid">{[0, 1].map(renderCorner)}</div>
      <div
        className="corner-preview"
        style={{ borderRadius: value.map((v) => `${Math.min(v, 45)}px`).join(' ') }}
      />
      <div className="corner-editor-grid">{[3, 2].map(renderCorner)}</div>
    </div>
  );
}
