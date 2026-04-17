import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';

const ROLES = ['ADMIN', 'MANAGER', 'INSPECTOR', 'READONLY'];
const ROLE_LABELS = { ADMIN: 'Admin', MANAGER: 'Manager', INSPECTOR: 'Prüfer', READONLY: 'Nur Lesen' };
const ROLE_COLORS = {
    ADMIN: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
    MANAGER: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
    INSPECTOR: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
    READONLY: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
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
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Benutzer ({users.length})</h2>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 font-medium text-sm active:scale-[0.98] transition-all"
                >
                    <Plus size={16} /> Neuer Benutzer
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-blue-600 dark:text-blue-400" />
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Name</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Email</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Rolle</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{user.name}</td>
                                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{user.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || ''}`}>
                                                {ROLE_LABELS[user.role] || user.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => openEdit(user)} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => setDeleteConfirm(user.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 p-1 ml-1">
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
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                                <X size={20} />
                            </button>
                        </div>

                        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm">{error}</div>}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="user-name" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
                                <input
                                    id="user-name"
                                    type="text"
                                    autoComplete="name"
                                    required
                                    className="w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label htmlFor="user-email" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                                <input
                                    id="user-email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label htmlFor="user-password" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Passwort {editingUser && <span className="text-gray-400 dark:text-gray-500">(leer lassen = nicht ändern)</span>}
                                </label>
                                <input
                                    id="user-password"
                                    type="password"
                                    autoComplete="new-password"
                                    required={!editingUser}
                                    minLength={12}
                                    title="Mindestens 12 Zeichen, Groß- und Kleinbuchstaben sowie eine Ziffer"
                                    className="w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label htmlFor="user-role" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Rolle</label>
                                <select
                                    id="user-role"
                                    className="w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                                    value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                >
                                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] transition-all">
                                    Abbrechen
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 rounded-xl bg-blue-600 dark:bg-blue-500 text-white font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 active:scale-[0.98] transition-all">
                                    {saving ? 'Speichern...' : 'Speichern'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Benutzer löschen?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">Diese Aktion kann nicht rückgängig gemacht werden.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] transition-all">
                                Abbrechen
                            </button>
                            <button onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 active:scale-[0.98] transition-all">
                                Löschen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
