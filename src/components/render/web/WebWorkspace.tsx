import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import {
  Eye,
  EyeOff,
  Gamepad2,
  Hand,
  ImagePlus,
  Info,
  LayoutTemplate,
  Copy,
  MousePointerClick,
  Palette,
  Play,
  RotateCw,
  Save,
  Settings,
  Sparkles,
  Type,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { createElement, isValidElement, useCallback, useEffect, useMemo, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { VirtualPresentationStage } from '../../VirtualPresentationStage';
import { normalizeSharedCanvasSettings } from '../canvas/canvasSettings';
import { RenderObjectSettingsSection } from '../video/panels/render-object-settings-section';
import { renderCopy } from '../video/shared/renderCopy';
import type { RenderStyle, WebExportSettings, WebMenuElement } from '../video/shared/types';
import { StartMenuBackgroundInspector } from './StartMenuBackgroundInspector';
import { StartMenuElementInspector } from './StartMenuElementInspector';
import {
  buildWebExperiencePresets,
} from './webExperiencePresets';
import { buildRehearsalTemplate } from './webExperienceTemplates';
import { buildArchivePageElements, buildSettingsPageElements } from './webMenuPageElements';
import type { WebPreviewSurface } from './WebPlaytestPreview';
import { WebPlaytestPreview } from './WebPlaytestPreview';

const webSmallTabClass =
  'h-8 rounded-lg px-2 text-[11px] font-black text-[var(--vr-text-soft)] transition-colors hover:text-[var(--vr-text)]';
const webSmallTabActiveClass = `${webSmallTabClass} bg-indigo-600 text-white`;

function TemplateMiniPreview({ settings, accent, surface }: { settings: Partial<WebExportSettings>; accent: string; surface: WebPreviewSurface }) {
  const pageBackground = surface === 'archive'
    ? { type: settings.archiveBackgroundType, color: settings.archiveBackgroundColor, start: settings.archiveBackgroundGradientStart, end: settings.archiveBackgroundGradientEnd, angle: settings.archiveBackgroundGradientAngle, image: settings.archiveBackgroundImageUrl }
    : surface === 'settings'
      ? { type: settings.settingsBackgroundType, color: settings.settingsBackgroundColor, start: settings.settingsBackgroundGradientStart, end: settings.settingsBackgroundGradientEnd, angle: settings.settingsBackgroundGradientAngle, image: settings.settingsBackgroundImageUrl }
      : surface === 'game'
        ? { type: settings.dialogueBackgroundType, color: settings.dialogueBackgroundColor, start: settings.dialogueBackgroundGradientStart, end: settings.dialogueBackgroundGradientEnd, angle: settings.dialogueBackgroundGradientAngle, image: settings.dialogueBackgroundImageUrl }
        : { type: settings.startMenuBackgroundType, color: settings.startMenuBackgroundColor, start: settings.startMenuBackgroundGradientStart, end: settings.startMenuBackgroundGradientEnd, angle: settings.startMenuBackgroundGradientAngle, image: settings.startMenuBackgroundImageUrl };
  const background = pageBackground.type === 'gradient'
    ? `linear-gradient(${pageBackground.angle ?? 135}deg, ${pageBackground.start || '#0f172a'}, ${pageBackground.end || accent})`
    : pageBackground.type === 'image' && pageBackground.image
      ? `url(${pageBackground.image}) center / cover`
      : pageBackground.color || '#172554';
  const elements = ((surface === 'archive'
    ? settings.archivePageElements
    : surface === 'settings'
      ? settings.settingsPageElements
      : surface === 'game'
        ? settings.dialogueOverlayElements
        : settings.startMenuElements) || [])
    .filter((element) => element.visible && element.width > 0 && element.height > 0)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  return (
    <span
      className="relative flex h-7 w-11 shrink-0 overflow-hidden rounded-[5px] border border-white/25 shadow-sm"
      style={{ background }}
      aria-hidden="true"
    >
      {elements.map((element) => {
        const isText = element.kind === 'text';
        const fill = isText && !element.fillEnabled
          ? 'transparent'
          : element.backgroundColor || (element.primary ? accent : 'rgba(255,255,255,.16)');
        return <span
          key={element.id}
          className="absolute overflow-hidden"
          style={{
            left: `${Math.max(0, Math.min(100, element.x))}%`,
            top: `${Math.max(0, Math.min(100, element.y))}%`,
            width: `${Math.max(1, Math.min(100, element.width))}%`,
            height: `${Math.max(1, Math.min(100, element.height))}%`,
            background: element.kind === 'image' && element.imageUrl ? `url(${element.imageUrl}) center / cover` : fill,
            border: element.borderWidth && element.borderColor ? `${Math.max(.5, element.borderWidth / 3)}px solid ${element.borderColor}` : undefined,
            borderRadius: Math.max(1, Math.min(4, (element.borderRadius || 4) / 4)),
            opacity: element.opacity === undefined ? 1 : element.opacity / 100,
            transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
          }}
        >
          {element.kind !== 'image' && <span className="absolute left-[12%] right-[12%] top-1/2 h-[1px] -translate-y-1/2 rounded-full" style={{ backgroundColor: element.textColor || '#ffffff' }} />}
        </span>;
      })}
    </span>
  );
}

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

type WebExperienceSnapshot = {
  settings?: Partial<WebExportSettings>;
  renderStyle?: Partial<RenderStyle>;
  choiceColor?: string;
  choiceTextColor?: string;
};

type SavedWebExperienceTemplate = WebExperienceSnapshot & {
  id: string;
  name: string;
  savedAt: number;
  scope?: 'current' | 'all';
  surface?: WebPreviewSurface;
};

const webTemplateLibraryStorageKey = 'galwriter-web-experience-templates:v1';

const stripEmbeddedDataUrls = <T,>(value: T): T => {
  if (typeof value === 'string') return (value.startsWith('data:') ? '' : value) as T;
  if (Array.isArray(value)) return value.map(stripEmbeddedDataUrls) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, stripEmbeddedDataUrls(item)]),
    ) as T;
  }
  return value;
};

