/**
 * Tunnel subscription hook — lives in its own component to avoid
 * StrictMode double-invocation issues in the parent page.
 */
import { useEffect } from 'react';
import { useGateway } from './useWebSocket';

export function useTunnelSubscription(
  onStatus: (data: {
    status: string;
    url?: string | null;
    error?: string | null;
    startedAt?: string | null;
  }) => void,
  onUrl: (url: string) => void
) {
  const { subscribe } = useGateway();

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      subscribe('tunnel:status', (data) => {
        onStatus(
          data as {
            status: string;
            url?: string | null;
            error?: string | null;
            startedAt?: string | null;
          }
        );
      })
    );

    unsubs.push(
      subscribe<{ url: string }>('tunnel:url', (data) => {
        onUrl((data as { url: string }).url);
      })
    );

    return () => {
      for (const u of unsubs) u();
    };
  }, [subscribe, onStatus, onUrl]);
}
