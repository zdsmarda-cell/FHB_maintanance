import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { Request, User, Technology, Supplier } from '../lib/types';
import { Loader, Plus, Filter, Download } from 'lucide-react';
import { Modal } from '../components/Shared';
import { RequestsTable } from '../components/requests/RequestsTable';
import { RequestForm } from '../components/requests/RequestForm';
import { RequestDetail } from '../components/requests/RequestDetail';
import { GalleryModal } from '../components/requests/modals/GalleryModal';
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

    // View State
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

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
    const [fApproved, setFApproved] = useState<'all' | 'yes' | 'no'>('all');
    const [fAuthorId, setFAuthorId] = useState('');
    const [fMaintenanceId, setFMaintenanceId] = useState<string | null>(null);
    
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Gallery
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);

    // Apply Initial Filters
    useEffect(() => {
        if (initialFilters) {
            if (initialFilters.status) setFStatusIds(Array.isArray(initialFilters.status) ? initialFilters.status : [initialFilters.status]);
            if (initialFilters.solverId) setFSolverIds([initialFilters.solverId]);
            if (initialFilters.authorId) setFAuthorId(initialFilters.authorId);
            if (initialFilters.techId) setFTechIds([initialFilters.techId]);
            if (initialFilters.maintenanceId) setFMaintenanceId(initialFilters.maintenanceId);
            if (initialFilters.mode === 'approval') setFApproved('no');
            if (initialFilters.date) {
                setFDateResFrom(initialFilters.date);
                setFDateResTo(initialFilters.date);
            }
            if (initialFilters.supplierId) {
                if (initialFilters.supplierId === 'internal' || initialFilters.supplierId === 'external') {
                    setFSupplierIds([initialFilters.supplierId]);
                } else {
                    setFSupplierIds([initialFilters.supplierId]);
                }
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
                const [reqs, techs, sups, usrs, locs, wps] = await Promise.all([
                    api.get('/requests'),
                    api.get('/technologies'),
                    api.get('/suppliers'),
                    api.get('/users'),
                    api.get('/locations'),
                    api.get('/locations/workplaces')
                ]);
                setRequests(reqs);
                setTechnologies(techs);
                setSuppliers(sups);
                setUsers(usrs);
                setLocations(locs);
                setWorkplaces(wps);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // --- Actions ---

    const handleOpenCreate = () => {
        setFormData({...emptyForm, authorId: user.id});
        setFormErrors({});
        setIsEditMode(false);
        setIsCreateOpen(true);
    };

    const handleEditRequest = () => {
        if (!selectedRequest) return;
        setFormData({
            ...selectedRequest,
            title: getLocalized(selectedRequest.title, lang),
            description: getLocalized(selectedRequest.description, lang)
        });
        setFormErrors({});
        setIsEditMode(true);
        setIsCreateOpen(true);
    };

    const validateForm = () => {
        const errs: Record<string, string> = {};
        if (!formData.title) errs.title = t('validation.required');
        if (!formData.techId) errs.techId = t('validation.required');
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            
            // Translate Text Fields
            const translatedTitle = await prepareMultilingual(formData.title);
            const translatedDesc = await prepareMultilingual(formData.description);
            const payload = { ...formData, title: translatedTitle, description: translatedDesc };

            if (isMock) {
                if (isEditMode && selectedRequest) {
                    db.requests.update(selectedRequest.id, payload);
                } else {
                    db.requests.add(payload);
                }
            } else {
                if (isEditMode && selectedRequest) {
                    await api.put(`/requests/${selectedRequest.id}`, payload);
                } else {
                    await api.post('/requests', payload);
                }
            }
            setIsCreateOpen(false);
            if (isEditMode) setSelectedRequest(null); // Close detail if editing
            loadData();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleRowClick = (req: Request) => {
        setSelectedRequest(req);
        setView('detail');
    };

    const handleAction = async (action: string, data?: any) => {
        if (!selectedRequest) return;
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            
            let updates: any = {};
            
            if (action === 'cancel') {
                updates = { state: 'cancelled', cancellationReason: data };
            } else if (action === 'solve') {
                updates = { state: 'solved' };
            } else if (action === 'approve') {
                updates = { isApproved: data };
            } else if (action === 'assign') {
                // If data (userId) passed, assign to user. If null, assign to self.
                const solverId = data || user.id;
                // If it's a takeover (reassign), we assume the date is passed in data if it's an object, but simple takeover assumes self.
                // The AssignModal handles complex assignment. This is for quick actions.
                updates = { solverId: solverId, state: 'assigned' };
            }

            if (isMock) {
                db.requests.updateState(selectedRequest.id, updates.state || selectedRequest.state, updates.cancellationReason || '', user.id, updates);
            } else {
                await api.put(`/requests/${selectedRequest.id}`, updates);
            }
            
            loadData();
            setSelectedRequest(null);
            setView('list');
        } catch (e) {
            console.error(e);
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
                        setFormData({ ...formData, photoUrls: [...(formData.photoUrls || []), reader.result as string] });
                        setIsUploading(false);
                    };
                    reader.readAsDataURL(file);
                } else {
                    const formPayload = new FormData();
                    formPayload.append('image', file);
                    const response = await fetch(`${api.baseUrl}/api/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formPayload
                    });
                    if (response.ok) {
                        const resData = await response.json();
                        const fullUrl = resData.url.startsWith('http') ? resData.url : `${api.baseUrl}${resData.url}`;
                        setFormData({ ...formData, photoUrls: [...(formData.photoUrls || []), fullUrl] });
                    }
                    setIsUploading(false);
                }
            } catch (error) { setIsUploading(false); }
        }
    };

    const handleExportPDF = async () => {
        // Simple export of current view
        await generateWorkListPDF(requests, user, 'All Requests', t, lang, technologies, suppliers, users);
    };

    const openGallery = (photos: string[], e: React.MouseEvent) => {
        e.stopPropagation();
        if (photos && photos.length > 0) {
            setGalleryImages(photos);
            setGalleryIndex(0);
            setIsGalleryOpen(true);
        }
    };

    // --- Render ---

    if (loading && requests.length === 0) return <div className="p-10 flex justify-center"><Loader className="animate-spin w-8 h-8 text-blue-600"/></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-800">{t('menu.requests')}</h2>
                    {fMaintenanceId && (
                        <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded border border-purple-200">
                            Filtrováno dle údržby
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 rounded border ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}>
                         <Filter className="w-5 h-5" />
                    </button>
                    <button onClick={handleExportPDF} className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-50" title="Exportovat seznam do PDF">
                        <Download className="w-5 h-5" />
                    </button>
                    <button onClick={handleOpenCreate} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                        <Plus className="w-4 h-4 mr-2" /> {t('headers.new_request')}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                <RequestsTable 
                    requests={requests}
                    currentUser={user}
                    technologies={technologies}
                    suppliers={suppliers}
                    users={users}
                    onRowClick={handleRowClick}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                    showFilters={showFilters}
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
                        fAuthorId, setFAuthorId,
                        fMaintenanceId, setFMaintenanceId
                    }}
                />
            </div>

            {/* Detail Modal */}
            {selectedRequest && (
                <Modal title={t('headers.request_detail')} onClose={() => setSelectedRequest(null)}>
                    <div className="max-h-[85vh] overflow-y-auto -m-4">
                        <RequestDetail 
                            request={selectedRequest}
                            currentUser={user}
                            technologies={technologies}
                            onBack={() => setSelectedRequest(null)}
                            onEdit={handleEditRequest}
                            onSolve={() => handleAction('solve')}
                            onAssign={() => handleAction('assign')} // Quick self-assign
                            onUnassign={() => handleAction('assign', null)} 
                            onCancel={(reason) => handleAction('cancel', reason)}
                            onApproveChange={(val) => handleAction('approve', val)}
                            onGallery={openGallery}
                            renderStatusBadge={(s) => <span className="font-bold uppercase">{t(`status.${s}`)}</span>}
                            renderPrioBadge={(p) => <span className="font-bold uppercase">{t(`prio.${p}`)}</span>}
                            refresh={loadData}
                        />
                    </div>
                </Modal>
            )}

            {/* Create/Edit Modal */}
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
                        removePhoto={(i) => setFormData({...formData, photoUrls: formData.photoUrls.filter((_:any, idx:number) => idx !== i)})}
                        isEditMode={isEditMode}
                        isUploading={isUploading}
                    />
                    <div className="flex justify-end pt-4 border-t mt-4 gap-2">
                        <button onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">{t('common.cancel')}</button>
                        <button onClick={handleSave} disabled={saving || isUploading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center">
                            {saving && <Loader className="animate-spin w-4 h-4 mr-2" />} {t('common.save')}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Gallery Modal */}
            {isGalleryOpen && (
                <GalleryModal 
                    images={galleryImages}
                    currentIndex={galleryIndex}
                    onClose={() => setIsGalleryOpen(false)}
                    onNext={(e) => { e.stopPropagation(); setGalleryIndex((prev) => (prev + 1) % galleryImages.length); }}
                    onPrev={(e) => { e.stopPropagation(); setGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length); }}
                />
            )}
        </div>
    );
};