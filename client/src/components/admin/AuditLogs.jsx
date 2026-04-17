import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import AdminLayout from './AdminLayout';

const ACTION_COLORS = {
    CREATE: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
    UPDATE: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
    DELETE: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
};

const ENTITY_TYPES = ['', 'User', 'Organization', 'Property', 'Inspection', 'InspectionResult', 'ChecklistCategory', 'ChecklistItem'];
const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE'];

export default function AuditLogs() {
    const { authFetch } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [filterEntity, setFilterEntity] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [expanded, setExpanded] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (filterEntity) params.set('entityType', filterEntity);
        if (filterAction) params.set('action', filterAction);
        try {
            const res = await authFetch(`/api/audit-logs?${params}`);
            if (res.ok) {
                const body = await res.json();
                setLogs(body.data);
                setTotalPages(body.totalPages);
                setTotal(body.total);
            }
        } finally {
            setLoading(false);
        }
    }, [authFetch, page, filterEntity, filterAction]);

    useEffect(() => { load(); }, [load]);

    const fmtDate = (iso) => {
        const d = new Date(iso);
        return d.toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'medium' });
    };

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto px-4 py-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Prüfprotokoll</h2>
                    <span className="text-sm text-gray-500 dark:text-gray-500">{total} Einträge</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    <div>
                        <label htmlFor="filter-entity" className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Entität</label>
                        <select
                            id="filter-entity"
                            value={filterEntity}
                            onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}
                            className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                        >
                            {ENTITY_TYPES.map((t) => <option key={t || 'all'} value={t}>{t || 'Alle'}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="filter-action" className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Aktion</label>
                        <select
                            id="filter-action"
                            value={filterAction}
                            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                            className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                        >
                            {ACTIONS.map((a) => <option key={a || 'all'} value={a}>{a || 'Alle'}</option>)}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="animate-spin text-gray-400" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-500">
                        Keine Einträge gefunden.
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                        {logs.map((log) => (
                            <div key={log.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                                <button
                                    type="button"
                                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${ACTION_COLORS[log.action] ?? 'bg-gray-100'}`}>
                                            {log.action}
                                        </span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {log.entityType} #{log.entityId}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-500 ml-auto">
                                            {fmtDate(log.timestamp)}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                        Benutzer: {log.userId ?? '—'} · IP: {log.ipAddress ?? '—'}
                                    </div>
                                </button>
                                {expanded === log.id && (
                                    <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-800/30 space-y-2">
                                        {log.previousData && (
                                            <details className="text-xs" open>
                                                <summary className="cursor-pointer text-gray-600 dark:text-gray-400">Vorheriger Zustand</summary>
                                                <pre className="mt-1 p-2 bg-white dark:bg-gray-900 rounded overflow-auto text-gray-800 dark:text-gray-300">{JSON.stringify(log.previousData, null, 2)}</pre>
                                            </details>
                                        )}
                                        {log.newData && (
                                            <details className="text-xs" open>
                                                <summary className="cursor-pointer text-gray-600 dark:text-gray-400">Neuer Zustand</summary>
                                                <pre className="mt-1 p-2 bg-white dark:bg-gray-900 rounded overflow-auto text-gray-800 dark:text-gray-300">{JSON.stringify(log.newData, null, 2)}</pre>
                                            </details>
                                        )}
                                        <div className="text-xs text-gray-500 dark:text-gray-500">
                                            User-Agent: {log.userAgent ?? '—'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            Seite {page} / {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
