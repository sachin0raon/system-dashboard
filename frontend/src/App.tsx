import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { useSystemSocket } from './api/socket';
import { Header } from './components/Header';
import { CpuCard } from './components/widgets/CpuCard';
import { MemoryCard } from './components/widgets/MemoryCard';
import { TemperatureCard } from './components/widgets/TemperatureCard';
import { DiskCard } from './components/widgets/DiskCard';
import { NetworkCard } from './components/widgets/NetworkCard';
import { OsCard } from './components/widgets/OsCard';
import { TopProcessesCard } from './components/widgets/TopProcessesCard';
import { SystemHealthCard } from './components/widgets/SystemHealthCard';
import { SkeletonCard } from './components/LoadingStates';

const cardTransition = (i: number): Transition => ({
  delay: i * 0.07,
  duration: 0.4,
  ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number],
});

function App() {
  const { data, isLoading, isError, error, isRefetching } = useSystemSocket();

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
            {[
              /* Row 1 — equal thirds */
              'lg:col-span-4',
              'lg:col-span-4',
              'lg:col-span-4',
              /* Row 2 — four equal quarters */
              'lg:col-span-3',
              'lg:col-span-3',
              'lg:col-span-3',
              'lg:col-span-3',
              /* Row 3 — full-width process table */
              'lg:col-span-12',
            ].map((className, i) => (
              <div key={i} className={`${className} h-full`}>
                <SkeletonCard />
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
            {[
              /* Row 1 — three equal stat cards */
              { id: 'cpu',    node: <CpuCard data={data.cpu} />,                                                                           className: 'lg:col-span-4' },
              { id: 'mem',    node: <MemoryCard data={data.memory} />,                                                                     className: 'lg:col-span-4' },
              { id: 'os',     node: <OsCard data={data.os} />,                                                                             className: 'lg:col-span-4' },
              /* Row 2 — four equal quarters */
              { id: 'disk',   node: <DiskCard data={data.disk} />,                                                                         className: 'lg:col-span-3' },
              { id: 'net',    node: <NetworkCard data={data.network} />,                                                                   className: 'lg:col-span-3' },
              { id: 'temp',   node: <TemperatureCard data={data.temperature} />,                                                           className: 'lg:col-span-3' },
              { id: 'health', node: <SystemHealthCard temperature={data.temperature} os={data.os} />,                                      className: 'lg:col-span-3' },
              /* Row 3 — process table gets full width for comfortable columns */
              { id: 'procs',  node: <TopProcessesCard cpuData={data.processes_cpu} memData={data.processes_memory} />,                     className: 'md:col-span-2 lg:col-span-12' },
            ].map((item, i) => (
              <motion.div
                key={item.id}
                className={`${item.className} h-full`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={cardTransition(i)}
              >
                {item.node}
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;
