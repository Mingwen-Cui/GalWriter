import { Box, Eye, MoveHorizontal, MoveVertical, RotateCw, Type } from 'lucide-react';

import type { PptTextBoxLayout, PptTextOverrideTarget } from '../video/shared/types';
import { ControlRow, InspectorGroup, NumberField } from '../web/webStyleInspectorControls';

type CoverTextTarget = Extract<PptTextOverrideTarget, 'cover-title' | 'cover-subtitle'>;

export function PptCoverTextInspector({
  target,
  label,
  text,
  layout,
  onUpdateText,
  onUpdateLayout,
}: {
  target: CoverTextTarget;
  label: string;
  text: string;
  layout: PptTextBoxLayout;
  onUpdateText: (target: CoverTextTarget, text: string) => void;
  onUpdateLayout: (target: CoverTextTarget, patch: Partial<PptTextBoxLayout>) => void;
}) {
  return (
    <div className="space-y-4">
      <InspectorGroup
        title="位置"
        icon={<Box className="h-4 w-4" />}
        tone="position"
        secondary={
          <NumberField
            icon={<RotateCw className="h-4 w-4" />}
            label="旋转"
            value={layout.rotation}
            min={-180}
            max={180}
            onChange={(rotation) => onUpdateLayout(target, { rotation })}
          />
        }
      >
        <ControlRow>
          <NumberField
            icon={<MoveHorizontal className="h-4 w-4" />}
            label="X"
            value={layout.x}
            min={0}
            max={1920}
            onChange={(x) => onUpdateLayout(target, { x })}
          />
          <NumberField
            icon={<MoveVertical className="h-4 w-4" />}
            label="Y"
            value={layout.y}
            min={0}
            max={1080}
            onChange={(y) => onUpdateLayout(target, { y })}
          />
        </ControlRow>
        <ControlRow className="mt-2">
          <NumberField
            icon={<MoveHorizontal className="h-4 w-4" />}
            label="宽度"
            value={layout.width}
            min={40}
            max={1920}
            onChange={(width) => onUpdateLayout(target, { width })}
          />
          <NumberField
            icon={<MoveVertical className="h-4 w-4" />}
            label="高度"
            value={layout.height}
            min={24}
            max={1080}
            onChange={(height) => onUpdateLayout(target, { height })}
          />
        </ControlRow>
      </InspectorGroup>
      <InspectorGroup
        title={label}
        icon={<Type className="h-4 w-4" />}
        tone="text"
        secondary={
          <label className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-[11px] font-bold text-slate-700">
            <input
              type="checkbox"
              checked={layout.visible !== false}
              onChange={(event) => onUpdateLayout(target, { visible: event.target.checked })}
            />
            <Eye className="h-3.5 w-3.5" />
            显示
          </label>
        }
      >
        <textarea
          value={text}
          onChange={(event) => onUpdateText(target, event.target.value)}
          className="min-h-24 w-full resize-y rounded-xl border-0 bg-white p-3 text-sm text-slate-900 outline-none"
        />
      </InspectorGroup>
    </div>
  );
}
