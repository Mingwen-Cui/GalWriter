import type { InlinePresentationAction, StoryPresentation } from '../domain/project';

export type InlinePlaybackStep =
  | { kind: 'text'; html: string }
  | { kind: 'action'; action: InlinePresentationAction };

type InlinePlaybackOptions = {
  hideCharacterTags?: boolean;
  hideSceneTags?: boolean;
};

const hasText = (html: string) => html.replace(/<[^>]*>/g, '').trim().length > 0;

const nodeHtml = (node: ChildNode) =>
  node instanceof HTMLElement ? node.outerHTML : node.textContent || '';

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
  const name = mention.dataset.mentionName || mention.textContent?.replace(/^@/, '') || '';
  const sourceNodeId =
    kind === 'character'
      ? presentation.characters.find((item) => item.sourceNodeId && item.sourceNodeId)?.sourceNodeId
      : presentation.scene?.sourceNodeId;
  return (
    presentation.inlineActions?.find((item) => item.id === mentionId) ||
    presentation.inlineActions?.find((item) => item.kind === kind && item.name === name) ||
    presentation.inlineActions?.find((item) => item.kind === kind && item.sourceNodeId === sourceNodeId) ||
    null
  );
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
    const filtered = filterPlaybackMentionTags(buffer, options);
    if (!hasText(filtered)) {
      buffer = '';
      return;
    }
    steps.push({ kind: 'text', html: filtered });
    buffer = '';
  };

  Array.from(container.childNodes).forEach((node) => {
    if (node instanceof HTMLElement && node.classList.contains('mention-chip')) {
      if (mentionPlacement(container, node) !== 'inline') {
        buffer += nodeHtml(node);
        return;
      }
      const action = findInlineAction(node, presentation);
      if (action) {
        flush();
        steps.push({ kind: 'action', action });
      } else {
        buffer += nodeHtml(node);
      }
      return;
    }
    buffer += nodeHtml(node);
  });
  flush();
  return steps.length ? steps : [{ kind: 'text', html: filterPlaybackMentionTags(html, options) }];
};

export const inlineActionTransform = (action?: InlinePresentationAction | null) => {
  if (!action || action.action === 'none' || action.action === 'pulse' || action.action === 'wait')
    return '';
  if (action.action === 'translate-x') return `translateX(${action.offsetX || action.strength}px)`;
  if (action.action === 'translate-y') return `translateY(${action.offsetY || action.strength}px)`;
  if (action.action === 'scale') return `scale(${action.scale || 1.08})`;
  return '';
};

export const inlineActionAnimation = (action?: InlinePresentationAction | null) => {
  if (!action || action.action === 'none' || action.action === 'wait') return undefined;
  const duration = Math.max(80, action.duration || 400);
  if (action.action === 'shake-x') return `galInlineShakeX ${duration}ms ease both`;
  if (action.action === 'shake-y') return `galInlineShakeY ${duration}ms ease both`;
  if (action.action === 'pulse') return `galInlinePulse ${duration}ms ease both`;
  return undefined;
};

const visibleCharCount = (html: string) => html.replace(/<[^>]*>/g, '').length;

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
    (sum, step) => sum + (step.kind === 'action' ? Math.max(0, step.action.duration || 0) / 1000 : 0),
    0,
  );
  const totalChars = steps.reduce(
    (sum, step) => sum + (step.kind === 'text' ? visibleCharCount(step.html) : 0),
    0,
  );
  if (!duration || totalChars === 0) {
    return {
      html: steps
        .filter((step): step is { kind: 'text'; html: string } => step.kind === 'text')
        .map((step) => step.html)
        .join(''),
      activeAction: null as InlinePresentationAction | null,
      activeActionElapsed: 0,
    };
  }

  const textSeconds = Math.max(0.1, duration - actionSeconds);
  const secondsPerChar = textSeconds / totalChars;
  let cursor = Math.max(0, elapsed);
  let visibleHtml = '';

  for (const step of steps) {
    if (step.kind === 'action') {
      const actionDuration = Math.max(0, step.action.duration || 0) / 1000;
      if (cursor <= actionDuration) {
        return { html: visibleHtml, activeAction: step.action, activeActionElapsed: cursor };
      }
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
    visibleHtml += step.html.replace(/<[^>]*>/g, '').slice(0, visibleChars);
    return {
      html: visibleHtml,
      activeAction: null as InlinePresentationAction | null,
      activeActionElapsed: 0,
    };
  }

  return {
    html: visibleHtml,
    activeAction: null as InlinePresentationAction | null,
    activeActionElapsed: 0,
  };
};
