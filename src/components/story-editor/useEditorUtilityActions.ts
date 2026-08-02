import { useCallback, useState } from 'react';

import { DEFAULT_PROJECT_FILE_NAME } from './constants';
import type { StoryEditorCopy } from './i18n';
import { getProjectDisplayName } from './projectNames';

type UseEditorUtilityActionsOptions = {
  assistantMemoryNotes: string[];
  assistantMemorySkillEnabled: boolean;
  projectTitle: string;
  saveFileName: string;
  showToast: (message: string, tone?: 'success' | 'error') => void;
  storyEditorCopy: StoryEditorCopy;
};

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Modern copy failed', error);
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (error) {
    console.error('Fallback copy failed', error);
    return false;
  }
}

export function useEditorUtilityActions({
  assistantMemoryNotes,
  assistantMemorySkillEnabled,
  projectTitle,
  saveFileName,
  showToast,
  storyEditorCopy,
}: UseEditorUtilityActionsOptions) {
  const [qqCopied, setQqCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const handleContactCopy = useCallback(
    async (text: string, type: 'qq' | 'email') => {
      if (!(await copyText(text))) return;
      showToast(storyEditorCopy.copySuccess);
      if (type === 'qq') {
        setQqCopied(true);
        setTimeout(() => setQqCopied(false), 2000);
      } else {
        setEmailCopied(true);
        setTimeout(() => setEmailCopied(false), 2000);
      }
    },
    [showToast, storyEditorCopy.copySuccess],
  );

  const handleDownloadAssistantMemory = useCallback(() => {
    const payload = {
      kind: 'galwriter-assistant-memory',
      version: 1,
      exportedAt: new Date().toISOString(),
      projectTitle: getProjectDisplayName(projectTitle, saveFileName) || DEFAULT_PROJECT_FILE_NAME,
      enabled: assistantMemorySkillEnabled,
      notes: assistantMemoryNotes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = (payload.projectTitle || 'galwriter')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-');
    link.href = url;
    link.download = `${safeTitle}-assistant-memory.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(storyEditorCopy.assistantMemoryDownloaded);
  }, [
    assistantMemoryNotes,
    assistantMemorySkillEnabled,
    projectTitle,
    saveFileName,
    showToast,
    storyEditorCopy.assistantMemoryDownloaded,
  ]);

  return {
    emailCopied,
    handleContactCopy,
    handleDownloadAssistantMemory,
    qqCopied,
  };
}
