import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { clearAutoSave, getAutoSave, saveAutoSave } from '../lib/db';

interface AutoSavePayload {
  snapshot: string;
  timestamp: number;
}

interface UseAutoSaveParams<TProjectData> {
  getProjectSnapshot: () => string;
  lastSavedSnapshotRef: MutableRefObject<string>;
  setIsDirty: Dispatch<SetStateAction<boolean>>;
  applyRecoveredProject: (projectData: TProjectData) => Promise<void>;
  showToast: (message: string) => void;
  language: 'zh' | 'en';
  enabled: boolean;
}

export const useAutoSave = <TProjectData>({
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
    if (!enabled) return;
    getAutoSave().then((data) => {
      if (!data) return;
      setAutoSaveData(data);
      setShowAutoSaveModal(true);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const currentSnapshot = getProjectSnapshot();
    const isNowDirty = currentSnapshot !== lastSavedSnapshotRef.current;
    setIsDirty(isNowDirty);

    if (isNowDirty) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        await saveAutoSave(currentSnapshot);
      }, 5000);
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [enabled, getProjectSnapshot, lastSavedSnapshotRef, setIsDirty]);

  const discardAutoSave = useCallback(async () => {
    await clearAutoSave();
    setShowAutoSaveModal(false);
    setAutoSaveData(null);
  }, []);

  const recoverAutoSave = useCallback(async () => {
    if (!autoSaveData) return;

    try {
      const data = JSON.parse(autoSaveData.snapshot) as TProjectData;
      await applyRecoveredProject(data);
      showToast(
        language === 'zh'
          ? '已恢复进度，请记得手动保存'
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
