import React, { useState } from 'react';
import { db } from '../../lib/db';
import { Edit, Trash, Plus } from 'lucide-react';
import { Modal, ConfirmModal, AlertModal } from '../../components/Shared';
import { useI18n } from '../../lib/i18n';

export const TechConfigPage = () => {
    const { t } = useI18n();
    const [types, setTypes] = useState(db.techTypes.list());
    const [states, setStates] = useState(db.techStates.list());
    
    // Create states
    const [newType, setNewType] = useState({ name: '', description: '' });
    const [newState, setNewState] = useState({ name: '', description: '' });
    const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false);
    const [isCreateStateOpen, setIsCreateStateOpen] = useState(false);

    // Edit states
    const [editingType, setEditingType] = useState<any>(null);
    const [editingState, setEditingState] = useState<any>(null);

    // Modal UI states
    const [deleteModal, setDeleteModal] = useState<{show: boolean, type: 'type'|'state', id: string}>({ show: false, type: 'type', id: '' });
    const [alertMsg, setAlertMsg] = useState<string | null>(null);
    
    // Errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    const refresh = () => { setTypes(db.techTypes.list()); setStates(db.techStates.list()); };

    const initiateDelete = (type: 'type'|'state', id: string) => {
        if(type === 'type' && db.techTypes.isUsed(id)) {
            setAlertMsg(t('msg.cannot_delete_used'));
            return;
        }
        if(type === 'state' && db.techStates.isUsed(id)) {
            setAlertMsg(t('msg.cannot_delete_used'));
            return;
        }
        setDeleteModal({ show: true, type, id });
    };

    const confirmDelete = () => {
        if(deleteModal.type === 'type') {
            db.techTypes.delete(deleteModal.id);
        } else {
            db.techStates.delete(deleteModal.id);
        }
        setDeleteModal({ show: false, type: 'type', id: '' });
        refresh();
    };

    const saveType = () => { if(editingType) { db.techTypes.update(editingType.id, editingType); setEditingType(null); refresh(); } }
    const saveState = () => { if(editingState) { db.techStates.update(editingState.id, editingState); setEditingState(null); refresh(); } }

    const handleAddType = () => {
        setErrors({});
        if(!newType.name) {
            setErrors({name: t('validation.required')});
            return;
        }
        db.techTypes.add(newType);
        setNewType({ name: '', description: '' });
        setIsCreateTypeOpen(false);
        refresh();
    }
    const handleAddState = () => {
        setErrors({});
        if(!newState.name) {
             setErrors({name: t('validation.required')});
             return;
        }
        db.techStates.add(newState);
        setNewState({ name: '', description: '' });
        setIsCreateStateOpen(false);
        refresh();
    }
    
    const openCreateType = () => { setErrors({}); setIsCreateTypeOpen(true); }
    const openCreateState = () => { setErrors({}); setIsCreateStateOpen(true); }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">{t('headers.tech_types')}</h3>
                    <button onClick={openCreateType} className="bg-blue-600 text-white p-1.5 rounded shadow-sm hover:bg-blue-700">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="bg-white rounded border border-slate-200 divide-y">
                    {types.map(t => (
                        <div key={t.id} className="p-2 flex justify-between items-center group">
                            <span>{t.name}</span>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                                <button onClick={() => setEditingType(t)}><Edit className="w-3 h-3 text-blue-600"/></button>
                                <button onClick={() => initiateDelete('type', t.id)}><Trash className="w-3 h-3 text-red-600"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
             <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">{t('headers.tech_states')}</h3>
                    <button onClick={openCreateState} className="bg-blue-600 text-white p-1.5 rounded shadow-sm hover:bg-blue-700">
                         <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="bg-white rounded border border-slate-200 divide-y">
                    {states.map(t => (
                        <div key={t.id} className="p-2 flex justify-between items-center group">
                            <span>{t.name}</span>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                                <button onClick={() => setEditingState(t)}><Edit className="w-3 h-3 text-blue-600"/></button>
                                <button onClick={() => initiateDelete('state', t.id)}><Trash className="w-3 h-3 text-red-600"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Modals */}
            {isCreateTypeOpen && (
                <Modal title={t('headers.new_tech_type')} onClose={() => setIsCreateTypeOpen(false)}>
                    <input 
                        value={newType.name} 
                        placeholder={t('form.name')} 
                        onChange={e => setNewType({...newType, name: e.target.value})} 
                        className={`border p-2 w-full rounded mb-1 ${errors.name ? 'border-red-500' : ''}`} 
                    />
                    {errors.name && <span className="text-xs text-red-500 mb-2 block">{errors.name}</span>}
                    
                    <input value={newType.description} placeholder={t('form.description')} onChange={e => setNewType({...newType, description: e.target.value})} className="border p-2 w-full rounded mb-2" />
                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <button onClick={() => setIsCreateTypeOpen(false)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                        <button onClick={handleAddType} className="bg-blue-600 text-white px-3 py-2 rounded">{t('common.create')}</button>
                    </div>
                </Modal>
            )}

            {isCreateStateOpen && (
                <Modal title={t('headers.new_tech_state')} onClose={() => setIsCreateStateOpen(false)}>
                    <input 
                        value={newState.name} 
                        placeholder={t('form.name')} 
                        onChange={e => setNewState({...newState, name: e.target.value})} 
                        className={`border p-2 w-full rounded mb-1 ${errors.name ? 'border-red-500' : ''}`} 
                    />
                    {errors.name && <span className="text-xs text-red-500 mb-2 block">{errors.name}</span>}

                    <input value={newState.description} placeholder={t('form.description')} onChange={e => setNewState({...newState, description: e.target.value})} className="border p-2 w-full rounded mb-2" />
                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <button onClick={() => setIsCreateStateOpen(false)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                        <button onClick={handleAddState} className="bg-blue-600 text-white px-3 py-2 rounded">{t('common.create')}</button>
                    </div>
                </Modal>
            )}
            
            {editingType && (
                <Modal title={t('common.edit')} onClose={() => setEditingType(null)}>
                    <input value={editingType.name} onChange={e => setEditingType({...editingType, name: e.target.value})} className="border p-2 w-full rounded" />
                    <button onClick={saveType} className="mt-2 bg-blue-600 text-white px-3 py-1 rounded">{t('common.save')}</button>
                </Modal>
            )}
            {editingState && (
                <Modal title={t('common.edit')} onClose={() => setEditingState(null)}>
                    <input value={editingState.name} onChange={e => setEditingState({...editingState, name: e.target.value})} className="border p-2 w-full rounded" />
                    <button onClick={saveState} className="mt-2 bg-blue-600 text-white px-3 py-1 rounded">{t('common.save')}</button>
                </Modal>
            )}

            {deleteModal.show && (
                <ConfirmModal 
                    message={t('msg.confirm_delete')} 
                    onConfirm={confirmDelete} 
                    onCancel={() => setDeleteModal({...deleteModal, show: false})} 
                />
            )}

            {alertMsg && (
                <AlertModal 
                    message={alertMsg} 
                    onClose={() => setAlertMsg(null)} 
                />
            )}
        </div>
    );
};