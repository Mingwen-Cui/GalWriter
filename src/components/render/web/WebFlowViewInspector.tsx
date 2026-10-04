import type { Language } from '../../../lib/i18n';
import type { WebExportSettings } from '../video/shared/types';

export function WebFlowViewInspector({
  settings,
  language,
  onChange,
}: {
  settings: WebExportSettings;
  language: Language;
  onChange: (patch: Partial<WebExportSettings>) => void;
}) {
  const label = (zh: string, ja: string, en: string) =>
    language === 'zh' ? zh : language === 'ja' ? ja : en;
  return (
    <section className="space-y-3 py-3">
      <div className="text-xs font-bold">
        {label('流程图方向', 'フローの方向', 'Flow direction')}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {(['right', 'down', 'left', 'up'] as const).map((direction, index) => (
          <button
            key={direction}
            type="button"
            aria-pressed={settings.flowOverviewLayoutDirection === direction}
            onClick={() => onChange({ flowOverviewLayoutDirection: direction })}
            className={`h-8 rounded-lg text-xs ${settings.flowOverviewLayoutDirection === direction ? 'bg-indigo-600 text-white' : 'bg-[var(--vr-surface)] text-[var(--vr-text-soft)]'}`}
          >
            {
              [
                label('向右', '右', 'Right'),
                label('向下', '下', 'Down'),
                label('向左', '左', 'Left'),
                label('向上', '上', 'Up'),
              ][index]
            }
          </button>
        ))}
      </div>
    </section>
  );
}
