import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { ToastContext } from './toast-core.js';

/**
 * Global toast system.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Gespeichert');
 *   toast.error('Verbindungsfehler', { action: { label: 'Erneut', onClick: retry } });
 *
 * Design choices:
 *   - Queued (multiple visible at once, stacked)
 *   - Auto-dismiss 5s (errors 8s — users need more time to read the action)
 *   - Optional action button inside the toast
 *   - Portal to document.body so layout never clips
 *   - aria-live=polite: screen readers announce without interrupting
 */

let nextId = 1;

const STYLES = {
    success: {
        bg: 'bg-green-600 dark:bg-green-500 text-white',
        Icon: Check,
    },
    error: {
        bg: 'bg-red-600 dark:bg-red-500 text-white',
        Icon: AlertTriangle,
    },
    info: {
        bg: 'bg-gray-900 dark:bg-gray-800 text-white',
        Icon: Info,
    },
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef(new Map());

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
    }, []);

    const push = useCallback(
        (type, message, opts = {}) => {
            const id = nextId++;
            const duration = opts.duration ?? (type === 'error' ? 8000 : 5000);
            setToasts((prev) => [...prev, { id, type, message, action: opts.action ?? null }]);
            if (duration > 0) {
                const timer = setTimeout(() => dismiss(id), duration);
                timersRef.current.set(id, timer);
            }
            return id;
        },
        [dismiss],
    );

    const toast = useMemo(
        () => ({
            success: (msg, opts) => push('success', msg, opts),
            error: (msg, opts) => push('error', msg, opts),
            info: (msg, opts) => push('info', msg, opts),
            dismiss,
        }),
        [push, dismiss],
    );

    const value = useMemo(() => ({ toast }), [toast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {typeof document !== 'undefined' &&
                createPortal(
                    <div
                        aria-live="polite"
                        aria-atomic="false"
                        className="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4"
                        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
                    >
                        {toasts.map((t) => {
                            const { bg, Icon } = STYLES[t.type] ?? STYLES.info;
                            return (
                                <div
                                    key={t.id}
                                    role={t.type === 'error' ? 'alert' : 'status'}
                                    className={`pointer-events-auto max-w-md w-full flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg ${bg} animate-in slide-in-from-top-2 fade-in duration-200`}
                                >
                                    <Icon size={20} className="shrink-0 mt-0.5" />
                                    <span className="font-medium text-sm flex-1 leading-snug break-words">
                                        {t.message}
                                    </span>
                                    {t.action && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                t.action.onClick();
                                                dismiss(t.id);
                                            }}
                                            className="shrink-0 text-sm font-semibold underline underline-offset-2 hover:opacity-80"
                                        >
                                            {t.action.label}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => dismiss(t.id)}
                                        aria-label="Schließen"
                                        className="shrink-0 opacity-80 hover:opacity-100 -mr-1 -mt-1 p-1"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>,
                    document.body,
                )}
        </ToastContext.Provider>
    );
}
