import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type MentionKind = 'character' | 'scene' | 'video';
export type MentionPlacement = 'start' | 'end' | 'inline';

export type RichTextHandle = {
  insertText: (text: string) => void;
  insertMention: (kind: MentionKind, name: string) => void;
  focus: () => void;
  getElement: () => HTMLDivElement | null;
};

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const createMentionHtml = (kind: MentionKind, name: string) => {
  const safeName = escapeHtml(name);
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `mention-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `<span class="mention-chip mention-chip-${kind}" data-mention-kind="${kind}" data-mention-name="${safeName}" data-mention-id="${id}" contenteditable="false" draggable="false">@${safeName}</span>&nbsp;`;
};

const hasMeaningfulText = (text: string) => /[\p{L}\p{N}]/u.test(text);

const rangeHasMeaningfulTextOutsideMentions = (range: Range) => {
  const fragment = range.cloneContents();
  const container = document.createElement('div');
  container.appendChild(fragment);
  container.querySelectorAll('.mention-chip').forEach((node) => node.remove());
  return hasMeaningfulText(container.textContent || '');
};

const mentionPlacement = (mention: HTMLElement): MentionPlacement => {
  const root = mention.closest('[contenteditable="true"]');
  if (!root) return 'inline';
  const rangeBefore = document.createRange();
  rangeBefore.setStart(root, 0);
  rangeBefore.setEndBefore(mention);
  const rangeAfter = document.createRange();
  rangeAfter.setStartAfter(mention);
  rangeAfter.setEnd(root, root.childNodes.length);
  const hasBefore = rangeHasMeaningfulTextOutsideMentions(rangeBefore);
  const hasAfter = rangeHasMeaningfulTextOutsideMentions(rangeAfter);
  if (!hasBefore) return 'start';
  if (!hasAfter) return 'end';
  return 'inline';
};

const ensureMentionId = (mention: HTMLElement) => {
  const current = mention.dataset.mentionId;
  if (current) return { id: current, changed: false };
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `mention-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  mention.dataset.mentionId = id;
  return { id, changed: true };
};

const getMentionNearSelection = (direction: 'backward' | 'forward') => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const container = range.startContainer;
  const offset = range.startOffset;

  if (container.nodeType === Node.TEXT_NODE) {
    const text = container.nodeValue || '';
    if (direction === 'backward' && offset > 0 && text.slice(0, offset).trim() !== '') return null;
    if (direction === 'forward' && offset < text.length && text.slice(offset).trim() !== '')
      return null;

    const sibling = direction === 'backward' ? container.previousSibling : container.nextSibling;
    return sibling instanceof HTMLElement && sibling.classList.contains('mention-chip')
      ? sibling
      : null;
  }

  if (!(container instanceof HTMLElement)) return null;
  const childIndex = direction === 'backward' ? offset - 1 : offset;
  const child = container.childNodes[childIndex];
  return child instanceof HTMLElement && child.classList.contains('mention-chip') ? child : null;
};

export const RichText = forwardRef<
  RichTextHandle,
  {
    value: string;
    onChange: (val: string) => void;
    className?: string;
    style?: React.CSSProperties;
    pasteAsPlainText?: boolean;
    autoFocus?: boolean;
    onMentionContextMenu?: (
      event: React.MouseEvent<HTMLSpanElement>,
      mention: { kind: MentionKind; name: string; id: string; placement: MentionPlacement },
    ) => void;
  }
>(function RichText(
  {
    value,
    onChange,
    className,
    style,
    pasteAsPlainText = false,
    autoFocus = false,
    onMentionContextMenu,
  },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      // 使用 setTimeout 确保在 DOM 完全就绪以及 React Flow 处理完新增节点逻辑后触发
      const timer = setTimeout(() => {
        if (!editorRef.current) return;
        editorRef.current.focus();

        // 选中所有文本
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const deleteMention = (mention: HTMLElement) => {
    const parent = mention.parentNode;
    const range = document.createRange();
    range.setStartBefore(mention);
    mention.remove();

    if (parent) {
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    handleInput();
  };

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      if (!editorRef.current) return;
      editorRef.current.focus();
      document.execCommand('insertText', false, text);
      handleInput();
    },
    insertMention(kind: MentionKind, name: string) {
      if (!editorRef.current) return;
      editorRef.current.focus();
      document.execCommand('insertHTML', false, createMentionHtml(kind, name));
      handleInput();
    },
    focus() {
      editorRef.current?.focus();
    },
    getElement() {
      return editorRef.current;
    },
  }));

  const insertImage = (src: string) => {
    // 使用 HTML 插入图片，并设置一些基础样式确保美观
    const img = `<img src="${src}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 4px 0; display: block;" />`;
    // NOTE: execCommand 虽然已废弃，但在 contentEditable 中仍然是最简单的插入 HTML 的方式
    document.execCommand('insertHTML', false, img);
    handleInput();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const url = URL.createObjectURL(blob);
          insertImage(url);
          e.preventDefault();
          return;
        }
      }
    }

    if (pasteAsPlainText) {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    // 支持从外部拖拽图片文件
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      e.preventDefault();
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          const url = URL.createObjectURL(files[i]);
          insertImage(url);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    const mention = getMentionNearSelection(e.key === 'Backspace' ? 'backward' : 'forward');
    if (!mention) return;
    e.preventDefault();
    deleteMention(mention);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLSpanElement) || !target.classList.contains('mention-chip')) return;
    const kind = target.dataset.mentionKind;
    const name = target.dataset.mentionName;
    if (
      (kind !== 'character' && kind !== 'scene' && kind !== 'video') ||
      !name ||
      !onMentionContextMenu
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const { id, changed } = ensureMentionId(target);
    if (changed) handleInput();
    onMentionContextMenu(event as unknown as React.MouseEvent<HTMLSpanElement>, {
      kind,
      name,
      id,
      placement: mentionPlacement(target),
    });
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLSpanElement) || !target.classList.contains('mention-chip')) return;
    const kind = target.dataset.mentionKind;
    const name = target.dataset.mentionName;
    if (
      (kind !== 'character' && kind !== 'scene' && kind !== 'video') ||
      !name ||
      !onMentionContextMenu
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();
    const { id, changed } = ensureMentionId(target);
    if (changed) handleInput();
    onMentionContextMenu(event as unknown as React.MouseEvent<HTMLSpanElement>, {
      kind,
      name,
      id,
      placement: mentionPlacement(target),
    });
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLSpanElement) || !target.classList.contains('mention-chip')) return;
    event.preventDefault();
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();
  };

  const preventMentionSelection = (
    event:
      | React.MouseEvent<HTMLDivElement>
      | React.DragEvent<HTMLDivElement>
      | React.SyntheticEvent<HTMLDivElement>,
  ) => {
    const target = event.target;
    if (!(target instanceof HTMLSpanElement) || !target.classList.contains('mention-chip')) return;
    event.preventDefault();
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      onDoubleClick={preventMentionSelection}
      onDragStart={preventMentionSelection}
      onSelect={preventMentionSelection}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDragOver={(e) => e.preventDefault()}
      // "nodrag" and "nowheel" prevents react-flow from hijacking selection/scroll
      className={`nodrag nopan outline-none ${className}`}
      // Prevent focus from expanding awkwardly if empty
      style={{ minHeight: '1.5em', whiteSpace: 'pre-wrap', ...style }}
    />
  );
});
