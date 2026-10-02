import { useEffect, useRef, useState } from 'react';
import type { Language } from '../../../lib/i18n';
import type { WebMenuElement } from '../video/shared/types';
import { webShapeCatalog, webShapeMarkup } from './webShapes';

type ShapeType = NonNullable<WebMenuElement['shapeType']>;

function ShapeIcon({ type }: { type: ShapeType }) {
  return (
    <span
      className="block h-5 w-6"
      dangerouslySetInnerHTML={{
        __html: webShapeMarkup(
          {
            id: `shape-icon-${type}`,
            kind: 'shape',
            shapeType: type,
            role: 'custom',
            text: '',
            visible: true,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            scale: 1,
            rotation: 0,
            fillEnabled: false,
            borderColor: 'currentColor',
            borderWidth: 1.8,
            borderRadius: type === 'rounded' ? 5 : 0,
          },
          24,
          20,
        ),
      }}
    />
  );
}

export function WebShapeAddControl({
  language,
  onAdd,
}: {
  language: Language;
  onAdd: (type: ShapeType) => void;
}) {
  const [type, setType] = useState<ShapeType>('rounded');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const shapes = webShapeCatalog(language);
  const current = shapes.find((shape) => shape.type === type)!;
  const addLabel = language === 'zh' ? '添加图形' : language === 'ja' ? '図形を追加' : 'Add shape';
  const chooseLabel =
    language === 'zh' ? '切换图形' : language === 'ja' ? '図形を切り替え' : 'Choose shape';
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  return (
    <div
      ref={root}
      className="relative z-[1200] flex h-9 items-stretch rounded-xl border border-violet-200 bg-violet-50 text-violet-700"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`${chooseLabel}：${current.label}`}
        title={`${chooseLabel}：${current.label}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="grid w-10 place-items-center rounded-l-xl hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-600"
      >
        <ShapeIcon type={type} />
      </button>
      <button
        type="button"
        aria-label={`${addLabel}：${current.label}`}
        title={`${addLabel}：${current.label}`}
        onClick={() => {
          setOpen(false);
          onAdd(type);
        }}
        className="border-l border-violet-200 px-2.5 text-[11px] font-bold hover:bg-violet-100 rounded-r-xl focus-visible:outline-2 focus-visible:outline-violet-600"
      >
        {addLabel}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={chooseLabel}
          className="absolute right-0 top-full mt-2 flex w-max flex-nowrap items-center gap-2 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-2 shadow-xl"
        >
          {shapes.map((shape) => (
            <button
              key={shape.type}
              type="button"
              aria-label={shape.label}
              title={shape.label}
              aria-pressed={type === shape.type}
              onClick={() => {
                setType(shape.type);
                setOpen(false);
                trigger.current?.focus();
              }}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-violet-600 ${type === shape.type ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-300' : 'text-[var(--vr-text)] hover:bg-violet-100 hover:text-violet-700'}`}
            >
              <ShapeIcon type={shape.type} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
