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
  Bot,
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
  Trash2,
  Upload,
  UserCircle2,
  Volume2,
  WandSparkles,
  X,
} from 'lucide-react';
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';

import type { CharacterFlowNode, CharacterNodeData } from '../domain/project';
import {
  CharacterAppearancePreview,
  renderCharacterAppearanceSpriteDataUrl,
} from './CharacterAppearancePreview';
import { useDialog } from '../editor-shell/DialogProvider';
import { formatCharacterNodeText } from '../lib/export';
import { Language, translations } from '../lib/i18n';
import {
  CHARACTER_APPEARANCE_SPRITE_VERSION,
  createCharacterAppearance,
  DEFAULT_APPEARANCE_ADJUSTMENT,
  getCharacterAppearanceAssetUrl,
  getCharacterAppearanceAssetUrls,
  getCharacterAppearanceCatalog,
  resolveMatchedHairOutfitSelection,
  type AppearanceAdjustment,
  type CharacterAppearanceGender,
} from '../lib/characterAppearance';
import { downloadImageUrl, getImageExtension, getSafeDownloadName } from '../lib/media';
import {
  cachePresetAssets,
  getCachedPresetAssetUrls,
  hasCachedPresetAssets,
  requiresPresetDownload,
  removeCachedPresetAssets,
} from '../lib/presetAssetCache';
import { SETTING_NODE_CARD_WIDTH } from './story-editor/constants';
import { SettingLibraryMenu } from './SettingLibraryMenu';

const PROFILE_TEXTAREA_CLASS =
  'w-full min-h-[54px] resize-none overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)] text-xs p-2 rounded-lg outline-none border border-[var(--card-border)] focus:border-purple-400 placeholder:text-[var(--text-muted)] custom-scrollbar';
const PROFILE_FIELD_CLASS = 'flex flex-col gap-1 min-w-0';
const TRAIT_TEXTAREA_CLASS = PROFILE_TEXTAREA_CLASS;
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

const getCalculatedCharacterNodeMinHeight = (outfitsCount: number) =>
  70 +
  112 +
  330 +
  132 +
  81 +
  (outfitsCount === 0 ? 33 : outfitsCount * 46 + (outfitsCount - 1) * 8);

const CHARACTER_NODE_MIN_WIDTH = SETTING_NODE_CARD_WIDTH;
const CHARACTER_NODE_HEIGHT_SAFETY = 4;

type AppearanceMenuOption = { id: string; label: string; assetPath: string };

const hashAppearanceSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandomAppearanceTemplate = (
  nodeId: string,
): NonNullable<CharacterNodeData['appearanceTemplate']> => {
  const seed = hashAppearanceSeed(nodeId);
  const gender: CharacterAppearanceGender = seed % 2 === 0 ? 'female' : 'male';
  const catalog = getCharacterAppearanceCatalog(gender);
  const choose = (options: AppearanceMenuOption[], offset: number) =>
    options[(seed >>> offset) % options.length]?.id || options[0]?.id || '';
  const matched = resolveMatchedHairOutfitSelection(catalog, {
    hairId: choose(catalog.hairs, 7),
    outfitId: choose(catalog.outfits, 13),
  });

  return {
    gender,
    faceId: choose(catalog.faces, 2),
    hairId: matched.hairId,
    outfitId: matched.outfitId,
  };
};

const NumberField = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) => (
  <label className="grid grid-cols-[50px_1fr] items-center gap-1 text-[10px] text-[var(--text-secondary)]">
    <span>{label}</span>
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-5 min-w-0 rounded border border-purple-200 bg-white px-1 text-right text-[10px] outline-none focus:border-purple-400 dark:border-purple-800 dark:bg-slate-900"
    />
  </label>
);

