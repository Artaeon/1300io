import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { ArrowLeft, Building, User, Layers, Loader2 } from 'lucide-react';

export default function AddProperty() {
    const [address, setAddress] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [unitsCount, setUnitsCount] = useState('');
    const [saving, setSaving] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const { authFetch } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (saving) return;

        // Client-side validation for fast feedback
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

        try {
            const res = await authFetch('/api/properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: address.trim(),
                    owner_name: ownerName.trim(),
                    units_count: units,
                }),
            });
            if (res.ok) {
                toast.success('Objekt angelegt');
                navigate('/');
                return;
            }

            if (res.status === 400) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.details?.[0] ?? data.error ?? 'Eingabe ungültig');
            } else if (res.status === 403) {
                toast.error('Keine Berechtigung, Objekte anzulegen.');
            } else {
                toast.error('Objekt konnte nicht angelegt werden. Bitte erneut versuchen.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Verbindungsfehler. Bitte prüfen Sie Ihre Internet-Verbindung.');
        } finally {
            setSaving(false);
        }
    };

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
                    aria-label="Zurück"
                    className="mr-2 -ml-2 p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/70 dark:hover:bg-gray-800/70 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <ArrowLeft />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Neue Immobilie</h1>
            </div>

            <form
                onSubmit={handleSubmit}
                noValidate
                className="hover-lift space-y-6 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm hover:shadow-lg ring-1 ring-gray-200/60 dark:ring-gray-800/60"
            >
                <div>
                    <label htmlFor="property-address" className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                        <Building size={16} className="mr-2" /> Adresse
                    </label>
                    <input
                        id="property-address"
                        type="text"
                        autoComplete="street-address"
                        aria-invalid={Boolean(fieldErrors.address)}
                        aria-describedby={fieldErrors.address ? 'property-address-error' : undefined}
                        placeholder="Musterstraße 1, 1010 Wien"
                        className={inputClass('address')}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                    />
                    {fieldErrors.address && (
                        <p id="property-address-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {fieldErrors.address}
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="property-owner" className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                        <User size={16} className="mr-2" /> Eigentümer / Verwaltung
                    </label>
                    <input
                        id="property-owner"
                        type="text"
                        autoComplete="organization"
                        aria-invalid={Boolean(fieldErrors.ownerName)}
                        aria-describedby={fieldErrors.ownerName ? 'property-owner-error' : undefined}
                        placeholder="ImmoTrust GmbH"
                        className={inputClass('ownerName')}
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                    />
                    {fieldErrors.ownerName && (
                        <p id="property-owner-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {fieldErrors.ownerName}
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="property-units" className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                        <Layers size={16} className="mr-2" /> Einheiten
                    </label>
                    <input
                        id="property-units"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        aria-invalid={Boolean(fieldErrors.unitsCount)}
                        aria-describedby={fieldErrors.unitsCount ? 'property-units-error' : undefined}
                        placeholder="10"
                        className={inputClass('unitsCount')}
                        value={unitsCount}
                        onChange={(e) => setUnitsCount(e.target.value)}
                    />
                    {fieldErrors.unitsCount && (
                        <p id="property-units-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {fieldErrors.unitsCount}
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="btn-apple w-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-bold py-4 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                    {saving && <Loader2 size={18} className="animate-spin" />}
                    {saving ? 'Speichern…' : 'Speichern'}
                </button>
            </form>
        </div>
    );
}
