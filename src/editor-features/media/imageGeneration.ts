import type { Edge, Node } from '@xyflow/react';

export const DEFAULT_IMAGE_API_URL = 'https://ark.cn-beijing.volces.com/api/v3';
export const DEFAULT_IMAGE_MODEL = 'doubao-seedream-4-5-251128';
export const DEFAULT_IMAGE_SIZE = '2K';
const SEEDREAM_DIMENSION_SIZE = '2048x2048';
const SEEDREAM_MIN_PIXELS = 3686400;

export type ImageReference = {
  url: string;
  label: string;
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
  referenceImages: string[] = [],
) => {
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
    return {
      url: requestUrl,
      usesSeedream: true,
      body: {
        model: normalizedModel,
        prompt,
        ...(referenceImages.length > 0 ? { image: referenceImages } : {}),
        sequential_image_generation: 'disabled',
        response_format: 'url',
        size: normalizedSize,
        stream: false,
        watermark: true,
      },
    };
  }

  return {
    url: requestUrl,
    usesSeedream: false,
    body: {
      model: normalizedModel,
      prompt,
      size: normalizedSize,
      n: 1,
    },
  };
};
