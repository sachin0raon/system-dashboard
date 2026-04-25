import { MemoryStick } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { MetricBar } from '../ui/MetricBar';
import { StatValue, CardLabel } from '../ui/StatValue';
import { formatBytes } from '../../lib/utils';
import type { MemoryInfo } from '../../types/metrics';

interface MemoryCardProps {
  data: MemoryInfo;
}

export function MemoryCard({ data }: MemoryCardProps) {
  return (
    <GlassCard className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(139, 92, 246, 0.15)' }}
          >
            <MemoryStick className="w-5 h-5" style={{ color: '#a78bfa', filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.5))' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Memory</h2>
            <CardLabel>RAM & Swap</CardLabel>
          </div>
        </div>
        <StatValue
          value={data.percent.toFixed(1)}
          unit="%"
          size="lg"
          color="#a78bfa"
        />
      </div>

      {/* RAM */}
      <div className="space-y-2">
        <MetricBar
          value={data.percent}
          label="RAM"
          color="#a78bfa"
          thresholds={{ warn: 70, danger: 90 }}
        />
        <div className="flex justify-between text-xs text-secondary font-mono">
          <span>{formatBytes(data.used_bytes)} used</span>
          <span>{formatBytes(data.total_bytes)} total</span>
        </div>
      </div>

      {/* Swap */}
      <div className="space-y-2">
        <MetricBar
          value={data.swap_percent}
          label="Swap"
          color="var(--color-warn)"
          thresholds={{ warn: 50, danger: 80 }}
        />
        <div className="flex justify-between text-xs text-secondary font-mono">
          <span>{formatBytes(data.swap_used_bytes)} used</span>
          <span>{formatBytes(data.swap_total_bytes)} total</span>
        </div>
      </div>

      {/* Available */}
      <div
        className="rounded-xl px-4 py-3 flex justify-between items-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
      >
        <CardLabel>Available</CardLabel>
        <StatValue value={formatBytes(data.available_bytes)} size="sm" color="#a78bfa" />
      </div>
    </GlassCard>
  );
}
