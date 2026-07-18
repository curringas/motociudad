// Web replacement for `expo-image-manipulator`. Re-encodes the image via canvas,
// which strips EXIF and applies JPEG compression. Only the subset used by the app.
export const SaveFormat = { JPEG: 'jpeg', PNG: 'png' } as const;

type ManipulateResult = { uri: string; width: number; height: number };

export async function manipulateAsync(
  uri: string,
  _actions: unknown[],
  opts?: { compress?: number; format?: string },
): Promise<ManipulateResult> {
  const img = await loadImage(uri);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0);
  const mime = opts?.format === SaveFormat.PNG ? 'image/png' : 'image/jpeg';
  const quality = opts?.compress ?? 0.8;
  const dataUri = canvas.toDataURL(mime, quality);
  return { uri: dataUri, width: canvas.width, height: canvas.height };
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image: ' + uri));
    img.src = uri;
  });
}

export default { manipulateAsync, SaveFormat };