function AppearanceImageMenu({
  label,
  options,
  value,
  isOpen,
  disabled,
  assetUrlBySource = {},
  thumbnailCrop = 'full',
  customAssetUrl,
  onToggle,
  onChange,
  onUploadCustom,
}: {
  label: string;
  options: AppearanceMenuOption[];
  value: string;
  isOpen: boolean;
  disabled?: boolean;
  assetUrlBySource?: Record<string, string>;
  thumbnailCrop?: 'full' | 'face';
  customAssetUrl?: string;
  onToggle: () => void;
  onChange: (value: string) => void;
  onUploadCustom?: (file: File) => void;
}) {
  const itemsPerPage = 16;
  const [page, setPage] = useState(0);
  const [hiddenOptionIds, setHiddenOptionIds] = useState<Set<string>>(() => new Set());
  const [uploadGuideOpen, setUploadGuideOpen] = useState(false);
  const visibleCatalogOptions = options.filter((option) => !hiddenOptionIds.has(option.id));
  const totalPages = Math.max(1, Math.ceil(visibleCatalogOptions.length / itemsPerPage));
  const safePage = Math.min(page, totalPages - 1);
  const pageOptions = visibleCatalogOptions.slice(
    safePage * itemsPerPage,
    (safePage + 1) * itemsPerPage,
  );
  const isLastPage = safePage >= totalPages - 1;
  const resolveOptionSrc = (option: AppearanceMenuOption) =>
    assetUrlBySource[getCharacterAppearanceAssetUrl(option.assetPath)] ||
    getCharacterAppearanceAssetUrl(option.assetPath);

  const toggleMenu = () => {
    setPage(0);
    setUploadGuideOpen(false);
    onToggle();
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          toggleMenu();
        }}
        className="flex h-5 items-center gap-0.5 rounded border border-purple-200 bg-white/80 px-1 text-[9px] text-[var(--text-secondary)] transition-colors hover:border-purple-400 disabled:cursor-not-allowed disabled:opacity-45 dark:border-purple-800 dark:bg-slate-900"
      >
        <span>{label}</span>
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {isOpen && !disabled && (
        <div className="absolute left-0 top-[calc(100%+5px)] z-[120] w-[276px] rounded-lg border border-purple-200 bg-[var(--card-bg)] p-1.5 shadow-xl dark:border-purple-800">
          <div className="relative">
            <div className="grid grid-cols-4 gap-1">
              {pageOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setUploadGuideOpen(false);
                    onChange(option.id);
                  }}
                  className={`relative overflow-hidden rounded-md border p-1 text-center transition-colors ${
                    !customAssetUrl && value === option.id
                      ? 'border-purple-400 bg-purple-500/10 text-purple-600'
                      : 'border-transparent hover:border-purple-200 hover:bg-purple-50 dark:hover:border-purple-800 dark:hover:bg-slate-800'
                  }`}
                >
                  <img
                    src={resolveOptionSrc(option)}
                    alt={option.label}
                    loading="lazy"
                    onError={() => {
                      setHiddenOptionIds((current) => {
                        if (current.has(option.id)) return current;
                        const next = new Set(current);
                        next.add(option.id);
                        return next;
                      });
                    }}
                    className={`mx-auto h-12 w-full origin-top object-cover object-top ${
                      thumbnailCrop === 'face' ? 'scale-[2.25]' : 'scale-[1.7]'
                    }`}
                  />
                  <span className="mt-0.5 block truncate text-[9px] leading-3">{option.label}</span>
                </button>
              ))}
              {isLastPage && onUploadCustom ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setUploadGuideOpen(true);
                  }}
                  className={`relative overflow-hidden rounded-md border p-1 text-center transition-colors ${
                    customAssetUrl
                      ? 'border-purple-400 bg-purple-500/10 text-purple-600'
                      : 'border-dashed border-purple-200 hover:border-purple-400 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-slate-800'
                  }`}
                >
                  {customAssetUrl ? (
                    <img
                      src={customAssetUrl}
                      alt=""
                      className={`mx-auto h-12 w-full origin-top object-cover object-top ${
                        thumbnailCrop === 'face' ? 'scale-[2.25]' : 'scale-[1.7]'
                      }`}
                    />
                  ) : (
                    <span className="mx-auto flex h-12 w-full items-center justify-center rounded bg-purple-50 text-purple-500 dark:bg-slate-900">
                      <Upload className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="mt-0.5 block truncate text-[9px] leading-3">上传</span>
                </button>
              ) : null}
            </div>
            {uploadGuideOpen && onUploadCustom ? (
              <div className="absolute inset-x-0 top-0 z-[130] rounded-md border border-purple-200 bg-[var(--card-bg)] p-2.5 shadow-lg dark:border-purple-800">
                <p className="text-[10px] leading-4 text-[var(--text-secondary)]">
                  推荐使用分辨率为 <span className="font-semibold text-purple-600">1024×1820</span>{' '}
                  的竖版图片。
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-purple-500 px-2 py-1 text-[9px] font-semibold text-white hover:bg-purple-600">
                    <Upload className="h-3 w-3" />
                    选择图片
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        onUploadCustom(file);
                        setUploadGuideOpen(false);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setUploadGuideOpen(false);
                    }}
                    className="rounded-md px-2 py-1 text-[9px] text-[var(--text-muted)] hover:bg-purple-50 dark:hover:bg-slate-800"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {totalPages > 1 && (
            <div className="mt-1.5 flex items-center justify-between border-t border-purple-100 pt-1.5 text-[9px] text-[var(--text-secondary)] dark:border-purple-900">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  setUploadGuideOpen(false);
                  setPage((current) => Math.max(0, current - 1));
                }}
                className="rounded px-1.5 py-0.5 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-purple-900/30"
              >
                上一页
              </button>
              <span>
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  setUploadGuideOpen(false);
                  setPage((current) => Math.min(totalPages - 1, current + 1));
                }}
                className="rounded px-1.5 py-0.5 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-purple-900/30"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CharacterNode({ id, data, selected }: NodeProps<CharacterFlowNode>) {
  const { alert: showDialogAlert } = useDialog();
  const lang = (data.language as Language) || 'zh';
  const t = translations[lang];

  const name = data.characterName || '';
  const traits = data.traits || '';
  const appearance = typeof data.appearance === 'string' ? data.appearance : data.features || '';
  const experience = typeof data.experience === 'string' ? data.experience : data.background || '';
  const notes = typeof data.notes === 'string' ? data.notes : data.other || data.traits || '';
  const voiceOptions = Array.isArray(data.voiceOptions) ? data.voiceOptions : [];
  const selectedVoiceProfile = voiceOptions.find((option) => option.id === data.voiceProfileId);
  const selectedVoiceId = data.voiceId || selectedVoiceProfile?.defaultVoice || '';
  const voiceListId = `character-voice-options-${id}`;
  const avatarUrl = data.avatarUrl;
  const threeViewUrl = data.threeViewUrl;
  const tagSpriteUrl = data.tagSpriteUrl;
  const placeholderAvatarUrl = data.placeholderIdentityId || '';
  // Keep gender/template state even when the modular portrait is disabled or
  // a custom avatar is present. The gender selector is an independent choice
  // that determines which preset will be used if the user enables it later.
  const defaultAppearanceTemplate = !data.appearanceTemplate
    ? createRandomAppearanceTemplate(id)
    : undefined;
  const selectedAppearanceTemplate = data.appearanceTemplate || defaultAppearanceTemplate;
  const templateGender =
    selectedAppearanceTemplate?.gender === 'female' || selectedAppearanceTemplate?.gender === 'male'
      ? selectedAppearanceTemplate.gender
      : null;
  const templateCatalog = templateGender ? getCharacterAppearanceCatalog(templateGender) : null;
  const templateAppearance = useMemo(
    () =>
      templateGender ? createCharacterAppearance(templateGender, selectedAppearanceTemplate) : null,
    [
      selectedAppearanceTemplate?.customFaceAssetUrl,
      selectedAppearanceTemplate?.customFrontHairAssetUrl,
      selectedAppearanceTemplate?.customOutfitAssetUrl,
      selectedAppearanceTemplate?.faceId,
      selectedAppearanceTemplate?.hairId,
      selectedAppearanceTemplate?.outfitId,
      templateGender,
    ],
  );
  const appearanceAdjustment: AppearanceAdjustment = useMemo(
    () => ({
      ...DEFAULT_APPEARANCE_ADJUSTMENT,
      ...selectedAppearanceTemplate?.adjustment,
    }),
    [
      selectedAppearanceTemplate?.adjustment?.hairScale,
      selectedAppearanceTemplate?.adjustment?.hairX,
      selectedAppearanceTemplate?.adjustment?.hairY,
      selectedAppearanceTemplate?.adjustment?.spriteHeadScale,
      selectedAppearanceTemplate?.adjustment?.spriteHeadX,
      selectedAppearanceTemplate?.adjustment?.spriteHeadY,
    ],
  );
  const appearanceSpriteSignature = templateAppearance
    ? [
        CHARACTER_APPEARANCE_SPRITE_VERSION,
        templateAppearance.gender,
        templateAppearance.faceId,
        templateAppearance.hairId,
        templateAppearance.outfitId,
        selectedAppearanceTemplate?.customFaceAssetUrl || '',
        selectedAppearanceTemplate?.customFrontHairAssetUrl || '',
        selectedAppearanceTemplate?.customOutfitAssetUrl || '',
        appearanceAdjustment.hairX,
        appearanceAdjustment.hairY,
        appearanceAdjustment.hairScale,
        appearanceAdjustment.spriteHeadX,
        appearanceAdjustment.spriteHeadY,
        appearanceAdjustment.spriteHeadScale,
      ].join('|')
    : '';
  const appearanceSourceUrls = useMemo(
    () => (templateAppearance ? getCharacterAppearanceAssetUrls(templateAppearance) : []),
    [appearanceSpriteSignature],
  );
  const presetCatalogSourceUrls = useMemo(
    () =>
      templateCatalog
        ? [
            ...templateCatalog.faces.map((item) => getCharacterAppearanceAssetUrl(item.assetPath)),
            ...templateCatalog.hairs.flatMap((item) => [
              getCharacterAppearanceAssetUrl(item.assetPath),
              ...(item.backAssetPath ? [getCharacterAppearanceAssetUrl(item.backAssetPath)] : []),
            ]),
            ...templateCatalog.outfits.map((item) =>
              getCharacterAppearanceAssetUrl(item.assetPath),
            ),
          ]
        : appearanceSourceUrls,
    [appearanceSourceUrls, templateGender],
  );
  const [presetEnabled, setPresetEnabled] = useState(
    () => data.appearancePresetEnabled ?? !requiresPresetDownload(),
  );
  const [presetDownloadState, setPresetDownloadState] = useState<'idle' | 'downloading' | 'paused'>(
    'idle',
  );
  const [presetDownloadProgress, setPresetDownloadProgress] = useState({ completed: 0, total: 0 });
  const presetDownloadAbortRef = useRef<AbortController | null>(null);
  const isAssistantCandidate = Boolean(data.assistantCandidateKind);
  const isGlobal = data.isGlobal !== false; // Default to true
  const cardToolbarScale =
    typeof data.cardToolbarScale === 'number' && Number.isFinite(data.cardToolbarScale)
      ? data.cardToolbarScale
      : 1;

  const isMinimized = !!data.isMinimized;
  const outfits = data.outfits || [];
  const characterAssetSlots = [
    {
      key: 'avatarUrl' as const,
      url: avatarUrl,
      appearancePreviewMode:
        !avatarUrl && presetEnabled && templateAppearance && templateCatalog?.installed
          ? ('portrait' as const)
          : null,
      surfaceClass:
        'bg-gradient-to-b from-purple-50 via-white to-slate-50 dark:from-purple-950/40 dark:via-slate-950 dark:to-slate-900',
      label: lang === 'zh' ? '正面头像' : lang === 'ja' ? '正面ポートレート' : 'Front Portrait',
      hint: lang === 'zh' ? '人物卡片' : lang === 'ja' ? '人物カード' : 'Character card',
    },
    {
      key: 'threeViewUrl' as const,
      url: threeViewUrl,
      appearancePreviewMode: null,
      surfaceClass: 'bg-slate-50 dark:bg-slate-900/70',
      label: lang === 'zh' ? '人物三视图' : lang === 'ja' ? '三面図' : 'Three-view Sheet',
      hint: lang === 'zh' ? '场景重绘参考' : lang === 'ja' ? '再描画の参照' : 'Redraw reference',
    },
    {
      key: 'tagSpriteUrl' as const,
      url: tagSpriteUrl,
      appearancePreviewMode:
        !tagSpriteUrl && presetEnabled && templateAppearance && templateCatalog?.installed
          ? ('sprite' as const)
          : null,
      surfaceClass:
        'bg-[repeating-conic-gradient(#f8fafc_0%_25%,#e2e8f0_0%_50%)] bg-[length:12px_12px] dark:bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)]',
      label:
        lang === 'zh'
          ? '透明标签立绘'
          : lang === 'ja'
            ? '透過タグ立ち絵'
            : 'Transparent Tag Sprite',
      hint:
        lang === 'zh' ? '剧情人物 Tag' : lang === 'ja' ? 'ストーリータグ' : 'Story character tag',
    },
  ];
  const [copied, setCopied] = useState(false);
  const [isRollingSetting, setIsRollingSetting] = useState(false);
  const [isGeneratingSettingImage, setIsGeneratingSettingImage] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    label?: string;
  } | null>(null);
  const [previewAssetKey, setPreviewAssetKey] = useState<
    'avatarUrl' | 'threeViewUrl' | 'tagSpriteUrl' | null
  >(null);
  const [openAppearanceMenu, setOpenAppearanceMenu] = useState<
    'faceId' | 'hairId' | 'outfitId' | 'calibration' | null
  >(null);
  const [appearanceAssetUrls, setAppearanceAssetUrls] = useState<Record<string, string>>({});
  const [isRemovingAvatarBackground, setIsRemovingAvatarBackground] = useState(false);
  const [removingOutfitBackgroundId, setRemovingOutfitBackgroundId] = useState<string | null>(null);
  const contentFrameRef = useRef<HTMLDivElement>(null);
  const [measuredMinHeight, setMeasuredMinHeight] = useState(
    getCalculatedCharacterNodeMinHeight(0),
  );
  const previewAsset = characterAssetSlots.find((asset) => asset.key === previewAssetKey);

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

  const calculatedMinHeight = getCalculatedCharacterNodeMinHeight(outfits.length);
  const effectiveMinHeight = Math.max(calculatedMinHeight, measuredMinHeight);
  const hasCharacterText = [
    name,
    data.identity,
    data.appearance,
    traits,
    data.personality,
    data.habits,
    data.speechStyle,
    data.experience,
    data.relationships,
    data.notes,
    data.features,
    data.background,
    data.other,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);

  const syncNodeHeightToMinimum = useCallback(
    (nextMinHeight = effectiveMinHeight, allowShrink = false) => {
      if (isMinimized) return;

      const heightToApply = Math.ceil(nextMinHeight);
      const currentNode = storeApi.getState().nodes.find((node) => node.id === id);
      if (!currentNode) return;

      const currentHeight =
        getNumericSize(currentNode.style?.height) ??
        getNumericSize((currentNode as any).height) ??
        getNumericSize((currentNode as any).measured?.height);
      const currentMinHeight = getNumericSize(currentNode.style?.minHeight);
      const shouldApplyHeight =
        allowShrink || currentHeight === undefined || currentHeight < heightToApply - 1;
      const shouldUpdateMinHeight = currentMinHeight !== heightToApply;

      if (!shouldApplyHeight && !shouldUpdateMinHeight) return;

      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

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
    [effectiveMinHeight, id, isMinimized, setNodes, storeApi, updateNodeInternals],
  );

  // Existing projects may contain character cards created with an older width.
  // Normalize those cards to the same fixed width used by scene setting cards.
  const syncNodeWidthToSettingCard = useCallback(() => {
    const currentNode = storeApi.getState().nodes.find((node) => node.id === id);
    if (!currentNode) return;

    const currentWidth =
      getNumericSize(currentNode.style?.width) ??
      getNumericSize((currentNode as any).width) ??
      getNumericSize((currentNode as any).measured?.width);
    const currentMinWidth = getNumericSize(currentNode.style?.minWidth);
    if (currentWidth === SETTING_NODE_CARD_WIDTH && currentMinWidth === SETTING_NODE_CARD_WIDTH)
      return;

    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;

        return {
          ...node,
          style: {
            ...node.style,
            width: SETTING_NODE_CARD_WIDTH,
            minWidth: SETTING_NODE_CARD_WIDTH,
          },
        };
      }),
    );
  }, [id, setNodes, storeApi]);

  const measureContentMinHeight = useCallback(() => {
    if (isMinimized || !contentFrameRef.current) return calculatedMinHeight;

    // This frame has no `h-full`, so its scroll height is the natural form
    // content rather than the current React Flow node height. That avoids a
    // feedback loop while keeping the border and shadow around all content.
    return Math.max(
      calculatedMinHeight,
      Math.ceil(contentFrameRef.current.scrollHeight + CHARACTER_NODE_HEIGHT_SAFETY),
    );
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

  useEffect(() => {
    if (!data.appearanceTemplate && defaultAppearanceTemplate) {
      updateNodeData({
        appearanceTemplate: defaultAppearanceTemplate,
        // AI-created cards can request a preset portrait up front. Keep that
        // instruction when materializing their deterministic appearance.
        appearancePresetEnabled: data.appearancePresetEnabled ?? false,
      });
    }
  }, [
    data.appearancePresetEnabled,
    data.appearanceTemplate,
    defaultAppearanceTemplate,
    updateNodeData,
  ]);

  useEffect(() => {
    if (typeof data.appearancePresetEnabled === 'boolean') {
      setPresetEnabled(data.appearancePresetEnabled);
    }
  }, [data.appearancePresetEnabled]);

  useEffect(() => {
    let cancelled = false;
    if (!presetEnabled) {
      setAppearanceAssetUrls({});
      return () => {
        cancelled = true;
      };
    }
    void getCachedPresetAssetUrls(presetCatalogSourceUrls).then((urls) => {
      if (!cancelled) setAppearanceAssetUrls(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [appearanceSpriteSignature, presetCatalogSourceUrls, presetEnabled]);

  // Assistant-created text-only characters arrive with this flag already on.
  // In a browser the preset files live in IndexedDB, so fetch them here as
  // well; otherwise the card would be marked as enabled but keep its generic
  // placeholder until the user presses the old "enable preset" button.
  useEffect(() => {
    if (
      !presetEnabled ||
      data.appearancePresetEnabled !== true ||
      !templateAppearance ||
      !requiresPresetDownload()
    ) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    presetDownloadAbortRef.current = controller;
    setPresetDownloadState('downloading');

    void (async () => {
      const alreadyCached = await hasCachedPresetAssets(presetCatalogSourceUrls);
      if (!alreadyCached) {
        await cachePresetAssets(presetCatalogSourceUrls, { signal: controller.signal });
      }
      const urls = await getCachedPresetAssetUrls(presetCatalogSourceUrls);
      if (!cancelled) {
        setAppearanceAssetUrls(urls);
        setPresetDownloadState('idle');
      }
    })().catch((error) => {
      if (!cancelled && (error as DOMException)?.name !== 'AbortError') {
        console.error('Failed to auto-enable character preset:', error);
        setPresetDownloadState('idle');
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
      if (presetDownloadAbortRef.current === controller) {
        presetDownloadAbortRef.current = null;
      }
    };
  }, [data.appearancePresetEnabled, presetCatalogSourceUrls, presetEnabled, templateAppearance]);

  useEffect(() => {
    if (!presetEnabled || !templateAppearance || tagSpriteUrl) return;
    if (data.appearanceSpriteUrl && data.appearanceSpriteSignature === appearanceSpriteSignature)
      return;
    let cancelled = false;
    renderCharacterAppearanceSpriteDataUrl(
      templateAppearance,
      appearanceAdjustment,
      appearanceAssetUrls,
    ).then((url) => {
      if (!cancelled && url) {
        updateNodeData({ appearanceSpriteUrl: url, appearanceSpriteSignature });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    appearanceAdjustment,
    appearanceAssetUrls,
    appearanceSpriteSignature,
    data.appearanceSpriteSignature,
    data.appearanceSpriteUrl,
    presetEnabled,
    tagSpriteUrl,
    templateAppearance,
    updateNodeData,
  ]);

  const enablePresetAppearance = async () => {
    if (presetEnabled || !templateAppearance) return;

    const applyEnabledPresetState = () => {
      const matched = resolveMatchedHairOutfitSelection(
        getCharacterAppearanceCatalog(templateAppearance.gender),
        {
          hairId: templateAppearance.hairId,
          outfitId: templateAppearance.outfitId,
        },
      );
      setPresetEnabled(true);
      updateNodeData({
        appearancePresetEnabled: true,
        appearanceTemplate: {
          gender: templateAppearance.gender,
          faceId: templateAppearance.faceId,
          hairId: matched.hairId,
          outfitId: matched.outfitId,
          // Keep a custom face if present; hair/outfit re-sync to a matched preset pair.
          ...(selectedAppearanceTemplate?.customFaceAssetUrl
            ? { customFaceAssetUrl: selectedAppearanceTemplate.customFaceAssetUrl }
            : {}),
          adjustment: appearanceAdjustment,
        },
      });
    };

    if (!requiresPresetDownload()) {
      applyEnabledPresetState();
      return;
    }

    const controller = new AbortController();
    presetDownloadAbortRef.current = controller;
    setPresetDownloadState('downloading');
    try {
      const alreadyCached = await hasCachedPresetAssets(presetCatalogSourceUrls);
      if (!alreadyCached) {
        await cachePresetAssets(presetCatalogSourceUrls, {
          signal: controller.signal,
          onProgress: setPresetDownloadProgress,
        });
      } else {
        setPresetDownloadProgress({
          completed: presetCatalogSourceUrls.length,
          total: presetCatalogSourceUrls.length,
        });
      }
      setAppearanceAssetUrls(await getCachedPresetAssetUrls(presetCatalogSourceUrls));
      applyEnabledPresetState();
      setPresetDownloadState('idle');
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        setPresetDownloadState('paused');
        return;
      }
      console.error('Failed to enable character preset:', error);
      setPresetDownloadState('idle');
      showDialogAlert({
        title: lang === 'zh' ? '启用失败' : 'Enable failed',
        description:
          lang === 'zh'
            ? '人物预设素材下载失败，请检查网络后重试。'
            : 'The character preset could not be downloaded. Please try again.',
        tone: 'danger',
      });
    } finally {
      presetDownloadAbortRef.current = null;
    }
  };

  const pausePresetAppearanceDownload = () => presetDownloadAbortRef.current?.abort();

  /** Disabling keeps the first-download cache, so re-enabling is immediate. */
  const disablePresetAppearance = () => {
    presetDownloadAbortRef.current?.abort();
    setPresetEnabled(false);
    updateNodeData({ appearancePresetEnabled: false });
    setPresetDownloadState('idle');
    setOpenAppearanceMenu(null);
  };

  const removePresetAppearance = async () => {
    presetDownloadAbortRef.current?.abort();
    await removeCachedPresetAssets(presetCatalogSourceUrls);
    setAppearanceAssetUrls({});
    setPresetEnabled(false);
    setPresetDownloadState('idle');
    setPresetDownloadProgress({ completed: 0, total: 0 });
    updateNodeData({
      appearancePresetEnabled: false,
      appearanceSpriteUrl: undefined,
      appearanceSpriteSignature: undefined,
    });
  };

  /* const downloadAppearance = async (
    nextSelection: Partial<Pick<NonNullable<CharacterNodeData['appearanceTemplate']>, 'faceId' | 'hairId' | 'outfitId'>> = {},
  ) => {
    if (!templateAppearance || isDownloadingAppearance) return;
    const nextAppearance = createCharacterAppearance(templateAppearance.gender, {
      faceId: nextSelection.faceId || templateAppearance.faceId,
      hairId: nextSelection.hairId || templateAppearance.hairId,
      outfitId: nextSelection.outfitId || templateAppearance.outfitId,
    });
    setIsDownloadingAppearance(true);
    try {
      const sourceUrls = getCharacterAppearanceAssetUrls(nextAppearance);
      await cachePresetAssets(sourceUrls);
      setAppearanceAssetUrls(await getCachedPresetAssetUrls(sourceUrls));
      updateNodeData({
        appearanceTemplate: {
          gender: nextAppearance.gender,
          faceId: nextAppearance.faceId,
          hairId: nextAppearance.hairId,
          outfitId: nextAppearance.outfitId,
          adjustment: appearanceAdjustment,
        },
      });
    } catch (error) {
      console.error('Failed to download character appearance:', error);
      showDialogAlert({
        title: lang === 'zh' ? '下载失败' : 'Download failed',
        description: lang === 'zh' ? '人物素材下载失败，请检查网络后重试。' : 'Character asset download failed. Please check your connection.',
        tone: 'danger',
      });
    } finally {
      setIsDownloadingAppearance(false);
    }
  }; */

  const selectAppearanceGender = (gender: CharacterAppearanceGender) => {
    const appearanceTemplate = createCharacterAppearance(gender);
    const matched = resolveMatchedHairOutfitSelection(getCharacterAppearanceCatalog(gender), {
      hairId: appearanceTemplate.hairId,
      outfitId: appearanceTemplate.outfitId,
    });
    updateNodeData({
      appearanceTemplate: {
        gender,
        faceId: appearanceTemplate.faceId,
        hairId: matched.hairId,
        outfitId: matched.outfitId,
      },
    });
  };

  const buildAppearanceTemplatePayload = (
    next: Partial<NonNullable<CharacterNodeData['appearanceTemplate']>>,
  ): NonNullable<CharacterNodeData['appearanceTemplate']> => {
    const current = selectedAppearanceTemplate;
    return {
      gender: next.gender || current?.gender || 'female',
      faceId: next.faceId ?? current?.faceId ?? '',
      hairId: next.hairId ?? current?.hairId ?? '',
      outfitId: next.outfitId ?? current?.outfitId ?? '',
      ...(next.customFaceAssetUrl !== undefined
        ? next.customFaceAssetUrl
          ? { customFaceAssetUrl: next.customFaceAssetUrl }
          : {}
        : current?.customFaceAssetUrl
          ? { customFaceAssetUrl: current.customFaceAssetUrl }
          : {}),
      ...(next.customFrontHairAssetUrl !== undefined
        ? next.customFrontHairAssetUrl
          ? { customFrontHairAssetUrl: next.customFrontHairAssetUrl }
          : {}
        : current?.customFrontHairAssetUrl
          ? { customFrontHairAssetUrl: current.customFrontHairAssetUrl }
          : {}),
      ...(next.customOutfitAssetUrl !== undefined
        ? next.customOutfitAssetUrl
          ? { customOutfitAssetUrl: next.customOutfitAssetUrl }
          : {}
        : current?.customOutfitAssetUrl
          ? { customOutfitAssetUrl: current.customOutfitAssetUrl }
          : {}),
      ...(next.adjustment || current?.adjustment
        ? { adjustment: next.adjustment || current?.adjustment }
        : {}),
    };
  };

  const updateAppearanceTemplate = (key: 'faceId' | 'hairId' | 'outfitId', value: string) => {
    if (!templateAppearance) return;
    updateNodeData({
      appearanceTemplate: buildAppearanceTemplatePayload({
        faceId: key === 'faceId' ? value : templateAppearance.faceId,
        hairId: key === 'hairId' ? value : templateAppearance.hairId,
        outfitId: key === 'outfitId' ? value : templateAppearance.outfitId,
        ...(key === 'faceId' ? { customFaceAssetUrl: '' } : {}),
        ...(key === 'hairId' ? { customFrontHairAssetUrl: '' } : {}),
        ...(key === 'outfitId' ? { customOutfitAssetUrl: '' } : {}),
        adjustment: appearanceAdjustment,
      }),
    });
  };

  const uploadCustomAppearanceLayer = (
    key: 'customFaceAssetUrl' | 'customFrontHairAssetUrl' | 'customOutfitAssetUrl',
    file: File,
  ) => {
    if (!templateAppearance) return;
    const url = URL.createObjectURL(file);
    updateNodeData({
      appearanceTemplate: buildAppearanceTemplatePayload({
        faceId: templateAppearance.faceId,
        hairId: templateAppearance.hairId,
        outfitId: templateAppearance.outfitId,
        [key]: url,
        adjustment: appearanceAdjustment,
      }),
    });
  };

  const updateAppearanceAdjustment = (key: keyof AppearanceAdjustment, value: number) => {
    if (!templateAppearance) return;
    updateNodeData({
      appearanceTemplate: buildAppearanceTemplatePayload({
        faceId: templateAppearance.faceId,
        hairId: templateAppearance.hairId,
        outfitId: templateAppearance.outfitId,
        adjustment: { ...appearanceAdjustment, [key]: Number.isFinite(value) ? value : 0 },
      }),
    });
  };

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
      getCalculatedCharacterNodeMinHeight(outfits.length),
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

  useEffect(() => {
    if (isMinimized || !contentFrameRef.current) return;

    let frameId = 0;
    const syncNaturalContentHeight = () => {
      const nextMeasuredMinHeight = measureContentMinHeight();
      setMeasuredMinHeight((previous) =>
        Math.abs(previous - nextMeasuredMinHeight) < 1 ? previous : nextMeasuredMinHeight,
      );
      syncNodeHeightToMinimum(Math.max(calculatedMinHeight, nextMeasuredMinHeight));
    };
    const scheduleSync = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(syncNaturalContentHeight);
    };
    const observer = new ResizeObserver(scheduleSync);
    observer.observe(contentFrameRef.current);
    scheduleSync();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, [calculatedMinHeight, isMinimized, measureContentMinHeight, syncNodeHeightToMinimum]);

  useLayoutEffect(() => {
    if (!data.assistantAutoHeightNonce) return;
    syncNodeHeightToMinimum(calculatedMinHeight, true);
  }, [calculatedMinHeight, data.assistantAutoHeightNonce, syncNodeHeightToMinimum]);

  useLayoutEffect(() => {
    syncNodeWidthToSettingCard();
  }, [syncNodeWidthToSettingCard]);

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
    e.target.value = '';
  };

  const handleCharacterAssetUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    assetKey: 'avatarUrl' | 'threeViewUrl' | 'tagSpriteUrl',
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    updateNodeData({ [assetKey]: URL.createObjectURL(file) } as Partial<CharacterNodeData>);
    event.target.value = '';
  };

  const removeCharacterAsset = (assetKey: 'avatarUrl' | 'threeViewUrl' | 'tagSpriteUrl') => {
    updateNodeData({ [assetKey]: undefined } as Partial<CharacterNodeData>);
    if (previewAssetKey === assetKey) setPreviewAssetKey(null);
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
    if (outfits[0]?.id === outfitId) return;

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
    setGenerationProgress({ current: 0, total: 3 });
    try {
      await data.onGenerateSettingImage(id, 'character', (current, total, label) => {
        setGenerationProgress({ current, total, label });
      });
    } finally {
      setIsGeneratingSettingImage(false);
      setGenerationProgress(null);
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
      className={`w-full bg-[var(--card-bg)] rounded-xl shadow-lg border-2 transition-all group ${
        isAssistantCandidate ? 'assistant-candidate-card cursor-pointer' : ''
      } ${
        selected
          ? 'border-purple-500 shadow-purple-500/25 ring-2 ring-purple-500/20'
          : 'border-[var(--card-border)]'
      } flex flex-col relative`}
      style={{
        height: isMinimized ? 'auto' : '100%',
        minHeight: isMinimized ? 'auto' : effectiveMinHeight,
        minWidth: `${CHARACTER_NODE_MIN_WIDTH}px`,
        overflow: 'visible',
      }}
    >
      <NodeResizer
        minWidth={CHARACTER_NODE_MIN_WIDTH}
        maxWidth={CHARACTER_NODE_MIN_WIDTH}
        minHeight={effectiveMinHeight}
        shouldResize={shouldResizeCharacterNode}
        isVisible={!isMinimized && selected && selectionCount === 1}
        lineClassName="!z-20 !border !border-purple-500"
        handleClassName="!z-20 !w-2 !h-2 !bg-[var(--card-bg)] !border !border-purple-500 !rounded-none"
      />

      <div ref={contentFrameRef} className="flex flex-col w-full rounded-xl">
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
            <SettingLibraryMenu
              kind="character"
              sourceItemId={data.libraryItemId}
              savedItems={data.settingLibraryItems?.filter((item) => item.kind === 'character')}
              presetItems={data.settingLibraryPresets?.filter((item) => item.kind === 'character')}
              onSave={(mode) => data.onSaveSettingLibrary?.(id, 'character', mode)}
              onUse={(itemId, source) =>
                data.onUseSettingLibrary?.(id, 'character', itemId, source)
              }
              onDownloadPreset={(itemId) => data.onDownloadSettingLibraryPreset?.(itemId)}
              onDelete={(itemId) => data.onDeleteSettingLibrary?.(itemId)}
            />
            <button
              type="button"
              onClick={() => data.onSendToAssistant?.([id])}
              className="flex items-center justify-center rounded px-1.5 py-1 text-indigo-600 transition-colors hover:bg-indigo-500/10 hover:text-indigo-700"
              title={
                lang === 'zh'
                  ? '加入 AI 上下文'
                  : lang === 'ja'
                    ? 'AI コンテキストに追加'
                    : 'Add to AI context'
              }
            >
              <Bot className="h-3.5 w-3.5" />
            </button>
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
            {!data.locked && (
              <button
                onClick={() => data.onDelete?.(id)}
                className="px-1.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors flex items-center justify-center"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {!isMinimized && (
          <div className="flex flex-col nodrag flex-1 min-h-min">
            {/* Avatar and Name */}
            <div className="flex items-center gap-3 p-3 border-b border-[var(--card-border)] bg-purple-50/10 dark:bg-purple-900/10 shrink-0">
              <div className="relative group/avatar shrink-0">
                <div
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 border-purple-200 dark:border-purple-800 flex items-center justify-center ${
                    avatarUrl ? 'bg-white' : 'bg-purple-100 dark:bg-purple-900/30'
                  }`}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover bg-white"
                    />
                  ) : presetEnabled && templateAppearance && templateCatalog?.installed ? (
                    <CharacterAppearancePreview
                      appearance={templateAppearance}
                      assetUrlOverrides={appearanceAssetUrls}
                      mode="portrait"
                      adjustment={appearanceAdjustment}
                      className="h-full w-full object-cover"
                    />
                  ) : placeholderAvatarUrl ? (
                    <img src={placeholderAvatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle2 className="h-7 w-7 text-purple-400" aria-label="人物头像占位" />
                  )}
                </div>
                <div className="absolute inset-0 overflow-hidden rounded-lg bg-black/55 opacity-0 transition-opacity group-hover/avatar:opacity-100">
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

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-2">
                  <input
                    data-agent-field="character-name"
                    type="text"
                    value={name}
                    onChange={(e) => updateNodeData({ characterName: e.target.value })}
                    placeholder="输入角色姓名..."
                    className="min-w-[72px] max-w-[45%] flex-[0_1_34%] bg-transparent text-sm font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-b-2 focus:border-purple-400"
                  />
                  <input
                    data-agent-field="identity"
                    type="text"
                    value={data.identity || ''}
                    onChange={(e) => updateNodeData({ identity: e.target.value })}
                    placeholder="年龄 · 职业 · 身份"
                    className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--text-secondary)] placeholder-[var(--text-muted)] outline-none focus:border-b focus:border-purple-400"
                  />
                </div>
                <div className="nodrag mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-purple-600">
                  {templateGender && (
                    <div
                      className="inline-flex h-5 overflow-hidden rounded border border-purple-200 bg-white/80 dark:border-purple-800 dark:bg-slate-900"
                      role="group"
                      aria-label={
                        lang === 'zh'
                          ? '角色性别'
                          : lang === 'ja'
                            ? 'キャラクターの性別'
                            : 'Character gender'
                      }
                    >
                      {(['male', 'female'] as const).map((gender) => (
                        <button
                          key={gender}
                          type="button"
                          onClick={() => selectAppearanceGender(gender)}
                          aria-pressed={templateGender === gender}
                          className={`px-1.5 text-[9px] transition-colors ${
                            templateGender === gender
                              ? 'bg-purple-500 text-white'
                              : 'text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/50'
                          }`}
                        >
                          {gender === 'male' ? '男' : '女'}
                        </button>
                      ))}
                    </div>
                  )}
                  {presetEnabled && templateCatalog && templateAppearance && (
                    <>
                      <AppearanceImageMenu
                        label={lang === 'zh' ? '脑袋' : lang === 'ja' ? '顔' : 'Face'}
                        options={templateCatalog.faces}
                        value={templateAppearance.faceId}
                        isOpen={openAppearanceMenu === 'faceId'}
                        disabled={!templateCatalog.installed || !presetEnabled}
                        assetUrlBySource={appearanceAssetUrls}
                        thumbnailCrop="face"
                        customAssetUrl={selectedAppearanceTemplate?.customFaceAssetUrl}
                        onToggle={() =>
                          setOpenAppearanceMenu((current) =>
                            current === 'faceId' ? null : 'faceId',
                          )
                        }
                        onChange={(value) => {
                          updateAppearanceTemplate('faceId', value);
                          setOpenAppearanceMenu(null);
                        }}
                        onUploadCustom={(file) =>
                          uploadCustomAppearanceLayer('customFaceAssetUrl', file)
                        }
                      />
                      <AppearanceImageMenu
                        label={lang === 'zh' ? '发型' : lang === 'ja' ? '髪型' : 'Hair'}
                        options={templateCatalog.hairs}
                        value={templateAppearance.hairId}
                        isOpen={openAppearanceMenu === 'hairId'}
                        disabled={!templateCatalog.installed || !presetEnabled}
                        assetUrlBySource={appearanceAssetUrls}
                        customAssetUrl={selectedAppearanceTemplate?.customFrontHairAssetUrl}
                        onToggle={() =>
                          setOpenAppearanceMenu((current) =>
                            current === 'hairId' ? null : 'hairId',
                          )
                        }
                        onChange={(value) => {
                          updateAppearanceTemplate('hairId', value);
                          setOpenAppearanceMenu(null);
                        }}
                        onUploadCustom={(file) =>
                          uploadCustomAppearanceLayer('customFrontHairAssetUrl', file)
                        }
                      />
                      <AppearanceImageMenu
                        label={lang === 'zh' ? '衣服' : lang === 'ja' ? '服装' : 'Outfit'}
                        options={templateCatalog.outfits}
                        value={templateAppearance.outfitId}
                        isOpen={openAppearanceMenu === 'outfitId'}
                        disabled={!templateCatalog.installed || !presetEnabled}
                        assetUrlBySource={appearanceAssetUrls}
                        customAssetUrl={selectedAppearanceTemplate?.customOutfitAssetUrl}
                        onToggle={() =>
                          setOpenAppearanceMenu((current) =>
                            current === 'outfitId' ? null : 'outfitId',
                          )
                        }
                        onChange={(value) => {
                          updateAppearanceTemplate('outfitId', value);
                          setOpenAppearanceMenu(null);
                        }}
                        onUploadCustom={(file) =>
                          uploadCustomAppearanceLayer('customOutfitAssetUrl', file)
                        }
                      />
                      {presetEnabled ? (
                        <button
                          type="button"
                          onClick={disablePresetAppearance}
                          className="rounded px-1 text-[9px] text-[var(--text-muted)] hover:bg-[var(--app-bg)] hover:text-red-500"
                        >
                          关闭预设
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50/70 px-1.5 py-0.5 text-[9px] text-purple-600 dark:border-purple-800 dark:bg-purple-950/30">
                          {presetDownloadState === 'downloading' ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>
                                {presetDownloadProgress.completed}/
                                {presetDownloadProgress.total || presetCatalogSourceUrls.length}
                              </span>
                              <button
                                type="button"
                                onClick={pausePresetAppearanceDownload}
                                className="rounded px-1 hover:bg-purple-100 dark:hover:bg-purple-900"
                              >
                                暂停
                              </button>
                              <button
                                type="button"
                                onClick={() => void removePresetAppearance()}
                                className="rounded px-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                删除
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => void enablePresetAppearance()}
                                className="rounded px-1 font-semibold hover:bg-purple-100 dark:hover:bg-purple-900"
                              >
                                {presetDownloadState === 'paused' ? '继续启用' : '启用预设'}
                              </button>
                              {presetDownloadState === 'paused' && (
                                <button
                                  type="button"
                                  onClick={() => void removePresetAppearance()}
                                  className="rounded px-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  删除
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {!templateCatalog.installed && (
                        <span className="text-[9px] text-[var(--text-muted)]">素材待导入</span>
                      )}
                    </>
                  )}
                  {!presetEnabled && templateCatalog && (
                    <div className="nodrag mt-1 flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50/70 px-1.5 py-1 text-[9px] text-purple-600 dark:border-purple-800 dark:bg-purple-950/30">
                      {presetDownloadState === 'downloading' ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>
                            {presetDownloadProgress.completed}/
                            {presetDownloadProgress.total || presetCatalogSourceUrls.length}
                          </span>
                          <button
                            type="button"
                            onClick={pausePresetAppearanceDownload}
                            className="rounded px-1 hover:bg-purple-100 dark:hover:bg-purple-900"
                          >
                            暂停
                          </button>
                          <button
                            type="button"
                            onClick={() => void removePresetAppearance()}
                            className="rounded px-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            删除
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void enablePresetAppearance()}
                          className="rounded px-1 font-semibold hover:bg-purple-100 dark:hover:bg-purple-900"
                        >
                          {presetDownloadState === 'paused' ? '继续启用' : '启用人物预设'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleRollSetting}
                disabled={isRollingSetting}
                className={`shrink-0 w-8 h-8 rounded-lg transition-colors flex items-center justify-center border border-purple-500/20 ${isRollingSetting ? 'text-purple-500 bg-purple-500/10 cursor-wait' : 'text-purple-500 hover:text-purple-600 hover:bg-purple-500/10'}`}
                title={lang === 'zh' ? '摇色子生成/扩写人物设定' : 'Roll character setting'}
              >
                {isRollingSetting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
                    lang === 'zh'
                      ? '根据人物设定生成头像、三视图和透明标签立绘'
                      : 'Generate portrait, three-view sheet, and transparent tag sprite'
                  }
                >
                  {isGeneratingSettingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <WandSparkles className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {/* Traits */}
            <div className="px-3 pt-3 pb-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <label className={PROFILE_FIELD_CLASS}>
                  <span className="text-[10px] font-bold text-purple-500 ml-1">外表</span>
                  <textarea
                    data-agent-field="appearance"
                    value={appearance}
                    onChange={(event) => updateNodeData({ appearance: event.target.value })}
                    placeholder="长相、穿着、明显特征"
                    className={PROFILE_TEXTAREA_CLASS}
                  />
                </label>
                <label className={PROFILE_FIELD_CLASS}>
                  <span className="text-[10px] font-bold text-purple-500 ml-1">性格</span>
                  <textarea
                    data-agent-field="personality"
                    value={data.personality || ''}
                    onChange={(event) => updateNodeData({ personality: event.target.value })}
                    placeholder="这个人平时是什么样子"
                    className={PROFILE_TEXTAREA_CLASS}
                  />
                </label>
                <label className={PROFILE_FIELD_CLASS}>
                  <span className="text-[10px] font-bold text-purple-500 ml-1">习惯</span>
                  <textarea
                    data-agent-field="habits"
                    value={data.habits || ''}
                    onChange={(event) => updateNodeData({ habits: event.target.value })}
                    placeholder="常见的小动作或反应"
                    className={PROFILE_TEXTAREA_CLASS}
                  />
                </label>
                <label className={PROFILE_FIELD_CLASS}>
                  <span className="text-[10px] font-bold text-purple-500 ml-1">说话</span>
                  <textarea
                    data-agent-field="speech-style"
                    value={data.speechStyle || ''}
                    onChange={(event) => updateNodeData({ speechStyle: event.target.value })}
                    placeholder="语气、用词、说话方式"
                    className={PROFILE_TEXTAREA_CLASS}
                  />
                </label>
                <label className={PROFILE_FIELD_CLASS}>
                  <span className="text-[10px] font-bold text-purple-500 ml-1">经历</span>
                  <textarea
                    data-agent-field="experience"
                    value={experience}
                    onChange={(event) => updateNodeData({ experience: event.target.value })}
                    placeholder="一两件影响过他的事"
                    className={PROFILE_TEXTAREA_CLASS}
                  />
                </label>
                <label className={PROFILE_FIELD_CLASS}>
                  <span className="text-[10px] font-bold text-purple-500 ml-1">关系</span>
                  <textarea
                    data-agent-field="relationships"
                    value={data.relationships || ''}
                    onChange={(event) => updateNodeData({ relationships: event.target.value })}
                    placeholder="和重要人物的基本关系"
                    className={PROFILE_TEXTAREA_CLASS}
                  />
                </label>
                <label className={`${PROFILE_FIELD_CLASS} col-span-2`}>
                  <span className="text-[10px] font-bold text-purple-500 ml-1">补充</span>
                  <textarea
                    data-agent-field="notes"
                    value={notes}
                    onChange={(event) => updateNodeData({ notes: event.target.value })}
                    placeholder="喜欢、害怕、身体特征等"
                    className={PROFILE_TEXTAREA_CLASS}
                  />
                </label>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] px-2 py-1.5">
                <span className="shrink-0 text-[10px] font-bold text-purple-500">语音 API</span>
                <select
                  data-agent-field="voice-profile"
                  value={data.voiceProfileId || ''}
                  onChange={(event) => {
                    const voiceProfileId = event.target.value || undefined;
                    const profile = voiceOptions.find((option) => option.id === voiceProfileId);
                    updateNodeData({
                      voiceProfileId,
                      voiceId: voiceProfileId ? profile?.defaultVoice || undefined : undefined,
                    });
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--text-primary)] outline-none"
                >
                  <option value="">请选择语音 API</option>
                  {voiceOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] px-2 py-1.5">
                <span className="shrink-0 text-[10px] font-bold text-purple-500">音色</span>
                <input
                  data-agent-field="voice-id"
                  list={voiceListId}
                  value={selectedVoiceId}
                  onChange={(event) => updateNodeData({ voiceId: event.target.value || undefined })}
                  disabled={!selectedVoiceProfile}
                  placeholder={selectedVoiceProfile?.voicePlaceholder || '请先选择语音 API'}
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-45"
                />
                <datalist id={voiceListId}>
                  {(selectedVoiceProfile?.voiceOptions || []).map((voice) => (
                    <option key={voice} value={voice} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={() =>
                    data.onPreviewCharacterVoice?.(id, data.voiceProfileId, selectedVoiceId)
                  }
                  disabled={!data.onPreviewCharacterVoice || !selectedVoiceProfile}
                  className="rounded p-1 text-purple-500 transition-colors hover:bg-purple-500/10 disabled:cursor-not-allowed disabled:opacity-35"
                  title="试听音色"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="hidden">
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

            <div className="px-3 pb-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="ml-1 text-[11px] font-bold text-[var(--text-secondary)]">
                  {lang === 'zh'
                    ? '人物素材'
                    : lang === 'ja'
                      ? 'キャラクター素材'
                      : 'Character Assets'}
                </label>
                {isGeneratingSettingImage && (
                  <span className="text-[10px] font-medium text-fuchsia-500">
                    {generationProgress?.label || (lang === 'zh' ? '准备中' : 'Preparing')}{' '}
                    {generationProgress?.current || 0}/{generationProgress?.total || 3}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {characterAssetSlots.map((asset) => (
                  <div
                    key={asset.key}
                    className="min-w-0 overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)]"
                  >
                    <div
                      className={`relative flex h-[82px] items-center justify-center overflow-hidden ${asset.surfaceClass}`}
                    >
                      {asset.appearancePreviewMode ? (
                        <div className="nodrag flex h-full w-full items-center justify-center p-1.5">
                          <CharacterAppearancePreview
                            appearance={templateAppearance!}
                            assetUrlOverrides={appearanceAssetUrls}
                            mode={asset.appearancePreviewMode}
                            adjustment={appearanceAdjustment}
                            className="h-full w-full object-contain drop-shadow-sm"
                          />
                        </div>
                      ) : asset.url ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPreviewAssetKey(asset.key);
                          }}
                          className="nodrag nopan flex h-full w-full cursor-zoom-in items-center justify-center p-1.5"
                          title={lang === 'zh' ? `查看${asset.label}` : `View ${asset.label}`}
                        >
                          <img
                            src={asset.url}
                            alt={asset.label}
                            className="h-full w-full object-contain drop-shadow-sm"
                          />
                        </button>
                      ) : (
                        <label
                          className="flex h-full w-full cursor-pointer items-center justify-center text-purple-400 transition-colors hover:bg-purple-500/10"
                          title={lang === 'zh' ? `上传${asset.label}` : `Upload ${asset.label}`}
                        >
                          <ImageIcon className="h-5 w-5" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleCharacterAssetUpload(event, asset.key)}
                          />
                        </label>
                      )}
                      {asset.url && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeCharacterAsset(asset.key);
                          }}
                          className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border border-white/70 bg-white/85 text-red-500 shadow-sm transition-colors hover:bg-red-50 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:bg-red-950/40"
                          title={lang === 'zh' ? `删除${asset.label}` : `Remove ${asset.label}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                      {(asset.url || asset.appearancePreviewMode) && (
                        <label
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/70 bg-white/85 text-purple-500 shadow-sm transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-900/90"
                          title={lang === 'zh' ? `替换${asset.label}` : `Replace ${asset.label}`}
                        >
                          <Upload className="h-3 w-3" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleCharacterAssetUpload(event, asset.key)}
                          />
                        </label>
                      )}
                    </div>
                    <div className="px-1.5 py-1.5">
                      <div className="truncate text-[10px] font-bold text-[var(--text-primary)]">
                        {asset.label}
                      </div>
                      <div className="truncate text-[9px] text-[var(--text-muted)]">
                        {asset.hint}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Outfits / alternate looks */}
            <div className="p-3 flex flex-col gap-2 relative shrink-0 min-h-[100px] rounded-b-xl border-t border-[var(--card-border)] bg-[var(--card-bg)]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[var(--text-secondary)] ml-1">
                  {lang === 'zh' ? '不同穿着' : lang === 'ja' ? '衣装違い' : 'Alternate Looks'}
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
                      {index > 0 && (
                        <button
                          onClick={() => removeOutfit(outfit.id)}
                          className="opacity-0 group-hover/outfit:opacity-100 p-1 text-red-400 hover:text-red-500 transition-opacity"
                          title="删除此穿着"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
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
              <img src={placeholderAvatarUrl} alt="" className="h-full w-full object-cover" />
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

      {previewAsset?.url &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-5 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={previewAsset.label}
            onMouseDown={() => setPreviewAssetKey(null)}
          >
            <div
              className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/70 bg-[var(--card-bg)] shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-[var(--text-primary)]">
                    {previewAsset.label}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{previewAsset.hint}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewAssetKey(null)}
                  className="nodrag nopan rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--app-bg)] hover:text-[var(--text-primary)]"
                  title={lang === 'zh' ? '关闭预览' : 'Close preview'}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div
                className={`flex h-[min(65vh,560px)] items-center justify-center p-5 ${previewAsset.surfaceClass}`}
              >
                <img
                  src={previewAsset.url}
                  alt={previewAsset.label}
                  className="h-full w-full object-contain drop-shadow-xl"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export const MemoizedCharacterNode = memo(CharacterNode);
