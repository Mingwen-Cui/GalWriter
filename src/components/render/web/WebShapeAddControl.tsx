import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Language } from '../../../lib/i18n';
import type { WebMenuElement } from '../video/shared/types';
import { webShapeCatalog, webShapeMarkup } from './webShapes';
import { webInsertToolClass, webInsertToolStateClass } from './WebInsertToolButton';

type ShapeType = NonNullable<WebMenuElement['shapeType']>;

export function WebShapeIcon({ type }: { type: ShapeType }) {
  return (
    <span
      className="block h-[18px] w-[18px]"
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
            borderRadius: type === 'rounded' ? 4 : 0,
          },
          18,
          18,
        ),
      }}
    />
  );
}

export function WebShapeAddControl({
  language,
  onAdd,
  onChoose = onAdd,
  active = false,
}: {
  language: Language;
  onAdd: (type: ShapeType) => void;
  onChoose?: (type: ShapeType) => void;
  active?: boolean;
}) {
  const [type, setType] = useState<ShapeType>('rectangle');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const shapes = webShapeCatalog(language);
  const current = shapes.find((shape) => shape.type === type)!;
  const addLabel = language === 'zh' ? '图形' : language === 'ja' ? '図形' : 'Shape';
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
      className={`relative z-[1200] flex h-9 items-stretch rounded-lg ${webInsertToolStateClass(active || open)}`}
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
        aria-label={`${addLabel}：${current.label}`}
        title={`${addLabel}：${current.label}`}
        aria-pressed={active}
        onClick={() => {
          setOpen(false);
          onAdd(type);
        }}
        className={webInsertToolClass}
      >
        <WebShapeIcon type={type} />
      </button>
      <button
        type="button"
        aria-label={chooseLabel}
        title={chooseLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="my-1 grid w-5 place-items-center rounded-r-lg focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        <ChevronDown className="h-3.5 w-3.5" />
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
                onChoose(shape.type);
                trigger.current?.focus();
              }}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600 ${type === shape.type ? 'bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-300' : 'text-[var(--vr-text-soft)] hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]'}`}
            >
              <WebShapeIcon type={shape.type} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
