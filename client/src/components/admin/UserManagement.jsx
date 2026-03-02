import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';

const ROLES = ['ADMIN', 'MANAGER', 'INSPECTOR', 'READONLY'];
const ROLE_LABELS = { ADMIN: 'Admin', MANAGER: 'Manager', INSPECTOR: 'Prüfer', READONLY: 'Nur Lesen' };
const ROLE_COLORS = {
    ADMIN: 'bg-red-100 text-red-700',
    MANAGER: 'bg-blue-100 text-blue-700',
    INSPECTOR: 'bg-green-100 text-green-700',
    READONLY: 'bg-gray-100 text-gray-600',
};

const emptyForm = { email: '', password: '', name: '', role: 'INSPECTOR' };

export default function UserManagement() {
    const { authFetch } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await authFetch('/api/users');
            if (res.ok) setUsers(await res.json());
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, [authFetch]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const openCreate = () => {
        setEditingUser(null);
        setForm(emptyForm);
        setError('');
        setShowModal(true);
    };

    const openEdit = (user) => {
        setEditingUser(user);
        setForm({ email: user.email, password: '', name: user.name, role: user.role });
        setError('');
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const body = editingUser
                ? { name: form.name, email: form.email, role: form.role, ...(form.password ? { password: form.password } : {}) }
                : form;

            const res = await authFetch(
                editingUser ? `/api/users/${editingUser.id}` : '/api/users',
                {
                    method: editingUser ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }
            );

            if (res.ok) {
                setShowModal(false);
                fetchUsers();
            } else {
                const data = await res.json();
                setError(data.error || data.details?.join(', ') || 'Fehler');
            }
        } catch {
            setError('Verbindungsfehler');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (userId) => {
        try {
            const res = await authFetch(`/api/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                setUsers(prev => prev.filter(u => u.id !== userId));
            } else {
                const data = await res.json();
                alert(data.error || 'Löschen fehlgeschlagen');
            }
        } catch {
            alert('Verbindungsfehler');
        } finally {
            setDeleteConfirm(null);
        }
    };

    return (
        <AdminLayout>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Benutzer ({users.length})</h2>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
                >
                    <Plus size={16} /> Neuer Benutzer
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Rolle</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{user.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || ''}`}>
                                                {ROLE_LABELS[user.role] || user.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => openEdit(user)} className="text-gray-400 hover:text-blue-600 p-1">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => setDeleteConfirm(user.id)} className="text-gray-400 hover:text-red-600 p-1 ml-1">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text" required
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email" required
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Passwort {editingUser && <span className="text-gray-400">(leer lassen = nicht ändern)</span>}
                                </label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    minLength={8}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
                                <select
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                >
                                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
                                    Abbrechen
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400">
                                    {saving ? 'Speichern...' : 'Speichern'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Benutzer löschen?</h3>
                        <p className="text-gray-600 mb-6">Diese Aktion kann nicht rückgängig gemacht werden.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
                                Abbrechen
                            </button>
                            <button onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700">
                                Löschen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
