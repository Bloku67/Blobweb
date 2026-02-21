import { useRef, useCallback } from 'react';

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getCanvas = useCallback(() => canvasRef.current, []);
  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  }, []);

  return { canvasRef, getCanvas, getContext };
}
