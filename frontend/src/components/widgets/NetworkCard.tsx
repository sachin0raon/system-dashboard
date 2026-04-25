import { useState } from 'react';
import { Network } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { StatValue, CardLabel } from '../ui/StatValue';
import { formatBytes } from '../../lib/utils';
import type { NetworkInfo } from '../../types/metrics';

interface NetworkCardProps {
  data: NetworkInfo;
}

export function NetworkCard({ data }: NetworkCardProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activeInterfaces = data.interfaces.filter(
    (iface) => iface.name !== 'lo' && (iface.bytes_sent_total > 0 || iface.bytes_recv_total > 0)
  );

  if (activeInterfaces.length === 0) {
    return (
      <GlassCard className="p-6 space-y-5 flex flex-col items-center justify-center min-h-[250px]">
        <Network className="text-secondary w-8 h-8 opacity-50 mb-2" />
        <p className="text-secondary text-sm text-center">No active interfaces detected.</p>
      </GlassCard>
    );
  }

  const safeIndex = selectedIndex >= activeInterfaces.length ? 0 : selectedIndex;
  const currentIface = activeInterfaces[safeIndex];

  return (
    <GlassCard className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(34, 197, 94, 0.12)' }}
          >
            <Network
              className="w-5 h-5"
              style={{
                color: 'var(--color-ok)',
                filter: 'drop-shadow(0 0 6px var(--color-ok-glow))',
              }}
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Network</h2>
            <CardLabel>Interface Data</CardLabel>
          </div>
        </div>
        
        {activeInterfaces.length > 1 && (
          <select
            value={safeIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="bg-black/20 text-xs font-mono rounded-lg px-2 py-1 text-zinc-200 border border-white/10 outline-none cursor-pointer focus:border-white/30 truncate max-w-[100px]"
          >
            {activeInterfaces.map((iface, idx) => (
              <option key={iface.name} value={idx}>
                {iface.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div
        className="rounded-xl p-4 space-y-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex justify-between items-start">
          <div className="truncate pr-2">
            <p className="text-sm font-semibold font-mono truncate">{currentIface.name}</p>
            {currentIface.ip_address && (
              <p className="text-xs text-secondary font-mono mt-0.5 truncate">{currentIface.ip_address}</p>
            )}
          </div>
          <div
            className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
            style={{
              background: 'var(--color-ok)',
              boxShadow: '0 0 6px var(--color-ok-glow)',
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <CardLabel className="mb-1">↓ Recv/s</CardLabel>
            <StatValue
              value={formatBytes(currentIface.bytes_recv_per_sec)}
              size="sm"
              color="var(--color-ok)"
            />
          </div>
          <div>
            <CardLabel className="mb-1">↑ Sent/s</CardLabel>
            <StatValue
              value={formatBytes(currentIface.bytes_sent_per_sec)}
              size="sm"
              color="var(--color-accent)"
            />
          </div>
          <div>
            <CardLabel className="mb-1">Total Recv</CardLabel>
            <StatValue value={formatBytes(currentIface.bytes_recv_total)} size="sm" />
          </div>
          <div>
            <CardLabel className="mb-1">Total Sent</CardLabel>
            <StatValue value={formatBytes(currentIface.bytes_sent_total)} size="sm" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
