import { motion } from 'framer-motion';
import { Sparkles, Monitor, Zap, Grid3X3, Flame, ScanLine, Aperture, Shuffle } from 'lucide-react';
import type { ShaderEffectParams } from '@/utils/webglShaders';

interface ShaderControlsProps {
  params: ShaderEffectParams;
  onChange: (params: ShaderEffectParams) => void;
}

interface SliderProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

function ShaderSlider({ label, icon, value, onChange, min = 0, max = 100, disabled }: SliderProps) {
  return (
    <div className={`space-y-2 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{Math.round(value)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:cursor-not-allowed"
      />
    </div>
  );
}

export function ShaderControls({ params, onChange }: ShaderControlsProps) {
  const updateParam = <K extends keyof ShaderEffectParams>(key: K, value: ShaderEffectParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Enable Shaders Toggle */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl border border-cyan-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">WebGL Shaders</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">GPU-accelerated effects</p>
          </div>
        </div>
        <button
          onClick={() => updateParam('enabled', !params.enabled)}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
            params.enabled ? 'bg-cyan-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
              params.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Shader Parameters */}
      <div className={`space-y-5 transition-opacity duration-200 ${params.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <ShaderSlider
          label="Chromatic Aberration"
          icon={<Aperture className="w-4 h-4" />}
          value={params.chromaticAberration}
          onChange={(v) => updateParam('chromaticAberration', v)}
          disabled={!params.enabled}
        />
        
        <ShaderSlider
          label="RGB Shift"
          icon={<Shuffle className="w-4 h-4" />}
          value={params.rgbShift}
          onChange={(v) => updateParam('rgbShift', v)}
          disabled={!params.enabled}
        />
        
        <ShaderSlider
          label="Scanlines"
          icon={<ScanLine className="w-4 h-4" />}
          value={params.scanlines}
          onChange={(v) => updateParam('scanlines', v)}
          disabled={!params.enabled}
        />
        
        <ShaderSlider
          label="Vignette"
          icon={<Monitor className="w-4 h-4" />}
          value={params.vignette}
          onChange={(v) => updateParam('vignette', v)}
          disabled={!params.enabled}
        />
        
        <ShaderSlider
          label="Barrel Distortion"
          icon={<Zap className="w-4 h-4" />}
          value={params.distortion}
          onChange={(v) => updateParam('distortion', v)}
          disabled={!params.enabled}
        />
        
        <ShaderSlider
          label="Pixelate"
          icon={<Grid3X3 className="w-4 h-4" />}
          value={params.pixelate}
          onChange={(v) => updateParam('pixelate', v)}
          disabled={!params.enabled}
        />
        
        <ShaderSlider
          label="Heat Haze"
          icon={<Flame className="w-4 h-4" />}
          value={params.heatHaze}
          onChange={(v) => updateParam('heatHaze', v)}
          disabled={!params.enabled}
        />
        
        <ShaderSlider
          label="Noise"
          icon={<Sparkles className="w-4 h-4" />}
          value={params.noise}
          onChange={(v) => updateParam('noise', v)}
          disabled={!params.enabled}
        />
      </div>

      {/* Info Card */}
      {params.enabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
        >
          <p className="text-xs text-blue-600 dark:text-blue-400">
            <strong>Pro tip:</strong> WebGL shaders run on your GPU for smooth real-time effects. 
            Combine with 2D effects for unique looks!
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
