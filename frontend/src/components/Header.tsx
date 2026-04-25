import { Cpu, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeaderProps {
  hostname?: string;
  isConnected: boolean;
  isRefetching: boolean;
  lastUpdated?: string;
}

export function Header({ hostname, isConnected, isRefetching, lastUpdated }: HeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8 relative z-10">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{
            background: 'var(--color-accent-dim)',
            border: '1px solid var(--color-border-accent)',
            boxShadow: '0 0 20px var(--color-accent-glow)',
          }}
        >
          <Cpu className="w-5 h-5 glow-accent" style={{ color: 'var(--color-accent)' }} />
        </div>
        <div>
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            System Dashboard
          </h1>
          {hostname && (
            <p className="text-xs text-secondary font-mono">@{hostname}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Connection indicator */}
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            background: isConnected
              ? 'rgba(34,197,94,0.08)'
              : 'rgba(239,68,68,0.08)',
            border: `1px solid ${isConnected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5" style={{ color: 'var(--color-ok)' }} />
          ) : (
            <WifiOff className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
          )}
          <span
            className="text-xs font-semibold font-mono"
            style={{ color: isConnected ? 'var(--color-ok)' : 'var(--color-danger)' }}
          >
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Refresh spinner */}
        <motion.div
          animate={isRefetching ? { rotate: 360 } : { rotate: 0 }}
          transition={
            isRefetching
              ? { repeat: Infinity, duration: 1, ease: 'linear' }
              : { duration: 0.3 }
          }
        >
          <RefreshCw
            className="w-4 h-4"
            style={{ color: isRefetching ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          />
        </motion.div>

        {/* Last updated */}
        {lastUpdated && (
          <span className="text-xs text-muted font-mono hidden sm:block">
            {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>
    </header>
  );
}
