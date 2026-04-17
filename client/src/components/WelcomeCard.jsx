import React, { useState } from 'react';
import { Camera, FileText, QrCode, ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY = 'welcome-card-dismissed';

/**
 * One-time welcome card shown to brand-new users with no properties
 * and no inspection history. Gives them a concrete 4-step path from
 * zero to their first PDF report, so the empty Dashboard doesn't
 * feel like a dead end.
 *
 * Dismissal is persisted in localStorage so it doesn't reappear. If
 * the user clears site data or uses a fresh device, the card reappears
 * — acceptable: the content is general enough to reread.
 */
function readDismissed() {
    try {
        return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
        return true;
    }
}

export default function WelcomeCard({ userName }) {
    const [hidden, setHidden] = useState(() => readDismissed());

    if (hidden) return null;

    const dismiss = () => {
        try {
            localStorage.setItem(STORAGE_KEY, String(Date.now()));
        } catch {
            /* ignore */
        }
        setHidden(true);
    };

    return (
        <section
            aria-labelledby="welcome-heading"
            className="relative bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-5 overflow-hidden"
        >
            <button
                type="button"
                onClick={dismiss}
                aria-label="Willkommensnachricht schließen"
                className="absolute top-2 right-2 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/40 dark:hover:bg-gray-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
                <X size={18} />
            </button>
            <h2 id="welcome-heading" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                {userName ? `Willkommen, ${userName}!` : 'Willkommen!'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                So führen Sie Ihre erste Prüfung nach ÖNORM B 1300 durch:
            </p>
            <ol className="space-y-3 text-sm">
                <Step index={1} Icon={ShieldCheck} title="Objekt anlegen">
                    Adresse, Eigentümer und Anzahl Einheiten — rechts unten auf „+“.
                </Step>
                <Step index={2} Icon={QrCode} title="Prüfung starten">
                    Über die Objektkarte oder den QR-Code vor Ort.
                </Step>
                <Step index={3} Icon={Camera} title="Mängel dokumentieren">
                    Foto direkt aus der Kamera, optional mit Beschreibung.
                </Step>
                <Step index={4} Icon={FileText} title="PDF-Bericht generieren">
                    Nach Abschluss automatisch mit Stempel und Unterschriftsfeldern.
                </Step>
            </ol>
        </section>
    );
}

// eslint-disable-next-line no-unused-vars
function Step({ index, Icon, title, children }) {
    return (
        <li className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                <Icon size={16} />
            </div>
            <div>
                <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Schritt {index}</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{title}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">{children}</p>
            </div>
        </li>
    );
}
