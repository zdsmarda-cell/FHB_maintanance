
import React, { useState } from 'react';
import { db } from '../../lib/db';
import { Edit, Lock, Plus, ShieldAlert, ListChecks, CheckCircle, XCircle } from 'lucide-react';
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
    
    // Filter states
    const [nameFilter, setNameFilter] = useState('');
    const [emailFilter, setEmailFilter] = useState('');
    
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
        
        // Strict Phone Validation: Optional +, then only numbers, min 9 digits
        const phoneRegex = /^\+?[0-9]{9,}$/;
        if (!data.phone) {
            newErrors.phone = t('validation.required');
        } else if (!phoneRegex.test(data.phone.replace(/\s/g, ''))) { // remove spaces for check
            newErrors.phone = "Telefon musí obsahovat minimálně 9 číslic a může začínat +";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddUser = () => {
        if(!validateForm(newUser)) return;
        db.users.add({...newUser, assignedLocationIds: [], assignedWorkplaceIds: [], approvalLimits: {}});
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
        
        if(type === 'loc') {
            const current = editingUser.assignedLocationIds || [];
            const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
            
            // If removing location, also remove its limit
            const updatedLimits = { ...editingUser.approvalLimits };
            if (!updated.includes(id)) {
                delete updatedLimits[id];
            } else if (updatedLimits[id] === undefined) {
                // If adding location, we can leave limit as undefined (no limit set yet)
                // or set to 0. User asked for blank input, so undefined is safer for UI logic.
            }

            setEditingUser({...editingUser, assignedLocationIds: updated, approvalLimits: updatedLimits});
        } else {
            const current = editingUser.assignedWorkplaceIds || [];
            const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
            setEditingUser({...editingUser, assignedWorkplaceIds: updated});
        }
    }

    const updateLimit = (locId: string, value: string) => {
        if (!editingUser) return;
        
        // Handle empty string by setting to undefined (which removes it from object effectively or sets to undefined)
        let numValue: number | undefined = undefined;
        if (value !== '') {
            numValue = parseInt(value);
        }

        const newLimits = { ...editingUser.approvalLimits };
        if (numValue === undefined) {
             delete newLimits[locId];
        } else {
             newLimits[locId] = numValue;
        }

        setEditingUser({
            ...editingUser,
            approvalLimits: newLimits
        });
    }

    const getOpenTaskCount = (userId: string) => {
        return requests.filter(r => r.solverId === userId && r.state !== 'solved' && r.state !== 'cancelled').length;
    }

    const filteredUsers = users.filter(u => {
        return u.name.toLowerCase().includes(nameFilter.toLowerCase()) &&
               u.email.toLowerCase().includes(emailFilter.toLowerCase());
    });

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h2 className="text-xl font-bold text-slate-800">{t('menu.users')}</h2>
                 <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                    <Plus className="w-4 h-4 mr-2" /> {t('headers.new_user')}
                </button>
             </div>
            
            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-3 align-top min-w-[150px]">
                                    <div className="mb-1">Jméno</div>
                                    <input 
                                        className="w-full p-1 border rounded font-normal normal-case"
                                        placeholder="Hledat..."
                                        value={nameFilter}
                                        onChange={e => setNameFilter(e.target.value)}
                                    />
                                </th>
                                <th className="px-4 py-3 align-top min-w-[150px]">
                                    <div className="mb-1">Email</div>
                                    <input 
                                        className="w-full p-1 border rounded font-normal normal-case"
                                        placeholder="Hledat..."
                                        value={emailFilter}
                                        onChange={e => setEmailFilter(e.target.value)}
                                    />
                                </th>
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
                                                <div className="flex flex-col gap-1">
                                                    {limitEntries.map(([locId, limit]) => {
                                                        const locName = locations.find(l => l.id === locId)?.name || 'Neznámá';
                                                        return (
                                                            <span key={locId} className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 border">
                                                                {locName}: <strong>{limit} €</strong>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            ) : <span className="text-slate-400">-</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {u.isBlocked ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-medium">
                                                    <Lock className="w-3 h-3 mr-1" /> Blokován
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-medium">
                                                    <CheckCircle className="w-3 h-3 mr-1" /> Aktivní
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {openTasks > 0 && (
                                                    <button 
                                                        onClick={() => onNavigate && onNavigate('requests', { solverId: u.id })}
                                                        className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200 transition-colors"
                                                        title="Zobrazit nedořešené úkoly"
                                                    >
                                                        <ListChecks className="w-3 h-3" />
                                                        {openTasks}
                                                    </button>
                                                )}
                                                <button onClick={() => { setErrors({}); setEditingUser(u); }} className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                                                    <Edit className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <tr><td colSpan={7} className="p-4 text-center text-slate-400">Žádní uživatelé nenalezeni.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
                             <label className="block text-xs font-bold mb-1">{t('form.phone')} (+420...)</label>
                             <input className={`border p-2 w-full rounded ${errors.phone ? 'border-red-500' : ''}`} value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} placeholder="+420..." />
                             {errors.phone && <span className="text-xs text-red-500">{errors.phone}</span>}
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

                             <label className="block text-xs font-bold mb-1">{t('form.phone')}</label>
                             <input className={`border p-2 w-full rounded mb-2 ${errors.phone ? 'border-red-500' : ''}`} value={editingUser.phone} onChange={e => setEditingUser({...editingUser, phone: e.target.value})} />
                             {errors.phone && <span className="text-xs text-red-500 mb-2 block">{errors.phone}</span>}
                             
                             <label className="block text-xs font-bold mb-1">{t('form.role')}</label>
                             <select className="p-2 border rounded w-full mb-2" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}>
                                <option value="admin">{t('role.admin')}</option>
                                <option value="maintenance">{t('role.maintenance')}</option>
                                <option value="operator">{t('role.operator')}</option>
                            </select>

                             <label className="flex items-center gap-2 cursor-pointer mt-2 bg-slate-50 p-2 rounded border">
                                 <input type="checkbox" checked={editingUser.isBlocked} onChange={e => setEditingUser({...editingUser, isBlocked: e.target.checked})} />
                                 <span className={`text-sm font-medium ${editingUser.isBlocked ? 'text-red-600' : 'text-slate-700'}`}>
                                     {editingUser.isBlocked ? 'Uživatel je blokován' : 'Uživatel je aktivní'}
                                 </span>
                             </label>
                        </div>
                        
                        <div className="border-t pt-2">
                            <label className="block text-xs font-bold mb-2">{t('form.permissions')} - {t('headers.locations')} & {t('headers.workplaces')}</label>
                            
                            {locations.map(loc => (
                                <div key={loc.id} className="ml-2 mb-2">
                                    <div className="flex items-center justify-between mb-1 bg-slate-50 p-2 rounded">
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={editingUser.assignedLocationIds?.includes(loc.id)} onChange={() => togglePermission('loc', loc.id)} />
                                            <span className="font-medium text-sm">{loc.name}</span>
                                        </div>
                                        {editingUser.assignedLocationIds?.includes(loc.id) && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500 whitespace-nowrap">{t('form.approval_limit')}:</span>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    placeholder="0"
                                                    className="border p-1 w-20 rounded text-right text-xs" 
                                                    value={editingUser.approvalLimits?.[loc.id] ?? ''}
                                                    onChange={(e) => updateLimit(loc.id, e.target.value)}
                                                />
                                                <span className="text-xs text-slate-500">€</span>
                                            </div>
                                        )}
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
                            ))}
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
