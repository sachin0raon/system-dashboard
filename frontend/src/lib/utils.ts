import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns a status color token based on a percentage threshold */
export function getStatusColor(
  value: number,
  thresholds = { warn: 60, danger: 85 }
): 'ok' | 'warn' | 'danger' {
  if (value >= thresholds.danger) return 'danger';
  if (value >= thresholds.warn) return 'warn';
  return 'ok';
}

/** Maps status string to CSS variable colors */
export function statusToColor(status: 'ok' | 'warn' | 'danger') {
  const map = {
    ok: 'var(--color-ok)',
    warn: 'var(--color-warn)',
    danger: 'var(--color-danger)',
  };
  return map[status];
}

export function statusToGlow(status: 'ok' | 'warn' | 'danger') {
  const map = {
    ok: 'var(--color-ok-glow)',
    warn: 'var(--color-warn-glow)',
    danger: 'var(--color-danger-glow)',
  };
  return map[status];
}

/** Format bytes into human-readable string */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
/** Format a number into a human-readable string (e.g. 1.2k) */
export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toFixed(0);
}
