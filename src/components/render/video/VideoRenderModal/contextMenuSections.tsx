import type { Node as FlowNode } from '@xyflow/react';
import {
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Copy,
  Download,
  Eye,
  FileDown,
  FileText,
  Gauge,
  ListPlus,
  Mic,
  Music,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  UserRound,
  Video,
} from 'lucide-react';

import type { Language } from '../../../../lib/i18n';
import { renderCopy } from '../shared/renderCopy';
import type {
  RenderContextMenuSection,
  RenderContextMenuTarget,
  RenderStatus,
} from '../shared/types';

type TrackKind = 'video' | 'audio';

export type ContextMenuSectionDependencies = {
  language: Language;
  status: RenderStatus;
  audioBusy: boolean;
  timelineIds: string[];
  assetNodeById: Map<string, FlowNode>;
  timelineNodeById: Map<string, FlowNode>;
  uploadedAssetNodes: FlowNode[];
  selectedIds: Set<string>;
  selectedSpeechNodes: FlowNode[];
  visibleAssetNodes: FlowNode[];
  videoTrackIds: string[];
  audioTrackIds: string[];
  videoTrackByNodeId: Record<string, string>;
  audioTrackByNodeId: Record<string, string>;
  timelineDurationById: Record<string, number>;
  keyShotIds: Set<string>;
  speed: number;
  defaultSeconds: number;
  canGenerateSpeechFromNode: (node: FlowNode) => boolean;
  segmentDurationLabel: (node: FlowNode) => string;
  segmentTitle: (node: FlowNode) => string;
  sortSelectedAssetsByCardOrder: () => void;
  importSelectedAssetsToTimeline: () => void;
  removeUploadedAssets: (ids: string[]) => void;
  generateAudioFromSelectedText: (nodes: FlowNode[]) => void;
  setTimelineNodesExported: (ids: string[], exported: boolean) => void;
  removeTimelineNodes: (ids: string[]) => void;
  addNearestAssetToTimeline: (kind: TrackKind) => void;
  selectAllTimelineNodes: () => void;
  clearTimelineSelection: () => void;
  addVideoTrack: () => void;
  addAudioTrack: () => void;
  assignNodeTrack: (id: string, kind: TrackKind, trackId: string) => void;
  useActualMediaDuration: (node: FlowNode) => void;
  previewNode: (id: string) => void;
  toggleNode: (id: string) => void;
  separateTimelineAudio: (node: FlowNode) => void;
  toggleKeyShot: (id: string) => void;
  removeTimelineNode: (id: string) => void;
  selectOnlyNode: (id: string) => void;
  selectTimelineFromNode: (id: string) => void;
  addNodeToTimeline: (id: string, kind: TrackKind, trackId?: string) => void;
  closeContextMenu: () => void;
};

