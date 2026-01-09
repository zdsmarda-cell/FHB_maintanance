
import React, { useState, useEffect, useMemo } from 'react';
import { db, api, isProductionDomain } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { User, Request, RequestPriority, Workplace, Technology, Supplier } from '../lib/types';
import { RequestsTable } from '../components/requests/RequestsTable';
import { RequestDetail } from '../components/requests/RequestDetail';
import { RequestForm } from '../components/requests/RequestForm';
import { Modal, Pagination, ConfirmModal, AlertModal } from '../components/Shared';
import { ApprovalModal } from '../components/requests/modals/ApprovalModal';
import { AssignModal } from '../components/requests/modals/AssignModal';
import { UnassignModal } from '../components/requests/modals/UnassignModal';
import { Plus, Printer, Loader } from 'lucide-react';
import { generateWorkListPDF } from '../lib/pdf';

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
    const [users, setUsers] = useState<User[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

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
    const [fApproved, setFApproved] = useState('all');

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
                setUsers(db.users.list());
                setSuppliers(db.suppliers.list());
            } else {
                const [reqData, techData, wpData, userData, supData] = await Promise.all([
                    api.get('/requests'),
                    api.get('/technologies'),
                    api.get('/locations/workplaces'),
                    api.get('/users'),
                    api.get('/suppliers')
                ]);
                setRequests(reqData);
                setTechnologies(techData);
                setWorkplaces(wpData);
                setUsers(userData);
                setSuppliers(supData);
            }

            // Refresh selected request reference
            if (selectedRequest) {
                // In mock, we read from db directly again. In prod, we look at the fresh `requests` (but since state update is async, we do this in effect or just rely on next render if we find it in new data)
                // For simplicity here, we assume selectedRequest is updated via UI flow or re-found from list
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
        if (initialFilters) {
            if (initialFilters.status) setFStatusIds([initialFilters.status]);
            if (initialFilters.solverId) setFSolverIds([initialFilters.solverId]);
            if (initialFilters.mode === 'approval') {
                setFApproved('no');
                setFStatusIds(['new', 'assigned']);
            }
            if (initialFilters.date) {
                setFDateResFrom(initialFilters.date);
                setFDateResTo(initialFilters.date);
            }
            if (initialFilters.supplierId) {
                setFSupplierIds([initialFilters.supplierId]);
            }
        }
    }, [initialFilters]);

    // --- Filtering Logic ---
    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const tech = technologies.find(t => t.id === req.techId);
            
            // 1. Role-based Access
            if (currentUser.role === 'operator') {
                if (req.authorId !== currentUser.id) return false;
            }

            // 2. Title Filter (Text)
            if (fTitle && !req.title.toLowerCase().includes(fTitle.toLowerCase())) return false;

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

            return true;
        });
    }, [requests, currentUser, technologies, fTitle, fTechIds, fDateResFrom, fDateResTo, fSolverIds, fSupplierIds, fStatusIds, fApproved]);


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
            title: req.title, techId: req.techId, description: req.description, priority: req.priority,
            estimatedCost: req.estimatedCost || 0, photoUrls: req.photoUrls || [], assignedSupplierId: req.assignedSupplierId || 'internal',
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
        if (!data.description) errs.description = t('validation.required');
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSaveNew = async () => {
        if (!validateForm(requestForm)) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            const payload = { ...requestForm, estimatedCost: requestForm.estimatedCost ?? 0, authorId: currentUser.id };

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
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            const payload = { ...requestForm, estimatedCost: requestForm.estimatedCost ?? 0 };

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
            
            if (isMock) {
                db.requests.updateState(selectedRequest.id, newState, reason || '', userId || currentUser.id, updates);
            } else {
                await api.put(`/requests/${selectedRequest.id}`, {
                    state: newState,
                    cancellationReason: reason,
                    ...updates
                });
            }
            refresh();
            if (view === 'detail') setView('list'); // Optionally close detail on major state change
        } catch(e) { console.error(e); setLoading(false); }
    };

    const handleApproveChange = async (isApproved: boolean) => {
        if (!selectedRequest) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            
            if (isMock) {
                db.requests.updateState(selectedRequest.id, selectedRequest.state, '', currentUser.id, { isApproved });
            } else {
                await api.put(`/requests/${selectedRequest.id}`, { isApproved });
            }
            // Update local selected request state to reflect change immediately in detail view
            setSelectedRequest({...selectedRequest, isApproved});
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
    
    // Status Change Logic - Handle "New" resets
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
                
                if (isMock) {
                    db.requests.updateState(statusModal.req.id, newStatus as any, 'Změna z přehledu', currentUser.id, updates); 
                } else {
                    await api.put(`/requests/${statusModal.req.id}`, {
                        state: newStatus,
                        ...updates
                    });
                }
                setStatusModal({ isOpen: false, req: null }); 
                refresh(); 
            } catch(e) { console.error(e); setLoading(false); }
        } 
    }

    const openAssignModal = (req: Request) => { 
        setAssignTargetReq(req); 
        // If already assigned, prefill solver and date
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
            // If it was new, switch to assigned. If it was assigned (change solver), keep assigned.
            const newState = assignTargetReq.state === 'new' ? 'assigned' : assignTargetReq.state;
            
            setLoading(true);
            try {
                const token = localStorage.getItem('auth_token');
                const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
                
                if (isMock) {
                    db.requests.updateState(assignTargetReq.id, newState, 'Přiřazeno/Změněno z přehledu', currentUser.id, updates);
                } else {
                    await api.put(`/requests/${assignTargetReq.id}`, {
                        state: newState,
                        ...updates
                    });
                }
                setAssignModalOpen(false); setAssignTargetReq(null); refresh();
            } catch(e) { console.error(e); setLoading(false); }
        }
    };

    // Unassign Logic (Called from UnassignModal or AssignModal Remove button)
    const handleUnassignConfirm = async () => {
        const target = unassignTargetReq || assignTargetReq || selectedRequest;
        if (target) {
            setLoading(true);
            try {
                const token = localStorage.getItem('auth_token');
                const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
                const updates = { solverId: '' };

                if (isMock) {
                    db.requests.updateState(
                        target.id, 
                        'new', 
                        `Udržbář se uvolnil z požadavku / Řešitel odebrán`, 
                        currentUser.id,
                        updates
                    );
                } else {
                    await api.put(`/requests/${target.id}`, {
                        state: 'new',
                        ...updates
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
        await generateWorkListPDF(filteredRequests, currentUser, "Seznam úkolů", t, lang);
    }

    // --- Main Content Render ---
    const renderContent = () => {
        if (loading && requests.length === 0) return <div className="p-10 flex justify-center"><Loader className="animate-spin w-8 h-8 text-blue-600"/></div>;

        if (view === 'create' || view === 'edit') {
            const isEdit = view === 'edit';
            return (
                <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
                    <h2 className="text-xl font-bold mb-4">{isEdit ? t('common.edit') : t('headers.new_request')}</h2>
                    <RequestForm 
                        formData={requestForm} setFormData={setRequestForm} errors={errors} user={currentUser}
                        locations={db.locations.list()} workplaces={workplaces} technologies={technologies}
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
                    onCancel={() => updateRequestState('cancelled', 'Cancelled by user')}
                    onApproveChange={handleApproveChange} onGallery={() => {}} 
                    renderStatusBadge={(s) => <span className="badge">{s}</span>} renderPrioBadge={(p) => <span className="badge">{p}</span>} refresh={refresh}
                />
            );
        }

        // List View
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">{t('menu.requests')}</h2>
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
                            fApproved, setFApproved
                        }}
                    />
                </div>
            </div>
        );
    };

    // Return structure including Modals at root level
    return (
        <>
            {renderContent()}

            {statusModal.isOpen && (
                <Modal title="Změna stavu" onClose={() => setStatusModal({ isOpen: false, req: null })}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">Vyberte nový stav: <strong>{statusModal.req?.title}</strong></p>
                        <select className="w-full border p-2 rounded" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                            <option value="new">{t('status.new')}</option>
                            <option value="assigned">{t('status.assigned')}</option>
                            <option value="solved">{t('status.solved')}</option>
                            <option value="cancelled">{t('status.cancelled')}</option>
                        </select>
                        
                        {/* Warning when switching to NEW if solver assigned */}
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
        </>
    );
};
