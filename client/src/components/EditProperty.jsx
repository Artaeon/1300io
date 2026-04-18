import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import { ArrowLeft, Building, User, Layers, Loader2 } from 'lucide-react';

export default function EditProperty() {
    const { id } = useParams();
    const { authFetch } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [address, setAddress] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [unitsCount, setUnitsCount] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    // Snapshot of the server state so we know whether the form is dirty.
    const initialRef = useRef({ address: '', ownerName: '', unitsCount: '' });

    useEffect(() => {
        authFetch(`/api/properties/${id}`)
            .then((res) => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then((data) => {
                setAddress(data.address);
                setOwnerName(data.owner_name);
                setUnitsCount(String(data.units_count));
                initialRef.current = {
                    address: data.address,
                    ownerName: data.owner_name,
                    unitsCount: String(data.units_count),
                };
                setLoading(false);
            })
            .catch(() => {
                setError('Immobilie nicht gefunden');
                setLoading(false);
            });
    }, [id, authFetch]);

    const isDirty =
        address !== initialRef.current.address ||
        ownerName !== initialRef.current.ownerName ||
        unitsCount !== initialRef.current.unitsCount;
    useBeforeUnload(isDirty && !submitted);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (saving) return;

        const errors = {};
        if (!address.trim()) errors.address = 'Adresse ist erforderlich';
        if (!ownerName.trim()) errors.ownerName = 'Eigentümer ist erforderlich';
        const units = parseInt(unitsCount, 10);
        if (!units || units < 1) errors.unitsCount = 'Mindestens 1 Einheit';
        if (units > 10_000) errors.unitsCount = 'Bitte eine realistische Anzahl angeben';
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});
        setSaving(true);
        setError('');
        try {
            const res = await authFetch(`/api/properties/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: address.trim(),
                    owner_name: ownerName.trim(),
                    units_count: units,
                }),
            });
            if (res.ok) {
                toast.success('Änderungen gespeichert');
                setSubmitted(true);
                navigate('/');
                return;
            }
            if (res.status === 400) {
                const data = await res.json().catch(() => ({}));
                setError(data.details?.[0] ?? data.error ?? 'Eingabe ungültig');
            } else if (res.status === 404) {
                setError('Diese Immobilie existiert nicht mehr.');
            } else if (res.status === 403) {
                setError('Keine Berechtigung, diese Immobilie zu bearbeiten.');
            } else {
                setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
            }
        } catch {
            setError('Verbindungsfehler');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100/50 dark:bg-gray-950">
                <Loader2 size={48} className="animate-spin text-blue-600 dark:text-blue-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Lade Immobilie…</p>
            </div>
        );
    }

    const inputClass = (field) =>
        `input-apple w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none ${
            fieldErrors[field]
                ? 'ring-2 ring-red-500'
                : ''
        }`;

    return (
        <div className="p-4 max-w-md mx-auto min-h-screen bg-gray-100/50 dark:bg-gray-950 pb-20">
            <div className="flex items-center mb-6">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    aria-label="Zurück zum Dashboard"
                    className="mr-2 -ml-2 p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/70 dark:hover:bg-gray-800/70 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    <ArrowLeft />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Immobilie bearbeiten</h1>
            </div>

            {error && (
                <div role="alert" className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="hover-lift space-y-6 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm hover:shadow-lg ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                <div>
                    <label htmlFor="edit-property-address" className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                        <Building size={16} className="mr-2" /> Adresse
                    </label>
                    <input
                        id="edit-property-address"
                        type="text"
                        autoComplete="street-address"
                        aria-invalid={Boolean(fieldErrors.address)}
                        aria-describedby={fieldErrors.address ? 'edit-address-error' : undefined}
                        className={inputClass('address')}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                    />
                    {fieldErrors.address && (
                        <p id="edit-address-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {fieldErrors.address}
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="edit-property-owner" className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                        <User size={16} className="mr-2" /> Eigentümer / Verwaltung
                    </label>
                    <input
                        id="edit-property-owner"
                        type="text"
                        autoComplete="organization"
                        aria-invalid={Boolean(fieldErrors.ownerName)}
                        aria-describedby={fieldErrors.ownerName ? 'edit-owner-error' : undefined}
                        className={inputClass('ownerName')}
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                    />
                    {fieldErrors.ownerName && (
                        <p id="edit-owner-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {fieldErrors.ownerName}
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="edit-property-units" className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                        <Layers size={16} className="mr-2" /> Einheiten
                    </label>
                    <input
                        id="edit-property-units"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        aria-invalid={Boolean(fieldErrors.unitsCount)}
                        aria-describedby={fieldErrors.unitsCount ? 'edit-units-error' : undefined}
                        className={inputClass('unitsCount')}
                        value={unitsCount}
                        onChange={(e) => setUnitsCount(e.target.value)}
                    />
                    {fieldErrors.unitsCount && (
                        <p id="edit-units-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {fieldErrors.unitsCount}
                        </p>
                    )}
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="btn-apple flex-1 py-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                        Abbrechen
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !isDirty}
                        className="btn-apple flex-1 bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-bold py-4 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
                    >
                        {saving && <Loader2 size={18} className="animate-spin" />}
                        {saving ? 'Speichern…' : 'Änderungen speichern'}
                    </button>
                </div>
            </form>
        </div>
    );
}
