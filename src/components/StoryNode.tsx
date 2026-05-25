import React, { memo, useRef, useCallback, useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer, NodeToolbar, useStore, useStoreApi, useViewport } from '@xyflow/react';
import { Plus, Trash2, Maximize, Play, Sparkles, Loader2, Image as ImageIcon, GitFork, EyeOff, Italic, StepForward, Bold, Underline, Type, Layers, Palette, Eraser, ScanSearch, User, MapPin, Download } from 'lucide-react';
import { RichText, RichTextHandle } from './RichText';
import { NumberInput } from './NumberInput';

import { translations, Language } from '../lib/i18n';

const COLORS = ['#ffffff', '#FE8A25', '#E64881', '#FD5C5C', '#1EC8CF'];
const SHAPES = ['square', 'rounded-rectangle', 'diamond', 'trapezoid', 'hexagon'];
const CARD_RADIUS = '12px';

const isLightColor = (color: string) => {
  const hex = color.replace('#', '');
  if (hex.length !== 3 && hex.length !== 6) return false;
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 150; // 稍微放宽阈值以适应更多充满活力的颜色
};

// --- Helper Components & Styles for NodeToolbar ---
const ToolbarRow = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`flex items-center gap-1.5 px-1 ${className}`}>
    {children}
  </div>
);

const ToolGroup = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`flex items-center gap-1 ${className}`}>
    {children}
  </div>
);

const Separator = () => (
  <div className="w-px h-4 bg-[var(--toolbar-border)]/50 mx-0.5 shrink-0" />
);

const btnBase = "h-7 flex items-center justify-center rounded-md transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)] disabled:opacity-50";
const iconBtnBase = `${btnBase} w-7 p-1.5`;
const textBtnBase = `${btnBase} px-2 text-xs font-medium`;

