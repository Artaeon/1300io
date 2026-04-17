import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2 } from 'lucide-react';
import LegalFooter from './LegalFooter';

/**
 * Page where an unverified user can request a fresh verification email.
 * Responds with a generic success message regardless of whether the
 * email actually exists — the backend never leaks that either.
 */
export default function RequestVerification() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        try {
            await fetch('/api/auth/request-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
        } catch {
            // swallow — we still show the generic success screen
        }
        setSubmitted(true);
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="hover-lift bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl hover:shadow-2xl max-w-sm w-full animate-fade-in-up ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                    <div className="flex justify-center mb-6">
                        <div className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 p-3 rounded-2xl animate-breathe">
                            <Mail size={32} className="text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>

                    {submitted ? (
                        <>
                            <h1 className="text-xl font-bold text-center mb-2 text-gray-900 dark:text-gray-100">
                                Überprüfen Sie Ihr Postfach
                            </h1>
                            <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-6">
                                Falls ein Konto mit dieser Adresse existiert und
                                noch nicht bestätigt ist, haben wir einen neuen
                                Bestätigungs-Link versendet. Prüfen Sie auch
                                den Spam-Ordner.
                            </p>
                            <Link
                                to="/login"
                                className="btn-apple block w-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white text-center font-semibold py-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                Zur Anmeldung
                            </Link>
                        </>
                    ) : (
                        <>
                            <h1 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-gray-100">
                                Bestätigungs-Link senden
                            </h1>
                            <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
                                Geben Sie Ihre E-Mail-Adresse ein.
                            </p>
                            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                                <div>
                                    <label htmlFor="request-verif-email" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                                    <input
                                        id="request-verif-email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        disabled={loading}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="input-apple w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 disabled:opacity-60"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-apple w-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-semibold py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                    {loading && <Loader2 size={18} className="animate-spin" />}
                                    {loading ? 'Wird gesendet…' : 'Link senden'}
                                </button>
                                <Link
                                    to="/login"
                                    className="link-underline block text-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                >
                                    Zurück zur Anmeldung
                                </Link>
                            </form>
                        </>
                    )}
                </div>
            </div>
            <LegalFooter />
        </div>
    );
}
