import { useState, useEffect, useRef } from 'react';
import type { SystemMetrics } from '../types/metrics';

const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

export function useSystemSocket() {
  const [data, setData] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let isSubscribed = true;

    function connect() {
      if (!isSubscribed) return;
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const isDev = window.location.port === '5173';
      const proxyUrl = isDev 
        ? `ws://${window.location.hostname}:8000/ws/metrics` 
        : `${protocol}//${window.location.host}/ws/metrics`;

      const finalUrl = `${proxyUrl}?token=${API_KEY || ''}`;

      const ws = new WebSocket(finalUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isSubscribed) {
          ws.close();
          return;
        }
        setIsError(false);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const metrics: SystemMetrics = JSON.parse(event.data);
          setData(metrics);
          setIsLoading(false);
        } catch (err) {
          console.error('Failed to parse WebSocket message', err);
        }
      };

      ws.onerror = (_event) => {
        if (!isSubscribed) return;
        setIsError(true);
      };

      ws.onclose = () => {
        if (!isSubscribed) return;
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    }

    // Delay the connection by 50ms to bypass React 18 Strict Mode double-invocation
    // This prevents the "WebSocket is closed before the connection is established" error
    const initTimeout = setTimeout(connect, 50);

    return () => {
      isSubscribed = false;
      clearTimeout(initTimeout);
      clearTimeout(reconnectTimeoutRef.current);
      
      if (wsRef.current) {
        // Strip event listeners to prevent memory leaks and false reconnects
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        
        // Only close if it's actually open or connecting
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      }
    };
  }, []);

  return { data, isLoading, isError, error, isRefetching: false };
}
