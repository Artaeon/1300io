import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, UserPlus, Loader2, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft, ShieldCheck, Moon, Sun, Eye, EyeOff, Check } from 'lucide-react';
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
    const [success, setSuccess] = useState(false);

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
            // Success: show the celebration overlay for ~1.4s so the user
            // sees the confirmation, then seed the auth context and route.
            setSuccess(true);
            setTimeout(() => {
                bootstrapSession({
                    token: data.token,
                    refreshToken: data.refreshToken,
                    user: data.user,
                });
                if (onInitialized) onInitialized();
                navigate('/', { replace: true });
            }, 1400);
        } catch {
            setServerError('Verbindungsfehler. Bitte erneut versuchen.');
        } finally {
            setLoading(false);
        }
    };

    const onFormSubmit = (e) => {
        e.preventDefault();
        if (loading) return;
        if (step < TOTAL_STEPS) {
            next();
        } else {
            submit();
        }
    };

    if (success) {
        return <SuccessOverlay orgName={orgName} />;
    }

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
                <form
                    onSubmit={onFormSubmit}
                    noValidate
                    className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl max-w-md w-full animate-fade-in-up ring-1 ring-gray-200/60 dark:ring-gray-800/60"
                >
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
                                type="submit"
                                className="group flex items-center gap-2 bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-semibold py-3 px-5 rounded-xl hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                Weiter
                                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-semibold py-3 px-5 rounded-xl hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                {loading ? 'Einrichten…' : 'Einrichtung abschließen'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
            <LegalFooter />
        </div>
    );
}

const STEP_LABELS = ['Willkommen', 'Admin-Konto', 'Organisation'];

function SuccessOverlay({ orgName }) {
    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-10 rounded-2xl shadow-xl max-w-sm w-full text-center animate-pop-in ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                <div className="flex justify-center mb-6">
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
                        <div className="absolute inset-0 rounded-full animate-pulse-ring" />
                        <svg
                            viewBox="0 0 48 48"
                            width="40"
                            height="40"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M14 24 L22 32 L36 16"
                                stroke="white"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="animate-checkmark-draw"
                            />
                        </svg>
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 animate-fade-in-up">
                    Alles bereit!
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                    {orgName ? <>Willkommen in {orgName}. </> : null}
                    Sie werden zur Übersicht weitergeleitet…
                </p>
                <div className="mt-6 h-1 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-green-600 animate-shimmer" />
                </div>
            </div>
            <LegalFooter />
        </div>
    );
}

