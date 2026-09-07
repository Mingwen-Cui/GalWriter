import type { Language } from '../../../../lib/i18n';
import { renderObjectText } from '../../video/objectInspector/i18n';
import type { RenderColorStop } from '../../video/shared/types';
import { GradientPopover } from './ColorPopovers';
export type GradientShape = 'linear' | 'radial' | 'diamond';
/** Web/PPT field adapter. The gradient editor itself has one implementation. */
export function GradientEditorPopover({
  language,
  angle,
  stops,
  shape = 'linear',
  onAngleChange,
  onStopsChange,
  onShapeChange,
}: {
  language: Language;
  angle: number;
  stops: RenderColorStop[];
  shape?: GradientShape;
  onAngleChange: (value: number) => void;
  onStopsChange: (value: RenderColorStop[]) => void;
  onShapeChange?: (value: GradientShape) => void;
}) {
  return (
    <GradientPopover
      tone="fill"
      text={renderObjectText(language).popover}
      angle={angle}
      stops={stops}
      gradientType={shape}
      allowedTypes={onShapeChange ? ['linear', 'radial', 'diamond'] : ['linear']}
      onAngleChange={onAngleChange}
      onStopsChange={onStopsChange}
      onGradientTypeChange={(value) => {
        if (value !== 'angular') onShapeChange?.(value);
      }}
    />
  );
}
