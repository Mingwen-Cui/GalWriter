import type JSZip from 'jszip';

import type { PptSlideTransition } from '../video/shared/types';
import { normalizePptTransition } from './pptTransitions';
import { replacePptSlideProperty } from './pptSlideXml';

export type PptTransitionExportTarget = { slideNumber: number; transition: PptSlideTransition };

export const pptTransitionXml = (transition: PptSlideTransition) => {
  const value = normalizePptTransition(transition);
  // The UI stores the incoming edge; OOXML push/wipe store travel direction.
  const dir = { left: 'r', right: 'l', up: 'd', down: 'u' }[value.direction];
  let effect = '';
  let requires = 'p14';
  switch (value.effect) {
    case 'push':
    case 'wipe':
      effect = `<p:${value.effect} dir="${dir}"/>`;
      break;
    case 'split':
      effect = `<p:split orient="${value.orientation === 'horizontal' ? 'horz' : 'vert'}" dir="${value.splitDirection}"/>`;
      break;
    case 'randomBars':
      effect = `<p:randomBar dir="${value.orientation === 'horizontal' ? 'horz' : 'vert'}"/>`;
      break;
    case 'fade':
    case 'cut':
      effect = `<p:${value.effect}/>`;
      break;
    case 'reveal':
      effect = `<p14:reveal dir="${value.direction === 'left' ? 'l' : 'r'}" thruBlk="0"/>`;
      break;
    case 'smooth':
      effect = '<p159:morph option="byObject"/>';
      requires = 'p159';
      break;
  }
  const speed = value.durationMs <= 500 ? 'fast' : value.durationMs <= 1000 ? 'med' : 'slow';
  const attrs = `spd="${speed}" advClick="${value.advanceOnClick ? 1 : 0}"${
    value.advanceAfterMs === undefined
      ? ''
      : ` advTm="${Math.max(0, Math.round(value.advanceAfterMs))}"`
  }`;
  const fallback = value.effect === 'smooth' || value.effect === 'reveal' ? '<p:fade/>' : effect;
  return `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main"><mc:Choice Requires="${requires}"><p:transition ${attrs} p14:dur="${Math.max(1, Math.round(value.durationMs))}">${effect}</p:transition></mc:Choice><mc:Fallback><p:transition ${attrs}>${fallback}</p:transition></mc:Fallback></mc:AlternateContent>`;
};

export const addNativePptTransitions = async (
  archive: JSZip,
  targets: PptTransitionExportTarget[],
) => {
  for (const { slideNumber, transition } of targets) {
    const path = `ppt/slides/slide${slideNumber}.xml`;
    const xml = await archive.file(path)?.async('string');
    if (!xml) continue;
    const node = pptTransitionXml(transition);
    archive.file(path, replacePptSlideProperty(xml, 'transition', node));
  }
};
