
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { Technology, User } from '../lib/types';
import { Plus, Edit, Search, Upload, Loader, X, Eye, EyeOff, Wrench, Link as LinkIcon, Weight, Image as ImageIcon, Calendar } from 'lucide-react';
import { Modal, MultiSelect, Pagination } from '../components/Shared';
import { GalleryModal } from '../components/requests/modals/GalleryModal';
import { prepareMultilingual, getLocalized } from '../lib/helpers';

const PROD_API_URL = 'https://fhbmain.impossible.cz:3010';
let API_BASE = PROD_API_URL;

interface AssetsPageProps {
  user: User;
  onNavigate: (page: string, params?: any) => void;
  initialFilters?: any;
}

const AssetModal = ({ isOpen, onClose, initialData, onSave, techTypes, techStates, workplaces, suppliers, locations }: any) => {
    const { t, lang } = useI18n(); 
    const [saving, setSaving] = useState(false);
    
    const [data, setData] = useState<Partial<Technology>>(() => {
        const base = initialData ? { ...initialData } : {
            name: '', serialNumber: '', typeId: '', stateId: '', workplaceIds: [], supplierId: '', 
            installDate: '', weight: 0, description: '', sharepointLink: '', photoUrls: [], isVisible: true
        };
        
        if (base.installDate && typeof base.installDate === 'string' && base.installDate.includes('T')) {
            base.installDate = base.installDate.split('T')[0];
        }

        if (base.description) {
            base.description = getLocalized(base.description, lang);
        }

        return base;
    });
    
    // Constraint: All selected workplaces must belong to ONE location.
    // We use this state to drive the MultiSelect options.
    const [selectedLocationId, setSelectedLocationId] = useState('');

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isUploading, setIsUploading] = useState(false);

    // Initialization: If editing, detect location from the first assigned workplace
    useEffect(() => {
        if (initialData && initialData.workplaceIds && initialData.workplaceIds.length > 0) {
            const firstWp = workplaces.find((w: any) => w.id === initialData.workplaceIds[0]);
            if (firstWp) {
                setSelectedLocationId(firstWp.locationId);
            }
        }
    }, [initialData, workplaces]);

    // Constraint Logic: Show only workplaces for the selected location
    const availableWorkplaces = selectedLocationId 
        ? workplaces.filter((w: any) => w.locationId === selectedLocationId)
        : [];

    // Map for MultiSelect
    const workplaceOptions = availableWorkplaces.map((w: any) => ({
        id: w.id, 
        name: getLocalized(w.name, lang)
    }));

    const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLocId = e.target.value;
        setSelectedLocationId(newLocId);
        
        // CRITICAL: Clear workplaces when location changes to prevent mixed locations
        if (newLocId !== selectedLocationId) {
            setData(prev => ({ ...prev, workplaceIds: [] }));
        }
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if(!data.name) errs.name = t('validation.required');
        // Workplace is strictly optional in DB, but if you want to enforce it visually:
        // if(!data.workplaceIds || data.workplaceIds.length === 0) errs.workplaceId = t('validation.required'); 
        if(!data.typeId) errs.typeId = t('validation.required');
        if(!data.stateId) errs.stateId = t('validation.required');
        if(!data.supplierId) errs.supplierId = t('validation.required');
        if(!data.installDate) errs.installDate = t('validation.required');
        if(data.weight !== undefined && data.weight < 0) errs.weight = "Váha nesmí být záporná";

        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    const handleSaveClick = async () => {
        if(validate()) {
            setSaving(true);
            try {
                const translatedDesc = data.description ? await prepareMultilingual(data.description) : '';
                
                if (data.name) {
                    const finalData = { 
                        ...data, 
                        description: translatedDesc,
                        weight: data.weight ?? 0 
                    };
                    await onSave(finalData as any);
                }
            } catch(e) { console.error(e); } 
            finally { setSaving(false); }
        }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsUploading(true);
            try {
                const token = localStorage.getItem('auth_token');
                const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

                if (isMock) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        setData({ ...data, photoUrls: [...(data.photoUrls || []), reader.result as string] });
                        setIsUploading(false);
                    };
                    reader.readAsDataURL(file);
                } else {
                    const formData = new FormData();
                    formData.append('image', file);
                    const response = await fetch(`${API_BASE}/api/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });
                    if (response.ok) {
                        const resData = await response.json();
                        const fullUrl = resData.url.startsWith('http') ? resData.url : `${API_BASE}${resData.url}`;
                        setData({ ...data, photoUrls: [...(data.photoUrls || []), fullUrl] });
                    }
                    setIsUploading(false);
                }
            } catch (error) { setIsUploading(false); }
        }
    };

    return (
        <Modal title={initialData ? t('common.edit') : t('common.add')} onClose={onClose}>
             <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                <div>
                     <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.name')}</label>
                     <input className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} value={data.name} onChange={e => setData({...data, name: e.target.value})} />
                </div>
                <div>
                     <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.serial_number')}</label>
                     <input className="w-full border p-2 rounded" value={data.serialNumber} onChange={e => setData({...data, serialNumber: e.target.value})} />
                </div>
                <div>
                     <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.description')}</label>
                     <textarea className="w-full border p-2 rounded" rows={2} value={data.description || ''} onChange={e => setData({...data, description: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.type')}</label>
                        <select className={`w-full border p-2 rounded ${errors.typeId ? 'border-red-500' : ''}`} value={data.typeId} onChange={e => setData({...data, typeId: e.target.value})}>
                            <option value="">-</option>
                            {techTypes.map((t: any) => <option key={t.id} value={t.id}>{getLocalized(t.name, lang)}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.state')}</label>
                        <select className={`w-full border p-2 rounded ${errors.stateId ? 'border-red-500' : ''}`} value={data.stateId} onChange={e => setData({...data, stateId: e.target.value})}>
                            <option value="">-</option>
                            {techStates.map((t: any) => <option key={t.id} value={t.id}>{getLocalized(t.name, lang)}</option>)}
                        </select>
                     </div>
                </div>
                
                {/* Location Selector (Enforces Single Parent) & Workplace Selection */}
                <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <p className="text-xs text-slate-400 mb-2">Umístění (Všechna pracoviště musí být v jedné lokalitě)</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.location')}</label>
                            <select 
                                className="w-full border p-2 rounded" 
                                value={selectedLocationId} 
                                onChange={handleLocationChange}
                            >
                                <option value="">{t('option.select_location')}</option>
                                {locations.map((l: any) => <option key={l.id} value={l.id}>{getLocalized(l.name, lang)}</option>)}
                            </select>
                         </div>
                         <div>
                            <div className={`${!selectedLocationId ? 'opacity-50 pointer-events-none' : ''}`}>
                                <MultiSelect 
                                    label={t('form.workplace')}
                                    options={workplaceOptions}
                                    selectedIds={data.workplaceIds || []}
                                    onChange={(ids) => setData({...data, workplaceIds: ids})}
                                />
                            </div>
                            {!selectedLocationId && <span className="text-[10px] text-slate-400">Nejdříve vyberte lokalitu</span>}
                         </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.supplier')}</label>
                        <select className={`w-full border p-2 rounded ${errors.supplierId ? 'border-red-500' : ''}`} value={data.supplierId} onChange={e => setData({...data, supplierId: e.target.value})}>
                            <option value="">-</option>
                            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{getLocalized(s.name, lang)}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.install_date')}</label>
                        <input type="date" className={`w-full border p-2 rounded ${errors.installDate ? 'border-red-500' : ''}`} value={data.installDate || ''} onChange={e => setData({...data, installDate: e.target.value})} />
                     </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center"><Weight className="w-3 h-3 mr-1"/> {t('form.weight')}</label>
                        <input 
                            type="number" min="0" 
                            className={`w-full border p-2 rounded ${errors.weight ? 'border-red-500' : ''}`} 
                            value={data.weight !== undefined ? data.weight : ''} 
                            onChange={e => setData({...data, weight: e.target.value === '' ? undefined : Number(e.target.value)})} 
                            placeholder="kg" 
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center"><LinkIcon className="w-3 h-3 mr-1"/> {t('form.documentation')}</label>
                        <input type="text" className="w-full border p-2 rounded" value={data.sharepointLink || ''} onChange={e => setData({...data, sharepointLink: e.target.value})} placeholder="https://..." />
                     </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.photos')}</label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                        {data.photoUrls?.map((url: string, i: number) => (
                             <div key={i} className="relative aspect-square bg-slate-100 border rounded overflow-hidden group">
                                <img src={url} className="w-full h-full object-cover" alt="prev"/>
                                <button onClick={() => setData({...data, photoUrls: data.photoUrls?.filter((_, idx) => idx !== i)})} className="absolute top-0 right-0 p-1 bg-white/80 text-red-500 opacity-0 group-hover:opacity-100">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                         <label className={`flex items-center justify-center border-2 border-dashed rounded aspect-square cursor-pointer hover:bg-slate-50 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isUploading ? <Loader className="w-5 h-5 text-blue-500 animate-spin" /> : <Upload className="w-5 h-5 text-slate-400" />}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                        </label>
                    </div>
                </div>
                <div className="mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={data.isVisible} onChange={e => setData({...data, isVisible: e.target.checked})} />
                        <span className="text-sm font-medium">{t('form.is_visible')}</span>
                    </label>
                </div>
             </div>
             <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
                <button onClick={onClose} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                <button onClick={handleSaveClick} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center">
                    {saving && <Loader className="animate-spin w-4 h-4 mr-2" />}
                    {t('common.save')}
                </button>
             </div>
        </Modal>
    );
};

