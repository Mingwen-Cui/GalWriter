import type { PptObjectAnimation } from '../video/shared/types';
import type { PptCopy } from './i18n';
import { resolvePptScenes } from './pptSceneResolver';

type Scene = ReturnType<typeof resolvePptScenes>[number];

export function targetLabel(copy: PptCopy, animation: PptObjectAnimation, scene?: Scene) {
  if (animation.target === 'character') {
    const name = scene?.characters.find((item) => item.sourceNodeId === animation.targetId)?.name;
    return `${copy.character}：${name || copy.unnamed}`;
  }
  if (animation.target === 'choice') return `${copy.choice} ${Number(animation.targetId || 0) + 1}`;
  return (
    (
      {
        background: copy.background,
        'dialog-panel': copy.dialogPanel,
        'dialog-title': copy.dialogTitle,
        'dialog-body': copy.dialogBody,
        'cover-title': copy.coverTitle,
        'cover-subtitle': copy.coverSubtitle,
      } as Record<string, string>
    )[animation.target] || copy.objectProperties
  );
}
