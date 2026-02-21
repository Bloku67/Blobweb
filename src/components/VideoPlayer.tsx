import { Play, Pause } from 'lucide-react';
import { useVideoProcessor } from '@/hooks/useVideoProcessor';

interface VideoPlayerProps {
  video: HTMLVideoElement | null;
}

export function VideoPlayer({ video }: VideoPlayerProps) {
  const { isPlaying, play, pause } = useVideoProcessor(video);

  if (!video) return null;

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        type="button"
        onClick={isPlaying ? pause : play}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Effects apply in real time while playing
      </span>
    </div>
  );
}
