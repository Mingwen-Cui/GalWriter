import type { Node as FlowNode } from '@xyflow/react';
import {
  Check,
  ClipboardPaste,
  Copy,
  Download,
  ImagePlus,
  Redo2,
  Save,
  Settings2,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ZoomOut,
} from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getTauriInvoke, isTauriRuntime } from '../../../../lib/tauriRuntime';
import {
  normalizeSharedCanvasSettings,
  type SharedCanvasSettings,
} from '../../canvas/canvasSettings';
import { defaultVideoCoverAiPrompt } from '../../homepageCoverTemplates';
import { StartMenuBackgroundInspector } from '../../web/StartMenuBackgroundInspector';
import { StartMenuElementInspector } from '../../web/StartMenuElementInspector';
import {
  WebEditableElementFrame,
  type WebEditableResizeHandle,
} from '../../web/WebEditableElementFrame';
import { renderVideoCoverCanvas } from '../export/videoCover';
import type {
  VideoCoverElement,
  VideoCoverSettings,
  WebExportSettings,
  WebMenuElement,
} from '../shared/types';

type VideoCoverEditorProps = {
  cover: VideoCoverSettings;
  nodes: FlowNode[];
  resolution: { width: number; height: number };
  language: 'zh' | 'en' | 'ja';
  onChange: (cover: VideoCoverSettings) => void;
  onDelete: () => void;
  onClose: () => void;
  embedded?: boolean;
};

type CoverTemplateInfo = {
  id: string;
  assets: string[];
  settings?: VideoCoverSettings | null;
};

const copy = (language: VideoCoverEditorProps['language']) =>
  language === 'zh'
    ? {
        title: '封面编辑',
        addText: '添加文字',
        addImage: '添加图片',
        done: '完成',
        inspector: '封面设置',
        element: '元素设置',
        background: '封面背景',
        source: '背景来源',
        frame: '视频帧',
        image: '素材图片',
        gradient: '渐变底色',
        pickVideo: '选择视频',
        frameTime: '取帧时间（秒）',
        pickImage: '选择图片素材',
        text: '文字内容',
        imageAsset: '图片素材',
        position: '位置与尺寸',
        style: '文字样式',
        deleteElement: '删除元素',
        deleteCover: '删除封面',
        confirm: '确定要删除这个视频封面吗？导出时将不再生成 PNG。',
        cancel: '取消',
        noMedia: '暂无可用图片素材。',
      }
    : language === 'ja'
      ? {
          title: 'カバー編集',
          addText: 'テキストを追加',
          addImage: '画像を追加',
          done: '完了',
          inspector: 'カバー設定',
          element: '要素設定',
          background: 'カバー背景',
          source: '背景素材',
          frame: '動画フレーム',
          image: '画像素材',
          gradient: 'グラデーション',
          pickVideo: '動画を選択',
          frameTime: 'フレーム時間（秒）',
          pickImage: '画像素材を選択',
          text: 'テキスト',
          imageAsset: '画像',
          position: '位置とサイズ',
          style: 'テキストスタイル',
          deleteElement: '要素を削除',
          deleteCover: 'カバーを削除',
          confirm: 'この動画カバーを削除しますか？PNG は書き出されなくなります。',
          cancel: 'キャンセル',
          noMedia: '利用できる画像素材がありません。',
        }
      : {
          title: 'Cover editor',
          addText: 'Add text',
          addImage: 'Add image',
          done: 'Done',
          inspector: 'Cover settings',
          element: 'Element settings',
          background: 'Cover background',
          source: 'Background source',
          frame: 'Video frame',
          image: 'Image asset',
          gradient: 'Gradient',
          pickVideo: 'Choose video',
          frameTime: 'Frame time (seconds)',
          pickImage: 'Choose image asset',
          text: 'Text',
          imageAsset: 'Image asset',
          position: 'Position and size',
          style: 'Text style',
          deleteElement: 'Delete element',
          deleteCover: 'Delete cover',
          confirm: 'Delete this video cover? A PNG will no longer be exported.',
          cancel: 'Cancel',
          noMedia: 'No usable image assets yet.',
        };

