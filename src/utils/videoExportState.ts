/**
 * Video export state management - isolated per export session
 * Fixes the global state pollution issue in imageEffects.ts
 */

export interface BlobTrackingState {
  previousBlobCenters: { x: number; y: number }[];
  previousBlobBoxesForLines: import('./imageEffects').BlobBox[];
  smoothedSensitivity: number;
  lineRevealCounter: number;
}

export function createBlobTrackingState(): BlobTrackingState {
  return {
    previousBlobCenters: [],
    previousBlobBoxesForLines: [],
    smoothedSensitivity: 0,
    lineRevealCounter: 0,
  };
}

export function resetBlobTrackingState(state: BlobTrackingState): void {
  state.previousBlobCenters = [];
  state.previousBlobBoxesForLines = [];
  state.smoothedSensitivity = 0;
  state.lineRevealCounter = 0;
}

/**
 * Video export progress tracking
 */
export interface ExportProgress {
  stage: 'preparing' | 'recording' | 'encoding' | 'finalizing';
  progress: number; // 0-100
  frame: number;
  totalFrames: number;
  estimatedTimeRemaining: number;
}

export type ProgressCallback = (progress: ExportProgress) => void;
