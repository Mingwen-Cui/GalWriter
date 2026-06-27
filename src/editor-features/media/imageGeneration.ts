import type { Edge, Node } from '@xyflow/react';

import { getTauriInvoke } from '../../lib/tauriRuntime';

export const DEFAULT_IMAGE_API_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const DEFAULT_IMAGE_MODEL = 'doubao-seedream-4-5-251128';
export const DEFAULT_IMAGE_SIZE = '2K';
export const LOCAL_STABLE_DIFFUSION_PROVIDER = 'local-stable-diffusion';
export const HOSTED_IMAGE_PROXY_PROVIDER = 'hosted-image';
export const DEFAULT_STABLE_DIFFUSION_API_URL = 'http://127.0.0.1:7860';
export const DEFAULT_STABLE_DIFFUSION_MODEL = 'stable-diffusion-webui';
export const DEFAULT_STABLE_DIFFUSION_SAMPLER = 'DPM++ 2M Karras';
export const DEFAULT_STABLE_DIFFUSION_STEPS = 20;
export const DEFAULT_STABLE_DIFFUSION_CFG_SCALE = 7;
const SEEDREAM_DIMENSION_SIZE = '2048x2048';
const SEEDREAM_MIN_PIXELS = 3686400;

export type ImageReference = {
  url: string;
  label: string;
};

export type StableDiffusionOptions = {
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  seed?: number;
  restoreFaces?: boolean;
  enableHr?: boolean;
  hrScale?: number;
  denoisingStrength?: number;
};

export const isLocalStableDiffusionProvider = (provider = '') =>
  provider === LOCAL_STABLE_DIFFUSION_PROVIDER;

export const isHostedImageProxyProvider = (provider = '') =>
  provider === HOSTED_IMAGE_PROXY_PROVIDER;

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
};

const parseImageDimensions = (size: string, fallback = 1024) => {
  const match = size.trim().match(/^(\d{3,5})\s*[xX*]\s*(\d{3,5})$/);
  if (!match) return { width: fallback, height: fallback };
  return {
    width: clampNumber(Number(match[1]), fallback, 64, 4096),
    height: clampNumber(Number(match[2]), fallback, 64, 4096),
  };
};

const normalizeStableDiffusionApiUrl = (url: string) => {
  const baseUrl = (url.trim() || DEFAULT_STABLE_DIFFUSION_API_URL).replace(/\/$/, '');
  if (/\/sdapi\/v1\/txt2img$/i.test(baseUrl)) return baseUrl;
  if (/\/sdapi\/v1$/i.test(baseUrl)) return `${baseUrl}/txt2img`;
  return `${baseUrl}/sdapi/v1/txt2img`;
};

const normalizeImageModel = (url: string, model: string, apiKey = '') => {
  const rawModel = model.trim();
  const usesArk = /ark\.cn-beijing\.volces\.com/i.test(url.trim());
  const usesArkKey = /^ark-/i.test(apiKey.trim());

  if (!rawModel) return DEFAULT_IMAGE_MODEL;
  if ((usesArk || usesArkKey) && rawModel === 'gpt-image-1') return DEFAULT_IMAGE_MODEL;
  return rawModel;
};

const normalizeImageApiUrl = (url: string, model: string, apiKey = '') => {
  const rawUrl = url.trim();
  const usesSeedream = /doubao|seedream/i.test(model.trim());
  const usesArkKey = /^ark-/i.test(apiKey.trim());

  if (!rawUrl) return DEFAULT_IMAGE_API_URL;
  if ((usesSeedream || usesArkKey) && rawUrl === 'https://api.openai.com/v1/images/generations')
    return DEFAULT_IMAGE_API_URL;
  if (/ark\.cn-beijing\.volces\.com\/?$/.test(rawUrl))
    return `${rawUrl.replace(/\/$/, '')}/api/v3/images/generations`;
  if (/\/api\/v3\/?$/.test(rawUrl)) return `${rawUrl.replace(/\/$/, '')}/images/generations`;
  return rawUrl;
};

