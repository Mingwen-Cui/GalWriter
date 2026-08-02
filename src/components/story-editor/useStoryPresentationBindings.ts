import type { Edge, Node } from '@xyflow/react';
import { useEffect } from 'react';

import type { StoryPresentation } from '../../domain/project';
import {
  createCharacterPresentation,
  createScenePresentation,
  normalizeStoryPresentation,
} from '../../lib/presentation';
import { resolveAssistantStorySceneMedia } from './assistantMentions';

type UseStoryPresentationBindingsOptions = {
  edges: Edge[];
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
};

export function useStoryPresentationBindings({
  edges,
  nodes,
  setNodes,
}: UseStoryPresentationBindingsOptions) {
  useEffect(() => {
    setNodes((currentNodes) => {
      const nodeById = new Map(currentNodes.map((node) => [node.id, node]));
      let changed = false;

      const nextNodes = currentNodes.map((node) => {
        if (node.type !== 'storyNode') return node;

        const connectedEdges = edges.filter(
          (edge) => edge.source === node.id || edge.target === node.id,
        );
        const connectedSceneBinding = connectedEdges
          .map((edge) => {
            const connectedId = edge.source === node.id ? edge.target : edge.source;
            const connected = nodeById.get(connectedId);
            if (connected?.type !== 'sceneNode') return null;

            const sceneHandle = edge.source === connectedId ? edge.sourceHandle : edge.targetHandle;
            const imageId = sceneHandle?.match(/^image-(?:in|out)-(.+)$/)?.[1];
            const sceneImages = Array.isArray(connected.data.images)
              ? (connected.data.images as Array<{
                  id: string;
                  imageUrl?: string;
                  videoUrl?: string;
                }>)
              : [];
            const selectedMedia = imageId
              ? sceneImages.find(
                  (image) => image.id === imageId && (image.imageUrl || image.videoUrl),
                )
              : undefined;
            const imageUrl =
              selectedMedia?.imageUrl ||
              (!selectedMedia && typeof connected.data.coverImageUrl === 'string'
                ? connected.data.coverImageUrl
                : undefined);
            const videoUrl = selectedMedia?.videoUrl;
            if (!imageUrl && !videoUrl) return null;

            return { node: connected, imageId: selectedMedia?.id, imageUrl, videoUrl };
          })
          .filter((binding): binding is NonNullable<typeof binding> => Boolean(binding))
          .sort((left, right) => Number(Boolean(right.imageId)) - Number(Boolean(left.imageId)))[0];
        const connectedCharacterBindings = connectedEdges
          .map((edge) => {
            const connectedId = edge.source === node.id ? edge.target : edge.source;
            const connected = nodeById.get(connectedId);
            if (connected?.type !== 'characterNode') return null;

            const characterHandle =
              edge.source === connectedId ? edge.sourceHandle : edge.targetHandle;
            const outfitId = characterHandle?.match(/^outfit-(?:in|out)-(.+)$/)?.[1];
            const outfits = Array.isArray(connected.data.outfits)
              ? (connected.data.outfits as Array<{ id: string }>)
              : [];
            return {
              node: connected,
              outfitId:
                outfitId && outfits.some((outfit) => outfit.id === outfitId) ? outfitId : undefined,
            };
          })
          .filter((binding): binding is NonNullable<typeof binding> => Boolean(binding));
        const connectedCharacterById = new Map<
          string,
          (typeof connectedCharacterBindings)[number]
        >();
        connectedCharacterBindings.forEach((binding) => {
          const existing = connectedCharacterById.get(binding.node.id);
          if (!existing || binding.outfitId) connectedCharacterById.set(binding.node.id, binding);
        });

        const presentation = normalizeStoryPresentation(
          node.data.presentation as StoryPresentation | undefined,
        );
        let nextScene = presentation.scene;
        let nextImageUrl = node.data.imageUrl as string | undefined;
        let nextVideoUrl = node.data.videoUrl as string | undefined;
        let nextShowTextOverlay = node.data.showTextOverlay as boolean | undefined;

        if (connectedSceneBinding) {
          const connectedScene = connectedSceneBinding.node;
          const previousImageUrl =
            nextScene?.linkedByEdge && nextScene.previousImageUrl !== undefined
              ? nextScene.previousImageUrl
              : nextImageUrl;
          const previousVideoUrl =
            nextScene?.linkedByEdge && nextScene.previousVideoUrl !== undefined
              ? nextScene.previousVideoUrl
              : nextVideoUrl;
          nextScene = {
            ...(nextScene?.sourceNodeId === connectedScene.id
              ? nextScene
              : createScenePresentation(
                  connectedScene.id,
                  previousImageUrl,
                  true,
                  nextShowTextOverlay,
                )),
            sourceNodeId: connectedScene.id,
            linkedByEdge: true,
            imageId: connectedSceneBinding.imageId,
            previousImageUrl,
            previousVideoUrl,
            previousShowTextOverlay:
              nextScene?.linkedByEdge && nextScene.previousShowTextOverlay !== undefined
                ? nextScene.previousShowTextOverlay
                : nextShowTextOverlay,
          };
          nextImageUrl = connectedSceneBinding.imageUrl;
          nextVideoUrl = connectedSceneBinding.videoUrl;
          nextShowTextOverlay = true;
        } else if (nextScene?.linkedByEdge) {
          nextImageUrl = nextScene.previousImageUrl;
          nextVideoUrl = nextScene.previousVideoUrl;
          nextShowTextOverlay = nextScene.previousShowTextOverlay;
          nextScene = undefined;
        } else if (nextScene) {
          const taggedSceneMedia = resolveAssistantStorySceneMedia(presentation, currentNodes);
          if (taggedSceneMedia.imageUrl || taggedSceneMedia.videoUrl) {
            nextImageUrl = taggedSceneMedia.imageUrl;
            nextVideoUrl = taggedSceneMedia.videoUrl;
            nextShowTextOverlay = taggedSceneMedia.showTextOverlay;
          }
        }

        const connectedCharacterIds = new Set(connectedCharacterById.keys());
        const nextCharacters = presentation.characters
          .filter(
            (character) =>
              !character.linkedByEdge || connectedCharacterIds.has(character.sourceNodeId),
          )
          .map((character) => {
            const binding = connectedCharacterById.get(character.sourceNodeId);
            return binding
              ? { ...character, linkedByEdge: true, outfitId: binding.outfitId }
              : character;
          });
        connectedCharacterById.forEach((binding) => {
          if (!nextCharacters.some((item) => item.sourceNodeId === binding.node.id)) {
            nextCharacters.push({
              ...createCharacterPresentation(binding.node.id, true),
              outfitId: binding.outfitId,
            });
          }
        });

        const nextPresentation = {
          scene: nextScene,
          characters: nextCharacters,
          inlineActions: presentation.inlineActions,
        };
        if (
          nextImageUrl === node.data.imageUrl &&
          nextVideoUrl === node.data.videoUrl &&
          nextShowTextOverlay === node.data.showTextOverlay &&
          JSON.stringify(nextPresentation) === JSON.stringify(presentation)
        ) {
          return node;
        }

        changed = true;
        return {
          ...node,
          data: {
            ...node.data,
            imageUrl: nextImageUrl,
            videoUrl: nextVideoUrl,
            showTextOverlay: nextShowTextOverlay,
            presentation: nextPresentation,
          },
        };
      });

      return changed ? nextNodes : currentNodes;
    });
  }, [edges, nodes, setNodes]);
}
