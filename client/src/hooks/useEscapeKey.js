import { useEffect } from 'react';

/**
 * Call `onEscape` when the Escape key is pressed, while `active` is true.
 * Useful for dismissing modals, dropdowns, and drawers.
 */
export function useEscapeKey(onEscape, active = true) {
    useEffect(() => {
        if (!active) return undefined;
        function handle(e) {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onEscape();
            }
        }
        document.addEventListener('keydown', handle);
        return () => document.removeEventListener('keydown', handle);
    }, [onEscape, active]);
}
