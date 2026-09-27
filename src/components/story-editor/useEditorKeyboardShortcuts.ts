import { useEffect } from 'react';
import type { ShortcutMap } from '../../lib/keyboardMouseSettings';

type UseEditorKeyboardShortcutsOptions = {
  deleteSelected: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  redo: () => void;
  showToast: (message: string, tone?: 'success' | 'error') => void;
  textCopiedMessage: string;
  undo: () => void;
  shortcuts: ShortcutMap;
  duplicate: () => void;
  selectAll: () => void;
  save: () => void;
};

export function useEditorKeyboardShortcuts({
  deleteSelected,
  handleCopy,
  handlePaste,
  redo,
  showToast,
  textCopiedMessage,
  undo,
  shortcuts,
  duplicate,
  selectAll,
  save,
}: UseEditorKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      const pressed = [event.ctrlKey || event.metaKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', key].filter(Boolean).join('+');
      const matches = (action: keyof ShortcutMap) => {
        const configured = (shortcuts[action] || '').replace(/Command|Cmd|⌘/gi, 'Ctrl').replace(/\s/g, '');
        return configured.toLowerCase() === pressed.toLowerCase();
      };
      const activeElement = document.activeElement;
      const activeTag = activeElement?.tagName.toLowerCase();
      const hasInputSelection =
        (activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement) &&
        activeElement.selectionStart !== null &&
        activeElement.selectionEnd !== null &&
        activeElement.selectionStart !== activeElement.selectionEnd;
      const hasDocumentSelection = Boolean(window.getSelection()?.toString());

      if (matches('copy') && (hasInputSelection || hasDocumentSelection)) {
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

      const action = (['copy', 'paste', 'cut', 'undo', 'redo', 'delete', 'selectAll', 'duplicate', 'save'] as const).find(matches);
      if (!action) return;
      event.preventDefault();
      if (action === 'copy') handleCopy();
      else if (action === 'paste') handlePaste();
      else if (action === 'cut') { handleCopy(); deleteSelected(); }
      else if (action === 'undo') undo();
      else if (action === 'redo') redo();
      else if (action === 'delete') deleteSelected();
      else if (action === 'selectAll') selectAll();
      else if (action === 'duplicate') duplicate();
      else if (action === 'save') save();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, duplicate, handleCopy, handlePaste, redo, save, selectAll, shortcuts, showToast, textCopiedMessage, undo]);
}
