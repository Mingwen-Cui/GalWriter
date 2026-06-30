import {
  Handle,
  NodeProps,
  NodeResizer,
  NodeToolbar,
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
  Eraser,
  Globe,
  Image as ImageIcon,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  Upload,
  UserCircle2,
  WandSparkles,
} from 'lucide-react';
import React, { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useDialog } from '../editor-shell/DialogProvider';
import { formatCharacterNodeText } from '../lib/export';
import { Language, translations } from '../lib/i18n';
import { downloadImageUrl, getImageExtension, getSafeDownloadName } from '../lib/media';
import type { CharacterFlowNode, CharacterNodeData } from '../domain/project';

const TRAIT_TEXTAREA_CLASS =
  'w-full flex-1 min-h-[60px] h-0 resize-none overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)] text-xs p-2.5 rounded-lg outline-none border border-[var(--card-border)] focus:border-purple-400 placeholder:text-[var(--text-muted)] custom-scrollbar';
const TRAIT_FIELD_CLASS = 'flex flex-col flex-1 min-h-min gap-1';

const getNumericSize = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();

    // 不要把 100% 当成 100px，否则会误判当前高度。
    if (/^-?\d+(\.\d+)?px$/.test(trimmed) || /^-?\d+(\.\d+)?$/.test(trimmed)) {
      const parsed = parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
  }

  return undefined;
};

const getCalculatedCharacterNodeMinHeight = (activeTraitsCount: number, outfitsCount: number) =>
  70 +
  73 +
  24 +
  26 +
  activeTraitsCount * 79 +
  Math.max(0, activeTraitsCount - 1) * 8 +
  24 +
  20 +
  (outfitsCount === 0 ? 33 : outfitsCount * 46 + (outfitsCount - 1) * 8);

const CHARACTER_NODE_MIN_WIDTH = 280;
const CHARACTER_NODE_HEIGHT_SAFETY = 8;

