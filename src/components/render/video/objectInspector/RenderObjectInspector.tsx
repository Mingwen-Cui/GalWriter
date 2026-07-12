import {
  Baseline,
  Blend,
  Box,
  CaseSensitive,
  ChevronDown,
  Minus,
  MoveHorizontal,
  MoveVertical,
  PaintBucket,
  Palette,
  Radius,
  RotateCw,
  Ruler,
  Sparkles,
  Strikethrough,
  Type,
  Underline,
  Plus,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import {
  AlignButtons,
  ControlRow,
  FillTabs,
  FloatingPopover,
  HeaderAction,
  HeaderSelect,
  InspectorGroup,
  NumberField,
  PositionAlignButtons,
  VisibilityButton,
} from '../../web/webStyleInspectorControls';
import { InlineColorControl, InlineGradientControl } from '../../web/StartMenuElementInspector';
import { getRenderObjects, isTextRenderObject, updateRenderObject } from '../shared/renderObjects';
import type {
  RenderEditableObject,
  RenderEditableObjectKind,
  RenderEditableTextObject,
  RenderFillStyle,
  RenderStyle,
  TextAnimation,
  TypewriterMode,
} from '../shared/types';
import { GradientPopover, ImageFillPopover, SolidColorPopover } from './ColorPopovers';
import { renderObjectText } from './i18n';

type Surface = 'video' | 'web' | 'playtest';
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
}: {
  language: Language;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  surface?: Surface;
  showDescriptions?: boolean;
  hideObjectSelector?: boolean;
}) {
  const text = renderObjectText(language);
  const objects = getRenderObjects(renderStyle);
  const selectedKind = renderStyle.selectedRenderObject || 'dialogBox';
  const selected = objects[selectedKind];
  const textObject = isTextRenderObject(selectedKind)
    ? (selected as RenderEditableTextObject)
    : null;
  const [popover, setPopover] = useState<Popover>(null);

  const setSelectedKind = (kind: RenderEditableObjectKind) => {
    updateRenderStyle('selectedRenderObject', kind);
  };

  const setObject = (updates: Partial<RenderEditableObject | RenderEditableTextObject>) => {
    const nextObjects = updateRenderObject(renderStyle, selectedKind, updates);
    updateRenderStyle('renderObjects', nextObjects);
    const geometryKeys = ['x', 'y', 'width', 'height'] as const;
    const isGeometryUpdate = geometryKeys.some((key) => key in updates);
    if (surface === 'video' || !isGeometryUpdate) {
      syncLegacyFields(selectedKind, nextObjects[selectedKind], updateRenderStyle);
    }
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

  const advancedVideoDisabled = surface === 'video';

  return (
    <div className="space-y-3 text-[12px] text-slate-900">
      {!hideObjectSelector && <div className="grid grid-cols-2 gap-2">
        {objectKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setSelectedKind(kind)}
            className={`h-9 rounded-lg px-2 text-left font-bold transition-colors ${
              selectedKind === kind
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {text.object[kind]}
          </button>
        ))}
      </div>}

      <InspectorGroup
        title={text.group.position}
        icon={<Box className="h-3.5 w-3.5" />}
        tone="position"
        secondary={
          <VisibilityButton
            visible={selected.visible}
            label={text.field.visible}
            onClick={() => setObject({ visible: !selected.visible })}
          />
        }
      >
        <HelpText show={showDescriptions} text={text.help.visible} />
        <ControlRow>
          <NumberField
            icon={<MoveHorizontal className="h-4 w-4" />}
            label={text.field.x}
            description={showDescriptions ? text.help.x : undefined}
            value={selected.x}
            min={-200}
            max={200}
            onChange={(value) => setObject({ x: value })}
          />
          <NumberField
            icon={<MoveVertical className="h-4 w-4" />}
            label={text.field.y}
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
            label={text.field.width}
            description={showDescriptions ? text.help.width : undefined}
            value={selected.width}
            min={0}
            max={200}
            onChange={(value) => setObject({ width: value })}
          />
          <NumberField
            icon={<Box className="h-4 w-4" />}
            label={text.field.height}
            description={showDescriptions ? text.help.height : undefined}
            value={selected.height}
            min={0}
            max={200}
            onChange={(value) => setObject({ height: value })}
          />
        </ControlRow>
        <ControlRow className="mt-2">
          <NumberField
            icon={<RotateCw className="h-4 w-4" />}
            label={text.field.rotation}
            description={showDescriptions ? text.help.rotation : undefined}
            value={selected.rotation}
            min={-180}
            max={180}
            onChange={(value) => setObject({ rotation: value })}
          />
          <NumberField
            icon={<Radius className="h-4 w-4" />}
            label={text.field.radius}
            description={showDescriptions ? text.help.radius : undefined}
            value={selected.radius}
            min={0}
            max={200}
            onChange={(value) => setObject({ radius: value })}
          />
        </ControlRow>
        <ControlRow className="mt-2">
          <ToggleButton
            active={selected.flipX}
            label={text.field.flipX}
            onClick={() => setObject({ flipX: !selected.flipX })}
            activeIcon={<MoveHorizontal className="h-4 w-4" />}
            inactiveIcon={<MoveHorizontal className="h-4 w-4" />}
          />
          <ToggleButton
            active={selected.flipY}
            label={text.field.flipY}
            onClick={() => setObject({ flipY: !selected.flipY })}
            activeIcon={<MoveVertical className="h-4 w-4" />}
            inactiveIcon={<MoveVertical className="h-4 w-4" />}
          />
        </ControlRow>
        <PositionAlignButtons
          className="mt-2"
          onAlign={(axis, value) => {
            if (axis === 'x') {
              setObject({
                x:
                  value === 'start'
                    ? 0
                    : value === 'center'
                      ? (100 - selected.width) / 2
                      : 100 - selected.width,
              });
            } else {
              setObject({
                y:
                  value === 'start'
                    ? 0
                    : value === 'center'
                      ? (100 - selected.height) / 2
                      : 100 - selected.height,
              });
            }
          }}
        />
      </InspectorGroup>

      {textObject && (
        <InspectorGroup
          title={text.group.text}
          icon={<Type className="h-3.5 w-3.5" />}
          tone="text"
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
          <HelpText show={showDescriptions} text={text.help.font} />
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
            <div className="grid h-10 grid-cols-2 overflow-hidden rounded-xl bg-white">
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

      <InspectorGroup
        title={text.group.fill}
        icon={<PaintBucket className="h-3.5 w-3.5" />}
        tone="fill"
        onTitleClick={() => setFill({ enabled: !selected.fill.enabled })}
        titleActive={selected.fill.enabled}
        secondary={
          <FillTabs
            value={selected.fill.type}
            labels={text.option}
            onChange={(type) => {
              setFill({ type });
              setPopover({ group: 'fill', type });
            }}
          />
        }
      >
        <HelpText show={showDescriptions} text={text.help.fill} />
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_44px] gap-3">
          {selected.fill.type === 'solid' ? (
            <InlineColorControl
              label={text.popover.solidTitle}
              color={selected.fill.color}
              alpha={selected.fill.alpha}
              alphaLabel={text.field.opacity}
              hexLabel={text.popover.hex}
              onColorChange={(color) => setFill({ color })}
              onAlphaChange={(alpha) => setFill({ alpha })}
              onOpen={() => setPopover({ group: 'fill', type: 'solid' })}
            />
          ) : selected.fill.type === 'gradient' ? (
            <InlineGradientControl
              label={text.popover.gradientTitle}
              stops={selected.fill.gradientStops}
              onOpen={() => setPopover({ group: 'fill', type: 'gradient' })}
              onAlphaChange={(alpha) =>
                setFill({ gradientStops: selected.fill.gradientStops.map((stop) => ({ ...stop, alpha })) })
              }
            />
          ) : (
            <button type="button" onClick={() => setPopover({ group: 'fill', type: 'image' })} className="grid h-10 min-w-0 grid-cols-[56px_minmax(0,1fr)] overflow-hidden rounded-xl bg-white text-left text-sm font-medium text-slate-950" title={text.popover.imageTitle}>
              <span className="h-full bg-slate-100 bg-cover bg-center" style={selected.fill.imageUrl ? { backgroundImage: `url("${selected.fill.imageUrl.replace(/"/g, '\\"')}")` } : undefined} />
              <span className="min-w-0 truncate px-3 leading-10">{text.popover.imageTitle}</span>
            </button>
          )}
          <div className="h-10 w-11" aria-hidden="true" />
        </div>
        {popover?.group === 'fill' && selected.fill.type === 'solid' && (
          <FloatingPopover>
            <SolidColorPopover
              tone="fill"
              text={text.popover}
              color={selected.fill.color}
              alpha={selected.fill.alpha}
              onColorChange={(color) => setFill({ color })}
              onAlphaChange={(alpha) => setFill({ alpha })}
            />
          </FloatingPopover>
        )}
        {popover?.group === 'fill' && selected.fill.type === 'gradient' && (
          <FloatingPopover>
            <GradientPopover
              tone="fill"
              text={text.popover}
              angle={selected.fill.gradientAngle}
              stops={selected.fill.gradientStops}
              onAngleChange={(gradientAngle) => setFill({ gradientAngle })}
              onStopsChange={(gradientStops) => setFill({ gradientStops })}
            />
          </FloatingPopover>
        )}
        {popover?.group === 'fill' && selected.fill.type === 'image' && (
          <FloatingPopover>
            <ImageFillPopover
              tone="fill"
              text={text.popover}
              value={selected.fill}
              onChange={setFill}
            />
          </FloatingPopover>
        )}
      </InspectorGroup>

      <InspectorGroup
        title={text.group.stroke}
        icon={<Minus className="h-3.5 w-3.5" />}
        tone="stroke"
        onTitleClick={() =>
          setObject({ stroke: { ...selected.stroke, enabled: !selected.stroke.enabled } })
        }
        titleActive={selected.stroke.enabled}
        secondary={
          <HeaderAction
            icon={<Palette className="h-4 w-4" />}
            label={text.field.color}
            onClick={() =>
              setPopover(popover?.group === 'stroke' ? null : { group: 'stroke', type: 'solid' })
            }
          />
        }
      >
        <DisabledNotice show={advancedVideoDisabled} label={text.disabled.videoOnly} />
        <div className={advancedVideoDisabled ? 'pointer-events-none opacity-45' : ''}>
          <HelpText show={showDescriptions} text={text.help.stroke} />
          <ControlRow>
            <NumberField
              icon={<Ruler className="h-4 w-4" />}
              label={text.field.strokeWidth}
              description={showDescriptions ? text.help.strokeWidth : undefined}
              value={selected.stroke.width}
              min={0}
              max={40}
              onChange={(width) => setObject({ stroke: { ...selected.stroke, width } })}
            />
            <button
              type="button"
              onClick={() =>
                setPopover(popover?.group === 'stroke' ? null : { group: 'stroke', type: 'solid' })
              }
              className="flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-bold"
            >
              <Palette className="h-4 w-4" />
              {text.field.color}
            </button>
          </ControlRow>
          <ControlRow className="mt-2">
            <TwoOptionTabs
              value={selected.stroke.type === 'gradient' ? 'gradient' : 'solid'}
              onChange={(type) => {
                setObject({ stroke: { ...selected.stroke, type } });
                setPopover({ group: 'stroke', type });
              }}
              solidLabel={text.option.solid}
              gradientLabel={text.option.gradient}
            />
            <ThreeOptionTabs
              value={selected.stroke.position}
              onChange={(position) => setObject({ stroke: { ...selected.stroke, position } })}
            />
          </ControlRow>
          <HelpText show={showDescriptions} text={`${text.help.strokeType} ${text.help.strokePosition}`} />
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_44px] gap-3">
            {selected.stroke.type === 'gradient' ? (
              <InlineGradientControl
                label={text.popover.gradientTitle}
                stops={selected.stroke.gradientStops}
                onOpen={() => setPopover({ group: 'stroke', type: 'gradient' })}
                onAlphaChange={(alpha) =>
                  setObject({ stroke: { ...selected.stroke, gradientStops: selected.stroke.gradientStops.map((stop) => ({ ...stop, alpha })) } })
                }
              />
            ) : (
              <InlineColorControl
                label={text.field.color}
                color={selected.stroke.color}
                alpha={selected.stroke.alpha}
                alphaLabel={text.field.opacity}
                hexLabel={text.popover.hex}
                onColorChange={(color) => setObject({ stroke: { ...selected.stroke, color } })}
                onAlphaChange={(alpha) => setObject({ stroke: { ...selected.stroke, alpha } })}
                onOpen={() => setPopover({ group: 'stroke', type: 'solid' })}
              />
            )}
            <div className="h-10 w-11" aria-hidden="true" />
          </div>
          {popover?.group === 'stroke' && (
            <FloatingPopover>
              {selected.stroke.type === 'gradient' ? (
                <GradientPopover
                  tone="stroke"
                  text={text.popover}
                  angle={selected.stroke.gradientAngle}
                  stops={selected.stroke.gradientStops}
                  onAngleChange={(gradientAngle) =>
                    setObject({ stroke: { ...selected.stroke, gradientAngle } })
                  }
                  onStopsChange={(gradientStops) =>
                    setObject({ stroke: { ...selected.stroke, gradientStops } })
                  }
                />
              ) : (
                <SolidColorPopover
                  tone="stroke"
                  text={text.popover}
                  color={selected.stroke.color}
                  alpha={selected.stroke.alpha}
                  onColorChange={(color) => setObject({ stroke: { ...selected.stroke, color } })}
                  onAlphaChange={(alpha) => setObject({ stroke: { ...selected.stroke, alpha } })}
                />
              )}
            </FloatingPopover>
          )}
        </div>
      </InspectorGroup>

      {shadowLayers.map((shadow, index) => (
        <InspectorGroup
          key={`${selectedKind}-shadow-${index}`}
          title={index === 0 ? text.group.shadow : `${text.group.shadow} ${index + 1}`}
          icon={<Palette className="h-3.5 w-3.5" />}
          tone="shadow"
          onTitleClick={index === 0 ? toggleShadow : undefined}
          titleActive={shadow.enabled}
          secondary={<ShadowModeTabs value={shadow.type} onChange={(type) => setShadowLayer(index, { type })} />}
        >
          <DisabledNotice show={advancedVideoDisabled} label={text.disabled.videoOnly} />
          <div className={advancedVideoDisabled ? 'pointer-events-none opacity-45' : ''}>
            <HelpText show={showDescriptions} text={index === 0 ? text.help.shadow : `${text.help.shadow} ${text.help.removeShadow}`} />
            <HelpText show={showDescriptions} text={text.help.shadowType} />
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
              <NumberField icon={<Blend className="h-4 w-4" />} label={text.field.opacity} description={showDescriptions ? text.help.shadowOpacity : undefined} value={shadow.alpha} min={0} max={100} onChange={(alpha) => setShadowLayer(index, { alpha })} />
              <NumberField icon={<Blend className="h-4 w-4" />} label={text.field.blur} description={showDescriptions ? text.help.shadowBlur : undefined} value={shadow.blur} min={0} max={120} onChange={(blur) => setShadowLayer(index, { blur })} />
              <button type="button" onClick={addShadowLayer} disabled={shadowLayers.length >= 6} className="grid h-10 w-11 place-items-center rounded-xl bg-white text-slate-700 hover:bg-fuchsia-100 disabled:opacity-35" title={text.help.addShadow} aria-label={text.help.addShadow}><Plus className="h-5 w-5" /></button>
            </div>
            <ControlRow className="mt-2">
              <NumberField icon={<MoveHorizontal className="h-4 w-4" />} label={text.field.x} description={showDescriptions ? text.help.shadowX : undefined} value={shadow.x} min={-120} max={120} onChange={(x) => setShadowLayer(index, { x })} />
              <NumberField icon={<MoveVertical className="h-4 w-4" />} label={text.field.y} description={showDescriptions ? text.help.shadowY : undefined} value={shadow.y} min={-120} max={120} onChange={(y) => setShadowLayer(index, { y })} />
            </ControlRow>
            <ControlRow className="mt-2">
              <InlineColorControl
                label={text.field.color}
                color={shadow.color}
                alpha={shadow.alpha}
                alphaLabel={text.field.opacity}
                hexLabel={text.popover.hex}
                onColorChange={(color) => setShadowLayer(index, { color })}
                onAlphaChange={(alpha) => setShadowLayer(index, { alpha })}
                onOpen={() => setPopover({ group: 'shadow', type: 'solid' })}
              />
              {index > 0 ? <button type="button" onClick={() => removeShadowLayer(index)} className="grid h-10 w-11 place-items-center rounded-xl bg-white text-rose-600 hover:bg-rose-50" title="Remove shadow" aria-label="Remove shadow"><Minus className="h-5 w-5" /></button> : <div />}
            </ControlRow>
            {popover?.group === 'shadow' && index === 0 && (
              <FloatingPopover><SolidColorPopover tone="shadow" text={text.popover} color={shadow.color} alpha={shadow.alpha} onColorChange={(color) => setShadowLayer(index, { color })} onAlphaChange={(alpha) => setShadowLayer(index, { alpha })} /></FloatingPopover>
            )}
          </div>
        </InspectorGroup>
      ))}

      <InspectorGroup
        title={text.group.animation}
        icon={<Sparkles className="h-3.5 w-3.5" />}
        tone="animation"
        secondary={
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
              setObject({ animation: { ...selected.animation, animation: value as TextAnimation } })
            }
          />
        }
      >
        <HelpText show={showDescriptions} text={text.help.duration} />
        <ControlRow>
          <NumberField
            icon={<RotateCw className="h-4 w-4" />}
            label={text.field.duration}
            description={showDescriptions ? text.help.duration : undefined}
            value={selected.animation.durationMs}
            min={0}
            max={10000}
            step={50}
            onChange={(durationMs) =>
              setObject({ animation: { ...selected.animation, durationMs } })
            }
          />
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
        </ControlRow>
      </InspectorGroup>

      {selectedKind === 'nameplate' && (
        <InspectorGroup
          title={text.group.extra}
          icon={<RotateCw className="h-3.5 w-3.5" />}
          tone="extra"
          secondary={
            <ToggleButton
              active={renderStyle.nameplateInside}
              label={text.field.insideDialog}
              onClick={() => updateRenderStyle('nameplateInside', !renderStyle.nameplateInside)}
              activeIcon={<Box className="h-4 w-4" />}
              inactiveIcon={<Box className="h-4 w-4" />}
            />
          }
        >
          <HelpText show={showDescriptions} text={`${text.help.insideDialog} ${text.help.followCharacter}`} />
          <ControlRow>
            <ToggleButton
              active={renderStyle.nameplateFollowCharacter}
              label={text.field.followCharacter}
              onClick={() =>
                updateRenderStyle('nameplateFollowCharacter', !renderStyle.nameplateFollowCharacter)
              }
              activeIcon={<MoveHorizontal className="h-4 w-4" />}
              inactiveIcon={<MoveHorizontal className="h-4 w-4" />}
            />
            <NumberField
              icon={<MoveVertical className="h-4 w-4" />}
              label={text.field.textGap}
              description={showDescriptions ? text.help.textGap : undefined}
              value={renderStyle.nameplateTextGap ?? 8}
              min={-60}
              max={80}
              onChange={(value) => updateRenderStyle('nameplateTextGap', value)}
            />
          </ControlRow>
        </InspectorGroup>
      )}
    </div>
  );
}

