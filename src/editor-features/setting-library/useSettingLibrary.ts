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
  toCharacterSettingLibraryData,
  toSceneSettingLibraryData,
  toSettingLibraryListItem,
  type SettingLibraryItem,
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
    () =>
      (['character', 'scene'] as const).flatMap((kind) =>
        getSettingLibraryPresets(kind).map((item) => ({
          id: item.id,
          kind: item.kind,
          name: item.name,
          source: 'preset' as const,
          updatedAt: 0,
        })),
      ),
    [],
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
      const currentLibraryItemId = node.data.libraryItemId;
      const existing =
        mode === 'update' && currentLibraryItemId
          ? await localPersistenceService.getSettingLibraryItem(currentLibraryItemId)
          : null;
      let item: SettingLibraryItem;

      if (kind === 'character') {
        if (!isCharacterNode(node)) return;
        item = {
          id: existing?.id || uuidv4(),
          kind,
          name: node.data.characterName.trim() || (language === 'zh' ? '未命名人物' : 'Untitled Character'),
          data: toCharacterSettingLibraryData(node.data),
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
      } else {
        if (!isSceneNode(node)) return;
        item = {
          id: existing?.id || uuidv4(),
          kind,
          name: node.data.sceneName.trim() || (language === 'zh' ? '未命名场景' : 'Untitled Scene'),
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
    async (kind: SettingLibraryKind, itemId: string, source: SettingLibrarySource) => {
      const item =
        source === 'preset'
          ? await loadSettingLibraryPreset(itemId)
          : await localPersistenceService.getSettingLibraryItem(itemId);
      if (!item || item.kind !== kind) return;

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
    [getCenterPosition, language, setNodes, showToast],
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
    presetListItems,
    refreshSettingLibrary,
    savedListItems,
    saveSettingLibrary,
    useSettingLibraryItem,
  };
};
