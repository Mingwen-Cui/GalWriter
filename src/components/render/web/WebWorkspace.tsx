import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { ReactNode } from 'react';
import {
  FileText,
  FolderOpen,
  Gamepad2,
  Eye,
  EyeOff,
  ImagePlus,
  Info,
  LayoutTemplate,
  Lock,
  Hand,
  MousePointerClick,
  Palette,
  Play,
  Save,
  Settings,
  Sparkles,
  RotateCw,
  Type,
  Upload,
  Unlock,
  Video,
  Volume2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createElement, isValidElement, useEffect, useState } from 'react';
 
import type { Language } from '../../../lib/i18n';
import { DragSizeControl } from '../video/controls/RenderControls';
import { RenderStyleSettingsSection } from '../video/panels/render-style-settings-section';
import { renderCopy } from '../video/shared/renderCopy';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';
import { WebPlaytestPreview } from './WebPlaytestPreview';

type WebWorkspaceProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  language: Language;
  webRenderStyle: RenderStyle;
  webChoiceColor: string;
  webChoiceTextColor: string;
  webSettings: WebExportSettings;
  webProjectName: string;
  defaultWebProjectName: string;
  progress: string;
  error: string;
  progressValue: number;
  savedPath: string;
  outputDir: string;
  outputDirError: string;
  setWebProjectName: (value: string) => void;
  setOutputDir: (value: string) => void;
  setOutputDirError: (value: string) => void;
  chooseOutputDir: () => void;
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
  updateWebChoiceTextColor: (value: string) => void;
  updateWebChoiceColor: (value: string) => void;
  updateWebRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
};

