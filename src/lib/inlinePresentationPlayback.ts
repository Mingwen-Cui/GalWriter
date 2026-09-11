import type { CSSProperties } from 'react';

import type { InlinePresentationAction, StoryPresentation } from '../domain/project';
import { isSwitchInlineAction } from './inlineAssetSwitch';

// Text fragments concatenate into the original rich-text structure. A tag
// action inside a paragraph may split its opening and closing HTML tags.
export type InlinePlaybackStep =
  | { kind: 'text'; html: string }
  | { kind: 'action'; action: InlinePresentationAction };

type InlinePlaybackOptions = {
  hideCharacterTags?: boolean;
  hideSceneTags?: boolean;
};

const filterPlaybackMentionTags = (
  html: string,
  { hideCharacterTags = false, hideSceneTags = false }: InlinePlaybackOptions = {},
) => {
  if (!html) return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('[data-mention-kind="video"]').forEach((node) => node.remove());
  if (hideCharacterTags) {
    container.querySelectorAll('[data-mention-kind="character"]').forEach((node) => node.remove());
  }
  if (hideSceneTags) {
    container.querySelectorAll('[data-mention-kind="scene"]').forEach((node) => node.remove());
  }
  return container.innerHTML;
};

const hasMeaningfulTextOutsideMentions = (html: string) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('.mention-chip').forEach((node) => node.remove());
  return /[\p{L}\p{N}]/u.test(container.textContent || '');
};

const mentionPlacement = (root: HTMLElement, mention: HTMLElement) => {
  const beforeRange = document.createRange();
  beforeRange.setStart(root, 0);
  beforeRange.setEndBefore(mention);
  const afterRange = document.createRange();
  afterRange.setStartAfter(mention);
  afterRange.setEnd(root, root.childNodes.length);
  const before = document.createElement('div');
  const after = document.createElement('div');
  before.appendChild(beforeRange.cloneContents());
  after.appendChild(afterRange.cloneContents());
  if (!hasMeaningfulTextOutsideMentions(before.innerHTML)) return 'start';
  if (!hasMeaningfulTextOutsideMentions(after.innerHTML)) return 'end';
  return 'inline';
};

const findInlineAction = (
  mention: HTMLElement,
  presentation: StoryPresentation,
): InlinePresentationAction | null => {
  const kind = mention.dataset.mentionKind;
  if (kind !== 'character' && kind !== 'scene') return null;
  const mentionId = mention.dataset.mentionId;
  const sourceNodeId = mention.dataset.sourceNodeId || mention.dataset.mentionSourceNodeId;
  const actions = (presentation.inlineActions || []).filter((action) => action.kind === kind);
  const exactAction = mentionId ? actions.find((action) => action.id === mentionId) : undefined;
  if (exactAction) {
    return !sourceNodeId || exactAction.sourceNodeId === sourceNodeId ? exactAction : null;
  }
  if (!sourceNodeId) return null;

  // Older documents may bind one action to a source instead of a mention.
  // A modern mention ID must never borrow another mention's action, even if
  // the two tags have the same display name or reference the same character.
  const legacyAction = actions.find(
    (action) => action.id === `${kind}:${sourceNodeId}` && action.sourceNodeId === sourceNodeId,
  );
  if (legacyAction) return legacyAction;
  if (mentionId) return null;
  const sourceActions = actions.filter((action) => action.sourceNodeId === sourceNodeId);
  return sourceActions.length === 1 ? sourceActions[0] : null;
};

