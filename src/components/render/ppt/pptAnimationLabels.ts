import type { PptObjectAnimation } from '../video/shared/types';
import type { PptCopy } from './i18n';
import { resolvePptScenes } from './pptSceneResolver';
import { getPptDialogueTurns } from './pptTagAnimations';

type Scene = ReturnType<typeof resolvePptScenes>[number];

export function targetLabel(copy: PptCopy, animation: PptObjectAnimation, scene?: Scene) {
  if (animation.target === 'character') {
    const name = scene?.characters.find((item) => item.sourceNodeId === animation.targetId)?.name;
    return `${copy.character}：${name || copy.unnamed}`;
  }
  if (animation.target === 'choice') return `${copy.choice} ${Number(animation.targetId || 0) + 1}`;
  if (animation.target === 'dialog-body' && animation.targetId?.startsWith('dialogue:')) {
    const speaker = scene
      ? getPptDialogueTurns(scene).find((turn) => turn.id === animation.targetId)?.name
      : undefined;
    if (speaker) return `${copy.dialogBody} · ${speaker}`;
  }
  return (
    (
      {
        background: copy.background,
        'dialog-panel': copy.dialogPanel,
        'dialog-title': copy.dialogTitle,
        'dialog-body': copy.dialogBody,
        'manual-text': copy.text,
        'cover-title': copy.coverTitle,
        'cover-subtitle': copy.coverSubtitle,
        'cover-description': 'Galgame 说明',
      } as Record<string, string>
    )[animation.target] || copy.objectProperties
  );
}
