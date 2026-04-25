import { useState } from 'react';
import { HardDrive } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { MetricBar } from '../ui/MetricBar';
import { StatValue, CardLabel } from '../ui/StatValue';
import { formatBytes } from '../../lib/utils';
import type { DiskInfo } from '../../types/metrics';

interface DiskCardProps {
  data: DiskInfo;
}

export function DiskCard({ data }: DiskCardProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (data.partitions.length === 0) {
    return (
      <GlassCard className="p-6 space-y-5 flex flex-col items-center justify-center min-h-[250px]">
        <HardDrive className="text-secondary w-8 h-8 opacity-50 mb-2" />
        <p className="text-secondary text-sm text-center">No disk partitions detected.</p>
      </GlassCard>
    );
  }

  const safeIndex = selectedIndex >= data.partitions.length ? 0 : selectedIndex;
  const currentPartition = data.partitions[safeIndex];

  return (
    <GlassCard className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(234, 179, 8, 0.12)' }}
          >
            <HardDrive
              className="w-5 h-5"
              style={{
                color: '#eab308',
                filter: 'drop-shadow(0 0 6px rgba(234,179,8,0.4))',
              }}
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Storage</h2>
            <CardLabel>Disk Partitions</CardLabel>
          </div>
        </div>

        {data.partitions.length > 1 && (
          <select
            value={safeIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="bg-black/20 text-xs font-mono rounded-lg px-2 py-1 text-zinc-200 border border-white/10 outline-none cursor-pointer focus:border-white/30 truncate max-w-[120px] shrink-0"
          >
            {data.partitions.map((partition, idx) => (
              <option key={partition.mountpoint} value={idx}>
                {partition.mountpoint}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Partitions */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="truncate pr-2">
              <span className="text-sm font-medium truncate">{currentPartition.mountpoint}</span>
              <span className="ml-2 text-muted text-xs font-mono">{currentPartition.fstype}</span>
            </div>
            <StatValue
              value={currentPartition.percent.toFixed(1)}
              unit="%"
              size="sm"
              color="#eab308"
            />
          </div>
          <MetricBar
            value={currentPartition.percent}
            color="#eab308"
            thresholds={{ warn: 70, danger: 90 }}
          />
          <div className="flex justify-between text-xs text-secondary font-mono">
            <span>{formatBytes(currentPartition.used_bytes)} used</span>
            <span>{formatBytes(currentPartition.free_bytes)} free of {formatBytes(currentPartition.total_bytes)}</span>
          </div>
        </div>
      </div>

      {/* I/O stats */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div
          className="rounded-xl px-4 py-3 text-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
        >
          <CardLabel className="mb-1">Read / s</CardLabel>
          <StatValue value={formatBytes(data.read_bytes_per_sec)} size="sm" color="#eab308" />
        </div>
        <div
          className="rounded-xl px-4 py-3 text-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
        >
          <CardLabel className="mb-1">Write / s</CardLabel>
          <StatValue value={formatBytes(data.write_bytes_per_sec)} size="sm" color="var(--color-warn)" />
        </div>
      </div>
    </GlassCard>
  );
}
