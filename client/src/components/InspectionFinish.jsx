import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle, FileText, Home, Download, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function InspectionFinish() {
    const { id } = useParams();
    const { authFetch } = useAuth();
    const [isCompleting, setIsCompleting] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [inspection, setInspection] = useState(null);
    const [error, setError] = useState(null);

    // Complete the inspection on mount
    useEffect(() => {
        const completeInspection = async () => {
            try {
                const response = await authFetch(`/api/inspections/${id}/complete`, {
                    method: 'POST'
                });

                if (!response.ok) throw new Error('Failed to complete inspection');

                const data = await response.json();
                setInspection(data);
            } catch (err) {
                console.error('Complete inspection failed:', err);
                setError('Prüfung konnte nicht abgeschlossen werden.');
            } finally {
                setIsCompleting(false);
            }
        };

        completeInspection();
    }, [id, authFetch]);

    const handleDownloadPDF = useCallback(async () => {
        setIsDownloading(true);
        try {
            const response = await authFetch(`/api/inspections/${id}/pdf`);

            if (!response.ok) throw new Error('PDF generation failed');

            // Get the blob with explicit type
            const blob = await response.blob();
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });

            // Create download link with explicit filename
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Begehung_Protokoll_${id}.pdf`;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();

            // Cleanup
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(link);
            }, 100);

        } catch (err) {
            console.error('PDF download failed:', err);
            alert('PDF konnte nicht heruntergeladen werden. Bitte versuchen Sie es erneut.');
        } finally {
            setIsDownloading(false);
        }
    }, [id, authFetch]);

    if (isCompleting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
                <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Prüfung wird abgeschlossen...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
                <Link to="/" className="text-blue-600 font-medium">Zurück zum Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-gradient-to-b from-green-50 to-white">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-green-100">
                {/* Success Animation */}
                <div className="flex justify-center mb-6">
                    <div className="bg-green-100 p-4 rounded-full">
                        <CheckCircle size={64} className="text-green-500" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">Fertig!</h1>
                <p className="text-gray-600 mb-2">
                    Die Prüfung wurde erfolgreich abgeschlossen und gespeichert.
                </p>

                {inspection?.property && (
                    <p className="text-sm text-gray-500 mb-2">
                        {inspection.property.address}
                    </p>
                )}

                <p className="text-xs text-gray-400 mb-8">
                    Prüfung #{id} • {new Date().toLocaleDateString('de-AT')}
                </p>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className={`w-full font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg ${isDownloading
                                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {isDownloading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Wird generiert...
                            </>
                        ) : (
                            <>
                                <Download size={20} />
                                Bericht herunterladen (.pdf)
                            </>
                        )}
                    </button>

                    <Link
                        to="/"
                        className="block w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <Home size={20} />
                            Zurück zum Dashboard
                        </span>
                    </Link>
                </div>

                {/* Info Note */}
                <p className="text-xs text-gray-400 mt-6">
                    Der Bericht enthält alle Prüfergebnisse, dokumentierte Mängel mit Fotos und ist jederzeit vom Dashboard abrufbar.
                </p>
            </div>
        </div>
    );
}
