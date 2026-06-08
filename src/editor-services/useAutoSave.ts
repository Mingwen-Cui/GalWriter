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
  const autoSaveRevisionRef = useRef(0);

  const cancelPendingAutoSave = useCallback(() => {
    autoSaveRevisionRef.current += 1;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !projectId) return;

    let cancelled = false;

    autosaveService.loadForProject(projectId).then((data) => {
      if (cancelled || !data) return;
      if (data.snapshot === lastSavedSnapshotRef.current) {
        void autosaveService.clearForProject(projectId);
        return;
      }
      setAutoSaveData(data);
      setShowAutoSaveModal(true);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, lastSavedSnapshotRef, projectId]);

  useEffect(() => {
    if (!enabled || !projectId) return;

    cancelPendingAutoSave();
    const currentSnapshot = getProjectSnapshot();
    const isNowDirty = currentSnapshot !== lastSavedSnapshotRef.current;
    setIsDirty(isNowDirty);

    if (isNowDirty) {
      const scheduledRevision = autoSaveRevisionRef.current;
      autoSaveTimerRef.current = setTimeout(async () => {
        if (scheduledRevision !== autoSaveRevisionRef.current) return;

        const latestSnapshot = getProjectSnapshot();
        if (latestSnapshot === lastSavedSnapshotRef.current) {
          await autosaveService.clearForProject(projectId);
          return;
        }

        await autosaveService.saveForProject(projectId, latestSnapshot);
      }, 5000);
    }

    return () => {
      cancelPendingAutoSave();
    };
  }, [
    cancelPendingAutoSave,
    enabled,
    getProjectSnapshot,
    lastSavedSnapshotRef,
    projectId,
    setIsDirty,
  ]);

  const clearAutoSave = useCallback(async () => {
    cancelPendingAutoSave();
    setShowAutoSaveModal(false);
    setAutoSaveData(null);

    if (projectId) {
      await autosaveService.clearForProject(projectId);
    } else {
      await autosaveService.clear();
    }
  }, [cancelPendingAutoSave, projectId]);

  const discardAutoSave = useCallback(async () => {
    await clearAutoSave();
  }, [clearAutoSave]);

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
    clearAutoSave,
  };
};
