import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import PhotoLightbox from './ui/PhotoLightbox';
import { Camera, Check, AlertTriangle, XCircle, ArrowRight, Loader2, RotateCcw, ZoomIn, Trash2 } from 'lucide-react';

export default function InspectionWizard() {
    const { propertyId } = useParams();
    const navigate = useNavigate();

    const { user, authFetch } = useAuth();
    const { toast } = useToast();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [inspectionId, setInspectionId] = useState(null);
    const [openDefects, setOpenDefects] = useState({}); // itemId -> defect info

    // Draft resume state
    const [existingDraft, setExistingDraft] = useState(null);
    const [showResumeDialog, setShowResumeDialog] = useState(false);

    // Loading & Error States
    const [uploadingItems, setUploadingItems] = useState({});
    const [savingStatus, setSavingStatus] = useState({});
    const [saveErrors, setSaveErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Debounce timers for comment auto-save
    const commentTimers = useRef({});

    // Lightbox state — which photo (if any) is being viewed full-screen
    const [lightboxSrc, setLightboxSrc] = useState(null);

    // Warn on tab-close / reload if there are unsaved answers in flight.
    // hasActiveUploads is true during photo upload; we also guard against
    // the 1s comment debounce window by tracking isDirty.
    const hasActiveUploads = Object.values(uploadingItems).some((v) => v);
    useBeforeUnload((isDirty || hasActiveUploads) && !submitted);

    const showToast = useCallback(
        (message, type = 'success') => {
            if (type === 'error') toast.error(message);
            else toast.success(message);
        },
        [toast],
    );

    // Save a single result to the server.
    //
    // Errors are tracked per-item in saveErrors so the UI can show a
    // small red indicator on the affected row. isDirty flips on every
    // save attempt so beforeunload warns if the user closes the tab
    // before a save completes. It's cleared only on successful save.
    const saveResult = useCallback(
        async (inspId, itemId, answer, { silent = false } = {}) => {
            if (!inspId || !answer.status) return;
            setIsDirty(true);
            try {
                const res = await authFetch(`/api/inspections/${inspId}/results`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        checklistItemId: parseInt(itemId),
                        status: answer.status,
                        comment: answer.comment || '',
                        photoUrl: answer.photoUrl || '',
                    }),
                });
                if (!res.ok) throw new Error('save failed');
                setSaveErrors((prev) => {
                    if (!prev[itemId]) return prev;
                    const next = { ...prev };
                    delete next[itemId];
                    return next;
                });
                setIsDirty(false);
            } catch {
                setSaveErrors((prev) => ({ ...prev, [itemId]: true }));
                if (!silent) {
                    toast.error('Speichern fehlgeschlagen.', {
                        action: {
                            label: 'Erneut',
                            onClick: () => saveResult(inspId, itemId, answer, { silent: true }),
                        },
                    });
                }
            }
        },
        [authFetch, toast],
    );

    // Resume a draft — load existing results into answers state
    const resumeDraft = useCallback(async (draftId) => {
        setInspectionId(draftId);
        setShowResumeDialog(false);
        try {
            const res = await authFetch(`/api/inspections/${draftId}/results`);
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
    }, [authFetch, showToast]);

    // Delete the existing draft, then start a fresh inspection.
    const discardDraft = useCallback(async () => {
        if (!existingDraft) return;
        try {
            const res = await authFetch(`/api/inspections/${existingDraft.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            toast.success('Entwurf verworfen');
            setExistingDraft(null);
            setShowResumeDialog(false);
            // Trigger createNewInspection via useEffect branch: clear
            // the draft first so re-init picks the fresh path.
        } catch {
            toast.error('Entwurf konnte nicht gelöscht werden.');
        }
    }, [authFetch, existingDraft, toast]);

    // Create a new inspection
    const createNewInspection = useCallback(async () => {
        setShowResumeDialog(false);
        try {
            const res = await authFetch('/api/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
    }, [authFetch, propertyId, user?.name, showToast]);

    // Initialize — check for draft, load checklist, fetch open defects
    useEffect(() => {
        const init = async () => {
            try {
                // Fetch checklist and open defects in parallel
                const [catRes, defectsRes] = await Promise.all([
                    authFetch('/api/checklist/categories'),
                    authFetch(`/api/properties/${propertyId}/defects`)
                ]);

                if (!catRes.ok) throw new Error('Failed to load checklist');
                const catData = await catRes.json();
                setCategories(catData);

                // Build lookup of open defects by checklist item id
                if (defectsRes.ok) {
                    const allDefects = await defectsRes.json();
                    const openMap = {};
                    allDefects.forEach(d => {
                        if (d.status === 'OPEN') {
                            openMap[d.checklist_item_id] = d;
                        }
                    });
                    setOpenDefects(openMap);
                }

                // Check for existing draft
                const draftRes = await authFetch(`/api/properties/${propertyId}/draft-inspection`);
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
    }, [propertyId, authFetch, showToast, createNewInspection]);

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

        // Compress image before upload (max 1920px width, 0.8 quality)
        let uploadFile = file;
        if (file.type.startsWith('image/')) {
            try {
                uploadFile = await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const MAX_WIDTH = 1920;
                        let { width, height } = img;
                        if (width > MAX_WIDTH) {
                            height = Math.round(height * (MAX_WIDTH / width));
                            width = MAX_WIDTH;
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                        canvas.toBlob((blob) => {
                            resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
                        }, 'image/jpeg', 0.8);
                    };
                    img.onerror = () => resolve(file);
                    img.src = URL.createObjectURL(file);
                });
            } catch {
                uploadFile = file;
            }
        }

        const formData = new FormData();
        formData.append('photo', uploadFile);

        try {
            const res = await authFetch('/api/upload', {
                method: 'POST',
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
            setCurrentCategoryIndex((prev) => prev + 1);
        } else {
            // Block submit if any per-item saves are still in flight /
            // failed — a completed inspection with missing results would
            // ship an incomplete PDF.
            if (Object.keys(saveErrors).length > 0) {
                toast.error('Einige Antworten konnten nicht gespeichert werden. Bitte erneut versuchen, bevor die Prüfung abgeschlossen wird.');
                return;
            }
            setIsSaving(true);
            setSubmitted(true);
            navigate(`/inspection/finish/${inspectionId}`);
        }
    };

    const isButtonDisabled = isSaving || hasActiveUploads;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100/50 dark:bg-gray-950">
                <Loader2 size={48} className="animate-spin text-blue-600 dark:text-blue-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Lade Checkliste...</p>
            </div>
        );
    }

    // Resume dialog
    if (showResumeDialog && existingDraft) {
        const draftDate = new Date(existingDraft.createdAt || existingDraft.date).toLocaleDateString('de-AT');
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100/50 dark:bg-gray-950">
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-6 rounded-2xl shadow-xl max-w-sm w-full text-center">
                    <RotateCcw size={48} className="text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Offener Entwurf</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Es gibt einen offenen Entwurf vom {draftDate}. Möchten Sie diesen fortsetzen oder eine neue Prüfung starten?
                    </p>
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => resumeDraft(existingDraft.id)}
                            className="w-full bg-blue-600 dark:bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
                        >
                            Entwurf fortsetzen
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                await discardDraft();
                                await createNewInspection();
                            }}
                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                        >
                            Entwurf verwerfen &amp; neu starten
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="w-full text-gray-500 dark:text-gray-400 py-2 hover:text-gray-700 dark:hover:text-gray-200 transition focus:outline-none focus-visible:underline"
                        >
                            Zurück zum Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!categories.length || !categories[currentCategoryIndex]) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100/50 dark:bg-gray-950">
                <AlertTriangle size={48} className="text-red-500 dark:text-red-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Keine Prüfpunkte gefunden.</p>
            </div>
        );
    }

    const currentCategory = categories[currentCategoryIndex];

    return (
        <div className="pb-24 bg-gray-100/50 dark:bg-gray-950 min-h-screen">
            {/* Toasts are rendered globally via ToastProvider */}
            <PhotoLightbox
                src={lightboxSrc}
                alt="Mangel-Foto in voller Größe"
                open={lightboxSrc !== null}
                onClose={() => setLightboxSrc(null)}
            />

            {/* Header */}
            <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl sticky top-0 z-10 border-b border-gray-200/50 dark:border-gray-800/50 px-4 py-3 flex items-center justify-between">
                <button onClick={() => navigate('/')} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:scale-95 transition-all">
                    <XCircle />
                </button>
                <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">{currentCategory.name}</h2>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {currentCategoryIndex + 1} / {categories.length}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-gray-200 dark:bg-gray-800">
                <div
                    className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                    style={{ width: `${((currentCategoryIndex + 1) / categories.length) * 100}%` }}
                />
            </div>

            <div className="p-4 space-y-6 max-w-lg mx-auto">
                {currentCategory.items.map(item => {
                    const answer = answers[item.id] || {};
                    const isUploading = uploadingItems[item.id];
                    const justSaved = savingStatus[item.id];
                    const hasOpenDefect = openDefects[item.id];
                    const saveFailed = saveErrors[item.id];

                    return (
                        <div
                            key={item.id}
                            className={`bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm transition-all duration-200 ${
                                saveFailed
                                    ? 'ring-2 ring-red-400 dark:ring-red-500'
                                    : justSaved
                                      ? 'ring-2 ring-green-400 dark:ring-green-500'
                                      : hasOpenDefect
                                        ? 'ring-1 ring-orange-300 dark:ring-orange-500'
                                        : ''
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2 mb-4">
                                <p className="font-medium text-gray-900 dark:text-gray-100 text-lg">{item.text}</p>
                                {hasOpenDefect && !saveFailed && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-full whitespace-nowrap shrink-0">
                                        <AlertTriangle size={12} />
                                        Vorheriger Mangel
                                    </span>
                                )}
                                {saveFailed && (
                                    <button
                                        type="button"
                                        onClick={() => saveResult(inspectionId, item.id, answer)}
                                        className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full shrink-0 hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                    >
                                        <AlertTriangle size={12} />
                                        Nicht gespeichert — erneut versuchen
                                    </button>
                                )}
                            </div>

                            {/* Status Buttons */}
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => handleStatusChange(item.id, 'OK')}
                                    disabled={isUploading}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${answer.status === 'OK'
                                        ? 'bg-green-50 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                                        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Check size={28} className="mb-1" />
                                    <span className="font-bold">OK</span>
                                </button>

                                <button
                                    onClick={() => handleStatusChange(item.id, 'DEFECT')}
                                    disabled={isUploading}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${answer.status === 'DEFECT'
                                        ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                                        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <AlertTriangle size={28} className="mb-1" />
                                    <span className="font-bold">Mangel</span>
                                </button>

                                <button
                                    onClick={() => handleStatusChange(item.id, 'NOT_APPLICABLE')}
                                    disabled={isUploading}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${answer.status === 'NOT_APPLICABLE'
                                        ? 'bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500 text-gray-600 dark:text-gray-300'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                                        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <XCircle size={28} className="mb-1" />
                                    <span className="font-bold">N/A</span>
                                </button>
                            </div>

                            {/* Defect Form */}
                            {answer.status === 'DEFECT' && (
                                <div className="mt-4 space-y-3">
                                    <label className={`block w-full font-semibold py-3 px-4 rounded-xl text-center cursor-pointer transition-colors ${isUploading
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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
                                        <div className="relative group">
                                            <button
                                                type="button"
                                                onClick={() => setLightboxSrc(answer.photoUrl)}
                                                aria-label="Foto vergrößern"
                                                className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl"
                                            >
                                                <img
                                                    src={answer.photoUrl}
                                                    alt="Dokumentierter Mangel"
                                                    className="w-full h-48 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                                                />
                                                <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <ZoomIn className="text-white drop-shadow" size={28} />
                                                </div>
                                            </button>
                                            <div className="absolute top-2 right-2 flex gap-1">
                                                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-lg">
                                                    Hochgeladen
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAnswers((prev) => {
                                                            const updated = { ...prev, [item.id]: { ...prev[item.id], photoUrl: '' } };
                                                            if (inspectionId && updated[item.id]?.status) {
                                                                saveResult(inspectionId, item.id, updated[item.id]);
                                                            }
                                                            return updated;
                                                        });
                                                    }}
                                                    aria-label="Foto entfernen"
                                                    title="Foto entfernen"
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/90 hover:bg-white text-red-600 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label htmlFor={`comment-${item.id}`} className="sr-only">
                                            Beschreibung des Mangels
                                        </label>
                                        <textarea
                                            id={`comment-${item.id}`}
                                            placeholder="Beschreibung des Mangels..."
                                            className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                                            rows={3}
                                            maxLength={2000}
                                            value={answer.comment || ''}
                                            onChange={(e) => handleDefectUpdate(item.id, 'comment', e.target.value)}
                                            aria-describedby={`comment-${item.id}-count`}
                                        />
                                        <div
                                            id={`comment-${item.id}-count`}
                                            className={`text-right text-xs mt-1 ${
                                                (answer.comment?.length ?? 0) > 1800
                                                    ? 'text-orange-600 dark:text-orange-400'
                                                    : 'text-gray-400 dark:text-gray-500'
                                            }`}
                                        >
                                            {(answer.comment?.length ?? 0)} / 2000
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer Nav */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 p-4 z-20">
                <button
                    onClick={handleNext}
                    disabled={isButtonDisabled}
                    className={`w-full font-bold text-xl py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${isButtonDisabled
                            ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 dark:text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
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
