import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

/**
 * Full-screen photo preview.
 *
 * A thumbnail on a phone is too small to inspect a defect photo
 * properly — this lightbox lets the user tap to see the full image
 * on their whole screen, with a close button in the top corner.
 *
 * Closes on ESC, backdrop click, or the X button. Body scroll is
 * locked while open.
 */
export default function PhotoLightbox({ src, alt, open, onClose }) {
    useEscapeKey(onClose, open);
    useBodyScrollLock(open);

    if (!open || typeof document === 'undefined' || !src) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-in fade-in duration-150"
            style={{
                paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
                paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            }}
        >
            <button
                type="button"
                aria-label="Bildansicht schließen"
                onClick={onClose}
                tabIndex={-1}
                className="absolute inset-0 bg-black/90 cursor-default focus:outline-none"
            />
            <img
                src={src}
                alt={alt ?? ''}
                className="relative max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            <button
                type="button"
                aria-label="Schließen"
                onClick={onClose}
                className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
            >
                <X size={22} />
            </button>
        </div>,
        document.body,
    );
}
