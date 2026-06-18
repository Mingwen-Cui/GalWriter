import type { InlinePresentationAction, InlinePresentationActionType } from '../domain/project';
import { inlinePresentationActionLabel } from '../lib/presentation';
import { DraggableNumberInput } from './DraggableNumberInput';
import { DurationInput } from './DurationInput';

const ACTIONS: InlinePresentationActionType[] = [
  'none',
  'shake-x',
  'shake-y',
  'translate-x',
  'translate-y',
  'scale',
  'pulse',
  'wait',
];

export function InlineActionEditor({
  action,
  targetName,
  targetKind,
  onChange,
  onDelete,
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
  onPreviewBefore?: (action: InlinePresentationAction) => void;
  onPreviewAfter?: (action: InlinePresentationAction) => void;
  autoPreview?: boolean;
  onAutoPreviewChange?: (value: boolean) => void;
}) {
  const update = (updates: Partial<InlinePresentationAction>) => {
    const next = { ...action, ...updates };
    onChange(next);
    if (autoPreview) onPreviewAfter?.(next);
  };
  const isTranslate = action.action === 'translate-x' || action.action === 'translate-y';
  const isScale = action.action === 'scale';
  const isWait = action.action === 'wait';

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
        正文中间的 {targetKind === 'character' ? '人物' : '场景'} tag 会暂停文字显示，执行这里的动作后再继续播放后面的文字。
      </div>
      <div>
        <div className="mb-1 text-[10px] font-black uppercase text-[var(--text-muted)]">
          {targetKind === 'character' ? '人物动作' : '场景动作'}：{targetName}
        </div>
        <select
          value={action.action}
          onChange={(event) => update({ action: event.target.value as InlinePresentationActionType })}
          className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2 font-bold"
        >
          {ACTIONS.map((item) => (
            <option key={item} value={item}>
              {inlinePresentationActionLabel(item)}
            </option>
          ))}
        </select>
      </div>
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
      <label className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2 font-bold">
        <input
          type="checkbox"
          checked={Boolean(autoPreview)}
          onChange={(event) => onAutoPreviewChange?.(event.target.checked)}
        />
        每次修改都进行预览测试
      </label>
      {!isWait && !isScale && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-bold">强度</span>
          <div className="min-w-0 flex-1">
            <DraggableNumberInput
              value={action.strength}
              min={0}
              max={80}
              onChange={(strength) => update({ strength })}
            />
          </div>
        </div>
      )}
      {isTranslate && (
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
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 font-bold text-rose-500 hover:bg-rose-500 hover:text-white"
        >
          移除这个 tag 的动作
        </button>
      )}
    </div>
  );
}
