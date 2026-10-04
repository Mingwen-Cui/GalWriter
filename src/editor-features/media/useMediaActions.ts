import type { Edge, Node } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { MIN_STORY_CARD_HEIGHT } from '../../components/story-editor/constants';
import type { CharacterAssetType, CharacterNodeData, SceneImageMode } from '../../domain/project';
import { useDialog } from '../../editor-shell/DialogProvider';
import { formatSceneNodeText } from '../../lib/export';
import type { Language } from '../../lib/i18n';
import {
  buildImageGenerationRequest,
  buildReferencePrompt,
  ensureImageAspectRatio,
  getConnectedImageReferences,
  type ImageReference,
  isHostedImageProxyProvider,
  isLocalStableDiffusionProvider,
  toApiImageReference,
} from './imageGeneration';

interface UseMediaActionsParams {
  nodes: Node[];
  edges: Edge[];
  language: Language;
  imageApiKey: string;
  imageApiUrl: string;
  imageModel: string;
  imageSize: string;
  imageProvider: string;
  imageNegativePrompt?: string;
  imageSteps?: number;
  imageCfgScale?: number;
  imageSampler?: string;
  imageSeed?: number;
  imageRestoreFaces?: boolean;
  imageEnableHr?: boolean;
  imageHrScale?: number;
  imageDenoisingStrength?: number;
  sceneImageMode: SceneImageMode;
  characterAssetTypes: CharacterAssetType[];
  showTitles: boolean;
  setImageSize: Dispatch<SetStateAction<string>>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  showToast: (message: string) => void;
  onMissingImageApiKeyRequest?: () => void;
}

const stripHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return (doc.body.textContent || '').trim();
};

const formatCharacterSpritePromptText = (
  data: CharacterNodeData | Record<string, unknown>,
): string => {
  const sections: string[] = [];
  const addSection = (label: string, value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) sections.push(`${label}:\n${text}`);
  };
  const hasNewProfileFields = [
    data.identity,
    data.appearance,
    data.habits,
    data.speechStyle,
    data.experience,
    data.relationships,
    data.notes,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);

  if (hasNewProfileFields) {
    addSection('Identity', data.identity);
    addSection('Appearance', data.appearance || data.features);
    addSection('Personality', data.personality);
    addSection('Habits', data.habits);
    addSection('Speech style', data.speechStyle);
    addSection('Past experience', data.experience || data.background);
    addSection('Relationship notes', data.relationships);
    addSection('Other stable details', data.notes || data.other || data.traits);
  } else {
    const usesSplitFields =
      !!data.showPersonality || !!data.showFeatures || !!data.showBackground || !!data.showOther;
    if (usesSplitFields) {
      if (data.showPersonality) addSection('Personality', data.personality);
      if (data.showFeatures) addSection('Appearance and distinctive features', data.features);
      if (data.showBackground) addSection('Background', data.background);
      if (data.showOther) addSection('Other requirements', data.other);
    } else {
      addSection('Character description', data.traits);
    }
  }

  return sections.join('\n\n').trim();
};

const applyNodeDataAndStyleUpdate = (
  nds: Node[],
  id: string,
  updates: Record<string, unknown>,
  styleUpdates?: Record<string, unknown>,
) =>
  nds.map((node) => {
    if (node.id !== id) return node;

    return {
      ...node,
      data: {
        ...node.data,
        ...updates,
      },
      ...(styleUpdates
        ? {
            style: {
              ...node.style,
              ...styleUpdates,
            },
          }
        : {}),
    };
  });