export function StoryNode({ id, data, selected }: NodeProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const richTextRef = useRef<RichTextHandle>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const text = (data.text as string) || '';
  const title = (data.title as string) ?? '新节点';
  const shape = (data.shape as string) || 'square';
  const color = (data.color as string) || COLORS[0];
  const imageUrl = data.imageUrl as string | undefined;
  const videoUrl = data.videoUrl as string | undefined;
  const audioUrl = data.audioUrl as string | undefined;
  const objectFit = (data.objectFit as 'cover' | 'contain' | 'fill') || 'cover';
  const lang = (data.language as Language) || 'zh';
  const t = translations[lang];
  const showTitles = data.showTitles !== false;
  const isRoot = data.isRoot === true;
  const { zoom } = useViewport();
  const storeApi = useStoreApi();

  const isDefaultColor = color === '#ffffff';
  // 使用 CSS 变量实现主题感知，这样切换主题时无需 React 重绘即可瞬间响应
  const nodeBg = isDefaultColor ? 'var(--card-bg)' : color;
  const nodeText = isDefaultColor ? 'var(--text-primary)' : (isLightColor(color) ? '#1e293b' : '#f8fafc');

  // 判断是否显示富文本工具（只有在显示文本编辑器时才显示）
  const showRichTextTools = !imageUrl && !videoUrl && !audioUrl || data.showTextOverlay;

  const updateNodeData = (updates: any) => {
    if (data.onUpdate) {
      (data.onUpdate as Function)(id, updates);
    }
  };

  const handleTextChange = (newHtml: string) => {
    updateNodeData({ text: newHtml });
  };

  const handleGenerateImage = async () => {
    if (!data.onGenerateImage || isGeneratingImage) return;
    setIsGeneratingImage(true);
    try {
      await (data.onGenerateImage as Function)(id);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadImage = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!imageUrl) return;

    const plainTitle = title.replace(/<[^>]*>/g, '').trim() || (lang === 'zh' ? '图片' : 'image');
    const safeTitle = plainTitle.replace(/[\\/:*?"<>|]/g, '_');
    const extension = imageUrl.match(/^data:image\/([^;]+)/i)?.[1]?.replace('jpeg', 'jpg') || 'png';
    const link = document.createElement('a');
    link.download = `${safeTitle}.${extension}`;

    try {
      if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
        link.href = imageUrl;
      } else {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        link.href = URL.createObjectURL(blob);
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (link.href.startsWith('blob:')) URL.revokeObjectURL(link.href);
    } catch {
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const highlightCharacters = () => {
    if (!text) return;
    const allNodes = storeApi.getState().nodes;
    const charNodes = allNodes.filter(n => n.type === 'characterNode' && n.data?.characterName);
    if (charNodes.length === 0) return;
    
    let newText = text;
    charNodes.forEach((node, index) => {
      const name = node.data.characterName as string;
      if (!name) return;
      // Define a palette of colors for different characters
      const highlightColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
      const color = highlightColors[index % highlightColors.length];
      
      // Prevent double highlighting if already wrapped in a span with this color
      const regex = new RegExp(`(?<!<span[^>]*>)${name}(?!</span>)`, 'g');
      newText = newText.replace(regex, `<span style="color: ${color}; font-weight: bold; background-color: ${color}20; padding: 0 2px; border-radius: 2px;">${name}</span>`);
    });
    
    if (newText !== text) {
      updateNodeData({ text: newText });
    }
  };

  const showNodeActions = data.showNodeActions !== false;
  const handleClasses = `!w-3 !h-3 !bg-blue-400 !border-2 !border-[var(--card-bg)] !rounded-full transition-all z-40 hover:!scale-150 hover:!bg-blue-500 cursor-crosshair shadow-sm ${showNodeActions ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}`;
  const addBtnClasses = `absolute w-6 h-6 bg-[var(--card-bg)] border border-[var(--card-border)] text-blue-500 hover:text-white rounded-full shadow-md hover:bg-blue-500 transition-all z-50 flex items-center justify-center ${showNodeActions ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}`;

  const getClipPath = (s: string) => {
    switch (s) {
      case 'circle': return 'circle(50% at 50% 50%)';
      case 'diamond': return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      case 'triangle': return 'polygon(50% 0%, 0% 100%, 100% 100%)';
      case 'triangleDown': return 'polygon(0% 0%, 100% 0%, 50% 100%)';
      case 'trapezoid': return 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)';
      case 'hexagon': return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
      case 'rounded-rectangle': return undefined;
      default: return undefined;
    }
  };

  const dynamicPaddingClasses = () => {
    switch (shape) {
      case 'diamond': return 'p-12'; // 增加边距以确保文字在菱形中心
      case 'circle': return 'p-8';
      case 'hexagon': return 'px-8 py-4';
      case 'triangle': return 'px-8 pt-10 pb-4';
      case 'triangleDown': return 'px-8 pt-4 pb-10';
      default: return 'p-3 pt-0';
    }
  };

  const selectionCount = useStore(state => {
    return state.nodes.filter(n => n.selected).length;
  });

  const mentionableCharacters = useStore(
    useCallback(
      (state: any) => {
        const chars: { id: string; name: string }[] = [];
        for (const n of state.nodes) {
          if (n.type !== 'characterNode') continue;
          const name = (n.data?.characterName as string)?.trim();
          if (!name) continue;
          const isGlobal = n.data?.isGlobal !== false;
          const isConnected = state.edges.some(
            (e) =>
              (e.source === n.id && e.target === id) ||
              (e.target === n.id && e.source === id)
          );
          if (isGlobal || isConnected) chars.push({ id: n.id, name });
        }
        return chars;
      },
      [id]
    )
  ) as { id: string; name: string }[];

  const mentionableScenes = useStore(
    useCallback(
      (state: any) => {
        const scenes: { id: string; name: string }[] = [];
        for (const n of state.nodes) {
          if (n.type !== 'sceneNode') continue;
          const name = (n.data?.sceneName as string)?.trim();
          if (!name) continue;
          const isGlobal = n.data?.isGlobal !== false;
          const isConnected = state.edges.some(
            (e) =>
              (e.source === n.id && e.target === id) ||
              (e.target === n.id && e.source === id)
          );
          if (isGlobal || isConnected) scenes.push({ id: n.id, name });
        }
        return scenes;
      },
      [id]
    )
  ) as { id: string; name: string }[];

  const insertCharacterMention = (name: string) => {
    richTextRef.current?.insertMention('character', name);
  };

  const insertSceneMention = (name: string) => {
    richTextRef.current?.insertMention('scene', name);
  };

  return (
    <div className="w-full h-full relative group min-w-[100px] min-h-[50px]">
      {isRoot && (
        <div className="absolute -top-3 -left-3 z-50 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
          <Play className="w-3 h-4" /> 开始
        </div>
      )}
      {data.skip && (
        <div className={`absolute -top-3 ${isRoot ? 'left-10' : '-left-3'} z-50 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1`}>
          <StepForward className="w-3 h-4" /> 暂时跳过
        </div>
      )}
      <NodeResizer
        minWidth={100}
        minHeight={50}
        isVisible={selected && selectionCount === 1}
        lineClassName="!border-blue-500 !border-2"
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-blue-500 !rounded-sm"
      />

      {/* Floating Toolbar for styles & actions */}
      <NodeToolbar isVisible={selected && selectionCount === 1} position={Position.Top} offset={15}>
        <div style={{ transform: `scale(${zoom * 0.6})`, transformOrigin: 'bottom center' }}>
          <div
            className="bg-[var(--toolbar-bg)] backdrop-blur-md p-2 rounded-xl flex flex-col gap-1.5 shadow-2xl border border-[var(--toolbar-border)] w-max max-w-[90vw] toolbar-animate"
          >
            {/* 第一行：颜色、形状、文字工具、视图 - 完全扁平化以实现平均散开分布 */}
            <ToolbarRow className="w-full justify-between gap-0">
              {/* 预设颜色按钮 */}
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateNodeData({ color: c })}
                  className={`w-5 h-5 rounded-full border border-[var(--toolbar-border)] transition-transform hover:scale-110 shrink-0 ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--toolbar-bg)]' : ''}`}
                  style={{ backgroundColor: c }}
                  title={c === '#ffffff' ? '白色' : '更改颜色'}
                />
              ))}

              {/* 自定义颜色按钮 */}
              <button
                onClick={() => colorInputRef.current?.click()}
                className={`w-5 h-5 rounded-full border border-[var(--toolbar-border)] transition-transform hover:scale-110 shrink-0 flex items-center justify-center overflow-hidden relative ${!COLORS.includes(color) ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--toolbar-bg)]' : ''}`}
                style={{ background: !COLORS.includes(color) ? color : 'linear-gradient(45deg, #f093fb 0%, #f5576c 100%)' }}
                title="自定义颜色"
              >
                <Palette className={`w-3 h-3 ${!COLORS.includes(color) ? 'text-white mix-blend-difference' : 'text-white'}`} />
                <input
                  ref={colorInputRef}
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  value={COLORS.includes(color) ? '#ffffff' : color}
                  onChange={(e) => updateNodeData({ color: e.target.value })}
                />
              </button>

              <Separator />

              {/* 形状按钮 */}
              {SHAPES.map(s => (
                <button
                  key={s}
                  onClick={() => updateNodeData({ shape: s })}
                  className={`w-7 h-7 flex items-center justify-center transition-transform hover:scale-110 shrink-0 rounded-md hover:bg-[var(--app-bg)] ${shape === s ? 'text-blue-400' : 'text-[var(--text-primary)]/80'}`}
                  title={`形状: ${s}`}
                >
                  <div
                    className="w-4 h-4 bg-current"
                    style={{ clipPath: getClipPath(s), borderRadius: s === 'square' ? '2px' : 0 }}
                  />
                </button>
              ))}

              {showRichTextTools && (
                <>
                  <Separator />

                  {/* 文字工具按钮 */}
                  <button
                    onClick={() => document.execCommand('bold', false, '')}
                    className={iconBtnBase}
                    title={t.boldText}
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => document.execCommand('italic', false, '')}
                    className={iconBtnBase}
                    title={t.italicText}
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => document.execCommand('underline', false, '')}
                    className={iconBtnBase}
                    title={t.underlineText}
                  >
                    <Underline className="w-4 h-4" />
                  </button>

                  <Separator />

                  {/* 视图按钮 */}
                  <button
                    onClick={highlightCharacters}
                    className={iconBtnBase}
                    title="高亮角色 (审查)"
                  >
                    <ScanSearch className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => (data.onZenMode as Function)(id)}
                    className={iconBtnBase}
                    title="专注模式"
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                </>
              )}
            </ToolbarRow>

            <div className="h-px w-full bg-[var(--toolbar-border)]/30" />

            {/* 已连接人物：插入 @角色名 */}
            {showRichTextTools && mentionableCharacters.length > 0 && (
              <>
                <ToolbarRow className="flex-wrap justify-start gap-1">
                  <ToolGroup className="gap-1 shrink-0">
                    <User className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  </ToolGroup>
                  {mentionableCharacters.map((char) => (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => insertCharacterMention(char.name)}
                      className={`${textBtnBase} bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 hover:text-indigo-400 border border-indigo-500/20`}
                      title={`插入 @${char.name}`}
                    >
                      @{char.name}
                    </button>
                  ))}
                </ToolbarRow>
                <div className="h-px w-full bg-[var(--toolbar-border)]/30" />
              </>
            )}

            {/* 媒体适配行 */}
            {/* Connected/global scenes: insert @scene name */}
            {showRichTextTools && mentionableScenes.length > 0 && (
              <>
                <ToolbarRow className="flex-wrap justify-start gap-1">
                  <ToolGroup className="gap-1 shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  </ToolGroup>
                  {mentionableScenes.map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => insertSceneMention(scene.name)}
                      className={`${textBtnBase} bg-blue-800/10 text-blue-700 hover:bg-blue-800/20 hover:text-blue-800 border border-blue-800/20 dark:text-blue-300 dark:hover:text-blue-200`}
                      title={`插入 @${scene.name}`}
                    >
                      @{scene.name}
                    </button>
                  ))}
                </ToolbarRow>
                <div className="h-px w-full bg-[var(--toolbar-border)]/30" />
              </>
            )}

            {(imageUrl || videoUrl) && (
              <>
                <ToolbarRow>
                  <ToolGroup>
                    <span className="text-[9px] text-[var(--text-muted)] px-1 uppercase font-black tracking-tighter shrink-0">{t.objectFit}</span>
                  </ToolGroup>

                  <Separator />

                  <ToolGroup>
                    <button
                      onClick={() => updateNodeData({ objectFit: 'contain' })}
                      className={`${textBtnBase} ${objectFit === 'contain' ? 'bg-indigo-500 text-white hover:bg-indigo-600 hover:text-white' : ''}`}
                    >
                      {t.fit}
                    </button>
                    <button
                      onClick={() => updateNodeData({ objectFit: 'cover' })}
                      className={`${textBtnBase} ${objectFit === 'cover' ? 'bg-indigo-500 text-white hover:bg-indigo-600 hover:text-white' : ''}`}
                    >
                      {t.crop}
                    </button>
                    <button
                      onClick={() => updateNodeData({ objectFit: 'fill' })}
                      className={`${textBtnBase} ${objectFit === 'fill' ? 'bg-indigo-500 text-white hover:bg-indigo-600 hover:text-white' : ''}`}
                    >
                      {t.fill}
                    </button>
                  </ToolGroup>

                  <Separator />

                  <ToolGroup>
                    {imageUrl && (
                      <button
                        onClick={handleDownloadImage}
                        className={`${iconBtnBase} bg-emerald-50 text-emerald-600 hover:bg-emerald-100`}
                        title={lang === 'zh' ? '下载图片' : 'Download Image'}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    {(!data.showTextOverlay || text.replace(/<[^>]*>/g, '').trim() === '') && (
                      <button
                        onClick={() => (data.onAddTextToImage as Function)(id)}
                        className={`${iconBtnBase} bg-indigo-50 text-indigo-600 hover:bg-indigo-100`}
                        title={lang === 'zh' ? '在卡片中添加/显示文字' : 'Add/Show text in card'}
                      >
                        <Type className="w-4 h-4" />
                      </button>
                    )}
                    {data.showTextOverlay && text.replace(/<[^>]*>/g, '').trim() !== '' && (
                      <button
                        onClick={() => (data.onExtractMedia as Function)(id)}
                        className={`${iconBtnBase} bg-amber-50 text-amber-600 hover:bg-amber-100 ml-0.5`}
                        title={lang === 'zh' ? '从卡片中提取照片/视频' : 'Extract media from card'}
                      >
                        <Layers className="w-4 h-4" />
                      </button>
                    )}
                    {data.showTextOverlay && (
                      <button
                        onClick={() => (data.onRemoveTextFromImage as Function)(id)}
                        className={`${iconBtnBase} bg-rose-50 text-rose-600 hover:bg-rose-100 ml-0.5`}
                        title={lang === 'zh' ? '移除/隐藏卡片文字' : 'Remove/Hide text from card'}
                      >
                        <Eraser className="w-4 h-4" />
                      </button>
                    )}
                  </ToolGroup>
                </ToolbarRow>
                <div className="h-px w-full bg-[var(--toolbar-border)]/30" />
              </>
            )}

            {/* 第二行：核心功能 */}
            <ToolbarRow>
              {/* 节点状态组 */}
              <ToolGroup>
                <button
                  onClick={() => updateNodeData({ isRoot: true })}
                  className={`${textBtnBase} ${isRoot ? 'bg-emerald-500/20 text-emerald-500 font-bold hover:bg-emerald-500/30' : ''}`}
                >
                  起点
                </button>
              </ToolGroup>

              <Separator />


              {/* 数值组 */}
              <ToolGroup className="gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)] font-black uppercase shrink-0">数值</span>
                <NumberInput
                  value={data.nodeValue as number || 0}
                  onChange={(val) => updateNodeData({ nodeValue: val })}
                  accentColor="indigo"
                  className="gap-1"
                />
              </ToolGroup>

              <Separator />

              {/* 线路/流程组 */}
              <ToolGroup>
                <button
                  onClick={() => (data.onHighlightStoryline as Function)(id)}
                  className={`${iconBtnBase} ${data.isHighlighted ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.5)] hover:bg-rose-600 hover:text-white' : ''}`}
                  title={data.isHighlighted ? t.hideStoryline : t.showStoryline}
                >
                  <GitFork className={`w-4 h-4 ${data.isHighlighted ? 'animate-pulse' : ''}`} />
                </button>
                <button
                  onClick={() => updateNodeData({ skip: !data.skip })}
                  className={`${iconBtnBase} ${data.skip ? 'bg-emerald-500/20 text-emerald-500 shadow-inner font-bold hover:bg-emerald-500/30' : ''}`}
                  title={t.skipForNow}
                >
                  <StepForward className="w-4 h-4" />
                </button>
              </ToolGroup>

              {id !== 'root' && (
                <>
                  <Separator />
                  {/* 可见性组 */}
                  <ToolGroup>
                    <button
                      onClick={() => updateNodeData({ hidden: true })}
                      className={iconBtnBase}
                      title={t.hideNode}
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                    {showRichTextTools && (
                      <button
                        onClick={() => (data.onZenMode as Function)(id)}
                        className={`${iconBtnBase} bg-emerald-50 text-emerald-600 hover:bg-emerald-100`}
                        title={lang === 'zh' ? '专注模式' : 'Zen Mode'}
                      >
                        <Maximize className="w-4 h-4" />
                      </button>
                    )}
                  </ToolGroup>

                  <Separator />

                  {/* 危险操作组 */}
                  <ToolGroup>
                    <button
                      onClick={() => (data.onDelete as Function)(id)}
                      className={`${iconBtnBase} text-red-400 hover:text-red-300 hover:bg-red-500/10`}
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </ToolGroup>
                </>
              )}
            </ToolbarRow>
          </div>
        </div>
      </NodeToolbar>

      <div
        className={`w-full h-full flex flex-col items-center ${(imageUrl || videoUrl || audioUrl) ? 'justify-start' : 'justify-center'} shadow-sm relative overflow-hidden border-2 transition-[border-color,ring,shadow,background-color] duration-300 ${selected ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-lg' : 'border-[var(--card-border)]'}`}
        style={{
          backgroundColor: nodeBg,
          color: nodeText,
          clipPath: getClipPath(shape),
          borderRadius: shape === 'square' || shape === 'rounded-rectangle' ? CARD_RADIUS : '0'
        }}
      >
        {showTitles && (
          <div 
            className={`w-full flex justify-center py-2 z-20 relative shrink-0 ${(imageUrl || videoUrl || audioUrl) ? 'backdrop-blur-sm border-b border-[var(--card-border)]/30' : 'mb-2'}`}
            style={{ backgroundColor: (imageUrl || videoUrl || audioUrl) ? (isDefaultColor ? 'rgba(var(--card-bg-rgb), 0.6)' : `${color}99`) : 'transparent' }}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => updateNodeData({ title: e.target.value })}
              onFocus={(e) => e.target.select()}
              className={`nodrag w-[50%] text-[11px] font-bold uppercase tracking-widest bg-transparent px-2 rounded outline-none border border-transparent hover:border-[var(--card-border)] focus:border-blue-500 transition-colors text-center pb-0.5 cursor-text ${(imageUrl || videoUrl || audioUrl) ? 'py-1' : ''}`}
              style={{ color: nodeText }}
              placeholder="标题..."
            />
          </div>
        )}

        <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} className={`w-full ${data.showTextOverlay ? 'h-1/2' : 'flex-1'} object-cover pointer-events-none`} style={{ objectFit }} alt="node" loading="lazy" />
          ) : videoUrl ? (
            <div className={`w-full ${data.showTextOverlay ? 'h-1/2' : 'flex-1'} relative`}>
              {zoom < 0.3 ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/10 text-slate-400">
                  <Play className="w-8 h-8 opacity-40" />
                  <span className="text-[10px] mt-2 font-bold opacity-40">放大以查看视频</span>
                </div>
              ) : (
                <video 
                  src={videoUrl} 
                  controls 
                  preload="metadata"
                  playsInline
                  draggable={false} 
                  onDragStart={(e) => e.preventDefault()} 
                  className="w-full h-full object-cover nodrag" 
                  style={{ objectFit }} 
                />
              )}
            </div>
          ) : audioUrl ? (
            <div 
              className="w-full flex-1 flex flex-col items-center justify-center nodrag"
              style={{ backgroundColor: nodeBg }}
            >
              {zoom < 0.3 ? (
                 <div className="text-2xl opacity-40">🎵</div>
              ) : (
                <>
                  <div className="text-4xl mb-2">🎵</div>
                  <audio src={data.audioUrl as string} controls preload="none" className="w-[80%]" />
                </>
              )}
            </div>
          ) : null}


          {showRichTextTools && (
            <div 
              className={`w-full flex-1 flex flex-col items-center justify-center ${dynamicPaddingClasses()} ${imageUrl || videoUrl ? 'border-t border-[var(--card-border)]/30' : ''}`}
              style={{ backgroundColor: nodeBg }}
            >
              <div className={`w-full h-full flex flex-col items-center justify-center ${shape === 'diamond' ? 'scale-[0.8]' : ''}`}>
                <RichText
                  ref={richTextRef}
                  value={text}
                  onChange={handleTextChange}
                  pasteAsPlainText={data.pasteAsPlainText as boolean}
                  className={`w-full h-full resize-none bg-transparent text-sm leading-relaxed relative z-10 break-words cursor-text ${shape === 'square' || shape === 'rounded-rectangle' ? 'text-left' : 'text-center'}`}
                  style={{ color: nodeText }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Generate Button - Always visible at top for image nodes, or bottom for text nodes */}
      <button
        onClick={() => (data.onAIGenerate as Function)(id)}
        disabled={data.isAILoading as boolean}
        className={`absolute z-50 p-1.5 bg-[var(--card-bg)]/80 backdrop-blur-md text-indigo-500 hover:bg-indigo-500 hover:text-white border border-[var(--card-border)] rounded-md transition-all opacity-0 group-hover:opacity-100 disabled:opacity-100 shadow-lg ${(imageUrl || videoUrl) ? 'bottom-2 right-2' : 'bottom-2 right-2'}`}
        title="AI 操作"
      >
        {data.isAILoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
      </button>

      <button
        onClick={handleGenerateImage}
        disabled={isGeneratingImage}
        className="absolute z-50 p-1.5 bg-[var(--card-bg)]/80 backdrop-blur-md text-blue-500 hover:bg-blue-500 hover:text-white border border-[var(--card-border)] rounded-md transition-all opacity-0 group-hover:opacity-100 disabled:opacity-100 shadow-lg bottom-2 right-11"
        title={lang === 'zh' ? '生成图片' : 'Generate Image'}
      >
        {isGeneratingImage ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ImageIcon className="w-4 h-4" />
        )}
      </button>

      {/* TOP */}
      <Handle type="source" position={Position.Top} id="top" className={`${handleClasses} -top-1.5`} />
      <button onClick={() => (data.onAddNode as Function)(id, 'top')} className={`${addBtnClasses} -top-8 left-1/2 -translate-x-1/2`}>
        <Plus className="w-4 h-4" />
      </button>

      {/* RIGHT */}
      <Handle type="source" position={Position.Right} id="right" className={`${handleClasses} -right-1.5`} />
      <button onClick={() => (data.onAddNode as Function)(id, 'right')} className={`${addBtnClasses} top-1/2 -right-8 -translate-y-1/2`}>
        <Plus className="w-4 h-4" />
      </button>

      {/* BOTTOM */}
      <Handle type="source" position={Position.Bottom} id="bottom" className={`${handleClasses} -bottom-1.5`} />
      <button onClick={() => (data.onAddNode as Function)(id, 'bottom')} className={`${addBtnClasses} -bottom-8 left-1/2 -translate-x-1/2`}>
        <Plus className="w-4 h-4" />
      </button>

      {/* LEFT */}
      <Handle type="source" position={Position.Left} id="left" className={`${handleClasses} -left-1.5`} />
      <button onClick={() => (data.onAddNode as Function)(id, 'left')} className={`${addBtnClasses} top-1/2 -left-8 -translate-y-1/2`}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

export const MemoizedStoryNode = memo(StoryNode);
