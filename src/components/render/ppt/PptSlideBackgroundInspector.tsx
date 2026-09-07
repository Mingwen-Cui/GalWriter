import { useState } from 'react';
import type { Language } from '../../../lib/i18n';
import { normalizeSharedCanvasSettings } from '../canvas/canvasSettings';
import { CanvasSettingsSection } from '../canvas/CanvasSettingsSection';
import { BackgroundFillInspector } from '../shared/paint/BackgroundFillInspector';
import type { PptExportSettings, PptSlideBackgroundStyle, WebExportSettings } from '../video/shared/types';
import { PptLayoutChangeDialog } from './PptLayoutChangeDialog';
import { getPptCopy } from './i18n';
export function PptSlideBackgroundInspector({language, pptSettings, background, showDescriptions, onUpdateBackground, onUpdatePptSettings}: {
 language: Language; webSettings: WebExportSettings; pptSettings: PptExportSettings; background: PptSlideBackgroundStyle; showDescriptions: boolean;
 onUpdateBackground: (patch: Partial<PptSlideBackgroundStyle>) => void; onUpdatePptSettings: (patch: Partial<PptExportSettings>) => void;
}) {
 const [pendingLayout, setPendingLayout] = useState<PptExportSettings['layout'] | null>(null);
 const standard = pptSettings.layout === 'LAYOUT_STANDARD';
 const canvas = normalizeSharedCanvasSettings({canvasWidth: standard ? 1440 : 1920, canvasHeight: 1080, canvasRatioWidth: standard ? 4 : 16, canvasRatioHeight: standard ? 3 : 9});
 return <div className="property-inspector space-y-1">
  <CanvasSettingsSection language={language} variant="ppt" value={canvas} showDescriptions={showDescriptions} onChange={patch => {const layout = patch.canvasRatioWidth === 4 ? 'LAYOUT_STANDARD' : 'LAYOUT_WIDE'; if (layout !== pptSettings.layout) setPendingLayout(layout);}}/>
  <BackgroundFillInspector language={language} value={{...background, imageUrl: background.imageUrl || ''}} onChange={onUpdateBackground}/>
  {pendingLayout && <PptLayoutChangeDialog copy={getPptCopy(language)} onCancel={() => setPendingLayout(null)} onChoose={layoutContentMode => {onUpdatePptSettings({layout: pendingLayout, layoutContentMode}); setPendingLayout(null);}}/>}
 </div>;
}
