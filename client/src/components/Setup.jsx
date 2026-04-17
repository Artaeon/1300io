import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, UserPlus, Loader2, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft, ShieldCheck, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';
import LegalFooter from './LegalFooter';

/**
 * First-run setup wizard. Shown exactly once per instance — on the very
 * first visit, before any ADMIN user exists. Collects:
 *   1) Welcome / consent
 *   2) Admin account (name, email, password)
 *   3) Organization (name)
 * and POSTs to /api/setup/initialize. The server returns tokens so the
 * user lands on the Dashboard already logged in.
 *
 * Routing gate in App.jsx ensures this page is only reachable when
 * status.initialized is false; once the server flips to initialized=true,
 * the gate redirects /setup → /login.
 */

const TOTAL_STEPS = 3;

export default function Setup({ onInitialized }) {
    const navigate = useNavigate();
    const { bootstrapSession } = useAuth();
    const { dark, toggleTheme } = useTheme();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState('');

    // Admin fields
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [adminConfirm, setAdminConfirm] = useState('');
    const [adminError, setAdminError] = useState('');

    // Organization fields
    const [orgName, setOrgName] = useState('');
    const [orgError, setOrgError] = useState('');

    const validateAdmin = () => {
        if (!adminName.trim()) return 'Bitte geben Sie Ihren Namen an.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
        if (adminPassword.length < 12) return 'Passwort muss mindestens 12 Zeichen lang sein.';
        if (adminPassword !== adminConfirm) return 'Passwörter stimmen nicht überein.';
        return '';
    };

    const validateOrg = () => {
        if (!orgName.trim()) return 'Bitte einen Namen für Ihre Organisation angeben.';
        return '';
    };

    const next = () => {
        setServerError('');
        if (step === 2) {
            const err = validateAdmin();
            if (err) { setAdminError(err); return; }
            setAdminError('');
        }
        setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    };

    const back = () => {
        setServerError('');
        setStep((s) => Math.max(s - 1, 1));
    };

    const submit = async () => {
        const orgErr = validateOrg();
        if (orgErr) { setOrgError(orgErr); return; }
        setOrgError('');

        setLoading(true);
        setServerError('');
        try {
            const res = await fetch('/api/setup/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admin: { name: adminName, email: adminEmail, password: adminPassword },
                    organization: { name: orgName },
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 409) {
                    // Someone else initialized in the meantime — bounce to login.
                    setServerError('Einrichtung wurde bereits abgeschlossen. Sie werden zur Anmeldung weitergeleitet.');
                    setTimeout(() => {
                        if (onInitialized) onInitialized();
                        navigate('/login', { replace: true });
                    }, 1500);
                    return;
                }
                if (Array.isArray(data.details) && data.details.length > 0) {
                    setServerError(data.details.join(' '));
                } else {
                    setServerError(data.error ?? 'Einrichtung fehlgeschlagen. Bitte erneut versuchen.');
                }
                return;
            }
            // Success: seed the auth context so we're logged in immediately.
            bootstrapSession({
                token: data.token,
                refreshToken: data.refreshToken,
                user: data.user,
            });
            if (onInitialized) onInitialized();
            navigate('/', { replace: true });
        } catch {
            setServerError('Verbindungsfehler. Bitte erneut versuchen.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex flex-col bg-gradient-to-b from-blue-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
            <button
                type="button"
                onClick={toggleTheme}
                aria-label={dark ? 'Hellmodus aktivieren' : 'Dunkelmodus aktivieren'}
                title={dark ? 'Hellmodus' : 'Dunkelmodus'}
                className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-md text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 shadow-sm transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="flex items-center gap-3 mb-6 animate-fade-in-up text-gray-900 dark:text-gray-100">
                    <Logo size={44} />
                </div>
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl max-w-md w-full animate-fade-in-up ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                    <StepIndicator step={step} total={TOTAL_STEPS} />

                    {serverError && (
                        <div role="alert" className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm text-center flex items-start gap-2">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <span>{serverError}</span>
                        </div>
                    )}

                    {/* keyed wrapper forces a remount + animation on every
                        step change, so forward + backward navigation both
                        get a crisp fade-slide transition. */}
                    <div key={step} className="animate-fade-in-right">
                        {step === 1 && <WelcomeStep />}
                        {step === 2 && (
                            <AdminStep
                                name={adminName} setName={setAdminName}
                                email={adminEmail} setEmail={setAdminEmail}
                                password={adminPassword} setPassword={setAdminPassword}
                                confirm={adminConfirm} setConfirm={setAdminConfirm}
                                error={adminError}
                                disabled={loading}
                            />
                        )}
                        {step === 3 && (
                            <OrgStep
                                name={orgName} setName={setOrgName}
                                error={orgError}
                                disabled={loading}
                            />
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-6">
                        {step > 1 ? (
                            <button
                                type="button"
                                onClick={back}
                                disabled={loading}
                                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-2 py-1"
                            >
                                <ArrowLeft size={16} />
                                Zurück
                            </button>
                        ) : <span />}

                        {step < TOTAL_STEPS ? (
                            <button
                                type="button"
                                onClick={next}
                                className="flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white font-bold py-3 px-5 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                Weiter
                                <ArrowRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={submit}
                                disabled={loading}
                                className="flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white font-bold py-3 px-5 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                {loading ? 'Einrichten…' : 'Einrichtung abschließen'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <LegalFooter />
        </div>
    );
}

function StepIndicator({ step, total }) {
    return (
        <div className="flex items-center justify-center gap-2 mb-6" aria-label={`Schritt ${step} von ${total}`}>
            {Array.from({ length: total }).map((_, i) => {
                const n = i + 1;
                const active = n === step;
                const done = n < step;
                return (
                    <div key={n} className="flex items-center gap-2">
                        <div
                            className={[
                                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                                done ? 'bg-green-500 text-white' :
                                active ? 'bg-blue-600 dark:bg-blue-500 text-white' :
                                'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                            ].join(' ')}
                        >
                            {done ? <CheckCircle size={14} /> : n}
                        </div>
                        {n < total && (
                            <div className={`h-px w-6 ${done ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-800'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function WelcomeStep() {
    return (
        <div className="text-center">
            <div className="flex justify-center mb-5">
                <div className="bg-blue-100 dark:bg-blue-900/40 p-4 rounded-full">
                    <ShieldCheck size={40} className="text-blue-600 dark:text-blue-400" />
                </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Willkommen bei 1300.io
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Sie richten gerade Ihre Instanz ein. In drei kurzen Schritten legen wir Ihr Admin-Konto und Ihre Organisation an.
            </p>
            <ul className="text-sm text-left text-gray-600 dark:text-gray-400 space-y-2 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4">
                <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">1.</span>
                    <span>Admin-Konto — Ihre Zugangsdaten</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">2.</span>
                    <span>Organisation — Name Ihrer Hausverwaltung</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">3.</span>
                    <span>Fertig — direkt einsatzbereit</span>
                </li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                Diese Seite erscheint nur bei der ersten Inbetriebnahme.
            </p>
        </div>
    );
}

function AdminStep({ name, setName, email, setEmail, password, setPassword, confirm, setConfirm, error, disabled }) {
    return (
        <div>
            <div className="flex justify-center mb-4">
                <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-full">
                    <UserPlus size={32} className="text-blue-600 dark:text-blue-400" />
                </div>
            </div>
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-gray-100 mb-1">
                Admin-Konto anlegen
            </h2>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-5">
                Dieses Konto erhält volle Administrations­rechte.
            </p>

            <div className="space-y-4">
                <Field id="setup-admin-name" label="Name" value={name} onChange={setName}
                    autoComplete="name" disabled={disabled} />
                <Field id="setup-admin-email" label="E-Mail" type="email" value={email} onChange={setEmail}
                    autoComplete="email" disabled={disabled} />
                <Field id="setup-admin-password" label="Passwort (min. 12 Zeichen)" type="password" value={password}
                    onChange={setPassword} autoComplete="new-password" disabled={disabled} />
                <Field id="setup-admin-confirm" label="Passwort wiederholen" type="password" value={confirm}
                    onChange={setConfirm} autoComplete="new-password" disabled={disabled} />

                {error && (
                    <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
                )}
            </div>
        </div>
    );
}

function OrgStep({ name, setName, error, disabled }) {
    return (
        <div>
            <div className="flex justify-center mb-4">
                <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-full">
                    <Building2 size={32} className="text-blue-600 dark:text-blue-400" />
                </div>
            </div>
            <h2 className="text-xl font-bold text-center text-gray-900 dark:text-gray-100 mb-1">
                Ihre Organisation
            </h2>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-5">
                Der Name erscheint auf Berichten und in der Admin-Oberfläche. Später änderbar.
            </p>

            <Field id="setup-org-name" label="Name der Hausverwaltung" value={name} onChange={setName}
                autoComplete="organization" disabled={disabled} />

            {error && (
                <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
        </div>
    );
}

function Field({ id, label, type = 'text', value, onChange, autoComplete, disabled }) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {label}
            </label>
            <input
                id={id}
                type={type}
                autoComplete={autoComplete}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none disabled:opacity-60"
            />
        </div>
    );
}
