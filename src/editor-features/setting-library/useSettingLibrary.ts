import type { Node } from '@xyflow/react';
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type {
  CharacterNodeData,
  SceneNodeData,
  SettingLibraryKind,
  SettingLibraryListItem,
  SettingLibrarySource,
} from '../../domain/project';
import {
  getSettingLibraryPresets,
  loadSettingLibraryPreset,
  type SettingLibraryItem,
  toCharacterSettingLibraryData,
  toSceneSettingLibraryData,
  toSettingLibraryListItem,
} from '../../domain/settingLibrary';
import { localPersistenceService } from '../../editor-services/localPersistenceService';
import { formatCharacterNodeText, formatSceneNodeText } from '../../lib/export';

type UseSettingLibraryParams = {
  nodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  getCenterPosition: () => { x: number; y: number };
  language: 'zh' | 'en' | 'ja';
  showToast: (message: string, tone?: 'success' | 'error') => void;
};

const isCharacterNode = (node: Node): node is Node<CharacterNodeData> => node.type === 'characterNode';
const isSceneNode = (node: Node): node is Node<SceneNodeData> => node.type === 'sceneNode';
const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const hasCharacterSettingContent = (data: CharacterNodeData) => {
  const characterName = typeof data.characterName === 'string' ? data.characterName.trim() : '';
  const isDefaultName = /^(新角色|新キャラクター|New Character)$/i.test(characterName);
  return (
    (characterName.length > 0 && !isDefaultName) ||
    [
      data.identity,
      data.appearance,
      data.traits,
      data.personality,
      data.habits,
      data.speechStyle,
      data.experience,
      data.relationships,
      data.notes,
      data.features,
      data.background,
      data.other,
      data.voiceProfileId,
      data.voiceId,
      data.avatarUrl,
      data.threeViewUrl,
      data.tagSpriteUrl,
    ].some(hasText) ||
    data.outfits?.some((outfit) => hasText(outfit.name) || hasText(outfit.imageUrl)) === true
  );
};

const hasSceneSettingContent = (data: SceneNodeData) => {
  const sceneName = typeof data.sceneName === 'string' ? data.sceneName.trim() : '';
  const isDefaultName = /^(新场景|新シーン|New Scene)$/i.test(sceneName);
  return (
    (sceneName.length > 0 && !isDefaultName) ||
    [
      data.location,
      data.time,
      data.weather,
      data.visual,
      data.sound,
      data.items,
      data.atmosphere,
      data.notes,
      data.description,
      data.other,
      data.coverImageUrl,
    ].some(hasText) ||
    data.images?.some((image) => hasText(image.name) || hasText(image.imageUrl)) === true
  );
};

const cloneCharacterData = (data: CharacterNodeData, id: string, libraryItemId?: string) => ({
  ...data,
  id,
  libraryItemId,
  isMinimized: false,
  isGlobal: undefined,
  outfits: data.outfits?.map((outfit) => ({ ...outfit })),
});

const cloneSceneData = (data: SceneNodeData, id: string, libraryItemId?: string) => ({
  ...data,
  id,
  libraryItemId,
  isMinimized: false,
  isGlobal: undefined,
  images: data.images?.map((image) => ({ ...image })),
});