const readWebTemplateLibrary = (): SavedWebExperienceTemplate[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(webTemplateLibraryStorageKey) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is SavedWebExperienceTemplate =>
          Boolean(item && typeof item.id === 'string' && typeof item.name === 'string'),
        )
      : [];
  } catch {
    return [];
  }
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
  updateWebSettingsBulk: (patch: Partial<WebExportSettings>) => void;
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
  savedPath: _savedPath,
  updateWebSettings,
  updateWebSettingsBulk,
  updateWebChoiceTextColor,
  updateWebChoiceColor,
  updateWebRenderStyle,
  callAIForTextResult,
}: WebWorkspaceProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const [aiStartMenuDesigning, setAiStartMenuDesigning] = useState(false);
  const [aiStartMenuDesignError, setAiStartMenuDesignError] = useState('');
  const [savedTemplateLibrary, setSavedTemplateLibrary] = useState(readWebTemplateLibrary);
  const [selectedSavedTemplateId, setSelectedSavedTemplateId] = useState<string | null>(null);
  const [isSaveTemplateDialogOpen, setIsSaveTemplateDialogOpen] = useState(false);
  const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);
  const [isTemplateEditing, setIsTemplateEditing] = useState(false);
  const [selectedTemplateEditIds, setSelectedTemplateEditIds] = useState<string[]>([]);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [templateSaveScope, setTemplateSaveScope] = useState<'current' | 'all'>('current');
  const createStartMenuDesignSnapshot = (scope: 'current' | 'all' = 'all', stripEmbeddedMedia = false) => {
    const stripDataUrl = (value?: string) =>
      stripEmbeddedMedia && value?.startsWith('data:') ? '' : value;
    const stripElementMedia = (element: WebMenuElement): WebMenuElement => ({
      ...element,
      imageUrl: stripDataUrl(element.imageUrl),
      backgroundImageUrl: stripDataUrl(element.backgroundImageUrl),
    });
    const fullSettings = {
      ...webSettings,
      startMenuBackgroundImageUrl: stripDataUrl(webSettings.startMenuBackgroundImageUrl) || '',
      startMenuBackgroundVideoUrl: stripDataUrl(webSettings.startMenuBackgroundVideoUrl),
      startMenuBackgroundMusicUrl: stripDataUrl(webSettings.startMenuBackgroundMusicUrl) || '',
      archiveBackgroundImageUrl: stripDataUrl(webSettings.archiveBackgroundImageUrl),
      archiveBackgroundVideoUrl: stripDataUrl(webSettings.archiveBackgroundVideoUrl),
      settingsBackgroundImageUrl: stripDataUrl(webSettings.settingsBackgroundImageUrl),
      settingsBackgroundVideoUrl: stripDataUrl(webSettings.settingsBackgroundVideoUrl),
      dialogueBackgroundImageUrl: stripDataUrl(webSettings.dialogueBackgroundImageUrl),
      dialogueBackgroundVideoUrl: stripDataUrl(webSettings.dialogueBackgroundVideoUrl),
      sceneBackgroundImageUrl: stripDataUrl(webSettings.sceneBackgroundImageUrl) || '',
      startMenuElements: webSettings.startMenuElements.map(stripElementMedia),
      archivePageElements: (webSettings.archivePageElements || []).map(stripElementMedia),
      settingsPageElements: (webSettings.settingsPageElements || []).map(stripElementMedia),
      previewToolbarElements: (webSettings.previewToolbarElements || []).map(stripElementMedia),
      dialogueOverlayElements: (webSettings.dialogueOverlayElements || []).map(stripElementMedia),
    };
    const surfaceKeys: Record<WebPreviewSurface, Array<keyof WebExportSettings>> = {
      start: ['showStartMenu', 'startMenuTemplate', 'startMenuBackgroundType', 'startMenuBackgroundColor', 'startMenuBackgroundGradientStart', 'startMenuBackgroundGradientEnd', 'startMenuBackgroundGradientAngle', 'startMenuBackgroundGradientShape', 'startMenuBackgroundGradientStops', 'startMenuBackgroundImageUrl', 'startMenuBackgroundVideoUrl', 'startMenuBackgroundVideoLoop', 'startMenuBackgroundVideoMuted', 'startMenuBackgroundVideoFit', 'startMenuElements', 'startMenuPlacementBoundsLocked', 'startMenuPlacementMinX', 'startMenuPlacementMinY', 'startMenuPlacementMaxX', 'startMenuPlacementMaxY', 'startMenuShowSave', 'startMenuShowNewGame', 'startMenuShowSettings'],
      archive: ['archiveBackgroundType', 'archiveBackgroundColor', 'archiveBackgroundGradientStart', 'archiveBackgroundGradientEnd', 'archiveBackgroundGradientAngle', 'archiveBackgroundGradientShape', 'archiveBackgroundGradientStops', 'archiveBackgroundImageUrl', 'archiveBackgroundVideoUrl', 'archiveBackgroundVideoLoop', 'archiveBackgroundVideoMuted', 'archiveBackgroundVideoFit', 'archivePageElements', 'startMenuMusicApplyToArchive'],
      settings: ['settingsBackgroundType', 'settingsBackgroundColor', 'settingsBackgroundGradientStart', 'settingsBackgroundGradientEnd', 'settingsBackgroundGradientAngle', 'settingsBackgroundGradientShape', 'settingsBackgroundGradientStops', 'settingsBackgroundImageUrl', 'settingsBackgroundVideoUrl', 'settingsBackgroundVideoLoop', 'settingsBackgroundVideoMuted', 'settingsBackgroundVideoFit', 'settingsPageElements', 'startMenuMusicApplyToSettings'],
      game: ['layoutMode', 'sceneFit', 'sceneScale', 'sceneScaleX', 'sceneScaleY', 'sceneOffsetX', 'sceneOffsetY', 'sceneBackgroundVisible', 'sceneBackgroundType', 'sceneBackgroundColor', 'sceneBackgroundGradientStart', 'sceneBackgroundGradientEnd', 'sceneBackgroundGradientAngle', 'sceneBackgroundImageUrl', 'choicesPosition', 'skipSingleChoicePopup', 'autoAdvance', 'videoAutoPlay', 'hideCharacterTags', 'hideSceneTags', 'dialogueBackgroundType', 'dialogueBackgroundColor', 'dialogueBackgroundGradientStart', 'dialogueBackgroundGradientEnd', 'dialogueBackgroundGradientAngle', 'dialogueBackgroundGradientShape', 'dialogueBackgroundGradientStops', 'dialogueBackgroundImageUrl', 'dialogueBackgroundVideoUrl', 'dialogueBackgroundVideoLoop', 'dialogueBackgroundVideoMuted', 'dialogueBackgroundVideoFit', 'previewToolbarElements', 'dialogueOverlayElements'],
    };
    const settings = scope === 'all'
      ? fullSettings
      : Object.fromEntries(surfaceKeys[currentPreviewSurface].map((key) => [key, fullSettings[key]]));
    return {
      version: 2,
      settings,
      renderStyle: scope === 'all' || currentPreviewSurface === 'game' ? webRenderStyle : undefined,
      choiceColor: webChoiceColor,
      choiceTextColor: webChoiceTextColor,
    };
  };
  const compactSavedTemplate = (template: SavedWebExperienceTemplate): SavedWebExperienceTemplate => {
    const settings = template.settings;
    if (!settings) return template;
    const clearDataUrl = (value?: string) => value?.startsWith('data:') ? '' : value;
    const compactElements = (elements?: WebMenuElement[]) => elements?.map((element) => ({
      ...element,
      imageUrl: clearDataUrl(element.imageUrl),
      backgroundImageUrl: clearDataUrl(element.backgroundImageUrl),
    }));
    return stripEmbeddedDataUrls({
      ...template,
      settings: {
        ...settings,
        startMenuBackgroundImageUrl: clearDataUrl(settings.startMenuBackgroundImageUrl),
        startMenuBackgroundVideoUrl: clearDataUrl(settings.startMenuBackgroundVideoUrl),
        startMenuBackgroundMusicUrl: clearDataUrl(settings.startMenuBackgroundMusicUrl),
        archiveBackgroundImageUrl: clearDataUrl(settings.archiveBackgroundImageUrl),
        archiveBackgroundVideoUrl: clearDataUrl(settings.archiveBackgroundVideoUrl),
        settingsBackgroundImageUrl: clearDataUrl(settings.settingsBackgroundImageUrl),
        settingsBackgroundVideoUrl: clearDataUrl(settings.settingsBackgroundVideoUrl),
        dialogueBackgroundImageUrl: clearDataUrl(settings.dialogueBackgroundImageUrl),
        dialogueBackgroundVideoUrl: clearDataUrl(settings.dialogueBackgroundVideoUrl),
        sceneBackgroundImageUrl: clearDataUrl(settings.sceneBackgroundImageUrl),
        startMenuElements: compactElements(settings.startMenuElements),
        archivePageElements: compactElements(settings.archivePageElements),
        settingsPageElements: compactElements(settings.settingsPageElements),
        previewToolbarElements: compactElements(settings.previewToolbarElements),
        dialogueOverlayElements: compactElements(settings.dialogueOverlayElements),
      },
    });
  };
  const saveStartMenuDesign = (name: string, scope = templateSaveScope) => {
    if (typeof window === 'undefined') return;
    const selected = savedTemplateLibrary.find((item) => item.id === selectedSavedTemplateId);
    if (!name) return;
    const entry: SavedWebExperienceTemplate = {
      // Templates are stored in localStorage. Keep their layout and styling, but
      // never include embedded image/video/audio data; otherwise one uploaded
      // asset can exceed the storage quota and make every save appear to fail.
      ...createStartMenuDesignSnapshot(scope, true),
      id: selected?.id || `template-${Date.now()}`,
      name,
      savedAt: Date.now(),
      scope,
      surface: scope === 'current' ? currentPreviewSurface : undefined,
    };
    const next = [entry, ...savedTemplateLibrary.filter((item) => item.id !== entry.id)]
      .map(compactSavedTemplate)
      .slice(0, 24);
    try {
      window.localStorage.setItem(webTemplateLibraryStorageKey, JSON.stringify(next));
      setSavedTemplateLibrary(next);
      setSelectedSavedTemplateId(entry.id);
    } catch {
      try {
        const compactNext = next.slice(0, 8);
        try {
          window.localStorage.setItem(webTemplateLibraryStorageKey, JSON.stringify(compactNext));
          setSavedTemplateLibrary(compactNext);
        } catch {
          try {
            window.localStorage.removeItem(webTemplateLibraryStorageKey);
            window.localStorage.setItem(webTemplateLibraryStorageKey, JSON.stringify(compactNext));
            setSavedTemplateLibrary(compactNext);
          } catch {
            // Keep the newly saved template usable for this session even when
            // the browser blocks localStorage entirely.
            setSavedTemplateLibrary(next);
          }
        }
        setSelectedSavedTemplateId(entry.id);
      } catch { setSavedTemplateLibrary(next); setSelectedSavedTemplateId(entry.id); }
    }
  };
  const persistTemplateLibrary = (next: SavedWebExperienceTemplate[]) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(webTemplateLibraryStorageKey, JSON.stringify(next));
      setSavedTemplateLibrary(next);
    } catch {
      // Keep the current library untouched when local storage is unavailable.
    }
  };
  const duplicateSavedTemplate = (templateId: string) => {
    const source = savedTemplateLibrary.find((item) => item.id === templateId);
    if (!source) return;
    const copy: SavedWebExperienceTemplate = {
      ...source,
      id: `template-${Date.now()}`,
      name: `${source.name} ${t('副本', 'コピー', 'copy')}`,
      savedAt: Date.now(),
    };
    persistTemplateLibrary([copy, ...savedTemplateLibrary]);
    setSelectedSavedTemplateId(copy.id);
  };
  const deleteSavedTemplate = (templateId: string) => {
    const next = savedTemplateLibrary.filter((item) => item.id !== templateId);
    persistTemplateLibrary(next);
    if (selectedSavedTemplateId === templateId) setSelectedSavedTemplateId(null);
  };
  const toggleTemplateEditSelection = (templateId: string) => {
    setSelectedTemplateEditIds((ids) =>
      ids.includes(templateId) ? ids.filter((id) => id !== templateId) : [...ids, templateId],
    );
  };
  const saveSelectedTemplates = () => {
    if (selectedTemplateEditIds.length === 0) return;
    const next = savedTemplateLibrary.map((template) => {
      if (!selectedTemplateEditIds.includes(template.id)) return template;
      const scope = template.scope || 'all';
      return {
        ...template,
        ...createStartMenuDesignSnapshot(scope),
        savedAt: Date.now(),
        scope,
        surface: scope === 'current' ? template.surface || currentPreviewSurface : undefined,
      };
    });
    persistTemplateLibrary(next);
  };
  const deleteSelectedTemplates = () => {
    if (selectedTemplateEditIds.length === 0) return;
    const selected = new Set(selectedTemplateEditIds);
    persistTemplateLibrary(savedTemplateLibrary.filter((template) => !selected.has(template.id)));
    if (selectedSavedTemplateId && selected.has(selectedSavedTemplateId)) setSelectedSavedTemplateId(null);
    setSelectedTemplateEditIds([]);
  };
  const loadStartMenuDesign = (templateId = selectedSavedTemplateId) => {
    if (typeof window === 'undefined') return;
    try {
      const selected = savedTemplateLibrary.find((item) => item.id === templateId);
      if (!selected) return;
      const parsed = selected as Partial<WebExportSettings> | WebExperienceSnapshot;
      const isExperienceSnapshot =
        typeof parsed === 'object' &&
        parsed !== null &&
        ('settings' in parsed ||
          'renderStyle' in parsed ||
          'choiceColor' in parsed ||
          'choiceTextColor' in parsed);
      const snapshot = isExperienceSnapshot ? (parsed as WebExperienceSnapshot) : null;
      const settingsPatch = snapshot ? snapshot.settings : (parsed as Partial<WebExportSettings>);
      if (settingsPatch) updateWebSettingsBulk(settingsPatch);
      if (snapshot?.renderStyle) {
        Object.entries(snapshot.renderStyle).forEach(([key, value]) => {
          updateWebRenderStyle(key as keyof RenderStyle, value as never);
        });
      }
      if (snapshot?.choiceColor) updateWebChoiceColor(snapshot.choiceColor);
      if (snapshot?.choiceTextColor) {
        updateWebChoiceTextColor(snapshot.choiceTextColor);
      }
    } catch {
      // Ignore invalid local design presets.
    }
  };
  const [showSettingDescriptions, setShowSettingDescriptions] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = window.localStorage.getItem('galwriter-web-export-setting-descriptions');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [startMenuPreviewMode, setStartMenuPreviewMode] = useState<'edit' | 'test'>('edit');
  const [designPanelMode, setDesignPanelMode] = useState<'background' | 'preset'>('background');
  const [currentPreviewSurface, setCurrentPreviewSurface] = useState<WebPreviewSurface>(
    webSettings.showStartMenu ? 'start' : 'game',
  );
  const [dialogueSelection, setDialogueSelection] = useState<
    'scene' | 'background' | import('../video/shared/types').RenderEditableObjectKind
  >(
    webRenderStyle.selectedRenderObject ||
      (webSettings.layoutMode === 'classic' ? 'scene' : 'dialogBox'),
  );
  useEffect(() => {
    if (webRenderStyle.selectedRenderObject)
      setDialogueSelection(webRenderStyle.selectedRenderObject);
  }, [webRenderStyle.selectedRenderObject]);
  const [editPreviewSurface, setEditPreviewSurface] = useState<WebPreviewSurface>('start');
  const [selectedStartMenuElementId, setSelectedStartMenuElementId] = useState<string | null>(null);
  const [selectedPreviewElementIds, setSelectedPreviewElementIds] = useState<string[]>([]);
  const [imageCropEditingElementId, setImageCropEditingElementId] = useState<string | null>(null);
  const [gradientEditingElement, setGradientEditingElement] = useState<{
    id: string;
    group: 'text' | 'fill' | 'stroke';
  } | null>(null);
  useEffect(() => {
    if (selectedStartMenuElementId) setDesignPanelMode('background');
  }, [selectedStartMenuElementId]);
  const [gradientEditingSurface, setGradientEditingSurface] = useState<WebPreviewSurface | null>(
    null,
  );
  useEffect(() => {
    if (webSettings.showStartMenu) return;
    setEditPreviewSurface('game');
    setCurrentPreviewSurface('game');
    setSelectedStartMenuElementId(null);
    setSelectedPreviewElementIds([]);
  }, [webSettings.showStartMenu]);
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
  const webExperiencePresets = useMemo(
    () =>
      buildWebExperiencePresets({
        language,
        title: webProjectName || t('开始', 'スタート', 'Start'),
        subtitle: t('没有存档', 'セーブなし', 'No save'),
        save: t('存档', 'セーブ', 'Save'),
        newGame: t('新游戏', '新規ゲーム', 'New Game'),
        settings: t('设置', '設定', 'Settings'),
        archiveTitle: t('存档', 'セーブ', 'Save'),
        archiveBack: t('返回', '戻る', 'Back'),
        archiveSlot: t(
          '没有存档\n导出后的网页会在这里显示上次进度。',
          'セーブなし\n書き出し後のWebでは前回の進行がここに表示されます。',
          'No save\nExported web builds show the last progress here.',
        ),
        archiveNew: t('新游戏', '新規ゲーム', 'New Game'),
        settingsTitle: t('设置', '設定', 'Settings'),
        settingsBack: t('返回', '戻る', 'Back'),
        settingsAuto: t('自动播放', '自動再生', 'Auto play'),
        settingsSpeed: t('打字速度', 'テキスト速度', 'Text speed'),
        settingsControls: t('显示控制栏', '操作表示', 'Show controls'),
      }),
    [language, webProjectName, webChoiceColor, webChoiceTextColor],
  );
  const activeElementSettingsKey:
    | 'startMenuElements'
    | 'archivePageElements'
    | 'settingsPageElements'
    | 'previewToolbarElements' =
    currentPreviewSurface === 'archive'
      ? 'archivePageElements'
      : currentPreviewSurface === 'settings'
        ? 'settingsPageElements'
        : currentPreviewSurface === 'game'
          ? 'previewToolbarElements'
          : 'startMenuElements';
  const activePageElements =
    activeElementSettingsKey === 'archivePageElements'
      ? archivePageElements
      : activeElementSettingsKey === 'settingsPageElements'
        ? settingsPageElements
        : activeElementSettingsKey === 'previewToolbarElements'
          ? [
              ...(webSettings.previewToolbarElements || []),
              ...(webSettings.dialogueOverlayElements || []),
            ]
          : webSettings.startMenuElements || [];
  const selectedStartMenuElement =
    activePageElements.find((element) => element.id === selectedStartMenuElementId) || null;
  const handleGradientEditingChange = useCallback(
    (group: 'text' | 'fill' | 'stroke' | null) => {
      const next = group && selectedStartMenuElementId ? { id: selectedStartMenuElementId, group } : null;
      setGradientEditingElement((current) =>
        current?.id === next?.id && current?.group === next?.group ? current : next,
      );
    },
    [selectedStartMenuElementId],
  );
  const applyWebExperiencePreset = (presetId: string) => {
    const preset = webExperiencePresets.find((item) => item.id === presetId);
    if (!preset) return;
    // A preset is a complete web experience. Applying it from Archive, Settings,
    // or Dialogue must update the same shared settings as applying it from Start.
    updateWebSettingsBulk(preset.settings);
    if (preset.renderStyle) {
      Object.entries(preset.renderStyle).forEach(([key, value]) => {
        updateWebRenderStyle(key as keyof RenderStyle, value as never);
      });
    }
    if (preset.choiceColor) updateWebChoiceColor(preset.choiceColor);
    if (preset.choiceTextColor) updateWebChoiceTextColor(preset.choiceTextColor);
    setSelectedStartMenuElementId(null);
    setDesignPanelMode('background');
    setPreviewRefreshKey((key) => key + 1);
  };
  const applyRehearsalTemplate = () => {
    const template = buildRehearsalTemplate(
      language,
      webProjectName || t('开始', 'スタート', 'Start'),
    );
    updateWebSettingsBulk(template.settings);
    Object.entries(template.renderStyle).forEach(([key, value]) => {
      updateWebRenderStyle(key as keyof RenderStyle, value as never);
    });
    updateWebChoiceColor(template.choiceColor);
    updateWebChoiceTextColor(template.choiceTextColor);
    setSelectedStartMenuElementId(null);
    setPreviewRefreshKey((key) => key + 1);
  };
  const updateActivePageElement = (id: string, patch: Partial<WebMenuElement>) => {
    if (currentPreviewSurface === 'game') {
      const toolbar = webSettings.previewToolbarElements || [];
      const dialogue = webSettings.dialogueOverlayElements || [];
      if (toolbar.some((element) => element.id === id)) {
        updateWebSettings(
          'previewToolbarElements',
          toolbar.map((element) => (element.id === id ? { ...element, ...patch } : element)),
        );
        return;
      }
      if (dialogue.some((element) => element.id === id)) {
        updateWebSettings(
          'dialogueOverlayElements',
          dialogue.map((element) => (element.id === id ? { ...element, ...patch } : element)),
        );
        return;
      }
    }
    const source = activePageElements;
    updateWebSettings(
      activeElementSettingsKey,
      source.map((element) => (element.id === id ? { ...element, ...patch } : element)),
    );
  };
  const deleteStartMenuElement = (id: string) => {
    updateWebSettings(
      'startMenuElements',
      (webSettings.startMenuElements || []).filter((element) => element.id !== id),
    );
    setSelectedStartMenuElementId(null);
  };
  const updateSelectedPageElement = (patch: Partial<WebMenuElement>) => {
    if (!selectedStartMenuElement) return;
    updateActivePageElement(selectedStartMenuElement.id, patch);
  };
  const alignSelectedPageElements = (axis: 'x' | 'y', value: 'start' | 'center' | 'end') => {
    const selectedIds = selectedPreviewElementIds;
    if (selectedIds.length < 2) return;
    const selectedIdSet = new Set(selectedIds);
    const patchAlignment = (element: WebMenuElement): Partial<WebMenuElement> => {
      if (axis === 'x') {
        return {
          x:
            value === 'start'
              ? 0
              : value === 'center'
                ? (100 - element.width) / 2
                : 100 - element.width,
        };
      }
      return {
        y:
          value === 'start'
            ? 0
            : value === 'center'
              ? (100 - element.height) / 2
              : 100 - element.height,
      };
    };
    const applyAlignment = (elements: WebMenuElement[]) =>
      elements.map((element) =>
        selectedIdSet.has(element.id) ? { ...element, ...patchAlignment(element) } : element,
      );

    if (currentPreviewSurface === 'game') {
      const toolbar = webSettings.previewToolbarElements || [];
      const dialogue = webSettings.dialogueOverlayElements || [];
      updateWebSettings('previewToolbarElements', applyAlignment(toolbar));
      updateWebSettings('dialogueOverlayElements', applyAlignment(dialogue));
      return;
    }
    updateWebSettings(activeElementSettingsKey, applyAlignment(activePageElements));
  };
  const surfaceMeta = {
    start: {
      icon: LayoutTemplate,
      title: t('菜单设计', 'メニュー設計', 'Menu design'),
      backgroundSurface: 'start' as const,
    },
    archive: {
      icon: Save,
      title: t('存档页设计', 'セーブ画面設計', 'Save design'),
      backgroundSurface: 'archive' as const,
    },
    settings: {
      icon: Settings,
      title: t('设置页设计', '設定画面設計', 'Settings design'),
      backgroundSurface: 'settings' as const,
    },
    game: {
      icon: Palette,
      title: t('对话设计', 'ダイアログ設計', 'Dialog design'),
      backgroundSurface: 'game' as const,
    },
  } satisfies Record<
    WebPreviewSurface,
    {
      icon: LucideIcon;
      title: string;
      backgroundSurface: 'start' | 'archive' | 'settings' | 'game';
    }
  >;
  const currentSurfaceMeta = surfaceMeta[currentPreviewSurface];
  const surfaceInspector = (
    <WebSurfaceInspectorPanel>
      {selectedStartMenuElement ? (
        <StartMenuElementInspector
          element={selectedStartMenuElement}
          language={language}
          surface={currentPreviewSurface}
          selectedElementIds={selectedPreviewElementIds}
          showDescriptions={showSettingDescriptions}
          onUpdate={updateSelectedPageElement}
          onAlignSelected={alignSelectedPageElements}
          onImageCropEditingChange={setImageCropEditingElementId}
          onGradientEditingChange={handleGradientEditingChange}
        />
      ) : currentPreviewSurface === 'game' &&
        dialogueSelection !== 'background' &&
        (webRenderStyle.selectedRenderObject || webSettings.layoutMode === 'classic') ? (
        <RenderObjectSettingsSection
          language={language}
          renderStyle={webRenderStyle}
          updateRenderStyle={updateWebRenderStyle}
          surface="web"
          showDescriptions={false}
          canvasSettings={normalizeSharedCanvasSettings(webSettings)}
          onCanvasSettingsChange={updateWebSettingsBulk}
          selection={dialogueSelection}
          onSelectionChange={setDialogueSelection}
        />
      ) : (
        <StartMenuBackgroundInspector
          settings={webSettings}
          language={language}
          showDescriptions={showSettingDescriptions}
          surface={currentSurfaceMeta.backgroundSurface}
          updateWebSettings={updateWebSettings}
          onGradientEditingChange={setGradientEditingSurface}
        />
      )}
    </WebSurfaceInspectorPanel>
  );
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
        fontWeight: 500,
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
  const addDialogueOverlayText = () => {
    const id = `dialogue-text-${Date.now()}`;
    updateWebSettings('dialogueOverlayElements', [
      ...(webSettings.dialogueOverlayElements || []),
      {
        id,
        kind: 'text',
        role: 'custom',
        text: 'Text',
        visible: true,
        x: 18,
        y: 62,
        width: 24,
        height: 7,
        scale: 1,
        rotation: 0,
        fontSize: 20,
        fontWeight: 500,
        textColor: '#ffffff',
        borderRadius: 0,
      },
    ]);
    setSelectedStartMenuElementId(id);
  };
  const addDialogueOverlayImage = () => {
    const id = `dialogue-image-${Date.now()}`;
    updateWebSettings('dialogueOverlayElements', [
      ...(webSettings.dialogueOverlayElements || []),
      {
        id,
        kind: 'image',
        role: 'custom',
        text: '',
        visible: true,
        x: 64,
        y: 58,
        width: 18,
        height: 18,
        scale: 1,
        rotation: 0,
        imageUrl: '',
        borderRadius: 12,
      },
    ]);
    setSelectedStartMenuElementId(id);
  };
  const addCurrentSurfaceText = () => {
    if (currentPreviewSurface === 'start') {
      addStartMenuText();
      return;
    }
    if (currentPreviewSurface === 'game') {
      addDialogueOverlayText();
      return;
    }
    const id = `${currentPreviewSurface}-text-${Date.now()}`;
    const key =
      currentPreviewSurface === 'archive' ? 'archivePageElements' : 'settingsPageElements';
    const source = currentPreviewSurface === 'archive' ? archivePageElements : settingsPageElements;
    updateWebSettings(key, [
      ...source,
      {
        id,
        kind: 'text',
        role: 'custom',
        text: '',
        visible: true,
        x: 18,
        y: 24,
        width: 26,
        height: 7,
        scale: 1,
        rotation: 0,
        fontSize: 18,
        fontWeight: 600,
        textColor: '#ffffff',
        borderRadius: 0,
      },
    ]);
    setSelectedStartMenuElementId(id);
  };
  const addCurrentSurfaceImage = () => {
    if (currentPreviewSurface === 'start') {
      addStartMenuImage();
      return;
    }
    if (currentPreviewSurface === 'game') {
      addDialogueOverlayImage();
      return;
    }
    const id = `${currentPreviewSurface}-image-${Date.now()}`;
    const key =
      currentPreviewSurface === 'archive' ? 'archivePageElements' : 'settingsPageElements';
    const source = currentPreviewSurface === 'archive' ? archivePageElements : settingsPageElements;
    updateWebSettings(key, [
      ...source,
      {
        id,
        kind: 'image',
        role: 'custom',
        text: '',
        visible: true,
        x: 58,
        y: 24,
        width: 18,
        height: 18,
        scale: 1,
        rotation: 0,
        imageUrl: '',
        borderRadius: 12,
      },
    ]);
    setSelectedStartMenuElementId(id);
  };
  const addCurrentSurfaceButton = () => {
    const id = `${currentPreviewSurface}-button-${Date.now()}`;
    const button: WebMenuElement = {
      id,
      kind: 'button',
      role: 'custom',
      text: t('按钮', 'ボタン', 'Button'),
      visible: true,
      x: 38,
      y: 48,
      width: 24,
      height: 8,
      scale: 1,
      rotation: 0,
      fontSize: 16,
      fontWeight: 700,
      textColor: '#ffffff',
      backgroundType: 'solid',
      backgroundColor: '#4f46e5',
      borderRadius: 12,
    };
    if (currentPreviewSurface === 'start') {
      updateWebSettings('startMenuElements', [...(webSettings.startMenuElements || []), button]);
    } else if (currentPreviewSurface === 'game') {
      updateWebSettings('previewToolbarElements', [
        ...(webSettings.previewToolbarElements || []),
        { ...button, x: 76, y: 12, width: 14, height: 5.6, fontSize: 12 },
      ]);
    } else {
      const key =
        currentPreviewSurface === 'archive' ? 'archivePageElements' : 'settingsPageElements';
      const source =
        currentPreviewSurface === 'archive' ? archivePageElements : settingsPageElements;
      updateWebSettings(key, [...source, button]);
    }
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
              borderColor: '#ffffff3d',
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
              backgroundColor: '#ffffff1a',
              borderColor: '#ffffff29',
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
              backgroundColor: '#ffffff1a',
              borderColor: '#ffffff29',
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
              base.backgroundColor || '#ffffff1a',
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
            borderColor: safeColor(element.borderColor, base.borderColor || '#ffffff2e'),
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

  const designPanelSwitcherLayout = {
    start: { pointer: 'left-[12.5%]', alignment: 'justify-start' },
    archive: { pointer: 'left-[37.5%]', alignment: 'justify-start pl-[24%]' },
    settings: { pointer: 'left-[62.5%]', alignment: 'justify-start pl-[45%]' },
    game: { pointer: 'left-[87.5%]', alignment: 'justify-end' },
  }[editPreviewSurface];

  return (
    <main className="min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(300px,380px)] bg-[var(--vr-bg)]">
      <section className="min-h-0 min-w-0 bg-[var(--vr-surface-soft)] flex flex-col">
        <div className="grid h-12 grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--vr-border)] px-4">
          <div className="flex min-w-0 items-center gap-2 text-xs font-black tracking-wide text-[var(--vr-text-soft)]">
            <Play className="w-4 h-4 text-[var(--vr-accent)]" />
            <span className="truncate">测试预览窗口</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {startMenuPreviewMode === 'edit' && (
              <>
                <IconToolButton
                  icon={Type}
                  label={t('添加文字', 'テキスト追加', 'Add text')}
                  onClick={addCurrentSurfaceText}
                />
                <IconToolButton
                  icon={ImagePlus}
                  label={t('添加图片', '画像追加', 'Add image')}
                  onClick={addCurrentSurfaceImage}
                />
                <IconToolButton
                  icon={MousePointerClick}
                  label={t('添加按钮', 'ボタン追加', 'Add button')}
                  onClick={addCurrentSurfaceButton}
                />
              </>
            )}
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
          <VirtualPresentationStage
            className="h-full w-full"
            width={webSettings.canvasWidth}
            height={webSettings.canvasHeight}
          >
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
              imageCropEditingElementId={imageCropEditingElementId}
              gradientEditingSurface={gradientEditingSurface}
              gradientEditingElement={gradientEditingElement}
              onSurfaceChange={setCurrentPreviewSurface}
              onSelectStartMenuElement={(id) => {
                setSelectedStartMenuElementId(id);
                setSelectedPreviewElementIds(id ? [id] : []);
                if (id) setDialogueSelection('background');
              }}
              onSelectStartMenuElements={setSelectedPreviewElementIds}
              onDeleteStartMenuElement={deleteStartMenuElement}
              onUpdateSettings={updateWebSettings}
              onUpdateRenderStyle={updateWebRenderStyle}
              selectedCanvasObject={
                dialogueSelection === 'scene' || dialogueSelection === 'background'
                  ? dialogueSelection
                  : undefined
              }
              onSelectCanvasObject={setDialogueSelection}
            />
          </VirtualPresentationStage>
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

        <div className="video-render-scroll web-workspace-inspector-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {startMenuPreviewMode === 'edit' && (
            <div className="sticky -top-4 z-30 -mx-4 -mt-4 bg-transparent px-4 py-3">
              <WebSettingCard>
                <WebSegmentedGroup
                  value={editPreviewSurface}
                  options={[
                    {
                      value: 'start',
                      label: t('主界面', 'メイン', 'Menu'),
                      disabled: !webSettings.showStartMenu,
                    },
                    {
                      value: 'archive',
                      label: t('存档', 'セーブ', 'Save'),
                      disabled: !webSettings.showStartMenu,
                    },
                    {
                      value: 'settings',
                      label: t('设置', '設定', 'Settings'),
                      disabled: !webSettings.showStartMenu,
                    },
                    { value: 'game', label: t('对话', '会話', 'Dialog') },
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
              {!selectedStartMenuElementId && <div className="relative mt-3 h-10">
                <span
                  aria-hidden="true"
                  className={`absolute ${designPanelSwitcherLayout.pointer} top-[-7px] z-20 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-l border-t border-[var(--vr-border)] bg-white`}
                />
                <div className={`relative flex ${designPanelSwitcherLayout.alignment}`}>
                  <div className="flex overflow-hidden rounded-xl border border-[var(--vr-border)] bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setDesignPanelMode('background')}
                      className={`relative z-30 h-8 rounded-lg px-3 text-[11px] font-black transition-colors ${designPanelMode === 'background' ? 'bg-[var(--vr-accent)] text-white shadow-sm' : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'}`}
                    >
                      {t('背景样式', '背景スタイル', 'Background')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDesignPanelMode('preset')}
                      className={`relative z-30 h-8 rounded-lg px-3 text-[11px] font-black transition-colors ${designPanelMode === 'preset' ? 'bg-[var(--vr-accent)] text-white shadow-sm' : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'}`}
                    >
                      {t('预设', 'プリセット', 'Preset')}
                    </button>
                  </div>
                </div>
              </div>}
            </div>
          )}
          {designPanelMode === 'preset' && (
            <>
              <WebAuxiliaryPanel>
                <div className="grid gap-2 rounded-xl bg-indigo-500/5 p-2">
                  {false && <IconToolButton
                    icon={LayoutTemplate}
                    label={t('应用排练模板', 'リハーサルを適用', 'Apply rehearsal')}
                    onClick={applyRehearsalTemplate}
                  />}
                  <div className="grid gap-2">
                    {webExperiencePresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyWebExperiencePreset(preset.id)}
                        className="grid gap-1 rounded-lg border border-transparent bg-[var(--vr-surface-soft)] p-2 text-left transition-colors hover:border-indigo-500/25 hover:bg-white/5"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-[11px] font-black text-[var(--vr-text)]">
                            {preset.name}
                          </span>
                          <TemplateMiniPreview settings={preset.settings} accent={preset.accent} surface={currentPreviewSurface} />
                        </span>
                        <span className="line-clamp-2 text-[10px] font-bold leading-4 text-[var(--vr-text-muted)]">
                          {preset.description}
                        </span>
                      </button>
                    ))}
                    {savedTemplateLibrary.map((template) => isTemplateEditing ? (
                      <label key={template.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors ${selectedTemplateEditIds.includes(template.id) ? 'border-indigo-500 bg-indigo-500/10' : 'border-indigo-500/15 bg-[var(--vr-surface-soft)]'}`}>
                        <input type="checkbox" checked={selectedTemplateEditIds.includes(template.id)} onChange={() => toggleTemplateEditSelection(template.id)} className="h-3.5 w-3.5 accent-[var(--vr-accent)]" aria-label={template.name} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-black text-[var(--vr-text)]">{template.name}</span><TemplateMiniPreview settings={template.settings || {}} accent={template.choiceColor || 'var(--vr-accent)'} surface={currentPreviewSurface} /></span>
                          <span className="block text-[10px] font-bold leading-4 text-[var(--vr-text-muted)]">{template.scope === 'current' ? t('当前页面模板', '現在のページ用テンプレート', 'Current-page template') : t('所有页面模板', '全ページ用テンプレート', 'All-pages template')}</span>
                        </span>
                      </label>
                    ) : (
                      <button key={template.id} type="button" onClick={() => { setSelectedSavedTemplateId(template.id); loadStartMenuDesign(template.id); }} className={`grid gap-1 rounded-lg border p-2 text-left transition-colors hover:border-indigo-500/35 hover:bg-white/5 ${selectedSavedTemplateId === template.id ? 'border-indigo-500/45 bg-indigo-500/10' : 'border-indigo-500/15 bg-[var(--vr-surface-soft)]'}`} title={t('应用此模板', 'このテンプレートを適用', 'Apply this template')}>
                        <span className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-[11px] font-black text-[var(--vr-text)]">{template.name}</span><TemplateMiniPreview settings={template.settings || {}} accent={template.choiceColor || 'var(--vr-accent)'} surface={currentPreviewSurface} /></span>
                        <span className="text-[10px] font-bold leading-4 text-[var(--vr-text-muted)]">{template.scope === 'current' ? t('当前页面模板', '現在のページ用テンプレート', 'Current-page template') : t('所有页面模板', '全ページ用テンプレート', 'All-pages template')}</span>
                      </button>
                    ))}
                  </div>
                  {isTemplateEditing && (
                    <div className="grid grid-cols-2 gap-2">
                      <IconToolButton icon={Save} label={t('保存至所选', '選択へ保存', 'Save to selected')} onClick={saveSelectedTemplates} disabled={selectedTemplateEditIds.length === 0} />
                      <IconToolButton icon={Trash2} label={t('删除所选', '選択を削除', 'Delete selected')} onClick={deleteSelectedTemplates} disabled={selectedTemplateEditIds.length === 0} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <IconToolButton
                      icon={Save}
                      label={t('保存模板', 'テンプレートを保存', 'Save template')}
                      onClick={() => {
                        setSelectedSavedTemplateId(null);
                        setTemplateNameDraft(t('我的模板', 'マイテンプレート', 'My template'));
                        setTemplateSaveScope('current');
                        setIsSaveTemplateDialogOpen(true);
                      }}
                    />
                    <IconToolButton
                      icon={Settings}
                      label={isTemplateEditing ? t('完成编辑', '編集を完了', 'Done editing') : t('编辑模板', 'テンプレートを編集', 'Edit templates')}
                      onClick={() => { setIsTemplateEditing((editing) => !editing); setSelectedTemplateEditIds([]); }}
                      active={isTemplateEditing}
                    />
                  </div>
                  {false && savedTemplateLibrary.length > 0 && (
                    <select
                      value={selectedSavedTemplateId || ''}
                      onChange={(event) => setSelectedSavedTemplateId(event.target.value || null)}
                      className="h-8 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-2 text-[11px] font-bold text-[var(--vr-text)]"
                    >
                      <option value="">
                        {t(
                          '选择已保存模板',
                          '保存済みテンプレートを選択',
                          'Choose a saved template',
                        )}
                      </option>
                      {savedTemplateLibrary.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {aiStartMenuDesignError && (
                  <div className="rounded-md bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-500 dark:text-rose-300">
                    {aiStartMenuDesignError}
                  </div>
                )}
              </WebAuxiliaryPanel>
              {isSaveTemplateDialogOpen && (
                <div className="fixed inset-0 z-[10060] grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setIsSaveTemplateDialogOpen(false)}>
                  <div className="w-full max-w-sm rounded-2xl border border-indigo-100 bg-white p-4 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
                    <div className="text-sm font-black text-slate-950">{t('保存当前方案', '現在のプランを保存', 'Save current design')}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{t('保存后可从模板列表再次应用。', '保存後、テンプレート一覧から再適用できます。', 'Saved templates can be applied again from this list.')}</div>
                    <input value={templateNameDraft} onChange={(event) => setTemplateNameDraft(event.target.value)} autoFocus className="mt-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500" />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border text-xs font-bold ${templateSaveScope === 'current' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}><input type="radio" name="template-save-scope" checked={templateSaveScope === 'current'} onChange={() => setTemplateSaveScope('current')} className="accent-indigo-600" />{t('保存当前页面', '現在のページを保存', 'Save current page')}</label>
                      <label className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border text-xs font-bold ${templateSaveScope === 'all' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}><input type="radio" name="template-save-scope" checked={templateSaveScope === 'all'} onChange={() => setTemplateSaveScope('all')} className="accent-indigo-600" />{t('保存所有页面', '全ページを保存', 'Save all pages')}</label>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setIsSaveTemplateDialogOpen(false)} className="h-10 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">{t('取消', 'キャンセル', 'Cancel')}</button>
                      <button type="button" onClick={() => { const name = templateNameDraft.trim(); if (!name) return; saveStartMenuDesign(name); setIsSaveTemplateDialogOpen(false); }} className="h-10 rounded-xl bg-indigo-600 text-xs font-bold text-white">{t('保存模板', 'テンプレートを保存', 'Save template')}</button>
                    </div>
                  </div>
                </div>
              )}
              {isTemplateLibraryOpen && (
                <div className="fixed inset-0 z-[10060] grid place-items-center bg-slate-950/40 p-4" onMouseDown={() => setIsTemplateLibraryOpen(false)}>
                  <div className="w-full max-w-md rounded-2xl border border-indigo-100 bg-white p-4 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
                    <div className="text-sm font-black text-slate-950">{t('编辑已保存模板', '保存済みテンプレートを編集', 'Edit saved templates')}</div>
                    <div className="mt-1 text-xs text-slate-500">{t('可应用、复制或删除已保存的模板。', '保存済みテンプレートを適用、複製、削除できます。', 'Apply, duplicate, or delete saved templates.')}</div>
                    <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto">
                      {savedTemplateLibrary.length ? savedTemplateLibrary.map((template) => (
                        <div key={template.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2 text-slate-800">
                          <button type="button" onClick={() => { setSelectedSavedTemplateId(template.id); loadStartMenuDesign(template.id); setIsTemplateLibraryOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-bold hover:text-indigo-700" title={t('应用此模板', 'このテンプレートを適用', 'Apply this template')}>
                            <TemplateMiniPreview settings={template.settings || {}} accent={template.choiceColor || '#6366f1'} surface={currentPreviewSurface} />
                            <span className="min-w-0 truncate">{template.name}</span>
                          </button>
                          <button type="button" onClick={() => duplicateSavedTemplate(template.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-indigo-600" title={t('复制模板', 'テンプレートを複製', 'Duplicate template')} aria-label={t('复制模板', 'テンプレートを複製', 'Duplicate template')}><Copy className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => deleteSavedTemplate(template.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600" title={t('删除模板', 'テンプレートを削除', 'Delete template')} aria-label={t('删除模板', 'テンプレートを削除', 'Delete template')}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )) : <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">{t('还没有保存的模板。', '保存済みのテンプレートはありません。', 'No saved templates yet.')}</div>}
                    </div>
                    <button type="button" onClick={() => setIsTemplateLibraryOpen(false)} className="mt-3 h-10 w-full rounded-xl bg-slate-100 text-xs font-bold text-slate-700">{t('关闭', '閉じる', 'Close')}</button>
                  </div>
                </div>
              )}
            </>
          )}

          {designPanelMode === 'background' && currentPreviewSurface === 'start' && <>{surfaceInspector}</>}

          {designPanelMode === 'background' && currentPreviewSurface === 'settings' && (
            <>
              {surfaceInspector}
            </>
          )}

          {designPanelMode === 'background' && currentPreviewSurface === 'archive' && (
            <>
              {surfaceInspector}
            </>
          )}

          {designPanelMode === 'background' && currentPreviewSurface === 'game' && <>{surfaceInspector}</>}

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
  active = false,
  disabled = false,
  iconClassName = '',
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  iconClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 min-w-0 items-center justify-start gap-1 rounded-lg border px-2 text-left text-[11px] font-normal transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-indigo-500/35 bg-indigo-500/10 text-[var(--vr-text)]'
          : 'border-transparent bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:border-indigo-500/25 hover:bg-white/5 hover:text-[var(--vr-text)]'
      }`}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClassName}`} />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

type StartMenuElement = WebExportSettings['startMenuElements'][number];

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

function WebSurfaceInspectorPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--vr-surface-soft)]/70 p-2">{children}</div>
  );
}

function WebAuxiliaryPanel({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2">{children}</div>
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
  disabled?: boolean;
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
            disabled={option.disabled}
            className={`web-segment-button flex h-9 w-full min-w-0 items-center justify-center gap-1 border-0 px-1 text-[10px] font-black transition-colors ${
              option.disabled
                ? 'cursor-not-allowed bg-slate-100 text-slate-300 opacity-70 dark:bg-white/5 dark:text-white/25'
                : active
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
