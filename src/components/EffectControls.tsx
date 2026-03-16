import { motion } from 'framer-motion';
import type { EffectParams } from '@/hooks/useImageProcessor';
import { 
  Sun, 
  Contrast, 
  Moon,
  Type,
  ScanEye,
  Boxes,
  GitBranch,
  Timer,
  Activity,
  Target,
  Zap,
  Aperture
} from 'lucide-react';

interface SliderProps {
  label: string;
  icon?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function Slider({
  label,
  icon,
  value,
  min,
  max,
  step = 1,
  unit = '',
  disabled,
  onChange,
}: SliderProps) {
  return (
    <div className={`py-1 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-center gap-2 text-xs mb-1">
        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
          {icon && <span className="text-gray-500 dark:text-gray-400">{icon}</span>}
          <span className="truncate">{label}</span>
        </div>
        <span className="text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-gray-600 disabled:opacity-50 accent-blue-600 cursor-pointer"
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

interface EffectControlsProps {
  params: EffectParams;
  onChange: (params: EffectParams) => void;
  disabled?: boolean;
}

export function EffectControls({
  params,
  onChange,
  disabled = false,
}: EffectControlsProps) {
  const update = (key: keyof EffectParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <motion.div
      className="p-3 space-y-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Section title="Lighting" icon={<Sun className="w-3.5 h-3.5" />}>
        <Slider
          label="Brightness"
          icon={<Sun className="w-3 h-3" />}
          value={params.brightness}
          min={0}
          max={200}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('brightness', v)}
        />
        <Slider
          label="Contrast"
          icon={<Contrast className="w-3 h-3" />}
          value={params.contrast}
          min={0}
          max={200}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('contrast', v)}
        />
        <Slider
          label="Exposure"
          icon={<Aperture className="w-3 h-3" />}
          value={params.exposure}
          min={-2}
          max={2}
          step={0.1}
          unit=" EV"
          disabled={disabled}
          onChange={(v) => update('exposure', v)}
        />
        <Slider
          label="Shadows"
          icon={<Moon className="w-3 h-3" />}
          value={params.shadows}
          min={-100}
          max={100}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('shadows', v)}
        />
        <Slider
          label="Highlights"
          icon={<Zap className="w-3 h-3" />}
          value={params.highlights}
          min={-100}
          max={100}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('highlights', v)}
        />
      </Section>

      <Section title="ASCII Text Effect" icon={<Type className="w-3.5 h-3.5" />}>
        <Slider
          label="Intensity"
          value={params.asciiIntensity}
          min={0}
          max={100}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('asciiIntensity', v)}
        />
        <Slider
          label="Character Size"
          value={params.asciiCharSize}
          min={2}
          max={24}
          unit="px"
          disabled={disabled}
          onChange={(v) => update('asciiCharSize', v)}
        />
      </Section>
    </motion.div>
  );
}

interface BlobTrackingControlsProps {
  params: EffectParams;
  onChange: (params: EffectParams) => void;
  disabled?: boolean;
}

export function BlobTrackingControls({
  params,
  onChange,
  disabled = false,
}: BlobTrackingControlsProps) {
  const update = (key: keyof EffectParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  const hasTrackingEnabled = params.blobTrackingSensitivity > 0;

  return (
    <motion.div
      className="p-3 space-y-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Section title="Blob Tracking & Motion" icon={<ScanEye className="w-3.5 h-3.5" />}>
        <Slider
          label="Detection Sensitivity"
          icon={<Activity className="w-3 h-3" />}
          value={params.blobTrackingSensitivity}
          min={0}
          max={100}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('blobTrackingSensitivity', v)}
        />
        
        <div className={`space-y-3 transition-opacity duration-200 ${hasTrackingEnabled ? '' : 'opacity-40'}`}>
          <Slider
            label="Max Blobs"
            icon={<Boxes className="w-3 h-3" />}
            value={params.blobMaxCount}
            min={1}
            max={30}
            disabled={disabled || !hasTrackingEnabled}
            onChange={(v) => update('blobMaxCount', v)}
          />
          
          <Slider
            label="Min Blob Size"
            icon={<Target className="w-3 h-3" />}
            value={params.blobMinSize || 10}
            min={5}
            max={100}
            unit="%"
            disabled={disabled || !hasTrackingEnabled}
            onChange={(v) => update('blobMinSize', v)}
          />
          
          <Slider
            label="Motion Threshold"
            icon={<GitBranch className="w-3 h-3" />}
            value={params.motionThreshold || 15}
            min={5}
            max={50}
            unit="px"
            disabled={disabled || !hasTrackingEnabled}
            onChange={(v) => update('motionThreshold', v)}
          />
          
          <Slider
            label="Tracking Persistence"
            icon={<Timer className="w-3 h-3" />}
            value={params.trackingPersistence || 5}
            min={1}
            max={20}
            unit=" fr"
            disabled={disabled || !hasTrackingEnabled}
            onChange={(v) => update('trackingPersistence', v)}
          />
        </div>
      </Section>

      <Section title="Connection Lines" icon={<GitBranch className="w-3.5 h-3.5" />}>
        <Slider
          label="Line Count"
          value={params.lineCount}
          min={0}
          max={50}
          disabled={disabled}
          onChange={(v) => update('lineCount', v)}
        />
        <Slider
          label="Line Delay"
          value={params.lineDelay}
          min={1}
          max={20}
          unit=" steps"
          disabled={disabled}
          onChange={(v) => update('lineDelay', v)}
        />
        <Slider
          label="Line Opacity"
          value={params.lineOpacity || 80}
          min={10}
          max={100}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('lineOpacity', v)}
        />
      </Section>

      {hasTrackingEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
        >
          <p className="text-xs text-blue-600 dark:text-blue-400">
            <strong>Active:</strong> Detecting bright regions and motion. 
            Lines connect tracked objects across frames.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