export const buildInlinePlaybackSteps = (
  html: string,
  presentation: StoryPresentation,
  options: InlinePlaybackOptions = {},
): InlinePlaybackStep[] => {
  if (!html) return [];
  const container = document.createElement('div');
  container.innerHTML = html;
  const steps: InlinePlaybackStep[] = [];
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    steps.push({ kind: 'text', html: buffer });
    buffer = '';
  };

  const visibleMentionHtml = (mention: HTMLElement) => {
    const kind = mention.dataset.mentionKind;
    if (
      kind === 'video' ||
      (kind === 'character' && options.hideCharacterTags) ||
      (kind === 'scene' && options.hideSceneTags)
    ) {
      return '';
    }
    return mention.outerHTML;
  };

  const appendNode = (node: ChildNode) => {
    if (!(node instanceof HTMLElement)) {
      // Serializing a text node through the DOM preserves escaped <, > and &.
      const wrapper = document.createElement('div');
      wrapper.appendChild(node.cloneNode(true));
      buffer += wrapper.innerHTML;
      return;
    }
    if (node.classList.contains('mention-chip') || node.hasAttribute('data-mention-kind')) {
      const placement = mentionPlacement(container, node);
      const action = findInlineAction(node, presentation);
      // A tag can explicitly place a stage entrance or exit at this point in
      // the typewriter timeline, even when it appears at the beginning/end.
      if (action?.timelinePhase) {
        flush();
        steps.push({ kind: 'action', action });
        buffer += visibleMentionHtml(node);
        return;
      }
      // A scene tag often sits at the beginning or end of a card rather than
      // in the middle of a sentence. Switching its media must still be a
      // real playback step, otherwise the editor can save a switch that the
      // player/export never executes.
      if (placement !== 'inline' && action?.action === 'switch') {
        if (placement === 'start') {
          flush();
          steps.push({ kind: 'action', action });
          buffer += visibleMentionHtml(node);
          return;
        }
        buffer += visibleMentionHtml(node);
        flush();
        steps.push({ kind: 'action', action });
        return;
      }
      if (placement !== 'inline') {
        buffer += visibleMentionHtml(node);
        return;
      }
      if (action) {
        flush();
        steps.push({ kind: 'action', action });
        buffer += visibleMentionHtml(node);
      } else {
        buffer += visibleMentionHtml(node);
      }
      return;
    }

    // Keep the actual ancestor markup across text steps. Cloning a DOM Range
    // for each step would turn one <p> into several separate paragraphs.
    const shell = node.cloneNode(false) as HTMLElement;
    const shellHtml = shell.outerHTML;
    const closingTag = `</${node.tagName.toLowerCase()}>`;
    const hasClosingTag = shellHtml.endsWith(closingTag);
    if (!hasClosingTag) {
      buffer += node.outerHTML;
      return;
    }
    buffer += shellHtml.slice(0, -closingTag.length);
    Array.from(node.childNodes).forEach(appendNode);
    buffer += closingTag;
  };
  Array.from(container.childNodes).forEach(appendNode);
  flush();
  return steps.length ? steps : [{ kind: 'text', html: filterPlaybackMentionTags(html, options) }];
};

export const inlineActionTransform = (action?: InlinePresentationAction | null) => {
  if (
    !action ||
    action.action === 'none' ||
    action.action === 'pulse' ||
    action.action === 'switch'
  )
    return '';
  if (action.action === 'translate') {
    return `translate(${action.offsetX || action.strength || 0}px, ${action.offsetY || 0}px)`;
  }
  if (action.action === 'translate-x') return `translateX(${action.offsetX || action.strength}px)`;
  if (action.action === 'translate-y') return `translateY(${action.offsetY || action.strength}px)`;
  if (action.action === 'scale') return `scale(${action.scale || 1.08})`;
  return '';
};

export const isPersistentInlineAction = (action?: InlinePresentationAction | null) =>
  action?.action === 'translate' ||
  action?.action === 'translate-x' ||
  action?.action === 'translate-y' ||
  action?.action === 'rotate' ||
  action?.action === 'opacity' ||
  action?.action === 'brightness' ||
  // Keep the selected material after the temporary transition overlay completes.
  action?.action === 'switch';

export const latestPersistentInlineAction = (
  actions: InlinePresentationAction[],
  kind: 'character' | 'scene',
  sourceNodeId?: string,
) =>
  actions
    .slice()
    .reverse()
    .find(
      (action) =>
        action.kind === kind &&
        action.sourceNodeId === sourceNodeId &&
        isPersistentInlineAction(action) &&
        action.action !== 'switch',
    ) || null;

/** The visual effect and its playback timer must share the same duration. */
export const getInlineActionDuration = (action?: InlinePresentationAction | null) => {
  if (!action) return 0;
  if (action.timelinePhase === 'enter' || action.timelinePhase === 'exit') {
    return Math.max(0, action.duration || 0);
  }
  if (action.action === 'none') return 0;
  const fallback = action.action === 'switch' ? 420 : 400;
  const duration = Number.isFinite(action.duration) ? action.duration : fallback;
  return Math.max(action.action === 'switch' ? 180 : 80, duration);
};

export const inlineActionCssVars = (action?: InlinePresentationAction | null) => {
  if (!action || action.action === 'none') return {};
  const opacity = Math.max(0, Math.min(100, action.strength || 0)) / 100;
  return {
    '--inline-action-strength': `${Math.max(0, action.strength || 10)}px`,
    '--inline-action-rotation': `${Math.max(-360, Math.min(360, action.strength || 15))}deg`,
    '--inline-action-opacity': opacity,
    '--inline-action-brightness': opacity,
  };
};

/** Preserve completed effects without replaying their keyframes on a new layer. */
export const inlineActionSettledStyle = (
  action?: InlinePresentationAction | null,
): CSSProperties => {
  if (!action) return {};
  const variables = inlineActionCssVars(action);
  if (action.action === 'rotate') return { rotate: variables['--inline-action-rotation'] };
  if (action.action === 'opacity') return { opacity: variables['--inline-action-opacity'] };
  if (action.action === 'brightness') {
    return { filter: `brightness(${variables['--inline-action-brightness']})` };
  }
  return {};
};