export const useSettingLibrary = ({
  nodes,
  setNodes,
  getCenterPosition,
  language,
  showToast,
}: UseSettingLibraryParams) => {
  const [savedItems, setSavedItems] = useState<SettingLibraryItem[]>([]);
  const [presetItems, setPresetItems] = useState<SettingLibraryItem[]>([]);

  const refreshSettingLibrary = useCallback(async () => {
    const items = await localPersistenceService.listSettingLibraryItems();
    setSavedItems(items);
  }, []);

  useEffect(() => {
    void refreshSettingLibrary().catch((error) => {
      console.error('Failed to load setting library:', error);
    });
  }, [refreshSettingLibrary]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      (['character', 'scene'] as const)
        .flatMap((kind) => getSettingLibraryPresets(kind))
        .map((item) => loadSettingLibraryPreset(item.id)),
    ).then((items) => {
      if (!cancelled) setPresetItems(items.filter((item): item is SettingLibraryItem => Boolean(item)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleLibraryChange = () => {
      void refreshSettingLibrary();
    };

    window.addEventListener('galwriter-setting-library-changed', handleLibraryChange);
    return () => window.removeEventListener('galwriter-setting-library-changed', handleLibraryChange);
  }, [refreshSettingLibrary]);

  const savedListItems = useMemo(
    () => savedItems.map((item) => toSettingLibraryListItem(item, 'saved')),
    [savedItems],
  );

  const presetListItems = useMemo(
    () => presetItems.map((item) => toSettingLibraryListItem(item, 'preset')),
    [presetItems],
  );

  const assistantContext = useMemo(() => {
    const availableItems = [...savedItems, ...presetItems].slice(0, 20);
    if (availableItems.length === 0) return '';
    const formattedItems = availableItems.map((item, index) => {
      const content =
        item.kind === 'character'
          ? formatCharacterNodeText(item.data as CharacterNodeData)
          : formatSceneNodeText(item.data as SceneNodeData);
      return `${index + 1}. [${item.kind}] ${item.name}\n${content}`;
    });
    return [
      '【可用设定库】',
      '下列设定可在回答、写作和生成新卡片时直接使用。若用户点名某个设定，优先保留其事实，不要随意改写核心信息。',
      formattedItems.join('\n\n---\n\n'),
    ].join('\n');
  }, [presetItems, savedItems]);

  const saveSettingLibrary = useCallback(
    async (nodeId: string, kind: SettingLibraryKind, mode: 'new' | 'update') => {
      const node = nodes.find((item) => item.id === nodeId);
      const now = Date.now();
      if (!node) return;
      let item: SettingLibraryItem;

      if (kind === 'character') {
        if (!isCharacterNode(node)) return;
        if (!hasCharacterSettingContent(node.data)) {
          showToast(
            language === 'zh'
              ? '请先填写至少一项人物设定，再保存到设定库'
              : language === 'ja'
                ? '保存前に、人物設定を1項目以上入力してください'
                : 'Add at least one character detail before saving to the library.',
            'error',
          );
          return;
        }
        const currentLibraryItemId = node.data.libraryItemId;
        const existing =
          mode === 'update' && currentLibraryItemId
            ? await localPersistenceService.getSettingLibraryItem(currentLibraryItemId)
            : null;
        const characterName = typeof node.data.characterName === 'string' ? node.data.characterName.trim() : '';
        item = {
          id: existing?.id || uuidv4(),
          kind,
          name: characterName || (language === 'zh' ? '未命名人物' : 'Untitled Character'),
          data: toCharacterSettingLibraryData(node.data),
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
      } else {
        if (!isSceneNode(node)) return;
        if (!hasSceneSettingContent(node.data)) {
          showToast(
            language === 'zh'
              ? '请先填写至少一项场景设定，再保存到设定库'
              : language === 'ja'
                ? '保存前に、シーン設定を1項目以上入力してください'
                : 'Add at least one scene detail before saving to the library.',
            'error',
          );
          return;
        }
        const currentLibraryItemId = node.data.libraryItemId;
        const existing =
          mode === 'update' && currentLibraryItemId
            ? await localPersistenceService.getSettingLibraryItem(currentLibraryItemId)
            : null;
        const sceneName = typeof node.data.sceneName === 'string' ? node.data.sceneName.trim() : '';
        item = {
          id: existing?.id || uuidv4(),
          kind,
          name: sceneName || (language === 'zh' ? '未命名场景' : 'Untitled Scene'),
          data: toSceneSettingLibraryData(node.data),
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
      }

      await localPersistenceService.saveSettingLibraryItem(item);
      setNodes((currentNodes) =>
        currentNodes.map((currentNode) =>
          currentNode.id === nodeId
            ? { ...currentNode, data: { ...currentNode.data, libraryItemId: item.id } }
            : currentNode,
        ),
      );
      await refreshSettingLibrary();
      window.dispatchEvent(new Event('galwriter-setting-library-changed'));
      showToast(
        language === 'zh'
          ? mode === 'update'
            ? '设定库已更新'
            : '已保存到设定库'
          : mode === 'update'
            ? 'Library item updated'
            : 'Saved to library',
      );
    },
    [language, nodes, refreshSettingLibrary, setNodes, showToast],
  );

  const useSettingLibraryItem = useCallback(
    async (
      targetNodeId: string,
      kind: SettingLibraryKind,
      itemId: string,
      source: SettingLibrarySource,
    ) => {
      const item =
        source === 'preset'
          ? await loadSettingLibraryPreset(itemId)
          : await localPersistenceService.getSettingLibraryItem(itemId);
      if (!item || item.kind !== kind) return;

      const targetNode = nodes.find((node) => node.id === targetNodeId);
      const targetIsEmpty =
        (kind === 'character' &&
          targetNode?.type === 'characterNode' &&
          !hasCharacterSettingContent({
            ...(targetNode.data as CharacterNodeData),
            characterName: '',
          })) ||
        (kind === 'scene' &&
          targetNode?.type === 'sceneNode' &&
          !hasSceneSettingContent({
            ...(targetNode.data as SceneNodeData),
            sceneName: '',
          }));

      if (targetIsEmpty) {
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id !== targetNodeId || node.type !== targetNode?.type) return node;
            const libraryData = item.data as CharacterNodeData | SceneNodeData;
            return {
              ...node,
              data: {
                ...node.data,
                ...libraryData,
                libraryItemId: source === 'saved' ? item.id : undefined,
                ...(kind === 'character'
                  ? { outfits: (libraryData as CharacterNodeData).outfits?.map((outfit) => ({ ...outfit })) }
                  : { images: (libraryData as SceneNodeData).images?.map((image) => ({ ...image })) }),
              },
            };
          }),
        );
        showToast(
          language === 'zh'
            ? `已将「${item.name}」填入当前${kind === 'character' ? '人物' : '场景'}设定`
            : `Applied ${item.name} to the current ${kind === 'character' ? 'character' : 'scene'}.`,
        );
        return;
      }

      const id = uuidv4();
      const center = getCenterPosition();
      const node: Node =
        kind === 'character'
          ? {
              id,
              type: 'characterNode',
              position: { x: center.x - 220, y: center.y - 180 },
              selected: true,
              data: cloneCharacterData(
                item.data as CharacterNodeData,
                id,
                source === 'saved' ? item.id : undefined,
              ),
            }
          : {
              id,
              type: 'sceneNode',
              position: { x: center.x - 220, y: center.y - 180 },
              selected: true,
              data: cloneSceneData(
                item.data as SceneNodeData,
                id,
                source === 'saved' ? item.id : undefined,
              ),
            };

      setNodes((currentNodes) => [
        ...currentNodes.map((currentNode) => ({ ...currentNode, selected: false })),
        node,
      ]);
      showToast(language === 'zh' ? `已添加「${item.name}」` : `Added ${item.name}`);
    },
    [getCenterPosition, language, nodes, setNodes, showToast],
  );

  const deleteSettingLibrary = useCallback(
    async (itemId: string) => {
      await localPersistenceService.deleteSettingLibraryItem(itemId);
      await refreshSettingLibrary();
      window.dispatchEvent(new Event('galwriter-setting-library-changed'));
      showToast(language === 'zh' ? '已从设定库删除' : 'Removed from library');
    },
    [language, refreshSettingLibrary, showToast],
  );

  const getListItems = useCallback(
    (kind: SettingLibraryKind, source: SettingLibrarySource): SettingLibraryListItem[] =>
      (source === 'saved' ? savedListItems : presetListItems).filter((item) => item.kind === kind),
    [presetListItems, savedListItems],
  );

  return {
    deleteSettingLibrary,
    assistantContext,
    getListItems,
    presetItems,
    presetListItems,
    refreshSettingLibrary,
    savedItems,
    savedListItems,
    saveSettingLibrary,
    useSettingLibraryItem,
  };
};
