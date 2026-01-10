
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { User, Maintenance, Technology, Supplier, Location, Workplace } from '../lib/types';
import { Plus, Filter, ArrowLeft, Edit, Loader, X, Trash, Calendar, List, Zap } from 'lucide-react';
import { Modal, ConfirmModal } from '../components/Shared';

interface MaintenancePageProps {
    user: User;
    onNavigate: (page: string, params?: any) => void;
}

export const MaintenancePage = ({ user, onNavigate }: MaintenancePageProps) => {
    const { t } = useI18n();
    
    // --- Data States ---
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState<Maintenance[]>([]);
    const [technologies, setTechnologies] = useState<Technology[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [workplaces, setWorkplaces] = useState<Workplace[]>([]);

    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedTemplate, setSelectedTemplate] = useState<Maintenance | null>(null);

    // Filter States
    const [filters, setFilters] = useState({
        techName: '',
        supplierId: '',
        responsiblePersonId: ''
    });
    const [showFilters, setShowFilters] = useState(user.role !== 'operator');

    // Delete State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // Run Now State
    const [runNowTemplate, setRunNowTemplate] = useState<Maintenance | null>(null);

    const refresh = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

            if (isMock) {
                setTemplates(db.maintenances.list());
                setTechnologies(db.technologies.list());
                setSuppliers(db.suppliers.list());
                setUsers(db.users.list());
                setLocations(db.locations.list());
                setWorkplaces(db.workplaces.list());
            } else {
                const [maintData, techData, supData, userData, locData, wpData] = await Promise.all([
                    api.get('/maintenance'),
                    api.get('/technologies'),
                    api.get('/suppliers'),
                    api.get('/users'),
                    api.get('/locations'),
                    api.get('/locations/workplaces')
                ]);
                setTemplates(maintData);
                setTechnologies(techData);
                setSuppliers(supData);
                setUsers(userData);
                setLocations(locData);
                setWorkplaces(wpData);
            }
        } catch (e) {
            console.error("Failed to load maintenance data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const resetFilters = () => {
        setFilters({
            techName: '',
            supplierId: '',
            responsiblePersonId: ''
        });
    };

    const handleRowClick = (m: Maintenance) => {
        setSelectedTemplate(m);
        setView('detail');
    };

    const handleDelete = async () => {
        if (!selectedTemplate) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

            if (isMock) {
                const current = db.maintenances.list().filter(x => x.id !== selectedTemplate.id);
                localStorage.setItem('tmp_maintenances', JSON.stringify(current));
            } else {
                await api.delete(`/maintenance/${selectedTemplate.id}`);
            }
            setShowDeleteConfirm(false);
            setSelectedTemplate(null);
            setView('list');
            refresh();
        } catch (e) {
            console.error("Delete Error", e);
        } finally {
            setLoading(false);
        }
    };

    const handleRunNow = async () => {
        if (!runNowTemplate) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

            if (isMock) {
                // Mock implementation: just create request and update maintenance
                const req = {
                    techId: runNowTemplate.techId,
                    maintenanceId: runNowTemplate.id,
                    title: runNowTemplate.title,
                    authorId: user.id,
                    solverId: runNowTemplate.responsiblePersonIds?.[0] || '',
                    state: runNowTemplate.responsiblePersonIds?.length > 0 ? 'assigned' : 'new',
                    priority: 'priority',
                    description: runNowTemplate.description,
                    plannedResolutionDate: new Date().toISOString().split('T')[0]
                };
                db.requests.add(req);
                db.maintenances.update(runNowTemplate.id, { lastGeneratedDate: new Date().toISOString() });
            } else {
                await api.post(`/maintenance/${runNowTemplate.id}/run`, {});
            }
            setRunNowTemplate(null);
            refresh();
        } catch (e) {
            console.error("Run Now Error", e);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Next Run Logic (mirrors worker logic)
    const calculateNextRun = (m: Maintenance) => {
        if (!m.isActive) return null;
        
        const baseDateStr = m.lastGeneratedDate || m.createdAt;
        const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
        baseDate.setHours(0,0,0,0);

        // Theoretical next date
        const nextDate = new Date(baseDate);
        nextDate.setDate(baseDate.getDate() + m.interval);

        // Check allowed days
        let targetDate = new Date(nextDate);
        let safetyCounter = 0;
        const allowedDays = m.allowedDays || [];

        // If no allowed days specified, assume all? Usually defaults to [1..5]
        if (allowedDays.length === 0) return targetDate;

        while (safetyCounter < 30) {
            const day = targetDate.getDay();
            if (allowedDays.includes(day)) {
                return targetDate;
            }
            targetDate.setDate(targetDate.getDate() + 1);
            safetyCounter++;
        }
        return targetDate;
    };

    // Filter Logic
    const filteredTemplates = templates.filter(m => {
        // Operator Restriction Logic
        if (user.role === 'operator') {
            const tech = technologies.find(t => t.id === m.techId);
            if (!tech) return false;
            
            // Check if tech belongs to a workplace/location accessible by the operator
            const workplace = workplaces.find(w => w.id === tech.workplaceId);
            if (!workplace) return false;

            const hasAccess = 
                (user.assignedWorkplaceIds || []).includes(workplace.id) || 
                (user.assignedLocationIds || []).includes(workplace.locationId);
            
            if (!hasAccess) return false;
        }

        const tech = technologies.find(t => t.id === m.techId);
        if (filters.techName && !tech?.name.toLowerCase().includes(filters.techName.toLowerCase())) return false;
        if (filters.supplierId && m.supplierId !== filters.supplierId) return false;
        if (filters.responsiblePersonId) { if (!m.responsiblePersonIds?.includes(filters.responsiblePersonId)) return false; }
        return true;
    });

    const renderActiveBadge = (isActive: boolean) => {
        return isActive 
            ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{t('status.planned')}</span>
            : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{t('status.done')}</span>
    };

    // --- MODALS STATES ---
    const [isCreateOpen, setIsCreateOpen] = useState(false); 
    const [editingId, setEditingId] = useState<string | null>(null);
    
    // --- FORM STATES ---
    const [selectedLocId, setSelectedLocId] = useState('');
    const [selectedWpId, setSelectedWpId] = useState('');
    const [maintForm, setMaintForm] = useState<Partial<Maintenance>>({
        title: '', techId: '', supplierId: '', responsiblePersonIds: [],
        description: '', interval: 30, allowedDays: [1,2,3,4,5], isActive: true
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    // --- CRUD OPERATIONS ---
    const openCreateModal = () => {
        setEditingId(null);
        setMaintForm({
            title: '', techId: '', supplierId: '', responsiblePersonIds: [],
            description: '', interval: 30, allowedDays: [1,2,3,4,5], isActive: true
        });
        setSelectedLocId(''); setSelectedWpId('');
        setErrors({});
        setIsCreateOpen(true);
    };

    const openEditModal = (m: Maintenance) => {
        setEditingId(m.id);
        setMaintForm(m);
        // Pre-fill location/workplace selectors based on techId
        const tech = technologies.find(t => t.id === m.techId);
        if (tech) {
            const wp = workplaces.find(w => w.id === tech.workplaceId);
            if (wp) {
                setSelectedWpId(wp.id);
                setSelectedLocId(wp.locationId);
            }
        }
        setErrors({});
        setIsCreateOpen(true);
    };

    // --- VALIDATION LOGIC ---
    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!maintForm.techId) newErrors.techId = t('validation.required');
        if (!maintForm.title) newErrors.title = t('validation.required');
        if (!maintForm.interval || maintForm.interval < 1) newErrors.interval = t('validation.required');
        if (!maintForm.allowedDays || maintForm.allowedDays.length === 0) newErrors.allowedDays = t('validation.required');

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

            if (isMock) {
                if (editingId) {
                    db.maintenances.update(editingId, maintForm);
                } else {
                    db.maintenances.add(maintForm as Omit<Maintenance, 'id'>);
                }
            } else {
                if (editingId) {
                    await api.put(`/maintenance/${editingId}`, maintForm);
                } else {
                    await api.post('/maintenance', maintForm);
                }
            }
            setIsCreateOpen(false);
            refresh();
            if (view === 'detail' && editingId) {
                // Update selected template in view if we just edited it
                const updated = { ...selectedTemplate, ...maintForm } as Maintenance;
                setSelectedTemplate(updated);
            }
        } catch (e) {
            console.error("Save Error", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading && templates.length === 0) return <div className="p-10 flex justify-center"><Loader className="animate-spin w-8 h-8 text-blue-600"/></div>;

    // --- VIEW RENDER ---
    if (view === 'detail' && selectedTemplate) {
        const tech = technologies.find(t => t.id === selectedTemplate.techId);
        const supplier = suppliers.find(s => s.id === selectedTemplate.supplierId);
        const responsibleNames = selectedTemplate.responsiblePersonIds
            ?.map(id => users.find(u => u.id === id)?.name).filter(Boolean).join(', ');
        
        const canEditMaint = user.role !== 'operator';
        const dayNames = selectedTemplate.allowedDays.sort().map(d => t(`day.${d}`)).join(', ');
        
        const nextRun = calculateNextRun(selectedTemplate);

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                     <button onClick={() => setView('list')} className="text-blue-600 hover:underline flex items-center">
                        <ArrowLeft className="w-4 h-4 mr-1"/> {t('common.back')}
                     </button>
                     <div className="flex gap-2">
                        {canEditMaint && (
                            <>
                                <button onClick={() => setRunNowTemplate(selectedTemplate)} className="bg-amber-100 text-amber-700 px-3 py-2 rounded flex items-center hover:bg-amber-200 border border-amber-200">
                                    <Zap className="w-4 h-4 mr-2" /> Vytvořit ihned
                                </button>
                                <button onClick={() => openEditModal(selectedTemplate)} className="bg-slate-200 text-slate-700 px-3 py-2 rounded flex items-center hover:bg-slate-300">
                                    <Edit className="w-4 h-4 mr-2" /> {t('common.edit')}
                                </button>
                                <button onClick={() => setShowDeleteConfirm(true)} className="bg-red-50 text-red-700 px-3 py-2 rounded flex items-center hover:bg-red-100 border border-red-200">
                                    <Trash className="w-4 h-4 mr-2" /> {t('common.delete')}
                                </button>
                            </>
                        )}
                     </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-6">
                        <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">{selectedTemplate.title}</h2>
                                    <div className="text-slate-500 mt-1">{tech?.name || 'Neznámá technologie'}</div>
                                </div>
                                {renderActiveBadge(selectedTemplate.isActive)}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-6">
                                <div><span className="text-slate-500 block">{t('form.interval')}</span> {selectedTemplate.interval} {t('common.days')}</div>
                                <div><span className="text-slate-500 block">{t('form.allowed_days')}</span> {dayNames}</div>
                                <div><span className="text-slate-500 block">{t('form.supplier')}</span> {supplier ? supplier.name : <span className="text-slate-400 italic">Interní řešení</span>}</div>
                                <div><span className="text-slate-500 block">{t('form.responsible_person')}</span> {responsibleNames || <span className="text-slate-400 italic">Nepřiřazeno</span>}</div>
                                <div><span className="text-slate-500 block">Poslední generování</span> {selectedTemplate.lastGeneratedDate ? new Date(selectedTemplate.lastGeneratedDate).toLocaleDateString() : '-'}</div>
                                <div>
                                    <span className="text-slate-500 block">Příští generování</span>
                                    <span className="font-bold text-slate-800 flex items-center gap-2">
                                        {nextRun ? nextRun.toLocaleDateString() : 'Neaktivní'}
                                        {nextRun && nextRun <= new Date() && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded">Dnes/Zítra</span>}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="mt-4 border-t pt-4">
                                <button 
                                    onClick={() => onNavigate('requests', { maintenanceId: selectedTemplate.id })}
                                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded transition-colors w-full md:w-auto justify-center"
                                >
                                    <List className="w-4 h-4" /> 
                                    Zobrazit {selectedTemplate.generatedRequestCount} vygenerovaných požadavků
                                </button>
                            </div>

                            <div className="mt-6">
                                <h4 className="font-bold text-sm text-slate-700 mb-2">{t('form.description')}</h4>
                                <p className="text-slate-600 bg-slate-50 p-3 rounded">{selectedTemplate.description || '-'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modals are handled at bottom of component */}
                {isCreateOpen && (
                    <MaintModal 
                        isOpen={isCreateOpen} 
                        onClose={() => setIsCreateOpen(false)} 
                        data={maintForm} 
                        setData={setMaintForm} 
                        isEdit={!!editingId}
                        onSave={handleSave}
                        selectedLocId={selectedLocId}
                        setSelectedLocId={setSelectedLocId}
                        selectedWpId={selectedWpId}
                        setSelectedWpId={setSelectedWpId}
                        errors={errors}
                        t={t}
                        locations={locations}
                        workplaces={workplaces}
                        technologies={technologies}
                        suppliers={suppliers}
                        users={users}
                    />
                )}

                {showDeleteConfirm && (
                    <ConfirmModal 
                        message={t('msg.confirm_delete')} 
                        onConfirm={handleDelete} 
                        onCancel={() => setShowDeleteConfirm(false)} 
                    />
                )}

                {runNowTemplate && (
                    <RunNowModal 
                        template={runNowTemplate} 
                        onConfirm={handleRunNow} 
                        onCancel={() => setRunNowTemplate(null)}
                        nextRunDate={calculateNextRun(runNowTemplate)}
                    />
                )}
            </div>
        );
    }

    // --- LIST VIEW ---
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">{t('headers.maintenance_plan')}</h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 rounded border ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}>
                         <Filter className="w-5 h-5" />
                    </button>
                    {user.role !== 'operator' && (
                        <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                            <Plus className="w-4 h-4 mr-2" /> {t('headers.new_maintenance')}
                        </button>
                    )}
                </div>
            </div>

            {/* Filters Toolbar */}
            {showFilters && (
                <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-sm">
                    <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-slate-700">{t('common.filter')}</span>
                        <button onClick={resetFilters} className="text-xs text-blue-600 hover:underline">Reset</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Název technologie</label>
                            <input className="w-full p-1.5 border rounded" value={filters.techName} onChange={e => setFilters({...filters, techName: e.target.value})} />
                        </div>
                        <div>
                             <label className="block text-xs text-slate-500 mb-1">{t('form.supplier')} / {t('form.responsible_person')}</label>
                             <select className="w-full p-1.5 border rounded" value={filters.supplierId} onChange={e => setFilters({...filters, supplierId: e.target.value})}>
                                <option value="">{t('common.all')}</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                             </select>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded shadow-sm border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-3 whitespace-nowrap">Technologie</th>
                                <th className="px-4 py-3 whitespace-nowrap">S.N.</th>
                                <th className="px-4 py-3 whitespace-nowrap">{t('form.interval')}</th>
                                <th className="px-4 py-3 whitespace-nowrap">Generování</th>
                                <th className="px-4 py-3 whitespace-nowrap">{t('col.open_requests')}</th>
                                <th className="px-4 py-3 whitespace-nowrap">{t('common.status')}</th>
                                <th className="px-4 py-3 whitespace-nowrap">{t('form.supplier')}</th>
                                <th className="px-4 py-3 whitespace-nowrap">{t('form.responsible_person')}</th>
                                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTemplates.length === 0 ? (
                                <tr><td colSpan={9} className="p-4 text-center text-slate-400">Žádné šablony údržby</td></tr>
                            ) : (
                                filteredTemplates.map(m => {
                                    const tech = technologies.find(t => t.id === m.techId);
                                    const supplier = suppliers.find(s => s.id === m.supplierId);
                                    const responsibleNames = m.responsiblePersonIds
                                        ?.map(id => users.find(u => u.id === id)?.name).filter(Boolean).join(', ');
                                    const nextRun = calculateNextRun(m);

                                    return (
                                        <tr key={m.id} onClick={() => handleRowClick(m)} className="border-b hover:bg-slate-50 cursor-pointer">
                                            <td className="px-4 py-3 font-medium whitespace-nowrap">{tech?.name || 'Neznámá technologie'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{tech?.serialNumber || '-'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{m.interval} {t('common.days')}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {nextRun ? nextRun.toLocaleDateString() : '-'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-center">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onNavigate('requests', { maintenanceId: m.id }); }}
                                                    className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-medium border border-blue-100"
                                                    title="Zobrazit požadavky"
                                                >
                                                    <List className="w-3 h-3 mr-1" /> {m.generatedRequestCount || 0}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">{renderActiveBadge(m.isActive)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{supplier?.name || '-'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap max-w-[200px] truncate" title={responsibleNames}>{responsibleNames || '-'}</td>
                                            <td className="px-4 py-3 text-right">
                                                {user.role !== 'operator' && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setRunNowTemplate(m); }}
                                                        className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-full transition-colors"
                                                        title="Vytvořit požadavek ihned"
                                                    >
                                                        <Zap className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isCreateOpen && (
                <MaintModal 
                    isOpen={isCreateOpen} 
                    onClose={() => setIsCreateOpen(false)} 
                    data={maintForm} 
                    setData={setMaintForm} 
                    isEdit={!!editingId}
                    onSave={handleSave}
                    selectedLocId={selectedLocId}
                    setSelectedLocId={setSelectedLocId}
                    selectedWpId={selectedWpId}
                    setSelectedWpId={setSelectedWpId}
                    errors={errors}
                    t={t}
                    locations={locations}
                    workplaces={workplaces}
                    technologies={technologies}
                    suppliers={suppliers}
                    users={users}
                />
            )}

            {runNowTemplate && (
                <RunNowModal 
                    template={runNowTemplate} 
                    onConfirm={handleRunNow} 
                    onCancel={() => setRunNowTemplate(null)}
                    nextRunDate={calculateNextRun(runNowTemplate)}
                />
            )}
        </div>
    );
};

const RunNowModal = ({ template, onConfirm, onCancel, nextRunDate }: any) => {
    return (
        <Modal title="Okamžité vytvoření požadavku" onClose={onCancel}>
            <div className="space-y-4">
                <div className="bg-amber-50 p-3 rounded border border-amber-100 text-sm text-amber-800">
                    <p className="font-bold mb-1 flex items-center"><Zap className="w-4 h-4 mr-1"/> Mimořádné spuštění</p>
                    <p>Chystáte se manuálně vytvořit požadavek pro šablonu: <strong>{template.title}</strong>.</p>
                </div>
                
                <div className="text-sm text-slate-600">
                    <p className="mb-2">Standardní termín dalšího generování by byl: <strong>{nextRunDate ? nextRunDate.toLocaleDateString() : 'Není naplánováno'}</strong>.</p>
                    <p>Pokud vytvoříte požadavek nyní, interval pro další automatické generování se přepočítá od dnešního data.</p>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Zrušit</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center">
                        <Zap className="w-4 h-4 mr-1" /> Vytvořit ihned
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// Refactored Modal for better readability (Same as before)
const MaintModal = ({ 
    isOpen, onClose, data, setData, isEdit, onSave, 
    selectedLocId, setSelectedLocId, selectedWpId, setSelectedWpId, errors, t,
    locations, workplaces, technologies, suppliers, users
}: any) => {
    
    const toggleAllowedDay = (day: number) => {
        const currentDays = data.allowedDays || [];
        const newDays = currentDays.includes(day) 
            ? currentDays.filter((d:number) => d !== day) 
            : [...currentDays, day];
        setData({...data, allowedDays: newDays});
    }

    return (
    <Modal title={isEdit ? t('headers.edit_maintenance') : t('headers.new_maintenance')} onClose={onClose}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto p-1">
            {!isEdit && (
                <div className="col-span-2 space-y-3 p-3 bg-slate-50 rounded border border-slate-100">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.location')}</label>
                            <select 
                                className="w-full p-2 rounded border" 
                                value={selectedLocId} 
                                onChange={e => { setSelectedLocId(e.target.value); setSelectedWpId(''); setData({...data, techId: ''}); }}
                            >
                                <option value="">-- Vyberte lokalitu --</option>
                                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        {selectedLocId && (
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.workplace')}</label>
                                <select 
                                    className="w-full p-2 rounded border" 
                                    value={selectedWpId} 
                                    onChange={e => { setSelectedWpId(e.target.value); setData({...data, techId: ''}); }}
                                >
                                    <option value="">-- Vyberte pracoviště --</option>
                                    {workplaces.filter((w: any) => w.locationId === selectedLocId).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        )}
                        {selectedWpId && (
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Technologie *</label>
                                <select 
                                className={`w-full border p-2 rounded ${errors.techId ? 'border-red-500' : ''}`}
                                value={data.techId} 
                                onChange={e => setData({...data, techId: e.target.value})}
                                >
                                <option value="">-- Vyberte technologii --</option>
                                {technologies.filter((t: any) => t.workplaceId === selectedWpId && t.isVisible).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                {errors.techId && <span className="text-xs text-red-500">{errors.techId}</span>}
                            </div>
                        )}
                </div>
            )}

            <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.name')}</label>
                    <input className={`w-full border p-2 rounded ${errors.title ? 'border-red-500' : ''}`} value={data.title} onChange={e => setData({...data, title: e.target.value})} />
                    {errors.title && <span className="text-xs text-red-500">{errors.title}</span>}
            </div>
            
            <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.supplier')}</label>
                    <select className={`w-full border p-2 rounded ${errors.supplierId ? 'border-red-500' : ''}`} value={data.supplierId} onChange={e => setData({...data, supplierId: e.target.value})}>
                    <option value="">-- Interní řešení --</option>
                    {suppliers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {errors.supplierId && <span className="text-xs text-red-500">{errors.supplierId}</span>}
            </div>
            
            <div className="col-span-2">
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.interval')}</label>
                        <div className="flex items-center">
                            <input type="number" min="1" className={`w-full border p-2 rounded ${errors.interval ? 'border-red-500' : ''}`} value={data.interval} onChange={e => setData({...data, interval: parseInt(e.target.value)})} />
                            <span className="ml-2 text-sm text-slate-500">{t('common.days')}</span>
                        </div>
                        {errors.interval && <span className="text-xs text-red-500">{errors.interval}</span>}
                     </div>
                 </div>
            </div>

            <div className="col-span-2">
                 <label className="block text-xs font-medium text-slate-700 mb-2">{t('form.allowed_days')}</label>
                 <div className="flex gap-2 flex-wrap">
                     {[1,2,3,4,5,6,0].map(day => (
                         <label key={day} className={`
                             cursor-pointer px-3 py-1.5 rounded text-sm border transition-colors
                             ${data.allowedDays?.includes(day) 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}
                         `}>
                             <input type="checkbox" className="hidden" checked={data.allowedDays?.includes(day)} onChange={() => toggleAllowedDay(day)} />
                             {t(`day.${day}`)}
                         </label>
                     ))}
                 </div>
                 {errors.allowedDays && <span className="text-xs text-red-500 block mt-1">{errors.allowedDays}</span>}
            </div>

            <div className="col-span-2 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={data.isActive} onChange={e => setData({...data, isActive: e.target.checked})} />
                    <span className="text-sm font-medium">Šablona je aktivní</span>
                </label>
            </div>
            
            <div className="col-span-2 border-t pt-4 mt-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.responsible_person')} (max 1)</label>
                    <div className={`${errors.responsiblePersonIds ? 'border border-red-500 rounded' : ''}`}>
                        <select 
                            className="w-full border p-2 rounded"
                            value={data.responsiblePersonIds?.[0] || ''}
                            onChange={e => setData({
                                ...data, 
                                responsiblePersonIds: e.target.value ? [e.target.value] : [] 
                            })}
                        >
                            <option value="">-- Nepřiřazeno --</option>
                            {users
                                .filter((u: any) => (u.role === 'admin' || u.role === 'maintenance') && !u.isBlocked)
                                .map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))
                            }
                        </select>
                    </div>
            </div>

            <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.description')}</label>
                    <textarea className="w-full border p-2 rounded" rows={3} value={data.description} onChange={e => setData({...data, description: e.target.value})} />
            </div>
        </div>
        <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
            <button onClick={onClose} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
            <button onClick={onSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('common.save')}</button>
        </div>
    </Modal>
)};
