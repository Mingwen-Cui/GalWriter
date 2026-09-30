import type {
  InlinePresentationAction,
  PresentationAnimation,
  PresentationMotion,
} from '../../../domain/project';
import type {
  PptAnimationDirection,
  PptAnimationEffect,
  PptObjectAnimation,
  RenderStyle,
} from '../video/shared/types';
import { getRenderObjects } from '../video/shared/renderObjects';
import { stripHtml } from '../video/shared/storyNodes';
import type { PptScene } from './pptSceneResolver';

type Mention = { id: string; kind: 'character' | 'scene'; name: string; start: number; end: number };
export type PptDialogueTurn = { id: string; characterId?: string; name: string; text: string };

/** Keep exported typewriter text readable instead of finishing in a flash. */
export const PPT_TEXT_WIPE_DURATION_MS = 1800;

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
      /<span\b(?=[^>]*data-mention-kind=(?:"(?:character|scene)"|'(?:character|scene)'))[^>]*>[\s\S]*?<\/span>/gi,
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
        start: match.index ?? 0,
        end: (match.index ?? 0) + markup.length,
      };
    })
    .filter((mention): mention is Mention => Boolean(mention));

/** Resolve each character mention to the dialogue text that follows it. */
export const getPptDialogueTurns = (scene: PptScene): PptDialogueTurn[] => {
  const mentions = mentionsInDocumentOrder(scene.rawText);
  let dialogueIndex = 0;
  return mentions.flatMap((mention, index) => {
    if (mention.kind !== 'character') return [];
    const text = stripHtml(
      scene.rawText.slice(mention.end, mentions[index + 1]?.start ?? scene.rawText.length),
    ).trim();
    if (!text) return [];
    const characterId =
      scene.presentation.inlineActions?.find(
        (action) => action.id === mention.id && action.kind === 'character',
      )?.sourceNodeId ||
      scene.characters.find((character) => character.name === mention.name)?.sourceNodeId;
    const id = `dialogue:${mention.id || dialogueIndex}`;
    dialogueIndex += 1;
    return [{ id, characterId, name: mention.name, text }];
  });
};

/** Map each laid-out visual line to the speaker turn that owns its text. */
export const getPptDialogueLineTargetIds = (
  scene: PptScene,
  bodyText: string,
  lineStarts: number[],
): Array<string | undefined> => {
  if (!lineStarts.length) return [];
  const turns = getPptDialogueTurns(scene);
  let searchFrom = 0;
  const turnStartLines = turns.map((turn) => {
    let matchIndex = bodyText.indexOf(turn.text, searchFrom);
    if (matchIndex < 0) {
      const speakerPrefix = turn.name ? `${turn.name}：` : '';
      matchIndex = speakerPrefix ? bodyText.indexOf(speakerPrefix, searchFrom) : -1;
    }
    if (matchIndex < 0) return -1;
    searchFrom = matchIndex + Math.max(1, turn.text.length);
    const codepointIndex = Array.from(bodyText.slice(0, matchIndex)).length;
    let lineIndex = 0;
    for (let index = 1; index < lineStarts.length; index += 1) {
      if (lineStarts[index] > codepointIndex) break;
      lineIndex = index;
    }
    return lineIndex;
  });
  return lineStarts.map((_, lineIndex) => {
    let activeTurn = -1;
    turnStartLines.forEach((startLine, index) => {
      if (startLine >= 0 && startLine <= lineIndex) activeTurn = index;
    });
    return activeTurn >= 0 ? turns[activeTurn].id : undefined;
  });
};

export const createPptStyleTextAnimations = (
  scene: PptScene,
  renderStyle: RenderStyle,
  savedAnimations: PptObjectAnimation[],
) => {
  const objects = getRenderObjects(renderStyle);
  const entries: PptObjectAnimation[] = [];
  const hasSaved = (target: PptObjectAnimation['target']) =>
    savedAnimations.some((item) => item.target === target);
  const add = (target: 'dialog-title' | 'dialog-body', object: typeof objects.title) => {
    const animation = object.animation.animation;
    if (!object.visible || animation === 'none' || hasSaved(target)) return;
    const typewriter = animation === 'typewriter';
    entries.push({
      id: `style:${scene.id}:${target}:${animation}`,
      source: 'tag',
      target,
      phase: 'enter',
      effect: typewriter ? 'wipe' : animation === 'slideUp' ? 'fly' : 'fade',
      start: 'afterPrevious',
      durationMs: typewriter
        ? Math.max(PPT_TEXT_WIPE_DURATION_MS, object.animation.durationMs || 0)
        : Math.max(500, object.animation.durationMs || 600),
      delayMs: 0,
      direction: animation === 'slideUp' ? 'down' : 'left',
      ...(typewriter ? { textBuild: { mode: 'line-wipe' as const, lineGapMs: 160 } } : {}),
    });
  };
  add('dialog-title', objects.title);
  add('dialog-body', objects.body);
  return entries;
};

/**
 * Order PPT events like the story text is read: a character's first entrance
 * happens at its mention, followed by that speaker's dialogue reveal. This
 * keeps different scenes consistent without depending on character layer or
 * the order in which objects happen to be drawn on the slide.
 */
