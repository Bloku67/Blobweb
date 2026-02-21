import { useState, useEffect, useCallback } from 'react';

/**
 * Video playback state and controls for the canvas-based video processor.
 * Actual frame-by-frame drawing with effects is handled in useImageProcessor.
 */
export function useVideoProcessor(video: HTMLVideoElement | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    setDuration(video.duration || 0);
    setCurrentTime(video.currentTime || 0);
    setIsPlaying(!video.paused);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [video]);

  const play = useCallback(() => {
    video?.play();
  }, [video]);

  const pause = useCallback(() => {
    video?.pause();
  }, [video]);

  return { isPlaying, duration, currentTime, play, pause };
}
