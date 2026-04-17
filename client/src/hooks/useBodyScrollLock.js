import { useEffect } from 'react';

/**
 * Lock body scroll while `active` is true.
 * Prevents background scrolling when a modal or drawer is open.
 *
 * Preserves the caller's scroll position by freezing body position,
 * which also avoids the iOS-safari "rubber band" that leaks through
 * overflow:hidden.
 */
export function useBodyScrollLock(active) {
    useEffect(() => {
        if (!active) return undefined;
        const originalOverflow = document.body.style.overflow;
        const originalPaddingRight = document.body.style.paddingRight;
        // compensate for scrollbar disappearance so layout doesn't shift
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.paddingRight = originalPaddingRight;
        };
    }, [active]);
}
