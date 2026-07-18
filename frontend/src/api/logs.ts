import { useQuery, keepPreviousData } from '@tanstack/react-query';

const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

const authHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
};

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders });
  if (!res.ok) {
    const detail = await res.json().then((d) => d.detail).catch(() => res.statusText);
    throw new Error(detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export interface LogEntry {
  timestamp: string;
  unit: string | null;
  message: string;
  priority: number;
  hostname: string | null;
  pid: number | null;
}

export interface LogFilters {
  unit: string;
  lines: 50 | 100 | 200 | 500;
  priority?: number;
}

// Fetches service list. enabled:true so it runs on mount and when source changes
// (source is part of the query key, so switching triggers a new fetch automatically).
// staleTime:Infinity prevents background refetches — user controls freshness via refetch().
export function useLogServices(source: 'running' | 'all') {
  return useQuery<string[], Error>({
    queryKey: ['log-services', source],
    queryFn: async () => {
      if (source === 'running') {
        const data = await apiFetch<{ services: string[] }>('/api/services');
        return data.services ?? [];
      }
      const data = await apiFetch<{ units: string[] }>('/api/logs/units');
      return data.units ?? [];
    },
    staleTime: Infinity,
    retry: false,
  });
}

// Auto-fetches when a unit is selected (enabled: !!filters.unit).
// Any filter change (unit, lines, priority) updates the queryKey and triggers a new fetch.
// staleTime:Infinity means no background refetches — only queryKey changes or manual refetch().
export function useLogEntries(filters: LogFilters) {
  return useQuery<LogEntry[], Error>({
    queryKey: ['log-entries', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.unit) params.set('unit', filters.unit);
      params.set('lines', String(filters.lines));
      if (filters.priority !== undefined) params.set('priority', String(filters.priority));
      const data = await apiFetch<{ entries: LogEntry[] }>(`/api/logs?${params}`);
      return data.entries ?? [];
    },
    enabled: !!filters.unit,
    staleTime: Infinity,
    retry: false,
    placeholderData: keepPreviousData,
  });
}
