import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import AdminLayout from './AdminLayout';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Plus, Pencil, Trash2, Users, Building2, UserPlus, UserMinus, Loader2 } from 'lucide-react';

export default function OrganizationManagement() {
    const { authFetch } = useAuth();
    const { toast } = useToast();
    const [organizations, setOrganizations] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editingOrg, setEditingOrg] = useState(null);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const [assignModal, setAssignModal] = useState(null); // orgId

    const fetchData = useCallback(async () => {
        try {
            const [orgRes, usersRes] = await Promise.all([
                authFetch('/api/organizations'),
                authFetch('/api/users'),
            ]);
            if (orgRes.ok) setOrganizations(await orgRes.json());
            if (usersRes.ok) setUsers(await usersRes.json());
        } catch {
            toast.error('Daten konnten nicht geladen werden.');
        } finally {
            setLoading(false);
        }
    }, [authFetch, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                setShowModal(false);
                toast.success(editingOrg ? 'Organisation aktualisiert' : 'Organisation angelegt');
                fetchData();
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

    const handleDelete = async (orgId) => {
        const res = await authFetch(`/api/organizations/${orgId}`, { method: 'DELETE' });
        if (res.ok) {
            toast.success('Organisation gelöscht');
            fetchData();
            return;
        }
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Löschen fehlgeschlagen');
        throw new Error('delete-failed');
    };

    const handleAssignUser = async (orgId, userId) => {
        try {
            const res = await authFetch(`/api/organizations/${orgId}/users/${userId}`, { method: 'PUT' });
            if (res.ok) {
                fetchData();
            } else {
                toast.error('Zuweisung fehlgeschlagen');
            }
        } catch {
            toast.error('Verbindungsfehler');
        }
    };

    const handleRemoveUser = async (orgId, userId) => {
        try {
            const res = await authFetch(`/api/organizations/${orgId}/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
            } else {
                toast.error('Entfernen fehlgeschlagen');
            }
        } catch {
            toast.error('Verbindungsfehler');
        }
    };

    const getOrgUsers = (orgId) => users.filter((u) => u.organizationId === orgId);
    const getUnassignedUsers = () => users.filter((u) => !u.organizationId);

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-blue-600 dark:text-blue-400" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Organisationen</h2>
                <button
                    type="button"
                    onClick={openCreate}
                    className="btn-apple flex items-center gap-2 bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
                >
                    <Plus size={16} />
                    Neue Organisation
                </button>
            </div>

            {organizations.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Building2 size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="mb-2">Noch keine Organisationen vorhanden.</p>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="link-underline text-blue-600 dark:text-blue-400 font-medium"
                    >
                        Erste Organisation anlegen
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {organizations.map((org) => {
                        const orgUsers = getOrgUsers(org.id);
                        return (
                            <div key={org.id} className="hover-lift bg-white dark:bg-gray-900 rounded-2xl shadow-sm hover:shadow-lg p-5 ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{org.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {org._count?.users || 0} Benutzer, {org._count?.properties || 0} Objekte
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setAssignModal(assignModal === org.id ? null : org.id)}
                                            aria-label="Benutzer zuweisen"
                                            title="Benutzer zuweisen"
                                            className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <UserPlus size={18} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openEdit(org)}
                                            aria-label="Bearbeiten"
                                            title="Bearbeiten"
                                            className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeleteConfirm(org.id)}
                                            aria-label="Löschen"
                                            title="Löschen"
                                            className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {orgUsers.length > 0 && (
                                    <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                                            <Users size={12} /> Zugewiesene Benutzer
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {orgUsers.map((u) => (
                                                <span key={u.id} className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm px-3 py-1 rounded-full">
                                                    {u.name}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveUser(org.id, u.id)}
                                                        aria-label={`${u.name} entfernen`}
                                                        className="hover:text-red-500 dark:hover:text-red-400 ml-1 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                                                    >
                                                        <UserMinus size={14} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {assignModal === org.id && (
                                    <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Benutzer zuweisen:</p>
                                        {getUnassignedUsers().length === 0 ? (
                                            <p className="text-sm text-gray-400 dark:text-gray-500">Alle Benutzer sind bereits zugewiesen.</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {getUnassignedUsers().map((u) => (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        onClick={() => handleAssignUser(org.id, u.id)}
                                                        className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                title={editingOrg ? 'Organisation bearbeiten' : 'Neue Organisation'}
                size="sm"
            >
                {error && (
                    <div role="alert" className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label htmlFor="org-name" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
                        <input
                            id="org-name"
                            type="text"
                            autoComplete="organization"
                            required
                            className="input-apple w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="z.B. Hausverwaltung Müller GmbH"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="btn-apple flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="btn-apple flex-1 py-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
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
                title="Organisation löschen?"
                message={
                    <>
                        <p>
                            Sind Sie sicher, dass Sie{' '}
                            <strong>{organizations.find(o => o.id === deleteConfirm)?.name ?? 'diese Organisation'}</strong> löschen möchten?
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                            Benutzer und Objekte werden von der Organisation getrennt, aber nicht gelöscht. Diese Aktion ist unwiderruflich.
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
