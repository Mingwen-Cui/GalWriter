import type { Edge, MarkerType, Node } from '@xyflow/react';
import JSZip from 'jszip';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo } from 'react';

import type {
  AIButtonsConfig,
  AIPromptsConfig,
  AssistantTask,
  EditorProjectSettings,
  EditorProjectSettingsSetters,
} from '../../editor-state/editorConfig';
import { autosaveService } from '../../editor-services/autosaveService';
import {
  createProjectSerializer,
  type ProjectSnapshotData,
} from '../../editor-services/projectSerializer';

type EdgeDefaults = {
  markerEnd: {
    type: MarkerType;
    width?: number;
    height?: number;
    color?: string;
  };
  style: React.CSSProperties | undefined;
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
}

export { type ProjectSnapshotData };

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
}: UseProjectSerializationParams) => {
  const projectSerializer = useMemo(
    () =>
      createProjectSerializer({
        defaultEdgeOptions,
        defaultAIPrompts,
        defaultAIButtonsConfig,
      }),
    [defaultAIButtonsConfig, defaultAIPrompts, defaultEdgeOptions],
  );

  const createSnapshotData = useCallback(
    () =>
      projectSerializer.createSnapshot({
        nodes,
        edges,
        settings,
        assistantTasks,
        activeAssistantTaskId,
      }),
    [activeAssistantTaskId, assistantTasks, edges, nodes, projectSerializer, settings],
  );

  const getProjectSnapshot = useCallback(() => {
    return JSON.stringify(createSnapshotData());
  }, [createSnapshotData]);

  const applyProjectData = useCallback(
    async (projectData: ProjectSnapshotData, options?: { zip?: JSZip | null; markSaved?: boolean }) => {
      const restoredProject = await projectSerializer.applyImportedProject(
        {
          projectData,
          settingsSetters,
          setAssistantTasks,
          setActiveAssistantTaskId,
        },
        options?.zip ?? null,
      );

      setNodes(restoredProject.nodes as Node[]);
      setEdges(restoredProject.edges as Edge[]);

      if (options?.markSaved ?? true) {
        lastSavedSnapshotRef.current = JSON.stringify(projectData);
        setIsDirty(false);
      }
    },
    [
      lastSavedSnapshotRef,
      projectSerializer,
      setActiveAssistantTaskId,
      setAssistantTasks,
      setEdges,
      setIsDirty,
      setNodes,
      settingsSetters,
    ],
  );

  const confirmExportZIP = useCallback(async () => {
    try {
      const projectData = createSnapshotData();
      const exportedProject = await projectSerializer.exportZip({
        projectData,
        fileName: saveFileName,
      });

      lastSavedSnapshotRef.current = JSON.stringify(exportedProject);
      setIsDirty(false);
      setShowSaveNameModal(false);
      await autosaveService.clear();
      showToast(settings.language === 'zh' ? '剧本工程已保存为 ZIP 文件' : 'Project saved as ZIP');
    } catch (error) {
      console.error('Export failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      window.alert(
        settings.language === 'zh' ? `导出失败: ${message}` : `Export failed: ${message}`,
      );
    }
  }, [
    createSnapshotData,
    lastSavedSnapshotRef,
    projectSerializer,
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
        const { projectData, zip } = await projectSerializer.importZip(file);
        if (projectData.nodes && projectData.edges) {
          await applyProjectData(projectData, { zip, markSaved: true });
        }
      } catch (error) {
        console.error('Import failed:', error);
        window.alert('Failed to load project. The file is corrupted or invalid.');
      }

      event.target.value = '';
    },
    [applyProjectData, getProjectSnapshot, lastSavedSnapshotRef, projectSerializer],
  );

  return {
    getProjectSnapshot,
    applyProjectData,
    confirmExportZIP,
    confirmExportJSON: confirmExportZIP,
    handleImportZIP,
  };
};
