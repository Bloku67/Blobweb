import { motion } from 'framer-motion';

export function CobwebLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <motion.svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial={{ rotate: 0 }}
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
    >
      {/* Outer spiral lines */}
      <path
        d="M50 10 Q60 30 50 50 Q40 30 50 10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M50 10 Q70 40 50 70 Q30 40 50 10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M50 10 Q80 50 50 90 Q20 50 50 10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      />
      
      {/* Radial lines */}
      <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <line x1="50" y1="10" x2="20" y2="50" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <line x1="50" y1="10" x2="80" y2="50" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <line x1="50" y1="10" x2="30" y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <line x1="50" y1="10" x2="70" y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      
      {/* Inner spiral */}
      <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.8" />
      <circle cx="50" cy="50" r="8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.9" />
      
      {/* Connection points */}
      <circle cx="50" cy="10" r="2" fill="currentColor" />
      <circle cx="20" cy="50" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="80" cy="50" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="30" cy="40" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="70" cy="40" r="1.5" fill="currentColor" opacity="0.8" />
    </motion.svg>
  );
}
