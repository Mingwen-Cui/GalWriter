import type { Edge, Node } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { CharacterImageMode, CharacterNodeData, SceneImageMode } from '../../domain/project';
import { formatCharacterNodeText, formatSceneNodeText } from '../../lib/export';
import {
  buildImageGenerationRequest,
  buildReferencePrompt,
  ensureImageAspectRatio,
  ensureTransparentImageBackground,
  getConnectedImageReferences,
  isLocalStableDiffusionProvider,
  type ImageReference,
  toApiImageReference,
} from './imageGeneration';
import type { Language } from '../../lib/i18n';

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
  characterImageMode: CharacterImageMode;
  sceneImageMode: SceneImageMode;
  showTitles: boolean;
  setImageSize: Dispatch<SetStateAction<string>>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  showToast: (message: string) => void;
  onMissingImageApiKeyRequest?: () => void;
}

const TITLE_HEIGHT = 36;

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
  characterImageMode,
  sceneImageMode,
  showTitles,
  setImageSize,
  setNodes,
  showToast,
  onMissingImageApiKeyRequest,
}: UseMediaActionsParams) => {
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
      } = {},
    ) => {
      const {
        transparentBackground = false,
        sizeOverride,
        aspectRatio,
        negativePromptOverride,
      } = options;
      const requestStableDiffusionOptions = negativePromptOverride
        ? {
            ...stableDiffusionOptions,
            negativePrompt: [stableDiffusionOptions.negativePrompt, negativePromptOverride]
              .filter(Boolean)
              .join(', '),
          }
        : stableDiffusionOptions;
      if (!isLocalStableDiffusion && !imageApiKey.trim()) {
        onMissingImageApiKeyRequest?.();
        alert(
          language === 'zh'
            ? '请先在设置中填写图片生成 API 密钥。'
            : language === 'ja'
              ? '先に設定で画像生成APIキーを入力してください。'
              : 'Configure the image generation API key in Settings first.',
        );
        return null;
      }

      const imageRequest = buildImageGenerationRequest(
        imageApiUrl,
        imageModel,
        sizeOverride || imageSize,
        prompt,
        imageApiKey,
        imageProvider,
        requestStableDiffusionOptions,
        [],
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
            throw new Error(retryErrText || errText || `HTTP ${response.status}`);
          }
        } else if (shouldRetryConfiguredSize) {
          const fallbackRequest = buildImageGenerationRequest(
            imageApiUrl,
            imageModel,
            imageSize,
            prompt,
            imageApiKey,
            imageProvider,
            requestStableDiffusionOptions,
            [],
            transparentBackground,
          );
          response = await fetch(fallbackRequest.url, {
            method: 'POST',
            headers: imageRequestHeaders,
            body: JSON.stringify(fallbackRequest.body),
          });
          if (!response.ok) {
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

      let processedImageSrc = imageSrc as string;

      if (transparentBackground) {
        try {
          processedImageSrc = await ensureTransparentImageBackground(processedImageSrc);
        } catch (error) {
          console.error('Transparent background processing failed:', error);
          throw new Error(
            language === 'zh'
              ? '图片已生成，但无法转换为透明背景。请确认图片地址允许读取，或改用支持透明 PNG 的图片模型。'
              : language === 'ja'
                ? '画像は生成されましたが、透過背景に変換できませんでした。'
                : 'The image was generated, but it could not be converted to a transparent background.',
          );
        }
      }

      if (aspectRatio) {
        try {
          processedImageSrc = await ensureImageAspectRatio(processedImageSrc, aspectRatio);
        } catch (error) {
          console.error('Scene aspect ratio processing failed:', error);
          throw new Error(
            language === 'zh'
              ? '场景图片已生成，但无法转换为指定比例。请确认图片地址允许读取。'
              : language === 'ja'
                ? 'シーン画像は生成されましたが、指定比率に変換できませんでした。'
                : 'The scene image was generated, but it could not be converted to the requested ratio.',
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
      language,
      onMissingImageApiKeyRequest,
      setImageSize,
    ],
  );

  const handleGenerateSettingNodeImage = useCallback(
    async (id: string, type: 'character' | 'scene') => {
      const node = nodes.find((item) => item.id === id);
      if (!node) return;

      try {
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
            ? characterImageMode === 'transparent-sprite'
              ? formatCharacterSpritePromptText(node.data as Record<string, unknown>)
              : formatCharacterNodeText(node.data as Record<string, unknown>)
            : formatSceneNodeText(node.data as Record<string, unknown>);
        const basePrompt = [titleText, bodyText].filter(Boolean).join('\n\n').trim();

        if (!basePrompt) {
          alert(
            language === 'zh'
              ? '请先填写人物或场景设定。'
              : language === 'ja'
                ? '先にキャラクターまたはシーン設定を入力してください。'
                : 'Fill in the character or scene setting first.',
          );
          return;
        }

        const prompt =
          type === 'character'
            ? characterImageMode === 'transparent-sprite'
              ? `Create exactly ONE polished visual novel character sprite: one single front-facing full-body depiction of one character, with the entire figure visible from head to toe. This is NOT a character sheet and NOT a turnaround. Do not generate side views, back views, multiple poses, duplicate figures, panels, or comparison layouts. Use a transparent background with a clean alpha channel. If native alpha transparency is unavailable, use a perfectly uniform pure white (#FFFFFF) background so it can be removed cleanly. No scenery, floor, backdrop, cast shadow, text, labels, UI, or frame. Preserve the character design described below:\n\n${basePrompt}`
              : `Create a polished visual novel character design sheet with three views (front, side, back) in one image. Keep the same character consistent across all views. No text labels, no UI, clean neutral background. Character setting:\n\n${basePrompt}`
            : sceneImageMode === 'storyboard-16:9'
              ? `Create a polished cinematic visual novel storyboard frame in a wide 16:9 landscape composition. Focus on the environment, spatial layout, camera framing, mood, props, lighting, and color palette. Compose important subjects so they remain visible after a centered 16:9 crop. No text labels, no UI. Scene setting:\n\n${basePrompt}`
              : `Create a polished visual novel scene concept image from this setting. Focus on the environment, spatial layout, mood, props, lighting, and color palette. No text labels, no UI. Scene setting:\n\n${basePrompt}`;

        const forceSceneStoryboard = type === 'scene' && sceneImageMode === 'storyboard-16:9';
        const imageSrc = await requestGeneratedImage(prompt, {
          transparentBackground:
            type === 'character' && characterImageMode === 'transparent-sprite',
          negativePromptOverride:
            type === 'character' && characterImageMode === 'transparent-sprite'
              ? 'character sheet, turnaround, three views, multiple views, side view, back view, multiple poses, duplicate character, split panel, collage, contact sheet'
              : undefined,
          sizeOverride: forceSceneStoryboard ? '1920x1080' : undefined,
          aspectRatio: forceSceneStoryboard ? 16 / 9 : undefined,
        });
        if (!imageSrc) return;

        setNodes((nds) =>
          nds.map((current) => {
            if (current.id !== id) return current;

            if (type === 'character') {
              const currentOutfits = (current.data.outfits as any[]) || [];
              const previousAvatarUrl = current.data.avatarUrl as string | undefined;
              const hasArchivedAvatar = currentOutfits.some(
                (outfit) => outfit.imageUrl === previousAvatarUrl,
              );
              const archivedAvatarName =
                language === 'zh'
                  ? '上一张人物图片'
                  : language === 'ja'
                    ? '前のキャラクター画像'
                    : 'Previous Character Image';
              const nextOutfits =
                previousAvatarUrl && previousAvatarUrl !== imageSrc && !hasArchivedAvatar
                  ? [
                      {
                        id: uuidv4(),
                        name: archivedAvatarName,
                        imageUrl: previousAvatarUrl,
                      },
                      ...currentOutfits,
                    ]
                  : currentOutfits;

              return {
                ...current,
                data: {
                  ...current.data,
                  avatarUrl: imageSrc,
                  outfits: nextOutfits,
                  generatedSettingImageId: undefined,
                },
              };
            }

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

        if (type === 'character' && characterImageMode === 'transparent-sprite') {
          showToast(
            language === 'zh'
              ? '人物透明背景立绘已生成'
              : language === 'ja'
                ? '透明背景の立ち絵を生成しました'
                : 'Transparent character sprite generated',
          );
        } else
          showToast(
            type === 'character'
              ? language === 'zh'
                ? '人物三视图已生成'
                : language === 'ja'
                  ? 'キャラクター三面図が生成されました'
                  : 'Character three-view generated'
              : language === 'zh'
                ? '场景图片已生成'
                : language === 'ja'
                  ? 'シーン画像が生成されました'
                  : 'Scene image generated',
          );
      } catch (error: any) {
        console.error('Setting image generation failed:', error);
        alert(
          `${language === 'zh' ? '图片生成失败' : language === 'ja' ? '画像の生成に失敗しました' : 'Image generation failed'}: ${error.message || 'Unknown error'}`,
        );
      }
    },
    [
      characterImageMode,
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
        alert(
          language === 'zh'
            ? '请先在普通卡片里输入图片提示词。'
            : language === 'ja'
              ? '先にストーリーカードにプロンプトを入力してください。'
              : 'Enter an image prompt in the story card first.',
        );
        return;
      }
      if (!isLocalStableDiffusion && !imageApiKey.trim()) {
        onMissingImageApiKeyRequest?.();
        alert(
          language === 'zh'
            ? '请先在设置中填写图片生成 API 密钥。'
            : language === 'ja'
              ? '先に設定で画像生成APIキーを入力してください。'
              : 'Configure the image generation API key in Settings first.',
        );
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
        const prompt = `${basePrompt}${buildReferencePrompt(convertedReferences)}`;
        const imageRequest = buildImageGenerationRequest(
          imageApiUrl,
          imageModel,
          imageSize,
          prompt,
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

        const currentHeight = (node.style?.height as number) || 200;
        const currentWidth = (node.style?.width as number) || 280;
        const previousImageUrl = node.data.imageUrl as string | undefined;
        const nextHeight = Math.max(currentHeight, 260);

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
            style: { width: currentWidth, height: currentHeight },
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
        alert(
          `${language === 'zh' ? '图片生成失败' : language === 'ja' ? '画像の生成に失敗しました' : 'Image generation failed'}: ${error.message || 'Unknown error'}`,
        );
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
          { height: 200 },
        );

        const newNodes: Node[] = extractedMedia.map((media, index) => {
          const newId = uuidv4();
          const displayWidth = 300;
          const displayHeight = 200;
          return {
            id: newId,
            type: 'storyNode',
            position: {
              x: node.position.x + (index + 1) * 320,
              y: node.position.y,
            },
            style: {
              width: displayWidth,
              height: displayHeight + (showTitles ? TITLE_HEIGHT : 0),
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
