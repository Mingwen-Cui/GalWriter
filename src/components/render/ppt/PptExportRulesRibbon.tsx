import type { PptExportSettings } from '../video/shared/types';
import { usePptCopy } from './pptCopyContext';

export function PptExportRulesRibbon({
  scene,
  pptSettings,
  updatePptSettings,
}: {
  scene?: { id: string; backgroundVideoUrl?: string };
  pptSettings: PptExportSettings;
  updatePptSettings: (patch: Partial<PptExportSettings>) => void;
}) {
  const copy = usePptCopy();
  return (
    <section className="ppt-export-rules" aria-label={copy.exportRules}>
      <label className="ppt-export-rules-field">
        <span>{copy.pageRatio}</span>
        <select
          value={pptSettings.layout}
          onChange={(event) =>
            updatePptSettings({ layout: event.target.value as PptExportSettings['layout'] })
          }
          className="render-field"
        >
          <option value="LAYOUT_WIDE">16:9</option>
          <option value="LAYOUT_STANDARD">4:3</option>
        </select>
      </label>
      <label className="ppt-export-rules-field">
        <span>{copy.branchMode}</span>
        <select
          value={pptSettings.branchMode}
          onChange={(event) =>
            updatePptSettings({
              branchMode: event.target.value as PptExportSettings['branchMode'],
            })
          }
          className="render-field"
        >
          <option value="interactive">{copy.interactive}</option>
          <option value="linear">{copy.linear}</option>
          <option value="all">{copy.allBranches}</option>
        </select>
      </label>
      <div className="ppt-export-rules-toggles">
        <label className="ppt-export-rules-toggle">
          <input
            type="checkbox"
            checked={pptSettings.includeCover}
            onChange={(event) => updatePptSettings({ includeCover: event.target.checked })}
          />
          <span>{copy.includeCover}</span>
        </label>
        <label className="ppt-export-rules-toggle">
          <input
            type="checkbox"
            checked={pptSettings.includeNotes}
            onChange={(event) => updatePptSettings({ includeNotes: event.target.checked })}
          />
          <span>{copy.includeNotes}</span>
        </label>
        {scene?.backgroundVideoUrl ? (
          <label className="ppt-export-rules-toggle">
            <input
              type="checkbox"
              checked={pptSettings.videoLoopByScene?.[scene.id] ?? false}
              onChange={(event) =>
                updatePptSettings({
                  videoLoopByScene: {
                    ...pptSettings.videoLoopByScene,
                    [scene.id]: event.target.checked,
                  },
                })
              }
            />
            <span>{copy.loopVideo}</span>
          </label>
        ) : null}
      </div>
    </section>
  );
}
