import {
  Handle,
  NodeProps,
  NodeResizer,
  Position,
  useReactFlow,
  useStore,
  useStoreApi,
  useUpdateNodeInternals,
} from '@xyflow/react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Dices,
  Download,
  Globe,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  RotateCw,
  Settings2,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react';
import React, { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { SceneFlowNode, SceneImage, SceneNodeData } from '../domain/project';
import { formatSceneNodeText } from '../lib/export';
import { Language } from '../lib/i18n';
import { downloadImageUrl, getImageExtension, getSafeDownloadName } from '../lib/media';
import { PanoramaModal, PanoramaViewer } from './PanoramaViewer';

const DETAIL_TEXTAREA_CLASS =
  'w-full flex-1 min-h-[60px] h-0 resize-none overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)] text-xs p-2.5 rounded-lg outline-none border border-[var(--card-border)] focus:border-blue-600 placeholder:text-[var(--text-muted)] custom-scrollbar';
const DETAIL_FIELD_CLASS = 'flex flex-col flex-1 min-h-min gap-1';

const getNumericSize = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^-?\d+(\.\d+)?px$/.test(trimmed) || /^-?\d+(\.\d+)?$/.test(trimmed)) {
      const parsed = parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
  }

  return undefined;
};

const getCalculatedSceneNodeMinHeight = (activeDetailsCount: number, imagesCount: number) =>
  70 +
  73 +
  24 +
  26 +
  activeDetailsCount * 79 +
  Math.max(0, activeDetailsCount - 1) * 8 +
  24 +
  20 +
  (imagesCount === 0 ? 33 : imagesCount * (46 + 8) + 8);

const SCENE_NODE_MIN_WIDTH = 280;
const SCENE_NODE_HEIGHT_SAFETY = 8;

