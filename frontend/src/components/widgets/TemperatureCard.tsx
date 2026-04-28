import { Thermometer, Fan, Zap, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '../ui/GlassCard';
import { StatValue, CardLabel } from '../ui/StatValue';
import { getStatusColor, statusToColor, statusToGlow, formatNumber } from '../../lib/utils';
import type { TemperatureInfo, CpuInfo } from '../../types/metrics';

interface TempGaugeProps {
  label: string;
  value: number | null;
  max?: number;
  unit?: string;
  colorScale?: { warn: number; danger: number };
}

function GenericGauge({ label, value, max = 100, unit = '°', colorScale = { warn: 65, danger: 80 } }: TempGaugeProps) {
  const val = value ?? 0;
  const status = getStatusColor(val, colorScale);
  const color = statusToColor(status);
  const glow = statusToGlow(status);

  // Gauge arc (semicircle) - SVG based
  const radius = 40;
  const circumference = Math.PI * radius; // half-circle circumference
  const progress = Math.min(100, Math.max(0, (val / max) * 100));
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-16 overflow-visible">
        <svg viewBox="0 0 100 55" className="w-full h-full" style={{ overflow: 'visible' }}>
          {/* Track arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Fill arc */}
          <motion.path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
          />
          {/* Center text */}
          <text
            x="50"
            y="46"
            textAnchor="middle"
            fill={color}
            fontSize="12"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="700"
          >
            {value !== null ? `${formatNumber(val)}${unit}` : 'N/A'}
          </text>
        </svg>
      </div>
      <CardLabel>{label}</CardLabel>
    </div>
  );
}

interface TemperatureCardProps {
  data: TemperatureInfo;
  cpu?: CpuInfo;
}

export function TemperatureCard({ data, cpu }: TemperatureCardProps) {
  const hasThermalData = (data.cpu_celsius !== null && data.cpu_celsius > 0) || (Object.keys(data.sensors || {}).length > 0);

  if (!hasThermalData && cpu) {
    return (
      <GlassCard className="p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(56, 189, 248, 0.12)' }}
            >
              <Zap
                className="w-5 h-5 text-sky-400"
                style={{ filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.4))' }}
              />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Kernel Stats</h2>
              <CardLabel>CPU & System Activity</CardLabel>
            </div>
          </div>
        </div>

        <div className="flex justify-around pt-2">
          <GenericGauge 
            label="Context Sw/s" 
            value={cpu.ctx_switches_per_sec} 
            max={50000} 
            unit="" 
            colorScale={{ warn: 20000, danger: 40000 }}
          />
          <GenericGauge 
            label="Interrupts/s" 
            value={cpu.interrupts_per_sec} 
            max={20000} 
            unit="" 
            colorScale={{ warn: 8000, danger: 15000 }}
          />
        </div>

        <div className="space-y-2 pt-1">
          <div
            className="rounded-xl px-4 py-3 flex justify-between items-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
          >
            <CardLabel>System Calls</CardLabel>
            <div className="flex items-baseline gap-1">
               <span className="text-lg font-mono font-bold text-sky-400">Low</span>
               <span className="text-[10px] text-muted">lat</span>
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  const allSensors = Object.entries(data.sensors ?? {});

  return (
    <GlassCard className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(239, 68, 68, 0.12)' }}
          >
            <Thermometer
              className="w-5 h-5"
              style={{ color: 'var(--color-danger)', filter: 'drop-shadow(0 0 6px var(--color-danger-glow))' }}
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Temperature</h2>
            <CardLabel>Thermal Sensors</CardLabel>
          </div>
        </div>

        {data.fan_speed_rpm !== undefined && data.fan_speed_rpm !== null && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: data.fan_speed_rpm > 0 ? 6000 / data.fan_speed_rpm : 0, ease: 'linear' }}
            >
              <Fan className="w-3.5 h-3.5 text-secondary" />
            </motion.div>
            <span className="text-[11px] font-mono font-bold text-white">{data.fan_speed_rpm.toFixed(0)} <span className="text-[9px] text-muted font-sans font-normal">RPM</span></span>
          </div>
        )}
      </div>

      {/* Gauges */}
      <div className="flex justify-around pt-2">
        <GenericGauge label="CPU" value={data.cpu_celsius} />
        <GenericGauge label="GPU" value={data.gpu_celsius} />
      </div>

      {/* Extra sensor rows */}
      {allSensors.length > 0 && (
        <div className="space-y-2 pt-1">
          <CardLabel>All Sensors</CardLabel>
          <div className="grid grid-cols-2 gap-2">
            {allSensors.map(([key, val]) => {
              const status = getStatusColor(val, { warn: 65, danger: 80 });
              return (
                <div
                  key={key}
                  className="rounded-xl px-3 py-2 flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
                >
                  <span className="text-xs text-secondary truncate max-w-[60%]">{key}</span>
                  <StatValue
                    value={`${val.toFixed(0)}°C`}
                    size="sm"
                    color={statusToColor(status)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
