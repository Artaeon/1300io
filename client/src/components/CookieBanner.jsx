import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'cookie-notice-ack';

function readAck() {
    try {
        return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
        return true; // localStorage blocked → treat as dismissed
    }
}

export default function CookieBanner() {
    const [visible, setVisible] = useState(() => !readAck());

    const dismiss = () => {
        try {
            localStorage.setItem(STORAGE_KEY, String(Date.now()));
        } catch {
            /* ignore */
        }
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4 pointer-events-none">
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-lg p-4 pointer-events-auto">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        Diese Anwendung verwendet lokalen Browser-Speicher für die
                        Anmeldung und Design-Einstellungen. Es werden keine
                        Tracking- oder Marketing-Cookies gesetzt.{' '}
                        <Link
                            to="/datenschutz"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Datenschutzerklärung
                        </Link>
                    </p>
                    <button
                        type="button"
                        onClick={dismiss}
                        className="shrink-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                    >
                        Verstanden
                    </button>
                </div>
            </div>
        </div>
    );
}
