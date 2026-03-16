import { useCallback, useEffect, useRef } from 'react';
import { drawImageWithEffects, resetBlobTracking } from '@/utils/imageEffects';
import { 
  getShaderProcessor, 
  disposeShaderProcessor,
  type ShaderEffectParams,
  defaultShaderParams 
} from '@/utils/webglShaders';

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
  // WebGL Shader effects
  shaderParams: ShaderEffectParams;
}

export const defaultEffectParams: EffectParams = {
  brightness: 100,
  contrast: 100,
  exposure: 0,
  shadows: 0,
  highlights: 0,
  asciiIntensity: 0,
  asciiCharSize: 8,
  blobTrackingSensitivity: 0,
  blobMaxCount: 5,
  lineCount: 0,
  lineDelay: 5,
  shaderParams: defaultShaderParams,
};

const MAX_DIM = 1200;

export function useImageProcessor(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  mediaSource: HTMLImageElement | HTMLVideoElement | null,
  mediaType: 'image' | 'video' | null,
  effectParams: EffectParams,
  showOriginal: boolean
) {
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const shaderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processorRef = useRef<ReturnType<typeof getShaderProcessor> | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mediaSource) return;

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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Show original without any effects
    if (showOriginal) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(mediaSource, 0, 0, sw, sh, 0, 0, w, h);
      return;
    }

    // Check if shaders are enabled
    const shadersEnabled = effectParams.shaderParams?.enabled ?? false;
    
    if (shadersEnabled) {
      // Initialize shader processor
      if (!processorRef.current) {
        processorRef.current = getShaderProcessor();
      }
      
      // Create offscreen canvas for shader processing if needed
      if (!shaderCanvasRef.current) {
        shaderCanvasRef.current = document.createElement('canvas');
      }
      
      const shaderCanvas = shaderCanvasRef.current;
      
      // Initialize WebGL context
      const initialized = processorRef.current.initialize(shaderCanvas);
      
      if (initialized) {
        // Calculate time for animated effects
        const time = (Date.now() - startTimeRef.current) / 1000;
        
        // Apply WebGL shader effects
        processorRef.current.process(mediaSource, effectParams.shaderParams, time);
        
        // Draw shader result to main canvas
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(shaderCanvas, 0, 0, w, h);
        
        // Check if we need to apply 2D effects on top
        const has2DEffects = 
          effectParams.brightness !== 100 ||
          effectParams.contrast !== 100 ||
          effectParams.exposure !== 0 ||
          effectParams.shadows !== 0 ||
          effectParams.highlights !== 0 ||
          effectParams.asciiIntensity > 0 ||
          effectParams.blobTrackingSensitivity > 0;
        
        if (has2DEffects) {
          // Apply 2D effects to the already shader-processed image
          const tempParams = { ...effectParams };
          // Disable shaders to prevent recursion
          tempParams.shaderParams = { ...effectParams.shaderParams, enabled: false };
          
          // Create a temporary image from the canvas
          const tempImage = new Image();
          tempImage.src = canvas.toDataURL();
          
          // Apply 2D effects
          drawImageWithEffects(ctx, tempImage, tempParams, w, h);
        }
      } else {
        // Fallback to 2D canvas if WebGL fails
        drawImageWithEffects(ctx, mediaSource, effectParams, w, h);
      }
    } else {
      // Use standard 2D canvas processing
      drawImageWithEffects(ctx, mediaSource, effectParams, w, h);
    }
  }, [canvasRef, mediaSource, effectParams, showOriginal]);

  useEffect(() => {
    if (!mediaSource) {
      resetBlobTracking();
      return;
    }

    if (mediaType === 'video') {
      const video = mediaSource as HTMLVideoElement;
      
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
        startTimeRef.current = Date.now();
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
      
      if (video.readyState >= 2) {
        draw();
      }
      
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      disposeShaderProcessor();
      processorRef.current = null;
      shaderCanvasRef.current = null;
    };
  }, []);
}