export function WebWorkspace({
  nodes,
  edges,
  language,
  webRenderStyle,
  webChoiceColor,
  webChoiceTextColor,
  webSettings,
  webProjectName,
  defaultWebProjectName,
  progress,
  error,
  progressValue,
  savedPath,
  outputDir,
  outputDirError,
  setWebProjectName,
  setOutputDir,
  setOutputDirError,
  chooseOutputDir,
  updateWebSettings,
  updateWebChoiceTextColor,
  updateWebChoiceColor,
  updateWebRenderStyle,
}: WebWorkspaceProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const startMenuDesignStorageKey = 'galwriter-web-start-menu-design:v1';
  const createStartMenuDesignSnapshot = (stripEmbeddedMedia = false): Partial<WebExportSettings> => ({
    showStartMenu: webSettings.showStartMenu,
    startMenuTemplate: webSettings.startMenuTemplate,
    startMenuBackgroundType: webSettings.startMenuBackgroundType,
    startMenuBackgroundColor: webSettings.startMenuBackgroundColor,
    startMenuBackgroundGradientStart: webSettings.startMenuBackgroundGradientStart,
    startMenuBackgroundGradientEnd: webSettings.startMenuBackgroundGradientEnd,
    startMenuBackgroundGradientAngle: webSettings.startMenuBackgroundGradientAngle,
    startMenuBackgroundImageUrl:
      stripEmbeddedMedia && webSettings.startMenuBackgroundImageUrl.startsWith('data:')
        ? ''
        : webSettings.startMenuBackgroundImageUrl,
    startMenuBackgroundMusicUrl:
      stripEmbeddedMedia && webSettings.startMenuBackgroundMusicUrl.startsWith('data:')
        ? ''
        : webSettings.startMenuBackgroundMusicUrl,
    startMenuButtonPosition: webSettings.startMenuButtonPosition,
    startMenuButtonLayout: webSettings.startMenuButtonLayout,
    startMenuButtonSize: webSettings.startMenuButtonSize,
    startMenuElements: webSettings.startMenuElements.map((element) =>
      stripEmbeddedMedia && element.imageUrl?.startsWith('data:')
        ? { ...element, imageUrl: '' }
        : element,
    ),
    startMenuPlacementBoundsLocked: webSettings.startMenuPlacementBoundsLocked,
    startMenuPlacementMinX: webSettings.startMenuPlacementMinX,
    startMenuPlacementMinY: webSettings.startMenuPlacementMinY,
    startMenuPlacementMaxX: webSettings.startMenuPlacementMaxX,
    startMenuPlacementMaxY: webSettings.startMenuPlacementMaxY,
    startMenuShowSave: webSettings.startMenuShowSave,
    startMenuShowNewGame: webSettings.startMenuShowNewGame,
    startMenuShowSettings: webSettings.startMenuShowSettings,
  });
  const saveStartMenuDesign = () => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        startMenuDesignStorageKey,
        JSON.stringify(createStartMenuDesignSnapshot()),
      );
    } catch (error) {
      try {
        window.localStorage.setItem(
          startMenuDesignStorageKey,
          JSON.stringify(createStartMenuDesignSnapshot(true)),
        );
      } catch {
        console.warn('Could not save start menu design preset:', error);
      }
    }
  };
  const loadStartMenuDesign = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(startMenuDesignStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<WebExportSettings>;
      const entries: Partial<WebExportSettings> = {
        showStartMenu: parsed.showStartMenu,
        startMenuTemplate: parsed.startMenuTemplate,
        startMenuBackgroundType: parsed.startMenuBackgroundType,
        startMenuBackgroundColor: parsed.startMenuBackgroundColor,
        startMenuBackgroundGradientStart: parsed.startMenuBackgroundGradientStart,
        startMenuBackgroundGradientEnd: parsed.startMenuBackgroundGradientEnd,
        startMenuBackgroundGradientAngle: parsed.startMenuBackgroundGradientAngle,
        startMenuBackgroundImageUrl: parsed.startMenuBackgroundImageUrl,
        startMenuBackgroundMusicUrl: parsed.startMenuBackgroundMusicUrl,
        startMenuButtonPosition: parsed.startMenuButtonPosition,
        startMenuButtonLayout: parsed.startMenuButtonLayout,
        startMenuButtonSize: parsed.startMenuButtonSize,
        startMenuElements: parsed.startMenuElements,
        startMenuPlacementBoundsLocked: parsed.startMenuPlacementBoundsLocked,
        startMenuPlacementMinX: parsed.startMenuPlacementMinX,
        startMenuPlacementMinY: parsed.startMenuPlacementMinY,
        startMenuPlacementMaxX: parsed.startMenuPlacementMaxX,
        startMenuPlacementMaxY: parsed.startMenuPlacementMaxY,
        startMenuShowSave: parsed.startMenuShowSave,
        startMenuShowNewGame: parsed.startMenuShowNewGame,
        startMenuShowSettings: parsed.startMenuShowSettings,
      };
      Object.entries(entries).forEach(([key, value]) => {
        if (value !== undefined) {
          updateWebSettings(key as keyof WebExportSettings, value as never);
        }
      });
    } catch {
      // Ignore invalid local design presets.
    }
  };
  const [showSettingDescriptions, setShowSettingDescriptions] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('galwriter-web-export-setting-descriptions');
    return stored === null ? true : stored === 'true';
  });
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [startMenuPreviewMode, setStartMenuPreviewMode] = useState<'edit' | 'test'>('edit');
  const [selectedStartMenuElementId, setSelectedStartMenuElementId] = useState<string | null>(null);
  const selectedStartMenuElement =
    webSettings.startMenuElements?.find((element) => element.id === selectedStartMenuElementId) || null;
  const updateStartMenuElement = (id: string, patch: Partial<WebExportSettings['startMenuElements'][number]>) => {
    updateWebSettings(
      'startMenuElements',
      (webSettings.startMenuElements || []).map((element) =>
        element.id === id ? { ...element, ...patch } : element,
      ),
    );
  };
  const deleteStartMenuElement = (id: string) => {
    updateWebSettings(
      'startMenuElements',
      (webSettings.startMenuElements || []).filter((element) => element.id !== id),
    );
    setSelectedStartMenuElementId(null);
  };
  const addStartMenuText = () => {
    const id = `text-${Date.now()}`;
    updateWebSettings('startMenuElements', [
      ...(webSettings.startMenuElements || []),
      {
        id,
        kind: 'text',
        role: 'custom',
        text: '',
        visible: true,
        x: 36,
        y: 34,
        width: 28,
        height: 8,
        scale: 1,
        rotation: 0,
        fontSize: 18,
        textColor: '#ffffff',
        borderRadius: 0,
      },
    ]);
    setSelectedStartMenuElementId(id);
  };
  const addStartMenuImage = () => {
    const id = `image-${Date.now()}`;
    updateWebSettings('startMenuElements', [
      ...(webSettings.startMenuElements || []),
      {
        id,
        kind: 'image',
        role: 'custom',
        text: '',
        visible: true,
        x: 36,
        y: 34,
        width: 24,
        height: 18,
        scale: 1,
        rotation: 0,
        imageUrl: '',
        borderRadius: 12,
      },
    ]);
    setSelectedStartMenuElementId(id);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      'galwriter-web-export-setting-descriptions',
      String(showSettingDescriptions),
    );
  }, [showSettingDescriptions]);

  return (
    <main className="min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(300px,380px)] bg-[var(--vr-bg)]">
      <section className="min-h-0 min-w-0 bg-[var(--vr-surface-soft)] flex flex-col">
        <div className="grid h-12 grid-cols-[1fr_auto] items-center border-b border-[var(--vr-border)] px-4">
          <div className="flex min-w-0 items-center gap-2 text-xs font-black tracking-wide text-[var(--vr-text-soft)]">
            <Play className="w-4 h-4 text-[var(--vr-accent)]" />
            <span className="truncate">测试预览窗口</span>
          </div>
          <button
            type="button"
            onClick={() => setPreviewRefreshKey((key) => key + 1)}
            className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--vr-surface)] text-[var(--vr-text)] ring-1 ring-[var(--vr-border)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-accent)]"
            title={t('刷新项目预览', 'プロジェクトプレビューを更新', 'Refresh project preview')}
            aria-label={t('刷新项目预览', 'プロジェクトプレビューを更新', 'Refresh project preview')}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 p-4 xl:p-5">
          <WebPlaytestPreview
            key={previewRefreshKey}
            nodes={nodes}
            edges={edges}
            language={language}
            renderStyle={webRenderStyle}
            choiceColor={webChoiceColor}
            choiceTextColor={webChoiceTextColor}
            settings={webSettings}
            projectTitle={webProjectName}
            previewMode={startMenuPreviewMode}
            selectedStartMenuElementId={selectedStartMenuElementId}
            onSelectStartMenuElement={setSelectedStartMenuElementId}
            onDeleteStartMenuElement={deleteStartMenuElement}
            onUpdateSettings={updateWebSettings}
            onUpdateRenderStyle={updateWebRenderStyle}
          />
        </div>
      </section>

      <aside className="min-h-0 border-l border-[var(--vr-border)] bg-[var(--vr-surface)] backdrop-blur-xl flex flex-col">
        <div className="h-12 px-4 border-b border-[var(--vr-border)] flex items-center justify-between gap-3 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
          <div className="flex min-w-0 items-center gap-2">
            <Settings className="h-4 w-4 shrink-0 text-[var(--vr-accent)]" />
            <span className="truncate">导出设置</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSettingDescriptions((current) => !current)}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
              showSettingDescriptions
                ? 'bg-[var(--vr-surface)] text-[var(--vr-text)] ring-1 ring-[var(--vr-border)]'
                : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
            }`}
            title={
              showSettingDescriptions
                ? t('隐藏参数说明', '説明を非表示', 'Hide descriptions')
                : t('显示参数说明', '説明を表示', 'Show descriptions')
            }
            aria-label={
              showSettingDescriptions
                ? t('隐藏参数说明', '説明を非表示', 'Hide descriptions')
                : t('显示参数说明', '説明を表示', 'Show descriptions')
            }
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          <WebPanelTitle
            icon={FileText}
            title="网页导出设置"
          />
          <div className="space-y-2 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2">
            <input
              type="text"
              value={webProjectName}
              onChange={(event) => setWebProjectName(event.target.value)}
              placeholder={defaultWebProjectName || 'galwriter-web'}
              className="h-10 w-full rounded-lg border border-transparent bg-[var(--vr-surface)] px-3 text-sm font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]"
              aria-label="Project title"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={outputDir}
                onChange={(event) => {
                  setOutputDir(event.target.value);
                  setOutputDirError('');
                }}
                placeholder="Defaults to Downloads"
                className={`min-w-0 flex-1 rounded-lg border bg-[var(--vr-surface)] px-3 py-2 text-xs text-[var(--vr-text)] outline-none ${
                  outputDirError ? 'border-rose-400/70' : 'border-transparent'
                }`}
                aria-label="Export location"
              />
              <button
                type="button"
                onClick={chooseOutputDir}
                className="h-9 w-9 shrink-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                title="Choose export folder"
                aria-label="Choose export folder"
              >
                <FolderOpen className="mx-auto h-4 w-4" />
              </button>
            </div>
            {outputDirError && (
              <span className="block text-[11px] font-bold text-rose-500 dark:text-rose-400">
                {outputDirError}
              </span>
            )}
          </div>

          <WebPanelTitle
            icon={LayoutTemplate}
            title="启动界面设计"
            action={
              <div className="w-36">
                <WebPillToggleGroup
                  value={startMenuPreviewMode}
                  options={[
                    { value: 'edit', label: '编辑模式' },
                    { value: 'test', label: '测试模式' },
                  ]}
                  onChange={(value) => {
                    const nextMode = value as 'edit' | 'test';
                    setStartMenuPreviewMode(nextMode);
                    setPreviewRefreshKey((key) => key + 1);
                  }}
                />
              </div>
            }
          />
          {startMenuPreviewMode === 'edit' ? (
          <div className="space-y-3 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3">
            <WebSettingCard
              icon={Gamepad2}
              description={
                showSettingDescriptions
                  ? t('进入主界面', 'タイトル画面', 'Start screen')
                  : undefined
              }
            >
              <WebPillToggleGroup
                value={webSettings.showStartMenu ? 'on' : 'off'}
                options={[
                  { value: 'on', label: 'Menu', icon: <Gamepad2 className="h-3.5 w-3.5" /> },
                  { value: 'off', label: 'Direct', icon: <Play className="h-3.5 w-3.5" /> },
                ]}
                onChange={(value) => updateWebSettings('showStartMenu', value === 'on')}
              />
            </WebSettingCard>
            {webSettings.showStartMenu && (
              <>
            <div className="space-y-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-2">
              <div className="px-1 text-[10px] font-black text-[var(--vr-text-muted)]">
                {selectedStartMenuElement
                  ? t('正在修改选中元素', '選択要素を編集中', 'Editing selected element')
                  : t('点击背景后修改启动背景', '背景をクリックして編集', 'Editing start background')}
              </div>
              {selectedStartMenuElement ? (
                <StartMenuElementInspector
                  element={selectedStartMenuElement}
                  language={language}
                  onUpdate={(patch) => updateStartMenuElement(selectedStartMenuElement.id, patch)}
                />
              ) : (
                <StartMenuBackgroundInspector
                  settings={webSettings}
                  language={language}
                  updateWebSettings={updateWebSettings}
                />
              )}
              <div className="grid grid-cols-3 gap-2">
                <IconToolButton
                  icon={Type}
                  label={t('添加文字', 'テキスト追加', 'Add text')}
                  onClick={addStartMenuText}
                />
                <IconToolButton
                  icon={ImagePlus}
                  label={t('添加图片', '画像追加', 'Add image')}
                  onClick={addStartMenuImage}
                />
                <IconToolButton
                  icon={Volume2}
                  label={t('主界面背景音乐', 'タイトルBGM', 'Start menu music')}
                  onClick={() => updateWebSettings('startMenuBackgroundMusicUrl', webSettings.startMenuBackgroundMusicUrl || '')}
                />
              </div>
              <input
                type="text"
                value={webSettings.startMenuBackgroundMusicUrl}
                onChange={(event) => updateWebSettings('startMenuBackgroundMusicUrl', event.target.value)}
                placeholder={t('主界面背景音乐 URL', 'タイトルBGM URL', 'Start menu music URL')}
                className="h-9 w-full rounded-lg border border-transparent bg-[var(--vr-surface-soft)] px-3 text-xs font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]"
                aria-label={t('主界面背景音乐 URL', 'タイトルBGM URL', 'Start menu music URL')}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'cinematic', label: 'Cinematic' },
                { value: 'minimal', label: 'Minimal' },
                { value: 'glass', label: 'Glass' },
              ].map((template) => {
                const active = webSettings.startMenuTemplate === template.value;
                return (
                  <button
                    key={template.value}
                    type="button"
                    onClick={() =>
                      updateWebSettings(
                        'startMenuTemplate',
                        template.value as WebExportSettings['startMenuTemplate'],
                      )
                    }
                    className={`group grid gap-2 rounded-lg border p-2 text-left transition-colors ${
                      active
                        ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]'
                        : 'border-[var(--vr-border)] bg-[var(--vr-surface)] hover:border-[var(--vr-border-strong)]'
                    }`}
                    aria-pressed={active}
                  >
                    <StartMenuTemplatePreview
                      template={template.value as WebExportSettings['startMenuTemplate']}
                      active={active}
                    />
                    <span className="truncate text-[10px] font-black text-[var(--vr-text)]">
                      {template.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={saveStartMenuDesign}
                className="flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-2 text-[10px] font-black text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]"
                title={t('保存为默认启动界面设计', 'デフォルトデザインとして保存', 'Save as default start screen design')}
              >
                <Save className="h-3.5 w-3.5" />
                <span className="truncate">{t('保存设计', '保存', 'Save Design')}</span>
              </button>
              <button
                type="button"
                onClick={loadStartMenuDesign}
                className="flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-2 text-[10px] font-black text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]"
                title={t('套用已保存的启动界面设计', '保存済みデザインを適用', 'Apply saved start screen design')}
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="truncate">{t('套用设计', '適用', 'Apply Design')}</span>
              </button>
            </div>
            <div className="space-y-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-2">
              <div className="px-1 text-[10px] font-black text-[var(--vr-text-muted)]">
                {t('按钮组布局', 'ボタングループ', 'Button group')}
              </div>
            <div className="grid grid-cols-2 gap-2">
              <WebSettingCard
                description={
                  showSettingDescriptions
                    ? t('按钮位置', 'ボタン位置', 'Button position')
                    : undefined
                }
              >
                <WebSegmentedGroup
                  value={webSettings.startMenuButtonPosition}
                  options={[
                    { value: 'center', label: '中' },
                    { value: 'bottomLeft', label: '左' },
                    { value: 'bottomRight', label: '右' },
                  ]}
                  onChange={(value) =>
                    updateWebSettings(
                      'startMenuButtonPosition',
                      value as WebExportSettings['startMenuButtonPosition'],
                    )
                  }
                />
              </WebSettingCard>
              <WebSettingCard
                description={
                  showSettingDescriptions
                    ? t('按钮排列', 'ボタン配列', 'Button layout')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.startMenuButtonLayout}
                  options={[
                    { value: 'vertical', label: 'Stack' },
                    { value: 'horizontal', label: 'Row' },
                  ]}
                  onChange={(value) =>
                    updateWebSettings(
                      'startMenuButtonLayout',
                      value as WebExportSettings['startMenuButtonLayout'],
                    )
                  }
                />
              </WebSettingCard>
            </div>
            <WebSettingCard
              description={showSettingDescriptions ? t('按钮大小', 'ボタンサイズ', 'Button size') : undefined}
            >
              <WebSegmentedGroup
                value={webSettings.startMenuButtonSize}
                options={[
                  { value: 'compact', label: 'S' },
                  { value: 'normal', label: 'M' },
                  { value: 'large', label: 'L' },
                ]}
                onChange={(value) =>
                  updateWebSettings(
                    'startMenuButtonSize',
                    value as WebExportSettings['startMenuButtonSize'],
                  )
                }
              />
            </WebSettingCard>
            <div className="grid grid-cols-3 gap-2">
              <WebSettingCard
                description={showSettingDescriptions ? t('存档按钮', 'セーブ', 'Save') : undefined}
              >
                <WebPillToggleGroup
                  value={webSettings.startMenuShowSave ? 'show' : 'hide'}
                  options={[
                    { value: 'show', label: 'Show', icon: <Eye className="h-3.5 w-3.5" /> },
                    { value: 'hide', label: 'Hide', icon: <EyeOff className="h-3.5 w-3.5" /> },
                  ]}
                  onChange={(value) => updateWebSettings('startMenuShowSave', value === 'show')}
                />
              </WebSettingCard>
              <WebSettingCard
                description={
                  showSettingDescriptions ? t('新游戏按钮', '新規', 'New game') : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.startMenuShowNewGame ? 'show' : 'hide'}
                  options={[
                    { value: 'show', label: 'Show', icon: <Eye className="h-3.5 w-3.5" /> },
                    { value: 'hide', label: 'Hide', icon: <EyeOff className="h-3.5 w-3.5" /> },
                  ]}
                  onChange={(value) => updateWebSettings('startMenuShowNewGame', value === 'show')}
                />
              </WebSettingCard>
              <WebSettingCard
                description={showSettingDescriptions ? t('设置按钮', '設定', 'Settings') : undefined}
              >
                <WebPillToggleGroup
                  value={webSettings.startMenuShowSettings ? 'show' : 'hide'}
                  options={[
                    { value: 'show', label: 'Show', icon: <Eye className="h-3.5 w-3.5" /> },
                    { value: 'hide', label: 'Hide', icon: <EyeOff className="h-3.5 w-3.5" /> },
                  ]}
                  onChange={(value) => updateWebSettings('startMenuShowSettings', value === 'show')}
                />
              </WebSettingCard>
            </div>
            </div>
              </>
            )}
          </div>
          ) : null}

          <WebPanelTitle icon={LayoutTemplate} title="网页参数" />
          <div className="space-y-2 rounded-xl border border-[var(--vr-border)] bg-slate-200/60 p-2 dark:bg-slate-800/60">
            <div className="grid grid-cols-3 gap-2">
              <WebSettingCard
                icon={LayoutTemplate}
                description={
                  showSettingDescriptions
                    ? t('网页布局', 'Webレイアウト', 'Web layout')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.layoutMode}
                  options={[
                    { value: 'classic', label: 'Split', icon: <LayoutClassicGlyph /> },
                    { value: 'immersive', label: 'Immersive', icon: <LayoutImmersiveGlyph /> },
                  ]}
                  onChange={(value) =>
                    updateWebSettings('layoutMode', value as WebExportSettings['layoutMode'])
                  }
                />
              </WebSettingCard>
              <WebSettingCard
                description={
                  showSettingDescriptions
                    ? t('选项位置', '選択肢の位置', 'Choice position')
                    : undefined
                }
              >
                <WebSegmentedGroup
                  value={webSettings.choicesPosition}
                  options={[
                    { value: 'aboveText', label: '上' },
                    { value: 'center', label: '中' },
                    { value: 'belowText', label: '下' },
                  ]}
                  onChange={(value) =>
                    updateWebSettings('choicesPosition', value as WebExportSettings['choicesPosition'])
                  }
                />
              </WebSettingCard>
              <WebSettingCard
                icon={Sparkles}
                description={
                  showSettingDescriptions
                    ? t('背景虚化', '背景をぼかす', 'Blur background')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.blurBackground ? 'on' : 'off'}
                  options={[
                    { value: 'on', label: 'Blur', icon: <BlurGlyph /> },
                    { value: 'off', label: 'Clear', icon: <ClearGlyph /> },
                  ]}
                  onChange={(value) => updateWebSettings('blurBackground', value === 'on')}
                />
              </WebSettingCard>
              <WebSettingCard
                icon={<SingleChoicePopupGlyph />}
                description={
                  showSettingDescriptions
                    ? t('隐藏单选弹窗', '単一選択のポップアップを隠す', 'Hide single-choice popups')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.skipSingleChoicePopup ? 'hide' : 'show'}
                  options={[
                    { value: 'hide', label: 'Hide', icon: <EyeOff className="h-3.5 w-3.5" /> },
                    { value: 'show', label: 'Show', icon: <Eye className="h-3.5 w-3.5" /> },
                  ]}
                  onChange={(value) => updateWebSettings('skipSingleChoicePopup', value === 'hide')}
                />
              </WebSettingCard>
              <WebSettingCard
                icon={Gamepad2}
                description={
                  showSettingDescriptions
                    ? t('自动翻页', '自動で進む', 'Auto advance')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.autoAdvance ? 'on' : 'off'}
                  options={[
                    { value: 'on', label: 'Auto', icon: <RotateCw className="h-3.5 w-3.5" /> },
                    { value: 'off', label: 'Manual', icon: <Hand className="h-3.5 w-3.5" /> },
                  ]}
                  onChange={(value) => updateWebSettings('autoAdvance', value === 'on')}
                />
              </WebSettingCard>
              <WebSettingCard
                icon={Video}
                description={
                  showSettingDescriptions
                    ? t('自动播放视频', '動画を自動再生する', 'Autoplay videos')
                    : undefined
                }
              >
                <WebPillToggleGroup
                  value={webSettings.videoAutoPlay ? 'auto' : 'manual'}
                  options={[
                    { value: 'auto', label: 'Auto', icon: <RotateCw className="h-3.5 w-3.5" /> },
                    { value: 'manual', label: 'Manual', icon: <Hand className="h-3.5 w-3.5" /> },
                  ]}
                  onChange={(value) => updateWebSettings('videoAutoPlay', value === 'auto')}
                />
              </WebSettingCard>
            </div>
          </div>
          <WebPanelTitle icon={Palette} title="文字样式" />
          <RenderStyleSettingsSection
            language={language}
            renderStyle={webRenderStyle}
            updateRenderStyle={updateWebRenderStyle}
            showDescriptions={showSettingDescriptions}
          />

          {(progress || error) && (
            <div className="space-y-2">
              {!error && (
                <div className="h-2 rounded-full bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--vr-accent)] transition-all"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
              )}
              <p
                className={`text-xs font-bold ${
                  error ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--vr-text-muted)]'
                }`}
              >
                {error || progress}
              </p>
            </div>
          )}
          {savedPath && (
            <div className="rounded-lg border border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--vr-accent-strong)] break-all">
              Saved:
              {savedPath}
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}

const isReactNodeIcon = (icon: LucideIcon | ReactNode): icon is ReactNode => isValidElement(icon);

const createIconElement = (Icon: LucideIcon) => createElement(Icon, { className: 'h-3.5 w-3.5' });

function StartMenuTemplatePreview({
  template,
  active,
}: {
  template: WebExportSettings['startMenuTemplate'];
  active: boolean;
}) {
  const backgroundClass =
    template === 'minimal'
      ? 'bg-slate-950'
      : template === 'glass'
        ? 'bg-[linear-gradient(135deg,#0f172a,#164e63)]'
        : 'bg-[radial-gradient(circle_at_50%_18%,rgba(14,165,233,0.45),transparent_44%),linear-gradient(180deg,#111827,#030712)]';
  const panelClass =
    template === 'minimal'
      ? 'border-white/15 bg-transparent'
      : template === 'glass'
        ? 'border-white/25 bg-white/15 backdrop-blur-sm'
        : 'border-white/10 bg-black/15';

  return (
    <span
      className={`relative block h-20 overflow-hidden rounded-md border ${
        active ? 'border-[var(--vr-accent)]' : 'border-white/10'
      } ${backgroundClass}`}
    >
      <span className={`absolute left-1/2 top-3 h-2 w-16 -translate-x-1/2 rounded-full ${panelClass}`} />
      <span className="absolute left-1/2 top-8 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/80" />
      <span className="absolute bottom-3 left-1/2 grid w-20 -translate-x-1/2 gap-1">
        <span className={`h-2 rounded-full ${template === 'minimal' ? 'bg-white/60' : 'bg-sky-400/90'}`} />
        <span className="h-2 rounded-full bg-white/24" />
      </span>
    </span>
  );
}

function IconToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-9 place-items-center rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]"
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

type StartMenuElement = WebExportSettings['startMenuElements'][number];

function readImageFileAsDataUrl(file: File, onReady: (value: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') onReady(reader.result);
  };
  reader.readAsDataURL(file);
}

function StartMenuBackgroundInspector({
  settings,
  language,
  updateWebSettings,
}: {
  settings: WebExportSettings;
  language: Language;
  updateWebSettings: <K extends keyof WebExportSettings>(key: K, value: WebExportSettings[K]) => void;
}) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const backgroundPreview =
    settings.startMenuBackgroundType === 'image' && settings.startMenuBackgroundImageUrl
      ? `center / cover url("${settings.startMenuBackgroundImageUrl.replace(/"/g, '\\"')}")`
      : settings.startMenuBackgroundType === 'gradient'
        ? `linear-gradient(${settings.startMenuBackgroundGradientAngle}deg, ${settings.startMenuBackgroundGradientStart}, ${settings.startMenuBackgroundGradientEnd})`
        : settings.startMenuBackgroundColor;
  return (
    <div className="grid gap-2">
      <WebSettingCard description={t('背景类型', '背景タイプ', 'Background type')}>
        <WebSegmentedGroup
          value={settings.startMenuBackgroundType}
          options={[
            { value: 'solid', label: t('底色', '単色', 'Solid') },
            { value: 'gradient', label: t('渐变', 'グラデ', 'Gradient') },
            { value: 'image', label: t('图片', '画像', 'Image') },
          ]}
          onChange={(value) =>
            updateWebSettings('startMenuBackgroundType', value as WebExportSettings['startMenuBackgroundType'])
          }
        />
      </WebSettingCard>
      {settings.startMenuBackgroundType === 'solid' && (
        <ColorField
          label={t('底色', '単色', 'Solid')}
          value={settings.startMenuBackgroundColor}
          onChange={(value) => updateWebSettings('startMenuBackgroundColor', value)}
        />
      )}
      {settings.startMenuBackgroundType === 'gradient' && (
        <div className="grid gap-2 rounded-lg bg-[var(--vr-surface-soft)] p-2">
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label={t('起点', '開始', 'Start')}
              value={settings.startMenuBackgroundGradientStart}
              onChange={(value) => updateWebSettings('startMenuBackgroundGradientStart', value)}
            />
            <ColorField
              label={t('终点', '終了', 'End')}
              value={settings.startMenuBackgroundGradientEnd}
              onChange={(value) => updateWebSettings('startMenuBackgroundGradientEnd', value)}
            />
          </div>
          <RangeField
            label={t('角度', '角度', 'Angle')}
            value={settings.startMenuBackgroundGradientAngle}
            min={0}
            max={360}
            onChange={(value) => updateWebSettings('startMenuBackgroundGradientAngle', value)}
          />
        </div>
      )}
      {settings.startMenuBackgroundType === 'image' && (
        <input
          type="text"
          value={settings.startMenuBackgroundImageUrl}
          onChange={(event) => updateWebSettings('startMenuBackgroundImageUrl', event.target.value)}
          placeholder={t('背景图片 URL', '背景画像 URL', 'Background image URL')}
          className="h-9 w-full rounded-lg border border-transparent bg-[var(--vr-surface-soft)] px-3 text-xs font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]"
          aria-label={t('背景图片 URL', '背景画像 URL', 'Background image URL')}
        />
      )}
      <div className="h-8 rounded-lg border border-[var(--vr-border)]" style={{ background: backgroundPreview }} />
      <div className="grid gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="px-1 text-[10px] font-black text-[var(--vr-text-muted)]">
            {t('文字/图片范围', 'テキスト/画像範囲', 'Text/image bounds')}
          </span>
          <button
            type="button"
            onClick={() =>
              updateWebSettings('startMenuPlacementBoundsLocked', !settings.startMenuPlacementBoundsLocked)
            }
            className={`grid h-7 w-7 place-items-center rounded-lg border transition-colors ${
              settings.startMenuPlacementBoundsLocked
                ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] text-[var(--vr-accent)]'
                : 'border-[var(--vr-border)] bg-[var(--vr-surface)] text-[var(--vr-text-soft)] hover:text-[var(--vr-text)]'
            }`}
            title={t('锁定放置范围', '範囲をロック', 'Lock placement bounds')}
            aria-label={t('锁定放置范围', '範囲をロック', 'Lock placement bounds')}
          >
            {settings.startMenuPlacementBoundsLocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <div className="rounded-md bg-[var(--vr-surface)] px-2 py-1 text-[10px] font-bold text-[var(--vr-text-muted)]">
          {t('范围框在左侧预览中拖动和缩放。', '範囲枠は左のプレビューで調整します。', 'Adjust the bounds box in the preview.')}
        </div>
      </div>
    </div>
  );
}

