
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../../lib/db';
import { Edit, Trash, Plus, Eye, EyeOff, Loader } from 'lucide-react';
import { Address } from '../../lib/types';
import { AddressInput, Modal, AlertModal, ConfirmModal } from '../../components/Shared';
import { useI18n } from '../../lib/i18n';

export const LocationsPage = () => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [workplaces, setWorkplaces] = useState<any[]>([]);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateWpOpen, setIsCreateWpOpen] = useState(false);
  const [createWpLocationId, setCreateWpLocationId] = useState<string | null>(null);

  const [editingLoc, setEditingLoc] = useState<any>(null);
  const [editingWp, setEditingWp] = useState<any>(null);

  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [deleteWpId, setDeleteWpId] = useState<string | null>(null);

  const emptyAddress: Address = { street: '', number: '', zip: '', city: '', country: 'SK' };
  const [newLoc, setNewLoc] = useState({ name: '', address: emptyAddress, isVisible: true });
  const [newWp, setNewWp] = useState({ name: '', description: '', locationId: '', isVisible: true });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));

  const refresh = async () => {
      setLoading(true);
      try {
          if (isMock) {
              setLocations(db.locations.list());
              setWorkplaces(db.workplaces.list());
          } else {
              const [locs, wps] = await Promise.all([api.get('/locations'), api.get('/locations/workplaces')]);
              setLocations(locs);
              setWorkplaces(wps);
          }
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const validateForm = (data: any, type: 'location' | 'workplace') => {
      const newErrors: Record<string, string> = {};
      if (!data.name || data.name.length < 2) newErrors.name = "Název musí mít alespoň 2 znaky.";
      if (type === 'location') {
          if (!data.address.street) newErrors.street = "Ulice je povinná.";
          if (!data.address.number) newErrors.number = "Číslo je povinné.";
          if (!data.address.city) newErrors.city = "Město musí mít alespoň 2 znaky.";
          if (!data.address.zip) newErrors.zip = "PSČ je povinné.";
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const handleAddLoc = async () => {
    if(!validateForm(newLoc, 'location')) return;
    try {
        if(isMock) db.locations.add(newLoc);
        else await api.post('/locations', newLoc);
        
        setNewLoc({ name: '', address: emptyAddress, isVisible: true });
        setIsCreateOpen(false);
        refresh();
    } catch(e) { console.error(e); }
  };

  const handleUpdateLoc = async () => {
      if(!editingLoc) return;
      if(!validateForm(editingLoc, 'location')) return;
      try {
          if(isMock) db.locations.update(editingLoc.id, editingLoc);
          else await api.put(`/locations/${editingLoc.id}`, editingLoc);
          
          setEditingLoc(null);
          refresh();
      } catch(e) { console.error(e); }
  };

  const confirmDeleteWp = async () => {
      if (deleteWpId) {
          try {
              if (isMock) db.workplaces.delete(deleteWpId);
              else {
                  // Using fetch because API helper currently lacks generic DELETE
                  const token = localStorage.getItem('auth_token');
                  const res = await fetch(`${api.baseUrl}/api/locations/workplaces/${deleteWpId}`, {
                      method: 'DELETE',
                      headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if(!res.ok) throw new Error('Delete failed');
              }
              setDeleteWpId(null);
              refresh();
          } catch(e: any) { setAlertMsg("Nelze smazat pracoviště (může být používáno)."); }
      }
  }
  
  const handleUpdateWp = async () => {
      if(!editingWp) return;
      if(!validateForm(editingWp, 'workplace')) return;
      try {
          if(isMock) db.workplaces.update(editingWp.id, editingWp);
          else await api.put(`/locations/workplaces/${editingWp.id}`, editingWp);
          
          setEditingWp(null);
          refresh();
      } catch(e) { console.error(e); }
  }

  const handleAddWp = async () => {
      if(!createWpLocationId) return;
      if(!validateForm(newWp, 'workplace')) return;
      try {
          const payload = { ...newWp, locationId: createWpLocationId };
          if(isMock) db.workplaces.add(payload);
          else await api.post('/locations/workplaces', payload);
          
          setIsCreateWpOpen(false);
          setCreateWpLocationId(null);
          refresh();
      } catch(e) { console.error(e); }
  }

  if (loading) return <div className="p-10 text-center"><Loader className="animate-spin w-8 h-8 mx-auto text-blue-600"/></div>;

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
           <h2 className="text-xl font-bold text-slate-800">{t('headers.locations')}</h2>
           <button onClick={() => { setErrors({}); setNewLoc({ name: '', address: emptyAddress, isVisible: true }); setIsCreateOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
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
                                       {loc.address.street} {loc.address.number}, {loc.address.zip} {loc.address.city}, {loc.address.country}
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
                                      <button onClick={() => setDeleteWpId(wp.id)} className="text-red-400 hover:text-red-600"><Trash className="w-3 h-3"/></button>
                                  </div>
                              </div>
                          ))}
                          <div className="mt-4 border-t pt-2">
                              <button onClick={() => { setErrors({}); setCreateWpLocationId(loc.id); setNewWp({ name: '', description: '', locationId: loc.id, isVisible: true }); setIsCreateWpOpen(true); }} className="w-full py-2 bg-slate-50 text-slate-600 border border-dashed border-slate-300 rounded hover:bg-slate-100 text-sm flex items-center justify-center">
                                  <Plus className="w-4 h-4 mr-2"/> Přidat pracoviště
                              </button>
                          </div>
                      </div>
                  </div>
              )
          })}
       </div>

       {/* Modals identical to previous but using Async handlers */}
       {isCreateOpen && (
           <Modal title={t('headers.new_location')} onClose={() => setIsCreateOpen(false)}>
               <div className="mb-2">
                   <label className="block text-xs text-slate-500 mb-1">{t('form.name')}</label>
                   <input className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} value={newLoc.name} onChange={e => setNewLoc({...newLoc, name: e.target.value})} />
               </div>
               <AddressInput address={newLoc.address} onChange={a => setNewLoc({...newLoc, address: a})} errors={errors} />
               <div className="mt-4"><label className="flex items-center gap-2"><input type="checkbox" checked={newLoc.isVisible} onChange={e => setNewLoc({...newLoc, isVisible: e.target.checked})} /> <span className="text-sm">{t('form.is_visible')}</span></label></div>
               <div className="flex justify-end mt-4"><button onClick={handleAddLoc} className="bg-blue-600 text-white px-4 py-2 rounded">{t('common.create')}</button></div>
           </Modal>
       )}
       
       {isCreateWpOpen && (
           <Modal title="Přidat Pracoviště" onClose={() => setIsCreateWpOpen(false)}>
               <div className="mb-2"><input className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} placeholder={t('form.name')} value={newWp.name} onChange={e => setNewWp({...newWp, name: e.target.value})} /></div>
               <div className="mb-2"><input className="w-full border p-2 rounded" placeholder={t('form.description')} value={newWp.description} onChange={e => setNewWp({...newWp, description: e.target.value})} /></div>
               <div className="mt-4"><label className="flex items-center gap-2"><input type="checkbox" checked={newWp.isVisible} onChange={e => setNewWp({...newWp, isVisible: e.target.checked})} /> <span className="text-sm">{t('form.is_visible')}</span></label></div>
               <div className="flex justify-end mt-4"><button onClick={handleAddWp} className="bg-blue-600 text-white px-4 py-2 rounded">{t('common.create')}</button></div>
           </Modal>
       )}

       {editingLoc && (
           <Modal title={t('headers.edit_location')} onClose={() => setEditingLoc(null)}>
               <div className="mb-2"><input className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} value={editingLoc.name} onChange={e => setEditingLoc({...editingLoc, name: e.target.value})} /></div>
               <AddressInput address={editingLoc.address} onChange={a => setEditingLoc({...editingLoc, address: a})} errors={errors} />
               <div className="mt-4"><label className="flex items-center gap-2"><input type="checkbox" checked={editingLoc.isVisible} onChange={e => setEditingLoc({...editingLoc, isVisible: e.target.checked})} /> <span className="text-sm">{t('form.is_visible')}</span></label></div>
               <div className="flex justify-end mt-4"><button onClick={handleUpdateLoc} className="bg-blue-600 text-white px-3 py-2 rounded">{t('common.save')}</button></div>
           </Modal>
       )}

       {editingWp && (
           <Modal title={t('common.edit') + ' ' + t('form.workplace')} onClose={() => setEditingWp(null)}>
               <div className="mb-2"><input className={`w-full border p-2 mb-2 rounded ${errors.name ? 'border-red-500' : ''}`} placeholder={t('form.name')} value={editingWp.name} onChange={e => setEditingWp({...editingWp, name: e.target.value})} /></div>
               <div className="mb-2"><input className="w-full border p-2 mb-2 rounded" placeholder={t('form.description')} value={editingWp.description} onChange={e => setEditingWp({...editingWp, description: e.target.value})} /></div>
               <div className="mt-2"><label className="flex items-center gap-2"><input type="checkbox" checked={editingWp.isVisible} onChange={e => setEditingWp({...editingWp, isVisible: e.target.checked})} /> <span className="text-sm">{t('form.is_visible')}</span></label></div>
               <div className="flex justify-end mt-4"><button onClick={handleUpdateWp} className="bg-blue-600 text-white px-3 py-2 rounded">{t('common.save')}</button></div>
           </Modal>
       )}

       {alertMsg && <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
       {deleteWpId && <ConfirmModal message={t('msg.confirm_delete')} onConfirm={confirmDeleteWp} onCancel={() => setDeleteWpId(null)} />}
    </div>
  );
};
