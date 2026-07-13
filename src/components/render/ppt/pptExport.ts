import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import PptxGenJS from 'pptxgenjs';

import { pptSceneColors, resolvePptScenes } from './pptSceneResolver';
import type { PptExportSettings, RenderStyle, WebExportSettings } from '../video/shared/types';

const hex = (value: string) => value.replace('#', '').slice(0, 6) || '0F172A';
const isEmbeddableImage = (value?: string) => Boolean(value?.startsWith('data:image/'));

export async function buildPptxBuffer({
  nodes,
  edges,
  projectName,
  settings,
  style,
  pptSettings,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  projectName: string;
  settings: WebExportSettings;
  style: RenderStyle;
  pptSettings: PptExportSettings;
}): Promise<ArrayBuffer> {
  const pptx = new PptxGenJS();
  pptx.layout = pptSettings.layout;
  pptx.author = 'GalWriter AI';
  pptx.subject = 'Interactive story presentation';
  pptx.title = projectName;

  const scenes = resolvePptScenes(nodes, edges, settings);
  const colors = pptSceneColors(style, settings);
  const slideByNodeId = new Map(scenes.map((scene, index) => [scene.id, index + (pptSettings.includeCover ? 2 : 1)]));

  if (pptSettings.includeCover) {
    const slide = pptx.addSlide();
    slide.background = { color: hex(settings.startMenuBackgroundColor || colors.background) };
    if (isEmbeddableImage(settings.startMenuBackgroundImageUrl)) {
      slide.addImage({ data: settings.startMenuBackgroundImageUrl, x: 0, y: 0, w: 13.333, h: 7.5 });
    }
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: '000000', transparency: 38 }, line: { transparency: 100 } });
    slide.addText(projectName, { x: 0.9, y: 2.75, w: 11.5, h: 0.7, fontFace: style.titleFontFamily, fontSize: 34, bold: true, color: hex(colors.title), align: 'center', margin: 0 });
    slide.addText('由 GalWriter AI 生成', { x: 0.9, y: 3.62, w: 11.5, h: 0.3, fontSize: 15, color: hex(colors.body), align: 'center', margin: 0 });
  }

  for (const scene of scenes) {
    const slide = pptx.addSlide();
    slide.background = { color: hex(colors.background) };
    if (isEmbeddableImage(scene.backgroundUrl)) {
      slide.addImage({ data: scene.backgroundUrl!, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', x: 0, y: 0, w: 13.333, h: 7.5 } });
    }

    scene.characters.forEach((character) => {
      if (!isEmbeddableImage(character.imageUrl)) return;
      const width = Math.min(3.6, Math.max(1.2, 2.3 * (character.scale || 100) / 100));
      const x = character.position === 'left' ? 0.55 : character.position === 'right' ? 9.18 : 4.87;
      slide.addImage({ data: character.imageUrl!, x: x + character.offsetX / 100, y: 1.05 + character.offsetY / 100, w: width, h: 4.9, transparency: 0, flipH: character.flipX });
    });

    slide.addShape(pptx.ShapeType.roundRect, { x: 0.55, y: 5.25, w: 12.23, h: 1.7, rectRadius: style.dialogRadius / 100, fill: { color: hex(colors.panel), transparency: 100 - (style.panelColorAlpha ?? 82) }, line: { transparency: 100 } });
    slide.addText(scene.title, { x: 0.9, y: 5.45, w: 2.8, h: 0.32, fontFace: style.titleFontFamily, fontSize: 16, bold: true, color: hex(colors.title), margin: 0 });
    slide.addText(scene.text || ' ', { x: 0.9, y: 5.86, w: 8.1, h: 0.8, fontFace: style.bodyFontFamily, fontSize: 18, color: hex(colors.body), breakLine: false, margin: 0, valign: 'middle' });
    scene.choices.slice(0, 3).forEach((choice, index) => {
      const targetSlide = choice.targetId ? slideByNodeId.get(choice.targetId) : undefined;
      slide.addText(choice.label, { x: 9.25, y: 5.52 + index * 0.43, w: 3.05, h: 0.3, fontSize: 11, color: 'FFFFFF', bold: true, align: 'center', margin: 0.04, fill: { color: hex(colors.choice) }, line: { color: hex(colors.choice) }, hyperlink: pptSettings.branchMode === 'interactive' && targetSlide ? { slide: targetSlide } : undefined });
    });
    if (pptSettings.includeNotes) {
      slide.addNotes(`节点：${scene.id}\n\n${scene.text}\n\n${scene.choices.map((choice) => `- ${choice.label}`).join('\n')}`);
    }
  }
  return (await pptx.write({ outputType: 'arraybuffer', compression: true })) as ArrayBuffer;
}
