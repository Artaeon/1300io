import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Sticky top banner shown when navigator reports offline.
 *
 * Critical for on-site inspectors who lose connection inside stairwells
 * or basements — without it, save failures look like app bugs.
 * Positioned at top so it's visible even with modals/drawers open.
 *
 * Not shown during SSR or before hydration (useOnlineStatus defaults
 * online=true there).
 */
export default function OfflineBanner() {
    const online = useOnlineStatus();
    if (online) return null;
    return (
        <div
            role="status"
            aria-live="polite"
            className="sticky top-0 z-40 bg-orange-600 dark:bg-orange-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow"
            style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
        >
            <WifiOff size={16} />
            <span>Offline — Änderungen werden gespeichert, sobald die Verbindung wiederhergestellt ist.</span>
        </div>
    );
}
