import React, { useState } from 'react';
import { db, uid } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { Plus, Trash, Edit, Save, X, ChevronRight, ChevronDown, CheckSquare, Square, Lock, Unlock } from 'lucide-react';
import { Address, User } from '../lib/types';

// --- Shared Components ---
const AddressInput = ({ address, onChange }: { address: Address, onChange: (a: Address) => void }) => (
    <div className="grid grid-cols-6 gap-2 text-sm mt-2 bg-slate-50 p-3 rounded border border-slate-100">
        <div className="col-span-4">
            <label className="block text-xs text-slate-500">Ulice</label>
            <input className="w-full border p-1 rounded" value={address.street} onChange={e => onChange({...address, street: e.target.value})} />
        </div>
        <div className="col-span-2">
            <label className="block text-xs text-slate-500">Číslo</label>
            <input className="w-full border p-1 rounded" value={address.number} onChange={e => onChange({...address, number: e.target.value})} />
        </div>
        <div className="col-span-2">
             <label className="block text-xs text-slate-500">PSČ</label>
             <input className="w-full border p-1 rounded" value={address.zip} onChange={e => onChange({...address, zip: e.target.value})} />
        </div>
        <div className="col-span-3">
             <label className="block text-xs text-slate-500">Město</label>
             <input className="w-full border p-1 rounded" value={address.city} onChange={e => onChange({...address, city: e.target.value})} />
        </div>
        <div className="col-span-1">
             <label className="block text-xs text-slate-500">Země</label>
             <select className="w-full border p-1 rounded bg-slate-100" disabled value={address.country}><option value="SK">SK</option></select>
        </div>
    </div>
);

const Modal = ({ title, onClose, children }: any) => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold">{title}</h3>
                <button onClick={onClose}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">{children}</div>
        </div>
    </div>
);

