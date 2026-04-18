import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function ChecklistManagement() {
    const { authFetch } = useAuth();
    const { toast } = useToast();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({});

    const [modal, setModal] = useState(null); // { type, mode, data? }
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [deleteTarget, setDeleteTarget] = useState(null); // { kind: 'category'|'item', id, label }

    const fetchCategories = useCallback(async () => {
        try {
            const res = await authFetch('/api/checklist/categories');
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
                if (Object.keys(expanded).length === 0) {
                    const exp = {};
                    data.forEach((c) => {
                        exp[c.id] = true;
                    });
                    setExpanded(exp);
                }
            } else {
                toast.error('Checkliste konnte nicht geladen werden.');
            }
        } catch {
            toast.error('Verbindungsfehler');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authFetch, toast]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const openCreateCategory = () => {
        setModal({ type: 'category', mode: 'create' });
        setForm({ name: '', sort_order: categories.length });
        setError('');
    };

    const openEditCategory = (cat) => {
        setModal({ type: 'category', mode: 'edit', data: cat });
        setForm({ name: cat.name, sort_order: cat.sort_order });
        setError('');
    };

    const openCreateItem = (categoryId) => {
        const cat = categories.find((c) => c.id === categoryId);
        setModal({ type: 'item', mode: 'create', data: { category_id: categoryId } });
        setForm({ text: '', sort_order: cat?.items?.length || 0 });
        setError('');
    };

    const openEditItem = (item) => {
        setModal({ type: 'item', mode: 'edit', data: item });
        setForm({ text: item.text, sort_order: item.sort_order });
        setError('');
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const url =
            deleteTarget.kind === 'category'
                ? `/api/checklist/categories/${deleteTarget.id}`
                : `/api/checklist/items/${deleteTarget.id}`;
        const res = await authFetch(url, { method: 'DELETE' });
        if (res.ok) {
            toast.success('Gelöscht');
            fetchCategories();
            return;
        }
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Löschen fehlgeschlagen');
        throw new Error('delete-failed');
    };

    const moveCategoryOrder = async (cat, direction) => {
        const newOrder = cat.sort_order + direction;
        if (newOrder < 0) return;
        await authFetch(`/api/checklist/categories/${cat.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order: newOrder }),
        });
        fetchCategories();
    };

    const moveItemOrder = async (item, direction) => {
        const newOrder = item.sort_order + direction;
        if (newOrder < 0) return;
        await authFetch(`/api/checklist/items/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order: newOrder }),
        });
        fetchCategories();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            let url;
            let method;
            let body;

            if (modal.type === 'category') {
                if (modal.mode === 'create') {
                    url = '/api/checklist/categories';
                    method = 'POST';
                    body = form;
                } else {
                    url = `/api/checklist/categories/${modal.data.id}`;
                    method = 'PUT';
                    body = form;
                }
            } else if (modal.mode === 'create') {
                url = '/api/checklist/items';
                method = 'POST';
                body = { ...form, category_id: modal.data.category_id };
            } else {
                url = `/api/checklist/items/${modal.data.id}`;
                method = 'PUT';
                body = form;
            }

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setModal(null);
                toast.success('Gespeichert');
                fetchCategories();
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

    return (
        <AdminLayout>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    Checkliste ({categories.length} Kategorien, {categories.reduce((sum, c) => sum + (c.items?.length || 0), 0)} Prüfpunkte)
                </h2>
                <button
                    type="button"
                    onClick={openCreateCategory}
                    className="btn-apple flex items-center gap-2 bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white px-4 py-2 rounded-xl font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
                >
                    <Plus size={16} /> Kategorie
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-blue-600 dark:text-blue-400" />
                </div>
            ) : categories.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p className="mb-2">Noch keine Kategorien.</p>
                    <button type="button" onClick={openCreateCategory} className="link-underline text-blue-600 dark:text-blue-400 font-medium">
                        Erste Kategorie anlegen
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {categories.map((cat) => (
                        <div key={cat.id} className="hover-lift bg-white dark:bg-gray-900 rounded-2xl shadow-sm hover:shadow-lg overflow-hidden ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                            <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                <button
                                    type="button"
                                    onClick={() => toggleExpand(cat.id)}
                                    aria-label={expanded[cat.id] ? 'Einklappen' : 'Aufklappen'}
                                    aria-expanded={Boolean(expanded[cat.id])}
                                    className="p-1 text-gray-500 dark:text-gray-400 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                                >
                                    {expanded[cat.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </button>
                                <span className="font-semibold text-gray-900 dark:text-gray-100 flex-1">{cat.name}</span>
                                <span className="text-xs text-gray-400 dark:text-gray-500 mr-3">{cat.items?.length || 0} Punkte</span>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => moveCategoryOrder(cat, -1)} aria-label="Nach oben verschieben" title="Nach oben" className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <ArrowUp size={14} />
                                    </button>
                                    <button type="button" onClick={() => moveCategoryOrder(cat, 1)} aria-label="Nach unten verschieben" title="Nach unten" className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <ArrowDown size={14} />
                                    </button>
                                    <button type="button" onClick={() => openEditCategory(cat)} aria-label="Kategorie bearbeiten" title="Bearbeiten" className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeleteTarget({ kind: 'category', id: cat.id, label: cat.name, itemCount: cat.items?.length ?? 0 })}
                                        aria-label="Kategorie löschen"
                                        title="Löschen"
                                        className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {expanded[cat.id] && (
                                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {cat.items?.map((item) => (
                                        <div key={item.id} className="flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{item.text}</span>
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                <button type="button" onClick={() => moveItemOrder(item, -1)} aria-label="Nach oben verschieben" className="p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                                    <ArrowUp size={12} />
                                                </button>
                                                <button type="button" onClick={() => moveItemOrder(item, 1)} aria-label="Nach unten verschieben" className="p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                                    <ArrowDown size={12} />
                                                </button>
                                                <button type="button" onClick={() => openEditItem(item)} aria-label="Prüfpunkt bearbeiten" className="p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                                    <Pencil size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget({ kind: 'item', id: item.id, label: item.text })}
                                                    aria-label="Prüfpunkt löschen"
                                                    className="p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => openCreateItem(cat.id)}
                                        className="w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                                    >
                                        <Plus size={14} /> Prüfpunkt hinzufügen
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <Modal
                open={modal !== null}
                onClose={() => setModal(null)}
                title={
                    modal
                        ? modal.mode === 'create'
                            ? modal.type === 'category'
                                ? 'Neue Kategorie'
                                : 'Neuer Prüfpunkt'
                            : modal.type === 'category'
                              ? 'Kategorie bearbeiten'
                              : 'Prüfpunkt bearbeiten'
                        : ''
                }
            >
                {error && (
                    <div role="alert" className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="checklist-name" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {modal?.type === 'category' ? 'Kategoriename' : 'Prüfpunkt'}
                        </label>
                        {modal?.type === 'category' ? (
                            <input
                                id="checklist-name"
                                type="text"
                                required
                                className="input-apple w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                                value={form.name || ''}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            />
                        ) : (
                            <textarea
                                id="checklist-name"
                                required
                                rows={3}
                                className="input-apple w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                                value={form.text || ''}
                                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                            />
                        )}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setModal(null)}
                            className="btn-apple flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="btn-apple flex-1 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            {saving && <Loader2 size={16} className="animate-spin" />}
                            {saving ? 'Speichern…' : 'Speichern'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                title={deleteTarget?.kind === 'category' ? 'Kategorie löschen?' : 'Prüfpunkt löschen?'}
                message={
                    <>
                        <p>
                            Soll <strong>&ldquo;{deleteTarget?.label}&rdquo;</strong> wirklich gelöscht werden?
                        </p>
                        {deleteTarget?.kind === 'category' && deleteTarget.itemCount > 0 && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                                Dabei werden auch {deleteTarget.itemCount} zugehörige Prüfpunkt(e) entfernt.
                            </p>
                        )}
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                            Bereits durchgeführte Prüfungen bleiben unverändert.
                        </p>
                    </>
                }
                confirmLabel="Löschen"
                destructive
                onConfirm={confirmDelete}
            />
        </AdminLayout>
    );
}
