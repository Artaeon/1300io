import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminLayout from './AdminLayout';
import { Plus, Pencil, Trash2, Users, Building2, X, UserPlus, UserMinus } from 'lucide-react';

export default function OrganizationManagement() {
    const { authFetch } = useAuth();
    const [organizations, setOrganizations] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editingOrg, setEditingOrg] = useState(null);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const [assignModal, setAssignModal] = useState(null); // orgId

    const fetchData = useCallback(async () => {
        try {
            const [orgRes, usersRes] = await Promise.all([
                authFetch('/api/organizations'),
                authFetch('/api/users')
            ]);
            if (orgRes.ok) setOrganizations(await orgRes.json());
            if (usersRes.ok) setUsers(await usersRes.json());
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openCreate = () => {
        setEditingOrg(null);
        setName('');
        setError('');
        setShowModal(true);
    };

    const openEdit = (org) => {
        setEditingOrg(org);
        setName(org.name);
        setError('');
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const url = editingOrg ? `/api/organizations/${editingOrg.id}` : '/api/organizations';
            const method = editingOrg ? 'PUT' : 'POST';
            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                setShowModal(false);
                fetchData();
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

    const handleDelete = async (orgId) => {
        setDeleting(true);
        try {
            const res = await authFetch(`/api/organizations/${orgId}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error || 'Löschen fehlgeschlagen');
            }
        } catch {
            alert('Verbindungsfehler');
        } finally {
            setDeleting(false);
            setDeleteConfirm(null);
        }
    };

    const handleAssignUser = async (orgId, userId) => {
        try {
            const res = await authFetch(`/api/organizations/${orgId}/users/${userId}`, { method: 'PUT' });
            if (res.ok) fetchData();
        } catch {
            // ignore
        }
    };

    const handleRemoveUser = async (orgId, userId) => {
        try {
            const res = await authFetch(`/api/organizations/${orgId}/users/${userId}`, { method: 'DELETE' });
            if (res.ok) fetchData();
        } catch {
            // ignore
        }
    };

    const getOrgUsers = (orgId) => users.filter(u => u.organizationId === orgId);
    const getUnassignedUsers = () => users.filter(u => !u.organizationId);

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Organisationen</h2>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                    <Plus size={16} />
                    Neue Organisation
                </button>
            </div>

            {organizations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <Building2 size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Noch keine Organisationen vorhanden.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {organizations.map(org => {
                        const orgUsers = getOrgUsers(org.id);
                        return (
                            <div key={org.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{org.name}</h3>
                                        <p className="text-sm text-gray-500">
                                            {org._count?.users || 0} Benutzer, {org._count?.properties || 0} Objekte
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setAssignModal(assignModal === org.id ? null : org.id)}
                                            className="text-gray-400 hover:text-blue-600 p-1"
                                            title="Benutzer zuweisen"
                                        >
                                            <UserPlus size={18} />
                                        </button>
                                        <button onClick={() => openEdit(org)} className="text-gray-400 hover:text-blue-600 p-1" title="Bearbeiten">
                                            <Pencil size={18} />
                                        </button>
                                        <button onClick={() => setDeleteConfirm(org.id)} className="text-gray-400 hover:text-red-600 p-1" title="Löschen">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Assigned Users */}
                                {orgUsers.length > 0 && (
                                    <div className="mt-3 border-t border-gray-100 pt-3">
                                        <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                            <Users size={12} /> Zugewiesene Benutzer
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {orgUsers.map(u => (
                                                <span key={u.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full">
                                                    {u.name}
                                                    <button
                                                        onClick={() => handleRemoveUser(org.id, u.id)}
                                                        className="hover:text-red-500 ml-1"
                                                    >
                                                        <UserMinus size={14} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Assign User Panel */}
                                {assignModal === org.id && (
                                    <div className="mt-3 border-t border-gray-100 pt-3">
                                        <p className="text-xs font-medium text-gray-500 mb-2">Benutzer zuweisen:</p>
                                        {getUnassignedUsers().length === 0 ? (
                                            <p className="text-sm text-gray-400">Alle Benutzer sind bereits zugewiesen.</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {getUnassignedUsers().map(u => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => handleAssignUser(org.id, u.id)}
                                                        className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full hover:bg-blue-100 hover:text-blue-700 transition"
                                                    >
                                                        + {u.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingOrg ? 'Organisation bearbeiten' : 'Neue Organisation'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="z.B. Hausverwaltung Müller GmbH"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400"
                                >
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
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Organisation löschen?</h3>
                        <p className="text-gray-600 mb-6">
                            Benutzer und Objekte werden von der Organisation getrennt, aber nicht gelöscht.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                disabled={deleting}
                                className="flex-1 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:bg-gray-400"
                            >
                                {deleting ? 'Löschen...' : 'Löschen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
