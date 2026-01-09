
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../../lib/db';
import { Edit, Trash, Plus, Loader, Box, Search, X } from 'lucide-react';
import { Address, Supplier } from '../../lib/types';
import { AddressInput, Modal, ConfirmModal } from '../../components/Shared';
import { useI18n } from '../../lib/i18n';
import { getLocalized, prepareMultilingual } from '../../lib/helpers';

interface SuppliersPageProps {
    onNavigate?: (page: string, params?: any) => void;
}

export const SuppliersPage = ({ onNavigate }: SuppliersPageProps) => {
    const { t, lang } = useI18n();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [assets, setAssets] = useState<any[]>([]); // To count assets per supplier
    const [contacts, setContacts] = useState<any[]>([]);
    const [viewContactsFor, setViewContactsFor] = useState<string | null>(null);
    const [editingSup, setEditingSup] = useState<any>(null);
    
    // Filter State
    const [search, setSearch] = useState('');
    
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<any>(null);
    const [confirmDelete, setConfirmDelete] = useState<{show: boolean, type: 'supplier'|'contact', id: string, supId?: string}>({ show: false, type: 'supplier', id: '' });
    
    const emptyAddress: Address = { street: '', number: '', zip: '', city: '', country: 'SK' };
    const [newSup, setNewSup] = useState({ name: '', address: emptyAddress, ic: '', dic: '', email: '', phone: '', description: '' });
    const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', position: '' });
    
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

    const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));

    // Fetch Data
    const refresh = async () => {
        setLoading(true);
        try {
            if (isMock) {
                setSuppliers(db.suppliers.list());
                setAssets(db.technologies.list());
            } else {
                const [supData, assetData] = await Promise.all([
                    api.get('/suppliers'),
                    api.get('/technologies')
                ]);
                setSuppliers(supData);
                setAssets(assetData);
            }
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    };

    useEffect(() => { refresh(); }, []);

    // Filter Logic
    const filteredSuppliers = suppliers.filter(s => {
        if (!search) return true;
        const name = getLocalized(s.name, lang).toLowerCase();
        return name.includes(search.toLowerCase()) || (s.ic && s.ic.includes(search));
    });

    const getAssetCount = (supplierId: string) => {
        return assets.filter(a => a.supplierId === supplierId).length;
    };

    // Fetch Contacts
    const loadContacts = async (supId: string) => {
        try {
            if (isMock) {
                setContacts(db.supplierContacts.list(supId));
            } else {
                const data = await api.get(`/suppliers/${supId}/contacts`);
                setContacts(data);
            }
        } catch (e) { console.error(e); }
    };

    const validateForm = (data: any) => {
        const newErrors: Record<string, string> = {};
        if (!data.name || data.name.trim().length < 2) newErrors.name = "Název musí mít alespoň 2 znaky.";
        if (!data.phone) newErrors.phone = t('validation.required');
        if (!data.email) newErrors.email = t('validation.required');
        if (!data.address.street) newErrors.street = "Ulice je povinná.";
        if (!data.address.city) newErrors.city = "Město je povinné.";
        if (!data.address.zip) newErrors.zip = "PSČ je povinné.";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddSup = async () => {
        if(!validateForm(newSup)) return;
        setSaving(true);
        try {
            const translatedName = await prepareMultilingual(newSup.name);
            const payload = { ...newSup, name: translatedName };

            if(isMock) db.suppliers.add(payload);
            else await api.post('/suppliers', payload);
            setNewSup({ name: '', address: emptyAddress, ic: '', dic: '', email: '', phone: '', description: '' });
            setIsCreateOpen(false);
            refresh();
        } catch(e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleUpdateSup = async () => {
        if(!editingSup) return;
        if(!validateForm(editingSup)) return;
        setSaving(true);
        try {
            const translatedName = await prepareMultilingual(editingSup.name);
            const payload = { ...editingSup, name: translatedName };

            if(isMock) db.suppliers.update(editingSup.id, payload);
            else await api.put(`/suppliers/${editingSup.id}`, payload);
            setEditingSup(null);
            refresh();
        } catch(e) { console.error(e); }
        finally { setSaving(false); }
    }
    
    const openCreateModal = () => {
        setErrors({});
        setNewSup({ name: '', address: emptyAddress, ic: '', dic: '', email: '', phone: '', description: '' });
        setIsCreateOpen(true);
    };

    const toggleContacts = (id: string) => {
        setContactErrors({});
        setNewContact({ name: '', email: '', phone: '', position: '' });
        if(viewContactsFor === id) { 
            setViewContactsFor(null); 
        } else { 
            setViewContactsFor(id); 
            loadContacts(id);
        }
    }

    const validateContact = (data: any) => {
        const errs: Record<string, string> = {};
        if (!data.name) errs.name = t('validation.required');
        if (!data.email) errs.email = t('validation.required');
        if (!data.phone) errs.phone = t('validation.required');
        if (!data.position) errs.position = t('validation.required');
        setContactErrors(errs);
        return Object.keys(errs).length === 0;
    }

    const addContact = async (supId: string) => {
        if(!validateContact(newContact)) return;
        try {
            if(isMock) db.supplierContacts.add({...newContact, supplierId: supId});
            else await api.post('/suppliers/contacts', {...newContact, supplierId: supId});
            
            loadContacts(supId);
            setNewContact({ name: '', email: '', phone: '', position: '' });
            setContactErrors({});
        } catch(e) { console.error(e); }
    }

    const updateContact = async () => {
        if(!editingContact) return;
        if(!validateContact(editingContact)) return;
        try {
            if(isMock) db.supplierContacts.update(editingContact.id, editingContact);
            else await api.put(`/suppliers/contacts/${editingContact.id}`, editingContact);
            
            loadContacts(editingContact.supplierId);
            setEditingContact(null);
            setContactErrors({});
        } catch(e) { console.error(e); }
    }
    
    const executeDelete = async () => {
        if (confirmDelete.type === 'contact') {
            try {
                if(isMock) db.supplierContacts.delete(confirmDelete.id);
                else await api.delete(`/suppliers/contacts/${confirmDelete.id}`);

                if (confirmDelete.supId) loadContacts(confirmDelete.supId);
            } catch(e) { console.error(e); }
        }
        setConfirmDelete({ show: false, type: 'supplier', id: '' });
    }

    const startEditSup = (s: any) => {
        setEditingSup({ ...s, name: getLocalized(s.name, lang) });
    };

    if (loading) return <div className="p-10 text-center"><Loader className="animate-spin w-8 h-8 mx-auto text-blue-600"/></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <h2 className="text-xl font-bold text-slate-800">{t('menu.suppliers')}</h2>
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                        <input 
                            className="w-full pl-8 p-1.5 border rounded text-sm bg-white" 
                            placeholder={t('common.search')} 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
                <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                    <Plus className="w-4 h-4 mr-2" /> {t('headers.new_supplier')}
                </button>
            </div>

            <div className="space-y-4">
                {filteredSuppliers.map(s => {
                    const assetCount = getAssetCount(s.id);
                    return (
                        <div key={s.id} className="bg-white rounded border border-slate-200">
                            <div className="p-4 flex flex-col md:flex-row justify-between items-start gap-4">
                                <div>
                                    <div className="font-bold text-lg flex items-center gap-2">
                                        {getLocalized(s.name, lang)}
                                        <button 
                                            onClick={() => onNavigate && onNavigate('assets', { supplierId: s.id })}
                                            className="text-xs bg-white border border-slate-300 text-slate-600 px-2 py-0.5 rounded-full hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 flex items-center transition-colors font-normal shadow-sm"
                                            title="Zobrazit technologie dodavatele"
                                        >
                                            <Box className="w-3 h-3 mr-1" /> {assetCount}
                                        </button>
                                    </div>
                                    <div className="text-sm text-slate-500">{s.address.street} {s.address.number}, {s.address.city}</div>
                                    <div className="text-xs text-slate-400 mt-1">{t('form.ic')}: {s.ic} | {t('form.phone')}: {s.phone}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => toggleContacts(s.id)} className="bg-slate-100 text-slate-600 px-3 py-1 rounded text-sm hover:bg-slate-200 transition-colors">{t('headers.contacts')}</button>
                                    <button onClick={() => { setErrors({}); startEditSup(s); }} className="text-blue-600 p-1 hover:bg-blue-50 rounded"><Edit className="w-4 h-4"/></button>
                                </div>
                            </div>
                            {viewContactsFor === s.id && (
                                <div className="border-t bg-slate-50 p-4">
                                    <h5 className="font-bold text-xs text-slate-500 uppercase mb-2">{t('headers.contacts')}</h5>
                                    {contacts.map(c => (
                                        <div key={c.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 border border-slate-100 text-sm">
                                            <div>
                                                <span className="font-medium">{c.name}</span> <span className="text-slate-400">({c.position})</span>
                                                <div className="text-xs text-slate-400">{c.email}, {c.phone}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setContactErrors({}); setEditingContact(c); }} className="text-blue-600"><Edit className="w-3 h-3"/></button>
                                                <button onClick={() => setConfirmDelete({ show: true, type: 'contact', id: c.id, supId: s.id })} className="text-red-500"><Trash className="w-3 h-3"/></button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-5 gap-2 mt-2 items-start">
                                        <input placeholder={t('form.user_name')} className={`border p-1 text-sm rounded w-full ${contactErrors.name ? 'border-red-500' : ''}`} value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                                        <input placeholder={t('form.position')} className={`border p-1 text-sm rounded w-full ${contactErrors.position ? 'border-red-500' : ''}`} value={newContact.position} onChange={e => setNewContact({...newContact, position: e.target.value})} />
                                        <input placeholder={t('form.email')} className={`border p-1 text-sm rounded w-full ${contactErrors.email ? 'border-red-500' : ''}`} value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
                                        <input placeholder={t('form.phone')} className={`border p-1 text-sm rounded w-full ${contactErrors.phone ? 'border-red-500' : ''}`} value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
                                        <button onClick={() => addContact(s.id)} className="bg-blue-600 text-white rounded text-sm py-1">{t('common.add')}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            {isCreateOpen && (
                <Modal title={t('headers.new_supplier')} onClose={() => setIsCreateOpen(false)}>
                     <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="col-span-2">
                             <label className="block text-xs text-slate-500 mb-1">{t('form.name')}</label>
                             <input className={`p-2 border rounded w-full ${errors.name ? 'border-red-500' : ''}`} value={newSup.name} onChange={e => setNewSup({...newSup, name: e.target.value})} />
                        </div>
                        <div className="col-span-1"><input placeholder={t('form.ic')} className="p-2 border rounded w-full" value={newSup.ic} onChange={e => setNewSup({...newSup, ic: e.target.value})} /></div>
                        <div className="col-span-1"><input placeholder={t('form.phone')} className="p-2 border rounded w-full" value={newSup.phone} onChange={e => setNewSup({...newSup, phone: e.target.value})} /></div>
                        <div className="col-span-2"><input placeholder={t('form.dic')} className="p-2 border rounded w-full" value={newSup.dic} onChange={e => setNewSup({...newSup, dic: e.target.value})} /></div>
                        <div className="col-span-2"><input placeholder={t('form.email')} className="p-2 border rounded w-full" value={newSup.email} onChange={e => setNewSup({...newSup, email: e.target.value})} /></div>
                    </div>
                    <AddressInput address={newSup.address} onChange={a => setNewSup({...newSup, address: a})} errors={errors} />
                    <div className="flex justify-end mt-4">
                        <button onClick={handleAddSup} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center">
                            {saving && <Loader className="animate-spin w-4 h-4 mr-2" />} {t('common.create')}
                        </button>
                    </div>
                </Modal>
            )}

            {editingSup && (
                <Modal title={t('headers.edit_supplier')} onClose={() => setEditingSup(null)}>
                     <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="col-span-2"><input className="p-2 border rounded w-full" value={editingSup.name} onChange={e => setEditingSup({...editingSup, name: e.target.value})} /></div>
                        <div className="col-span-1"><input className="p-2 border rounded w-full" value={editingSup.ic} onChange={e => setEditingSup({...editingSup, ic: e.target.value})} /></div>
                        <div className="col-span-1"><input className="p-2 border rounded w-full" value={editingSup.phone} onChange={e => setEditingSup({...editingSup, phone: e.target.value})} /></div>
                        <div className="col-span-2"><input className="p-2 border rounded w-full" value={editingSup.dic} onChange={e => setEditingSup({...editingSup, dic: e.target.value})} /></div>
                        <div className="col-span-2"><input className="p-2 border rounded w-full" value={editingSup.email} onChange={e => setEditingSup({...editingSup, email: e.target.value})} /></div>
                    </div>
                    <AddressInput address={editingSup.address} onChange={a => setEditingSup({...editingSup, address: a})} errors={errors} />
                    <div className="flex justify-end mt-4">
                        <button onClick={handleUpdateSup} disabled={saving} className="bg-blue-600 text-white px-3 py-2 rounded flex items-center">
                            {saving && <Loader className="animate-spin w-4 h-4 mr-2" />} {t('common.save')}
                        </button>
                    </div>
                </Modal>
            )}

            {editingContact && (
                <Modal title="Upravit Kontakt" onClose={() => setEditingContact(null)}>
                    <div className="space-y-3">
                        <input className="w-full border p-2 rounded" value={editingContact.name} onChange={e => setEditingContact({...editingContact, name: e.target.value})} />
                        <input className="w-full border p-2 rounded" value={editingContact.position} onChange={e => setEditingContact({...editingContact, position: e.target.value})} />
                        <input className="w-full border p-2 rounded" value={editingContact.email} onChange={e => setEditingContact({...editingContact, email: e.target.value})} />
                        <input className="w-full border p-2 rounded" value={editingContact.phone} onChange={e => setEditingContact({...editingContact, phone: e.target.value})} />
                    </div>
                    <div className="flex justify-end mt-4"><button onClick={updateContact} className="bg-blue-600 text-white px-3 py-2 rounded">{t('common.save')}</button></div>
                </Modal>
            )}

            {confirmDelete.show && <ConfirmModal message={t('msg.confirm_delete')} onConfirm={executeDelete} onCancel={() => setConfirmDelete({ show: false, type: 'supplier', id: '' })} />}
        </div>
    );
};
