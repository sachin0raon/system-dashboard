import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  glowOnHover?: boolean;
  accentGlow?: boolean;
}

export function GlassCard({
  className,
  children,
  glowOnHover = true,
  accentGlow = false,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      whileHover={glowOnHover ? { scale: 1.015, y: -2 } : undefined}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('glass glass-hover h-full', className)}
      style={
        accentGlow
          ? { boxShadow: '0 0 32px var(--color-accent-glow)' }
          : undefined
      }
      {...props}
    >
      {children}
    </motion.div>
  );
}