export const AssetsPage = ({ user, onNavigate, initialFilters }: AssetsPageProps) => {
    const { t, lang } = useI18n();
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<Technology[]>([]);
    const [techTypes, setTechTypes] = useState<any[]>([]);
    const [techStates, setTechStates] = useState<any[]>([]);
    const [workplaces, setWorkplaces] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);

    const [search, setSearch] = useState('');
    const [filterTypeIds, setFilterTypeIds] = useState<string[]>([]);
    const [filterStateIds, setFilterStateIds] = useState<string[]>([]);
    const [filterWpIds, setFilterWpIds] = useState<string[]>([]);
    const [filterSupplierId, setFilterSupplierId] = useState<string>(''); 
    const [filterVisible, setFilterVisible] = useState<'all' | 'true' | 'false'>('true');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Technology | null>(null);

    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);

    useEffect(() => {
        if (initialFilters) {
            if (initialFilters.typeId) setFilterTypeIds([initialFilters.typeId]);
            if (initialFilters.stateId) setFilterStateIds([initialFilters.stateId]);
            // If filtering by workplace, match technologies containing that workplace ID
            if (initialFilters.workplaceId) setFilterWpIds([initialFilters.workplaceId]);
            if (initialFilters.supplierId) setFilterSupplierId(initialFilters.supplierId);
            if (initialFilters.locationId) {
                const wps = workplaces.filter(w => w.locationId === initialFilters.locationId).map(w => w.id);
                if (workplaces.length > 0) setFilterWpIds(wps);
            }
        }
    }, [initialFilters, workplaces]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

            if (isMock) {
                setAssets(db.technologies.list());
                setTechTypes(db.techTypes.list());
                setTechStates(db.techStates.list());
                setWorkplaces(db.workplaces.list());
                setSuppliers(db.suppliers.list());
                setLocations(db.locations.list());
                setRequests(db.requests.list());
            } else {
                const [a, tt, ts, w, s, l, r] = await Promise.all([
                    api.get('/technologies'),
                    api.get('/config/types'),
                    api.get('/config/states'),
                    api.get('/locations/workplaces'),
                    api.get('/suppliers'),
                    api.get('/locations'),
                    api.get('/requests')
                ]);
                setAssets(a);
                setTechTypes(tt);
                setTechStates(ts);
                setWorkplaces(w);
                setSuppliers(s);
                setLocations(l);
                setRequests(r);
            }
        } catch (e) {
            console.error("Failed to fetch assets", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreate = () => { setEditingAsset(null); setIsModalOpen(true); };
    const handleEdit = (asset: Technology) => { setEditingAsset(asset); setIsModalOpen(true); };

    const handleSave = async (data: any) => {
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
            
            if (isMock) {
                if (editingAsset) db.technologies.update(editingAsset.id, data);
                else db.technologies.add(data);
            } else {
                if (editingAsset) await api.put(`/technologies/${editingAsset.id}`, data);
                else await api.post('/technologies', data);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (e) { console.error(e); }
    };

    // Filter Logic
    const filtered = assets.filter(a => {
        if (filterVisible === 'true' && !a.isVisible) return false;
        if (filterVisible === 'false' && a.isVisible) return false;
        if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.serialNumber?.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterTypeIds.length > 0 && !filterTypeIds.includes(a.typeId)) return false;
        if (filterStateIds.length > 0 && !filterStateIds.includes(a.stateId)) return false;
        
        // Workplace Filter: Check if asset has ANY of the selected filter IDs in its workplaceIds array
        if (filterWpIds.length > 0) {
            const assetWps = a.workplaceIds || [];
            const hasMatch = assetWps.some(id => filterWpIds.includes(id));
            if (!hasMatch) return false;
        }
        
        if (filterSupplierId && a.supplierId !== filterSupplierId) return false;
        if (filterDateFrom && (!a.installDate || a.installDate < filterDateFrom)) return false;
        if (filterDateTo && (!a.installDate || a.installDate > filterDateTo)) return false;

        return true;
    });

    const paginatedAssets = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    const getOpenRequestCount = (techId: string) => {
        return requests.filter(r => r.techId === techId && r.state !== 'solved' && r.state !== 'cancelled').length;
    };

    const openGallery = (photos: string[], e: React.MouseEvent) => {
        e.stopPropagation();
        if (photos && photos.length > 0) {
            setGalleryImages(photos);
            setGalleryIndex(0);
            setIsGalleryOpen(true);
        }
    }

    if (loading) return <div className="p-10 flex justify-center"><Loader className="animate-spin w-8 h-8 text-blue-600"/></div>;

    const localizedTypes = techTypes.map(t => ({...t, name: getLocalized(t.name, lang)}));
    const localizedStates = techStates.map(s => ({...s, name: getLocalized(s.name, lang)}));
    const localizedSuppliers = suppliers.map(s => ({...s, name: getLocalized(s.name, lang)}));
    const localizedWorkplaces = workplaces.map(w => ({...w, name: getLocalized(w.name, lang)}));

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">{t('menu.assets')}</h2>
                {(user.role === 'admin' || user.role === 'maintenance') && (
                    <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                        <Plus className="w-4 h-4 mr-2" /> {t('common.add')}
                    </button>
                )}
            </div>

            <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                        <input className="w-full pl-8 p-1.5 border rounded text-sm" placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div><MultiSelect label={t('headers.tech_types')} options={localizedTypes} selectedIds={filterTypeIds} onChange={setFilterTypeIds} /></div>
                    <div><MultiSelect label={t('headers.tech_states')} options={localizedStates} selectedIds={filterStateIds} onChange={setFilterStateIds} /></div>
                    <div><MultiSelect label={t('form.workplace')} options={localizedWorkplaces} selectedIds={filterWpIds} onChange={setFilterWpIds} /></div>
                    
                    <div>
                        <div className="mb-1 text-xs text-slate-500 font-medium">{t('form.install_date')}</div>
                        <div className="flex items-center gap-1">
                            <input type="date" className="w-full p-1.5 border rounded text-xs" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} title="Od" />
                            <span className="text-slate-400">-</span>
                            <input type="date" className="w-full p-1.5 border rounded text-xs" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} title="Do" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex-1">
                            <select className="w-full p-1.5 border rounded text-sm mt-5" value={filterSupplierId} onChange={e => setFilterSupplierId(e.target.value)}>
                                <option value="">{t('form.supplier')}: {t('common.all')}</option>
                                {localizedSuppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="mt-2 flex justify-end">
                     <select className="p-1.5 border rounded text-sm" value={filterVisible} onChange={e => setFilterVisible(e.target.value as any)}>
                        <option value="all">{t('filter.visibility_all')}</option>
                        <option value="true">{t('filter.visibility_yes')}</option>
                        <option value="false">{t('filter.visibility_no')}</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-3">{t('form.name')} / S.N.</th>
                                <th className="px-4 py-3">{t('form.install_date')}</th>
                                <th className="px-4 py-3">{t('form.type')}</th>
                                <th className="px-4 py-3">{t('form.state')}</th>
                                <th className="px-4 py-3">{t('form.workplace')}</th>
                                <th className="px-4 py-3">{t('form.supplier')}</th>
                                <th className="px-4 py-3 text-center">{t('form.is_visible')}</th>
                                <th className="px-4 py-3 text-center">{t('col.open_requests')}</th>
                                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedAssets.map(asset => {
                                const type = techTypes.find(t => t.id === asset.typeId)?.name;
                                const state = techStates.find(t => t.id === asset.stateId)?.name;
                                const sup = suppliers.find(s => s.id === asset.supplierId);
                                const reqCount = getOpenRequestCount(asset.id);
                                const hasPhotos = asset.photoUrls && asset.photoUrls.length > 0;
                                
                                // Resolve workplaces
                                const assignedWps = (asset.workplaceIds || []).map(id => {
                                    const w = workplaces.find(x => x.id === id);
                                    return w ? getLocalized(w.name, lang) : null;
                                }).filter(Boolean).join(', ');

                                return (
                                    <tr key={asset.id} className={`border-b hover:bg-slate-50 ${!asset.isVisible ? 'bg-slate-50 opacity-70' : ''}`}>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            <div className="flex items-center gap-2">
                                                {hasPhotos && (
                                                    <button onClick={(e) => openGallery(asset.photoUrls, e)} className="text-blue-500 hover:text-blue-700" title="Zobrazit fotky">
                                                        <ImageIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <div>
                                                    <div>{asset.name}</div>
                                                    {asset.serialNumber && <div className="text-xs text-slate-500 font-mono">{asset.serialNumber}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {asset.installDate ? new Date(asset.installDate).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-4 py-3">{getLocalized(type, lang) || '-'}</td>
                                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border">{getLocalized(state, lang) || '-'}</span></td>
                                        <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={assignedWps}>
                                            {assignedWps || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{getLocalized(sup?.name, lang) || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            {asset.isVisible ? <Eye className="w-4 h-4 text-green-500 mx-auto" /> : <EyeOff className="w-4 h-4 text-slate-400 mx-auto" />}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {reqCount > 0 ? <span className="inline-flex items-center px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-medium cursor-pointer" onClick={() => onNavigate('requests', { techId: asset.id })}><Wrench className="w-3 h-3 mr-1" /> {reqCount}</span> : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {(user.role === 'admin' || user.role === 'maintenance') && (
                                                <button onClick={() => handleEdit(asset)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filtered.length > 0 && <Pagination currentPage={currentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />}
            </div>

            {isModalOpen && <AssetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialData={editingAsset} onSave={handleSave} techTypes={techTypes} techStates={techStates} workplaces={workplaces} suppliers={suppliers} locations={locations} />}
            
            {isGalleryOpen && (
                <GalleryModal 
                    images={galleryImages} 
                    currentIndex={galleryIndex} 
                    onClose={() => setIsGalleryOpen(false)} 
                    onNext={(e) => { e.stopPropagation(); setGalleryIndex((prev) => (prev + 1) % galleryImages.length); }} 
                    onPrev={(e) => { e.stopPropagation(); setGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length); }}
                />
            )}
        </div>
    );
};
