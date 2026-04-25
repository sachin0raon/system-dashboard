import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { getStatusColor, statusToColor, statusToGlow } from '../../lib/utils';

interface MetricBarProps {
  value: number; // 0-100
  label?: string;
  className?: string;
  thresholds?: { warn: number; danger: number };
  color?: string; // override: CSS color value
  animated?: boolean;
}

export function MetricBar({
  value,
  label,
  className,
  thresholds,
  color,
  animated = true,
}: MetricBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const status = getStatusColor(clampedValue, thresholds);
  const fillColor = color ?? statusToColor(status);
  const glowColor = statusToGlow(status);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-secondary font-medium">{label}</span>
          <span className="font-mono text-xs font-semibold" style={{ color: fillColor }}>
            {clampedValue.toFixed(1)}%
          </span>
        </div>
      )}
      <div className="progress-track">
        <motion.div
          className="progress-fill relative"
          style={{
            width: animated ? undefined : `${clampedValue}%`,
            background: `linear-gradient(90deg, ${fillColor} 0%, ${fillColor} 80%, white 100%)`,
            boxShadow: `0 0 12px ${glowColor}`,
          }}
          initial={{ width: 0 }}
          animate={animated ? { width: `${clampedValue}%` } : undefined}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Subtle sheen overlay */}
          <div className="absolute inset-0 bg-white/10 opacity-30" />
        </motion.div>
      </div>
    </div>
  );
}
