import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import LegalFooter from './LegalFooter';

/**
 * Reset-password form. Reads ?token= from the URL and POSTs with a new
 * password. On success, the server invalidates ALL refresh tokens for
 * this user, so the user must log in again with the new credentials.
 */
export default function ResetPassword() {
    const [params] = useSearchParams();
    const token = params.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [fieldError, setFieldError] = useState('');
    const [serverError, setServerError] = useState('');
    const [success, setSuccess] = useState(false);

    if (!token) {
        return (
            <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="hover-lift bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl hover:shadow-2xl max-w-sm w-full text-center animate-fade-in-up ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                        <div className="flex justify-center mb-6">
                            <div className="bg-red-100 dark:bg-red-900/40 p-4 rounded-full">
                                <AlertTriangle size={40} className="text-red-500 dark:text-red-400" />
                            </div>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            Ungültiger Link
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            Dieser Link enthält keinen Bestätigungs-Code.
                        </p>
                        <Link
                            to="/forgot-password"
                            className="btn-apple block w-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-semibold py-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            Neuen Link anfordern
                        </Link>
                    </div>
                </div>
                <LegalFooter />
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        setFieldError('');
        setServerError('');

        if (password.length < 12) {
            setFieldError('Passwort muss mindestens 12 Zeichen lang sein.');
            return;
        }
        if (password !== confirm) {
            setFieldError('Passwörter stimmen nicht überein.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            if (res.ok) {
                setSuccess(true);
                // Give the user a beat to read the confirmation, then route them.
                setTimeout(() => navigate('/login'), 1800);
            } else {
                const body = await res.json().catch(() => ({}));
                setServerError(body.error ?? 'Zurücksetzen fehlgeschlagen.');
            }
        } catch {
            setServerError('Verbindungsfehler. Bitte erneut versuchen.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="hover-lift bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl hover:shadow-2xl max-w-sm w-full animate-fade-in-up ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                    {success ? (
                        <div className="text-center animate-pop-in">
                            <div className="flex justify-center mb-6">
                                <div className="bg-gradient-to-br from-green-400 to-emerald-600 p-4 rounded-2xl shadow-lg animate-breathe">
                                    <CheckCircle size={40} className="text-white" />
                                </div>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                Passwort aktualisiert
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                                Sie werden gleich zur Anmeldung weitergeleitet.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-center mb-6">
                                <div className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 p-3 rounded-2xl animate-breathe">
                                    <KeyRound size={32} className="text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                            <h1 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-gray-100">
                                Neues Passwort
                            </h1>
                            <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
                                Mindestens 12 Zeichen, Groß- und Kleinbuchstaben sowie eine Ziffer.
                            </p>

                            {serverError && (
                                <div role="alert" className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm text-center">
                                    {serverError}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                                <div>
                                    <label htmlFor="reset-password" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Neues Passwort
                                    </label>
                                    <input
                                        id="reset-password"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        minLength={12}
                                        disabled={loading}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="input-apple w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 disabled:opacity-60"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="reset-confirm" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Wiederholen
                                    </label>
                                    <input
                                        id="reset-confirm"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        disabled={loading}
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        className="input-apple w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 disabled:opacity-60"
                                    />
                                    {fieldError && (
                                        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
                                            {fieldError}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-apple w-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-semibold py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                    {loading && <Loader2 size={18} className="animate-spin" />}
                                    {loading ? 'Wird gespeichert…' : 'Passwort setzen'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
            <LegalFooter />
        </div>
    );
}
