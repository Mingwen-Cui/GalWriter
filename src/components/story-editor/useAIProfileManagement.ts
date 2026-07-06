import React, { useCallback, useMemo } from 'react';

import type {
  BackgroundRemovalAIProfile,
  ImageAIProfile,
  ProjectAIProfilesExport,
  SavedAIProfile,
  TextAIProfile,
  VoiceAIProfile,
} from '../../domain/project';
import {
  DEFAULT_IMAGE_API_URL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_STABLE_DIFFUSION_CFG_SCALE,
  DEFAULT_STABLE_DIFFUSION_SAMPLER,
  DEFAULT_STABLE_DIFFUSION_STEPS,
} from '../../editor-features/media/imageGeneration';
import {
  HOSTED_IMAGE_PROXY_PROFILE,
  HOSTED_IMAGE_PROXY_PROFILE_ID,
  HOSTED_PROXY_PROFILE,
  HOSTED_PROXY_PROFILE_ID,
  HOSTED_VOICE_PROXY_PROFILE,
  HOSTED_VOICE_PROXY_PROFILE_ID,
} from '../../lib/hostedProxy';
import { isTauriRuntime } from '../../lib/tauriRuntime';
import {
  DEFAULT_TTS_API_URL,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE,
} from './constants';
import {
  buildDefaultBackgroundRemovalProfile,
  buildDefaultImageProfile,
  buildDefaultTextProfile,
  buildDefaultVoiceProfile,
  updateProfileList,
} from './aiProfiles';
import type { AIProfileSeed, AIProfileUpdates } from './types';

// ---------------------------------------------------------------------------
// Params

interface UseAIProfileManagementParams {
  savedAIProfiles: SavedAIProfile[];
  setSavedAIProfiles: React.Dispatch<React.SetStateAction<SavedAIProfile[]>>;
  activeTextProfileId: string | null;
  setActiveTextProfileId: React.Dispatch<React.SetStateAction<string | null>>;
  activeImageProfileId: string | null;
  setActiveImageProfileId: React.Dispatch<React.SetStateAction<string | null>>;
  activeBackgroundRemovalProfileId: string | null;
  setActiveBackgroundRemovalProfileId: React.Dispatch<React.SetStateAction<string | null>>;
  activeVoiceProfileId: string | null;
  setActiveVoiceProfileId: React.Dispatch<React.SetStateAction<string | null>>;
}

// ---------------------------------------------------------------------------
// Hook