const normalizeSeedreamSize = (size: string) => {
  const rawSize = size.trim();
  const sizeAliases: Record<string, string> = {
    '2k': '2K',
    '1:1': SEEDREAM_DIMENSION_SIZE,
    square: SEEDREAM_DIMENSION_SIZE,
  };

  const alias = sizeAliases[rawSize.toLowerCase()];
  if (alias) return alias;

  const match = rawSize.match(/^(\d{3,5})\s*[xX*]\s*(\d{3,5})$/);
  if (!match) return DEFAULT_IMAGE_SIZE;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_IMAGE_SIZE;
  }

  if (width * height >= SEEDREAM_MIN_PIXELS) return `${width}x${height}`;

  const scale = Math.sqrt(SEEDREAM_MIN_PIXELS / (width * height));
  const nextWidth = Math.ceil((width * scale) / 64) * 64;
  const nextHeight = Math.ceil((height * scale) / 64) * 64;
  return `${nextWidth}x${nextHeight}`;
};

const getEdgeHandleForNode = (edge: Edge, nodeId: string) => {
  if (edge.source === nodeId) return edge.sourceHandle || '';
  if (edge.target === nodeId) return edge.targetHandle || '';
  return '';
};

const pushUniqueReference = (
  references: ImageReference[],
  seen: Set<string>,
  url: unknown,
  label: string,
) => {
  if (typeof url !== 'string') return;
  const trimmed = url.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  references.push({ url: trimmed, label });
};

const collectCharacterImageReferences = (
  node: Node,
  references: ImageReference[],
  seen: Set<string>,
  handleId = '',
  labelPrefix = '',
) => {
  const characterName = ((node.data.characterName as string) || '角色').trim();
  const labelName = labelPrefix ? `${labelPrefix}${characterName}` : characterName;
  const outfits = (node.data.outfits as { id: string; name?: string; imageUrl?: string }[]) || [];
  const outfitId = handleId.match(/^outfit-(?:in|out)-(.+)$/)?.[1];
  const connectedOutfit = outfitId ? outfits.find((outfit) => outfit.id === outfitId) : null;

  if (connectedOutfit) {
    pushUniqueReference(
      references,
      seen,
      connectedOutfit.imageUrl,
      `${labelName} - ${connectedOutfit.name || '服装'}`,
    );
    return;
  }

  pushUniqueReference(references, seen, node.data.avatarUrl, `${labelName} - 头像`);
  outfits.forEach((outfit) => {
    pushUniqueReference(
      references,
      seen,
      outfit.imageUrl,
      `${labelName} - ${outfit.name || '服装'}`,
    );
  });
};

const collectSceneImageReferences = (
  node: Node,
  references: ImageReference[],
  seen: Set<string>,
  handleId = '',
  labelPrefix = '',
) => {
  const sceneName = ((node.data.sceneName as string) || '场景').trim();
  const labelName = labelPrefix ? `${labelPrefix}${sceneName}` : sceneName;
  const images = (node.data.images as { id: string; name?: string; imageUrl?: string }[]) || [];
  const imageId = handleId.match(/^image-(?:in|out)-(.+)$/)?.[1];
  const connectedImage = imageId ? images.find((image) => image.id === imageId) : null;

  if (connectedImage) {
    pushUniqueReference(
      references,
      seen,
      connectedImage.imageUrl,
      `${labelName} - ${connectedImage.name || '场景图'}`,
    );
    return;
  }

  pushUniqueReference(references, seen, node.data.coverImageUrl, `${labelName} - 封面`);
  images.forEach((image) => {
    pushUniqueReference(
      references,
      seen,
      image.imageUrl,
      `${labelName} - ${image.name || '场景图'}`,
    );
  });
};

