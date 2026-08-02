import { useEffect } from 'react';

type UseEditorKeyboardShortcutsOptions = {
  deleteSelected: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  redo: () => void;
  showToast: (message: string, tone?: 'success' | 'error') => void;
  textCopiedMessage: string;
  undo: () => void;
};

export function useEditorKeyboardShortcuts({
  deleteSelected,
  handleCopy,
  handlePaste,
  redo,
  showToast,
  textCopiedMessage,
  undo,
}: UseEditorKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();
      const activeElement = document.activeElement;
      const activeTag = activeElement?.tagName.toLowerCase();
      const hasInputSelection =
        (activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement) &&
        activeElement.selectionStart !== null &&
        activeElement.selectionEnd !== null &&
        activeElement.selectionStart !== activeElement.selectionEnd;
      const hasDocumentSelection = Boolean(window.getSelection()?.toString());

      if (modifier && key === 'c' && (hasInputSelection || hasDocumentSelection)) {
        showToast(textCopiedMessage);
        return;
      }
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (modifier && key === 'y') {
        event.preventDefault();
        redo();
      } else if (modifier && key === 'c') {
        handleCopy();
      } else if (modifier && key === 'v') {
        event.preventDefault();
        handlePaste();
      } else if (key === 'delete' || key === 'backspace') {
        if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          deleteSelected();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, handleCopy, handlePaste, redo, showToast, textCopiedMessage, undo]);
}
