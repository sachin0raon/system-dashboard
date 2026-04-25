import { useQuery } from '@tanstack/react-query';
import type { SystemMetrics } from '../types/metrics';

const API_BASE = '/api';

// API key is read from environment variable (injected at build time)
// For dev, set VITE_API_KEY in .env.local
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

async function fetchMetrics(): Promise<SystemMetrics> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  const response = await fetch(`${API_BASE}/metrics`, { headers });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Unauthorized: Invalid or missing API key.');
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.statusText}`);
  }

  return response.json();
}

export function useSystemMetrics() {
  return useQuery<SystemMetrics, Error>({
    queryKey: ['system-metrics'],
    queryFn: fetchMetrics,
    refetchInterval: 2000,
    staleTime: 1500,
    retry: 2,
    refetchIntervalInBackground: false,
  });
}
