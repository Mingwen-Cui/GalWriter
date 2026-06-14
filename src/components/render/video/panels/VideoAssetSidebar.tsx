import type { Node as FlowNode } from '@xyflow/react';
import { FileText, Grid2X2, Image, Layers, ListPlus, Plus, Rows3 } from 'lucide-react';
import { useRef, useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import { renderCopy } from '../shared/renderCopy';
import type { AssetCardLayout, AssetRegionOption } from '../shared/types';

type VideoAssetSidebarProps = {
  language: Language;
  assetPanelWidth: number;
  assetCardLayout: AssetCardLayout;
  assetCardScale: number;
  assetRegionFilter: string;
  assetRegionOptions: AssetRegionOption[];
  visibleAssetNodes: FlowNode[];
  allAssetNodes: FlowNode[];
  timelineIds: string[];
  nodeRegionById: Map<string, AssetRegionOption | null>;
  activePreviewNode?: FlowNode;
  selectedAssetIds: string[];
  assetScrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number };
  assetThumbTopPercent: number;
  assetThumbHeightPercent: number;
  assetUploadInputRef: React.RefObject<HTMLInputElement | null>;
  assetViewportRef: React.RefObject<HTMLDivElement | null>;
  setAssetCardLayout: (value: AssetCardLayout) => void;
  setAssetRegionFilter: (value: string) => void;
  setActivePreviewId: (value: string) => void;
  setAssetSelection: (ids: string[]) => void;
  handleAssetUploadInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleAssetFileDragOver: (event: React.DragEvent<HTMLElement>) => void;
  handleAssetFileDrop: (event: React.DragEvent<HTMLElement>) => void;
  syncAssetScrollInfo: () => void;
  handleAssetDragStart: (
    event: React.DragEvent<HTMLElement>,
    id: string,
    kind?: 'video' | 'audio',
    offsetSeconds?: number,
  ) => void;
  openContextMenu: (
    event: React.MouseEvent<HTMLElement>,
    target: { kind: 'asset'; nodeId?: string; selectedNodeIds?: string[] },
  ) => void;
  addNodeToTimeline: (
    id: string,
    trackKind?: 'video' | 'audio',
    trackId?: string,
    startTime?: number,
  ) => void;
  mediaIcon: (node: FlowNode, className?: string) => React.ReactNode;
  mediaKind: (node: FlowNode) => string;
  segmentTitle: (node: FlowNode) => string;
  segmentText: (node: FlowNode) => string;
  segmentDurationLabel: (node: FlowNode) => string;
  handleAssetScrollThumbStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleAssetScrollThumbMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleAssetScrollThumbEnd: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleAssetScaleHandleStart: (
    event: React.PointerEvent<HTMLButtonElement>,
    side: 'top' | 'bottom',
  ) => void;
  handleAssetScaleHandleMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  handleAssetScaleHandleEnd: (event: React.PointerEvent<HTMLButtonElement>) => void;
};

