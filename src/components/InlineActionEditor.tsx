import { ClipboardPaste, Copy, Eraser, List, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { InlinePresentationAction, InlinePresentationActionType } from '../domain/project';
import { inlinePresentationActionLabel } from '../lib/presentation';
import { DraggableNumberInput } from './DraggableNumberInput';
import { DurationInput } from './DurationInput';

const ACTIONS: InlinePresentationActionType[] = [
  'none',
  'shake-x',
  'shake-y',
  'translate',
  'scale',
  'pulse',
  'rotate',
  'opacity',
  'brightness',
];

type InlineActionTemplate = {
  id: string;
  name: string;
  action: InlinePresentationAction;
};

const templateStorageKey = (kind: 'character' | 'scene') =>
  `galwriter-inline-${kind}-action-templates`;

const readTemplates = (kind: 'character' | 'scene') => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(templateStorageKey(kind));
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? (parsed as InlineActionTemplate[]) : [];
  } catch (error) {
    console.error('Failed to parse inline action templates:', error);
    return [];
  }
};

const normalizeActionType = (type: InlinePresentationActionType) =>
  type === 'translate-x' || type === 'translate-y' ? 'translate' : type;

let inlineActionClipboard: InlinePresentationAction | null = null;

export function InlineActionEditor({
  action,
  targetName,
  targetKind,
  onChange,
  onDelete,
  onReset,
  onPreviewBefore,
  onPreviewAfter,
  autoPreview,
  onAutoPreviewChange,
}: {
  action: InlinePresentationAction;
  targetName: string;
  targetKind: 'character' | 'scene';
  onChange: (action: InlinePresentationAction) => void;
  onDelete?: () => void;
  onReset?: () => void;
  onPreviewBefore?: (action: InlinePresentationAction) => void;
  onPreviewAfter?: (action: InlinePresentationAction) => void;
  autoPreview?: boolean;
  onAutoPreviewChange?: (value: boolean) => void;
}) {
  const [templates, setTemplates] = useState<InlineActionTemplate[]>(() =>
    readTemplates(targetKind),
  );
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    setTemplates(readTemplates(targetKind));
    setShowTemplates(false);
  }, [targetKind]);

  const saveTemplates = (nextTemplates: InlineActionTemplate[]) => {
    setTemplates(nextTemplates);
    localStorage.setItem(templateStorageKey(targetKind), JSON.stringify(nextTemplates));
  };

  const update = (updates: Partial<InlinePresentationAction>) => {
    const next = { ...action, ...updates };
    onChange(next);
    if (autoPreview) onPreviewAfter?.(next);
  };
  const currentAction = normalizeActionType(action.action);
  const isNone = currentAction === 'none';
  const isTranslate = currentAction === 'translate';
  const isScale = action.action === 'scale';
  const isRepeatable = currentAction === 'shake-x' || currentAction === 'shake-y' || currentAction === 'pulse';
  const isPercentSlider = currentAction === 'opacity' || currentAction === 'brightness';
  const showsStrength = !isNone && !isScale && !isPercentSlider;
  const strengthLabel = currentAction === 'rotate' ? '角度' : '强度';

  const changeActionType = (type: InlinePresentationActionType) => {
    const nextType = normalizeActionType(type);
    update({
      action: nextType,
      duration: nextType === 'none' ? 0 : action.duration || 420,
      strength:
        nextType === 'rotate'
          ? action.strength || 15
          : nextType === 'opacity'
            ? action.strength || 45
            : nextType === 'brightness'
              ? action.strength || 70
              : action.strength || 10,
      repeats: nextType === 'shake-x' || nextType === 'shake-y' || nextType === 'pulse' ? action.repeats || 3 : action.repeats || 1,
    });
  };

  const createTemplate = () => {
    const nextTemplate: InlineActionTemplate = {
      id: crypto.randomUUID(),
      name: `${targetName || inlinePresentationActionLabel(currentAction)}-模板-${templates.length + 1}`,
      action: { ...action, action: currentAction },
    };
    saveTemplates([...templates, nextTemplate]);
    setShowTemplates(true);
  };

  const applyTemplate = (template: InlineActionTemplate) => {
    const nextAction = {
      ...template.action,
      id: action.id,
      kind: action.kind,
      sourceNodeId: action.sourceNodeId,
      name: action.name,
    };
    onChange(nextAction);
    if (autoPreview) onPreviewAfter?.(nextAction);
  };

  const renameTemplate = (id: string, name: string) => {
    saveTemplates(templates.map((template) => (template.id === id ? { ...template, name } : template)));
  };

  const deleteTemplate = (id: string) => {
    saveTemplates(templates.filter((template) => template.id !== id));
  };

  const copyAction = () => {
    inlineActionClipboard = { ...action, action: currentAction };
  };

  const pasteAction = () => {
    if (!inlineActionClipboard) return;
    const nextAction = {
      ...inlineActionClipboard,
      id: action.id,
      kind: action.kind,
      sourceNodeId: action.sourceNodeId,
      name: action.name,
    };
    onChange(nextAction);
    if (autoPreview) onPreviewAfter?.(nextAction);
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase text-[var(--text-muted)]">
          <span>
            {targetKind === 'character' ? '人物动作' : '场景动作'}：{targetName}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="rounded-md p-1 text-amber-600 transition-colors hover:bg-amber-500/10 hover:text-amber-700"
                title="清零动作设置"
              >
                <Eraser className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-1 text-rose-500 transition-colors hover:bg-rose-500/10 hover:text-rose-600"
              title="移除这个 tag 的动作"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            )}
          </div>
        </div>
      <div className="flex items-center justify-between rounded-lg border border-[var(--card-border)]/40 bg-[var(--app-bg)] p-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyAction}
            className="flex items-center justify-center rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-indigo-500/10 hover:text-indigo-500"
            title="复制设置"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!inlineActionClipboard}
            onClick={pasteAction}
            className="flex items-center justify-center rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-indigo-500/10 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)]"
            title="粘贴设置"
          >
            <ClipboardPaste className="h-4 w-4" />
          </button>
        </div>
        <div className="h-4 w-px shrink-0 bg-[var(--card-border)]/40" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={createTemplate}
            className="flex items-center justify-center rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-indigo-500/10 hover:text-indigo-500"
            title="新建模板"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowTemplates((value) => !value)}
            className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
              showTemplates
                ? 'bg-indigo-500/10 text-indigo-500'
                : 'text-[var(--text-secondary)] hover:bg-indigo-500/10 hover:text-indigo-500'
            }`}
            title="模板列表"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
      <select
        value={currentAction}
        onChange={(event) => changeActionType(event.target.value as InlinePresentationActionType)}
        className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2 font-bold"
      >
        {ACTIONS.map((item) => (
          <option key={item} value={item}>
            {inlinePresentationActionLabel(item)}
          </option>
        ))}
      </select>
      {showTemplates && (
        <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-[var(--card-border)]/40 bg-[var(--app-bg)]/50 p-2">
          <div className="flex items-center justify-between px-1 text-[10px] font-bold text-[var(--text-muted)]">
            <span>已存动作模板</span>
            {templates.length === 0 && <span className="font-normal">暂无模板</span>}
          </div>
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between gap-1.5 rounded border border-[var(--card-border)]/30 bg-[var(--card-bg)] p-1.5 transition-colors hover:border-indigo-500/30"
            >
              <input
                type="text"
                value={template.name}
                onChange={(event) => renameTemplate(template.id, event.target.value)}
                className="min-w-0 flex-1 border-b border-transparent bg-transparent px-0.5 pb-0.5 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-indigo-500/50"
                placeholder="模板名称"
              />
              <button
                type="button"
                onClick={() => applyTemplate(template)}
                className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-500 transition-colors hover:bg-indigo-500 hover:text-white"
                title="应用模板"
              >
                使用
              </button>
              <button
                type="button"
                onClick={() => deleteTemplate(template.id)}
                className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                title="删除模板"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {showsStrength && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-bold">{strengthLabel}</span>
          <div className="min-w-0 flex-1">
            <DraggableNumberInput
              value={action.strength}
              min={0}
              max={currentAction === 'rotate' ? 360 : 180}
              unit={currentAction === 'rotate' ? 'DEG' : 'PX'}
              onChange={(strength) => update({ strength })}
            />
          </div>
          {isRepeatable && (
            <>
              <span className="shrink-0 font-bold">次数</span>
              <div className="w-[64px] shrink-0">
                <DraggableNumberInput
                  value={action.repeats || 1}
                  min={1}
                  max={12}
                  unit={null}
                  onChange={(repeats) => update({ repeats })}
                />
              </div>
            </>
          )}
          <span className="shrink-0 font-bold">时长</span>
          <label className="w-[76px] shrink-0">
            <DurationInput
              value={action.duration}
              min={0}
              step={50}
              unit="MS"
              decimals={0}
              onChange={(duration) => update({ duration })}
            />
          </label>
        </div>
      )}
      {isPercentSlider && (
        <label className="flex items-center gap-2">
          <span className="shrink-0 font-bold">
            {currentAction === 'opacity' ? '不透明度' : '亮度'}：{Math.round(action.strength)}%
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={action.strength}
            onChange={(event) => update({ strength: Number(event.target.value) })}
            className="min-w-0 flex-1"
          />
          <span className="shrink-0 font-bold">时长</span>
          <label className="w-[76px] shrink-0">
            <DurationInput
              value={action.duration}
              min={0}
              step={50}
              unit="MS"
              decimals={0}
              onChange={(duration) => update({ duration })}
            />
          </label>
        </label>
      )}
      {!isNone && !showsStrength && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-bold">时长</span>
          <label className="min-w-0 flex-1">
            <DurationInput
              value={action.duration}
              min={0}
              step={50}
              unit="MS"
              decimals={0}
              onChange={(duration) => update({ duration })}
            />
          </label>
        </div>
      )}
      {isTranslate && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPreviewBefore?.(action)}
              className="rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2 font-bold hover:bg-indigo-500 hover:text-white"
            >
              动画前
            </button>
            <button
              type="button"
              onClick={() => onPreviewAfter?.(action)}
              className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2 font-bold text-indigo-600 hover:bg-indigo-500 hover:text-white"
            >
              动画后
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-bold">水平</span>
            <div className="min-w-0 flex-1">
              <DraggableNumberInput
                value={action.offsetX}
                min={-120}
                max={120}
                onChange={(offsetX) => update({ offsetX })}
              />
            </div>
            <span className="shrink-0 font-bold">垂直</span>
            <div className="min-w-0 flex-1">
              <DraggableNumberInput
                value={action.offsetY}
                min={-120}
                max={120}
                onChange={(offsetY) => update({ offsetY })}
              />
            </div>
          </div>
        </>
      )}
      {isScale && (
        <label className="flex items-center gap-2">
          <span className="shrink-0 font-bold">缩放：{Math.round(action.scale * 100)}%</span>
          <input
            type="range"
            min="0.5"
            max="1.8"
            step="0.02"
            value={action.scale}
            onChange={(event) => update({ scale: Number(event.target.value) })}
            className="min-w-0 flex-1"
          />
        </label>
      )}
    </div>
  );
}
