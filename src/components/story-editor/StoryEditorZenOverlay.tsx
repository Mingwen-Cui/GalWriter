import type { Edge, Node } from '@xyflow/react';
import { Suspense } from 'react';

import type { StoryAudioClip, StoryNodeData, StoryPresentation } from '../../domain/project';
import { normalizeStoryPresentation } from '../../lib/presentation';
import {
  resolveAssistantStorySceneMedia,
  syncPresentationWithStoryMentions,
} from './assistantMentions';
import { ZenEditor } from './lazyModals';

type StoryEditorZenOverlayProps = {
  nodes: Node[];
  edges: Edge[];
  zenModeNodeId: string | null;
  aiLoadingNodeId: string | null;
  onAIGenerate: (nodeId: string) => void;
  onGenerateImage: (nodeId: string) => void;
  onGenerateAudio: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<StoryNodeData>) => void;
  onClose: () => void;
};

export function StoryEditorZenOverlay({
  nodes,
  edges,
  zenModeNodeId,
  aiLoadingNodeId,
  onAIGenerate,
  onGenerateImage,
  onGenerateAudio,
  onUpdateNode,
  onClose,
}: StoryEditorZenOverlayProps) {
  if (!zenModeNodeId) {
    return null;
  }

  const node = nodes.find((item) => item.id === zenModeNodeId);
  const zenPresentation = normalizeStoryPresentation(node?.data.presentation as any);
  const characterTags = node
    ? nodes
        .filter(
          (item) =>
            item.type === 'characterNode' &&
            typeof item.data.characterName === 'string' &&
            item.data.characterName.trim().length > 0,
        )
        .filter((item) => {
          const isGlobal = item.data?.isGlobal !== false;
          const isConnected = edges.some(
            (edge) =>
              (edge.source === item.id && edge.target === node.id) ||
              (edge.target === item.id && edge.source === node.id),
          );
          const isPresented = zenPresentation.characters.some(
            (character) => character.sourceNodeId === item.id,
          );
          return isGlobal || isConnected || isPresented;
        })
        .map((item) => {
          const config = zenPresentation.characters.find(
            (character) => character.sourceNodeId === item.id,
          );
          const outfits = Array.isArray(item.data.outfits) ? item.data.outfits : [];
          const outfit = config?.outfitId
            ? outfits.find((outfitItem: any) => outfitItem.id === config.outfitId)
            : outfits.find((outfitItem: any) => outfitItem.imageUrl);
          return {
            id: item.id,
            name: String(item.data.characterName).trim(),
            imageUrl:
              (outfit as { imageUrl?: string } | undefined)?.imageUrl ||
              (typeof item.data.avatarUrl === 'string' ? item.data.avatarUrl : undefined),
          };
        })
    : [];
  const sceneTags = node
    ? nodes
        .filter(
          (item) =>
            item.type === 'sceneNode' &&
            typeof item.data.sceneName === 'string' &&
            item.data.sceneName.trim().length > 0,
        )
        .filter((item) => {
          const isGlobal = item.data?.isGlobal !== false;
          const isConnected = edges.some(
            (edge) =>
              (edge.source === item.id && edge.target === node.id) ||
              (edge.target === item.id && edge.source === node.id),
          );
          const isPresented = zenPresentation.scene?.sourceNodeId === item.id;
          return isGlobal || isConnected || isPresented;
        })
        .map((item) => ({ id: item.id, name: String(item.data.sceneName).trim() }))
    : [];
  const presentationScene = zenPresentation.scene
    ? nodes.find((item) => item.id === zenPresentation.scene?.sourceNodeId)
    : undefined;
  const presentationSceneImages = Array.isArray(presentationScene?.data.images)
    ? (presentationScene.data.images as Array<{
        id: string;
        imageUrl?: string;
        videoUrl?: string;
      }>)
    : [];
  const selectedPresentationSceneMedia = zenPresentation.scene?.imageId
    ? presentationSceneImages.find((image) => image.id === zenPresentation.scene?.imageId)
    : undefined;
  const zenVideoUrl =
    selectedPresentationSceneMedia?.videoUrl ||
    (typeof node?.data.videoUrl === 'string' ? node.data.videoUrl : undefined);
  const zenImageUrl = zenVideoUrl
    ? undefined
    : (typeof node?.data.imageUrl === 'string' ? node.data.imageUrl : undefined) ||
      selectedPresentationSceneMedia?.imageUrl ||
      (typeof presentationScene?.data.coverImageUrl === 'string'
        ? presentationScene.data.coverImageUrl
        : '');

  const handleZenPresentationChange = (presentation: StoryPresentation) => {
    const nextPresentation = normalizeStoryPresentation(presentation);
    const updates: Partial<StoryNodeData> = { presentation: nextPresentation };
    if (nextPresentation.scene) {
      Object.assign(updates, resolveAssistantStorySceneMedia(nextPresentation, nodes));
    } else if (zenPresentation.scene) {
      updates.imageUrl = zenPresentation.scene.previousImageUrl;
      updates.videoUrl = zenPresentation.scene.previousVideoUrl;
      updates.showTextOverlay =
        zenPresentation.scene.previousShowTextOverlay ??
        (node?.data.showTextOverlay as boolean | undefined);
    }
    onUpdateNode(zenModeNodeId, updates);
  };

  const handleZenTextChange = (value: string) => {
    const synced = syncPresentationWithStoryMentions(value, zenPresentation, nodes);
    const updates: Partial<StoryNodeData> = {
      text: value,
      presentation: synced.presentation,
    };
    if (synced.removedScene) {
      updates.imageUrl = synced.removedScene.previousImageUrl;
      updates.videoUrl = synced.removedScene.previousVideoUrl;
      updates.showTextOverlay =
        synced.removedScene.previousShowTextOverlay ??
        (node?.data.showTextOverlay as boolean | undefined);
    }
    onUpdateNode(zenModeNodeId, updates);
  };

  return (
    <Suspense fallback={null}>
      <ZenEditor
        nodeId={zenModeNodeId}
        value={typeof node?.data.text === 'string' ? node.data.text : ''}
        imageUrl={zenImageUrl}
        videoUrl={zenVideoUrl}
        audioUrl={typeof node?.data.audioUrl === 'string' ? node.data.audioUrl : ''}
        audioClips={
          Array.isArray(node?.data.audioClips) ? (node.data.audioClips as StoryAudioClip[]) : []
        }
        characterTags={characterTags}
        sceneTags={sceneTags}
        presentation={zenPresentation}
        isAILoading={aiLoadingNodeId === zenModeNodeId}
        onAIGenerate={() => onAIGenerate(zenModeNodeId)}
        onGenerateImage={() => onGenerateImage(zenModeNodeId)}
        onGenerateAudio={() => onGenerateAudio(zenModeNodeId)}
        onAudioClipsChange={(audioClips) => {
          const firstPlayable = audioClips.find((clip) => !clip.skipped);
          onUpdateNode(zenModeNodeId, {
            audioClips,
            audioUrl: firstPlayable?.url,
          });
        }}
        onChange={handleZenTextChange}
        onPresentationChange={handleZenPresentationChange}
        onClose={onClose}
      />
    </Suspense>
  );
}
