import {
  Eye,
  EyeOff,
  House,
  ListMusic,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Undo2,
} from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { useRef, useState } from 'react';

import { AudioPlaylistModal } from '../../AudioPlaylistModal';
import type { RenderStyle, WebExportSettings, WebMenuElement } from '../video/shared/types';
import { WebEditableElementFrame, type WebEditableResizeHandle } from './WebEditableElementFrame';
import type { WebAlignmentGuideLine } from './webElementAlignmentGuides';
import {
  snapElementBoxToElementGuides,
  snapResizeBoxToElementGuides,
} from './webElementAlignmentGuides';
import {
  webColorWithAlpha,
  webElementBoxStyle,
  webElementShadowStyle,
} from './webElementStyle';
import { readStartMenuImageFile } from './webPlaytestStartMenuTools';

export type PlayedAudio = {
  nodeId: string;
  title: string;
  url: string;
};

const floatingResizeCursorByHandle: Record<WebEditableResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

const toolbarRoleLabels: Partial<Record<NonNullable<WebMenuElement['role']>, string>> = {
  audio: '音频',
  fullscreen: '最大化',
  return: '返回',
  mainMenu: '主界面',
  controlsToggle: '显示/隐藏控制栏',
};

const colorWithAlpha = (color: string | undefined, alpha: number | undefined) => {
  return webColorWithAlpha(color, alpha, '#000000');
};

const elementRadiusStyle = (
  element: WebMenuElement,
  fallback: number,
): React.CSSProperties => {
  const base = element.borderRadius ?? fallback;
  return {
    borderRadius: base,
    borderTopLeftRadius: element.borderTopLeftRadius ?? base,
    borderTopRightRadius: element.borderTopRightRadius ?? base,
    borderBottomRightRadius: element.borderBottomRightRadius ?? base,
    borderBottomLeftRadius: element.borderBottomLeftRadius ?? base,
  };
};

export function ChoiceButton({
  label,
  choiceColor,
  choiceTextColor,
  onClick,
}: {
  label: string;
  choiceColor: string;
  choiceTextColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 rounded-xl px-3.5 py-2.5 text-left text-xs font-black leading-snug shadow-lg shadow-black/15 transition-all hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:scale-[0.99]"
      style={{
        backgroundColor: `${choiceColor}cc`,
        border: `1px solid ${choiceColor}`,
        color: choiceTextColor,
      }}
    >
      {label}
    </button>
  );
}

export function ChoiceButtonsGroup({
  items,
  extraClass = '',
  choiceColor,
  choiceTextColor,
}: {
  items: { id: string; label: string; onClick: () => void }[];
  extraClass?: string;
  choiceColor: string;
  choiceTextColor: string;
}) {
  return (
    <div className={`grid gap-2 ${extraClass}`}>
      {items.map((item) => (
        <ChoiceButton
          key={item.id}
          label={item.label}
          choiceColor={choiceColor}
          choiceTextColor={choiceTextColor}
          onClick={item.onClick}
        />
      ))}
    </div>
  );
}

