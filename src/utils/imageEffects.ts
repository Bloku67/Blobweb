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
  blobMinSize: number;
  motionThreshold: number;
  trackingPersistence: number;
  lineCount: number;
  lineDelay: number;
  lineOpacity: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function applyLighting(
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

    const lum = getLuminance(r, g, b);

    r = (r - 128) * contrast + 128 + brightness;
    g = (g - 128) * contrast + 128 + brightness;
    b = (b - 128) * contrast + 128 + brightness;

    r *= exposureMult;
    g *= exposureMult;
    b *= exposureMult;

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

    data[i] = clamp(Math.round(r), 0, 255);
    data[i + 1] = clamp(Math.round(g), 0, 255);
    data[i + 2] = clamp(Math.round(b), 0, 255);
  }
}

const ASCII_CHARS = '#$%^&*';

function getAsciiChar(luminance: number, _intensity: number): string {
  const index = Math.floor((1 - luminance) * (ASCII_CHARS.length - 1));
  return ASCII_CHARS[Math.max(0, Math.min(ASCII_CHARS.length - 1, index))];
}

/** Bounding box for a detected blob (bright/moving region) */
export interface BlobBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  vx: number;
  vy: number;
  isMoving: boolean;
  id: number;
  age: number;
}

const BRIGHT_LUMINANCE_THRESHOLD = 0.45;

function cellInBlob(cx: number, cy: number, blobs: BlobBox[]): boolean {
  for (const b of blobs) {
    if (cx >= b.minX && cx <= b.maxX && cy >= b.minY && cy <= b.maxY) return true;
  }
  return false;
}

