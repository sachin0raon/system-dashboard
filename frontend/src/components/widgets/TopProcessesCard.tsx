import { Activity } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { CardLabel } from '../ui/StatValue';
import type { ProcessInfo } from '../../types/metrics';

interface TopProcessesCardProps {
  data: ProcessInfo[];
}

export function TopProcessesCard({ data }: TopProcessesCardProps) {
  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(56, 189, 248, 0.12)' }}
        >
          <Activity
            className="w-5 h-5"
            style={{ color: 'var(--color-primary)', filter: 'drop-shadow(0 0 6px var(--color-primary-glow))' }}
          />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Top Processes</h2>
          <CardLabel>By CPU Usage</CardLabel>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[rgba(0,0,0,0.2)]">
        <table className="w-full text-xs text-left">
          <thead className="bg-[rgba(255,255,255,0.04)] border-b border-[var(--color-border)] text-secondary">
            <tr>
              <th className="px-3 py-2 font-medium">PID</th>
              <th className="px-3 py-2 font-medium">NAME</th>
              <th className="px-3 py-2 font-medium text-right">CPU %</th>
              <th className="px-3 py-2 font-medium text-right">MEM %</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((proc) => (
                <tr key={proc.pid} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-3 py-2 text-secondary font-mono">{proc.pid}</td>
                  <td className="px-3 py-2 font-medium truncate max-w-[100px]">{proc.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-primary font-medium">{proc.cpu_percent.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono">{proc.memory_percent.toFixed(1)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-secondary">
                  No process data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
