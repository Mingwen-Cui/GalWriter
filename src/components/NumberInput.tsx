import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  accentColor?: string;
}

/**
 * 一个通用的数值输入组件，包含：
 * 1. 减号按钮
 * 2. 滑轨 (0-10)
 * 3. 加号按钮
 * 4. 数字输入框 (支持负数)
 */
export function NumberInput({
  value,
  onChange,
  min = -9999,
  max = 9999,
  step = 1,
  className = "",
  accentColor = "amber"
}: NumberInputProps) {
  // 滑轨的视觉范围定义为 0-10
  const sliderMin = 0;
  const sliderMax = 10;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? 0 : Number(e.target.value);
    onChange(val);
  };

  const increment = () => {
    onChange(Math.min(max, value + step));
  };

  const decrement = () => {
    onChange(Math.max(min, value - step));
  };

  // 映射 accentColor 到 tailwind 类
  const accentClasses: Record<string, string> = {
    amber: "accent-amber-500 hover:accent-amber-400",
    blue: "accent-blue-500 hover:accent-blue-400",
    indigo: "accent-indigo-500 hover:accent-indigo-400",
    emerald: "accent-emerald-500 hover:accent-emerald-400",
  };

  const borderClasses: Record<string, string> = {
    amber: "focus:border-amber-500/50",
    blue: "focus:border-blue-500/50",
    indigo: "focus:border-indigo-500/50",
    emerald: "focus:border-emerald-500/50",
  };

  const selectedAccent = accentClasses[accentColor] || accentClasses.amber;
  const selectedBorder = borderClasses[accentColor] || borderClasses.amber;

  return (
    <div 
      className={`flex items-center gap-2 group/numinput nopan nodrag ${className}`}
      // 阻止所有交互事件冒泡，防止触发 React Flow 的画布操作
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 减号按钮 */}
      <button 
        onClick={decrement}
        className="p-1.5 rounded-lg bg-[var(--app-bg)] hover:bg-[var(--card-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 border border-[var(--card-border)]"
        title="减少"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      
      {/* 滑轨 */}
      <div className="relative flex items-center flex-1 min-w-[60px]">
        <input 
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={step}
          value={Math.max(sliderMin, Math.min(sliderMax, value))}
          onChange={handleSliderChange}
          className={`w-full h-1.5 bg-[var(--app-bg)] rounded-lg appearance-none cursor-pointer transition-all ${selectedAccent} nodrag nopan border border-[var(--card-border)]`}
        />
      </div>

      {/* 加号按钮 */}
      <button 
        onClick={increment}
        className="p-1.5 rounded-lg bg-[var(--app-bg)] hover:bg-[var(--card-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 border border-[var(--card-border)]"
        title="增加"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* 数字输入框 */}
      <div className="relative">
        <input 
          type="number"
          value={value}
          onChange={handleInputChange}
          className={`w-14 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg px-2 py-1.5 text-sm font-bold text-[var(--text-primary)] text-center outline-none transition-all ${selectedBorder} hover:border-[var(--text-muted)] focus:bg-[var(--card-bg)] nodrag nopan shadow-sm`}
        />
      </div>
    </div>
  );
}
