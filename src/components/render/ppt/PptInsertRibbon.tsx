import { CopyPlus, ImagePlus, PlusSquare, Type, Webhook } from 'lucide-react';
import { useRef } from 'react';

import type { PptCopy } from './i18n';

function InsertGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="relative flex min-w-max items-center gap-1 border-r border-[var(--vr-border)] px-3 pb-5 pt-2 last:border-r-0">
      <div className="absolute inset-x-0 bottom-1 text-center text-[10px] font-medium text-[var(--vr-text-muted)]">
        {label}
      </div>
      {children}
    </section>
  );
}

function InsertAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof PlusSquare;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="ppt-ribbon-action min-w-[66px]">
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );
}

export function PptInsertRibbon({
  copy,
  onNewSlide,
  onDuplicateSlide,
  onInsertText,
  onInsertButton,
  onInsertImage,
}: {
  copy: PptCopy;
  onNewSlide: () => void;
  onDuplicateSlide: () => void;
  onInsertText: () => void;
  onInsertButton: () => void;
  onInsertImage: (dataUrl: string, name: string) => void;
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
    <div className="flex min-h-[94px] items-stretch overflow-x-auto px-3">
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
        <InsertAction label={copy.insertImage} icon={ImagePlus} onClick={() => imageInputRef.current?.click()} />
      </InsertGroup>
      <InsertGroup label={copy.text}>
        <InsertAction label={copy.insertTitle} icon={Type} onClick={onInsertText} />
      </InsertGroup>
      <InsertGroup label={copy.button}>
        <InsertAction label={copy.insertButton} icon={Webhook} onClick={onInsertButton} />
      </InsertGroup>
    </div>
  );
}
