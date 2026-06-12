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
  Save,
  Sparkles,
  Trash2,
  Type,
  Underline,
  User,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type {
  CharacterPresentation,
  PresentationAnimation,
  PresentationMotion,
  ScenePresentation,
  StoryPresentation,
} from '../domain/project';
import {
  clampCharacterLayer,
  copyCharacterPresentationSettings,
  copyScenePresentationSettings,
  createCharacterPresentation,
  createScenePresentation,
  getCharacterStagePosition,
  getPresentationTransform,
  hasCharacterPresentationClipboard,
  hasScenePresentationClipboard,
  normalizeStoryPresentation,
  pasteCharacterPresentationSettings,
  pasteScenePresentationSettings,
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
  const [toolbarMenu, setToolbarMenu] = useState<'colors' | 'sizes' | null>(null);
  const [presentationMenu, setPresentationMenu] = useState<
    (ZenTag & { kind: 'character' | 'scene' }) | null
  >(null);
  const [preview, setPreview] = useState<{
    kind: 'character' | 'scene';
    sourceNodeId?: string;
    phase: 'enter' | 'exit';
    visible: boolean;
  } | null>(null);
  const [presentationResetUndo, setPresentationResetUndo] = useState<{
    kind: 'character' | 'scene';
    sourceNodeId: string;
    value: CharacterPresentation | ScenePresentation;
  } | null>(null);
  const [, setPresentationClipboardVersion] = useState(0);

  // NOTE: 演出设置模板接口定义
  interface CharacterTemplate {
    id: string;
    name: string;
    settings: {
      position: 'left' | 'center' | 'right' | 'custom';
      offsetX: number;
      offsetY: number;
      scale: number;
      flipX: boolean;
      layer: number;
      enter: PresentationMotion;
      exit: PresentationMotion;
    };
  }

  interface SceneTemplate {
    id: string;
    name: string;
    settings: {
      cropMode: 'cover' | 'contain' | 'stretch';
      scale: number;
      offsetX: number;
      offsetY: number;
      enter: PresentationMotion;
      exit: PresentationMotion;
    };
  }

  const [characterTemplates, setCharacterTemplates] = useState<CharacterTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('galwriter-char-templates');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [sceneTemplates, setSceneTemplates] = useState<SceneTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('galwriter-scene-templates');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [showCharacterTemplateList, setShowCharacterTemplateList] = useState(false);
  const [showSceneTemplateList, setShowSceneTemplateList] = useState(false);

  // NOTE: 新建角色模板处理
  const handleCreateCharacterTemplate = (config: CharacterPresentation) => {
    const {
      sourceNodeId: _sourceNodeId,
      linkedByEdge: _linkedByEdge,
      outfitId: _outfitId,
      ...settings
    } = config;
    let currentTemplates: CharacterTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-char-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse character templates:', error);
    }
    const newTemplate: CharacterTemplate = {
      id: Date.now().toString(),
      name: `${presentationMenu?.name || '角色'}-模板-${currentTemplates.length + 1}`,
      settings,
    };
    const nextTemplates = [...currentTemplates, newTemplate];
    setCharacterTemplates(nextTemplates);
    localStorage.setItem('galwriter-char-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
    setShowCharacterTemplateList(true);
  };

  // NOTE: 新建场景模板处理
  const handleCreateSceneTemplate = (config: ScenePresentation) => {
    const {
      sourceNodeId: _sourceNodeId,
      linkedByEdge: _linkedByEdge,
      imageId: _imageId,
      previousImageUrl: _previousImageUrl,
      previousShowTextOverlay: _previousShowTextOverlay,
      ...settings
    } = config;
    let currentTemplates: SceneTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-scene-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse scene templates:', error);
    }
    const newTemplate: SceneTemplate = {
      id: Date.now().toString(),
      name: `${presentationMenu?.name || '场景'}-模板-${currentTemplates.length + 1}`,
      settings,
    };
    const nextTemplates = [...currentTemplates, newTemplate];
    setSceneTemplates(nextTemplates);
    localStorage.setItem('galwriter-scene-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
    setShowSceneTemplateList(true);
  };

  // NOTE: 重命名角色模板
  const handleRenameCharacterTemplate = (tplId: string, newName: string) => {
    let currentTemplates: CharacterTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-char-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse character templates:', error);
    }
    const nextTemplates = currentTemplates.map((t) =>
      t.id === tplId ? { ...t, name: newName } : t,
    );
    setCharacterTemplates(nextTemplates);
    localStorage.setItem('galwriter-char-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
  };

  // NOTE: 重命名场景模板
  const handleRenameSceneTemplate = (tplId: string, newName: string) => {
    let currentTemplates: SceneTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-scene-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse scene templates:', error);
    }
    const nextTemplates = currentTemplates.map((t) =>
      t.id === tplId ? { ...t, name: newName } : t,
    );
    setSceneTemplates(nextTemplates);
    localStorage.setItem('galwriter-scene-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
  };

  // NOTE: 删除角色模板
  const handleDeleteCharacterTemplate = (tplId: string) => {
    let currentTemplates: CharacterTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-char-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse character templates:', error);
    }
    const nextTemplates = currentTemplates.filter((t) => t.id !== tplId);
    setCharacterTemplates(nextTemplates);
    localStorage.setItem('galwriter-char-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
  };

  // NOTE: 删除场景模板
  const handleDeleteSceneTemplate = (tplId: string) => {
    let currentTemplates: SceneTemplate[] = [];
    try {
      const stored = localStorage.getItem('galwriter-scene-templates');
      currentTemplates = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse scene templates:', error);
    }
    const nextTemplates = currentTemplates.filter((t) => t.id !== tplId);
    setSceneTemplates(nextTemplates);
    localStorage.setItem('galwriter-scene-templates', JSON.stringify(nextTemplates));
    window.dispatchEvent(new Event('galwriter-templates-changed'));
  };

  // NOTE: 应用角色模板
  const handleApplyCharacterTemplate = (tpl: CharacterTemplate) => {
    if (!presentationMenu) return;
    updateCharacter(
      presentationMenu.id,
      (current) => ({
        ...current,
        ...structuredClone(tpl.settings),
      }),
      'enter',
    );
  };

  // NOTE: 应用场景模板
  const handleApplySceneTemplate = (tpl: SceneTemplate) => {
    if (!presentationMenu) return;
    updateScene(
      presentationMenu.id,
      (current) => ({
        ...current,
        ...structuredClone(tpl.settings),
      }),
      'enter',
    );
  };

  // NOTE: 监听模板数据同步事件以同步全局跨卡片模板列表
  useEffect(() => {
    const handleSync = () => {
      try {
        const storedChar = localStorage.getItem('galwriter-char-templates');
        setCharacterTemplates(storedChar ? JSON.parse(storedChar) : []);
      } catch (error) {
        console.error('Failed to sync character templates:', error);
      }
      try {
        const storedScene = localStorage.getItem('galwriter-scene-templates');
        setSceneTemplates(storedScene ? JSON.parse(storedScene) : []);
      } catch (error) {
        console.error('Failed to sync scene templates:', error);
      }
    };
    window.addEventListener('galwriter-templates-changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('galwriter-templates-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);
  const normalizedPresentation = normalizeStoryPresentation(presentation);

  const replayCharacter = (
    sourceNodeId: string,
    phase: 'enter' | 'exit' = 'enter',
    motionOverride?: PresentationMotion,
  ) => {
    const motion =
      motionOverride ||
      normalizedPresentation.characters.find((item) => item.sourceNodeId === sourceNodeId)?.[phase];
    if (!motion || motion.type === 'none' || motion.duration <= 0) {
      setPreview(null);
      return;
    }
    setPreview({ kind: 'character', sourceNodeId, phase, visible: phase === 'exit' });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setPreview({
          kind: 'character',
          sourceNodeId,
          phase,
          visible: phase === 'enter',
        }),
      ),
    );
  };

  const updateCharacter = (
    sourceNodeId: string,
    updater: (current: CharacterPresentation) => CharacterPresentation,
    phase: 'enter' | 'exit' = 'enter',
    preserveResetUndo = false,
  ) => {
    const current =
      normalizedPresentation.characters.find((item) => item.sourceNodeId === sourceNodeId) ||
      createCharacterPresentation(sourceNodeId);
    const next = updater(current);
    onPresentationChange?.({
      ...normalizedPresentation,
      characters: [
        ...normalizedPresentation.characters.filter((item) => item.sourceNodeId !== sourceNodeId),
        next,
      ],
    });
    if (!preserveResetUndo) setPresentationResetUndo(null);
    replayCharacter(sourceNodeId, phase, next[phase]);
  };

  const openCharacterMenu = (tag: ZenTag) => {
    if (!normalizedPresentation.characters.some((item) => item.sourceNodeId === tag.id)) {
      onPresentationChange?.({
        ...normalizedPresentation,
        characters: [...normalizedPresentation.characters, createCharacterPresentation(tag.id)],
      });
    }
    setPresentationMenu({ ...tag, kind: 'character' });
    replayCharacter(tag.id);
  };

  const replayScene = (
    sourceNodeId: string,
    phase: 'enter' | 'exit' = 'enter',
    motionOverride?: PresentationMotion,
  ) => {
    const motion =
      motionOverride ||
      (normalizedPresentation.scene?.sourceNodeId === sourceNodeId
        ? normalizedPresentation.scene[phase]
        : undefined);
    if (!motion || motion.type === 'none' || motion.duration <= 0) {
      setPreview(null);
      return;
    }
    setPreview({ kind: 'scene', sourceNodeId, phase, visible: phase === 'exit' });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setPreview({ kind: 'scene', sourceNodeId, phase, visible: phase === 'enter' }),
      ),
    );
  };

  const updateScene = (
    sourceNodeId: string,
    updater: (current: ScenePresentation) => ScenePresentation,
    phase: 'enter' | 'exit' = 'enter',
    preserveResetUndo = false,
  ) => {
    const current =
      normalizedPresentation.scene?.sourceNodeId === sourceNodeId
        ? normalizedPresentation.scene
        : createScenePresentation(sourceNodeId, imageUrl);
    const next = updater(current);
    onPresentationChange?.({
      ...normalizedPresentation,
      scene: next,
    });
    if (!preserveResetUndo) setPresentationResetUndo(null);
    replayScene(sourceNodeId, phase, next[phase]);
  };

  const openSceneMenu = (tag: ZenTag) => {
    if (normalizedPresentation.scene?.sourceNodeId !== tag.id) {
      onPresentationChange?.({
        ...normalizedPresentation,
        scene: createScenePresentation(tag.id, imageUrl),
      });
    }
    setPresentationMenu({ ...tag, kind: 'scene' });
    replayScene(tag.id);
  };

  useEffect(() => {
    if (!presentationMenu) return;
    const tags = presentationMenu.kind === 'character' ? characterTags : sceneTags;
    const latest = tags.find((tag) => tag.id === presentationMenu.id);
    if (!latest) setPresentationMenu(null);
  }, [characterTags, sceneTags, presentationMenu]);

  useEffect(() => {
    if (presentationMenu) return;
    if (characterTags[0]) {
      setPresentationMenu({ ...characterTags[0], kind: 'character' });
    } else if (sceneTags[0]) {
      setPresentationMenu({ ...sceneTags[0], kind: 'scene' });
    }
  }, [characterTags, presentationMenu, sceneTags]);

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
    <div className="fixed inset-0 z-[200] grid grid-cols-[76px_minmax(0,1fr)_320px] gap-3 bg-[var(--app-bg)] p-3 animate-in fade-in duration-200">
      <aside className="relative z-[80] flex min-h-0 flex-col items-center gap-3 overflow-visible rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-2 shadow-sm">
        {/* Toolbar */}
        <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3 overflow-visible rounded-xl bg-[var(--app-bg)] px-1 py-3">
          <button
            onClick={() => format('bold')}
            className="rounded-lg p-3 text-[var(--text-primary)] hover:bg-[var(--card-bg)]"
            title="加粗"
          >
            <Bold className="h-5 w-5" />
          </button>
          <button
            onClick={() => format('italic')}
            className="rounded-lg p-3 text-[var(--text-primary)] hover:bg-[var(--card-bg)]"
            title="斜体"
          >
            <Italic className="h-5 w-5" />
          </button>
          <button
            onClick={() => format('underline')}
            className="rounded-lg p-3 text-[var(--text-primary)] hover:bg-[var(--card-bg)]"
            title="下划线"
          >
            <Underline className="h-5 w-5" />
          </button>
          <div className="my-1 h-px w-10 shrink-0 bg-[var(--card-border)]"></div>
          <button
            onClick={() => format('insertUnorderedList')}
            className="rounded-lg p-3 text-[var(--text-primary)] hover:bg-[var(--card-bg)]"
            title="项目符号列表"
          >
            <List className="h-5 w-5" />
          </button>
          <button
            onClick={() => format('insertOrderedList')}
            className="rounded-lg p-3 text-[var(--text-primary)] hover:bg-[var(--card-bg)]"
            title="编号列表"
          >
            <ListOrdered className="h-5 w-5" />
          </button>
          <div className="my-1 h-px w-10 shrink-0 bg-[var(--card-border)]"></div>

          {/* Colors */}
          <div className="relative flex flex-col items-center">
            <button
              type="button"
              onClick={() => setToolbarMenu((current) => (current === 'colors' ? null : 'colors'))}
              className={`rounded-lg p-3 text-[var(--text-muted)] hover:bg-[var(--card-bg)] ${
                toolbarMenu === 'colors' ? 'bg-[var(--card-bg)] text-indigo-500 shadow-sm' : ''
              }`}
              title="文字颜色"
            >
              <Palette className="h-5 w-5" />
            </button>
            {toolbarMenu === 'colors' && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 z-[200] grid w-40 -translate-y-1/2 grid-cols-3 place-items-center gap-x-4 gap-y-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-xl">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      format('foreColor', c);
                      setToolbarMenu(null);
                    }}
                    className="h-8 w-8 rounded-full border-2 border-[var(--card-border)] shadow-sm transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="my-1 h-px w-10 shrink-0 bg-[var(--card-border)]"></div>
          {/* Sizes */}
          <div className="relative flex flex-col items-center">
            <button
              type="button"
              onClick={() => setToolbarMenu((current) => (current === 'sizes' ? null : 'sizes'))}
              className={`rounded-lg p-3 text-[var(--text-muted)] hover:bg-[var(--card-bg)] ${
                toolbarMenu === 'sizes' ? 'bg-[var(--card-bg)] text-indigo-500 shadow-sm' : ''
              }`}
              title="字号"
            >
              <Type className="h-5 w-5" />
            </button>
            {toolbarMenu === 'sizes' && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 z-[200] flex -translate-y-1/2 gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-2.5 shadow-xl">
                {sizes.map((s) => (
                  <button
                    key={s.val}
                    onClick={() => {
                      format('fontSize', s.val);
                      setToolbarMenu(null);
                    }}
                    className="flex h-10 w-11 items-center justify-center rounded-lg border border-[var(--card-border)] text-base font-black text-[var(--text-secondary)] hover:bg-[var(--app-bg)] hover:text-indigo-500"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-3">
            <div className="my-1 h-px w-10 shrink-0 bg-[var(--card-border)]"></div>
            <button
              onClick={onAIGenerate}
              disabled={!onAIGenerate || isAILoading}
              className="rounded-lg p-3 text-indigo-500 hover:bg-[var(--card-bg)] disabled:cursor-not-allowed disabled:opacity-50"
              title="AI 续写"
            >
              {isAILoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={handleGenerateImage}
              disabled={!onGenerateImage || isGeneratingImage}
              className="rounded-lg p-3 text-blue-500 hover:bg-[var(--card-bg)] disabled:cursor-not-allowed disabled:opacity-50"
              title="图片生成"
            >
              {isGeneratingImage ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImageIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          <div className="hidden">
            {(characterTags.length > 0 || sceneTags.length > 0) && (
              <div>
                {characterTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <User className="w-4 h-4 text-[var(--text-muted)] mx-1 shrink-0" />
                    {characterTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onDoubleClick={(event) => event.preventDefault()}
                        onDragStart={(event) => event.preventDefault()}
                        onClick={() => insertMention('character', tag.name)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          openCharacterMenu(tag);
                        }}
                        className="select-none px-2 py-1 rounded-md text-xs font-bold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors"
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
                        onMouseDown={(event) => event.preventDefault()}
                        onDoubleClick={(event) => event.preventDefault()}
                        onDragStart={(event) => event.preventDefault()}
                        onClick={() => insertMention('scene', tag.name)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          openSceneMenu(tag);
                        }}
                        className="select-none px-2 py-1 rounded-md text-xs font-bold bg-blue-800/10 text-blue-700 hover:bg-blue-800/20 hover:text-blue-800 border border-blue-800/20 dark:text-blue-300 dark:hover:text-blue-200 transition-colors"
                        title={`点击插入 @${tag.name}，右键设置场景演出`}
                      >
                        @{tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="relative z-0 min-h-0 min-w-0">
        {/* Editor Area with Media Support */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm">
          {(imageUrl ||
            videoUrl ||
            normalizedPresentation.characters.some((config) =>
              characterTags.some((tag) => tag.id === config.sourceNodeId && tag.imageUrl),
            )) && (
            <div className="relative flex-1 min-h-48 w-full shrink-0 overflow-hidden border-b border-[var(--card-border)] bg-slate-950">
              {imageUrl ? (
                (() => {
                  const scene = normalizedPresentation.scene;
                  const previewMatches =
                    Boolean(scene) &&
                    preview?.kind === 'scene' &&
                    preview.sourceNodeId === scene?.sourceNodeId;
                  const phase = previewMatches ? preview?.phase || 'enter' : 'enter';
                  const motion = scene?.[phase];
                  const animated = previewMatches && !preview?.visible;
                  return (
                    <img
                      src={imageUrl}
                      className="absolute inset-0 h-full w-full"
                      style={{
                        objectFit:
                          scene?.cropMode === 'contain'
                            ? 'contain'
                            : scene?.cropMode === 'stretch'
                              ? 'fill'
                              : 'cover',
                        objectPosition: `${50 + (scene?.offsetX || 0)}% ${
                          50 + (scene?.offsetY || 0)
                        }%`,
                        opacity: animated && motion?.type === 'fade' ? 0 : 1,
                        transform: `scale(${scene?.scale || 1}) ${
                          animated && motion
                            ? getPresentationTransform(motion.type, phase === 'exit')
                            : ''
                        }`,
                        transitionProperty: 'opacity, transform',
                        transitionDuration: `${previewMatches ? motion?.duration || 0 : 0}ms`,
                        transitionTimingFunction: 'ease-out',
                      }}
                      alt=""
                    />
                  );
                })()
              ) : videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : null}
              {normalizedPresentation.characters.map((config) => {
                const tag = characterTags.find(
                  (character) => character.id === config.sourceNodeId && character.imageUrl,
                );
                if (!tag?.imageUrl) return null;
                const previewMatches =
                  preview?.kind === 'character' && preview.sourceNodeId === config.sourceNodeId;
                const phase = previewMatches ? preview.phase : 'enter';
                const motion = config[phase];
                const animated = previewMatches && !preview.visible;
                return (
                  <img
                    key={config.sourceNodeId}
                    src={tag.imageUrl}
                    alt={tag.name}
                    className="absolute max-h-[92%] max-w-[72%] w-auto object-contain object-bottom"
                    style={{
                      ...getCharacterStagePosition(config),
                      zIndex: clampCharacterLayer(config.layer),
                      opacity: animated && motion.type === 'fade' ? 0 : 1,
                      translate: '-50% 0',
                      transform: `${
                        animated ? getPresentationTransform(motion.type, phase === 'exit') : ''
                      } scale(${config.scale}) scaleX(${config.flipX ? -1 : 1})`,
                      transformOrigin: 'center center',
                      transition:
                        previewMatches && motion.type !== 'none' && motion.duration > 0
                          ? `transform ${motion.duration}ms ease, opacity ${motion.duration}ms ease`
                          : undefined,
                    }}
                  />
                );
              })}
            </div>
          )}
          <div className="h-48 shrink-0 bg-[var(--card-bg)] p-8 overflow-y-auto">
            <RichText
              ref={richTextRef}
              value={value}
              onChange={onChange}
              onMentionContextMenu={(event, mention) => {
                const tags = mention.kind === 'character' ? characterTags : sceneTags;
                const tag = tags.find((item) => item.name === mention.name);
                if (!tag) return;
                if (mention.kind === 'character') openCharacterMenu(tag);
                else openSceneMenu(tag);
              }}
              className="w-full min-h-full text-lg md:text-xl leading-[1.8] text-[var(--text-primary)] font-serif break-words focus:outline-none"
            />
          </div>
        </div>
      </main>
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
          <span className="text-xs font-black text-[var(--text-muted)]">演出设置</span>
          <button
            onClick={onClose}
            className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-5 py-2.5 text-sm font-black text-rose-500 shadow-sm hover:bg-rose-500 hover:text-white"
          >
            退出专注
          </button>
        </div>
        <div className="space-y-2 border-b border-[var(--card-border)] p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex shrink-0 items-center gap-1.5 text-sm font-black text-indigo-500">
              <User className="h-5 w-5" />
              人物演出
            </div>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {characterTags.length ? (
                characterTags.map((tag) => (
                  <div key={tag.id} className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openCharacterMenu(tag)}
                      className={`max-w-36 truncate rounded-lg px-3 py-2 text-left text-sm font-bold ${
                        presentationMenu?.kind === 'character' && presentationMenu.id === tag.id
                          ? 'bg-indigo-500 text-white'
                          : 'bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20'
                      }`}
                    >
                      {tag.name}
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertMention('character', tag.name)}
                      className="rounded-lg bg-[var(--app-bg)] px-3 text-sm font-black text-indigo-500"
                      title={`插入 @${tag.name}`}
                    >
                      @
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-[var(--text-muted)]">无人物</div>
              )}
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex shrink-0 items-center gap-1.5 text-sm font-black text-blue-500">
              <MapPin className="h-5 w-5" />
              场景演出
            </div>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {sceneTags.length ? (
                sceneTags.map((tag) => (
                  <div key={tag.id} className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openSceneMenu(tag)}
                      className={`max-w-36 truncate rounded-lg px-3 py-2 text-left text-sm font-bold ${
                        presentationMenu?.kind === 'scene' && presentationMenu.id === tag.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
                      }`}
                    >
                      {tag.name}
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertMention('scene', tag.name)}
                      className="rounded-lg bg-[var(--app-bg)] px-3 text-sm font-black text-blue-500"
                      title={`插入 @${tag.name}`}
                    >
                      @
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-[var(--text-muted)]">无场景</div>
              )}
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {presentationMenu?.kind === 'character' &&
            (() => {
              const current =
                normalizedPresentation.characters.find(
                  (item) => item.sourceNodeId === presentationMenu.id,
                ) || createCharacterPresentation(presentationMenu.id);
              const animationOptions: { value: PresentationAnimation; label: string }[] = [
                { value: 'none', label: '· 无动画' },
                { value: 'fade', label: '◇ 淡入淡出' },
                { value: 'slide-left', label: '← 向左滑动' },
                { value: 'slide-right', label: '→ 向右滑动' },
                { value: 'slide-up', label: '↑ 向上滑动' },
                { value: 'slide-down', label: '↓ 向下滑动' },
                { value: 'zoom', label: '↕ 缩放' },
              ];
              return (
                <div className="relative text-sm text-[var(--text-primary)]">
                  <button
                    onClick={() => {
                      const canRestore =
                        presentationResetUndo?.kind === 'character' &&
                        presentationResetUndo.sourceNodeId === presentationMenu.id;
                      if (canRestore) {
                        updateCharacter(
                          presentationMenu.id,
                          () => presentationResetUndo.value as CharacterPresentation,
                          'enter',
                          true,
                        );
                        setPresentationResetUndo(null);
                        return;
                      }
                      setPresentationResetUndo({
                        kind: 'character',
                        sourceNodeId: presentationMenu.id,
                        value: structuredClone(current),
                      });
                      updateCharacter(
                        presentationMenu.id,
                        (current) => ({
                          ...createCharacterPresentation(presentationMenu.id),
                          linkedByEdge: current.linkedByEdge,
                          outfitId: current.outfitId,
                        }),
                        'enter',
                        true,
                      );
                    }}
                    className={`absolute right-0 top-0 rounded-md border px-2 py-1 text-xs font-bold transition-colors ${
                      presentationResetUndo?.kind === 'character' &&
                      presentationResetUndo.sourceNodeId === presentationMenu.id
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white'
                    }`}
                    title={
                      presentationResetUndo?.kind === 'character' &&
                      presentationResetUndo.sourceNodeId === presentationMenu.id
                        ? '还原清零前的演出设置'
                        : '恢复默认演出设置'
                    }
                  >
                    {presentationResetUndo?.kind === 'character' &&
                    presentationResetUndo.sourceNodeId === presentationMenu.id
                      ? '还原'
                      : '清零'}
                  </button>
                  <div className="mb-3 pr-16">
                    <strong>人物演出：{presentationMenu.name}</strong>
                  </div>
                  <div className="mb-3 flex items-center justify-between bg-[var(--app-bg)] rounded-lg p-1.5 border border-[var(--card-border)]/40 gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          copyCharacterPresentationSettings(current);
                          setPresentationClipboardVersion((version) => version + 1);
                        }}
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors flex items-center justify-center"
                        title="复制设置"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!hasCharacterPresentationClipboard()}
                        onClick={() =>
                          updateCharacter(presentationMenu.id, pasteCharacterPresentationSettings)
                        }
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-[var(--text-secondary)] disabled:hover:bg-transparent flex items-center justify-center"
                        title="粘贴设置"
                      >
                        <ClipboardPaste className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="w-px h-4 bg-[var(--card-border)]/40 shrink-0" />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCreateCharacterTemplate(current)}
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors flex items-center justify-center"
                        title="新建模板"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCharacterTemplateList(!showCharacterTemplateList)}
                        className={`p-1.5 rounded-md transition-colors flex items-center justify-center ${showCharacterTemplateList ? 'text-indigo-500 bg-indigo-500/10' : 'text-[var(--text-secondary)] hover:text-indigo-500 hover:bg-indigo-500/10'}`}
                        title="模板列表"
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {showCharacterTemplateList && (
                    <div className="mb-3 border border-[var(--card-border)]/40 rounded-lg bg-[var(--app-bg)]/50 p-2 space-y-1.5 max-h-48 overflow-y-auto">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] px-1 flex justify-between items-center">
                        <span>已存人物模板</span>
                        {characterTemplates.length === 0 && (
                          <span className="font-normal">暂无模板</span>
                        )}
                      </div>
                      {characterTemplates.map((tpl) => (
                        <div
                          key={tpl.id}
                          className="flex items-center justify-between gap-1.5 bg-[var(--card-bg)] p-1.5 rounded border border-[var(--card-border)]/30 hover:border-indigo-500/30 transition-colors"
                        >
                          <input
                            type="text"
                            value={tpl.name}
                            onChange={(e) => handleRenameCharacterTemplate(tpl.id, e.target.value)}
                            className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none border-b border-transparent focus:border-indigo-500/50 pb-0.5 px-0.5"
                            placeholder="模板名称"
                          />
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleApplyCharacterTemplate(tpl)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-colors"
                              title="应用模板"
                            >
                              使用
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCharacterTemplate(tpl.id)}
                              className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="删除模板"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => replayCharacter(presentationMenu.id, 'enter')}
                      className="rounded-lg bg-blue-500/10 p-2 font-bold text-blue-500 outline-none focus:outline-none focus-visible:outline-none"
                    >
                      预览入场
                    </button>
                    <button
                      type="button"
                      onClick={() => replayCharacter(presentationMenu.id, 'exit')}
                      className="rounded-lg bg-rose-500/10 p-2 font-bold text-rose-500 outline-none focus:outline-none focus-visible:outline-none"
                    >
                      预览出场
                    </button>
                  </div>
                  <div className="mb-3 flex w-full gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateCharacter(presentationMenu.id, (item) => ({
                          ...item,
                          position: 'left',
                        }))
                      }
                      className={`flex-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${
                        current.position === 'left'
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-[var(--card-border)] bg-[var(--app-bg)] hover:border-indigo-500/50 hover:bg-indigo-500/10'
                      }`}
                    >
                      左边
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateCharacter(presentationMenu.id, (item) => ({
                          ...item,
                          position: 'center',
                        }))
                      }
                      className={`flex-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${
                        current.position === 'center'
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-[var(--card-border)] bg-[var(--app-bg)] hover:border-indigo-500/50 hover:bg-indigo-500/10'
                      }`}
                    >
                      中间
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateCharacter(presentationMenu.id, (item) => ({
                          ...item,
                          position: 'right',
                        }))
                      }
                      className={`flex-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${
                        current.position === 'right'
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-[var(--card-border)] bg-[var(--app-bg)] hover:border-indigo-500/50 hover:bg-indigo-500/10'
                      }`}
                    >
                      右边
                    </button>
                  </div>
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
                  {normalizedPresentation.characters.length > 1 && (
                    <label className="mb-3 flex items-center gap-2">
                      <span className="shrink-0 font-bold">Z轴</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={clampCharacterLayer(current.layer)}
                        onChange={(event) =>
                          updateCharacter(presentationMenu.id, (item) => ({
                            ...item,
                            layer: clampCharacterLayer(Number(event.target.value)),
                          }))
                        }
                        className="w-20 rounded-lg border-0 bg-[var(--app-bg)] p-2 text-right outline-none focus:outline-none focus-visible:outline-none"
                      />
                    </label>
                  )}
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
                        <span className="mb-1 block font-bold">时长</span>
                        <div className="flex w-full items-center rounded-lg bg-[var(--app-bg)]">
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
                            className="min-w-0 flex-1 border-0 bg-transparent p-2 text-right outline-none focus:border-0 focus:outline-none focus-visible:outline-none"
                          />
                          <span className="pr-2 text-[10px] font-bold text-[var(--text-muted)]">
                            MS
                          </span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              );
            })()}
          {presentationMenu?.kind === 'scene' &&
            (() => {
              const current =
                normalizedPresentation.scene?.sourceNodeId === presentationMenu.id
                  ? normalizedPresentation.scene
                  : createScenePresentation(presentationMenu.id, imageUrl);
              const animationOptions: { value: PresentationAnimation; label: string }[] = [
                { value: 'none', label: '· 无动画' },
                { value: 'fade', label: '◇ 淡入淡出' },
                { value: 'slide-left', label: '← 向左滑动' },
                { value: 'slide-right', label: '→ 向右滑动' },
                { value: 'slide-up', label: '↑ 向上滑动' },
                { value: 'slide-down', label: '↓ 向下滑动' },
                { value: 'zoom', label: '↕ 缩放' },
              ];
              return (
                <div className="relative text-sm text-[var(--text-primary)]">
                  <button
                    onClick={() => {
                      const canRestore =
                        presentationResetUndo?.kind === 'scene' &&
                        presentationResetUndo.sourceNodeId === presentationMenu.id;
                      if (canRestore) {
                        updateScene(
                          presentationMenu.id,
                          () => presentationResetUndo.value as ScenePresentation,
                          'enter',
                          true,
                        );
                        setPresentationResetUndo(null);
                        return;
                      }
                      setPresentationResetUndo({
                        kind: 'scene',
                        sourceNodeId: presentationMenu.id,
                        value: structuredClone(current),
                      });
                      updateScene(
                        presentationMenu.id,
                        (item) => ({
                          ...createScenePresentation(presentationMenu.id, imageUrl),
                          linkedByEdge: item.linkedByEdge,
                          imageId: item.imageId,
                          previousImageUrl: item.previousImageUrl,
                          previousShowTextOverlay: item.previousShowTextOverlay,
                        }),
                        'enter',
                        true,
                      );
                    }}
                    className={`absolute right-0 top-0 rounded-md border px-2 py-1 text-xs font-bold transition-colors ${
                      presentationResetUndo?.kind === 'scene' &&
                      presentationResetUndo.sourceNodeId === presentationMenu.id
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white'
                    }`}
                    title={
                      presentationResetUndo?.kind === 'scene' &&
                      presentationResetUndo.sourceNodeId === presentationMenu.id
                        ? '还原清零前的演出设置'
                        : '恢复默认演出设置'
                    }
                  >
                    {presentationResetUndo?.kind === 'scene' &&
                    presentationResetUndo.sourceNodeId === presentationMenu.id
                      ? '还原'
                      : '清零'}
                  </button>
                  <div className="mb-3 pr-16">
                    <strong>场景演出：{presentationMenu.name}</strong>
                  </div>
                  <div className="mb-3 flex items-center justify-between bg-[var(--app-bg)] rounded-lg p-1.5 border border-[var(--card-border)]/40 gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          copyScenePresentationSettings(current);
                          setPresentationClipboardVersion((version) => version + 1);
                        }}
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-500/10 transition-colors flex items-center justify-center"
                        title="复制设置"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!hasScenePresentationClipboard()}
                        onClick={() =>
                          updateScene(presentationMenu.id, pasteScenePresentationSettings)
                        }
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-500/10 transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-[var(--text-secondary)] disabled:hover:bg-transparent flex items-center justify-center"
                        title="粘贴设置"
                      >
                        <ClipboardPaste className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="w-px h-4 bg-[var(--card-border)]/40 shrink-0" />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCreateSceneTemplate(current)}
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-500/10 transition-colors flex items-center justify-center"
                        title="新建模板"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSceneTemplateList(!showSceneTemplateList)}
                        className={`p-1.5 rounded-md transition-colors flex items-center justify-center ${showSceneTemplateList ? 'text-blue-500 bg-blue-500/10' : 'text-[var(--text-secondary)] hover:text-blue-500 hover:bg-blue-500/10'}`}
                        title="模板列表"
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {showSceneTemplateList && (
                    <div className="mb-3 border border-[var(--card-border)]/40 rounded-lg bg-[var(--app-bg)]/50 p-2 space-y-1.5 max-h-48 overflow-y-auto">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] px-1 flex justify-between items-center">
                        <span>已存场景模板</span>
                        {sceneTemplates.length === 0 && (
                          <span className="font-normal">暂无模板</span>
                        )}
                      </div>
                      {sceneTemplates.map((tpl) => (
                        <div
                          key={tpl.id}
                          className="flex items-center justify-between gap-1.5 bg-[var(--card-bg)] p-1.5 rounded border border-[var(--card-border)]/30 hover:border-blue-500/30 transition-colors"
                        >
                          <input
                            type="text"
                            value={tpl.name}
                            onChange={(e) => handleRenameSceneTemplate(tpl.id, e.target.value)}
                            className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none border-b border-transparent focus:border-blue-500/50 pb-0.5 px-0.5"
                            placeholder="模板名称"
                          />
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleApplySceneTemplate(tpl)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
                              title="应用模板"
                            >
                              使用
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSceneTemplate(tpl.id)}
                              className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="删除模板"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => replayScene(presentationMenu.id, 'enter')}
                      className="rounded-lg bg-blue-500/10 p-2 font-bold text-blue-500 outline-none focus:outline-none focus-visible:outline-none"
                    >
                      预览入场
                    </button>
                    <button
                      type="button"
                      onClick={() => replayScene(presentationMenu.id, 'exit')}
                      className="rounded-lg bg-rose-500/10 p-2 font-bold text-rose-500 outline-none focus:outline-none focus-visible:outline-none"
                    >
                      预览出场
                    </button>
                  </div>
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {(
                      [
                        ['cover', '覆盖裁切'],
                        ['contain', '完整显示'],
                        ['stretch', '拉伸填充'],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() =>
                          updateScene(presentationMenu.id, (item) => ({ ...item, cropMode: mode }))
                        }
                        className={`rounded-lg border p-2 text-xs font-bold ${
                          current.cropMode === mode
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-[var(--card-border)] bg-[var(--app-bg)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="mb-3 block">
                    <span className="mb-1 block font-bold">
                      缩放：{Math.round(current.scale * 100)}%
                    </span>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.05"
                      value={current.scale}
                      onChange={(event) =>
                        updateScene(presentationMenu.id, (item) => ({
                          ...item,
                          scale: Number(event.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </label>
                  {(['offsetX', 'offsetY'] as const).map((field) => (
                    <label key={field} className="mb-3 block">
                      <span className="mb-1 flex justify-between font-bold">
                        <span>{field === 'offsetX' ? '水平位置' : '垂直位置'}</span>
                        <span>{current[field]}</span>
                      </span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={current[field]}
                        onChange={(event) =>
                          updateScene(presentationMenu.id, (item) => ({
                            ...item,
                            [field]: Number(event.target.value),
                          }))
                        }
                        className="w-full"
                      />
                    </label>
                  ))}
                  {(['enter', 'exit'] as const).map((phase) => (
                    <div key={phase} className="mb-3 grid grid-cols-[1fr_90px] gap-2">
                      <label>
                        <span className="mb-1 block font-bold">
                          {phase === 'enter' ? '入场动画' : '出场动画'}
                        </span>
                        <select
                          value={current[phase].type}
                          onChange={(event) =>
                            updateScene(
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
                        <span className="mb-1 block font-bold">时长</span>
                        <div className="flex w-full items-center rounded-lg bg-[var(--app-bg)]">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={current[phase].duration}
                            onChange={(event) =>
                              updateScene(
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
                            className="min-w-0 flex-1 border-0 bg-transparent p-2 text-right outline-none focus:border-0 focus:outline-none focus-visible:outline-none"
                          />
                          <span className="pr-2 text-[10px] font-bold text-[var(--text-muted)]">
                            MS
                          </span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              );
            })()}
        </div>
      </aside>
    </div>
  );
}
