import { ShieldCheck, ShieldAlert, Activity } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { CardLabel, StatValue } from '../ui/StatValue';
import type { TemperatureInfo, OsInfo } from '../../types/metrics';

interface SystemHealthCardProps {
  temperature: TemperatureInfo;
  os: OsInfo;
}

interface AlertItem {
  active: boolean;
  label: string;
  severity: 'danger' | 'warn';
}

/** Animated load-average bar. Normalized to a 4-core Pi baseline. */
function LoadBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 4) * 100);
  const color =
    value >= 3.5 ? 'var(--color-danger)' :
    value >= 2.0 ? 'var(--color-warn)' :
    'var(--color-ok)';

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <CardLabel>{label}</CardLabel>
        <span className="text-xs font-mono font-bold tabular-nums" style={{ color }}>
          {value.toFixed(2)}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
    </div>
  );
}

export function SystemHealthCard({ temperature, os }: SystemHealthCardProps) {
  const alertItems: AlertItem[] = [
    { active: temperature.is_under_voltage, label: 'Under-Voltage', severity: 'danger' },
    { active: temperature.is_throttled,     label: 'Throttled',     severity: 'danger' },
    { active: temperature.freq_capped,      label: 'Freq Capped',   severity: 'warn'   },
    { active: temperature.soft_temp_limit,  label: 'Temp Limit',    severity: 'warn'   },
  ];

  const isNominal = alertItems.every(a => !a.active);

  return (
    <GlassCard className="p-6 space-y-5">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-500"
          style={{
            background: isNominal
              ? 'rgba(34,197,94,0.12)'
              : 'rgba(239,68,68,0.12)',
          }}
        >
          {isNominal ? (
            <ShieldCheck
              className="w-5 h-5"
              style={{
                color: 'var(--color-ok)',
                filter: 'drop-shadow(0 0 6px var(--color-ok-glow))',
              }}
            />
          ) : (
            <ShieldAlert
              className="w-5 h-5"
              style={{
                color: 'var(--color-danger)',
                filter: 'drop-shadow(0 0 6px var(--color-danger-glow))',
              }}
            />
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold">System Health</h2>
          <CardLabel>
            {isNominal
              ? 'All Systems Nominal'
              : `${alertItems.filter(a => a.active).length} Alert${alertItems.filter(a => a.active).length > 1 ? 's' : ''} Active`}
          </CardLabel>
        </div>
      </div>

      {/* ── Thermal & Power status badges ────────────────────── */}
      <div className="space-y-2">
        <CardLabel>Thermal &amp; Power</CardLabel>
        <div className="flex flex-wrap gap-2">
          {isNominal ? (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg"
              style={{
                background: 'rgba(34,197,94,0.10)',
                border: '1px solid rgba(34,197,94,0.22)',
                color: 'var(--color-ok)',
              }}
            >
              ✓ All Clear
            </span>
          ) : (
            alertItems.map(({ active, label, severity }) => (
              <span
                key={label}
                className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-300"
                style={
                  active
                    ? severity === 'danger'
                      ? {
                          background: 'rgba(239,68,68,0.12)',
                          border: '1px solid rgba(239,68,68,0.30)',
                          color: 'var(--color-danger)',
                        }
                      : {
                          background: 'rgba(245,158,11,0.12)',
                          border: '1px solid rgba(245,158,11,0.30)',
                          color: 'var(--color-warn)',
                        }
                    : {
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        color: 'rgba(255,255,255,0.22)',
                      }
                }
              >
                {active ? '● ' : '○ '}{label}
              </span>
            ))
          )}
        </div>
      </div>

      {/* ── Load Average ─────────────────────────────────────── */}
      <div className="space-y-3">
        <CardLabel>Load Average</CardLabel>
        <LoadBar label="1 min"  value={os.load_avg_1}  />
        <LoadBar label="5 min"  value={os.load_avg_5}  />
        <LoadBar label="15 min" value={os.load_avg_15} />
      </div>

      {/* ── Process count pill ───────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-2.5"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-muted" />
          <CardLabel>Active Processes</CardLabel>
        </div>
        <StatValue value={os.process_count} size="sm" color="var(--color-accent)" />
      </div>
    </GlassCard>
  );
}