export function useAIProfileManagement({
  savedAIProfiles,
  setSavedAIProfiles,
  activeTextProfileId,
  setActiveTextProfileId,
  activeImageProfileId,
  setActiveImageProfileId,
  activeBackgroundRemovalProfileId,
  setActiveBackgroundRemovalProfileId,
  activeVoiceProfileId,
  setActiveVoiceProfileId,
}: UseAIProfileManagementParams) {
  // ---- Active profile memos ------------------------------------------------

  const activeTextProfile = useMemo(() => {
    if (!isTauriRuntime() && activeTextProfileId === HOSTED_PROXY_PROFILE_ID) {
      return HOSTED_PROXY_PROFILE;
    }

    return (
      savedAIProfiles.find(
        (profile): profile is TextAIProfile =>
          profile.kind === 'text' && profile.id === activeTextProfileId,
      ) ?? null
    );
  }, [activeTextProfileId, savedAIProfiles]);

  const activeImageProfile = useMemo(() => {
    if (!isTauriRuntime() && activeImageProfileId === HOSTED_IMAGE_PROXY_PROFILE_ID) {
      return HOSTED_IMAGE_PROXY_PROFILE;
    }

    return (
      savedAIProfiles.find(
        (profile): profile is ImageAIProfile =>
          profile.kind === 'image' && profile.id === activeImageProfileId,
      ) ?? null
    );
  }, [activeImageProfileId, savedAIProfiles]);

  const activeBackgroundRemovalProfile = useMemo(() => {
    return (
      savedAIProfiles.find(
        (profile): profile is BackgroundRemovalAIProfile =>
          profile.kind === 'background-removal' && profile.id === activeBackgroundRemovalProfileId,
      ) ?? null
    );
  }, [activeBackgroundRemovalProfileId, savedAIProfiles]);

  const activeVoiceProfile = useMemo(() => {
    if (!isTauriRuntime() && activeVoiceProfileId === HOSTED_VOICE_PROXY_PROFILE_ID) {
      return HOSTED_VOICE_PROXY_PROFILE;
    }

    return (
      savedAIProfiles.find(
        (profile): profile is VoiceAIProfile =>
          profile.kind === 'voice' && profile.id === activeVoiceProfileId,
      ) ?? null
    );
  }, [activeVoiceProfileId, savedAIProfiles]);

  // ---- Derived values from active profiles ----------------------------------

  const aiProvider = activeTextProfile?.provider ?? 'deepseek';
  const thinkingMode = activeTextProfile?.thinkingMode ?? false;
  const textApiKey = activeTextProfile?.apiKey ?? '';
  const imageApiKey = activeImageProfile?.apiKey ?? '';
  const imageApiUrl = activeImageProfile?.apiUrl ?? DEFAULT_IMAGE_API_URL;
  const imageModel = activeImageProfile?.model ?? DEFAULT_IMAGE_MODEL;
  const imageSize = activeImageProfile?.size ?? DEFAULT_IMAGE_SIZE;
  const imageProvider = activeImageProfile?.provider ?? 'doubao';
  const imageNegativePrompt = activeImageProfile?.negativePrompt ?? '';
  const imageSteps = activeImageProfile?.steps ?? DEFAULT_STABLE_DIFFUSION_STEPS;
  const imageCfgScale = activeImageProfile?.cfgScale ?? DEFAULT_STABLE_DIFFUSION_CFG_SCALE;
  const imageSampler = activeImageProfile?.sampler ?? DEFAULT_STABLE_DIFFUSION_SAMPLER;
  const imageSeed = activeImageProfile?.seed ?? -1;
  const imageRestoreFaces = activeImageProfile?.restoreFaces ?? false;
  const imageEnableHr = activeImageProfile?.enableHr ?? false;
  const imageHrScale = activeImageProfile?.hrScale ?? 2;
  const imageDenoisingStrength = activeImageProfile?.denoisingStrength ?? 0.7;
  const imageRemoveBackground = activeImageProfile?.removeBackground ?? false;
  const backgroundRemovalApiUrl = activeBackgroundRemovalProfile?.apiUrl ?? '';
  const backgroundRemovalApiKey = activeBackgroundRemovalProfile?.apiKey ?? '';
  const backgroundRemovalModel = activeBackgroundRemovalProfile?.model ?? '';
  const backgroundRemovalProvider = activeBackgroundRemovalProfile?.provider ?? 'custom';
  const ttsApiKey = activeVoiceProfile?.apiKey ?? '';
  const ttsApiUrl = activeVoiceProfile?.apiUrl ?? DEFAULT_TTS_API_URL;
  const ttsAppKey = activeVoiceProfile?.appKey ?? activeVoiceProfile?.model ?? DEFAULT_TTS_MODEL;
  const ttsAppSecret = activeVoiceProfile?.appSecret ?? '';
  const ttsModel = activeVoiceProfile?.model ?? DEFAULT_TTS_MODEL;
  const ttsVoice = activeVoiceProfile?.voice ?? DEFAULT_TTS_VOICE;
  const ttsProvider = activeVoiceProfile?.provider ?? 'system';
  const activeTextProfileName = activeTextProfile?.name ?? '';
  const activeImageProfileName = activeImageProfile?.name ?? '';
  const activeVoiceProfileName = activeVoiceProfile?.name ?? '';

  // ---- Export profiles -------------------------------------------------------

  const getExportedAIProfiles = useCallback((): ProjectAIProfilesExport | null => {
    const profiles = [
      activeTextProfile,
      activeImageProfile,
      activeBackgroundRemovalProfile,
      activeVoiceProfile,
    ].filter(
      (profile): profile is SavedAIProfile =>
        Boolean(profile) &&
        profile?.id !== HOSTED_PROXY_PROFILE_ID &&
        profile?.id !== HOSTED_IMAGE_PROXY_PROFILE_ID &&
        profile?.id !== HOSTED_VOICE_PROXY_PROFILE_ID,
    );

    if (profiles.length === 0) return null;

    const exportedProfileIds = new Set(profiles.map((profile) => profile.id));
    return {
      profiles,
      activeTextProfileId:
        activeTextProfileId && exportedProfileIds.has(activeTextProfileId)
          ? activeTextProfileId
          : null,
      activeImageProfileId:
        activeImageProfileId && exportedProfileIds.has(activeImageProfileId)
          ? activeImageProfileId
          : null,
      activeBackgroundRemovalProfileId:
        activeBackgroundRemovalProfileId && exportedProfileIds.has(activeBackgroundRemovalProfileId)
          ? activeBackgroundRemovalProfileId
          : null,
      activeVoiceProfileId:
        activeVoiceProfileId && exportedProfileIds.has(activeVoiceProfileId)
          ? activeVoiceProfileId
          : null,
      exportedAt: new Date().toISOString(),
    };
  }, [
    activeBackgroundRemovalProfile,
    activeBackgroundRemovalProfileId,
    activeImageProfile,
    activeImageProfileId,
    activeTextProfile,
    activeTextProfileId,
    activeVoiceProfile,
    activeVoiceProfileId,
  ]);

  // ---- CRUD callbacks -------------------------------------------------------

  const handleCreateAIProfile = useCallback(
    async (
      kind: 'text' | 'image' | 'background-removal' | 'voice',
      initialProfile: AIProfileSeed = {},
    ) => {
      const baseProfile =
        kind === 'text'
          ? buildDefaultTextProfile()
          : kind === 'image'
            ? buildDefaultImageProfile()
            : kind === 'background-removal'
              ? buildDefaultBackgroundRemovalProfile()
              : buildDefaultVoiceProfile();
      const profile = Object.assign({}, baseProfile, initialProfile, {
        id: baseProfile.id,
        kind,
      }) as SavedAIProfile;
      setSavedAIProfiles((current) => [...current, profile]);
      if (kind === 'text') setActiveTextProfileId(profile.id);
      if (kind === 'image') setActiveImageProfileId(profile.id);
      if (kind === 'background-removal') setActiveBackgroundRemovalProfileId(profile.id);
      if (kind === 'voice') setActiveVoiceProfileId(profile.id);
      return profile.id;
    },
    [],
  );

  const handleUpdateAIProfile = useCallback(
    async (profileId: string, updates: AIProfileUpdates) => {
      if (
        profileId === HOSTED_PROXY_PROFILE_ID ||
        profileId === HOSTED_IMAGE_PROXY_PROFILE_ID ||
        profileId === HOSTED_VOICE_PROXY_PROFILE_ID
      )
        return;
      setSavedAIProfiles((current) =>
        updateProfileList(current, profileId, (profile) => Object.assign({}, profile, updates)),
      );
    },
    [],
  );

  const handleSelectAIProfile = useCallback(
    async (kind: 'text' | 'image' | 'background-removal' | 'voice', profileId: string) => {
      if (kind === 'text') setActiveTextProfileId(profileId);
      if (kind === 'image') setActiveImageProfileId(profileId);
      if (kind === 'background-removal') setActiveBackgroundRemovalProfileId(profileId);
      if (kind === 'voice') setActiveVoiceProfileId(profileId);
    },
    [],
  );

  const handleDeleteAIProfile = useCallback(
    async (profileId: string) => {
      if (
        profileId === HOSTED_PROXY_PROFILE_ID ||
        profileId === HOSTED_IMAGE_PROXY_PROFILE_ID ||
        profileId === HOSTED_VOICE_PROXY_PROFILE_ID
      )
        return;
      setSavedAIProfiles((current) => {
        const nextProfiles = current.filter((profile) => profile.id !== profileId);
        if (activeTextProfileId === profileId) {
          setActiveTextProfileId(
            nextProfiles.find((profile) => profile.kind === 'text')?.id ?? null,
          );
        }
        if (activeImageProfileId === profileId) {
          setActiveImageProfileId(
            nextProfiles.find((profile) => profile.kind === 'image')?.id ?? null,
          );
        }
        if (activeBackgroundRemovalProfileId === profileId) {
          setActiveBackgroundRemovalProfileId(
            nextProfiles.find((profile) => profile.kind === 'background-removal')?.id ?? null,
          );
        }
        if (activeVoiceProfileId === profileId) {
          setActiveVoiceProfileId(
            nextProfiles.find((profile) => profile.kind === 'voice')?.id ?? null,
          );
        }
        return nextProfiles;
      });
    },
    [
      activeBackgroundRemovalProfileId,
      activeImageProfileId,
      activeTextProfileId,
      activeVoiceProfileId,
    ],
  );

  const setImageSize = useCallback(
    (value: React.SetStateAction<string>) => {
      if (!activeImageProfileId || activeImageProfileId === HOSTED_IMAGE_PROXY_PROFILE_ID) return;

      setSavedAIProfiles((currentProfiles) => {
        const targetProfile = currentProfiles.find(
          (profile): profile is ImageAIProfile =>
            profile.kind === 'image' && profile.id === activeImageProfileId,
        );
        if (!targetProfile) return currentProfiles;

        const nextValue = typeof value === 'function' ? value(targetProfile.size) : value;
        return updateProfileList(currentProfiles, targetProfile.id, (profile) => ({
          ...profile,
          size: nextValue,
        })) as SavedAIProfile[];
      });
    },
    [activeImageProfileId],
  );

  // ---- Return ---------------------------------------------------------------

  return {
    // Active profiles
    activeTextProfile,
    activeImageProfile,
    activeBackgroundRemovalProfile,
    activeVoiceProfile,
    // Derived values
    aiProvider,
    thinkingMode,
    textApiKey,
    imageApiKey,
    imageApiUrl,
    imageModel,
    imageSize,
    imageProvider,
    imageNegativePrompt,
    imageSteps,
    imageCfgScale,
    imageSampler,
    imageSeed,
    imageRestoreFaces,
    imageEnableHr,
    imageHrScale,
    imageDenoisingStrength,
    imageRemoveBackground,
    backgroundRemovalApiUrl,
    backgroundRemovalApiKey,
    backgroundRemovalModel,
    backgroundRemovalProvider,
    ttsApiKey,
    ttsApiUrl,
    ttsAppKey,
    ttsAppSecret,
    ttsModel,
    ttsVoice,
    ttsProvider,
    activeTextProfileName,
    activeImageProfileName,
    activeVoiceProfileName,
    // Callbacks
    getExportedAIProfiles,
    handleCreateAIProfile,
    handleUpdateAIProfile,
    handleSelectAIProfile,
    handleDeleteAIProfile,
    setImageSize,
  };
}
