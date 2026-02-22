import { useState, useCallback, useRef } from 'react';
import { Download } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { downloadBlob, createFilename } from '@/utils/fileUtils';
import type { EffectParams } from '@/hooks/useImageProcessor';
import type { MediaSource } from '../App';

const DEFAULT_FPS = 30;
const FPS_MEASURE_DURATION_MS = 600;

/** Detect video FPS using requestVideoFrameCallback; fallback to DEFAULT_FPS */
function getVideoFPS(video: HTMLVideoElement): Promise<number> {
  const rvfc = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, metadata: unknown) => void) => number }).requestVideoFrameCallback;
  if (typeof rvfc !== 'function') {
    return Promise.resolve(DEFAULT_FPS);
  }
  return new Promise((resolve) => {
    let frameCount = 0;
    const start = performance.now();
    let resolved = false;
    const tick = () => {
      frameCount++;
      const elapsed = performance.now() - start;
      if (elapsed >= FPS_MEASURE_DURATION_MS && !resolved) {
        resolved = true;
        video.pause();
        video.currentTime = 0;
        const fps = Math.round((frameCount / elapsed) * 1000);
        resolve(Math.min(60, Math.max(1, fps)) || DEFAULT_FPS);
        return;
      }
      if (!resolved) rvfc.call(video, tick);
    };
    video.currentTime = 0;
    video.play().then(() => rvfc.call(video, tick)).catch(() => { if (!resolved) { resolved = true; resolve(DEFAULT_FPS); } });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        video.pause();
        video.currentTime = 0;
        resolve(DEFAULT_FPS);
      }
    }, FPS_MEASURE_DURATION_MS + 800);
  });
}

interface DownloadButtonProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  mediaSource: MediaSource;
  mediaType: 'image' | 'video' | null;
  effectParams: EffectParams;
}

export function DownloadButton({
  canvasRef,
  mediaSource,
  mediaType,
}: DownloadButtonProps) {
  const [recording, setRecording] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleDownloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mediaSource) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          showToast('Download failed');
          return;
        }
        const ext = 'png';
        downloadBlob(blob, createFilename('graphics-export', ext));
        showToast('Image downloaded');
      },
      'image/png',
      0.95
    );
  }, [canvasRef, mediaSource, showToast]);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLoadedRef = useRef(false);

  const loadFfmpeg = useCallback(async (): Promise<FFmpeg> => {
    if (ffmpegRef.current && ffmpegLoadedRef.current) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegRef.current = ffmpeg;
    ffmpegLoadedRef.current = true;
    return ffmpeg;
  }, []);

  const webmToMp4 = useCallback(
    async (webmBlob: Blob, sourceFps: number): Promise<Blob> => {
      const ffmpeg = await loadFfmpeg();
      const data = await fetchFile(webmBlob);
      await ffmpeg.writeFile('input.webm', data);
      // Prefer stream copy; otherwise re-encode at source FPS with high quality
      try {
        await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'copy', '-c:a', 'copy', 'output.mp4']);
      } catch {
        // Re-encode: source FPS, high quality (CRF 18), slower preset
        await ffmpeg.exec([
          '-i', 'input.webm',
          '-r', String(sourceFps),
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-crf', '18',
          '-pix_fmt', 'yuv420p',
          'output.mp4',
        ]);
      }
      const out = await ffmpeg.readFile('output.mp4');
      const uint8Array = new Uint8Array(out as unknown as Uint8Array);
      return new Blob([uint8Array], { type: 'video/mp4' });
    },
    [loadFfmpeg]
  );

  const handleDownloadVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !mediaSource || mediaType !== 'video') return;

    const video = mediaSource as HTMLVideoElement;
    
    // Ensure video is ready
    if (video.readyState < 2) {
      await new Promise((resolve) => {
        const handleLoadedData = () => {
          video.removeEventListener('loadeddata', handleLoadedData);
          resolve(undefined);
        };
        video.addEventListener('loadeddata', handleLoadedData);
      });
    }

    // Get the original video duration
    const originalDuration = video.duration;
    if (!originalDuration || !isFinite(originalDuration)) {
      showToast('Invalid video duration');
      return;
    }

    // Detect FPS from source video (briefly plays then resets)
    const sourceFps = await getVideoFPS(video);
    // Ensure video is back at start for recording
    video.currentTime = 0;
    await new Promise((r) => setTimeout(r, 50));

    // Capture at source video FPS so timing matches
    const stream = canvas.captureStream(sourceFps);

    const useMp4 =
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/mp4');
    const mimeType = useMp4 ? 'video/mp4' : 'video/webm;codecs=vp9';

    // High bitrate for better quality (e.g. 8 Mbps for HD)
    const videoBitsPerSecond = 8000000;
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, {
          type: useMp4 ? 'video/mp4' : 'video/webm',
        });
        if (useMp4) {
          downloadBlob(blob, createFilename('graphics-export', 'mp4'));
          showToast('Video downloaded (MP4)');
        } else {
          showToast('Converting to MP4…');
          const mp4Blob = await webmToMp4(blob, sourceFps);
          downloadBlob(mp4Blob, createFilename('graphics-export', 'mp4'));
          showToast('Video downloaded (MP4)');
        }
      } catch (e) {
        console.error(e);
        showToast('Download failed');
      } finally {
        setRecording(false);
      }
    };

    setRecording(true);
    recorder.start(100); // Request data every 100ms for smoother recording

    // Reset video to start
    video.currentTime = 0;
    
    // Wait for video to seek to start
    await new Promise((resolve) => {
      const handleSeeked = () => {
        video.removeEventListener('seeked', handleSeeked);
        resolve(undefined);
      };
      video.addEventListener('seeked', handleSeeked);
    });

    // Play video and record for the full duration
    video.play();
    
    // Record for the full original video duration
    await new Promise((resolve) => {
      const handleEnded = () => {
        video.removeEventListener('ended', handleEnded);
        resolve(undefined);
      };
      video.addEventListener('ended', handleEnded);
      
      // Fallback timeout (original duration + 1 second buffer)
      setTimeout(() => {
        video.removeEventListener('ended', handleEnded);
        resolve(undefined);
      }, (originalDuration + 1) * 1000);
    });

    // Stop recording
    recorder.stop();
    
    // Reset video
    video.pause();
    video.currentTime = 0;
  }, [
    canvasRef,
    mediaSource,
    mediaType,
    showToast,
    webmToMp4,
  ]);

  const handleClick = useCallback(() => {
    if (mediaType === 'video') {
      handleDownloadVideo();
    } else {
      handleDownloadImage();
    }
  }, [mediaType, handleDownloadImage, handleDownloadVideo]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={recording}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {recording ? 'Recording…' : 'Download'}
      </button>
      {toast && (
        <div className="absolute top-full right-0 mt-1 px-3 py-1.5 text-sm rounded bg-gray-800 dark:bg-gray-700 text-white shadow-lg z-10">
          {toast}
        </div>
      )}
    </div>
  );
}
