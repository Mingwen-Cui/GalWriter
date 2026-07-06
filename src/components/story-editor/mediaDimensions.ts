export const TITLE_HEIGHT = 36;

/**
 * 获取媒体文件的原始尺尺寸 * @param url 媒体 URL (data: blob:)
 * @param type MIME 类型
 */
export const getMediaDimensions = (
  url: string,
  type: string,
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    if (type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 400, height: 300 });
      img.src = url;
    } else if (type.startsWith('video/')) {
      const video = document.createElement('video');
      video.onloadedmetadata = () =>
        resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => resolve({ width: 400, height: 300 });
      video.src = url;
    } else {
      resolve({ width: 400, height: 200 }); // 音频或其他
    }
  });
};