export const getConnectedImageReferences = (
  allNodes: Node[],
  allEdges: Edge[],
  storyNodeId: string,
) => {
  const references: ImageReference[] = [];
  const seen = new Set<string>();
  const storyNode = allNodes.find((node) => node.id === storyNodeId);
  const currentImageUrl =
    typeof storyNode?.data?.imageUrl === 'string' ? storyNode.data.imageUrl.trim() : '';
  if (currentImageUrl) {
    seen.add(currentImageUrl);
  }
  const connectedEdges = allEdges.filter(
    (edge) => edge.source === storyNodeId || edge.target === storyNodeId,
  );
  const connectedNodeIds = new Set<string>();

  connectedEdges.forEach((edge) => {
    const connectedNodeId = edge.source === storyNodeId ? edge.target : edge.source;
    const connectedNode = allNodes.find((n) => n.id === connectedNodeId);
    if (!connectedNode) return;
    connectedNodeIds.add(connectedNode.id);

    if (connectedNode.type === 'characterNode') {
      const characterName = ((connectedNode.data.characterName as string) || '角色').trim();
      const outfits =
        (connectedNode.data.outfits as { id: string; name?: string; imageUrl?: string }[]) || [];
      const handleId = getEdgeHandleForNode(edge, connectedNode.id);
      const outfitId = handleId.match(/^outfit-(?:in|out)-(.+)$/)?.[1];
      const connectedOutfit = outfitId ? outfits.find((outfit) => outfit.id === outfitId) : null;

      if (connectedOutfit) {
        pushUniqueReference(
          references,
          seen,
          connectedOutfit.imageUrl,
          `${characterName} - ${connectedOutfit.name || '服装'}`,
        );
      } else {
        pushUniqueReference(
          references,
          seen,
          connectedNode.data.avatarUrl,
          `${characterName} - 头像`,
        );
        outfits.forEach((outfit) => {
          pushUniqueReference(
            references,
            seen,
            outfit.imageUrl,
            `${characterName} - ${outfit.name || '服装'}`,
          );
        });
      }
    }

    if (connectedNode.type === 'sceneNode') {
      const sceneName = ((connectedNode.data.sceneName as string) || '场景').trim();
      const images =
        (connectedNode.data.images as { id: string; name?: string; imageUrl?: string }[]) || [];
      const handleId = getEdgeHandleForNode(edge, connectedNode.id);
      const imageId = handleId.match(/^image-(?:in|out)-(.+)$/)?.[1];
      const connectedImage = imageId ? images.find((image) => image.id === imageId) : null;

      if (connectedImage) {
        pushUniqueReference(
          references,
          seen,
          connectedImage.imageUrl,
          `${sceneName} - ${connectedImage.name || '场景图'}`,
        );
      } else {
        pushUniqueReference(
          references,
          seen,
          connectedNode.data.coverImageUrl,
          `${sceneName} - 封面`,
        );
        images.forEach((image) => {
          pushUniqueReference(
            references,
            seen,
            image.imageUrl,
            `${sceneName} - ${image.name || '场景图'}`,
          );
        });
      }
    }
  });

  if (references.length > 0) {
    return references.slice(0, 10);
  }

  allNodes.forEach((node) => {
    if (connectedNodeIds.has(node.id) || node.data?.isGlobal === false) return;

    if (node.type === 'characterNode') {
      collectCharacterImageReferences(node, references, seen, '', '全局人物: ');
    }

    if (node.type === 'sceneNode') {
      collectSceneImageReferences(node, references, seen, '', '全局场景: ');
    }
  });

  return references.slice(0, 10);
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read reference image.'));
    reader.readAsDataURL(blob);
  });

export const toApiImageReference = async (url: string) => {
  if (/^data:image\//i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^blob:/i.test(url)) {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to read local reference image: HTTP ${response.status}`);
    return blobToDataUrl(await response.blob());
  }
  return url;
};

export const buildReferencePrompt = (references: ImageReference[]) => {
  if (references.length === 0) return '';

  const labels = references
    .map((reference, index) => `${index + 1}. ${reference.label}`)
    .join('\n');
  return `\n\n参考图要求：已附加以下人物/场景参考图，请尽量保持人物脸型、发型、服装、色彩特征，以及场景空间布局和氛围一致。不要照搬水印或界面元素。\n${labels}`;
};

