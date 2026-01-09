
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../../lib/db';
import { Edit, Trash, Plus, Eye, EyeOff, Loader, Box } from 'lucide-react';
import { Address } from '../../lib/types';
import { AddressInput, Modal, AlertModal, ConfirmModal } from '../../components/Shared';
import { useI18n } from '../../lib/i18n';
import { getLocalized, prepareMultilingual } from '../../lib/helpers';

interface LocationsPageProps {
    onNavigate?: (page: string, params?: any) => void;
}

export const LocationsPage = ({ onNavigate }: LocationsPageProps) => {
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false); // New state for save loading
  const [locations, setLocations] = useState<any[]>([]);
  const [workplaces, setWorkplaces] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]); // Need assets to count
  
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
              setAssets(db.technologies.list());
          } else {
              const [locs, wps, tech] = await Promise.all([
                  api.get('/locations'), 
                  api.get('/locations/workplaces'),
                  api.get('/technologies')
              ]);
              setLocations(locs);
              setWorkplaces(wps);
              setAssets(tech);
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
    setSaving(true);
    try {
        const translatedName = await prepareMultilingual(newLoc.name);
        const payload = { ...newLoc, name: translatedName };

        if(isMock) db.locations.add(payload);
        else await api.post('/locations', payload);
        
        setNewLoc({ name: '', address: emptyAddress, isVisible: true });
        setIsCreateOpen(false);
        refresh();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleUpdateLoc = async () => {
      if(!editingLoc) return;
      if(!validateForm(editingLoc, 'location')) return;
      setSaving(true);
      try {
          const translatedName = await prepareMultilingual(editingLoc.name);
          const payload = { ...editingLoc, name: translatedName };

          if(isMock) db.locations.update(editingLoc.id, payload);
          else await api.put(`/locations/${editingLoc.id}`, payload);
          
          setEditingLoc(null);
          refresh();
      } catch(e) { console.error(e); }
      finally { setSaving(false); }
  };

  const handleUpdateWp = async () => {
      if(!editingWp) return;
      if(!validateForm(editingWp, 'workplace')) return;
      setSaving(true);
      try {
          const translatedName = await prepareMultilingual(editingWp.name);
          const translatedDesc = await prepareMultilingual(editingWp.description);
          const payload = { ...editingWp, name: translatedName, description: translatedDesc };

          if(isMock) db.workplaces.update(editingWp.id, payload);
          else await api.put(`/locations/workplaces/${editingWp.id}`, payload);
          
          setEditingWp(null);
          refresh();
      } catch(e) { console.error(e); }
      finally { setSaving(false); }
  }

  const handleAddWp = async () => {
      if(!createWpLocationId) return;
      if(!validateForm(newWp, 'workplace')) return;
      setSaving(true);
      try {
          const translatedName = await prepareMultilingual(newWp.name);
          const translatedDesc = await prepareMultilingual(newWp.description);
          
          const payload = { ...newWp, locationId: createWpLocationId, name: translatedName, description: translatedDesc };
          if(isMock) db.workplaces.add(payload);
          else await api.post('/locations/workplaces', payload);
          
          setIsCreateWpOpen(false);
          setCreateWpLocationId(null);
          refresh();
      } catch(e) { console.error(e); }
      finally { setSaving(false); }
  }

  const confirmDeleteWp = async () => {
      if (deleteWpId) {
          try {
              if (isMock) db.workplaces.delete(deleteWpId);
              else {
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

  // Pre-process for editing: Decode JSON to current lang for input field
  const startEditLoc = (loc: any) => {
      setEditingLoc({ ...loc, name: getLocalized(loc.name, lang) });
  };
  const startEditWp = (wp: any) => {
      setEditingWp({ 
          ...wp, 
          name: getLocalized(wp.name, lang),
          description: getLocalized(wp.description, lang)
      });
  };

  const getAssetCount = (type: 'loc'|'wp', id: string) => {
      if (type === 'wp') {
          return assets.filter(a => a.workplaceId === id).length;
      }
      // For location, sum assets of all workplaces in this location
      const locWps = workplaces.filter(w => w.locationId === id).map(w => w.id);
      return assets.filter(a => locWps.includes(a.workplaceId)).length;
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
              const locAssetCount = getAssetCount('loc', loc.id);
              return (
                  <div key={loc.id} className={`bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm ${!loc.isVisible ? 'opacity-75' : ''}`}>
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-start">
                           <div className="flex items-start gap-2">
                               {!loc.isVisible && <div title="Skryto"><EyeOff className="w-5 h-5 text-slate-400 mt-1" /></div>}
                               <div>
                                   <div className="font-bold text-lg flex items-center gap-2">
                                       {getLocalized(loc.name, lang)}
                                       <button 
                                            onClick={() => onNavigate && onNavigate('assets', { locationId: loc.id })}
                                            className="text-xs bg-white border border-slate-300 text-slate-600 px-2 py-0.5 rounded-full hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 flex items-center transition-colors font-normal shadow-sm"
                                            title="Zobrazit technologie v lokalitě"
                                        >
                                            <Box className="w-3 h-3 mr-1" /> {locAssetCount}
                                        </button>
                                   </div>
                                   <div className="text-sm text-slate-500">
                                       {loc.address.street} {loc.address.number}, {loc.address.zip} {loc.address.city}, {loc.address.country}
                                   </div>
                               </div>
                           </div>
                           <button onClick={() => { setErrors({}); startEditLoc(loc); }} className="text-blue-600 p-2 hover:bg-blue-50 rounded"><Edit className="w-4 h-4"/></button>
                      </div>
                      <div className="p-4">
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('headers.workplaces')}</h5>
                          {wps.length === 0 && <div className="text-sm text-slate-400 italic mb-2">Žádná pracoviště</div>}
                          {wps.map(wp => {
                              const wpAssetCount = getAssetCount('wp', wp.id);
                              return (
                                  <div key={wp.id} className="flex justify-between items-center py-2 border-b last:border-0 text-sm border-slate-100">
                                      <div className="flex items-center gap-2">
                                          {!wp.isVisible && <div title="Skryto"><EyeOff className="w-4 h-4 text-slate-400" /></div>}
                                          <span className="font-medium text-slate-700 flex items-center">
                                              {getLocalized(wp.name, lang)} 
                                              <button 
                                                onClick={() => onNavigate && onNavigate('assets', { workplaceId: wp.id })}
                                                className="ml-2 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full hover:bg-blue-100 hover:text-blue-700 flex items-center transition-colors font-normal"
                                                title="Zobrazit technologie"
                                              >
                                                <Box className="w-3 h-3 mr-1" /> {wpAssetCount}
                                              </button>
                                          </span>
                                          <span className="font-normal text-slate-400 ml-2">{getLocalized(wp.description, lang)}</span>
                                      </div>
                                      <div className="flex gap-2">
                                          <button onClick={() => { setErrors({}); startEditWp(wp); }} className="text-blue-600 hover:text-blue-800"><Edit className="w-3 h-3"/></button>
                                          <button onClick={() => setDeleteWpId(wp.id)} className="text-red-400 hover:text-red-600"><Trash className="w-3 h-3"/></button>
                                      </div>
                                  </div>
                              );
                          })}
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

       {isCreateOpen && (
           <Modal title={t('headers.new_location')} onClose={() => setIsCreateOpen(false)}>
               <div className="mb-2">
                   <label className="block text-xs text-slate-500 mb-1">{t('form.name')}</label>
                   <input className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} value={newLoc.name} onChange={e => setNewLoc({...newLoc, name: e.target.value})} />
               </div>
               <AddressInput address={newLoc.address} onChange={a => setNewLoc({...newLoc, address: a})} errors={errors} />
               <div className="mt-4"><label className="flex items-center gap-2"><input type="checkbox" checked={newLoc.isVisible} onChange={e => setNewLoc({...newLoc, isVisible: e.target.checked})} /> <span className="text-sm">{t('form.is_visible')}</span></label></div>
               <div className="flex justify-end mt-4">
                   <button onClick={handleAddLoc} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center">
                       {saving && <Loader className="animate-spin w-4 h-4 mr-2" />} {t('common.create')}
                   </button>
               </div>
           </Modal>
       )}
       
       {isCreateWpOpen && (
           <Modal title="Přidat Pracoviště" onClose={() => setIsCreateWpOpen(false)}>
               <div className="mb-2"><input className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} placeholder={t('form.name')} value={newWp.name} onChange={e => setNewWp({...newWp, name: e.target.value})} /></div>
               <div className="mb-2"><input className="w-full border p-2 rounded" placeholder={t('form.description')} value={newWp.description} onChange={e => setNewWp({...newWp, description: e.target.value})} /></div>
               <div className="mt-4"><label className="flex items-center gap-2"><input type="checkbox" checked={newWp.isVisible} onChange={e => setNewWp({...newWp, isVisible: e.target.checked})} /> <span className="text-sm">{t('form.is_visible')}</span></label></div>
               <div className="flex justify-end mt-4">
                   <button onClick={handleAddWp} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center">
                       {saving && <Loader className="animate-spin w-4 h-4 mr-2" />} {t('common.create')}
                   </button>
               </div>
           </Modal>
       )}

       {editingLoc && (
           <Modal title={t('headers.edit_location')} onClose={() => setEditingLoc(null)}>
               <div className="mb-2"><input className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} value={editingLoc.name} onChange={e => setEditingLoc({...editingLoc, name: e.target.value})} /></div>
               <AddressInput address={editingLoc.address} onChange={a => setEditingLoc({...editingLoc, address: a})} errors={errors} />
               <div className="mt-4"><label className="flex items-center gap-2"><input type="checkbox" checked={editingLoc.isVisible} onChange={e => setEditingLoc({...editingLoc, isVisible: e.target.checked})} /> <span className="text-sm">{t('form.is_visible')}</span></label></div>
               <div className="flex justify-end mt-4">
                   <button onClick={handleUpdateLoc} disabled={saving} className="bg-blue-600 text-white px-3 py-2 rounded flex items-center">
                       {saving && <Loader className="animate-spin w-4 h-4 mr-2" />} {t('common.save')}
                   </button>
               </div>
           </Modal>
       )}

       {editingWp && (
           <Modal title={t('common.edit') + ' ' + t('form.workplace')} onClose={() => setEditingWp(null)}>
               <div className="mb-2"><input className={`w-full border p-2 mb-2 rounded ${errors.name ? 'border-red-500' : ''}`} placeholder={t('form.name')} value={editingWp.name} onChange={e => setEditingWp({...editingWp, name: e.target.value})} /></div>
               <div className="mb-2"><input className="w-full border p-2 mb-2 rounded" placeholder={t('form.description')} value={editingWp.description} onChange={e => setEditingWp({...editingWp, description: e.target.value})} /></div>
               <div className="mt-2"><label className="flex items-center gap-2"><input type="checkbox" checked={editingWp.isVisible} onChange={e => setEditingWp({...editingWp, isVisible: e.target.checked})} /> <span className="text-sm">{t('form.is_visible')}</span></label></div>
               <div className="flex justify-end mt-4">
                   <button onClick={handleUpdateWp} disabled={saving} className="bg-blue-600 text-white px-3 py-2 rounded flex items-center">
                       {saving && <Loader className="animate-spin w-4 h-4 mr-2" />} {t('common.save')}
                   </button>
               </div>
           </Modal>
       )}

       {alertMsg && <AlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
       {deleteWpId && <ConfirmModal message={t('msg.confirm_delete')} onConfirm={confirmDeleteWp} onCancel={() => setDeleteWpId(null)} />}
    </div>
  );
};
