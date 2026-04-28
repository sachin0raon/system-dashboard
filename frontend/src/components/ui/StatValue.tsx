import { cn } from '../../lib/utils';

interface StatValueProps {
  value: string | number;
  unit?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
}

export function StatValue({ value, unit, size = 'lg', color, className }: StatValueProps) {
  const sizeMap = {
    xs: 'text-sm',
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  return (
    <div
      className={cn('font-mono font-bold tracking-tight leading-none', sizeMap[size], className)}
      style={{ color: color ?? 'var(--color-text)' }}
    >
      {value}
      {unit && (
        <span
          className="font-mono font-medium ml-1"
          style={{
            fontSize: '0.55em',
            color: 'var(--color-text-secondary)',
          }}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

interface CardLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function CardLabel({ children, className }: CardLabelProps) {
  return (
    <p className={cn('text-xs font-medium uppercase tracking-widest text-muted', className)}>
      {children}
    </p>
  );
}