export function CharacterNode({ id, data, selected }: NodeProps<CharacterFlowNode>) {
  const { alert: showDialogAlert } = useDialog();
  const lang = (data.language as Language) || 'zh';
  const t = translations[lang];

  const name = data.characterName || '';
  const traits = data.traits || '';
  const avatarUrl = data.avatarUrl;
  const isGlobal = data.isGlobal !== false; // Default to true
  const cardToolbarScale =
    typeof data.cardToolbarScale === 'number' && Number.isFinite(data.cardToolbarScale)
      ? data.cardToolbarScale
      : 1;

  const isMinimized = !!data.isMinimized;
  const outfits = data.outfits || [];
  const [copied, setCopied] = useState(false);
  const [isRollingSetting, setIsRollingSetting] = useState(false);
  const [isGeneratingSettingImage, setIsGeneratingSettingImage] = useState(false);
  const [isRemovingAvatarBackground, setIsRemovingAvatarBackground] = useState(false);
  const [removingOutfitBackgroundId, setRemovingOutfitBackgroundId] = useState<string | null>(null);
  const contentFrameRef = useRef<HTMLDivElement>(null);
  const [measuredMinHeight, setMeasuredMinHeight] = useState(
    getCalculatedCharacterNodeMinHeight(1, 0),
  );

  const storeApi = useStoreApi();
  const updateNodeInternals = useUpdateNodeInternals();
  const { setEdges, setNodes } = useReactFlow();
  const { nodes: currentNodes } = storeApi.getState();
  const selectionCount = currentNodes.filter((n) => n.selected).length;

  // 读取当前连线，用于判断每个连接点是否已经连上。
  // 未连接时显示外圈圆环，连接后圆环自动消失。
  const edges = useStore((state) => state.edges);

  const getOppositeHandleId = useCallback((handleId: string) => {
    // 主连接点：左 target-main，右 source-main。
    if (handleId === 'target-main') return 'source-main';
    if (handleId === 'source-main') return 'target-main';

    // 服装连接点：左 outfit-in-xxx，右 outfit-out-xxx。
    if (handleId.startsWith('outfit-in-')) {
      return handleId.replace('outfit-in-', 'outfit-out-');
    }

    if (handleId.startsWith('outfit-out-')) {
      return handleId.replace('outfit-out-', 'outfit-in-');
    }

    return null;
  }, []);

  const isHandleConnected = useCallback(
    (handleId: string) => {
      // 不只判断 source，也判断 target。
      // 这样即使这个 Handle 是被别人连过来的，圆环也会正确消失。
      return edges.some(
        (edge) =>
          (edge.source === id && edge.sourceHandle === handleId) ||
          (edge.target === id && edge.targetHandle === handleId),
      );
    },
    [edges, id],
  );

  const getHandleClasses = useCallback(
    (handleId: string, _type: 'target' | 'source') => {
      const oppositeHandleId = getOppositeHandleId(handleId);

      const hasConnection = isHandleConnected(handleId);
      const oppositeHasConnection = oppositeHandleId ? isHandleConnected(oppositeHandleId) : false;

      // 同一组左右连接点，只要任意一边已经连线，两边都不再显示外层圆环。
      // 例如左边 outfit-in 已连接，则右边 outfit-out 也取消圆环；反之同理。
      const shouldShowRing = !hasConnection && !oppositeHasConnection;

      const ringClasses = shouldShowRing
        ? '!ring-2 !ring-offset-2 !ring-offset-[var(--card-bg)] !ring-purple-500/30'
        : '';

      return `w-3 h-3 bg-indigo-400 bg-indigo-400 border-2 border-[var(--card-bg)] rounded-full transition-[transform,background-color] hover:bg-indigo-600 !shadow-sm ${ringClasses} z-50`;
    },
    [getOppositeHandleId, isHandleConnected],
  );

  const activeTraitsCount =
    [data.showPersonality, data.showFeatures, data.showBackground, data.showOther].filter(Boolean)
      .length || 1;

  const calculatedMinHeight = getCalculatedCharacterNodeMinHeight(
    activeTraitsCount,
    outfits.length,
  );
  const effectiveMinHeight = Math.max(calculatedMinHeight, measuredMinHeight);
  const hasCharacterText = [
    name,
    traits,
    data.personality,
    data.features,
    data.background,
    data.other,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);

  const syncNodeHeightToMinimum = useCallback(
    (nextMinHeight = effectiveMinHeight, allowShrink = false) => {
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
          const shouldApplyHeight =
            allowShrink || currentHeight === undefined || currentHeight < heightToApply - 1;
          const shouldUpdateMinHeight = currentMinHeight !== heightToApply;

          if (!shouldApplyHeight && !shouldUpdateMinHeight) {
            return node;
          }

          return {
            ...node,
            style: {
              ...node.style,
              ...(shouldApplyHeight ? { height: heightToApply } : {}),
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
      contentFrameRef.current.scrollHeight ||
      contentFrameRef.current.getBoundingClientRect().height;
    return Math.max(calculatedMinHeight, Math.ceil(contentHeight + CHARACTER_NODE_HEIGHT_SAFETY));
  }, [calculatedMinHeight, isMinimized]);

  const shouldResizeCharacterNode = useCallback(
    (_event: unknown, params: { height: number; direction?: number[] }) => {
      if (isMinimized) return true;
      const isVerticalResize = !params.direction || params.direction[1] !== 0;
      if (!isVerticalResize) return true;
      return params.height >= measureContentMinHeight() - 1;
    },
    [isMinimized, measureContentMinHeight],
  );

  const updateNodeData = useCallback(
    (updates: Partial<CharacterNodeData>) => {
      data.onUpdate?.(id, updates);
    },
    [data, id],
  );

  const handleTraitVisibilityChange = (
    key: 'showPersonality' | 'showFeatures' | 'showBackground' | 'showOther',
    checked: boolean,
  ) => {
    const nextVisibility = {
      showPersonality: !!data.showPersonality,
      showFeatures: !!data.showFeatures,
      showBackground: !!data.showBackground,
      showOther: !!data.showOther,
      [key]: checked,
    };

    const nextActiveTraitsCount = Object.values(nextVisibility).filter(Boolean).length || 1;
    const nextMinHeight = Math.max(
      getCalculatedCharacterNodeMinHeight(nextActiveTraitsCount, outfits.length),
      measureContentMinHeight(),
    );

    // 只按公式同步一次最小高度，不再使用 scrollHeight 反复测量。
    // 这样既能让 NodeResizer 立即跟上，也不会出现高度无限变高。
    syncNodeHeightToMinimum(nextMinHeight);
    updateNodeData({ [key]: checked });

    requestAnimationFrame(() => {
      updateNodeInternals(id);
    });
  };

  const minimizedConnectedOutfits = outfits
    .map((outfit) => {
      const inHandleId = `outfit-in-${outfit.id}`;
      const outHandleId = `outfit-out-${outfit.id}`;

      return {
        outfit,
        inHandleId,
        outHandleId,
        hasInConnection: isHandleConnected(inHandleId),
        hasOutConnection: isHandleConnected(outHandleId),
      };
    })
    .filter((item) => item.hasInConnection || item.hasOutConnection);

  const minimizedOutfitHandleStyle = { top: '50%' };

  const minimizedConnectedOutfitHandleKey = minimizedConnectedOutfits
    .map(
      (item) =>
        `${item.inHandleId}:${item.hasInConnection ? 1 : 0}:${item.outHandleId}:${item.hasOutConnection ? 1 : 0}`,
    )
    .join('|');

  /**
   * 文本框勾选、服装新增、折叠展开等会让内容高度发生变化。
   * 这里按“公式高度”同步到 React Flow 节点 style。
   * 注意：不要持续读取 scrollHeight，否则会和 height: 100% 形成反馈循环，导致高度一直变高。
   */
  useLayoutEffect(() => {
    const nextMeasuredMinHeight = measureContentMinHeight();
    setMeasuredMinHeight((previous) =>
      Math.abs(previous - nextMeasuredMinHeight) < 1 ? previous : nextMeasuredMinHeight,
    );
    syncNodeHeightToMinimum(Math.max(calculatedMinHeight, nextMeasuredMinHeight));
  }, [
    calculatedMinHeight,
    data.showPersonality,
    data.showFeatures,
    data.showBackground,
    data.showOther,
    outfits.length,
    isMinimized,
    measureContentMinHeight,
    syncNodeHeightToMinimum,
  ]);

  useLayoutEffect(() => {
    if (!data.assistantAutoHeightNonce) return;
    syncNodeHeightToMinimum(calculatedMinHeight, true);
  }, [calculatedMinHeight, data.assistantAutoHeightNonce, syncNodeHeightToMinimum]);

  /**
   * React Flow 会缓存每个 Handle 的位置。
   * 从“全局模式”切到“连线模式”时，主连接点是条件渲染出来的，
   * 如果不立刻刷新 node internals，就会出现短时间内看得到点、但线拖不出来的情况。
   */
  useLayoutEffect(() => {
    updateNodeInternals(id);

    const rafId = requestAnimationFrame(() => {
      updateNodeInternals(id);
    });

    return () => cancelAnimationFrame(rafId);
  }, [
    outfits.length,
    isMinimized,
    isGlobal,
    data.showPersonality,
    data.showFeatures,
    data.showBackground,
    data.showOther,
    minimizedConnectedOutfitHandleKey,
    id,
    updateNodeInternals,
  ]);

  const toggleGlobal = () => {
    const newGlobal = !isGlobal;
    updateNodeData({ isGlobal: newGlobal });

    if (newGlobal) {
      // Remove edges connected to main handles if switching to global
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, outfitId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (outfitId) {
      updateNodeData({
        outfits: outfits.map((o) => (o.id === outfitId ? { ...o, imageUrl: url } : o)),
      });
    } else {
      updateNodeData({ avatarUrl: url });
    }
  };

  const addOutfit = () => {
    updateNodeData({
      outfits: [...outfits, { id: uuidv4(), name: '新服装' }],
    });
  };

  const updateOutfitName = (outfitId: string, name: string) => {
    updateNodeData({
      outfits: outfits.map((o) => (o.id === outfitId ? { ...o, name } : o)),
    });
  };

  const removeOutfit = (outfitId: string) => {
    updateNodeData({
      outfits: outfits.filter((o) => o.id !== outfitId),
    });
  };

  const handleCopyExport = async () => {
    const charName = name || '未命名角色';
    const body = formatCharacterNodeText(data);
    const text = `### 角色：${charName}\n\n${body}`;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // 降级到 execCommand
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
      await data.onGenerateSettingText(id, 'character');
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      console.error('Character setting roll failed:', error);
      await showDialogAlert({
        title:
          lang === 'zh'
            ? '人物设定生成失败'
            : lang === 'ja'
              ? 'キャラクター設定の生成に失敗しました'
              : 'Character setting generation failed',
        description:
          message ||
          (lang === 'zh'
            ? '请检查 AI 配置和网络连接'
            : lang === 'ja'
              ? 'AI 設定とネットワーク接続を確認してください'
              : 'Check AI settings and network connection.'),
        tone: 'warning',
      });
    } finally {
      setIsRollingSetting(false);
    }
  };

  const handleGenerateSettingImage = async () => {
    if (!data.onGenerateSettingImage || isGeneratingSettingImage || !hasCharacterText) return;

    setIsGeneratingSettingImage(true);
    try {
      await data.onGenerateSettingImage(id, 'character');
    } finally {
      setIsGeneratingSettingImage(false);
    }
  };

  const handleDownloadAvatarImage = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!avatarUrl) return;

    const safeName = getSafeDownloadName(
      `${name || (lang === 'zh' ? '人物' : lang === 'ja' ? 'キャラクター' : 'character')}-立绘`,
    );
    await downloadImageUrl(avatarUrl, `${safeName}.${getImageExtension(avatarUrl)}`);
  };

  const handleRemoveAvatarBackground = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!avatarUrl || !data.onRemoveCharacterImageBackground || isRemovingAvatarBackground) return;

    setIsRemovingAvatarBackground(true);
    try {
      await data.onRemoveCharacterImageBackground(id);
    } finally {
      setIsRemovingAvatarBackground(false);
    }
  };

  const handleRemoveOutfitBackground = async (
    event: React.MouseEvent<HTMLButtonElement>,
    outfitId: string,
  ) => {
    event.stopPropagation();
    if (!data.onRemoveCharacterImageBackground || removingOutfitBackgroundId) return;

    setRemovingOutfitBackgroundId(outfitId);
    try {
      await data.onRemoveCharacterImageBackground(id, outfitId);
    } finally {
      setRemovingOutfitBackgroundId(null);
    }
  };

  const handleDownloadOutfitImage = async (
    event: React.MouseEvent<HTMLButtonElement>,
    outfit: { id: string; name: string; imageUrl?: string },
  ) => {
    event.stopPropagation();
    if (!outfit.imageUrl) return;

    const fallbackLabel = lang === 'zh' ? '人物图片' : 'character-image';
    const safeName = getSafeDownloadName(
      `${name || (lang === 'zh' ? '角色' : 'character')}-${outfit.name || fallbackLabel}`,
    );
    await downloadImageUrl(outfit.imageUrl, `${safeName}.${getImageExtension(outfit.imageUrl)}`);
  };

  return (
    <div
      data-agent-node-id={id}
      className={`w-full bg-[var(--card-bg)] rounded-xl shadow-lg border-2 transition-all group ${selected ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-[var(--card-border)]'} flex flex-col relative`}
      style={{
        height: isMinimized ? 'auto' : '100%',
        minHeight: isMinimized ? 'auto' : effectiveMinHeight,
        minWidth: `${CHARACTER_NODE_MIN_WIDTH}px`,
        overflow: 'visible',
      }}
    >
      <NodeResizer
        minWidth={CHARACTER_NODE_MIN_WIDTH}
        minHeight={effectiveMinHeight}
        shouldResize={shouldResizeCharacterNode}
        isVisible={!isMinimized && selected && selectionCount === 1}
        lineStyle={{ border: 'none' }}
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-purple-500 !rounded-full"
      />

      <div ref={contentFrameRef} className="flex flex-col w-full h-full rounded-xl">
        {/* Header with Buttons */}
        <div className="bg-[var(--header-bg)] rounded-t-xl border-b border-[var(--header-border)] px-3 py-2 flex items-center justify-between z-10 relative cursor-grab active:cursor-grabbing shrink-0">
          <div className="flex items-center gap-2">
            <UserCircle2 className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-bold text-[var(--text-primary)] tracking-tight">
              {lang === 'zh'
                ? '人物设定'
                : lang === 'ja'
                  ? 'キャラクター設定'
                  : 'Character Setting'}
            </span>
          </div>
          <div className="flex gap-1 items-center">
            <button
              onClick={handleCopyExport}
              className={`px-1.5 py-1 rounded transition-colors flex items-center justify-center ${copied ? 'text-emerald-500 hover:bg-emerald-500/20' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)]'}`}
              title={copied ? '已复制' : '复制人物设定'}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
            <button
              onClick={toggleGlobal}
              className={`px-1.5 py-1 rounded transition-colors flex items-center justify-center ${isGlobal ? 'text-emerald-500 hover:bg-emerald-500/20' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)]'}`}
              title={isGlobal ? '已设为全局角色' : '设为全局角色'}
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
            {/* Avatar and Name */}
            <div className="flex items-center gap-3 p-3 border-b border-[var(--card-border)] bg-purple-50/10 dark:bg-purple-900/10 shrink-0">
              <div className="relative group/avatar shrink-0">
                <div
                  className={`w-12 h-12 rounded-full overflow-hidden border-2 border-purple-200 dark:border-purple-800 flex items-center justify-center ${
                    avatarUrl ? 'bg-white' : 'bg-purple-100 dark:bg-purple-900/30'
                  }`}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover bg-white"
                    />
                  ) : (
                    <UserCircle2 className="w-6 h-6 text-purple-400" />
                  )}
                </div>
                <div className="absolute inset-0 overflow-hidden rounded-full bg-black/55 opacity-0 transition-opacity group-hover/avatar:opacity-100">
                  {!avatarUrl ? (
                    <label
                      className="flex h-full w-full cursor-pointer items-center justify-center text-white transition-colors hover:bg-white/20"
                      title={lang === 'zh' ? '上传人物图片' : 'Upload character image'}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e)}
                      />
                    </label>
                  ) : (
                    <div
                      className="relative h-full w-full"
                      style={{
                        background:
                          'conic-gradient(from -30deg, rgba(255,255,255,0.10) 0deg 119deg, rgba(255,255,255,0.18) 119deg 121deg, rgba(255,255,255,0.10) 121deg 239deg, rgba(255,255,255,0.18) 239deg 241deg, rgba(255,255,255,0.10) 241deg 359deg, rgba(255,255,255,0.18) 359deg 360deg)',
                      }}
                    >
                      <label
                        className="absolute inset-0 cursor-pointer text-white transition-colors hover:bg-white/15"
                        style={{
                          clipPath: 'polygon(50% 50%, 6.7% 25%, 50% 0%, 93.3% 25%)',
                        }}
                        title={lang === 'zh' ? '上传人物图片' : 'Upload character image'}
                      >
                        <Upload className="absolute left-1/2 top-1.5 h-3.5 w-3.5 -translate-x-1/2" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRemoveAvatarBackground}
                        disabled={
                          !data.onRemoveCharacterImageBackground || isRemovingAvatarBackground
                        }
                        className="absolute inset-0 text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                        style={{
                          clipPath: 'polygon(50% 50%, 93.3% 25%, 93.3% 75%, 50% 100%)',
                        }}
                        title={lang === 'zh' ? '处理为透明背景' : 'Make background transparent'}
                      >
                        {isRemovingAvatarBackground ? (
                          <Loader2 className="absolute bottom-2 right-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eraser className="absolute bottom-2 right-2 h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadAvatarImage}
                        className="absolute inset-0 text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                        style={{
                          clipPath: 'polygon(50% 50%, 50% 100%, 6.7% 75%, 6.7% 25%)',
                        }}
                        title={lang === 'zh' ? '下载人物图片' : 'Download character image'}
                      >
                        <Download className="absolute bottom-2 left-2 h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <input
                  data-agent-field="character-name"
                  type="text"
                  value={name}
                  onChange={(e) => updateNodeData({ characterName: e.target.value })}
                  placeholder="输入角色姓名..."
                  className="w-full bg-transparent text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-b-2 focus:border-purple-400"
                />
                <div className="text-[10px] text-purple-500 font-medium flex items-center gap-1 mt-1">
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
                className={`shrink-0 w-8 h-8 rounded-lg transition-colors flex items-center justify-center border border-purple-500/20 ${isRollingSetting ? 'text-purple-500 bg-purple-500/10 cursor-wait' : 'text-purple-500 hover:text-purple-600 hover:bg-purple-500/10'}`}
                title={lang === 'zh' ? '摇色子生成/扩写人物设定' : 'Roll character setting'}
              >
                {isRollingSetting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Dices className="w-4 h-4" />
                )}
              </button>
              {hasCharacterText && (
                <button
                  onClick={handleGenerateSettingImage}
                  disabled={isGeneratingSettingImage}
                  className={`shrink-0 w-8 h-8 rounded-lg transition-colors flex items-center justify-center border border-fuchsia-500/20 ${isGeneratingSettingImage ? 'text-fuchsia-500 bg-fuchsia-500/10 cursor-wait' : 'text-fuchsia-500 hover:text-fuchsia-600 hover:bg-fuchsia-500/10'}`}
                  title={
                    lang === 'zh' ? '根据人物设定一键生图' : 'Generate image from character setting'
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

            {/* Traits */}
            <div className="px-3 pt-3 pb-3 flex flex-col flex-1 min-h-min">
              <div className="flex flex-wrap items-center gap-3 ml-1 mb-2 shrink-0">
                {/* <label className="text-[11px] font-bold text-[var(--text-secondary)]">开启设定项:</label> */}
                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={!!data.showPersonality}
                    onChange={(e) =>
                      handleTraitVisibilityChange('showPersonality', e.target.checked)
                    }
                    className="rounded border-[var(--card-border)] text-purple-500 focus:ring-purple-500 bg-[var(--card-bg)]"
                  />
                  性格
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={!!data.showFeatures}
                    onChange={(e) => handleTraitVisibilityChange('showFeatures', e.target.checked)}
                    className="rounded border-[var(--card-border)] text-purple-500 focus:ring-purple-500 bg-[var(--card-bg)]"
                  />
                  人物特点
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={!!data.showBackground}
                    onChange={(e) =>
                      handleTraitVisibilityChange('showBackground', e.target.checked)
                    }
                    className="rounded border-[var(--card-border)] text-purple-500 focus:ring-purple-500 bg-[var(--card-bg)]"
                  />
                  人物背景
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={!!data.showOther}
                    onChange={(e) => handleTraitVisibilityChange('showOther', e.target.checked)}
                    className="rounded border-[var(--card-border)] text-purple-500 focus:ring-purple-500 bg-[var(--card-bg)]"
                  />
                  其他
                </label>
              </div>

              <div className="flex flex-col flex-1 min-h-min gap-2">
                {data.showPersonality && (
                  <div className={TRAIT_FIELD_CLASS}>
                    <label className="block text-[10px] font-bold text-purple-500 ml-1 shrink-0">
                      性格
                    </label>
                    <textarea
                      data-agent-field="personality"
                      value={data.personality || ''}
                      onChange={(e) => updateNodeData({ personality: e.target.value })}
                      placeholder="例如：傲娇，口是心非..."
                      className={TRAIT_TEXTAREA_CLASS}
                    />
                  </div>
                )}
                {data.showFeatures && (
                  <div className={TRAIT_FIELD_CLASS}>
                    <label className="block text-[10px] font-bold text-purple-500 ml-1 shrink-0">
                      人物特点
                    </label>
                    <textarea
                      data-agent-field="features"
                      value={data.features || ''}
                      onChange={(e) => updateNodeData({ features: e.target.value })}
                      placeholder="例如：喜欢喝红茶，左眼带有眼罩..."
                      className={TRAIT_TEXTAREA_CLASS}
                    />
                  </div>
                )}
                {data.showBackground && (
                  <div className={TRAIT_FIELD_CLASS}>
                    <label className="block text-[10px] font-bold text-purple-500 ml-1 shrink-0">
                      人物背景
                    </label>
                    <textarea
                      data-agent-field="background"
                      value={data.background || ''}
                      onChange={(e) => updateNodeData({ background: e.target.value })}
                      placeholder="例如：出生于没落贵族家庭..."
                      className={TRAIT_TEXTAREA_CLASS}
                    />
                  </div>
                )}
                {data.showOther && (
                  <div className={TRAIT_FIELD_CLASS}>
                    <label className="block text-[10px] font-bold text-purple-500 ml-1 shrink-0">
                      其他
                    </label>
                    <textarea
                      data-agent-field="other"
                      value={data.other || ''}
                      onChange={(e) => updateNodeData({ other: e.target.value })}
                      placeholder="其他设定内容..."
                      className={TRAIT_TEXTAREA_CLASS}
                    />
                  </div>
                )}

                {!data.showPersonality &&
                  !data.showFeatures &&
                  !data.showBackground &&
                  !data.showOther && (
                    <div className={TRAIT_FIELD_CLASS}>
                      <label className="block text-[10px] font-bold text-purple-500 ml-1 shrink-0">
                        综合设定
                      </label>
                      <textarea
                        data-agent-field="traits"
                        value={traits}
                        onChange={(e) => updateNodeData({ traits: e.target.value })}
                        placeholder="例如：性格傲娇，总是口是心非。喜欢喝红茶..."
                        className={TRAIT_TEXTAREA_CLASS}
                      />
                    </div>
                  )}
              </div>
            </div>

            {/* Outfits / Three-views */}
            <div className="p-3 flex flex-col gap-2 relative shrink-0 min-h-[100px] rounded-b-xl border-t border-[var(--card-border)] bg-[var(--card-bg)]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[var(--text-secondary)] ml-1">
                  人物图片 / 不同穿着
                </label>
                <button
                  onClick={addOutfit}
                  className="text-purple-500 hover:text-purple-600 hover:bg-purple-500/10 p-1 rounded transition-colors"
                  title="添加新穿着"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {outfits.length === 0 ? (
                <div className="text-[10px] text-[var(--text-muted)] text-center py-2 bg-[var(--app-bg)] rounded-lg border border-dashed border-[var(--card-border)]">
                  暂无人物图片，点击右上角 + 添加
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {outfits.map((outfit, index) => (
                    <div
                      key={outfit.id}
                      className="relative flex items-center gap-2 bg-[var(--app-bg)] p-1.5 rounded-lg border border-[var(--card-border)] group/outfit"
                    >
                      <label
                        className={`relative cursor-pointer shrink-0 w-8 h-8 rounded-md overflow-hidden flex items-center justify-center border border-purple-200 dark:border-purple-800 ${
                          outfit.imageUrl ? 'bg-white' : 'bg-purple-100 dark:bg-purple-900/30'
                        }`}
                      >
                        {outfit.imageUrl ? (
                          <img
                            src={outfit.imageUrl}
                            className="w-full h-full object-cover bg-white"
                            alt="Outfit"
                          />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, outfit.id)}
                        />
                      </label>
                      <input
                        type="text"
                        value={outfit.name}
                        onChange={(e) => updateOutfitName(outfit.id, e.target.value)}
                        placeholder="服装名称"
                        className="flex-1 bg-transparent text-[11px] text-[var(--text-primary)] outline-none focus:border-b focus:border-purple-400 min-w-0"
                      />
                      <label
                        className="cursor-pointer rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-purple-500/10 hover:text-purple-500 group-hover/outfit:opacity-100"
                        title={lang === 'zh' ? '上传人物图片' : 'Upload character image'}
                      >
                        <Upload className="w-3 h-3" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, outfit.id)}
                        />
                      </label>
                      {outfit.imageUrl && (
                        <>
                          <button
                            onClick={(event) => handleRemoveOutfitBackground(event, outfit.id)}
                            disabled={
                              !data.onRemoveCharacterImageBackground ||
                              removingOutfitBackgroundId === outfit.id
                            }
                            className="rounded p-1 text-fuchsia-500 opacity-0 transition-opacity hover:bg-fuchsia-500/10 hover:text-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-40 group-hover/outfit:opacity-100"
                            title={lang === 'zh' ? '处理为透明背景' : 'Make background transparent'}
                          >
                            {removingOutfitBackgroundId === outfit.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Eraser className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={(event) => handleDownloadOutfitImage(event, outfit)}
                            className="opacity-0 group-hover/outfit:opacity-100 p-1 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 rounded transition-opacity"
                            title={lang === 'zh' ? '下载人物图片' : 'Download character image'}
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => removeOutfit(outfit.id)}
                        className="opacity-0 group-hover/outfit:opacity-100 p-1 text-red-400 hover:text-red-500 transition-opacity"
                        title="删除此穿着"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {/* Outfit Handles */}
                      <Handle
                        type="source"
                        position={Position.Left}
                        id={`outfit-in-${outfit.id}`}
                        className={getHandleClasses(`outfit-in-${outfit.id}`, 'source')}
                        style={{ top: '50%', left: '-13px' }}
                      />
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={`outfit-out-${outfit.id}`}
                        className={getHandleClasses(`outfit-out-${outfit.id}`, 'source')}
                        style={{ top: '50%', right: '-13px' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isMinimized && (
        <div className="px-3 py-2 flex items-center gap-2 bg-purple-50/10 dark:bg-purple-900/10 shrink-0">
          <div
            className={`w-5 h-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center ${
              avatarUrl ? 'bg-white' : 'bg-purple-200'
            }`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} className="w-full h-full object-cover bg-white" />
            ) : (
              <UserCircle2 className="w-3 h-3 text-purple-500" />
            )}
          </div>
          <span className="text-[10px] text-[var(--text-primary)] font-bold truncate">
            {name || '未命名角色'}
          </span>
        </div>
      )}

      {isMinimized &&
        minimizedConnectedOutfits.map((item) => (
          <React.Fragment key={item.outfit.id}>
            {item.hasInConnection && (
              <Handle
                type="source"
                position={Position.Left}
                id={item.inHandleId}
                className={getHandleClasses(item.inHandleId, 'source')}
                style={minimizedOutfitHandleStyle}
              />
            )}
            {item.hasOutConnection && (
              <Handle
                type="source"
                position={Position.Right}
                id={item.outHandleId}
                className={getHandleClasses(item.outHandleId, 'source')}
                style={minimizedOutfitHandleStyle}
              />
            )}
          </React.Fragment>
        ))}

      {/* Main Handles (only when not global) */}
      {!isGlobal && (
        <>
          <Handle
            type="source"
            position={Position.Left}
            id="target-main"
            className={getHandleClasses('target-main', 'source')}
            style={{ top: isMinimized ? '50%' : '65px' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="source-main"
            className={getHandleClasses('source-main', 'source')}
            style={{ top: isMinimized ? '50%' : '65px' }}
          />
        </>
      )}
    </div>
  );
}

export const MemoizedCharacterNode = memo(CharacterNode);
