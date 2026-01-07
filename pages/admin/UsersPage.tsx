import React, { useState } from 'react';
import { db } from '../../lib/db';
import { Edit, Lock, Plus, ShieldAlert, ListChecks } from 'lucide-react';
import { User } from '../../lib/types';
import { Modal } from '../../components/Shared';
import { useI18n } from '../../lib/i18n';

interface UsersPageProps {
    onNavigate?: (page: string, params?: any) => void;
}

export const UsersPage = ({ onNavigate }: UsersPageProps) => {
    const { t } = useI18n();
    const [users, setUsers] = useState(db.users.list());
    const [newUser, setNewUser] = useState<any>({ name: '', email: '', role: 'operator', phone: '', isBlocked: false });
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    
    const locations = db.locations.list();
    const workplaces = db.workplaces.list();
    const requests = db.requests.list();

    // Errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    const refresh = () => setUsers(db.users.list());

    const validateForm = (data: any) => {
        const newErrors: Record<string, string> = {};
        if (!data.name) newErrors.name = t('validation.required');
        if (!data.email) newErrors.email = t('validation.required');
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddUser = () => {
        if(!validateForm(newUser)) return;
        db.users.add({...newUser, assignedLocationIds: [], assignedWorkplaceIds: []});
        setIsCreateOpen(false);
        setNewUser({ name: '', email: '', role: 'operator', phone: '', isBlocked: false });
        refresh();
    };

    const saveUser = () => { 
        if(!editingUser) return;
        if(!validateForm(editingUser)) return;
        db.users.update(editingUser.id, editingUser); 
        setEditingUser(null); 
        refresh(); 
    }

    const openCreateModal = () => {
        setErrors({});
        setNewUser({ name: '', email: '', role: 'operator', phone: '', isBlocked: false });
        setIsCreateOpen(true);
    };

    const togglePermission = (type: 'loc' | 'wp', id: string) => {
        if(!editingUser) return;
        // Do not allow toggling if role is admin
        if(editingUser.role === 'admin') return;

        if(type === 'loc') {
            const current = editingUser.assignedLocationIds || [];
            const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
            setEditingUser({...editingUser, assignedLocationIds: updated});
        } else {
            const current = editingUser.assignedWorkplaceIds || [];
            const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
            setEditingUser({...editingUser, assignedWorkplaceIds: updated});
        }
    }

    const getOpenTaskCount = (userId: string) => {
        return requests.filter(r => r.solverId === userId && r.state !== 'solved' && r.state !== 'cancelled').length;
    }

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h2 className="text-xl font-bold text-slate-800">{t('menu.users')}</h2>
                 <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                    <Plus className="w-4 h-4 mr-2" /> {t('headers.new_user')}
                </button>
             </div>
            
            <div className="bg-white rounded border border-slate-200 divide-y">
                {users.map(u => {
                     const openTasks = getOpenTaskCount(u.id);
                     return (
                     <div key={u.id} className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${u.isBlocked ? 'bg-red-200 text-red-800' : 'bg-slate-200'}`}>{u.name[0]}</div>
                            <div>
                                <div className="font-bold flex items-center gap-2">
                                    {u.name} {u.isBlocked && <Lock className="w-3 h-3 text-red-500"/>}
                                </div>
                                <div className="text-xs text-slate-500">{u.email} | {t(`role.${u.role}`)}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {openTasks > 0 && (
                                <button 
                                    onClick={() => onNavigate && onNavigate('operations', { solverId: u.id })}
                                    className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200 transition-colors"
                                    title="Zobrazit nedořešené úkoly"
                                >
                                    <ListChecks className="w-3 h-3" />
                                    {openTasks} nedořešených
                                </button>
                            )}
                            <button onClick={() => { setErrors({}); setEditingUser(u); }} className="text-blue-600 flex items-center gap-1 bg-blue-50 px-3 py-1 rounded text-sm"><Edit className="w-3 h-3"/> {t('common.edit')}</button>
                        </div>
                    </div>
                )})}
            </div>

            {isCreateOpen && (
                <Modal title={t('headers.new_user')} onClose={() => setIsCreateOpen(false)}>
                     <div className="space-y-3">
                        <div>
                             <label className="block text-xs font-bold mb-1">{t('form.user_name')}</label>
                             <input className={`border p-2 w-full rounded ${errors.name ? 'border-red-500' : ''}`} value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                             {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
                        </div>
                        <div>
                             <label className="block text-xs font-bold mb-1">{t('form.email')}</label>
                             <input className={`border p-2 w-full rounded ${errors.email ? 'border-red-500' : ''}`} value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                             {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
                        </div>
                        <div>
                             <label className="block text-xs font-bold mb-1">{t('form.role')}</label>
                             <select className="p-2 border rounded w-full" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                                <option value="admin">{t('role.admin')}</option>
                                <option value="maintenance">{t('role.maintenance')}</option>
                                <option value="operator">{t('role.operator')}</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 mt-2 border-t border-slate-100">
                        <button onClick={() => setIsCreateOpen(false)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                        <button onClick={handleAddUser} className="bg-blue-600 text-white px-4 py-2 rounded">{t('common.create')}</button>
                    </div>
                </Modal>
            )}

            {editingUser && (
                <Modal title={`${t('common.edit')}: ${editingUser.name}`} onClose={() => setEditingUser(null)}>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                        <div>
                             <label className="block text-xs font-bold mb-1">{t('form.name')}</label>
                             <input className={`border p-2 w-full rounded mb-2 ${errors.name ? 'border-red-500' : ''}`} value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                             {errors.name && <span className="text-xs text-red-500 mb-2 block">{errors.name}</span>}
                             
                             <label className="block text-xs font-bold mb-1">{t('form.email')}</label>
                             <input className={`border p-2 w-full rounded mb-2 ${errors.email ? 'border-red-500' : ''}`} value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
                             {errors.email && <span className="text-xs text-red-500 mb-2 block">{errors.email}</span>}
                             
                             {/* Role Selector in Edit */}
                             <label className="block text-xs font-bold mb-1">{t('form.role')}</label>
                             <select className="p-2 border rounded w-full mb-2" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}>
                                <option value="admin">{t('role.admin')}</option>
                                <option value="maintenance">{t('role.maintenance')}</option>
                                <option value="operator">{t('role.operator')}</option>
                            </select>

                             <label className="flex items-center gap-2 cursor-pointer mt-2">
                                 <input type="checkbox" checked={editingUser.isBlocked} onChange={e => setEditingUser({...editingUser, isBlocked: e.target.checked})} />
                                 <span className="text-sm font-medium text-red-600">{t('form.blocked')}</span>
                             </label>
                        </div>
                        
                        <div className="border-t pt-2">
                            <label className="block text-xs font-bold mb-2">{t('form.permissions')} - {t('headers.locations')} & {t('headers.workplaces')}</label>
                            
                            {editingUser.role === 'admin' ? (
                                <div className="bg-blue-50 text-blue-700 p-3 rounded text-sm flex items-start gap-2">
                                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                                    <span>{t('msg.admin_full_access')}</span>
                                </div>
                            ) : (
                                locations.map(loc => (
                                    <div key={loc.id} className="ml-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={editingUser.assignedLocationIds?.includes(loc.id)} onChange={() => togglePermission('loc', loc.id)} />
                                            <span className="font-medium text-sm">{loc.name}</span>
                                        </div>
                                        {/* Show workplaces if location is checked */}
                                        {editingUser.assignedLocationIds?.includes(loc.id) && (
                                            <div className="ml-6 mt-1 border-l-2 border-slate-200 pl-2">
                                                {workplaces.filter(w => w.locationId === loc.id).map(wp => (
                                                     <div key={wp.id} className="flex items-center gap-2 py-0.5">
                                                        <input type="checkbox" checked={editingUser.assignedWorkplaceIds?.includes(wp.id)} onChange={() => togglePermission('wp', wp.id)} />
                                                        <span className="text-sm text-slate-600">{wp.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex justify-end pt-4 border-t border-slate-100">
                             <button onClick={() => setEditingUser(null)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                             <button onClick={saveUser} className="bg-blue-600 text-white px-4 py-2 rounded">{t('common.save')}</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};