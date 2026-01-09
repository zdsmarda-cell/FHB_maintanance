
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { Technology, User } from '../lib/types';
import { Plus, Edit, Trash2, Search, Upload, Loader, X, Eye, EyeOff, Wrench, RotateCcw } from 'lucide-react';
import { Modal, ConfirmModal, MultiSelect, Pagination } from '../components/Shared';

const PROD_API_URL = 'https://fhbmain.impossible.cz:3010';
let API_BASE = PROD_API_URL;

interface AssetsPageProps {
  user: User;
  onNavigate: (page: string, params?: any) => void;
  initialFilters?: any;
}

const AssetModal = ({ isOpen, onClose, initialData, onSave, techTypes, techStates, workplaces, suppliers, locations }: any) => {
    const { t } = useI18n();
    const [data, setData] = useState<Partial<Technology>>(initialData || {
        name: '', serialNumber: '', typeId: '', stateId: '', workplaceId: '', supplierId: '', 
        installDate: '', weight: undefined, description: '', sharepointLink: '', photoUrls: [], isVisible: true
    });
    
    // State for Location Filter
    const [selectedLocId, setSelectedLocId] = useState('');

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isUploading, setIsUploading] = useState(false);

    // Initialize Location based on existing Workplace
    useEffect(() => {
        if (initialData && initialData.workplaceId && !selectedLocId) {
            const wp = workplaces.find((w: any) => w.id === initialData.workplaceId);
            if (wp) setSelectedLocId(wp.locationId);
        }
    }, [initialData, workplaces]);

    // Filter workplaces based on selected Location
    const filteredWorkplaces = selectedLocId 
        ? workplaces.filter((w: any) => w.locationId === selectedLocId)
        : workplaces;

    const validate = () => {
        const errs: Record<string, string> = {};
        if(!data.name) errs.name = t('validation.required');
        if(!data.workplaceId) errs.workplaceId = t('validation.required');
        if(!data.typeId) errs.typeId = t('validation.required');
        if(!data.stateId) errs.stateId = t('validation.required');
        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    const handleSave = () => {
        if(validate()) {
            if (data.name && data.workplaceId) {
                const finalData = { ...data, weight: data.weight || 0 };
                onSave(finalData as any);
            }
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
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.type')}</label>
                        <select className={`w-full border p-2 rounded ${errors.typeId ? 'border-red-500' : ''}`} value={data.typeId} onChange={e => setData({...data, typeId: e.target.value})}>
                            <option value="">-</option>
                            {techTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.state')}</label>
                        <select className={`w-full border p-2 rounded ${errors.stateId ? 'border-red-500' : ''}`} value={data.stateId} onChange={e => setData({...data, stateId: e.target.value})}>
                            <option value="">-</option>
                            {techStates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                     </div>
                </div>
                
                {/* Location & Workplace */}
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.location')}</label>
                        <select 
                            className="w-full border p-2 rounded" 
                            value={selectedLocId} 
                            onChange={e => { setSelectedLocId(e.target.value); setData({...data, workplaceId: ''}); }}
                        >
                            <option value="">-- {t('common.all')} --</option>
                            {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.workplace')}</label>
                        <select 
                            className={`w-full border p-2 rounded ${errors.workplaceId ? 'border-red-500' : ''}`} 
                            value={data.workplaceId} 
                            onChange={e => setData({...data, workplaceId: e.target.value})}
                            disabled={!selectedLocId && filteredWorkplaces.length > 20} // Optional UX improvement
                        >
                            <option value="">-</option>
                            {filteredWorkplaces.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                     </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.supplier')}</label>
                        <select className="w-full border p-2 rounded" value={data.supplierId} onChange={e => setData({...data, supplierId: e.target.value})}>
                            <option value="">-</option>
                            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.install_date')}</label>
                        <input type="date" className="w-full border p-2 rounded" value={data.installDate || ''} onChange={e => setData({...data, installDate: e.target.value})} />
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
                <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{t('common.save')}</button>
             </div>
        </Modal>
    );
};

export const AssetsPage = ({ user, onNavigate, initialFilters }: AssetsPageProps) => {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<Technology[]>([]);
    const [techTypes, setTechTypes] = useState<any[]>([]);
    const [techStates, setTechStates] = useState<any[]>([]);
    const [workplaces, setWorkplaces] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);

    // Filtering State
    const [search, setSearch] = useState('');
    const [filterTypeIds, setFilterTypeIds] = useState<string[]>([]);
    const [filterStateIds, setFilterStateIds] = useState<string[]>([]);
    const [filterWpIds, setFilterWpIds] = useState<string[]>([]);
    const [filterVisible, setFilterVisible] = useState<'all' | 'true' | 'false'>('true');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    
    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Technology | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Initial Filters
    useEffect(() => {
        if (initialFilters) {
            if (initialFilters.typeId) setFilterTypeIds([initialFilters.typeId]);
            if (initialFilters.stateId) setFilterStateIds([initialFilters.stateId]);
        }
    }, [initialFilters]);

    // FETCH DATA
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
        if (filterWpIds.length > 0 && !filterWpIds.includes(a.workplaceId)) return false;
        return true;
    });

    const paginatedAssets = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const getOpenRequestCount = (techId: string) => requests.filter(r => r.techId === techId && r.state !== 'solved' && r.state !== 'cancelled').length;

    if (loading) return <div className="p-10 flex justify-center"><Loader className="animate-spin w-8 h-8 text-blue-600"/></div>;

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                        <input className="w-full pl-8 p-1.5 border rounded text-sm" placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div><MultiSelect label={t('headers.tech_types')} options={techTypes} selectedIds={filterTypeIds} onChange={setFilterTypeIds} /></div>
                    <div><MultiSelect label={t('headers.tech_states')} options={techStates} selectedIds={filterStateIds} onChange={setFilterStateIds} /></div>
                    <div><MultiSelect label={t('form.workplace')} options={workplaces.map(w => ({ id: w.id, name: w.name }))} selectedIds={filterWpIds} onChange={setFilterWpIds} /></div>
                    <div>
                        <select className="w-full p-1.5 border rounded text-sm mt-5" value={filterVisible} onChange={e => setFilterVisible(e.target.value as any)}>
                            <option value="all">{t('common.all')}</option>
                            <option value="true">{t('common.yes')}</option>
                            <option value="false">{t('common.no')}</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-3">{t('form.name')} / S.N.</th>
                                <th className="px-4 py-3">{t('form.type')}</th>
                                <th className="px-4 py-3">{t('form.state')}</th>
                                <th className="px-4 py-3">{t('form.location')}</th>
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
                                const wp = workplaces.find(w => w.id === asset.workplaceId);
                                const loc = locations.find(l => l.id === wp?.locationId);
                                const sup = suppliers.find(s => s.id === asset.supplierId);
                                const reqCount = getOpenRequestCount(asset.id);

                                return (
                                    <tr key={asset.id} className={`border-b hover:bg-slate-50 ${!asset.isVisible ? 'bg-slate-50 opacity-70' : ''}`}>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            <div>{asset.name}</div>
                                            {asset.serialNumber && <div className="text-xs text-slate-500 font-mono">{asset.serialNumber}</div>}
                                        </td>
                                        <td className="px-4 py-3">{type || '-'}</td>
                                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border">{state || '-'}</span></td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{wp?.name}</div>
                                            <div className="text-xs text-slate-500">{loc?.name}</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{sup?.name || '-'}</td>
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
        </div>
    );
};
