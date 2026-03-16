import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { EffectParams } from '@/hooks/useImageProcessor';
import type { BlobBox } from './imageEffects';
import { createBlobTrackingState, resetBlobTrackingState, type ProgressCallback } from './videoExportState';

const DEFAULT_FPS = 30;
const FRAME_TIME_SAMPLE_MS = 500;
const MAX_CANVAS_DIMENSION = 1920; // Prevent memory issues
const BATCH_FRAMES = 30; // Process this many frames before yielding to event loop

interface VideoExportOptions {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  effectParams: EffectParams;
  onProgress?: ProgressCallback;
  onChunk?: (blob: Blob) => void; // Stream chunks instead of buffering
  quality?: 'low' | 'medium' | 'high';
}

interface ExportResult {
  blob: Blob;
  fps: number;
  width: number;
  height: number;
  duration: number;
}

// FFmpeg singleton with lazy loading
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadingPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadingPromise) return ffmpegLoadingPromise;

  ffmpegLoadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoadingPromise;
}

/**
 * Detect FPS from video using requestVideoFrameCallback
 */
function detectVideoFPS(video: HTMLVideoElement): Promise<number> {
  const rvfc = (video as HTMLVideoElement & { 
    requestVideoFrameCallback?: (cb: (now: number, metadata: { mediaTime: number; presentedFrames: number }) => void) => number 
  }).requestVideoFrameCallback;

  if (!rvfc || typeof rvfc !== 'function') {
    return Promise.resolve(DEFAULT_FPS);
  }

  return new Promise((resolve) => {
    let frameCount = 0;
    const startTime = performance.now();
    let resolved = false;

    const tick = (_now: number, _metadata: { mediaTime: number; presentedFrames: number }) => {
      if (resolved) return;
      frameCount++;
      
      const elapsed = performance.now() - startTime;
      if (elapsed >= FRAME_TIME_SAMPLE_MS) {
        resolved = true;
        const fps = Math.round((frameCount / elapsed) * 1000);
        resolve(Math.min(60, Math.max(1, fps)) || DEFAULT_FPS);
        return;
      }
      
      rvfc.call(video, tick);
    };

    // Ensure video is playing for accurate frame timing
    video.currentTime = 0;
    
    rvfc.call(video, tick);
    
    // Timeout fallback
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(DEFAULT_FPS);
      }
    }, FRAME_TIME_SAMPLE_MS + 200);
  });
}

/**
 * Calculate optimal canvas size based on quality setting
 */
function getExportDimensions(
  videoWidth: number, 
  videoHeight: number, 
  quality: 'low' | 'medium' | 'high'
): { width: number; height: number } {
  const maxDim = quality === 'low' ? 720 : quality === 'medium' ? 1080 : MAX_CANVAS_DIMENSION;
  
  let w = videoWidth;
  let h = videoHeight;
  
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }
  
  // Ensure even dimensions for codec compatibility
  w = Math.floor(w / 2) * 2;
  h = Math.floor(h / 2) * 2;
  
  return { width: w, height: h };
}

/**
 * Render a single frame with isolated state
 */
function renderFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  effectParams: EffectParams,
  width: number,
  height: number,
  trackingState: ReturnType<typeof createBlobTrackingState>
): void {
  const sw = video.videoWidth;
  const sh = video.videoHeight;
  
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(video, 0, 0, sw, sh, 0, 0, width, height);

  // Get image data for processing
  const imageData = ctx.getImageData(0, 0, width, height);
  
  // Apply lighting effects
  if (effectParams.brightness !== 100 || effectParams.contrast !== 100 || 
      effectParams.exposure !== 0 || effectParams.shadows !== 0 || effectParams.highlights !== 0) {
    applyLightingToImageData(imageData, effectParams);
    ctx.putImageData(imageData, 0, 0);
  }

  // Detect blobs if needed
  let blobs: BlobBox[] = [];
  if (effectParams.blobTrackingSensitivity > 0 || effectParams.asciiIntensity > 0) {
    blobs = detectBlobsWithState(ctx, width, height, effectParams, trackingState);
  }

  // Apply ASCII effect
  if (effectParams.asciiIntensity > 0) {
    applyAsciiEffectWithState(ctx, width, height, effectParams, blobs);
  }

  // Draw blob boxes and lines
  if (effectParams.blobTrackingSensitivity > 0 && blobs.length > 0) {
    drawBlobBoxes(ctx, blobs);
    if (effectParams.lineCount > 0) {
      drawBlobLinesWithState(ctx, blobs, effectParams, trackingState);
    }
  }
}

