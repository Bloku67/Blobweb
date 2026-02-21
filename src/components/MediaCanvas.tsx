import { useImageProcessor } from '@/hooks/useImageProcessor';
import type { EffectParams } from '@/hooks/useImageProcessor';
import type { MediaSource } from '../App';

interface MediaCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  mediaSource: MediaSource;
  mediaType: 'image' | 'video' | null;
  effectParams: EffectParams;
  showOriginal: boolean;
}

export function MediaCanvas({
  canvasRef,
  mediaSource,
  mediaType,
  effectParams,
  showOriginal,
}: MediaCanvasProps) {

  useImageProcessor(
    canvasRef,
    mediaSource,
    mediaType,
    effectParams,
    showOriginal
  );

  if (!mediaSource) {
    return (
      <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-8">
        <p>Upload an image or video to get started.</p>
      </div>
    );
  }

  const isVideo = mediaSource instanceof HTMLVideoElement;
  const width = isVideo ? mediaSource.videoWidth : (mediaSource as HTMLImageElement).naturalWidth;
  const height = isVideo ? mediaSource.videoHeight : (mediaSource as HTMLImageElement).naturalHeight;
  const maxDim = 1200;
  let displayW = width;
  let displayH = height;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      displayH = (height * maxDim) / width;
      displayW = maxDim;
    } else {
      displayW = (width * maxDim) / height;
      displayH = maxDim;
    }
  }

  return (
    <div className="flex items-center justify-center w-full">
      <canvas
        ref={canvasRef as React.RefObject<HTMLCanvasElement>}
        className="max-w-full max-h-[70vh] rounded-lg shadow-lg bg-black"
        style={{ width: displayW, height: displayH }}
      />
    </div>
  );
}
