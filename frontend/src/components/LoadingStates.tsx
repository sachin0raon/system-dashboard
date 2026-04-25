
interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={`glass rounded-2xl p-6 space-y-4 overflow-hidden ${className ?? ''}`}
    >
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl shimmer" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-24 rounded shimmer" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="h-2 w-16 rounded shimmer" style={{ background: 'rgba(255,255,255,0.03)' }} />
        </div>
        <div className="h-8 w-16 rounded shimmer" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* Bar skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            <div className="h-2 w-16 rounded shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <div className="h-2 w-10 rounded shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
          </div>
          <div className="progress-track shimmer" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      ))}

      {/* Footer skeleton */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl px-3 py-4 shimmer"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="glass rounded-2xl p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]"
      style={{ border: '1px solid rgba(239,68,68,0.25)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.15)' }}
      >
        <span style={{ color: 'var(--color-danger)', fontSize: '1.25rem' }}>!</span>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
        Connection Error
      </p>
      <p className="text-xs text-secondary text-center max-w-xs">{message}</p>
    </div>
  );
}
