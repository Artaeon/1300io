import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

/**
 * Accessible modal dialog.
 *
 * Handles: focus trap, ESC to close, body-scroll lock, backdrop click to
 * close, proper ARIA roles, and safe-area-aware padding for iOS.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   title: string (required — used as aria-label)
 *   children: modal body
 *   size: 'sm' | 'md' | 'lg'
 *   initialFocusRef?: ref to element that should receive focus on open
 */
const SIZES = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
};

export default function Modal({
    open,
    onClose,
    title,
    children,
    size = 'md',
    hideCloseButton = false,
}) {
    const trapRef = useFocusTrap(open);
    useEscapeKey(onClose, open);
    useBodyScrollLock(open);

    if (!open || typeof document === 'undefined') return null;

    const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
            {/* Backdrop as a real button — click-outside-to-close is a real
                affordance that screen-reader and keyboard users deserve too. */}
            <button
                type="button"
                aria-label="Dialog schließen"
                onClick={onClose}
                tabIndex={-1}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default focus:outline-none"
            />
            <div
                ref={trapRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`relative w-full ${SIZES[size]} bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col`}
                style={{
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
            >
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {title}
                    </h2>
                    {!hideCloseButton && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Schließen"
                            className="shrink-0 -mr-1 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
                <div className="px-5 pb-5 overflow-y-auto">{children}</div>
            </div>
        </div>,
        document.body,
    );
}
