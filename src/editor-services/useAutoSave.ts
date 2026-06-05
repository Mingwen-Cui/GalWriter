import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { autosaveService } from './autosaveService';
import type { Language } from '../lib/i18n';

interface AutoSavePayload {
  snapshot: string;
  timestamp: number;
}

interface UseAutoSaveParams<TProjectData> {
  projectId: string | null;
  getProjectSnapshot: () => string;
  lastSavedSnapshotRef: MutableRefObject<string>;
  setIsDirty: Dispatch<SetStateAction<boolean>>;
  applyRecoveredProject: (projectData: TProjectData) => Promise<void>;
  showToast: (message: string) => void;
  language: Language;
  enabled: boolean;
}

export const useAutoSave = <TProjectData>({
  projectId,
  getProjectSnapshot,
  lastSavedSnapshotRef,
  setIsDirty,
  applyRecoveredProject,
  showToast,
  language,
  enabled,
}: UseAutoSaveParams<TProjectData>) => {
  const [showAutoSaveModal, setShowAutoSaveModal] = useState(false);
  const [autoSaveData, setAutoSaveData] = useState<AutoSavePayload | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !projectId) return;
    autosaveService.loadForProject(projectId).then((data) => {
      if (!data) return;
      if (data.snapshot === lastSavedSnapshotRef.current) {
        void autosaveService.clearForProject(projectId);
        return;
      }
      setAutoSaveData(data);
      setShowAutoSaveModal(true);
    });
  }, [enabled, lastSavedSnapshotRef, projectId]);

  useEffect(() => {
    if (!enabled || !projectId) return;
    const currentSnapshot = getProjectSnapshot();
    const isNowDirty = currentSnapshot !== lastSavedSnapshotRef.current;
    setIsDirty(isNowDirty);

    if (isNowDirty) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        await autosaveService.saveForProject(projectId, currentSnapshot);
      }, 5000);
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [enabled, getProjectSnapshot, lastSavedSnapshotRef, projectId, setIsDirty]);

  const discardAutoSave = useCallback(async () => {
    if (!projectId) return;
    await autosaveService.clearForProject(projectId);
    setShowAutoSaveModal(false);
    setAutoSaveData(null);
  }, [projectId]);

  const recoverAutoSave = useCallback(async () => {
    if (!autoSaveData) return;

    try {
      const data = JSON.parse(autoSaveData.snapshot) as TProjectData;
      await applyRecoveredProject(data);
      showToast(
        language === 'zh'
          ? '已恢复进度，请记得手动保存'
          : language === 'ja'
            ? '進捗を復元しました。手動で保存することを忘れないでください。'
            : 'Progress recovered, please remember to save',
      );
    } catch (error) {
      console.error('Failed to restore autosave', error);
    }

    setShowAutoSaveModal(false);
  }, [applyRecoveredProject, autoSaveData, language, showToast]);

  return {
    autoSaveData,
    showAutoSaveModal,
    setShowAutoSaveModal,
    discardAutoSave,
    recoverAutoSave,
    clearAutoSave: projectId ? () => autosaveService.clearForProject(projectId) : autosaveService.clear,
  };
};