/** Draw ASCII only on bright regions or inside detected blob boxes */
export function applyAsciiEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  charSize: number,
  blobs: BlobBox[]
): void {
  if (intensity <= 0) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  
  const cellSize = Math.max(3, Math.min(20, charSize));
  const cols = Math.floor(width / cellSize);
  const rows = Math.floor(height / cellSize);
  
  const blendAlpha = intensity / 100;
  ctx.fillStyle = '#ffffff';
  ctx.font = `${cellSize * 0.8}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

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
          totalLum += getLuminance(data[idx], data[idx + 1], data[idx + 2]);
          count++;
        }
      }
      
      const avgLum = count > 0 ? totalLum / count : 0;
      const isBright = avgLum >= BRIGHT_LUMINANCE_THRESHOLD;
      const inBlob = cellInBlob(cx, cy, blobs);
      
      if (!isBright && !inBlob) continue;
      
      const char = getAsciiChar(avgLum, intensity);
      ctx.globalAlpha = blendAlpha;
      ctx.fillText(char, cx, cy);
    }
  }
  
  ctx.globalAlpha = 1;
}

// ============================================
// ENHANCED BLOB TRACKING SYSTEM
// ============================================

/** Detection scale - more aggressive for performance (was 0.25, now 0.1) */
const DETECT_SCALE = 0.1;
const SMOOTH_ALPHA = 0.25;

// State management with ID persistence
interface TrackedBlob {
  x: number;
  y: number;
  id: number;
  lastSeen: number;
}

let trackedBlobs: TrackedBlob[] = [];
let nextBlobId = 1;
let smoothedSensitivity = 0;
let lineRevealCounter = 0;
let previousBlobBoxesForLines: BlobBox[] = [];

export function resetBlobTracking(): void {
  trackedBlobs = [];
  nextBlobId = 1;
  smoothedSensitivity = 0;
  lineRevealCounter = 0;
  previousBlobBoxesForLines = [];
}

/**
 * Build integral image for fast luminance sum queries
 * O(n) build time, O(1) query time
 */
function buildIntegralImage(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData;
  const integral = new Float32Array((width + 1) * (height + 1));
  
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      rowSum += lum;
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }
  
  return integral;
}

/**
 * Get sum of luminance in rectangle using integral image
 */
function getIntegralSum(integral: Float32Array, width: number, x1: number, y1: number, x2: number, y2: number): number {
  const w = width + 1;
  return integral[(y2 + 1) * w + (x2 + 1)] - integral[y1 * w + (x2 + 1)] - integral[(y2 + 1) * w + x1] + integral[y1 * w + x1];
}

/**
 * Enhanced blob detection with:
 * - Integral images for fast luminance queries
 * - ID persistence across frames
 * - Motion prediction
 * - Configurable motion threshold
 */
function detectBlobsEnhanced(
  imageData: ImageData,
  sensitivity: number,
  scaleBackW: number,
  scaleBackH: number,
  maxBlobs: number,
  minBlobSizePercent: number,
  motionThresholdPx: number,
  persistence: number
): BlobBox[] {
  const { width, height } = imageData;
  const threshold = Math.floor((sensitivity / 100) * 255);
  const blobs: BlobBox[] = [];
  const visited = new Uint8Array(width * height);
  
  // Build integral image for fast queries
  const integral = buildIntegralImage(imageData);
  
  // Adaptive step based on resolution
  const step = Math.max(3, Math.floor(width / 60));
  
  // Minimum blob area based on percentage
  const minArea = Math.max(4, (minBlobSizePercent / 100) * (width * height) / 100);
  
  const getPixelFast = (x: number, y: number): number => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    // Use integral image for average in 3x3 area
    const sum = getIntegralSum(integral, width, Math.max(0, x-1), Math.max(0, y-1), 
                               Math.min(width-1, x+1), Math.min(height-1, y+1));
    const count = (Math.min(width-1, x+1) - Math.max(0, x-1) + 1) * 
                  (Math.min(height-1, y+1) - Math.max(0, y-1) + 1);
    return (sum / count) * 255;
  };
  
  const floodFill = (startX: number, startY: number): BlobBox | null => {
    const stack: [number, number][] = [[startX, startY]];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let count = 0;
    let sumX = 0, sumY = 0;
    
    while (stack.length > 0 && count < 500) {
      const [x, y] = stack.pop()!;
      const key = y * width + x;
      if (visited[key]) continue;
      
      const lum = getPixelFast(x, y);
      if (lum < threshold) continue;
      
      visited[key] = 1;
      count++;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Check 4-connected neighbors
      if (x > 0) stack.push([x - 1, y]);
      if (x < width - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]);
      if (y < height - 1) stack.push([x, y + 1]);
    }
    
    if (count < minArea) return null;
    
    const cx = sumX / count;
    const cy = sumY / count;
    
    // Find matching tracked blob
    let matchedId = -1;
    let minDist = Infinity;
    
    for (const tb of trackedBlobs) {
      const dx = cx - tb.x;
      const dy = cy - tb.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist && dist < motionThresholdPx / DETECT_SCALE) {
        minDist = dist;
        matchedId = tb.id;
      }
    }
    
    // Assign new ID if no match
    if (matchedId === -1) {
      matchedId = nextBlobId++;
    }
    
    // Calculate velocity
    const prev = trackedBlobs.find(tb => tb.id === matchedId);
    const vx = prev ? (cx - prev.x) * DETECT_SCALE : 0;
    const vy = prev ? (cy - prev.y) * DETECT_SCALE : 0;
    
    const isMoving = Math.sqrt(vx * vx + vy * vy) >= motionThresholdPx * 0.1;
    
    return {
      minX: (minX / width) * scaleBackW,
      minY: (minY / height) * scaleBackH,
      maxX: (maxX / width) * scaleBackW,
      maxY: (maxY / height) * scaleBackH,
      vx,
      vy,
      isMoving,
      id: matchedId,
      age: prev ? prev.lastSeen + 1 : 0,
    };
  };
  
  const cap = Math.max(1, maxBlobs);
  
  // Grid-based sampling for faster detection
  for (let y = 0; y < height && blobs.length < cap; y += step) {
    for (let x = 0; x < width && blobs.length < cap; x += step) {
      const key = y * width + x;
      if (!visited[key] && getPixelFast(x, y) >= threshold) {
        const blob = floodFill(x, y);
        if (blob) blobs.push(blob);
      }
    }
  }
  
  // Update tracked blobs with persistence
  const newTracked: TrackedBlob[] = [];
  
  for (const blob of blobs) {
    newTracked.push({
      x: ((blob.minX + blob.maxX) / 2) / scaleBackW * width,
      y: ((blob.minY + blob.maxY) / 2) / scaleBackH * height,
      id: blob.id,
      lastSeen: 0,
    });
  }
  
  // Add persistent blobs that haven't been seen recently
  for (const tb of trackedBlobs) {
    if (!blobs.find(b => b.id === tb.id)) {
      if (tb.lastSeen < persistence) {
        newTracked.push({ ...tb, lastSeen: tb.lastSeen + 1 });
      }
    }
  }
  
  trackedBlobs = newTracked;
  
  return blobs;
}

/** Draw white outline boxes around detected blobs with ID labels */
export function drawBlobBoxes(
  ctx: CanvasRenderingContext2D,
  blobs: BlobBox[],
  lineWidth: number = 2
): void {
  if (blobs.length === 0) return;
  
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([]);
  
  for (const b of blobs) {
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    if (w > 2 && h > 2) {
      ctx.strokeRect(b.minX, b.minY, w, h);
      
      // Draw ID label for moving blobs
      if (b.isMoving) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '10px monospace';
        ctx.fillText(String(b.id), b.minX + 2, b.minY - 2);
      }
    }
  }
}

/** Lines between blob boxes with delay and opacity control */
function getLineSegments(blobs: BlobBox[], prev: BlobBox[]): { x1: number; y1: number; x2: number; y2: number; strength: number }[] {
  const segments: { x1: number; y1: number; x2: number; y2: number; strength: number }[] = [];
  const center = (b: BlobBox) => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
  
  // Motion-based connections
  for (let i = 0; i < blobs.length; i++) {
    const c = center(blobs[i]);
    
    // Connect to previous position (motion trail)
    if (prev.length > 0) {
      const prevBlob = prev.find(p => p.id === blobs[i].id);
      if (prevBlob) {
        const pc = center(prevBlob);
        const dist = Math.sqrt((c.x - pc.x) ** 2 + (c.y - pc.y) ** 2);
        if (dist > 5) {
          segments.push({ x1: pc.x, y1: pc.y, x2: c.x, y2: c.y, strength: 1.0 });
        }
      }
    }
    
    // Connect nearby blobs
    for (let j = i + 1; j < blobs.length && segments.length < 50; j++) {
      const c2 = center(blobs[j]);
      const dist = Math.sqrt((c.x - c2.x) ** 2 + (c.y - c2.y) ** 2);
      if (dist < 200) {
        segments.push({ 
          x1: c.x, y1: c.y, x2: c2.x, y2: c2.y, 
          strength: 1 - (dist / 200) 
        });
      }
    }
  }
  
  return segments;
}

export function drawBlobLines(
  ctx: CanvasRenderingContext2D,
  blobs: BlobBox[],
  lineCount: number,
  lineDelay: number,
  lineOpacity: number
): void {
  if (blobs.length === 0 || lineCount <= 0) return;
  
  const segments = getLineSegments(blobs, previousBlobBoxesForLines);
  previousBlobBoxesForLines = blobs.slice();
  
  const delaySteps = Math.max(1, Math.floor(lineDelay));
  lineRevealCounter++;
  const numToDraw = Math.min(
    lineCount,
    Math.min(segments.length, Math.floor(lineRevealCounter / delaySteps))
  );
  
  const baseAlpha = lineOpacity / 100;
  
  for (let i = 0; i < numToDraw; i++) {
    const s = segments[i % segments.length];
    const alpha = baseAlpha * s.strength;
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 1 + s.strength;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
}

/** Detect blobs on a downscaled buffer with enhanced tracking */
export function detectBlobsFromCanvas(
  ctx: CanvasRenderingContext2D,
  destWidth: number,
  destHeight: number,
  sensitivity: number,
  maxBlobs: number,
  minBlobSize: number = 10,
  motionThreshold: number = 15,
  persistence: number = 5
): BlobBox[] {
  smoothedSensitivity = SMOOTH_ALPHA * sensitivity + (1 - SMOOTH_ALPHA) * smoothedSensitivity;
  
  // More aggressive downscaling for performance (0.1x instead of 0.25x)
  const dw = Math.max(40, Math.floor(destWidth * DETECT_SCALE));
  const dh = Math.max(30, Math.floor(destHeight * DETECT_SCALE));
  
  const temp = document.createElement('canvas');
  temp.width = dw;
  temp.height = dh;
  const tCtx = temp.getContext('2d');
  if (!tCtx) return [];
  
  tCtx.drawImage(ctx.canvas, 0, 0, destWidth, destHeight, 0, 0, dw, dh);
  const imageData = tCtx.getImageData(0, 0, dw, dh);
  
  return detectBlobsEnhanced(
    imageData, 
    smoothedSensitivity, 
    destWidth, 
    destHeight, 
    maxBlobs,
    minBlobSize,
    motionThreshold,
    persistence
  );
}

/** Main image processing with all effects */
export function drawImageWithEffects(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement,
  params: EffectParams,
  destWidth: number,
  destHeight: number
): void {
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!sw || !sh) return;

  ctx.clearRect(0, 0, destWidth, destHeight);
  ctx.drawImage(source, 0, 0, sw, sh, 0, 0, destWidth, destHeight);

  let imageData = ctx.getImageData(0, 0, destWidth, destHeight);
  applyLighting(imageData, {
    brightness: params.brightness,
    contrast: params.contrast,
    exposure: params.exposure,
    shadows: params.shadows,
    highlights: params.highlights,
  });
  ctx.putImageData(imageData, 0, 0);

  const maxBlobs = Math.max(1, params.blobMaxCount);
  const blobs =
    params.blobTrackingSensitivity > 0 || params.asciiIntensity > 0
      ? detectBlobsFromCanvas(
          ctx, 
          destWidth, 
          destHeight, 
          params.blobTrackingSensitivity || 50, 
          maxBlobs,
          params.blobMinSize,
          params.motionThreshold,
          params.trackingPersistence
        )
      : [];

  if (params.asciiIntensity > 0) {
    applyAsciiEffect(ctx, destWidth, destHeight, params.asciiIntensity, params.asciiCharSize, blobs);
  }

  if (params.blobTrackingSensitivity > 0 && blobs.length > 0) {
    drawBlobBoxes(ctx, blobs, 2);
    if (params.lineCount > 0) {
      drawBlobLines(ctx, blobs, params.lineCount, params.lineDelay, params.lineOpacity);
    }
  }
}
