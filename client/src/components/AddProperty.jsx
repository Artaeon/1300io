import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Building, User, Layers } from 'lucide-react';

export default function AddProperty() {
    const [address, setAddress] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [unitsCount, setUnitsCount] = useState('');
    const { authFetch } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await authFetch('/api/properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, owner_name: ownerName, units_count: unitsCount })
            });
            if (res.ok) {
                navigate('/');
            } else {
                alert('Fehler beim Erstellen der Immobilie');
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="p-4 max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
            <div className="flex items-center mb-6">
                <button onClick={() => navigate('/')} className="mr-4 text-gray-600">
                    <ArrowLeft />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Neue Immobilie</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <Building size={16} className="mr-2" /> Adresse
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="Musterstraße 1, 1010 Wien"
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
                        placeholder="ImmoTrust GmbH"
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
                        placeholder="10"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={unitsCount}
                        onChange={(e) => setUnitsCount(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition"
                >
                    Speichern
                </button>
            </form>
        </div>
    );
}
