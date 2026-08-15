import type { Language } from '../../../lib/i18n';
import type { PptTextBoxLayout, PptTextOverrideTarget } from '../video/shared/types';
import { StartMenuElementInspector } from '../web/StartMenuElementInspector';
import { toPptCoverPatch, toPptCoverWebInspectorElement } from './pptWebInspectorAdapter';

type CoverTextTarget = Extract<
  PptTextOverrideTarget,
  'cover-title' | 'cover-subtitle' | 'cover-description'
>;

export function PptCoverTextInspector({
  target,
  text,
  layout,
  language,
  showDescriptions,
  onUpdateText,
  onUpdateLayout,
}: {
  target: CoverTextTarget;
  text: string;
  layout: PptTextBoxLayout;
  language: Language;
  showDescriptions: boolean;
  onUpdateText: (target: CoverTextTarget, text: string) => void;
  onUpdateLayout: (target: CoverTextTarget, patch: Partial<PptTextBoxLayout>) => void;
}) {
  return (
    <StartMenuElementInspector
      element={toPptCoverWebInspectorElement(target, text, layout)}
      language={language}
      showDescriptions={showDescriptions}
      onUpdate={(update) => {
        const next = toPptCoverPatch(layout, update);
        if (next.text !== undefined) onUpdateText(target, next.text);
        if (Object.keys(next.layoutPatch).length) onUpdateLayout(target, next.layoutPatch);
      }}
    />
  );
}
