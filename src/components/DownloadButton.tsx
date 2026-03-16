import { useState, useCallback, useRef } from 'react';
import { Download, X, Loader2 } from 'lucide-react';
import { exportVideo, cancelExport } from '@/utils/videoExporter';
import { downloadBlob, createFilename } from '@/utils/fileUtils';
import type { EffectParams } from '@/hooks/useImageProcessor';
import type { MediaSource } from '../App';

interface DownloadButtonProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  mediaSource: MediaSource;
  mediaType: 'image' | 'video' | null;
  effectParams: EffectParams;
}

type ExportStage = 'preparing' | 'recording' | 'encoding' | 'finalizing' | null;

export function DownloadButton({
  canvasRef,
  mediaSource,
  mediaType,
  effectParams,
}: DownloadButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<ExportStage>(null);
  const [frameInfo, setFrameInfo] = useState({ current: 0, total: 0 });
  const [eta, setEta] = useState(0);
  const abortRef = useRef(false);

  const getStageLabel = (s: ExportStage): string => {
    switch (s) {
      case 'preparing': return 'Preparing...';
      case 'recording': return 'Recording frames...';
      case 'encoding': return 'Encoding video...';
      case 'finalizing': return 'Finalizing...';
      default: return '';
    }
  };

  const handleDownloadImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !mediaSource) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert('Download failed');
          return;
        }
        downloadBlob(blob, createFilename('blobweb-export', 'png'));
      },
      'image/png',
      0.95
    );
  }, [canvasRef, mediaSource]);

  const handleDownloadVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    const video = mediaSource as HTMLVideoElement;
    
    if (!canvas || !video || mediaType !== 'video') return;

    if (video.duration > 300) {
      // 5 minute limit
      const proceed = confirm(
        `This video is ${Math.round(video.duration / 60)} minutes long. ` +
        'Export may take a while and use significant memory. Continue?'
      );
      if (!proceed) return;
    }

    setIsExporting(true);
    setProgress(0);
    setStage('preparing');
    abortRef.current = false;

    try {
      const result = await exportVideo({
        video,
        canvas,
        effectParams,
        quality: 'medium',
        onProgress: (p) => {
          if (abortRef.current) return;
          setProgress(p.progress);
          setStage(p.stage as ExportStage);
          setFrameInfo({ current: p.frame, total: p.totalFrames });
          setEta(p.estimatedTimeRemaining);
        },
      });

      if (!abortRef.current) {
        downloadBlob(result.blob, createFilename('blobweb-export', 'mp4'));
      }
    } catch (err) {
      if (!abortRef.current) {
        console.error('Export failed:', err);
        alert('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } finally {
      setIsExporting(false);
      setStage(null);
    }
  }, [canvasRef, mediaSource, mediaType, effectParams]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    cancelExport();
    setIsExporting(false);
    setStage(null);
  }, []);

  const handleClick = useCallback(() => {
    if (mediaType === 'video') {
      handleDownloadVideo();
    } else {
      handleDownloadImage();
    }
  }, [mediaType, handleDownloadImage, handleDownloadVideo]);

  if (isExporting) {
    return (
      <div className="relative flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white min-w-[200px]">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs mb-1">
              <span>{getStageLabel(stage)}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 bg-blue-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {frameInfo.total > 0 && (
              <div className="text-[10px] text-blue-200 mt-1">
                Frame {frameInfo.current} / {frameInfo.total}
                {eta > 0 && ` • ~${eta}s remaining`}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="p-1.5 rounded-md hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
          title="Cancel export"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!mediaSource}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Download className="h-4 w-4" />
      Download
    </button>
  );
}
