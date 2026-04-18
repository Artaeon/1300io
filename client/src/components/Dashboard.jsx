import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Building, MapPin, Plus, LogOut, FileText, Clock, CheckCircle2, AlertCircle, Download, Pencil, Trash2, Settings, Search, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../hooks/useToast';
import ConfirmDialog from './ui/ConfirmDialog';
import { SkeletonPropertyCard } from './ui/Skeleton';
import WelcomeCard from './WelcomeCard';
import LegalFooter from './LegalFooter';
import Logo from './Logo';

// Helper: Check if inspection is within 1 year
const isInspectionValid = (endedAt) => {
    if (!endedAt) return false;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return new Date(endedAt) > oneYearAgo;
};

// Status Badge Component
const InspectionStatusBadge = ({ lastInspection }) => {
    if (!lastInspection || !lastInspection.ended_at) {
        return (
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded-full text-sm font-medium">
                <AlertCircle size={14} />
                <span>Prüfung fällig!</span>
            </div>
        );
    }

    const isValid = isInspectionValid(lastInspection.ended_at);
    const dateStr = new Date(lastInspection.ended_at).toLocaleDateString('de-AT');

    if (isValid) {
        return (
            <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-full text-sm font-medium">
                <CheckCircle2 size={14} />
                <span>Geprüft: {dateStr}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-3 py-1.5 rounded-full text-sm font-medium">
            <AlertCircle size={14} />
            <span>Abgelaufen ({dateStr})</span>
        </div>
    );
};

export default function Dashboard() {
    const [properties, setProperties] = useState([]);
    const [totalProperties, setTotalProperties] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState(''); // '' | 'due' | 'expired' | 'valid'
    const [sort, setSort] = useState('createdAt'); // createdAt | address | owner_name
    const [sortDir, setSortDir] = useState('desc'); // asc | desc
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user, logout, authFetch } = useAuth();
    const { dark, toggleTheme } = useTheme();
    const { toast } = useToast();
    const searchTimer = useRef(null);

    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const handleDeleteProperty = useCallback(async (propertyId) => {
        try {
            const res = await authFetch(`/api/properties/${propertyId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setProperties(prev => prev.filter(p => p.id !== propertyId));
                setTotalProperties(prev => prev - 1);
                toast.success('Objekt gelöscht');
            } else if (res.status === 409) {
                toast.error('Objekt kann nicht gelöscht werden: offene Prüfung vorhanden');
                throw new Error('conflict');
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || 'Löschen fehlgeschlagen');
                throw new Error('delete-failed');
            }
        } catch (err) {
            if (err?.message !== 'conflict' && err?.message !== 'delete-failed') {
                toast.error('Verbindungsfehler. Bitte erneut versuchen.');
            }
            throw err; // keep ConfirmDialog open so user sees what happened
        }
    }, [authFetch, toast]);

    // PDF Download helper
    const handleDownloadPDF = useCallback(async (inspectionId) => {
        try {
            const response = await authFetch(`/api/inspections/${inspectionId}/pdf`);
            if (!response.ok) throw new Error('PDF generation failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `Begehung_Protokoll_${inspectionId}.pdf`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('PDF download failed:', err);
            toast.error('PDF-Download fehlgeschlagen. Bitte erneut versuchen.', {
                action: { label: 'Erneut', onClick: () => handleDownloadPDF(inspectionId) },
            });
        }
    }, [authFetch, toast]);

    const fetchProperties = useCallback(async (currentPage, searchTerm, status, sortBy, dir) => {
        try {
            const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
            if (searchTerm) params.set('search', searchTerm);
            if (status) params.set('status', status);
            if (sortBy) params.set('sort', sortBy);
            if (dir) params.set('dir', dir);
            const propsRes = await authFetch(`/api/properties?${params}`);
            if (propsRes.status === 401) { logout(); return; }
            const result = await propsRes.json();
            setProperties(result.data);
            setTotalProperties(result.total);
            setTotalPages(result.totalPages);
        } catch (err) {
            console.error("Failed to fetch properties", err);
        }
    }, [authFetch, logout]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                await fetchProperties(1, '', '', 'createdAt', 'desc');

                // Fetch history
                const histRes = await authFetch('/api/inspections/history?limit=5');
                if (histRes.ok) {
                    const histData = await histRes.json();
                    setHistory(histData.data);
                }
            } catch (err) {
                console.error("Failed to fetch data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [authFetch, fetchProperties]);

    // Refetch when status/sort changes (search has its own debounced handler)
    useEffect(() => {
        if (loading) return;
        fetchProperties(1, search, statusFilter, sort, sortDir);
        setPage(1);
    }, [statusFilter, sort, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

    // Debounced search
    const handleSearchChange = (value) => {
        setSearch(value);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setPage(1);
            fetchProperties(1, value, statusFilter, sort, sortDir);
        }, 400);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchProperties(newPage, search, statusFilter, sort, sortDir);
        window.scrollTo(0, 0);
    };

    // No full-screen spinner — the Dashboard shell renders immediately
    // and the list area below shows skeleton cards while properties load.
    // User perceives the app as responsive instead of blank-then-snap.

    return (
        <div className="min-h-screen bg-gray-100/50 dark:bg-gray-950 pb-24">
            {/* Header */}
            <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
                    <Logo size={32} className="text-gray-900 dark:text-gray-100" />
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label={dark ? 'Hellmodus aktivieren' : 'Dunkelmodus aktivieren'}
                            title={dark ? 'Hellmodus' : 'Dunkelmodus'}
                            className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            {dark ? <Sun size={22} /> : <Moon size={22} />}
                        </button>
                        {user?.role === 'ADMIN' && (
                            <Link
                                to="/admin/users"
                                aria-label="Verwaltung öffnen"
                                title="Verwaltung"
                                className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                <Settings size={22} />
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={logout}
                            aria-label="Abmelden"
                            title="Abmelden"
                            className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                            <LogOut size={22} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

                {/* Welcome / onboarding — dismissable, persisted */}
                <WelcomeCard userName={user?.name} />

                {/* SECTION 1: Recent Inspections History */}
                {history.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <Clock size={20} className="text-gray-400 dark:text-gray-500 animate-breathe" />
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Aktuelle Prüfungen</h2>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Datum</th>
                                            <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Objekt</th>
                                            <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 hidden sm:table-cell">Prüfer</th>
                                            <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">PDF</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {history.map(insp => (
                                            <tr key={insp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                                                    {insp.ended_at
                                                        ? new Date(insp.ended_at).toLocaleDateString('de-AT')
                                                        : '—'
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">{insp.property?.address || 'Unbekannt'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                                                    {insp.inspector_name}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleDownloadPDF(insp.id)}
                                                        className="link-underline inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                                                    >
                                                        <Download size={16} />
                                                        <span className="hidden sm:inline">PDF</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}

                {/* SECTION 2: Properties List */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Building size={20} className="text-gray-400 dark:text-gray-500 animate-breathe" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Meine Objekte</h2>
                        <span className="text-sm text-gray-500 dark:text-gray-400">({totalProperties})</span>
                    </div>

                    {/* Search + Sort */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <label htmlFor="property-search" className="sr-only">Objekte suchen</label>
                            <input
                                id="property-search"
                                type="search"
                                placeholder="Objekte suchen..."
                                className="input-apple w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                            />
                        </div>
                        <label htmlFor="property-sort" className="sr-only">Sortierung</label>
                        <select
                            id="property-sort"
                            value={`${sort}:${sortDir}`}
                            onChange={(e) => {
                                const [k, d] = e.target.value.split(':');
                                setSort(k);
                                setSortDir(d);
                            }}
                            className="input-apple py-2.5 px-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 text-sm outline-none"
                        >
                            <option value="createdAt:desc">Neueste zuerst</option>
                            <option value="createdAt:asc">Älteste zuerst</option>
                            <option value="address:asc">Adresse A–Z</option>
                            <option value="address:desc">Adresse Z–A</option>
                            <option value="owner_name:asc">Eigentümer A–Z</option>
                            <option value="units_count:desc">Einheiten ↓</option>
                            <option value="units_count:asc">Einheiten ↑</option>
                        </select>
                    </div>

                    {/* Status filter chips */}
                    <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Status-Filter">
                        {[
                            { key: '', label: 'Alle' },
                            { key: 'due', label: 'Prüfung fällig' },
                            { key: 'expired', label: 'Abgelaufen' },
                            { key: 'valid', label: 'Geprüft' },
                        ].map((opt) => {
                            const active = statusFilter === opt.key;
                            return (
                                <button
                                    key={opt.key || 'all'}
                                    type="button"
                                    onClick={() => setStatusFilter(opt.key)}
                                    aria-pressed={active}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                        active
                                            ? 'bg-blue-600 dark:bg-blue-500 text-white'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <>
                                <SkeletonPropertyCard />
                                <SkeletonPropertyCard />
                                <SkeletonPropertyCard />
                            </>
                        ) : properties.map(prop => (
                            <div key={prop.id} className="hover-lift bg-white dark:bg-gray-900 rounded-2xl shadow-sm hover:shadow-lg overflow-hidden ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                                <div className="p-5">
                                    {/* Status Badge & Actions */}
                                    <div className="flex justify-between items-start mb-3">
                                        <InspectionStatusBadge lastInspection={prop.lastInspection} />
                                        <div className="flex items-center gap-1">
                                            {prop.lastInspection && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadPDF(prop.lastInspection.id)}
                                                    aria-label="Letzten Bericht herunterladen"
                                                    title="Letzten Bericht herunterladen"
                                                    className="min-w-11 min-h-11 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                >
                                                    <FileText size={18} />
                                                </button>
                                            )}
                                            <Link
                                                to={`/properties/${prop.id}/edit`}
                                                aria-label="Objekt bearbeiten"
                                                title="Bearbeiten"
                                                className="min-w-11 min-h-11 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                            >
                                                <Pencil size={18} />
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => setDeleteConfirm(prop.id)}
                                                aria-label="Objekt löschen"
                                                title="Löschen"
                                                className="min-w-11 min-h-11 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Property Info */}
                                    <Link to={`/properties/${prop.id}`} className="block">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{prop.address}</h3>
                                    </Link>
                                    <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-4">
                                        <MapPin size={14} className="mr-1" />
                                        <span>{prop.units_count} Einheiten • {prop.owner_name}</span>
                                    </div>

                                    {/* Action Button */}
                                    <Link
                                        to={`/inspection/new/${prop.id}`}
                                        className="btn-apple block w-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white text-center font-bold py-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                        Neue Prüfung starten
                                    </Link>
                                </div>
                            </div>
                        ))}

                        {!loading && properties.length === 0 && (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                <Building size={48} className="mx-auto mb-4 opacity-30" />
                                {search ? (
                                    <>
                                        <p>Keine Objekte gefunden für &ldquo;{search}&rdquo;.</p>
                                        <button
                                            type="button"
                                            onClick={() => handleSearchChange('')}
                                            className="link-underline text-blue-600 dark:text-blue-400 font-medium mt-2"
                                        >
                                            Suche zurücksetzen
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p className="mb-1">Willkommen!</p>
                                        <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                                            Noch keine Objekte vorhanden. Legen Sie Ihr erstes Objekt an, um eine Prüfung zu starten.
                                        </p>
                                        <Link
                                            to="/properties/new"
                                            className="link-underline inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium"
                                        >
                                            <Plus size={16} /> Erstes Objekt anlegen
                                        </Link>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-6">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page <= 1}
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                Seite {page} von {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page >= totalPages}
                                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}
                </section>
            </div>

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={deleteConfirm !== null}
                onClose={() => setDeleteConfirm(null)}
                title="Objekt löschen?"
                message={
                    <>
                        <p>
                            Sind Sie sicher, dass Sie <strong>{properties.find(p => p.id === deleteConfirm)?.address ?? 'dieses Objekt'}</strong> löschen möchten?
                        </p>
                        <p className="mt-2 text-gray-500 dark:text-gray-500 text-xs">
                            Das Objekt und alle zugehörigen abgeschlossenen Prüfungen werden unwiderruflich entfernt. Offene (Entwurfs-) Prüfungen blockieren das Löschen.
                        </p>
                    </>
                }
                confirmLabel="Löschen"
                destructive
                onConfirm={() => handleDeleteProperty(deleteConfirm)}
            />

            {/* FAB - Add Property */}
            <Link
                to="/properties/new"
                aria-label="Neues Objekt hinzufügen"
                title="Neues Objekt"
                className="btn-apple fixed right-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-4 rounded-full shadow-2xl flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/50"
                style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
            >
                <Plus size={28} />
            </Link>

            {/* Legal Footer */}
            <LegalFooter />
        </div>
    );
}
