export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

export function isImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

export function isVideoFile(file: File): boolean {
  return ACCEPTED_VIDEO_TYPES.includes(file.type);
}

export function isAcceptedMediaFile(file: File): boolean {
  return isImageFile(file) || isVideoFile(file);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function createFilename(prefix: string, extension: string): string {
  const date = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  return `${prefix}_${date}.${extension}`;
}
