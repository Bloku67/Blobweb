import { useRef, useState } from 'react';
import { MediaUploader } from './components/MediaUploader';
import { MediaCanvas } from './components/MediaCanvas';
import { EffectControls } from './components/EffectControls';
import { DownloadButton } from './components/DownloadButton';
import { VideoPlayer } from './components/VideoPlayer';
import { ThemeToggle } from './components/ThemeToggle';
import { CobwebLogo } from './components/CobwebLogo';
import type { EffectParams } from './hooks/useImageProcessor';

export type MediaType = 'image' | 'video' | null;
export type MediaSource = HTMLImageElement | HTMLVideoElement | null;

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mediaSource, setMediaSource] = useState<MediaSource>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [effectParams, setEffectParams] = useState<EffectParams>({
    brightness: 100,
    contrast: 100,
    exposure: 0,
    shadows: 0,
    highlights: 0,
    asciiIntensity: 0,
    asciiCharSize: 8,
    blobTrackingSensitivity: 0,
    blobMaxCount: 8,
    lineCount: 0,
    lineDelay: 3,
  });
  const [showBeforeAfter, setShowBeforeAfter] = useState<'before' | 'after'>('after');

  const handleMediaLoaded = (source: MediaSource, type: MediaType) => {
    setMediaSource(source);
    setMediaType(type);
  };

  const handleReset = () => {
    setEffectParams({
      brightness: 100,
      contrast: 100,
      exposure: 0,
      shadows: 0,
      highlights: 0,
      asciiIntensity: 0,
      asciiCharSize: 8,
      blobTrackingSensitivity: 0,
      blobMaxCount: 8,
      lineCount: 0,
      lineDelay: 3,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <CobwebLogo className="h-7 w-7 text-gray-900 dark:text-gray-100" />
          <h1 className="text-xl font-semibold">Blobweb</h1>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2">
          {mediaSource && (
            <>
              <button
                type="button"
                onClick={() => setShowBeforeAfter(showBeforeAfter === 'before' ? 'after' : 'before')}
                className="px-3 py-1.5 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {showBeforeAfter === 'before' ? 'Show result' : 'Show original'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Reset
              </button>
              <DownloadButton
                canvasRef={canvasRef}
                mediaSource={mediaSource}
                mediaType={mediaType}
                effectParams={effectParams}
              />
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
          <MediaUploader onMediaLoaded={handleMediaLoaded} />
          <EffectControls
            params={effectParams}
            onChange={setEffectParams}
            disabled={!mediaSource}
          />
        </aside>

        <main className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-4 overflow-auto bg-gray-200 dark:bg-gray-800">
          <MediaCanvas
            canvasRef={canvasRef}
            mediaSource={mediaSource}
            mediaType={mediaType}
            effectParams={effectParams}
            showOriginal={showBeforeAfter === 'before'}
          />
          {mediaType === 'video' && mediaSource instanceof HTMLVideoElement && (
            <VideoPlayer video={mediaSource} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
