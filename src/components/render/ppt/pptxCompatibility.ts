import JSZip from 'jszip';

import type { PptObjectAnimation } from '../video/shared/types';

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

const xmlEscape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const findShapeId = (slideXml: string, objectName: string) =>
  slideXml.match(new RegExp(`<p:cNvPr id="(\\d+)" name="${xmlEscape(objectName)}"`))?.[1];
const duration = (animation: PptObjectAnimation) =>
  Math.max(1, Math.round(animation.durationMs || 500));
const delay = (animation: PptObjectAnimation) => Math.max(0, Math.round(animation.delayMs || 0));
const nodeType = (animation: PptObjectAnimation) =>
  animation.start === 'withPrevious'
    ? 'withEffect'
    : animation.start === 'afterPrevious'
      ? 'afterEffect'
      : 'clickEffect';
const startDelay = (animation: PptObjectAnimation) =>
  animation.start === 'onClick' ? 'indefinite' : '0';
const phaseOf = (animation: PptObjectAnimation) => animation.phase || 'enter';

const shapeTarget = (shapeId: string) => `<p:tgtEl><p:spTgt spid="${shapeId}"/></p:tgtEl>`;
const behavior = (id: number, shapeId: string, animation: PptObjectAnimation, extra = '') =>
  `<p:cBhvr additive="base" accumulate="none"><p:cTn id="${id}" dur="${duration(animation)}" fill="hold"${
    animation.repeats && animation.repeats > 1
      ? ` repeatCount="${Math.round(animation.repeats)}"`
      : ''
  }${extra}/>${shapeTarget(shapeId)}</p:cBhvr>`;

const visibilitySet = (id: number, shapeId: string, visible: boolean) =>
  `<p:set><p:cBhvr><p:cTn id="${id}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${shapeTarget(shapeId)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${
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
  const amount = Math.max(
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
  );
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
  return animation.effect;
};

const effectXml = (id: number, shapeId: string, animation: PptObjectAnimation) => {
  const phase = phaseOf(animation);
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

const animationXml = (shapeId: string, animation: PptObjectAnimation, index: number) => {
  const baseId = 3 + index * 10;
  const phase = phaseOf(animation);
  const presetClass = phase === 'enter' ? 'entr' : phase === 'exit' ? 'exit' : 'emph';
  const presetId =
    animation.effect === 'appear'
      ? 1
      : animation.effect === 'fade'
        ? 10
        : animation.effect === 'fly' || animation.effect === 'line'
          ? 2
          : animation.effect === 'zoom'
            ? 23
            : 0;
  const visibility = phase === 'enter' ? visibilitySet(baseId + 1, shapeId, true) : '';
  const hideAfter = phase === 'exit' ? visibilitySet(baseId + 2, shapeId, false) : '';
  return `<p:par><p:cTn id="${baseId}" fill="hold"><p:stCondLst><p:cond delay="${startDelay(animation)}"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${baseId + 3}" fill="hold"><p:stCondLst><p:cond delay="${delay(
    animation,
  )}"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${baseId + 4}" presetID="${presetId}" presetClass="${presetClass}" presetSubtype="0" fill="hold" grpId="0" nodeType="${nodeType(
    animation,
  )}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${visibility}${effectXml(
    baseId + 5,
    shapeId,
    animation,
  )}${hideAfter}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
};

const videoPlaybackXml = (shapeId: string, id: number, loop: boolean) =>
  `<p:video><p:cMediaNode vol="80000"><p:cTn id="${id}"${
    loop ? ' repeatCount="indefinite"' : ''
  } fill="hold" display="0" nodeType="withEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${shapeTarget(
    shapeId,
  )}</p:cMediaNode></p:video>`;

const animationTimelineXml = (
  targets: Array<{ shapeId: string; animation: PptObjectAnimation }>,
  videoTargets: Array<{ shapeId: string; loop: boolean }>,
) => {
  if (!targets.length && !videoTargets.length) return '';
  const entries = targets
    .map((target, index) => animationXml(target.shapeId, target.animation, index))
    .join('');
  const buildList = targets
    .map((target) => `<p:bldP spid="${target.shapeId}" grpId="0" animBg="1"/>`)
    .join('');
  const mainSequence = entries
    ? `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${entries}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>`
    : '';
  const videos = videoTargets
    .map((target, index) => videoPlaybackXml(target.shapeId, 3 + targets.length * 10 + index, target.loop))
    .join('');
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>${mainSequence}${videos}</p:childTnLst></p:cTn></p:par></p:tnLst>${buildList ? `<p:bldLst>${buildList}</p:bldLst>` : ''}</p:timing>`;
};

const addNativeAnimations = async (
  archive: JSZip,
  targets: PptAnimationExportTarget[],
  videoTargets: PptVideoPlaybackTarget[],
) => {
  const targetsBySlide = new Map<number, PptAnimationExportTarget[]>();
  const videosBySlide = new Map<number, PptVideoPlaybackTarget[]>();
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

  for (const slideNumber of new Set([...targetsBySlide.keys(), ...videosBySlide.keys()])) {
    const slideTargets = targetsBySlide.get(slideNumber) || [];
    const slideVideos = videosBySlide.get(slideNumber) || [];
    const path = `ppt/slides/slide${slideNumber}.xml`;
    const slideXml = await archive.file(path)?.async('string');
    if (!slideXml) continue;
    const resolved = slideTargets
      .map((target) => ({
        shapeId: findShapeId(slideXml, target.objectName),
        animation: target.animation,
      }))
      .filter((target): target is { shapeId: string; animation: PptObjectAnimation } =>
        Boolean(target.shapeId),
      );
    const resolvedVideos = slideVideos
      .map((target) => ({ shapeId: findShapeId(slideXml, target.objectName), loop: target.loop }))
      .filter((target): target is { shapeId: string; loop: boolean } => Boolean(target.shapeId));
    const timeline = animationTimelineXml(resolved, resolvedVideos);
    if (!timeline) continue;
    archive.file(
      path,
      slideXml
        .replace(/<p:timing>[\s\S]*?<\/p:timing>/, '')
        .replace('</p:sld>', `${timeline}</p:sld>`),
    );
  }
};

export async function finalizePptxForPowerPoint(
  buffer: ArrayBuffer,
  animationTargets: PptAnimationExportTarget[] = [],
  videoTargets: PptVideoPlaybackTarget[] = [],
): Promise<ArrayBuffer> {
  const archive = await JSZip.loadAsync(buffer);
  const contentTypes = await archive.file(CONTENT_TYPES_PATH)?.async('string');
  if (!contentTypes) throw new Error('PPTX export is missing [Content_Types].xml');
  archive.file(CONTENT_TYPES_PATH, removeMissingSlideMasterOverrides(contentTypes));
  await addNativeAnimations(archive, animationTargets, videoTargets);
  return archive.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
