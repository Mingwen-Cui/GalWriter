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

    const objects = getRenderObjects(style);
    const panel = objects.dialogBox;
    const title = objects.title;
    const body = objects.body;
    const nameplate = objects.nameplate;
    const panelX = Math.max(0, Math.min(12.2, 0.93 + panel.x / 100));
    const panelY = Math.max(0, Math.min(6.8, 4.43 + panel.y / 100));
    const panelW = Math.max(1.2, Math.min(13.333 - panelX, 13.333 * panel.width / 100));
    const panelH = Math.max(0.35, Math.min(7.5 - panelY, 7.5 * panel.height / 100));
    if (panel.visible) {
      slide.addShape(pptx.ShapeType.roundRect, { x: panelX, y: panelY, w: panelW, h: panelH, rectRadius: Math.max(.02, panel.radius / 180), fill: { color: hex(panel.fill.color), transparency: 100 - panel.fill.alpha }, line: panel.stroke.enabled ? { color: hex(panel.stroke.color), transparency: 100 - panel.stroke.alpha, width: panel.stroke.width } : { transparency: 100 }, rotate: panel.rotation });
    }
    if (title.visible) {
      slide.addText(scene.title, { x: panelX + .22 + title.x / 100, y: panelY + .16 + title.y / 100, w: Math.min(panelW - .3, panelW * title.width / 100), h: Math.max(.18, title.height / 100), fontFace: title.fontFamily, fontSize: Math.max(8, title.fontSize * .66), bold: title.fontWeight >= 700, color: hex(title.fill.color), align: title.textAlign, margin: 0, breakLine: false, rotate: title.rotation });
    }
    if (body.visible) {
      slide.addText(scene.text || ' ', { x: panelX + .22 + body.x / 100, y: panelY + .16 + title.height / 100 + .08 + body.y / 100, w: Math.min(panelW - .3, panelW * body.width / 100), h: Math.max(.2, body.height / 100), fontFace: body.fontFamily, fontSize: Math.max(8, body.fontSize * .66), bold: body.fontWeight >= 700, color: hex(body.fill.color), align: body.textAlign, breakLine: false, margin: 0, valign: 'middle', rotate: body.rotation });
    }
    if (style.nameplateVisible && nameplate.visible) {
      const name = scene.characters.find((character) => character.name)?.name || scene.title;
      const x = Math.max(0, Math.min(11.8, .93 + nameplate.x / 100));
      const y = Math.max(0, Math.min(7.0, 5.63 - nameplate.y / 100));
      const w = Math.max(1.1, Math.min(5, 13.333 * nameplate.width / 100));
      const h = Math.max(.26, nameplate.height / 100);
      slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: Math.max(.02, nameplate.radius / 180), fill: { color: hex(nameplate.fill.color), transparency: 100 - nameplate.fill.alpha }, line: nameplate.stroke.enabled ? { color: hex(nameplate.stroke.color), transparency: 100 - nameplate.stroke.alpha, width: nameplate.stroke.width } : { transparency: 100 }, rotate: nameplate.rotation });
      slide.addText(name, { x: x + .06, y: y + .05, w: w - .12, h: Math.max(.16, h - .1), fontFace: nameplate.fontFamily, fontSize: Math.max(8, nameplate.fontSize * .66), bold: nameplate.fontWeight >= 700, color: hex(style.nameplateTextColor || '#FFFFFF'), align: nameplate.textAlign, margin: 0, rotate: nameplate.rotation });
    }
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