// --- Locations & Workplaces ---
export const LocationsPage = () => {
  const [locations, setLocations] = useState(db.locations.list());
  const [workplaces, setWorkplaces] = useState(db.workplaces.list());
  const [editingLoc, setEditingLoc] = useState<any>(null);
  const [editingWp, setEditingWp] = useState<any>(null);

  const emptyAddress: Address = { street: '', number: '', zip: '', city: '', country: 'SK' };
  const [newLoc, setNewLoc] = useState({ name: '', address: emptyAddress, isVisible: true });
  const [newWp, setNewWp] = useState({ name: '', description: '', locationId: '', isVisible: true });

  const refresh = () => { setLocations(db.locations.list()); setWorkplaces(db.workplaces.list()); };

  const handleAddLoc = () => {
    if(!newLoc.name) return;
    db.locations.add(newLoc);
    setNewLoc({ name: '', address: emptyAddress, isVisible: true });
    refresh();
  };

  const handleUpdateLoc = () => {
      if(!editingLoc) return;
      db.locations.update(editingLoc.id, editingLoc);
      setEditingLoc(null);
      refresh();
  };

  const handleDeleteWp = (id: string) => {
      if(db.workplaces.isUsed(id)) {
          alert("Nelze smazat pracoviště, je na něm vedena technologie.");
          return;
      }
      if(confirm("Opravdu smazat pracoviště?")) {
          db.workplaces.delete(id);
          refresh();
      }
  };
  
  const handleUpdateWp = () => {
      if(!editingWp) return;
      db.workplaces.update(editingWp.id, editingWp);
      setEditingWp(null);
      refresh();
  }

  const handleAddWp = (locId: string) => {
      if(!newWp.name) return;
      db.workplaces.add({...newWp, locationId: locId});
      setNewWp({ name: '', description: '', locationId: '', isVisible: true });
      refresh();
  }

  return (
    <div className="space-y-8">
       {/* Create Location */}
       <div className="bg-white p-4 rounded shadow-sm border border-slate-200">
         <h4 className="font-bold mb-3 text-slate-800">Nová Lokalita</h4>
         <input placeholder="Název lokality" className="p-2 border rounded w-full mb-2" value={newLoc.name} onChange={e => setNewLoc({...newLoc, name: e.target.value})} />
         <AddressInput address={newLoc.address} onChange={a => setNewLoc({...newLoc, address: a})} />
         <button onClick={handleAddLoc} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded text-sm">Vytvořit lokalitu</button>
       </div>

       <div className="space-y-4">
          {locations.map(loc => {
              const wps = workplaces.filter(w => w.locationId === loc.id);
              return (
                  <div key={loc.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-start">
                           <div>
                               <div className="font-bold text-lg">{loc.name}</div>
                               <div className="text-sm text-slate-500">
                                   {loc.address.street} {loc.address.number}, {loc.address.zip} {loc.address.city}, {loc.address.country}
                               </div>
                           </div>
                           <button onClick={() => setEditingLoc(loc)} className="text-blue-600 p-1"><Edit className="w-4 h-4"/></button>
                      </div>
                      <div className="p-4">
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pracoviště</h5>
                          {wps.map(wp => (
                              <div key={wp.id} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                                  <span>{wp.name} <span className="text-slate-400">- {wp.description}</span></span>
                                  <div className="flex gap-2">
                                      <button onClick={() => setEditingWp(wp)} className="text-blue-600"><Edit className="w-3 h-3"/></button>
                                      <button onClick={() => handleDeleteWp(wp.id)} className="text-red-500"><Trash className="w-3 h-3"/></button>
                                  </div>
                              </div>
                          ))}
                          <div className="mt-3 flex gap-2">
                              <input placeholder="Název pracoviště" className="border p-1 text-sm rounded flex-1" value={newWp.locationId === loc.id ? newWp.name : ''} onChange={e => setNewWp({...newWp, locationId: loc.id, name: e.target.value})} />
                              <input placeholder="Popis" className="border p-1 text-sm rounded flex-1" value={newWp.locationId === loc.id ? newWp.description : ''} onChange={e => setNewWp({...newWp, locationId: loc.id, description: e.target.value})} />
                              <button onClick={() => handleAddWp(loc.id)} className="bg-slate-200 px-2 rounded text-sm">Přidat</button>
                          </div>
                      </div>
                  </div>
              )
          })}
       </div>

       {editingLoc && (
           <Modal title="Upravit Lokalitu" onClose={() => setEditingLoc(null)}>
               <input className="w-full border p-2 mb-2 rounded" value={editingLoc.name} onChange={e => setEditingLoc({...editingLoc, name: e.target.value})} />
               <AddressInput address={editingLoc.address} onChange={a => setEditingLoc({...editingLoc, address: a})} />
               <div className="flex justify-end mt-4"><button onClick={handleUpdateLoc} className="bg-blue-600 text-white px-3 py-2 rounded">Uložit</button></div>
           </Modal>
       )}

       {editingWp && (
           <Modal title="Upravit Pracoviště" onClose={() => setEditingWp(null)}>
               <input className="w-full border p-2 mb-2 rounded" placeholder="Název" value={editingWp.name} onChange={e => setEditingWp({...editingWp, name: e.target.value})} />
               <input className="w-full border p-2 mb-2 rounded" placeholder="Popis" value={editingWp.description} onChange={e => setEditingWp({...editingWp, description: e.target.value})} />
               <div className="flex justify-end mt-4"><button onClick={handleUpdateWp} className="bg-blue-600 text-white px-3 py-2 rounded">Uložit</button></div>
           </Modal>
       )}
    </div>
  );
};

// --- Suppliers ---
export const SuppliersPage = () => {
    const [suppliers, setSuppliers] = useState(db.suppliers.list());
    const [contacts, setContacts] = useState<any[]>([]); // We load this on demand or all
    const [viewContactsFor, setViewContactsFor] = useState<string | null>(null);
    const [editingSup, setEditingSup] = useState<any>(null);
    const emptyAddress: Address = { street: '', number: '', zip: '', city: '', country: 'SK' };
    const [newSup, setNewSup] = useState({ name: '', address: emptyAddress, ic: '', dic: '', email: '', phone: '', description: '' });
    const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', position: '' });

    const refresh = () => setSuppliers(db.suppliers.list());

    const handleAddSup = () => {
        if(!newSup.name) return;
        db.suppliers.add(newSup);
        setNewSup({ name: '', address: emptyAddress, ic: '', dic: '', email: '', phone: '', description: '' });
        refresh();
    };

    const handleUpdateSup = () => {
        if(!editingSup) return;
        db.suppliers.update(editingSup.id, editingSup);
        setEditingSup(null);
        refresh();
    }

    const toggleContacts = (id: string) => {
        if(viewContactsFor === id) { setViewContactsFor(null); }
        else { setViewContactsFor(id); setContacts(db.supplierContacts.list(id)); }
    }

    const addContact = (supId: string) => {
        if(!newContact.name) return;
        db.supplierContacts.add({...newContact, supplierId: supId});
        setContacts(db.supplierContacts.list(supId));
        setNewContact({ name: '', email: '', phone: '', position: '' });
    }
    
    const deleteContact = (supId: string, id: string) => {
        db.supplierContacts.delete(id);
        setContacts(db.supplierContacts.list(supId));
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded shadow-sm border border-slate-200">
                <h4 className="font-bold mb-3">Nový Dodavatel</h4>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <input placeholder="Název" className="p-2 border rounded" value={newSup.name} onChange={e => setNewSup({...newSup, name: e.target.value})} />
                    <input placeholder="IČ" className="p-2 border rounded" value={newSup.ic} onChange={e => setNewSup({...newSup, ic: e.target.value})} />
                    <input placeholder="Email" className="p-2 border rounded" value={newSup.email} onChange={e => setNewSup({...newSup, email: e.target.value})} />
                    <input placeholder="Telefon" className="p-2 border rounded" value={newSup.phone} onChange={e => setNewSup({...newSup, phone: e.target.value})} />
                </div>
                <AddressInput address={newSup.address} onChange={a => setNewSup({...newSup, address: a})} />
                <button onClick={handleAddSup} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded text-sm">Vytvořit dodavatele</button>
            </div>

            <div className="space-y-4">
                {suppliers.map(s => (
                    <div key={s.id} className="bg-white rounded border border-slate-200">
                        <div className="p-4 flex justify-between items-start">
                            <div>
                                <div className="font-bold text-lg">{s.name}</div>
                                <div className="text-sm text-slate-500">{s.address.street} {s.address.number}, {s.address.city}</div>
                                <div className="text-xs text-slate-400 mt-1">IČ: {s.ic} | Tel: {s.phone}</div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => toggleContacts(s.id)} className="bg-slate-100 text-slate-600 px-3 py-1 rounded text-sm">Kontakty</button>
                                <button onClick={() => setEditingSup(s)} className="text-blue-600 p-1"><Edit className="w-4 h-4"/></button>
                            </div>
                        </div>
                        {viewContactsFor === s.id && (
                            <div className="border-t bg-slate-50 p-4">
                                <h5 className="font-bold text-xs text-slate-500 uppercase mb-2">Kontaktní osoby</h5>
                                {contacts.map(c => (
                                    <div key={c.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 border border-slate-100 text-sm">
                                        <div>
                                            <span className="font-medium">{c.name}</span> <span className="text-slate-400">({c.position})</span>
                                            <div className="text-xs text-slate-400">{c.email}, {c.phone}</div>
                                        </div>
                                        <button onClick={() => deleteContact(s.id, c.id)} className="text-red-500"><Trash className="w-3 h-3"/></button>
                                    </div>
                                ))}
                                <div className="grid grid-cols-5 gap-2 mt-2">
                                    <input placeholder="Jméno" className="border p-1 text-sm rounded" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                                    <input placeholder="Pozice" className="border p-1 text-sm rounded" value={newContact.position} onChange={e => setNewContact({...newContact, position: e.target.value})} />
                                    <input placeholder="Email" className="border p-1 text-sm rounded" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
                                    <input placeholder="Tel" className="border p-1 text-sm rounded" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
                                    <button onClick={() => addContact(s.id)} className="bg-blue-600 text-white rounded text-sm">Přidat</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            {editingSup && (
                <Modal title="Upravit Dodavatele" onClose={() => setEditingSup(null)}>
                     <div className="grid grid-cols-2 gap-2 mb-2">
                        <input className="p-2 border rounded w-full" value={editingSup.name} onChange={e => setEditingSup({...editingSup, name: e.target.value})} />
                        <input className="p-2 border rounded w-full" value={editingSup.ic} onChange={e => setEditingSup({...editingSup, ic: e.target.value})} />
                        <input className="p-2 border rounded w-full" value={editingSup.email} onChange={e => setEditingSup({...editingSup, email: e.target.value})} />
                        <input className="p-2 border rounded w-full" value={editingSup.phone} onChange={e => setEditingSup({...editingSup, phone: e.target.value})} />
                    </div>
                    <AddressInput address={editingSup.address} onChange={a => setEditingSup({...editingSup, address: a})} />
                    <div className="flex justify-end mt-4"><button onClick={handleUpdateSup} className="bg-blue-600 text-white px-3 py-2 rounded">Uložit</button></div>
                </Modal>
            )}
        </div>
    );
};

// --- Tech Config ---
export const TechConfigPage = () => {
    const [types, setTypes] = useState(db.techTypes.list());
    const [states, setStates] = useState(db.techStates.list());
    const [newType, setNewType] = useState({ name: '', description: '' });
    const [newState, setNewState] = useState({ name: '', description: '' });
    const [editingType, setEditingType] = useState<any>(null);
    const [editingState, setEditingState] = useState<any>(null);

    const refresh = () => { setTypes(db.techTypes.list()); setStates(db.techStates.list()); };

    const deleteType = (id: string) => {
        if(db.techTypes.isUsed(id)) { alert('Nelze smazat, typ je používán.'); return; }
        if(confirm('Smazat?')) { db.techTypes.delete(id); refresh(); }
    }
    const deleteState = (id: string) => {
         if(db.techStates.isUsed(id)) { alert('Nelze smazat, stav je používán.'); return; }
         if(confirm('Smazat?')) { db.techStates.delete(id); refresh(); }
    }
    const saveType = () => { if(editingType) { db.techTypes.update(editingType.id, editingType); setEditingType(null); refresh(); } }
    const saveState = () => { if(editingState) { db.techStates.update(editingState.id, editingState); setEditingState(null); refresh(); } }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h3 className="font-bold mb-2">Typy Technologií</h3>
                <div className="flex gap-2 mb-4">
                    <input className="border p-1 rounded flex-1" placeholder="Název" value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} />
                    <button className="bg-blue-600 text-white px-2 rounded" onClick={() => { db.techTypes.add(newType); refresh(); }}>+</button>
                </div>
                <div className="bg-white rounded border border-slate-200 divide-y">
                    {types.map(t => (
                        <div key={t.id} className="p-2 flex justify-between items-center group">
                            <span>{t.name}</span>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                                <button onClick={() => setEditingType(t)}><Edit className="w-3 h-3 text-blue-600"/></button>
                                <button onClick={() => deleteType(t.id)}><Trash className="w-3 h-3 text-red-600"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
             <div>
                <h3 className="font-bold mb-2">Stavy Technologií</h3>
                <div className="flex gap-2 mb-4">
                    <input className="border p-1 rounded flex-1" placeholder="Název" value={newState.name} onChange={e => setNewState({...newState, name: e.target.value})} />
                    <button className="bg-blue-600 text-white px-2 rounded" onClick={() => { db.techStates.add(newState); refresh(); }}>+</button>
                </div>
                <div className="bg-white rounded border border-slate-200 divide-y">
                    {states.map(t => (
                        <div key={t.id} className="p-2 flex justify-between items-center group">
                            <span>{t.name}</span>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                                <button onClick={() => setEditingState(t)}><Edit className="w-3 h-3 text-blue-600"/></button>
                                <button onClick={() => deleteState(t.id)}><Trash className="w-3 h-3 text-red-600"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {editingType && (
                <Modal title="Edit Typu" onClose={() => setEditingType(null)}>
                    <input value={editingType.name} onChange={e => setEditingType({...editingType, name: e.target.value})} className="border p-2 w-full rounded" />
                    <button onClick={saveType} className="mt-2 bg-blue-600 text-white px-3 py-1 rounded">Uložit</button>
                </Modal>
            )}
            {editingState && (
                <Modal title="Edit Stavu" onClose={() => setEditingState(null)}>
                    <input value={editingState.name} onChange={e => setEditingState({...editingState, name: e.target.value})} className="border p-2 w-full rounded" />
                    <button onClick={saveState} className="mt-2 bg-blue-600 text-white px-3 py-1 rounded">Uložit</button>
                </Modal>
            )}
        </div>
    );
};

// --- Users ---
export const UsersPage = () => {
    const [users, setUsers] = useState(db.users.list());
    const [newUser, setNewUser] = useState<any>({ name: '', email: '', role: 'operator', phone: '', isBlocked: false });
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const locations = db.locations.list();
    const workplaces = db.workplaces.list();

    const refresh = () => setUsers(db.users.list());
    const saveUser = () => { if(editingUser) { db.users.update(editingUser.id, editingUser); setEditingUser(null); refresh(); } }

    const togglePermission = (type: 'loc' | 'wp', id: string) => {
        if(!editingUser) return;
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

    return (
        <div className="space-y-6">
             <div className="bg-white p-4 rounded shadow-sm border border-slate-200 flex gap-2 items-center flex-wrap">
                <input placeholder="Jméno" className="p-2 border rounded" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                <input placeholder="Email" className="p-2 border rounded" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                <select className="p-2 border rounded" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="admin">Admin</option>
                    <option value="maintenance">Údržba</option>
                    <option value="operator">Obsluha</option>
                </select>
                <button onClick={() => { db.users.add({...newUser, assignedLocationIds: [], assignedWorkplaceIds: []}); refresh(); }} className="bg-blue-600 text-white px-4 py-2 rounded">Vytvořit</button>
            </div>
            
            <div className="bg-white rounded border border-slate-200 divide-y">
                {users.map(u => (
                     <div key={u.id} className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${u.isBlocked ? 'bg-red-200 text-red-800' : 'bg-slate-200'}`}>{u.name[0]}</div>
                            <div>
                                <div className="font-bold flex items-center gap-2">
                                    {u.name} {u.isBlocked && <Lock className="w-3 h-3 text-red-500"/>}
                                </div>
                                <div className="text-xs text-slate-500">{u.email} | {u.role}</div>
                            </div>
                        </div>
                        <button onClick={() => setEditingUser(u)} className="text-blue-600 flex items-center gap-1 bg-blue-50 px-3 py-1 rounded text-sm"><Edit className="w-3 h-3"/> Spravovat</button>
                    </div>
                ))}
            </div>

            {editingUser && (
                <Modal title={`Editace: ${editingUser.name}`} onClose={() => setEditingUser(null)}>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                        <div>
                             <label className="block text-xs font-bold mb-1">Základní info</label>
                             <input className="border p-2 w-full rounded mb-2" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                             <input className="border p-2 w-full rounded mb-2" value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
                             <label className="flex items-center gap-2 cursor-pointer mt-2">
                                 <input type="checkbox" checked={editingUser.isBlocked} onChange={e => setEditingUser({...editingUser, isBlocked: e.target.checked})} />
                                 <span className="text-sm font-medium text-red-600">Blokovat přístup</span>
                             </label>
                        </div>
                        
                        <div className="border-t pt-2">
                            <label className="block text-xs font-bold mb-2">Oprávnění - Lokality a Pracoviště</label>
                            {locations.map(loc => (
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
                            ))}
                        </div>
                        <div className="flex justify-end pt-4"><button onClick={saveUser} className="bg-blue-600 text-white px-4 py-2 rounded">Uložit změny</button></div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- Settings ---
export const SettingsPage = () => {
    const [settings, setSettings] = useState(db.settings.get());
    
    const toggleTranslation = () => {
        const newVal = !settings.enableOnlineTranslation;
        const newSettings = { ...settings, enableOnlineTranslation: newVal };
        setSettings(newSettings);
        db.settings.save(newSettings);
    };

    return (
        <div className="bg-white p-6 rounded shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4">Administrátorské nastavení</h3>
            <div className="flex items-center justify-between py-3 border-b">
                <div>
                    <div className="font-medium">Online překlady</div>
                    <div className="text-xs text-slate-500">Automaticky překládat uživatelské vstupy pomocí externí služby.</div>
                </div>
                <button 
                    onClick={toggleTranslation}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enableOnlineTranslation ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enableOnlineTranslation ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
    );
};