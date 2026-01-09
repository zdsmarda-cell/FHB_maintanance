
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../../lib/db';
import { Edit, Trash, Plus, Box, Loader } from 'lucide-react';
import { Modal, ConfirmModal, AlertModal } from '../../components/Shared';
import { useI18n } from '../../lib/i18n';

interface TechConfigPageProps {
    onNavigate?: (page: string, params?: any) => void;
}

export const TechConfigPage = ({ onNavigate }: TechConfigPageProps) => {
    const { t } = useI18n();
    const [loading, setLoading] = useState(false);
    const [types, setTypes] = useState<any[]>([]);
    const [states, setStates] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]); // For counting usage
    
    const [newType, setNewType] = useState({ name: '' });
    const [newState, setNewState] = useState({ name: '' });
    const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false);
    const [isCreateStateOpen, setIsCreateStateOpen] = useState(false);

    const [editingType, setEditingType] = useState<any>(null);
    const [editingState, setEditingState] = useState<any>(null);

    const [deleteModal, setDeleteModal] = useState<{show: boolean, type: 'type'|'state', id: string}>({ show: false, type: 'type', id: '' });
    const [alertMsg, setAlertMsg] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));

    const refresh = async () => {
        setLoading(true);
        try {
            if(isMock) {
                setTypes(db.techTypes.list());
                setStates(db.techStates.list());
                setAssets(db.technologies.list());
            } else {
                const [t, s, a] = await Promise.all([
                    api.get('/config/types'),
                    api.get('/config/states'),
                    api.get('/technologies')
                ]);
                setTypes(t);
                setStates(s);
                setAssets(a);
            }
        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    };

    useEffect(() => { refresh(); }, []);

    const isUsed = (type: 'type'|'state', id: string) => {
        if (type === 'type') return assets.some(a => a.typeId === id);
        return assets.some(a => a.stateId === id);
    }

    const initiateDelete = (type: 'type'|'state', id: string) => {
        if(isUsed(type, id)) {
            setAlertMsg(t('msg.cannot_delete_used'));
            return;
        }
        setDeleteModal({ show: true, type, id });
    };

    const confirmDelete = async () => {
        try {
            const endpoint = deleteModal.type === 'type' ? '/config/types' : '/config/states';
            if(isMock) {
                if(deleteModal.type === 'type') db.techTypes.delete(deleteModal.id);
                else db.techStates.delete(deleteModal.id);
            } else {
                // Using fetch directly because generic API helper might need adjustment for DELETE
                const token = localStorage.getItem('auth_token');
                const res = await fetch(`${api.baseUrl}/api${endpoint}/${deleteModal.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if(!res.ok) throw new Error('Delete failed');
            }
            setDeleteModal({ show: false, type: 'type', id: '' });
            refresh();
        } catch(e) { console.error(e); }
    };

    const saveType = async () => { 
        if(!editingType) return;
        try {
            if(isMock) db.techTypes.update(editingType.id, editingType);
            else await api.put(`/config/types/${editingType.id}`, editingType);
            setEditingType(null); 
            refresh(); 
        } catch(e) { console.error(e); }
    }

    const saveState = async () => { 
        if(!editingState) return;
        try {
            if(isMock) db.techStates.update(editingState.id, editingState);
            else await api.put(`/config/states/${editingState.id}`, editingState);
            setEditingState(null); 
            refresh(); 
        } catch(e) { console.error(e); }
    }

    const handleAddType = async () => {
        setErrors({});
        if(!newType.name) { setErrors({name: t('validation.required')}); return; }
        try {
            if(isMock) db.techTypes.add(newType);
            else await api.post('/config/types', newType);
            setNewType({ name: '' });
            setIsCreateTypeOpen(false);
            refresh();
        } catch(e) { console.error(e); }
    }

    const handleAddState = async () => {
        setErrors({});
        if(!newState.name) { setErrors({name: t('validation.required')}); return; }
        try {
            if(isMock) db.techStates.add(newState);
            else await api.post('/config/states', newState);
            setNewState({ name: '' });
            setIsCreateStateOpen(false);
            refresh();
        } catch(e) { console.error(e); }
    }
    
    if (loading) return <div className="p-10 text-center"><Loader className="animate-spin w-8 h-8 mx-auto text-blue-600"/></div>;

    // View JSX remains similar, just data binding updates
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">{t('headers.tech_types')}</h3>
                    <button onClick={() => { setErrors({}); setIsCreateTypeOpen(true); }} className="bg-blue-600 text-white p-1.5 rounded shadow-sm hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="bg-white rounded border border-slate-200 divide-y">
                    {types.map(t => (
                        <div key={t.id} className="p-2 flex justify-between items-center group">
                            <div className="flex items-center gap-2">
                                <span>{t.name}</span>
                                {isUsed('type', t.id) && <button onClick={() => onNavigate && onNavigate('assets', { typeId: t.id })} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-200 flex items-center"><Box className="w-3 h-3 mr-1" /></button>}
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    <button onClick={() => { setErrors({}); setIsCreateStateOpen(true); }} className="bg-blue-600 text-white p-1.5 rounded shadow-sm hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="bg-white rounded border border-slate-200 divide-y">
                    {states.map(t => (
                        <div key={t.id} className="p-2 flex justify-between items-center group">
                            <div className="flex items-center gap-2">
                                <span>{t.name}</span>
                                {isUsed('state', t.id) && <button onClick={() => onNavigate && onNavigate('assets', { stateId: t.id })} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-200 flex items-center"><Box className="w-3 h-3 mr-1" /></button>}
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingState(t)}><Edit className="w-3 h-3 text-blue-600"/></button>
                                <button onClick={() => initiateDelete('state', t.id)}><Trash className="w-3 h-3 text-red-600"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {isCreateTypeOpen && (
                <Modal title={t('headers.new_tech_type')} onClose={() => setIsCreateTypeOpen(false)}>
                    <input value={newType.name} placeholder={t('form.name')} onChange={e => setNewType({...newType, name: e.target.value})} className={`border p-2 w-full rounded mb-1 ${errors.name ? 'border-red-500' : ''}`} />
                    <div className="flex justify-end pt-4 border-t border-slate-100"><button onClick={handleAddType} className="bg-blue-600 text-white px-3 py-2 rounded">{t('common.create')}</button></div>
                </Modal>
            )}

            {isCreateStateOpen && (
                <Modal title={t('headers.new_tech_state')} onClose={() => setIsCreateStateOpen(false)}>
                    <input value={newState.name} placeholder={t('form.name')} onChange={e => setNewState({...newState, name: e.target.value})} className={`border p-2 w-full rounded mb-1 ${errors.name ? 'border-red-500' : ''}`} />
                    <div className="flex justify-end pt-4 border-t border-slate-100"><button onClick={handleAddState} className="bg-blue-600 text-white px-3 py-2 rounded">{t('common.create')}</button></div>
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

            {deleteModal.show && <ConfirmModal message={t('msg.confirm_delete')} onConfirm={confirmDelete} onCancel={() => setDeleteModal({...deleteModal, show: false})} />}
            {alertMsg && <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
        </div>
    );
};
