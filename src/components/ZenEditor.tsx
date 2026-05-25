import React, { useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Palette, Type, User, MapPin, Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';
import { RichText, RichTextHandle } from './RichText';

type ZenTag = {
  id: string;
  name: string;
};

export function ZenEditor({
  value,
  imageUrl,
  videoUrl,
  characterTags = [],
  sceneTags = [],
  isAILoading = false,
  onAIGenerate,
  onGenerateImage,
  onChange,
  onClose
}: {
  value: string,
  imageUrl?: string,
  videoUrl?: string,
  characterTags?: ZenTag[],
  sceneTags?: ZenTag[],
  isAILoading?: boolean,
  onAIGenerate?: () => void,
  onGenerateImage?: () => Promise<void> | void,
  onChange: (v: string) => void,
  onClose: () => void
}) {
  const richTextRef = useRef<RichTextHandle>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const format = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
  };

  const insertMention = (kind: 'character' | 'scene', name: string) => {
    richTextRef.current?.insertMention(kind, name);
  };

  const handleGenerateImage = async () => {
    if (!onGenerateImage || isGeneratingImage) return;
    setIsGeneratingImage(true);
    try {
      await onGenerateImage();
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const colors = ['#1e293b', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const sizes = [{ label: 'S', val: '2' }, { label: 'M', val: '4' }, { label: 'L', val: '6' }];

  return (
    <div className="fixed inset-0 bg-[var(--app-bg)] z-[200] p-6 sm:p-12 flex flex-col animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-8 max-w-5xl mx-auto w-full shrink-0">
        <div className="text-xl font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          专注模式
        </div>
        <button onClick={onClose} className="px-6 py-2 border border-[var(--card-border)] text-[var(--text-secondary)] font-medium rounded-full hover:bg-[var(--app-bg)] transition-colors shadow-sm bg-[var(--card-bg)]">
          退出全屏
        </button>
      </div>

      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-6 p-2 bg-[var(--card-bg)] rounded-lg shadow-sm border border-[var(--card-border)] shrink-0">
          <button onClick={() => format('bold')} className="p-2 hover:bg-[var(--app-bg)] rounded text-[var(--text-primary)]" title="加粗"><Bold className="w-4 h-4" /></button>
          <button onClick={() => format('italic')} className="p-2 hover:bg-[var(--app-bg)] rounded text-[var(--text-primary)]" title="斜体"><Italic className="w-4 h-4" /></button>
          <button onClick={() => format('underline')} className="p-2 hover:bg-[var(--app-bg)] rounded text-[var(--text-primary)]" title="下划线"><Underline className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-[var(--card-border)] mx-1"></div>
          <button onClick={() => format('insertUnorderedList')} className="p-2 hover:bg-[var(--app-bg)] rounded text-[var(--text-primary)]" title="项目符号列表"><List className="w-4 h-4" /></button>
          <button onClick={() => format('insertOrderedList')} className="p-2 hover:bg-[var(--app-bg)] rounded text-[var(--text-primary)]" title="编号列表"><ListOrdered className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-[var(--card-border)] mx-1"></div>

          {/* Colors */}
          <div className="flex items-center gap-1 px-2">
            <Palette className="w-4 h-4 text-[var(--text-muted)] mr-1" />
            {colors.map(c => (
              <button key={c} onClick={() => format('foreColor', c)} className="w-5 h-5 rounded-full border border-[var(--card-border)]" style={{ backgroundColor: c }}></button>
            ))}
          </div>

          <div className="w-px h-6 bg-[var(--card-border)] mx-1"></div>
          <button
            onClick={onAIGenerate}
            disabled={!onAIGenerate || isAILoading}
            className="p-2 hover:bg-[var(--app-bg)] rounded text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="AI 续写"
          >
            {isAILoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </button>
          <button
            onClick={handleGenerateImage}
            disabled={!onGenerateImage || isGeneratingImage}
            className="p-2 hover:bg-[var(--app-bg)] rounded text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="图片生成"
          >
            {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </button>
          <div className="w-px h-6 bg-[var(--card-border)] mx-1"></div>
          {/* Sizes */}
          <div className="flex items-center gap-1 px-2">
            <Type className="w-4 h-4 text-[var(--text-muted)] mr-1" />
            {sizes.map(s => (
              <button key={s.val} onClick={() => format('fontSize', s.val)} className="w-6 h-6 flex items-center justify-center text-xs font-medium hover:bg-[var(--app-bg)] rounded border border-[var(--card-border)] text-[var(--text-secondary)]">{s.label}</button>
            ))}
          </div>

          {(characterTags.length > 0 || sceneTags.length > 0) && (
            <>
              <div className="w-px h-6 bg-[var(--card-border)] mx-1"></div>
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                {characterTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <User className="w-4 h-4 text-[var(--text-muted)] mx-1 shrink-0" />
                    {characterTags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => insertMention('character', tag.name)}
                        className="px-2 py-1 rounded-md text-xs font-bold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors"
                        title={`Insert @${tag.name}`}
                      >
                        @{tag.name}
                      </button>
                    ))}
                  </div>
                )}
                {sceneTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <MapPin className="w-4 h-4 text-[var(--text-muted)] mx-1 shrink-0" />
                    {sceneTags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => insertMention('scene', tag.name)}
                        className="px-2 py-1 rounded-md text-xs font-bold bg-blue-800/10 text-blue-700 hover:bg-blue-800/20 hover:text-blue-800 border border-blue-800/20 dark:text-blue-300 dark:hover:text-blue-200 transition-colors"
                        title={`Insert @${tag.name}`}
                      >
                        @{tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Editor Area with Media Support */}
        <div className="flex-1 bg-[var(--card-bg)] rounded-xl shadow-sm border border-[var(--card-border)] flex flex-col md:flex-row overflow-hidden">
          {(imageUrl || videoUrl) && (
            <div className="w-full md:w-1/2 h-48 md:h-full bg-[var(--app-bg)] border-b md:border-b-0 md:border-r border-[var(--card-border)] flex items-center justify-center overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} className="w-full h-full object-contain" alt="Media" />
              ) : (
                <video src={videoUrl} controls className="w-full h-full object-contain" />
              )}
            </div>
          )}
          <div className="flex-1 p-8 overflow-y-auto">
            <RichText
              ref={richTextRef}
              value={value}
              onChange={onChange}
              className="w-full min-h-full text-lg md:text-xl leading-[1.8] text-[var(--text-primary)] font-serif break-words focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
