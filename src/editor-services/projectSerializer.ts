import type { Edge, MarkerType, Node } from '@xyflow/react';
import JSZip from 'jszip';
import type { Dispatch, SetStateAction } from 'react';

import type {
  AIButtonsConfig,
  AIPromptsConfig,
  ImportedProjectSettings,
  StoryEdge,
  StoryNode,
  StoryProject,
} from '../domain/project';
import type {
  AssistantTask,
  EditorProjectSettings,
  EditorProjectSettingsSetters,
} from '../editor-state/editorConfig';

export type ProjectSnapshotData = StoryProject;

export type ProjectSerializerEdgeDefaults = {
  markerEnd: {
    type: MarkerType;
    width?: number;
    height?: number;
    color?: string;
  };
  style: StoryEdge['style'];
};

export interface ProjectSerializerOptions {
  defaultEdgeOptions: ProjectSerializerEdgeDefaults;
  defaultAIPrompts: AIPromptsConfig;
  defaultAIButtonsConfig: AIButtonsConfig;
}

export interface ExportZipParams {
  projectData: ProjectSnapshotData;
  fileName: string;
}

export interface ApplyImportedProjectParams {
  projectData: ProjectSnapshotData;
  settingsSetters: EditorProjectSettingsSetters;
  setAssistantTasks: Dispatch<SetStateAction<AssistantTask[]>>;
  setActiveAssistantTaskId: Dispatch<SetStateAction<string>>;
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

    for (let i = 0; i < slice.length; i += 1) {
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
    const fileName = `inline_${nodeId}_${type}_${index += 1}.${ext}`;
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
  if (incomingSettings.pasteAsPlainText !== undefined) {
    setters.setPasteAsPlainText(incomingSettings.pasteAsPlainText);
  }
  if (incomingSettings.showNodeActions !== undefined) {
    setters.setShowNodeActions(incomingSettings.showNodeActions);
  }
  if (incomingSettings.showStats !== undefined) setters.setShowStats(incomingSettings.showStats);
  if (incomingSettings.saveAssistantConversations !== undefined) {
    setters.setSaveAssistantConversations(incomingSettings.saveAssistantConversations);
  }
  if (incomingSettings.presetColors) setters.setPresetColors(incomingSettings.presetColors);
  if (incomingSettings.showTitles !== undefined) setters.setShowTitles(incomingSettings.showTitles);
  if (incomingSettings.generateLength) setters.setGenerateLength(incomingSettings.generateLength);
  if (incomingSettings.imageSize) setters.setImageSize(incomingSettings.imageSize);
  if (incomingSettings.aiPrompts) {
    setters.setAiPrompts({ ...defaultPrompts, ...incomingSettings.aiPrompts });
  }
  if (incomingSettings.aiButtonsConfig) {
    setters.setAiButtonsConfig({
      ...defaultButtonsConfig,
      ...incomingSettings.aiButtonsConfig,
    });
  }
  if (incomingSettings.scrollMode) setters.setScrollMode(incomingSettings.scrollMode);
  if (incomingSettings.showMiniMap !== undefined) {
    setters.setShowMiniMap(incomingSettings.showMiniMap);
  }
  if (incomingSettings.miniMapPosition === 'left' || incomingSettings.miniMapPosition === 'right') {
    setters.setMiniMapPosition(incomingSettings.miniMapPosition);
  }
  if (incomingSettings.showControls !== undefined) {
    setters.setShowControls(incomingSettings.showControls);
  }
  if (typeof incomingSettings.projectTitle === 'string') {
    setters.setProjectTitle(incomingSettings.projectTitle);
  }
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
  if (incomingSettings.bubbleStyle === 'glass' || incomingSettings.bubbleStyle === 'flat') {
    setters.setBubbleStyle(incomingSettings.bubbleStyle);
  }
  if (incomingSettings.playTestDarkMode !== undefined) {
    setters.setPlayTestDarkMode(incomingSettings.playTestDarkMode);
  }
  if (incomingSettings.playTestChoicesColumns !== undefined) {
    setters.setPlayTestChoicesColumns(incomingSettings.playTestChoicesColumns);
  }
  if (incomingSettings.playTestVideoAutoPlay !== undefined) {
    setters.setPlayTestVideoAutoPlay(incomingSettings.playTestVideoAutoPlay);
  }
  if (incomingSettings.playTestLayoutMode) {
    setters.setPlayTestLayoutMode(incomingSettings.playTestLayoutMode);
  }
  if (incomingSettings.playTestInteractionMode) {
    setters.setPlayTestInteractionMode(incomingSettings.playTestInteractionMode);
  }
  if (incomingSettings.playTestTypewriterSpeed !== undefined) {
    setters.setPlayTestTypewriterSpeed(incomingSettings.playTestTypewriterSpeed);
  }
  if (incomingSettings.playTestChoiceDelay !== undefined) {
    setters.setPlayTestChoiceDelay(incomingSettings.playTestChoiceDelay);
  }
  if (incomingSettings.playTestChoicesPosition) {
    setters.setPlayTestChoicesPosition(incomingSettings.playTestChoicesPosition);
  }
  if (incomingSettings.playTestBlurBackground !== undefined) {
    setters.setPlayTestBlurBackground(incomingSettings.playTestBlurBackground);
  }
  if (incomingSettings.playTestBlurText !== undefined) {
    setters.setPlayTestBlurText(incomingSettings.playTestBlurText);
  }
  if (incomingSettings.playTestSkipSingleChoicePopup !== undefined) {
    setters.setPlayTestSkipSingleChoicePopup(incomingSettings.playTestSkipSingleChoicePopup);
  }
  if (incomingSettings.playTestDimBackground !== undefined) {
    setters.setPlayTestDimBackground(incomingSettings.playTestDimBackground);
  }
};

const restoreProjectNodes = async (nodes: Node[], zip: JSZip | null) =>
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

const triggerDownload = (content: Blob, fileName: string) => {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const createProjectSerializer = (options: ProjectSerializerOptions) => {
  const createSnapshot = ({
    nodes,
    edges,
    settings,
    assistantTasks,
    activeAssistantTaskId,
  }: {
    nodes: Node[];
    edges: Edge[];
    settings: EditorProjectSettings;
    assistantTasks: AssistantTask[];
    activeAssistantTaskId: string;
  }) => {
    const simpleNodes = nodes.map((node) => ({
      id: node.id,
      position: node.position,
      type: node.type,
      style: node.style,
      data: { ...node.data },
      width: node.measured?.width || node.width,
      height: node.measured?.height || node.height,
      dragHandle: node.dragHandle,
    })) as StoryNode[];

    const simpleEdges: StoryEdge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: { label: typeof edge.data?.label === 'string' ? edge.data.label : '' },
    }));

