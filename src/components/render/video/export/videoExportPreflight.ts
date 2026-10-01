import type { Node as FlowNode } from '@xyflow/react';

import type { CharacterNodeData, SceneNodeData } from '../../../../domain/project';
import type { StoryPresentation } from '../../../../domain/project';
import type { Language } from '../../../../lib/i18n';
import { resolveCharacterImageUrl, resolveSceneMedia } from '../../../../lib/inlineAssetSwitch';
import { normalizeStoryPresentation } from '../../../../lib/presentation';
import { resolveSceneLightOverlayUrl } from '../../../../lib/sceneVisualStyle';
import type { SharedCanvasSettings } from '../../canvas/canvasSettings';
import type { ExportAssetFailure } from '../../shared/exportAssetFailures';
import { formatExportAssetFailures } from '../../shared/exportAssetFailures';
import { loadCachedImage } from '../shared/mediaUtils';
import { getRenderObjects } from '../shared/renderObjects';
import type { RenderStyle } from '../shared/types';

type ImageAssetReference = { url: string; label: string };

const collectVideoImageAssets = (
  nodes: FlowNode[],
  renderNodes: FlowNode[],
  style: RenderStyle,
  canvasSettings?: SharedCanvasSettings,
) => {
  const assets = new Map<string, ImageAssetReference>();
  const add = (url: string | undefined, label: string) => {
    if (!url?.trim()) return;
    assets.set(url, { url, label });
  };

  if (canvasSettings?.sceneBackgroundVisible && canvasSettings.sceneBackgroundType === 'image') {
    add(canvasSettings.sceneBackgroundImageUrl, 'video scene background');
  }
  if (style.dialogVisible && style.dialogBackgroundType === 'image') {
    add(style.dialogImageUrl, 'dialogue panel background');
  }
  if (style.nameplateVisible && style.nameplateBackgroundType === 'image') {
    add(style.nameplateImageUrl, 'nameplate background');
  }

  const objects = getRenderObjects(style);
  Object.entries(objects).forEach(([name, object]) => {
    if (!object.visible) return;
    if (object.fill.type === 'image') add(object.fill.imageUrl, `${name} fill`);
    if (object.stroke.type === 'image') add(object.stroke.imageUrl, `${name} outline`);
  });

  renderNodes.forEach((node) => {
    if (node.type !== 'storyNode') return;
    const presentation = normalizeStoryPresentation(
      node.data?.presentation as StoryPresentation | undefined,
    );
    const sceneConfig = presentation.scene;
    const sceneNode = sceneConfig
      ? nodes.find(
          (candidate) =>
            candidate.id === sceneConfig.sourceNodeId && candidate.type === 'sceneNode',
        )
      : undefined;
    const sceneData = sceneNode?.data as SceneNodeData | undefined;
    const media = resolveSceneMedia({
      data: sceneData,
      scene: sceneConfig,
      fallbackImageUrl: typeof node.data?.imageUrl === 'string' ? node.data.imageUrl : undefined,
      fallbackVideoUrl: typeof node.data?.videoUrl === 'string' ? node.data.videoUrl : undefined,
    });
    if (!media.videoUrl)
      add(media.imageUrl, `${String(node.data?.title || node.id)} scene background`);
    const lightOverlay = resolveSceneLightOverlayUrl(
      sceneData?.visualStyle,
      sceneData?.scenePresetEnabled === true,
    );
    add(lightOverlay, `${String(node.data?.title || node.id)} lighting overlay`);

    presentation.characters.forEach((config) => {
      const characterNode = nodes.find(
        (candidate) => candidate.id === config.sourceNodeId && candidate.type === 'characterNode',
      );
      if (!characterNode) return;
      const characterData = characterNode.data as CharacterNodeData;
      const name = characterData.characterName || characterNode.id;
      add(resolveCharacterImageUrl(characterData, config), `${name} character image`);
      presentation.inlineActions
        .filter(
          (action) => action.kind === 'character' && action.sourceNodeId === config.sourceNodeId,
        )
        .forEach((action) =>
          add(resolveCharacterImageUrl(characterData, config, action), `${name} animation image`),
        );
    });

    presentation.inlineActions
      .filter(
        (action) => action.kind === 'scene' && action.sourceNodeId === sceneConfig?.sourceNodeId,
      )
      .forEach((action) => {
        const switched = resolveSceneMedia({
          data: sceneData,
          scene: sceneConfig,
          switchAction: action,
        });
        if (!switched.videoUrl)
          add(switched.imageUrl, `${String(node.data?.title || node.id)} scene animation image`);
      });
  });

  return [...assets.values()];
};

export const preflightVideoExportImages = async (
  nodes: FlowNode[],
  renderNodes: FlowNode[],
  style: RenderStyle,
  canvasSettings: SharedCanvasSettings | undefined,
  language: Language,
) => {
  const references = collectVideoImageAssets(nodes, renderNodes, style, canvasSettings);
  const failures: ExportAssetFailure[] = [];
  await Promise.all(
    references.map(async ({ url, label }) => {
      try {
        await loadCachedImage(url);
      } catch (error) {
        failures.push({
          kind: 'image',
          label,
          source: url,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
  if (failures.length > 0) {
    throw new Error(formatExportAssetFailures(language, '视频导出', failures));
  }
};
