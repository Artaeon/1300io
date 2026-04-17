import { useEffect } from 'react';

/**
 * Show the native "Leave site?" dialog when `enabled` is true and
 * the user attempts to close the tab / navigate away via the browser
 * (reload, close, back button to another origin).
 *
 * Note: React Router's programmatic navigate() is NOT blocked by this.
 * Use useBlocker() from react-router-dom v6.4+ for in-app navigation
 * guards. We cover both in the InspectionWizard.
 */
export function useBeforeUnload(enabled) {
    useEffect(() => {
        if (!enabled) return undefined;

        function handler(e) {
            // Modern browsers only show a generic localized message;
            // returnValue must be set for legacy support.
            e.preventDefault();
            e.returnValue = '';
            return '';
        }

        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [enabled]);
}
