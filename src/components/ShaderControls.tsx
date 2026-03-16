import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Monitor, 
  Zap, 
  Grid3X3, 
  Flame, 
  ScanLine, 
  Aperture, 
  Shuffle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import type { ShaderEffectParams } from '@/utils/webglShaders';

interface SliderProps {
  label: string;
  icon?: React.ReactNode;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function Slider({ label, icon, value, min = 0, max = 100, step = 1, unit = '%', disabled, onChange }: SliderProps) {
  return (
    <div className={`py-1 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-center gap-2 text-xs mb-1">
        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
          {icon && <span className="text-gray-500 dark:text-gray-400">{icon}</span>}
          <span className="truncate">{label}</span>
        </div>
        <span className="text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
          {Math.round(value)}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-gray-600 disabled:opacity-50 accent-cyan-600 cursor-pointer"
      />
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 overflow-hidden">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 py-2 border-b border-gray-200 dark:border-gray-600 bg-gray-100/50 dark:bg-gray-700/30">
        {icon && <span className="text-gray-400">{icon}</span>}
        {title}
      </h3>
      <div className="px-3 py-2">{children}</div>
    </section>
  );
}

interface ShaderControlsProps {
  params: ShaderEffectParams;
  onChange: (params: ShaderEffectParams) => void;
  disabled?: boolean;
}

export function ShaderControls({ params, onChange, disabled = false }: ShaderControlsProps) {
  const updateParam = <K extends keyof ShaderEffectParams>(key: K, value: ShaderEffectParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <motion.div
      className="p-3 space-y-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Enable Shaders Toggle - styled as a section header */}
      <div className={`rounded-lg border overflow-hidden transition-colors ${
        params.enabled 
          ? 'border-cyan-500/30 bg-cyan-500/5' 
          : 'border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30'
      }`}>
        <button
          onClick={() => updateParam('enabled', !params.enabled)}
          disabled={disabled}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${params.enabled ? 'text-cyan-500' : 'text-gray-400'}`} />
            <div className="text-left">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                WebGL Shaders
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">GPU-accelerated effects</p>
            </div>
          </div>
          <div className="text-gray-400">
            {params.enabled ? (
              <ToggleRight className="w-5 h-5 text-cyan-500" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
          </div>
        </button>
      </div>

      <Section title="Color Distortion" icon={<Aperture className="w-3.5 h-3.5" />}>
        <Slider
          label="Chromatic Aberration"
          icon={<Aperture className="w-3 h-3" />}
          value={params.chromaticAberration}
          disabled={disabled || !params.enabled}
          onChange={(v) => updateParam('chromaticAberration', v)}
        />
        <Slider
          label="RGB Shift"
          icon={<Shuffle className="w-3 h-3" />}
          value={params.rgbShift}
          disabled={disabled || !params.enabled}
          onChange={(v) => updateParam('rgbShift', v)}
        />
      </Section>

      <Section title="Screen Effects" icon={<Monitor className="w-3.5 h-3.5" />}>
        <Slider
          label="Scanlines"
          icon={<ScanLine className="w-3 h-3" />}
          value={params.scanlines}
          disabled={disabled || !params.enabled}
          onChange={(v) => updateParam('scanlines', v)}
        />
        <Slider
          label="Vignette"
          icon={<Monitor className="w-3 h-3" />}
          value={params.vignette}
          disabled={disabled || !params.enabled}
          onChange={(v) => updateParam('vignette', v)}
        />
        <Slider
          label="Noise"
          icon={<Sparkles className="w-3 h-3" />}
          value={params.noise}
          disabled={disabled || !params.enabled}
          onChange={(v) => updateParam('noise', v)}
        />
      </Section>

      <Section title="Warp Effects" icon={<Zap className="w-3.5 h-3.5" />}>
        <Slider
          label="Barrel Distortion"
          icon={<Zap className="w-3 h-3" />}
          value={params.distortion}
          disabled={disabled || !params.enabled}
          onChange={(v) => updateParam('distortion', v)}
        />
        <Slider
          label="Pixelate"
          icon={<Grid3X3 className="w-3 h-3" />}
          value={params.pixelate}
          disabled={disabled || !params.enabled}
          onChange={(v) => updateParam('pixelate', v)}
        />
        <Slider
          label="Heat Haze"
          icon={<Flame className="w-3 h-3" />}
          value={params.heatHaze}
          disabled={disabled || !params.enabled}
          onChange={(v) => updateParam('heatHaze', v)}
        />
      </Section>

      {params.enabled && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg"
        >
          <p className="text-xs text-cyan-700 dark:text-cyan-400">
            <strong>GPU Mode:</strong> Effects run on your graphics card for smooth 60fps performance.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
