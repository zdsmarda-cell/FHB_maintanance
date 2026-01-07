import React, { useState } from 'react';
import { db } from '../../lib/db';
import { Edit, Trash, Plus } from 'lucide-react';
import { Address } from '../../lib/types';
import { AddressInput, Modal, ConfirmModal } from '../../components/Shared';
import { useI18n } from '../../lib/i18n';

export const SuppliersPage = () => {
    const { t } = useI18n();
    const [suppliers, setSuppliers] = useState(db.suppliers.list());
    const [contacts, setContacts] = useState<any[]>([]);
    const [viewContactsFor, setViewContactsFor] = useState<string | null>(null);
    const [editingSup, setEditingSup] = useState<any>(null);
    
    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    
    // Delete Modal State
    const [confirmDelete, setConfirmDelete] = useState<{show: boolean, type: 'supplier'|'contact', id: string, supId?: string}>({ show: false, type: 'supplier', id: '' });
    
    const emptyAddress: Address = { street: '', number: '', zip: '', city: '', country: 'SK' };
    const [newSup, setNewSup] = useState({ name: '', address: emptyAddress, ic: '', dic: '', email: '', phone: '', description: '' });
    const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', position: '' });
    
    // Errors
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

    const refresh = () => setSuppliers(db.suppliers.list());

    const validateForm = (data: any) => {
        const newErrors: Record<string, string> = {};
        if (!data.name) newErrors.name = t('validation.required');
        
        // Validation per requirements
        if (!data.phone) newErrors.phone = t('validation.required');
        if (!data.email) newErrors.email = t('validation.required');
        if (!data.address.street) newErrors.street = t('validation.required');
        if (!data.address.city) newErrors.city = t('validation.required');
        if (!data.address.zip) newErrors.zip = t('validation.required');
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddSup = () => {
        if(!validateForm(newSup)) return;
        db.suppliers.add(newSup);
        setNewSup({ name: '', address: emptyAddress, ic: '', dic: '', email: '', phone: '', description: '' });
        setIsCreateOpen(false);
        refresh();
    };

    const handleUpdateSup = () => {
        if(!editingSup) return;
        if(!validateForm(editingSup)) return;
        
        db.suppliers.update(editingSup.id, editingSup);
        setEditingSup(null);
        refresh();
    }
    
    const openCreateModal = () => {
        setErrors({});
        setNewSup({ name: '', address: emptyAddress, ic: '', dic: '', email: '', phone: '', description: '' });
        setIsCreateOpen(true);
    };

    const toggleContacts = (id: string) => {
        setContactErrors({});
        setNewContact({ name: '', email: '', phone: '', position: '' });
        if(viewContactsFor === id) { setViewContactsFor(null); }
        else { setViewContactsFor(id); setContacts(db.supplierContacts.list(id)); }
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

    const addContact = (supId: string) => {
        if(!validateContact(newContact)) return;

        db.supplierContacts.add({...newContact, supplierId: supId});
        setContacts(db.supplierContacts.list(supId));
        setNewContact({ name: '', email: '', phone: '', position: '' });
        setContactErrors({});
    }
    
    const promptDeleteContact = (supId: string, id: string) => {
        setConfirmDelete({ show: true, type: 'contact', id, supId });
    }

    const executeDelete = () => {
        if (confirmDelete.type === 'contact') {
            db.supplierContacts.delete(confirmDelete.id);
            if (confirmDelete.supId) setContacts(db.supplierContacts.list(confirmDelete.supId));
        }
        setConfirmDelete({ show: false, type: 'supplier', id: '' });
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">{t('menu.suppliers')}</h2>
                <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                    <Plus className="w-4 h-4 mr-2" /> {t('headers.new_supplier')}
                </button>
            </div>

            <div className="space-y-4">
                {suppliers.map(s => (
                    <div key={s.id} className="bg-white rounded border border-slate-200">
                        <div className="p-4 flex justify-between items-start">
                            <div>
                                <div className="font-bold text-lg">{s.name}</div>
                                <div className="text-sm text-slate-500">{s.address.street} {s.address.number}, {s.address.city}</div>
                                <div className="text-xs text-slate-400 mt-1">{t('form.ic')}: {s.ic} | {t('form.phone')}: {s.phone}</div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => toggleContacts(s.id)} className="bg-slate-100 text-slate-600 px-3 py-1 rounded text-sm">{t('headers.contacts')}</button>
                                <button onClick={() => { setErrors({}); setEditingSup(s); }} className="text-blue-600 p-1"><Edit className="w-4 h-4"/></button>
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
                                        <button onClick={() => promptDeleteContact(s.id, c.id)} className="text-red-500"><Trash className="w-3 h-3"/></button>
                                    </div>
                                ))}
                                <div className="grid grid-cols-5 gap-2 mt-2 items-start">
                                    <div className="w-full">
                                        <input placeholder={t('form.user_name')} className={`border p-1 text-sm rounded w-full ${contactErrors.name ? 'border-red-500' : ''}`} value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                                    </div>
                                    <div className="w-full">
                                        <input placeholder={t('form.position')} className={`border p-1 text-sm rounded w-full ${contactErrors.position ? 'border-red-500' : ''}`} value={newContact.position} onChange={e => setNewContact({...newContact, position: e.target.value})} />
                                    </div>
                                    <div className="w-full">
                                        <input placeholder={t('form.email')} className={`border p-1 text-sm rounded w-full ${contactErrors.email ? 'border-red-500' : ''}`} value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
                                    </div>
                                    <div className="w-full">
                                        <input placeholder={t('form.phone')} className={`border p-1 text-sm rounded w-full ${contactErrors.phone ? 'border-red-500' : ''}`} value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
                                    </div>
                                    <button onClick={() => addContact(s.id)} className="bg-blue-600 text-white rounded text-sm py-1">{t('common.add')}</button>
                                </div>
                                {Object.keys(contactErrors).length > 0 && <div className="text-xs text-red-500 mt-1">Všechna pole jsou povinná.</div>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Create Modal */}
            {isCreateOpen && (
                <Modal title={t('headers.new_supplier')} onClose={() => setIsCreateOpen(false)}>
                     <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="col-span-2">
                             <label className="block text-xs text-slate-500 mb-1">{t('form.name')}</label>
                             <input className={`p-2 border rounded w-full ${errors.name ? 'border-red-500' : ''}`} value={newSup.name} onChange={e => setNewSup({...newSup, name: e.target.value})} />
                             {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
                        </div>
                        <div className="col-span-1">
                             <input placeholder={t('form.ic')} className="p-2 border rounded w-full" value={newSup.ic} onChange={e => setNewSup({...newSup, ic: e.target.value})} />
                        </div>
                        <div className="col-span-1">
                             <input placeholder={t('form.phone')} className={`p-2 border rounded w-full ${errors.phone ? 'border-red-500' : ''}`} value={newSup.phone} onChange={e => setNewSup({...newSup, phone: e.target.value})} />
                             {errors.phone && <span className="text-xs text-red-500">{errors.phone}</span>}
                        </div>
                        <div className="col-span-2">
                             <input placeholder={t('form.email')} className={`p-2 border rounded w-full ${errors.email ? 'border-red-500' : ''}`} value={newSup.email} onChange={e => setNewSup({...newSup, email: e.target.value})} />
                             {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
                        </div>
                    </div>
                    <AddressInput address={newSup.address} onChange={a => setNewSup({...newSup, address: a})} errors={errors} />
                    <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                        <button onClick={() => setIsCreateOpen(false)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                        <button onClick={handleAddSup} className="bg-blue-600 text-white px-4 py-2 rounded">{t('common.create')}</button>
                    </div>
                </Modal>
            )}

            {/* Edit Modal */}
            {editingSup && (
                <Modal title={t('headers.edit_supplier')} onClose={() => setEditingSup(null)}>
                     <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="col-span-2">
                            <label className="block text-xs text-slate-500 mb-1">{t('form.name')}</label>
                            <input className={`p-2 border rounded w-full ${errors.name ? 'border-red-500' : ''}`} value={editingSup.name} onChange={e => setEditingSup({...editingSup, name: e.target.value})} />
                             {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
                        </div>
                        <div className="col-span-1">
                            <input className="p-2 border rounded w-full" value={editingSup.ic} onChange={e => setEditingSup({...editingSup, ic: e.target.value})} />
                        </div>
                        <div className="col-span-1">
                            <input className={`p-2 border rounded w-full ${errors.phone ? 'border-red-500' : ''}`} value={editingSup.phone} onChange={e => setEditingSup({...editingSup, phone: e.target.value})} />
                            {errors.phone && <span className="text-xs text-red-500">{errors.phone}</span>}
                        </div>
                        <div className="col-span-2">
                            <input className={`p-2 border rounded w-full ${errors.email ? 'border-red-500' : ''}`} value={editingSup.email} onChange={e => setEditingSup({...editingSup, email: e.target.value})} />
                            {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
                        </div>
                    </div>
                    <AddressInput address={editingSup.address} onChange={a => setEditingSup({...editingSup, address: a})} errors={errors} />
                    <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                        <button onClick={() => setEditingSup(null)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                        <button onClick={handleUpdateSup} className="bg-blue-600 text-white px-3 py-2 rounded">{t('common.save')}</button>
                    </div>
                </Modal>
            )}

            {confirmDelete.show && (
                <ConfirmModal 
                    message={t('msg.confirm_delete')} 
                    onConfirm={executeDelete} 
                    onCancel={() => setConfirmDelete({ show: false, type: 'supplier', id: '' })} 
                />
            )}
        </div>
    );
};