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
  MousePointerClick,
  Palette,
  Play,
  RotateCw,
  Save,
  Settings,
  Sparkles,
  Type,
  Upload,
  Video,
  Volume2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { createElement, isValidElement, useEffect, useMemo, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { VirtualPresentationStage } from '../../VirtualPresentationStage';
import { DragSizeControl } from '../video/controls/RenderControls';
import { RenderObjectSettingsSection } from '../video/panels/render-object-settings-section';
import { renderCopy } from '../video/shared/renderCopy';
import type { RenderStyle, WebExportSettings, WebMenuElement } from '../video/shared/types';
import { StartMenuBackgroundInspector } from './StartMenuBackgroundInspector';
import { StartMenuElementInspector } from './StartMenuElementInspector';
import {
  buildWebExperiencePresets,
  pickPresetSettingsForScope,
  type WebPresetScope,
} from './webExperiencePresets';
import { WebMenuMusicPanel } from './WebMenuMusicPanel';
import { buildArchivePageElements, buildSettingsPageElements } from './webMenuPageElements';
import type { WebPreviewSurface } from './WebPlaytestPreview';
import { WebPlaytestPreview } from './WebPlaytestPreview';

const webSmallTabClass =
  'h-8 rounded-lg px-2 text-[11px] font-black text-[var(--vr-text-soft)] transition-colors hover:text-[var(--vr-text)]';
const webSmallTabActiveClass = `${webSmallTabClass} bg-indigo-600 text-white`;

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
  savedPath,
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
  const [showMenuMusicSettings, setShowMenuMusicSettings] = useState(false);
  const [presetScope, setPresetScope] = useState<WebPresetScope>('all');
  const startMenuDesignStorageKey = 'galwriter-web-start-menu-design:v1';
  const createStartMenuDesignSnapshot = (stripEmbeddedMedia = false) => {
    const stripElementMedia = (element: WebMenuElement): WebMenuElement => ({
      ...element,
      imageUrl: stripEmbeddedMedia && element.imageUrl?.startsWith('data:') ? '' : element.imageUrl,
      backgroundImageUrl:
        stripEmbeddedMedia && element.backgroundImageUrl?.startsWith('data:')
          ? ''
          : element.backgroundImageUrl,
    });
    return {
      version: 2,
      settings: {
        ...webSettings,
        startMenuBackgroundImageUrl:
          stripEmbeddedMedia && webSettings.startMenuBackgroundImageUrl.startsWith('data:')
            ? ''
            : webSettings.startMenuBackgroundImageUrl,
        startMenuBackgroundMusicUrl:
          stripEmbeddedMedia && webSettings.startMenuBackgroundMusicUrl.startsWith('data:')
            ? ''
            : webSettings.startMenuBackgroundMusicUrl,
        startMenuElements: webSettings.startMenuElements.map(stripElementMedia),
        archivePageElements: (webSettings.archivePageElements || []).map(stripElementMedia),
        settingsPageElements: (webSettings.settingsPageElements || []).map(stripElementMedia),
        previewToolbarElements: (webSettings.previewToolbarElements || []).map(stripElementMedia),
        dialogueOverlayElements: (webSettings.dialogueOverlayElements || []).map(stripElementMedia),
      },
      renderStyle: webRenderStyle,
      choiceColor: webChoiceColor,
      choiceTextColor: webChoiceTextColor,
    };
  };
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
      const parsed = JSON.parse(raw) as Partial<WebExportSettings> | WebExperienceSnapshot;
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
  const [selectedPreviewElementIds, setSelectedPreviewElementIds] = useState<string[]>([]);
  const [imageCropEditingElementId, setImageCropEditingElementId] = useState<string | null>(null);
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
  const applyWebExperiencePreset = (presetId: string) => {
    const preset = webExperiencePresets.find((item) => item.id === presetId);
    if (!preset) return;
    updateWebSettingsBulk(pickPresetSettingsForScope(preset, currentPreviewSurface, presetScope));
    if (presetScope === 'all' || currentPreviewSurface === 'game') {
      if (preset.renderStyle) {
        Object.entries(preset.renderStyle).forEach(([key, value]) => {
          updateWebRenderStyle(key as keyof RenderStyle, value as never);
        });
      }
      if (preset.choiceColor) updateWebChoiceColor(preset.choiceColor);
      if (preset.choiceTextColor) updateWebChoiceTextColor(preset.choiceTextColor);
    }
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
  const alignSelectedPageElements = (
    axis: 'x' | 'y',
    value: 'start' | 'center' | 'end',
  ) => {
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
    start: { icon: LayoutTemplate, title: t('菜单设计', 'メニュー設計', 'Menu design'), backgroundSurface: 'start' as const },
    archive: { icon: Save, title: t('存档页设计', 'セーブ画面設計', 'Save design'), backgroundSurface: 'archive' as const },
    settings: { icon: Settings, title: t('设置页设计', '設定画面設計', 'Settings design'), backgroundSurface: 'settings' as const },
    game: { icon: Palette, title: t('对话设计', 'ダイアログ設計', 'Dialog design'), backgroundSurface: 'game' as const },
  } satisfies Record<
    WebPreviewSurface,
    {
      icon: LucideIcon;
      title: string;
      backgroundSurface: 'start' | 'archive' | 'settings' | 'game';
    }
  >;
  const currentSurfaceMeta = surfaceMeta[currentPreviewSurface];
  const selectedInspectorTitle = selectedStartMenuElement
    ? selectedStartMenuElement.kind === 'button'
      ? t('按钮样式', 'ボタンスタイル', 'Button style')
      : selectedStartMenuElement.kind === 'image'
        ? t('图片样式', '画像スタイル', 'Image style')
        : t('文字样式', 'テキストスタイル', 'Text style')
    : currentPreviewSurface === 'game' && webRenderStyle.selectedRenderObject
      ? t('对话对象', 'ダイアログ要素', 'Dialog object')
      : t('背景样式', '背景スタイル', 'Background style');
  const surfaceInspector = (
    <WebSurfaceInspectorPanel
      title={currentSurfaceMeta.title}
      icon={currentSurfaceMeta.icon}
      inspectorTitle={selectedInspectorTitle}
    >
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
        />
      ) : currentPreviewSurface === 'game' && webRenderStyle.selectedRenderObject ? (
        <RenderObjectSettingsSection
          language={language}
          renderStyle={webRenderStyle}
          updateRenderStyle={updateWebRenderStyle}
          surface="web"
          showDescriptions={showSettingDescriptions}
        />
      ) : (
        <StartMenuBackgroundInspector
          settings={webSettings}
          language={language}
          showDescriptions={showSettingDescriptions}
          surface={currentSurfaceMeta.backgroundSurface}
          updateWebSettings={updateWebSettings}
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
      const key = currentPreviewSurface === 'archive' ? 'archivePageElements' : 'settingsPageElements';
      const source = currentPreviewSurface === 'archive' ? archivePageElements : settingsPageElements;
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
            borderColor: safeColor(
              element.borderColor,
              base.borderColor || '#ffffff2e',
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
                <IconToolButton
                  icon={Volume2}
                  label={t('音乐', '音楽', 'Music')}
                  onClick={() => setShowMenuMusicSettings((current) => !current)}
                  active={showMenuMusicSettings}
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
            onSurfaceChange={setCurrentPreviewSurface}
            onSelectStartMenuElement={(id) => {
              setSelectedStartMenuElementId(id);
              setSelectedPreviewElementIds(id ? [id] : []);
            }}
            onSelectStartMenuElements={setSelectedPreviewElementIds}
            onDeleteStartMenuElement={deleteStartMenuElement}
            onUpdateSettings={updateWebSettings}
            onUpdateRenderStyle={updateWebRenderStyle}
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

        <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          {startMenuPreviewMode === 'edit' && (
            <div className="sticky -top-4 z-30 -mx-4 -mt-4 border-b border-[var(--vr-border)] bg-[var(--vr-surface)]/95 px-4 py-3 backdrop-blur-xl">
              <WebSettingCard>
                <WebSegmentedGroup
                  value={editPreviewSurface}
                  options={[
                    { value: 'start', label: t('主界面', 'メイン', 'Menu'), disabled: !webSettings.showStartMenu },
                    { value: 'archive', label: t('存档', 'セーブ', 'Save'), disabled: !webSettings.showStartMenu },
                    { value: 'settings', label: t('设置', '設定', 'Settings'), disabled: !webSettings.showStartMenu },
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
              {showMenuMusicSettings && (
                <WebSettingCard>
                  <WebMenuMusicPanel
                    language={language}
                    settings={webSettings}
                    updateWebSettings={updateWebSettings}
                  />
                </WebSettingCard>
              )}
            </div>
          )}
          {currentPreviewSurface === 'start' && webSettings.showStartMenu && (
            <>
              {surfaceInspector}
              <WebAuxiliaryPanel title="Preset">
                <div className="grid gap-2 rounded-xl bg-indigo-500/5 p-2">
                  <IconToolButton
                    icon={Sparkles}
                    label={aiStartMenuDesigning ? 'AI designing' : 'AI full design'}
                    onClick={() => void generateStartMenuDesignWithAI()}
                    disabled={!callAIForTextResult || aiStartMenuDesigning}
                    iconClassName={aiStartMenuDesigning ? 'animate-spin' : ''}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPresetScope('all')}
                      className={presetScope === 'all' ? webSmallTabActiveClass : webSmallTabClass}
                    >
                      Full set
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetScope('current')}
                      className={
                        presetScope === 'current' ? webSmallTabActiveClass : webSmallTabClass
                      }
                    >
                      Current only
                    </button>
                  </div>
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
                          <span
                            className="h-3 w-8 shrink-0 rounded-full"
                            style={{ background: preset.accent }}
                          />
                        </span>
                        <span className="line-clamp-2 text-[10px] font-bold leading-4 text-[var(--vr-text-muted)]">
                          {preset.description}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <IconToolButton icon={Save} label="Save preset" onClick={saveStartMenuDesign} />
                    <IconToolButton
                      icon={Upload}
                      label="Apply mine"
                      onClick={loadStartMenuDesign}
                    />
                  </div>
                </div>
                {aiStartMenuDesignError && (
                  <div className="rounded-md bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-500 dark:text-rose-300">
                    {aiStartMenuDesignError}
                  </div>
                )}
              </WebAuxiliaryPanel>
            </>
          )}

          {currentPreviewSurface === 'settings' && (
            <>
              {surfaceInspector}
              <WebAuxiliaryPanel title="Web settings">
                <div className="grid grid-cols-3 gap-2">
                  <WebSettingCard icon={LayoutTemplate}>
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
                  <WebSettingCard>
                    <WebSegmentedGroup
                      value={webSettings.choicesPosition}
                      options={[
                        { value: 'aboveText', label: 'Top' },
                        { value: 'center', label: 'Mid' },
                        { value: 'belowText', label: 'Bot' },
                      ]}
                      onChange={(value) =>
                        updateWebSettings(
                          'choicesPosition',
                          value as WebExportSettings['choicesPosition'],
                        )
                      }
                    />
                  </WebSettingCard>
                  <WebSettingCard icon={Sparkles}>
                    <WebPillToggleGroup
                      value={webSettings.blurBackground ? 'on' : 'off'}
                      options={[
                        { value: 'on', label: 'Blur', icon: <BlurGlyph /> },
                        { value: 'off', label: 'Clear', icon: <ClearGlyph /> },
                      ]}
                      onChange={(value) => updateWebSettings('blurBackground', value === 'on')}
                    />
                  </WebSettingCard>
                  <WebSettingCard icon={<SingleChoicePopupGlyph />}>
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
                  <WebSettingCard icon={Gamepad2}>
                    <WebPillToggleGroup
                      value={webSettings.autoAdvance ? 'on' : 'off'}
                      options={[
                        { value: 'on', label: 'Auto', icon: <RotateCw className="h-3.5 w-3.5" /> },
                        { value: 'off', label: 'Manual', icon: <Hand className="h-3.5 w-3.5" /> },
                      ]}
                      onChange={(value) => updateWebSettings('autoAdvance', value === 'on')}
                    />
                  </WebSettingCard>
                  <WebSettingCard icon={Video}>
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
              </WebAuxiliaryPanel>
            </>
          )}

          {currentPreviewSurface === 'archive' && (
            <>
              {surfaceInspector}
              <WebAuxiliaryPanel title={t('存档页', 'セーブ画面', 'Save page')}>
                <WebSettingCard icon={Save}>
                  <WebPillToggleGroup
                    value={webSettings.startMenuShowSave ? 'show' : 'hide'}
                    options={[
                      { value: 'show', label: t('显示', '表示', 'Show'), icon: <Eye className="h-3.5 w-3.5" /> },
                      { value: 'hide', label: t('隐藏', '非表示', 'Hide'), icon: <EyeOff className="h-3.5 w-3.5" /> },
                    ]}
                    onChange={(value) => updateWebSettings('startMenuShowSave', value === 'show')}
                  />
                </WebSettingCard>
                <div className="grid gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-2">
                  <div className="px-1 text-[10px] font-black text-[var(--vr-text-muted)]">
                    {t('存档卡片', 'セーブカード', 'Save card')}
                  </div>
                  <ColorField
                    label={t('按钮', 'ボタン', 'Button')}
                    value={webChoiceColor}
                    onChange={updateWebChoiceColor}
                  />
                  <ColorField
                    label={t('文字', 'テキスト', 'Text')}
                    value={webChoiceTextColor}
                    onChange={updateWebChoiceTextColor}
                  />
                </div>
              </WebAuxiliaryPanel>
            </>
          )}

          {currentPreviewSurface === 'game' && (
            <>
              {surfaceInspector}
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

function WebSurfaceInspectorPanel({
  icon,
  title,
  inspectorTitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  inspectorTitle: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <WebPanelTitle icon={icon} title={title} />
      <div className="space-y-3">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0 text-[11px] font-black text-[var(--vr-text)]">
              {inspectorTitle}
            </div>
            <div className="h-px flex-1 bg-[var(--vr-border)]" />
          </div>
          <div className="rounded-lg bg-[var(--vr-surface-soft)]/70 p-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function WebAuxiliaryPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-[var(--vr-surface)]/90 p-3 shadow-xl shadow-black/5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0 text-[11px] font-black text-[var(--vr-text)]">{title}</div>
        <div className="h-px flex-1 bg-[var(--vr-border)]" />
      </div>
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