export const buildImageGenerationRequest = (
  url: string,
  model: string,
  size: string,
  prompt: string,
  apiKey = '',
  provider = '',
  stableDiffusionOptions: StableDiffusionOptions = {},
  referenceImages: string[] = [],
  transparentBackground = false,
) => {
  const hostedProxyUrl = (() => {
    const configuredProxyUrl = url.trim();
    if (configuredProxyUrl && isHostedImageProxyProvider(provider)) return configuredProxyUrl;
    return 'api/proxy.php';
  })();

  if (isLocalStableDiffusionProvider(provider)) {
    const dimensions = parseImageDimensions(size);
    return {
      url: normalizeStableDiffusionApiUrl(url),
      provider,
      usesSeedream: false,
      usesStableDiffusion: true,
      body: {
        prompt,
        negative_prompt: stableDiffusionOptions.negativePrompt?.trim() || '',
        steps: clampNumber(stableDiffusionOptions.steps, DEFAULT_STABLE_DIFFUSION_STEPS, 1, 150),
        cfg_scale: clampNumber(
          stableDiffusionOptions.cfgScale,
          DEFAULT_STABLE_DIFFUSION_CFG_SCALE,
          1,
          30,
        ),
        sampler_name: stableDiffusionOptions.sampler?.trim() || DEFAULT_STABLE_DIFFUSION_SAMPLER,
        seed: clampNumber(stableDiffusionOptions.seed, -1, -1, 2147483647),
        width: dimensions.width,
        height: dimensions.height,
        batch_size: 1,
        n_iter: 1,
        restore_faces: Boolean(stableDiffusionOptions.restoreFaces),
        enable_hr: Boolean(stableDiffusionOptions.enableHr),
        hr_scale: clampNumber(stableDiffusionOptions.hrScale, 2, 1, 4),
        denoising_strength: clampNumber(stableDiffusionOptions.denoisingStrength, 0.7, 0, 1),
        ...(model.trim() && model.trim() !== DEFAULT_STABLE_DIFFUSION_MODEL
          ? { override_settings: { sd_model_checkpoint: model.trim() } }
          : {}),
      },
    };
  }

  const normalizedModel = normalizeImageModel(url, model, apiKey);
  const normalizedUrl = normalizeImageApiUrl(url, normalizedModel, apiKey);
  const usesSeedream =
    /doubao|seedream/i.test(normalizedModel) || /ark\.cn-beijing\.volces\.com/i.test(normalizedUrl);
  const localArkProxyUrl = (() => {
    if (typeof window === 'undefined') return '/api/ark-image';
    const origin = window.location.origin;
    const isViteDevOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):3000$/i.test(origin);
    return isViteDevOrigin ? '/api/ark-image' : 'http://127.0.0.1:3000/api/ark-image';
  })();
  const requestUrl =
    usesSeedream && /ark\.cn-beijing\.volces\.com/i.test(normalizedUrl) && import.meta.env.DEV
      ? localArkProxyUrl
      : normalizedUrl;
  const normalizedSize = usesSeedream ? normalizeSeedreamSize(size) : size.trim() || '1024x1024';

  if (usesSeedream) {
    const seedreamBody = {
      model: normalizedModel,
      prompt,
      ...(referenceImages.length > 0 ? { image: referenceImages } : {}),
      sequential_image_generation: 'disabled',
      response_format: 'url',
      size: normalizedSize,
      stream: false,
      watermark: true,
    };

    if (isHostedImageProxyProvider(provider)) {
      return {
        url: hostedProxyUrl,
        provider,
        usesSeedream: true,
        usesStableDiffusion: false,
        body: {
          type: 'image',
          provider: 'doubao',
          payload: seedreamBody,
        },
      };
    }

    return {
      url: requestUrl,
      provider,
      usesSeedream: true,
      usesStableDiffusion: false,
      body: seedreamBody,
    };
  }

  const genericBody = {
    model: normalizedModel,
    prompt,
    size: normalizedSize,
    n: 1,
    ...(transparentBackground && /gpt-image/i.test(normalizedModel)
      ? {
          background: 'transparent',
          output_format: 'png',
        }
      : {}),
  };

  if (isHostedImageProxyProvider(provider)) {
    return {
      url: hostedProxyUrl,
      provider,
      usesSeedream: false,
      usesStableDiffusion: false,
      body: {
        type: 'image',
        provider: 'image',
        payload: genericBody,
      },
    };
  }

  return {
    url: requestUrl,
    provider,
    usesSeedream: false,
    usesStableDiffusion: false,
    body: genericBody,
  };
};

const buildSubjectSegmentationPayload = (imageUrl: string) => {
  const dataUrlMatch = imageUrl.match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i);
  if (dataUrlMatch) return { image_base64: dataUrlMatch[1] };
  if (/^https?:\/\//i.test(imageUrl)) return { image_url: imageUrl };
  return { image_base64: imageUrl };
};

const isAliyunImageSegUrl = (url: string) => /imageseg\.[a-z0-9-]+\.aliyuncs\.com\/?$/i.test(url);
const isVolcengineImageXUrl = (url: string) =>
  /imagex\.volcengineapi\.com\/?\?Action=AIProcess&Version=2023-05-01/i.test(url);

const parseAccessKeyPair = (apiKey = '', providerLabel: string) => {
  const [accessKeyId, ...secretParts] = apiKey.trim().split(':');
  const accessKeySecret = secretParts.join(':');
  if (!accessKeyId?.trim() || !accessKeySecret?.trim()) {
    throw new Error(`${providerLabel} requires API Key in AccessKeyId:AccessKeySecret format.`);
  }
  return {
    accessKeyId: accessKeyId.trim(),
    accessKeySecret: accessKeySecret.trim(),
  };
};