function StartMenuElementInspector({
  element,
  language,
  onUpdate,
}: {
  element: StartMenuElement;
  language: Language;
  onUpdate: (patch: Partial<StartMenuElement>) => void;
}) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  return (
    <div className="grid gap-2">
      <div className="rounded-lg bg-[var(--vr-surface-soft)] px-3 py-2 text-[11px] font-bold text-[var(--vr-text-muted)]">
        {element.kind === 'button'
          ? t('这里会修改当前选中按钮自己的颜色和背景，不会改变其他按钮布局。', '選択ボタンだけを編集します。', 'Edits only the selected button; layout stays unchanged.')
          : element.kind === 'image'
            ? t('这里会修改当前选中图片。', '選択画像を編集します。', 'Edits the selected image.')
            : t('这里会修改当前选中文字。', '選択テキストを編集します。', 'Edits the selected text.')}
      </div>
      {element.kind !== 'image' && (
        <label className="grid gap-1">
          <span className="px-1 text-[10px] font-black text-[var(--vr-text-muted)]">
            {element.kind === 'button'
              ? t('按钮名称', 'ボタン名', 'Button name')
              : t('文字内容', 'テキスト', 'Text')}
          </span>
          <input
            type="text"
            value={element.text}
            onChange={(event) => onUpdate({ text: event.target.value })}
            placeholder={
              element.kind === 'button'
                ? t('输入按钮名称', 'ボタン名を入力', 'Enter button name')
                : t('输入文字', 'テキストを入力', 'Enter text')
            }
            className="h-9 w-full rounded-lg border border-transparent bg-[var(--vr-surface-soft)] px-3 text-xs font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]"
          />
        </label>
      )}
      {element.kind === 'image' ? (
        <div className="grid gap-2">
          <input
            type="text"
            value={element.imageUrl || ''}
            onChange={(event) => onUpdate({ imageUrl: event.target.value })}
            placeholder={t('图片 URL', '画像 URL', 'Image URL')}
            className="h-9 w-full rounded-lg border border-transparent bg-[var(--vr-surface-soft)] px-3 text-xs font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]"
            aria-label={t('图片 URL', '画像 URL', 'Image URL')}
          />
          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 text-[10px] font-black text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]">
            <ImagePlus className="h-3.5 w-3.5" />
            <span>{t('选择图片', '画像を選択', 'Choose image')}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) readImageFileAsDataUrl(file, (value) => onUpdate({ imageUrl: value }));
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      ) : (
        <ColorField
          label={t('文字颜色', '文字色', 'Text')}
          value={element.textColor || '#ffffff'}
          onChange={(value) => onUpdate({ textColor: value })}
        />
      )}
      <RangeField
        label={t('圆角', '角丸', 'Radius')}
        value={element.borderRadius ?? (element.kind === 'text' ? 0 : 12)}
        min={0}
        max={40}
        onChange={(value) => onUpdate({ borderRadius: value })}
      />
      {element.kind === 'button' && (
        <>
          <WebSettingCard description={t('按钮背景', 'ボタン背景', 'Button background')}>
            <WebPillToggleGroup
              value={element.backgroundType || 'solid'}
              options={[
                { value: 'solid', label: t('底色', '単色', 'Solid') },
                { value: 'gradient', label: t('渐变', 'グラデ', 'Gradient') },
                { value: 'image', label: t('图片', '画像', 'Image') },
              ]}
              onChange={(value) => onUpdate({ backgroundType: value as StartMenuElement['backgroundType'] })}
            />
          </WebSettingCard>
          {(element.backgroundType || 'solid') === 'solid' ? (
            <ColorField
              label={t('按钮底色', 'ボタン色', 'Button')}
              value={colorInputValue(element.backgroundColor || '#0ea5e9')}
              onChange={(value) => onUpdate({ backgroundColor: value, backgroundType: 'solid' })}
            />
          ) : (element.backgroundType || 'solid') === 'gradient' ? (
            <div className="grid gap-2 rounded-lg bg-[var(--vr-surface-soft)] p-2">
              <div className="grid grid-cols-2 gap-2">
                <ColorField
                  label={t('起点', '開始', 'Start')}
                  value={element.backgroundGradientStart || '#0ea5e9'}
                  onChange={(value) => onUpdate({ backgroundGradientStart: value, backgroundType: 'gradient' })}
                />
                <ColorField
                  label={t('终点', '終了', 'End')}
                  value={element.backgroundGradientEnd || '#0f172a'}
                  onChange={(value) => onUpdate({ backgroundGradientEnd: value, backgroundType: 'gradient' })}
                />
              </div>
              <RangeField
                label={t('角度', '角度', 'Angle')}
                value={element.backgroundGradientAngle ?? 135}
                min={0}
                max={360}
                onChange={(value) => onUpdate({ backgroundGradientAngle: value, backgroundType: 'gradient' })}
              />
            </div>
          ) : (
            <div className="grid gap-2 rounded-lg bg-[var(--vr-surface-soft)] p-2">
              <input
                type="text"
                value={element.backgroundImageUrl || ''}
                onChange={(event) => onUpdate({ backgroundImageUrl: event.target.value, backgroundType: 'image' })}
                placeholder={t('按钮背景图片 URL', 'ボタン背景画像 URL', 'Button background image URL')}
                className="h-9 w-full rounded-lg border border-transparent bg-[var(--vr-surface)] px-3 text-xs font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]"
                aria-label={t('按钮背景图片 URL', 'ボタン背景画像 URL', 'Button background image URL')}
              />
              <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-3 text-[10px] font-black text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]">
                <ImagePlus className="h-3.5 w-3.5" />
                <span>{t('选择背景图', '背景画像を選択', 'Choose background')}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) {
                      readImageFileAsDataUrl(file, (value) =>
                        onUpdate({ backgroundImageUrl: value, backgroundType: 'image' }),
                      );
                    }
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
          )}
          <ColorField
            label={t('边框颜色', '枠線色', 'Border')}
            value={colorInputValue(element.borderColor || '#ffffff')}
            onChange={(value) => onUpdate({ borderColor: value })}
          />
        </>
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2 rounded-lg bg-[var(--vr-surface-soft)] px-2 py-1 text-[10px] font-black text-[var(--vr-text-muted)]">
      <span className="truncate">{label}</span>
      <input
        type="color"
        value={colorInputValue(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded border-0 bg-transparent"
        aria-label={label}
      />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[72px_minmax(0,1fr)_36px] items-center gap-2 text-[10px] font-black text-[var(--vr-text-muted)]">
      <span className="truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-[var(--vr-accent)]"
      />
      <span className="text-right">{value}</span>
    </label>
  );
}