const nodeLabel = (node: FlowNode) => String(node.data?.title || node.data?.label || node.id);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const newElementId = (kind: VideoCoverElement['kind']) =>
  `cover-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const cloneCoverSettings = (value: VideoCoverSettings) =>
  JSON.parse(JSON.stringify(value)) as VideoCoverSettings;
const textColorWithAlpha = (color: string | undefined, alpha: number | undefined) => {
  const source = color || '#ffffff';
  const match = source.match(/^#([0-9a-f]{6})$/i);
  if (!match) return source;
  const safeAlpha = Math.max(0, Math.min(100, alpha ?? 100)) / 100;
  return `${source}${Math.round(safeAlpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
};
const coverTextShadowStyle = (
  element: VideoCoverElement,
  stageHeight: number,
  canvasHeight: number,
) => {
  if (element.shadowEnabled === false) return 'none';
  const shadows = element.shadows?.length
    ? element.shadows
    : [
        {
          type: element.shadowType || 'outer',
          color: element.shadowColor || '#000000',
          opacity: element.shadowOpacity ?? 0,
          blur: element.shadowBlur ?? 18,
          offsetX: element.shadowOffsetX ?? 0,
          offsetY: element.shadowOffsetY ?? 2,
        },
      ];
  const scale = stageHeight / Math.max(1, canvasHeight);
  return (
    shadows
      .filter((shadow) => shadow.enabled !== false && shadow.type === 'outer' && shadow.opacity > 0)
      .map(
        (shadow) =>
          `${(shadow.offsetX || 0) * scale}px ${(shadow.offsetY || 0) * scale}px ${(shadow.blur || 0) * scale}px ${textColorWithAlpha(shadow.color, shadow.opacity)}`,
      )
      .join(', ') || 'none'
  );
};

function ToolbarButton({
  icon: Icon,
  label,
  tone,
  onClick,
  disabled,
}: {
  icon: typeof Type;
  label: string;
  tone: 'indigo' | 'emerald';
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tone === 'indigo' ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
    >
      <span
        className={`grid h-7 w-7 place-items-center rounded-lg text-white ${tone === 'indigo' ? 'bg-indigo-600' : 'bg-emerald-600'}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      {label}
    </button>
  );
}

export function VideoCoverEditor({
  cover,
  nodes,
  resolution,
  language,
  onChange,
  onDelete,
  onClose,
  embedded = false,
}: VideoCoverEditorProps) {
  const text = copy(language);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isDeleteCoverConfirmOpen, setIsDeleteCoverConfirmOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateLibrary, setTemplateLibrary] = useState<CoverTemplateInfo[]>([]);
  const [isTemplateLibraryLoading, setIsTemplateLibraryLoading] = useState(true);
  const [templateSaveState, setTemplateSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const templatePreviewVersion = 0;
  const [isTemplateExporting, setIsTemplateExporting] = useState(false);
  const [viewScale, setViewScale] = useState(1);
  const [cropGuide, setCropGuide] = useState<'none' | '4:3' | '16:9'>('none');
  const [stageHeight, setStageHeight] = useState(0);
  const coverHistoryRef = useRef<{ past: VideoCoverSettings[]; future: VideoCoverSettings[] }>({
    past: [],
    future: [],
  });
  const copiedElementRef = useRef<VideoCoverElement | null>(null);
  const [hasCopiedElement, setHasCopiedElement] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [aiPromptCopied, setAiPromptCopied] = useState(false);
  const videoNodes = useMemo(
    () => nodes.filter((node) => typeof node.data?.videoUrl === 'string' && node.data.videoUrl),
    [nodes],
  );
  const imageNodes = useMemo(
    () => nodes.filter((node) => typeof node.data?.imageUrl === 'string' && node.data.imageUrl),
    [nodes],
  );
  const templateImages = useMemo(
    () =>
      templateLibrary.flatMap((template) =>
        template.assets.map((asset) => ({
          id: `${template.id}:${asset}`,
          label: `${template.id} · ${asset}`,
          url: encodeURI(`/cover-templates/${template.id}/${asset}`),
        })),
      ),
    [templateLibrary],
  );
  const elements = cover.elements || [];
  const orderedElements = useMemo(
    () =>
      elements
        .map((element, index) => ({ element, index }))
        .sort(
          (left, right) =>
            (left.element.zIndex ?? left.index) - (right.element.zIndex ?? right.index),
        )
        .map(({ element }) => element),
    [elements],
  );
  const selectedElement = elements.find((element) => element.id === selectedElementId) || null;
  const selectedInspectorElement = selectedElement
    ? ({ ...selectedElement, text: selectedElement.text || '' } as WebMenuElement)
    : null;
  const coverCanvasSettings = useMemo(
    () =>
      normalizeSharedCanvasSettings({
        ...cover.canvasSettings,
        canvasWidth: cover.canvasSettings?.canvasWidth || resolution.width,
        canvasHeight: cover.canvasSettings?.canvasHeight || resolution.height,
      }),
    [cover.canvasSettings, resolution.height, resolution.width],
  );
  const coverBackgroundSettings = useMemo(
    () =>
      ({
        ...coverCanvasSettings,
        startMenuBackgroundType:
          cover.sourceType === 'videoFrame'
            ? 'video'
            : cover.sourceType === 'image'
              ? 'image'
              : 'gradient',
        startMenuBackgroundColor: cover.gradientStart,
        startMenuBackgroundGradientStart: cover.gradientStart,
        startMenuBackgroundGradientEnd: cover.gradientEnd,
        startMenuBackgroundGradientAngle: 135,
        startMenuBackgroundImageUrl: cover.imageUrl || '',
        startMenuBackgroundVideoUrl: String(
          nodes.find((node) => node.id === cover.videoNodeId)?.data?.videoUrl || '',
        ),
      }) as WebExportSettings,
    [cover, coverCanvasSettings, nodes],
  );
  const cropGuideBounds = useMemo(() => {
    if (cropGuide === 'none') return null;
    const guideRatio = cropGuide === '4:3' ? 4 / 3 : 16 / 9;
    const canvasRatio = coverCanvasSettings.canvasWidth / coverCanvasSettings.canvasHeight;
    if (canvasRatio > guideRatio) {
      const width = (guideRatio / canvasRatio) * 100;
      return { left: `${(100 - width) / 2}%`, top: '0%', width: `${width}%`, height: '100%' };
    }
    const height = (canvasRatio / guideRatio) * 100;
    return { left: '0%', top: `${(100 - height) / 2}%`, width: '100%', height: `${height}%` };
  }, [coverCanvasSettings.canvasHeight, coverCanvasSettings.canvasWidth, cropGuide]);

  useEffect(() => {
    let cancelled = false;
    const loadTemplateLibrary = async () => {
      try {
        let templates: CoverTemplateInfo[] = [];
        if (isTauriRuntime()) {
          const invoke = await getTauriInvoke();
          templates = invoke ? ((await invoke('list_cover_templates')) as CoverTemplateInfo[]) : [];
        } else {
          const response = await fetch(encodeURI('/cover-templates/manifest.json'));
          if (response.ok) {
            templates =
              ((await response.json()) as { templates?: CoverTemplateInfo[] }).templates || [];
          }
        }
        if (!cancelled) setTemplateLibrary(templates);
      } catch {
        if (!cancelled) setTemplateSaveState('error');
      } finally {
        if (!cancelled) setIsTemplateLibraryLoading(false);
      }
    };
    void loadTemplateLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cover.logoInitialized) return;
    const legacy: VideoCoverElement[] = [...(cover.elements || [])];
    if (cover.title.trim())
      legacy.push({
        id: newElementId('text'),
        kind: 'text',
        text: cover.title,
        visible: true,
        x: 15,
        y: 50,
        width: 70,
        height: 14,
        rotation: 0,
        opacity: 100,
        fontSize: cover.titleFontSize,
        fontWeight: 900,
        textAlign: cover.textAlign,
        textColor: '#ffffff',
      });
    if (cover.subtitle.trim())
      legacy.push({
        id: newElementId('text'),
        kind: 'text',
        text: cover.subtitle,
        visible: true,
        x: 15,
        y: 65,
        width: 70,
        height: 8,
        rotation: 0,
        opacity: 100,
        fontSize: cover.subtitleFontSize,
        fontWeight: 600,
        textAlign: cover.textAlign,
        textColor: '#ffffff',
      });
    legacy.push({
      id: 'cover-logo',
      kind: 'image',
      imageUrl: '/glass.png',
      visible: true,
      x: 92,
      y: 88,
      width: 5,
      height: 8.8,
      rotation: 0,
      opacity: 94,
      objectFit: 'contain',
      zIndex: 100,
    });
    onChange({ ...cover, title: '', subtitle: '', elements: legacy, logoInitialized: true });
  }, [cover, onChange]);
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    void renderVideoCoverCanvas({
      settings: cover,
      nodes,
      width: Math.min(1920, coverCanvasSettings.canvasWidth),
      height: Math.min(1080, coverCanvasSettings.canvasHeight),
      canvas: preview,
      includeElements: false,
    }).catch(() => undefined);
  }, [cover, coverCanvasSettings, nodes]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateHeight = () => setStageHeight(stage.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [coverCanvasSettings.canvasHeight, coverCanvasSettings.canvasWidth]);

  const recordCoverHistory = () => {
    const history = coverHistoryRef.current;
    history.past = [...history.past.slice(-49), cloneCoverSettings(cover)];
    history.future = [];
    setHistoryVersion((version) => version + 1);
  };
  const commitCover = (next: VideoCoverSettings, recordHistory = true) => {
    if (recordHistory) recordCoverHistory();
    onChange(next);
  };
  const undoCover = () => {
    const history = coverHistoryRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future = [cloneCoverSettings(cover), ...history.future].slice(0, 50);
    setHistoryVersion((version) => version + 1);
    onChange(previous);
  };
  const copyAiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(defaultVideoCoverAiPrompt);
      setAiPromptCopied(true);
      window.setTimeout(() => setAiPromptCopied(false), 1800);
    } catch {
      setAiPromptCopied(false);
    }
  };
  const redoCover = () => {
    const history = coverHistoryRef.current;
    const next = history.future.shift();
    if (!next) return;
    history.past = [...history.past.slice(-49), cloneCoverSettings(cover)];
    setHistoryVersion((version) => version + 1);
    onChange(next);
  };
  const patch = (value: Partial<VideoCoverSettings>, recordHistory = true) =>
    commitCover({ ...cover, ...value }, recordHistory);
  const updateCoverCanvas = (value: Partial<SharedCanvasSettings>) =>
    patch({ canvasSettings: { ...cover.canvasSettings, ...value } });
  const updateCoverBackground = (
    key: keyof WebExportSettings,
    value: WebExportSettings[keyof WebExportSettings],
  ) => {
    if (key === 'startMenuBackgroundType') {
      patch({
        sourceType: value === 'video' ? 'videoFrame' : value === 'image' ? 'image' : 'gradient',
      });
      return;
    }
    if (key === 'startMenuBackgroundGradientStart') patch({ gradientStart: String(value) });
    if (key === 'startMenuBackgroundGradientEnd') patch({ gradientEnd: String(value) });
    if (key === 'startMenuBackgroundImageUrl') patch({ imageUrl: String(value) });
    if (key === 'startMenuBackgroundVideoUrl')
      patch({ videoNodeId: nodes.find((node) => node.data?.videoUrl === value)?.id });
  };
  const updateElements = (next: VideoCoverElement[], recordHistory = true) =>
    patch({ elements: next }, recordHistory);
  const updateElement = (id: string, value: Partial<VideoCoverElement>, recordHistory = true) =>
    updateElements(
      elements.map((element) => (element.id === id ? { ...element, ...value } : element)),
      recordHistory,
    );
  const deleteElement = (id: string) => {
    updateElements(elements.filter((element) => element.id !== id));
    setSelectedElementId((current) => (current === id ? null : current));
  };
  const addText = () => {
    const element: VideoCoverElement = {
      id: newElementId('text'),
      kind: 'text',
      text: language === 'zh' ? '输入文字' : language === 'ja' ? 'テキスト' : 'Your text',
      visible: true,
      x: 20,
      y: 42,
      width: 60,
      height: 13,
      rotation: 0,
      opacity: 100,
      fontSize: 58,
      fontWeight: 800,
      textAlign: 'center',
      textColor: '#ffffff',
      zIndex: Math.min(9999, Math.max(0, ...elements.map((item) => item.zIndex ?? 0)) + 1),
    };
    updateElements([...elements, element]);
    setSelectedElementId(element.id);
  };
  const addImage = (imageUrl: string) => {
    if (!imageUrl) return;
    const element: VideoCoverElement = {
      id: newElementId('image'),
      kind: 'image',
      imageUrl,
      visible: true,
      x: 32,
      y: 32,
      width: 36,
      height: 36,
      rotation: 0,
      opacity: 100,
      objectFit: 'cover',
      zIndex: Math.min(9999, Math.max(0, ...elements.map((item) => item.zIndex ?? 0)) + 1),
    };
    updateElements([...elements, element]);
    setSelectedElementId(element.id);
    setIsImagePickerOpen(false);
  };
  const addUploadedImage = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => addImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  };
  const duplicateElement = (element: VideoCoverElement) => {
    const duplicate: VideoCoverElement = {
      ...cloneCoverSettings({ ...cover, elements: [element] }).elements![0],
      id: newElementId(element.kind),
      x: clamp(element.x + 3, -100, 100),
      y: clamp(element.y + 3, -100, 100),
      zIndex: Math.min(9999, Math.max(0, ...elements.map((item) => item.zIndex ?? 0)) + 1),
    };
    updateElements([...elements, duplicate]);
    setSelectedElementId(duplicate.id);
  };
  const copySelectedElement = () => {
    if (!selectedElement) return;
    copiedElementRef.current = cloneCoverSettings({
      ...cover,
      elements: [selectedElement],
    }).elements![0];
    setHasCopiedElement(true);
    if (selectedElement.kind === 'text' && selectedElement.text) {
      void navigator.clipboard?.writeText(selectedElement.text).catch(() => undefined);
    }
  };
  const pasteCopiedElement = () => {
    if (copiedElementRef.current) duplicateElement(copiedElementRef.current);
  };
  useEffect(() => {
    const isNativeTextTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    const copy = (event: ClipboardEvent) => {
      if (isNativeTextTarget(event.target) || !selectedElement) return;
      copySelectedElement();
      event.stopPropagation();
      if (selectedElement.kind === 'text' && selectedElement.text) {
        event.clipboardData?.setData('text/plain', selectedElement.text);
      }
      event.preventDefault();
    };
    const paste = (event: ClipboardEvent) => {
      if (isNativeTextTarget(event.target)) return;
      const image = Array.from(event.clipboardData?.files || []).find((file) =>
        file.type.startsWith('image/'),
      );
      if (image) {
        event.stopPropagation();
        event.preventDefault();
        addUploadedImage(image);
        return;
      }
      const plainText = event.clipboardData?.getData('text/plain').trim();
      if (
        copiedElementRef.current &&
        (copiedElementRef.current.kind === 'image' ||
          !plainText ||
          plainText === copiedElementRef.current.text)
      ) {
        event.stopPropagation();
        event.preventDefault();
        duplicateElement(copiedElementRef.current);
        return;
      }
      if (plainText) {
        event.stopPropagation();
        event.preventDefault();
        const element: VideoCoverElement = {
          id: newElementId('text'),
          kind: 'text',
          text: plainText,
          visible: true,
          x: 20,
          y: 42,
          width: 60,
          height: 13,
          rotation: 0,
          opacity: 100,
          fontSize: 58,
          fontWeight: 800,
          textAlign: 'center',
          textColor: '#ffffff',
          zIndex: Math.min(9999, Math.max(0, ...elements.map((item) => item.zIndex ?? 0)) + 1),
        };
        updateElements([...elements, element]);
        setSelectedElementId(element.id);
      }
    };
    window.addEventListener('copy', copy, true);
    window.addEventListener('paste', paste, true);
    return () => {
      window.removeEventListener('copy', copy, true);
      window.removeEventListener('paste', paste, true);
    };
  }, [cover, elements, selectedElement]);
  useEffect(() => {
    const keyboardHistory = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditingText =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (isEditingText) return;
      if (
        event.code === 'Space' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.stopPropagation();
        event.preventDefault();
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.stopPropagation();
        event.preventDefault();
        if (event.shiftKey) redoCover();
        else undoCover();
      } else if (key === 'y') {
        event.stopPropagation();
        event.preventDefault();
        redoCover();
      }
    };
    window.addEventListener('keydown', keyboardHistory, true);
    return () => window.removeEventListener('keydown', keyboardHistory, true);
  }, [cover]);
  const applyTemplate = async (template: CoverTemplateInfo) => {
    const isPortrait = coverCanvasSettings.canvasHeight > coverCanvasSettings.canvasWidth;
    const assetUrls = template.assets.map((asset) =>
      encodeURI(`/cover-templates/${template.id}/${asset}`),
    );
    let savedSettings = template.settings;
    if (!savedSettings) {
      try {
        const response = await fetch(encodeURI(`/cover-templates/${template.id}/template.json`));
        if (response.ok) savedSettings = (await response.json()) as VideoCoverSettings;
      } catch {
        // A new template has no saved layout yet; its image assets are loaded below.
      }
    }
    if (savedSettings) {
      commitCover({
        ...savedSettings,
        title: '',
        subtitle: '',
        logoInitialized: true,
      });
    } else {
      const imageLayers: VideoCoverElement[] = assetUrls.map((imageUrl, index) => ({
        id: `template-${template.id}-${index + 1}`,
        kind: 'image',
        imageUrl,
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 100,
        zIndex: index,
        objectFit: 'cover',
        imageCropX: 50,
        imageCropY: 50,
        imageCropScale: 1,
      }));
      imageLayers.push({
        id: 'cover-logo',
        kind: 'image',
        imageUrl: '/glass.png',
        visible: true,
        x: 92,
        y: isPortrait ? 94 : 88,
        width: isPortrait ? 6 : 5,
        height: isPortrait ? 4 : 8.8,
        rotation: 0,
        opacity: 94,
        objectFit: 'contain',
        zIndex: 100,
      });
      commitCover({
        ...cover,
        sourceType: 'gradient',
        gradientStart: '#0f172a',
        gradientEnd: '#0e7490',
        title: '',
        subtitle: '',
        elements: imageLayers,
        logoInitialized: true,
      });
    }
    setActiveTemplateId(template.id);
    setSelectedElementId(null);
    setTemplateSaveState('idle');
  };
  const createCoverPng = async () => {
    const previewCanvas = document.createElement('canvas');
    await renderVideoCoverCanvas({
      settings: cover,
      nodes,
      width: coverCanvasSettings.canvasWidth,
      height: coverCanvasSettings.canvasHeight,
      canvas: previewCanvas,
      includeElements: true,
    });
    const blob = await new Promise<Blob | null>((resolve) =>
      previewCanvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('Cover preview is unavailable.');
    return blob;
  };
  const saveActiveTemplate = async () => {
    if (!activeTemplateId || !previewRef.current || !isTauriRuntime()) return;
    setTemplateSaveState('saving');
    try {
      const blob = await createCoverPng();
      const previewPng = Array.from(new Uint8Array(await blob.arrayBuffer()));
      const invoke = await getTauriInvoke();
      if (!invoke) throw new Error('Template saving is available in the desktop app only.');
      await invoke('save_cover_copy', {
        templateId: activeTemplateId,
        settings: cover,
        previewPng,
      });
      setTemplateSaveState('saved');
    } catch {
      setTemplateSaveState('error');
    }
  };
  const downloadCoverPng = async () => {
    const blob = await createCoverPng();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTemplateId || 'video-cover'}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const closeEditor = async () => {
    if (activeTemplateId && isTauriRuntime()) await saveActiveTemplate();
    onClose();
  };
  const exportActiveTemplate = async () => {
    if (!activeTemplateId) return;
    const template = templateLibrary.find((candidate) => candidate.id === activeTemplateId);
    if (!template) return;
    setIsTemplateExporting(true);
    try {
      const { default: JSZip } = await import('jszip');
      const archive = new JSZip();
      archive.file('template.json', JSON.stringify(cover, null, 2));
      archive.file('preview.png', await createCoverPng());
      await Promise.all(
        template.assets.map(async (asset) => {
          const response = await fetch(encodeURI(`/cover-templates/${template.id}/${asset}`));
          if (!response.ok) throw new Error(`Could not read ${asset}`);
          archive.file(asset, await response.blob());
        }),
      );
      const blob = await archive.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeTemplateId}-template.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      setIsTemplateExporting(false);
    }
  };
  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, element: VideoCoverElement) => {
    if ((event.target as HTMLElement).closest('[data-cover-control="true"]')) return;
    if (editingElementId === element.id) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setSelectedElementId(element.id);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = event.clientX;
    const startY = event.clientY;
    recordCoverHistory();
    const move = (moveEvent: PointerEvent) =>
      updateElement(
        element.id,
        {
          x: clamp(element.x + ((moveEvent.clientX - startX) / rect.width) * 100, -100, 100),
          y: clamp(element.y + ((moveEvent.clientY - startY) / rect.height) * 100, -100, 100),
        },
        false,
      );
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const beginResize = (
    event: ReactPointerEvent<HTMLElement>,
    element: VideoCoverElement,
    handle: WebEditableResizeHandle,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = event.clientX;
    const startY = event.clientY;
    recordCoverHistory();
    const move = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
      let x = element.x;
      let y = element.y;
      let width = element.width;
      let height = element.height;
      if (handle.includes('e')) width = clamp(element.width + dx, 4, 200);
      if (handle.includes('s')) height = clamp(element.height + dy, 4, 200);
      if (handle.includes('w')) {
        x = clamp(element.x + dx, -100, 100);
        width = clamp(element.width - (x - element.x), 4, 200);
      }
      if (handle.includes('n')) {
        y = clamp(element.y + dy, -100, 100);
        height = clamp(element.height - (y - element.y), 4, 200);
      }
      updateElement(element.id, { x, y, width, height }, false);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const beginRotate = (event: ReactPointerEvent<HTMLElement>, element: VideoCoverElement) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + ((element.x + element.width / 2) / 100) * rect.width;
    const centerY = rect.top + ((element.y + element.height / 2) / 100) * rect.height;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    recordCoverHistory();
    const move = (moveEvent: PointerEvent) => {
      const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
      updateElement(
        element.id,
        { rotation: element.rotation + ((angle - startAngle) * 180) / Math.PI },
        false,
      );
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const numberField = (
    label: string,
    value: number,
    onValue: (next: number) => void,
    min = 0,
    max = 100,
    step = 1,
  ) => (
    <label className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onValue(Number(event.target.value))}
        className="h-9 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-2 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
      />
    </label>
  );
  const canUndo = historyVersion >= 0 && coverHistoryRef.current.past.length > 0;
  const canRedo = historyVersion >= 0 && coverHistoryRef.current.future.length > 0;

  return (
    <div
      className={
        embedded
          ? 'h-full min-h-0 min-w-0 overflow-hidden bg-[var(--vr-bg)]'
          : 'fixed inset-0 z-[200] grid place-items-center bg-slate-950/20 p-6'
      }
    >
      <div
        className={`relative grid w-full overflow-hidden bg-[var(--vr-bg)] grid-rows-[56px_minmax(0,1fr)] ${embedded ? 'h-full' : 'h-[min(760px,calc(100vh-48px))] max-w-[1180px] rounded-2xl border border-white/70 shadow-2xl'}`}
      >
        <div className="relative h-14 border-b border-[var(--vr-border)] bg-[var(--vr-surface)]">
          <header className="grid h-14 grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)] items-center gap-5 px-5">
            <div className="flex min-w-0 items-center gap-3 text-xs font-black tracking-wide text-[var(--vr-text-soft)]">
              <Settings2 className="h-4 w-4 shrink-0 text-[var(--vr-accent)]" />
              <span className="whitespace-nowrap">{text.title}</span>
              <button
                type="button"
                onClick={() => setIsDeleteCoverConfirmOpen(true)}
                className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[11px] font-black text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {text.deleteCover}
              </button>
            </div>
            <div className="flex shrink-0 items-center justify-self-center gap-3">
              <ToolbarButton icon={Type} label={text.addText} tone="indigo" onClick={addText} />
              <ToolbarButton
                icon={ImagePlus}
                label={text.addImage}
                tone="emerald"
                onClick={() => setIsImagePickerOpen(true)}
              />
            </div>
            <div className="flex min-w-0 items-center justify-end gap-3">
              {activeTemplateId && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void exportActiveTemplate()}
                    disabled={isTemplateExporting}
                    className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-black text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {isTemplateExporting ? '导出中' : '导出模板'}
                  </button>
                  {isTauriRuntime() ? (
                    <button
                      type="button"
                      onClick={() => void saveActiveTemplate()}
                      disabled={templateSaveState === 'saving'}
                      className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {templateSaveState === 'saving'
                        ? '保存中'
                        : templateSaveState === 'saved'
                          ? '已保存副本'
                          : templateSaveState === 'error'
                            ? '保存失败，重试'
                            : '保存副本'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void downloadCoverPng()}
                      className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700 hover:bg-sky-100"
                    >
                      <Download className="h-4 w-4" />
                      下载封面
                    </button>
                  )}
                </div>
              )}
              <div className="flex shrink-0 items-center gap-2 border-l border-[var(--vr-border)] pl-3">
                <button
                  type="button"
                  onClick={() => void closeEditor()}
                  className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--vr-accent)] px-3 text-xs font-black text-white hover:brightness-105"
                >
                  <Check className="h-4 w-4" />
                  {text.done}
                </button>
                <button
                  type="button"
                  onClick={() => void closeEditor()}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:bg-[var(--vr-border)]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>
          <div className="absolute left-0 right-[330px] top-14 z-20 flex h-10 items-center justify-start gap-3 border-b border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-5 max-md:right-0">
            <div
              className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-slate-600"
              title="拖动滑杆调整画布缩放，查看超出画布的图层"
            >
              <ZoomOut className="h-4 w-4 shrink-0" />
              <input
                type="range"
                min="0.35"
                max="1"
                step="0.05"
                value={viewScale}
                onChange={(event) => setViewScale(Number(event.target.value))}
                aria-label="画布缩放"
                className="w-24 accent-[var(--vr-accent)]"
              />
              <span className="w-8 text-right text-[10px] font-black tabular-nums">
                {Math.round(viewScale * 100)}%
              </span>
            </div>
            <div
              className="flex h-8 shrink-0 items-center overflow-hidden border-x border-[var(--vr-border)] px-3"
              aria-label="取景参考比例"
            >
              {(['none', '4:3', '16:9'] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setCropGuide(ratio)}
                  className={`h-7 whitespace-nowrap rounded-md px-2.5 text-[11px] font-black transition-colors ${cropGuide === ratio ? 'bg-[var(--vr-accent)] text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                  title={ratio === 'none' ? '关闭取景参考线' : `显示 ${ratio} 取景框，仅作视觉参考`}
                >
                  {ratio === 'none' ? '无' : ratio}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2 border-r border-[var(--vr-border)] pr-3">
              <button
                type="button"
                onClick={copySelectedElement}
                disabled={!selectedElement}
                className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                title="复制选中的文字或图片"
              >
                <Copy className="h-3.5 w-3.5" />
                复制
              </button>
              <button
                type="button"
                onClick={pasteCopiedElement}
                disabled={!hasCopiedElement}
                className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                title="粘贴最近复制的文字或图片"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                粘贴
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={undoCover}
                disabled={!canUndo}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                title="撤销"
                aria-label="撤销"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={redoCover}
                disabled={!canRedo}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                title="重做"
                aria-label="重做"
              >
                <Redo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void copyAiPrompt()}
                className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-[11px] font-black text-violet-700 transition-colors hover:bg-violet-100"
                title="复制 AI 封面图片生成提示词"
              >
                <Copy className="h-3.5 w-3.5" />
                {aiPromptCopied ? '已复制' : '复制 AI 提示词'}
              </button>
            </div>
          </div>
        </div>
        {isImagePickerOpen && (
          <div className="absolute left-1/2 top-24 z-[300] w-[min(520px,calc(100%-32px))] -translate-x-1/2 rounded-2xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-black text-[var(--vr-text)]">{text.pickImage}</div>
              <button
                type="button"
                onClick={() => setIsImagePickerOpen(false)}
                className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)]"
              >
                ×
              </button>
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                addUploadedImage(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 text-xs font-black text-emerald-700 hover:bg-emerald-100"
            >
              <Upload className="h-4 w-4" />
              上传图片
            </button>
            <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto">
              {templateImages.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => addImage(image.url)}
                  className="aspect-square overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50 hover:ring-2 hover:ring-[var(--vr-accent)]"
                  title={image.label}
                >
                  <img src={image.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              {imageNodes.map((node) => {
                const url = String(node.data?.imageUrl || '');
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => addImage(url)}
                    className="aspect-square overflow-hidden rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] hover:ring-2 hover:ring-[var(--vr-accent)]"
                    title={nodeLabel(node)}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
            {!imageNodes.length && !templateImages.length && (
              <p className="py-5 text-center text-xs text-[var(--vr-text-muted)]">{text.noMedia}</p>
            )}
          </div>
        )}
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_330px] max-md:grid-cols-1">
          <section className="flex min-h-0 min-w-0 flex-col bg-[var(--vr-surface-soft)] pt-10">
            <div
              className="min-h-0 flex-1 overflow-hidden p-5"
              onPointerDown={() => {
                setSelectedElementId(null);
                setEditingElementId(null);
              }}
            >
              <div className="mx-auto flex h-full min-h-[360px] items-center justify-center">
                <div
                  ref={stageRef}
                  className="relative w-full max-w-[1120px] overflow-visible bg-slate-950 shadow-2xl transition-transform"
                  style={{
                    aspectRatio: `${coverCanvasSettings.canvasWidth} / ${coverCanvasSettings.canvasHeight}`,
                    transform: `scale(${viewScale})`,
                  }}
                  onPointerDown={() => {
                    setSelectedElementId(null);
                    setEditingElementId(null);
                  }}
                >
                  <canvas ref={previewRef} className="absolute inset-0 h-full w-full" />
                  {cropGuideBounds && (
                    <div className="pointer-events-none absolute inset-0 z-[120] overflow-hidden">
                      <div
                        className="absolute border-2 border-white/90"
                        style={{
                          ...cropGuideBounds,
                          boxShadow: '0 0 0 9999px rgba(71, 85, 105, 0.5)',
                        }}
                      >
                        <span className="absolute -top-6 left-0 rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-black text-white">
                          {cropGuide}
                        </span>
                      </div>
                    </div>
                  )}
                  {orderedElements.map((element) => (
                    <div
                      key={element.id}
                      data-cover-element="true"
                      className={`absolute touch-none ${editingElementId === element.id ? 'cursor-text' : 'cursor-move'} ${element.visible ? '' : 'opacity-35'}`}
                      style={{
                        left: `${element.x}%`,
                        top: `${element.y}%`,
                        width: `${element.width}%`,
                        height: `${element.height}%`,
                        transform: `rotate(${element.rotation}deg)`,
                        opacity: element.opacity / 100,
                        zIndex: element.zIndex ?? 0,
                      }}
                      onPointerDown={(event) => beginDrag(event, element)}
                    >
                      {element.kind === 'text' ? (
                        <div
                          contentEditable={editingElementId === element.id}
                          suppressContentEditableWarning
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            setSelectedElementId(element.id);
                            setEditingElementId(element.id);
                            const target = event.currentTarget;
                            window.requestAnimationFrame(() => {
                              target.focus();
                              const selection = window.getSelection();
                              if (!selection) return;
                              const range = document.createRange();
                              range.selectNodeContents(target);
                              range.collapse(false);
                              selection.removeAllRanges();
                              selection.addRange(range);
                            });
                          }}
                          onBlur={(event) => {
                            updateElement(element.id, { text: event.currentTarget.innerText });
                            setEditingElementId(null);
                          }}
                          className={`flex h-full w-full items-center overflow-hidden whitespace-pre-wrap break-words px-1 leading-tight outline-none ${editingElementId === element.id ? 'cursor-text select-text' : ''}`}
                          style={{
                            color: textColorWithAlpha(element.textColor, element.textColorAlpha),
                            fontFamily: element.fontFamily,
                            fontSize: `${Math.max(12, ((element.fontSize || 54) / coverCanvasSettings.canvasHeight) * stageHeight)}px`,
                            fontWeight: element.fontWeight || 800,
                            letterSpacing: `${((element.letterSpacing || 0) / coverCanvasSettings.canvasHeight) * stageHeight}px`,
                            lineHeight: element.lineHeight || 1.28,
                            textAlign: element.textAlign || 'center',
                            justifyContent:
                              element.textAlign === 'left'
                                ? 'flex-start'
                                : element.textAlign === 'right'
                                  ? 'flex-end'
                                  : 'center',
                            textShadow: coverTextShadowStyle(
                              element,
                              stageHeight,
                              coverCanvasSettings.canvasHeight,
                            ),
                            WebkitTextStroke:
                              element.strokeEnabled === false || !(element.textStrokeWidth || 0)
                                ? undefined
                                : `${((element.textStrokeWidth || 0) / coverCanvasSettings.canvasHeight) * stageHeight}px ${element.textStrokeColor || '#000000'}`,
                            paintOrder: 'stroke fill',
                          }}
                        >
                          {element.text}
                        </div>
                      ) : element.imageUrl ? (
                        <div className="h-full w-full overflow-hidden">
                          <img
                            src={element.imageUrl}
                            alt=""
                            draggable={false}
                            className="h-full w-full select-none"
                            style={{
                              objectFit: element.objectFit || 'cover',
                              objectPosition: `${element.imageCropX ?? 50}% ${element.imageCropY ?? 50}%`,
                              transform: `scale(${element.imageCropScale ?? 1})`,
                              transformOrigin: `${element.imageCropX ?? 50}% ${element.imageCropY ?? 50}%`,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {selectedElement && (
                    <div
                      className="pointer-events-none absolute"
                      style={{
                        left: `${selectedElement.x}%`,
                        top: `${selectedElement.y}%`,
                        width: `${selectedElement.width}%`,
                        height: `${selectedElement.height}%`,
                        transform: `rotate(${selectedElement.rotation}deg)`,
                        zIndex: 2147483647,
                      }}
                    >
                      <WebEditableElementFrame
                        visible={selectedElement.visible}
                        onToggleVisible={(event) => {
                          event.stopPropagation();
                          updateElement(selectedElement.id, { visible: !selectedElement.visible });
                        }}
                        onDelete={(event) => {
                          event.stopPropagation();
                          deleteElement(selectedElement.id);
                        }}
                        onRotatePointerDown={(event) => beginRotate(event, selectedElement)}
                        onResizePointerDown={(event, handle) =>
                          beginResize(event, selectedElement, handle)
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--vr-border)] bg-[var(--vr-surface)] p-3">
              <div className="grid grid-cols-4 gap-3">
                {templateLibrary.slice(0, 4).map((template) => {
                  const previewUrl = encodeURI(
                    `/cover-templates/${template.id}/preview.png?${templatePreviewVersion}`,
                  );
                  const firstAssetUrl = template.assets[0]
                    ? encodeURI(`/cover-templates/${template.id}/${template.assets[0]}`)
                    : '';
                  return (
                    <button
                      key={template.id}
                      type="button"
                      title={template.id}
                      aria-label={template.id}
                      onClick={() => void applyTemplate(template)}
                      className={`group overflow-hidden rounded-xl border p-1 transition-all ${activeTemplateId === template.id ? 'border-[var(--vr-accent)] ring-2 ring-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] hover:border-[var(--vr-accent)]'}`}
                    >
                      <span className="relative flex h-24 items-center justify-center overflow-hidden rounded-lg bg-slate-800">
                        {firstAssetUrl && (
                          <img
                            src={previewUrl}
                            alt=""
                            className="h-full w-full object-contain"
                            onError={(event) => {
                              event.currentTarget.src = firstAssetUrl;
                            }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
                {isTemplateLibraryLoading && (
                  <span className="col-span-4 py-4 text-center text-xs font-bold text-[var(--vr-text-muted)]">
                    读取模板素材…
                  </span>
                )}
                {!isTemplateLibraryLoading && !templateLibrary.length && (
                  <span className="col-span-4 py-4 text-center text-xs font-bold text-[var(--vr-text-muted)]">
                    暂无可用封面模板。
                  </span>
                )}
              </div>
            </div>
          </section>
          <aside className="min-h-0 overflow-y-auto border-l border-[var(--vr-border)] bg-[var(--vr-surface)] p-4 max-md:border-l-0 max-md:border-t">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
              <Settings2 className="h-4 w-4 text-[var(--vr-accent)]" />
              {selectedElement ? text.element : text.inspector}
            </h2>
            {selectedElement && selectedInspectorElement ? (
              <>
                <StartMenuElementInspector
                  element={selectedInspectorElement}
                  language={language}
                  showDescriptions={false}
                  fontSizeMax={Number.MAX_SAFE_INTEGER}
                  strokeWidthMax={Number.MAX_SAFE_INTEGER}
                  onUpdate={(updates) =>
                    updateElement(selectedElement.id, updates as Partial<VideoCoverElement>)
                  }
                  onAlignSelected={(axis, value) => {
                    const next = value === 'start' ? 0 : value === 'center' ? 50 : 100;
                    updateElement(
                      selectedElement.id,
                      axis === 'x'
                        ? { x: next - selectedElement.width / 2 }
                        : { y: next - selectedElement.height / 2 },
                    );
                  }}
                />
                {selectedElement.kind === 'image' && (
                  <section className="mt-4 rounded-2xl bg-sky-50 p-3">
                    <div className="mb-2 text-xs font-black text-slate-800">图片裁切</div>
                    <div className="grid grid-cols-2 gap-2">
                      {numberField(
                        '焦点 X',
                        selectedElement.imageCropX ?? 50,
                        (imageCropX) => updateElement(selectedElement.id, { imageCropX }),
                        0,
                        100,
                      )}
                      {numberField(
                        '焦点 Y',
                        selectedElement.imageCropY ?? 50,
                        (imageCropY) => updateElement(selectedElement.id, { imageCropY }),
                        0,
                        100,
                      )}
                      <label className="col-span-2 grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]">
                        <span>
                          裁切缩放 {Math.round((selectedElement.imageCropScale ?? 1) * 100)}%
                        </span>
                        <input
                          type="range"
                          min="1"
                          max="3"
                          step="0.01"
                          value={selectedElement.imageCropScale ?? 1}
                          onChange={(event) =>
                            updateElement(selectedElement.id, {
                              imageCropScale: Number(event.target.value),
                            })
                          }
                          className="accent-indigo-600"
                        />
                      </label>
                    </div>
                  </section>
                )}
                <div className="hidden space-y-4">
                  {selectedElement.kind === 'text' ? (
                    <>
                      <label className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]">
                        <span>{text.text}</span>
                        <textarea
                          value={selectedElement.text || ''}
                          onChange={(event) =>
                            updateElement(selectedElement.id, { text: event.target.value })
                          }
                          className="min-h-20 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
                        />
                      </label>
                      <section className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--vr-surface-soft)] p-3">
                        {numberField(
                          '字号',
                          selectedElement.fontSize || 54,
                          (fontSize) => updateElement(selectedElement.id, { fontSize }),
                          12,
                          220,
                        )}
                        {numberField(
                          '字重',
                          selectedElement.fontWeight || 800,
                          (fontWeight) => updateElement(selectedElement.id, { fontWeight }),
                          100,
                          900,
                          100,
                        )}
                        <label className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]">
                          <span>颜色</span>
                          <input
                            type="color"
                            value={selectedElement.textColor || '#ffffff'}
                            onChange={(event) =>
                              updateElement(selectedElement.id, { textColor: event.target.value })
                            }
                            className="h-9 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-1"
                          />
                        </label>
                        <label className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]">
                          <span>对齐</span>
                          <select
                            value={selectedElement.textAlign || 'center'}
                            onChange={(event) =>
                              updateElement(selectedElement.id, {
                                textAlign: event.target.value as VideoCoverElement['textAlign'],
                              })
                            }
                            className="h-9 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-2 text-xs font-bold text-[var(--vr-text)]"
                          >
                            <option value="left">左对齐</option>
                            <option value="center">居中</option>
                            <option value="right">右对齐</option>
                          </select>
                        </label>
                      </section>
                    </>
                  ) : (
                    <section>
                      <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                        {text.imageAsset}
                      </div>
                      <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto">
                        {imageNodes.map((node) => {
                          const url = String(node.data?.imageUrl || '');
                          return (
                            <button
                              key={node.id}
                              type="button"
                              onClick={() => updateElement(selectedElement.id, { imageUrl: url })}
                              className={`aspect-square overflow-hidden rounded-lg border-2 ${selectedElement.imageUrl === url ? 'border-[var(--vr-accent)]' : 'border-transparent'}`}
                              title={nodeLabel(node)}
                            >
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            </button>
                          );
                        })}
                      </div>
                      {!imageNodes.length && (
                        <p className="mt-2 text-xs text-[var(--vr-text-muted)]">{text.noMedia}</p>
                      )}
                    </section>
                  )}
                  <section>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                      {text.position}
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--vr-surface-soft)] p-3">
                      {numberField('X', selectedElement.x, (x) =>
                        updateElement(selectedElement.id, { x }),
                      )}
                      {numberField('Y', selectedElement.y, (y) =>
                        updateElement(selectedElement.id, { y }),
                      )}
                      {numberField(
                        '宽度',
                        selectedElement.width,
                        (width) => updateElement(selectedElement.id, { width }),
                        4,
                        100,
                      )}
                      {numberField(
                        '高度',
                        selectedElement.height,
                        (height) => updateElement(selectedElement.id, { height }),
                        4,
                        100,
                      )}
                      {numberField(
                        '旋转',
                        selectedElement.rotation,
                        (rotation) => updateElement(selectedElement.id, { rotation }),
                        -360,
                        360,
                      )}
                      {numberField(
                        '透明度',
                        selectedElement.opacity,
                        (opacity) => updateElement(selectedElement.id, { opacity }),
                        0,
                        100,
                      )}
                    </div>
                  </section>
                  <button
                    type="button"
                    onClick={() => deleteElement(selectedElement.id)}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 text-xs font-black text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {text.deleteElement}
                  </button>
                </div>
              </>
            ) : (
              <>
                <StartMenuBackgroundInspector
                  settings={coverBackgroundSettings}
                  language={language}
                  showDescriptions={false}
                  hideMusic
                  onCanvasSettingsChange={updateCoverCanvas}
                  updateWebSettings={(key, value) => updateCoverBackground(key, value)}
                />
                <div className="hidden space-y-4">
                  <section className="rounded-xl bg-[var(--vr-surface-soft)] p-3">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                      {text.background}
                    </div>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--vr-bg)] p-1">
                      {(
                        [
                          ['videoFrame', text.frame],
                          ['image', text.image],
                          ['gradient', text.gradient],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => patch({ sourceType: value })}
                          className={`h-8 rounded-md text-[10px] font-black ${cover.sourceType === value ? 'bg-[var(--vr-surface)] text-[var(--vr-accent-strong)] shadow-sm' : 'text-[var(--vr-text-muted)]'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </section>
                  {cover.sourceType === 'videoFrame' && (
                    <section className="space-y-2">
                      <label className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]">
                        <span>{text.pickVideo}</span>
                        <select
                          value={cover.videoNodeId || ''}
                          onChange={(event) => patch({ videoNodeId: event.target.value })}
                          className="h-9 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 text-xs font-bold text-[var(--vr-text)]"
                        >
                          <option value="">—</option>
                          {videoNodes.map((node) => (
                            <option key={node.id} value={node.id}>
                              {nodeLabel(node)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {numberField(
                        text.frameTime,
                        cover.frameTime,
                        (frameTime) => patch({ frameTime }),
                        0,
                        3600,
                        0.1,
                      )}
                    </section>
                  )}
                  {cover.sourceType === 'image' && (
                    <section>
                      <div className="mb-2 text-[10px] font-bold text-[var(--vr-text-muted)]">
                        {text.pickImage}
                      </div>
                      <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto">
                        {imageNodes.map((node) => {
                          const url = String(node.data?.imageUrl || '');
                          return (
                            <button
                              key={node.id}
                              type="button"
                              onClick={() => patch({ imageUrl: url })}
                              className={`aspect-square overflow-hidden rounded-lg border-2 ${cover.imageUrl === url ? 'border-[var(--vr-accent)]' : 'border-transparent'}`}
                            >
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            </button>
                          );
                        })}
                      </div>
                      {!imageNodes.length && (
                        <p className="mt-2 text-xs text-[var(--vr-text-muted)]">{text.noMedia}</p>
                      )}
                    </section>
                  )}
                  {cover.sourceType === 'gradient' && (
                    <section className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--vr-surface-soft)] p-3">
                      {(['gradientStart', 'gradientEnd'] as const).map((key) => (
                        <label
                          key={key}
                          className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]"
                        >
                          <span>{key === 'gradientStart' ? 'A' : 'B'}</span>
                          <input
                            type="color"
                            value={cover[key]}
                            onChange={(event) => patch({ [key]: event.target.value })}
                            className="h-9 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-1"
                          />
                        </label>
                      ))}
                    </section>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsDeleteCoverConfirmOpen(true)}
                    className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 text-xs font-black text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {text.deleteCover}
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
        {isDeleteCoverConfirmOpen && (
          <div className="absolute inset-0 z-[500] grid place-items-center bg-slate-950/35 p-5">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="cover-delete-title"
              className="w-full max-w-sm rounded-2xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-5 shadow-2xl"
            >
              <h3 id="cover-delete-title" className="text-base font-black text-[var(--vr-text)]">
                {text.deleteCover}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--vr-text-soft)]">{text.confirm}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteCoverConfirmOpen(false)}
                  className="h-9 rounded-lg bg-[var(--vr-surface-soft)] px-3 text-xs font-black text-[var(--vr-text-soft)] hover:bg-[var(--vr-border)]"
                >
                  {text.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    setIsDeleteCoverConfirmOpen(false);
                    onClose();
                  }}
                  className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-black text-white hover:bg-rose-700"
                >
                  {text.deleteCover}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
