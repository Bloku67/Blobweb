import { useCallback, useState } from 'react';
import { Upload, Image as ImageIcon, Video } from 'lucide-react';
import {
  isAcceptedMediaFile,
  isImageFile,
  isVideoFile,
} from '@/utils/fileUtils';
import type { MediaSource } from '../App';

interface MediaUploaderProps {
  onMediaLoaded: (source: MediaSource, type: 'image' | 'video' | null) => void;
}

export function MediaUploader({ onMediaLoaded }: MediaUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      if (!isAcceptedMediaFile(file)) {
        setError('Please upload an image (JPEG, PNG, WebP) or video (MP4, WebM).');
        return;
      }

      if (isImageFile(file)) {
        const img = new Image();
        img.onload = () => {
          onMediaLoaded(img, 'image');
        };
        img.onerror = () => {
          setError('Failed to load image.');
        };
        img.src = URL.createObjectURL(file);
        return;
      }

      if (isVideoFile(file)) {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.loop = true;
        video.crossOrigin = 'anonymous';
        
        const handleCanPlay = () => {
          video.removeEventListener('canplay', handleCanPlay);
          onMediaLoaded(video, 'video');
        };
        
        video.addEventListener('canplay', handleCanPlay);
        video.onerror = () => {
          setError('Failed to load video.');
        };
        video.src = URL.createObjectURL(file);
        video.load();
        return;
      }
    },
    [onMediaLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
      <label
        className={`
          flex flex-col items-center justify-center w-full min-h-[140px] rounded-lg border-2 border-dashed cursor-pointer
          transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          onChange={handleChange}
        />
        <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
          <Upload className="h-10 w-10" />
          <span className="text-sm font-medium">
            Drag & drop or click to upload
          </span>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" /> JPEG, PNG, WebP
            </span>
            <span className="flex items-center gap-1">
              <Video className="h-4 w-4" /> MP4, WebM
            </span>
          </div>
        </div>
      </label>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
