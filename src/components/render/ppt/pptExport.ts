import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import PptxGenJS from 'pptxgenjs';

import type { Language } from '../../../lib/i18n';

import {
  CHARACTER_STAGE_MAX_HEIGHT_PERCENT,
  CHARACTER_STAGE_MAX_WIDTH_PERCENT,
} from '../../../lib/presentation';
import { resolvePresentationDialogueLayout } from '../video/shared/presentationLayout';
import { getRenderObjects } from '../video/shared/renderObjects';
import type {
  PptExportSettings,
  PptManualSlide,
  RenderStyle,
  WebExportSettings,
} from '../video/shared/types';
import {
  getPptImageDimensions,
  toPptImageData,
  toPptVideoData,
  toPptVideoLastFrameData,
} from './pptMedia';
import { pptSceneColors, resolvePptScenes } from './pptSceneResolver';
import { resolvePptTagAnimations } from './pptTagAnimations';
import { splitPptTextLines } from './pptTextLines';
import {
  finalizePptxForPowerPoint,
  type PptAnimationExportTarget,
  type PptVideoPlaybackTarget,
  toPptFontFace,
} from './pptxCompatibility';

const hex = (value: string) => value.replace('#', '').slice(0, 6) || '0F172A';

const WIDE_PAGE_WIDTH = 13.333;
const WIDE_PAGE_HEIGHT = 7.5;

/**
 * `LAYOUT_STANDARD` is the application's saved 4:3 preference, not a
 * PptxGenJS layout name.  Passing it through makes the library reject the
 * export with `UNKNOWN-LAYOUT`, so keep the app-facing and library-facing
 * values deliberately separate.
 */
const toPptxGenLayout = (layout: PptExportSettings['layout']) =>
  layout === 'LAYOUT_STANDARD' ? 'LAYOUT_4x3' : 'LAYOUT_WIDE';

/**
 * PPT stores inches, whereas the editor, web preview, and video renderer share
 * a 16:9 logical scene. Standard (4:3) slides therefore contain that scene
 * instead of independently reflowing it.
 */
const createPptPageMapper = (layout: PptExportSettings['layout']) => {
  const pageWidth = layout === 'LAYOUT_STANDARD' ? 10 : WIDE_PAGE_WIDTH;
  const pageHeight = WIDE_PAGE_HEIGHT;
  const scale = pageWidth / WIDE_PAGE_WIDTH;
  const contentHeight = WIDE_PAGE_HEIGHT * scale;
  const offsetY = (pageHeight - contentHeight) / 2;
  const frame = (x: number, y: number, w: number, h: number) => ({
    x: x * scale,
    y: offsetY + y * scale,
    w: w * scale,
    h: h * scale,
  });
  return { scale, frame };
};

const fitImageContain = (
  source: { width: number; height: number },
  frame: { x: number; y: number; w: number; h: number },
) => {
  const scale = Math.min(frame.w / source.width, frame.h / source.height);
  const w = source.width * scale;
  const h = source.height * scale;
  return { x: frame.x + (frame.w - w) / 2, y: frame.y + (frame.h - h), w, h };
};

