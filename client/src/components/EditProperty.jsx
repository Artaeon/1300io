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
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Lade Immobilie...</p>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
            <div className="flex items-center mb-6">
                <button onClick={() => navigate('/')} className="mr-4 text-gray-600">
                    <ArrowLeft />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Immobilie bearbeiten</h1>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-center">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <Building size={16} className="mr-2" /> Adresse
                    </label>
                    <input
                        type="text"
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <User size={16} className="mr-2" /> Eigentümer / Verwaltung
                    </label>
                    <input
                        type="text"
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <Layers size={16} className="mr-2" /> Einheiten
                    </label>
                    <input
                        type="number"
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={unitsCount}
                        onChange={(e) => setUnitsCount(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                    {saving ? 'Speichern...' : 'Änderungen speichern'}
                </button>
            </form>
        </div>
    );
}
