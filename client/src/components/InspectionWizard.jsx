import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Camera, Check, AlertTriangle, XCircle, ArrowRight, Loader2, RotateCcw } from 'lucide-react';

// Toast Component
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top duration-300 ${type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
            }`}>
            {type === 'error' ? <AlertTriangle size={20} /> : <Check size={20} />}
            <span className="font-medium">{message}</span>
        </div>
    );
};

export default function InspectionWizard() {
    const { propertyId } = useParams();
    const navigate = useNavigate();

    const { token, user } = useAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [inspectionId, setInspectionId] = useState(null);

    // Draft resume state
    const [existingDraft, setExistingDraft] = useState(null);
    const [showResumeDialog, setShowResumeDialog] = useState(false);

    // Loading & Error States
    const [uploadingItems, setUploadingItems] = useState({});
    const [savingStatus, setSavingStatus] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState(null);

    // Debounce timers for comment auto-save
    const commentTimers = useRef({});

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
    }, []);

    // Save a single result to the server
    const saveResult = useCallback(async (inspId, itemId, answer) => {
        if (!inspId || !answer.status) return;
        try {
            await fetch(`/api/inspections/${inspId}/results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    checklistItemId: parseInt(itemId),
                    status: answer.status,
                    comment: answer.comment || '',
                    photoUrl: answer.photoUrl || ''
                })
            });
        } catch {
            showToast('Speichern fehlgeschlagen', 'error');
        }
    }, [token, showToast]);

    // Resume a draft — load existing results into answers state
    const resumeDraft = useCallback(async (draftId) => {
        setInspectionId(draftId);
        setShowResumeDialog(false);
        try {
            const res = await fetch(`/api/inspections/${draftId}/results`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load results');
            const results = await res.json();
            const restored = {};
            results.forEach(r => {
                restored[r.checklist_item_id] = {
                    status: r.status,
                    comment: r.comment || '',
                    photoUrl: r.photo_url || ''
                };
            });
            setAnswers(restored);
            showToast('Entwurf wiederhergestellt');
        } catch {
            showToast('Entwurf konnte nicht geladen werden', 'error');
        }
    }, [token, showToast]);

    // Create a new inspection
    const createNewInspection = useCallback(async () => {
        setShowResumeDialog(false);
        try {
            const res = await fetch('/api/inspections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    propertyId,
                    inspectorName: user?.name || 'Inspector'
                })
            });
            if (!res.ok) throw new Error('Inspection creation failed');
            const data = await res.json();
            setInspectionId(data.id);
        } catch {
            showToast('Prüfung konnte nicht erstellt werden!', 'error');
        }
    }, [token, propertyId, user?.name, showToast]);

    // Initialize — check for draft, load checklist
    useEffect(() => {
        if (!token) return;

        const init = async () => {
            try {
                // Fetch checklist
                const catRes = await fetch('/api/checklist/categories', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!catRes.ok) throw new Error('Failed to load checklist');
                const catData = await catRes.json();
                setCategories(catData);

                // Check for existing draft
                const draftRes = await fetch(`/api/properties/${propertyId}/draft-inspection`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const draft = await draftRes.json();

                if (draft) {
                    setExistingDraft(draft);
                    setShowResumeDialog(true);
                } else {
                    await createNewInspection();
                }
            } catch {
                showToast('Initialisierung fehlgeschlagen!', 'error');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [propertyId, token, showToast, createNewInspection]);

    // Auto-save on status change
    const handleStatusChange = useCallback((itemId, status) => {
        setAnswers(prev => {
            const updated = {
                ...prev,
                [itemId]: { ...prev[itemId], status, comment: prev[itemId]?.comment || '', photoUrl: prev[itemId]?.photoUrl || '' }
            };
            // Auto-save immediately
            if (inspectionId) {
                saveResult(inspectionId, itemId, updated[itemId]);
            }
            return updated;
        });

        // Visual feedback
        setSavingStatus(prev => ({ ...prev, [itemId]: true }));
        setTimeout(() => {
            setSavingStatus(prev => ({ ...prev, [itemId]: false }));
        }, 300);
    }, [inspectionId, saveResult]);

    // Update defect details (comment, photoUrl)
    const handleDefectUpdate = useCallback((itemId, field, value) => {
        setAnswers(prev => {
            const updated = {
                ...prev,
                [itemId]: { ...prev[itemId], [field]: value }
            };

            // Debounce comment auto-save (1s)
            if (field === 'comment' && inspectionId && updated[itemId]?.status) {
                if (commentTimers.current[itemId]) {
                    clearTimeout(commentTimers.current[itemId]);
                }
                commentTimers.current[itemId] = setTimeout(() => {
                    saveResult(inspectionId, itemId, updated[itemId]);
                }, 1000);
            }

            return updated;
        });
    }, [inspectionId, saveResult]);

    const handleFileUpload = async (itemId, file) => {
        if (!file) return;

        setUploadingItems(prev => ({ ...prev, [itemId]: true }));

        const formData = new FormData();
        formData.append('photo', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) throw new Error('Upload failed');

            const data = await res.json();
            setAnswers(prev => {
                const updated = {
                    ...prev,
                    [itemId]: { ...prev[itemId], photoUrl: data.url }
                };
                // Auto-save after photo upload
                if (inspectionId && updated[itemId]?.status) {
                    saveResult(inspectionId, itemId, updated[itemId]);
                }
                return updated;
            });
            showToast('Foto erfolgreich hochgeladen!');
        } catch {
            showToast('Upload fehlgeschlagen! Bitte erneut versuchen.', 'error');
        } finally {
            setUploadingItems(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const handleNext = async () => {
        if (currentCategoryIndex < categories.length - 1) {
            window.scrollTo(0, 0);
            setCurrentCategoryIndex(prev => prev + 1);
        } else {
            // All results already auto-saved — just navigate to finish
            setIsSaving(true);
            navigate(`/inspection/finish/${inspectionId}`);
        }
    };

    // Check if any uploads are in progress
    const hasActiveUploads = Object.values(uploadingItems).some(v => v);
    const isButtonDisabled = isSaving || hasActiveUploads;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Lade Checkliste...</p>
            </div>
        );
    }

    // Resume dialog
    if (showResumeDialog && existingDraft) {
        const draftDate = new Date(existingDraft.createdAt || existingDraft.date).toLocaleDateString('de-AT');
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full text-center">
                    <RotateCcw size={48} className="text-blue-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Offener Entwurf</h2>
                    <p className="text-gray-600 mb-6">
                        Es gibt einen offenen Entwurf vom {draftDate}. Möchten Sie diesen fortsetzen oder eine neue Prüfung starten?
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => resumeDraft(existingDraft.id)}
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition"
                        >
                            Entwurf fortsetzen
                        </button>
                        <button
                            onClick={createNewInspection}
                            className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 transition"
                        >
                            Neue Prüfung starten
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full text-gray-500 py-2 hover:text-gray-700 transition"
                        >
                            Zurück
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!categories.length || !categories[currentCategoryIndex]) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <AlertTriangle size={48} className="text-red-500 mb-4" />
                <p className="text-gray-600">Keine Prüfpunkte gefunden.</p>
            </div>
        );
    }

    const currentCategory = categories[currentCategoryIndex];

    return (
        <div className="pb-24">
            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Header */}
            <div className="bg-white sticky top-0 z-10 shadow-sm px-4 py-3 flex items-center justify-between">
                <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
                    <XCircle />
                </button>
                <h2 className="font-bold text-lg">{currentCategory.name}</h2>
                <span className="text-sm font-medium text-gray-500">
                    {currentCategoryIndex + 1} / {categories.length}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-gray-200">
                <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${((currentCategoryIndex + 1) / categories.length) * 100}%` }}
                />
            </div>

            <div className="p-4 space-y-6 max-w-lg mx-auto">
                {currentCategory.items.map(item => {
                    const answer = answers[item.id] || {};
                    const isUploading = uploadingItems[item.id];
                    const justSaved = savingStatus[item.id];

                    return (
                        <div key={item.id} className={`bg-white p-4 rounded-xl shadow-sm border transition-all duration-200 ${justSaved ? 'border-green-400 ring-2 ring-green-200' : 'border-gray-100'
                            }`}>
                            <p className="font-medium text-gray-800 text-lg mb-4">{item.text}</p>

                            {/* Status Buttons */}
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => handleStatusChange(item.id, 'OK')}
                                    disabled={isUploading}
                                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${answer.status === 'OK'
                                        ? 'bg-green-50 border-green-500 text-green-700'
                                        : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                                        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Check size={28} className="mb-1" />
                                    <span className="font-bold">OK</span>
                                </button>

                                <button
                                    onClick={() => handleStatusChange(item.id, 'DEFECT')}
                                    disabled={isUploading}
                                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${answer.status === 'DEFECT'
                                        ? 'bg-red-50 border-red-500 text-red-700'
                                        : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                                        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <AlertTriangle size={28} className="mb-1" />
                                    <span className="font-bold">Mangel</span>
                                </button>

                                <button
                                    onClick={() => handleStatusChange(item.id, 'NOT_APPLICABLE')}
                                    disabled={isUploading}
                                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${answer.status === 'NOT_APPLICABLE'
                                        ? 'bg-gray-100 border-gray-400 text-gray-600'
                                        : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                                        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <XCircle size={28} className="mb-1" />
                                    <span className="font-bold">N/A</span>
                                </button>
                            </div>

                            {/* Defect Form */}
                            {answer.status === 'DEFECT' && (
                                <div className="mt-4 space-y-3">
                                    <label className={`block w-full font-semibold py-3 px-4 rounded-lg text-center cursor-pointer transition-colors ${isUploading
                                            ? 'bg-blue-100 text-blue-500'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}>
                                        <span className="flex items-center justify-center gap-2">
                                            {isUploading ? (
                                                <>
                                                    <Loader2 size={20} className="animate-spin" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Camera size={20} />
                                                    {answer.photoUrl ? 'Foto ändern' : 'Foto machen'}
                                                </>
                                            )}
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            disabled={isUploading}
                                            onChange={(e) => handleFileUpload(item.id, e.target.files[0])}
                                        />
                                    </label>

                                    {answer.photoUrl && (
                                        <div className="relative">
                                            <img
                                                src={answer.photoUrl}
                                                alt="Preview"
                                                className="w-full h-48 object-cover rounded-lg border border-gray-300"
                                            />
                                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                                                ✓ Hochgeladen
                                            </div>
                                        </div>
                                    )}

                                    <textarea
                                        placeholder="Beschreibung des Mangels..."
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        rows={3}
                                        value={answer.comment || ''}
                                        onChange={(e) => handleDefectUpdate(item.id, 'comment', e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer Nav */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-20">
                <button
                    onClick={handleNext}
                    disabled={isButtonDisabled}
                    className={`w-full font-bold text-xl py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all ${isButtonDisabled
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : 'bg-blue-600 text-white active:bg-blue-700 hover:bg-blue-700'
                        }`}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="animate-spin" />
                            Speichern...
                        </>
                    ) : hasActiveUploads ? (
                        <>
                            <Loader2 className="animate-spin" />
                            Upload läuft...
                        </>
                    ) : (
                        <>
                            {currentCategoryIndex < categories.length - 1 ? 'Weiter' : 'Abschließen'}
                            <ArrowRight />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
