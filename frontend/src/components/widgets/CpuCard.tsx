import { Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '../ui/GlassCard';
import { MetricBar } from '../ui/MetricBar';
import { StatValue, CardLabel } from '../ui/StatValue';
import type { CpuInfo } from '../../types/metrics';

interface CpuCardProps {
  data: CpuInfo;
}

export function CpuCard({ data }: CpuCardProps) {
  return (
    <GlassCard className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-accent-dim)' }}
          >
            <Cpu className="w-5 h-5 glow-accent" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">CPU</h2>
            <CardLabel>Processor</CardLabel>
          </div>
        </div>
        <StatValue value={data.usage_percent.toFixed(1)} unit="%" size="lg" color="var(--color-accent)" />
      </div>

      {/* Overall bar */}
      <MetricBar value={data.usage_percent} thresholds={{ warn: 60, danger: 85 }} />

      {/* Per-core grid */}
      {data.per_core_percent.length > 0 && (
        <div className="space-y-2">
          <CardLabel>Per Core</CardLabel>
          <div className="grid grid-cols-2 gap-2">
            {data.per_core_percent.map((pct, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <MetricBar
                  value={pct}
                  label={`Core ${i}`}
                  thresholds={{ warn: 70, danger: 90 }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        {[
          { label: 'Freq', value: `${(data.frequency_mhz / 1000).toFixed(2)}`, unit: 'GHz' },
          { label: 'Cores', value: data.core_count, unit: 'phy' },
          { label: 'Threads', value: data.thread_count, unit: 'log' },
        ].map(({ label, value, unit }) => (
          <div
            key={label}
            className="rounded-xl px-3 py-2 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
          >
            <StatValue value={value} unit={unit} size="sm" />
            <CardLabel className="mt-0.5">{label}</CardLabel>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
