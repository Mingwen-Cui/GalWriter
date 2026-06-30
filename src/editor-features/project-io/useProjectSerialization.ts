import type { Edge, MarkerType, Node } from '@xyflow/react';
import type JSZip from 'jszip';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo } from 'react';

import { useDialog } from '../../editor-shell/DialogProvider';
import type {
  AIButtonsConfig,
  AIPromptsConfig,
  AssistantTask,
  EditorProjectSettings,
  EditorProjectSettingsSetters,
} from '../../editor-state/editorConfig';
import type { ProjectAIProfilesExport } from '../../domain/project';
import { autosaveService } from '../../editor-services/autosaveService';
import {
  createProjectSerializer,
  type ProjectSnapshotData,
} from '../../editor-services/projectSerializer';
import { stableStringify } from '../../lib/stableStringify';

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
  currentProjectId: string | null;
  currentProjectFilePath: string | null;
  defaultProjectSaveDir: string | null;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setIsDirty: Dispatch<SetStateAction<boolean>>;
  setShowSaveNameModal: Dispatch<SetStateAction<boolean>>;
  lastSavedSnapshotRef: React.MutableRefObject<string>;
  showToast: (message: string) => void;
  getProjectThumbnailDataUrl?: () => Promise<string | null>;
  getExportedAIProfiles?: () => ProjectAIProfilesExport | null;
  onProjectFilePathSaved?: (filePath: string) => Promise<void> | void;
  onImportedProject?: (params: {
    projectData: ProjectSnapshotData;
    suggestedProjectName: string;
    replaceCurrentProject: boolean;
    zip: JSZip | null;
    thumbnailDataUrl?: string | null;
  }) => Promise<boolean> | boolean;
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
  currentProjectId,
  currentProjectFilePath,
  defaultProjectSaveDir,
  setNodes,
  setEdges,
  setIsDirty,
  setShowSaveNameModal,
  lastSavedSnapshotRef,
  showToast,
  getProjectThumbnailDataUrl,
  getExportedAIProfiles,
  onProjectFilePathSaved,
  onImportedProject,
  defaultEdgeOptions,
  defaultAIPrompts,
  defaultAIButtonsConfig,
}: UseProjectSerializationParams) => {
  const { alert: showDialogAlert } = useDialog();
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
    return stableStringify(createSnapshotData());
  }, [createSnapshotData]);

  const applyProjectData = useCallback(
    async (
      projectData: ProjectSnapshotData,
      options?: { zip?: JSZip | null; markSaved?: boolean },
    ) => {
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
        lastSavedSnapshotRef.current = stableStringify(projectData);
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

  const confirmExportZIP = useCallback(
    async (options?: { includeApiProfiles?: boolean }) => {
      try {
        const projectData = createSnapshotData();
        if (options?.includeApiProfiles) {
          const exportedAIProfiles = getExportedAIProfiles?.();
          if (exportedAIProfiles?.profiles.length) {
            projectData.exportedAIProfiles = exportedAIProfiles;
          }
        }
        const thumbnailDataUrl = await getProjectThumbnailDataUrl?.();
        const exportedProject = await projectSerializer.exportZip({
          projectData,
          fileName: saveFileName,
          filePath: currentProjectFilePath,
          thumbnailDataUrl,
          defaultSaveDir: defaultProjectSaveDir,
        });

        if (exportedProject.canceled) return;

        if (exportedProject.filePath) {
          await onProjectFilePathSaved?.(exportedProject.filePath);
        }

        lastSavedSnapshotRef.current = stableStringify(exportedProject.projectData);
        setIsDirty(false);
        setShowSaveNameModal(false);
        if (currentProjectId) {
          await autosaveService.clearForProject(currentProjectId);
        }
        showToast(
          settings.language === 'zh' ? '剧本工程已保存为 ZIP 文件' : 'Project saved as ZIP',
        );
        const savedLocation = exportedProject.filePath
          ? exportedProject.filePath
          : settings.language === 'zh'
            ? '浏览器下载文件夹'
            : 'your browser downloads folder';
        showToast(
          settings.language === 'zh'
            ? `ZIP 备份已导出到：${savedLocation}`
            : `ZIP backup exported to: ${savedLocation}`,
        );
      } catch (error) {
        console.error('Export failed:', error);
        const message = error instanceof Error ? error.message : String(error);
        await showDialogAlert({
          title:
            settings.language === 'zh'
              ? '导出失败'
              : settings.language === 'ja'
                ? 'エクスポートに失敗しました'
                : 'Export failed',
          description: message,
          tone: 'warning',
        });
      }
    },
    [
      createSnapshotData,
      currentProjectId,
      currentProjectFilePath,
      defaultProjectSaveDir,
      getExportedAIProfiles,
      getProjectThumbnailDataUrl,
      lastSavedSnapshotRef,
      onProjectFilePathSaved,
      projectSerializer,
      saveFileName,
      setIsDirty,
      setShowSaveNameModal,
      settings.language,
      showToast,
    ],
  );

  const handleImportZIP = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const importedEntries = await projectSerializer.importProjectEntries(file);
        for (const {
          projectData,
          suggestedProjectName,
          zip,
          thumbnailDataUrl,
        } of importedEntries) {
          if (!projectData.nodes || !projectData.edges) continue;
          const handled = await onImportedProject?.({
            projectData,
            suggestedProjectName,
            replaceCurrentProject: importedEntries.length === 1 && Boolean(currentProjectId),
            zip,
            thumbnailDataUrl,
          });

          if (!handled) {
            await applyProjectData(projectData, { zip, markSaved: true });
          }
        }
      } catch (error) {
        console.error('Import failed:', error);
        await showDialogAlert({
          title:
            settings.language === 'zh'
              ? '导入失败'
              : settings.language === 'ja'
                ? 'インポートに失敗しました'
                : 'Import failed',
          description:
            settings.language === 'zh'
              ? '项目文件已损坏或格式无效。'
              : settings.language === 'ja'
                ? 'プロジェクトファイルが壊れているか、形式が無効です。'
                : 'The project file is corrupted or invalid.',
          tone: 'warning',
        });
      }

      event.target.value = '';
    },
    [applyProjectData, currentProjectId, onImportedProject, projectSerializer, settings.language, showDialogAlert],
  );

  return {
    getProjectSnapshot,
    applyProjectData,
    confirmExportZIP,
    confirmExportJSON: confirmExportZIP,
    handleImportZIP,
  };
};