    return {
      nodes: simpleNodes,
      edges: simpleEdges,
      settings,
      assistantTasks: settings.saveAssistantConversations ? assistantTasks : undefined,
      activeAssistantTaskId: settings.saveAssistantConversations ? activeAssistantTaskId : undefined,
    } satisfies ProjectSnapshotData;
  };

  const exportZip = async ({ projectData, fileName }: ExportZipParams) => {
    const zip = new JSZip();
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
          const mediaFileName = `media_${node.id}_${field}.${extension}`;
          assetsFolder?.file(mediaFileName, blob);
          nextNode.data[field] = `assets/${mediaFileName}`;
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

    const exportProject = {
      ...projectData,
      nodes: processedNodes,
    };

    zip.file('project.json', JSON.stringify(exportProject, null, 2));

    const content = await zip.generateAsync({ type: 'blob' });
    const normalizedFileName = fileName.endsWith('.zip') ? fileName : `${fileName}.zip`;
    triggerDownload(content, normalizedFileName);

    return exportProject;
  };

  const importZip = async (file: File) => {
    if (file.name.endsWith('.json')) {
      return {
        projectData: JSON.parse(await file.text()) as ProjectSnapshotData,
        zip: null,
      };
    }

    const zip = await JSZip.loadAsync(file);
    const projectJsonFile = zip.file('project.json');
    if (!projectJsonFile) throw new Error('Invalid project: project.json not found');

    return {
      projectData: JSON.parse(await projectJsonFile.async('string')) as ProjectSnapshotData,
      zip,
    };
  };

  const restoreImportedProject = async (projectData: ProjectSnapshotData, zip: JSZip | null) => {
    const restoredNodes = await restoreProjectNodes(projectData.nodes, zip);

    return {
      ...projectData,
      nodes: restoredNodes,
      edges: projectData.edges.map((edge) => ({
        ...edge,
        type: 'customEdge',
        markerEnd: options.defaultEdgeOptions.markerEnd,
        style: options.defaultEdgeOptions.style,
      })),
    };
  };

  const applyImportedProject = async (
    { projectData, settingsSetters, setAssistantTasks, setActiveAssistantTaskId }: ApplyImportedProjectParams,
    zip: JSZip | null,
  ) => {
    const restoredProject = await restoreImportedProject(projectData, zip);

    applyProjectSettings(
      restoredProject.settings,
      settingsSetters,
      options.defaultAIPrompts,
      options.defaultAIButtonsConfig,
    );

    if (
      restoredProject.settings?.saveAssistantConversations !== false &&
      Array.isArray(restoredProject.assistantTasks) &&
      restoredProject.assistantTasks.length > 0
    ) {
      setAssistantTasks(restoredProject.assistantTasks);
      const incomingActiveTaskId = restoredProject.activeAssistantTaskId;
      setActiveAssistantTaskId(
        incomingActiveTaskId &&
          restoredProject.assistantTasks.some((task) => task.id === incomingActiveTaskId)
          ? incomingActiveTaskId
          : restoredProject.assistantTasks[0].id,
      );
    }

    return restoredProject;
  };

  return {
    createSnapshot,
    exportZip,
    importZip,
    restoreImportedProject,
    applyImportedProject,
    applyProjectSettings: (
      incomingSettings: ImportedProjectSettings | undefined,
      setters: EditorProjectSettingsSetters,
    ) =>
      applyProjectSettings(
        incomingSettings,
        setters,
        options.defaultAIPrompts,
        options.defaultAIButtonsConfig,
      ),
  };
};
