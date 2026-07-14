import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import PptxGenJS from 'pptxgenjs';

import { pptSceneColors, resolvePptScenes } from './pptSceneResolver';
import { getRenderObjects } from '../video/shared/renderObjects';
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
  const slideByNodeId = new Map<string, number>();
  let slideNumber = pptSettings.includeCover ? 2 : 1;
  scenes.forEach((scene) => {
    slideByNodeId.set(scene.id, slideNumber);
    slideNumber += 1 + (pptSettings.branchMode !== 'linear' && scene.choices.length > 1 ? 1 : 0);
  });

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
      const scale = character.scale || 1;
      const width = Math.min(4.8, Math.max(1.2, 2.45 * scale));
      const height = Math.min(6.1, Math.max(2.45, 4.9 * scale));
      const baseX = character.position === 'left' ? 0.24 : character.position === 'right' ? 0.76 : 0.5;
      const x = Math.max(0, Math.min(13.333 - width, 13.333 * (baseX + character.offsetX / 1000) - width / 2));
      const y = Math.max(0.3, Math.min(7.5 - height, 7.5 - height - character.offsetY / 100));
      slide.addImage({ data: character.imageUrl!, x, y, w: width, h: height, transparency: 0, flipH: character.flipX });
    });

    if (style.nameplateVisible) {
      const nameplate = getRenderObjects(style).nameplate;
      if (nameplate.visible) {
        const name = scene.characters.find((character) => character.name)?.name || scene.title;
        const x = Math.max(0.55, Math.min(9.5, 0.9 + (nameplate.x || style.nameplateOffsetX || 0) / 100));
        const y = Math.max(0.3, Math.min(6.5, 4.88 + (nameplate.y || style.nameplateOffsetY || 0) / 100));
        const w = Math.max(1.25, Math.min(3.8, (nameplate.width || style.nameplateScale || 100) / 50));
        slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.38, rectRadius: Math.max(0.02, (nameplate.radius || style.nameplateRadius || 14) / 180), fill: { color: hex(style.nameplateColor || colors.choice), transparency: 100 - (style.nameplateColorAlpha ?? 86) }, line: { transparency: 100 } });
        slide.addText(name, { x: x + 0.08, y: y + 0.08, w: w - 0.16, h: 0.17, fontFace: style.nameplateFontFamily || style.titleFontFamily, fontSize: Math.max(10, (style.nameplateFontSize || 18) * 0.68), bold: true, color: hex(style.nameplateTextColor || '#FFFFFF'), align: 'center', margin: 0 });
      }
    }

    slide.addShape(pptx.ShapeType.roundRect, { x: 0.55, y: 5.25, w: 12.23, h: 1.7, rectRadius: style.dialogRadius / 100, fill: { color: hex(colors.panel), transparency: 100 - (style.panelColorAlpha ?? 82) }, line: { transparency: 100 } });
    slide.addText(scene.title, { x: 0.9, y: 5.45, w: 2.8, h: 0.32, fontFace: style.titleFontFamily, fontSize: 16, bold: true, color: hex(colors.title), margin: 0 });
    slide.addText(scene.text || ' ', { x: 0.9, y: 5.86, w: 8.1, h: 0.8, fontFace: style.bodyFontFamily, fontSize: 18, color: hex(colors.body), breakLine: false, margin: 0, valign: 'middle' });
    if (pptSettings.includeNotes) {
      slide.addNotes(pptSettings.speakerNotes?.[scene.id] || `节点：${scene.id}\n\n${scene.text}\n\n${scene.choices.map((choice) => `- ${choice.label}`).join('\n')}`);
    }

    if (pptSettings.branchMode === 'linear' || scene.choices.length < 2) continue;

    const choiceSlide = pptx.addSlide();
    choiceSlide.background = { color: hex(colors.background) };
    if (isEmbeddableImage(scene.backgroundUrl)) {
      choiceSlide.addImage({ data: scene.backgroundUrl!, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', x: 0, y: 0, w: 13.333, h: 7.5 } });
    }
    choiceSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: '0F172A', transparency: 42 }, line: { transparency: 100 } });
    choiceSlide.addText('CHOOSE YOUR ROUTE', { x: 1.1, y: 1.08, w: 11.1, h: 0.3, fontSize: 12, bold: true, charSpacing: 3, color: 'D1D5DB', align: 'center', margin: 0 });
    choiceSlide.addText('你的选择是？', { x: 1.1, y: 1.48, w: 11.1, h: 0.55, fontFace: style.titleFontFamily, fontSize: 28, bold: true, color: 'FFFFFF', align: 'center', margin: 0 });
    scene.choices.forEach((choice, index) => {
      const targetSlide = choice.targetId ? slideByNodeId.get(choice.targetId) : undefined;
      const y = 2.32 + index * 0.86;
      choiceSlide.addShape(pptx.ShapeType.roundRect, { x: 2.0, y, w: 9.33, h: 0.62, rectRadius: 0.08, fill: { color: '111827', transparency: 14 }, line: { color: 'FFFFFF', transparency: 62 }, hyperlink: pptSettings.branchMode === 'interactive' && targetSlide ? { slide: targetSlide } : undefined });
      choiceSlide.addShape(pptx.ShapeType.ellipse, { x: 2.28, y: y + 0.12, w: 0.38, h: 0.38, fill: { color: hex(colors.choice) }, line: { transparency: 100 } });
      choiceSlide.addText(String(index + 1), { x: 2.28, y: y + 0.165, w: 0.38, h: 0.16, fontSize: 8, bold: true, color: 'FFFFFF', align: 'center', margin: 0 });
      choiceSlide.addText(choice.label, { x: 2.86, y: y + 0.15, w: 8.0, h: 0.27, fontFace: style.bodyFontFamily, fontSize: 16, bold: true, color: 'FFFFFF', margin: 0, hyperlink: pptSettings.branchMode === 'interactive' && targetSlide ? { slide: targetSlide } : undefined });
    });
    if (pptSettings.includeNotes) choiceSlide.addNotes(`选择节点：${scene.id}\n\n${scene.choices.map((choice, index) => `${index + 1}. ${choice.label}`).join('\n')}`);
  }
  return (await pptx.write({ outputType: 'arraybuffer', compression: true })) as ArrayBuffer;
}
