import { useState, useMemo } from 'react';
import { ScrollText, RefreshCw, Search } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { CardLabel } from '../ui/StatValue';
import { useLogServices, useLogEntries } from '../../api/logs';
import type { LogEntry } from '../../api/logs';

const PRIORITY_LEVELS = [
  { level: 0, label: 'EMERG',  color: '#ef4444' },
  { level: 1, label: 'ALERT',  color: '#ef4444' },
  { level: 2, label: 'CRIT',   color: '#ef4444' },
  { level: 3, label: 'ERR',    color: '#f97316' },
  { level: 4, label: 'WARN',   color: '#eab308' },
  { level: 5, label: 'NOTICE', color: '#06b6d4' },
  { level: 6, label: 'INFO',   color: 'rgba(255,255,255,0.5)' },
  { level: 7, label: 'DEBUG',  color: 'rgba(255,255,255,0.25)' },
] as const;

const LINE_OPTIONS = [50, 100, 200, 500] as const;
const ALL_LEVEL_SET = new Set([0, 1, 2, 3, 4, 5, 6, 7]);

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlight({ text, search }: { text: string; search: string }) {
  if (!search.trim()) return <>{text}</>;
  const regex = new RegExp(`(${escapeRegex(search)})`, 'gi');
  const parts = text.split(regex);
  const lower = search.toLowerCase();
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lower ? (
          <mark
            key={i}
            style={{ background: 'rgba(234,179,8,0.35)', color: 'inherit', borderRadius: '2px', padding: '0 1px' }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function LogCard() {
  const [source, setSource] = useState<'running' | 'all'>('running');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [lines, setLines] = useState<50 | 100 | 200 | 500>(100);
  const [activeLevels, setActiveLevels] = useState<Set<number>>(new Set(ALL_LEVEL_SET));
  const [searchText, setSearchText] = useState('');

  // If all 8 or zero levels are selected, omit the priority param (fetch everything).
  // Otherwise send Math.max(...activeLevels): journalctl -p N means "levels 0 through N".
  const priorityParam = useMemo<number | undefined>(() => {
    if (activeLevels.size === 0 || activeLevels.size === 8) return undefined;
    return Math.max(...activeLevels);
  }, [activeLevels]);

  const servicesQuery = useLogServices(source);
  const logsQuery = useLogEntries({ unit: selectedUnit, lines, priority: priorityParam });

  const services = servicesQuery.data ?? [];

  // Client-side filter — runs on every keystroke over already-fetched data.
  const displayedEntries = useMemo<LogEntry[]>(() => {
    const entries = logsQuery.data ?? [];
    if (!searchText.trim()) return entries;
    const lower = searchText.toLowerCase();
    return entries.filter(
      (e) =>
        e.message.toLowerCase().includes(lower) ||
        (e.unit?.toLowerCase().includes(lower) ?? false)
    );
  }, [logsQuery.data, searchText]);

  function handleSourceToggle(s: 'running' | 'all') {
    setSource(s);
    setSelectedUnit(''); // clear stale selection — new list loads via queryKey change
  }

  function toggleLevel(level: number) {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  }

  const canRefreshLogs = !!selectedUnit && !logsQuery.isFetching;

  return (
    <GlassCard glowOnHover={false} className="p-6 space-y-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(139,92,246,0.12)' }}
          >
            <ScrollText
              className="w-5 h-5"
              style={{ color: '#a78bfa', filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.4))' }}
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Logs</h2>
            <CardLabel>systemd Journal Viewer</CardLabel>
          </div>
        </div>

        {/* Source toggle */}
        <div
          className="flex items-center gap-1 p-1 rounded-lg shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }}
        >
          {(['running', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleSourceToggle(s)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                source === s ? 'text-purple-300' : 'text-muted hover:text-secondary'
              }`}
              style={
                source === s
                  ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }
                  : {}
              }
            >
              {s === 'running' ? 'Running' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Controls ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Service dropdown + its own refresh */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            disabled={servicesQuery.isFetching}
            className="flex-1 bg-black/20 text-xs font-mono rounded-lg px-2 py-1.5 text-zinc-200 border border-white/10 outline-none cursor-pointer focus:border-white/30 min-w-0 disabled:opacity-50"
          >
            <option value="">Select service…</option>
            {services.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => servicesQuery.refetch()}
            disabled={servicesQuery.isFetching}
            title="Refresh service list"
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-muted ${servicesQuery.isFetching ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Line count */}
        <select
          value={lines}
          onChange={(e) => setLines(Number(e.target.value) as 50 | 100 | 200 | 500)}
          className="bg-black/20 text-xs font-mono rounded-lg px-2 py-1.5 text-zinc-200 border border-white/10 outline-none cursor-pointer focus:border-white/30"
        >
          {LINE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} lines</option>
          ))}
        </select>

        {/* Refresh logs */}
        <button
          onClick={() => logsQuery.refetch()}
          disabled={!canRefreshLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
        >
          <RefreshCw className={`w-3 h-3 ${logsQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      {/* ── Priority toggles ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {PRIORITY_LEVELS.map(({ level, label, color }) => {
          const active = activeLevels.has(level);
          return (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono uppercase tracking-wider transition-all"
              style={{
                color:      active ? color : 'rgba(255,255,255,0.18)',
                background: active ? `color-mix(in srgb, ${color} 12%, transparent)` : 'rgba(255,255,255,0.03)',
                border:     `1px solid ${active ? `color-mix(in srgb, ${color} 30%, transparent)` : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Search ──────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Filter logs…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full bg-black/20 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-200 border border-white/10 outline-none focus:border-white/30 placeholder:text-muted transition-colors"
        />
      </div>

      {/* ── Log table ───────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[rgba(0,0,0,0.2)] backdrop-blur-md">
        {logsQuery.isError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-xs font-mono" style={{ color: 'var(--color-danger)' }}>
              {logsQuery.error?.message ?? 'Failed to fetch logs'}
            </p>
          </div>
        ) : !logsQuery.data ? (
          <div className="px-4 py-10 text-center text-muted text-xs">
            {logsQuery.isFetching
              ? 'Loading…'
              : 'Select a service to view logs'}
          </div>
        ) : displayedEntries.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted text-xs">
            {searchText
              ? 'No entries match your filter'
              : 'No log entries found for the selected filters'}
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-[var(--color-border)]">
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-muted whitespace-nowrap">Time</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-muted whitespace-nowrap">Unit</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-muted whitespace-nowrap">Level</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-muted">Message</th>
              </tr>
            </thead>
            <tbody>
              {displayedEntries.map((entry, i) => {
                const lvl = PRIORITY_LEVELS[Math.min(entry.priority, 7)] ?? PRIORITY_LEVELS[6];
                return (
                  <tr
                    key={i}
                    className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Timestamp */}
                    <td className="px-4 py-2 font-mono text-[10px] text-muted whitespace-nowrap">
                      {formatTimestamp(entry.timestamp)}
                    </td>

                    {/* Unit badge */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {entry.unit ? (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-mono max-w-[140px] truncate"
                          style={{
                            background: 'rgba(6,182,212,0.1)',
                            border: '1px solid rgba(6,182,212,0.2)',
                            color: '#67e8f9',
                          }}
                          title={entry.unit}
                        >
                          <Highlight text={entry.unit} search={searchText} />
                        </span>
                      ) : (
                        <span className="text-muted font-mono text-[10px]">—</span>
                      )}
                    </td>

                    {/* Priority badge */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span
                        className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold"
                        style={{
                          color:      lvl.color,
                          background: `color-mix(in srgb, ${lvl.color} 12%, transparent)`,
                          border:     `1px solid color-mix(in srgb, ${lvl.color} 25%, transparent)`,
                        }}
                      >
                        {lvl.label}
                      </span>
                    </td>

                    {/* Message */}
                    <td className="px-4 py-2 font-mono text-[11px] text-white/55 max-w-0 w-full">
                      <span className="block truncate" title={entry.message}>
                        <Highlight text={entry.message} search={searchText} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      {logsQuery.data && (
        <div className="flex justify-between items-center">
          <CardLabel>
            {displayedEntries.length}
            {searchText ? ` of ${logsQuery.data.length}` : ''} entries
          </CardLabel>
          {logsQuery.dataUpdatedAt > 0 && (
            <CardLabel>
              Updated {new Date(logsQuery.dataUpdatedAt).toLocaleTimeString()}
            </CardLabel>
          )}
        </div>
      )}
    </GlassCard>
  );
}