/**
 * Apply lighting effects to ImageData in-place
 */
function applyLightingToImageData(
  imageData: ImageData,
  params: Pick<EffectParams, 'brightness' | 'contrast' | 'exposure' | 'shadows' | 'highlights'>
): void {
  const { data } = imageData;
  const brightness = (params.brightness - 100) * 2.55;
  const contrast = params.contrast / 100;
  const exposureMult = Math.pow(2, params.exposure);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Apply contrast and brightness
    r = (r - 128) * contrast + 128 + brightness;
    g = (g - 128) * contrast + 128 + brightness;
    b = (b - 128) * contrast + 128 + brightness;

    // Apply exposure
    r *= exposureMult;
    g *= exposureMult;
    b *= exposureMult;

    // Shadows and highlights
    if (lum < 0.5) {
      const lift = 1 + params.shadows / 100;
      r *= lift;
      g *= lift;
      b *= lift;
    } else {
      const lift = 1 - params.highlights / 100;
      r *= lift;
      g *= lift;
      b *= lift;
    }

    data[i] = Math.min(255, Math.max(0, Math.round(r)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
  }
}

/**
 * Blob detection with isolated state
 */
function detectBlobsWithState(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: EffectParams,
  state: ReturnType<typeof createBlobTrackingState>
): BlobBox[] {
  const DETECT_SCALE = 0.25;
  const SMOOTH_ALPHA = 0.25;
  const MOVE_THRESHOLD = 1.5;
  
  // Smooth sensitivity
  state.smoothedSensitivity = SMOOTH_ALPHA * params.blobTrackingSensitivity + 
                              (1 - SMOOTH_ALPHA) * state.smoothedSensitivity;
  
  // Downscale for detection
  const dw = Math.max(80, Math.floor(width * DETECT_SCALE));
  const dh = Math.max(60, Math.floor(height * DETECT_SCALE));
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = dw;
  tempCanvas.height = dh;
  const tCtx = tempCanvas.getContext('2d');
  if (!tCtx) return [];
  
  tCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, dw, dh);
  const imageData = tCtx.getImageData(0, 0, dw, dh);
  
  // Flood fill blob detection
  const threshold = Math.floor((state.smoothedSensitivity / 100) * 200);
  const blobs: BlobBox[] = [];
  const visited = new Set<number>();
  const step = Math.max(2, Math.floor(dw / 80));
  const maxBlobs = Math.max(1, params.blobMaxCount);
  
  const getPixel = (x: number, y: number): number => {
    if (x < 0 || x >= dw || y < 0 || y >= dh) return 0;
    const idx = (y * dw + x) * 4;
    return ((0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2]) / 255) * 255;
  };
  
  for (let y = 0; y < dh && blobs.length < maxBlobs; y += step) {
    for (let x = 0; x < dw && blobs.length < maxBlobs; x += step) {
      const key = y * dw + x;
      if (visited.has(key)) continue;
      
      const lum = getPixel(x, y);
      if (lum < threshold) continue;
      
      // Flood fill
      const stack: [number, number][] = [[x, y]];
      let minX = x, maxX = x, minY = y, maxY = y;
      let count = 0;
      
      while (stack.length > 0 && count < 200) {
        const [cx, cy] = stack.pop()!;
        const cKey = cy * dw + cx;
        if (visited.has(cKey)) continue;
        
        const cLum = getPixel(cx, cy);
        if (cLum < threshold) continue;
        
        visited.add(cKey);
        count++;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        
        stack.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
      }
      
      if (count < 4) continue;
      
      // Calculate velocity from previous frame
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      let vx = 0, vy = 0;
      
      if (state.previousBlobCenters.length > 0) {
        let minDist = Infinity;
        let closest = -1;
        for (let i = 0; i < state.previousBlobCenters.length; i++) {
          const p = state.previousBlobCenters[i];
          const dist = Math.sqrt((cx - p.x) ** 2 + (cy - p.y) ** 2);
          if (dist < minDist && dist < 80) {
            minDist = dist;
            closest = i;
          }
        }
        if (closest >= 0) {
          vx = cx - state.previousBlobCenters[closest].x;
          vy = cy - state.previousBlobCenters[closest].y;
        }
      }
      
      blobs.push({
        minX: (minX / dw) * width,
        minY: (minY / dh) * height,
        maxX: (maxX / dw) * width,
        maxY: (maxY / dh) * height,
        vx,
        vy,
        isMoving: Math.sqrt(vx * vx + vy * vy) >= MOVE_THRESHOLD,
      });
    }
  }
  
  // Update state for next frame
  state.previousBlobCenters = blobs.map(b => ({
    x: ((b.minX + b.maxX) / 2) / width * dw,
    y: ((b.minY + b.maxY) / 2) / height * dh,
  }));
  
  return blobs;
}

