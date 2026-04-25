import React from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { useSystemMetrics } from './api/queries';
import { Header } from './components/Header';
import { CpuCard } from './components/widgets/CpuCard';
import { MemoryCard } from './components/widgets/MemoryCard';
import { TemperatureCard } from './components/widgets/TemperatureCard';
import { DiskCard } from './components/widgets/DiskCard';
import { NetworkCard } from './components/widgets/NetworkCard';
import { OsCard } from './components/widgets/OsCard';
import { SkeletonCard } from './components/LoadingStates';

const cardTransition = (i: number): Transition => ({
  delay: i * 0.07,
  duration: 0.4,
  ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number],
});

function App() {
  const { data, isLoading, isError, error, isRefetching } = useSystemMetrics();

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* ── Ambient background orbs ─────────────────────────── */}
      <div
        className="orb"
        style={{
          top: '-15%',
          left: '-10%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(ellipse, rgba(34,211,238,0.12) 0%, transparent 70%)',
        }}
      />
      <div
        className="orb"
        style={{
          bottom: '-20%',
          right: '-5%',
          width: '45%',
          height: '45%',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.1) 0%, transparent 70%)',
        }}
      />
      <div
        className="orb"
        style={{
          top: '40%',
          left: '40%',
          width: '30%',
          height: '30%',
          background: 'radial-gradient(ellipse, rgba(239,68,68,0.06) 0%, transparent 70%)',
        }}
      />

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="relative z-10 p-5 md:p-8 lg:p-10 max-w-screen-2xl mx-auto">
        <Header
          hostname={data?.os.hostname}
          isConnected={!isError && !isLoading}
          isRefetching={isRefetching}
          lastUpdated={data?.timestamp}
        />

        {/* ── Error call-out ──────────────────────────────────── */}
        <AnimatePresence>
          {isError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 rounded-2xl px-5 py-4 flex gap-3 items-start"
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <span className="text-danger text-sm font-semibold mt-0.5" style={{ color: 'var(--color-danger)' }}>
                ✕
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
                  Unable to reach backend API
                </p>
                <p className="text-xs text-secondary mt-0.5">
                  {(error as Error)?.message ?? 'Unknown error. Check that the backend is running.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Dashboard Grid ──────────────────────────────────── */}
        {isLoading && !data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} className={i === 4 ? 'md:col-span-2 lg:col-span-3' : ''} />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Row 1: CPU, Memory, Temperature */}
            {([
              <CpuCard key="cpu" data={data.cpu} />,
              <MemoryCard key="mem" data={data.memory} />,
              <TemperatureCard key="temp" data={data.temperature} />,
              <DiskCard key="disk" data={data.disk} />,
              <OsCard key="os" data={data.os} />,
              <NetworkCard key="net" data={data.network} />,
            ] as React.ReactNode[]).map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={cardTransition(i)}
              >
                {card}
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;
