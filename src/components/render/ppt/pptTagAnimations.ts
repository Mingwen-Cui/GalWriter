import type {
  InlinePresentationAction,
  PresentationAnimation,
  PresentationMotion,
} from '../../../domain/project';
import type {
  PptAnimationDirection,
  PptAnimationEffect,
  PptObjectAnimation,
} from '../video/shared/types';
import type { PptScene } from './pptSceneResolver';

type Mention = { id: string; kind: 'character' | 'scene'; name: string };

const attribute = (markup: string, name: string) =>
  markup.match(new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))?.[1] ||
  markup.match(new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))?.[2] ||
  '';

/**
 * Avoid DOMParser here: the same resolver is used during browser and desktop
 * exports. Mention spans are authored by RichText and have stable data ids.
 */
const mentionsInDocumentOrder = (html: string): Mention[] =>
  Array.from(
    html.matchAll(
      /<span\b[^>]*data-mention-kind=(?:"(?:character|scene)"|'(?:character|scene)')[^>]*>/gi,
    ),
  )
    .map((match) => {
      const markup = match[0];
      const kind = attribute(markup, 'data-mention-kind');
      if (kind !== 'character' && kind !== 'scene') return null;
      return {
        id: attribute(markup, 'data-mention-id'),
        kind,
        name: attribute(markup, 'data-mention-name'),
      };
    })
    .filter((mention): mention is Mention => Boolean(mention));

const directionForMotion = (
  type: PresentationAnimation,
  phase: 'enter' | 'exit',
): PptAnimationDirection => {
  if (type === 'slide-left') return phase === 'enter' ? 'right' : 'left';
  if (type === 'slide-right') return phase === 'enter' ? 'left' : 'right';
  if (type === 'slide-up') return phase === 'enter' ? 'down' : 'up';
  if (type === 'slide-down') return phase === 'enter' ? 'up' : 'down';
  return 'left';
};

const effectForMotion = (type: PresentationAnimation): PptAnimationEffect => {
  if (type === 'fade') return 'fade';
  if (type === 'zoom') return 'zoom';
  if (type.startsWith('slide-')) return 'fly';
  return 'none';
};

const motionEntry = ({
  id,
  target,
  targetId,
  phase,
  motion,
  start,
}: {
  id: string;
  target: PptObjectAnimation['target'];
  targetId?: string;
  phase: 'enter' | 'exit';
  motion: PresentationMotion | undefined;
  start: PptObjectAnimation['start'];
}): PptObjectAnimation | null => {
  const effect = effectForMotion(motion?.type || 'none');
  if (effect === 'none') return null;
  return {
    id,
    source: 'tag',
    target,
    targetId,
    phase,
    effect,
    start,
    durationMs: Math.max(0, motion?.duration || 0),
    delayMs: 0,
    direction: directionForMotion(motion?.type || 'none', phase),
  };
};

const actionEntry = (
  scene: PptScene,
  mention: Mention,
  action: InlinePresentationAction,
  order: number,
): PptObjectAnimation | null => {
  if (action.action === 'none') return null;
  const target = action.kind === 'scene' ? 'background' : 'character';
  const targetId = action.kind === 'character' ? action.sourceNodeId : undefined;
  const switchImageUrl =
    action.action === 'switch' && action.targetAssetId
      ? action.kind === 'scene'
        ? scene.sceneSwitchImageUrls?.[action.targetAssetId]
        : scene.characters.find((character) => character.sourceNodeId === targetId)
            ?.switchImageUrls?.[action.targetAssetId]
      : undefined;
  const effect: PptAnimationEffect =
    action.action === 'shake-x' || action.action === 'shake-y' || action.action === 'translate'
      ? 'line'
      : action.action === 'scale'
        ? 'growShrink'
        : action.action === 'pulse'
          ? 'pulse'
          : action.action === 'rotate'
            ? 'spin'
            : action.action === 'opacity'
              ? 'transparency'
              : action.action === 'brightness'
                ? 'darken'
                : 'fade';
  return {
    id: `tag:${scene.id}:middle:${mention.id || order}`,
    source: 'tag',
    mentionId: mention.id || undefined,
    action:
      action.action === 'translate-x' || action.action === 'translate-y'
        ? 'translate'
        : action.action,
    target,
    targetId,
    phase: 'emphasis',
    effect,
    start: 'onClick',
    durationMs: Math.max(0, action.duration || 0),
    delayMs: 0,
    direction:
      action.action === 'shake-y' || action.action === 'translate-y'
        ? 'down'
        : action.action === 'translate-x' && (action.offsetX || action.strength) < 0
          ? 'left'
          : 'right',
    repeats: Math.max(1, Math.round(action.repeats || 1)),
    strength: action.strength,
    offsetX: action.offsetX,
    offsetY: action.offsetY,
    scale: action.scale,
    switchImageUrl,
  };
};

const actionForMention = (scene: PptScene, mention: Mention) => {
  const actions = scene.presentation.inlineActions || [];
  const targetId =
    mention.kind === 'scene'
      ? scene.presentation.scene?.sourceNodeId
      : scene.characters.find((character) => character.name === mention.name)?.sourceNodeId;
  return (
    actions.find((action) => mention.id && action.id === mention.id) ||
    actions.find(
      (action) =>
        action.kind === mention.kind &&
        action.sourceNodeId === targetId &&
        (!mention.name || !action.name || action.name === mention.name),
    ) ||
    null
  );
};

/**
 * Projects authored tag animation settings into PowerPoint's three native
 * panes. The generated entries remain read-only projections; manual PPT
 * entries can still be appended as dedicated export overrides.
 */
export const resolvePptTagAnimations = (scene: PptScene): PptObjectAnimation[] => {
  const entries: PptObjectAnimation[] = [];
  let hasEntrance = false;
  const pushMotion = (
    id: string,
    target: PptObjectAnimation['target'],
    targetId: string | undefined,
    phase: 'enter' | 'exit',
    motion: PresentationMotion | undefined,
    start: PptObjectAnimation['start'],
  ) => {
    const entry = motionEntry({ id, target, targetId, phase, motion, start });
    if (entry) entries.push(entry);
    return Boolean(entry);
  };

  if (
    pushMotion(
      `tag:${scene.id}:background:enter`,
      'background',
      undefined,
      'enter',
      scene.presentation.scene?.enter,
      'onClick',
    )
  ) {
    hasEntrance = true;
  }
  scene.presentation.characters.forEach((character) => {
    if (
      pushMotion(
        `tag:${scene.id}:character:${character.sourceNodeId}:enter`,
        'character',
        character.sourceNodeId,
        'enter',
        character.enter,
        hasEntrance ? 'withPrevious' : 'onClick',
      )
    ) {
      hasEntrance = true;
    }
  });

  mentionsInDocumentOrder(scene.rawText).forEach((mention, index) => {
    const action = actionForMention(scene, mention);
    if (!action) return;
    const entry = actionEntry(scene, mention, action, index);
    if (entry) entries.push(entry);
  });

  let hasExit = false;
  scene.presentation.characters.forEach((character) => {
    if (
      pushMotion(
        `tag:${scene.id}:character:${character.sourceNodeId}:exit`,
        'character',
        character.sourceNodeId,
        'exit',
        character.exit,
        hasExit ? 'withPrevious' : 'onClick',
      )
    ) {
      hasExit = true;
    }
  });
  pushMotion(
    `tag:${scene.id}:background:exit`,
    'background',
    undefined,
    'exit',
    scene.presentation.scene?.exit,
    hasExit ? 'withPrevious' : 'onClick',
  );
  return entries;
};
