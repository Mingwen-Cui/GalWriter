import type { Edge, MarkerType, Node } from '@xyflow/react';
import JSZip from 'jszip';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';

import type {
  AIButtonsConfig,
  AIPromptsConfig,
  AssistantTask,
  EditorProjectSettings,
  EditorProjectSettingsSetters,
  ImportedProjectSettings,
} from '../../editor-state/editorConfig';

type ProjectNode = {
  id: string;
  position: Node['position'];
  type: Node['type'];
  style: Node['style'];
  data: Record<string, unknown>;
  width?: number;
  height?: number;
  dragHandle?: string;
};

type ProjectEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: { label: string };
};

export interface ProjectSnapshotData {
  nodes: ProjectNode[];
  edges: ProjectEdge[];
  settings: EditorProjectSettings;
  assistantTasks?: AssistantTask[];
  activeAssistantTaskId?: string;
}

type EdgeDefaults = {
  markerEnd: {
    type: MarkerType;
    width?: number;
    height?: number;
    color?: string;
  };
  style: Edge['style'];
};

interface UseProjectSerializationParams {
  nodes: Node[];
  edges: Edge[];
  settings: EditorProjectSettings;
  settingsSetters: EditorProjectSettingsSetters;
  assistantTasks: AssistantTask[];
  activeAssistantTaskId: string;
  setAssistantTasks: Dispatch<SetStateAction<AssistantTask[]>>;
  setActiveAssistantTaskId: Dispatch<SetStateAction<string>>;
  saveFileName: string;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setIsDirty: Dispatch<SetStateAction<boolean>>;
  setShowSaveNameModal: Dispatch<SetStateAction<boolean>>;
  lastSavedSnapshotRef: React.MutableRefObject<string>;
  showToast: (message: string) => void;
  defaultEdgeOptions: EdgeDefaults;
  defaultAIPrompts: AIPromptsConfig;
  defaultAIButtonsConfig: AIButtonsConfig;
  clearAutoSave: () => Promise<void>;
}

const base64ToBlob = (base64: string) => {
  const parts = base64.split(';base64,');
  if (parts.length !== 2) return null;
  const contentType = parts[0].split(':')[1];
  const byteCharacters = atob(parts[1]);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: contentType });
};

const urlToBlob = async (url: string) => {
  if (!url) return null;
  if (url.startsWith('data:')) return base64ToBlob(url);
  if (url.startsWith('blob:')) {
    try {
      const response = await fetch(url);
      return await response.blob();
    } catch (error) {
      console.error('Failed to fetch blob URL', error);
      return null;
    }
  }
  return null;
};

const processHtmlMedia = async (html: string, assetsFolder: JSZip | null, nodeId: string) => {
  if (!html) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll('img, video, source, audio');
  let index = 0;

  for (const element of Array.from(elements)) {
    const src = element.getAttribute('src');
    if (!src || (!src.startsWith('data:') && !src.startsWith('blob:'))) continue;

    const blob = await urlToBlob(src);
    if (!blob) continue;

    const type = blob.type.split('/')[0];
    const ext = blob.type.split('/')[1] || 'bin';
    const fileName = `inline_${nodeId}_${type}_${index++}.${ext}`;
    assetsFolder?.file(fileName, blob);
    element.setAttribute('src', `assets/${fileName}`);
  }

  return doc.body.innerHTML;
};

const restoreHtmlMedia = async (html: string, zip: JSZip | null) => {
  if (!html || !zip) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll('img, video, source, audio');

  for (const element of Array.from(elements)) {
    const src = element.getAttribute('src');
    if (!src || !src.startsWith('assets/')) continue;
    const assetFile = zip.file(src);
    if (!assetFile) continue;
    const blob = await assetFile.async('blob');
    element.setAttribute('src', URL.createObjectURL(blob));
  }

  return doc.body.innerHTML;
};

