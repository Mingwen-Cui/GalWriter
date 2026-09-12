import { ArrowDown, ArrowUp, Layers, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Language } from '../../../../lib/i18n';
import { renderObjectText } from '../../video/objectInspector/i18n';
import { BackgroundFillInspector } from '../paint/BackgroundFillInspector';
import { SolidColorPopover } from '../paint/ColorPopovers';
import { InlineColorControl } from '../paint/InlinePaintControls';
import { newOutline, newPaint, newShadow, type SurfaceAppearance } from '../paint/appearance';
import { parseColorValue, toHex8 } from '../paint/colorValue';
import { FloatingPopover, InspectorGroup, NumberField } from './InspectorControls';

export function AppearanceStackInspector({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: SurfaceAppearance;
  onChange: (value: SurfaceAppearance) => void;
}) {
  const t = (zh: string, en: string, ja = en) =>
    language === 'zh' ? zh : language === 'ja' ? ja : en;
  const [editing, setEditing] = useState<{ group: keyof SurfaceAppearance; id: string } | null>(
    null,
  );
  const [colorOpen, setColorOpen] = useState(false);
  const names = {
    fills: t('填充', 'Fills', '塗り'),
    strokes: t('描边', 'Strokes', '線'),
    shadows: t('阴影', 'Shadows', '影'),
  };
  const paintNames = {
    solid: t('纯色', 'Solid', '単色'),
    gradient: t('渐变', 'Gradient', 'グラデーション'),
    image: t('图片', 'Image', '画像'),
    video: t('视频', 'Video', '動画'),
  };
  const update = (group: keyof SurfaceAppearance, id: string, patch: object) =>
    onChange({
      ...value,
      [group]: value[group].map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    });
  const selected = editing
    ? value[editing.group].find((layer) => layer.id === editing.id)
    : undefined;
  const close = () => {
    setEditing(null);
    setColorOpen(false);
  };
  const color = (colorValue: string, onChange: (color: string) => void) => {
    const parsed = parseColorValue(colorValue);
    return (
      <>
        <InlineColorControl
          label={t('颜色', 'Color')}
          color={parsed.hex}
          alpha={parsed.alpha}
          hexLabel="HEX"
          alphaLabel="%"
          onColorChange={(c) => onChange(toHex8(c, parsed.alpha))}
          onAlphaChange={(a) => onChange(toHex8(parsed.hex, a))}
          onColorAndAlphaChange={({ color, alpha }) => onChange(toHex8(color, alpha))}
          onOpen={() => setColorOpen(!colorOpen)}
        />
        {colorOpen && (
          <SolidColorPopover
            tone="fill"
            text={renderObjectText(language).popover}
            color={parsed.hex}
            alpha={parsed.alpha}
            onColorChange={(c) => onChange(toHex8(c, parsed.alpha))}
            onAlphaChange={(a) => onChange(toHex8(parsed.hex, a))}
            onColorAndAlphaChange={({ color, alpha }) => onChange(toHex8(color, alpha))}
          />
        )}
      </>
    );
  };
  return (
    <div className="space-y-3">
      {(['fills', 'strokes', 'shadows'] as const).map((group) => (
        <InspectorGroup
          key={group}
          title={names[group]}
          icon={<Layers className="h-3.5 w-3.5" />}
          tone={group === 'fills' ? 'fill' : group === 'strokes' ? 'stroke' : 'shadow'}
          secondary={null}
        >
          <div className="effect-stack">
            {value[group].map((layer, index) => (
              <div className="effect-row" key={layer.id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={layer.enabled}
                  aria-label={`${names[group]} ${index + 1}`}
                  onClick={() => update(group, layer.id, { enabled: !layer.enabled })}
                >
                  <span className="property-switch" data-on={layer.enabled}>
                    <span />
                  </span>
                </button>
                <button
                  type="button"
                  className="effect-name"
                  onClick={() => {
                    setEditing({ group, id: layer.id });
                    setColorOpen(false);
                  }}
                >
                  <span className="effect-swatch" style={{ background: layer.color }} />
                  {'type' in layer ? paintNames[layer.type] : names[group]}{' '}
                  <span className="opacity-50">{index + 1}</span>
                </button>
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={t('上移', 'Move up')}
                  onClick={() => {
                    const next = [...value[group]];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    onChange({ ...value, [group]: next });
                  }}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  disabled={index === value[group].length - 1}
                  aria-label={t('下移', 'Move down')}
                  onClick={() => {
                    const next = [...value[group]];
                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                    onChange({ ...value, [group]: next });
                  }}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  aria-label={t('删除', 'Remove')}
                  onClick={() =>
                    onChange({
                      ...value,
                      [group]: value[group].filter((item) => item.id !== layer.id),
                    })
                  }
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="property-add"
            onClick={() => {
              const layer =
                group === 'fills' ? newPaint() : group === 'strokes' ? newOutline() : newShadow();
              onChange({ ...value, [group]: [layer, ...value[group]] });
              setEditing({ group, id: layer.id });
              setColorOpen(false);
            }}
          >
            <Plus size={13} />
            {t('添加', 'Add')} {names[group]}
          </button>
        </InspectorGroup>
      ))}
      {editing && selected && (
        <FloatingPopover
          language={language}
          positionKey={`appearance-${editing.group}`}
          popoverKey={editing.group === 'fills' && 'type' in selected ? selected.type : 'style'}
          title={editing.group === 'fills' && 'type' in selected ? paintNames[selected.type] : names[editing.group]}
          onClose={close}
          closeLabel={t('关闭', 'Close')}
        >
          <div className="property-editor-popover space-y-3">
            {editing.group === 'fills' && 'type' in selected && (
              <>
                <BackgroundFillInspector
                  language={language}
                  inlineEditor
                  value={selected}
                  onChange={(patch) => update('fills', selected.id, patch)}
                />
                <NumberField
                  label={t('不透明度 · %', 'Opacity · %')}
                  value={selected.opacity}
                  min={0}
                  max={100}
                  onChange={(opacity) => update('fills', selected.id, { opacity })}
                />
              </>
            )}
            {editing.group === 'strokes' && 'width' in selected && (
              <div className="space-y-3">
                <BackgroundFillInspector
                  language={language}
                  inlineEditor
                  allowedTypes={['solid', 'gradient']}
                  value={selected.paint && (selected.paint.type === 'solid' || selected.paint.type === 'gradient')
                    ? selected.paint
                    : { ...newPaint(), color: selected.color }}
                  onChange={(patch) =>
                    update('strokes', selected.id, {
                      paint: {
                        ...(selected.paint || { ...newPaint(), color: selected.color }),
                        type: selected.paint?.type === 'gradient' ? 'gradient' : 'solid',
                        ...patch,
                      },
                      ...(patch.color ? { color: patch.color } : {}),
                    })
                  }
                />
                <NumberField
                  label={t('宽度 · px', 'Width · px')}
                  value={selected.width}
                  min={0}
                  max={100}
                  onChange={(width) => update('strokes', selected.id, { width })}
                />
                <select
                  className="property-select"
                  aria-label={t('描边位置', 'Stroke position')}
                  value={selected.position}
                  onChange={(e) => update('strokes', selected.id, { position: e.target.value })}
                >
                  <option value="inside">{t('内部', 'Inside')}</option>
                  <option value="center">{t('居中', 'Center')}</option>
                  <option value="outside">{t('外部', 'Outside')}</option>
                </select>
              </div>
            )}
            {editing.group === 'shadows' && 'blur' in selected && (
              <div className="space-y-3">
                {color(selected.color, (c) => update('shadows', selected.id, { color: c }))}
                <select
                  className="property-select"
                  aria-label={t('阴影类型', 'Shadow type')}
                  value={selected.inset ? 'inner' : 'outer'}
                  onChange={(e) =>
                    update('shadows', selected.id, { inset: e.target.value === 'inner' })
                  }
                >
                  <option value="outer">{t('外阴影', 'Outer shadow')}</option>
                  <option value="inner">{t('内阴影', 'Inner shadow')}</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  {(['x', 'y', 'blur', 'spread'] as const).map((key) => (
                    <NumberField
                      key={key}
                      label={`${{ x: 'X', y: 'Y', blur: t('模糊', 'Blur'), spread: t('扩展', 'Spread') }[key]} · px`}
                      value={selected[key]}
                      min={key === 'blur' ? 0 : -100}
                      max={200}
                      onChange={(n) => update('shadows', selected.id, { [key]: n })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </FloatingPopover>
      )}
    </div>
  );
}
