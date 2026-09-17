import { resolveDialogueTextLayout, revealLayoutLines } from '../../shared/presentationTextLayout';
import type { Node as FlowNode } from '@xyflow/react';
import type { StoryPresentation } from '../../../../domain/project';
import { presentationPlaybackStateAtTime } from '../../../../lib/inlinePresentationPlayback';
import {
  getPresentationContentWindow,
  normalizeStoryPresentation,
} from '../../../../lib/presentation';
import { htmlToSpeechText } from '../../../../lib/tts';
import { animatedTextState } from '../canvas/textAnimation';
import { getNameplateItems } from './nameplateRenderer';
import { getVideoRenderObjects } from './renderObjects';
import { filterMentionTags } from './storyNodes';
import type { RenderStyle } from './types';

/** The renderer and selection overlay share text, wrapping, timing and baselines. */
export function resolveVideoTextLayout({
  ctx,
  node,
  nodes,
  width,
  height,
  style,
  elapsed,
  duration,
  forceFinalText = false,
  isZh,
  hideCharacterTags,
  hideSceneTags,
}: {
  ctx: CanvasRenderingContext2D;
  node: FlowNode;
  nodes: FlowNode[];
  width: number;
  height: number;
  style: RenderStyle;
  elapsed?: number;
  duration?: number;
  forceFinalText?: boolean;
  isZh: boolean;
  hideCharacterTags: boolean;
  hideSceneTags: boolean;
}) {
  const rawBodyHtml = String(node.data?.text || '');
  const presentation = normalizeStoryPresentation(
    node.data?.presentation as StoryPresentation | undefined,
  );
  const contentWindow = getPresentationContentWindow(presentation, duration || 0);
  const contentElapsed =
    typeof elapsed === 'number' && duration ? Math.max(0, elapsed - contentWindow.start) : elapsed;
  const inlineState = presentationPlaybackStateAtTime({
    html: rawBodyHtml,
    presentation,
    elapsed,
    duration,
    options: { hideCharacterTags, hideSceneTags },
  });
  const plainText = (html: string) =>
    htmlToSpeechText(filterMentionTags(html, hideCharacterTags, hideSceneTags));
  const objects = getVideoRenderObjects(style);
  const fixed = resolveDialogueTextLayout(ctx, {
    width, height, style,
    title: htmlToSpeechText(String(node.data?.title || '')),
    body: plainText(rawBodyHtml), hideTitle: node.data?.hideTitleInPlayback === true,
  });
  const animate = (kind: 'title' | 'body') => {
    const block = fixed[kind];
    const lines = kind === 'body' && !forceFinalText
      ? revealLayoutLines(block, Array.from(plainText(inlineState.html)).length) : block.lines;
    const state = animatedTextState(objects[kind].animation.animation, lines,
      objects[kind].animation.durationMs, contentElapsed, forceFinalText, objects[kind].animation.typewriterMode);
    return { ...block, lines: state.lines, firstBaseline: block.firstBaseline + state.offsetY,
      top: block.top + state.offsetY, alpha: state.alpha };
  };
  return { objects, inlineState, dialog: fixed.dialog,
    nameplateItems: getNameplateItems(node, nodes), nameplateReservedHeight: 0,
    title: animate('title'), body: animate('body') };

}
