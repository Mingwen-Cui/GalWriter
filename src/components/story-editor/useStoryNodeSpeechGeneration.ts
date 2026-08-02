import type { Node } from '@xyflow/react';
import { useCallback } from 'react';

import type { StoryAudioClip, TtsNarrationMode, VoiceAIProfile } from '../../domain/project';
import { ttsService } from '../../editor-services/ttsService';
import { formatStoryEditorText, type StoryEditorCopy } from './i18n';

type AlertOptions = {
  title: string;
  description: string;
  tone?: 'info' | 'warning' | 'danger';
};

type UseStoryNodeSpeechGenerationOptions = {
  activeVoiceProfile: VoiceAIProfile | null;
  handleUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  nodes: Node[];
  requestSettingsAttention: (target: 'text' | 'image' | 'background-removal' | 'voice') => void;
  setTtsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  showDialogAlert: (options: AlertOptions) => Promise<void>;
  showToast: (message: string, tone?: 'success' | 'error') => void;
  storyEditorCopy: StoryEditorCopy;
  ttsApiKey: string;
  ttsApiUrl: string;
  ttsAppKey: string;
  ttsAppSecret: string;
  ttsLoading: boolean;
  ttsModel: string;
  ttsNarrationMode: TtsNarrationMode;
  ttsProvider: VoiceAIProfile['provider'];
  ttsVoice: string;
};

export function useStoryNodeSpeechGeneration({
  activeVoiceProfile,
  handleUpdateNode,
  nodes,
  requestSettingsAttention,
  setTtsLoading,
  showDialogAlert,
  showToast,
  storyEditorCopy,
  ttsApiKey,
  ttsApiUrl,
  ttsAppKey,
  ttsAppSecret,
  ttsLoading,
  ttsModel,
  ttsNarrationMode,
  ttsProvider,
  ttsVoice,
}: UseStoryNodeSpeechGenerationOptions) {
  return useCallback(
    async (nodeId: string) => {
      if (ttsLoading) return;

      const node = nodes.find((item) => item.id === nodeId && item.type === 'storyNode');
      if (!node) return;

      const speechSegments = ttsService.buildSpeechSegments(
        String(node.data.title || ''),
        String(node.data.text || ''),
        ttsNarrationMode,
      );
      if (speechSegments.length === 0) return;

      const missingVoiceApiConfig =
        !activeVoiceProfile ||
        (ttsProvider === 'youdao'
          ? !ttsAppKey.trim() || !ttsApiKey.trim()
          : ttsProvider !== 'system' && ttsProvider !== 'hosted-voice' && !ttsApiKey.trim());
      if (missingVoiceApiConfig) {
        requestSettingsAttention('voice');
        showToast(storyEditorCopy.voiceApiRequired);
        return;
      }

      setTtsLoading(true);
      try {
        showToast(storyEditorCopy.generatingAudio);
        const existingClips = Array.isArray(node.data.audioClips)
          ? node.data.audioClips
          : typeof node.data.audioUrl === 'string' && node.data.audioUrl
            ? [
                {
                  id: crypto.randomUUID(),
                  name: storyEditorCopy.existingAudio,
                  url: node.data.audioUrl,
                  source: 'imported' as const,
                  createdAt: Date.now() - 1,
                },
              ]
            : [];
        const generatedClips: StoryAudioClip[] = [];

        for (const [index, segment] of speechSegments.entries()) {
          const audio = await ttsService.generate({
            text: segment.text,
            provider: ttsProvider,
            apiUrl: ttsApiUrl,
            apiKey: ttsApiKey,
            appKey: ttsAppKey,
            appSecret: ttsAppSecret || ttsApiKey,
            model: ttsModel,
            voice: ttsVoice,
          });
          generatedClips.push({
            id: crypto.randomUUID(),
            name: formatStoryEditorText(storyEditorCopy.textAudioName, {
              number: existingClips.length + index + 1,
            }),
            url: audio.url,
            source: 'tts',
            createdAt: Date.now() + index,
            segmentId: segment.id,
            order: index,
          });
        }

        const nextClips = [...existingClips, ...generatedClips];
        handleUpdateNode(nodeId, {
          audioUrl: nextClips.find((clip) => !clip.skipped)?.url || generatedClips[0]?.url,
          audioClips: nextClips,
          ttsGenerated: true,
        });
        showToast(storyEditorCopy.audioGenerated);
      } catch (error) {
        console.error('TTS generation failed:', error);
        await showDialogAlert({
          title: storyEditorCopy.audioGenerationFailed,
          description: error instanceof Error ? error.message : storyEditorCopy.unknownError,
          tone: 'warning',
        });
      } finally {
        setTtsLoading(false);
      }
    },
    [
      activeVoiceProfile,
      handleUpdateNode,
      nodes,
      requestSettingsAttention,
      setTtsLoading,
      showDialogAlert,
      showToast,
      storyEditorCopy,
      ttsApiKey,
      ttsApiUrl,
      ttsAppKey,
      ttsAppSecret,
      ttsLoading,
      ttsModel,
      ttsNarrationMode,
      ttsProvider,
      ttsVoice,
    ],
  );
}