function StepIndicator({ step, total }) {
    const pct = ((step - 1) / (total - 1)) * 100;
    return (
        <div className="mb-7" aria-label={`Schritt ${step} von ${total}: ${STEP_LABELS[step - 1]}`}>
            <div className="flex items-center justify-between mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span>Schritt {step} von {total}</span>
                <span className="text-blue-600 dark:text-blue-400">{STEP_LABELS[step - 1]}</span>
            </div>
            <div className="relative h-2 rounded-full bg-gray-200/70 dark:bg-gray-800 overflow-hidden">
                <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-[width] duration-500 ease-out"
                    style={{ width: `${Math.max(8, pct)}%` }}
                />
            </div>
            <div className="flex items-center justify-between mt-3">
                {Array.from({ length: total }).map((_, i) => {
                    const n = i + 1;
                    const active = n === step;
                    const done = n < step;
                    return (
                        <div
                            key={n}
                            className={[
                                'flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-all duration-300',
                                done ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm' :
                                active ? 'bg-white dark:bg-gray-800 ring-2 ring-blue-500 dark:ring-blue-400 text-blue-600 dark:text-blue-400 scale-110 animate-pulse-ring' :
                                'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                            ].join(' ')}
                        >
                            {done ? <CheckCircle size={14} /> : n}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function WelcomeStep() {
    const items = [
        { Icon: UserPlus, title: 'Admin-Konto', body: 'Ihr persönlicher Zugang mit vollen Rechten.' },
        { Icon: Building2, title: 'Organisation', body: 'Name Ihrer Hausverwaltung für Berichte.' },
        { Icon: CheckCircle, title: 'Einsatzbereit', body: 'Direkt loslegen mit Ihrer ersten Prüfung.' },
    ];
    return (
        <div className="text-center">
            <div className="flex justify-center mb-5">
                <div className="relative">
                    <div className="absolute inset-0 rounded-2xl animate-pulse-ring" />
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl shadow-lg">
                        <ShieldCheck size={40} className="text-white" />
                    </div>
                </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                Willkommen bei 1300.io
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                In drei kurzen Schritten ist Ihre Instanz einsatzbereit.
            </p>
            <ul className="text-left space-y-2">
                {/* eslint-disable-next-line no-unused-vars */}
                {items.map(({ Icon, title, body }, i) => (
                    <li
                        key={title}
                        className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 ring-1 ring-gray-100 dark:ring-gray-800 animate-fade-in-right"
                        style={{ animationDelay: `${80 + i * 80}ms` }}
                    >
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Icon size={18} />
                        </div>
                        <div>
                            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{title}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">{body}</div>
                        </div>
                    </li>
                ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-5">
                Diese Seite erscheint nur bei der ersten Inbetriebnahme.
            </p>
        </div>
    );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AdminStep({ name, setName, email, setEmail, password, setPassword, confirm, setConfirm, error, disabled }) {
    const nameValid = name.trim().length > 0;
    const emailValid = EMAIL_RE.test(email);
    const passwordOk = password.length >= 12;
    const confirmValid = confirm.length > 0 && confirm === password;

    return (
        <div>
            <div className="flex justify-center mb-4">
                <div className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 p-3 rounded-2xl shadow-sm">
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
                    autoComplete="name" disabled={disabled} valid={nameValid} />
                <Field id="setup-admin-email" label="E-Mail" type="email" value={email} onChange={setEmail}
                    autoComplete="email" disabled={disabled} valid={emailValid} />
                <PasswordField id="setup-admin-password" label="Passwort (min. 12 Zeichen)" value={password}
                    onChange={setPassword} autoComplete="new-password" disabled={disabled} showStrength />
                <PasswordField id="setup-admin-confirm" label="Passwort wiederholen" value={confirm}
                    onChange={setConfirm} autoComplete="new-password" disabled={disabled} />
                {passwordOk && confirm && !confirmValid && (
                    <p role="alert" className="text-xs text-red-500 dark:text-red-400 animate-fade-in">
                        Passwörter stimmen nicht überein.
                    </p>
                )}

                {error && (
                    <p role="alert" className="text-xs text-red-600 dark:text-red-400 animate-fade-in">{error}</p>
                )}
            </div>
        </div>
    );
}

function OrgStep({ name, setName, error, disabled }) {
    const nameValid = name.trim().length > 0;
    return (
        <div>
            <div className="flex justify-center mb-4">
                <div className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 p-3 rounded-2xl shadow-sm">
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
                autoComplete="organization" disabled={disabled} valid={nameValid} />

            {error && (
                <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400 animate-fade-in">{error}</p>
            )}
        </div>
    );
}

function Field({ id, label, type = 'text', value, onChange, autoComplete, disabled, valid }) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={type}
                    autoComplete={autoComplete}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={[
                        'w-full p-3 pr-10 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 outline-none transition-all disabled:opacity-60',
                        valid
                            ? 'ring-2 ring-green-400/60 dark:ring-green-500/60 focus:ring-green-500'
                            : 'focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
                    ].join(' ')}
                />
                {valid && (
                    <span
                        aria-hidden="true"
                        className="absolute inset-y-0 right-3 flex items-center text-green-500 dark:text-green-400 animate-pop-in"
                    >
                        <Check size={18} />
                    </span>
                )}
            </div>
        </div>
    );
}

// --- Password strength helpers ----------------------------------------

function computePasswordStrength(pw) {
    if (!pw) return { score: 0, label: '', tone: '' };
    let score = 0;
    if (pw.length >= 12) score += 1;
    if (pw.length >= 16) score += 1;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
    if (/\d/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    if (pw.length < 12) score = Math.min(score, 1);
    score = Math.min(score, 4);
    const labels = ['', 'Schwach', 'Akzeptabel', 'Gut', 'Stark'];
    const tones = [
        '',
        'bg-red-500',
        'bg-yellow-500',
        'bg-emerald-500',
        'bg-green-500',
    ];
    return { score, label: labels[score], tone: tones[score] };
}

function PasswordField({ id, label, value, onChange, autoComplete, disabled, showStrength }) {
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const { score, label: strengthLabel, tone } = computePasswordStrength(value);

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyUp={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                    onKeyDown={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                    onBlur={() => setCapsLock(false)}
                    disabled={disabled}
                    className="w-full p-3 pr-11 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none transition-all disabled:opacity-60"
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Passwort ausblenden' : 'Passwort einblenden'}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-2 flex items-center p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>

            {capsLock && (
                <p role="alert" className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-fade-in">
                    <AlertTriangle size={12} /> Feststelltaste ist aktiv.
                </p>
            )}

            {showStrength && value && (
                <div className="mt-2 animate-fade-in">
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className={[
                                    'h-1.5 flex-1 rounded-full transition-colors duration-300',
                                    i <= score ? tone : 'bg-gray-200 dark:bg-gray-800',
                                ].join(' ')}
                            />
                        ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                        <span>Passwortstärke</span>
                        <span className={[
                            'font-semibold',
                            score <= 1 ? 'text-red-500' :
                            score === 2 ? 'text-yellow-600 dark:text-yellow-400' :
                            score === 3 ? 'text-emerald-600 dark:text-emerald-400' :
                            'text-green-600 dark:text-green-400',
                        ].join(' ')}>{strengthLabel}</span>
                    </p>
                </div>
            )}
        </div>
    );
}
