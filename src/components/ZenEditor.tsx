import {
  Bold,
  ClipboardPaste,
  Copy,
  Eraser,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Loader2,
  MapPin,
  Mic,
  Palette,
  Pause,
  Play,
  Save,
  SkipForward,
  Sparkles,
  Square,
  Trash2,
  Type,
  Underline,
  User,
  Volume2,
  Upload,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type {
  CharacterPresentation,
  InlinePresentationAction,
  PresentationAnimation,
  PresentationMotion,
  ScenePresentation,
  StoryAudioClip,
  StoryPresentation,
} from '../domain/project';
import { convertRecordingToMp3 } from '../lib/audioRecording';
import {
  clampCharacterLayer,
  copyCharacterPresentationSettings,
  copyScenePresentationSettings,
  createCharacterPresentation,
  createInlinePresentationAction,
  createScenePresentation,
  getCharacterStagePosition,
  getPresentationTransform,
  hasCharacterPresentationClipboard,
  hasScenePresentationClipboard,
  normalizeStoryPresentation,
  pasteCharacterPresentationSettings,
  pasteScenePresentationSettings,
} from '../lib/presentation';
import {
  inlineActionAnimation,
  inlineActionCssVars,
  inlineActionTransform,
} from '../lib/inlinePresentationPlayback';
import { InlineActionEditor } from './InlineActionEditor';
import { RichText, RichTextHandle } from './RichText';
import { DurationInput } from './DurationInput';
import { DraggableNumberInput } from './DraggableNumberInput';
import { VirtualPresentationStage } from './VirtualPresentationStage';

type ZenTag = {
  id: string;
  name: string;
  imageUrl?: string;
};

export function ZenEditor({
  nodeId,
  value,
  imageUrl,
  videoUrl,
  audioUrl,
  audioClips = [],
  characterTags = [],
  sceneTags = [],
  presentation,
  isAILoading = false,
  onAIGenerate,
  onGenerateImage,
  onGenerateAudio,
  onAudioClipsChange,
  onChange,
  onPresentationChange,
  onClose,
}: {
  nodeId: string;
  value: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  audioClips?: StoryAudioClip[];
  characterTags?: ZenTag[];
  sceneTags?: ZenTag[];
  presentation?: StoryPresentation;
  isAILoading?: boolean;
  onAIGenerate?: () => void;
  onGenerateImage?: () => Promise<void> | void;
  onGenerateAudio?: () => Promise<void> | void;
  onAudioClipsChange?: (clips: StoryAudioClip[]) => void;
  onChange: (v: string) => void;
  onPresentationChange?: (presentation: StoryPresentation) => void;
  onClose: () => void;
}) {
  const richTextRef = useRef<RichTextHandle>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [rightPanel, setRightPanel] = useState<'presentation' | 'audio'>('presentation');
  const [recordingState, setRecordingState] = useState<
    'idle' | 'recording' | 'paused' | 'encoding'
  >('idle');
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null);
  const [editingAudioName, setEditingAudioName] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformFrameRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const audioImportInputRef = useRef<HTMLInputElement>(null);
  const importedAudioUrlsRef = useRef<string[]>([]);
  const sceneVideoRef = useRef<HTMLVideoElement>(null);
  const sceneVideoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sceneVideoDuration, setSceneVideoDuration] = useState(0);
  const [waveformLevels, setWaveformLevels] = useState<number[]>(() => Array(24).fill(0.08));
  const [toolbarMenu, setToolbarMenu] = useState<'colors' | 'sizes' | null>(null);
  const [presentationMenu, setPresentationMenu] = useState<
    (ZenTag & { kind: 'character' | 'scene'; mentionId?: string; placement?: 'start' | 'end' | 'inline' }) | null
  >(null);
  const [preview, setPreview] = useState<{
    kind: 'character' | 'scene';
    sourceNodeId?: string;
    phase: 'enter' | 'exit';
    visible: boolean;
  } | null>(null);
  const [inlineActionPreview, setInlineActionPreview] = useState<{
    action: InlinePresentationAction;
    mode: 'before' | 'after';
    nonce: number;
  } | null>(null);
  const [autoPreviewInlineAction, setAutoPreviewInlineAction] = useState(true);
  const [autoPreviewPresentationMotion, setAutoPreviewPresentationMotion] = useState(true);
  const [presentationResetUndo, setPresentationResetUndo] = useState<{
    kind: 'character' | 'scene';
    sourceNodeId: string;
    value: CharacterPresentation | ScenePresentation;
  } | null>(null);
  const [, setPresentationClipboardVersion] = useState(0);

  const normalizedAudioClips: StoryAudioClip[] =
    audioClips.length > 0
      ? audioClips
      : audioUrl
        ? [
            {
              id: 'legacy-audio',
              name: '已有音频',
              url: audioUrl,
              source: 'imported',
              createdAt: 0,
            },
          ]
        : [];

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
      layer: number;
      videoStartTime?: number;
      videoEndTime?: number;
      videoLoop?: boolean;
      videoMaxDuration?: number;
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
    if (!presentationMenu || presentationMenu.placement === 'inline') return;
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
    if (!presentationMenu || presentationMenu.placement === 'inline') return;
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
  const sceneVideoStartTime = Math.max(0, normalizedPresentation.scene?.videoStartTime || 0);
  const sceneVideoEndTime =
    normalizedPresentation.scene?.videoEndTime &&
    normalizedPresentation.scene.videoEndTime > sceneVideoStartTime
      ? Math.min(normalizedPresentation.scene.videoEndTime, sceneVideoDuration || Infinity)
      : sceneVideoDuration;
  const sceneVideoMaxDuration = Math.max(0.1, normalizedPresentation.scene?.videoMaxDuration || 30);

  useEffect(() => {
    return () => {
      if (sceneVideoStopTimerRef.current) clearTimeout(sceneVideoStopTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const video = sceneVideoRef.current;
    if (!video || !videoUrl) return;
    video.currentTime = Math.min(sceneVideoStartTime, Math.max(0, video.duration || Infinity));
  }, [sceneVideoStartTime, videoUrl]);

  const stopSceneVideoTimer = () => {
    if (!sceneVideoStopTimerRef.current) return;
    clearTimeout(sceneVideoStopTimerRef.current);
    sceneVideoStopTimerRef.current = null;
  };

  const startSceneVideoTimer = () => {
    stopSceneVideoTimer();
    sceneVideoStopTimerRef.current = setTimeout(() => {
      sceneVideoRef.current?.pause();
      sceneVideoStopTimerRef.current = null;
    }, sceneVideoMaxDuration * 1000);
  };

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
    _phase: 'enter' | 'exit' = 'enter',
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
    if (!preserveResetUndo && autoPreviewPresentationMotion)
      replayCharacter(sourceNodeId, _phase, next[_phase]);
    if (!preserveResetUndo) setPresentationResetUndo(null);
  };

  const updateInlineAction = (action: InlinePresentationAction) => {
    onPresentationChange?.({
      ...normalizedPresentation,
      inlineActions: [
        ...(normalizedPresentation.inlineActions || []).filter((item) => item.id !== action.id),
        action,
      ],
    });
  };

  const deleteInlineAction = (actionId: string) => {
    onPresentationChange?.({
      ...normalizedPresentation,
      inlineActions: (normalizedPresentation.inlineActions || []).filter(
        (item) => item.id !== actionId,
      ),
    });
  };

  const deletePresentationTarget = (
    menu: NonNullable<typeof presentationMenu>,
  ) => {
    onPresentationChange?.(
      menu.kind === 'character'
        ? {
            ...normalizedPresentation,
            characters: normalizedPresentation.characters.filter(
              (item) => item.sourceNodeId !== menu.id,
            ),
          }
        : {
            ...normalizedPresentation,
            scene:
              normalizedPresentation.scene?.sourceNodeId === menu.id
                ? undefined
                : normalizedPresentation.scene,
          },
    );
    setPresentationResetUndo(null);
    setPresentationMenu(null);
  };

  const getInlineAction = (tag: ZenTag & { kind: 'character' | 'scene'; mentionId?: string }) => {
    const id = tag.mentionId || `${tag.kind}:${tag.id}`;
    return (
      normalizedPresentation.inlineActions?.find((item) => item.id === id) ||
      createInlinePresentationAction({
        id,
        kind: tag.kind,
        sourceNodeId: tag.id,
        name: tag.name,
      })
    );
  };

  const previewInlineAction = (action: InlinePresentationAction, mode: 'before' | 'after') => {
    setPreview(null);
    const nonce = Date.now();
    if (mode === 'after') {
      setInlineActionPreview({ action, mode: 'before', nonce });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setInlineActionPreview({ action, mode: 'after', nonce })),
      );
      return;
    }
    setInlineActionPreview({ action, mode, nonce });
  };

  const presentationPhaseForPlacement = (placement?: 'start' | 'end' | 'inline') =>
    placement === 'end' ? 'exit' : 'enter';

  const openCharacterMenu = (
    tag: ZenTag,
    options: { mentionId?: string; placement?: 'start' | 'end' | 'inline' } = {},
  ) => {
    if (!normalizedPresentation.characters.some((item) => item.sourceNodeId === tag.id)) {
      onPresentationChange?.({
        ...normalizedPresentation,
        characters: [...normalizedPresentation.characters, createCharacterPresentation(tag.id)],
      });
    }
    setPresentationMenu({ ...tag, kind: 'character', ...options });
    if (options.placement !== 'inline') replayCharacter(tag.id, presentationPhaseForPlacement(options.placement));
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
    _phase: 'enter' | 'exit' = 'enter',
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
    if (!preserveResetUndo && autoPreviewPresentationMotion)
      replayScene(sourceNodeId, _phase, next[_phase]);
    if (!preserveResetUndo) setPresentationResetUndo(null);
  };

  const openSceneMenu = (
    tag: ZenTag,
    options: { mentionId?: string; placement?: 'start' | 'end' | 'inline' } = {},
  ) => {
    if (normalizedPresentation.scene?.sourceNodeId !== tag.id) {
      onPresentationChange?.({
        ...normalizedPresentation,
        scene: createScenePresentation(tag.id, imageUrl),
      });
    }
    setPresentationMenu({ ...tag, kind: 'scene', ...options });
    if (options.placement !== 'inline') replayScene(tag.id, presentationPhaseForPlacement(options.placement));
  };

  const cardVideoMentionName = '卡片视频';
  const openCardVideoMenu = () => {
    openSceneMenu({ id: nodeId, name: cardVideoMentionName });
  };

  useEffect(() => {
    if (!presentationMenu) return;
    if (
      presentationMenu.kind === 'scene' &&
      videoUrl &&
      presentationMenu.id === nodeId
    ) {
      return;
    }
    const tags = presentationMenu.kind === 'character' ? characterTags : sceneTags;
    const latest = tags.find((tag) => tag.id === presentationMenu.id);
    if (!latest) setPresentationMenu(null);
  }, [characterTags, nodeId, sceneTags, presentationMenu, videoUrl]);

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

  const insertMention = (kind: 'character' | 'scene' | 'video', name: string) => {
    richTextRef.current?.insertMention(kind, name);
  };

  const insertCharacterMention = (tag: ZenTag) => {
    insertMention('character', tag.name);
    openCharacterMenu(tag);
  };

  const insertSceneMention = (tag: ZenTag) => {
    insertMention('scene', tag.name);
    openSceneMenu(tag);
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

  const handleGenerateAudio = async () => {
    if (!onGenerateAudio || isGeneratingAudio) return;
    setRightPanel('audio');
    setIsGeneratingAudio(true);
    try {
      await onGenerateAudio();
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const updateAudioClips = (clips: StoryAudioClip[]) => {
    onAudioClipsChange?.(clips);
  };

  const importAudioFiles = (files: FileList | File[]) => {
    if (!onAudioClipsChange) return;
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/'));
    if (audioFiles.length === 0) return;

    const clips = audioFiles.map((file) => {
      const url = URL.createObjectURL(file);
      importedAudioUrlsRef.current.push(url);
      return {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, '') || '导入音频',
        url,
        source: 'imported' as const,
        createdAt: Date.now(),
      };
    });

    updateAudioClips([...normalizedAudioClips, ...clips]);
  };

  const stopRecordingTracks = () => {
    if (waveformFrameRef.current !== null) {
      cancelAnimationFrame(waveformFrameRef.current);
      waveformFrameRef.current = null;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setWaveformLevels(Array(24).fill(0.08));
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const startWaveformAnalysis = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      const drawWaveform = () => {
        analyser.getByteFrequencyData(frequencyData);
        const bars = 24;
        const bucketSize = Math.max(1, Math.floor(frequencyData.length / bars));
        const levels = Array.from({ length: bars }, (_, index) => {
          let total = 0;
          const start = index * bucketSize;
          const end = Math.min(frequencyData.length, start + bucketSize);
          for (let cursor = start; cursor < end; cursor += 1) total += frequencyData[cursor];
          const average = total / Math.max(1, end - start);
          return Math.max(0.08, Math.min(1, average / 150));
        });
        setWaveformLevels(levels);
        waveformFrameRef.current = requestAnimationFrame(drawWaveform);
      };
      drawWaveform();
    } catch (error) {
      console.warn('Microphone waveform is unavailable:', error);
    }
  };

  const startRecording = async () => {
    if (!onAudioClipsChange || recordingState !== 'idle') return;
    setRightPanel('audio');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      startWaveformAnalysis(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const recording = new Blob(recordingChunksRef.current, {
          type: mimeType || recorder.mimeType || 'audio/webm',
        });
        recordingChunksRef.current = [];
        recorderRef.current = null;
        stopRecordingTracks();
        if (recording.size === 0) {
          setRecordingState('idle');
          return;
        }

        setRecordingState('encoding');
        try {
          const mp3 = await convertRecordingToMp3(recording);
          const clip: StoryAudioClip = {
            id: crypto.randomUUID(),
            name: `录音 ${new Date().toLocaleTimeString()}`,
            url: URL.createObjectURL(mp3),
            source: 'recording',
            createdAt: Date.now(),
          };
          updateAudioClips([...normalizedAudioClips, clip]);
          setActiveAudioId(clip.id);
        } catch (error) {
          console.error('Failed to encode recording as MP3:', error);
          alert('录音转 MP3 失败，请重试。');
        } finally {
          setRecordingState('idle');
        }
      };
      recorder.start(250);
      setRecordingState('recording');
    } catch (error) {
      stopRecordingTracks();
      setRecordingState('idle');
      const message = error instanceof Error ? error.message : '无法打开麦克风';
      alert(`无法开始录音：${message}`);
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const toggleRecordingPause = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      void audioContextRef.current?.suspend();
      setRecordingState('paused');
    } else if (recorder.state === 'paused') {
      recorder.resume();
      void audioContextRef.current?.resume();
      setRecordingState('recording');
    }
  };

  const playableAudioClips = normalizedAudioClips.filter((clip) => !clip.skipped);
  const activeAudioClip =
    normalizedAudioClips.find((clip) => clip.id === activeAudioId) || playableAudioClips[0];

  const playClip = (clip: StoryAudioClip) => {
    setActiveAudioId(clip.id);
    window.setTimeout(() => {
      audioPlayerRef.current?.play().catch(() => setIsAudioPlaying(false));
    }, 0);
  };

  const toggleClipPlayback = (clip: StoryAudioClip) => {
    if (activeAudioClip?.id === clip.id && isAudioPlaying) {
      audioPlayerRef.current?.pause();
      return;
    }
    playClip(clip);
  };

  const playNextClip = () => {
    if (!activeAudioClip) return;
    const currentIndex = normalizedAudioClips.findIndex((clip) => clip.id === activeAudioClip.id);
    const next = normalizedAudioClips.slice(currentIndex + 1).find((clip) => !clip.skipped);
    if (next) playClip(next);
    else setIsAudioPlaying(false);
  };

  const toggleClipSkipped = (clipId: string) => {
    const nextClips = normalizedAudioClips.map((clip) =>
      clip.id === clipId ? { ...clip, skipped: !clip.skipped } : clip,
    );
    updateAudioClips(nextClips);
    if (activeAudioClip?.id === clipId) {
      audioPlayerRef.current?.pause();
      setIsAudioPlaying(false);
    }
  };

  const deleteClip = (clipId: string) => {
    const nextClips = normalizedAudioClips.filter((clip) => clip.id !== clipId);
    if (activeAudioClip?.id === clipId) {
      audioPlayerRef.current?.pause();
      setActiveAudioId(nextClips.find((clip) => !clip.skipped)?.id || null);
      setIsAudioPlaying(false);
    }
    updateAudioClips(nextClips);
  };

  const startRenamingClip = (clip: StoryAudioClip) => {
    setEditingAudioId(clip.id);
    setEditingAudioName(clip.name);
  };

  const finishRenamingClip = () => {
    if (!editingAudioId) return;
    const name = editingAudioName.trim();
    if (name) {
      updateAudioClips(
        normalizedAudioClips.map((clip) => (clip.id === editingAudioId ? { ...clip, name } : clip)),
      );
    }
    setEditingAudioId(null);
    setEditingAudioName('');
  };

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stopRecordingTracks();
      audioPlayerRef.current?.pause();
      importedAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      importedAudioUrlsRef.current = [];
    },
    [],
  );

  const colors = ['#1e293b', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const sizes = [
    { label: 'S', val: '2' },
    { label: 'M', val: '4' },
    { label: 'L', val: '6' },
  ];

  const inlinePreviewTransformFor = (kind: 'character' | 'scene', sourceNodeId?: string) =>
    inlineActionPreview?.mode === 'after' &&
    inlineActionPreview.action.kind === kind &&
    inlineActionPreview.action.sourceNodeId === sourceNodeId
      ? inlineActionTransform(inlineActionPreview.action)
      : '';

  const inlinePreviewDurationFor = (kind: 'character' | 'scene', sourceNodeId?: string) =>
    inlineActionPreview?.action.kind === kind && inlineActionPreview.action.sourceNodeId === sourceNodeId
      ? Math.max(80, inlineActionPreview.action.duration || 300)
      : 0;

  const inlinePreviewAnimationFor = (kind: 'character' | 'scene', sourceNodeId?: string) =>
    inlineActionPreview?.mode === 'after' &&
    inlineActionPreview.action.kind === kind &&
    inlineActionPreview.action.sourceNodeId === sourceNodeId
      ? inlineActionAnimation(inlineActionPreview.action)
      : undefined;

  const inlinePreviewCssVarsFor = (kind: 'character' | 'scene', sourceNodeId?: string) =>
    inlineActionPreview?.action.kind === kind && inlineActionPreview.action.sourceNodeId === sourceNodeId
      ? inlineActionCssVars(inlineActionPreview.action)
      : {};

  const inlinePreviewNonceFor = (kind: 'character' | 'scene', sourceNodeId?: string) =>
    inlineActionPreview?.action.kind === kind && inlineActionPreview.action.sourceNodeId === sourceNodeId
      ? inlineActionPreview.nonce
      : 0;

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
              onClick={() => {
                setRightPanel('audio');
                if (recordingState === 'recording' || recordingState === 'paused') {
                  stopRecording();
                } else {
                  void startRecording();
                }
              }}
              disabled={!onAudioClipsChange || recordingState === 'encoding'}
              className={`rounded-lg p-3 hover:bg-[var(--card-bg)] disabled:cursor-not-allowed disabled:opacity-50 ${
                recordingState === 'recording' || recordingState === 'paused'
                  ? 'bg-rose-500/10 text-rose-500'
                  : 'text-rose-500'
              }`}
              title={
                recordingState === 'recording' || recordingState === 'paused'
                  ? '停止录音'
                  : recordingState === 'encoding'
                    ? '正在生成 MP3'
                    : '声音录制'
              }
            >
              {recordingState === 'encoding' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : recordingState === 'recording' || recordingState === 'paused' ? (
                <Square className="h-5 w-5 fill-current" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={handleGenerateAudio}
              disabled={!onGenerateAudio || isGeneratingAudio}
              className="rounded-lg p-3 text-sky-500 hover:bg-[var(--card-bg)] disabled:cursor-not-allowed disabled:opacity-50"
              title="文字转音频"
            >
              {isGeneratingAudio ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Volume2 className="h-5 w-5" />
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
            {(characterTags.length > 0 || sceneTags.length > 0 || videoUrl) && (
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
                        onClick={() => insertCharacterMention(tag)}
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
                        onClick={() => insertSceneMention(tag)}
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
                {videoUrl && (
                  <div className="flex flex-wrap items-center gap-1">
                    <MapPin className="w-4 h-4 text-[var(--text-muted)] mx-1 shrink-0" />
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertMention('video', cardVideoMentionName)}
                      className="select-none px-2 py-1 rounded-md text-xs font-bold bg-blue-800/10 text-blue-700 hover:bg-blue-800/20 border border-blue-800/20 dark:text-blue-300"
                      title={`插入 @${cardVideoMentionName}`}
                    >
                      @{cardVideoMentionName}
                    </button>
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
              {(imageUrl || videoUrl || normalizedPresentation.characters.length > 0) && (
                <div className="absolute inset-0">
                  <VirtualPresentationStage className="h-full w-full">
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{
                        transform: `scale(${normalizedPresentation.scene?.scale || 1})`,
                        transformOrigin: 'center',
                      }}
                    >
                      {(imageUrl || videoUrl) &&
                        (() => {
                          const scene = normalizedPresentation.scene;
                          const previewMatches =
                            Boolean(scene) &&
                            preview?.kind === 'scene' &&
                            preview.sourceNodeId === scene?.sourceNodeId;
                          const phase = previewMatches ? preview?.phase || 'enter' : 'enter';
                          const motion = scene?.[phase];
                          const animated = previewMatches && !preview?.visible;
                          const mediaStyle: React.CSSProperties = {
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
                            transform:
                              [
                                animated && motion
                                  ? getPresentationTransform(motion.type, phase === 'exit')
                                  : '',
                                inlinePreviewTransformFor('scene', scene?.sourceNodeId),
                              ]
                                .filter(Boolean)
                                .join(' ') || 'none',
                            transitionProperty: 'opacity, transform',
                            transitionDuration: `${
                              previewMatches
                                ? motion?.duration || 0
                                : inlinePreviewDurationFor('scene', scene?.sourceNodeId)
                            }ms`,
                            transitionTimingFunction: 'ease-out',
                            zIndex: scene ? clampCharacterLayer(scene.layer) : 0,
                            animation: inlinePreviewAnimationFor('scene', scene?.sourceNodeId),
                            ...inlinePreviewCssVarsFor('scene', scene?.sourceNodeId),
                          };
                          return imageUrl ? (
                            <img
                              key={`scene-preview-${inlinePreviewNonceFor('scene', scene?.sourceNodeId)}`}
                              src={imageUrl}
                              draggable={false}
                              onDragStart={(event) => event.preventDefault()}
                              className="preview-media-safe absolute inset-0 h-full w-full"
                              style={mediaStyle}
                              alt=""
                            />
                          ) : (
                            <video
                              key={`scene-preview-${inlinePreviewNonceFor('scene', scene?.sourceNodeId)}`}
                              ref={sceneVideoRef}
                              src={videoUrl}
                              controls
                              playsInline
                              className="absolute inset-0 h-full w-full"
                              style={mediaStyle}
                              onLoadedMetadata={(event) => {
                                const duration = Number.isFinite(event.currentTarget.duration)
                                  ? event.currentTarget.duration
                                  : 0;
                                setSceneVideoDuration(duration);
                                event.currentTarget.currentTime = Math.min(
                                  sceneVideoStartTime,
                                  duration,
                                );
                              }}
                              onPlay={startSceneVideoTimer}
                              onPause={stopSceneVideoTimer}
                              onEnded={stopSceneVideoTimer}
                              onTimeUpdate={(event) => {
                                const video = event.currentTarget;
                                if (!sceneVideoEndTime || video.currentTime < sceneVideoEndTime)
                                  return;
                                if (normalizedPresentation.scene?.videoLoop) {
                                  video.currentTime = Math.min(
                                    sceneVideoStartTime,
                                    Math.max(0, video.duration || sceneVideoStartTime),
                                  );
                                  void video.play();
                                } else {
                                  video.pause();
                                  video.currentTime = sceneVideoEndTime;
                                }
                              }}
                            />
                          );
                        })()}
                      {normalizedPresentation.characters.map((config) => {
                        const tag = characterTags.find(
                          (character) => character.id === config.sourceNodeId && character.imageUrl,
                        );
                        if (!tag?.imageUrl) return null;
                        const previewMatches =
                          preview?.kind === 'character' &&
                          preview.sourceNodeId === config.sourceNodeId;
                        const phase = previewMatches ? preview.phase : 'enter';
                        const motion = config[phase];
                        const animated = previewMatches && !preview.visible;
                        return (
                          <img
                            key={`${config.sourceNodeId}-${inlinePreviewNonceFor(
                              'character',
                              config.sourceNodeId,
                            )}`}
                            src={tag.imageUrl}
                            alt={tag.name}
                            draggable={false}
                            onDragStart={(event) => event.preventDefault()}
                            className="preview-media-safe absolute max-h-[92%] max-w-[72%] w-auto object-contain object-bottom"
                            style={{
                              ...getCharacterStagePosition(config),
                              zIndex: clampCharacterLayer(config.layer),
                              opacity: animated && motion.type === 'fade' ? 0 : 1,
                              transform: `translate(-50%, 0) ${
                                animated
                                  ? getPresentationTransform(motion.type, phase === 'exit')
                                  : ''
                              } scale(${config.scale}) scaleX(${config.flipX ? -1 : 1}) ${inlinePreviewTransformFor(
                                'character',
                                config.sourceNodeId,
                              )}`,
                              transformOrigin: 'center center',
                              transition:
                                previewMatches && motion.type !== 'none' && motion.duration > 0
                                  ? `transform ${motion.duration}ms ease, opacity ${motion.duration}ms ease`
                                  : inlinePreviewDurationFor('character', config.sourceNodeId)
                                    ? `transform ${inlinePreviewDurationFor('character', config.sourceNodeId)}ms ease`
                                  : undefined,
                              animation: inlinePreviewAnimationFor('character', config.sourceNodeId),
                              ...inlinePreviewCssVarsFor('character', config.sourceNodeId),
                            }}
                          />
                        );
                      })}
                    </div>
                  </VirtualPresentationStage>
                </div>
              )}
            </div>
          )}
          <div className="h-48 shrink-0 bg-[var(--card-bg)] p-8 overflow-y-auto">
            <RichText
              ref={richTextRef}
              value={value}
              onChange={onChange}
              onMentionContextMenu={(event, mention) => {
                if (mention.kind === 'video') return;
                const tags = mention.kind === 'character' ? characterTags : sceneTags;
                const tag = tags.find((item) => item.name === mention.name);
                if (!tag) return;
                const options = { mentionId: mention.id, placement: mention.placement };
                if (mention.kind === 'character') openCharacterMenu(tag, options);
                else openSceneMenu(tag, options);
              }}
              className="w-full min-h-full text-lg md:text-xl leading-[1.8] text-[var(--text-primary)] font-serif break-words focus:outline-none"
            />
          </div>
        </div>
      </main>
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
          <div className="flex rounded-xl bg-[var(--app-bg)] p-1">
            <button
              type="button"
              onClick={() => setRightPanel('presentation')}
              className={`rounded-lg px-3 py-2 text-xs font-black ${
                rightPanel === 'presentation'
                  ? 'bg-[var(--card-bg)] text-indigo-500 shadow-sm'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              演出设置
            </button>
            <button
              type="button"
              onClick={() => setRightPanel('audio')}
              className={`rounded-lg px-3 py-2 text-xs font-black ${
                rightPanel === 'audio'
                  ? 'bg-[var(--card-bg)] text-sky-500 shadow-sm'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              音频列表
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-5 py-2.5 text-sm font-black text-rose-500 shadow-sm hover:bg-rose-500 hover:text-white"
          >
            退出专注
          </button>
        </div>
        <div
          className={`space-y-2 border-b border-[var(--card-border)] p-3 ${
            rightPanel === 'audio' ? 'hidden' : ''
          }`}
        >
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex shrink-0 items-center gap-1.5 text-sm font-black text-indigo-500">
              <User className="h-5 w-5" />
              人物演出
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {characterTags.length ? (
                characterTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertCharacterMention(tag)}
                    className={`max-w-36 truncate rounded-lg px-3 py-2 text-left text-sm font-bold ${
                      presentationMenu?.kind === 'character' && presentationMenu.id === tag.id
                        ? 'bg-indigo-500 text-white'
                        : 'bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20'
                    }`}
                    title={`切换到${tag.name}的人物演出设置`}
                  >
                    {tag.name}
                  </button>
                ))
              ) : (
                <div className="text-[11px] text-[var(--text-muted)]">无人物</div>
              )}
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex shrink-0 items-center gap-1.5 text-sm font-black text-blue-500">
              <MapPin className="h-5 w-5" />
              场景演出
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {sceneTags.length || videoUrl ? (
                <>
                  {videoUrl && (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={openCardVideoMenu}
                      className={`max-w-36 truncate rounded-lg px-3 py-2 text-left text-sm font-bold ${
                        presentationMenu?.kind === 'scene' && presentationMenu.id === nodeId
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
                      }`}
                      title="切换到卡片视频的场景演出设置"
                    >
                      {cardVideoMentionName}
                    </button>
                  )}
                  {sceneTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertSceneMention(tag)}
                      className={`max-w-36 truncate rounded-lg px-3 py-2 text-left text-sm font-bold ${
                        presentationMenu?.kind === 'scene' && presentationMenu.id === tag.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
                      }`}
                      title={`切换到${tag.name}的场景演出设置`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </>
              ) : (
                <div className="text-[11px] text-[var(--text-muted)]">无场景</div>
              )}
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {rightPanel === 'presentation' &&
            presentationMenu?.placement === 'inline' &&
            (() => {
              const action = getInlineAction(presentationMenu);
              const currentCharacter =
                presentationMenu.kind === 'character'
                  ? normalizedPresentation.characters.find(
                      (item) => item.sourceNodeId === presentationMenu.id,
                    ) || createCharacterPresentation(presentationMenu.id)
                  : null;
              return (
                <div className="space-y-3">
                  <InlineActionEditor
                    action={action}
                    targetName={presentationMenu.name}
                    targetKind={presentationMenu.kind}
                    onChange={updateInlineAction}
                    onDelete={() => {
                      deleteInlineAction(action.id);
                      setPresentationMenu(null);
                    }}
                    onReset={() =>
                      updateInlineAction(
                        createInlinePresentationAction({
                          id: action.id,
                          kind: action.kind,
                          sourceNodeId: action.sourceNodeId,
                          name: action.name,
                        }),
                      )
                    }
                    onPreviewBefore={(nextAction) => previewInlineAction(nextAction, 'before')}
                    onPreviewAfter={(nextAction) => previewInlineAction(nextAction, 'after')}
                    autoPreview={autoPreviewInlineAction}
                    onAutoPreviewChange={setAutoPreviewInlineAction}
                  />
                  {currentCharacter && (
                    <div className="flex items-center gap-2 text-xs">
                      <label className="flex items-center gap-2">
                        <span className="shrink-0 font-bold">Z轴</span>
                        <div className="w-20">
                          <DraggableNumberInput
                            value={clampCharacterLayer(currentCharacter.layer)}
                            min={1}
                            max={20}
                            unit={null}
                            onChange={(value) =>
                              updateCharacter(presentationMenu.id, (item) => ({
                                ...item,
                                layer: clampCharacterLayer(value),
                              }))
                            }
                          />
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              );
            })()}
          {rightPanel === 'presentation' &&
            presentationMenu?.placement !== 'inline' &&
            presentationMenu?.kind === 'character' &&
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
              const activePhase = presentationPhaseForPlacement(presentationMenu.placement);
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
                      const phase = presentationPhaseForPlacement(presentationMenu.placement);
                      updateCharacter(
                        presentationMenu.id,
                        (current) => ({
                          ...current,
                          [phase]: { type: 'none', duration: 0 },
                        }),
                        phase,
                        true,
                      );
                    }}
                    className={`absolute right-8 top-0 rounded-md border p-1.5 transition-colors ${
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
                    <Eraser className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePresentationTarget(presentationMenu)}
                    className="absolute right-0 top-0 rounded-md border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-500 transition-colors hover:bg-rose-500 hover:text-white"
                    title="删除这个 tag 的演出"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <label className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-bold">Z轴</span>
                      <div className="w-20">
                        <DraggableNumberInput
                          value={clampCharacterLayer(current.layer)}
                          min={1}
                          max={20}
                          unit={null}
                          onChange={(value) =>
                            updateCharacter(presentationMenu.id, (item) => ({
                              ...item,
                              layer: clampCharacterLayer(value),
                            }))
                          }
                        />
                      </div>
                    </label>
                    <label
                      className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 font-bold ${
                        activePhase === 'enter'
                          ? '!bg-emerald-500/10 !text-emerald-600'
                          : '!bg-rose-500/10 !text-rose-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={autoPreviewPresentationMotion}
                        onChange={(event) => setAutoPreviewPresentationMotion(event.target.checked)}
                        className={`h-4 w-4 ${
                          activePhase === 'enter' ? 'accent-emerald-500' : 'accent-rose-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => replayCharacter(presentationMenu.id, activePhase)}
                        className="flex items-center gap-1.5 outline-none focus:outline-none focus-visible:outline-none"
                      >
                        {activePhase === 'enter' ? '预览入场' : '预览出场'}
                      </button>
                    </label>
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
                  <div className="mb-3 flex items-center gap-2">
                    <span className="shrink-0 font-bold">水平偏移</span>
                    <div className="min-w-0 flex-1">
                      <DraggableNumberInput
                        value={current.offsetX}
                        min={-500}
                        max={500}
                        onChange={(value) =>
                          updateCharacter(presentationMenu.id, (item) => ({
                            ...item,
                            offsetX: value,
                          }))
                        }
                      />
                    </div>
                    <span className="shrink-0 font-bold">垂直偏移</span>
                    <div className="min-w-0 flex-1">
                      <DraggableNumberInput
                        value={current.offsetY}
                        min={-500}
                        max={500}
                        onChange={(value) =>
                          updateCharacter(presentationMenu.id, (item) => ({
                            ...item,
                            offsetY: value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <label className="mb-3 flex items-center gap-2">
                    <span className="shrink-0 font-bold">
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
                      className="min-w-0 flex-1"
                    />
                  </label>
                  {([activePhase] as const).map((phase) => (
                    <div key={phase} className="mb-3 flex items-center gap-2">
                      <span className="shrink-0 font-bold">
                        {phase === 'enter' ? '入场动画' : '出场动画'}
                      </span>
                      <label className="min-w-0 flex-1">
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
                      <span className="shrink-0 font-bold">时长</span>
                      <label className="w-[72px] shrink-0">
                        <DurationInput
                          value={current[phase].duration}
                          onChange={(duration) =>
                            updateCharacter(
                              presentationMenu.id,
                              (item) => ({
                                ...item,
                                [phase]: {
                                  ...item[phase],
                                  duration,
                                },
                              }),
                              phase,
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              );
            })()}
          {rightPanel === 'presentation' &&
            presentationMenu?.placement !== 'inline' &&
            presentationMenu?.kind === 'scene' &&
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
              const activePhase = presentationPhaseForPlacement(presentationMenu.placement);
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
                      const phase = presentationPhaseForPlacement(presentationMenu.placement);
                      updateScene(
                        presentationMenu.id,
                        (item) => ({
                          ...item,
                          [phase]: { type: 'none', duration: 0 },
                        }),
                        phase,
                        true,
                      );
                    }}
                    className={`absolute right-8 top-0 rounded-md border p-1.5 transition-colors ${
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
                    <Eraser className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePresentationTarget(presentationMenu)}
                    className="absolute right-0 top-0 rounded-md border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-500 transition-colors hover:bg-rose-500 hover:text-white"
                    title="删除这个 tag 的演出"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <label className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-bold">Z轴</span>
                      <div className="w-20">
                        <DraggableNumberInput
                          value={clampCharacterLayer(current.layer)}
                          min={1}
                          max={20}
                          unit={null}
                          onChange={(value) =>
                            updateScene(presentationMenu.id, (item) => ({
                              ...item,
                              layer: clampCharacterLayer(value),
                            }))
                          }
                        />
                      </div>
                    </label>
                    <label
                      className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 font-bold ${
                        activePhase === 'enter'
                          ? '!bg-emerald-500/10 !text-emerald-600'
                          : '!bg-rose-500/10 !text-rose-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={autoPreviewPresentationMotion}
                        onChange={(event) => setAutoPreviewPresentationMotion(event.target.checked)}
                        className={`h-4 w-4 ${
                          activePhase === 'enter' ? 'accent-emerald-500' : 'accent-rose-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => replayScene(presentationMenu.id, activePhase)}
                        className="flex items-center gap-1.5 outline-none focus:outline-none focus-visible:outline-none"
                      >
                        {activePhase === 'enter' ? '预览入场' : '预览出场'}
                      </button>
                    </label>
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
                  {videoUrl && (
                    <div className="mb-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <strong className="text-blue-500">视频播放范围</strong>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          视频总长 {sceneVideoDuration.toFixed(1)} 秒
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-xs font-bold">开始时间</span>
                        <div className="min-w-0 flex-1">
                          <DurationInput
                            value={current.videoStartTime || 0}
                            step={0.1}
                            min={0}
                            max={Math.max(0, sceneVideoDuration)}
                            unit="S"
                            decimals={1}
                            onChange={(start) => {
                              updateScene(presentationMenu.id, (item) => ({
                                ...item,
                                videoStartTime: start,
                                videoEndTime:
                                  item.videoEndTime && item.videoEndTime > start
                                    ? item.videoEndTime
                                    : undefined,
                              }));
                            }}
                          />
                        </div>
                        <span className="shrink-0 text-xs font-bold">结束时间</span>
                        <div className="min-w-0 flex-1">
                          <DurationInput
                            value={current.videoEndTime ?? sceneVideoDuration}
                            step={0.1}
                            min={current.videoStartTime || 0}
                            max={Math.max(0, sceneVideoDuration)}
                            unit="S"
                            decimals={1}
                            onChange={(end) =>
                              updateScene(presentationMenu.id, (item) => ({
                                ...item,
                                videoEndTime: Math.max(item.videoStartTime || 0, end),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex h-9 shrink-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(current.videoLoop)}
                            onChange={(event) =>
                              updateScene(presentationMenu.id, (item) => ({
                                ...item,
                                videoLoop: event.target.checked,
                              }))
                            }
                            className="h-4 w-4"
                          />
                          <span className="font-bold">循环播放</span>
                        </label>
                        {current.videoLoop && (
                          <>
                            <span className="shrink-0 text-xs font-bold">持续时间</span>
                            <div className="min-w-0 flex-1">
                              <DurationInput
                                value={current.videoMaxDuration || 30}
                                step={0.5}
                                min={0.5}
                                unit="S"
                                decimals={1}
                                onChange={(duration) =>
                                  updateScene(presentationMenu.id, (item) => ({
                                    ...item,
                                    videoMaxDuration: duration,
                                  }))
                                }
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  <label className="mb-3 flex items-center gap-2">
                    <span className="shrink-0 font-bold">
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
                      className="min-w-0 flex-1"
                    />
                  </label>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="shrink-0 font-bold">水平偏移</span>
                    <div className="min-w-0 flex-1">
                      <DraggableNumberInput
                        value={current.offsetX}
                        min={-100}
                        max={100}
                        onChange={(value) =>
                          updateScene(presentationMenu.id, (item) => ({
                            ...item,
                            offsetX: value,
                          }))
                        }
                      />
                    </div>
                    <span className="shrink-0 font-bold">垂直偏移</span>
                    <div className="min-w-0 flex-1">
                      <DraggableNumberInput
                        value={current.offsetY}
                        min={-100}
                        max={100}
                        onChange={(value) =>
                          updateScene(presentationMenu.id, (item) => ({
                            ...item,
                            offsetY: value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  {([activePhase] as const).map((phase) => (
                    <div key={phase} className="mb-3 flex items-center gap-2">
                      <span className="shrink-0 font-bold">
                        {phase === 'enter' ? '入场动画' : '出场动画'}
                      </span>
                      <label className="min-w-0 flex-1">
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
                      <span className="shrink-0 font-bold">时长</span>
                      <label className="w-[72px] shrink-0">
                        <DurationInput
                          value={current[phase].duration}
                          onChange={(duration) =>
                            updateScene(
                              presentationMenu.id,
                              (item) => ({
                                ...item,
                                [phase]: {
                                  ...item[phase],
                                  duration,
                                },
                              }),
                              phase,
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              );
            })()}
          {rightPanel === 'audio' && (
            <div className="space-y-4 text-sm text-[var(--text-primary)]">
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <strong>录音控制</strong>
                  <span className="text-xs font-bold text-[var(--text-muted)]">
                    {recordingState === 'recording'
                      ? '正在录音'
                      : recordingState === 'paused'
                        ? '已暂停'
                        : recordingState === 'encoding'
                          ? '正在生成 MP3'
                          : '未录音'}
                  </span>
                </div>
                <div
                  className={`mb-3 flex h-16 items-center justify-center gap-1 rounded-xl border px-3 transition-colors ${
                    recordingState === 'recording'
                      ? 'border-rose-500/30 bg-rose-500/10'
                      : recordingState === 'paused'
                        ? 'border-amber-500/30 bg-amber-500/10 opacity-60'
                        : 'border-[var(--card-border)] bg-[var(--app-bg)]'
                  }`}
                  aria-label={
                    recordingState === 'recording' ? '正在接收麦克风声音' : '麦克风音量波形'
                  }
                >
                  {waveformLevels.map((level, index) => (
                    <span
                      key={index}
                      className={`w-1 rounded-full transition-[height,background-color] duration-75 ${
                        recordingState === 'recording'
                          ? 'bg-rose-500'
                          : recordingState === 'paused'
                            ? 'bg-amber-500'
                            : 'bg-[var(--text-muted)]/30'
                      }`}
                      style={{
                        height:
                          recordingState === 'recording' || recordingState === 'paused'
                            ? `${Math.max(5, level * 48)}px`
                            : `${5 + ((index * 7) % 12)}px`,
                      }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (recordingState === 'recording' || recordingState === 'paused') {
                        stopRecording();
                      } else {
                        void startRecording();
                      }
                    }}
                    disabled={!onAudioClipsChange || recordingState === 'encoding'}
                    className="flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 py-2 font-bold text-white disabled:opacity-50"
                  >
                    {recordingState === 'recording' || recordingState === 'paused' ? (
                      <>
                        <Square className="h-4 w-4 fill-current" />
                        停止录音
                      </>
                    ) : recordingState === 'encoding' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        生成 MP3
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" />
                        开始录音
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={toggleRecordingPause}
                    disabled={recordingState !== 'recording' && recordingState !== 'paused'}
                    className="flex items-center justify-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] px-3 py-2 font-bold disabled:opacity-40"
                  >
                    {recordingState === 'paused' ? (
                      <>
                        <Play className="h-4 w-4" />
                        继续录音
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4" />
                        暂停录音
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <strong>音频播放列表</strong>
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                    顺序播放 · 跳过已标记音频
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={audioImportInputRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files;
                      if (files && files.length > 0) importAudioFiles(files);
                      event.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => audioImportInputRef.current?.click()}
                    disabled={!onAudioClipsChange}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] px-3 py-2 text-xs font-black disabled:opacity-40"
                  >
                    <Upload className="h-4 w-4" />
                    上传
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const first = playableAudioClips[0];
                      if (first) playClip(first);
                    }}
                    disabled={playableAudioClips.length === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                  >
                    <Play className="h-4 w-4" />
                    顺序播放
                  </button>
                </div>
              </div>

              {activeAudioClip && (
                <audio
                  ref={audioPlayerRef}
                  src={activeAudioClip.url}
                  controls
                  preload="metadata"
                  onPlay={() => setIsAudioPlaying(true)}
                  onPause={() => setIsAudioPlaying(false)}
                  onEnded={playNextClip}
                  className="h-10 w-full"
                />
              )}

              <div className="space-y-2">
                {normalizedAudioClips.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--card-border)] p-6 text-center text-xs text-[var(--text-muted)]">
                    暂无音频。可使用左侧的录音、文字转音频或上方上传按钮添加。
                  </div>
                ) : (
                  normalizedAudioClips.map((clip, index) => {
                    const active = activeAudioClip?.id === clip.id;
                    return (
                      <div
                        key={clip.id}
                        className={`rounded-xl border p-3 ${
                          active
                            ? 'border-sky-500/50 bg-sky-500/10'
                            : 'border-[var(--card-border)] bg-[var(--app-bg)]'
                        } ${clip.skipped ? 'opacity-55' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleClipPlayback(clip)}
                            disabled={clip.skipped}
                            className="rounded-lg bg-sky-500/10 p-2 text-sky-500 disabled:opacity-40"
                            title={active && isAudioPlaying ? '暂停' : '播放'}
                          >
                            {active && isAudioPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            {editingAudioId === clip.id ? (
                              <input
                                autoFocus
                                value={editingAudioName}
                                onChange={(event) => setEditingAudioName(event.target.value)}
                                onBlur={finishRenamingClip}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') finishRenamingClip();
                                  if (event.key === 'Escape') {
                                    setEditingAudioId(null);
                                    setEditingAudioName('');
                                  }
                                }}
                                className="w-full rounded border border-sky-500/40 bg-[var(--card-bg)] px-2 py-1 font-bold outline-none"
                                aria-label="重命名音频"
                              />
                            ) : (
                              <div
                                className="truncate font-bold"
                                onDoubleClick={() => startRenamingClip(clip)}
                                title="双击重命名"
                              >
                                {index + 1}. {clip.name}
                              </div>
                            )}
                            <div className="text-[10px] uppercase text-[var(--text-muted)]">
                              {clip.source === 'recording'
                                ? 'MP3 录音'
                                : clip.source === 'tts'
                                  ? '文字转音频'
                                  : '已有音频'}
                              {clip.skipped ? ' · 已跳过' : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleClipSkipped(clip.id)}
                            className={`rounded-lg p-2 ${
                              clip.skipped
                                ? 'bg-amber-500 text-white'
                                : 'bg-amber-500/10 text-amber-500'
                            }`}
                            title={clip.skipped ? '恢复播放' : '播放时跳过'}
                          >
                            <SkipForward className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteClip(clip.id)}
                            className="rounded-lg bg-rose-500/10 p-2 text-rose-500"
                            title="删除音频"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
