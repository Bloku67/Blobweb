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

/** Bounding box for a detected blob (bright/moving region) - declared early for applyAsciiEffect */
export interface BlobBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  vx: number;
  vy: number;
  isMoving: boolean;
}

const BRIGHT_LUMINANCE_THRESHOLD = 0.45; // only draw ASCII on bright or moving regions

function cellInBlob(cx: number, cy: number, blobs: BlobBox[]): boolean {
  for (const b of blobs) {
    if (cx >= b.minX && cx <= b.maxX && cy >= b.minY && cy <= b.maxY) return true;
  }
  return false;
}

/** Draw ASCII only on bright regions or inside detected blob boxes (moving/bright objects) */
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

const DETECT_SCALE = 0.25;
const MOVE_THRESHOLD = 1.5;
const SMOOTH_ALPHA = 0.25; // smoothing factor for sensitivity

let previousBlobCenters: { x: number; y: number }[] = [];
let smoothedSensitivity = 0;
let lineRevealCounter = 0;
let previousBlobBoxesForLines: BlobBox[] = [];

export function resetBlobTracking(): void {
  previousBlobCenters = [];
  previousBlobBoxesForLines = [];
  lineRevealCounter = 0;
}

function detectBlobs(
  imageData: ImageData,
  sensitivity: number,
  scaleBackW: number,
  scaleBackH: number,
  maxBlobs: number
): BlobBox[] {
  const { width, height, data } = imageData;
  const threshold = Math.floor((sensitivity / 100) * 200);
  const blobs: BlobBox[] = [];
  const visited = new Set<number>();
  const step = Math.max(2, Math.floor(width / 80));
  
  const getPixel = (x: number, y: number): number => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    const idx = (y * width + x) * 4;
    return getLuminance(data[idx], data[idx + 1], data[idx + 2]) * 255;
  };
  
  const floodFill = (startX: number, startY: number): BlobBox | null => {
    const stack: [number, number][] = [[startX, startY]];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let count = 0;
    
    while (stack.length > 0 && count < 200) {
      const [x, y] = stack.pop()!;
      const key = y * width + x;
      if (visited.has(key)) continue;
      
      const lum = getPixel(x, y);
      if (lum < threshold) continue;
      
      visited.add(key);
      count++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const nKey = ny * width + nx;
        if (!visited.has(nKey) && getPixel(nx, ny) >= threshold) {
          stack.push([nx, ny]);
        }
      }
    }
    
    if (count < 4) return null;
    
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    
    let vx = 0, vy = 0;
    if (previousBlobCenters.length > 0) {
      let minDist = Infinity;
      let closest = -1;
      for (let i = 0; i < previousBlobCenters.length; i++) {
        const p = previousBlobCenters[i];
        const dist = Math.sqrt((cx - p.x) ** 2 + (cy - p.y) ** 2);
        if (dist < minDist && dist < 80) {
          minDist = dist;
          closest = i;
        }
      }
      if (closest >= 0) {
        const p = previousBlobCenters[closest];
        vx = cx - p.x;
        vy = cy - p.y;
      }
    }
    
    const isMoving = Math.sqrt(vx * vx + vy * vy) >= MOVE_THRESHOLD;
    
    return {
      minX: (minX / width) * scaleBackW,
      minY: (minY / height) * scaleBackH,
      maxX: (maxX / width) * scaleBackW,
      maxY: (maxY / height) * scaleBackH,
      vx,
      vy,
      isMoving,
    };
  };
  
  const cap = Math.max(1, maxBlobs);
  for (let y = 0; y < height && blobs.length < cap; y += step) {
    for (let x = 0; x < width && blobs.length < cap; x += step) {
      const key = y * width + x;
      if (!visited.has(key) && getPixel(x, y) >= threshold) {
        const blob = floodFill(x, y);
        if (blob) blobs.push(blob);
      }
    }
  }
  
  previousBlobCenters = blobs.map((b) => ({
    x: ((b.minX + b.maxX) / 2) / scaleBackW * width,
    y: ((b.minY + b.maxY) / 2) / scaleBackH * height,
  }));
  
  return blobs;
}

/** Draw white outline boxes around detected blobs */
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
    }
  }
}

/** Lines between blob boxes with delay: each frame we reveal more lines up to lineCount */
function getLineSegments(blobs: BlobBox[], prev: BlobBox[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const center = (b: BlobBox) => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
  
  for (let i = 0; i < blobs.length; i++) {
    const c = center(blobs[i]);
    if (prev.length > 0) {
      let bestJ = 0;
      let bestD = Infinity;
      for (let j = 0; j < prev.length; j++) {
        const p = center(prev[j]);
        const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          bestJ = j;
        }
      }
      const p = center(prev[bestJ]);
      segments.push({ x1: p.x, y1: p.y, x2: c.x, y2: c.y });
    }
    for (let j = i + 1; j < blobs.length && segments.length < 50; j++) {
      const c2 = center(blobs[j]);
      segments.push({ x1: c.x, y1: c.y, x2: c2.x, y2: c2.y });
    }
  }
  return segments;
}

export function drawBlobLines(
  ctx: CanvasRenderingContext2D,
  blobs: BlobBox[],
  lineCount: number,
  lineDelay: number
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

/** Detect blobs on a downscaled buffer; uses smoothed sensitivity and maxBlobs cap */
export function detectBlobsFromCanvas(
  ctx: CanvasRenderingContext2D,
  destWidth: number,
  destHeight: number,
  sensitivity: number,
  maxBlobs: number
): BlobBox[] {
  smoothedSensitivity = SMOOTH_ALPHA * sensitivity + (1 - SMOOTH_ALPHA) * smoothedSensitivity;
  
  const dw = Math.max(80, Math.floor(destWidth * DETECT_SCALE));
  const dh = Math.max(60, Math.floor(destHeight * DETECT_SCALE));
  
  const temp = document.createElement('canvas');
  temp.width = dw;
  temp.height = dh;
  const tCtx = temp.getContext('2d');
  if (!tCtx) return [];
  
  tCtx.drawImage(ctx.canvas, 0, 0, destWidth, destHeight, 0, 0, dw, dh);
  const imageData = tCtx.getImageData(0, 0, dw, dh);
  
  return detectBlobs(imageData, smoothedSensitivity, destWidth, destHeight, maxBlobs);
}

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
      ? detectBlobsFromCanvas(ctx, destWidth, destHeight, params.blobTrackingSensitivity || 50, maxBlobs)
      : [];

  if (params.asciiIntensity > 0) {
    applyAsciiEffect(ctx, destWidth, destHeight, params.asciiIntensity, params.asciiCharSize, blobs);
  }

  if (params.blobTrackingSensitivity > 0 && blobs.length > 0) {
    drawBlobBoxes(ctx, blobs, 2);
    if (params.lineCount > 0) {
      drawBlobLines(ctx, blobs, params.lineCount, params.lineDelay);
    }
  }
}
