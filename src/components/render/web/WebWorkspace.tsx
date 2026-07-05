import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { ReactNode } from 'react';
import {
  Gamepad2,
  Eye,
  EyeOff,
  ImagePlus,
  Info,
  LayoutTemplate,
  Hand,
  MousePointerClick,
  Palette,
  Play,
  Save,
  Settings,
  Sparkles,
  RotateCw,
  Trash2,
  Type,
  Upload,
  Video,
  Volume2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createElement, isValidElement, useEffect, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { DragSizeControl } from '../video/controls/RenderControls';
import { RenderStyleSettingsSection } from '../video/panels/render-style-settings-section';
import { renderCopy } from '../video/shared/renderCopy';
import type { RenderStyle, WebExportSettings, WebMenuElement } from '../video/shared/types';
import { WebPlaytestPreview } from './WebPlaytestPreview';
import type { WebPreviewSurface } from './WebPlaytestPreview';
import { buildArchivePageElements, buildSettingsPageElements } from './webMenuPageElements';

const protectedStartMenuElementRoles = new Set(['save', 'new', 'settings']);

type AIStartMenuDesign = {
  template?: WebExportSettings['startMenuTemplate'];
  backgroundType?: WebExportSettings['startMenuBackgroundType'];
  backgroundColor?: string;
  backgroundGradientStart?: string;
  backgroundGradientEnd?: string;
  backgroundGradientAngle?: number;
  placementBounds?: {
    minX?: number;
    minY?: number;
    maxX?: number;
    maxY?: number;
    locked?: boolean;
  };
  elements?: Partial<WebExportSettings['startMenuElements'][number]>[];
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const safeColor = (value: unknown, fallback: string) => {
  const text = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text;
  if (/^rgba?\((\s*\d+\s*,){2}\s*\d+(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(text)) return text;
  return fallback;
};

const extractJsonObject = (content: string): AIStartMenuDesign => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || content;
  const first = source.indexOf('{');
  const last = source.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('AI did not return JSON.');
  return JSON.parse(source.slice(first, last + 1)) as AIStartMenuDesign;
};

type WebWorkspaceProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  language: Language;
  webRenderStyle: RenderStyle;
  webChoiceColor: string;
  webChoiceTextColor: string;
  webSettings: WebExportSettings;
  webProjectName: string;
  progress: string;
  error: string;
  progressValue: number;
  savedPath: string;
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
  updateWebChoiceTextColor: (value: string) => void;
  updateWebChoiceColor: (value: string) => void;
  updateWebRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  callAIForTextResult?: (prompt: string) => Promise<{ content: string; reasoning?: string }>;
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
  progress,
  error,
  progressValue,
  savedPath,
  updateWebSettings,
  updateWebChoiceTextColor,
  updateWebChoiceColor,
  updateWebRenderStyle,
  callAIForTextResult,
}: WebWorkspaceProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const [aiStartMenuDesigning, setAiStartMenuDesigning] = useState(false);
  const [aiStartMenuDesignError, setAiStartMenuDesignError] = useState('');
  const startMenuDesignStorageKey = 'galwriter-web-start-menu-design:v1';
  const createStartMenuDesignSnapshot = (
    stripEmbeddedMedia = false,
  ): Partial<WebExportSettings> => ({
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
        archivePageElements: parsed.archivePageElements,
        settingsPageElements: parsed.settingsPageElements,
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
  const [currentPreviewSurface, setCurrentPreviewSurface] = useState<WebPreviewSurface>(
    webSettings.showStartMenu ? 'start' : 'game',
  );
  const [editPreviewSurface, setEditPreviewSurface] = useState<WebPreviewSurface>('start');
  const [selectedStartMenuElementId, setSelectedStartMenuElementId] = useState<string | null>(null);
  const defaultArchivePageElements = buildArchivePageElements(
    language,
    webChoiceColor,
    webChoiceTextColor,
  );
  const defaultSettingsPageElements = buildSettingsPageElements(
    language,
    webChoiceColor,
    webChoiceTextColor,
  );
  const archivePageElements = webSettings.archivePageElements?.length
    ? webSettings.archivePageElements
    : defaultArchivePageElements;
  const settingsPageElements = webSettings.settingsPageElements?.length
    ? webSettings.settingsPageElements
    : defaultSettingsPageElements;
  const activeElementSettingsKey:
    | 'startMenuElements'
    | 'archivePageElements'
    | 'settingsPageElements' =
    currentPreviewSurface === 'archive'
      ? 'archivePageElements'
      : currentPreviewSurface === 'settings'
        ? 'settingsPageElements'
        : 'startMenuElements';
  const activePageElements =
    activeElementSettingsKey === 'archivePageElements'
      ? archivePageElements
      : activeElementSettingsKey === 'settingsPageElements'
        ? settingsPageElements
        : webSettings.startMenuElements || [];
  const selectedStartMenuElement =
    activePageElements.find((element) => element.id === selectedStartMenuElementId) || null;
  const updateActivePageElement = (id: string, patch: Partial<WebMenuElement>) => {
    const source = activePageElements;
    updateWebSettings(
      activeElementSettingsKey,
      source.map((element) => (element.id === id ? { ...element, ...patch } : element)),
    );
  };
  const updateStartMenuElement = (
    id: string,
    patch: Partial<WebExportSettings['startMenuElements'][number]>,
  ) => {
    updateWebSettings(
      'startMenuElements',
      (webSettings.startMenuElements || []).map((element) =>
        element.id === id ? { ...element, ...patch } : element,
      ),
    );
  };
  const deleteStartMenuElement = (id: string) => {
    const element = webSettings.startMenuElements?.find((item) => item.id === id);
    if (element?.role && protectedStartMenuElementRoles.has(element.role)) return;

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
  const generateStartMenuDesignWithAI = async () => {
    if (!callAIForTextResult || aiStartMenuDesigning) return;
    setAiStartMenuDesigning(true);
    setAiStartMenuDesignError('');
    try {
      const currentElements: StartMenuElement[] = webSettings.startMenuElements?.length
        ? webSettings.startMenuElements
        : [
            {
              id: 'title',
              kind: 'text',
              role: 'title',
              text: webProjectName || t('开始', 'スタート', 'Start'),
              visible: true,
              x: 22,
              y: 30,
              width: 56,
              height: 12,
              scale: 1,
              rotation: 0,
              fontSize: 34,
              textColor: '#ffffff',
              borderRadius: 0,
            },
            {
              id: 'subtitle',
              kind: 'text',
              role: 'subtitle',
              text: t('没有存档', 'セーブなし', 'No save'),
              visible: true,
              x: 22,
              y: 43,
              width: 56,
              height: 5,
              scale: 1,
              rotation: 0,
              fontSize: 13,
              textColor: '#ffffff',
              borderRadius: 0,
            },
            {
              id: 'save',
              kind: 'button',
              role: 'save',
              text: t('存档', 'セーブ', 'Save'),
              visible: true,
              x: 33,
              y: 61,
              width: 34,
              height: 10,
              scale: 1,
              rotation: 0,
              primary: true,
              disabled: true,
              fontSize: 14,
              textColor: webChoiceTextColor,
              backgroundType: 'solid',
              backgroundColor: webChoiceColor,
              borderColor: 'rgba(255,255,255,0.24)',
              borderRadius: 12,
            },
            {
              id: 'new',
              kind: 'button',
              role: 'new',
              text: t('新游戏', '新規ゲーム', 'New Game'),
              visible: true,
              x: 33,
              y: 73,
              width: 34,
              height: 10,
              scale: 1,
              rotation: 0,
              primary: false,
              disabled: false,
              fontSize: 14,
              textColor: '#ffffff',
              backgroundType: 'solid',
              backgroundColor: 'rgba(255,255,255,0.10)',
              borderColor: 'rgba(255,255,255,0.16)',
              borderRadius: 12,
            },
            {
              id: 'settings',
              kind: 'button',
              role: 'settings',
              text: t('设置', '設定', 'Settings'),
              visible: true,
              x: 33,
              y: 85,
              width: 34,
              height: 10,
              scale: 1,
              rotation: 0,
              primary: false,
              disabled: false,
              fontSize: 14,
              textColor: '#ffffff',
              backgroundType: 'solid',
              backgroundColor: 'rgba(255,255,255,0.10)',
              borderColor: 'rgba(255,255,255,0.16)',
              borderRadius: 12,
            },
          ];
      const prompt = `You are designing a visual novel web start screen for GalWriter.
Return one strict JSON object only. No markdown, no explanation.
The app will consume this response as settings, so every value must be practical.

Project title: ${webProjectName || 'Untitled'}
Language: ${language}
Current elements:
${JSON.stringify(
  currentElements.map((element) => ({
    id: element.id,
    kind: element.kind,
    role: element.role,
    text: element.text,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  })),
  null,
  2,
)}

Design goals:
- Create a more polished, original start screen than generic Cinematic / Minimal / Glass presets.
- Preserve the functional roles save, new, settings. Do not omit them.
- Do not use remote image URLs. Use solid or gradient colors only.
- Keep all element positions in percent coordinates from 0 to 100.
- Keep elements readable over the background.
- Return concise button labels in the current UI language if you rename text.

JSON schema:
{
  "template": "cinematic" | "minimal" | "glass",
  "backgroundType": "solid" | "gradient",
  "backgroundColor": "#123456",
  "backgroundGradientStart": "#123456",
  "backgroundGradientEnd": "#abcdef",
  "backgroundGradientAngle": 0,
  "placementBounds": { "minX": 0, "minY": 0, "maxX": 100, "maxY": 100, "locked": false },
  "elements": [
    {
      "id": "title",
      "kind": "text",
      "role": "title",
      "text": "...",
      "visible": true,
      "x": 20,
      "y": 20,
      "width": 60,
      "height": 12,
      "scale": 1,
      "rotation": 0,
      "fontSize": 34,
      "textColor": "#ffffff",
      "borderRadius": 0
    }
  ]
}`;
      const result = await callAIForTextResult(prompt);
      const design = extractJsonObject(result.content);
      const nextTemplate =
        design.template === 'minimal' ||
        design.template === 'glass' ||
        design.template === 'cinematic'
          ? design.template
          : 'cinematic';
      const nextBackgroundType =
        design.backgroundType === 'solid' || design.backgroundType === 'gradient'
          ? design.backgroundType
          : 'gradient';
      const sourceByRole = new Map<string, StartMenuElement>(
        currentElements
          .filter((element) => element.role)
          .map((element) => [String(element.role), element] as const),
      );
      const sourceById = new Map<string, StartMenuElement>(
        currentElements.map((element) => [element.id, element] as const),
      );
      const sanitizedElements: StartMenuElement[] = (design.elements || [])
        .slice(0, 10)
        .map((element, index) => {
          const role = element.role;
          const base =
            (role ? sourceByRole.get(role) : undefined) ||
            (element.id ? sourceById.get(element.id) : undefined) ||
            currentElements[index] ||
            currentElements[0];
          const kind =
            element.kind === 'button' || element.kind === 'image' || element.kind === 'text'
              ? element.kind
              : base.kind;
          return {
            ...base,
            ...element,
            id: String(element.id || base.id || `ai-${index}`),
            kind,
            role: element.role || base.role || 'custom',
            text: String(element.text ?? base.text ?? ''),
            visible: element.visible !== false,
            x: clampNumber(element.x, base.x, 0, 94),
            y: clampNumber(element.y, base.y, 0, 96),
            width: clampNumber(element.width, base.width, 6, 96),
            height: clampNumber(element.height, base.height, 4, 80),
            scale: clampNumber(element.scale, base.scale, 0.4, 2.4),
            rotation: clampNumber(element.rotation, base.rotation, -18, 18),
            fontSize: clampNumber(element.fontSize, base.fontSize ?? 14, 8, 72),
            textColor: safeColor(element.textColor, base.textColor || '#ffffff'),
            backgroundType:
              element.backgroundType === 'gradient'
                ? 'gradient'
                : element.backgroundType === 'image'
                  ? 'solid'
                  : element.backgroundType || base.backgroundType,
            backgroundColor: safeColor(
              element.backgroundColor,
              base.backgroundColor || 'rgba(255,255,255,0.10)',
            ),
            backgroundGradientStart: safeColor(
              element.backgroundGradientStart,
              base.backgroundGradientStart || webChoiceColor,
            ),
            backgroundGradientEnd: safeColor(
              element.backgroundGradientEnd,
              base.backgroundGradientEnd || '#0f172a',
            ),
            backgroundGradientAngle: clampNumber(
              element.backgroundGradientAngle,
              base.backgroundGradientAngle ?? 135,
              0,
              360,
            ),
            borderColor: safeColor(
              element.borderColor,
              base.borderColor || 'rgba(255,255,255,0.18)',
            ),
            borderRadius: clampNumber(
              element.borderRadius,
              base.borderRadius ?? (kind === 'text' ? 0 : 12),
              0,
              40,
            ),
            imageUrl:
              kind === 'image' ? String(element.imageUrl || base.imageUrl || '') : base.imageUrl,
          };
        });
      ['save', 'new', 'settings'].forEach((role) => {
        if (!sanitizedElements.some((element) => element.role === role)) {
          const fallback = sourceByRole.get(role);
          if (fallback) sanitizedElements.push(fallback);
        }
      });

      updateWebSettings('showStartMenu', true);
      updateWebSettings('startMenuTemplate', nextTemplate);
      updateWebSettings('startMenuBackgroundType', nextBackgroundType);
      updateWebSettings(
        'startMenuBackgroundColor',
        safeColor(design.backgroundColor, webSettings.startMenuBackgroundColor),
      );
      updateWebSettings(
        'startMenuBackgroundGradientStart',
        safeColor(design.backgroundGradientStart, webSettings.startMenuBackgroundGradientStart),
      );
      updateWebSettings(
        'startMenuBackgroundGradientEnd',
        safeColor(design.backgroundGradientEnd, webSettings.startMenuBackgroundGradientEnd),
      );
      updateWebSettings(
        'startMenuBackgroundGradientAngle',
        clampNumber(
          design.backgroundGradientAngle,
          webSettings.startMenuBackgroundGradientAngle,
          0,
          360,
        ),
      );
      updateWebSettings(
        'startMenuPlacementMinX',
        clampNumber(design.placementBounds?.minX, 10, 0, 94),
      );
      updateWebSettings(
        'startMenuPlacementMinY',
        clampNumber(design.placementBounds?.minY, 10, 0, 96),
      );
      updateWebSettings(
        'startMenuPlacementMaxX',
        clampNumber(design.placementBounds?.maxX, 90, 6, 100),
      );
      updateWebSettings(
        'startMenuPlacementMaxY',
        clampNumber(design.placementBounds?.maxY, 90, 4, 100),
      );
      updateWebSettings('startMenuPlacementBoundsLocked', Boolean(design.placementBounds?.locked));
      if (sanitizedElements.length > 0) updateWebSettings('startMenuElements', sanitizedElements);
      setSelectedStartMenuElementId(null);
      setPreviewRefreshKey((key) => key + 1);
    } catch (error) {
      setAiStartMenuDesignError(error instanceof Error ? error.message : String(error));
    } finally {
      setAiStartMenuDesigning(false);
    }
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
        <div className="grid h-12 grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--vr-border)] px-4">
          <div className="flex min-w-0 items-center gap-2 text-xs font-black tracking-wide text-[var(--vr-text-soft)]">
            <Play className="w-4 h-4 text-[var(--vr-accent)]" />
            <span className="truncate">测试预览窗口</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="w-28">
              <WebPillToggleGroup
                value={webSettings.showStartMenu ? 'on' : 'off'}
                options={[
                  { value: 'on', label: 'Menu', icon: <Gamepad2 className="h-3.5 w-3.5" /> },
                  { value: 'off', label: 'Direct', icon: <Play className="h-3.5 w-3.5" /> },
                ]}
                onChange={(value) => updateWebSettings('showStartMenu', value === 'on')}
              />
            </div>
            <button
              type="button"
              onClick={() => setPreviewRefreshKey((key) => key + 1)}
              className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--vr-surface)] text-[var(--vr-text)] ring-1 ring-[var(--vr-border)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-accent)]"
              title={t('刷新项目预览', 'プロジェクトプレビューを更新', 'Refresh project preview')}
              aria-label={t(
                '刷新项目预览',
                'プロジェクトプレビューを更新',
                'Refresh project preview',
              )}
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
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
            requestedSurface={
              startMenuPreviewMode === 'edit' && webSettings.showStartMenu
                ? editPreviewSurface
                : undefined
            }
            selectedStartMenuElementId={selectedStartMenuElementId}
            onSurfaceChange={setCurrentPreviewSurface}
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
          <div className="w-36 shrink-0">
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
        </div>

        <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          {startMenuPreviewMode === 'edit' && webSettings.showStartMenu && (
            <div className="space-y-3">
              <WebSettingCard>
                <WebSegmentedGroup
                  value={editPreviewSurface}
                  options={[
                    { value: 'start', label: t('主界面', 'メイン', 'Menu') },
                    { value: 'archive', label: t('存档', 'セーブ', 'Save') },
                    { value: 'game', label: t('对话', '会話', 'Dialog') },
                    { value: 'settings', label: t('设置', '設定', 'Settings') },
                  ]}
                  columns="grid-cols-4"
                  onChange={(value) => {
                    const surface = value as WebPreviewSurface;
                    setSelectedStartMenuElementId(null);
                    setEditPreviewSurface(surface);
                    setCurrentPreviewSurface(surface);
                  }}
                />
              </WebSettingCard>
              <div className="h-px bg-[var(--vr-border)]" />
            </div>
          )}
          {currentPreviewSurface === 'start' && (
            <>
              <WebPanelTitle icon={LayoutTemplate} title="启动界面设计" />
              {webSettings.showStartMenu && (
                <div className="space-y-3 rounded-xl border border-white/10 bg-[var(--vr-surface)]/90 p-3 shadow-xl shadow-black/5 backdrop-blur-xl">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <div className="min-w-0 text-[11px] font-black text-[var(--vr-text)]">
                        {selectedStartMenuElement
                          ? selectedStartMenuElement.kind === 'button'
                            ? t('按钮样式', 'ボタンスタイル', 'Button style')
                            : selectedStartMenuElement.kind === 'image'
                              ? t('图片样式', '画像スタイル', 'Image style')
                              : t('文字样式', 'テキストスタイル', 'Text style')
                          : t('背景样式', '背景スタイル', 'Background style')}
                      </div>
                      <div className="h-px flex-1 bg-[var(--vr-border)]" />
                    </div>
                    <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)]/70 p-2">
                      {selectedStartMenuElement ? (
                        <StartMenuElementInspector
                          element={selectedStartMenuElement}
                          language={language}
                          onUpdate={(patch) =>
                            updateActivePageElement(selectedStartMenuElement.id, patch)
                          }
                        />
                      ) : (
                        <StartMenuBackgroundInspector
                          settings={webSettings}
                          language={language}
                          showDescriptions={showSettingDescriptions}
                          updateWebSettings={updateWebSettings}
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <div className="text-[11px] font-black text-[var(--vr-text)]">
                        {t('素材', '素材', 'Assets')}
                      </div>
                      <div className="h-px flex-1 bg-[var(--vr-border)]" />
                    </div>
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
                      <label
                        className="grid h-9 min-w-0 cursor-pointer place-items-center rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]"
                        title={
                          webSettings.startMenuBackgroundMusicUrl
                            ? t('更换音乐', 'BGM変更', 'Replace music')
                            : t('导入 MP3', 'MP3読込', 'Import MP3')
                        }
                      >
                        <Volume2 className="h-4 w-4" />
                        <input
                          type="file"
                          accept="audio/mpeg,audio/mp3,.mp3"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            if (file) {
                              readImageFileAsDataUrl(file, (value) =>
                                updateWebSettings('startMenuBackgroundMusicUrl', value),
                              );
                            }
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <div className="text-[11px] font-black text-[var(--vr-text)]">
                        {t('预设', 'プリセット', 'Preset')}
                      </div>
                      <div className="h-px flex-1 bg-[var(--vr-border)]" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => void generateStartMenuDesignWithAI()}
                        disabled={!callAIForTextResult || aiStartMenuDesigning}
                        className="grid h-9 min-w-0 place-items-center rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)] disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          aiStartMenuDesigning
                            ? t('AI 设计中', 'AI設計中', 'AI designing')
                            : t('AI 设计', 'AI設計', 'AI Design')
                        }
                      >
                        <Sparkles
                          className={`h-4 w-4 ${aiStartMenuDesigning ? 'animate-spin' : ''}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={saveStartMenuDesign}
                        className="grid h-9 min-w-0 place-items-center rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]"
                        title={t('保存设计', '保存', 'Save Design')}
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={loadStartMenuDesign}
                        className="grid h-9 min-w-0 place-items-center rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]"
                        title={t('套用设计', '適用', 'Apply Design')}
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                    </div>
                    {webSettings.startMenuBackgroundMusicUrl && (
                      <button
                        type="button"
                        onClick={() => updateWebSettings('startMenuBackgroundMusicUrl', '')}
                        className="flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 text-[10px] font-black text-[var(--vr-text-soft)] transition-colors hover:border-rose-400/45 hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="truncate">{t('移除音乐', 'BGM削除', 'Remove music')}</span>
                      </button>
                    )}
                  </div>

                  {aiStartMenuDesignError && (
                    <div className="rounded-md bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-500 dark:text-rose-300">
                      {aiStartMenuDesignError}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {currentPreviewSurface === 'settings' && (
            <>
              <WebPanelTitle icon={LayoutTemplate} title="设置页面界面设计" />
              {selectedStartMenuElement && (
                <div className="space-y-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-2">
                  <StartMenuElementInspector
                    element={selectedStartMenuElement}
                    language={language}
                    onUpdate={(patch) =>
                      updateActivePageElement(selectedStartMenuElement.id, patch)
                    }
                  />
                </div>
              )}
              <WebPanelTitle icon={Settings} title="网页参数" />
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
                        updateWebSettings(
                          'choicesPosition',
                          value as WebExportSettings['choicesPosition'],
                        )
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
                        ? t(
                            '隐藏单选弹窗',
                            '単一選択のポップアップを隠す',
                            'Hide single-choice popups',
                          )
                        : undefined
                    }
                  >
                    <WebPillToggleGroup
                      value={webSettings.skipSingleChoicePopup ? 'hide' : 'show'}
                      options={[
                        { value: 'hide', label: 'Hide', icon: <EyeOff className="h-3.5 w-3.5" /> },
                        { value: 'show', label: 'Show', icon: <Eye className="h-3.5 w-3.5" /> },
                      ]}
                      onChange={(value) =>
                        updateWebSettings('skipSingleChoicePopup', value === 'hide')
                      }
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
                        {
                          value: 'auto',
                          label: 'Auto',
                          icon: <RotateCw className="h-3.5 w-3.5" />,
                        },
                        {
                          value: 'manual',
                          label: 'Manual',
                          icon: <Hand className="h-3.5 w-3.5" />,
                        },
                      ]}
                      onChange={(value) => updateWebSettings('videoAutoPlay', value === 'auto')}
                    />
                  </WebSettingCard>
                </div>
              </div>
            </>
          )}
          {currentPreviewSurface === 'archive' && (
            <>
              <WebPanelTitle icon={Save} title="档案页界面设计" />
              {selectedStartMenuElement && (
                <div className="space-y-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-2">
                  <StartMenuElementInspector
                    element={selectedStartMenuElement}
                    language={language}
                    onUpdate={(patch) =>
                      updateActivePageElement(selectedStartMenuElement.id, patch)
                    }
                  />
                </div>
              )}
              <div className="space-y-3 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3">
                <WebSettingCard
                  icon={Save}
                  description={
                    showSettingDescriptions
                      ? t(
                          '启动界面中的档案入口',
                          'タイトル画面のセーブ入口',
                          'Save entry on the start screen',
                        )
                      : undefined
                  }
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
                <div className="grid gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-2">
                  <div className="px-1 text-[10px] font-black text-[var(--vr-text-muted)]">
                    {t('档案卡片预览', 'セーブカード', 'Save card')}
                  </div>
                  <ColorField
                    label={t('按钮底色', 'ボタン色', 'Button')}
                    value={webChoiceColor}
                    onChange={updateWebChoiceColor}
                  />
                  <ColorField
                    label={t('文字颜色', '文字色', 'Text')}
                    value={webChoiceTextColor}
                    onChange={updateWebChoiceTextColor}
                  />
                  <div className="rounded-lg bg-[var(--vr-surface-soft)] px-3 py-2 text-[10px] font-bold text-[var(--vr-text-muted)]">
                    {t(
                      '档案页沿用网页按钮颜色；导出后的网页会自动读取本地存档。',
                      'セーブ画面はWebボタン色を使い、書き出し後はローカルセーブを自動で読みます。',
                      'The archive page uses the web button colors and reads local saves in exported builds.',
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          {currentPreviewSurface === 'game' && (
            <>
              <WebPanelTitle icon={Palette} title="文字样式" />
              <RenderStyleSettingsSection
                language={language}
                renderStyle={webRenderStyle}
                updateRenderStyle={updateWebRenderStyle}
                showDescriptions={showSettingDescriptions}
              />
            </>
          )}

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
        </div>
      </aside>
    </main>
  );
}

const isReactNodeIcon = (icon: LucideIcon | ReactNode): icon is ReactNode => isValidElement(icon);

const createIconElement = (Icon: LucideIcon) => createElement(Icon, { className: 'h-3.5 w-3.5' });

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
  showDescriptions,
  updateWebSettings,
}: {
  settings: WebExportSettings;
  language: Language;
  showDescriptions: boolean;
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
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
      <StartMenuBackgroundField
        description={showDescriptions ? t('背景类型', '背景タイプ', 'Background type') : undefined}
      >
        <div className="grid grid-cols-3 gap-2">
          <StartMenuBackgroundChoiceButton
            icon={Palette}
            label={t('底色', '単色', 'Solid')}
            active={settings.startMenuBackgroundType === 'solid'}
            onClick={() => updateWebSettings('startMenuBackgroundType', 'solid')}
          />
          <StartMenuBackgroundChoiceButton
            icon={Sparkles}
            label={t('渐变', 'グラデ', 'Gradient')}
            active={settings.startMenuBackgroundType === 'gradient'}
            onClick={() => updateWebSettings('startMenuBackgroundType', 'gradient')}
          />
          <StartMenuBackgroundChoiceButton
            icon={ImagePlus}
            label={t('图片', '画像', 'Image')}
            active={settings.startMenuBackgroundType === 'image'}
            onClick={() => updateWebSettings('startMenuBackgroundType', 'image')}
          />
        </div>
      </StartMenuBackgroundField>
      {settings.startMenuBackgroundType === 'solid' && (
        <StartMenuBackgroundField
          description={
            showDescriptions
              ? t('启动页背景底色', 'タイトル画面の背景色', 'Start screen background color')
              : undefined
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <StartMenuBackgroundColorTile
              icon={Palette}
              label={t('底色', '単色', 'Solid')}
              value={settings.startMenuBackgroundColor}
              onChange={(value) => updateWebSettings('startMenuBackgroundColor', value)}
            />
            <StartMenuBackgroundPreviewTile background={backgroundPreview} />
          </div>
        </StartMenuBackgroundField>
      )}
      {settings.startMenuBackgroundType === 'gradient' && (
        <StartMenuBackgroundField
          description={
            showDescriptions
              ? t('渐变起点、终点与方向', 'グラデーションの色と角度', 'Gradient colors and angle')
              : undefined
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <StartMenuBackgroundColorTile
              icon={Palette}
              label={t('起点', '開始', 'Start')}
              value={settings.startMenuBackgroundGradientStart}
              onChange={(value) => updateWebSettings('startMenuBackgroundGradientStart', value)}
            />
            <StartMenuBackgroundColorTile
              icon={Palette}
              label={t('终点', '終了', 'End')}
              value={settings.startMenuBackgroundGradientEnd}
              onChange={(value) => updateWebSettings('startMenuBackgroundGradientEnd', value)}
            />
            <StartMenuBackgroundIconTile icon={RotateCw}>
              <DragSizeControl
                label={t('角度', '角度', 'Angle')}
                value={settings.startMenuBackgroundGradientAngle}
                min={0}
                max={360}
                step={1}
                unit="deg"
                onChange={(value) => updateWebSettings('startMenuBackgroundGradientAngle', value)}
              />
            </StartMenuBackgroundIconTile>
          </div>
        </StartMenuBackgroundField>
      )}
      {settings.startMenuBackgroundType === 'image' && (
        <StartMenuBackgroundField
          description={
            showDescriptions
              ? t(
                  '启动页背景图片地址',
                  'タイトル画面の背景画像URL',
                  'Start screen background image URL',
                )
              : undefined
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <StartMenuBackgroundIconTile icon={ImagePlus} className="col-span-2">
              <input
                type="text"
                value={settings.startMenuBackgroundImageUrl}
                onChange={(event) =>
                  updateWebSettings('startMenuBackgroundImageUrl', event.target.value)
                }
                placeholder={t('背景图片 URL', '背景画像 URL', 'Background image URL')}
                className="h-10 w-full rounded-r-lg border-0 bg-transparent px-2 text-right text-xs font-normal text-[var(--vr-text)] outline-none placeholder:text-[var(--vr-text-muted)] focus:bg-white/5"
                aria-label={t('背景图片 URL', '背景画像 URL', 'Background image URL')}
              />
            </StartMenuBackgroundIconTile>
            <StartMenuBackgroundPreviewTile background={backgroundPreview} className="col-span-1" />
          </div>
        </StartMenuBackgroundField>
      )}
    </div>
  );
}

function StartMenuBackgroundField({
  description,
  children,
}: {
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      {description && (
        <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>
      )}
      {children}
    </div>
  );
}

function StartMenuBackgroundIconTile({
  icon: Icon,
  children,
  className = '',
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid h-10 grid-cols-[28px_minmax(0,1fr)] items-stretch rounded-lg bg-[var(--vr-surface-soft)] ${className}`}
    >
      <span className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function StartMenuBackgroundChoiceButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 min-w-0 items-center justify-start gap-1.5 rounded-lg px-2 text-left text-[11px] font-normal transition-colors ${
        active
          ? 'border border-indigo-500/25 bg-indigo-500/15 text-indigo-500 ring-1 ring-indigo-400/35'
          : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'
      }`}
      aria-pressed={active}
      title={label}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function StartMenuBackgroundColorTile({
  icon,
  label,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <StartMenuBackgroundIconTile icon={icon}>
      <input
        type="color"
        value={colorInputValue(value)}
        onChange={(event) => onChange(event.target.value)}
        className="video-render-color-input h-10 w-full cursor-pointer rounded-r-lg border-0 bg-transparent p-0"
        aria-label={label}
        title={label}
      />
    </StartMenuBackgroundIconTile>
  );
}

function StartMenuBackgroundPreviewTile({
  background,
  className = 'col-span-2',
}: {
  background: string;
  className?: string;
}) {
  return (
    <div
      className={`${className} grid h-10 grid-cols-[28px_minmax(0,1fr)] items-stretch rounded-lg bg-[var(--vr-surface-soft)]`}
    >
      <span className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
        <Eye className="h-3.5 w-3.5" />
      </span>
      <div className="p-1">
        <div className="h-full rounded-md border border-white/10" style={{ background }} />
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
      {element.kind === 'text' && (
        <label className="grid gap-1">
          <span className="px-1 text-[10px] font-black text-[var(--vr-text-muted)]">
            {t('文字内容', 'テキスト', 'Text')}
          </span>
          <input
            type="text"
            value={element.text}
            onChange={(event) => onUpdate({ text: event.target.value })}
            placeholder={t('输入文字', 'テキストを入力', 'Enter text')}
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
              onChange={(value) =>
                onUpdate({ backgroundType: value as StartMenuElement['backgroundType'] })
              }
              columns="grid-cols-3"
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
                  onChange={(value) =>
                    onUpdate({ backgroundGradientStart: value, backgroundType: 'gradient' })
                  }
                />
                <ColorField
                  label={t('终点', '終了', 'End')}
                  value={element.backgroundGradientEnd || '#0f172a'}
                  onChange={(value) =>
                    onUpdate({ backgroundGradientEnd: value, backgroundType: 'gradient' })
                  }
                />
              </div>
              <RangeField
                label={t('角度', '角度', 'Angle')}
                value={element.backgroundGradientAngle ?? 135}
                min={0}
                max={360}
                onChange={(value) =>
                  onUpdate({ backgroundGradientAngle: value, backgroundType: 'gradient' })
                }
              />
            </div>
          ) : (
            <div className="grid gap-2 rounded-lg bg-[var(--vr-surface-soft)] p-2">
              <input
                type="text"
                value={element.backgroundImageUrl || ''}
                onChange={(event) =>
                  onUpdate({ backgroundImageUrl: event.target.value, backgroundType: 'image' })
                }
                placeholder={t(
                  '按钮背景图片 URL',
                  'ボタン背景画像 URL',
                  'Button background image URL',
                )}
                className="h-9 w-full rounded-lg border border-transparent bg-[var(--vr-surface)] px-3 text-xs font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]"
                aria-label={t(
                  '按钮背景图片 URL',
                  'ボタン背景画像 URL',
                  'Button background image URL',
                )}
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
      {description && (
        <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>
      )}
      <div
        className={`grid h-9 items-center rounded-lg bg-[var(--vr-surface-soft)] ${
          hasIcon ? 'grid-cols-[28px_minmax(0,1fr)]' : 'grid-cols-1'
        }`}
      >
        {Icon ? (
          <div className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
            {isReactNodeIcon(Icon) ? Icon : createIconElement(Icon as LucideIcon)}
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
    <div
      className={`web-segment-control grid h-9 w-full overflow-hidden rounded-lg ${columns} min-w-0`}
    >
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
    <div
      className={`web-segment-control grid h-9 w-full overflow-hidden rounded-lg ${columns} min-w-0`}
    >
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
