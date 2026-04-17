import React, { useState } from 'react';
import { useAuth, LoginError } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import LegalFooter from './LegalFooter';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [errorKind, setErrorKind] = useState(null);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        setError('');
        setErrorKind(null);
        setLoading(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            if (err instanceof LoginError) {
                setError(err.message);
                setErrorKind(err.kind);
            } else {
                setError('Unerwarteter Fehler');
                setErrorKind('server');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl max-w-sm w-full">
                    <div className="flex justify-center mb-6">
                        <div className="bg-blue-100 dark:bg-blue-900/40 p-4 rounded-full">
                            <Lock size={40} className="text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-gray-100">Anmelden</h1>

                    {error && (
                        <div
                            role="alert"
                            className={`p-3 rounded-xl mb-4 text-center text-sm ${
                                errorKind === 'rate-limit'
                                    ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                                    : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            }`}
                        >
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        <div>
                            <label htmlFor="login-email" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                autoComplete="email"
                                required
                                disabled={loading}
                                className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none disabled:opacity-60"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="login-password" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Passwort</label>
                            <input
                                id="login-password"
                                type="password"
                                autoComplete="current-password"
                                required
                                disabled={loading}
                                className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none disabled:opacity-60"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 dark:bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                        >
                            {loading && <Loader2 size={18} className="animate-spin" />}
                            {loading ? 'Anmeldung läuft…' : 'Einloggen'}
                        </button>
                    </form>

                    <div className="mt-5 flex justify-between text-sm">
                        <Link
                            to="/forgot-password"
                            className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus-visible:underline"
                        >
                            Passwort vergessen?
                        </Link>
                        <Link
                            to="/request-verification"
                            className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus-visible:underline"
                        >
                            E-Mail bestätigen
                        </Link>
                    </div>
                </div>
            </div>
            <LegalFooter />
        </div>
    );
}