export const createContextMenuSectionBuilder = (deps: ContextMenuSectionDependencies) => {
  const isZh = deps.language === 'zh';
  const canMutate = deps.status !== 'rendering';
  const speechNodesFor = (menu: RenderContextMenuTarget, node?: FlowNode) => {
    const explicitSelection = (menu.selectedNodeIds || [])
      .map((id) => deps.timelineNodeById.get(id))
      .filter((item): item is FlowNode => Boolean(item));
    if (explicitSelection.length > 0) {
      return explicitSelection.filter(deps.canGenerateSpeechFromNode);
    }
    if (node && deps.selectedIds.has(node.id)) return deps.selectedSpeechNodes;
    if (node && deps.canGenerateSpeechFromNode(node)) return [node];
    return deps.selectedSpeechNodes;
  };
  const trackItems = (node: FlowNode, kind: TrackKind) => {
    const trackIds = kind === 'audio' ? deps.audioTrackIds : deps.videoTrackIds;
    const trackByNodeId =
      kind === 'audio' ? deps.audioTrackByNodeId : deps.videoTrackByNodeId;
    return trackIds.map((trackId, index) => ({
      label: isZh
        ? `移动到${kind === 'audio' ? '音频' : '视频'}轨 ${index + 1}`
        : `Move to ${kind === 'audio' ? 'Audio' : 'Video'} ${index + 1}`,
      icon:
        kind === 'audio' ? (
          <Music className="w-4 h-4" />
        ) : (
          <Video className="w-4 h-4" />
        ),
      onSelect: () => deps.assignNodeTrack(node.id, kind, trackId),
      disabled: !canMutate || (trackByNodeId[node.id] || trackIds[0]) === trackId,
    }));
  };

  return (
    menu: RenderContextMenuTarget,
    node?: FlowNode,
  ): RenderContextMenuSection[] => {
    const isTimelineNode =
      !!node &&
      (menu.kind === 'timeline' || menu.kind === 'audio') &&
      deps.timelineIds.includes(node.id);
    const speechNodes = speechNodesFor(menu, node);

    if (!node) {
      const selectedAssetIds = (menu.selectedNodeIds || []).filter((id) =>
        deps.assetNodeById.has(id),
      );
      if (menu.kind === 'asset' && selectedAssetIds.length > 0) {
        const uploadedIds = selectedAssetIds.filter((id) =>
          deps.uploadedAssetNodes.some((asset) => asset.id === id),
        );
        return [
          {
            items: [
              {
                label: renderCopy(
                  deps.language,
                  '按卡片顺序排序',
                  'カード順に並べる',
                  'Sort by card order',
                ),
                icon: <ListPlus className="w-4 h-4" />,
                onSelect: deps.sortSelectedAssetsByCardOrder,
              },
              {
                label: renderCopy(
                  deps.language,
                  '导入到编辑时间线',
                  '編集タイムラインに追加',
                  'Import to editing timeline',
                ),
                icon: <Download className="w-4 h-4" />,
                onSelect: deps.importSelectedAssetsToTimeline,
                disabled: !canMutate,
              },
            ],
          },
          ...(uploadedIds.length
            ? [
                {
                  items: [
                    {
                      label: renderCopy(
                        deps.language,
                        `删除上传素材（${uploadedIds.length}）`,
                        `アップロード素材を削除（${uploadedIds.length}）`,
                        `Delete uploaded asset(s) (${uploadedIds.length})`,
                      ),
                      icon: <Trash2 className="w-4 h-4" />,
                      onSelect: () => deps.removeUploadedAssets(uploadedIds),
                      disabled: !canMutate,
                      danger: true,
                    },
                  ],
                },
              ]
            : []),
          {
            items: [
              {
                label: renderCopy(
                  deps.language,
                  `已选择 ${selectedAssetIds.length} 个素材，拖动任一卡片加入时间线`,
                  `${selectedAssetIds.length} 個の素材を選択中。任意のカードをドラッグ`,
                  `${selectedAssetIds.length} assets selected; drag any card to the timeline`,
                ),
                icon: <ListPlus className="w-4 h-4" />,
                disabled: true,
              },
            ],
          },
        ];
      }

      const selectedTimelineIds = (menu.selectedNodeIds || []).filter((id) =>
        deps.timelineIds.includes(id),
      );
      const allExported =
        selectedTimelineIds.length > 0 &&
        selectedTimelineIds.every((id) => deps.selectedIds.has(id));
      if (selectedTimelineIds.length > 0) {
        return [
          {
            items: [
              {
                label: isZh
                  ? `文字转音频（${speechNodes.length}）`
                  : `Text to audio (${speechNodes.length})`,
                icon: <Mic className="w-4 h-4" />,
                onSelect: () => deps.generateAudioFromSelectedText(speechNodes),
                disabled: !canMutate || deps.audioBusy || speechNodes.length === 0,
              },
              {
                label: allExported
                  ? isZh
                    ? '不导出'
                    : 'Do not export'
                  : isZh
                    ? '导出'
                    : 'Export',
                icon: <CheckCircle2 className="w-4 h-4" />,
                onSelect: () =>
                  deps.setTimelineNodesExported(selectedTimelineIds, !allExported),
                disabled: !canMutate,
              },
            ],
          },
          {
            items: [
              {
                label: isZh ? '删除' : 'Delete',
                icon: <Trash2 className="w-4 h-4" />,
                onSelect: () => deps.removeTimelineNodes(selectedTimelineIds),
                disabled: !canMutate,
                danger: true,
              },
            ],
          },
        ];
      }

      return [
        {
          items: [
            {
              label: isZh
                ? `将选中的 ${speechNodes.length} 个片段文字生成音频`
                : `Generate speech for ${speechNodes.length} selected segment(s)`,
              icon: <Mic className="w-4 h-4" />,
              onSelect: () => deps.generateAudioFromSelectedText(speechNodes),
              disabled: !canMutate || deps.audioBusy || speechNodes.length === 0,
            },
            {
              label: isZh ? '插入最近素材到视频轨' : 'Insert next asset to video track',
              icon: <ListPlus className="w-4 h-4" />,
              onSelect: () => deps.addNearestAssetToTimeline('video'),
              disabled: !canMutate || deps.visibleAssetNodes.length === 0,
            },
            {
              label: isZh ? '插入最近素材到音频轨' : 'Insert next asset to audio track',
              icon: <Mic className="w-4 h-4" />,
              onSelect: () => deps.addNearestAssetToTimeline('audio'),
              disabled: !canMutate || deps.visibleAssetNodes.length === 0,
            },
          ],
        },
        {
          items: [
            {
              label: isZh ? '选择全部时间线卡片' : 'Select all timeline cards',
              icon: <CheckCircle2 className="w-4 h-4" />,
              onSelect: deps.selectAllTimelineNodes,
              disabled: !canMutate || deps.timelineIds.length === 0,
            },
            {
              label: isZh ? '清空导出选择' : 'Clear export selection',
              icon: <Scissors className="w-4 h-4" />,
              onSelect: deps.clearTimelineSelection,
              disabled: !canMutate || deps.selectedIds.size === 0,
            },
          ],
        },
        {
          items: [
            {
              label: isZh ? '新增视频轨' : 'Add video track',
              icon: <Video className="w-4 h-4" />,
              onSelect: deps.addVideoTrack,
              disabled: !canMutate,
            },
            {
              label: isZh ? '新增音频轨' : 'Add audio track',
              icon: <Music className="w-4 h-4" />,
              onSelect: deps.addAudioTrack,
              disabled: !canMutate,
            },
          ],
        },
      ];
    }

    if (isTimelineNode) {
      const exported = deps.selectedIds.has(node.id);
      const moveItems = trackItems(node, menu.trackKind === 'audio' ? 'audio' : 'video');
      return [
        {
          items: [
            {
              label: `${deps.segmentDurationLabel(node)} · ${
                deps.timelineDurationById[node.id]
                  ? `${(deps.timelineDurationById[node.id] / deps.speed).toFixed(2)}s`
                  : `${deps.defaultSeconds.toFixed(2)}s`
              }`,
              icon: <Clock className="w-4 h-4" />,
              onSelect: () => deps.useActualMediaDuration(node),
              disabled: !canMutate || (!node.data?.videoUrl && !node.data?.audioUrl),
            },
          ],
        },
        {
          items: [
            {
              label: isZh ? '预览此段' : 'Preview this segment',
              icon: <Eye className="w-4 h-4" />,
              onSelect: () => deps.previewNode(node.id),
              disabled: deps.status === 'rendering',
            },
            {
              label: exported ? (isZh ? '不导出' : 'Do not export') : isZh ? '导出' : 'Export',
              icon: <CheckCircle2 className="w-4 h-4" />,
              onSelect: () => deps.toggleNode(node.id),
              disabled: !canMutate,
            },
            {
              label: isZh ? '文字转音频' : 'Text to audio',
              icon: <Mic className="w-4 h-4" />,
              onSelect: () => deps.generateAudioFromSelectedText([node]),
              disabled:
                !canMutate || deps.audioBusy || !deps.canGenerateSpeechFromNode(node),
            },
          ],
        },
        {
          items: [
            {
              label: isZh ? '音视频分离' : 'Separate audio and video',
              icon: <Scissors className="w-4 h-4" />,
              onSelect: () => deps.separateTimelineAudio(node),
              disabled: !canMutate || !node.data?.videoUrl,
            },
            {
              label: deps.keyShotIds.has(node.id)
                ? isZh
                  ? '取消重点镜头'
                  : 'Unmark key shot'
                : isZh
                  ? '标记为重点镜头'
                  : 'Mark as key shot',
              icon: <Sparkles className="w-4 h-4" />,
              onSelect: () => deps.toggleKeyShot(node.id),
              disabled: !canMutate,
            },
          ],
        },
        ...(moveItems.length > 1 ? [{ items: moveItems }] : []),
        {
          items: [
            {
              label: isZh ? '删除' : 'Delete',
              icon: <Trash2 className="w-4 h-4" />,
              onSelect: () => deps.removeTimelineNode(node.id),
              disabled: !canMutate,
              danger: true,
            },
          ],
        },
      ];
    }

    const moveItems = trackItems(node, menu.trackKind === 'audio' ? 'audio' : 'video');
    return [
      {
        items: [
          {
            label: isZh ? '预览此段' : 'Preview this segment',
            icon: <Eye className="w-4 h-4" />,
            onSelect: () => deps.previewNode(node.id),
            disabled: deps.status === 'rendering',
          },
          {
            label: isZh ? '只导出此段' : 'Export only this segment',
            icon: <FileDown className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '从此处开始导出' : 'Export from here',
            icon: <Gauge className="w-4 h-4" />,
            disabled: true,
          },
        ],
      },
      {
        items: [
          {
            label: isZh ? '加入视频时间线' : 'Add to video timeline',
            icon: <ListPlus className="w-4 h-4" />,
            onSelect: () => deps.addNodeToTimeline(node.id, 'video', menu.trackId),
            disabled: !canMutate,
          },
          {
            label: isZh ? '加入音频时间线' : 'Add to audio timeline',
            icon: <Mic className="w-4 h-4" />,
            onSelect: () => deps.addNodeToTimeline(node.id, 'audio', menu.trackId),
            disabled: !canMutate,
          },
          {
            label: deps.selectedIds.has(node.id)
              ? isZh
                ? '从导出中排除'
                : 'Exclude from export'
              : isZh
                ? '加入导出选择'
                : 'Include in export',
            icon: <CheckCircle2 className="w-4 h-4" />,
            disabled: true,
          },
        ],
      },
      {
        items: [
          {
            label: isZh ? '重新生成此段画面' : 'Regenerate visuals',
            icon: <RotateCcw className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '文字转音频' : 'Text to audio',
            icon: <Mic className="w-4 h-4" />,
            onSelect: () => deps.generateAudioFromSelectedText(speechNodes),
            disabled: !canMutate || deps.audioBusy || speechNodes.length === 0,
          },
          {
            label: isZh ? '编辑剧情内容' : 'Edit story content',
            icon: <FileText className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '编辑角色/表情' : 'Edit character/expression',
            icon: <UserRound className="w-4 h-4" />,
            disabled: true,
          },
        ],
      },
      {
        items: [
          {
            label: isZh ? '调整时长' : 'Adjust duration',
            icon: <Clock className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '拆分卡片' : 'Split card',
            icon: <Scissors className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '复制卡片' : 'Duplicate card',
            icon: <Copy className="w-4 h-4" />,
            disabled: true,
          },
        ],
      },
      ...(moveItems.length > 1 ? [{ items: moveItems }] : []),
      ...(deps.uploadedAssetNodes.some((asset) => asset.id === node.id)
        ? [
            {
              items: [
                {
                  label: isZh ? '删除上传素材' : 'Delete uploaded asset',
                  icon: <Trash2 className="w-4 h-4" />,
                  onSelect: () => deps.removeUploadedAssets([node.id]),
                  disabled: !canMutate,
                  danger: true,
                },
              ],
            },
          ]
        : []),
      {
        items: [
          {
            label: isZh ? '复制卡片标题' : 'Copy card title',
            icon: <ClipboardCopy className="w-4 h-4" />,
            onSelect: () => {
              deps.closeContextMenu();
              navigator.clipboard?.writeText(deps.segmentTitle(node));
            },
          },
          {
            label: isZh ? '标记为重点镜头' : 'Mark as key shot',
            icon: <Sparkles className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: isZh ? '从时间线删除' : 'Remove from timeline',
            icon: <Trash2 className="w-4 h-4" />,
            disabled: true,
            danger: true,
          },
        ],
      },
    ];
  };
};