export function VideoAssetSidebar({
  language,
  assetPanelWidth,
  assetCardLayout,
  assetCardScale,
  assetRegionFilter,
  assetRegionOptions,
  visibleAssetNodes,
  allAssetNodes,
  timelineIds,
  nodeRegionById,
  activePreviewNode,
  selectedAssetIds,
  assetScrollInfo,
  assetThumbTopPercent,
  assetThumbHeightPercent,
  assetUploadInputRef,
  assetViewportRef,
  setAssetCardLayout,
  setAssetRegionFilter,
  setActivePreviewId,
  setAssetSelection,
  handleAssetUploadInputChange,
  handleAssetFileDragOver,
  handleAssetFileDrop,
  syncAssetScrollInfo,
  handleAssetDragStart,
  openContextMenu,
  addNodeToTimeline,
  mediaIcon,
  mediaKind,
  segmentTitle,
  segmentText,
  segmentDurationLabel,
  handleAssetScrollThumbStart,
  handleAssetScrollThumbMove,
  handleAssetScrollThumbEnd,
  handleAssetScaleHandleStart,
  handleAssetScaleHandleMove,
  handleAssetScaleHandleEnd,
}: VideoAssetSidebarProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const selectionDragRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    pointerId: number;
  } | null>(null);
  const suppressNextContextMenuRef = useRef(false);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const handleSelectionPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.focus({ preventScroll: true });
    if (event.button !== 2) return;
    const target = event.target as HTMLElement;
    if (target.closest('button,input,select,textarea,[draggable="true"]')) return;
    event.preventDefault();
    const drag = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      pointerId: event.pointerId,
    };
    selectionDragRef.current = drag;
    setSelectionBox(drag);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSelectionPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = selectionDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = { ...drag, currentX: event.clientX, currentY: event.clientY };
    selectionDragRef.current = next;
    setSelectionBox(next);
  };

  const handleSelectionPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = selectionDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    selectionDragRef.current = null;
    setSelectionBox(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const width = Math.abs(drag.currentX - drag.startX);
    const height = Math.abs(drag.currentY - drag.startY);
    if (width < 5 && height < 5) return;

    suppressNextContextMenuRef.current = true;
    const selectionRect = {
      left: Math.min(drag.startX, drag.currentX),
      right: Math.max(drag.startX, drag.currentX),
      top: Math.min(drag.startY, drag.currentY),
      bottom: Math.max(drag.startY, drag.currentY),
    };
    const ids = Array.from(
      assetViewportRef.current?.querySelectorAll<HTMLElement>('[data-asset-card-id]') || [],
    )
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const selected =
          rect.left <= selectionRect.right &&
          rect.right >= selectionRect.left &&
          rect.top <= selectionRect.bottom &&
          rect.bottom >= selectionRect.top;
        return selected;
      })
      .map((element) => element.dataset.assetCardId)
      .filter((id): id is string => Boolean(id));
    const uniqueIds = Array.from(new Set(ids));
    setAssetSelection(uniqueIds);
    if (uniqueIds.length > 0) {
      openContextMenu(event as unknown as React.MouseEvent<HTMLElement>, {
        kind: 'asset',
        selectedNodeIds: uniqueIds,
      });
    }
  };

  return (
    <aside
      className="min-h-0 border-r border-[var(--vr-border)] bg-[var(--vr-surface)] backdrop-blur-xl flex flex-col shrink-0"
      style={{ width: assetPanelWidth }}
      onDragOver={handleAssetFileDragOver}
      onDrop={handleAssetFileDrop}
    >
      <div className="h-12 px-4 border-b border-[var(--vr-border)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
          <Layers className="w-4 h-4 text-[var(--vr-accent)]" />
          {t('素材卡片', '素材カード', 'Asset Cards')}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--vr-text-muted)]">
            {visibleAssetNodes.length}/{allAssetNodes.length}
          </span>
          <div className="flex h-7 items-center rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-0.5">
            <button
              type="button"
              onClick={() => setAssetCardLayout('row')}
              className={`h-6 w-6 rounded-md flex items-center justify-center transition-colors ${assetCardLayout === 'row' ? 'bg-[var(--vr-panel)] text-[var(--vr-accent)] shadow-sm' : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'}`}
              title={t('横向排列', '横並び', 'Row layout')}
              aria-label={t('横向排列', '横並び', 'Row layout')}
            >
              <Rows3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setAssetCardLayout('grid')}
              className={`h-6 w-6 rounded-md flex items-center justify-center transition-colors ${assetCardLayout === 'grid' ? 'bg-[var(--vr-panel)] text-[var(--vr-accent)] shadow-sm' : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'}`}
              title={t('网格排列', 'グリッド表示', 'Grid layout')}
              aria-label={t('网格排列', 'グリッド表示', 'Grid layout')}
            >
              <Grid2X2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-b border-[var(--vr-border)]">
        <input
          ref={assetUploadInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          onChange={handleAssetUploadInputChange}
          className="hidden"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => assetUploadInputRef.current?.click()}
            className="h-9 w-9 shrink-0 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-accent)] flex items-center justify-center hover:bg-[var(--vr-panel)] hover:border-[var(--vr-border-strong)] transition-colors"
            title={t('上传素材文件', '素材ファイルをアップロード', 'Upload media assets')}
            aria-label={t('上传素材文件', '素材ファイルをアップロード', 'Upload media assets')}
          >
            <Plus className="w-4 h-4" />
          </button>
          <select
            value={assetRegionFilter}
            onChange={(event) => setAssetRegionFilter(event.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-xs font-bold text-[var(--vr-text)]"
          >
            {assetRegionOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={assetViewportRef}
          tabIndex={0}
          onScroll={syncAssetScrollInfo}
          onKeyDown={(event) => {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return;
            event.preventDefault();
            const allVisibleSelected =
              visibleAssetNodes.length > 0 &&
              visibleAssetNodes.every((node) => selectedAssetIds.includes(node.id));
            setAssetSelection(
              allVisibleSelected ? [] : visibleAssetNodes.map((node) => node.id),
            );
          }}
          onPointerDown={handleSelectionPointerDown}
          onPointerMove={handleSelectionPointerMove}
          onPointerUp={handleSelectionPointerEnd}
          onPointerCancel={handleSelectionPointerEnd}
          onContextMenu={(event) => {
            if (!suppressNextContextMenuRef.current) return;
            suppressNextContextMenuRef.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
          className="video-render-scroll video-render-scroll-hidden min-h-0 h-full overflow-y-auto p-3 pr-7"
        >
          <div
            className={
              assetCardLayout === 'grid'
                ? 'grid auto-rows-max grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-2 origin-top-left'
                : 'space-y-2 origin-top-left'
            }
            style={{ zoom: assetCardScale }}
          >
            {visibleAssetNodes.map((node) => {
              const region = nodeRegionById.get(node.id);
              const selectedOrder = selectedAssetIds.indexOf(node.id);
              return (
                <div
                  data-asset-card-id={node.id}
                  key={node.id}
                  draggable
                  onDragStart={(event) => handleAssetDragStart(event, node.id)}
                  onClick={() => {
                    setAssetSelection([node.id]);
                    setActivePreviewId(node.id);
                  }}
                  onContextMenu={(event) => {
                    if (selectedAssetIds.includes(node.id) && selectedAssetIds.length > 1) {
                      openContextMenu(event, {
                        kind: 'asset',
                        selectedNodeIds: selectedAssetIds,
                      });
                      return;
                    }
                    setAssetSelection([node.id]);
                    openContextMenu(event, { kind: 'asset', nodeId: node.id });
                  }}
                  className={`group relative cursor-grab active:cursor-grabbing rounded-lg border transition-all ${
                    assetCardLayout === 'grid' ? 'p-2' : 'p-2.5'
                  } ${selectedAssetIds.includes(node.id) ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] ring-2 ring-[var(--vr-accent)]/25 shadow-sm' : activePreviewNode?.id === node.id ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] shadow-sm' : 'border-[var(--vr-border)] bg-[var(--vr-panel)] hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-surface-soft)]'}`}
                >
                  <div
                    className={assetCardLayout === 'grid' ? 'flex flex-col gap-2' : 'flex gap-3'}
                  >
                    <div
                      className={`relative rounded-md overflow-hidden bg-black border border-[var(--vr-border)] shrink-0 flex items-center justify-center text-[var(--vr-text-muted)] ${
                        assetCardLayout === 'grid' ? 'aspect-video w-full' : 'w-20 h-14'
                      }`}
                    >
                      {node.data?.imageUrl ? (
                        <img
                          src={node.data.imageUrl as string}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : node.data?.videoUrl ? (
                        <video
                          src={node.data.videoUrl as string}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        mediaIcon(node, 'w-5 h-5')
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-[var(--vr-text-muted)]">
                        {mediaIcon(node, 'w-3.5 h-3.5')}
                        <span>{mediaKind(node).toUpperCase()}</span>
                        {selectedOrder >= 0 && (
                          <span className="rounded bg-[var(--vr-accent)] px-1.5 py-0.5 text-[10px] text-white">
                            {selectedOrder + 1}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs font-black text-[var(--vr-text)] truncate">
                        {segmentTitle(node)}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--vr-text-muted)] truncate">
                        {region
                          ? `${region.type === 'dynamicGroup' ? t('包裹', 'ラップ', 'Wrap') : t('背景', '背景', 'Background')} · ${region.label}`
                          : segmentText(node) || t('无正文', '本文なし', 'No body text')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {visibleAssetNodes.length === 0 && (
              <div className="rounded-lg border border-dashed border-[var(--vr-border-strong)] px-3 py-8 text-center text-xs font-bold text-[var(--vr-text-muted)]">
                {t(
                  '这个区域里暂无可渲染卡片',
                  'この領域に書き出せるカードはありません',
                  'No renderable cards in this region',
                )}
              </div>
            )}
          </div>
        </div>
        <div className="absolute inset-y-3 right-2 w-4">
          <div className="relative h-full w-2 rounded-full bg-slate-200">
            <div
              className="absolute inset-x-1 rounded-full bg-[var(--vr-accent-soft)]"
              style={{
                top: `${assetThumbTopPercent}%`,
                height: `${assetThumbHeightPercent}%`,
              }}
            />
            <div
              className="absolute inset-x-0 cursor-grab active:cursor-grabbing"
              style={{
                top: `${assetThumbTopPercent}%`,
                height: `${assetThumbHeightPercent}%`,
              }}
              onPointerDown={handleAssetScrollThumbStart}
              onPointerMove={handleAssetScrollThumbMove}
              onPointerUp={handleAssetScrollThumbEnd}
              onPointerCancel={handleAssetScrollThumbEnd}
              title={t(
                '拖动滚动素材卡片',
                'ドラッグして素材カードをスクロール',
                'Drag to scroll asset cards',
              )}
            >
              <span className="pointer-events-none absolute inset-y-1 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-[var(--vr-accent)] opacity-70 transition-opacity" />
              <button
                type="button"
                className="absolute -top-1 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full border border-white/70 bg-[var(--vr-accent)] shadow-sm transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vr-accent)] active:scale-110"
                onPointerDown={(event) => handleAssetScaleHandleStart(event, 'top')}
                onPointerMove={handleAssetScaleHandleMove}
                onPointerUp={handleAssetScaleHandleEnd}
                onPointerCancel={handleAssetScaleHandleEnd}
                title={t(
                  '拖动调整素材卡片缩放上手柄',
                  'ドラッグして素材カード倍率の上ハンドルを調整',
                  'Drag to adjust asset scale top handle',
                )}
                aria-label={t(
                  '调整素材卡片缩放上手柄',
                  '素材カード倍率の上ハンドルを調整',
                  'Adjust asset scale top handle',
                )}
              />
              <button
                type="button"
                className="absolute -bottom-1 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full border border-white/70 bg-[var(--vr-accent)] shadow-sm transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vr-accent)] active:scale-110"
                onPointerDown={(event) => handleAssetScaleHandleStart(event, 'bottom')}
                onPointerMove={handleAssetScaleHandleMove}
                onPointerUp={handleAssetScaleHandleEnd}
                onPointerCancel={handleAssetScaleHandleEnd}
                title={t(
                  '拖动调整素材卡片缩放下手柄',
                  'ドラッグして素材カード倍率の下ハンドルを調整',
                  'Drag to adjust asset scale bottom handle',
                )}
                aria-label={t(
                  '调整素材卡片缩放下手柄',
                  '素材カード倍率の下ハンドルを調整',
                  'Adjust asset scale bottom handle',
                )}
              />
            </div>
          </div>
        </div>
      </div>
      {selectionBox && (
        <div
          className="pointer-events-none fixed z-[9999] rounded border border-[var(--vr-accent)] bg-[var(--vr-accent)]/15 shadow-[0_0_0_1px_rgba(255,255,255,0.35)_inset]"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.currentX),
            top: Math.min(selectionBox.startY, selectionBox.currentY),
            width: Math.abs(selectionBox.currentX - selectionBox.startX),
            height: Math.abs(selectionBox.currentY - selectionBox.startY),
          }}
        />
      )}
    </aside>
  );
}
