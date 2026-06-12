import {
  Bold,
  ClipboardPaste,
  Copy,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Loader2,
  MapPin,
  Palette,
  Sparkles,
  Type,
  Underline,
  User,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type {
  CharacterPresentation,
  PresentationAnimation,
  StoryPresentation,
} from '../domain/project';
import {
  createCharacterPresentation,
  copyCharacterPresentationSettings,
  getCharacterStagePosition,
  getPresentationTransform,
  hasCharacterPresentationClipboard,
  normalizeStoryPresentation,
  pasteCharacterPresentationSettings,
} from '../lib/presentation';
import { RichText, RichTextHandle } from './RichText';

type ZenTag = {
  id: string;
  name: string;
  imageUrl?: string;
};

export function ZenEditor({
  value,
  imageUrl,
  videoUrl,
  characterTags = [],
  sceneTags = [],
  presentation,
  isAILoading = false,
  onAIGenerate,
  onGenerateImage,
  onChange,
  onPresentationChange,
  onClose,
}: {
  value: string;
  imageUrl?: string;
  videoUrl?: string;
  characterTags?: ZenTag[];
  sceneTags?: ZenTag[];
  presentation?: StoryPresentation;
  isAILoading?: boolean;
  onAIGenerate?: () => void;
  onGenerateImage?: () => Promise<void> | void;
  onChange: (v: string) => void;
  onPresentationChange?: (presentation: StoryPresentation) => void;
  onClose: () => void;
}) {
  const richTextRef = useRef<RichTextHandle>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [presentationMenu, setPresentationMenu] = useState<ZenTag | null>(null);
  const [preview, setPreview] = useState<{
    sourceNodeId: string;
    phase: 'enter' | 'exit';
    visible: boolean;
  } | null>(null);
  const [, setPresentationClipboardVersion] = useState(0);
  const normalizedPresentation = normalizeStoryPresentation(presentation);

  const replayCharacter = (sourceNodeId: string, phase: 'enter' | 'exit' = 'enter') => {
    setPreview({ sourceNodeId, phase, visible: phase === 'exit' });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setPreview({ sourceNodeId, phase, visible: phase === 'enter' }),
      ),
    );
  };

  const updateCharacter = (
    sourceNodeId: string,
    updater: (current: CharacterPresentation) => CharacterPresentation,
    phase: 'enter' | 'exit' = 'enter',
  ) => {
    const current =
      normalizedPresentation.characters.find((item) => item.sourceNodeId === sourceNodeId) ||
      createCharacterPresentation(sourceNodeId);
    onPresentationChange?.({
      ...normalizedPresentation,
      characters: [
        ...normalizedPresentation.characters.filter((item) => item.sourceNodeId !== sourceNodeId),
        updater(current),
      ],
    });
    replayCharacter(sourceNodeId, phase);
  };

  const openCharacterMenu = (tag: ZenTag) => {
    if (!normalizedPresentation.characters.some((item) => item.sourceNodeId === tag.id)) {
      onPresentationChange?.({
        ...normalizedPresentation,
        characters: [...normalizedPresentation.characters, createCharacterPresentation(tag.id)],
      });
    }
    setPresentationMenu(tag);
    replayCharacter(tag.id);
  };

  useEffect(() => {
    if (!presentationMenu) return;
    const latest = characterTags.find((tag) => tag.id === presentationMenu.id);
    if (!latest) setPresentationMenu(null);
  }, [characterTags, presentationMenu]);

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
  const sizes = [
    { label: 'S', val: '2' },
    { label: 'M', val: '4' },
    { label: 'L', val: '6' },
  ];

  return (
    <div className="fixed inset-0 bg-[var(--app-bg)] z-[200] p-6 sm:p-12 flex flex-col animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-8 max-w-5xl mx-auto w-full shrink-0">
        <div className="text-xl font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          专注模式
        </div>
        <button
          onClick={onClose}
          className="px-6 py-2 border border-[var(--card-border)] text-[var(--text-secondary)] font-medium rounded-full hover:bg-[var(--app-bg)] transition-colors shadow-sm bg-[var(--card-bg)]"
        >
          退出全屏
        </button>
      </div>

      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-6 p-2 bg-[var(--card-bg)] rounded-lg shadow-sm border border-[var(--card-border)] shrink-0">
          <button
            onClick={() => format('bold')}
            className="p-2 hover:bg-[var(--app-bg)] rounded text-[var(--text-primary)]"
            title="加粗"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => format('italic')}
            className="p-2 hover:bg-[var(--app-bg)] rounded text-[var(--text-primary)]"
            title="斜体"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => format('underline')}
            className="p-2 hover:bg-[var(--app-bg)] rounded text-[var(--text-primary)]"
            title="下划线"
          >
            <Underline className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-[var(--card-border)] mx-1"></div>
          <button
            onClick={() => format('insertUnorderedList')}
            className="p-2 hover:bg-[var(--app-bg)] rounded text-[var(--text-primary)]"
            title="项目符号列表"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => format('insertOrderedList')}
            className="p-2 hover:bg-[var(--app-bg)] rounded text-[var(--text-primary)]"
            title="编号列表"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-[var(--card-border)] mx-1"></div>

          {/* Colors */}
          <div className="flex items-center gap-1 px-2">
            <Palette className="w-4 h-4 text-[var(--text-muted)] mr-1" />
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => format('foreColor', c)}
                className="w-5 h-5 rounded-full border border-[var(--card-border)]"
                style={{ backgroundColor: c }}
              ></button>
            ))}
          </div>

          <div className="w-px h-6 bg-[var(--card-border)] mx-1"></div>
          <button
            onClick={onAIGenerate}
            disabled={!onAIGenerate || isAILoading}
            className="p-2 hover:bg-[var(--app-bg)] rounded text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="AI 续写"
          >
            {isAILoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleGenerateImage}
            disabled={!onGenerateImage || isGeneratingImage}
            className="p-2 hover:bg-[var(--app-bg)] rounded text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="图片生成"
          >
            {isGeneratingImage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
          </button>
          <div className="w-px h-6 bg-[var(--card-border)] mx-1"></div>
          {/* Sizes */}
          <div className="flex items-center gap-1 px-2">
            <Type className="w-4 h-4 text-[var(--text-muted)] mr-1" />
            {sizes.map((s) => (
              <button
                key={s.val}
                onClick={() => format('fontSize', s.val)}
                className="w-6 h-6 flex items-center justify-center text-xs font-medium hover:bg-[var(--app-bg)] rounded border border-[var(--card-border)] text-[var(--text-secondary)]"
              >
                {s.label}
              </button>
            ))}
          </div>

          {(characterTags.length > 0 || sceneTags.length > 0) && (
            <>
              <div className="w-px h-6 bg-[var(--card-border)] mx-1"></div>
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                {characterTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <User className="w-4 h-4 text-[var(--text-muted)] mx-1 shrink-0" />
                    {characterTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => insertMention('character', tag.name)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          openCharacterMenu(tag);
                        }}
                        className="px-2 py-1 rounded-md text-xs font-bold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors"
                        title={`点击插入 @${tag.name}，右击设置人物演出`}
                      >
                        @{tag.name}
                      </button>
                    ))}
                  </div>
                )}
                {sceneTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <MapPin className="w-4 h-4 text-[var(--text-muted)] mx-1 shrink-0" />
                    {sceneTags.map((tag) => (
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
        <div className="flex-1 bg-[var(--card-bg)] rounded-xl shadow-sm border border-[var(--card-border)] flex flex-col overflow-hidden">
          {(imageUrl ||
            videoUrl ||
            normalizedPresentation.characters.some((config) =>
              characterTags.some((tag) => tag.id === config.sourceNodeId && tag.imageUrl),
            )) && (
            <div className="relative h-[52%] min-h-48 w-full shrink-0 overflow-hidden border-b border-[var(--card-border)] bg-[var(--app-bg)]">
              {imageUrl ? (
                <img src={imageUrl} className="absolute inset-0 h-full w-full object-cover" alt="" />
              ) : videoUrl ? (
                <video src={videoUrl} controls className="absolute inset-0 h-full w-full object-contain" />
              ) : null}
              {normalizedPresentation.characters.map((config) => {
                const tag = characterTags.find(
                  (character) => character.id === config.sourceNodeId && character.imageUrl,
                );
                if (!tag?.imageUrl) return null;
                const previewMatches = preview?.sourceNodeId === config.sourceNodeId;
                const phase = previewMatches ? preview.phase : 'enter';
                const motion = config[phase];
                const animated = previewMatches && !preview.visible;
                return (
                  <img
                    key={config.sourceNodeId}
                    src={tag.imageUrl}
                    alt={tag.name}
                    className="absolute max-h-[92%] max-w-[72%] object-contain object-bottom"
                    style={{
                      ...getCharacterStagePosition(config),
                      zIndex: config.layer,
                      opacity: animated && motion.type !== 'none' ? 0 : 1,
                      transform: `translateX(-50%) scale(${config.scale}) scaleX(${
                        config.flipX ? -1 : 1
                      }) ${animated ? getPresentationTransform(motion.type, phase === 'exit') : ''}`,
                      transformOrigin: 'bottom center',
                      transition: previewMatches
                        ? `transform ${motion.duration}ms ease, opacity ${motion.duration}ms ease`
                        : undefined,
                    }}
                  />
                );
              })}
            </div>
          )}
          <div className="flex-1 bg-[var(--card-bg)] p-8 overflow-y-auto">
            <RichText
              ref={richTextRef}
              value={value}
              onChange={onChange}
              onMentionContextMenu={(event, mention) => {
                if (mention.kind !== 'character') return;
                const tag = characterTags.find((item) => item.name === mention.name);
                if (tag) openCharacterMenu(tag);
              }}
              className="w-full min-h-full text-lg md:text-xl leading-[1.8] text-[var(--text-primary)] font-serif break-words focus:outline-none"
            />
          </div>
        </div>
      </div>
      {presentationMenu &&
        (() => {
          const current =
            normalizedPresentation.characters.find(
              (item) => item.sourceNodeId === presentationMenu.id,
            ) || createCharacterPresentation(presentationMenu.id);
          const animationOptions: { value: PresentationAnimation; label: string }[] = [
            { value: 'none', label: '无动画' },
            { value: 'fade', label: '淡入淡出' },
            { value: 'slide-left', label: '向左滑动' },
            { value: 'slide-right', label: '向右滑动' },
            { value: 'slide-up', label: '向上滑动' },
            { value: 'slide-down', label: '向下滑动' },
            { value: 'zoom', label: '缩放' },
          ];
          return (
            <div className="fixed right-8 top-24 z-[230] w-80 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-sm text-[var(--text-primary)] shadow-2xl">
              <button
                onClick={() =>
                  updateCharacter(presentationMenu.id, (current) => ({
                    ...createCharacterPresentation(presentationMenu.id),
                    linkedByEdge: current.linkedByEdge,
                    outfitId: current.outfitId,
                  }))
                }
                className="absolute right-12 top-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-600 hover:bg-amber-500 hover:text-white"
                title="恢复默认演出设置"
              >
                清零
              </button>
              <div className="mb-3 flex items-center justify-between pr-16">
                <strong>人物演出：{presentationMenu.name}</strong>
                <button onClick={() => setPresentationMenu(null)} className="px-2 text-lg">
                  ×
                </button>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    copyCharacterPresentationSettings(current);
                    setPresentationClipboardVersion((version) => version + 1);
                  }}
                  className="flex items-center justify-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2 font-bold"
                >
                  <Copy className="h-4 w-4" />
                  复制设置
                </button>
                <button
                  disabled={!hasCharacterPresentationClipboard()}
                  onClick={() =>
                    updateCharacter(
                      presentationMenu.id,
                      pasteCharacterPresentationSettings,
                    )
                  }
                  className="flex items-center justify-center gap-1 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2 font-bold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ClipboardPaste className="h-4 w-4" />
                  粘贴设置
                </button>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => replayCharacter(presentationMenu.id, 'enter')}
                  className="rounded-lg bg-blue-500/10 p-2 font-bold text-blue-500"
                >
                  预览入场
                </button>
                <button
                  onClick={() => replayCharacter(presentationMenu.id, 'exit')}
                  className="rounded-lg bg-rose-500/10 p-2 font-bold text-rose-500"
                >
                  预览出场
                </button>
              </div>
              <label className="mb-3 block">
                <span className="mb-1 block font-bold">站位</span>
                <select
                  value={current.position}
                  onChange={(event) =>
                    updateCharacter(presentationMenu.id, (item) => ({
                      ...item,
                      position: event.target.value as CharacterPresentation['position'],
                    }))
                  }
                  className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2"
                >
                  <option value="left">左侧</option>
                  <option value="center">中央</option>
                  <option value="right">右侧</option>
                  <option value="custom">自定义</option>
                </select>
              </label>
              {(['offsetX', 'offsetY'] as const).map((field) => (
                <label key={field} className="mb-3 block">
                  <span className="mb-1 flex justify-between font-bold">
                    <span>{field === 'offsetX' ? '水平偏移' : '垂直偏移'}</span>
                    <span>{current[field]}</span>
                  </span>
                  <input
                    type="range"
                    min="-500"
                    max="500"
                    value={current[field]}
                    onChange={(event) =>
                      updateCharacter(presentationMenu.id, (item) => ({
                        ...item,
                        [field]: Number(event.target.value),
                      }))
                    }
                    className="w-full cursor-ew-resize"
                  />
                </label>
              ))}
              <label className="mb-3 block">
                <span className="mb-1 block font-bold">
                  缩放：{Math.round(current.scale * 100)}%
                </span>
                <input
                  type="range"
                  min="0.4"
                  max="2"
                  step="0.05"
                  value={current.scale}
                  onChange={(event) =>
                    updateCharacter(presentationMenu.id, (item) => ({
                      ...item,
                      scale: Number(event.target.value),
                    }))
                  }
                  className="w-full"
                />
              </label>
              {(['enter', 'exit'] as const).map((phase) => (
                <div key={phase} className="mb-3 grid grid-cols-[1fr_90px] gap-2">
                  <label>
                    <span className="mb-1 block font-bold">
                      {phase === 'enter' ? '入场动画' : '出场动画'}
                    </span>
                    <select
                      value={current[phase].type}
                      onChange={(event) =>
                        updateCharacter(
                          presentationMenu.id,
                          (item) => ({
                            ...item,
                            [phase]: {
                              ...item[phase],
                              type: event.target.value as PresentationAnimation,
                            },
                          }),
                          phase,
                        )
                      }
                      className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2"
                    >
                      {animationOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1 block font-bold">时长(ms)</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={current[phase].duration}
                      onChange={(event) =>
                        updateCharacter(
                          presentationMenu.id,
                          (item) => ({
                            ...item,
                            [phase]: {
                              ...item[phase],
                              duration: Number(event.target.value),
                            },
                          }),
                          phase,
                        )
                      }
                      className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2"
                    />
                  </label>
                </div>
              ))}
            </div>
          );
        })()}
    </div>
  );
}
