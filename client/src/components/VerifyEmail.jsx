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
                <div className="hover-lift bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl hover:shadow-2xl max-w-sm w-full text-center animate-fade-in-up ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                    {state === 'pending' && (
                        <>
                            <div className="flex justify-center mb-6">
                                <div className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 p-3 rounded-2xl animate-breathe">
                                    <Loader2 size={32} className="text-blue-600 dark:text-blue-400 animate-spin" />
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
                        <div className="animate-pop-in">
                            <div className="flex justify-center mb-6">
                                <div className="bg-gradient-to-br from-green-400 to-emerald-600 p-4 rounded-2xl shadow-lg animate-breathe">
                                    <CheckCircle size={40} className="text-white" />
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
                                className="btn-apple block w-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-semibold py-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                            >
                                Zur Anmeldung
                            </Link>
                        </div>
                    )}

                    {state === 'failure' && (
                        <div className="animate-fade-in-up">
                            <div className="flex justify-center mb-6">
                                <div className="bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40 p-3 rounded-2xl animate-breathe">
                                    <AlertTriangle size={32} className="text-red-500 dark:text-red-400" />
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
                                className="btn-apple block w-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-semibold py-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                Neuen Link anfordern
                            </Link>
                            <Link
                                to="/login"
                                className="link-underline block mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                                Zurück zur Anmeldung
                            </Link>
                        </div>
                    )}
                </div>
            </div>
            <LegalFooter />
        </div>
    );
}
