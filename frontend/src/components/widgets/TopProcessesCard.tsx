import { Activity, ChevronDown, ChevronUp, ChevronsUpDown, GitBranch } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { CardLabel } from '../ui/StatValue';
import type { ProcessInfo } from '../../types/metrics';
import { useState, useMemo } from 'react';

interface TopProcessesCardProps {
  cpuData: ProcessInfo[];
  memData: ProcessInfo[];
}


type SortCol = 'pid' | 'name' | 'cpu' | 'mem' | 'threads' | 'uptime' | 'cmd';
type SortDir = 'asc' | 'desc';

/** Human-readable uptime from epoch seconds */
function formatUptime(createTimeEpoch: number): string {
  if (!createTimeEpoch) return '—';
  const secs = Math.floor(Date.now() / 1000 - createTimeEpoch);
  if (secs < 0) return '—';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `${h}h ${rm}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h`;
}

/** Trim cmdline to a readable length */
function shortenCmd(cmd: string): string {
  // Strip leading path components for readability: show last segment + args
  const parts = cmd.split(' ');
  const binary = parts[0].split('/').pop() ?? parts[0];
  const args = parts.slice(1).join(' ');
  const short = args ? `${binary} ${args}` : binary;
  return short.length > 60 ? short.slice(0, 57) + '…' : short;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-1" />;
  return dir === 'desc'
    ? <ChevronDown className="w-3 h-3 inline ml-1 text-[var(--color-accent)]" />
    : <ChevronUp className="w-3 h-3 inline ml-1 text-[var(--color-accent)]" />;
}

export function TopProcessesCard({ cpuData, memData }: TopProcessesCardProps) {
  const [sortCol, setSortCol] = useState<SortCol>('cpu');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Deduplicate by PID (merge cpu & mem lists) to show all "intensive" processes
  const merged = useMemo<ProcessInfo[]>(() => {
    const combined = [...cpuData, ...memData];
    const unique = new Map<number, ProcessInfo>();
    
    combined.forEach(p => {
      // If we see the same PID twice, the one in cpuData usually has fresher CPU %
      // but they should be very similar. We just ensure uniqueness here.
      unique.set(p.pid, p);
    });
    
    return Array.from(unique.values());
  }, [cpuData, memData]);

  const sorted = useMemo(() => {
    const arr = [...merged];
    arr.sort((a, b) => {
      let av: number | string, bv: number | string;
      switch (sortCol) {
        case 'pid':      av = a.pid;             bv = b.pid;             break;
        case 'name':     av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
        case 'cpu':      av = a.cpu_percent;     bv = b.cpu_percent;     break;
        case 'mem':      av = a.memory_percent;  bv = b.memory_percent;  break;
        case 'threads':  av = a.num_threads;     bv = b.num_threads;     break;
        case 'uptime':   av = a.create_time;     bv = b.create_time;     break;
        case 'cmd':      av = a.cmdline.toLowerCase(); bv = b.cmdline.toLowerCase(); break;
        default:         av = a.cpu_percent;     bv = b.cpu_percent;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [merged, sortCol, sortDir]);

  function handleColClick(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  const thCls = (col: SortCol) =>
    `px-4 py-3 font-semibold uppercase tracking-wider text-[10px] cursor-pointer select-none whitespace-nowrap transition-colors
    ${sortCol === col ? 'text-[var(--color-accent)]' : 'text-muted hover:text-secondary'}`;

  return (
    <GlassCard className="p-6 space-y-4">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
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
            <CardLabel>Live Task Manager · {sorted.length} unique tasks</CardLabel>
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[rgba(0,0,0,0.2)] backdrop-blur-md [overflow-anchor:none]">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-[var(--color-border)]">
              <th className={thCls('pid')} onClick={() => handleColClick('pid')}>
                PID <SortIcon active={sortCol === 'pid'} dir={sortDir} />
              </th>
              <th className={thCls('name')} onClick={() => handleColClick('name')}>
                Process <SortIcon active={sortCol === 'name'} dir={sortDir} />
              </th>
              <th className={thCls('cmd')} onClick={() => handleColClick('cmd')}>
                Command / Path <SortIcon active={sortCol === 'cmd'} dir={sortDir} />
              </th>
              <th className={`${thCls('threads')} text-right`} onClick={() => handleColClick('threads')}>
                Threads <SortIcon active={sortCol === 'threads'} dir={sortDir} />
              </th>
              <th className={`${thCls('uptime')} text-right`} onClick={() => handleColClick('uptime')}>
                Uptime <SortIcon active={sortCol === 'uptime'} dir={sortDir} />
              </th>
              <th className={`${thCls('cpu')} text-right`} onClick={() => handleColClick('cpu')}>
                CPU % <SortIcon active={sortCol === 'cpu'} dir={sortDir} />
              </th>
              <th className={`${thCls('mem')} text-right`} onClick={() => handleColClick('mem')}>
                MEM % <SortIcon active={sortCol === 'mem'} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length > 0 ? (
              sorted.map((proc) => {
                const isChild = proc.ppid > 1;
                return (
                  <tr
                    key={proc.pid}
                    className="group hover:bg-white/[0.04] transition-colors border-b border-white/[0.03] last:border-b-0"
                  >
                    {/* PID */}
                    <td className="px-4 py-2.5 text-muted font-mono text-[11px] whitespace-nowrap">
                      {proc.pid}
                    </td>

                    {/* Name + user + parent badge */}
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white/90 truncate max-w-[130px]">{proc.name}</span>
                          {isChild && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                              style={{
                                background: 'rgba(139,92,246,0.12)',
                                border: '1px solid rgba(139,92,246,0.25)',
                                color: '#a78bfa',
                              }}
                              title={`Parent PID: ${proc.ppid}`}
                            >
                              <GitBranch className="w-2.5 h-2.5" />
                              {proc.ppid}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] uppercase tracking-wider text-muted opacity-60">
                          {proc.username}
                        </span>
                      </div>
                    </td>

                    {/* Command / Path */}
                    <td className="px-4 py-2.5 max-w-[340px]">
                      <span
                        className="font-mono text-[10px] text-white/50 group-hover:text-white/70 transition-colors truncate block"
                        title={proc.cmdline}
                      >
                        {shortenCmd(proc.cmdline)}
                      </span>
                    </td>

                    {/* Threads */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span className="font-mono text-[11px] text-white/60">{proc.num_threads}</span>
                    </td>

                    {/* Uptime */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span className="font-mono text-[11px] text-white/50">
                        {formatUptime(proc.create_time)}
                      </span>
                    </td>

                    {/* CPU % */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`font-mono font-bold text-[11px] ${
                            sortCol === 'cpu' ? 'text-[var(--color-primary)]' : 'text-zinc-400'
                          }`}
                        >
                          {proc.cpu_percent.toFixed(1)}%
                        </span>
                        <div className="w-14 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, proc.cpu_percent)}%`,
                              background: sortCol === 'cpu'
                                ? 'var(--color-primary)'
                                : 'rgba(161,161,170,0.5)',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* MEM % */}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`font-mono font-bold text-[11px] ${
                            sortCol === 'mem' ? 'text-purple-400' : 'text-zinc-400'
                          }`}
                        >
                          {proc.memory_percent.toFixed(1)}%
                        </span>
                        <div className="w-14 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, proc.memory_percent)}%`,
                              background: sortCol === 'mem'
                                ? 'rgb(168,85,247)'
                                : 'rgba(161,161,170,0.5)',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted italic">
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
