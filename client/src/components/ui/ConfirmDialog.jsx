import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/**
 * Promise-friendly confirmation dialog.
 *
 * Props:
 *   open, onClose: modal control
 *   title: headline
 *   message: body text (string or ReactNode). Use this for the "what
 *     will be deleted" detail so the user sees the blast radius
 *   confirmLabel: button text (default "Bestätigen")
 *   cancelLabel: button text (default "Abbrechen")
 *   destructive: boolean — if true, confirm button is red
 *   onConfirm: async () => void. Button shows a spinner while the
 *     promise is pending and the dialog stays open until it resolves
 *     (so errors can be handled and the user isn't surprised by an
 *     immediate close on a failed request)
 */
export default function ConfirmDialog({
    open,
    onClose,
    title,
    message,
    confirmLabel = 'Bestätigen',
    cancelLabel = 'Abbrechen',
    destructive = false,
    onConfirm,
}) {
    const [loading, setLoading] = useState(false);
    const confirmBtnRef = useRef(null);

    // Move focus to the confirm button on open. We avoid autoFocus so
    // screen-reader users get a stable, predictable initial focus at
    // the dialog title when they reopen. Programmatic focus after
    // mount works fine with the focus trap.
    useEffect(() => {
        if (open && confirmBtnRef.current) {
            confirmBtnRef.current.focus();
        }
    }, [open]);

    const handleConfirm = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await onConfirm();
            onClose();
        } catch {
            // caller should have surfaced its own toast; keep dialog open
        } finally {
            setLoading(false);
        }
    };

    const confirmColor = destructive
        ? 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
        : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600';

    return (
        <Modal open={open} onClose={loading ? () => {} : onClose} title={title} size="sm" hideCloseButton>
            <div className="space-y-5">
                {destructive && (
                    <div className="flex justify-center">
                        <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/40">
                            <AlertTriangle size={28} className="text-red-600 dark:text-red-400" />
                        </div>
                    </div>
                )}
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{message}</div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmBtnRef}
                        type="button"
                        onClick={handleConfirm}
                        disabled={loading}
                        className={`flex-1 py-2.5 rounded-xl text-white font-medium active:scale-[0.98] transition-all disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2 ${confirmColor}`}
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
