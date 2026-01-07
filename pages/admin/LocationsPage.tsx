import React, { useState } from 'react';
import { db } from '../../lib/db';
import { Edit, Trash, Plus, Eye, EyeOff } from 'lucide-react';
import { Address } from '../../lib/types';
import { AddressInput, Modal, AlertModal, ConfirmModal } from '../../components/Shared';
import { useI18n } from '../../lib/i18n';

export const LocationsPage = () => {
  const { t } = useI18n();
  const [locations, setLocations] = useState(db.locations.list());
  const [workplaces, setWorkplaces] = useState(db.workplaces.list());
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<any>(null);
  const [editingWp, setEditingWp] = useState<any>(null);

  // Alert/Confirm states
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [deleteWpId, setDeleteWpId] = useState<string | null>(null);

  // Form Data
  const emptyAddress: Address = { street: '', number: '', zip: '', city: '', country: 'SK' };
  const [newLoc, setNewLoc] = useState({ name: '', address: emptyAddress, isVisible: true });
  const [newWp, setNewWp] = useState({ name: '', description: '', locationId: '', isVisible: true });
  
  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refresh = () => { setLocations(db.locations.list()); setWorkplaces(db.workplaces.list()); };

  // Validation Helper
  const validateForm = (data: any, type: 'location' | 'workplace') => {
      const newErrors: Record<string, string> = {};
      
      if (!data.name) newErrors.name = t('validation.required');
      
      if (type === 'location') {
          if (!data.address.street) newErrors.street = t('validation.required');
          if (!data.address.city) newErrors.city = t('validation.required');
          if (!data.address.zip) newErrors.zip = t('validation.required');
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const handleAddLoc = () => {
    if(!validateForm(newLoc, 'location')) return;
    
    db.locations.add(newLoc);
    setNewLoc({ name: '', address: emptyAddress, isVisible: true });
    setIsCreateOpen(false);
    refresh();
  };

  const handleUpdateLoc = () => {
      if(!editingLoc) return;
      if(!validateForm(editingLoc, 'location')) return;

      db.locations.update(editingLoc.id, editingLoc);
      setEditingLoc(null);
      refresh();
  };

  const handleCreateOpen = () => {
      setErrors({});
      setNewLoc({ name: '', address: emptyAddress, isVisible: true });
      setIsCreateOpen(true);
  };

  // Workplace Logic
  const initiateDeleteWp = (id: string) => {
      if(db.workplaces.isUsed(id)) {
          setAlertMsg(t('msg.cannot_delete_used'));
          return;
      }
      setDeleteWpId(id);
  };

  const confirmDeleteWp = () => {
      if (deleteWpId) {
          db.workplaces.delete(deleteWpId);
          setDeleteWpId(null);
          refresh();
      }
  }
  
  const handleUpdateWp = () => {
      if(!editingWp) return;
      if(!validateForm(editingWp, 'workplace')) return;

      db.workplaces.update(editingWp.id, editingWp);
      setEditingWp(null);
      refresh();
  }

  const handleAddWp = (locId: string) => {
      const data = { ...newWp, locationId: locId, isVisible: true };
      if(!data.name) {
          setAlertMsg(t('validation.required')); 
          return;
      }
      
      db.workplaces.add(data);
      setNewWp({ name: '', description: '', locationId: '', isVisible: true });
      refresh();
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
           <h2 className="text-xl font-bold text-slate-800">{t('headers.locations')}</h2>
           <button onClick={handleCreateOpen} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                <Plus className="w-4 h-4 mr-2" /> {t('headers.new_location')}
           </button>
       </div>

       <div className="space-y-4">
          {locations.map(loc => {
              const wps = workplaces.filter(w => w.locationId === loc.id);
              return (
                  <div key={loc.id} className={`bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm ${!loc.isVisible ? 'opacity-75' : ''}`}>
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-start">
                           <div className="flex items-start gap-2">
                               {!loc.isVisible && <div title="Skryto"><EyeOff className="w-5 h-5 text-slate-400 mt-1" /></div>}
                               <div>
                                   <div className="font-bold text-lg">{loc.name}</div>
                                   <div className="text-sm text-slate-500">
                                       {loc.address.street}, {loc.address.zip} {loc.address.city}, {loc.address.country}
                                   </div>
                               </div>
                           </div>
                           <button onClick={() => { setErrors({}); setEditingLoc(loc); }} className="text-blue-600 p-2 hover:bg-blue-50 rounded"><Edit className="w-4 h-4"/></button>
                      </div>
                      <div className="p-4">
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('headers.workplaces')}</h5>
                          {wps.length === 0 && <div className="text-sm text-slate-400 italic mb-2">Žádná pracoviště</div>}
                          {wps.map(wp => (
                              <div key={wp.id} className="flex justify-between items-center py-2 border-b last:border-0 text-sm border-slate-100">
                                  <div className="flex items-center gap-2">
                                      {!wp.isVisible && <div title="Skryto"><EyeOff className="w-4 h-4 text-slate-400" /></div>}
                                      <span className="font-medium text-slate-700">{wp.name} <span className="font-normal text-slate-400 ml-2">{wp.description}</span></span>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => { setErrors({}); setEditingWp(wp); }} className="text-blue-600 hover:text-blue-800"><Edit className="w-3 h-3"/></button>
                                      <button onClick={() => initiateDeleteWp(wp.id)} className="text-red-400 hover:text-red-600"><Trash className="w-3 h-3"/></button>
                                  </div>
                              </div>
                          ))}
                          <div className="mt-3 flex gap-2 pt-2">
                              <input 
                                placeholder={t('form.name')} 
                                className="border p-1.5 text-sm rounded flex-1 focus:outline-none focus:border-blue-500 transition-colors" 
                                value={newWp.locationId === loc.id ? newWp.name : ''} 
                                onChange={e => setNewWp({...newWp, locationId: loc.id, name: e.target.value})} 
                              />
                              <input 
                                placeholder={t('form.description')} 
                                className="border p-1.5 text-sm rounded flex-1 focus:outline-none focus:border-blue-500 transition-colors" 
                                value={newWp.locationId === loc.id ? newWp.description : ''} 
                                onChange={e => setNewWp({...newWp, locationId: loc.id, description: e.target.value})} 
                              />
                              <button onClick={() => handleAddWp(loc.id)} className="bg-slate-100 text-slate-600 px-3 rounded text-sm font-medium hover:bg-slate-200">{t('common.add')}</button>
                          </div>
                      </div>
                  </div>
              )
          })}
       </div>

       {/* Create Modal */}
       {isCreateOpen && (
           <Modal title={t('headers.new_location')} onClose={() => setIsCreateOpen(false)}>
               <div className="mb-2">
                   <label className="block text-xs text-slate-500 mb-1">{t('form.name')}</label>
                   <input 
                        className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} 
                        value={newLoc.name} 
                        onChange={e => setNewLoc({...newLoc, name: e.target.value})} 
                   />
                   {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
               </div>
               <AddressInput address={newLoc.address} onChange={a => setNewLoc({...newLoc, address: a})} errors={errors} />
               <div className="mt-4">
                   <label className="flex items-center gap-2 cursor-pointer">
                       <input type="checkbox" checked={newLoc.isVisible} onChange={e => setNewLoc({...newLoc, isVisible: e.target.checked})} />
                       <span className="text-sm font-medium">{t('form.is_visible')}</span>
                   </label>
               </div>
               <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                   <button onClick={() => setIsCreateOpen(false)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                   <button onClick={handleAddLoc} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('common.create')}</button>
               </div>
           </Modal>
       )}

       {/* Edit Location Modal */}
       {editingLoc && (
           <Modal title={t('headers.edit_location')} onClose={() => setEditingLoc(null)}>
               <div className="mb-2">
                   <label className="block text-xs text-slate-500 mb-1">{t('form.name')}</label>
                   <input 
                        className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} 
                        value={editingLoc.name} 
                        onChange={e => setEditingLoc({...editingLoc, name: e.target.value})} 
                   />
                   {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
               </div>
               <AddressInput address={editingLoc.address} onChange={a => setEditingLoc({...editingLoc, address: a})} errors={errors} />
               <div className="mt-4">
                   <label className="flex items-center gap-2 cursor-pointer">
                       <input type="checkbox" checked={editingLoc.isVisible} onChange={e => setEditingLoc({...editingLoc, isVisible: e.target.checked})} />
                       <span className="text-sm font-medium">{t('form.is_visible')}</span>
                   </label>
               </div>
               <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                   <button onClick={() => setEditingLoc(null)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                   <button onClick={handleUpdateLoc} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">{t('common.save')}</button>
               </div>
           </Modal>
       )}

       {/* Edit Workplace Modal */}
       {editingWp && (
           <Modal title={t('common.edit') + ' ' + t('form.workplace')} onClose={() => setEditingWp(null)}>
               <div className="mb-2">
                   <label className="block text-xs text-slate-500 mb-1">{t('form.name')}</label>
                   <input 
                        className={`w-full border p-2 mb-2 rounded ${errors.name ? 'border-red-500' : ''}`} 
                        placeholder={t('form.name')} 
                        value={editingWp.name} 
                        onChange={e => setEditingWp({...editingWp, name: e.target.value})} 
                   />
                   {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
               </div>
               <div className="mb-2">
                   <label className="block text-xs text-slate-500 mb-1">{t('form.description')}</label>
                   <input className="w-full border p-2 mb-2 rounded" placeholder={t('form.description')} value={editingWp.description} onChange={e => setEditingWp({...editingWp, description: e.target.value})} />
               </div>
               <div className="mt-2">
                   <label className="flex items-center gap-2 cursor-pointer">
                       <input type="checkbox" checked={editingWp.isVisible} onChange={e => setEditingWp({...editingWp, isVisible: e.target.checked})} />
                       <span className="text-sm font-medium">{t('form.is_visible')}</span>
                   </label>
               </div>
               <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                    <button onClick={() => setEditingWp(null)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                    <button onClick={handleUpdateWp} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">{t('common.save')}</button>
               </div>
           </Modal>
       )}

       {alertMsg && <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
       {deleteWpId && <ConfirmModal message={t('msg.confirm_delete')} onConfirm={confirmDeleteWp} onCancel={() => setDeleteWpId(null)} />}
    </div>
  );
};