import { Monitor, Clock, Activity } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { StatValue, CardLabel } from '../ui/StatValue';
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
    <GlassCard className="p-6 space-y-5">
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
          <h2 className="text-sm font-semibold">System</h2>
          <CardLabel>OS & General Info</CardLabel>
        </div>
      </div>

      {/* OS Details */}
      <div className="space-y-2.5">
        {[
          { label: 'Hostname', value: data.hostname },
          { label: 'OS', value: `${data.os_name} ${data.os_version}` },
          { label: 'Kernel', value: data.kernel },
          { label: 'Arch', value: data.architecture },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex justify-between items-center py-1.5 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <CardLabel>{label}</CardLabel>
            <span className="text-xs font-mono truncate max-w-[55%] text-right" title={value}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Uptime & Processes */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-xl px-4 py-3 flex flex-col items-center gap-1"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
        >
          <Clock className="w-4 h-4 text-muted mb-0.5" />
          <StatValue value={formatUptime(data.uptime_seconds)} size="sm" color="#818cf8" />
          <CardLabel>Uptime</CardLabel>
        </div>
        <div
          className="rounded-xl px-4 py-3 flex flex-col items-center gap-1"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
        >
          <Activity className="w-4 h-4 text-muted mb-0.5" />
          <StatValue value={data.process_count} size="sm" color="#818cf8" />
          <CardLabel>Processes</CardLabel>
        </div>
      </div>

      {/* Load average */}
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
      >
        <CardLabel className="mb-2">Load Average</CardLabel>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: '1 min', value: data.load_avg_1 },
            { label: '5 min', value: data.load_avg_5 },
            { label: '15 min', value: data.load_avg_15 },
          ].map(({ label, value }) => (
            <div key={label}>
              <StatValue value={value.toFixed(2)} size="sm" color="#818cf8" />
              <CardLabel className="mt-0.5">{label}</CardLabel>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
