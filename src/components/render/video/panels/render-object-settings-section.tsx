import type { Language } from '../../../../lib/i18n';
import { RenderObjectInspector } from '../objectInspector/RenderObjectInspector';
import type { RenderStyle } from '../shared/types';

type RenderObjectSettingsSectionProps = {
  language: Language;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  surface?: 'video' | 'web' | 'playtest';
};

export function RenderObjectSettingsSection({
  language,
  renderStyle,
  updateRenderStyle,
  surface = 'web',
}: RenderObjectSettingsSectionProps) {
  return (
    <RenderObjectInspector
      language={language}
      renderStyle={renderStyle}
      updateRenderStyle={updateRenderStyle}
      surface={surface}
    />
  );
}
