import { useEffect, useRef } from 'react';

const FOCUSABLE =
    'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab focus inside `ref.current` while `active` is true.
 *
 * On activate:
 *   - remembers the element that had focus so we can restore it
 *   - focuses the first focusable element inside the trap (unless
 *     the trap already contains the active element)
 *
 * On deactivate:
 *   - restores focus to the remembered element (if still connected)
 *
 * Uses a capturing keydown listener so nested components can't
 * accidentally swallow Tab.
 */
export function useFocusTrap(active) {
    const ref = useRef(null);

    useEffect(() => {
        if (!active || !ref.current) return undefined;
        const root = ref.current;
        const previouslyFocused = document.activeElement;

        const firstFocusable = root.querySelector(FOCUSABLE);
        if (firstFocusable && !root.contains(document.activeElement)) {
            firstFocusable.focus();
        }

        function handleKey(e) {
            if (e.key !== 'Tab') return;
            const focusables = Array.from(root.querySelectorAll(FOCUSABLE)).filter(
                (el) => !el.hasAttribute('aria-hidden'),
            );
            if (focusables.length === 0) {
                e.preventDefault();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', handleKey, true);
        return () => {
            document.removeEventListener('keydown', handleKey, true);
            if (previouslyFocused && previouslyFocused.isConnected && typeof previouslyFocused.focus === 'function') {
                previouslyFocused.focus();
            }
        };
    }, [active]);

    return ref;
}