export const inlineActionAnimation = (action?: InlinePresentationAction | null) => {
  if (!action || action.action === 'none') return undefined;
  const duration = getInlineActionDuration(action);
  const repeats = Math.max(1, Math.round(action.repeats || 1));
  const repeatDuration = duration / repeats;
  if (action.action === 'shake-x')
    return `galInlineShakeX ${repeatDuration}ms ease ${repeats} both`;
  if (action.action === 'shake-y')
    return `galInlineShakeY ${repeatDuration}ms ease ${repeats} both`;
  if (action.action === 'pulse') return `galInlinePulse ${repeatDuration}ms ease ${repeats} both`;
  if (action.action === 'rotate') return `galInlineRotate ${duration}ms ease both`;
  if (action.action === 'opacity') return `galInlineOpacity ${duration}ms ease both`;
  if (action.action === 'brightness') return `galInlineBrightness ${duration}ms ease both`;
  if (action.action === 'switch') return undefined;
  return undefined;
};

const visibleCharCount = (html: string) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container.textContent?.length || 0;
};

const sliceVisibleHtml = (html: string, length: number) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, length);
  let node = walker.nextNode();
  while (node) {
    const count = node.textContent?.length || 0;
    if (remaining <= count) {
      const range = document.createRange();
      range.setStart(container, 0);
      range.setEnd(node, remaining);
      const result = document.createElement('div');
      result.appendChild(range.cloneContents());
      return result.innerHTML;
    }
    remaining -= count;
    node = walker.nextNode();
  }
  return container.innerHTML;
};

export const inlinePlaybackStateAtTime = ({
  html,
  presentation,
  elapsed = 0,
  duration = 0,
  options = {},
}: {
  html: string;
  presentation: StoryPresentation;
  elapsed?: number;
  duration?: number;
  options?: InlinePlaybackOptions;
}) => {
  const steps = buildInlinePlaybackSteps(html, presentation, options);
  const actionSeconds = steps.reduce(
    (sum, step) => sum + (step.kind === 'action' ? getInlineActionDuration(step.action) / 1000 : 0),
    0,
  );
  const totalChars = steps.reduce(
    (sum, step) => sum + (step.kind === 'text' ? visibleCharCount(step.html) : 0),
    0,
  );
  if (!duration) {
    const completedActions = steps
      .filter(
        (step): step is { kind: 'action'; action: InlinePresentationAction } =>
          step.kind === 'action',
      )
      .map((step) => step.action);
    const completedSwitchActions = completedActions.filter(isSwitchInlineAction);
    const completedInlineActions = completedActions.filter(isPersistentInlineAction);
    return {
      html: steps
        .filter((step): step is { kind: 'text'; html: string } => step.kind === 'text')
        .map((step) => step.html)
        .join(''),
      activeAction: null as InlinePresentationAction | null,
      activeActionElapsed: 0,
      completedSwitchActions,
      completedInlineActions,
    };
  }

  const textSeconds = Math.max(0.1, duration - actionSeconds);
  const secondsPerChar = totalChars > 0 ? textSeconds / totalChars : 0;
  let cursor = Math.max(0, elapsed);
  let visibleHtml = '';
  const completedSwitchActions: InlinePresentationAction[] = [];
  const completedInlineActions: InlinePresentationAction[] = [];

  for (const step of steps) {
    if (step.kind === 'action') {
      const actionDuration = getInlineActionDuration(step.action) / 1000;
      if (cursor < actionDuration) {
        return {
          html: visibleHtml,
          activeAction: step.action,
          activeActionElapsed: cursor,
          completedSwitchActions,
          completedInlineActions,
        };
      }
      if (isSwitchInlineAction(step.action)) completedSwitchActions.push(step.action);
      if (isPersistentInlineAction(step.action)) completedInlineActions.push(step.action);
      cursor -= actionDuration;
      continue;
    }

    const chars = visibleCharCount(step.html);
    const segmentSeconds = chars * secondsPerChar;
    if (cursor >= segmentSeconds) {
      visibleHtml += step.html;
      cursor -= segmentSeconds;
      continue;
    }

    const visibleChars = Math.max(0, Math.ceil(cursor / secondsPerChar));
    visibleHtml = sliceVisibleHtml(
      visibleHtml + step.html,
      visibleCharCount(visibleHtml) + visibleChars,
    );
    return {
      html: visibleHtml,
      activeAction: null as InlinePresentationAction | null,
      activeActionElapsed: 0,
      completedSwitchActions,
      completedInlineActions,
    };
  }

  return {
    html: visibleHtml,
    activeAction: null as InlinePresentationAction | null,
    activeActionElapsed: 0,
    completedSwitchActions,
    completedInlineActions,
  };
};
