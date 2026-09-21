import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

type WebInlineTextProps = {
  value: string;
  displayValue?: string;
  placeholder?: string;
  editable: boolean;
  editing: boolean;
  className?: string;
  style?: CSSProperties;
  onStart: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
};

// The editing DOM is owned exclusively by the browser. React never reconciles
// children inside it; finishing replaces it with a fresh, read-only text node.
function TextSession({ value, className, style, onCommit, onCancel }: WebInlineTextProps) {
  const editorRef = useRef<HTMLSpanElement>(null);
  const initialValue = useRef(value);
  const finished = useRef(false);
  const composing = useRef(false);
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.textContent = initialValue.current;
    editor.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const finish = (cancel = false) => {
    if (finished.current) return;
    finished.current = true;
    const editor = editorRef.current;
    const text = (editor?.innerText ?? '').replace(/\r\n?/g, '\n');
    const selection = window.getSelection();
    if (editor?.contains(selection?.anchorNode ?? null)) selection?.removeAllRanges();
    if (cancel) onCancel();
    else onCommit(text);
  };

  return (
    <span
      ref={editorRef}
      role="textbox"
      aria-multiline="true"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      className={className}
      style={{
        ...style,
        position: 'relative',
        display: 'inline-block',
        maxWidth: '100%',
        pointerEvents: 'auto',
        cursor: 'text',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        whiteSpace: 'pre-wrap',
        minWidth: '1ch',
        minHeight: '1em',
        outline: 'none',
        caretColor: style?.color === 'transparent' ? '#4f46e5' : 'currentColor',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        // A settings caption can live inside a native <label>. Do not let its
        // click transfer focus from the text editor to the associated slider.
        event.preventDefault();
        event.stopPropagation();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
          event.preventDefault();
          finish(event.key === 'Escape');
        }
      }}
      onKeyUp={(event) => event.stopPropagation()}
      onBlur={() => finish()}
    />
  );
}

export function WebInlineText(props: WebInlineTextProps) {
  if (props.editable && props.editing) return <TextSession {...props} />;
  return (
    <span
      className={props.className}
      style={{
        ...props.style,
        position: 'relative',
        display: 'inline-block',
        maxWidth: '100%',
        whiteSpace: 'pre-wrap',
        ...(props.editable
          ? { pointerEvents: 'auto', cursor: 'text', minWidth: '1ch', minHeight: '1em' }
          : {}),
      }}
      onPointerDown={(event) => {
        if (props.editable) event.stopPropagation();
      }}
      onClick={(event) => {
        if (props.editable) event.preventDefault();
      }}
      onDoubleClick={(event) => {
        if (!props.editable) return;
        event.stopPropagation();
        props.onStart();
      }}
    >
      {(props.displayValue ?? props.value) || (props.editable ? props.placeholder : '')}
    </span>
  );
}
