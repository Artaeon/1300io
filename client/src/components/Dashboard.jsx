import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Building, MapPin, Plus, LogOut, FileText, Clock, CheckCircle2, AlertCircle, Download, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LegalFooter from './LegalFooter';

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
            <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-3 py-1.5 rounded-full text-sm font-medium">
                <AlertCircle size={14} />
                <span>Prüfung fällig!</span>
            </div>
        );
    }

    const isValid = isInspectionValid(lastInspection.ended_at);
    const dateStr = new Date(lastInspection.ended_at).toLocaleDateString('de-AT');

    if (isValid) {
        return (
            <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-3 py-1.5 rounded-full text-sm font-medium">
                <CheckCircle2 size={14} />
                <span>Geprüft: {dateStr}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full text-sm font-medium">
            <AlertCircle size={14} />
            <span>Abgelaufen ({dateStr})</span>
        </div>
    );
};

export default function Dashboard() {
    const [properties, setProperties] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const { logout, authFetch } = useAuth();

    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const handleDeleteProperty = useCallback(async (propertyId) => {
        setDeleting(true);
        try {
            const res = await authFetch(`/api/properties/${propertyId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setProperties(prev => prev.filter(p => p.id !== propertyId));
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
    }, [authFetch]);

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
            alert('PDF Download fehlgeschlagen.');
        }
    }, [authFetch]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch properties
                const propsRes = await authFetch('/api/properties');
                if (propsRes.status === 401) { logout(); return; }
                const propsData = await propsRes.json();
                setProperties(propsData);

                // Fetch history
                const histRes = await authFetch('/api/inspections/history');
                if (histRes.ok) {
                    const histData = await histRes.json();
                    setHistory(histData);
                }
            } catch (err) {
                console.error("Failed to fetch data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [authFetch, logout]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-900">PropSecure</h1>
                    <button onClick={logout} className="text-gray-500 hover:text-red-500 p-2">
                        <LogOut size={22} />
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

                {/* SECTION 1: Recent Inspections History */}
                {history.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <Clock size={20} className="text-gray-500" />
                            <h2 className="text-lg font-bold text-gray-900">Aktuelle Prüfungen</h2>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Datum</th>
                                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Objekt</th>
                                            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Prüfer</th>
                                            <th className="text-center px-4 py-3 font-semibold text-gray-600">PDF</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {history.slice(0, 5).map(insp => (
                                            <tr key={insp.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {insp.ended_at
                                                        ? new Date(insp.ended_at).toLocaleDateString('de-AT')
                                                        : '—'
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-medium text-gray-900">{insp.property?.address || 'Unbekannt'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                                                    {insp.inspector_name}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleDownloadPDF(insp.id)}
                                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
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
                        <Building size={20} className="text-gray-500" />
                        <h2 className="text-lg font-bold text-gray-900">Meine Objekte</h2>
                        <span className="text-sm text-gray-500">({properties.length})</span>
                    </div>

                    <div className="space-y-4">
                        {properties.map(prop => (
                            <div key={prop.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                                <div className="p-5">
                                    {/* Status Badge & Actions */}
                                    <div className="flex justify-between items-start mb-3">
                                        <InspectionStatusBadge lastInspection={prop.lastInspection} />
                                        <div className="flex items-center gap-1">
                                            {prop.lastInspection && (
                                                <button
                                                    onClick={() => handleDownloadPDF(prop.lastInspection.id)}
                                                    className="text-gray-400 hover:text-blue-600 p-1"
                                                    title="Letzten Bericht herunterladen"
                                                >
                                                    <FileText size={18} />
                                                </button>
                                            )}
                                            <Link
                                                to={`/properties/${prop.id}/edit`}
                                                className="text-gray-400 hover:text-blue-600 p-1"
                                                title="Bearbeiten"
                                            >
                                                <Pencil size={18} />
                                            </Link>
                                            <button
                                                onClick={() => setDeleteConfirm(prop.id)}
                                                className="text-gray-400 hover:text-red-600 p-1"
                                                title="Löschen"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Property Info */}
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{prop.address}</h3>
                                    <div className="flex items-center text-gray-500 text-sm mb-4">
                                        <MapPin size={14} className="mr-1" />
                                        <span>{prop.units_count} Einheiten • {prop.owner_name}</span>
                                    </div>

                                    {/* Action Button */}
                                    <Link
                                        to={`/inspection/new/${prop.id}`}
                                        className="block w-full bg-blue-600 active:bg-blue-700 text-white text-center font-bold py-3 rounded-lg shadow hover:shadow-lg transition-all"
                                    >
                                        Neue Prüfung starten
                                    </Link>
                                </div>
                            </div>
                        ))}

                        {properties.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <Building size={48} className="mx-auto mb-4 opacity-30" />
                                <p>Noch keine Objekte vorhanden.</p>
                                <Link to="/properties/new" className="text-blue-600 font-medium mt-2 inline-block">
                                    + Erstes Objekt hinzufügen
                                </Link>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Delete Confirmation Dialog */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Objekt löschen?</h3>
                        <p className="text-gray-600 mb-6">
                            Diese Aktion löscht das Objekt und alle zugehörigen Prüfungen unwiderruflich.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={() => handleDeleteProperty(deleteConfirm)}
                                disabled={deleting}
                                className="flex-1 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:bg-gray-400"
                            >
                                {deleting ? 'Löschen...' : 'Löschen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FAB - Add Property */}
            <Link
                to="/properties/new"
                className="fixed bottom-20 right-6 bg-gray-900 text-white p-4 rounded-full shadow-2xl flex items-center justify-center hover:bg-gray-800 transition-transform active:scale-95"
            >
                <Plus size={28} />
            </Link>

            {/* Legal Footer */}
            <LegalFooter />
        </div>
    );
}
