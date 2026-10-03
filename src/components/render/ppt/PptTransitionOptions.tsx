import type { PptSlideTransition } from '../video/shared/types';
import { usePptCopy } from './pptCopyContext';
import { PptDirectionControl } from './PptDirectionControl';
import { normalizePptTransition, PPT_TRANSITION_DIRECTIONS } from './pptTransitions';

export function PptTransitionOptions({
  transition,
  onChange,
}: {
  transition: PptSlideTransition;
  onChange: (patch: Partial<PptSlideTransition>) => void;
}) {
  const copy = usePptCopy();
  const value = normalizePptTransition(transition);
  const options =
    value.effect === 'split'
      ? [
          {
            orientation: 'horizontal' as const,
            splitDirection: 'in' as const,
            label: copy.splitHorizontalIn,
          },
          {
            orientation: 'horizontal' as const,
            splitDirection: 'out' as const,
            label: copy.splitHorizontalOut,
          },
          {
            orientation: 'vertical' as const,
            splitDirection: 'in' as const,
            label: copy.splitVerticalIn,
          },
          {
            orientation: 'vertical' as const,
            splitDirection: 'out' as const,
            label: copy.splitVerticalOut,
          },
        ]
      : value.effect === 'randomBars'
        ? [
            { orientation: 'horizontal' as const, label: copy.horizontal },
            { orientation: 'vertical' as const, label: copy.vertical },
          ]
        : [];
  if (options.length)
    return (
      <div role="group" aria-label={copy.effectOptions} className="grid grid-cols-2 gap-1">
        {options.map(({ label, ...patch }) => {
          const active =
            value.orientation === patch.orientation &&
            (!('splitDirection' in patch) || value.splitDirection === patch.splitDirection);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              className={`ppt-effect-button min-w-[68px] ${active ? 'is-active' : ''}`}
              onClick={() => onChange(patch)}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  return (
    <PptDirectionControl
      value={value.direction}
      phase={value.effect === 'reveal' ? 'exit' : 'enter'}
      allowedDirections={PPT_TRANSITION_DIRECTIONS[value.effect]}
      onChange={(direction) => onChange({ direction })}
    />
  );
}
