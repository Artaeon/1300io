import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, X, Loader2 } from 'lucide-react';
import AdminLayout from './AdminLayout';

export default function ChecklistManagement() {
    const { authFetch } = useAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({});

    // Modal state
    const [modal, setModal] = useState(null); // { type: 'category'|'item', mode: 'create'|'edit', data?: {...} }
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchCategories = useCallback(async () => {
        try {
            const res = await authFetch('/api/checklist/categories');
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
                // Auto-expand all on first load
                if (Object.keys(expanded).length === 0) {
                    const exp = {};
                    data.forEach(c => { exp[c.id] = true; });
                    setExpanded(exp);
                }
            }
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, [authFetch, expanded]);

    useEffect(() => { fetchCategories(); }, [fetchCategories]);

    const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    // Category operations
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

    const deleteCategory = async (id) => {
        if (!confirm('Kategorie und alle Prüfpunkte löschen?')) return;
        const res = await authFetch(`/api/checklist/categories/${id}`, { method: 'DELETE' });
        if (res.ok) fetchCategories();
    };

    // Item operations
    const openCreateItem = (categoryId) => {
        const cat = categories.find(c => c.id === categoryId);
        setModal({ type: 'item', mode: 'create', data: { category_id: categoryId } });
        setForm({ text: '', sort_order: cat?.items?.length || 0 });
        setError('');
    };

    const openEditItem = (item) => {
        setModal({ type: 'item', mode: 'edit', data: item });
        setForm({ text: item.text, sort_order: item.sort_order });
        setError('');
    };

    const deleteItem = async (id) => {
        const res = await authFetch(`/api/checklist/items/${id}`, { method: 'DELETE' });
        if (res.ok) fetchCategories();
    };

    // Sort order
    const moveCategoryOrder = async (cat, direction) => {
        const newOrder = cat.sort_order + direction;
        if (newOrder < 0) return;
        await authFetch(`/api/checklist/categories/${cat.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order: newOrder })
        });
        fetchCategories();
    };

    const moveItemOrder = async (item, direction) => {
        const newOrder = item.sort_order + direction;
        if (newOrder < 0) return;
        await authFetch(`/api/checklist/items/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order: newOrder })
        });
        fetchCategories();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            let url, method, body;

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
            } else {
                if (modal.mode === 'create') {
                    url = '/api/checklist/items';
                    method = 'POST';
                    body = { ...form, category_id: modal.data.category_id };
                } else {
                    url = `/api/checklist/items/${modal.data.id}`;
                    method = 'PUT';
                    body = form;
                }
            }

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setModal(null);
                fetchCategories();
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

    return (
        <AdminLayout>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    Checkliste ({categories.length} Kategorien, {categories.reduce((sum, c) => sum + (c.items?.length || 0), 0)} Prüfpunkte)
                </h2>
                <button
                    onClick={openCreateCategory}
                    className="flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 font-medium text-sm active:scale-[0.98] transition-all"
                >
                    <Plus size={16} /> Kategorie
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-blue-600 dark:text-blue-400" />
                </div>
            ) : (
                <div className="space-y-3">
                    {categories.map(cat => (
                        <div key={cat.id} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                            {/* Category Header */}
                            <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                <button onClick={() => toggleExpand(cat.id)} className="text-gray-500 dark:text-gray-400 mr-2">
                                    {expanded[cat.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </button>
                                <span className="font-semibold text-gray-900 dark:text-gray-100 flex-1">{cat.name}</span>
                                <span className="text-xs text-gray-400 dark:text-gray-500 mr-3">{cat.items?.length || 0} Punkte</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => moveCategoryOrder(cat, -1)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1" title="Nach oben">
                                        <ArrowUp size={14} />
                                    </button>
                                    <button onClick={() => moveCategoryOrder(cat, 1)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1" title="Nach unten">
                                        <ArrowDown size={14} />
                                    </button>
                                    <button onClick={() => openEditCategory(cat)} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1">
                                        <Pencil size={14} />
                                    </button>
                                    <button onClick={() => deleteCategory(cat.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Items */}
                            {expanded[cat.id] && (
                                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {cat.items?.map(item => (
                                        <div key={item.id} className="flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{item.text}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => moveItemOrder(item, -1)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                                                    <ArrowUp size={12} />
                                                </button>
                                                <button onClick={() => moveItemOrder(item, 1)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                                                    <ArrowDown size={12} />
                                                </button>
                                                <button onClick={() => openEditItem(item)} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1">
                                                    <Pencil size={12} />
                                                </button>
                                                <button onClick={() => deleteItem(item.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 p-1">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => openCreateItem(cat.id)}
                                        className="w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 font-medium"
                                    >
                                        <Plus size={14} /> Prüfpunkt hinzufügen
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {modal.mode === 'create' ? 'Neu erstellen' : 'Bearbeiten'}
                            </h3>
                            <button onClick={() => setModal(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                                <X size={20} />
                            </button>
                        </div>

                        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm">{error}</div>}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    {modal.type === 'category' ? 'Kategoriename' : 'Prüfpunkt'}
                                </label>
                                {modal.type === 'category' ? (
                                    <input
                                        type="text" required
                                        className="w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                                        value={form.name || ''}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    />
                                ) : (
                                    <textarea
                                        required rows={3}
                                        className="w-full p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                                        value={form.text || ''}
                                        onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                                    />
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setModal(null)}
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
        </AdminLayout>
    );
}
