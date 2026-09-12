import type { Node as FlowNode } from '@xyflow/react';
import type { StoryPresentation } from '../../../../domain/project';
import { inlinePlaybackStateAtTime } from '../../../../lib/inlinePresentationPlayback';
import { normalizeStoryPresentation } from '../../../../lib/presentation';
import { htmlToSpeechText } from '../../../../lib/tts';
import { animatedTextState, revealCharacters } from '../canvas/textAnimation';
import { getVideoTextForChinesePreference } from '../i18n';
import { getDialogueBoxLayout } from './dialogueBoxRenderer';
import { getNameplateItems, getNameplateReservedHeight } from './nameplateRenderer';
import { getVideoRenderObjects } from './renderObjects';
import { filterMentionTags, wrapText } from './storyNodes';
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
  const inlineState = inlinePlaybackStateAtTime({
    html: rawBodyHtml,
    presentation: normalizeStoryPresentation(
      node.data?.presentation as StoryPresentation | undefined,
    ),
    elapsed,
    duration,
    options: { hideCharacterTags, hideSceneTags },
  });
  const plainText = (html: string) =>
    htmlToSpeechText(filterMentionTags(html, hideCharacterTags, hideSceneTags));
  const objects = getVideoRenderObjects(style);
  const baseDialog = getDialogueBoxLayout(width, height, style);
  const paddingX = baseDialog.paddingX ?? baseDialog.padding;
  const paddingY = baseDialog.paddingY ?? baseDialog.padding;
  const contentWidth = Math.max(48, baseDialog.width - paddingX * 2);
  const titleSize = Math.max(18, style.titleFontSize);
  const bodySize = Math.max(16, style.bodyFontSize);
  const titleLineHeight = Math.round(titleSize * Math.max(0.8, style.titleLineHeight));
  const bodyLineHeight = Math.round(bodySize * Math.max(0.8, style.bodyLineHeight));
  const titleWidth = Math.max(
    48,
    contentWidth * Math.min(1, Math.max(0.08, objects.title.width / 100)),
  );
  const bodyWidth = Math.max(
    48,
    contentWidth * Math.min(1, Math.max(0.08, objects.body.width / 100)),
  );
  const titleFont = `800 ${titleSize}px ${style.titleFontFamily}`;
  const bodyFont = `500 ${bodySize}px ${style.bodyFontFamily}`;
  const titleVisible = objects.title.visible && node.data?.hideTitleInPlayback !== true;

  ctx.save();
  try {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = titleFont;
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
      `${style.titleLetterSpacing ?? 0}px`;
    const titleText = titleVisible
      ? htmlToSpeechText(String(node.data?.title || '')) ||
        getVideoTextForChinesePreference(
          isZh,
          'componentsrendervideopreviewframeRendererIsZhText124',
        )
      : '';
    const titleLines = wrapText(ctx, titleText, titleWidth).slice(0, 2);
    const titleState = animatedTextState(
      objects.title.animation.animation,
      titleLines,
      objects.title.animation.durationMs,
      elapsed,
      forceFinalText,
      objects.title.animation.typewriterMode,
    );

    ctx.font = bodyFont;
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
      `${style.bodyLetterSpacing ?? 0}px`;
    const fullBodyLines = objects.body.visible
      ? wrapText(ctx, plainText(rawBodyHtml), bodyWidth).slice(0, 7)
      : [];
    const bodyLines = revealCharacters(
      fullBodyLines,
      Array.from(plainText(inlineState.html)).length,
    );
    const bodyState = animatedTextState(
      objects.body.animation.animation,
      bodyLines,
      objects.body.animation.durationMs,
      elapsed,
      forceFinalText,
      objects.body.animation.typewriterMode,
    );
    const renderedTitleLines = titleState.lines.filter((line) => line.length > 0);
    const renderedBodyLines = bodyState.lines.filter((line) => line.length > 0);
    const fullGap = titleLines.length && fullBodyLines.length ? Math.round(bodySize * 0.6) : 0;
    const renderedGap =
      renderedTitleLines.length && renderedBodyLines.length ? Math.round(bodySize * 0.6) : 0;
    const fixedTextHeight =
      titleLines.length * titleLineHeight + fullGap + fullBodyLines.length * bodyLineHeight;
    const nameplateItems = getNameplateItems(node, nodes);
    const nameplateReservedHeight = getNameplateReservedHeight(nameplateItems, ctx, style);
    const dialog = getDialogueBoxLayout(width, height, style, {
      topExtension: nameplateReservedHeight,
    });
    const textOffsetY = Math.round(
      (baseDialog.height * Math.max(-20, Math.min(40, style.dialogTextOffsetY ?? 0))) / 100,
    );
    const firstBaseline =
      dialog.y +
      nameplateReservedHeight +
      Math.max(paddingY, (dialog.height - nameplateReservedHeight - fixedTextHeight) / 2) +
      Math.round(bodySize * 0.35) +
      textOffsetY;
    const left = dialog.x + paddingX;
    return {
      objects,
      inlineState,
      dialog,
      nameplateItems,
      nameplateReservedHeight,
      title: {
        lines: renderedTitleLines,
        font: titleFont,
        fontSize: titleSize,
        lineHeight: titleLineHeight,
        left: left + objects.title.x,
        right: left + objects.title.x + titleWidth,
        firstBaseline: firstBaseline + objects.title.y + titleState.offsetY,
        alpha: titleState.alpha,
        visible: titleVisible,
      },
      body: {
        lines: renderedBodyLines,
        font: bodyFont,
        fontSize: bodySize,
        lineHeight: bodyLineHeight,
        left: left + objects.body.x,
        right: left + objects.body.x + bodyWidth,
        firstBaseline:
          firstBaseline +
          renderedTitleLines.length * titleLineHeight +
          renderedGap +
          objects.body.y +
          bodyState.offsetY,
        alpha: bodyState.alpha,
        visible: objects.body.visible,
      },
    };
  } finally {
    ctx.restore();
  }
}
