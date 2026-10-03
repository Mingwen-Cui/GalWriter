import { DraggableNumberInput } from '../../DraggableNumberInput';

export function PptNumberInput({
  label,
  value,
  onChange,
  min,
  max,
  disabled = false,
  className = '',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <DraggableNumberInput
      label={label}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={0.1}
      unit={null}
      disabled={disabled}
      containerClassName={`ppt-number-field ${className}`}
      inputClassName="h-full touch-none !p-0 !text-left !text-[11px]"
    />
  );
}
