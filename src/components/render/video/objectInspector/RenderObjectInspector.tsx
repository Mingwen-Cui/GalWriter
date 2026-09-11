import { AppearanceStackInspector } from '../../shared/inspectors/AppearanceStackInspector';
import { CornerEditor, LayerOrderMenu } from '../../shared/inspectors/GeometryPopovers';
import { objectAppearance } from '../../shared/paint/appearance';
import {
  Baseline,
  Blend,
  Box,
  CaseSensitive,
  ChevronDown,
  Crosshair,
  Expand,
  Minus,
  MoveHorizontal,
  MoveVertical,
  PaintBucket,
  Palette,
  Pin,
  Plus,
  Radius,
  RotateCw,
  Ruler,
  Sparkles,
  Strikethrough,
  Type,
  Underline,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { formatVideoText, getVideoStructuredText } from '../i18n';

import type { Language } from '../../../../lib/i18n';
import {
  AlignButtons,
  ControlRow,
  FillTabs,
  FloatingPopover,
  HeaderSelect,
  InspectorGroup,
  NumberField,
} from '../../shared/inspectors/InspectorControls';
import {
  GradientPopover,
  ImageFillPopover,
  SolidColorPopover,
} from '../../shared/paint/ColorPopovers';
import {
  InlineColorControl,
  InlineGradientControl,
  ShadowModeIcon,
} from '../../shared/paint/InlinePaintControls';
import {
  getRenderObjects,
  getVideoRenderObjects,
  isTextRenderObject,
  updateRenderObject,
  updateVideoTextAnimations,
} from '../shared/renderObjects';
import type {
  RenderEditableObject,
  RenderEditableObjectKind,
  RenderEditableTextObject,
  RenderFillStyle,
  RenderStyle,
  TextAnimation,
  TypewriterMode,
} from '../shared/types';
import { renderObjectText } from './i18n';

type Surface = 'video' | 'web' | 'playtest';
export type RenderObjectInspectorGroup =
  | 'position'
  | 'text'
  | 'fill'
  | 'stroke'
  | 'shadow'
  | 'animation';
type Popover = null | { group: 'fill' | 'stroke' | 'shadow'; type: 'solid' | 'gradient' | 'image' };

const objectKinds: RenderEditableObjectKind[] = ['dialogBox', 'title', 'body', 'nameplate'];
const fonts = [
  { label: 'Microsoft YaHei', value: '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif' },
  { label: 'SimSun', value: 'SimSun, "Noto Serif SC", serif' },
  { label: 'SimHei', value: 'SimHei, "Noto Sans SC", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
];

export function RenderObjectInspector({
  language,
  renderStyle,
  updateRenderStyle,
  surface = 'web',
  showDescriptions = false,
  hideObjectSelector = false,
  singleColumn = false,
  visibleGroups,
}: {
  language: Language;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  surface?: Surface;
  showDescriptions?: boolean;
  hideObjectSelector?: boolean;
  singleColumn?: boolean;
  visibleGroups?: RenderObjectInspectorGroup[];
}) {
  const text = renderObjectText(language);
  const closeLabel = formatVideoText(
    language,
    'componentsrendervideoobjectInspectorRenderObjectInspectorConditionalText100',
  );
  const objects =
    surface === 'video' ? getVideoRenderObjects(renderStyle) : getRenderObjects(renderStyle);
  const selectedKind = renderStyle.selectedRenderObject || 'dialogBox';
  const selected = objects[selectedKind];
  const textObject = isTextRenderObject(selectedKind)
    ? (selected as RenderEditableTextObject)
    : null;
  const nameplateToggleText = getVideoStructuredText(
    language,
    'componentsrendervideoobjectInspectorRenderObjectInspectorStructuredText110',
  );
  const shadowModeLabels = getVideoStructuredText(
    language,
    'componentsrendervideoobjectInspectorRenderObjectInspectorStructuredText121',
  );
  const [popover, setPopover] = useState<Popover>(null);
  const [cornersOpen, setCornersOpen] = useState(false);
  const showsGroup = (group: RenderObjectInspectorGroup) =>
    !visibleGroups || visibleGroups.includes(group);
  const strokeLabels = getVideoStructuredText(
    language,
    'componentsrendervideoobjectInspectorRenderObjectInspectorStructuredText130',
  );
  const shadowLabels = getVideoStructuredText(
    language,
    'componentsrendervideoobjectInspectorRenderObjectInspectorStructuredText136',
  );
  const animationLabels = getVideoStructuredText(
    language,
    'componentsrendervideoobjectInspectorRenderObjectInspectorStructuredText142',
  );
  const positionTitle = selected.visible
    ? text.group.position
    : formatVideoText(
        language,
        'componentsrendervideoobjectInspectorRenderObjectInspectorConditionalText148',
      );

  const setSelectedKind = (kind: RenderEditableObjectKind) => {
    updateRenderStyle('selectedRenderObject', kind);
  };

  const setObject = (updates: Partial<RenderEditableObject | RenderEditableTextObject>) => {
    const isVideoTextAnimation =
      surface === 'video' &&
      (selectedKind === 'title' || selectedKind === 'body') &&
      'animation' in updates;
    if (isVideoTextAnimation) {
      updateRenderStyle(
        'videoTextAnimations',
        updateVideoTextAnimations(renderStyle, selectedKind, updates.animation || {}),
      );
      return;
    }
    const nextObjects = updateRenderObject(renderStyle, selectedKind, updates);
    updateRenderStyle('renderObjects', nextObjects);
  };

  const setFill = (updates: Partial<RenderFillStyle>) => {
    const nextFill = { ...selected.fill, ...updates };
    setObject({ fill: nextFill });
  };

  const shadowLayers = selected.shadows?.length ? selected.shadows : [selected.shadow];
  const setShadowLayer = (index: number, updates: Partial<typeof selected.shadow>) => {
    const nextLayers = shadowLayers.map((layer, layerIndex) =>
      layerIndex === index ? { ...layer, ...updates } : layer,
    );
    setObject({ shadow: nextLayers[0], shadows: nextLayers });
  };
  const toggleShadow = () => {
    const enabled = !selected.shadow.enabled;
    const nextLayers = shadowLayers.map((layer, index) => ({
      ...layer,
      enabled: index === 0 ? enabled : layer.enabled,
      alpha: enabled && index === 0 && layer.alpha <= 0 ? 35 : layer.alpha,
    }));
    setObject({ shadow: nextLayers[0], shadows: nextLayers });
  };
  const addShadowLayer = () => {
    if (shadowLayers.length >= 6) return;
    const nextLayer = {
      ...selected.shadow,
      enabled: true,
      type: 'outer' as const,
      color: '#000000',
      alpha: 35,
      x: 0,
      y: 8,
      blur: 18,
      spread: 0,
    };
    const nextLayers = [...shadowLayers, nextLayer];
    setObject({ shadow: nextLayers[0], shadows: nextLayers });
  };
  const removeShadowLayer = (index: number) => {
    if (index === 0) return;
    const nextLayers = shadowLayers.filter((_, layerIndex) => layerIndex !== index);
    setObject({ shadow: nextLayers[0], shadows: nextLayers });
  };

  const advancedVideoDisabled = false;

  return (
    <div
      className={`${
        surface === 'playtest'
          ? `${singleColumn ? 'columns-1' : 'columns-1 lg:columns-2'} gap-3 [&>*]:mb-3 [&>*]:break-inside-avoid`
          : 'space-y-3'
      } text-[12px] text-slate-900`}
    >
      {!hideObjectSelector && (
        <div
          className={`${surface === 'playtest' ? 'rounded-2xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-3 lg:col-span-2' : ''} grid grid-cols-4 gap-2`}
        >
          {objectKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setSelectedKind(kind)}
              className={`h-9 min-w-0 truncate rounded-lg px-2 text-left font-bold transition-colors ${
                selectedKind === kind
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {text.object[kind]}
            </button>
          ))}
        </div>
      )}

      <LayerOrderMenu
        language={language}
        selectedId={selectedKind}
        items={Object.entries(objects).map(([id, obj]) => ({
          id,
          name:
            (
              { dialogBox: '对话框', title: '名称', body: '正文', nameplate: '姓名框' } as Record<
                string,
                string
              >
            )[id] || id,
          z: obj.zIndex ?? 0,
        }))}
        onSelect={(id) => setSelectedKind(id as RenderEditableObjectKind)}
        onChange={(id, zIndex) =>
          updateRenderStyle(
            'renderObjects',
            updateRenderObject(renderStyle, id as RenderEditableObjectKind, { zIndex }),
          )
        }
      />
      <button type="button" className="property-add" onClick={() => setCornersOpen(!cornersOpen)}>
        {language === 'zh' ? '圆角 · 四角设置' : 'Corner radius'}
      </button>
      {cornersOpen && (
        <FloatingPopover language={language} popoverKey="corners" onClose={() => setCornersOpen(false)}>
          <CornerEditor
            language={language}
            value={
              selected.corners || [
                selected.radius,
                selected.radius,
                selected.radius,
                selected.radius,
              ]
            }
            onChange={(corners) => setObject({ corners, radius: corners[0] })}
          />
        </FloatingPopover>
      )}
      {showsGroup('position') && (
        <InspectorGroup
          title={positionTitle}
          icon={<PositionVisibilityIcon visible={selected.visible} />}
          tone="position"
          onTitleClick={() => setObject({ visible: !selected.visible })}
          titleActive
          showDescriptions={showDescriptions}
          secondaryHasDescription
          secondary={
            <NumberField
              icon={<Radius className="h-4 w-4" />}
              label={`${text.field.radius} · px`}
              description={showDescriptions ? text.help.radius : undefined}
              value={selected.radius}
              min={0}
              max={200}
              onChange={(value) =>
                setObject({ radius: value, corners: [value, value, value, value] })
              }
            />
          }
        >
          <ControlRow>
            <NumberField
              icon={<MoveHorizontal className="h-4 w-4" />}
              label={`${text.field.x} · %`}
              description={showDescriptions ? text.help.x : undefined}
              value={selected.x}
              min={-200}
              max={200}
              onChange={(value) => setObject({ x: value })}
            />
            <NumberField
              icon={<MoveVertical className="h-4 w-4" />}
              label={`${text.field.y} · %`}
              description={showDescriptions ? text.help.y : undefined}
              value={selected.y}
              min={-200}
              max={200}
              onChange={(value) => setObject({ y: value })}
            />
          </ControlRow>
          <ControlRow className="mt-2">
            <NumberField
              icon={<Ruler className="h-4 w-4" />}
              label={`${text.field.width} · %`}
              description={showDescriptions ? text.help.width : undefined}
              value={selected.width}
              min={0}
              max={200}
              onChange={(value) => setObject({ width: value })}
            />
            <NumberField
              icon={<Box className="h-4 w-4" />}
              label={`${text.field.height} · %`}
              description={showDescriptions ? text.help.height : undefined}
              value={selected.height}
              min={0}
              max={200}
              onChange={(value) => setObject({ height: value })}
            />
          </ControlRow>
          {selectedKind === 'nameplate' && (
            <>
              <ControlRow className="mt-2">
                <IconChoicePair
                  value={renderStyle.nameplateInside}
                  onChange={(value) => updateRenderStyle('nameplateInside', value)}
                  leftIcon={<Box className="h-4 w-4" />}
                  rightIcon={<Expand className="h-4 w-4" />}
                  leftLabel={nameplateToggleText.inside}
                  rightLabel={nameplateToggleText.outside}
                />
                <IconChoicePair
                  value={renderStyle.nameplateFollowCharacter}
                  onChange={(value) => updateRenderStyle('nameplateFollowCharacter', value)}
                  leftIcon={<Crosshair className="h-4 w-4" />}
                  rightIcon={<Pin className="h-4 w-4" />}
                  leftLabel={nameplateToggleText.follow}
                  rightLabel={nameplateToggleText.fixed}
                />
              </ControlRow>
              {renderStyle.nameplateInside && (
                <ControlRow className="mt-2">
                  <NumberField
                    icon={<MoveVertical className="h-4 w-4" />}
                    label={text.field.textGap}
                    description={showDescriptions ? text.help.textGap : undefined}
                    value={renderStyle.nameplateTextGap ?? 8}
                    min={-60}
                    max={80}
                    onChange={(value) => updateRenderStyle('nameplateTextGap', value)}
                  />
                  <div aria-hidden="true" />
                </ControlRow>
              )}
            </>
          )}
        </InspectorGroup>
      )}

      {showsGroup('text') && textObject && (
        <InspectorGroup
          title={text.group.text}
          icon={<Type className="h-3.5 w-3.5" />}
          tone="text"
          showDescriptions={showDescriptions}
          secondaryDescription={text.field.font}
          secondary={
            <HeaderSelect
              icon={<Type className="h-4 w-4" />}
              label={text.field.font}
              value={textObject.fontFamily}
              options={fonts}
              onChange={(value) => setObject({ fontFamily: value })}
            />
          }
        >
          <ControlRow>
            <NumberField
              icon={<CaseSensitive className="h-4 w-4" />}
              label={text.field.fontSize}
              description={showDescriptions ? text.help.fontSize : undefined}
              value={textObject.fontSize}
              min={8}
              max={160}
              onChange={(value) => setObject({ fontSize: value })}
            />
            <NumberField
              icon={<Baseline className="h-4 w-4" />}
              label={text.field.fontWeight}
              description={showDescriptions ? text.help.fontWeight : undefined}
              value={textObject.fontWeight}
              min={100}
              max={900}
              step={100}
              onChange={(value) => setObject({ fontWeight: value })}
            />
          </ControlRow>
          <ControlRow className="mt-2">
            <NumberField
              icon={<MoveHorizontal className="h-4 w-4" />}
              label={text.field.letterSpacing}
              description={showDescriptions ? text.help.letterSpacing : undefined}
              value={textObject.letterSpacing}
              min={-10}
              max={60}
              step={0.5}
              onChange={(value) => setObject({ letterSpacing: value })}
            />
            <NumberField
              icon={<MoveVertical className="h-4 w-4" />}
              label={text.field.lineHeight}
              description={showDescriptions ? text.help.lineHeight : undefined}
              value={textObject.lineHeight}
              min={0.6}
              max={3}
              step={0.05}
              onChange={(value) => setObject({ lineHeight: value })}
            />
          </ControlRow>
          <ControlRow className="mt-2">
            <AlignButtons
              value={textObject.textAlign}
              onChange={(value) => setObject({ textAlign: value, horizontalAlign: value })}
            />
            <div className="grid h-8 grid-cols-2 overflow-hidden rounded-md bg-white">
              <ToggleButton
                active={textObject.underline}
                label={text.field.underline}
                onClick={() => setObject({ underline: !textObject.underline })}
                activeIcon={<Underline className="h-4 w-4" />}
                inactiveIcon={<Underline className="h-4 w-4" />}
                iconOnly
              />
              <ToggleButton
                active={textObject.strikethrough}
                label={text.field.strikethrough}
                onClick={() => setObject({ strikethrough: !textObject.strikethrough })}
                activeIcon={<Strikethrough className="h-4 w-4" />}
                inactiveIcon={<Strikethrough className="h-4 w-4" />}
                iconOnly
              />
            </div>
          </ControlRow>
        </InspectorGroup>
      )}

      {showsGroup('fill') && (
        <AppearanceStackInspector
          language={language}
          value={objectAppearance(selected)}
          onChange={(appearance) => setObject({ appearance })}
        />
      )}

      {showsGroup('animation') && (selectedKind === 'title' || selectedKind === 'body') && (
        <div
          className={
            surface === 'video' ? 'pointer-events-none select-none opacity-40 grayscale' : undefined
          }
        >
          <InspectorGroup
            title={text.group.animation}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            tone="animation"
            showDescriptions={showDescriptions}
            secondaryHasDescription
            secondary={
              <SettingDescription show={showDescriptions} label={animationLabels.type}>
                <SelectField
                  label={text.group.animation}
                  value={selected.animation.animation}
                  options={[
                    { value: 'none', label: text.option.none },
                    { value: 'fade', label: text.option.fade },
                    { value: 'slideUp', label: text.option.slideUp },
                    { value: 'typewriter', label: text.option.typewriter },
                  ]}
                  onChange={(value) =>
                    setObject({
                      animation: { ...selected.animation, animation: value as TextAnimation },
                    })
                  }
                />
              </SettingDescription>
            }
          >
            <ControlRow>
              <NumberField
                icon={<RotateCw className="h-4 w-4" />}
                label={text.field.duration}
                description={showDescriptions ? text.field.duration : undefined}
                value={selected.animation.durationMs}
                min={0}
                max={10000}
                step={50}
                onChange={(durationMs) =>
                  setObject({ animation: { ...selected.animation, durationMs } })
                }
              />
              <SettingDescription show={showDescriptions} label={animationLabels.typewriter}>
                <SelectField
                  label={text.field.typewriter}
                  value={selected.animation.typewriterMode}
                  options={[
                    { value: 'character', label: text.option.character },
                    { value: 'sentence', label: text.option.sentence },
                    { value: 'line', label: text.option.line },
                  ]}
                  onChange={(value) =>
                    setObject({
                      animation: { ...selected.animation, typewriterMode: value as TypewriterMode },
                    })
                  }
                />
              </SettingDescription>
            </ControlRow>
          </InspectorGroup>
          {surface === 'video' && (
            <p className="mt-1 px-2 text-[10px] text-slate-500">
              {formatVideoText(
                language,
                'componentsrendervideoobjectInspectorRenderObjectInspectorConditionalText849',
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PositionVisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) return <Box className="h-3.5 w-3.5" />;
  return (
    <span className="relative inline-grid h-3.5 w-3.5 place-items-center" aria-hidden="true">
      <Box className="h-3.5 w-3.5" />
      <span className="absolute h-[1.5px] w-[18px] rotate-[-45deg] rounded-full bg-current" />
    </span>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className="relative grid h-8 min-w-0 grid-cols-[minmax(0,1fr)_18px] items-center rounded-md bg-white px-3 text-sm font-normal text-slate-900"
      title={label}
    >
      <span className="min-w-0 truncate">
        {options.find((option) => option.value === value)?.label || value}
      </span>
      <ChevronDown className="h-4 w-4" aria-hidden="true" />
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
  activeIcon,
  inactiveIcon,
  iconOnly = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  activeIcon?: React.ReactNode;
  inactiveIcon?: React.ReactNode;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 min-w-0 items-center justify-center gap-2 px-3 text-sm font-bold ${active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      {active ? activeIcon : inactiveIcon}
      {!iconOnly && <span className="min-w-0 truncate">{label}</span>}
    </button>
  );
}

function IconChoicePair({
  value,
  onChange,
  leftIcon,
  rightIcon,
  leftLabel,
  rightLabel,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  leftIcon: React.ReactNode;
  rightIcon: React.ReactNode;
  leftLabel: string;
  rightLabel: string;
}) {
  const optionClass = (active: boolean) =>
    `grid h-8 place-items-center transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
    }`;
  return (
    <div className="grid h-8 grid-cols-2 overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
      <button
        type="button"
        className={optionClass(value)}
        onClick={() => onChange(true)}
        title={leftLabel}
        aria-label={leftLabel}
        aria-pressed={value}
      >
        {leftIcon}
      </button>
      <button
        type="button"
        className={optionClass(!value)}
        onClick={() => onChange(false)}
        title={rightLabel}
        aria-label={rightLabel}
        aria-pressed={!value}
      >
        {rightIcon}
      </button>
    </div>
  );
}

function TwoOptionTabs({
  value,
  onChange,
  solidLabel,
  gradientLabel,
}: {
  value: 'solid' | 'gradient';
  onChange: (value: 'solid' | 'gradient') => void;
  solidLabel: string;
  gradientLabel: string;
}) {
  return (
    <div className="grid h-8 grid-cols-2 overflow-hidden rounded-md bg-white">
      {(
        [
          ['solid', solidLabel],
          ['gradient', gradientLabel],
        ] as const
      ).map(([option, label]) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`grid place-items-center text-xs font-bold ${value === option ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-indigo-50'}`}
        >
          <span title={label} aria-label={label}>
            {option === 'solid' ? (
              <Palette className="h-4 w-4" />
            ) : (
              <span
                className="block h-3.5 w-3.5 rounded-full border border-current/30"
                style={{ background: 'linear-gradient(135deg, currentColor 0%, transparent 100%)' }}
              />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

function ThreeOptionTabs({
  value,
  onChange,
}: {
  value: 'inside' | 'center' | 'outside';
  onChange: (value: 'inside' | 'center' | 'outside') => void;
}) {
  return (
    <div className="grid h-8 grid-cols-3 overflow-hidden rounded-md bg-white">
      {(['inside', 'center', 'outside'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`grid place-items-center text-[10px] font-bold ${value === option ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-indigo-50'}`}
          title={option}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="5" y="5" width="14" height="14" rx="2" opacity="0.35" />
            {option === 'inside' && <rect x="7" y="7" width="10" height="10" rx="2" />}
            {option === 'center' && (
              <rect x="5" y="5" width="14" height="14" rx="2" strokeDasharray="3 3" />
            )}
            {option === 'outside' && <rect x="3" y="3" width="18" height="18" rx="2" />}
          </svg>
        </button>
      ))}
    </div>
  );
}

function ShadowModeTabs({
  value,
  onChange,
  labels,
  outerOnly = false,
}: {
  value: 'outer' | 'inner' | 'innerBlur';
  onChange: (value: 'outer' | 'inner' | 'innerBlur') => void;
  labels: Record<'outer' | 'inner' | 'innerBlur', string>;
  outerOnly?: boolean;
}) {
  if (outerOnly) {
    return (
      <div
        className="grid h-8 min-w-16 place-items-center rounded-md bg-indigo-600 px-3 text-white"
        aria-label={labels.outer}
        title={labels.outer}
      >
        <ShadowModeIcon mode="outer" />
      </div>
    );
  }
  return (
    <div className="grid h-8 grid-cols-3 overflow-hidden rounded-md bg-white">
      {(['outer', 'inner', 'innerBlur'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`inline-grid place-items-center ${value === option ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-fuchsia-50'}`}
          aria-label={labels[option]}
          title={labels[option]}
        >
          <ShadowModeIcon mode={option} />
        </button>
      ))}
    </div>
  );
}

function DisabledNotice({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return (
    <div className="mb-2 rounded-lg bg-white/75 px-2 py-1 text-[11px] font-bold text-slate-500">
      {label}
    </div>
  );
}

function SettingDescription({
  show,
  label,
  className = '',
  children,
}: {
  show: boolean;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      {show && <div className="px-1 text-[10px] leading-4 text-slate-500">{label}</div>}
      {children}
    </div>
  );
}
