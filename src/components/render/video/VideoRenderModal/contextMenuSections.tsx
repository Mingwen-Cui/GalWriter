import { getVideoTextForChinesePreference } from '../i18n';
import { formatVideoText } from '../i18n';
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
    const trackByNodeId = kind === 'audio' ? deps.audioTrackByNodeId : deps.videoTrackByNodeId;
    return trackIds.map((trackId, index) => ({
      label: getVideoTextForChinesePreference(
        isZh,
        'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText97',
        kind === 'audio' ? '音频' : '视频',
        index + 1,
      ),
      icon: kind === 'audio' ? <Music className="w-4 h-4" /> : <Video className="w-4 h-4" />,
      onSelect: () => deps.assignNodeTrack(node.id, kind, trackId),
      disabled: !canMutate || (trackByNodeId[node.id] || trackIds[0]) === trackId,
    }));
  };

  return (menu: RenderContextMenuTarget, node?: FlowNode): RenderContextMenuSection[] => {
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
                label: formatVideoText(
                  deps.language,
                  'componentsrendervideoVideoRenderModalcontextMenuSectionsText134',
                ),
                icon: <ListPlus className="w-4 h-4" />,
                onSelect: deps.sortSelectedAssetsByCardOrder,
              },
              {
                label: formatVideoText(
                  deps.language,
                  'componentsrendervideoVideoRenderModalcontextMenuSectionsText144',
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
                      label: formatVideoText(
                        deps.language,
                        'componentsrendervideoVideoRenderModalcontextMenuSectionsText161',
                        uploadedIds.length,
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
                label: formatVideoText(
                  deps.language,
                  'componentsrendervideoVideoRenderModalcontextMenuSectionsText179',
                  selectedAssetIds.length,
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
                label: getVideoTextForChinesePreference(
                  isZh,
                  'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText189',
                  speechNodes.length,
                ),
                icon: <Mic className="w-4 h-4" />,
                onSelect: () => deps.generateAudioFromSelectedText(speechNodes),
                disabled: !canMutate || deps.audioBusy || speechNodes.length === 0,
              },
              {
                label: allExported
                  ? getVideoTextForChinesePreference(
                      isZh,
                      'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText197',
                    )
                  : getVideoTextForChinesePreference(
                      isZh,
                      'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText197_2',
                    ),
                icon: <CheckCircle2 className="w-4 h-4" />,
                onSelect: () => deps.setTimelineNodesExported(selectedTimelineIds, !allExported),
                disabled: !canMutate,
              },
            ],
          },
          {
            items: [
              {
                label: getVideoTextForChinesePreference(
                  isZh,
                  'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText207',
                ),
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
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText222',
                speechNodes.length,
              ),
              icon: <Mic className="w-4 h-4" />,
              onSelect: () => deps.generateAudioFromSelectedText(speechNodes),
              disabled: !canMutate || deps.audioBusy || speechNodes.length === 0,
            },
            {
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText230',
              ),
              icon: <ListPlus className="w-4 h-4" />,
              onSelect: () => deps.addNearestAssetToTimeline('video'),
              disabled: !canMutate || deps.visibleAssetNodes.length === 0,
            },
            {
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText236',
              ),
              icon: <Mic className="w-4 h-4" />,
              onSelect: () => deps.addNearestAssetToTimeline('audio'),
              disabled: !canMutate || deps.visibleAssetNodes.length === 0,
            },
          ],
        },
        {
          items: [
            {
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText246',
              ),
              icon: <CheckCircle2 className="w-4 h-4" />,
              onSelect: deps.selectAllTimelineNodes,
              disabled: !canMutate || deps.timelineIds.length === 0,
            },
            {
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText252',
              ),
              icon: <Scissors className="w-4 h-4" />,
              onSelect: deps.clearTimelineSelection,
              disabled: !canMutate || deps.selectedIds.size === 0,
            },
          ],
        },
        {
          items: [
            {
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText262',
              ),
              icon: <Video className="w-4 h-4" />,
              onSelect: deps.addVideoTrack,
              disabled: !canMutate,
            },
            {
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText268',
              ),
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
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText299',
              ),
              icon: <Eye className="w-4 h-4" />,
              onSelect: () => deps.previewNode(node.id),
              disabled: deps.status === 'rendering',
            },
            {
              label: exported
                ? getVideoTextForChinesePreference(
                    isZh,
                    'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText305',
                  )
                : getVideoTextForChinesePreference(
                    isZh,
                    'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText305_2',
                  ),
              icon: <CheckCircle2 className="w-4 h-4" />,
              onSelect: () => deps.toggleNode(node.id),
              disabled: !canMutate,
            },
            {
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText311',
              ),
              icon: <Mic className="w-4 h-4" />,
              onSelect: () => deps.generateAudioFromSelectedText([node]),
              disabled: !canMutate || deps.audioBusy || !deps.canGenerateSpeechFromNode(node),
            },
          ],
        },
        {
          items: [
            {
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText321',
              ),
              icon: <Scissors className="w-4 h-4" />,
              onSelect: () => deps.separateTimelineAudio(node),
              disabled: !canMutate || !node.data?.videoUrl,
            },
            {
              label: deps.keyShotIds.has(node.id)
                ? getVideoTextForChinesePreference(
                    isZh,
                    'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText328',
                  )
                : getVideoTextForChinesePreference(
                    isZh,
                    'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText331',
                  ),
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
              label: getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText344',
              ),
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
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText360',
            ),
            icon: <Eye className="w-4 h-4" />,
            onSelect: () => deps.previewNode(node.id),
            disabled: deps.status === 'rendering',
          },
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText366',
            ),
            icon: <FileDown className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText371',
            ),
            icon: <Gauge className="w-4 h-4" />,
            disabled: true,
          },
        ],
      },
      {
        items: [
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText380',
            ),
            icon: <ListPlus className="w-4 h-4" />,
            onSelect: () => deps.addNodeToTimeline(node.id, 'video', menu.trackId),
            disabled: !canMutate,
          },
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText386',
            ),
            icon: <Mic className="w-4 h-4" />,
            onSelect: () => deps.addNodeToTimeline(node.id, 'audio', menu.trackId),
            disabled: !canMutate,
          },
          {
            label: deps.selectedIds.has(node.id)
              ? getVideoTextForChinesePreference(
                  isZh,
                  'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText393',
                )
              : getVideoTextForChinesePreference(
                  isZh,
                  'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText396',
                ),
            icon: <CheckCircle2 className="w-4 h-4" />,
            disabled: true,
          },
        ],
      },
      {
        items: [
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText407',
            ),
            icon: <RotateCcw className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText412',
            ),
            icon: <Mic className="w-4 h-4" />,
            onSelect: () => deps.generateAudioFromSelectedText(speechNodes),
            disabled: !canMutate || deps.audioBusy || speechNodes.length === 0,
          },
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText418',
            ),
            icon: <FileText className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText423',
            ),
            icon: <UserRound className="w-4 h-4" />,
            disabled: true,
          },
        ],
      },
      {
        items: [
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText432',
            ),
            icon: <Clock className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText437',
            ),
            icon: <Scissors className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText442',
            ),
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
                  label: getVideoTextForChinesePreference(
                    isZh,
                    'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText454',
                  ),
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
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText467',
            ),
            icon: <ClipboardCopy className="w-4 h-4" />,
            onSelect: () => {
              deps.closeContextMenu();
              navigator.clipboard?.writeText(deps.segmentTitle(node));
            },
          },
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText475',
            ),
            icon: <Sparkles className="w-4 h-4" />,
            disabled: true,
          },
          {
            label: getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModalcontextMenuSectionsIsZhText480',
            ),
            icon: <Trash2 className="w-4 h-4" />,
            disabled: true,
            danger: true,
          },
        ],
      },
    ];
  };
};
