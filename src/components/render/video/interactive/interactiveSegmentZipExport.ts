import type { Node as FlowNode } from '@xyflow/react';
import JSZip from 'jszip';
import type { Dispatch, SetStateAction } from 'react';

import type { Language } from '../../../../lib/i18n';
import { saveRenderedWebZip } from '../export/tauriRenderAdapter';
import { isTauriRuntime } from '../shared/mediaUtils';
import { renderCopy } from '../shared/renderCopy';
import type { RenderStatus } from '../shared/types';
import {
  buildSegmentLayout,
  graphBoundsFromPositions,
  type LayoutDirection,
} from './interactiveSegmentGraphLayout';
import {
  buildInteractiveSegmentExportOrder,
  createInteractiveSegmentStructurePngBytes,
  sortSegmentsByExportOrder,
} from './InteractiveSegmentExportOrder';
import type { InteractiveSegmentDraft } from './interactiveSegments';
import { makeInteractiveSegmentFileName } from './interactiveSegments';

type RenderSegmentVideo = (options: {
  fileName?: string;
  frameRate?: number;
  exportFormat?: 'mp4';
  nodes?: FlowNode[];
  audioSegments?: [];
  outputDir?: string;
  progressPrefix?: string;
  returnBytes?: boolean;
}) => Promise<Uint8Array | undefined>;

type ExportZipArgs = {
  language: Language;
  segments: InteractiveSegmentDraft[];
  nodesById: Map<string, FlowNode>;
  activeSegmentId: string;
  outputDir: string;
  frameRate: number;
  renderVideo: RenderSegmentVideo;
  setStatus: Dispatch<SetStateAction<RenderStatus>>;
  setError: Dispatch<SetStateAction<string>>;
  setSavedPath: Dispatch<SetStateAction<string>>;
  setProgress: Dispatch<SetStateAction<string>>;
  setProgressValue: Dispatch<SetStateAction<number>>;
};

const zipName = () => `interactive-segments-${Date.now()}`;

const downloadZip = (bytes: Uint8Array, fileName: string) => {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const exportInteractiveSegmentZip = async ({
  language,
  segments,
  nodesById,
  activeSegmentId,
  outputDir,
  frameRate,
  renderVideo,
  setStatus,
  setError,
  setSavedPath,
  setProgress,
  setProgressValue,
}: ExportZipArgs) => {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const orderIds = buildInteractiveSegmentExportOrder(segments, activeSegmentId);
  const enabledSegments = sortSegmentsByExportOrder(
    segments.filter((segment) => segment.enabled),
    orderIds,
  );
  if (enabledSegments.length === 0) return;

  const fileName = zipName();
  const zip = new JSZip();
  setStatus('rendering');
  setError('');
  setSavedPath('');
  setProgressValue(0);
  setProgress(t('准备导出互动分段 ZIP...', 'インタラクティブ分割 ZIP を準備中...', 'Preparing interactive ZIP...'));

  try {
    for (let index = 0; index < enabledSegments.length; index += 1) {
      const segment = enabledSegments[index];
      const segmentNodes = segment.nodeIds
        .map((id) => nodesById.get(id))
        .filter(Boolean) as FlowNode[];
      if (segmentNodes.length === 0) continue;

      const progressPrefix = `${index + 1}/${enabledSegments.length}`;
      setProgress(
        t(
          `正在渲染互动片段 ${progressPrefix}`,
          `インタラクティブ分割をレンダリング中 ${progressPrefix}`,
          `Rendering interactive segment ${progressPrefix}`,
        ),
      );
      const bytes = await renderVideo({
        fileName: makeInteractiveSegmentFileName(segment, index),
        frameRate,
        exportFormat: 'mp4',
        nodes: segmentNodes,
        audioSegments: [],
        progressPrefix,
        returnBytes: true,
      });
      if (!bytes) continue;
      zip.file(`${String(index + 1).padStart(2, '0')}-${makeInteractiveSegmentFileName(segment, index)}.mp4`, bytes);
      setProgressValue(Math.round(((index + 1) / enabledSegments.length) * 82));
    }

    const cardWidth = 280;
    const cardHeight = 222;
    const graphPadding = 120;
    const layoutDirection: LayoutDirection = 'right';
    const positions = buildSegmentLayout(segments, layoutDirection, cardWidth, cardHeight);
    const graphBounds = graphBoundsFromPositions(positions, cardWidth, cardHeight);
    const renderPositions = new Map<string, { x: number; y: number }>();
    positions.forEach((position, id) => {
      renderPositions.set(id, {
        x: position.x + graphPadding - graphBounds.minX,
        y: position.y + graphPadding - graphBounds.minY,
      });
    });
    const graphLinks = segments.flatMap((segment) =>
      segment.choices.map((choice) => ({
        id: choice.id,
        fromSegmentId: segment.id,
        toSegmentId: choice.targetSegmentId,
        label: choice.label,
      })),
    );
    const structureBytes = await createInteractiveSegmentStructurePngBytes({
      segments,
      graphLinks,
      renderPositions,
      exportOrderIds: orderIds,
      cardWidth,
      cardHeight,
      graphWidth: Math.max(1040, graphBounds.maxX - graphBounds.minX + graphPadding * 2),
      graphHeight: Math.max(620, graphBounds.maxY - graphBounds.minY + graphPadding * 2),
      layoutDirection,
    });
    if (structureBytes.length > 0) {
      zip.file('interactive-segment-structure.png', structureBytes);
    }

    setProgressValue(90);
    setProgress(t('正在打包 ZIP...', 'ZIP を作成中...', 'Packaging ZIP...'));
    const zipBytes = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    if (isTauriRuntime()) {
      const result = await saveRenderedWebZip({
        fileName,
        bytes: Array.from(zipBytes),
        outputDir,
      });
      setSavedPath(result.path);
    } else {
      downloadZip(zipBytes, fileName);
      setSavedPath(`${fileName}.zip`);
    }
    setStatus('done');
    setProgressValue(100);
    setProgress(t('互动分段 ZIP 导出完成', 'インタラクティブ分割 ZIP を書き出しました', 'Interactive ZIP exported'));
  } catch (error: any) {
    console.error('Interactive segment ZIP export failed:', error);
    setStatus('error');
    setError(error?.message || t('互动分段 ZIP 导出失败', 'インタラクティブ分割 ZIP の書き出しに失敗しました', 'Interactive ZIP export failed'));
  }
};
