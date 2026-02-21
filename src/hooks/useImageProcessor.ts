import { useCallback, useEffect, useRef } from 'react';
import { drawImageWithEffects, resetBlobTracking } from '@/utils/imageEffects';

export interface EffectParams {
  brightness: number;
  contrast: number;
  exposure: number;
  shadows: number;
  highlights: number;
  asciiIntensity: number;
  asciiCharSize: number;
  blobTrackingSensitivity: number;
  blobMaxCount: number;
  lineCount: number;
  lineDelay: number;
}

const MAX_DIM = 1200;

export function useImageProcessor(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  mediaSource: HTMLImageElement | HTMLVideoElement | null,
  mediaType: 'image' | 'video' | null,
  effectParams: EffectParams,
  showOriginal: boolean
) {
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mediaSource) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isVideo = mediaSource instanceof HTMLVideoElement;
    const sw = isVideo ? mediaSource.videoWidth : (mediaSource as HTMLImageElement).naturalWidth;
    const sh = isVideo ? mediaSource.videoHeight : (mediaSource as HTMLImageElement).naturalHeight;
    if (!sw || !sh) return;

    let w = sw;
    let h = sh;
    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) {
        h = (h * MAX_DIM) / w;
        w = MAX_DIM;
      } else {
        w = (w * MAX_DIM) / h;
        h = MAX_DIM;
      }
    }

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    if (showOriginal) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(mediaSource, 0, 0, sw, sh, 0, 0, w, h);
      return;
    }

    drawImageWithEffects(ctx, mediaSource, effectParams, w, h);
  }, [canvasRef, mediaSource, effectParams, showOriginal]);

  useEffect(() => {
    if (!mediaSource) {
      resetBlobTracking();
      return;
    }

    if (mediaType === 'video') {
      const video = mediaSource as HTMLVideoElement;
      
      // Ensure video is ready
      const handleLoadedData = () => {
        draw();
      };
      
      const tick = () => {
        if (video.readyState >= 2) {
          draw();
        }
        if (!video.paused && !video.ended) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      
      const handlePlay = () => {
        rafRef.current = requestAnimationFrame(tick);
      };
      const handlePause = () => {
        cancelAnimationFrame(rafRef.current);
      };
      const handleEnded = () => {
        cancelAnimationFrame(rafRef.current);
      };
      
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      
      // Initial draw
      if (video.readyState >= 2) {
        draw();
      }
      
      // Start loop if already playing
      if (!video.paused && !video.ended) {
        rafRef.current = requestAnimationFrame(tick);
      }
      
      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        cancelAnimationFrame(rafRef.current);
      };
    }

    draw();
  }, [mediaSource, mediaType, draw]);
}
