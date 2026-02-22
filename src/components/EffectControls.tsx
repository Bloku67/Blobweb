import { motion } from 'framer-motion';
import type { EffectParams } from '@/hooks/useImageProcessor';

interface SliderProps {
  label: string;
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
  value,
  min,
  max,
  step = 1,
  unit = '',
  disabled,
  onChange,
}: SliderProps) {
  return (
    <div className="py-1">
      <div className="flex justify-between items-center gap-2 text-xs mb-0.5">
        <span className="text-gray-700 dark:text-gray-300 truncate">{label}</span>
        <span className="text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
          {value}
          {unit}
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
        className="w-full h-1 rounded-full appearance-none bg-gray-200 dark:bg-gray-600 disabled:opacity-50 accent-blue-600 slider-compact"
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 overflow-hidden">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2.5 py-1.5 border-b border-gray-200 dark:border-gray-600">
        {title}
      </h3>
      <div className="px-2.5 py-1.5">{children}</div>
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
      className="p-2 space-y-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Section title="Lighting">
        <Slider
          label="Brightness"
          value={params.brightness}
          min={0}
          max={200}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('brightness', v)}
        />
        <Slider
          label="Contrast"
          value={params.contrast}
          min={0}
          max={200}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('contrast', v)}
        />
        <Slider
          label="Exposure"
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
          value={params.shadows}
          min={0}
          max={100}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('shadows', v)}
        />
        <Slider
          label="Highlights"
          value={params.highlights}
          min={0}
          max={100}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('highlights', v)}
        />
      </Section>

      <Section title="ASCII Text Effect">
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
          label="Character size"
          value={params.asciiCharSize}
          min={2}
          max={20}
          unit="px"
          disabled={disabled}
          onChange={(v) => update('asciiCharSize', v)}
        />
      </Section>

      <Section title="Blob tracking">
        <Slider
          label="Sensitivity"
          value={params.blobTrackingSensitivity}
          min={0}
          max={100}
          unit="%"
          disabled={disabled}
          onChange={(v) => update('blobTrackingSensitivity', v)}
        />
        <Slider
          label="Max blobs"
          value={params.blobMaxCount}
          min={1}
          max={20}
          disabled={disabled}
          onChange={(v) => update('blobMaxCount', v)}
        />
        <Slider
          label="Lines amount"
          value={params.lineCount}
          min={0}
          max={30}
          disabled={disabled}
          onChange={(v) => update('lineCount', v)}
        />
        <Slider
          label="Line delay"
          value={params.lineDelay}
          min={1}
          max={15}
          unit=" steps"
          disabled={disabled}
          onChange={(v) => update('lineDelay', v)}
        />
      </Section>
    </motion.div>
  );
}