const requirePublicImageUrl = (imageUrl: string, providerLabel: string) => {
  if (!/^https?:\/\//i.test(imageUrl)) {
    throw new Error(
      `${providerLabel} requires the source image to be a public HTTP/HTTPS URL. Local blob/base64 images must be uploaded first.`,
    );
  }
};

const requestAliyunImageSeg = async (url: string, imageUrl: string, apiKey = '', model = '') => {
  requirePublicImageUrl(imageUrl, 'Alibaba Cloud ImageSeg');
  const { accessKeyId, accessKeySecret } = parseAccessKeyPair(apiKey, 'Alibaba Cloud ImageSeg');
  const action = model.trim() || 'SegmentBody';
  const invoke = await getTauriInvoke();
  if (!invoke) {
    throw new Error('Alibaba Cloud ImageSeg requires the desktop app native proxy for signed requests.');
  }
  const text = String(
    await invoke('proxy_aliyun_imageseg_request', {
      endpoint: url,
      accessKeyId,
      accessKeySecret,
      action,
      imageUrl,
    }),
  );
  const result = JSON.parse(text);
  const image =
    result?.Data?.ImageURL ||
    result?.Data?.ImageUrl ||
    result?.Data?.URL ||
    result?.Data?.Url ||
    result?.Data?.Image ||
    result?.data?.image_url ||
    result?.image_url;
  if (!image || typeof image !== 'string') {
    throw new Error(text || 'Alibaba Cloud ImageSeg returned no transparent image URL.');
  }
  return image;
};

