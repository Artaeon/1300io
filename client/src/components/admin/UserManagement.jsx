import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

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
    const { toast } = useToast();
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
                toast.success(editingUser ? 'Benutzer aktualisiert' : 'Benutzer angelegt');
                fetchUsers();
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || data.details?.join(', ') || 'Fehler beim Speichern');
            }
        } catch {
            setError('Verbindungsfehler');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (userId) => {
        const res = await authFetch(`/api/users/${userId}`, { method: 'DELETE' });
        if (res.ok) {
            setUsers(prev => prev.filter(u => u.id !== userId));
            toast.success('Benutzer gelöscht');
            return;
        }
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 && data.error?.includes('own account')) {
            toast.error('Sie können Ihr eigenes Konto nicht löschen.');
        } else {
            toast.error(data.error || 'Löschen fehlgeschlagen');
        }
        throw new Error('delete-failed');
    };

    return (
        <AdminLayout>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Benutzer ({users.length})</h2>
                <button
                    onClick={openCreate}
                    className="btn-apple flex items-center gap-2 bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white px-4 py-2 rounded-xl font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    <Plus size={16} /> Neuer Benutzer
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-blue-600 dark:text-blue-400" />
                </div>
            ) : (
                <div className="hover-lift bg-white dark:bg-gray-900 rounded-2xl shadow-sm hover:shadow-lg overflow-hidden ring-1 ring-gray-200/60 dark:ring-gray-800/60">
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
            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                title={editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
            >
                {error && (
                    <div role="alert" className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="user-name" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
                        <input
                            id="user-name"
                            type="text"
                            autoComplete="name"
                            required
                            className="input-apple w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
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
                            className="input-apple w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
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
                            className="input-apple w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        />
                        {!editingUser && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                                Mindestens 12 Zeichen, Groß- und Kleinbuchstaben sowie eine Ziffer.
                            </p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="user-role" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Rolle</label>
                        <select
                            id="user-role"
                            className="input-apple w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 outline-none"
                            value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                        >
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowModal(false)}
                            className="btn-apple flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700">
                            Abbrechen
                        </button>
                        <button type="submit" disabled={saving}
                            className="btn-apple flex-1 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {saving && <Loader2 size={16} className="animate-spin" />}
                            {saving ? 'Speichern…' : 'Speichern'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={deleteConfirm !== null}
                onClose={() => setDeleteConfirm(null)}
                title="Benutzer löschen?"
                message={
                    <>
                        <p>
                            Sind Sie sicher, dass Sie{' '}
                            <strong>{users.find(u => u.id === deleteConfirm)?.name ?? 'diesen Benutzer'}</strong> löschen möchten?
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                            Der Benutzer verliert sofort den Zugriff. Prüfungsprotokolle bleiben im Audit-Log erhalten.
                        </p>
                    </>
                }
                confirmLabel="Löschen"
                destructive
                onConfirm={() => handleDelete(deleteConfirm)}
            />
        </AdminLayout>
    );
}
