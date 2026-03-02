import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Building, MapPin, AlertTriangle, CheckCircle2, Clock, Loader2, FileText, Download } from 'lucide-react';

export default function PropertyDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { authFetch } = useAuth();

    const [property, setProperty] = useState(null);
    const [defects, setDefects] = useState([]);
    const [inspections, setInspections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [propRes, defectsRes, historyRes] = await Promise.all([
                    authFetch(`/api/properties/${id}`),
                    authFetch(`/api/properties/${id}/defects`),
                    authFetch(`/api/inspections/history?limit=50`)
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
            alert('PDF Download fehlgeschlagen.');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Lade Objektdaten...</p>
            </div>
        );
    }

    if (!property) return null;

    const openDefects = defects.filter(d => d.status === 'OPEN');
    const resolvedDefects = defects.filter(d => d.status === 'RESOLVED');

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900 truncate">{property.address}</h1>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

                {/* Property Info */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Building size={20} className="text-gray-500" />
                        <h2 className="text-lg font-bold text-gray-900">Objektdaten</h2>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <MapPin size={14} />
                            <span>{property.address}</span>
                        </div>
                        <p>Eigentümer: {property.owner_name}</p>
                        <p>Einheiten: {property.units_count}</p>
                    </div>
                    <Link
                        to={`/inspection/new/${property.id}`}
                        className="mt-4 block w-full bg-blue-600 text-white text-center font-bold py-3 rounded-lg hover:bg-blue-700 transition"
                    >
                        Neue Prüfung starten
                    </Link>
                </div>

                {/* Defect Summary */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle size={20} className="text-red-500" />
                        <h2 className="text-lg font-bold text-gray-900">Mängel</h2>
                        {openDefects.length > 0 && (
                            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {openDefects.length} offen
                            </span>
                        )}
                    </div>

                    {defects.length === 0 ? (
                        <p className="text-gray-500 text-sm">Keine Mängel dokumentiert.</p>
                    ) : (
                        <div className="space-y-3">
                            {/* Open Defects */}
                            {openDefects.map(defect => (
                                <div key={defect.id} className="border-l-4 border-red-500 bg-red-50 rounded-r-lg p-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">{defect.checklist_item?.text}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {defect.checklist_item?.category?.name}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                            OFFEN
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
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
                                <div key={defect.id} className="border-l-4 border-green-500 bg-green-50 rounded-r-lg p-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">{defect.checklist_item?.text}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {defect.checklist_item?.category?.name}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                            BEHOBEN
                                        </span>
                                    </div>
                                    <div className="space-y-1 mt-2 text-xs text-gray-500">
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
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText size={20} className="text-gray-500" />
                        <h2 className="text-lg font-bold text-gray-900">Prüfhistorie</h2>
                    </div>

                    {inspections.length === 0 ? (
                        <p className="text-gray-500 text-sm">Noch keine abgeschlossenen Prüfungen.</p>
                    ) : (
                        <div className="space-y-2">
                            {inspections.map(insp => (
                                <div key={insp.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {insp.ended_at
                                                ? new Date(insp.ended_at).toLocaleDateString('de-AT')
                                                : new Date(insp.date).toLocaleDateString('de-AT')
                                            }
                                        </p>
                                        <p className="text-xs text-gray-500">{insp.inspector_name}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDownloadPDF(insp.id)}
                                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
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