const applyProjectSettings = (
  incomingSettings: ImportedProjectSettings | undefined,
  setters: EditorProjectSettingsSetters,
  defaultPrompts: AIPromptsConfig,
  defaultButtonsConfig: AIButtonsConfig,
) => {
  if (!incomingSettings) return;

  if (incomingSettings.canvasBg) setters.setCanvasBg(incomingSettings.canvasBg);
  if (incomingSettings.edgeStyle) setters.setEdgeStyle(incomingSettings.edgeStyle);
  if (incomingSettings.customApiKey) setters.setCustomApiKey(incomingSettings.customApiKey);
  if (incomingSettings.pasteAsPlainText !== undefined)
    setters.setPasteAsPlainText(incomingSettings.pasteAsPlainText);
  if (incomingSettings.showNodeActions !== undefined)
    setters.setShowNodeActions(incomingSettings.showNodeActions);
  if (incomingSettings.showStats !== undefined) setters.setShowStats(incomingSettings.showStats);
  if (incomingSettings.saveAssistantConversations !== undefined)
    setters.setSaveAssistantConversations(incomingSettings.saveAssistantConversations);
  if (incomingSettings.presetColors) setters.setPresetColors(incomingSettings.presetColors);
  if (incomingSettings.showTitles !== undefined) setters.setShowTitles(incomingSettings.showTitles);
  if (incomingSettings.generateLength) setters.setGenerateLength(incomingSettings.generateLength);
  if (incomingSettings.aiProvider) setters.setAiProvider(incomingSettings.aiProvider);
  if (incomingSettings.deepseekApiKey) setters.setDeepseekApiKey(incomingSettings.deepseekApiKey);
  if (incomingSettings.openaiApiKey) setters.setOpenaiApiKey(incomingSettings.openaiApiKey);
  if (incomingSettings.imageApiKey) setters.setImageApiKey(incomingSettings.imageApiKey);
  if (incomingSettings.imageApiUrl) setters.setImageApiUrl(incomingSettings.imageApiUrl);
  if (incomingSettings.imageModel) setters.setImageModel(incomingSettings.imageModel);
  if (incomingSettings.imageSize) setters.setImageSize(incomingSettings.imageSize);
  if (incomingSettings.ttsApiKey) setters.setTtsApiKey(incomingSettings.ttsApiKey);
  if (incomingSettings.ttsApiUrl) setters.setTtsApiUrl(incomingSettings.ttsApiUrl);
  if (incomingSettings.ttsModel) setters.setTtsModel(incomingSettings.ttsModel);
  if (incomingSettings.ttsVoice) setters.setTtsVoice(incomingSettings.ttsVoice);
  if (incomingSettings.ttsProvider === 'system' || incomingSettings.ttsProvider === 'youdao')
    setters.setTtsProvider(incomingSettings.ttsProvider);
  if (incomingSettings.thinkingMode !== undefined)
    setters.setThinkingMode(incomingSettings.thinkingMode);
  if (incomingSettings.aiPrompts)
    setters.setAiPrompts({ ...defaultPrompts, ...incomingSettings.aiPrompts });
  if (incomingSettings.aiButtonsConfig)
    setters.setAiButtonsConfig({
      ...defaultButtonsConfig,
      ...incomingSettings.aiButtonsConfig,
    });
  if (incomingSettings.scrollMode) setters.setScrollMode(incomingSettings.scrollMode);
  if (incomingSettings.showMiniMap !== undefined)
    setters.setShowMiniMap(incomingSettings.showMiniMap);
  if (incomingSettings.miniMapPosition === 'left' || incomingSettings.miniMapPosition === 'right') {
    setters.setMiniMapPosition(incomingSettings.miniMapPosition);
  }
  if (incomingSettings.showControls !== undefined)
    setters.setShowControls(incomingSettings.showControls);
  if (typeof incomingSettings.projectTitle === 'string')
    setters.setProjectTitle(incomingSettings.projectTitle);
  if (
    incomingSettings.toolbarLayout === 'horizontal' ||
    incomingSettings.toolbarLayout === 'vertical'
  ) {
    setters.setToolbarLayout(incomingSettings.toolbarLayout);
  }
  if (
    incomingSettings.selectionMenuLayout === 'horizontal' ||
    incomingSettings.selectionMenuLayout === 'vertical'
  ) {
    setters.setSelectionMenuLayout(incomingSettings.selectionMenuLayout);
  }
  if (incomingSettings.language) setters.setLanguage(incomingSettings.language);
  if (incomingSettings.theme) setters.setTheme(incomingSettings.theme);
  if (incomingSettings.bubbleStyle === 'glass' || incomingSettings.bubbleStyle === 'flat')
    setters.setBubbleStyle(incomingSettings.bubbleStyle);
  if (incomingSettings.playTestDarkMode !== undefined)
    setters.setPlayTestDarkMode(incomingSettings.playTestDarkMode);
  if (incomingSettings.playTestChoicesColumns !== undefined)
    setters.setPlayTestChoicesColumns(incomingSettings.playTestChoicesColumns);
  if (incomingSettings.playTestVideoAutoPlay !== undefined)
    setters.setPlayTestVideoAutoPlay(incomingSettings.playTestVideoAutoPlay);
  if (incomingSettings.playTestLayoutMode)
    setters.setPlayTestLayoutMode(incomingSettings.playTestLayoutMode);
  if (incomingSettings.playTestInteractionMode)
    setters.setPlayTestInteractionMode(incomingSettings.playTestInteractionMode);
  if (incomingSettings.playTestTypewriterSpeed !== undefined)
    setters.setPlayTestTypewriterSpeed(incomingSettings.playTestTypewriterSpeed);
  if (incomingSettings.playTestChoiceDelay !== undefined)
    setters.setPlayTestChoiceDelay(incomingSettings.playTestChoiceDelay);
  if (incomingSettings.playTestChoicesPosition)
    setters.setPlayTestChoicesPosition(incomingSettings.playTestChoicesPosition);
  if (incomingSettings.playTestBlurBackground !== undefined)
    setters.setPlayTestBlurBackground(incomingSettings.playTestBlurBackground);
  if (incomingSettings.playTestBlurText !== undefined)
    setters.setPlayTestBlurText(incomingSettings.playTestBlurText);
  if (incomingSettings.playTestSkipSingleChoicePopup !== undefined)
    setters.setPlayTestSkipSingleChoicePopup(incomingSettings.playTestSkipSingleChoicePopup);
  if (incomingSettings.playTestDimBackground !== undefined)
    setters.setPlayTestDimBackground(incomingSettings.playTestDimBackground);
};

