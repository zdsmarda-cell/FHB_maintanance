
import React, { useState, useEffect, useMemo } from 'react';
import { db, api, isProductionDomain } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { User, Request, RequestPriority, Workplace, Technology, Supplier, Location, RequestHistoryEntry } from '../lib/types';
import { RequestsTable } from '../components/requests/RequestsTable';
import { RequestDetail } from '../components/requests/RequestDetail';
import { RequestForm } from '../components/requests/RequestForm';
import { Modal, Pagination, ConfirmModal, AlertModal } from '../components/Shared';
import { ApprovalModal } from '../components/requests/modals/ApprovalModal';
import { AssignModal } from '../components/requests/modals/AssignModal';
import { UnassignModal } from '../components/requests/modals/UnassignModal';
import { GalleryModal } from '../components/requests/modals/GalleryModal';
import { Plus, Printer, Loader, FilterX } from 'lucide-react';
import { generateWorkListPDF } from '../lib/pdf';
import { getLocalized, prepareMultilingual } from '../lib/helpers';

interface RequestsPageProps {
    user: User;
    initialFilters?: any;
}

export const RequestsPage = ({ user: initialUser, initialFilters }: RequestsPageProps) => {
    const { t, lang } = useI18n(); // Destructure lang
    const [view, setView] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
    const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
    
    // --- Data States ---
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<Request[]>([]);
    const [technologies, setTechnologies] = useState<Technology[]>([]);
    const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
    const [locations, setLocations] = useState<Location[]>([]); // Added state for locations
    const [users, setUsers] = useState<User[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // Gallery Modal State
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);

    // CRITICAL: Always get the fresh user from DB/State to ensure Limits are up-to-date
    // In production we look in loaded users, fallback to initial
    const currentUser = users.find(u => u.id === initialUser.id) || initialUser;
    
    // --- Filter States (Lifted from Table) ---
    const [fTitle, setFTitle] = useState('');
    const [fTechIds, setFTechIds] = useState<string[]>([]);
    const [fDateResFrom, setFDateResFrom] = useState('');
    const [fDateResTo, setFDateResTo] = useState('');
    const [fSolverIds, setFSolverIds] = useState<string[]>([]);
    const [fSupplierIds, setFSupplierIds] = useState<string[]>([]);
    const [fStatusIds, setFStatusIds] = useState<string[]>([]);
    const [fPriorities, setFPriorities] = useState<string[]>([]); // Added Priority Filter
    const [fApproved, setFApproved] = useState('all');
    const [fMaintenanceId, setFMaintenanceId] = useState<string | null>(null); // New Maintenance Filter

    // --- Data Fetching ---
    const refresh = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

            if (isMock) {
                setRequests(db.requests.list());
                setTechnologies(db.technologies.list());
                setWorkplaces(db.workplaces.list());
                setLocations(db.locations.list());
                setUsers(db.users.list());
                setSuppliers(db.suppliers.list());
            } else {
                const [reqData, techData, wpData, userData, supData, locData] = await Promise.all([
                    api.get('/requests'),
                    api.get('/technologies'),
                    api.get('/locations/workplaces'),
                    api.get('/users'),
                    api.get('/suppliers'),
                    api.get('/locations')
                ]);
                setRequests(reqData);
                setTechnologies(techData);
                setWorkplaces(wpData);
                setUsers(userData);
                setSuppliers(supData);
                setLocations(locData);
            }
        } catch (e) {
            console.error("Failed to load requests data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    // Load initial filters
    useEffect(() => {
        if (initialFilters && Object.keys(initialFilters).length > 0) {
            if (initialFilters.status) setFStatusIds([initialFilters.status]);
            if (initialFilters.solverId) setFSolverIds([initialFilters.solverId]);
            if (initialFilters.mode === 'approval') {
                setFApproved('no');
                // Ensure we see requests that need approval (usually new or assigned)
                // If status isn't specified, we might default to active ones, 
                // but 'no' on approval + Admin role usually implies the Dashboard link.
                if (!initialFilters.status) setFStatusIds(['new', 'assigned']);
            }
            if (initialFilters.date) {
                setFDateResFrom(initialFilters.date);
                setFDateResTo(initialFilters.date);
            }
            if (initialFilters.supplierId) {
                setFSupplierIds([initialFilters.supplierId]);
            }
            if (initialFilters.maintenanceId) {
                setFMaintenanceId(initialFilters.maintenanceId);
            }
            if (initialFilters.techId) {
                setFTechIds([initialFilters.techId]);
            }
        }
    }, [initialFilters]);

    // --- Filtering Logic (Used for PDF Export consistency) ---
    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const tech = technologies.find(t => t.id === req.techId);
            
            // 1. Role-based Access
            if (currentUser.role === 'operator') {
                if (req.authorId !== currentUser.id) return false;
            }

            // 2. Title Filter (Text) - Localized check
            if (fTitle) {
                const localizedTitle = getLocalized(req.title, lang);
                if (!localizedTitle.toLowerCase().includes(fTitle.toLowerCase())) return false;
            }

            // 3. Tech Filter (Multi)
            if (fTechIds.length > 0 && !fTechIds.includes(req.techId)) return false;

            // 4. Resolution Date Filter (Range)
            if (fDateResFrom || fDateResTo) {
                if (!req.plannedResolutionDate) return false; 
                const resDate = new Date(req.plannedResolutionDate).getTime();
                if (fDateResFrom) {
                    if (resDate < new Date(fDateResFrom).setHours(0,0,0,0)) return false;
                }
                if (fDateResTo) {
                    if (resDate > new Date(fDateResTo).setHours(23,59,59,999)) return false;
                }
            }

            // 5. Solver Filter (Multi)
            if (fSolverIds.length > 0) {
                if (!req.solverId) return false;
                if (!fSolverIds.includes(req.solverId)) return false;
            }

            // 6. Supplier Filter (Multi)
            if (fSupplierIds.length > 0) {
                const effectiveSupplierId = req.assignedSupplierId || tech?.supplierId || 'internal';
                
                if (fSupplierIds.includes('external')) {
                    if (effectiveSupplierId === 'internal') return false;
                } else if (fSupplierIds.includes('internal')) {
                    if (effectiveSupplierId !== 'internal') return false;
                } else {
                    if (!fSupplierIds.includes(effectiveSupplierId)) return false;
                }
            }

            // 7. Status Filter (Multi)
            if (fStatusIds.length > 0 && !fStatusIds.includes(req.state)) return false;

            // 8. Approval Filter (Select)
            if (fApproved === 'yes' && !req.isApproved) return false;
            if (fApproved === 'no' && req.isApproved) return false;

            // 9. Maintenance ID Filter
            if (fMaintenanceId && req.maintenanceId !== fMaintenanceId) return false;

            // 10. Priority Filter
            if (fPriorities.length > 0 && !fPriorities.includes(req.priority)) return false;

            return true;
        });
    }, [requests, currentUser, technologies, fTitle, fTechIds, fDateResFrom, fDateResTo, fSolverIds, fSupplierIds, fStatusIds, fApproved, fMaintenanceId, fPriorities, lang]);


    // Modals
    const [statusModal, setStatusModal] = useState<{ isOpen: boolean, req: Request | null }>({ isOpen: false, req: null });
    const [newStatus, setNewStatus] = useState<string>('');
    const [approvalReq, setApprovalReq] = useState<Request | null>(null);
    const [alertMsg, setAlertMsg] = useState<string | null>(null);
    const [showPriceWarning, setShowPriceWarning] = useState(false);
    
    // Assign Modal
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignTargetReq, setAssignTargetReq] = useState<Request | null>(null);
    const [assignSolverId, setAssignSolverId] = useState('');
    const [assignDate, setAssignDate] = useState('');
    
    // Unassign Modal
    const [unassignModalOpen, setUnassignModalOpen] = useState(false);
    const [unassignTargetReq, setUnassignTargetReq] = useState<Request | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Form State
    const [requestForm, setRequestForm] = useState<{
        title: string; techId: string; description: string; priority: RequestPriority;
        estimatedCost: number | undefined; photoUrls: string[]; assignedSupplierId: string;
        plannedResolutionDate?: string;
        estimatedTime?: number;
    }>({ title: '', techId: '', description: '', priority: 'basic', estimatedCost: undefined, photoUrls: [], assignedSupplierId: 'internal' });
    const [errors, setErrors] = useState({});
    const [isUploading, setIsUploading] = useState(false);

    // --- Helpers & Actions ---
    const getEligibleSolvers = (req: Request): User[] => {
        const tech = technologies.find(t => t.id === req.techId);
        if (!tech) return [];
        const wp = workplaces.find(w => w.id === tech.workplaceId);
        if (!wp) return [];
        return users.filter(u => {
            if (u.isBlocked) return false;
            if (u.role === 'operator') return false;
            if (u.role === 'admin') return true;
            return (u.assignedLocationIds || []).includes(wp.locationId) || (u.assignedWorkplaceIds || []).includes(wp.id);
        });
    };

    const handleRowClick = (req: Request) => { setSelectedRequest(req); setView('detail'); };
    
    const handleEditClick = (req: Request) => {
        setSelectedRequest(req);
        setRequestForm({
            title: getLocalized(req.title, lang), // Decode title for editing
            techId: req.techId, 
            description: getLocalized(req.description, lang), // Decode description for editing
            priority: req.priority,
            estimatedCost: req.estimatedCost || 0, 
            photoUrls: req.photoUrls || [], 
            assignedSupplierId: req.assignedSupplierId || 'internal',
            plannedResolutionDate: req.plannedResolutionDate || '',
            estimatedTime: req.estimatedTime
        });
        setView('edit');
    };
    
    const handleBack = () => { setSelectedRequest(null); setView('list'); refresh(); };
    const handleCreate = () => { setRequestForm({ title: '', techId: '', description: '', priority: 'basic', estimatedCost: undefined, photoUrls: [], assignedSupplierId: 'internal' }); setView('create'); };

    const validateForm = (data: any) => {
        const errs: any = {};
        if (!data.title) errs.title = t('validation.required');
        if (!data.techId) errs.techId = t('validation.required');
        
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSaveNew = async () => {
        if (!validateForm(requestForm)) return;
        setLoading(true);
        try {
            // Translate Content
            const translatedTitle = await prepareMultilingual(requestForm.title);
            const translatedDesc = await prepareMultilingual(requestForm.description);

            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            
            const payload = { 
                ...requestForm, 
                title: translatedTitle,
                description: translatedDesc,
                estimatedCost: requestForm.estimatedCost ?? 0, 
                authorId: currentUser.id 
            };

            if (isMock) {
                db.requests.add({ ...payload, state: 'new' } as any);
            } else {
                await api.post('/requests', payload);
            }
            setView('list');
            refresh();
        } catch(e) { console.error(e); setLoading(false); }
    };

    const handleUpdate = () => {
        if (!selectedRequest) return;
        if (!validateForm(requestForm)) return;
        const newCost = requestForm.estimatedCost ?? 0;
        const oldCost = selectedRequest.estimatedCost || 0;
        if (selectedRequest.isApproved && newCost !== oldCost && newCost > 0) { setShowPriceWarning(true); return; }
        executeUpdate();
    };

    const executeUpdate = async () => {
        if (!selectedRequest) return;
        setLoading(true);
        try {
            // Translate Content
            const translatedTitle = await prepareMultilingual(requestForm.title);
            const translatedDesc = await prepareMultilingual(requestForm.description);

            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            
            const payload = { 
                ...requestForm, 
                title: translatedTitle,
                description: translatedDesc,
                estimatedCost: requestForm.estimatedCost ?? 0 
            };

            if (isMock) {
                db.requests.update(selectedRequest.id, payload);
            } else {
                await api.put(`/requests/${selectedRequest.id}`, payload);
            }
            setShowPriceWarning(false); 
            setView('list');
            refresh();
        } catch(e) { console.error(e); setLoading(false); }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const token = localStorage.getItem('auth_token');
                const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

                if (isMock) {
                    const reader = new FileReader();
                    reader.onloadend = () => { setRequestForm(prev => ({ ...prev, photoUrls: [...prev.photoUrls, reader.result as string] })); setIsUploading(false); };
                    reader.readAsDataURL(file);
                } else {
                    const formData = new FormData();
                    formData.append('image', file);
                    const response = await fetch(`${api.baseUrl}/api/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });
                    if(response.ok) {
                        const resData = await response.json();
                        const fullUrl = resData.url.startsWith('http') ? resData.url : `${api.baseUrl}${resData.url}`;
                        setRequestForm(prev => ({ ...prev, photoUrls: [...prev.photoUrls, fullUrl] }));
                    }
                    setIsUploading(false);
                }
            } catch (err) { setIsUploading(false); }
        }
    };
    const removePhoto = (idx: number) => { setRequestForm(prev => ({ ...prev, photoUrls: prev.photoUrls.filter((_, i) => i !== idx) })); };

    // --- STATE CHANGES ---
    const updateRequestState = async (newState: any, reason?: string, userId?: string, updates?: any) => {
        if (!selectedRequest) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            
            // Prepare History Entry including reason/note
            const historyEntry: RequestHistoryEntry = {
                date: new Date().toISOString(),
                userId: userId || currentUser.id,
                action: 'status_change',
                oldValue: selectedRequest.state,
                newValue: newState,
                note: reason || '' 
            };

            // Calculate new history array
            const currentHistory = selectedRequest.history || [];
            const newHistory = [...currentHistory, historyEntry];

            // Merge history into updates
            const finalUpdates = { 
                ...updates, 
                history: newHistory,
                // Ensure cancellationReason is explicitly set if cancelled
                ...(newState === 'cancelled' ? { cancellationReason: reason } : {})
            };

            if (isMock) {
                db.requests.updateState(selectedRequest.id, newState, reason || '', userId || currentUser.id, finalUpdates);
            } else {
                await api.put(`/requests/${selectedRequest.id}`, {
                    state: newState,
                    cancellationReason: reason,
                    ...finalUpdates
                });
            }
            refresh();
            if (view === 'detail') setView('list');
        } catch(e) { console.error(e); setLoading(false); }
    };

    const handleApproveChange = async (isApproved: boolean) => {
        if (!selectedRequest) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            
            // Prepare History
            const historyEntry: RequestHistoryEntry = {
                date: new Date().toISOString(),
                userId: currentUser.id,
                action: isApproved ? 'approved' : 'rejected',
                note: isApproved ? 'Schváleno' : 'Zamítnuto'
            };
            const newHistory = [...(selectedRequest.history || []), historyEntry];

            if (isMock) {
                db.requests.updateState(selectedRequest.id, selectedRequest.state, '', currentUser.id, { isApproved, history: newHistory });
            } else {
                await api.put(`/requests/${selectedRequest.id}`, { isApproved, history: newHistory });
            }
            setSelectedRequest({...selectedRequest, isApproved, history: newHistory});
            refresh();
        } catch(e) { console.error(e); setLoading(false); }
    };

    const handleApprovalModalAction = async (isApproved: boolean) => {
        if (!approvalReq) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            
            if (isMock) {
                db.requests.updateState(approvalReq.id, approvalReq.state, '', currentUser.id, { isApproved });
            } else {
                await api.put(`/requests/${approvalReq.id}`, { isApproved });
            }
            setApprovalReq(null); 
            refresh();
        } catch(e) { console.error(e); setLoading(false); }
    };

    const openApprovalModal = (req: Request) => {
        if (currentUser.role !== 'admin' && currentUser.role !== 'maintenance') { setAlertMsg("Nemáte oprávnění ke schvalování."); return; }
        const tech = technologies.find(t => t.id === req.techId);
        const wp = workplaces.find(w => w.id === tech?.workplaceId);
        const limit = currentUser.approvalLimits?.[wp?.locationId || ''];
        const cost = req.estimatedCost || 0;
        if (limit !== undefined && limit >= cost) { setApprovalReq(req); } else { setAlertMsg(`Zamítnuto: Cena (${cost} €) překračuje váš schvalovací limit (${limit || 0} €).`); }
    };

    const openStatusModal = (req: Request) => { setStatusModal({ isOpen: true, req }); setNewStatus(req.state); }
    
    const saveStatusChange = async () => { 
        if (statusModal.req && newStatus) { 
            const updates: any = {};
            if (newStatus === 'new') {
                updates.solverId = '';
            }
            
            setLoading(true);
            try {
                const token = localStorage.getItem('auth_token');
                const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
                
                const historyEntry: RequestHistoryEntry = {
                    date: new Date().toISOString(),
                    userId: currentUser.id,
                    action: 'status_change',
                    oldValue: statusModal.req.state,
                    newValue: newStatus,
                    note: 'Změna z přehledu'
                };
                const newHistory = [...(statusModal.req.history || []), historyEntry];
                const finalUpdates = { ...updates, history: newHistory };

                if (isMock) {
                    db.requests.updateState(statusModal.req.id, newStatus as any, 'Změna z přehledu', currentUser.id, finalUpdates); 
                } else {
                    await api.put(`/requests/${statusModal.req.id}`, {
                        state: newStatus,
                        ...finalUpdates
                    });
                }
                setStatusModal({ isOpen: false, req: null }); 
                refresh(); 
            } catch(e) { console.error(e); setLoading(false); }
        } 
    }

    const openAssignModal = (req: Request) => { 
        setAssignTargetReq(req); 
        if (req.solverId) {
             setAssignSolverId(req.solverId);
        } else {
             setAssignSolverId(currentUser.role === 'maintenance' ? currentUser.id : currentUser.id); 
        }
        setAssignDate(req.plannedResolutionDate || ''); 
        setAssignModalOpen(true); 
    };

    const openUnassignModal = (req: Request) => {
        setUnassignTargetReq(req);
        setUnassignModalOpen(true);
    };

    const handleAssignConfirm = async () => {
        if (assignTargetReq && assignSolverId && assignDate) {
            const updates: any = { solverId: assignSolverId, plannedResolutionDate: assignDate };
            const newState = assignTargetReq.state === 'new' ? 'assigned' : assignTargetReq.state;
            
            setLoading(true);
            try {
                const token = localStorage.getItem('auth_token');
                const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
                
                const historyEntry: RequestHistoryEntry = {
                    date: new Date().toISOString(),
                    userId: currentUser.id,
                    action: 'edited',
                    note: 'Přiřazeno/Změněno z přehledu'
                };
                const newHistory = [...(assignTargetReq.history || []), historyEntry];
                const finalUpdates = { ...updates, history: newHistory };

                if (isMock) {
                    db.requests.updateState(assignTargetReq.id, newState, 'Přiřazeno/Změněno z přehledu', currentUser.id, finalUpdates);
                } else {
                    await api.put(`/requests/${assignTargetReq.id}`, {
                        state: newState,
                        ...finalUpdates
                    });
                }
                setAssignModalOpen(false); setAssignTargetReq(null); refresh();
            } catch(e) { console.error(e); setLoading(false); }
        }
    };

    const handleUnassignConfirm = async () => {
        const target = unassignTargetReq || assignTargetReq || selectedRequest;
        if (target) {
            setLoading(true);
            try {
                const token = localStorage.getItem('auth_token');
                const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
                const updates = { solverId: '' };
                
                const historyEntry: RequestHistoryEntry = {
                    date: new Date().toISOString(),
                    userId: currentUser.id,
                    action: 'edited',
                    note: 'Uvolněno z řešení'
                };
                const newHistory = [...(target.history || []), historyEntry];
                const finalUpdates = { ...updates, history: newHistory };

                if (isMock) {
                    db.requests.updateState(
                        target.id, 
                        'new', 
                        `Udržbář se uvolnil z požadavku / Řešitel odebrán`, 
                        currentUser.id,
                        finalUpdates
                    );
                } else {
                    await api.put(`/requests/${target.id}`, {
                        state: 'new',
                        ...finalUpdates
                    });
                }
                setUnassignModalOpen(false);
                setAssignModalOpen(false);
                setUnassignTargetReq(null);
                setAssignTargetReq(null);
                refresh();
            } catch(e) { console.error(e); setLoading(false); }
        }
    }

    const handleExportPDF = async () => {
        await generateWorkListPDF(
            filteredRequests, 
            currentUser, 
            "Seznam úkolů", 
            t, 
            lang,
            technologies,
            suppliers,
            users
        );
    }

    const openGallery = (photos: string[], e: React.MouseEvent) => {
        e.stopPropagation();
        if (photos && photos.length > 0) {
            setGalleryImages(photos);
            setGalleryIndex(0);
            setIsGalleryOpen(true);
        }
    };

    // --- Badge Renderers for Detail View (Correctly Localized) ---
    const renderDetailStatusBadge = (status: string) => {
        const styles: any = {
            'new': 'bg-blue-100 text-blue-800 border-blue-200',
            'assigned': 'bg-amber-100 text-amber-800 border-amber-200',
            'solved': 'bg-green-100 text-green-800 border-green-200',
            'cancelled': 'bg-red-100 text-red-800 border-red-200'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold border uppercase ${styles[status] || 'bg-slate-100'}`}>
                {t(`status.${status}`) || status}
            </span>
        );
    };

    const renderDetailPrioBadge = (prio: string) => {
        let colors = 'bg-slate-100 text-slate-700';
        if (prio === 'urgent') colors = 'bg-red-100 text-red-800 border-red-200 font-bold';
        if (prio === 'priority') colors = 'bg-amber-100 text-amber-800 border-amber-200';
        return <span className={`px-2 py-0.5 rounded text-xs border uppercase ${colors}`}>{t(`prio.${prio}`)}</span>;
    };

    const renderContent = () => {
        if (loading && requests.length === 0) return <div className="p-10 flex justify-center"><Loader className="animate-spin w-8 h-8 text-blue-600"/></div>;

        if (view === 'create' || view === 'edit') {
            const isEdit = view === 'edit';
            return (
                <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
                    <h2 className="text-xl font-bold mb-4">{isEdit ? t('common.edit') : t('headers.new_request')}</h2>
                    <RequestForm 
                        formData={requestForm} setFormData={setRequestForm} errors={errors} user={currentUser}
                        locations={locations} workplaces={workplaces} technologies={technologies}
                        handleImageUpload={handleImageUpload} removePhoto={removePhoto} isEditMode={isEdit} isUploading={isUploading}
                    />
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                        <button onClick={() => setView('list')} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">{t('common.cancel')}</button>
                        <button onClick={isEdit ? handleUpdate : handleSaveNew} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{isEdit ? t('common.save') : t('common.create')}</button>
                    </div>
                    {showPriceWarning && <ConfirmModal title="Změna ceny" message="Změna ceny u schváleného požadavku zruší jeho schválení. Chcete pokračovat?" onConfirm={executeUpdate} onCancel={() => setShowPriceWarning(false)} />}
                </div>
            );
        }

        if (view === 'detail' && selectedRequest) {
            return (
                <RequestDetail 
                    request={selectedRequest} currentUser={currentUser} technologies={technologies}
                    onBack={handleBack} onEdit={() => handleEditClick(selectedRequest)} onSolve={() => updateRequestState('solved')}
                    onAssign={() => openAssignModal(selectedRequest)} 
                    onUnassign={() => setUnassignModalOpen(true)}
                    onCancel={(reason) => updateRequestState('cancelled', reason)}
                    onApproveChange={handleApproveChange} 
                    onGallery={openGallery} 
                    renderStatusBadge={renderDetailStatusBadge} 
                    renderPrioBadge={renderDetailPrioBadge} 
                    refresh={refresh}
                />
            );
        }

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold text-slate-800">{t('menu.requests')}</h2>
                        {fMaintenanceId && (
                            <button 
                                onClick={() => setFMaintenanceId(null)}
                                className="flex items-center gap-1 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full hover:bg-purple-200"
                                title="Zrušit filtr šablony údržby"
                            >
                                <FilterX className="w-3 h-3" /> Filtrováno dle údržby
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleExportPDF}
                            className="bg-slate-100 text-slate-700 px-3 py-2 rounded flex items-center shadow-sm hover:bg-slate-200 border border-slate-300"
                            title="Exportovat seznam do PDF"
                        >
                            <Printer className="w-4 h-4 mr-2" /> Export PDF
                        </button>

                        <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center shadow-sm hover:bg-blue-700">
                            <Plus className="w-4 h-4 mr-2" /> {t('headers.new_request')}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <RequestsTable 
                        requests={requests} 
                        onRowClick={handleRowClick}
                        onEditClick={handleEditClick}
                        onStatusChangeClick={openStatusModal}
                        onAssignSelf={openAssignModal}
                        onApprovalClick={openApprovalModal}
                        onUnassign={openUnassignModal}
                        onGallery={openGallery}
                        currentUser={currentUser} 
                        workplaces={workplaces}
                        technologies={technologies}
                        users={users}
                        suppliers={suppliers}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        filterState={{
                            fTitle, setFTitle,
                            fTechIds, setFTechIds,
                            fDateResFrom, setFDateResFrom,
                            fDateResTo, setFDateResTo,
                            fSolverIds, setFSolverIds,
                            fSupplierIds, setFSupplierIds,
                            fStatusIds, setFStatusIds,
                            fPriorities, setFPriorities,
                            fApproved, setFApproved
                        }}
                    />
                </div>
            </div>
        );
    };

    return (
        <>
            {renderContent()}

            {statusModal.isOpen && (
                <Modal title="Změna stavu" onClose={() => setStatusModal({ isOpen: false, req: null })}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">Vyberte nový stav: <strong>{getLocalized(statusModal.req?.title, lang)}</strong></p>
                        <select className="w-full border p-2 rounded" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                            <option value="new">{t('status.new')}</option>
                            <option value="assigned">{t('status.assigned')}</option>
                            <option value="solved">{t('status.solved')}</option>
                            <option value="cancelled">{t('status.cancelled')}</option>
                        </select>
                        
                        {newStatus === 'new' && statusModal.req?.solverId && (
                            <div className="bg-amber-50 text-amber-800 p-2 rounded text-xs border border-amber-200">
                                <strong>Pozor:</strong> Změna stavu na "Nový" odebere současného řešitele z požadavku.
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t">
                            <button onClick={() => setStatusModal({ isOpen: false, req: null })} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">Zrušit</button>
                            <button onClick={saveStatusChange} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Uložit</button>
                        </div>
                    </div>
                </Modal>
            )}

            {assignModalOpen && assignTargetReq && (
                <AssignModal 
                    isOpen={assignModalOpen} 
                    onClose={() => setAssignModalOpen(false)} 
                    onConfirm={handleAssignConfirm}
                    onRemove={handleUnassignConfirm}
                    assignDate={assignDate} setAssignDate={setAssignDate} assignSolverId={assignSolverId} setAssignSolverId={setAssignSolverId}
                    candidates={getEligibleSolvers(assignTargetReq)} currentUser={currentUser}
                    isAlreadyAssigned={!!assignTargetReq.solverId}
                />
            )}

            {unassignModalOpen && (
                <UnassignModal 
                    isOpen={unassignModalOpen}
                    onClose={() => setUnassignModalOpen(false)}
                    onConfirm={handleUnassignConfirm}
                />
            )}

            {approvalReq && <ApprovalModal request={approvalReq} technologies={technologies} onClose={() => setApprovalReq(null)} onApprove={handleApprovalModalAction} />}
            {alertMsg && <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
            
            {isGalleryOpen && (
                <GalleryModal 
                    images={galleryImages} 
                    currentIndex={galleryIndex} 
                    onClose={() => setIsGalleryOpen(false)} 
                    onNext={(e) => { e.stopPropagation(); setGalleryIndex((prev) => (prev + 1) % galleryImages.length); }} 
                    onPrev={(e) => { e.stopPropagation(); setGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length); }}
                />
            )}
        </>
    );
};