export async function buildPptxBuffer({
  nodes,
  edges,
  projectName,
  settings,
  style,
  pptSettings,
  language,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  projectName: string;
  settings: WebExportSettings;
  style: RenderStyle;
  pptSettings: PptExportSettings;
  language: Language;
}): Promise<ArrayBuffer> {
  const pptx = new PptxGenJS();
  pptx.layout = toPptxGenLayout(pptSettings.layout);
  const generatedBy =
    language === 'zh'
      ? '由旮旯作家 · GalWriter 生成'
      : language === 'ja'
        ? 'GalWriter で作成'
        : 'Created with GalWriter';
  pptx.author = `${language === 'zh' ? '旮旯作家 · GalWriter' : 'GalWriter'} (Mingwen Cui)`;
  pptx.subject = 'Interactive story presentation';
  pptx.title = projectName;
  const page = createPptPageMapper(pptSettings.layout);
  const fullContentFrame = page.frame(0, 0, WIDE_PAGE_WIDTH, WIDE_PAGE_HEIGHT);
  const authorNote =
    'Independent design and development: Mingwen Cui (崔铭文)\nhttps://mingwencui.com/AIwriter/?lang=zh';
  let authorNoteWritten = false;

  const scenes = resolvePptScenes(nodes, edges, settings);
  const colors = pptSceneColors(style, settings);
  const imageCache = new Map<string, Promise<string | undefined>>();
  const videoCache = new Map<string, Promise<string | undefined>>();
  const resolveImage = (url?: string) => {
    if (!url) return Promise.resolve(undefined);
    const cached = imageCache.get(url);
    if (cached) return cached;
    const image = toPptImageData(url);
    imageCache.set(url, image);
    return image;
  };
  const resolveVideo = (url?: string) => {
    if (!url) return Promise.resolve(undefined);
    const cached = videoCache.get(url);
    if (cached) return cached;
    const video = toPptVideoData(url);
    videoCache.set(url, video);
    return video;
  };
  const manualSlides = pptSettings.manualSlides || [];
  const automaticSlideIds = [
    ...(pptSettings.includeCover ? ['cover'] : []),
    ...scenes.flatMap((scene) => [
      scene.id,
      ...(pptSettings.branchMode !== 'linear' && scene.choices.length > 1
        ? [`choice:${scene.id}`]
        : []),
    ]),
  ];
  const knownSlideIds = new Set([...automaticSlideIds, ...manualSlides.map((slide) => slide.id)]);
  const orderedSlideIds = [
    ...(pptSettings.slideOrder || []).filter((id) => knownSlideIds.has(id)),
    ...automaticSlideIds.filter((id) => !(pptSettings.slideOrder || []).includes(id)),
    ...manualSlides
      .map((slide) => slide.id)
      .filter((id) => !(pptSettings.slideOrder || []).includes(id)),
  ];
  const slideByNodeId = new Map<string, number>();
  const slideNumberById = new Map(orderedSlideIds.map((id, index) => [id, index + 1]));
  const animationTargets: PptAnimationExportTarget[] = [];
  const videoPlaybackTargets: PptVideoPlaybackTarget[] = [];
  scenes.forEach((scene) => {
    slideByNodeId.set(scene.id, slideNumberById.get(scene.id) || 1);
  });
  const manualByAnchor = new Map<string, PptManualSlide[]>();
  const manualById = new Map(manualSlides.map((slide) => [slide.id, slide]));
  orderedSlideIds.forEach((id, index) => {
    const slide = manualById.get(id);
    if (!slide) return;
    const anchor = orderedSlideIds[index - 1] || '__start__';
    const items = manualByAnchor.get(anchor) || [];
    items.push(slide);
    manualByAnchor.set(anchor, items);
  });
  const addManualSlide = async (manual: PptManualSlide) => {
    const slide = pptx.addSlide();
    slide.background = { color: hex(manual.backgroundColor) };
    for (const element of manual.elements) {
      const frame = page.frame(
        (element.x / 1920) * WIDE_PAGE_WIDTH,
        (element.y / 1080) * WIDE_PAGE_HEIGHT,
        (element.width / 1920) * WIDE_PAGE_WIDTH,
        (element.height / 1080) * WIDE_PAGE_HEIGHT,
      );
      if (element.kind === 'image') {
        const image = await resolveImage(element.src);
        if (image) slide.addImage({ data: image, ...frame, rotate: element.rotation || 0 });
        continue;
      }
      if (element.kind === 'text') {
        slide.addText(element.text || ' ', {
          ...frame,
          fontFace: toPptFontFace(element.fontFamily || style.bodyFontFamily),
          fontSize: Math.max(8, element.fontSize * 0.75 * page.scale),
          bold: element.bold,
          color: hex(element.color),
          align: element.align || 'left',
          margin: 0,
          rotate: element.rotation || 0,
        });
        continue;
      }
      const targetSlide = element.targetSlideId
        ? slideNumberById.get(element.targetSlideId)
        : undefined;
      const hyperlink =
        element.action === 'slide' && targetSlide
          ? { slide: targetSlide }
          : element.action === 'url' && element.url
            ? { url: element.url }
            : undefined;
      const isPrimary = element.variant === 'primary';
      const isSecondary = element.variant === 'secondary';
      slide.addShape(pptx.ShapeType.roundRect, {
        ...frame,
        rectRadius: 0.08,
        fill: isPrimary
          ? { color: '4F46E5' }
          : { color: 'FFFFFF', transparency: isSecondary ? 0 : 100 },
        line: isSecondary ? { color: '4F46E5', width: 1.4 } : { transparency: 100 },
        hyperlink,
      });
      slide.addText(element.text || ' ', {
        ...frame,
        fontSize: Math.max(8, 18 * page.scale),
        bold: true,
        color: isPrimary ? 'FFFFFF' : '4F46E5',
        align: 'center',
        valign: 'middle',
        margin: 0,
        hyperlink,
      });
    }
  };
  const appendManualSlides = async (anchorId: string) => {
    for (const manual of manualByAnchor.get(anchorId) || []) {
      await addManualSlide(manual);
      await appendManualSlides(manual.id);
    }
  };
  await appendManualSlides('__start__');

  if (pptSettings.includeCover) {
    const slide = pptx.addSlide();
    slide.background = { color: hex(settings.startMenuBackgroundColor || colors.background) };
    const coverImage = await resolveImage(settings.startMenuBackgroundImageUrl);
    if (coverImage) {
      slide.addImage({ data: coverImage, ...fullContentFrame });
    }
    slide.addShape(pptx.ShapeType.rect, {
      ...fullContentFrame,
      fill: { color: '000000', transparency: 38 },
      line: { transparency: 100 },
    });
    slide.addText(projectName, {
      ...page.frame(0.9, 2.75, 11.5, 0.7),
      fontFace: toPptFontFace(style.titleFontFamily),
      fontSize: 34 * page.scale,
      bold: true,
      color: hex(colors.title),
      align: 'center',
      margin: 0,
    });
    slide.addText(generatedBy, {
      ...page.frame(0.9, 3.62, 11.5, 0.3),
      fontSize: 15 * page.scale,
      color: hex(colors.body),
      align: 'center',
      margin: 0,
    });
    slide.addNotes(authorNote);
    authorNoteWritten = true;
    await appendManualSlides('cover');
  }

  for (const scene of scenes) {
    const slide = pptx.addSlide();
    const sceneSlideNumber = slideByNodeId.get(scene.id);
    const sceneAnimations = [
      ...resolvePptTagAnimations(scene),
      ...(pptSettings.animations?.[scene.id] || []),
    ];
    const addAnimationTargets = (
      objectName: string,
      target: PptAnimationExportTarget['animation']['target'],
      targetId?: string,
    ) => {
      if (!sceneSlideNumber) return;
      sceneAnimations
        .filter(
          (animation) =>
            animation.target === target &&
            animation.targetId === targetId &&
            !(animation.action === 'switch' && animation.switchImageUrl),
        )
        .forEach((animation) => {
          // Character entrances are part of the scene opening: export legacy
          // click-triggered entries as automatic even when they were created
          // before the automatic PPT defaults were introduced.
          const exportAnimation =
            target === 'character' && animation.phase === 'enter' && animation.start === 'onClick'
              ? { ...animation, start: 'withPrevious' as const }
              : animation;
          animationTargets.push({
            slideNumber: sceneSlideNumber,
            objectName,
            animation: exportAnimation,
          });
        });
    };
    const addNativeSwitch = (
      outgoingObjectName: string,
      incomingObjectName: string,
      animation: PptAnimationExportTarget['animation'],
    ) => {
      if (!sceneSlideNumber) return;
      animationTargets.push({
        slideNumber: sceneSlideNumber,
        objectName: outgoingObjectName,
        animation: { ...animation, action: undefined, phase: 'exit', effect: 'fade' },
      });
      animationTargets.push({
        slideNumber: sceneSlideNumber,
        objectName: incomingObjectName,
        animation: {
          ...animation,
          action: undefined,
          phase: 'enter',
          effect: 'fade',
          start: 'withPrevious',
        },
      });
    };
    slide.background = { color: hex(colors.background) };
    const backgroundImage = await resolveImage(scene.backgroundUrl);
    const backgroundVideo = await resolveVideo(scene.backgroundVideoUrl);
    if (backgroundVideo) {
      const objectName = `ppt-scene-video-${scene.id}`;
      slide.addMedia({
        type: 'video',
        data: backgroundVideo,
        objectName,
        cover: backgroundImage,
        ...fullContentFrame,
      });
      if (sceneSlideNumber) {
        videoPlaybackTargets.push({
          slideNumber: sceneSlideNumber,
          objectName,
          loop: pptSettings.videoLoopByScene?.[scene.id] ?? false,
        });
      }
      addAnimationTargets(objectName, 'background');
    }
    // `cover` belongs to the video object and is shown by PowerPoint before
    // playback. Do not add it as another full-slide image afterwards: that
    // image is stacked above the media object and hides the video controls.
    if (!backgroundVideo && backgroundImage) {
      const objectName = `ppt-scene-${scene.id}`;
      slide.addImage({
        data: backgroundImage,
        objectName,
        ...fullContentFrame,
        sizing: { type: 'cover', ...fullContentFrame },
      });
      if (!backgroundVideo) addAnimationTargets(objectName, 'background');
      let currentBackgroundObjectName = objectName;
      for (const [index, animation] of sceneAnimations
        .filter(
          (item) => item.target === 'background' && item.action === 'switch' && item.switchImageUrl,
        )
        .entries()) {
        const switchImage = await resolveImage(animation.switchImageUrl);
        if (!switchImage) continue;
        const nextObjectName = `${objectName}-switch-${index}`;
        slide.addImage({
          data: switchImage,
          objectName: nextObjectName,
          ...fullContentFrame,
          sizing: { type: 'cover', ...fullContentFrame },
        });
        addNativeSwitch(currentBackgroundObjectName, nextObjectName, animation);
        currentBackgroundObjectName = nextObjectName;
      }
    } else if (!backgroundVideo) {
      const objectName = `ppt-scene-${scene.id}`;
      slide.addShape(pptx.ShapeType.rect, {
        objectName,
        ...fullContentFrame,
        fill: { color: hex(colors.background) },
        line: { transparency: 100 },
      });
      if (!backgroundVideo) addAnimationTargets(objectName, 'background');
      let currentBackgroundObjectName = objectName;
      for (const [index, animation] of sceneAnimations
        .filter(
          (item) => item.target === 'background' && item.action === 'switch' && item.switchImageUrl,
        )
        .entries()) {
        const switchImage = await resolveImage(animation.switchImageUrl);
        if (!switchImage) continue;
        const nextObjectName = `${objectName}-switch-${index}`;
        slide.addImage({
          data: switchImage,
          objectName: nextObjectName,
          ...fullContentFrame,
          sizing: { type: 'cover', ...fullContentFrame },
        });
        addNativeSwitch(currentBackgroundObjectName, nextObjectName, animation);
        currentBackgroundObjectName = nextObjectName;
      }
    }

    for (const character of scene.characters) {
      const characterImage = await resolveImage(character.imageUrl);
      if (!characterImage) continue;
      const scale = character.scale || 1;
      const width = 13.333 * (CHARACTER_STAGE_MAX_WIDTH_PERCENT / 100) * scale;
      const height = 7.5 * (CHARACTER_STAGE_MAX_HEIGHT_PERCENT / 100) * scale;
      const baseX =
        character.position === 'left' ? 0.24 : character.position === 'right' ? 0.76 : 0.5;
      const x = Math.max(
        0,
        Math.min(13.333 - width, 13.333 * (baseX + character.offsetX / 1000) - width / 2),
      );
      const y = Math.max(
        0,
        Math.min(7.5 - height, 7.5 - height - (7.5 * character.offsetY) / 1000),
      );
      const characterFrame = page.frame(x, y, width, height);
      const imageFrame = fitImageContain(
        await getPptImageDimensions(characterImage),
        characterFrame,
      );
      const objectName = `ppt-character-${scene.id}-${character.sourceNodeId}`;
      slide.addImage({
        data: characterImage,
        objectName,
        ...imageFrame,
        transparency: 0,
        flipH: character.flipX,
      });
      addAnimationTargets(objectName, 'character', character.sourceNodeId);
      let currentCharacterObjectName = objectName;
      for (const [index, animation] of sceneAnimations
        .filter(
          (item) =>
            item.target === 'character' &&
            item.targetId === character.sourceNodeId &&
            item.action === 'switch' &&
            item.switchImageUrl,
        )
        .entries()) {
        const switchImage = await resolveImage(animation.switchImageUrl);
        if (!switchImage) continue;
        const nextObjectName = `${objectName}-switch-${index}`;
        slide.addImage({
          data: switchImage,
          objectName: nextObjectName,
          ...imageFrame,
          transparency: 0,
          flipH: character.flipX,
        });
        addNativeSwitch(currentCharacterObjectName, nextObjectName, animation);
        currentCharacterObjectName = nextObjectName;
      }
    }

    const objects = getRenderObjects(style);
    const panel = objects.dialogBox;
    const title = objects.title;
    const body = objects.body;
    const nameplate = objects.nameplate;
    const layout = resolvePresentationDialogueLayout(1920, 1080, style);
    const panelX = (layout.x / 1920) * 13.333;
    const panelY = (layout.y / 1080) * 7.5;
    const panelW = (layout.width / 1920) * 13.333;
    const panelH = (layout.height / 1080) * 7.5;
    const panelPaddingX = (layout.paddingX / 1920) * 13.333;
    const panelPaddingY = (layout.paddingY / 1080) * 7.5;
    const panelFrame = page.frame(panelX, panelY, panelW, panelH);
    if (panel.visible) {
      const objectName = `ppt-dialog-panel-${scene.id}`;
      slide.addShape(pptx.ShapeType.roundRect, {
        objectName,
        ...panelFrame,
        rectRadius: Math.max(0.02, panel.radius / 180),
        fill: { color: hex(panel.fill.color), transparency: 100 - panel.fill.alpha },
        line: panel.stroke.enabled
          ? {
              color: hex(panel.stroke.color),
              transparency: 100 - panel.stroke.alpha,
              width: panel.stroke.width,
            }
          : { transparency: 100 },
        rotate: panel.rotation,
      });
      addAnimationTargets(objectName, 'dialog-panel');
    }
    const hasTitle = title.visible && Boolean(scene.title.trim());
    if (hasTitle) {
      const objectName = `ppt-dialog-title-${scene.id}`;
      slide.addText(scene.title, {
        objectName,
        ...page.frame(
          panelX + panelPaddingX + title.x / 144,
          panelY + panelPaddingY + title.y / 144,
          Math.min(panelW - panelPaddingX * 2, (panelW * title.width) / 100),
          Math.max(0.18, title.height / 144),
        ),
        fontFace: toPptFontFace(title.fontFamily),
        fontSize: Math.max(8 * page.scale, title.fontSize * 0.75 * page.scale),
        bold: title.fontWeight >= 700,
        color: hex(title.fill.color),
        align: title.textAlign,
        margin: 0,
        breakLine: false,
        rotate: title.rotation,
      });
      addAnimationTargets(objectName, 'dialog-title');
    }
    if (body.visible) {
      const bodyX = panelX + panelPaddingX + body.x / 144;
      const bodyY =
        panelY + panelPaddingY + (hasTitle ? title.height / 144 + 0.08 : 0) + body.y / 144;
      const bodyW = Math.min(panelW - panelPaddingX * 2, (panelW * body.width) / 100);
      const bodyH = Math.max(0.2, body.height / 144);
      const bodyFontSize = Math.max(8 * page.scale, body.fontSize * 0.75 * page.scale);
      const lineWipe = sceneAnimations.find(
        (animation) =>
          animation.target === 'dialog-body' &&
          (animation.phase || 'enter') === 'enter' &&
          animation.effect === 'wipe' &&
          animation.textBuild?.mode === 'line-wipe',
      );
      if (lineWipe) {
        const lines = splitPptTextLines(scene.text || ' ', bodyW * 72, bodyFontSize);
        const lineHeight = Math.max(0.2, (bodyFontSize / 72) * (body.lineHeight || 1.45));
        lines.forEach((line, index) => {
          const objectName = `ppt-dialog-body-${scene.id}-line-${index + 1}`;
          slide.addText(line, {
            objectName,
            ...page.frame(
              bodyX,
              bodyY + index * lineHeight,
              bodyW,
              Math.min(lineHeight + 0.04, bodyH),
            ),
            fontFace: toPptFontFace(body.fontFamily),
            fontSize: bodyFontSize,
            bold: body.fontWeight >= 700,
            color: hex(body.fill.color),
            align: body.textAlign,
            breakLine: false,
            margin: 0,
            valign: 'middle',
            rotate: body.rotation,
          });
          if (sceneSlideNumber) {
            animationTargets.push({
              slideNumber: sceneSlideNumber,
              objectName,
              animation: {
                ...lineWipe,
                textBuild: undefined,
                start: index === 0 ? lineWipe.start : 'afterPrevious',
                delayMs: index === 0 ? lineWipe.delayMs : lineWipe.textBuild.lineGapMs,
              },
            });
          }
        });
      } else {
        const objectName = `ppt-dialog-body-${scene.id}`;
        slide.addText(scene.text || ' ', {
          objectName,
          ...page.frame(bodyX, bodyY, bodyW, bodyH),
          fontFace: toPptFontFace(body.fontFamily),
          fontSize: bodyFontSize,
          bold: body.fontWeight >= 700,
          color: hex(body.fill.color),
          align: body.textAlign,
          breakLine: false,
          margin: 0,
          valign: 'middle',
          rotate: body.rotation,
        });
        addAnimationTargets(objectName, 'dialog-body');
      }
    }
    if (style.nameplateVisible && nameplate.visible) {
      const name = scene.characters.find((character) => character.name)?.name || scene.title;
      const x = Math.max(0, Math.min(11.8, 0.93 + nameplate.x / 100));
      const y = Math.max(0, Math.min(7.0, 5.63 - nameplate.y / 100));
      const w = Math.max(1.1, Math.min(5, (13.333 * nameplate.width) / 100));
      const h = Math.max(0.26, nameplate.height / 100);
      const nameplateFrame = page.frame(x, y, w, h);
      const objectName = `ppt-nameplate-${scene.id}`;
      slide.addShape(pptx.ShapeType.roundRect, {
        objectName,
        ...nameplateFrame,
        rectRadius: Math.max(0.02, nameplate.radius / 180),
        fill: { color: hex(nameplate.fill.color), transparency: 100 - nameplate.fill.alpha },
        line: nameplate.stroke.enabled
          ? {
              color: hex(nameplate.stroke.color),
              transparency: 100 - nameplate.stroke.alpha,
              width: nameplate.stroke.width,
            }
          : { transparency: 100 },
        rotate: nameplate.rotation,
      });
      addAnimationTargets(objectName, 'nameplate');
      slide.addText(name, {
        ...page.frame(x + 0.06, y + 0.05, w - 0.12, Math.max(0.16, h - 0.1)),
        fontFace: toPptFontFace(nameplate.fontFamily),
        fontSize: Math.max(8 * page.scale, nameplate.fontSize * 0.66 * page.scale),
        bold: nameplate.fontWeight >= 700,
        color: hex(style.nameplateTextColor || '#FFFFFF'),
        align: nameplate.textAlign,
        margin: 0,
        rotate: nameplate.rotation,
      });
    }
    const sceneNotes =
      pptSettings.speakerNotes?.[scene.id] ||
      `节点：${scene.id}\n\n${scene.text}\n\n${scene.choices.map((choice) => `- ${choice.label}`).join('\n')}`;
    if (pptSettings.includeNotes || !authorNoteWritten) {
      slide.addNotes(authorNoteWritten ? sceneNotes : `${authorNote}\n\n${sceneNotes}`);
      authorNoteWritten = true;
    }

    await appendManualSlides(scene.id);

    if (pptSettings.branchMode === 'linear' || scene.choices.length < 2) continue;

    const choiceSlide = pptx.addSlide();
    choiceSlide.background = { color: hex(colors.background) };
    const choiceBackgroundImage = backgroundVideo
      ? (await toPptVideoLastFrameData(scene.backgroundVideoUrl)) || backgroundImage
      : backgroundImage;
    if (choiceBackgroundImage) {
      choiceSlide.addImage({
        data: choiceBackgroundImage,
        ...fullContentFrame,
        sizing: { type: 'cover', ...fullContentFrame },
      });
    }
    choiceSlide.addShape(pptx.ShapeType.rect, {
      ...fullContentFrame,
      fill: { color: '0F172A', transparency: 42 },
      line: { transparency: 100 },
    });
    choiceSlide.addText('CHOOSE YOUR ROUTE', {
      ...page.frame(1.1, 1.08, 11.1, 0.3),
      fontSize: 12 * page.scale,
      bold: true,
      charSpacing: 3,
      color: 'D1D5DB',
      align: 'center',
      margin: 0,
    });
    choiceSlide.addText('你的选择是？', {
      ...page.frame(1.1, 1.48, 11.1, 0.55),
      fontFace: toPptFontFace(style.titleFontFamily),
      fontSize: 28 * page.scale,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      margin: 0,
    });
    scene.choices.forEach((choice, index) => {
      const targetSlide = choice.targetId ? slideByNodeId.get(choice.targetId) : undefined;
      const y = 2.32 + index * 0.86;
      choiceSlide.addShape(pptx.ShapeType.roundRect, {
        ...page.frame(2.0, y, 9.33, 0.62),
        rectRadius: 0.08,
        fill: { color: '111827', transparency: 14 },
        line: { color: 'FFFFFF', transparency: 62 },
        hyperlink:
          pptSettings.branchMode === 'interactive' && targetSlide
            ? { slide: targetSlide }
            : undefined,
      });
      choiceSlide.addShape(pptx.ShapeType.ellipse, {
        ...page.frame(2.28, y + 0.12, 0.38, 0.38),
        fill: { color: hex(colors.choice) },
        line: { transparency: 100 },
      });
      choiceSlide.addText(String(index + 1), {
        ...page.frame(2.28, y + 0.165, 0.38, 0.16),
        fontSize: 8 * page.scale,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
        margin: 0,
      });
      choiceSlide.addText(choice.label, {
        ...page.frame(2.86, y + 0.15, 8.0, 0.27),
        fontFace: toPptFontFace(style.bodyFontFamily),
        fontSize: 16 * page.scale,
        bold: true,
        color: 'FFFFFF',
        margin: 0,
        hyperlink:
          pptSettings.branchMode === 'interactive' && targetSlide
            ? { slide: targetSlide }
            : undefined,
      });
    });
    if (pptSettings.includeNotes)
      choiceSlide.addNotes(
        `选择节点：${scene.id}\n\n${scene.choices.map((choice, index) => `${index + 1}. ${choice.label}`).join('\n')}`,
      );
    await appendManualSlides(`choice:${scene.id}`);
  }
  const buffer = (await pptx.write({
    outputType: 'arraybuffer',
    compression: true,
  })) as ArrayBuffer;
  return finalizePptxForPowerPoint(buffer, animationTargets, videoPlaybackTargets);
}