const restoreProjectNodes = async (nodes: ProjectNode[], zip: JSZip | null) =>
  Promise.all(
    nodes.map(async (node) => {
      const restoredNode: Node = {
        ...node,
        data: { ...node.data },
        dragHandle: node.type === 'backgroundNode' ? '.custom-drag-handle' : node.dragHandle,
      };

      for (const field of ['imageUrl', 'videoUrl', 'audioUrl']) {
        const value = restoredNode.data[field];
        if (typeof value !== 'string' || !value.startsWith('assets/') || !zip) continue;
        const assetFile = zip.file(value);
        if (!assetFile) continue;
        const blob = await assetFile.async('blob');
        restoredNode.data[field] = URL.createObjectURL(blob);
      }

      if (typeof restoredNode.data.text === 'string') {
        restoredNode.data.text = await restoreHtmlMedia(restoredNode.data.text, zip);
      }

      if (typeof restoredNode.data.content === 'string') {
        restoredNode.data.content = await restoreHtmlMedia(restoredNode.data.content, zip);
      }

      return restoredNode;
    }),
  );

export const useProjectSerialization = ({
  nodes,
  edges,
  settings,
  settingsSetters,
  assistantTasks,
  activeAssistantTaskId,
  setAssistantTasks,
  setActiveAssistantTaskId,
  saveFileName,
  setNodes,
  setEdges,
  setIsDirty,
  setShowSaveNameModal,
  lastSavedSnapshotRef,
  showToast,
  defaultEdgeOptions,
  defaultAIPrompts,
  defaultAIButtonsConfig,
  clearAutoSave,
}: UseProjectSerializationParams) => {
  const getProjectSnapshot = useCallback(() => {
    const simpleNodes: ProjectNode[] = nodes.map((node) => ({
      id: node.id,
      position: node.position,
      type: node.type,
      style: node.style,
      data: { ...node.data },
      width: node.measured?.width || node.width,
      height: node.measured?.height || node.height,
      dragHandle: node.dragHandle,
    }));

    const simpleEdges: ProjectEdge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: { label: typeof edge.data?.label === 'string' ? edge.data.label : '' },
    }));

    return JSON.stringify({
      nodes: simpleNodes,
      edges: simpleEdges,
      settings,
      assistantTasks: settings.saveAssistantConversations ? assistantTasks : undefined,
      activeAssistantTaskId: settings.saveAssistantConversations ? activeAssistantTaskId : undefined,
    });
  }, [activeAssistantTaskId, assistantTasks, edges, nodes, settings]);

  const applyProjectData = useCallback(
    async (
      projectData: ProjectSnapshotData,
      options?: { zip?: JSZip | null; markSaved?: boolean },
    ) => {
      const restoredNodes = await restoreProjectNodes(projectData.nodes, options?.zip ?? null);
      setNodes(restoredNodes);
      setEdges(
        projectData.edges.map((edge) => ({
          ...edge,
          type: 'customEdge',
          markerEnd: defaultEdgeOptions.markerEnd,
          style: defaultEdgeOptions.style,
        })),
      );
      applyProjectSettings(
        projectData.settings,
        settingsSetters,
        defaultAIPrompts,
        defaultAIButtonsConfig,
      );

      if (
        projectData.settings?.saveAssistantConversations !== false &&
        Array.isArray(projectData.assistantTasks) &&
        projectData.assistantTasks.length > 0
      ) {
        setAssistantTasks(projectData.assistantTasks);
        const incomingActiveTaskId = projectData.activeAssistantTaskId;
        setActiveAssistantTaskId(
          incomingActiveTaskId &&
            projectData.assistantTasks.some((task) => task.id === incomingActiveTaskId)
            ? incomingActiveTaskId
            : projectData.assistantTasks[0].id,
        );
      }

      if (options?.markSaved ?? true) {
        lastSavedSnapshotRef.current = JSON.stringify(projectData);
        setIsDirty(false);
      }
    },
    [
      defaultAIButtonsConfig,
      defaultAIPrompts,
      defaultEdgeOptions.markerEnd,
      defaultEdgeOptions.style,
      lastSavedSnapshotRef,
      setEdges,
      setIsDirty,
      setNodes,
      setActiveAssistantTaskId,
      setAssistantTasks,
      settingsSetters,
    ],
  );

  const confirmExportZIP = useCallback(async () => {
    try {
      const zip = new JSZip();
      const projectData = JSON.parse(getProjectSnapshot()) as ProjectSnapshotData;
      const assetsFolder = zip.folder('assets');

      const processedNodes = await Promise.all(
        projectData.nodes.map(async (node) => {
          const nextNode = { ...node, data: { ...node.data } };

          for (const field of ['imageUrl', 'videoUrl', 'audioUrl']) {
            const value = nextNode.data[field];
            if (typeof value !== 'string') continue;
            if (!value.startsWith('data:') && !value.startsWith('blob:')) continue;

            const blob = await urlToBlob(value);
            if (!blob) continue;

            const extension = blob.type.split('/')[1] || 'bin';
            const fileName = `media_${node.id}_${field}.${extension}`;
            assetsFolder?.file(fileName, blob);
            nextNode.data[field] = `assets/${fileName}`;
          }

          if (typeof nextNode.data.text === 'string') {
            nextNode.data.text = await processHtmlMedia(nextNode.data.text, assetsFolder, node.id);
          }

          if (typeof nextNode.data.content === 'string') {
            nextNode.data.content = await processHtmlMedia(
              nextNode.data.content,
              assetsFolder,
              node.id,
            );
          }

          return nextNode;
        }),
      );

      projectData.nodes = processedNodes;
      zip.file('project.json', JSON.stringify(projectData, null, 2));

      const content = await zip.generateAsync({ type: 'blob' });
      const fileName = saveFileName.endsWith('.zip') ? saveFileName : `${saveFileName}.zip`;
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      lastSavedSnapshotRef.current = JSON.stringify(projectData);
      setIsDirty(false);
      setShowSaveNameModal(false);
      await clearAutoSave();
      showToast(settings.language === 'zh' ? '剧本工程已保存为 ZIP 文件' : 'Project saved as ZIP');
    } catch (error) {
      console.error('Export failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      window.alert(
        settings.language === 'zh' ? `导出失败: ${message}` : `Export failed: ${message}`,
      );
    }
  }, [
    clearAutoSave,
    getProjectSnapshot,
    lastSavedSnapshotRef,
    saveFileName,
    setIsDirty,
    setShowSaveNameModal,
    settings.language,
    showToast,
  ]);

  const handleImportZIP = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (
        lastSavedSnapshotRef.current !== getProjectSnapshot() &&
        !window.confirm('当前项目有未保存的更改，导入新文件将覆盖当前内容。确定要继续吗？')
      ) {
        event.target.value = '';
        return;
      }

      try {
        let data: ProjectSnapshotData;
        let zip: JSZip | null = null;

        if (file.name.endsWith('.json')) {
          data = JSON.parse(await file.text()) as ProjectSnapshotData;
        } else {
          zip = await JSZip.loadAsync(file);
          const projectJsonFile = zip.file('project.json');
          if (!projectJsonFile) throw new Error('Invalid project: project.json not found');
          data = JSON.parse(await projectJsonFile.async('string')) as ProjectSnapshotData;
        }

        if (data.nodes && data.edges) {
          await applyProjectData(data, { zip, markSaved: true });
        }
      } catch (error) {
        console.error('Import failed:', error);
        window.alert('Failed to load project. The file is corrupted or invalid.');
      }

      event.target.value = '';
    },
    [applyProjectData, getProjectSnapshot, lastSavedSnapshotRef],
  );

  return {
    getProjectSnapshot,
    applyProjectData,
    confirmExportZIP,
    confirmExportJSON: confirmExportZIP,
    handleImportZIP,
  };
};
