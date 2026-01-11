
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { calculateNextMaintenanceDate, getLocalized } from '../lib/helpers';
import { User, Maintenance, Technology, Supplier, Location, Workplace } from '../lib/types';
import { Plus, Filter, ArrowLeft, Edit, Loader, X, Trash, Calendar, List, Zap, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Modal, ConfirmModal } from '../components/Shared';

interface MaintenancePageProps {
    user: User;
    onNavigate: (page: string, params?: any) => void;
}

export const MaintenancePage = ({ user, onNavigate }: MaintenancePageProps) => {
    const { t, lang } = useI18n();
    
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
        serialNumber: '', // Added Serial Number filter
        supplierId: '',
        responsiblePersonId: ''
    });
    const [showFilters, setShowFilters] = useState(user.role !== 'operator');

    // Action States
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [runNowTemplate, setRunNowTemplate] = useState<Maintenance | null>(null);
    const [historyTemplate, setHistoryTemplate] = useState<Maintenance | null>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

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

    // Load logs when history modal opens
    useEffect(() => {
        if (historyTemplate) {
            const fetchLogs = async () => {
                setLogsLoading(true);
                try {
                    const token = localStorage.getItem('auth_token');
                    const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
                    
                    if (isMock) {
                        setLogs([]); // Mock logs not implemented in basic FE state for now
                    } else {
                        const data = await api.get(`/maintenance/${historyTemplate.id}/history`);
                        setLogs(data);
                    }
                } catch(e) { console.error(e); }
                finally { setLogsLoading(false); }
            }
            fetchLogs();
        }
    }, [historyTemplate]);

    const resetFilters = () => {
        setFilters({
            techName: '',
            serialNumber: '',
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
        
        // --- FILTERS ---
        if (filters.techName && !getLocalized(tech?.name, lang).toLowerCase().includes(filters.techName.toLowerCase())) return false;
        if (filters.serialNumber && !tech?.serialNumber?.toLowerCase().includes(filters.serialNumber.toLowerCase())) return false;
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
        const dayNames = selectedTemplate.allowedDays.sort().map(d => t(`day.${d}`)).join(', ');
        
        const nextRun = calculateNextMaintenanceDate(selectedTemplate);

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                     <button onClick={() => setView('list')} className="text-blue-600 hover:underline flex items-center">
                        <ArrowLeft className="w-4 h-4 mr-1"/> {t('common.back')}
                     </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-6">
                        <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">{selectedTemplate.title}</h2>
                                    <div className="text-slate-500 mt-1">{getLocalized(tech?.name, lang) || 'Neznámá technologie'}</div>
                                </div>
                                {renderActiveBadge(selectedTemplate.isActive)}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-6">
                                <div><span className="text-slate-500 block">{t('form.interval')}</span> {selectedTemplate.interval} {t('common.days')}</div>
                                <div><span className="text-slate-500 block">{t('form.allowed_days')}</span> {dayNames}</div>
                                <div><span className="text-slate-500 block">{t('form.supplier')}</span> {supplier ? getLocalized(supplier.name, lang) : <span className="text-slate-400 italic">{t('form.internal_solution')}</span>}</div>
                                <div><span className="text-slate-500 block">{t('form.responsible_person')}</span> {responsibleNames || <span className="text-slate-400 italic">{t('option.unassigned')}</span>}</div>
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Název technologie</label>
                            <input className="w-full p-1.5 border rounded" value={filters.techName} onChange={e => setFilters({...filters, techName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('form.serial_number')}</label>
                            <input className="w-full p-1.5 border rounded" placeholder="S.N." value={filters.serialNumber} onChange={e => setFilters({...filters, serialNumber: e.target.value})} />
                        </div>
                        <div>
                             <label className="block text-xs text-slate-500 mb-1">{t('form.supplier')} / {t('form.responsible_person')}</label>
                             <select className="w-full p-1.5 border rounded" value={filters.supplierId} onChange={e => setFilters({...filters, supplierId: e.target.value})}>
                                <option value="">{t('common.all')}</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{getLocalized(s.name, lang)}</option>)}
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
                                <th className="px-4 py-3 whitespace-nowrap text-center">{t('col.open_requests')}</th>
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
                                    const nextRun = calculateNextMaintenanceDate(m);

                                    return (
                                        <tr key={m.id} onClick={() => handleRowClick(m)} className="border-b hover:bg-slate-50 cursor-pointer group">
                                            <td className="px-4 py-3 font-medium whitespace-nowrap">{getLocalized(tech?.name, lang) || 'Neznámá technologie'}</td>
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
                                            <td className="px-4 py-3 whitespace-nowrap">{supplier ? getLocalized(supplier.name, lang) : '-'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap max-w-[200px] truncate" title={responsibleNames}>{responsibleNames || '-'}</td>
                                            <td className="px-4 py-3 text-right">
                                                {user.role !== 'operator' && (
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setHistoryTemplate(m); }}
                                                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                                                            title="Historie spouštění"
                                                        >
                                                            <Clock className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setRunNowTemplate(m); }}
                                                            className="p-1.5 text-amber-500 hover:bg-amber-50 rounded transition-colors"
                                                            title="Vytvořit požadavek ihned"
                                                        >
                                                            <Zap className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); openEditModal(m); }}
                                                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                                            title="Editovat"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setSelectedTemplate(m); setShowDeleteConfirm(true); }}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                            title="Smazat"
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                    </div>
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
                    lang={lang}
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
                    nextRunDate={calculateNextMaintenanceDate(runNowTemplate)}
                />
            )}

            {historyTemplate && (
                <HistoryModal 
                    template={historyTemplate} 
                    logs={logs}
                    loading={logsLoading}
                    onClose={() => { setHistoryTemplate(null); setLogs([]); }}
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

const HistoryModal = ({ template, logs, loading, onClose }: any) => {
    return (
        <Modal title={`Historie spouštění: ${template.title}`} onClose={onClose}>
            <div className="max-h-[60vh] overflow-auto">
                {loading ? (
                    <div className="p-8 flex justify-center"><Loader className="animate-spin w-6 h-6 text-blue-600"/></div>
                ) : logs.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">Žádná historie není k dispozici.</div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
                            <tr>
                                <th className="p-2">Datum plánu</th>
                                <th className="p-2">Spuštěno</th>
                                <th className="p-2">Stav</th>
                                <th className="p-2">Info</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {logs.map((log: any) => (
                                <tr key={log.id}>
                                    <td className="p-2 whitespace-nowrap">{new Date(log.createdAt).toLocaleDateString()}</td>
                                    <td className="p-2 whitespace-nowrap text-xs text-slate-500">
                                        {log.executedAt ? new Date(log.executedAt).toLocaleString() : '-'}
                                    </td>
                                    <td className="p-2">
                                        {log.status === 'success' && <span className="text-green-600 flex items-center gap-1 text-xs font-bold"><CheckCircle className="w-3 h-3"/> OK</span>}
                                        {log.status === 'error' && <span className="text-red-600 flex items-center gap-1 text-xs font-bold"><AlertTriangle className="w-3 h-3"/> Chyba</span>}
                                        {log.status === 'pending' && <span className="text-amber-600 text-xs font-bold">Čeká</span>}
                                    </td>
                                    <td className="p-2 text-xs">
                                        {log.status === 'error' ? <span className="text-red-600">{log.errorMessage}</span> : (log.requestId ? <span className="text-slate-400">ID: {log.requestId.slice(0,8)}...</span> : '-')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div className="flex justify-end pt-4 border-t mt-2">
                <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200">Zavřít</button>
            </div>
        </Modal>
    );
};

// Refactored Modal for better readability (Same as before)
const MaintModal = ({ 
    isOpen, onClose, data, setData, isEdit, onSave, 
    selectedLocId, setSelectedLocId, selectedWpId, setSelectedWpId, errors, t, lang,
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
                                <option value="">{t('option.select_location')}</option>
                                {locations.map((l: any) => <option key={l.id} value={l.id}>{getLocalized(l.name, lang)}</option>)}
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
                                    <option value="">{t('option.select_wp')}</option>
                                    {workplaces.filter((w: any) => w.locationId === selectedLocId).map((w: any) => <option key={w.id} value={w.id}>{getLocalized(w.name, lang)}</option>)}
                                </select>
                            </div>
                        )}
                        
                        {/* Always show technology dropdown, but disabled or empty if no workplace */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.technology')} *</label>
                            <select 
                                className={`w-full border p-2 rounded ${errors.techId ? 'border-red-500' : ''} ${!selectedWpId ? 'bg-slate-100' : ''}`}
                                value={data.techId} 
                                onChange={e => setData({...data, techId: e.target.value})}
                                disabled={!selectedWpId}
                            >
                                <option value="">{selectedWpId ? t('option.select_tech') : t('option.select_wp_first')}</option>
                                {selectedWpId && technologies.filter((t: any) => t.workplaceId === selectedWpId && t.isVisible).map((t: any) => <option key={t.id} value={t.id}>{getLocalized(t.name, lang)}</option>)}
                            </select>
                            {errors.techId && <span className="text-xs text-red-500 font-bold">{errors.techId}</span>}
                        </div>
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
                    <option value="">{t('option.internal_solution')}</option>
                    {suppliers.map((t: any) => <option key={t.id} value={t.id}>{getLocalized(t.name, lang)}</option>)}
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
                    <span className="text-sm font-medium">{t('label.template_active')}</span>
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
                            <option value="">{t('option.unassigned')}</option>
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
