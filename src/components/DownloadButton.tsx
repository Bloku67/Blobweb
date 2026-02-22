import { useState, useCallback, useRef } from 'react';
import { Download } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { downloadBlob, createFilename } from '@/utils/fileUtils';
import type { EffectParams } from '@/hooks/useImageProcessor';
import type { MediaSource } from '../App';

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
    async (webmBlob: Blob): Promise<Blob> => {
      const ffmpeg = await loadFfmpeg();
      const data = await fetchFile(webmBlob);
      await ffmpeg.writeFile('input.webm', data);
      await ffmpeg.exec(['-i', 'input.webm', 'output.mp4']);
      const out = await ffmpeg.readFile('output.mp4');
      return new Blob([out], { type: 'video/mp4' });
    },
    [loadFfmpeg]
  );

  const handleDownloadVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !mediaSource || mediaType !== 'video') return;

    const video = mediaSource as HTMLVideoElement;
    const stream = canvas.captureStream(30);

    const useMp4 =
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('video/mp4');
    const mimeType = useMp4 ? 'video/mp4' : 'video/webm;codecs=vp9';
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2500000,
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
          const mp4Blob = await webmToMp4(blob);
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
    recorder.start(100);

    video.play();
    const duration = video.duration * 1000;
    await new Promise((r) => setTimeout(r, Math.min(duration, 10000)));
    video.pause();
    video.currentTime = 0;
    recorder.stop();
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
