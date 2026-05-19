import { useState, useEffect, useCallback } from 'react';

interface SystemMetric {
  type: 'render' | 'fetch' | 'error';
  name: string;
  duration?: number;
  message?: string;
  timestamp: number;
}

export function useSystemMonitor() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);

  // Capture console errors
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
      setMetrics(prev => [...prev, {
        type: 'error' as const,
        name: 'Console Error',
        message,
        timestamp: Date.now()
      } as SystemMetric].slice(-50)); // Keep last 50
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  const trackPerformance = useCallback((name: string, duration: number) => {
    setMetrics(prev => [...prev, {
      type: 'render' as const,
      name,
      duration,
      timestamp: Date.now()
    } as SystemMetric].slice(-50));
  }, []);

  const getDiagnostics = useCallback(() => {
    return {
      metrics,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
  }, [metrics]);

  return { trackPerformance, getDiagnostics };
}
