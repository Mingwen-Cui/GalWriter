import { NodeProps, NodeResizer, NodeToolbar, Position, useStore } from '@xyflow/react';
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Trash2, Type } from 'lucide-react';
import React, { memo, useEffect } from 'react';

import { RichText } from './RichText';

const FONT_FAMILIES = [
  { label: '系统默认', value: 'system-ui, sans-serif' },
  { label: '衬线体', value: 'Georgia, serif' },
  { label: '等宽体', value: 'monospace' },
  { label: '楷体', value: '"Kaiti", "STKaiti", serif' },
  { label: '黑体', value: '"SimHei", "Microsoft YaHei", sans-serif' },
];

const PRESET_SIZES = [12, 16, 24, 32, 48, 64];

export function TextNode({ id, data, selected }: NodeProps) {
  const content = (data.content as string) || '';
  const fontSize = (data.fontSize as number) || 24;
  const color = (data.color as string) || '#334155';
  const fontFamily = (data.fontFamily as string) || FONT_FAMILIES[0].value;
  const isBold = data.isBold === true;
  const textAlign = (data.textAlign as 'left' | 'center' | 'right') || 'center';

  const updateNodeData = (updates: any) => {
    if (data.onUpdate) {
      (data.onUpdate as Function)(id, updates);
    }
  };

  const selectionCount = useStore((state) => state.nodes.filter((n) => n.selected).length);

  useEffect(() => {
    if (data.initialEditing) {
      const timer = setTimeout(() => {
        updateNodeData({ initialEditing: false });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div
      className={`w-full h-full relative group border-2 rounded-xl transition-[border-color,background-color,shadow,ring] duration-300 ${selected ? 'border-indigo-500/50 bg-indigo-50/10 shadow-md ring-2 ring-indigo-500/20' : 'border-transparent'}`}
    >
      <NodeResizer
        minWidth={50}
        minHeight={30}
        isVisible={selected && selectionCount === 1}
        lineClassName="!border-indigo-500/50 !border-dashed"
        handleClassName="!w-2 !h-2 !bg-indigo-500 !border-none !rounded-full"
      />

      <NodeToolbar isVisible={selected && selectionCount === 1} position={Position.Top} offset={10}>
        <div className="toolbar-bubble-surface bg-[var(--toolbar-bg)] backdrop-blur-md p-1.5 rounded-2xl shadow-2xl border border-[var(--toolbar-border)] flex flex-col gap-2 min-w-[280px]">
          {/* Row 1: Style & Actions */}
          <div className="flex items-center gap-2 px-1">
            <div className="relative flex-1 group/select">
              <select
                value={fontFamily}
                onChange={(e) => updateNodeData({ fontFamily: e.target.value })}
                className="w-full bg-[var(--app-bg)] border-none rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer pr-6"
              >
                {FONT_FAMILIES.map((f) => (
                  <option
                    key={f.value}
                    value={f.value}
                    className="bg-[var(--card-bg)] text-[var(--text-primary)]"
                  >
                    {f.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            </div>

            <div className="w-px h-4 bg-[var(--card-border)]" />

            <button
              onClick={() => updateNodeData({ isBold: !isBold })}
              className={`p-1.5 rounded-lg transition-all ${isBold ? 'bg-indigo-500/20 text-indigo-500 shadow-inner' : 'text-[var(--text-secondary)] hover:bg-[var(--app-bg)]'}`}
              title="加粗"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-[var(--card-border)]" />

            <div className="flex bg-[var(--app-bg)] p-0.5 rounded-lg">
              <button
                onClick={() => updateNodeData({ textAlign: 'left' })}
                className={`p-1 rounded-md transition-all ${textAlign === 'left' ? 'bg-[var(--card-bg)] text-indigo-500 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                title="左对齐"
              >
                <AlignLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => updateNodeData({ textAlign: 'center' })}
                className={`p-1 rounded-md transition-all ${textAlign === 'center' ? 'bg-[var(--card-bg)] text-indigo-500 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                title="居中"
              >
                <AlignCenter className="w-3 h-3" />
              </button>
              <button
                onClick={() => updateNodeData({ textAlign: 'right' })}
                className={`p-1 rounded-md transition-all ${textAlign === 'right' ? 'bg-[var(--card-bg)] text-indigo-500 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                title="右对齐"
              >
                <AlignRight className="w-3 h-3" />
              </button>
            </div>

            <div className="w-px h-4 bg-slate-200" />

            <div className="relative flex items-center justify-center w-6 h-6">
              <input
                type="color"
                value={color}
                onChange={(e) => updateNodeData({ color: e.target.value })}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                className="w-4 h-4 rounded-full border border-slate-200 shadow-sm"
                style={{ backgroundColor: color }}
              />
            </div>

            <button
              onClick={() => (data.onDelete as Function)(id)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row 2: Font Sizes */}
          <div className="flex items-center gap-1 bg-[var(--app-bg)] p-1 rounded-lg">
            <div className="flex items-center gap-1 px-1.5 border-r border-[var(--card-border)] mr-1">
              <Type className="w-3 h-3 text-[var(--text-muted)]" />
              <input
                type="number"
                value={fontSize}
                onChange={(e) =>
                  updateNodeData({ fontSize: Math.max(8, parseInt(e.target.value) || 12) })
                }
                className="w-10 bg-transparent border-none text-[10px] font-bold outline-none"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {PRESET_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => updateNodeData({ fontSize: size })}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${fontSize === size ? 'bg-indigo-500 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--text-primary)]'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </NodeToolbar>

      <div
        className={`w-full h-full flex items-center p-2 overflow-hidden ${
          textAlign === 'left'
            ? 'justify-start'
            : textAlign === 'right'
              ? 'justify-end'
              : 'justify-center'
        }`}
      >
        <RichText
          value={content}
          onChange={(val) => updateNodeData({ content: val })}
          autoFocus={data.initialEditing === true}
          className="w-full outline-none cursor-text placeholder:text-[var(--text-muted)] transition-all"
          style={{
            fontSize: `${fontSize}px`,
            color: color,
            fontFamily: fontFamily,
            fontWeight: isBold ? 'bold' : 'normal',
            textAlign: textAlign,
            textShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        />
      </div>
    </div>
  );
}

export const MemoizedTextNode = memo(TextNode);
