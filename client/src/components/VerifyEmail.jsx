import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Loader2, Mail } from 'lucide-react';
import LegalFooter from './LegalFooter';

/**
 * Lands the user when they click the verification link in their email.
 * Reads ?token= and POSTs to /api/auth/verify-email.
 *
 * Three states: pending, success, failure. Layout mirrors InspectionFinish
 * for visual consistency.
 */
export default function VerifyEmail() {
    const [params] = useSearchParams();
    const token = params.get('token');
    // Initial state derived from the URL so we don't need an effect
    // to set it — avoids the react-hooks/set-state-in-effect warning.
    const [state, setState] = useState(() => (token ? 'pending' : 'failure'));
    const [email, setEmail] = useState(null);
    const [error, setError] = useState(() =>
        token ? '' : 'Kein Bestätigungs-Code in der URL.',
    );
    // React dev mode double-invokes effects; guard so we don't consume
    // the single-use token twice on mount.
    const fired = useRef(false);

    useEffect(() => {
        if (!token) return;
        if (fired.current) return;
        fired.current = true;

        fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        })
            .then(async (res) => {
                if (res.ok) {
                    const body = await res.json();
                    setEmail(body.email ?? null);
                    setState('success');
                } else {
                    const body = await res.json().catch(() => ({}));
                    setError(body.error ?? 'Bestätigung fehlgeschlagen.');
                    setState('failure');
                }
            })
            .catch(() => {
                setError('Verbindungsfehler. Bitte erneut versuchen.');
                setState('failure');
            });
    }, [token]);

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
                    {state === 'pending' && (
                        <>
                            <div className="flex justify-center mb-6">
                                <div className="bg-blue-100 dark:bg-blue-900/40 p-4 rounded-full">
                                    <Loader2 size={40} className="text-blue-600 dark:text-blue-400 animate-spin" />
                                </div>
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                E-Mail wird bestätigt…
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                Bitte einen Moment Geduld.
                            </p>
                        </>
                    )}

                    {state === 'success' && (
                        <>
                            <div className="flex justify-center mb-6">
                                <div className="bg-green-100 dark:bg-green-900/40 p-4 rounded-full">
                                    <CheckCircle size={48} className="text-green-500 dark:text-green-400" />
                                </div>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                E-Mail bestätigt
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                {email
                                    ? `Die Adresse ${email} wurde bestätigt.`
                                    : 'Ihr Konto ist jetzt aktiviert.'}
                            </p>
                            <Link
                                to="/login"
                                className="block w-full bg-blue-600 dark:bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                            >
                                Zur Anmeldung
                            </Link>
                        </>
                    )}

                    {state === 'failure' && (
                        <>
                            <div className="flex justify-center mb-6">
                                <div className="bg-red-100 dark:bg-red-900/40 p-4 rounded-full">
                                    <AlertTriangle size={48} className="text-red-500 dark:text-red-400" />
                                </div>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                Bestätigung fehlgeschlagen
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                                {error}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4 flex items-center justify-center gap-1">
                                <Mail size={14} />
                                Link abgelaufen? Fordern Sie einen neuen an.
                            </p>
                            <Link
                                to="/request-verification"
                                className="block w-full bg-blue-600 dark:bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                Neuen Link anfordern
                            </Link>
                            <Link
                                to="/login"
                                className="block mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                                Zurück zur Anmeldung
                            </Link>
                        </>
                    )}
                </div>
            </div>
            <LegalFooter />
        </div>
    );
}
