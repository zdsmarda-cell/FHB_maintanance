
import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { User, Maintenance } from '../lib/types';
import { Plus, Filter, ArrowLeft, Edit, MessageSquare, CheckCircle, PlayCircle, Calendar } from 'lucide-react';
import { Modal, MultiSelect } from '../components/Shared';

export const MaintenancePage = ({ user }: { user: User }) => {
    const { t } = useI18n();
    // RBAC Check
    if (user.role === 'operator') {
        return <div className="p-10 text-center text-red-500">Access Denied</div>;
    }

    const [maintenances, setMaintenances] = useState(db.maintenances.list());
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedMaint, setSelectedMaint] = useState<Maintenance | null>(null);

    // Filter States
    const [filters, setFilters] = useState({
        techName: '',
        type: '',
        dateFrom: '',
        state: 'active',
        supplierId: '',
        responsiblePersonId: ''
    });
    const [showFilters, setShowFilters] = useState(true);

    const refresh = () => {
        setMaintenances(db.maintenances.list());
        if (selectedMaint) {
            setSelectedMaint(db.maintenances.list().find(m => m.id === selectedMaint.id) || null);
        }
    };

    const resetFilters = () => {
        setFilters({
            techName: '',
            type: '',
            dateFrom: '',
            state: 'active',
            supplierId: '',
            responsiblePersonId: ''
        });
    };

    const handleRowClick = (m: Maintenance) => {
        setSelectedMaint(m);
        setView('detail');
    };

    // Filter Logic
    const filteredMaintenances = maintenances.filter(m => {
        const tech = db.technologies.list().find(t => t.id === m.techId);
        if (filters.techName && !tech?.name.toLowerCase().includes(filters.techName.toLowerCase())) return false;
        if (filters.type && m.type !== filters.type) return false;
        if (filters.dateFrom && m.planDateFrom < filters.dateFrom) return false;
        if (filters.state === 'active') { if (m.state === 'done') return false; } 
        else if (filters.state && filters.state !== 'all') { if (m.state !== filters.state) return false; }
        if (filters.supplierId && m.supplierId !== filters.supplierId) return false;
        if (filters.responsiblePersonId) { if (!m.responsiblePersonIds?.includes(filters.responsiblePersonId)) return false; }
        return true;
    });

    const renderStatusBadge = (status: string) => {
        const styles: any = {
            'planned': 'bg-blue-100 text-blue-800',
            'in_progress': 'bg-amber-100 text-amber-800',
            'done': 'bg-green-100 text-green-800',
        };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>{t(`status.${status}`)}</span>;
    };

    // --- MODALS STATES ---
    const [isCreateOpen, setIsCreateOpen] = useState(false); // Used for both Create and Edit
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCompleteOpen, setIsCompleteOpen] = useState(false);
    
    // --- FORM STATES ---
    const [selectedLocId, setSelectedLocId] = useState('');
    const [selectedWpId, setSelectedWpId] = useState('');
    const [maintForm, setMaintForm] = useState<Partial<Maintenance>>({
        type: 'planned', title: '', techId: '', supplierId: '', responsiblePersonIds: [],
        planDateFrom: '', planDateTo: '', planHours: 0, description: '', state: 'planned'
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    // --- AUTO-SELECTION HELPERS ---
    useEffect(() => {
        if (isCreateOpen && !editingId) {
            const locs = db.locations.list();
            if (locs.length === 1 && !selectedLocId) setSelectedLocId(locs[0].id);
        }
    }, [isCreateOpen, editingId]);

    useEffect(() => {
        if (selectedLocId && !editingId) {
            const wps = db.workplaces.byLoc(selectedLocId);
            if (wps.length === 1 && !selectedWpId) setSelectedWpId(wps[0].id);
        }
    }, [selectedLocId, editingId]);

    // --- CRUD OPERATIONS ---
    const openCreateModal = () => {
        setEditingId(null);
        setMaintForm({
            type: 'planned', title: '', techId: '', supplierId: '', responsiblePersonIds: [],
            planDateFrom: '', planDateTo: '', planHours: 0, description: '', state: 'planned'
        });
        setSelectedLocId(''); setSelectedWpId('');
        setErrors({});
        setIsCreateOpen(true);
    };

    const openEditModal = (m: Maintenance) => {
        setEditingId(m.id);
        setMaintForm(m);
        // Pre-fill location/workplace selectors based on techId
        const tech = db.technologies.list().find(t => t.id === m.techId);
        if (tech) {
            const wp = db.workplaces.list().find(w => w.id === tech.workplaceId);
            if (wp) {
                setSelectedWpId(wp.id);
                setSelectedLocId(wp.locationId);
            }
        }
        setErrors({});
        setIsCreateOpen(true);
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!maintForm.techId) newErrors.techId = t('validation.required');
        if (!maintForm.title) newErrors.title = t('validation.required');
        if (!maintForm.planDateFrom) newErrors.planDateFrom = t('validation.required');
        if (!maintForm.planDateTo) newErrors.planDateTo = t('validation.required');
        if (!maintForm.supplierId) newErrors.supplierId = t('validation.required');
        if (!maintForm.responsiblePersonIds || maintForm.responsiblePersonIds.length === 0) newErrors.responsiblePersonIds = t('validation.required');
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        if (editingId) {
            db.maintenances.update(editingId, maintForm);
        } else {
            db.maintenances.add(maintForm as Omit<Maintenance, 'id'>);
        }
        setIsCreateOpen(false);
        refresh();
    };

    // --- STATUS CHANGE & COMPLETION ---
    const [finalReportData, setFinalReportData] = useState({ report: '', realDateFrom: '', realDateTo: '' });
    
    const handleChangeStatus = (newState: Maintenance['state']) => {
        if (!selectedMaint) return;
        if (newState === 'done') {
            setFinalReportData({ 
                report: '', 
                realDateFrom: selectedMaint.planDateFrom, 
                realDateTo: selectedMaint.planDateTo 
            });
            setIsCompleteOpen(true);
        } else {
            db.maintenances.update(selectedMaint.id, { state: newState });
            refresh();
        }
    };

    const handleComplete = () => {
        if (!selectedMaint) return;
        if (!finalReportData.report) { alert(t('validation.required')); return; }
        
        db.maintenances.update(selectedMaint.id, { 
            state: 'done', 
            finalReport: finalReportData.report,
            realDateFrom: finalReportData.realDateFrom,
            realDateTo: finalReportData.realDateTo
        });
        setIsCompleteOpen(false);
        refresh();
    };

    // --- NOTES ---
    const [newNote, setNewNote] = useState('');
    const handleAddNote = () => {
        if (!selectedMaint || !newNote.trim()) return;
        db.maintenanceNotes.add({
            maintenanceId: selectedMaint.id,
            authorId: user.id,
            content: newNote,
            attachmentUrls: []
        });
        setNewNote('');
        refresh(); // Ideally just refresh notes, but full refresh is safe
    };


    // --- VIEW RENDER ---
    if (view === 'detail' && selectedMaint) {
        const tech = db.technologies.list().find(t => t.id === selectedMaint.techId);
        const supplier = db.suppliers.list().find(s => s.id === selectedMaint.supplierId);
        const notes = db.maintenanceNotes.list(selectedMaint.id);
        const responsibleNames = selectedMaint.responsiblePersonIds
            ?.map(id => db.users.list().find(u => u.id === id)?.name).filter(Boolean).join(', ');

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                     <button onClick={() => setView('list')} className="text-blue-600 hover:underline flex items-center">
                        <ArrowLeft className="w-4 h-4 mr-1"/> {t('common.back')}
                     </button>
                     <div className="flex gap-2">
                        {selectedMaint.state === 'planned' && (
                            <button onClick={() => handleChangeStatus('in_progress')} className="bg-amber-500 text-white px-3 py-2 rounded flex items-center shadow-sm hover:bg-amber-600">
                                <PlayCircle className="w-4 h-4 mr-2" /> Zahájit
                            </button>
                        )}
                        {selectedMaint.state === 'in_progress' && (
                            <button onClick={() => handleChangeStatus('done')} className="bg-green-600 text-white px-3 py-2 rounded flex items-center shadow-sm hover:bg-green-700">
                                <CheckCircle className="w-4 h-4 mr-2" /> Dokončit
                            </button>
                        )}
                        <button onClick={() => openEditModal(selectedMaint)} className="bg-slate-200 text-slate-700 px-3 py-2 rounded flex items-center hover:bg-slate-300">
                            <Edit className="w-4 h-4 mr-2" /> {t('common.edit')}
                        </button>
                     </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded border border-slate-200 p-6 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">{selectedMaint.title}</h2>
                                    <div className="text-slate-500 mt-1">{tech?.name}</div>
                                </div>
                                {renderStatusBadge(selectedMaint.state)}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm mt-6">
                                <div><span className="text-slate-500 block">{t('form.date_from')}</span> {selectedMaint.planDateFrom}</div>
                                <div><span className="text-slate-500 block">{t('form.date_to')}</span> {selectedMaint.planDateTo}</div>
                                <div><span className="text-slate-500 block">{t('form.supplier')}</span> {supplier?.name}</div>
                                <div><span className="text-slate-500 block">{t('form.responsible_person')}</span> {responsibleNames}</div>
                                <div><span className="text-slate-500 block">{t('form.plan_hours')}</span> {selectedMaint.planHours} h</div>
                                <div><span className="text-slate-500 block">{t('form.maintenance_type')}</span> {selectedMaint.type === 'operational' ? 'Provozní' : 'Plánovaná'}</div>
                            </div>
                            
                            <div className="mt-6">
                                <h4 className="font-bold text-sm text-slate-700 mb-2">{t('form.description')}</h4>
                                <p className="text-slate-600 bg-slate-50 p-3 rounded">{selectedMaint.description || '-'}</p>
                            </div>

                            {selectedMaint.state === 'done' && (
                                <div className="mt-6 border-t pt-4">
                                     <h4 className="font-bold text-sm text-green-700 mb-2">{t('form.final_report')}</h4>
                                     <div className="bg-green-50 p-4 rounded border border-green-100 text-green-900">
                                         <p>{selectedMaint.finalReport}</p>
                                         <div className="text-xs mt-2 opacity-75">
                                             Realizace: {selectedMaint.realDateFrom} - {selectedMaint.realDateTo}
                                         </div>
                                     </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="bg-white rounded border border-slate-200 flex flex-col h-full shadow-sm max-h-[600px]">
                            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold flex items-center gap-2">
                                <MessageSquare className="w-4 h-4"/> {t('headers.notes')}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {notes.length === 0 && <div className="text-center text-slate-400 text-sm">Žádné poznámky</div>}
                                {notes.map(n => {
                                    const author = db.users.list().find(u => u.id === n.authorId);
                                    return (
                                        <div key={n.id} className="bg-slate-50 p-3 rounded border border-slate-100 text-sm">
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                <span className="font-bold text-slate-700">{author?.name}</span>
                                                <span>{new Date(n.date).toLocaleString()}</span>
                                            </div>
                                            <p>{n.content}</p>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="p-4 border-t border-slate-200">
                                <textarea 
                                    className="w-full border rounded p-2 text-sm mb-2" 
                                    rows={2} 
                                    placeholder={t('form.add_note')}
                                    value={newNote}
                                    onChange={e => setNewNote(e.target.value)}
                                />
                                <button onClick={handleAddNote} className="w-full bg-blue-600 text-white py-1.5 rounded text-sm hover:bg-blue-700">Odeslat</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- EDIT / CREATE MODAL --- */}
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
                    />
                )}

                {/* --- COMPLETE MODAL --- */}
                {isCompleteOpen && (
                    <Modal title={t('headers.complete_maintenance')} onClose={() => setIsCompleteOpen(false)}>
                        <div className="space-y-4">
                             <div>
                                 <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.real_date_from')}</label>
                                 <input type="date" className="w-full border p-2 rounded" value={finalReportData.realDateFrom} onChange={e => setFinalReportData({...finalReportData, realDateFrom: e.target.value})} />
                             </div>
                             <div>
                                 <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.real_date_to')}</label>
                                 <input type="date" className="w-full border p-2 rounded" value={finalReportData.realDateTo} onChange={e => setFinalReportData({...finalReportData, realDateTo: e.target.value})} />
                             </div>
                             <div>
                                 <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.final_report')} *</label>
                                 <textarea className="w-full border p-2 rounded h-32" value={finalReportData.report} onChange={e => setFinalReportData({...finalReportData, report: e.target.value})} />
                             </div>
                             <div className="flex justify-end gap-2 pt-4">
                                 <button onClick={() => setIsCompleteOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">{t('common.cancel')}</button>
                                 <button onClick={handleComplete} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">{t('common.confirm')}</button>
                             </div>
                        </div>
                    </Modal>
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
                    <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                        <Plus className="w-4 h-4 mr-2" /> {t('headers.new_maintenance')}
                    </button>
                </div>
            </div>

            {/* Filters Toolbar */}
            {showFilters && (
                <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-sm">
                    <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-slate-700">{t('common.filter')}</span>
                        <button onClick={resetFilters} className="text-xs text-blue-600 hover:underline">Reset</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {/* Same filters as before */}
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Název technologie</label>
                            <input className="w-full p-1.5 border rounded" value={filters.techName} onChange={e => setFilters({...filters, techName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('form.maintenance_type')}</label>
                            <select className="w-full p-1.5 border rounded" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}>
                                <option value="">{t('common.all')}</option>
                                <option value="planned">Plánovaná</option>
                                <option value="operational">Provozní</option>
                            </select>
                        </div>
                        <div>
                             <label className="block text-xs text-slate-500 mb-1">{t('form.date_from')}</label>
                             <input type="date" className="w-full p-1.5 border rounded" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
                        </div>
                        <div>
                             <label className="block text-xs text-slate-500 mb-1">{t('common.status')}</label>
                             <select className="w-full p-1.5 border rounded" value={filters.state} onChange={e => setFilters({...filters, state: e.target.value})}>
                                <option value="active">Neuzavřené</option>
                                <option value="all">{t('common.all')}</option>
                                <option value="planned">{t('status.planned')}</option>
                                <option value="in_progress">{t('status.in_progress')}</option>
                                <option value="done">{t('status.done')}</option>
                             </select>
                        </div>
                        <div>
                             <label className="block text-xs text-slate-500 mb-1">{t('form.supplier')}</label>
                             <select className="w-full p-1.5 border rounded" value={filters.supplierId} onChange={e => setFilters({...filters, supplierId: e.target.value})}>
                                <option value="">{t('common.all')}</option>
                                {db.suppliers.list().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                             </select>
                        </div>
                        <div>
                             <label className="block text-xs text-slate-500 mb-1">{t('form.responsible_person')}</label>
                             <select className="w-full p-1.5 border rounded" value={filters.responsiblePersonId} onChange={e => setFilters({...filters, responsiblePersonId: e.target.value})}>
                                <option value="">{t('common.all')}</option>
                                {db.users.list().filter(u => u.role !== 'operator').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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
                                <th className="px-4 py-3 whitespace-nowrap">Typ</th>
                                <th className="px-4 py-3 whitespace-nowrap">{t('common.date')}</th>
                                <th className="px-4 py-3 whitespace-nowrap">{t('common.status')}</th>
                                <th className="px-4 py-3 whitespace-nowrap">{t('form.supplier')}</th>
                                <th className="px-4 py-3 whitespace-nowrap">{t('form.responsible_person')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMaintenances.length === 0 ? (
                                <tr><td colSpan={6} className="p-4 text-center text-slate-400">Žádná údržba</td></tr>
                            ) : (
                                filteredMaintenances.map(m => {
                                    const tech = db.technologies.list().find(t => t.id === m.techId);
                                    const supplier = db.suppliers.list().find(s => s.id === m.supplierId);
                                    const responsibleNames = m.responsiblePersonIds
                                        ?.map(id => db.users.list().find(u => u.id === id)?.name).filter(Boolean).join(', ');

                                    return (
                                        <tr key={m.id} onClick={() => handleRowClick(m)} className="border-b hover:bg-slate-50 cursor-pointer">
                                            <td className="px-4 py-3 font-medium whitespace-nowrap">{tech?.name || 'Unknown'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{m.type === 'operational' ? 'Provozní' : 'Plánovaná'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{m.planDateFrom} - {m.planDateTo}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{renderStatusBadge(m.state)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{supplier?.name}</td>
                                            <td className="px-4 py-3 whitespace-nowrap max-w-[200px] truncate" title={responsibleNames}>{responsibleNames || '-'}</td>
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
                />
            )}
        </div>
    );
};

// Refactored Modal for better readability
const MaintModal = ({ isOpen, onClose, data, setData, isEdit, onSave, selectedLocId, setSelectedLocId, selectedWpId, setSelectedWpId, errors, t }: any) => (
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
                                {db.locations.list().map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
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
                                    {db.workplaces.byLoc(selectedLocId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
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
                                {db.technologies.list().filter(t => t.workplaceId === selectedWpId && t.isVisible).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                {errors.techId && <span className="text-xs text-red-500">{errors.techId}</span>}
                            </div>
                        )}
                </div>
            )}

            <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.name')} *</label>
                    <input className={`w-full border p-2 rounded ${errors.title ? 'border-red-500' : ''}`} value={data.title} onChange={e => setData({...data, title: e.target.value})} />
                    {errors.title && <span className="text-xs text-red-500">{errors.title}</span>}
            </div>
            <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.maintenance_type')}</label>
                    <select className="w-full border p-2 rounded" value={data.type} onChange={e => setData({...data, type: e.target.value as any})}>
                        <option value="planned">Plánovaná</option>
                        <option value="operational">Provozní</option>
                    </select>
            </div>
            <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.supplier')} *</label>
                    <select className={`w-full border p-2 rounded ${errors.supplierId ? 'border-red-500' : ''}`} value={data.supplierId} onChange={e => setData({...data, supplierId: e.target.value})}>
                    <option value="">-</option>
                    {db.suppliers.list().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {errors.supplierId && <span className="text-xs text-red-500">{errors.supplierId}</span>}
            </div>
            <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.date_from')} *</label>
                    <input type="date" className={`w-full border p-2 rounded ${errors.planDateFrom ? 'border-red-500' : ''}`} value={data.planDateFrom} onChange={e => setData({...data, planDateFrom: e.target.value})} />
                    {errors.planDateFrom && <span className="text-xs text-red-500">{errors.planDateFrom}</span>}
            </div>
            <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.date_to')} *</label>
                    <input type="date" className={`w-full border p-2 rounded ${errors.planDateTo ? 'border-red-500' : ''}`} value={data.planDateTo} onChange={e => setData({...data, planDateTo: e.target.value})} />
                    {errors.planDateTo && <span className="text-xs text-red-500">{errors.planDateTo}</span>}
            </div>
            
            <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.responsible_person')} *</label>
                    <div className={`${errors.responsiblePersonIds ? 'border border-red-500 rounded' : ''}`}>
                        <MultiSelect 
                        label=""
                        options={db.users.list().filter(u => (u.role === 'admin' || u.role === 'maintenance') && !u.isBlocked).map(u => ({ id: u.id, name: u.name }))}
                        selectedIds={data.responsiblePersonIds || []}
                        onChange={ids => setData({...data, responsiblePersonIds: ids})}
                        />
                    </div>
                    {errors.responsiblePersonIds && <span className="text-xs text-red-500">{errors.responsiblePersonIds}</span>}
            </div>

                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.plan_hours')}</label>
                    <input type="number" className="w-full border p-2 rounded" value={data.planHours} onChange={e => setData({...data, planHours: parseFloat(e.target.value)})} />
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
);
