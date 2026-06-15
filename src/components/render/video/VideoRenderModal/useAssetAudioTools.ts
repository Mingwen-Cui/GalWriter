import type { Node as FlowNode } from '@xyflow/react';
import type { ChangeEvent, Dispatch, DragEvent, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';

import { generateSpeechAudio, type TTSConfig } from '../../../../lib/tts';
import { getUploadedAssetKind, isInternalGalWriterDrag } from './uploadedAssets';

export const useAssetAudioTools = ({
  isZh,
  selectedSpeechNodes,
  getSpeechTextForNode,
  voiceTtsConfig,
  audioTrackIds,
  setUploadedAssetNodes,
  setAssetRegionFilter,
  setActivePreviewId,
  setAudioTrackByNodeId,
  setError,
  closeContextMenu,
}: {
  isZh: boolean;
  selectedSpeechNodes: FlowNode[];
  getSpeechTextForNode: (node: FlowNode) => string;
  voiceTtsConfig?: TTSConfig;
  audioTrackIds: string[];
  setUploadedAssetNodes: Dispatch<SetStateAction<FlowNode[]>>;
  setAssetRegionFilter: Dispatch<SetStateAction<string>>;
  setActivePreviewId: Dispatch<SetStateAction<string>>;
  setAudioTrackByNodeId: Dispatch<SetStateAction<Record<string, string>>>;
  setError: Dispatch<SetStateAction<string>>;
  closeContextMenu: () => void;
}) => {
  const [audioMessage, setAudioMessage] = useState('');
  const [audioBusy, setAudioBusy] = useState(false);
  const [isRecordingVoiceover, setIsRecordingVoiceover] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const createTrackedObjectUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  };

  const revokeTrackedObjectUrl = (url: string) => {
    if (!objectUrlsRef.current.has(url)) return;
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  };

  const addAudioAssetFromBlob = (blob: Blob, title: string, generated = false) => {
    const url = createTrackedObjectUrl(blob);
    const node: FlowNode = {
      id: `generated-audio-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'storyNode',
      position: { x: 0, y: 0 },
      data: {
        title,
        text: '',
        audioUrl: url,
        ...(generated ? { ttsGenerated: true } : {}),
      },
    };
    setUploadedAssetNodes((previous) => [node, ...previous]);
    setAssetRegionFilter('all');
    setActivePreviewId(node.id);
    setAudioTrackByNodeId((previous) => ({
      ...previous,
      [node.id]: audioTrackIds[0] || 'audio-1',
    }));
    setAudioMessage(
      isZh
        ? '音频已添加到素材栏，可拖到音频轨。'
        : 'Audio added to assets. Drag it to an audio track.',
    );
    setError('');
  };

  const handleUploadedAssetFiles = (files: FileList | File[]) => {
    const nextNodes = Array.from(files).flatMap((file, index) => {
      const kind = getUploadedAssetKind(file);
      if (!kind) return [];
      const url = createTrackedObjectUrl(file);
      const title = file.name.replace(/\.[^/.]+$/, '') || file.name;
      return [
        {
          id: `uploaded-asset-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
          type: 'storyNode',
          position: { x: 0, y: 0 },
          data: {
            title,
            text: '',
            ...(kind === 'image' ? { imageUrl: url } : {}),
            ...(kind === 'video' ? { videoUrl: url } : {}),
            ...(kind === 'audio' ? { audioUrl: url } : {}),
          },
        } satisfies FlowNode,
      ];
    });

    if (nextNodes.length === 0) {
      setError(isZh ? '请选择图片、视频或音频文件。' : 'Choose image, video, or audio files.');
      return;
    }
    setUploadedAssetNodes((previous) => [...nextNodes, ...previous]);
    setAssetRegionFilter('all');
    setActivePreviewId(nextNodes[0].id);
    setError('');
  };

  const generateAudioFromSelectedText = async (speechNodes = selectedSpeechNodes) => {
    if (audioBusy) return;
    const speechText = speechNodes
      .map((node, index) => {
        const text = getSpeechTextForNode(node);
        return text ? `${index + 1}. ${text}` : '';
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();
    if (!speechText) {
      setAudioMessage(
        isZh
          ? '选中的片段没有可朗读文字。'
          : 'Selected segments have no readable text.',
      );
      return;
    }

    closeContextMenu();
    setAudioBusy(true);
    setAudioMessage(
      isZh
        ? `正在为 ${speechNodes.length} 个片段生成语音...`
        : `Generating speech for ${speechNodes.length} segment(s)...`,
    );
    try {
      const audio = await generateSpeechAudio(
        speechText,
        voiceTtsConfig || {
          provider: 'system',
          apiUrl: '',
          apiKey: '',
          model: '',
          voice: '',
        },
      );
      addAudioAssetFromBlob(
        audio.blob,
        isZh
          ? `剧本文字配音 ${new Date().toLocaleTimeString()}`
          : `Script voiceover ${new Date().toLocaleTimeString()}`,
        true,
      );
    } catch (error) {
      setAudioMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? '文字转音频失败。'
            : 'Text to audio failed.',
      );
    } finally {
      setAudioBusy(false);
    }
  };

  const startVoiceoverRecording = async () => {
    if (isRecordingVoiceover) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || recorder.mimeType || 'audio/webm',
        });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        chunksRef.current = [];
        setIsRecordingVoiceover(false);
        if (blob.size > 0) {
          addAudioAssetFromBlob(
            blob,
            isZh
              ? `用户配音 ${new Date().toLocaleTimeString()}`
              : `Voiceover ${new Date().toLocaleTimeString()}`,
          );
        }
      };
      recorder.start();
      setIsRecordingVoiceover(true);
      setAudioMessage(
        isZh
          ? '正在录音，点击停止后生成音频素材。'
          : 'Recording. Stop to create an audio asset.',
      );
    } catch (error) {
      setIsRecordingVoiceover(false);
      setAudioMessage(
        error instanceof Error
          ? error.message
          : isZh
            ? '无法打开麦克风。'
            : 'Could not open the microphone.',
      );
    }
  };

  const stopVoiceoverRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecordingVoiceover(false);
  };

  const handleAssetUploadInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) handleUploadedAssetFiles(event.target.files);
    event.target.value = '';
  };

  const handleAssetFileDragOver = (event: DragEvent<HTMLElement>) => {
    if (!isInternalGalWriterDrag(event) && event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleAssetFileDrop = (event: DragEvent<HTMLElement>) => {
    if (isInternalGalWriterDrag(event) || !event.dataTransfer.types.includes('Files')) return;
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    event.stopPropagation();
    handleUploadedAssetFiles(event.dataTransfer.files);
  };

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    },
    [],
  );

  return {
    audioMessage,
    audioBusy,
    isRecordingVoiceover,
    generateAudioFromSelectedText,
    startVoiceoverRecording,
    stopVoiceoverRecording,
    handleAssetUploadInputChange,
    handleAssetFileDragOver,
    handleAssetFileDrop,
    revokeTrackedObjectUrl,
  };
};
