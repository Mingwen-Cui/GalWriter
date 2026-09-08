import type JSZip from 'jszip';
import { renderAppearancePng } from '../../shared/paint/appearanceCanvas';
import type { CodeExportTarget } from '../codeExport/targets/targetTypes';
import type { RenpyExportSettings } from '../codeExport/types';
import { resolveGameInterface } from './gameInterface';

export async function packageGameInterface(
  zip: JSZip,
  settings: RenpyExportSettings,
  target: CodeExportTarget,
) {
  if (target === 'ir-json') return;
  const d = resolveGameInterface(settings.interfaceDesigns, target);
  const root = target === 'tyrano' ? 'data/image/galwriter-ui' : 'game/galwriter-ui';
  const surfaces = [
    [
      'dialogue',
      d.panelAppearance,
      (d.width * d.panelWidth) / 100,
      (d.height * d.panelHeight) / 100,
      d.corners || d.radius,
    ],
    ['canvas', d.canvasAppearance, d.width, d.height, 0],
    ['choices', d.choiceAppearance, d.width * 0.5, d.fontSize * 1.5 + 24, d.radius],
  ] as const;
  for (const [name, value, width, height, corners] of surfaces) {
    if (!value) continue;
    const image = await renderAppearancePng(
      value,
      width,
      height,
      Array.isArray(corners) ? [...corners] : corners,
      false,
    );
    zip.file(`${root}/${name}.png`, image.data.split(',')[1], { base64: true });
    if (target === 'tyrano' && name === 'canvas')
      zip.file('data/bgimage/galwriter-ui/canvas.png', image.data.split(',')[1], { base64: true });
  }
  zip.file(
    'GAME_INTERFACE.md',
    '# Interface design\n\nLayer data is preserved in the project settings. Static interface artwork is composited into galwriter-ui PNG files. Video fills use their first frame in native game skins; Web retains video playback. Text and game actions remain native controls.\n',
  );
}