export function ControlsToggle({
  label,
  hidden,
  onClick,
  positionClass,
  style,
}: {
  label: string;
  hidden: boolean;
  onClick: () => void;
  positionClass: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${positionClass} z-30 grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-black/35 text-white shadow-lg shadow-black/20 backdrop-blur-md transition-colors hover:bg-black/55 active:scale-95`}
      style={style}
      title={label}
      aria-label={label}
    >
      {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

export function PreviewToolbar({
  settings,
  previewControlsHidden,
  historyLength,
  showAudioPlaylist,
  playlistAudioUrl,
  playlistAudioRef,
  isPreviewFullscreen,
  previewMode = 'test',
  toolbarElements,
  selectedToolbarElementId,
  t,
  onSelectToolbarElement,
  onUpdateToolbarElement,
  onBack,
  onReturnToStartMenu,
  onToggleAudioPlaylist,
  onToggleFullscreen,
  onPlaylistAudioPlay,
  onPlaylistAudioPause,
  onPlaylistAudioEnded,
}: {
  settings: WebExportSettings;
  previewControlsHidden: boolean;
  historyLength: number;
  showAudioPlaylist: boolean;
  playlistAudioUrl: string | null;
  playlistAudioRef: RefObject<HTMLAudioElement | null>;
  isPreviewFullscreen: boolean;
  previewMode?: 'edit' | 'test';
  toolbarElements: WebMenuElement[];
  selectedToolbarElementId?: string | null;
  t: (zh: string, ja: string, en: string) => string;
  onSelectToolbarElement?: (id: string | null) => void;
  onUpdateToolbarElement?: (id: string, patch: Partial<WebMenuElement>) => void;
  onBack: () => void;
  onReturnToStartMenu: () => void;
  onToggleAudioPlaylist: () => void;
  onToggleFullscreen: () => void;
  onPlaylistAudioPlay: () => void;
  onPlaylistAudioPause: () => void;
  onPlaylistAudioEnded: () => void;
}) {
  return (
    <div
      data-toolbar-editor="true"
      className={`z-[200] flex items-center justify-between overflow-visible transition-opacity ${
        settings.layoutMode === 'immersive'
          ? 'absolute left-0 right-0 top-0 h-12 px-3 border-b border-transparent bg-transparent shadow-none backdrop-blur-0'
          : 'pointer-events-none absolute left-0 right-0 top-0 h-0 bg-transparent p-0 shadow-none backdrop-blur-0'
      } ${previewControlsHidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <div className="hidden">
        {toolbarElements
          .filter((element) => previewMode === 'edit' || element.visible !== false)
          .filter((element) => settings.showStartMenu || element.role !== 'mainMenu')
          .map((element) => (
            <ToolbarElement
              key={element.id}
              element={element}
              selected={selectedToolbarElementId === element.id}
              previewMode={previewMode}
              disabled={element.role === 'return' && historyLength === 0}
              active={element.role === 'audio' && showAudioPlaylist}
              icon={
                element.role === 'audio' ? (
                  <ListMusic className="h-3.5 w-3.5" />
                ) : element.role === 'fullscreen' ? (
                  isPreviewFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )
                ) : element.role === 'return' ? (
                  <RotateCcw className="h-3.5 w-3.5" />
                ) : (
                  <House className="h-3.5 w-3.5" />
                )
              }
              guideElements={toolbarElements}
              allElements={toolbarElements}
              selectedElementIds={[]}
              onSelect={onSelectToolbarElement}
              onSelectOnly={onSelectToolbarElement}
              onUpdate={onUpdateToolbarElement}
              onUpdateElements={(elements) => {
                elements.forEach((item) => {
                  const original = toolbarElements.find((element) => element.id === item.id);
                  if (!original) return;
                  onUpdateToolbarElement?.(item.id, item);
                });
              }}
              onAction={() => {
                if (element.role === 'audio') onToggleAudioPlaylist();
                if (element.role === 'fullscreen') onToggleFullscreen();
                if (element.role === 'return') onBack();
                if (element.role === 'mainMenu') onReturnToStartMenu();
              }}
            />
          ))}
      </div>
      <div className="hidden">
        <div className="relative">
          <button
            type="button"
            onClick={onToggleAudioPlaylist}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition-all active:scale-95 ${
              showAudioPlaylist
                ? 'bg-sky-500/35 text-sky-100'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={t('录音播放列表', '録音プレイリスト', 'Audio playlist')}
            aria-label={t('录音播放列表', '録音プレイリスト', 'Audio playlist')}
          >
            <ListMusic className="h-3.5 w-3.5" />
            <span>{t('音频', '音声', 'Audio')}</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-sky-500/22 px-3 text-xs font-black text-sky-100 transition-all hover:bg-sky-500/34 active:scale-95"
          title={
            isPreviewFullscreen
              ? t('退出测试全屏', 'テスト全画面を終了', 'Exit test fullscreen')
              : t('测试全屏', 'テスト全画面', 'Test fullscreen')
          }
          aria-label={
            isPreviewFullscreen
              ? t('退出测试全屏', 'テスト全画面を終了', 'Exit test fullscreen')
              : t('测试全屏', 'テスト全画面', 'Test fullscreen')
          }
        >
          {isPreviewFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
          <span>
            {isPreviewFullscreen ? t('退出', '終了', 'Exit') : t('最大化', '最大化', 'Max')}
          </span>
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={historyLength === 0}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-white/12 px-3 text-xs font-black text-white transition-all hover:bg-white/20 active:scale-95 disabled:opacity-35 disabled:grayscale disabled:hover:bg-white/12 disabled:active:scale-100"
          title={t('返回上一页', '前に戻る', 'Back')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t('返回', '戻る', 'Back')}</span>
        </button>
        {settings.showStartMenu && (
          <button
            type="button"
            onClick={onReturnToStartMenu}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-white/12 px-3 text-xs font-black text-white transition-all hover:bg-white/20 active:scale-95"
            title={t('返回主界面', 'メイン画面へ戻る', 'Main menu')}
          >
            <House className="h-3.5 w-3.5" />
            <span>{t('主界面', 'メイン', 'Menu')}</span>
          </button>
        )}
      </div>
      {playlistAudioUrl && (
        <audio
          ref={playlistAudioRef}
          src={playlistAudioUrl}
          preload="auto"
          onPlay={onPlaylistAudioPlay}
          onPause={onPlaylistAudioPause}
          onEnded={onPlaylistAudioEnded}
          className="hidden"
        />
      )}
    </div>
  );
}

export function PreviewFloatingElementLayer({
  elements,
  guideElements,
  selectedElementId,
  previewMode,
  className = '',
  onSelectElement,
  onUpdateElement,
  onUpdateElements,
  getIcon,
  isActive,
  isDisabled,
  onAction,
  onDoubleClickButton,
}: {
  elements: WebMenuElement[];
  guideElements?: WebMenuElement[];
  selectedElementId?: string | null;
  previewMode: 'edit' | 'test';
  className?: string;
  onSelectElement?: (id: string | null) => void;
  onUpdateElement?: (id: string, patch: Partial<WebMenuElement>) => void;
  onUpdateElements?: (elements: WebMenuElement[]) => void;
  getIcon?: (element: WebMenuElement) => ReactNode;
  isActive?: (element: WebMenuElement) => boolean;
  isDisabled?: (element: WebMenuElement) => boolean;
  onAction?: (element: WebMenuElement) => void;
  onDoubleClickButton?: (element: WebMenuElement) => void;
}) {
  const [activeGuideLines, setActiveGuideLines] = useState<WebAlignmentGuideLine[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const marqueeRef = useRef<{
    startClientX: number;
    startClientY: number;
    rect: DOMRect;
  } | null>(null);
  const marqueeBoxRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const snapGuideElements = guideElements || elements;
  const handleLayerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (previewMode !== 'edit' || event.currentTarget !== event.target) return;
    if (event.button === 0) {
      setSelectedElementIds([]);
      onSelectElement?.(null);
      return;
    }
    if (event.button !== 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.preventDefault();
    event.stopPropagation();
    marqueeRef.current = { startClientX: event.clientX, startClientY: event.clientY, rect };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const nextBox = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
      width: 0,
      height: 0,
    };
    marqueeBoxRef.current = nextBox;
    setMarqueeBox(nextBox);
  };
  const updateMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    const marquee = marqueeRef.current;
    if (!marquee) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = ((marquee.startClientX - marquee.rect.left) / marquee.rect.width) * 100;
    const startY = ((marquee.startClientY - marquee.rect.top) / marquee.rect.height) * 100;
    const currentX = ((event.clientX - marquee.rect.left) / marquee.rect.width) * 100;
    const currentY = ((event.clientY - marquee.rect.top) / marquee.rect.height) * 100;
    const left = Math.max(0, Math.min(startX, currentX));
    const top = Math.max(0, Math.min(startY, currentY));
    const right = Math.min(100, Math.max(startX, currentX));
    const bottom = Math.min(100, Math.max(startY, currentY));
    const nextBox = {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
    marqueeBoxRef.current = nextBox;
    setMarqueeBox(nextBox);
  };
  const finishMarquee = (event?: React.PointerEvent<HTMLDivElement>) => {
    const box = marqueeBoxRef.current;
    if (!marqueeRef.current || !box) return;
    event?.preventDefault();
    event?.stopPropagation();
    const nextIds = elements
      .filter((element) => previewMode === 'edit' || element.visible !== false)
      .filter(
        (element) =>
          element.x < box.x + box.width &&
          element.x + element.width > box.x &&
          element.y < box.y + box.height &&
          element.y + element.height > box.y,
      )
      .map((element) => element.id);
    marqueeRef.current = null;
    marqueeBoxRef.current = null;
    setMarqueeBox(null);
    setSelectedElementIds(nextIds);
    onSelectElement?.(nextIds[nextIds.length - 1] || null);
  };

  return (
    <>
      <div
        className={`absolute inset-0 z-[15] ${
          previewMode === 'edit' && elements.length > 0
            ? 'pointer-events-auto'
            : 'pointer-events-none'
        } ${className}`}
        onPointerDown={handleLayerPointerDown}
        onPointerMove={updateMarquee}
        onPointerUp={finishMarquee}
        onPointerCancel={finishMarquee}
        onContextMenu={(event) => {
          if (previewMode === 'edit') event.preventDefault();
        }}
      />
      <div
        data-toolbar-editor="true"
        className={`pointer-events-none absolute inset-0 z-[220] ${className}`}
      >
      {previewMode === 'edit' && activeGuideLines.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30">
          {activeGuideLines.map((line, index) => (
            <div
              key={`${line.axis}-${line.value}-${index}`}
              className={
                line.axis === 'x'
                  ? 'absolute top-0 h-full border-l-[1.5px] border-dashed border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.42)]'
                  : 'absolute left-0 w-full border-t-[1.5px] border-dashed border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.42)]'
              }
              style={line.axis === 'x' ? { left: `${line.value}%` } : { top: `${line.value}%` }}
            />
          ))}
        </div>
      )}
      {previewMode === 'edit' && marqueeBox && (
        <div
          className="pointer-events-none absolute z-[70] border border-sky-400 bg-sky-400/14 shadow-[0_0_0_1px_rgba(14,165,233,0.24)]"
          style={{
            left: `${marqueeBox.x}%`,
            top: `${marqueeBox.y}%`,
            width: `${marqueeBox.width}%`,
            height: `${marqueeBox.height}%`,
          }}
        />
      )}
      {elements
        .filter((element) => previewMode === 'edit' || element.visible !== false)
        .map((element) => (
          <ToolbarElement
            key={element.id}
            element={element}
            selected={selectedElementId === element.id || selectedElementIds.includes(element.id)}
            previewMode={previewMode}
            disabled={Boolean(isDisabled?.(element))}
            active={Boolean(isActive?.(element))}
            icon={getIcon?.(element)}
            guideElements={snapGuideElements}
            allElements={elements}
            selectedElementIds={selectedElementIds}
            onSelect={(id) => {
              setSelectedElementIds(id ? [id] : []);
              onSelectElement?.(id);
            }}
            onSelectOnly={(id) => onSelectElement?.(id)}
            onUpdate={onUpdateElement}
            onUpdateElements={onUpdateElements}
            onGuideLinesChange={setActiveGuideLines}
            onAction={() => onAction?.(element)}
            onDoubleClickButton={onDoubleClickButton ? () => onDoubleClickButton(element) : undefined}
          />
        ))}
      </div>
    </>
  );
}

function ToolbarElement({
  element,
  selected,
  previewMode,
  disabled,
  active,
  icon,
  guideElements,
  allElements,
  selectedElementIds,
  onSelect,
  onSelectOnly,
  onUpdate,
  onUpdateElements,
  onGuideLinesChange,
  onAction,
  onDoubleClickButton,
}: {
  element: WebMenuElement;
  selected: boolean;
  previewMode: 'edit' | 'test';
  disabled: boolean;
  active: boolean;
  icon: ReactNode;
  guideElements: WebMenuElement[];
  allElements: WebMenuElement[];
  selectedElementIds: string[];
  onSelect?: (id: string | null) => void;
  onSelectOnly?: (id: string | null) => void;
  onUpdate?: (id: string, patch: Partial<WebMenuElement>) => void;
  onUpdateElements?: (elements: WebMenuElement[]) => void;
  onGuideLinesChange?: (lines: WebAlignmentGuideLine[]) => void;
  onAction: () => void;
  onDoubleClickButton?: () => void;
}) {
  const editable = previewMode === 'edit';
  // Editing overlays include their own buttons (rotate, visibility, resize).
  // The editable target therefore cannot itself be a <button>.
  const ElementContainer = editable ? 'div' : 'button';
  const [editingText, setEditingText] = useState(false);
  const textEditorRef = useRef<HTMLSpanElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const beginTextEditing = () => {
    if (!editable || element.kind === 'image') return;
    onSelect?.(element.id);
    setEditingText(true);
    window.requestAnimationFrame(() => {
      const editor = textEditorRef.current;
      if (!editor) return;
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  };
  const justifyContent =
    element.textAlign === 'left'
      ? 'flex-start'
      : element.textAlign === 'right'
        ? 'flex-end'
        : 'center';
  const beginDrag = (
    event: React.PointerEvent<HTMLElement>,
    type: 'move' | 'resize' | 'rotate',
    handle?: WebEditableResizeHandle,
  ) => {
    if (!editable || !onUpdate) return;
    if (event.button === 2) return;
    event.preventDefault();
    event.stopPropagation();
    const shouldMoveGroup =
      type === 'move' && selectedElementIds.length > 1 && selectedElementIds.includes(element.id);
    const groupIds = shouldMoveGroup ? selectedElementIds : [element.id];
    const groupInitial = allElements.filter((item) => groupIds.includes(item.id));
    if (shouldMoveGroup) onSelectOnly?.(element.id);
    else onSelect?.(element.id);
    document.body.style.cursor =
      type === 'rotate'
        ? 'grabbing'
        : type === 'resize' && handle
          ? floatingResizeCursorByHandle[handle]
          : 'grabbing';
    const parent = event.currentTarget
      .closest('[data-toolbar-editor="true"]')
      ?.getBoundingClientRect();
    const rect = parent || event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = element;
    const centerX = rect.left + ((element.x + element.width / 2) / 100) * rect.width;
    const centerY = rect.top + ((element.y + element.height / 2) / 100) * rect.height;
    const startAngle =
      Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
    const move = (moveEvent: PointerEvent) => {
      if (type === 'rotate') {
        const angle =
          Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
        onGuideLinesChange?.([]);
        onUpdate(element.id, { rotation: Math.round(initial.rotation + angle - startAngle) });
        return;
      }
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
      let x = initial.x;
      let y = initial.y;
      let width = initial.width;
      let height = initial.height;
      if (type === 'move') {
        x = initial.x + dx;
        y = initial.y + dy;
        const snapped = snapElementBoxToElementGuides({
          x,
          y,
          width,
          height,
          rect,
          elements: guideElements,
          movingId: element.id,
        });
        x = snapped.x;
        y = snapped.y;
        onGuideLinesChange?.(snapped.lines);
        if (shouldMoveGroup && onUpdateElements && groupInitial.length > 1) {
          const rawGroupDx = x - initial.x;
          const rawGroupDy = y - initial.y;
          const groupLeft = Math.min(...groupInitial.map((item) => item.x));
          const groupTop = Math.min(...groupInitial.map((item) => item.y));
          const groupRight = Math.max(...groupInitial.map((item) => item.x + item.width));
          const groupBottom = Math.max(...groupInitial.map((item) => item.y + item.height));
          const groupDx = Math.max(-groupLeft, Math.min(100 - groupRight, rawGroupDx));
          const groupDy = Math.max(-groupTop, Math.min(100 - groupBottom, rawGroupDy));
          const movingIds = new Set(groupIds);
          const initialById = new Map(groupInitial.map((item) => [item.id, item]));
          onUpdateElements(
            allElements.map((item) =>
              movingIds.has(item.id) && initialById.has(item.id)
                ? {
                    ...item,
                    x: Number((initialById.get(item.id)!.x + groupDx).toFixed(2)),
                    y: Number((initialById.get(item.id)!.y + groupDy).toFixed(2)),
                  }
                : item,
            ),
          );
          return;
        }
      } else {
        const resizeHandle = handle || 'se';
        if (resizeHandle.includes('e')) width = initial.width + dx;
        if (resizeHandle.includes('s')) height = initial.height + dy;
        if (resizeHandle.includes('w')) {
          x = initial.x + dx;
          width = initial.width - dx;
        }
        if (resizeHandle.includes('n')) {
          y = initial.y + dy;
          height = initial.height - dy;
        }
        const snapped = snapResizeBoxToElementGuides({
          x,
          y,
          width,
          height,
          handle: resizeHandle,
          rect,
          elements: guideElements,
          movingId: element.id,
        });
        x = snapped.x;
        y = snapped.y;
        width = snapped.width;
        height = snapped.height;
        onGuideLinesChange?.(snapped.lines);
      }
      width = Math.max(3, Math.min(60, width));
      height = Math.max(3, Math.min(100, height));
      x = Math.max(0, Math.min(100 - width, x));
      y = Math.max(0, Math.min(100 - height, y));
      onUpdate(element.id, {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        width: Number(width.toFixed(2)),
        height: Number(height.toFixed(2)),
      });
    };
    const end = () => {
      onGuideLinesChange?.([]);
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  return (
    <ElementContainer
      {...(!editable ? { type: 'button', disabled } : {})}
      className={`pointer-events-auto absolute text-xs font-black text-white ${
        element.kind === 'text'
          ? 'bg-transparent shadow-none'
          : element.kind === 'image'
            ? 'border-0 bg-transparent shadow-none'
            : `shadow-lg ${active ? 'bg-sky-500/35 text-sky-100' : 'bg-white/12 hover:bg-white/20'}`
      } ${disabled ? 'opacity-35 grayscale' : ''}`}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        height: `${element.height}%`,
        transform: `rotate(${element.rotation || 0}deg)`,
        opacity: element.visible === false ? 0.34 : (element.opacity ?? 100) / 100,
        ...elementRadiusStyle(element, element.kind === 'text' ? 0 : 8),
        zIndex: selected ? 1000 : 20 + (element.zIndex ?? 0),
        background:
          element.kind === 'button' && element.fillEnabled !== false && element.backgroundColor
            ? element.backgroundColor
            : undefined,
        ...(element.kind !== 'text' || element.textStrokeTarget === 'box'
          ? webElementBoxStyle(element)
          : {}),
        color: element.textColor || undefined,
        fontFamily: element.fontFamily || undefined,
        fontSize: element.fontSize || undefined,
        fontWeight: element.fontWeight,
        WebkitTextStroke:
          element.kind === 'text' &&
          element.textStrokeTarget !== 'box' &&
          element.strokeEnabled !== false &&
          (element.textStrokeWidth ?? 0) > 0
            ? `${element.textStrokeWidth}px ${element.textStrokeColor || '#000000'}`
            : undefined,
        letterSpacing: element.letterSpacing,
        lineHeight: element.lineHeight,
        ...(element.kind === 'text' ? webElementShadowStyle(element, 'text') : {}),
        cursor: editable ? 'grab' : undefined,
      }}
      onPointerDown={(event) => beginDrag(event, 'move')}
      onClick={(event) => {
        event.stopPropagation();
        if (editable) {
          if (event.detail > 1) {
            if (element.kind === 'image') imageInputRef.current?.click();
            else if (element.kind === 'button' && onDoubleClickButton) onDoubleClickButton();
            else beginTextEditing();
            return;
          }
          onSelect?.(element.id);
          return;
        }
        if (!disabled) onAction();
      }}
    >
      {editable && element.kind === 'button' && element.role && toolbarRoleLabels[element.role] && (
        <span className="pointer-events-none absolute left-0 top-0 z-[250] max-w-full -translate-y-[calc(100%+4px)] truncate rounded-full bg-slate-950/78 px-2 py-0.5 text-[10px] font-black text-white shadow backdrop-blur">
          {toolbarRoleLabels[element.role]}
        </span>
      )}
      <span
        className={`flex h-full w-full items-center gap-1.5 overflow-hidden ${
          element.kind === 'button' ? 'px-2' : ''
        }`}
        style={{
          ...elementRadiusStyle(element, element.kind === 'text' ? 0 : 8),
          justifyContent,
          textAlign: element.textAlign || 'center',
        }}
      >
        {element.kind === 'image' ? (
          element.imageUrl ? (
            <img src={element.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center rounded-xl border border-white/20 bg-white/10 text-[10px] text-white/60">
              Image
            </span>
          )
        ) : (
          <>
            {icon}
            {element.textVisible !== false && (
              <span
                ref={textEditorRef}
                contentEditable={editable && editingText}
                suppressContentEditableWarning
                className={`min-w-0 whitespace-pre-line outline-none ${
                  editable && !editingText ? 'cursor-text' : ''
                } ${
                  editable && editingText ? 'opacity-50 caret-white' : ''
                }`}
                onPointerDown={(event) => {
                  if (editingText) event.stopPropagation();
                }}
                onBlur={(event) => {
                  if (!editingText) return;
                  onUpdate?.(element.id, { text: event.currentTarget.textContent || '' });
                  setEditingText(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
              >
                {element.text ||
                  (editable && !editingText && element.kind === 'button' ? '双击编辑' : '')}
              </span>
            )}
          </>
        )}
        {element.kind === 'image' && (
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) readStartMenuImageFile(file, (imageUrl) => onUpdate?.(element.id, { imageUrl }));
              event.currentTarget.value = '';
            }}
          />
        )}
      </span>
      {selected && editable && onUpdate && (
        <WebEditableElementFrame
          visible={element.visible !== false}
          onRotatePointerDown={(event) => beginDrag(event, 'rotate')}
          onToggleVisible={(event) => {
            event.stopPropagation();
            onUpdate(element.id, { visible: element.visible === false });
          }}
          onResizePointerDown={(event, handle) => beginDrag(event, 'resize', handle)}
        />
      )}
    </ElementContainer>
  );
}

export function PreviewAudioPlaylistModal({
  open,
  items,
  activeUrl,
  isPlaying,
  t,
  onClose,
  onToggleAudio,
}: {
  open: boolean;
  items: PlayedAudio[];
  activeUrl: string | null;
  isPlaying: boolean;
  t: (zh: string, ja: string, en: string) => string;
  onClose: () => void;
  onToggleAudio: (audio: PlayedAudio) => void;
}) {
  return (
    <AudioPlaylistModal
      open={open}
      items={items}
      activeUrl={activeUrl}
      isPlaying={isPlaying}
      title={t('录音播放列表', '録音プレイリスト', 'Audio playlist')}
      hint={t('最近听过的录音排在最上方', '最近聞いた録音を上に表示', 'Most recently heard first')}
      emptyText={t(
        '听过的录音会显示在这里',
        '再生した録音がここに表示されます',
        'Audio you have heard will appear here',
      )}
      closeLabel={t('关闭', '閉じる', 'Close')}
      dark
      scope="container"
      onClose={onClose}
      onToggleAudio={onToggleAudio}
    />
  );
}

export function PreviewSettingsPopover({
  t,
  settings,
  renderStyle,
  reset,
  onUpdateSettings,
  onUpdateRenderStyle,
}: {
  t: (zh: string, ja: string, en: string) => string;
  settings: WebExportSettings;
  renderStyle: RenderStyle;
  reset: () => void;
  onUpdateSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
  onUpdateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
}) {
  return (
    <div
      className="absolute right-0 top-10 z-40 w-[min(560px,calc(100vw-2rem))] max-h-[min(72vh,560px)] overflow-y-auto rounded-2xl border border-white/12 bg-slate-950/94 p-4 text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={reset}
        className="mb-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-black text-white/82 transition-colors hover:bg-white/16 hover:text-white"
      >
        <Undo2 className="h-4 w-4" />
        <span>{t('重置预览', 'プレビューをリセット', 'Reset preview')}</span>
      </button>
      <div className="grid gap-3 md:grid-cols-2">
        <PreviewOptionGroup
          title={t('界面排版', 'レイアウト', 'Layout')}
          options={[
            { value: 'classic', label: t('经典', 'クラシック', 'Classic') },
            { value: 'immersive', label: t('沉浸', '没入', 'Immersive') },
          ]}
          value={settings.layoutMode}
          onChange={(value) =>
            onUpdateSettings('layoutMode', value as WebExportSettings['layoutMode'])
          }
        />
        <PreviewOptionGroup
          title={t('选项位置', '選択肢の位置', 'Choice Position')}
          columns="grid-cols-3"
          options={[
            { value: 'aboveText', label: t('上', '上', 'Above') },
            { value: 'center', label: t('中', '中', 'Center') },
            { value: 'belowText', label: t('下', '下', 'Below') },
          ]}
          value={settings.choicesPosition}
          onChange={(value) =>
            onUpdateSettings('choicesPosition', value as WebExportSettings['choicesPosition'])
          }
        />
        <PreviewOptionGroup
          title={t('交互', 'インタラクション', 'Interaction')}
          options={[
            { value: 'typewriter', label: t('打字机', 'タイプライター', 'Typewriter') },
            { value: 'immediate', label: t('立即显示', '即時表示', 'Immediate') },
          ]}
          value={settings.interactionMode}
          onChange={(value) =>
            onUpdateSettings('interactionMode', value as WebExportSettings['interactionMode'])
          }
        />
        <PreviewOptionGroup
          title={t('自动翻页', '自動進行', 'Auto Advance')}
          options={[
            { value: 'on', label: t('自动', '自動', 'On') },
            { value: 'off', label: t('手动', '手動', 'Manual') },
          ]}
          value={settings.autoAdvance ? 'on' : 'off'}
          onChange={(value) => onUpdateSettings('autoAdvance', value === 'on')}
        />
        <PreviewOptionGroup
          title={t('显示效果', '表示効果', 'Display')}
          options={[
            {
              value: 'backdrop',
              label: t('背景虚化', '背景ぼかし', 'Backdrop'),
              icon: <BlurGlyph />,
            },
            {
              value: 'skip',
              label: t('隐藏单选', '単一選択を隠す', 'Skip Single'),
              icon: <SingleChoicePopupGlyph />,
            },
          ]}
          value={
            settings.blurBackground ? 'backdrop' : settings.skipSingleChoicePopup ? 'skip' : ''
          }
          onChange={(value) => {
            if (value === 'backdrop') onUpdateSettings('blurBackground', !settings.blurBackground);
            if (value === 'skip') {
              onUpdateSettings('skipSingleChoicePopup', !settings.skipSingleChoicePopup);
            }
          }}
        />
        <PreviewOptionGroup
          title={t('媒体', 'メディア', 'Media')}
          options={[
            { value: 'autoplay', label: t('视频自动播放', '動画自動再生', 'Video Autoplay') },
          ]}
          value={settings.videoAutoPlay ? 'autoplay' : ''}
          onChange={() => onUpdateSettings('videoAutoPlay', !settings.videoAutoPlay)}
        />
        <PreviewOptionGroup
          title={t('人物标签', 'キャラタグ', 'Character Tags')}
          titleIcon={<CharacterTagGlyph />}
          options={[
            {
              value: 'hide',
              label: t('隐藏', '非表示', 'Hide'),
              icon: <EyeOff className="h-3.5 w-3.5" />,
            },
            {
              value: 'show',
              label: t('显示', '表示', 'Show'),
              icon: <Eye className="h-3.5 w-3.5" />,
            },
          ]}
          value={settings.hideCharacterTags ? 'hide' : 'show'}
          onChange={(value) => onUpdateSettings('hideCharacterTags', value === 'hide')}
        />
        <PreviewOptionGroup
          title={t('场景标签', 'シーンタグ', 'Scene Tags')}
          titleIcon={<SceneTagGlyph />}
          options={[
            {
              value: 'hide',
              label: t('隐藏', '非表示', 'Hide'),
              icon: <EyeOff className="h-3.5 w-3.5" />,
            },
            {
              value: 'show',
              label: t('显示', '表示', 'Show'),
              icon: <Eye className="h-3.5 w-3.5" />,
            },
          ]}
          value={settings.hideSceneTags ? 'hide' : 'show'}
          onChange={(value) => onUpdateSettings('hideSceneTags', value === 'hide')}
        />
        <PreviewRange
          label={t('标题字号', 'タイトルサイズ', 'Title Size')}
          value={renderStyle.titleFontSize}
          min={18}
          max={120}
          onChange={(value) => onUpdateRenderStyle('titleFontSize', value)}
        />
        <PreviewRange
          label={t('正文字号', '本文サイズ', 'Body Size')}
          value={renderStyle.bodyFontSize}
          min={16}
          max={96}
          onChange={(value) => onUpdateRenderStyle('bodyFontSize', value)}
        />
      </div>
    </div>
  );
}

function PreviewOptionGroup({
  title,
  titleIcon,
  options,
  value,
  onChange,
  columns = 'grid-cols-2',
}: {
  title: string;
  titleIcon?: ReactNode;
  options: { value: string; label: string; icon?: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-white/45">
        {titleIcon}
        {title}
      </div>
      <div className={`grid ${columns} gap-2`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            title={option.label}
            className={`h-8 rounded-lg px-2 text-xs font-black transition-colors ${
              value === option.value
                ? 'bg-sky-500 text-white'
                : 'bg-white/10 text-white/75 hover:bg-white/16'
            }`}
          >
            {option.icon}
            {option.icon ? null : option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CharacterTagGlyph() {
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
      <path d="M8 4.5h8a2.5 2.5 0 0 1 2.5 2.5v10A2.5 2.5 0 0 1 16 19.5H8A2.5 2.5 0 0 1 5.5 17V7A2.5 2.5 0 0 1 8 4.5Z" />
      <circle cx="12" cy="10" r="2" />
      <path d="M8.5 16c.9-1.8 2.1-2.7 3.5-2.7s2.6.9 3.5 2.7" />
    </svg>
  );
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

function SceneTagGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <rect x="4.5" y="5" width="15" height="14" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.4" />
      <path d="M6.5 16l3.5-3.4 2.7 2.6 1.5-1.5 3.3 2.3" />
    </svg>
  );
}

function BlurGlyph() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-white/20 bg-white/10">
      <Sparkles className="h-2.5 w-2.5" />
      <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-white/30 blur-[1px]" />
    </span>
  );
}

function PreviewRange({
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
    <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center justify-between text-xs font-black text-white/75">
        <span>{label}</span>
        <span>{value}px</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-sky-400"
      />
    </label>
  );
}