export const orderPptSceneAnimations = (
  scene: PptScene,
  tagAnimations: PptObjectAnimation[],
  textAnimations: PptObjectAnimation[],
  savedAnimations: PptObjectAnimation[],
) => {
  const mentions = mentionsInDocumentOrder(scene.rawText);
  const characterIdForMention = (mention: Mention) =>
    scene.presentation.inlineActions?.find(
      (action) => action.id === mention.id && action.kind === 'character',
    )?.sourceNodeId ||
    scene.characters.find((character) => character.name === mention.name)?.sourceNodeId;
  const backgroundEnters = tagAnimations.filter(
    (item) => item.target === 'background' && item.phase === 'enter',
  );
  const characterEnters = tagAnimations.filter(
    (item) => item.target === 'character' && item.phase === 'enter',
  );
  const dialogueCharacterOrder = mentions
    .filter((mention) => mention.kind === 'character')
    .map(characterIdForMention)
    .filter((id): id is string => Boolean(id))
    .filter((id, index, ids) => ids.indexOf(id) === index);
  const characterExitOrder = tagAnimations
    .filter((item) => item.target === 'character' && item.phase === 'exit')
    .sort((left, right) => {
      const leftIndex = dialogueCharacterOrder.indexOf(left.targetId || '');
      const rightIndex = dialogueCharacterOrder.indexOf(right.targetId || '');
      return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
    });
  const exits = [
    ...characterExitOrder,
    ...tagAnimations.filter((item) => item.target !== 'character' && item.phase === 'exit'),
  ];
  const used = new Set<string>([
    ...backgroundEnters.map((item) => item.id),
    ...exits.map((item) => item.id),
  ]);
  const ordered: PptObjectAnimation[] = [...backgroundEnters];
  const titleAnimations = textAnimations.filter((item) => item.target === 'dialog-title');
  const bodyTemplates = textAnimations.filter((item) => item.target === 'dialog-body');
  ordered.push(...titleAnimations);
  const mentionedCharacterIds = new Set(
    mentions
      .filter((mention) => mention.kind === 'character')
      .map(characterIdForMention)
      .filter((id): id is string => Boolean(id)),
  );
  const unmentionedCharacterEnters = characterEnters.filter(
    (item) => !mentionedCharacterIds.has(item.targetId || ''),
  );
  ordered.push(...unmentionedCharacterEnters);
  unmentionedCharacterEnters.forEach((item) => used.add(item.id));

  let dialogueIndex = 0;
  mentions.forEach((mention, index) => {
    const afterMention = scene.rawText.slice(
      mention.end,
      mentions[index + 1]?.start ?? scene.rawText.length,
    );
    const hasFollowingText = Boolean(stripHtml(afterMention).trim());
    if (mention.kind === 'character') {
      const entrance = characterEnters.find(
        (item) => item.targetId === characterIdForMention(mention),
      );
      if (entrance && !used.has(entrance.id)) {
        ordered.push({ ...entrance, start: 'afterPrevious' });
        used.add(entrance.id);
      }
    }

    const mentionAction = tagAnimations.find(
      (item) => item.mentionId === mention.id && !used.has(item.id),
    );
    if (mentionAction) {
      ordered.push({ ...mentionAction, start: 'afterPrevious' });
      used.add(mentionAction.id);
    }

    if (mention.kind === 'character' && hasFollowingText && bodyTemplates.length) {
      const template = bodyTemplates[0];
      const turn = getPptDialogueTurns(scene)[dialogueIndex];
      ordered.push({
        ...template,
        id: `${template.id}:${turn?.id || `dialogue:${mention.id || dialogueIndex}`}`,
        targetId: turn?.id,
        mentionId: mention.id || undefined,
        start: 'afterPrevious',
      });
      dialogueIndex += 1;
    }
  });

  ordered.push(
    ...tagAnimations.filter((item) => !used.has(item.id) && item.phase !== 'exit'),
    ...exits,
    ...savedAnimations,
  );
  if (!dialogueIndex && bodyTemplates.length) {
    const exitIndex = ordered.findIndex((item) => item.phase === 'exit');
    const savedIndex = ordered.findIndex((item) => item.source !== 'tag');
    const insertionIndex = exitIndex >= 0 ? exitIndex : savedIndex >= 0 ? savedIndex : ordered.length;
    ordered.splice(insertionIndex, 0, ...bodyTemplates);
  }
  return ordered;
};

const directionForMotion = (
  type: PresentationAnimation,
): PptAnimationDirection => {
  // Keep the direction as the authored movement direction. The native PPT
  // Fly In exporter derives the opposite source edge for entrances.
  if (type === 'slide-left') return 'left';
  if (type === 'slide-right') return 'right';
  if (type === 'slide-up') return 'up';
  if (type === 'slide-down') return 'down';
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
    direction: directionForMotion(motion?.type || 'none'),
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
    action.action === 'switch'
      ? 'wipe'
      : action.action === 'shake-x' || action.action === 'shake-y' || action.action === 'translate'
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

  pushMotion(
    `tag:${scene.id}:background:enter`,
    'background',
    undefined,
    'enter',
    scene.presentation.scene?.enter,
    'withPrevious',
  );
  scene.presentation.characters.forEach((character) => {
    pushMotion(
      `tag:${scene.id}:character:${character.sourceNodeId}:enter`,
      'character',
      character.sourceNodeId,
      'enter',
      character.enter,
      'withPrevious',
    );
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
