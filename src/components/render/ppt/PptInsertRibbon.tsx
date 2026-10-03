import { ClipboardPaste, Copy, CopyPlus, ImagePlus, PlusSquare, Type, Webhook } from 'lucide-react';
import { type ReactNode, useRef } from 'react';

import type { PptCopy } from './i18n';
import type { Language } from '../../../lib/i18n';
import type { WebMenuElement } from '../video/shared/types';
import { WebShapeIcon } from '../web/WebShapeAddControl';
import { webInsertToolClass, webInsertToolStateClass } from '../web/WebInsertToolButton';
import { webShapeCatalog } from '../web/webShapes';

function InsertGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="relative min-w-max border-r border-[var(--vr-border)] px-4 pb-6 pt-2 last:border-r-0">
      <div className="absolute inset-x-0 bottom-1 text-center text-[10px] font-medium text-[var(--vr-text-muted)]">
        {label}
      </div>
      <div className="grid grid-flow-col grid-rows-2 gap-x-3 gap-y-1">{children}</div>
    </section>
  );
}

function InsertAction({
  label,
  icon: Icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: typeof PlusSquare;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`${webInsertToolClass} ${webInsertToolStateClass()}`}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  );
}

export function PptInsertRibbon({
  copy,
  language,
  onInsertShape,
  selectedShape,
  onNewSlide,
  onDuplicateSlide,
  onInsertText,
  onInsertButton,
  onInsertImage,
  onCopyElement,
  onPasteElement,
  canCopyElement,
  canPasteElement,
  exportRules,
}: {
  copy: PptCopy;
  language: Language;
  onInsertShape: (type: NonNullable<WebMenuElement['shapeType']>) => void;
  selectedShape?: WebMenuElement['shapeType'];
  onNewSlide: () => void;
  onDuplicateSlide: () => void;
  onInsertText: () => void;
  onInsertButton: () => void;
  onInsertImage: (dataUrl: string, name: string) => void;
  onCopyElement: () => void;
  onPasteElement: () => void;
  canCopyElement: boolean;
  canPasteElement: boolean;
  exportRules?: ReactNode;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const readImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onInsertImage(reader.result, file.name);
    };
    reader.readAsDataURL(file);
  };
  return (
    <header className="ppt-ribbon-shell" style={{ height: 112, flexBasis: 112 }}>
      <div className="ppt-ribbon">
        <InsertGroup label={copy.slides}>
          <InsertAction label={copy.newSlide} icon={PlusSquare} onClick={onNewSlide} />
          <InsertAction label={copy.duplicateSlide} icon={CopyPlus} onClick={onDuplicateSlide} />
        </InsertGroup>
        <InsertGroup label={copy.image}>
          <input
            ref={imageInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(event) => {
              readImage(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <InsertAction
            label={copy.insertImage}
            icon={ImagePlus}
            onClick={() => imageInputRef.current?.click()}
          />
        </InsertGroup>
        <InsertGroup label={copy.text}>
          <InsertAction
            label={copy.copyElement}
            icon={Copy}
            onClick={onCopyElement}
            disabled={!canCopyElement}
          />
          <InsertAction
            label={copy.pasteElement}
            icon={ClipboardPaste}
            onClick={onPasteElement}
            disabled={!canPasteElement}
          />
          <InsertAction label={copy.insertTitle} icon={Type} onClick={onInsertText} />
        </InsertGroup>
        <InsertGroup label={copy.button}>
          <InsertAction label={copy.insertButton} icon={Webhook} onClick={onInsertButton} />
        </InsertGroup>
        <InsertGroup label={language === 'zh' ? '图形' : language === 'ja' ? '図形' : 'Shapes'}>
          <>
            {webShapeCatalog(language).map(({ type, label }) => (
              <button
                key={type}
                type="button"
                aria-label={label}
                title={label}
                aria-pressed={selectedShape === type}
                className={`${webInsertToolClass} ${webInsertToolStateClass(selectedShape === type)}`}
                onClick={() => onInsertShape(type)}
              >
                <WebShapeIcon type={type} />
              </button>
            ))}
          </>
        </InsertGroup>
      </div>
      {exportRules}
    </header>
  );
}
