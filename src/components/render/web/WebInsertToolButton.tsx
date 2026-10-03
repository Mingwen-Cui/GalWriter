import type { LucideIcon } from 'lucide-react';

export const webInsertToolClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-35';
export const webInsertToolStateClass = (active = false) =>
  active
    ? 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-300'
    : 'text-[var(--vr-text-soft)] hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]';

export function WebInsertToolButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`${webInsertToolClass} ${webInsertToolStateClass(active)}`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
    </button>
  );
}
