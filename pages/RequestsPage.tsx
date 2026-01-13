
import React, { useState, useEffect, useMemo } from 'react';
import { db, api, isProductionDomain } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { Request, User, Technology, Supplier } from '../lib/types';
import { Loader, Plus, Filter, Download } from 'lucide-react';
import { Modal, AlertModal } from '../components/Shared';
import { RequestsTable } from '../components/requests/RequestsTable';
import { RequestForm } from '../components/requests/RequestForm';
import { RequestDetail } from '../components/requests/RequestDetail';
import { GalleryModal } from '../components/requests/modals/GalleryModal';
import { AssignModal } from '../components/requests/modals/AssignModal';
import { CancelModal } from '../components/requests/modals/CancelModal';
import { ApprovalModal } from '../components/requests/modals/ApprovalModal';
import { StatusModal } from '../components/requests/modals/StatusModal';
import { generateWorkListPDF } from '../lib/pdf';
import { getLocalized, prepareMultilingual } from '../lib/helpers';

interface RequestsPageProps {
    user: User;
    initialFilters?: any;
}

export const RequestsPage = ({ user, initialFilters }: RequestsPageProps) => {
    const { t, lang } = useI18n();
    const [loading, setLoading] = useState(false);
    
    // Data State
    const [requests, setRequests] = useState<Request[]>([]);
    const [technologies, setTechnologies] = useState<Technology[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [workplaces, setWorkplaces] = useState<any[]>([]);

    // View & Action States
    const [selectedRequest, setSelectedRequest] = useState<Request | null>(null); // Purely for Detail Modal
    const [editingRequest, setEditingRequest] = useState<Request | null>(null); // Purely for Edit Logic
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    
    // Action Modals State
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignTargetReq, setAssignTargetReq] = useState<Request | null>(null);
    const [assignDate, setAssignDate] = useState('');
    const [assignSolverId, setAssignSolverId] = useState('');

    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelTargetReq, setCancelTargetReq] = useState<Request | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [approvalTargetReq, setApprovalTargetReq] = useState<Request | null>(null);
    const [approvalHasLimit, setApprovalHasLimit] = useState(true);

    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [statusTargetReq, setStatusTargetReq] = useState<Request | null>(null);

    const [alertMsg, setAlertMsg] = useState<string | null>(null);

    // Form Data
    const emptyForm = { title: '', description: '', techId: '', priority: 'basic', estimatedCost: 0, estimatedTime: 0, photoUrls: [], assignedSupplierId: 'internal' };
    const [formData, setFormData] = useState<any>(emptyForm);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isUploading, setIsUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Filter State
    const [fTitle, setFTitle] = useState('');
    const [fTechIds, setFTechIds] = useState<string[]>([]);
    const [fDateResFrom, setFDateResFrom] = useState('');
    const [fDateResTo, setFDateResTo] = useState('');
    const [fSolverIds, setFSolverIds] = useState<string[]>([]);
    const [fSupplierIds, setFSupplierIds] = useState<string[]>([]);
    const [fStatusIds, setFStatusIds] = useState<string[]>([]);
    const [fPriorities, setFPriorities] = useState<string[]>([]);
    const [fApproved, setFApproved] = useState('all');
    const [fMaintenanceId, setFMaintenanceId] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Initialize filters from props
    useEffect(() => {
        if (initialFilters) {
            if (initialFilters.status) {
                const statuses = Array.isArray(initialFilters.status) ? initialFilters.status : [initialFilters.status];
                setFStatusIds(statuses);
            }
            if (initialFilters.solverId) setFSolverIds([initialFilters.solverId]);
            if (initialFilters.authorId) { /* Add author filter logic if needed, currently not in UI */ }
            if (initialFilters.mode === 'approval') setFApproved('pending');
            if (initialFilters.maintenanceId) {
                setFMaintenanceId(initialFilters.maintenanceId);
                setShowFilters(true); // Auto-show filters context
            }
            if (initialFilters.techId) setFTechIds([initialFilters.techId]);
            if (initialFilters.supplierId) {
                setFSupplierIds([initialFilters.supplierId]);
            }
            if (initialFilters.date) {
                setFDateResFrom(initialFilters.date);
                setFDateResTo(initialFilters.date);
            }
        }
    }, [initialFilters]);

    // Data Loading
    const loadData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

            if (isMock) {
                setRequests(db.requests.list());
                setTechnologies(db.technologies.list());
                setSuppliers(db.suppliers.list());
                setUsers(db.users.list());
                setLocations(db.locations.list());
                setWorkplaces(db.workplaces.list());
            } else {
                const [reqRes, techRes, supRes, userRes, locRes, wpRes] = await Promise.all([
                    api.get('/requests'),
                    api.get('/technologies'),
                    api.get('/suppliers'),
                    api.get('/users'),
                    api.get('/locations'),
                    api.get('/locations/workplaces')
                ]);
                setRequests(reqRes);
                setTechnologies(techRes);
                setSuppliers(supRes);
                setUsers(userRes);
                setLocations(locRes);
                setWorkplaces(wpRes);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // --- Actions ---

    // 1. Create / Edit Handlers
    const handleOpenCreate = () => {
        setFormData(emptyForm);
        setFormErrors({});
        setIsEditMode(false);
        setIsCreateOpen(true);
    };

    const handleOpenEdit = (req: Request) => {
        setFormData({
            title: req.title,
            description: req.description,
            techId: req.techId,
            priority: req.priority,
            estimatedCost: req.estimatedCost,
            estimatedTime: req.estimatedTime,
            photoUrls: req.photoUrls || [],
            assignedSupplierId: req.assignedSupplierId || 'internal',
            // Keep original data for non-editable fields in payload if needed
            plannedResolutionDate: req.plannedResolutionDate
        });
        setEditingRequest(req);
        setFormErrors({});
        setIsEditMode(true);
        setIsCreateOpen(true);
    };

    const handleSaveRequest = async () => {
        // Validation
        const errs: Record<string, string> = {};
        if (!formData.title) errs.title = t('validation.required');
        if (!formData.techId) errs.techId = t('validation.required');
        
        if (Object.keys(errs).length > 0) {
            setFormErrors(errs);
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            
            // Translate title and description
            const translatedTitle = await prepareMultilingual(formData.title);
            const translatedDesc = await prepareMultilingual(formData.description);

            const payload = {
                ...formData,
                title: translatedTitle,
                description: translatedDesc,
                authorId: user.id
            };

            if (isMock) {
                if (isEditMode && editingRequest) {
                    db.requests.update(editingRequest.id, payload);
                } else {
                    db.requests.add(payload);
                }
            } else {
                if (isEditMode && editingRequest) {
                    await api.put(`/requests/${editingRequest.id}`, payload);
                } else {
                    await api.post('/requests', payload);
                }
            }
            setIsCreateOpen(false);
            setEditingRequest(null);
            loadData();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
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
                    reader.onloadend = () => {
                        setFormData((prev: any) => ({ ...prev, photoUrls: [...prev.photoUrls, reader.result] }));
                        setIsUploading(false);
                    };
                    reader.readAsDataURL(file);
                } else {
                    const fd = new FormData();
                    fd.append('image', file);
                    const res = await fetch(`${api.baseUrl}/api/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: fd
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const fullUrl = data.url.startsWith('http') ? data.url : `${api.baseUrl}${data.url}`;
                        setFormData((prev: any) => ({ ...prev, photoUrls: [...prev.photoUrls, fullUrl] }));
                    }
                    setIsUploading(false);
                }
            } catch (e) { setIsUploading(false); }
        }
    };

    const removePhoto = (index: number) => {
        setFormData((prev: any) => ({ ...prev, photoUrls: prev.photoUrls.filter((_: any, i: number) => i !== index) }));
    };

    // 2. Assign / Take Over Logic
    const openAssignModal = (req: Request) => {
        setAssignTargetReq(req);
        // Prefill current date if empty
        setAssignDate(req.plannedResolutionDate ? req.plannedResolutionDate : new Date().toISOString().split('T')[0]);
        setAssignSolverId(req.solverId || ''); 
        setAssignModalOpen(true);
    };

    const handleAssignConfirm = async () => {
        if (!assignTargetReq || !assignDate || !assignSolverId) return;
        setLoading(true);
        try {
            const updates = { 
                solverId: assignSolverId, 
                plannedResolutionDate: assignDate,
                state: assignTargetReq.state === 'new' ? 'assigned' : assignTargetReq.state
            };
            await updateRequest(assignTargetReq.id, updates, 'assigned');
            setAssignModalOpen(false);
            loadData();
        } catch(e) { console.error(e); setLoading(false); }
    };

    const handleRemoveSolver = async () => {
        if (!assignTargetReq) return;
        setLoading(true);
        try {
            await updateRequest(assignTargetReq.id, { solverId: null, state: 'new' }, 'edited');
            setAssignModalOpen(false);
            loadData();
        } catch(e) { console.error(e); setLoading(false); }
    }

    // 3. Cancel Logic
    const openCancelModal = (req: Request) => {
        setCancelTargetReq(req);
        setCancelReason('');
        setCancelModalOpen(true);
    };

    const handleCancelConfirm = async () => {
        if (!cancelTargetReq || !cancelReason) return;
        setLoading(true);
        try {
            await updateRequest(cancelTargetReq.id, { 
                state: 'cancelled', 
                cancellationReason: cancelReason 
            }, 'status_change');
            setCancelModalOpen(false);
            loadData();
        } catch(e) { console.error(e); setLoading(false); }
    };

    // 4. Approval Logic
    const openApprovalModal = (req: Request) => {
        const tech = technologies.find(t => t.id === req.techId);
        const wp = workplaces.find(w => w.id === tech?.workplaceId);
        const locId = wp?.locationId;
        
        // Strict Check: User MUST have a limit for this location
        // AND the limit must be greater than or equal to the cost.
        let limit = 0;
        if (locId && user.approvalLimits && user.approvalLimits[locId] !== undefined) {
            limit = Number(user.approvalLimits[locId]);
        }
        
        const cost = Number(req.estimatedCost) || 0;
        const hasLimit = cost <= limit;

        setApprovalTargetReq(req);
        setApprovalHasLimit(hasLimit);
        setApprovalModalOpen(true);
    };

    const handleApprovalConfirm = async (approved: boolean) => {
        if (!approvalTargetReq) return;
        // Double check limit before action? UI prevents it via ApprovalModal state, 
        // but backend should also verify. For FE we rely on Modal state.
        if (!approvalHasLimit) {
            setAlertMsg(t('msg.approval_limit_exceeded'));
            setApprovalModalOpen(false);
            return;
        }

        setLoading(true);
        try {
            await updateRequest(approvalTargetReq.id, { isApproved: approved }, approved ? 'approved' : 'rejected');
            setApprovalModalOpen(false);
            loadData();
        } catch(e) { console.error(e); setLoading(false); }
    };

    // 5. Status Change Logic
    const openStatusModal = (req: Request) => {
        setStatusTargetReq(req);
        setStatusModalOpen(true);
    };

    const handleStatusConfirm = async (newStatus: string) => {
        if (!statusTargetReq) return;
        
        // Special logic: If changing to 'new', warn about removing solver (handled in Modal UI warning)
        const updates: any = { state: newStatus };
        if (newStatus === 'new') {
            updates.solverId = null;
        }

        setLoading(true);
        try {
            await updateRequest(statusTargetReq.id, updates, 'status_change');
            setStatusModalOpen(false);
            loadData();
        } catch(e) { console.error(e); setLoading(false); }
    };

    // Helper to update request
    const updateRequest = async (id: string, updates: any, action: string) => {
        const token = localStorage.getItem('auth_token');
        const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
        
        if (isMock) {
            db.requests.updateState(id, updates.state, updates.cancellationReason || '', user.id, updates);
        } else {
            // Append history entry
            const historyEntry = {
                date: new Date().toISOString(),
                userId: user.id,
                action: action,
                note: updates.cancellationReason || ''
            };
            
            // We need to fetch current history to append, or let backend handle it?
            // Current backend endpoint handles simple updates. Let's send history array update.
            const req = requests.find(r => r.id === id);
            const currentHistory = req ? req.history : [];
            const newHistory = [...currentHistory, historyEntry];

            await api.put(`/requests/${id}`, { ...updates, history: newHistory });
        }
    };

    // --- PDF Export ---
    const handleExportPDF = () => {
        generateWorkListPDF(filteredRequests, user, 'Filtered List', t, lang, technologies, suppliers, users);
    };

    // --- Filtering Logic ---
    const filteredRequests = useMemo(() => {
        return requests.filter(r => {
            if (fTitle && !getLocalized(r.title, lang).toLowerCase().includes(fTitle.toLowerCase())) return false;
            
            if (fTechIds.length > 0 && !fTechIds.includes(r.techId)) return false;
            
            if (fDateResFrom && (!r.plannedResolutionDate || r.plannedResolutionDate < fDateResFrom)) return false;
            if (fDateResTo && (!r.plannedResolutionDate || r.plannedResolutionDate > fDateResTo)) return false;
            
            if (fSolverIds.length > 0) {
                // If filtering for "Unassigned" (you might add a specific ID for that or handle empty solverId)
                // Assuming fSolverIds contains user IDs.
                if (!r.solverId || !fSolverIds.includes(r.solverId)) return false;
            }

            // Status Filter
            if (fStatusIds.length > 0 && !fStatusIds.includes(r.state)) return false;

            // Priority Filter
            if (fPriorities.length > 0 && !fPriorities.includes(r.priority)) return false;

            // Supplier Filter
            if (fSupplierIds.length > 0) {
                const effectiveSupplierId = r.assignedSupplierId || 
                    technologies.find(t => t.id === r.techId)?.supplierId || 'internal';
                
                // Special "External" group logic
                if (fSupplierIds.includes('external')) {
                    // Match if it is NOT internal
                    if (effectiveSupplierId !== 'internal') {
                        // Keep it (unless specific suppliers are also selected and it doesn't match them? 
                        // Simplified: If 'external' is selected, show all externals. If specific supplier selected, show that.)
                        // For MultiSelect, usually OR logic within the same category.
                        // If we have [external, sup1], we show (isExternal OR isSup1).
                        // Since sup1 is external, this is redundant but safe.
                        return true; 
                    }
                    // If it is internal, check if 'internal' is also in the filter list
                    if (!fSupplierIds.includes('internal')) return false;
                } else {
                    // Normal check
                    if (!fSupplierIds.includes(effectiveSupplierId)) return false;
                }
            }

            if (fApproved !== 'all') {
                if (fApproved === 'yes' && !r.isApproved) return false;
                if (fApproved === 'no' && r.isApproved) return false;
                if (fApproved === 'pending') {
                    // Pending = Not Approved AND Active AND (Cost > 0)
                    if (r.isApproved) return false;
                    if (r.state === 'solved' || r.state === 'cancelled') return false;
                    if ((r.estimatedCost || 0) <= 0) return false; // No approval needed if cost is 0
                }
            }

            if (fMaintenanceId && r.maintenanceId !== fMaintenanceId) return false;

            return true;
        });
    }, [requests, fTitle, fTechIds, fDateResFrom, fDateResTo, fSolverIds, fSupplierIds, fStatusIds, fPriorities, fApproved, fMaintenanceId, lang, technologies]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Reset pagination when filters change
    useEffect(() => { setCurrentPage(1); }, [filteredRequests.length]);

    if (loading && requests.length === 0) return <div className="p-10 flex justify-center"><Loader className="animate-spin w-8 h-8 text-blue-600"/></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">{t('menu.requests')}</h2>
                <div className="flex gap-2">
                    <button 
                        onClick={handleExportPDF} 
                        className="px-3 py-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 flex items-center shadow-sm"
                        title="Exportovat seznam do PDF"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 rounded border ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}>
                         <Filter className="w-5 h-5" />
                    </button>
                    <button onClick={handleOpenCreate} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                        <Plus className="w-4 h-4 mr-2" /> {t('headers.new_request')}
                    </button>
                </div>
            </div>

            {fMaintenanceId && (
                <div className="bg-purple-50 text-purple-800 p-3 rounded border border-purple-200 flex justify-between items-center text-sm">
                    <span>Filtrováno dle údržby (ID: {fMaintenanceId})</span>
                    <button onClick={() => setFMaintenanceId(null)} className="text-purple-600 hover:underline">Zrušit</button>
                </div>
            )}

            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                <RequestsTable 
                    requests={filteredRequests}
                    currentUser={user}
                    technologies={technologies}
                    suppliers={suppliers}
                    users={users}
                    workplaces={workplaces}
                    onDetail={(r) => setSelectedRequest(r)}
                    onEdit={handleOpenEdit}
                    onCancel={openCancelModal}
                    onTakeOver={openAssignModal}
                    onApproval={openApprovalModal}
                    onStatusChange={openStatusModal}
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
                        fApproved, setFApproved,
                        fMaintenanceId, setFMaintenanceId
                    }}
                    showFilters={showFilters}
                />
            </div>

            {/* Modals */}
            {isCreateOpen && (
                <Modal title={isEditMode ? t('common.edit') : t('headers.new_request')} onClose={() => setIsCreateOpen(false)}>
                    <RequestForm 
                        formData={formData} 
                        setFormData={setFormData} 
                        errors={formErrors}
                        user={user}
                        locations={locations}
                        workplaces={workplaces}
                        technologies={technologies}
                        handleImageUpload={handleImageUpload}
                        removePhoto={removePhoto}
                        isEditMode={isEditMode}
                        isUploading={isUploading}
                    />
                    <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
                        <button onClick={() => setIsCreateOpen(false)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                        <button onClick={handleSaveRequest} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center">
                            {saving && <Loader className="animate-spin w-4 h-4 mr-2" />} {t('common.save')}
                        </button>
                    </div>
                </Modal>
            )}

            {selectedRequest && (
                <Modal title={t('headers.request_detail')} onClose={() => setSelectedRequest(null)}>
                    <div className="max-h-[80vh] overflow-y-auto -m-4">
                        <RequestDetail 
                            request={selectedRequest}
                            currentUser={user}
                            technologies={technologies}
                            onBack={() => setSelectedRequest(null)}
                            onGallery={() => {}} // Gallery handled inside detail if needed or pass handler
                            renderStatusBadge={(s) => <span className="font-bold uppercase">{s}</span>}
                            renderPrioBadge={(p) => <span className="font-bold uppercase">{p}</span>}
                            refresh={loadData}
                        />
                    </div>
                </Modal>
            )}

            {assignModalOpen && assignTargetReq && (
                <AssignModal 
                    isOpen={assignModalOpen} 
                    onClose={() => setAssignModalOpen(false)} 
                    onConfirm={handleAssignConfirm}
                    onRemove={handleRemoveSolver} // Pass remove handler
                    assignDate={assignDate} 
                    setAssignDate={setAssignDate} 
                    assignSolverId={assignSolverId} 
                    setAssignSolverId={setAssignSolverId}
                    candidates={users.filter(u => u.role !== 'operator' && !u.isBlocked)} 
                    currentUser={user}
                    isAlreadyAssigned={!!assignTargetReq.solverId} // Pass if already assigned
                />
            )}

            {cancelModalOpen && cancelTargetReq && (
                <CancelModal 
                    isOpen={cancelModalOpen} 
                    onClose={() => setCancelModalOpen(false)} 
                    onConfirm={handleCancelConfirm} 
                    reason={cancelReason} 
                    setReason={setCancelReason} 
                    error={''}
                />
            )}

            {approvalModalOpen && approvalTargetReq && (
                <ApprovalModal 
                    request={approvalTargetReq} 
                    technologies={technologies} 
                    hasSufficientLimit={approvalHasLimit} 
                    onClose={() => setApprovalModalOpen(false)} 
                    onApprove={handleApprovalConfirm} 
                />
            )}

            {statusModalOpen && statusTargetReq && (
                <StatusModal 
                    isOpen={statusModalOpen}
                    onClose={() => setStatusModalOpen(false)}
                    onConfirm={handleStatusConfirm}
                    currentStatus={statusTargetReq.state}
                />
            )}

            {alertMsg && <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
        </div>
    );
};
