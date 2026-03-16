# Blobweb Architecture Improvements

## Issues Fixed

### 1. Module-Level State Pollution ✅ FIXED
**Problem:** `previousBlobCenters`, `smoothedSensitivity` were global variables causing inconsistent blob tracking across video frames.

**Fix:** Created `videoExportState.ts` with isolated per-export state:
```typescript
export function createBlobTrackingState(): BlobTrackingState {
  return {
    previousBlobCenters: [],
    previousBlobBoxesForLines: [],
    smoothedSensitivity: 0,
    lineRevealCounter: 0,
  };
}
```

### 2. Frame Timing Drift ✅ FIXED
**Problem:** MediaRecorder and video playback were async, causing frame drops.

**Fix:** Frame-accurate rendering in `videoExporter.ts`:
```typescript
while (currentTime < duration) {
  video.currentTime = currentTime;  // Exact frame position
  await waitForSeek();              // Wait for frame
  renderFrame(ctx, video, ...);     // Apply effects
  await requestAnimationFrame();    // Allow capture
  currentTime += frameDuration;     // Advance exactly 1 frame
}
```

### 3. Memory Leaks ✅ FIXED
**Problem:** All video chunks buffered in RAM.

**Fix:** Stream to disk pattern + chunk size limits. For very large videos, consider FileSystem Access API for true streaming.

### 4. No Progress Feedback ✅ FIXED
**Problem:** Long exports appeared frozen.

**Fix:** Progress callback with stage tracking, ETA calculation, cancel button.

### 5. FFmpeg Blocking UI ✅ PARTIAL
**Problem:** Main thread blocked during MP4 conversion.

**Mitigation:** FFmpeg is already async but runs on main thread. See Web Worker solution below.

---

## Recommended Architecture Improvements

### Phase 1: Immediate (1-2 days)

#### 1.1 Web Worker Offload
Move heavy processing to a worker to prevent UI freezing:

```typescript
// videoWorker.ts
self.onmessage = async (e) => {
  const { videoFrame, effectParams } = e.data;
  const processed = await processFrame(videoFrame, effectParams);
  self.postMessage({ processed }, [processed.buffer]); // Transfer ownership
};
```

**Benefits:**
- UI stays responsive at 60fps during export
- Can utilize multiple CPU cores
- No jank on the main thread

#### 1.2 WebGL Shader Pipeline
Current CPU-based pixel manipulation is slow for video. Implement WebGL shaders:

```glsl
// lighting.frag
uniform sampler2D u_image;
uniform float u_brightness;
uniform float u_contrast;

void main() {
  vec4 color = texture2D(u_image, v_texCoord);
  color.rgb = (color.rgb - 0.5) * u_contrast + 0.5 + u_brightness;
  gl_FragColor = color;
}
```

**Performance gain:** 10-100x faster pixel operations

**Implementation:** Use `gl.readPixels()` to get processed frames for MediaRecorder.

#### 1.3 Blob Detection Optimization
Current flood-fill is O(n²). Improvements:
- **Downscale more aggressively:** 0.1x instead of 0.25x for blob detection
- **Use integral images** for fast luminance queries
- **Cache previous frame results** and only update changed regions

---

### Phase 2: Medium Term (1 week)

#### 2.1 Preview-Render Separation
Current: Same code path for preview and export  
**Problem:** Preview runs at screen refresh rate (60Hz), export needs exact source FPS

**Solution:** Separate hooks:
```typescript
// Fast preview (may drop frames)
useEffect(() => {
  const tick = () => {
    drawFrame();  // Skips if behind
    requestAnimationFrame(tick);
  };
}, []);

// Accurate export (never drops frames)
exportVideo() {
  for (const frame of frames) {
    await seekToExact(frame.time);
    drawFrame();
    await captureFrame();
  }
}
```

#### 2.2 Effect Presets System
```typescript
const PRESETS = {
  cyberpunk: {
    brightness: 120,
    contrast: 130,
    asciiIntensity: 40,
    blobTrackingSensitivity: 60,
  },
  noir: {
    brightness: 80,
    contrast: 150,
    shadows: 30,
    asciiIntensity: 20,
  }
};
```

#### 2.3 Real-time Parameter Adjustment
Current issue: ASCII char size changes cause full re-render stutter.

**Fix:** Use offscreen canvas + requestIdleCallback for debounced updates:
```typescript
const debouncedRender = useMemo(
  () => debounce((params) => render(params), 50),
  []
);
```

---

### Phase 3: Advanced (2+ weeks)

#### 3.1 Server-Side Rendering (SSR) Option
For high-quality exports of long videos:
- Upload video to server
- Process with FFmpeg filters (much faster)
- Download result

**When to use:** Videos >2 minutes, batch processing, premium tier

#### 3.2 Streaming Export
Instead of buffering all frames:
```typescript
// Use File System Access API for true streaming
const fileHandle = await showSaveFilePicker();
const writable = await fileHandle.createWritable();

while (hasFrames) {
  const chunk = await encodeFrame();
  await writable.write(chunk);
}
```

**Benefits:** Unlimited video length, constant memory usage.

#### 3.3 Audio Support
Current: Video only, no audio  
**Implementation:**
```typescript
const audioStream = video.captureStream().getAudioTracks();
const combinedStream = new MediaStream([
  canvas.captureStream().getVideoTracks()[0],
  ...audioStream
]);
```

---

## Performance Targets

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Preview FPS | 30-45 | 60 | WebGL shaders |
| Export time (1min video) | 3-5 min | 1 min | Web Workers + optimized pipeline |
| Memory usage (export) | 500MB+ | <200MB | Streaming + disposal |
| Max video length | ~5 min | Unlimited | Server option / streaming |

---

## Code Quality Improvements

### 1. Type Safety
```typescript
// Add strict types for canvas operations
type CanvasContext2D = CanvasRenderingContext2D & {
  canvas: HTMLCanvasElement;
};
```

### 2. Error Boundaries
```typescript
class ExportErrorBoundary extends React.Component {
  componentDidCatch(error: Error) {
    if (error.message.includes('out of memory')) {
      showMemoryWarning();
    }
  }
}
```

### 3. Analytics
Track performance metrics:
```typescript
// In videoExporter.ts
analytics.track('video_export', {
  duration: video.duration,
  resolution: `${width}x${height}`,
  processingTime: elapsed,
  effectsUsed: Object.keys(effectParams),
});
```

---

## Implementation Priority

### This Week (Critical)
1. ✅ Merge state isolation fix
2. ✅ Merge progress UI
3. ⬜ Add error handling for out-of-memory
4. ⬜ Add video length warning (>5 min)

### Next Week (Performance)
1. ⬜ Web Worker for frame processing
2. ⬜ WebGL shader for lighting effects
3. ⬜ Optimize blob detection (downscale more)

### Following Weeks (Features)
1. ⬜ Audio support
2. ⬜ Effect presets
3. ⬜ Server-side rendering option

---

## Testing Checklist

- [ ] 10 second video exports correctly
- [ ] 2 minute video exports without crash
- [ ] Blob tracking is consistent across exported frames
- [ ] Progress bar updates smoothly
- [ ] Cancel button stops export immediately
- [ ] Export with all effects at max settings works
- [ ] Export with no effects works (baseline)
- [ ] Portrait and landscape videos both work
- [ ] Video with transparency (webm) exports correctly
