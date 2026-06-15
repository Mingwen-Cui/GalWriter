import type { Node } from '@xyflow/react';
import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { Language } from '../../lib/i18n';

interface UseCanvasDnDParams {
  canvasWrapperRef: React.RefObject<HTMLDivElement | null>;
  tx: number;
  ty: number;
  tzoom: number;
  showTitles: boolean;
  language: Language;
  titleHeight: number;
  getMediaDimensions: (url: string, type: string) => Promise<{ width: number; height: number }>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

export const useCanvasDnD = ({
  canvasWrapperRef,
  tx,
  ty,
  tzoom,
  showTitles,
  language,
  titleHeight,
  getMediaDimensions,
  setNodes,
}: UseCanvasDnDParams) => {
  useEffect(() => {
    const handleGlobalDragOver = (event: DragEvent) => {
      if ((event.target as HTMLElement)?.closest('.react-flow')) return;
      event.preventDefault();
    };

    const handleGlobalDrop = (event: DragEvent) => {
      if ((event.target as HTMLElement)?.closest('.react-flow')) return;
      event.preventDefault();
    };

    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);

    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  useEffect(() => {
    const element = canvasWrapperRef.current;
    if (!element) return;

    const handleNativeDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
    };

    const handleNativeDrop = async (event: DragEvent) => {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      const renderer = element.querySelector('.react-flow__renderer') ?? element;
      const bounds = renderer.getBoundingClientRect();
      const dropX = (event.clientX - bounds.left - tx) / tzoom;
      const dropY = (event.clientY - bounds.top - ty) / tzoom;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (
          !file.type.startsWith('image/') &&
          !file.type.startsWith('video/') &&
          !file.type.startsWith('audio/')
        ) {
          continue;
        }

        const url = URL.createObjectURL(file);
        const newId = uuidv4();

        let mediaData: Record<string, string> = {};
        let title =
          language === 'zh'
            ? '导入文件'
            : language === 'ja'
              ? 'ファイルをインポート'
              : 'Import File';

        const { width, height } = await getMediaDimensions(url, file.type);
        let displayWidth = 400;
        let displayHeight = (height / width) * displayWidth;

        if (displayHeight > 500) {
          displayHeight = 500;
          displayWidth = (width / height) * displayHeight;
        }

        if (file.type.startsWith('image/')) {
          mediaData = { imageUrl: url };
          title =
            language === 'zh'
              ? '导入图片'
              : language === 'ja'
                ? '画像をインポート'
                : 'Import Image';
        } else if (file.type.startsWith('video/')) {
          mediaData = { videoUrl: url };
          title =
            language === 'zh'
              ? '导入视频'
              : language === 'ja'
                ? '動画をインポート'
                : 'Import Video';
        } else if (file.type.startsWith('audio/')) {
          mediaData = { audioUrl: url };
          title =
            language === 'zh'
              ? '导入音频'
              : language === 'ja'
                ? '音声ファイルをインポート'
                : 'Import Audio';
          displayWidth = 300;
          displayHeight = 150;
        }

        const newNode: Node = {
          id: newId,
          type: 'storyNode',
          position: {
            x: dropX + i * 30 - displayWidth / 2,
            y: dropY + i * 30 - displayHeight / 2,
          },
          style: { width: displayWidth, height: displayHeight + (showTitles ? titleHeight : 0) },
          data: {
            id: newId,
            title,
            shape: 'square',
            color: '#ffffff',
            sizeMode: 'auto',
            text: '',
            objectFit: 'playtest',
            titleHeightAdded: showTitles,
            ...mediaData,
          },
        };

        setNodes((currentNodes) => [...currentNodes, newNode]);
      }
    };

    element.addEventListener('dragover', handleNativeDragOver, { capture: true });
    element.addEventListener('drop', handleNativeDrop, { capture: true });

    return () => {
      element.removeEventListener('dragover', handleNativeDragOver, { capture: true });
      element.removeEventListener('drop', handleNativeDrop, { capture: true });
    };
  }, [
    canvasWrapperRef,
    getMediaDimensions,
    language,
    setNodes,
    showTitles,
    titleHeight,
    tx,
    ty,
    tzoom,
  ]);
};
