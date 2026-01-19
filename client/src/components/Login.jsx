import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import LegalFooter from './LegalFooter';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError('Ungültige Zugangsdaten');
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full">
                    <div className="flex justify-center mb-6">
                        <div className="bg-blue-100 p-4 rounded-full">
                            <Lock size={40} className="text-blue-600" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Anmelden</h1>

                    {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-center">{error}</div>}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                required
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                            <input
                                type="password"
                                required
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition"
                        >
                            Einloggen
                        </button>
                    </form>
                </div>
            </div>
            <LegalFooter />
        </div>
    );
}
