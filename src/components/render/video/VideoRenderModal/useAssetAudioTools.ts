import { getVideoTextForChinesePreference } from '../i18n';
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
      getVideoTextForChinesePreference(
        isZh,
        'componentsrendervideoVideoRenderModaluseAssetAudioToolsIsZhText74',
      ),
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
      setError(
        getVideoTextForChinesePreference(
          isZh,
          'componentsrendervideoVideoRenderModaluseAssetAudioToolsIsZhText104',
        ),
      );
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
        getVideoTextForChinesePreference(
          isZh,
          'componentsrendervideoVideoRenderModaluseAssetAudioToolsIsZhText125',
        ),
      );
      return;
    }

    closeContextMenu();
    setAudioBusy(true);
    setAudioMessage(
      getVideoTextForChinesePreference(
        isZh,
        'componentsrendervideoVideoRenderModaluseAssetAudioToolsIsZhText135',
        speechNodes.length,
      ),
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
        getVideoTextForChinesePreference(
          isZh,
          'componentsrendervideoVideoRenderModaluseAssetAudioToolsIsZhText152',
          new Date().toLocaleTimeString(),
        ),
        true,
      );
    } catch (error) {
      setAudioMessage(
        error instanceof Error
          ? error.message
          : getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModaluseAssetAudioToolsIsZhText161',
            ),
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
            getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModaluseAssetAudioToolsIsZhText196',
              new Date().toLocaleTimeString(),
            ),
          );
        }
      };
      recorder.start();
      setIsRecordingVoiceover(true);
      setAudioMessage(
        getVideoTextForChinesePreference(
          isZh,
          'componentsrendervideoVideoRenderModaluseAssetAudioToolsIsZhText205',
        ),
      );
    } catch (error) {
      setIsRecordingVoiceover(false);
      setAudioMessage(
        error instanceof Error
          ? error.message
          : getVideoTextForChinesePreference(
              isZh,
              'componentsrendervideoVideoRenderModaluseAssetAudioToolsIsZhText214',
            ),
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
