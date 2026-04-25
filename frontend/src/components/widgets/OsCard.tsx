import { Monitor, Clock, Activity } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { CardLabel } from '../ui/StatValue';
import type { OsInfo } from '../../types/metrics';

interface OsCardProps {
  data: OsInfo;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export function OsCard({ data }: OsCardProps) {


  return (
    <GlassCard className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(99, 102, 241, 0.15)' }}
        >
          <Monitor
            className="w-5 h-5"
            style={{
              color: '#818cf8',
              filter: 'drop-shadow(0 0 6px rgba(99,102,241,0.5))',
            }}
          />
        </div>
        <div>
          <h2 className="text-sm font-semibold">System OS</h2>
          <CardLabel>{data.process_count} Processes</CardLabel>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-0.5">
            <Clock className="w-3.5 h-3.5 text-muted" />
            <CardLabel>Uptime</CardLabel>
          </div>
          <div className="text-sm font-mono font-bold text-[#818cf8]">{formatUptime(data.uptime_seconds)}</div>
        </div>
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-0.5">
            <Activity className="w-3.5 h-3.5 text-muted" />
            <CardLabel>Load Avg</CardLabel>
          </div>
          <div className="text-sm font-mono font-bold text-[#818cf8]">{data.load_avg_1.toFixed(2)}, {data.load_avg_5.toFixed(2)}</div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
        {[
          { label: 'Hostname', value: data.hostname },
          { label: 'Platform', value: `${data.os_name} ${data.os_version}` },
          { label: 'Kernel', value: data.kernel },
          { label: 'Architecture', value: data.architecture },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center text-xs">
            <span className="text-secondary font-medium tracking-wide uppercase text-[10px]">{label}</span>
            <span className="font-mono text-white truncate max-w-[65%]">{value}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
