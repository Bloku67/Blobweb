/**
 * Video effects are applied frame-by-frame using the same image effect
 * pipeline as in imageEffects.ts. The useImageProcessor hook draws each
 * video frame to the canvas and applies lighting, motion blur, and
 * displacement in real time.
 */
export { drawImageWithEffects } from './imageEffects';
export type { EffectParams } from './imageEffects';
