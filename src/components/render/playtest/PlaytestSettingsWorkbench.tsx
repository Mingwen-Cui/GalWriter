import { MonitorPlay, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import type { SharedCanvasSettings } from '../canvas/canvasSettings';
import { CanvasSettingsSection } from '../canvas/CanvasSettingsSection';
import { InspectorGroup } from '../shared/inspectors/InspectorControls';
import { RenderObjectSettingsSection } from '../shared/inspectors/RenderObjectSettingsSection';
import { renderObjectText } from '../video/objectInspector/i18n';
import type { RenderEditableObjectKind, RenderStyle } from '../video/shared/types';
import { getPlaytestText } from './i18n';
import {
  type PlaytestCanvasSelection,
  type PlaytestRuntimeSettings,
} from './model/playtestCanvasModel';

export type { PlaytestRuntimeSettings } from './model/playtestCanvasModel';

export type PlaytestSettingsWorkbenchProps = {
  language: Language;
  canvasSettings: SharedCanvasSettings;
  onCanvasSettingsChange: (patch: Partial<SharedCanvasSettings>) => void;
  runtimeSettings: PlaytestRuntimeSettings;
  onRuntimeSettingsChange: (patch: Partial<PlaytestRuntimeSettings>) => void;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  layout?: 'settings' | 'sidebar';
  windowedPlaytestRaised?: boolean;
  onToggleWindowedPlaytest?: () => void;
};

type WorkbenchSelection = PlaytestCanvasSelection;

export function PlaytestSettingsWorkbench({
  language,
  canvasSettings,
  onCanvasSettingsChange,
  runtimeSettings,
  onRuntimeSettingsChange,
  renderStyle,
  updateRenderStyle,
  layout = 'settings',
  windowedPlaytestRaised = false,
  onToggleWindowedPlaytest,
}: PlaytestSettingsWorkbenchProps) {
  const text = getPlaytestText(language);
  const objectText = renderObjectText(language);
  const [selection, setSelection] = useState<WorkbenchSelection>(
    canvasSettings.layoutMode === 'classic'
      ? 'scene'
      : renderStyle.selectedRenderObject || 'dialogBox',
  );
  const showParameterDescriptions = false;

  useEffect(() => {
    const selectedObject = renderStyle.selectedRenderObject;
    if (selectedObject && selection !== selectedObject) {
      setSelection(selectedObject);
    }
  }, [renderStyle.selectedRenderObject, selection]);

  useEffect(() => {
    if (
      canvasSettings.layoutMode !== 'classic' &&
      (selection === 'scene' || selection === 'background')
    ) {
      setSelection('dialogBox');
      updateRenderStyle('selectedRenderObject', 'dialogBox');
    }
  }, [canvasSettings.layoutMode, selection, updateRenderStyle]);

  const inspector = (
    <div className="video-render-workspace min-w-0 space-y-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-4 gap-2 rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
          {(['dialogBox', 'title', 'body', 'nameplate'] as RenderEditableObjectKind[]).map(
            (kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={selection === kind}
                data-render-selection={kind}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  setSelection(kind);
                  updateRenderStyle('selectedRenderObject', kind);
                }}
                className={`h-9 min-w-0 truncate rounded-lg px-2 text-left text-xs font-bold transition-colors ${
                  selection === kind
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/90 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10'
                }`}
              >
                {objectText.object[kind]}
              </button>
            ),
          )}
        </div>

        {onToggleWindowedPlaytest ? (
          <button
            type="button"
            onClick={onToggleWindowedPlaytest}
            aria-label={windowedPlaytestRaised ? text.dismissPreview : text.openPreview}
            title={windowedPlaytestRaised ? text.dismissPreview : text.openPreview}
            aria-pressed={windowedPlaytestRaised}
            className={`inline-grid h-8 w-8 place-items-center rounded-lg border shadow-sm transition-colors ${
              windowedPlaytestRaised
                ? 'border-indigo-500/20 bg-indigo-50 text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-300'
                : 'border-slate-200/80 bg-white/80 text-slate-500 hover:border-indigo-500/20 hover:bg-indigo-50 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/20 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-300'
            }`}
          >
            <MonitorPlay className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {layout === 'settings' ? (
        <div className="grid min-w-0 items-start gap-x-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-5">
            <CanvasSettingsSection
              language={language}
              value={canvasSettings}
              onChange={onCanvasSettingsChange}
              showDescriptions={showParameterDescriptions}
            />
            <RenderObjectSettingsSection
              language={language}
              renderStyle={renderStyle}
              updateRenderStyle={updateRenderStyle}
              surface="playtest"
              showDescriptions={showParameterDescriptions}
              canvasSettings={canvasSettings}
              onCanvasSettingsChange={onCanvasSettingsChange}
              selection={selection}
              onSelectionChange={setSelection}
              hideSelectionBar
              singleColumn
              visibleGroups={['position', 'text', 'animation']}
            />
          </div>

          <div className="min-w-0 space-y-5">
            <PlaytestRuntimeSettingsSection
              language={language}
              value={runtimeSettings}
              onChange={onRuntimeSettingsChange}
              choicesPosition={canvasSettings.choicesPosition}
              showDescriptions={showParameterDescriptions}
            />
            {selection !== 'scene' && selection !== 'background' ? (
              <RenderObjectSettingsSection
                language={language}
                renderStyle={renderStyle}
                updateRenderStyle={updateRenderStyle}
                surface="playtest"
                showDescriptions={showParameterDescriptions}
                canvasSettings={canvasSettings}
                onCanvasSettingsChange={onCanvasSettingsChange}
                selection={selection}
                onSelectionChange={setSelection}
                hideSelectionBar
                singleColumn
                visibleGroups={['fill', 'stroke', 'shadow']}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-y-5">
          <CanvasSettingsSection
            language={language}
            value={canvasSettings}
            onChange={onCanvasSettingsChange}
            showDescriptions={showParameterDescriptions}
          />
          <PlaytestRuntimeSettingsSection
            language={language}
            value={runtimeSettings}
            onChange={onRuntimeSettingsChange}
            choicesPosition={canvasSettings.choicesPosition}
            showDescriptions={showParameterDescriptions}
          />
          <RenderObjectSettingsSection
            language={language}
            renderStyle={renderStyle}
            updateRenderStyle={updateRenderStyle}
            surface="playtest"
            showDescriptions={showParameterDescriptions}
            canvasSettings={canvasSettings}
            onCanvasSettingsChange={onCanvasSettingsChange}
            selection={selection}
            onSelectionChange={setSelection}
            hideSelectionBar
            singleColumn
          />
        </div>
      )}
    </div>
  );

  return inspector;
}

function PlaytestRuntimeSettingsSection({
  language,
  value,
  onChange,
  choicesPosition,
  showDescriptions,
}: {
  language: Language;
  value: PlaytestRuntimeSettings;
  onChange: (patch: Partial<PlaytestRuntimeSettings>) => void;
  choicesPosition: SharedCanvasSettings['choicesPosition'];
  showDescriptions: boolean;
}) {
  const text = getPlaytestText(language);
  return (
    <InspectorGroup
      title={text.runtimeSettings}
      icon={<Play className="h-3.5 w-3.5" />}
      tone="extra"
      secondary={null}
      showDescriptions={showDescriptions}
    >
      <div className="property-control-row">
        <RuntimeField label={text.textPlayback}>
          <Segmented
            value={value.interactionMode}
            options={[
              ['immediate', text.immediate],
              ['typewriter', text.typewriter],
            ]}
            onChange={(interactionMode) =>
              onChange({
                interactionMode: interactionMode as PlaytestRuntimeSettings['interactionMode'],
              })
            }
          />
        </RuntimeField>
        <RuntimeNumber
          label={text.typewriterSpeed}
          value={value.typewriterSpeed}
          unit="ms"
          min={0}
          max={500}
          onChange={(typewriterSpeed) => onChange({ typewriterSpeed })}
        />
      </div>
      <div className="property-control-row mt-3">
        <RuntimeField label={text.choiceColumns} disabled={choicesPosition === 'center'}>
          <Segmented
            value={String(value.choicesColumns)}
            options={[
              ['1', '1'],
              ['2', '2'],
              ['3', '3'],
            ]}
            onChange={(choicesColumns) => onChange({ choicesColumns: Number(choicesColumns) })}
          />
        </RuntimeField>
        <RuntimeField label={text.blurBackground}>
          <Segmented
            value={value.blurBackground ? 'on' : 'off'}
            options={[
              ['on', text.on],
              ['off', text.off],
            ]}
            onChange={(next) => onChange({ blurBackground: next === 'on' })}
          />
        </RuntimeField>
      </div>
      <div className="property-control-row mt-3">
        <RuntimeField label={text.blurText} disabled={!value.blurBackground}>
          <Segmented
            value={value.blurText ? 'on' : 'off'}
            options={[
              ['on', text.on],
              ['off', text.off],
            ]}
            onChange={(next) => onChange({ blurText: next === 'on' })}
          />
        </RuntimeField>
        <RuntimeNumber
          label={text.choiceDelay}
          value={value.choiceDelay}
          unit="s"
          min={0}
          max={60}
          onChange={(choiceDelay) => onChange({ choiceDelay })}
        />
      </div>
      <div className="property-control-row mt-3">
        <RuntimeNumber
          label={text.autoAdvanceDelay}
          value={value.autoAdvanceDelay}
          unit="s"
          min={0}
          max={60}
          onChange={(autoAdvanceDelay) => onChange({ autoAdvanceDelay })}
        />
      </div>
    </InspectorGroup>
  );
}

function RuntimeField({
  label,
  disabled = false,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`min-w-0 space-y-1 ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
      <span className="playtest-runtime-description block truncate px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function RuntimeNumber({
  label,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <RuntimeField label={label}>
      <span className="grid h-10 grid-cols-[minmax(0,1fr)_40px] items-center overflow-hidden rounded-xl bg-[var(--vr-surface-soft)]">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(event) =>
            onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))
          }
          className="h-full min-w-0 bg-transparent px-3 text-sm font-bold tabular-nums text-[var(--vr-text)] outline-none"
        />
        <span className="text-xs font-medium text-[var(--vr-text-muted)]">{unit}</span>
      </span>
    </RuntimeField>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <span
      className="grid h-10 overflow-hidden rounded-xl bg-[var(--vr-surface-soft)]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          className={`min-w-0 truncate px-2 text-xs font-bold transition-colors ${
            value === optionValue
              ? 'bg-[var(--vr-accent)] text-white'
              : 'text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)]'
          }`}
        >
          {label}
        </button>
      ))}
    </span>
  );
}
