import { useEffect } from 'react';
import * as Network from 'expo-network';
import { useAppStore } from '@/store';

/**
 * Monitors network connectivity and updates Zustand store.
 * Per 09_CUSTOMER_APP_SPEC.md: offline state must be handled on every screen.
 * Mount once in root _layout.tsx.
 */
export function useNetworkStatus() {
  const setOffline = useAppStore((s) => s.setOffline);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const state = await Network.getNetworkStateAsync();
      if (!cancelled) setOffline(!state.isInternetReachable);
    };

    check();
    const interval = setInterval(check, 10_000); // check every 10s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setOffline]);
}
