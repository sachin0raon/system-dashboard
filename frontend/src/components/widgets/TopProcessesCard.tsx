import { Activity, ChevronDown } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { CardLabel } from '../ui/StatValue';
import type { ProcessInfo } from '../../types/metrics';
import { useEffect, useState } from 'react';

interface TopProcessesCardProps {
  cpuData: ProcessInfo[];
  memData: ProcessInfo[];
}

export function TopProcessesCard({ cpuData, memData }: TopProcessesCardProps) {
  const [sortBy, setSortBy] = useState<'cpu' | 'memory'>(() => {
    return (localStorage.getItem('process-sort-by') as 'cpu' | 'memory') || 'cpu';
  });

  useEffect(() => {
    localStorage.setItem('process-sort-by', sortBy);
  }, [sortBy]);

  const activeData = sortBy === 'cpu' ? cpuData : memData;

  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
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
            <CardLabel>Live Task Manager</CardLabel>
          </div>
        </div>

        {/* Sort Dropdown */}
        <div className="relative group/select">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'cpu' | 'memory')}
            className="appearance-none bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold py-1.5 pl-3 pr-8 rounded-lg border border-white/10 outline-none cursor-pointer transition-all text-white/80"
          >
            <option value="cpu">By CPU %</option>
            <option value="memory">By Memory %</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[rgba(0,0,0,0.2)] backdrop-blur-md">
        <table className="w-full min-w-[450px] text-xs text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-[var(--color-border)]">
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-muted">PID</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-muted">Process Name</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-muted text-right">CPU %</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-muted text-right">MEM %</th>
            </tr>
          </thead>
          <tbody>
              {activeData.length > 0 ? (
                activeData.map((proc) => (
                  <tr
                    key={proc.pid}
                    className="group hover:bg-white/[0.05] transition-colors border-b border-white/[0.03] last:border-b-0"
                  >
                    <td className="px-4 py-3 text-muted font-mono">{proc.pid}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white/90 truncate max-w-[100px] sm:max-w-[150px] lg:max-w-[200px]">{proc.name}</span>
                        <span className="text-[9px] uppercase tracking-wider text-muted opacity-60">
                          {proc.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-mono font-bold group-hover:glow-accent transition-all ${sortBy === 'cpu' ? 'text-primary' : 'text-zinc-400'}`}>
                          {proc.cpu_percent.toFixed(1)}%
                        </span>
                        {/* Mini bar indicator */}
                        <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${sortBy === 'cpu' ? 'bg-primary' : 'bg-zinc-500'}`}
                            style={{ width: `${Math.min(100, proc.cpu_percent)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-mono font-bold transition-all ${sortBy === 'memory' ? 'text-purple-400' : 'text-zinc-400'}`}>
                          {proc.memory_percent.toFixed(1)}%
                        </span>
                        <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${sortBy === 'memory' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'bg-zinc-500'}`}
                            style={{ width: `${Math.min(100, proc.memory_percent)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted italic">
                    No intensive processes detected
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