function syncLegacyFields(
  kind: RenderEditableObjectKind,
  object: RenderEditableObject | RenderEditableTextObject,
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void,
) {
  if (kind === 'dialogBox') {
    updateRenderStyle('dialogVisible', object.visible);
    updateRenderStyle('dialogOffsetX', object.x);
    updateRenderStyle('dialogOffsetY', object.y);
    updateRenderStyle('dialogWidth', object.width);
    updateRenderStyle('dialogHeight', object.height);
    updateRenderStyle('dialogRadius', object.radius);
    updateRenderStyle('dialogBackgroundType', object.fill.type);
    updateRenderStyle('panelColor', object.fill.color);
    updateRenderStyle('panelColorAlpha', object.fill.alpha);
    updateRenderStyle('dialogGradientAngle', object.fill.gradientAngle);
    updateRenderStyle('dialogGradientStops', object.fill.gradientStops);
    updateRenderStyle('dialogImageUrl', object.fill.imageUrl);
  }
  if (kind === 'title' || kind === 'body') {
    const textObject = object as RenderEditableTextObject;
    const prefix = kind;
    if (kind === 'title') updateRenderStyle('titleVisible', textObject.visible);
    updateRenderStyle(`${prefix}FontFamily` as keyof RenderStyle, textObject.fontFamily as never);
    updateRenderStyle(`${prefix}FontSize` as keyof RenderStyle, textObject.fontSize as never);
    updateRenderStyle(`${prefix}Color` as keyof RenderStyle, textObject.fill.color as never);
    updateRenderStyle(`${prefix}ColorAlpha` as keyof RenderStyle, textObject.fill.alpha as never);
    updateRenderStyle(
      `${prefix}StrokeColor` as keyof RenderStyle,
      textObject.stroke.color as never,
    );
    updateRenderStyle(
      `${prefix}StrokeWidth` as keyof RenderStyle,
      textObject.stroke.width as never,
    );
    updateRenderStyle(`${prefix}Align` as keyof RenderStyle, textObject.textAlign as never);
    updateRenderStyle(
      `${prefix}LetterSpacing` as keyof RenderStyle,
      textObject.letterSpacing as never,
    );
    updateRenderStyle(`${prefix}LineHeight` as keyof RenderStyle, textObject.lineHeight as never);
    updateRenderStyle(
      `${prefix}Animation` as keyof RenderStyle,
      textObject.animation.animation as never,
    );
    updateRenderStyle(
      `${prefix}TypewriterMode` as keyof RenderStyle,
      textObject.animation.typewriterMode as never,
    );
  }
  if (kind === 'nameplate') {
    const textObject = object as RenderEditableTextObject;
    updateRenderStyle('nameplateVisible', textObject.visible);
    updateRenderStyle('nameplateOffsetX', textObject.x);
    updateRenderStyle('nameplateOffsetY', textObject.y);
    updateRenderStyle('nameplateScale', textObject.width);
    updateRenderStyle('nameplateRadius', textObject.radius);
    updateRenderStyle('nameplateFontFamily', textObject.fontFamily);
    updateRenderStyle('nameplateFontSize', textObject.fontSize);
    updateRenderStyle('nameplateTextColor', textObject.fill.color);
    updateRenderStyle('nameplateTextColorAlpha', textObject.fill.alpha);
    updateRenderStyle('nameplateBackgroundType', textObject.fill.type);
    updateRenderStyle('nameplateColor', textObject.fill.color);
    updateRenderStyle('nameplateColorAlpha', textObject.fill.alpha);
    updateRenderStyle('nameplateGradientAngle', textObject.fill.gradientAngle);
    updateRenderStyle('nameplateGradientStops', textObject.fill.gradientStops);
    updateRenderStyle('nameplateImageUrl', textObject.fill.imageUrl);
  }
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
      className="relative grid h-10 min-w-0 grid-cols-[minmax(0,1fr)_18px] items-center rounded-xl bg-white px-3 text-sm font-normal text-slate-900"
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
      className={`flex h-10 min-w-0 items-center justify-center gap-2 px-3 text-sm font-bold ${active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      {active ? activeIcon : inactiveIcon}
      {!iconOnly && <span className="min-w-0 truncate">{label}</span>}
    </button>
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
    <div className="grid h-10 grid-cols-2 overflow-hidden rounded-xl bg-white">
      {([
        ['solid', solidLabel],
        ['gradient', gradientLabel],
      ] as const).map(([option, label]) => (
        <button key={option} type="button" onClick={() => onChange(option)} className={`grid place-items-center text-xs font-bold ${value === option ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-indigo-50'}`}>
          <span title={label} aria-label={label}>
            {option === 'solid' ? <Palette className="h-4 w-4" /> : <span className="block h-3.5 w-3.5 rounded-full border border-current/30" style={{ background: 'linear-gradient(135deg, currentColor 0%, transparent 100%)' }} />}
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
    <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
      {(['inside', 'center', 'outside'] as const).map((option) => (
        <button key={option} type="button" onClick={() => onChange(option)} className={`grid place-items-center text-[10px] font-bold ${value === option ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-indigo-50'}`} title={option}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" aria-hidden="true">
            <rect x="5" y="5" width="14" height="14" rx="2" opacity="0.35" />
            {option === 'inside' && <rect x="7" y="7" width="10" height="10" rx="2" />}
            {option === 'center' && <rect x="5" y="5" width="14" height="14" rx="2" strokeDasharray="3 3" />}
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
}: {
  value: 'outer' | 'inner' | 'innerBlur';
  onChange: (value: 'outer' | 'inner' | 'innerBlur') => void;
}) {
  return (
    <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
      {(['outer', 'inner', 'innerBlur'] as const).map((option) => (
        <button key={option} type="button" onClick={() => onChange(option)} className={`text-[10px] font-bold ${value === option ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-fuchsia-50'}`} title={option}>
          {option === 'outer' ? '外' : option === 'inner' ? '内' : '柔内'}
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

function HelpText({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return <p className="mb-2 px-1 text-[10px] leading-4 text-slate-500">{text}</p>;
}