function colorInputValue(value: string, fallback = '#111827') {
  const trimmed = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  const rgba = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgba) return fallback;
  return `#${[rgba[1], rgba[2], rgba[3]]
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function SingleChoicePopupGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <rect x="4.5" y="5" width="15" height="11.5" rx="2.5" />
      <path d="M9 20l3-3.5 3 3.5" />
      <path d="M8.5 9h7" />
      <path d="M8.5 12.5h4" />
    </svg>
  );
}

function WebPanelTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[var(--vr-accent)]" />
        <span className="truncate">{title}</span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function WebSettingCard({
  icon: Icon,
  description,
  children,
}: {
  icon?: LucideIcon | ReactNode;
  description?: string;
  children: ReactNode;
}) {
  const hasIcon = Boolean(Icon);
  return (
    <div className="space-y-1">
      {description && <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>}
      <div
        className={`grid h-9 items-center rounded-lg bg-[var(--vr-surface-soft)] ${
          hasIcon ? 'grid-cols-[28px_minmax(0,1fr)]' : 'grid-cols-1'
        }`}
      >
        {Icon ? (
          <div className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
            {isReactNodeIcon(Icon)
              ? Icon
              : createIconElement(Icon as LucideIcon)}
          </div>
        ) : null}
        <div className={`min-w-0 ${hasIcon ? 'web-segment-leading-icon' : ''}`}>{children}</div>
      </div>
    </div>
  );
}

type SegmentedOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

function WebPillToggleGroup({
  value,
  options,
  onChange,
  columns = 'grid-cols-2',
}: {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className={`web-segment-control grid h-9 w-full overflow-hidden rounded-lg ${columns} min-w-0`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`web-segment-button flex h-9 min-w-0 items-center justify-center gap-1 border-0 px-2 text-[10px] font-black transition-colors ${
              active
                ? 'bg-[var(--vr-accent)] text-white'
                : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'
            }`}
            title={option.label}
            aria-pressed={active}
          >
            {option.icon}
            {option.icon ? null : <span className="truncate">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function WebSegmentedGroup({
  value,
  options,
  onChange,
  columns = 'grid-cols-3',
}: {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className={`web-segment-control grid h-9 w-full overflow-hidden rounded-lg ${columns} min-w-0`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`web-segment-button flex h-9 w-full min-w-0 items-center justify-center gap-1 border-0 px-1 text-[10px] font-black transition-colors ${
              active
                ? 'bg-[var(--vr-accent)] text-white'
                : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'
            }`}
            title={option.label}
            aria-pressed={active}
          >
            {option.icon}
            {option.icon ? null : <span className="truncate">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function LayoutClassicGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <rect x="4" y="3.5" width="16" height="8" rx="2.5" />
      <path d="M7 15h10" />
      <path d="M7 18h7" />
      <path d="M7 21h9" />
    </svg>
  );
}

function LayoutImmersiveGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <path d="M7 14.5h10" />
      <path d="M7 17.5h7" />
      <path d="M8.5 7.5h7" />
      <path d="M8.5 10.5h4" />
    </svg>
  );
}

function VideoPointerGlyph() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-current/35 bg-current/10">
      <Video className="h-2.5 w-2.5" />
      <MousePointerClick className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5" />
    </span>
  );
}

function ChoicePositionGlyph({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-current/35 bg-current/10">
      {children}
    </span>
  );
}

function ChoiceTopGlyph() {
  return (
    <ChoicePositionGlyph>
      <span className="flex h-2.5 w-2.5 flex-col items-center justify-between">
        <span className="h-0.5 w-2 rounded-full bg-current" />
        <span className="h-0.5 w-1.5 rounded-full bg-current/55" />
      </span>
    </ChoicePositionGlyph>
  );
}

function ChoiceMiddleGlyph() {
  return (
    <ChoicePositionGlyph>
      <span className="flex h-2.5 w-2.5 flex-col items-center justify-between">
        <span className="h-0.5 w-1.5 rounded-full bg-current/55" />
        <span className="h-0.5 w-2 rounded-full bg-current" />
        <span className="h-0.5 w-1.5 rounded-full bg-current/55" />
      </span>
    </ChoicePositionGlyph>
  );
}

function ChoiceBottomGlyph() {
  return (
    <ChoicePositionGlyph>
      <span className="flex h-2.5 w-2.5 flex-col items-center justify-between">
        <span className="h-0.5 w-1.5 rounded-full bg-current/55" />
        <span className="h-0.5 w-2 rounded-full bg-current" />
      </span>
    </ChoicePositionGlyph>
  );
}

function BlurGlyph() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-current/35 bg-current/10">
      <Sparkles className="h-2.5 w-2.5" />
      <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-current/30 blur-[1px]" />
    </span>
  );
}

function ClearGlyph() {
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-current/35 bg-current/10">
      <span className="h-2.5 w-2.5 rounded-[3px] border border-current/55" />
    </span>
  );
}

function SpeedControl({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className={disabled ? 'opacity-45' : ''}>
      <DragSizeControl
        label={label}
        value={value}
        min={10}
        max={200}
        step={5}
        unit="ms"
        onChange={onChange}
      />
    </div>
  );
}


