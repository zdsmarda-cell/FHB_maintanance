
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../../lib/db';
import { Edit, Lock, Plus, ListChecks, CheckCircle, Loader } from 'lucide-react';
import { User } from '../../lib/types';
import { Modal } from '../../components/Shared';
import { useI18n } from '../../lib/i18n';

export const UsersPage = ({ onNavigate }: any) => {
    const { t } = useI18n();
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [workplaces, setWorkplaces] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]); // For counting open tasks

    const [newUser, setNewUser] = useState<any>({ name: '', email: '', role: 'operator', phone: '', isBlocked: false });
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    
    const [nameFilter, setNameFilter] = useState('');
    const [emailFilter, setEmailFilter] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));

    const refresh = async () => {
        setLoading(true);
        try {
            if(isMock) {
                setUsers(db.users.list());
                setLocations(db.locations.list());
                setWorkplaces(db.workplaces.list());
                setRequests(db.requests.list());
            } else {
                const [u, l, w, r] = await Promise.all([
                    api.get('/users'),
                    api.get('/locations'),
                    api.get('/locations/workplaces'),
                    api.get('/requests')
                ]);
                setUsers(u);
                setLocations(l);
                setWorkplaces(w);
                setRequests(r);
            }
        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    };

    useEffect(() => { refresh(); }, []);

    const validateForm = (data: any) => {
        const newErrors: Record<string, string> = {};
        if (!data.name) newErrors.name = t('validation.required');
        if (!data.email) newErrors.email = t('validation.required');
        const phoneRegex = /^\+?[0-9]{9,}$/;
        if (!data.phone) { newErrors.phone = t('validation.required'); } 
        else if (!phoneRegex.test(data.phone.replace(/\s/g, ''))) { newErrors.phone = "Telefon musí obsahovat minimálně 9 číslic a může začínat +"; }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddUser = async () => {
        if(!validateForm(newUser)) return;
        try {
            const payload = {...newUser, assignedLocationIds: [], assignedWorkplaceIds: [], approvalLimits: {}};
            if(isMock) db.users.add(payload);
            else await api.post('/users', payload);
            
            setIsCreateOpen(false);
            setNewUser({ name: '', email: '', role: 'operator', phone: '', isBlocked: false });
            refresh();
        } catch(e) { console.error(e); }
    };

    const saveUser = async () => { 
        if(!editingUser) return;
        if(!validateForm(editingUser)) return;
        try {
            if(isMock) db.users.update(editingUser.id, editingUser);
            else await api.put(`/users/${editingUser.id}`, editingUser);
            
            setEditingUser(null); 
            refresh(); 
        } catch(e) { console.error(e); }
    }

    const getOpenTaskCount = (userId: string) => {
        return requests.filter(r => r.solverId === userId && r.state !== 'solved' && r.state !== 'cancelled').length;
    }

    const filteredUsers = users.filter(u => {
        return u.name.toLowerCase().includes(nameFilter.toLowerCase()) &&
               u.email.toLowerCase().includes(emailFilter.toLowerCase());
    });

    // Helper functions for UI logic (togglePermission, updateLimit) remain mostly same, just operating on local editingUser state
    const togglePermission = (type: 'loc' | 'wp', id: string) => {
        if(!editingUser) return;
        if(type === 'loc') {
            const current = editingUser.assignedLocationIds || [];
            const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
            const updatedLimits = { ...(editingUser.approvalLimits || {}) };
            if (!updated.includes(id)) { delete updatedLimits[id]; }
            setEditingUser({...editingUser, assignedLocationIds: updated, approvalLimits: updatedLimits});
        } else {
            const current = editingUser.assignedWorkplaceIds || [];
            const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
            setEditingUser({...editingUser, assignedWorkplaceIds: updated});
        }
    }

    const updateLimit = (locId: string, value: string) => {
        if (!editingUser) return;
        let numValue = value !== '' ? parseInt(value) : undefined;
        const newLimits = { ...(editingUser.approvalLimits || {}) };
        if (numValue === undefined) { delete newLimits[locId]; } else { newLimits[locId] = numValue; }
        setEditingUser({ ...editingUser, approvalLimits: newLimits });
    }

    if (loading) return <div className="p-10 text-center"><Loader className="animate-spin w-8 h-8 mx-auto text-blue-600"/></div>;

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h2 className="text-xl font-bold text-slate-800">{t('menu.users')}</h2>
                 <button onClick={() => { setErrors({}); setNewUser({ name: '', email: '', role: 'operator', phone: '', isBlocked: false }); setIsCreateOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                    <Plus className="w-4 h-4 mr-2" /> {t('headers.new_user')}
                </button>
             </div>
            
            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-3 align-top min-w-[150px]"><div className="mb-1">Jméno</div><input className="w-full p-1 border rounded font-normal normal-case" placeholder="Hledat..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} /></th>
                                <th className="px-4 py-3 align-top min-w-[150px]"><div className="mb-1">Email</div><input className="w-full p-1 border rounded font-normal normal-case" placeholder="Hledat..." value={emailFilter} onChange={e => setEmailFilter(e.target.value)} /></th>
                                <th className="px-4 py-3 align-top">Telefon</th>
                                <th className="px-4 py-3 align-top">Role</th>
                                <th className="px-4 py-3 align-top">Limity schvalování</th>
                                <th className="px-4 py-3 align-top text-center">Stav</th>
                                <th className="px-4 py-3 align-top text-center">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => {
                                const openTasks = getOpenTaskCount(u.id);
                                const limitEntries = Object.entries(u.approvalLimits || {});
                                return (
                                    <tr key={u.id} className="border-b hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                                        <td className="px-4 py-3 text-slate-600">{u.email}</td>
                                        <td className="px-4 py-3 text-slate-600">{u.phone}</td>
                                        <td className="px-4 py-3 text-slate-600">{t(`role.${u.role}`)}</td>
                                        <td className="px-4 py-3 text-xs">
                                            {limitEntries.length > 0 ? (
                                                <div className="flex flex-col gap-1">{limitEntries.map(([locId, limit]) => <span key={locId} className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 border">{locations.find(l => l.id === locId)?.name || '?'}: <strong>{limit} €</strong></span>)}</div>
                                            ) : <span className="text-slate-400">-</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {u.isBlocked ? <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-medium"><Lock className="w-3 h-3 mr-1" /> Blokován</span> : <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-medium"><CheckCircle className="w-3 h-3 mr-1" /> Aktivní</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {openTasks > 0 && <button onClick={() => onNavigate && onNavigate('requests', { solverId: u.id })} className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200"><ListChecks className="w-3 h-3" />{openTasks}</button>}
                                                <button onClick={() => { setErrors({}); setEditingUser(u); }} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {isCreateOpen && (
                <Modal title={t('headers.new_user')} onClose={() => setIsCreateOpen(false)}>
                     <div className="space-y-3">
                        <input className={`border p-2 w-full rounded ${errors.name ? 'border-red-500' : ''}`} placeholder={t('form.user_name')} value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                        <input className={`border p-2 w-full rounded ${errors.email ? 'border-red-500' : ''}`} placeholder={t('form.email')} value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                        <input className={`border p-2 w-full rounded ${errors.phone ? 'border-red-500' : ''}`} placeholder={t('form.phone') + " (+420...)"} value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} />
                        <select className="p-2 border rounded w-full" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                            <option value="admin">{t('role.admin')}</option>
                            <option value="maintenance">{t('role.maintenance')}</option>
                            <option value="operator">{t('role.operator')}</option>
                        </select>
                    </div>
                    <div className="flex justify-end pt-4 mt-2 border-t border-slate-100"><button onClick={handleAddUser} className="bg-blue-600 text-white px-4 py-2 rounded">{t('common.create')}</button></div>
                </Modal>
            )}

            {/* Edit Modal */}
            {editingUser && (
                <Modal title={`${t('common.edit')}: ${editingUser.name}`} onClose={() => setEditingUser(null)}>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                        <div>
                             <input className={`border p-2 w-full rounded mb-2 ${errors.name ? 'border-red-500' : ''}`} value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                             <input className={`border p-2 w-full rounded mb-2 ${errors.email ? 'border-red-500' : ''}`} value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
                             <input className={`border p-2 w-full rounded mb-2 ${errors.phone ? 'border-red-500' : ''}`} value={editingUser.phone} onChange={e => setEditingUser({...editingUser, phone: e.target.value})} />
                             <select className="p-2 border rounded w-full mb-2" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}>
                                <option value="admin">{t('role.admin')}</option>
                                <option value="maintenance">{t('role.maintenance')}</option>
                                <option value="operator">{t('role.operator')}</option>
                            </select>
                             <label className="flex items-center gap-2 cursor-pointer mt-2 bg-slate-50 p-2 rounded border">
                                 <input type="checkbox" checked={editingUser.isBlocked} onChange={e => setEditingUser({...editingUser, isBlocked: e.target.checked})} />
                                 <span className={`text-sm font-medium ${editingUser.isBlocked ? 'text-red-600' : 'text-slate-700'}`}>{editingUser.isBlocked ? 'Uživatel je blokován' : 'Uživatel je aktivní'}</span>
                             </label>
                        </div>
                        <div className="border-t pt-2">
                            <label className="block text-xs font-bold mb-2">{t('form.permissions')}</label>
                            {locations.map(loc => (
                                <div key={loc.id} className="ml-2 mb-2">
                                    <div className="flex items-center justify-between mb-1 bg-slate-50 p-2 rounded">
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={editingUser.assignedLocationIds?.includes(loc.id)} onChange={() => togglePermission('loc', loc.id)} />
                                            <span className="font-medium text-sm">{loc.name}</span>
                                        </div>
                                        {editingUser.assignedLocationIds?.includes(loc.id) && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Limit:</span>
                                                <input type="number" min="0" placeholder="0" className="border p-1 w-20 rounded text-right text-xs" value={editingUser.approvalLimits?.[loc.id] ?? ''} onChange={(e) => updateLimit(loc.id, e.target.value)} />
                                                <span className="text-xs text-slate-500">€</span>
                                            </div>
                                        )}
                                    </div>
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
                            ))}
                        </div>
                        <div className="flex justify-end pt-4 border-t border-slate-100"><button onClick={saveUser} className="bg-blue-600 text-white px-4 py-2 rounded">{t('common.save')}</button></div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
