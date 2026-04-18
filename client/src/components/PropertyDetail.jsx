import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import Breadcrumbs from './ui/Breadcrumbs';
import { ArrowLeft, Building, MapPin, AlertTriangle, CheckCircle2, Clock, Loader2, FileText, Download, QrCode } from 'lucide-react';

export default function PropertyDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { authFetch } = useAuth();
    const { toast } = useToast();

    const [property, setProperty] = useState(null);
    const [defects, setDefects] = useState([]);
    const [inspections, setInspections] = useState([]);
    const [qrData, setQrData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [propRes, defectsRes, historyRes, qrRes] = await Promise.all([
                    authFetch(`/api/properties/${id}`),
                    authFetch(`/api/properties/${id}/defects`),
                    authFetch(`/api/inspections/history?limit=50`),
                    authFetch(`/api/properties/${id}/qr`)
                ]);

                if (!propRes.ok) {
                    navigate('/');
                    return;
                }

                const propData = await propRes.json();
                setProperty(propData);

                if (defectsRes.ok) {
                    setDefects(await defectsRes.json());
                }

                if (historyRes.ok) {
                    const histData = await historyRes.json();
                    setInspections(histData.data.filter(i => i.property?.id === parseInt(id)));
                }

                if (qrRes.ok) {
                    setQrData(await qrRes.json());
                }
            } catch {
                navigate('/');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, authFetch, navigate]);

    const handleDownloadPDF = async (inspectionId) => {
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
        } catch {
            toast.error('PDF-Download fehlgeschlagen. Bitte erneut versuchen.', {
                action: { label: 'Erneut', onClick: () => handleDownloadPDF(inspectionId) },
            });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100/50 dark:bg-gray-950">
                <Loader2 size={48} className="animate-spin text-blue-600 dark:text-blue-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Lade Objektdaten...</p>
            </div>
        );
    }

    if (!property) return null;

    const openDefects = defects.filter(d => d.status === 'OPEN');
    const resolvedDefects = defects.filter(d => d.status === 'RESOLVED');

    return (
        <div className="min-h-screen bg-gray-100/50 dark:bg-gray-950 pb-20">
            {/* Header */}
            <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        aria-label="Zurück zum Dashboard"
                        className="min-w-11 min-h-11 -ml-2 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{property.address}</h1>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                <Breadcrumbs
                    items={[
                        { label: 'Dashboard', to: '/' },
                        { label: property.address },
                    ]}
                />

                {/* Property Info */}
                <div className="hover-lift bg-white dark:bg-gray-900 rounded-2xl shadow-sm hover:shadow-lg p-5 ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                    <div className="flex items-center gap-2 mb-3">
                        <Building size={20} className="text-gray-400 dark:text-gray-500 animate-breathe" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Objektdaten</h2>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                            <MapPin size={14} />
                            <span>{property.address}</span>
                        </div>
                        <p>Eigentümer: {property.owner_name}</p>
                        <p>Einheiten: {property.units_count}</p>
                    </div>
                    <Link
                        to={`/inspection/new/${property.id}`}
                        className="btn-apple mt-4 block w-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-600 text-white text-center font-bold py-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        Neue Prüfung starten
                    </Link>
                </div>

                {/* QR Code */}
                {qrData && (
                    <div className="hover-lift bg-white dark:bg-gray-900 rounded-2xl shadow-sm hover:shadow-lg p-5 ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                        <div className="flex items-center gap-2 mb-3">
                            <QrCode size={20} className="text-gray-400 dark:text-gray-500 animate-breathe" />
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">QR-Code</h2>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            Scannen Sie den Code, um direkt eine Prüfung zu starten.
                        </p>
                        <div className="flex justify-center">
                            <img src={qrData.qr} alt="QR Code" className="w-48 h-48 rounded-xl" />
                        </div>
                    </div>
                )}

                {/* Defect Summary */}
                <div className="hover-lift bg-white dark:bg-gray-900 rounded-2xl shadow-sm hover:shadow-lg p-5 ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle size={20} className="text-red-500 dark:text-red-400 animate-breathe" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Mängel</h2>
                        {openDefects.length > 0 && (
                            <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                {openDefects.length} offen
                            </span>
                        )}
                    </div>

                    {defects.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Keine Mängel dokumentiert.</p>
                    ) : (
                        <div className="space-y-3">
                            {/* Open Defects */}
                            {openDefects.map(defect => (
                                <div key={defect.id} className="border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 rounded-r-xl p-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{defect.checklist_item?.text}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {defect.checklist_item?.category?.name}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full whitespace-nowrap">
                                            OFFEN
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        <Clock size={12} />
                                        <span>
                                            Festgestellt: {new Date(defect.first_found_result?.inspection?.date).toLocaleDateString('de-AT')}
                                            {' '}von {defect.first_found_result?.inspection?.inspector_name}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {/* Resolved Defects */}
                            {resolvedDefects.map(defect => (
                                <div key={defect.id} className="border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 rounded-r-xl p-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{defect.checklist_item?.text}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {defect.checklist_item?.category?.name}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full whitespace-nowrap">
                                            BEHOBEN
                                        </span>
                                    </div>
                                    <div className="space-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        <div className="flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            <span>
                                                Festgestellt: {new Date(defect.first_found_result?.inspection?.date).toLocaleDateString('de-AT')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <CheckCircle2 size={12} />
                                            <span>
                                                Behoben: {new Date(defect.resolved_result?.inspection?.date).toLocaleDateString('de-AT')}
                                                {' '}von {defect.resolved_result?.inspection?.inspector_name}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Inspection History */}
                <div className="hover-lift bg-white dark:bg-gray-900 rounded-2xl shadow-sm hover:shadow-lg p-5 ring-1 ring-gray-200/60 dark:ring-gray-800/60">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText size={20} className="text-gray-400 dark:text-gray-500 animate-breathe" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Prüfhistorie</h2>
                    </div>

                    {inspections.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Noch keine abgeschlossenen Prüfungen.</p>
                    ) : (
                        <div className="space-y-2">
                            {inspections.map(insp => (
                                <div key={insp.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {insp.ended_at
                                                ? new Date(insp.ended_at).toLocaleDateString('de-AT')
                                                : new Date(insp.date).toLocaleDateString('de-AT')
                                            }
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{insp.inspector_name}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDownloadPDF(insp.id)}
                                        className="link-underline flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                                    >
                                        <Download size={16} />
                                        PDF
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
