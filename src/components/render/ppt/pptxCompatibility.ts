import JSZip from 'jszip';

import type { RenderCustomFont } from '../video/shared/types';
import type { PptObjectAnimation } from '../video/shared/types';
import { embedCustomFontsInPptx } from './pptFontEmbedding';
import { pptTextLineTiming } from './pptTextBuild';
import { addNativePptTransitions, type PptTransitionExportTarget } from './pptTransitionExport';
import { replacePptSlideProperty } from './pptSlideXml';

const CONTENT_TYPES_PATH = '[Content_Types].xml';

/**
 * PptxGenJS 4.0.1 registers a slide-master override for every slide, even
 * though the package contains only one slide master. PowerPoint treats those
 * references as broken and repairs the presentation on open.
 */
const removeMissingSlideMasterOverrides = (contentTypes: string) =>
  contentTypes.replace(
    /<Override PartName="\/ppt\/slideMasters\/slideMaster(?!1\.xml")[^"]*"[^>]*\/>/g,
    '',
  );

/** CSS font stacks are invalid in OOXML attributes; PPTX needs one family. */
export const toPptFontFace = (fontFamily?: string) => {
  const firstFamily = fontFamily?.split(',')[0]?.trim().replace(/["']/g, '');
  return firstFamily || 'Arial';
};

export type PptAnimationExportTarget = {
  slideNumber: number;
  objectName: string;
  animation: PptObjectAnimation;
};

export type PptVideoPlaybackTarget = {
  slideNumber: number;
  objectName: string;
  loop: boolean;
};

export type PptAudioPlaybackTarget = PptVideoPlaybackTarget & { volume: number; slideCount: number };

/**
 * Keep shapes for one authored effect together, with the character first so
 * its start mode remains authoritative when merging its nameplate copies.
 */
export const orderPptAnimationTargets = (
  targets: PptAnimationExportTarget[],
  animationOrderBySlide: Map<number, Map<string, number>>,
) =>
  targets
    .map((target, index) => ({ target, index }))
    .sort((left, right) => {
      const slideOrder = left.target.slideNumber - right.target.slideNumber;
      if (slideOrder) return slideOrder;
      const animationOrder = animationOrderBySlide.get(left.target.slideNumber);
      if (!animationOrder) return left.index - right.index;
      const animationIndex =
        (animationOrder.get(left.target.animation.id) ?? Number.MAX_SAFE_INTEGER) -
        (animationOrder.get(right.target.animation.id) ?? Number.MAX_SAFE_INTEGER);
      if (animationIndex) return animationIndex;
      const targetRank = (objectName: string) =>
        objectName.startsWith('ppt-character-')
          ? 0
          : objectName.endsWith('-text') && objectName.startsWith('ppt-nameplate-')
            ? 2
            : objectName.startsWith('ppt-nameplate-')
              ? 1
              : 0;
      return (
        targetRank(left.target.objectName) - targetRank(right.target.objectName) ||
        left.index - right.index
      );
    })
    .map(({ target }) => target);

const xmlEscape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const findShapeId = (slideXml: string, objectName: string) =>
  slideXml.match(new RegExp(`<p:cNvPr id="(\\d+)" name="${xmlEscape(objectName)}"`))?.[1];
const textLineCount = (slideXml: string, objectName: string) => {
  const name = new RegExp(`<p:cNvPr id="\\d+" name="${xmlEscape(objectName)}"`);
  const shape = [...slideXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].find((match) =>
    name.test(match[0]),
  )?.[0];
  return shape ? Math.max(1, (shape.match(/<a:p(?:\s[^>]*)?>/g) || []).length) : 0;
};
const duration = (animation: PptObjectAnimation) =>
  Math.max(1, Math.round(animation.durationMs || 500));
const delay = (animation: PptObjectAnimation) => Math.max(0, Math.round(animation.delayMs || 0));
const nodeType = (animation: PptObjectAnimation) =>
  animation.start === 'withPrevious'
    ? 'withEffect'
    : animation.start === 'afterPrevious'
      ? 'afterEffect'
      : 'clickEffect';
const phaseOf = (animation: PptObjectAnimation) => animation.phase || 'enter';
const presetSubtypeFor = (animation: PptObjectAnimation) => {
  if (animation.effect === 'wipe' && animation.direction === 'left') return 1;
  if (animation.effect !== 'fly') return 0;
  // Fly In direction is the source edge, while the shared motion model stores
  // the direction in which the object travels toward its final position.
  return {
    left: 2,
    right: 8,
    up: 4,
    down: 1,
  }[animation.direction];
};

const shapeTarget = (shapeId: string, paragraph?: number) =>
  paragraph !== undefined
    ? `<p:tgtEl><p:spTgt spid="${shapeId}"><p:txEl><p:pRg st="${paragraph}" end="${paragraph}"/></p:txEl></p:spTgt></p:tgtEl>`
    : `<p:tgtEl><p:spTgt spid="${shapeId}"/></p:tgtEl>`;
const behavior = (
  id: number,
  shapeId: string,
  animation: PptObjectAnimation,
  extra = '',
  paragraph?: number,
  attributes: string[] = [],
) =>
  `<p:cBhvr additive="base" accumulate="none"><p:cTn id="${id}" dur="${duration(animation)}" fill="hold"${
    animation.repeats && animation.repeats > 1
      ? ` repeatCount="${Math.round(animation.repeats)}"`
      : ''
  }${extra}><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${shapeTarget(shapeId, paragraph)}${
    attributes.length
      ? `<p:attrNameLst>${attributes.map((name) => `<p:attrName>${name}</p:attrName>`).join('')}</p:attrNameLst>`
      : ''
  }</p:cBhvr>`;

const visibilitySet = (
  id: number, shapeId: string, visible: boolean, paragraph?: number, offsetMs = 0,
) =>
  `<p:set><p:cBhvr><p:cTn id="${id}" dur="1" fill="hold"><p:stCondLst><p:cond delay="${offsetMs}"/></p:stCondLst></p:cTn>${shapeTarget(shapeId, paragraph)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${
    visible ? 'visible' : 'hidden'
  }"/></p:to></p:set>`;

const directionVector = (direction: PptObjectAnimation['direction'], amount: number) => {
  if (direction === 'left') return [-amount, 0] as const;
  if (direction === 'right') return [amount, 0] as const;
  if (direction === 'up') return [0, -amount] as const;
  return [0, amount] as const;
};

const motionPathXml = (id: number, shapeId: string, animation: PptObjectAnimation) => {
  const phase = phaseOf(animation);
  const action = animation.action;
  // Motion paths use fractions of the slide, not DrawingML percentage units.
  // A shared path also keeps the portrait and label moving the same distance.
  const amount = animation.effect === 'fly' ? 1 : Math.max(
    24000,
    Math.min(
      180000,
      Math.round(
        Math.abs(
          action === 'translate'
            ? animation.offsetX || animation.offsetY || animation.strength || 0
            : animation.strength || 0,
        ) * 900,
      ),
    ),
  ) / 100000;
  const direction =
    action === 'translate' && Math.abs(animation.offsetY || 0) > Math.abs(animation.offsetX || 0)
      ? (animation.offsetY || 0) < 0
        ? 'up'
        : 'down'
      : animation.direction;
  const [x, y] = directionVector(direction, amount);
  const isShake = action === 'shake-x' || action === 'shake-y';
  const isEntrance = phase === 'enter';
  const isExit = phase === 'exit';
  const path = isEntrance
    ? `M ${-x} ${-y} L 0 0 E`
    : isExit
      ? `M 0 0 L ${x} ${y} E`
      : isShake
        ? `M 0 0 L ${x} ${y} L ${-x} ${-y} L 0 0 E`
        : `M 0 0 L ${x} ${y} E`;
  return `<p:animMotion origin="layout" path="${path}" pathEditMode="relative" rAng="0">${behavior(
    id,
    shapeId,
    animation,
    isShake ? ' autoRev="1"' : '',
    undefined,
    ['ppt_x', 'ppt_y'],
  )}</p:animMotion>`;
};

const scaleXml = (id: number, shapeId: string, animation: PptObjectAnimation) => {
  const phase = phaseOf(animation);
  const targetScale = Math.max(
    0.1,
    Math.min(3, animation.scale || 1 + (animation.strength || 12) / 100),
  );
  const percentage = Math.round(targetScale * 100000);
  const startsSmall = phase === 'enter';
  const endsSmall = phase === 'exit';
  const x = startsSmall ? 82000 : endsSmall ? 82000 : percentage;
  const y = x;
  const autoReverse = animation.action === 'pulse' ? ' autoRev="1"' : '';
  return `<p:animScale zoomContents="1">${behavior(id, shapeId, animation, autoReverse)}<p:by x="${x}" y="${y}"/></p:animScale>`;
};

const rotationXml = (id: number, shapeId: string, animation: PptObjectAnimation) =>
  `<p:animRot by="${Math.round((animation.strength || 15) * 60000)}">${behavior(
    id,
    shapeId,
    animation,
  )}</p:animRot>`;

const filterFor = (animation: PptObjectAnimation) => {
  if (animation.effect === 'transparency') return 'transparency';
  if (animation.effect === 'darken')
    return animation.strength && animation.strength > 100 ? 'lighten' : 'darken';
  if (animation.effect === 'lighten') return 'lighten';
  if (animation.effect === 'pulse') return 'pulse';
  if (animation.effect === 'wiggle') return 'teeter';
  if (animation.effect === 'fade') return 'fade';
  if (animation.effect === 'appear') return 'appear';
  if (animation.effect === 'fly') {
    const sourceEdge = {
      left: 'fromRight',
      right: 'fromLeft',
      up: 'fromBottom',
      down: 'fromTop',
    }[animation.direction];
    return `slide(${sourceEdge})`;
  }
  if (animation.effect === 'wipe') return `wipe(${animation.direction})`;
  return animation.effect;
};

const effectXml = (id: number, shapeId: string, animation: PptObjectAnimation) => {
  const phase = phaseOf(animation);
  // Keep line-aware timing in the workspace, but export the text as the
  // native PowerPoint wipe effect instead of a per-character fade build.
  if (animation.effect === 'line' || animation.effect === 'fly')
    return motionPathXml(id, shapeId, animation);
  if (animation.effect === 'zoom' || animation.effect === 'growShrink')
    return scaleXml(id, shapeId, animation);
  if (animation.effect === 'spin') return rotationXml(id, shapeId, animation);
  return `<p:animEffect transition="${phase === 'exit' ? 'out' : 'in'}" filter="${filterFor(animation)}">${behavior(
    id,
    shapeId,
    animation,
  )}</p:animEffect>`;
};

type ResolvedAnimationTarget = {
  shapeId: string;
  animation: PptObjectAnimation;
  lineCount: number;
};

const animationXml = (
  targets: ResolvedAnimationTarget[],
  allocateId: () => number,
  offsetMs: number,
) => {
  const animation = targets[0].animation;
  const id = allocateId();
  const phase = phaseOf(animation);
  const presetClass = phase === 'enter' ? 'entr' : phase === 'exit' ? 'exit' : 'emph';
  const presetId =
    animation.effect === 'appear'
      ? 1
      : animation.effect === 'fade'
        ? 10
        : animation.effect === 'fly' || animation.effect === 'line'
          ? 2
          : animation.effect === 'wipe'
            ? 22
            : animation.effect === 'zoom'
              ? 23
              : 0;
  const effects = targets.map(({ shapeId, animation: targetAnimation, lineCount }) => {
    const lineBuild = targetAnimation.textBuild && phase === 'enter';
    const visibility = phase === 'enter' && !lineBuild
      ? visibilitySet(allocateId(), shapeId, true) : '';
    const effect = lineBuild
      ? Array.from({ length: lineCount }, (_, paragraph) => {
          const timing = pptTextLineTiming(targetAnimation, lineCount, paragraph);
          const lineId = allocateId();
          const lineAnimation = { ...targetAnimation, durationMs: timing.durationMs };
          return `<p:par><p:cTn id="${lineId}" fill="hold"><p:stCondLst><p:cond delay="${Math.round(timing.offsetMs)}"/></p:stCondLst><p:childTnLst>${visibilitySet(allocateId(), shapeId, true, paragraph)}<p:animEffect transition="in" filter="wipe(${targetAnimation.direction})">${behavior(allocateId(), shapeId, lineAnimation, '', paragraph)}</p:animEffect></p:childTnLst></p:cTn></p:par>`;
        }).join('')
      : effectXml(allocateId(), shapeId, targetAnimation);
    const hideAfter = phase === 'exit'
      ? visibilitySet(allocateId(), shapeId, false, undefined, duration(targetAnimation)) : '';
    return `${visibility}${effect}${hideAfter}`;
  }).join('');
  // All shapes for one authored effect share its trigger and delay. Copies
  // cannot add clicks, delays, or durations to the following dialogue effect.
  return `<p:par><p:cTn id="${id}" presetID="${presetId}" presetClass="${presetClass}" presetSubtype="${presetSubtypeFor(animation)}" fill="hold" grpId="0" nodeType="${nodeType(animation)}"><p:stCondLst><p:cond delay="${offsetMs}"/></p:stCondLst><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par>`;
};

const videoPlaybackXml = (shapeId: string, id: number, loop: boolean) =>
  `<p:video><p:cMediaNode vol="80000"><p:cTn id="${id}"${
    loop ? ' repeatCount="indefinite"' : ''
  } fill="hold" display="0" nodeType="withEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${shapeTarget(
    shapeId,
  )}</p:cMediaNode></p:video>`;

const animationTimelineXml = (
  targets: ResolvedAnimationTarget[],
  videoTargets: Array<{ shapeId: string; loop: boolean }>,
  audioTargets: Array<{ shapeId: string; loop: boolean; volume: number; slideCount: number }> = [],
) => {
  if (!targets.length && !videoTargets.length && !audioTargets.length) return '';
  let nextId = 3;
  const allocateId = () => nextId++;
  const effectsById = new Map<string, ResolvedAnimationTarget[]>();
  targets.forEach((target) => {
    const group = effectsById.get(target.animation.id) || [];
    if (!group.some((item) => item.shapeId === target.shapeId)) group.push(target);
    effectsById.set(target.animation.id, group);
  });
  const clickGroups: Array<{ id: number; onClick: boolean; effects: string[] }> = [];
  let previousStart = 0;
  let previousDuration = 0;
  for (const group of effectsById.values()) {
    const animation = group[0].animation;
    if (!clickGroups.length || animation.start === 'onClick') {
      clickGroups.push({ id: allocateId(), onClick: animation.start === 'onClick', effects: [] });
      previousStart = 0;
      previousDuration = 0;
    }
    const start = previousStart +
      (animation.start === 'afterPrevious' ? previousDuration : 0) + delay(animation);
    clickGroups[clickGroups.length - 1].effects.push(animationXml(group, allocateId, start));
    previousStart = start;
    previousDuration = duration(animation);
  }
  const entries = clickGroups.map((group) =>
    `<p:par><p:cTn id="${group.id}" fill="hold"><p:stCondLst><p:cond delay="${group.onClick ? 'indefinite' : '0'}"/></p:stCondLst><p:childTnLst>${group.effects.join('')}</p:childTnLst></p:cTn></p:par>`,
  ).join('');
  const mainSequence = entries
    ? `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${entries}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>`
    : '';
  const videos = videoTargets
    .map(target => videoPlaybackXml(target.shapeId, allocateId(), target.loop))
    .join('');
  const audio = audioTargets.map(target =>
    `<p:audio isNarration="0"><p:cMediaNode vol="${Math.round(Math.max(0, Math.min(1, target.volume)) * 100000)}" numSld="${target.slideCount}" showWhenStopped="0"><p:cTn id="${allocateId()}" dur="indefinite"${target.loop ? ' repeatCount="indefinite"' : ''} fill="hold" display="0" nodeType="withEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${shapeTarget(target.shapeId)}</p:cMediaNode></p:audio>`
  ).join('');
  const textShapes = [
    ...new Set(
      targets.filter((target) => target.animation.textBuild && phaseOf(target.animation) === 'enter')
        .map((target) => target.shapeId),
    ),
  ];
  const builds = textShapes.length
    ? `<p:bldLst>${textShapes.map((shapeId) => `<p:bldP spid="${shapeId}" grpId="0" build="p" animBg="0"/>`).join('')}</p:bldLst>`
    : '';
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>${mainSequence}${videos}${audio}</p:childTnLst></p:cTn></p:par></p:tnLst>${builds}</p:timing>`;
};

const addNativeAnimations = async (
  archive: JSZip,
  targets: PptAnimationExportTarget[],
  videoTargets: PptVideoPlaybackTarget[],
  audioTargets: PptAudioPlaybackTarget[],
) => {
  const targetsBySlide = new Map<number, PptAnimationExportTarget[]>();
  const videosBySlide = new Map<number, PptVideoPlaybackTarget[]>();
  const audiosBySlide = new Map<number, PptAudioPlaybackTarget[]>();
  audioTargets.forEach(target => {
    const current = audiosBySlide.get(target.slideNumber) || [];
    current.push(target);
    audiosBySlide.set(target.slideNumber, current);
  });
  targets
    .filter((target) => target.animation.effect !== 'none')
    .forEach((target) => {
      const current = targetsBySlide.get(target.slideNumber) || [];
      current.push(target);
      targetsBySlide.set(target.slideNumber, current);
    });

  videoTargets.forEach((target) => {
    const current = videosBySlide.get(target.slideNumber) || [];
    current.push(target);
    videosBySlide.set(target.slideNumber, current);
  });

  for (const slideNumber of new Set([...targetsBySlide.keys(), ...videosBySlide.keys(), ...audiosBySlide.keys()])) {
    const slideTargets = targetsBySlide.get(slideNumber) || [];
    const slideVideos = videosBySlide.get(slideNumber) || [];
    const path = `ppt/slides/slide${slideNumber}.xml`;
    let slideXml = await archive.file(path)?.async('string');
    if (!slideXml) continue;
    // PptxGenJS emits videoFile even for type: 'audio'. PowerPoint rejects an
    // audio relationship behind a videoFile reference and asks to repair it.
    let nextShapeId = Math.max(1, ...[...slideXml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(match => Number(match[1]))) + 1;
    for (const audio of audiosBySlide.get(slideNumber) || []) {
      slideXml = slideXml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, picture =>
        picture.includes(`name="${audio.objectName}"`)
          // The library also derives media IDs from relationships, which can
          // collide with editable text shapes on this slide.
          ? picture.replace(/<a:videoFile\b/g, '<a:audioFile')
            .replace(/<p:cNvPr id="\d+"/, `<p:cNvPr id="${nextShapeId++}"`) : picture,
      );
    }
    const resolved = slideTargets
      .map((target) => {
        const lineCount = textLineCount(slideXml, target.objectName);
        return {
          shapeId: findShapeId(slideXml, target.objectName),
          // Paragraph ranges/build lists can only target actual text shapes.
          animation: lineCount ? target.animation : { ...target.animation, textBuild: undefined },
          lineCount: lineCount || 1,
        };
      })
      .filter(
        (target): target is { shapeId: string; animation: PptObjectAnimation; lineCount: number } =>
          Boolean(target.shapeId),
      );
    const resolvedVideos = slideVideos
      .map((target) => ({ shapeId: findShapeId(slideXml, target.objectName), loop: target.loop }))
      .filter((target): target is { shapeId: string; loop: boolean } => Boolean(target.shapeId));
    const resolvedAudios = (audiosBySlide.get(slideNumber) || [])
      .flatMap(target => {
        const shapeId = findShapeId(slideXml, target.objectName);
        return shapeId ? [{ ...target, shapeId }] : [];
      });
    const timeline = animationTimelineXml(resolved, resolvedVideos, resolvedAudios);
    if (!timeline) continue;
    archive.file(path, replacePptSlideProperty(slideXml, 'timing', timeline));
  }
};

export async function finalizePptxForPowerPoint(
  buffer: ArrayBuffer,
  animationTargets: PptAnimationExportTarget[] = [],
  videoTargets: PptVideoPlaybackTarget[] = [],
  customFonts: RenderCustomFont[] = [],
  transitionTargets: PptTransitionExportTarget[] = [],
  audioTargets: PptAudioPlaybackTarget[] = [],
): Promise<ArrayBuffer> {
  const archive = await JSZip.loadAsync(buffer);
  const contentTypes = await archive.file(CONTENT_TYPES_PATH)?.async('string');
  if (!contentTypes) throw new Error('PPTX export is missing [Content_Types].xml');
  archive.file(CONTENT_TYPES_PATH, removeMissingSlideMasterOverrides(contentTypes));
  await addNativeAnimations(archive, animationTargets, videoTargets, audioTargets);
  await addNativePptTransitions(archive, transitionTargets);
  await embedCustomFontsInPptx(archive, customFonts);
  return archive.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