export function SceneNode({ id, data, selected }: NodeProps<SceneFlowNode>) {
  const lang = (data.language as Language) || 'zh';

  const name = data.sceneName || '';
  const description = data.description || '';
  const coverImageUrl = data.coverImageUrl;
  const isGlobal = data.isGlobal !== false;
  const isMinimized = !!data.isMinimized;
  const images = data.images || [];
  const [copied, setCopied] = useState(false);
  const [isRollingSetting, setIsRollingSetting] = useState(false);
  const [isGeneratingSettingImage, setIsGeneratingSettingImage] = useState(false);
  const contentFrameRef = useRef<HTMLDivElement>(null);
  const [measuredMinHeight, setMeasuredMinHeight] = useState(getCalculatedSceneNodeMinHeight(1, 0));
  const [expandedPanorama, setExpandedPanorama] = useState<{ url: string; title: string } | null>(
    null,
  );

  const storeApi = useStoreApi();
  const updateNodeInternals = useUpdateNodeInternals();
  const { setEdges, setNodes } = useReactFlow();
  const { nodes: currentNodes } = storeApi.getState();
  const selectionCount = currentNodes.filter((n) => n.selected).length;

  const edges = useStore((state) => state.edges);

  const getOppositeHandleId = useCallback((handleId: string) => {
    if (handleId === 'target-main') return 'source-main';
    if (handleId === 'source-main') return 'target-main';

    if (handleId.startsWith('image-in-')) {
      return handleId.replace('image-in-', 'image-out-');
    }
    if (handleId.startsWith('image-out-')) {
      return handleId.replace('image-out-', 'image-in-');
    }

    return null;
  }, []);

  const isHandleConnected = useCallback(
    (handleId: string) => {
      return edges.some(
        (edge) =>
          (edge.source === id && edge.sourceHandle === handleId) ||
          (edge.target === id && edge.targetHandle === handleId),
      );
    },
    [edges, id],
  );

  const getHandleClasses = useCallback(
    (handleId: string) => {
      const oppositeHandleId = getOppositeHandleId(handleId);
      const hasConnection = isHandleConnected(handleId);
      const oppositeHasConnection = oppositeHandleId ? isHandleConnected(oppositeHandleId) : false;
      const shouldShowRing = !hasConnection && !oppositeHasConnection;

      const ringClasses = shouldShowRing
        ? '!ring-2 !ring-offset-2 !ring-offset-[var(--card-bg)] !ring-blue-700/30'
        : '';

      return `w-3 h-3 bg-blue-700 border-2 border-[var(--card-bg)] rounded-full transition-[transform,background-color] hover:bg-blue-900 !shadow-sm ${ringClasses} z-50`;
    },
    [getOppositeHandleId, isHandleConnected],
  );

  const activeDetailsCount =
    [data.showLocation, data.showItems, data.showAtmosphere, data.showOther].filter(Boolean)
      .length || 1;

  const calculatedMinHeight = getCalculatedSceneNodeMinHeight(activeDetailsCount, images.length);
  const effectiveMinHeight = Math.max(calculatedMinHeight, measuredMinHeight);
  const hasSceneText = [
    name,
    description,
    data.location,
    data.items,
    data.atmosphere,
    data.other,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);

  const syncNodeHeightToMinimum = useCallback(
    (nextMinHeight = effectiveMinHeight) => {
      if (isMinimized) return;

      const heightToApply = Math.ceil(nextMinHeight);

      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

          const currentHeight =
            getNumericSize(node.style?.height) ??
            getNumericSize((node as any).height) ??
            getNumericSize((node as any).measured?.height);

          const currentMinHeight = getNumericSize(node.style?.minHeight);
          const shouldGrowHeight = currentHeight === undefined || currentHeight < heightToApply - 1;
          const shouldUpdateMinHeight = currentMinHeight !== heightToApply;

          if (!shouldGrowHeight && !shouldUpdateMinHeight) {
            return node;
          }

          return {
            ...node,
            style: {
              ...node.style,
              ...(shouldGrowHeight ? { height: heightToApply } : {}),
              minHeight: heightToApply,
            },
          };
        }),
      );

      requestAnimationFrame(() => {
        updateNodeInternals(id);
      });
    },
    [effectiveMinHeight, id, isMinimized, setNodes, updateNodeInternals],
  );

  const measureContentMinHeight = useCallback(() => {
    if (isMinimized || !contentFrameRef.current) return calculatedMinHeight;

    const contentHeight =
      contentFrameRef.current.scrollHeight || contentFrameRef.current.getBoundingClientRect().height;
    return Math.max(calculatedMinHeight, Math.ceil(contentHeight + SCENE_NODE_HEIGHT_SAFETY));
  }, [calculatedMinHeight, isMinimized]);

  const shouldResizeSceneNode = useCallback(
    (_event: unknown, params: { height: number; direction?: number[] }) => {
      if (isMinimized) return true;
      const isVerticalResize = !params.direction || params.direction[1] !== 0;
      if (!isVerticalResize) return true;
      return params.height >= measureContentMinHeight() - 1;
    },
    [isMinimized, measureContentMinHeight],
  );

  const updateNodeData = useCallback(
    (updates: Partial<SceneNodeData>) => {
      data.onUpdate?.(id, updates);
    },
    [data, id],
  );

  const handleDetailVisibilityChange = (
    key: 'showLocation' | 'showItems' | 'showAtmosphere' | 'showOther',
    checked: boolean,
  ) => {
    const nextVisibility = {
      showLocation: !!data.showLocation,
      showItems: !!data.showItems,
      showAtmosphere: !!data.showAtmosphere,
      showOther: !!data.showOther,
      [key]: checked,
    };

    const nextActiveDetailsCount = Object.values(nextVisibility).filter(Boolean).length || 1;
    const nextMinHeight = Math.max(
      getCalculatedSceneNodeMinHeight(nextActiveDetailsCount, images.length),
      measureContentMinHeight(),
    );

    syncNodeHeightToMinimum(nextMinHeight);
    updateNodeData({ [key]: checked });

    requestAnimationFrame(() => {
      updateNodeInternals(id);
    });
  };

  const minimizedConnectedImages = images
    .map((image) => {
      const inHandleId = `image-in-${image.id}`;
      const outHandleId = `image-out-${image.id}`;

      return {
        image,
        inHandleId,
        outHandleId,
        hasInConnection: isHandleConnected(inHandleId),
        hasOutConnection: isHandleConnected(outHandleId),
      };
    })
    .filter((item) => item.hasInConnection || item.hasOutConnection);

  const minimizedConnectedImageHandleKey = minimizedConnectedImages
    .map(
      (item) =>
        `${item.inHandleId}:${item.hasInConnection ? 1 : 0}:${item.outHandleId}:${item.hasOutConnection ? 1 : 0}`,
    )
    .join('|');

  useLayoutEffect(() => {
    const nextMeasuredMinHeight = measureContentMinHeight();
    setMeasuredMinHeight((previous) =>
      Math.abs(previous - nextMeasuredMinHeight) < 1 ? previous : nextMeasuredMinHeight,
    );
    syncNodeHeightToMinimum(Math.max(calculatedMinHeight, nextMeasuredMinHeight));
  }, [
    calculatedMinHeight,
    data.showLocation,
    data.showItems,
    data.showAtmosphere,
    data.showOther,
    images.length,
    isMinimized,
    measureContentMinHeight,
    syncNodeHeightToMinimum,
  ]);

  useLayoutEffect(() => {
    updateNodeInternals(id);

    const rafId = requestAnimationFrame(() => {
      updateNodeInternals(id);
    });

    return () => cancelAnimationFrame(rafId);
  }, [
    images.length,
    isMinimized,
    isGlobal,
    data.showLocation,
    data.showItems,
    data.showAtmosphere,
    data.showOther,
    minimizedConnectedImageHandleKey,
    id,
    updateNodeInternals,
  ]);

  const toggleGlobal = () => {
    const newGlobal = !isGlobal;
    updateNodeData({ isGlobal: newGlobal });

    if (newGlobal) {
      setEdges((edges) =>
        edges.filter((edge) => {
          if (
            edge.source === id &&
            (edge.sourceHandle === 'source-main' || edge.sourceHandle === 'target-main')
          )
            return false;
          if (
            edge.target === id &&
            (edge.targetHandle === 'source-main' || edge.targetHandle === 'target-main')
          )
            return false;
          return true;
        }),
      );
    }
  };

  const handleMediaUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    imageId?: string,
    asCover?: boolean,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);

    if (imageId) {
      updateNodeData({
        images: images.map((img) =>
          img.id === imageId
            ? file.type.startsWith('video/')
              ? { ...img, imageUrl: undefined, videoUrl: url, isPanorama: false }
              : { ...img, imageUrl: url, videoUrl: undefined }
            : img,
        ),
      });
    } else if (asCover && file.type.startsWith('image/')) {
      updateNodeData({ coverImageUrl: url });
    }
    e.target.value = '';
  };

  const addImage = () => {
    updateNodeData({
      images: [...images, { id: uuidv4(), name: lang === 'zh' ? '场景素材' : 'Scene Media' }],
    });
  };

  const updateImageName = (imageId: string, imageName: string) => {
    updateNodeData({
      images: images.map((img) => (img.id === imageId ? { ...img, name: imageName } : img)),
    });
  };

  const removeImage = (imageId: string) => {
    updateNodeData({
      images: images.filter((img) => img.id !== imageId),
    });
  };

  const handleCopyExport = async () => {
    const sceneName = name || (lang === 'zh' ? '未命名场景' : 'Unnamed Scene');
    const body = formatSceneNodeText(data);
    const text =
      lang === 'zh' ? `### 场景：${sceneName}\n\n${body}` : `### Scene: ${sceneName}\n\n${body}`;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // fallback
      }
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRollSetting = async () => {
    if (!data.onGenerateSettingText || isRollingSetting) return;

    setIsRollingSetting(true);
    try {
      await data.onGenerateSettingText(id, 'scene');
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      console.error('Scene setting roll failed:', error);
      alert(
        lang === 'zh'
          ? `场景设定生成失败：${message || '请检查 AI 配置和网络连接'}`
          : `Scene setting generation failed: ${message || 'check AI settings and network'}`,
      );
    } finally {
      setIsRollingSetting(false);
    }
  };

  const handleGenerateSettingImage = async () => {
    if (!data.onGenerateSettingImage || isGeneratingSettingImage || !hasSceneText) return;

    setIsGeneratingSettingImage(true);
    try {
      await data.onGenerateSettingImage(id, 'scene');
    } finally {
      setIsGeneratingSettingImage(false);
    }
  };

  const handleDownloadCoverImage = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!coverImageUrl) return;

    const safeName = getSafeDownloadName(
      `${name || (lang === 'zh' ? '场景' : lang === 'ja' ? 'シーン' : 'scene')}-场景图`,
    );
    await downloadImageUrl(coverImageUrl, `${safeName}.${getImageExtension(coverImageUrl)}`);
  };

  const handleDownloadSceneImage = async (
    event: React.MouseEvent<HTMLButtonElement>,
    image: SceneImage,
  ) => {
    event.stopPropagation();
    if (!image.imageUrl) return;

    const fallbackLabel = lang === 'zh' ? '场景图片' : 'scene-image';
    const safeName = getSafeDownloadName(
      `${name || (lang === 'zh' ? '场景' : 'scene')}-${image.name || fallbackLabel}`,
    );
    await downloadImageUrl(image.imageUrl, `${safeName}.${getImageExtension(image.imageUrl)}`);
  };

  return (
    <>
      <div
        data-agent-node-id={id}
        className={`w-full bg-[var(--card-bg)] rounded-xl shadow-lg border-2 transition-all group ${selected ? 'border-blue-800 ring-2 ring-blue-800/30' : 'border-[var(--card-border)]'} flex flex-col relative`}
        style={{
          height: isMinimized ? 'auto' : '100%',
          minHeight: isMinimized ? 'auto' : effectiveMinHeight,
          minWidth: `${SCENE_NODE_MIN_WIDTH}px`,
          overflow: 'visible',
        }}
      >
        <NodeResizer
          minWidth={SCENE_NODE_MIN_WIDTH}
          minHeight={effectiveMinHeight}
          shouldResize={shouldResizeSceneNode}
          isVisible={!isMinimized && selected && selectionCount === 1}
          lineStyle={{ border: 'none' }}
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-blue-800 !rounded-full"
        />

        <div ref={contentFrameRef} className="flex flex-col w-full h-full rounded-xl">
          <div className="bg-[var(--header-bg)] rounded-t-xl border-b border-[var(--header-border)] px-3 py-2 flex items-center justify-between z-10 relative cursor-grab active:cursor-grabbing shrink-0">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-800" />
              <span className="text-xs font-bold text-[var(--text-primary)] tracking-tight">
                {lang === 'zh' ? '场景设定' : lang === 'ja' ? 'シーン設定' : 'Scene Setting'}
              </span>
            </div>
            <div className="flex gap-1 items-center">
              <button
                onClick={handleCopyExport}
                className={`px-1.5 py-1 rounded transition-colors flex items-center justify-center ${copied ? 'text-emerald-500 hover:bg-emerald-500/20' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)]'}`}
                title={
                  copied
                    ? lang === 'zh'
                      ? '已复制'
                      : 'Copied'
                    : lang === 'zh'
                      ? '复制场景设定'
                      : 'Copy scene setting'
                }
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
              <button
                onClick={toggleGlobal}
                className={`px-1.5 py-1 rounded transition-colors flex items-center justify-center ${isGlobal ? 'text-emerald-500 hover:bg-emerald-500/20' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)]'}`}
                title={
                  isGlobal
                    ? lang === 'zh'
                      ? '已设为全局场景'
                      : 'Global scene'
                    : lang === 'zh'
                      ? '设为全局场景'
                      : 'Set as global scene'
                }
              >
                <Globe className="w-3 h-3" />
              </button>
              <button
                onClick={() => updateNodeData({ isMinimized: !isMinimized })}
                className="px-1.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)] rounded transition-colors flex items-center justify-center"
              >
                {isMinimized ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => data.onDelete?.(id)}
                className="px-1.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors flex items-center justify-center"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="flex flex-col nodrag flex-1 min-h-min">
              <div className="flex items-center gap-3 p-3 border-b border-[var(--card-border)] bg-blue-50/10 dark:bg-blue-950/20 shrink-0">
                <div className="relative group/cover shrink-0">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-blue-300 dark:border-blue-800 bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                    {coverImageUrl ? (
                      <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <MapPin className="w-6 h-6 text-blue-700" />
                    )}
                  </div>
                  <div className="absolute inset-0 overflow-hidden rounded-lg bg-black/50 opacity-0 transition-opacity group-hover/cover:opacity-100">
                    <div className="flex h-full items-stretch">
                      <label
                        className="flex flex-1 cursor-pointer items-center justify-center border-r border-white/30 text-white transition-colors hover:bg-white/20"
                        title={lang === 'zh' ? '上传场景图片' : 'Upload scene image'}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleMediaUpload(e, undefined, true)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleDownloadCoverImage}
                        disabled={!coverImageUrl}
                        className="flex flex-1 items-center justify-center text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                        title={lang === 'zh' ? '下载场景图片' : 'Download scene image'}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <input
                    data-agent-field="scene-name"
                    type="text"
                    value={name}
                    onChange={(e) => updateNodeData({ sceneName: e.target.value })}
                    placeholder={lang === 'zh' ? '输入场景名称...' : 'Enter scene name...'}
                    className="w-full bg-transparent text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-b-2 focus:border-blue-700"
                  />
                  <div className="text-[10px] text-blue-800 font-medium flex items-center gap-1 mt-1">
                    <Settings2 className="w-3 h-3" />
                    {isGlobal
                      ? lang === 'zh'
                        ? '全局设定生效中'
                        : lang === 'ja'
                          ? 'グローバル設定が有効'
                          : 'Global setting active'
                      : lang === 'zh'
                        ? '需连线生效'
                        : lang === 'ja'
                          ? '接続すると有効'
                          : 'Connect to activate'}
                  </div>
                </div>
                <button
                  onClick={handleRollSetting}
                  disabled={isRollingSetting}
                  className={`shrink-0 w-8 h-8 rounded-lg transition-colors flex items-center justify-center border border-blue-800/20 ${isRollingSetting ? 'text-blue-800 bg-blue-800/10 cursor-wait' : 'text-blue-800 hover:text-blue-900 hover:bg-blue-800/10'}`}
                  title={lang === 'zh' ? '摇色子生成/扩写场景设定' : 'Roll scene setting'}
                >
                  {isRollingSetting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Dices className="w-4 h-4" />
                  )}
                </button>
                {hasSceneText && (
                  <button
                    onClick={handleGenerateSettingImage}
                    disabled={isGeneratingSettingImage}
                    className={`shrink-0 w-8 h-8 rounded-lg transition-colors flex items-center justify-center border border-cyan-500/20 ${isGeneratingSettingImage ? 'text-cyan-600 bg-cyan-500/10 cursor-wait' : 'text-cyan-600 hover:text-cyan-700 hover:bg-cyan-500/10'}`}
                    title={
                      lang === 'zh' ? '根据场景设定一键生图' : 'Generate image from scene setting'
                    }
                  >
                    {isGeneratingSettingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <WandSparkles className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              <div className="px-3 pt-3 pb-3 flex flex-col flex-1 min-h-min">
                <div className="flex flex-wrap items-center gap-3 ml-1 mb-2 shrink-0">
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={!!data.showLocation}
                      onChange={(e) =>
                        handleDetailVisibilityChange('showLocation', e.target.checked)
                      }
                      className="rounded border-[var(--card-border)] text-blue-800 focus:ring-blue-800 bg-[var(--card-bg)]"
                    />
                    {lang === 'zh' ? '位置描写' : 'Location'}
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={!!data.showItems}
                      onChange={(e) => handleDetailVisibilityChange('showItems', e.target.checked)}
                      className="rounded border-[var(--card-border)] text-blue-800 focus:ring-blue-800 bg-[var(--card-bg)]"
                    />
                    {lang === 'zh' ? '场景物品' : 'Items'}
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={!!data.showAtmosphere}
                      onChange={(e) =>
                        handleDetailVisibilityChange('showAtmosphere', e.target.checked)
                      }
                      className="rounded border-[var(--card-border)] text-blue-800 focus:ring-blue-800 bg-[var(--card-bg)]"
                    />
                    {lang === 'zh' ? '氛围环境' : 'Atmosphere'}
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={!!data.showOther}
                      onChange={(e) => handleDetailVisibilityChange('showOther', e.target.checked)}
                      className="rounded border-[var(--card-border)] text-blue-800 focus:ring-blue-800 bg-[var(--card-bg)]"
                    />
                    {lang === 'zh' ? '其他' : 'Other'}
                  </label>
                </div>

                <div className="flex flex-col flex-1 min-h-min gap-2">
                  {data.showLocation && (
                    <div className={DETAIL_FIELD_CLASS}>
                      <label className="block text-[10px] font-bold text-blue-800 ml-1 shrink-0">
                        {lang === 'zh' ? '位置描写' : 'Location Description'}
                      </label>
                      <textarea
                        data-agent-field="location"
                        value={data.location || ''}
                        onChange={(e) => updateNodeData({ location: e.target.value })}
                        placeholder={
                          lang === 'zh'
                            ? '例如：位于学校后山的小树林，阳光透过树叶洒落...'
                            : 'e.g. A small grove behind the school...'
                        }
                        className={DETAIL_TEXTAREA_CLASS}
                      />
                    </div>
                  )}
                  {data.showItems && (
                    <div className={DETAIL_FIELD_CLASS}>
                      <label className="block text-[10px] font-bold text-blue-800 ml-1 shrink-0 flex items-center gap-1">
                        {lang === 'zh' ? '场景物品' : 'Scene Items'}
                      </label>
                      <textarea
                        data-agent-field="items"
                        value={data.items || ''}
                        onChange={(e) => updateNodeData({ items: e.target.value })}
                        placeholder={
                          lang === 'zh'
                            ? '例如：旧木长椅、生锈的秋千、散落的落叶...'
                            : 'e.g. Old wooden bench, rusty swing...'
                        }
                        className={DETAIL_TEXTAREA_CLASS}
                      />
                    </div>
                  )}
                  {data.showAtmosphere && (
                    <div className={DETAIL_FIELD_CLASS}>
                      <label className="block text-[10px] font-bold text-blue-800 ml-1 shrink-0">
                        {lang === 'zh' ? '氛围环境' : 'Atmosphere'}
                      </label>
                      <textarea
                        data-agent-field="atmosphere"
                        value={data.atmosphere || ''}
                        onChange={(e) => updateNodeData({ atmosphere: e.target.value })}
                        placeholder={
                          lang === 'zh'
                            ? '例如：安静、略带忧伤的午后，远处传来鸟鸣...'
                            : 'e.g. Quiet afternoon, birds chirping in the distance...'
                        }
                        className={DETAIL_TEXTAREA_CLASS}
                      />
                    </div>
                  )}
                  {data.showOther && (
                    <div className={DETAIL_FIELD_CLASS}>
                      <label className="block text-[10px] font-bold text-blue-800 ml-1 shrink-0">
                        {lang === 'zh' ? '其他' : 'Other'}
                      </label>
                      <textarea
                        data-agent-field="other"
                        value={data.other || ''}
                        onChange={(e) => updateNodeData({ other: e.target.value })}
                        placeholder={lang === 'zh' ? '其他场景细节...' : 'Other scene details...'}
                        className={DETAIL_TEXTAREA_CLASS}
                      />
                    </div>
                  )}

                  {!data.showLocation &&
                    !data.showItems &&
                    !data.showAtmosphere &&
                    !data.showOther && (
                      <div className={DETAIL_FIELD_CLASS}>
                        <label className="block text-[10px] font-bold text-blue-800 ml-1 shrink-0">
                          {lang === 'zh' ? '综合描述' : 'General Description'}
                        </label>
                        <textarea
                          data-agent-field="description"
                          value={description}
                          onChange={(e) => updateNodeData({ description: e.target.value })}
                          placeholder={
                            lang === 'zh'
                              ? '例如：学校后山的小树林，阳光透过树叶...'
                              : 'Describe the scene...'
                          }
                          className={DETAIL_TEXTAREA_CLASS}
                        />
                      </div>
                    )}
                </div>
              </div>

              <div className="p-3 flex flex-col gap-2 relative shrink-0 min-h-[100px] rounded-b-xl border-t border-[var(--card-border)] bg-[var(--card-bg)]">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[var(--text-secondary)] ml-1">
                    {lang === 'zh' ? '场景照片 / 视频' : 'Scene Photos / Videos'}
                  </label>
                  <button
                    onClick={addImage}
                    className="text-blue-800 hover:text-blue-900 hover:bg-blue-800/10 p-1 rounded transition-colors"
                    title={lang === 'zh' ? '添加照片或视频' : 'Add photo or video'}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {images.length === 0 ? (
                  <div className="text-[10px] text-[var(--text-muted)] text-center py-2 bg-[var(--app-bg)] rounded-lg border border-dashed border-[var(--card-border)]">
                    {lang === 'zh'
                      ? '暂无照片或视频，点击右上角 + 添加'
                      : 'No photos or videos yet, click + to add'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {images.map((image) => (
                      <div
                        key={image.id}
                        className="relative flex flex-col gap-1.5 bg-[var(--app-bg)] p-1.5 rounded-lg border border-[var(--card-border)] group/image"
                      >
                        <div className="flex items-center gap-2">
                          {!image.isPanorama ? (
                            <label className="relative cursor-pointer shrink-0 w-8 h-8 rounded-md overflow-hidden bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center border border-blue-300 dark:border-blue-800">
                              {image.videoUrl ? (
                                <video
                                  src={image.videoUrl}
                                  className="w-full h-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              ) : image.imageUrl ? (
                                <img
                                  src={image.imageUrl}
                                  className="w-full h-full object-cover"
                                  alt={image.name}
                                />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5 text-blue-700" />
                              )}
                              <input
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={(e) => handleMediaUpload(e, image.id)}
                              />
                            </label>
                          ) : (
                            <div className="shrink-0 w-8 h-8 rounded-md overflow-hidden border border-blue-700/50 flex items-center justify-center bg-blue-950/30">
                              {image.imageUrl ? (
                                <img
                                  src={image.imageUrl}
                                  className="w-full h-full object-cover opacity-80"
                                  alt={image.name}
                                />
                              ) : (
                                <RotateCw className="w-3.5 h-3.5 text-blue-700" />
                              )}
                            </div>
                          )}
                          <input
                            type="text"
                            value={image.name}
                            onChange={(e) => updateImageName(image.id, e.target.value)}
                            placeholder={lang === 'zh' ? '素材名称' : 'Media name'}
                            className="flex-1 bg-transparent text-[11px] text-[var(--text-primary)] outline-none focus:border-b focus:border-blue-700 min-w-0"
                          />
                          <label
                            className="cursor-pointer rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-blue-800/10 hover:text-blue-800 group-hover/image:opacity-100"
                            title={lang === 'zh' ? '上传照片或视频' : 'Upload photo or video'}
                          >
                            <Upload className="w-3 h-3" />
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={(e) => handleMediaUpload(e, image.id)}
                            />
                          </label>
                          {image.imageUrl && (
                            <button
                              onClick={(event) => handleDownloadSceneImage(event, image)}
                              className="opacity-0 group-hover/image:opacity-100 p-1 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 rounded transition-opacity"
                              title={lang === 'zh' ? '下载场景图片' : 'Download scene image'}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => removeImage(image.id)}
                            className="opacity-0 group-hover/image:opacity-100 p-1 text-red-400 hover:text-red-500 transition-opacity"
                            title={lang === 'zh' ? '删除此图片' : 'Remove image'}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <Handle
                            type="source"
                            position={Position.Left}
                            id={`image-in-${image.id}`}
                            className={getHandleClasses(`image-in-${image.id}`)}
                            style={{ top: '50%', left: '-13px' }}
                          />
                          <Handle
                            type="source"
                            position={Position.Right}
                            id={`image-out-${image.id}`}
                            className={getHandleClasses(`image-out-${image.id}`)}
                            style={{ top: '50%', right: '-13px' }}
                          />
                        </div>

                        {image.imageUrl && image.isPanorama && (
                          <PanoramaViewer
                            imageUrl={image.imageUrl}
                            compact
                            onExpand={() =>
                              setExpandedPanorama({ url: image.imageUrl!, title: image.name })
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {isMinimized && (
          <div className="px-3 py-2 flex items-center gap-2 bg-blue-50/10 dark:bg-blue-950/20 shrink-0">
            <div className="w-5 h-5 rounded-md overflow-hidden bg-blue-200 shrink-0 flex items-center justify-center">
              {coverImageUrl ? (
                <img src={coverImageUrl} className="w-full h-full object-cover" />
              ) : (
                <MapPin className="w-3 h-3 text-blue-800" />
              )}
            </div>
            <span className="text-[10px] text-[var(--text-primary)] font-bold truncate">
              {name || (lang === 'zh' ? '未命名场景' : 'Unnamed Scene')}
            </span>
          </div>
        )}

        {isMinimized &&
          minimizedConnectedImages.map((item) => (
            <React.Fragment key={item.image.id}>
              {item.hasInConnection && (
                <Handle
                  type="source"
                  position={Position.Left}
                  id={item.inHandleId}
                  className={getHandleClasses(item.inHandleId)}
                  style={{ top: '50%' }}
                />
              )}
              {item.hasOutConnection && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={item.outHandleId}
                  className={getHandleClasses(item.outHandleId)}
                  style={{ top: '50%' }}
                />
              )}
            </React.Fragment>
          ))}

        {!isGlobal && (
          <>
            <Handle
              type="source"
              position={Position.Left}
              id="target-main"
              className={getHandleClasses('target-main')}
              style={{ top: isMinimized ? '50%' : '65px' }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id="source-main"
              className={getHandleClasses('source-main')}
              style={{ top: isMinimized ? '50%' : '65px' }}
            />
          </>
        )}
      </div>

      {expandedPanorama && (
        <PanoramaModal
          imageUrl={expandedPanorama.url}
          title={expandedPanorama.title}
          onClose={() => setExpandedPanorama(null)}
        />
      )}
    </>
  );
}

export const MemoizedSceneNode = memo(SceneNode);