/**
 * Draw blob boxes
 */
function drawBlobBoxes(ctx: CanvasRenderingContext2D, blobs: BlobBox[]): void {
  if (blobs.length === 0) return;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  
  for (const b of blobs) {
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    if (w > 2 && h > 2) {
      ctx.strokeRect(b.minX, b.minY, w, h);
    }
  }
}

/**
 * ASCII effect with proper blending
 */
function applyAsciiEffectWithState(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: EffectParams,
  blobs: BlobBox[]
): void {
  const ASCII_CHARS = '#$%^&*';
  const BRIGHT_THRESHOLD = 0.45;
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const cellSize = Math.max(3, Math.min(20, params.asciiCharSize));
  const cols = Math.floor(width / cellSize);
  const rows = Math.floor(height / cellSize);
  const blendAlpha = params.asciiIntensity / 100;
  
  ctx.fillStyle = '#ffffff';
  ctx.font = `${cellSize * 0.8}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = blendAlpha;
  
  const cellInBlob = (cx: number, cy: number): boolean => {
    for (const b of blobs) {
      if (cx >= b.minX && cx <= b.maxX && cy >= b.minY && cy <= b.maxY) return true;
    }
    return false;
  };
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellSize;
      const y = row * cellSize;
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      
      let totalLum = 0;
      let count = 0;
      
      for (let dy = 0; dy < cellSize && y + dy < height; dy++) {
        for (let dx = 0; dx < cellSize && x + dx < width; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          totalLum += (0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2]) / 255;
          count++;
        }
      }
      
      const avgLum = count > 0 ? totalLum / count : 0;
      if (avgLum < BRIGHT_THRESHOLD && !cellInBlob(cx, cy)) continue;
      
      const charIndex = Math.floor((1 - avgLum) * (ASCII_CHARS.length - 1));
      ctx.fillText(ASCII_CHARS[Math.max(0, Math.min(ASCII_CHARS.length - 1, charIndex))], cx, cy);
    }
  }
  
  ctx.globalAlpha = 1;
}

/**
 * Draw blob lines with state
 */
function drawBlobLinesWithState(
  ctx: CanvasRenderingContext2D,
  blobs: BlobBox[],
  params: EffectParams,
  state: ReturnType<typeof createBlobTrackingState>
): void {
  if (blobs.length === 0 || params.lineCount <= 0) return;
  
  const center = (b: BlobBox) => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  
  for (let i = 0; i < blobs.length; i++) {
    const c = center(blobs[i]);
    if (state.previousBlobBoxesForLines.length > 0) {
      let bestJ = 0, bestD = Infinity;
      for (let j = 0; j < state.previousBlobBoxesForLines.length; j++) {
        const p = center(state.previousBlobBoxesForLines[j]);
        const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          bestJ = j;
        }
      }
      const p = center(state.previousBlobBoxesForLines[bestJ]);
      segments.push({ x1: p.x, y1: p.y, x2: c.x, y2: c.y });
    }
    for (let j = i + 1; j < blobs.length && segments.length < 50; j++) {
      const c2 = center(blobs[j]);
      segments.push({ x1: c.x, y1: c.y, x2: c2.x, y2: c2.y });
    }
  }
  
  state.previousBlobBoxesForLines = blobs.slice();
  
  const delaySteps = Math.max(1, Math.floor(params.lineDelay));
  state.lineRevealCounter++;
  const numToDraw = Math.min(params.lineCount, Math.min(segments.length, 
    Math.floor(state.lineRevealCounter / delaySteps)));
  
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  
  for (let i = 0; i < numToDraw; i++) {
    const s = segments[i % segments.length];
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
}

/**
 * Main export function - frame-accurate video rendering
 */
export async function exportVideo(options: VideoExportOptions): Promise<ExportResult> {
  const { video, canvas, effectParams, onProgress, quality = 'medium' } = options;
  
  if (!video.videoWidth || !video.duration) {
    throw new Error('Invalid video source');
  }
  
  // Get dimensions
  const { width, height } = getExportDimensions(video.videoWidth, video.videoHeight, quality);
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  // Detect FPS
  onProgress?.({ 
    stage: 'preparing', 
    progress: 10, 
    frame: 0, 
    totalFrames: 0, 
    estimatedTimeRemaining: 0 
  });
  
  const fps = await detectVideoFPS(video);
  const duration = video.duration;
  const totalFrames = Math.ceil(duration * fps);
  
  onProgress?.({ 
    stage: 'preparing', 
    progress: 20, 
    frame: 0, 
    totalFrames, 
    estimatedTimeRemaining: 0 
  });
  
  // Setup MediaRecorder
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
    ? 'video/webm;codecs=vp9' 
    : 'video/webm';
  
  const stream = canvas.captureStream(fps);
  const bitrate = quality === 'low' ? 4000000 : quality === 'medium' ? 8000000 : 12000000;
  const recorder = new MediaRecorder(stream, { 
    mimeType, 
    videoBitsPerSecond: bitrate 
  });
  
  // Stream to file instead of buffering in memory
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  
  // Wait for recorder to start
  await new Promise<void>((resolve) => {
    recorder.onstart = () => resolve();
    recorder.start(100);
  });
  
  // Prepare video
  video.pause();
  video.currentTime = 0;
  await new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
  });
  
  // Frame-accurate rendering
  const trackingState = createBlobTrackingState();
  const frameDuration = 1 / fps;
  let currentTime = 0;
  let frameCount = 0;
  
  onProgress?.({ 
    stage: 'recording', 
    progress: 25, 
    frame: 0, 
    totalFrames, 
    estimatedTimeRemaining: duration 
  });
  
  const startTime = performance.now();
  
  while (currentTime < duration && frameCount < totalFrames) {
    // Seek to exact frame time
    video.currentTime = currentTime;
    
    // Wait for seek
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
    });
    
    // Render frame with effects
    renderFrame(ctx, video, effectParams, width, height, trackingState);
    
    // Allow canvas to be captured
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    frameCount++;
    currentTime += frameDuration;
    
    // Progress update every 10 frames
    if (frameCount % 10 === 0) {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = 25 + (frameCount / totalFrames) * 50;
      const fps_current = frameCount / elapsed;
      const remainingFrames = totalFrames - frameCount;
      const estimatedRemaining = remainingFrames / fps_current;
      
      onProgress?.({ 
        stage: 'recording', 
        progress: Math.round(progress), 
        frame: frameCount, 
        totalFrames, 
        estimatedTimeRemaining: Math.round(estimatedRemaining) 
      });
    }
    
    // Yield to prevent UI blocking every BATCH_FRAMES
    if (frameCount % BATCH_FRAMES === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  // Stop recording
  const webmBlob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
    recorder.stop();
  });
  
  // Cleanup tracking state
  resetBlobTrackingState(trackingState);
  
  onProgress?.({ 
    stage: 'encoding', 
    progress: 80, 
    frame: totalFrames, 
    totalFrames, 
    estimatedTimeRemaining: 10 
  });
  
  // Convert to MP4 using FFmpeg
  const ffmpeg = await getFFmpeg();
  const webmData = await fetchFile(webmBlob);
  await ffmpeg.writeFile('input.webm', webmData);
  
  // Try stream copy first, fall back to re-encode
  try {
    await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'copy', '-c:a', 'copy', 'output.mp4']);
  } catch {
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-r', String(fps),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', quality === 'low' ? '23' : quality === 'medium' ? '20' : '18',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      'output.mp4'
    ]);
  }
  
  const mp4Data = await ffmpeg.readFile('output.mp4');
  const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' });
  
  // Cleanup FFmpeg files
  await ffmpeg.deleteFile('input.webm').catch(() => {});
  await ffmpeg.deleteFile('output.mp4').catch(() => {});
  
  onProgress?.({ 
    stage: 'finalizing', 
    progress: 100, 
    frame: totalFrames, 
    totalFrames, 
    estimatedTimeRemaining: 0 
  });
  
  return {
    blob: mp4Blob,
    fps,
    width,
    height,
    duration
  };
}

/**
 * Cancel any ongoing export
 */
let abortController: AbortController | null = null;

export function cancelExport(): void {
  abortController?.abort();
  abortController = null;
}
