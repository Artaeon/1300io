import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Building, User, Layers, Loader2 } from 'lucide-react';

export default function EditProperty() {
    const { id } = useParams();
    const { authFetch } = useAuth();
    const navigate = useNavigate();

    const [address, setAddress] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [unitsCount, setUnitsCount] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        authFetch(`/api/properties/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then(data => {
                setAddress(data.address);
                setOwnerName(data.owner_name);
                setUnitsCount(String(data.units_count));
                setLoading(false);
            })
            .catch(() => {
                setError('Immobilie nicht gefunden');
                setLoading(false);
            });
    }, [id, authFetch]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const res = await authFetch(`/api/properties/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, owner_name: ownerName, units_count: unitsCount })
            });
            if (res.ok) {
                navigate('/');
            } else {
                const data = await res.json();
                setError(data.error || 'Fehler beim Speichern');
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
                <p className="text-gray-600 dark:text-gray-400">Lade Immobilie...</p>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-md mx-auto min-h-screen bg-gray-100/50 dark:bg-gray-950 pb-20">
            <div className="flex items-center mb-6">
                <button onClick={() => navigate('/')} className="mr-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 active:scale-95 transition-all">
                    <ArrowLeft />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Immobilie bearbeiten</h1>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-center">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm">
                <div>
                    <label htmlFor="edit-property-address" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                        <Building size={16} className="mr-2" /> Adresse
                    </label>
                    <input
                        id="edit-property-address"
                        type="text"
                        autoComplete="street-address"
                        required
                        className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="edit-property-owner" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                        <User size={16} className="mr-2" /> Eigentümer / Verwaltung
                    </label>
                    <input
                        id="edit-property-owner"
                        type="text"
                        autoComplete="organization"
                        required
                        className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="edit-property-units" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                        <Layers size={16} className="mr-2" /> Einheiten
                    </label>
                    <input
                        id="edit-property-units"
                        type="number"
                        min="1"
                        required
                        className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                        value={unitsCount}
                        onChange={(e) => setUnitsCount(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-blue-600 dark:bg-blue-500 text-white font-bold py-4 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-[0.98] transition-all disabled:bg-gray-400"
                >
                    {saving ? 'Speichern...' : 'Änderungen speichern'}
                </button>
            </form>
        </div>
    );
}
