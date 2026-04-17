import { useEffect, useState } from 'react';

/**
 * Track navigator.onLine with online/offline event listeners.
 *
 * Note: navigator.onLine is conservative — it reports online whenever
 * any network interface is up, not whether the internet is reachable.
 * We treat "online" as "probably online"; actual fetch failures still
 * bubble up as caller-level toasts.
 */
export function useOnlineStatus() {
    const [online, setOnline] = useState(() =>
        typeof navigator !== 'undefined' ? navigator.onLine : true,
    );

    useEffect(() => {
        const goOnline = () => setOnline(true);
        const goOffline = () => setOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return online;
}
