import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Language } from '../../../lib/i18n';
import type { WebExportSettings, WebMenuElement } from '../video/shared/types';
import { InspectorGroup } from '../shared/inspectors/InspectorControls';
import { buildSettingsPageElements, resolveSettingsPageElements } from './webMenuPageElements';

export function PlayerSettingsControlsInspector({
  settings,
  language,
  selectedId,
  onSelect,
  onUpdateElements,
}: {
  settings: WebExportSettings;
  language: Language;
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onUpdateElements: (elements: WebMenuElement[]) => void;
}) {
  const t = (zh: string, en: string, ja: string) =>
    language === 'en' ? en : language === 'ja' ? ja : zh;
  const elements = resolveSettingsPageElements(settings, language, '#0ea5e9', '#ffffff');
  const library = buildSettingsPageElements(language, '#0ea5e9', '#ffffff');
  const update = (next: WebMenuElement[]) => {
    onUpdateElements(next);
    if (!next.some((item) => item.id === selectedId)) onSelect(null);
  };
  const add = (source: WebMenuElement, restore = false) => {
    const item = {
      ...source,
      id: restore ? source.id : `${source.id}-${crypto.randomUUID()}`,
      visible: true,
    };
    // Duplicate functions are allowed; offset a new copy so its selection frame remains reachable.
    if (!restore && elements.some((element) => element.role === source.role)) {
      item.x = Math.min(90 - item.width, item.x + 3);
      item.y = Math.min(95 - item.height, item.y + 3);
    }
    onUpdateElements([...elements, item]);
    onSelect(item.id);
  };
  return (
    <div className="property-inspector">
      <InspectorGroup
        title={t('设置页元素', 'Settings page elements', '設定ページの要素')}
        icon={<SlidersHorizontal className="h-4 w-4" />}
        tone="extra"
        secondary={<span className="text-xs text-[var(--inspector-muted)]">{elements.length}</span>}
      >
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-[var(--inspector-muted)]">
            {t(
              '每一项都是独立的页面元素。点击画布中的元素即可拖动、缩放和编辑；切换到测试模式操作其功能。',
              'Each item is a page element. Select it on the canvas to move, resize and style it. Use test mode to operate controls.',
              '各項目は独立した要素です。選択して移動・サイズ・外観を編集できます。動作はテストモードで操作します。',
            )}
          </p>
          <div className="space-y-1">
            {elements.map((element) => (
              <div
                key={element.id}
                className={`flex items-center gap-1 rounded-md border p-1 ${element.id === selectedId ? 'border-violet-400 bg-violet-50' : 'border-[var(--inspector-line)]'}`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(element.id)}
                  className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-xs text-[var(--inspector-text)]"
                >
                  {element.text || element.role || element.kind}
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={element.visible !== false}
                  aria-label={t('显示 ', 'Show ', '表示 ') + element.text}
                  onClick={() =>
                    update(
                      elements.map((item) =>
                        item.id === element.id
                          ? { ...item, visible: item.visible === false }
                          : item,
                      ),
                    )
                  }
                  className="rounded px-2 py-1.5 text-xs text-[var(--inspector-muted)]"
                >
                  {element.visible === false
                    ? t('隐藏', 'Hidden', '非表示')
                    : t('显示', 'Shown', '表示')}
                </button>
                <button
                  type="button"
                  aria-label={t('删除 ', 'Delete ', '削除 ') + element.text}
                  onClick={() => update(elements.filter((item) => item.id !== element.id))}
                  className="rounded p-1.5 text-[var(--inspector-muted)] hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <details open className="border-t border-[var(--inspector-line)] pt-2">
            <summary className="cursor-pointer py-1 text-xs font-semibold">
              {t('添加按钮与功能', 'Add buttons & functions', 'ボタンと機能を追加')}
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {library.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => add(item)}
                  className="flex items-center gap-1 rounded-md border border-dashed border-[var(--inspector-line)] px-2 py-2 text-left text-xs text-[var(--inspector-text)] hover:bg-violet-50"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  {item.text}
                </button>
              ))}
            </div>
          </details>
          {!!settings.settingsPageRemovedElements?.length && (
            <details className="border-t border-[var(--inspector-line)] pt-2">
              <summary className="cursor-pointer py-1 text-xs font-semibold">
                {t('恢复已删除元素', 'Restore removed elements', '削除した要素を復元')}
              </summary>
              <div className="space-y-1">
                {settings.settingsPageRemovedElements.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => add(item, true)}
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-violet-50"
                  >
                    <Plus className="h-3 w-3" />
                    {item.text || item.kind}
                  </button>
                ))}
              </div>
            </details>
          )}
          {elements.length > 0 && (
            <button
              type="button"
              className="text-xs text-[var(--inspector-muted)]"
              onClick={() => update([])}
            >
              {t(
                '清空页面，按需添加',
                'Clear page and add what you need',
                'すべて削除して必要な要素を追加',
              )}
            </button>
          )}
        </div>
      </InspectorGroup>
    </div>
  );
}