export const useMediaActions = ({
  nodes,
  edges,
  language,
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
  sceneImageMode,
  characterAssetTypes,
  showTitles,
  setImageSize,
  setNodes,
  showToast,
  onMissingImageApiKeyRequest,
}: UseMediaActionsParams) => {
  const { alert: showDialogAlert } = useDialog();
  const stableDiffusionOptions = useMemo(
    () => ({
      negativePrompt: imageNegativePrompt,
      steps: imageSteps,
      cfgScale: imageCfgScale,
      sampler: imageSampler,
      seed: imageSeed,
      restoreFaces: imageRestoreFaces,
      enableHr: imageEnableHr,
      hrScale: imageHrScale,
      denoisingStrength: imageDenoisingStrength,
    }),
    [
      imageNegativePrompt,
      imageSteps,
      imageCfgScale,
      imageSampler,
      imageSeed,
      imageRestoreFaces,
      imageEnableHr,
      imageHrScale,
      imageDenoisingStrength,
    ],
  );
  const isLocalStableDiffusion = isLocalStableDiffusionProvider(imageProvider);
  const isHostedImageProxy = isHostedImageProxyProvider(imageProvider);

  const handleAddTextToImage = useCallback(
    (id: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== id) return node;

          const currentText = (node.data.text as string) || '';
          return {
            ...node,
            data: {
              ...node.data,
              text:
                currentText ||
                (language === 'zh'
                  ? '在此处输入描述文本...'
                  : language === 'ja'
                    ? 'ここに説明を入力してください...'
                    : 'Enter description here...'),
              showTextOverlay: true,
            },
            style: {
              ...node.style,
              height: ((node.style?.height as number) || 200) + 100,
            },
          };
        }),
      );
    },
    [language, setNodes],
  );

  const handleRemoveTextFromImage = useCallback(
    (id: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== id) return node;

          return {
            ...node,
            data: {
              ...node.data,
              showTextOverlay: false,
            },
            style: {
              ...node.style,
              height: Math.max(100, ((node.style?.height as number) || 200) - 100),
            },
          };
        }),
      );
    },
    [setNodes],
  );

  const requestGeneratedImage = useCallback(
    async (
      prompt: string,
      options: {
        transparentBackground?: boolean;
        sizeOverride?: string;
        aspectRatio?: number;
        negativePromptOverride?: string;
        referenceImages?: ImageReference[];
      } = {},
    ) => {
      const {
        transparentBackground = false,
        sizeOverride,
        aspectRatio,
        negativePromptOverride,
        referenceImages = [],
      } = options;
      const requestStableDiffusionOptions = negativePromptOverride
        ? {
            ...stableDiffusionOptions,
            negativePrompt: [stableDiffusionOptions.negativePrompt, negativePromptOverride]
              .filter(Boolean)
              .join(', '),
          }
        : stableDiffusionOptions;
      if (!isLocalStableDiffusion && !isHostedImageProxy && !imageApiKey.trim()) {
        onMissingImageApiKeyRequest?.();
        await showDialogAlert({
          title:
            language === 'zh'
              ? '缺少图片接口配置'
              : language === 'ja'
                ? '画像API設定が未入力です'
                : 'Missing image API setup',
          description:
            language === 'zh'
              ? '请先在设置中填写图片生成 API 密钥。'
              : language === 'ja'
                ? '先に設定で画像生成APIキーを入力してください。'
                : 'Configure the image generation API key in Settings first.',
          tone: 'warning',
        });
        return null;
      }

      let apiReferenceImages: string[] = [];
      if (referenceImages.length > 0) {
        try {
          apiReferenceImages = await Promise.all(
            referenceImages.map((reference) => toApiImageReference(reference.url)),
          );
        } catch (error) {
          console.warn('Character reference image could not be attached:', error);
        }
      }
      const promptWithReferences = `${prompt}${buildReferencePrompt(referenceImages)}`;
      const imageRequest = buildImageGenerationRequest(
        imageApiUrl,
        imageModel,
        sizeOverride || imageSize,
        promptWithReferences,
        imageApiKey,
        imageProvider,
        requestStableDiffusionOptions,
        apiReferenceImages,
        transparentBackground,
      );
      const imageRequestBody = JSON.stringify(imageRequest.body);
      const imageRequestHeaders = {
        'Content-Type': 'application/json',
        ...(imageApiKey.trim() ? { Authorization: `Bearer ${imageApiKey.trim()}` } : {}),
      };
      const sendImageRequest = (url: string) =>
        fetch(url, {
          method: 'POST',
          headers: imageRequestHeaders,
          body: imageRequestBody,
        });

      let response: Response;
      let activeImageRequestUrl = imageRequest.url;
      try {
        response = await sendImageRequest(activeImageRequestUrl);
      } catch (fetchError) {
        const fallbackArkProxyUrl =
          typeof window !== 'undefined' &&
          /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):3000$/i.test(window.location.origin)
            ? '/api/ark-image'
            : 'http://127.0.0.1:3000/api/ark-image';
        const canRetryArkProxy =
          imageRequest.usesSeedream &&
          imageRequest.url !== fallbackArkProxyUrl &&
          typeof window !== 'undefined' &&
          window.location.protocol.startsWith('http');
        if (!canRetryArkProxy) {
          throw new Error(
            `${language === 'zh' ? '图片请求无法发送' : language === 'ja' ? '画像リクエストを送信できませんでした' : 'Image request could not be sent'} (${imageRequest.url}). ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          );
        }
        activeImageRequestUrl = fallbackArkProxyUrl;
        response = await sendImageRequest(activeImageRequestUrl);
      }

      if (!response.ok) {
        const errText = await response.text();
        const shouldRetrySeedreamSize =
          imageRequest.usesSeedream &&
          /InvalidParameter|size|pixels/i.test(errText) &&
          'size' in imageRequest.body &&
          imageRequest.body.size !== '2048x2048';
        const shouldRetryConfiguredSize =
          Boolean(sizeOverride) &&
          !imageRequest.usesSeedream &&
          /InvalidParameter|size|width|height|dimension|resolution/i.test(errText);

        if (shouldRetrySeedreamSize) {
          response = await fetch(activeImageRequestUrl, {
            method: 'POST',
            headers: imageRequestHeaders,
            body: JSON.stringify({
              ...imageRequest.body,
              size: '2048x2048',
            }),
          });

          if (response.ok) {
            if (!sizeOverride) setImageSize('2048x2048');
          } else {
            const retryErrText = await response.text();
            throw new Error(`Image API HTTP ${response.status}: ${retryErrText || errText || response.statusText}`);
          }
        } else if (shouldRetryConfiguredSize) {
          const fallbackRequest = buildImageGenerationRequest(
            imageApiUrl,
            imageModel,
            imageSize,
            promptWithReferences,
            imageApiKey,
            imageProvider,
            requestStableDiffusionOptions,
            apiReferenceImages,
            transparentBackground,
          );
          response = await fetch(fallbackRequest.url, {
            method: 'POST',
            headers: imageRequestHeaders,
            body: JSON.stringify(fallbackRequest.body),
          });
          if (!response.ok) {
            const retryErrText = await response.text();
            throw new Error(`Image API HTTP ${response.status}: ${retryErrText || errText || response.statusText}`);
          }
        } else {
          throw new Error(`Image API HTTP ${response.status}: ${errText || response.statusText}`);
        }
      }

      const result = await response.json();
      const imageData = result?.data?.[0];
      const stableDiffusionImage = Array.isArray(result?.images) ? result.images[0] : '';
      const imageSrc = stableDiffusionImage
        ? `data:image/png;base64,${stableDiffusionImage}`
        : imageData?.b64_json
          ? `data:image/png;base64,${imageData.b64_json}`
          : imageData?.url;

      if (!imageSrc) {
        throw new Error(
          language === 'zh'
            ? '图片 API 没有返回可用图片。'
            : language === 'ja'
              ? '画像APIが利用可能な画像を返しませんでした。'
              : 'Image API returned no usable image.',
        );
      }

      let processedImageSrc = imageSrc as string;

      if (aspectRatio) {
        try {
          processedImageSrc = await ensureImageAspectRatio(processedImageSrc, aspectRatio);
        } catch (error) {
          console.error('Scene aspect ratio processing failed:', error);
          showToast(
            language === 'zh'
              ? '图片已生成，比例转换失败，已使用原图。'
              : language === 'ja'
                ? '画像は生成されましたが、比率変換に失敗したため元画像を使用しました。'
                : 'The image was generated, but ratio conversion failed. Using the original image.',
          );
        }
      }

      return processedImageSrc;
    },
    [
      imageApiKey,
      imageApiUrl,
      imageModel,
      imageSize,
      imageProvider,
      stableDiffusionOptions,
      isLocalStableDiffusion,
      isHostedImageProxy,
      language,
      onMissingImageApiKeyRequest,
      setImageSize,
      showToast,
    ],
  );

  const handleGenerateSettingNodeImage = useCallback(
    async (
      id: string,
      type: 'character' | 'scene',
      onProgress?: (current: number, total: number, label?: string) => void,
      requestedAssetType?: CharacterAssetType | 'background',
      propagateError = false,
    ) => {
      const node = nodes.find((item) => item.id === id);
      if (!node) return false;

      try {
        if ((type === 'scene' && requestedAssetType && requestedAssetType !== 'background') ||
            (type === 'character' && requestedAssetType === 'background')) {
          throw new Error('The requested image asset type does not match this card type.');
        }
        const titleText =
          type === 'character'
            ? (node.data.characterName as string) ||
              (language === 'zh'
                ? '未命名角色'
                : language === 'ja'
                  ? '名前のないキャラクター'
                  : 'Unnamed Character')
            : (node.data.sceneName as string) ||
              (language === 'zh'
                ? '未命名场景'
                : language === 'ja'
                  ? '名前のないシーン'
                  : 'Unnamed Scene');
        const bodyText =
          type === 'character'
            ? formatCharacterSpritePromptText(node.data as Record<string, unknown>)
            : formatSceneNodeText(node.data as Record<string, unknown>);
        const basePrompt = [titleText, bodyText].filter(Boolean).join('\n\n').trim();

        if (!basePrompt) {
          await showDialogAlert({
            title:
              language === 'zh'
                ? '缺少设定内容'
                : language === 'ja'
                  ? '設定内容が不足しています'
                  : 'Missing setting content',
            description:
              language === 'zh'
                ? '请先填写人物或场景设定。'
                : language === 'ja'
                  ? '先にキャラクターまたはシーン設定を入力してください。'
                  : 'Fill in the character or scene setting first.',
            tone: 'warning',
          });
          return false;
        }

        if (type === 'character') {
          const saveCharacterAsset = (updates: Partial<CharacterNodeData>) => {
            setNodes((nds) =>
              nds.map((current) =>
                current.id === id
                  ? {
                      ...current,
                      data: {
                        ...current.data,
                        ...updates,
                        generatedSettingImageId: undefined,
                      },
                    }
                  : current,
              ),
            );
          };
          const characterSetting = `Character setting:\n\n${basePrompt}`;
          const selectedAssetTypes = requestedAssetType && requestedAssetType !== 'background'
            ? [requestedAssetType]
            : characterAssetTypes;

          if (selectedAssetTypes.length === 0) {
            showToast(
              language === 'zh'
                ? '请先在图片 AI 中选择要生成的人物素材'
                : language === 'ja'
                  ? 'Image AI で生成するキャラクター素材を選択してください'
                  : 'Choose character assets to generate in Image AI first',
            );
            return false;
          }

          const total = selectedAssetTypes.length;
          let current = 0;
          const reportProgress = (label: string) => onProgress?.(++current, total, label);
          const generatedAssetLabels: string[] = [];
          let portraitReference: ImageReference[] = node.data.avatarUrl
            ? [{ url: node.data.avatarUrl as string, label: `${titleText} card portrait` }]
            : [];

          if (selectedAssetTypes.includes('portrait')) {
            reportProgress(language === 'zh' ? '正面头像' : 'Card portrait');
            const avatarUrl = await requestGeneratedImage(
              `Create exactly ONE polished visual novel character portrait for a character card. Use a front-facing close-up or upper-body composition, with the face clear and centered. One character only. No character sheet, no alternate views, no duplicate figures, no text, no UI, and no frame. Preserve the character design described below:\n\n${characterSetting}`,
            );
            if (!avatarUrl) return false;
            saveCharacterAsset({ avatarUrl });
            portraitReference = [{ url: avatarUrl, label: `${titleText} card portrait` }];
            generatedAssetLabels.push(language === 'zh' ? '头像' : 'portrait');
          }

          if (selectedAssetTypes.includes('three-view')) {
            reportProgress(language === 'zh' ? '人物三视图' : 'Three-view sheet');
            const threeViewUrl = await requestGeneratedImage(
              `Create a polished visual novel character design sheet with exactly three full-body views of the SAME character: front, side, and back. Keep the face, hair, clothing, proportions, and colors consistent with the attached card portrait. Use a clean neutral background. No text labels, no UI, and no frame.\n\n${characterSetting}`,
              portraitReference.length > 0 ? { referenceImages: portraitReference } : undefined,
            );
            if (!threeViewUrl) return false;
            saveCharacterAsset({ threeViewUrl });
            generatedAssetLabels.push(language === 'zh' ? '三视图' : 'three-view sheet');
          }

          if (selectedAssetTypes.includes('tag-sprite')) {
            reportProgress(language === 'zh' ? '透明标签立绘' : 'Transparent tag sprite');
            const tagSpriteUrl = await requestGeneratedImage(
              `Create exactly ONE polished visual novel character sprite matching the character setting below. If a reference portrait is provided, preserve that character's face, hair, outfit, proportions, and colors. Show one single front-facing full-body figure, head to toe. This is NOT a character sheet or turnaround. Do not generate side views, back views, duplicate figures, multiple poses, panels, scenery, floor, cast shadow, text, labels, UI, or frame. Use a clean transparent background.\n\n${characterSetting}`,
              {
                transparentBackground: true,
                negativePromptOverride:
                  'character sheet, turnaround, three views, multiple views, side view, back view, multiple poses, duplicate character, split panel, collage, contact sheet, scenery, floor, shadow, text, UI, frame',
                ...(portraitReference.length > 0 ? { referenceImages: portraitReference } : {}),
              },
            );
            if (!tagSpriteUrl) return false;
            saveCharacterAsset({ tagSpriteUrl });
            generatedAssetLabels.push(language === 'zh' ? '透明标签立绘' : 'transparent sprite');
          }

          onProgress?.(total, total, language === 'zh' ? '已完成' : 'Complete');
          showToast(
            language === 'zh'
              ? `人物素材已生成：${generatedAssetLabels.join('、')}`
              : language === 'ja'
                ? 'キャラクター素材を生成しました'
                : `Character assets generated: ${generatedAssetLabels.join(', ')}`,
          );
          return true;
        }

        const prompt =
          sceneImageMode === 'storyboard-16:9'
            ? `Create a polished cinematic visual novel storyboard frame in a wide 16:9 landscape composition. Focus on the environment, spatial layout, camera framing, mood, props, lighting, and color palette. Compose important subjects so they remain visible after a centered 16:9 crop. No text labels, no UI. Scene setting:\n\n${basePrompt}`
            : `Create a polished visual novel scene concept image from this setting. Focus on the environment, spatial layout, mood, props, lighting, and color palette. No text labels, no UI. Scene setting:\n\n${basePrompt}`;

        const forceSceneStoryboard = sceneImageMode === 'storyboard-16:9';
        const imageSrc = await requestGeneratedImage(prompt, {
          sizeOverride: forceSceneStoryboard ? '1920x1080' : undefined,
          aspectRatio: forceSceneStoryboard ? 16 / 9 : undefined,
        });
        if (!imageSrc) return false;

        setNodes((nds) =>
          nds.map((current) => {
            if (current.id !== id) return current;

            const currentImages = (current.data.images as any[]) || [];
            const previousCoverImageUrl = current.data.coverImageUrl as string | undefined;
            const hasArchivedCover = currentImages.some(
              (image) => image.imageUrl === previousCoverImageUrl,
            );
            const archivedCoverName =
              language === 'zh'
                ? '上一张场景图片'
                : language === 'ja'
                  ? '前のシーン画像'
                  : 'Previous Scene Image';
            const nextImages =
              previousCoverImageUrl && previousCoverImageUrl !== imageSrc && !hasArchivedCover
                ? [
                    {
                      id: uuidv4(),
                      name: archivedCoverName,
                      imageUrl: previousCoverImageUrl,
                    },
                    ...currentImages,
                  ]
                : currentImages;

            return {
              ...current,
              data: {
                ...current.data,
                coverImageUrl: imageSrc,
                images: nextImages,
                generatedSettingImageId: undefined,
              },
            };
          }),
        );

        showToast(
          language === 'zh'
            ? '场景图片已生成'
            : language === 'ja'
              ? 'シーン画像が生成されました'
              : 'Scene image generated',
        );
        return true;
      } catch (error: any) {
        if (propagateError) throw error;
        console.error('Setting image generation failed:', error);
        await showDialogAlert({
          title:
            language === 'zh'
              ? '图片生成失败'
              : language === 'ja'
                ? '画像の生成に失敗しました'
                : 'Image generation failed',
          description: error.message || 'Unknown error',
          tone: 'warning',
        });
        return false;
      }
    },
    [
      characterAssetTypes,
      language,
      nodes,
      requestGeneratedImage,
      sceneImageMode,
      setNodes,
      showToast,
    ],
  );

  const handleGenerateStoryNodeImage = useCallback(
    async (id: string) => {
      const node = nodes.find((item) => item.id === id);
      if (!node) return;

      const titleText = stripHtml((node.data.title as string) || '');
      const bodyText = stripHtml((node.data.text as string) || '');
      const basePrompt = [titleText, bodyText].filter(Boolean).join('\n\n').trim();
      if (!basePrompt) {
        await showDialogAlert({
          title:
            language === 'zh'
              ? '缺少提示词'
              : language === 'ja'
                ? 'プロンプトがありません'
                : 'Missing prompt',
          description:
            language === 'zh'
              ? '请先在普通卡片里输入图片提示词。'
              : language === 'ja'
                ? '先にストーリーカードにプロンプトを入力してください。'
                : 'Enter an image prompt in the story card first.',
          tone: 'warning',
        });
        return;
      }
      if (!isLocalStableDiffusion && !isHostedImageProxy && !imageApiKey.trim()) {
        onMissingImageApiKeyRequest?.();
        await showDialogAlert({
          title:
            language === 'zh'
              ? '缺少图片接口配置'
              : language === 'ja'
                ? '画像API設定が未入力です'
                : 'Missing image API setup',
          description:
            language === 'zh'
              ? '请先在设置中填写图片生成 API 密钥。'
              : language === 'ja'
                ? '先に設定で画像生成APIキーを入力してください。'
                : 'Configure the image generation API key in Settings first.',
          tone: 'warning',
        });
        return;
      }

      try {
        const imageReferences = getConnectedImageReferences(nodes, edges, id);
        const convertedReferences = (
          await Promise.allSettled(
            imageReferences.map(async (reference) => ({
              ...reference,
              apiImage: await toApiImageReference(reference.url),
            })),
          )
        )
          .filter(
            (result): result is PromiseFulfilledResult<ImageReference & { apiImage: string }> =>
              result.status === 'fulfilled' && !!result.value.apiImage,
          )
          .map((result) => result.value);
        const apiReferenceImages = convertedReferences.map((reference) => reference.apiImage);
        const promptBase = `${basePrompt}${buildReferencePrompt(convertedReferences)}`;
        const imageRequest = buildImageGenerationRequest(
          imageApiUrl,
          imageModel,
          imageSize,
          promptBase,
          imageApiKey,
          imageProvider,
          stableDiffusionOptions,
          apiReferenceImages,
        );
        const imageRequestBody = JSON.stringify(imageRequest.body);
        const imageRequestHeaders = {
          'Content-Type': 'application/json',
          ...(imageApiKey.trim() ? { Authorization: `Bearer ${imageApiKey.trim()}` } : {}),
        };
        const sendImageRequest = (url: string) =>
          fetch(url, {
            method: 'POST',
            headers: imageRequestHeaders,
            body: imageRequestBody,
          });

        let response: Response;
        let activeImageRequestUrl = imageRequest.url;
        try {
          response = await sendImageRequest(activeImageRequestUrl);
        } catch (fetchError) {
          const fallbackArkProxyUrl =
            typeof window !== 'undefined' &&
            /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):3000$/i.test(window.location.origin)
              ? '/api/ark-image'
              : 'http://127.0.0.1:3000/api/ark-image';
          const canRetryArkProxy =
            imageRequest.usesSeedream &&
            imageRequest.url !== fallbackArkProxyUrl &&
            typeof window !== 'undefined' &&
            window.location.protocol.startsWith('http');
          if (!canRetryArkProxy) {
            throw new Error(
              `${language === 'zh' ? '图片请求无法发送' : language === 'ja' ? '画像リクエストを送信できませんでした' : 'Image request could not be sent'} (${imageRequest.url}). ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
            );
          }
          activeImageRequestUrl = fallbackArkProxyUrl;
          response = await sendImageRequest(activeImageRequestUrl);
        }

        if (!response.ok) {
          const errText = await response.text();
          const shouldRetrySeedreamSize =
            imageRequest.usesSeedream &&
            /InvalidParameter|size|pixels/i.test(errText) &&
            'size' in imageRequest.body &&
            imageRequest.body.size !== '2048x2048';

          if (shouldRetrySeedreamSize) {
            response = await fetch(activeImageRequestUrl, {
              method: 'POST',
              headers: imageRequestHeaders,
              body: JSON.stringify({
                ...imageRequest.body,
                size: '2048x2048',
              }),
            });

            if (response.ok) {
              setImageSize('2048x2048');
            } else {
              const retryErrText = await response.text();
              throw new Error(retryErrText || errText || `HTTP ${response.status}`);
            }
          } else {
            throw new Error(errText || `HTTP ${response.status}`);
          }
        }

        const result = await response.json();
        const imageData = result?.data?.[0];
        const stableDiffusionImage = Array.isArray(result?.images) ? result.images[0] : '';
        const imageSrc = stableDiffusionImage
          ? `data:image/png;base64,${stableDiffusionImage}`
          : imageData?.b64_json
            ? `data:image/png;base64,${imageData.b64_json}`
            : imageData?.url;

        if (!imageSrc) {
          throw new Error(
            language === 'zh'
              ? '图片 API 没有返回可用图片。'
              : language === 'ja'
                ? '画像APIが利用可能な画像を返しませんでした。'
                : 'Image API returned no usable image.',
          );
        }

        const currentWidth = (node.style?.width as number) || 280;
        const previousImageUrl = node.data.imageUrl as string | undefined;
        const nextHeight = MIN_STORY_CARD_HEIGHT;

        setNodes((nds) => {
          const nextNodes = nds.map((current) => {
            if (current.id !== id) return current;
            return {
              ...current,
              data: {
                ...current.data,
                imageUrl: imageSrc,
                videoUrl: undefined,
                objectFit: current.data.objectFit || 'playtest',
                showTextOverlay: true,
                titleHeightAdded: showTitles,
              },
              style: {
                ...current.style,
                height: nextHeight,
              },
            };
          });

          if (!previousImageUrl) return nextNodes;

          const extractedId = uuidv4();
          const extractedNode: Node = {
            id: extractedId,
            type: 'storyNode',
            position: {
              x: node.position.x + currentWidth + 40,
              y: node.position.y,
            },
            style: { width: currentWidth, height: MIN_STORY_CARD_HEIGHT },
            data: {
              id: extractedId,
              title:
                language === 'zh' ? '旧图片' : language === 'ja' ? '以前の画像' : 'Previous Image',
              shape: 'square',
              color: '#ffffff',
              sizeMode: 'auto',
              text: '',
              imageUrl: previousImageUrl,
              objectFit: node.data.objectFit || 'playtest',
              showTextOverlay: false,
              titleHeightAdded: showTitles,
            },
          };

          return [...nextNodes, extractedNode];
        });
        showToast(
          language === 'zh'
            ? '图片已生成到当前卡片'
            : language === 'ja'
              ? 'カードに画像が生成されました'
              : 'Image generated into the current card',
        );
      } catch (error: any) {
        console.error('Image generation failed:', error);
        await showDialogAlert({
          title:
            language === 'zh'
              ? '图片生成失败'
              : language === 'ja'
                ? '画像の生成に失敗しました'
                : 'Image generation failed',
          description: error.message || 'Unknown error',
          tone: 'warning',
        });
      }
    },
    [
      edges,
      imageApiKey,
      imageApiUrl,
      imageModel,
      imageSize,
      imageProvider,
      stableDiffusionOptions,
      isLocalStableDiffusion,
      isHostedImageProxy,
      language,
      nodes,
      onMissingImageApiKeyRequest,
      setImageSize,
      setNodes,
      showTitles,
      showToast,
    ],
  );

  const handleExtractMedia = useCallback(
    (id: string) => {
      const node = nodes.find((item) => item.id === id);
      if (!node) return;

      const extractedMedia: { url: string; type: string }[] = [];

      if (node.data.imageUrl)
        extractedMedia.push({ url: node.data.imageUrl as string, type: 'image' });
      if (node.data.videoUrl)
        extractedMedia.push({ url: node.data.videoUrl as string, type: 'video' });
      if (node.data.audioUrl)
        extractedMedia.push({ url: node.data.audioUrl as string, type: 'audio' });

      const text = (node.data.text as string) || '';
      const imgRegex = /<img[^>]+src="([^">]+)"/g;
      const videoRegex = /<video[^>]+src="([^">]+)"/g;
      let match: RegExpExecArray | null;

      while ((match = imgRegex.exec(text)) !== null) {
        if (!extractedMedia.find((media) => media.url === match?.[1])) {
          extractedMedia.push({ url: match[1], type: 'image' });
        }
      }
      while ((match = videoRegex.exec(text)) !== null) {
        if (!extractedMedia.find((media) => media.url === match?.[1])) {
          extractedMedia.push({ url: match[1], type: 'video' });
        }
      }

      if (extractedMedia.length === 0) return;

      const cleanText = text
        .replace(/<img[^>]+>/g, '')
        .replace(/<video[^>]+>.*?<\/video>/g, '')
        .replace(/<video[^>]+>/g, '')
        .trim();

      setNodes((nds) => {
        const clearedNodes = applyNodeDataAndStyleUpdate(
          nds,
          id,
          {
            imageUrl: undefined,
            videoUrl: undefined,
            audioUrl: undefined,
            showTextOverlay: false,
            text: cleanText,
          },
          { height: MIN_STORY_CARD_HEIGHT },
        );

        const newNodes: Node[] = extractedMedia.map((media, index) => {
          const newId = uuidv4();
          const displayWidth = 300;
          return {
            id: newId,
            type: 'storyNode',
            position: {
              x: node.position.x + (index + 1) * 320,
              y: node.position.y,
            },
            style: {
              width: displayWidth,
              height: MIN_STORY_CARD_HEIGHT,
            },
            data: {
              id: newId,
              title:
                media.type === 'image'
                  ? language === 'zh'
                    ? '提取图片'
                    : language === 'ja'
                      ? '画像を抽出'
                      : 'Extract Image'
                  : language === 'zh'
                    ? '提取视频'
                    : language === 'ja'
                      ? '動画を抽出'
                      : 'Extract Video',
              imageUrl: media.type === 'image' ? media.url : undefined,
              videoUrl: media.type === 'video' ? media.url : undefined,
              audioUrl: media.type === 'audio' ? media.url : undefined,
              sizeMode: 'auto',
              titleHeightAdded: showTitles,
              showTitles,
            },
          };
        });

        return [...clearedNodes, ...newNodes];
      });
    },
    [language, nodes, setNodes, showTitles],
  );

  return {
    handleAddTextToImage,
    handleRemoveTextFromImage,
    requestGeneratedImage,
    handleGenerateSettingNodeImage,
    handleGenerateStoryNodeImage,
    handleExtractMedia,
  };
};