const requestVolcengineImageX = async (url: string, imageUrl: string, apiKey = '', model = '') => {
  requirePublicImageUrl(imageUrl, 'Volcengine veImageX');
  const { accessKeyId, accessKeySecret } = parseAccessKeyPair(apiKey, 'Volcengine veImageX');
  const [modelId = 'humanv2', serviceId = '', deliveryDomain = ''] = model
    .split('|')
    .map((item) => item.trim());
  if (!serviceId) {
    throw new Error('Volcengine veImageX requires Model in humanv2|ServiceId|delivery-domain format.');
  }
  const invoke = await getTauriInvoke();
  if (!invoke) {
    throw new Error('Volcengine veImageX requires the desktop app native proxy for signed requests.');
  }
  const text = String(
    await invoke('proxy_volcengine_imagex_request', {
      endpoint: url,
      accessKeyId,
      accessKeySecret,
      serviceId,
      imageUrl,
      modelId: modelId || 'humanv2',
    }),
  );
  const result = JSON.parse(text);
  const output = result?.Result?.Output ? JSON.parse(result.Result.Output) : result?.Result || result;
  const directUrl = output?.Url || output?.URL || output?.ImageUrl || output?.ImageURL;
  if (typeof directUrl === 'string' && /^https?:\/\//i.test(directUrl)) return directUrl;
  const objectKey = output?.ObjectKey;
  if (typeof objectKey === 'string' && objectKey) {
    if (!deliveryDomain) {
      throw new Error(
        `Volcengine veImageX returned ObjectKey "${objectKey}", but no delivery domain was configured. Put humanv2|ServiceId|https://your-imagex-domain in Model.`,
      );
    }
    return `${deliveryDomain.replace(/\/+$/, '')}/${objectKey.replace(/^\/+/, '')}`;
  }
  throw new Error(text || 'Volcengine veImageX returned no usable image URL.');
};

export const requestSubjectSegmentation = async (
  imageUrl: string,
  options: {
    apiUrl?: string;
    apiKey?: string;
    reqKey?: string;
    useHostedProxy?: boolean;
    bundledWithImageGeneration?: boolean;
  } = {},
) => {
  const configuredUrl = options.apiUrl?.trim() || '';
  const useHostedProxy =
    Boolean(options.useHostedProxy) || /(?:^|\/)proxy\.php(?:$|[?#])/i.test(configuredUrl);
  const url = useHostedProxy ? configuredUrl || 'api/proxy.php' : configuredUrl;
  if (!url) {
    throw new Error('Subject segmentation API URL is required.');
  }
  if (!useHostedProxy && isAliyunImageSegUrl(url)) {
    return requestAliyunImageSeg(url, imageUrl, options.apiKey, options.reqKey);
  }
  if (!useHostedProxy && isVolcengineImageXUrl(url)) {
    return requestVolcengineImageX(url, imageUrl, options.apiKey, options.reqKey);
  }

  const body = useHostedProxy
    ? {
        type: 'segment',
        image: imageUrl,
        bundled_with_image_generation: Boolean(options.bundledWithImageGeneration),
      }
    : buildSubjectSegmentationPayload(imageUrl);

  let responseText = '';

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.apiKey?.trim() ? { Authorization: `Bearer ${options.apiKey.trim()}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `Subject segmentation request could not reach ${url}. Check CORS/proxy settings and network connectivity. ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  responseText = await response.text();
  if (!response.ok) {
    throw new Error(responseText || `HTTP ${response.status}`);
  }

  const result = JSON.parse(responseText);
  const image =
    result?.image ||
    result?.image_url ||
    result?.url ||
    result?.data?.image ||
    result?.data?.image_url ||
    result?.data?.image_base64 ||
    result?.data?.binary_data_base64?.[0] ||
    result?.data?.image_urls?.[0] ||
    result?.data?.[0]?.b64_json ||
    result?.data?.[0]?.url ||
    result?.Result?.Image ||
    result?.Result?.ImageUrl ||
    result?.Result?.image ||
    result?.Result?.image_url;

  if (!image || typeof image !== 'string') {
    throw new Error('Subject segmentation returned no usable image.');
  }

  if (/^data:image\//i.test(image) || /^https?:\/\//i.test(image)) return image;
  return `data:image/png;base64,${image}`;
};

const loadImageSource = async (imageUrl: string) => {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to read generated image: HTTP ${response.status}`);
  const blob = await response.blob();
  return createImageBitmap(blob);
};

const colorDistance = (
  red: number,
  green: number,
  blue: number,
  background: readonly [number, number, number],
) =>
  Math.sqrt(
    (red - background[0]) ** 2 + (green - background[1]) ** 2 + (blue - background[2]) ** 2,
  );

export const ensureTransparentImageBackground = async (imageUrl: string) => {
  const bitmap = await loadImageSource(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error('Canvas is unavailable.');
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  let hasTransparentPixel = false;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 250) {
      hasTransparentPixel = true;
      break;
    }
  }
  if (hasTransparentPixel) return canvas.toDataURL('image/png');

  const cornerOffsets = [
    0,
    (canvas.width - 1) * 4,
    (canvas.height - 1) * canvas.width * 4,
    (canvas.height * canvas.width - 1) * 4,
  ];
  const background = cornerOffsets
    .map((offset) => [pixels[offset], pixels[offset + 1], pixels[offset + 2]] as const)
    .reduce((sum, color) => [sum[0] + color[0], sum[1] + color[1], sum[2] + color[2]] as const, [
      0, 0, 0,
    ] as const)
    .map((value) => value / cornerOffsets.length) as [number, number, number];

  const width = canvas.width;
  const height = canvas.height;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;
  const removalThreshold = 82;

  const enqueueIfBackground = (pixelIndex: number) => {
    if (visited[pixelIndex]) return;
    const offset = pixelIndex * 4;
    if (
      colorDistance(pixels[offset], pixels[offset + 1], pixels[offset + 2], background) >
      removalThreshold
    ) {
      return;
    }
    visited[pixelIndex] = 1;
    queue[queueEnd++] = pixelIndex;
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfBackground(x);
    enqueueIfBackground((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueueIfBackground(y * width);
    enqueueIfBackground(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart++];
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const offset = pixelIndex * 4;
    const distance = colorDistance(
      pixels[offset],
      pixels[offset + 1],
      pixels[offset + 2],
      background,
    );
    pixels[offset + 3] = Math.round(255 * Math.max(0, (distance - 18) / 64));

    if (x > 0) enqueueIfBackground(pixelIndex - 1);
    if (x + 1 < width) enqueueIfBackground(pixelIndex + 1);
    if (y > 0) enqueueIfBackground(pixelIndex - width);
    if (y + 1 < height) enqueueIfBackground(pixelIndex + width);
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

export const ensureImageAspectRatio = async (imageUrl: string, targetRatio: number) => {
  const bitmap = await loadImageSource(imageUrl);
  const sourceRatio = bitmap.width / bitmap.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = bitmap.width;
  let sourceHeight = bitmap.height;

  if (sourceRatio > targetRatio) {
    sourceWidth = Math.round(bitmap.height * targetRatio);
    sourceX = Math.round((bitmap.width - sourceWidth) / 2);
  } else if (sourceRatio < targetRatio) {
    sourceHeight = Math.round(bitmap.width / targetRatio);
    sourceY = Math.round((bitmap.height - sourceHeight) / 2);
  }

  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Canvas is unavailable.');
  }

  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  return canvas.toDataURL('image/png');
};
