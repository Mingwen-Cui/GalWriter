export const getSafeDownloadName = (name: string, fallback = 'image') => {
  const plainName = name.replace(/<[^>]*>/g, '').trim() || fallback;
  return plainName.replace(/[\\/:*?"<>|]/g, '_');
};

export const getImageExtension = (imageUrl: string) =>
  imageUrl.match(/^data:image\/([^;]+)/i)?.[1]?.replace('jpeg', 'jpg') || 'png';

export async function downloadImageUrl(imageUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;

  try {
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      link.href = imageUrl;
    } else {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      link.href = URL.createObjectURL(blob);
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (link.href.startsWith('blob:') && !imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(link.href);
    }
  } catch (error) {
    console.error('Image download failed:', error);
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  }
}
