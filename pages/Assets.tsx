
import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { Technology, User } from '../lib/types';
import { Plus, Edit, Trash2, Search, Upload, Loader, X, Eye, EyeOff, Wrench, RotateCcw } from 'lucide-react';
import { Modal, ConfirmModal, MultiSelect, Pagination } from '../components/Shared';

interface AssetsPageProps {
  user: User;
  onNavigate: (page: string, params?: any) => void;
  initialFilters?: any;
}

const AssetModal = ({ isOpen, onClose, initialData, onSave }: { isOpen: boolean, onClose: () => void, initialData: Technology | null, onSave: (data: Omit<Technology, 'id'> | Technology) => void }) => {
    const { t } = useI18n();
    // Initialize weight as undefined for new items to show empty input
    const [data, setData] = useState<Partial<Technology>>(initialData || {
        name: '', serialNumber: '', typeId: '', stateId: '', workplaceId: '', supplierId: '', 
        installDate: '', weight: undefined, description: '', sharepointLink: '', photoUrls: [], isVisible: true
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isUploading, setIsUploading] = useState(false);

    // Helper to get visible workplaces
    const visibleWorkplaces = db.workplaces.list().filter(w => w.isVisible);

    const validate = () => {
        const errs: Record<string, string> = {};
        if(!data.name) errs.name = t('validation.required');
        if(!data.workplaceId) errs.workplaceId = t('validation.required');
        if(!data.description?.trim()) errs.description = t('validation.required');
        
        // Mandatory fields
        if(!data.supplierId) errs.supplierId = t('validation.required');
        if(!data.installDate) errs.installDate = t('validation.required');
        if(!data.typeId) errs.typeId = t('validation.required');
        if(!data.stateId) errs.stateId = t('validation.required');

        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    const handleSave = () => {
        if(validate()) {
            if (data.name && data.workplaceId) {
                // Ensure weight is saved as 0 if left undefined/empty, or keep as undefined depending on DB requirement. 
                // Here we cast to number or 0 for safety before saving.
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
                const isMockToken = token?.startsWith('mock-token-');
                const isDev = (import.meta as any).env && (import.meta as any).env.DEV;

                if (isDev || isMockToken) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const newPhotos = [...(data.photoUrls || []), reader.result as string];
                        setData({ ...data, photoUrls: newPhotos });
                        setIsUploading(false);
                    };
                    reader.readAsDataURL(file);
                } else {
                    const formData = new FormData();
                    formData.append('image', file);
                    
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });

                    if (response.ok) {
                        const resData = await response.json();
                        const fullUrl = `${resData.url}`;
                        setData({ ...data, photoUrls: [...(data.photoUrls || []), fullUrl] });
                    }
                    setIsUploading(false);
                }
            } catch (error) {
                console.error('Upload Error:', error);
                setIsUploading(false);
            }
        }
    };

    const removePhoto = (index: number) => {
        setData({ ...data, photoUrls: (data.photoUrls || []).filter((_: any, i: number) => i !== index) });
    }

    return (
        <Modal title={initialData ? t('common.edit') : t('common.add')} onClose={onClose}>
             <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                <div>
                     <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.name')}</label>
                     <input className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} value={data.name} onChange={e => setData({...data, name: e.target.value})} />
                     {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
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
                            {db.techTypes.list().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {errors.typeId && <span className="text-xs text-red-500">{errors.typeId}</span>}
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.state')}</label>
                        <select className={`w-full border p-2 rounded ${errors.stateId ? 'border-red-500' : ''}`} value={data.stateId} onChange={e => setData({...data, stateId: e.target.value})}>
                            <option value="">-</option>
                            {db.techStates.list().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {errors.stateId && <span className="text-xs text-red-500">{errors.stateId}</span>}
                     </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.workplace')}</label>
                        <select className={`w-full border p-2 rounded ${errors.workplaceId ? 'border-red-500' : ''}`} value={data.workplaceId} onChange={e => setData({...data, workplaceId: e.target.value})}>
                            <option value="">-</option>
                            {visibleWorkplaces.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        {errors.workplaceId && <span className="text-xs text-red-500">{errors.workplaceId}</span>}
                     </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.supplier')}</label>
                        <select className={`w-full border p-2 rounded ${errors.supplierId ? 'border-red-500' : ''}`} value={data.supplierId} onChange={e => setData({...data, supplierId: e.target.value})}>
                            <option value="">-</option>
                            {db.suppliers.list().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {errors.supplierId && <span className="text-xs text-red-500">{errors.supplierId}</span>}
                     </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                         <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.install_date')}</label>
                         <input type="date" className={`w-full border p-2 rounded ${errors.installDate ? 'border-red-500' : ''}`} value={data.installDate} onChange={e => setData({...data, installDate: e.target.value})} />
                         {errors.installDate && <span className="text-xs text-red-500">{errors.installDate}</span>}
                    </div>
                     <div>
                         <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.weight')}</label>
                         <input 
                            type="number" 
                            className="w-full border p-2 rounded" 
                            value={data.weight ?? ''} 
                            onChange={e => setData({...data, weight: e.target.value === '' ? undefined : Number(e.target.value)})}
                            placeholder="0" 
                        />
                    </div>
                </div>

                <div>
                     <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.description')}</label>
                     <textarea className={`w-full border p-2 rounded ${errors.description ? 'border-red-500' : ''}`} rows={3} value={data.description} onChange={e => setData({...data, description: e.target.value})} />
                     {errors.description && <span className="text-xs text-red-500">{errors.description}</span>}
                </div>
                
                 <div>
                     <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.documentation')}</label>
                     <input className="w-full border p-2 rounded" value={data.sharepointLink} onChange={e => setData({...data, sharepointLink: e.target.value})} placeholder="URL" />
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.photos')}</label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                        {data.photoUrls?.map((url: string, i: number) => (
                             <div key={i} className="relative aspect-square bg-slate-100 border rounded overflow-hidden group">
                                <img src={url} className="w-full h-full object-cover" alt="prev"/>
                                <button onClick={() => removePhoto(i)} className="absolute top-0 right-0 p-1 bg-white/80 text-red-500 opacity-0 group-hover:opacity-100">
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
    const [assets, setAssets] = useState(db.technologies.list());
    
    // Filtering State (Multi-select)
    const [search, setSearch] = useState('');
    const [filterTypeIds, setFilterTypeIds] = useState<string[]>([]);
    const [filterStateIds, setFilterStateIds] = useState<string[]>([]);
    const [filterWpIds, setFilterWpIds] = useState<string[]>([]);
    const [filterVisible, setFilterVisible] = useState<'all' | 'true' | 'false'>('true');

    // Load initial filters if present
    useEffect(() => {
        if (initialFilters) {
            if (initialFilters.typeId) setFilterTypeIds([initialFilters.typeId]);
            if (initialFilters.stateId) setFilterStateIds([initialFilters.stateId]);
        }
    }, [initialFilters]);

    // Check if any filter is active
    const hasActiveFilters = search !== '' || 
                             filterTypeIds.length > 0 || 
                             filterStateIds.length > 0 || 
                             filterWpIds.length > 0 || 
                             filterVisible !== 'true';

    const handleResetFilters = () => {
        setSearch('');
        setFilterTypeIds([]);
        setFilterStateIds([]);
        setFilterWpIds([]);
        setFilterVisible('true');
    };

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Technology | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const refresh = () => setAssets(db.technologies.list());

    const handleCreate = () => {
        setEditingAsset(null);
        setIsModalOpen(true);
    };

    const handleEdit = (asset: Technology) => {
        setEditingAsset(asset);
        setIsModalOpen(true);
    };

    const handleSave = (data: any) => {
        if (editingAsset) {
            db.technologies.update(editingAsset.id, data);
        } else {
            db.technologies.add(data);
        }
        setIsModalOpen(false);
        refresh();
    };

    const handleDelete = () => {
        if (deleteId) {
            db.technologies.update(deleteId, { isVisible: false });
            setDeleteId(null);
            refresh();
        }
    };

    // Prepare options for filters
    const workplaceOptions = db.workplaces.list().map(w => {
        const loc = db.locations.list().find(l => l.id === w.locationId);
        return { id: w.id, name: `${loc?.name || '?'} - ${w.name}` };
    });

    // Filtering
    const filtered = assets.filter(a => {
        // Visibility Filter
        if (filterVisible === 'true' && !a.isVisible) return false;
        if (filterVisible === 'false' && a.isVisible) return false;

        // Text Search
        if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.serialNumber.toLowerCase().includes(search.toLowerCase())) return false;
        
        // Multi-select Filters
        if (filterTypeIds.length > 0 && !filterTypeIds.includes(a.typeId)) return false;
        if (filterStateIds.length > 0 && !filterStateIds.includes(a.stateId)) return false;
        if (filterWpIds.length > 0 && !filterWpIds.includes(a.workplaceId)) return false;
        
        return true;
    });

    // Pagination slice
    const paginatedAssets = filtered.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterTypeIds, filterStateIds, filterWpIds, filterVisible]);

    const getOpenRequestCount = (techId: string) => {
        return db.requests.list().filter(r => r.techId === techId && r.state !== 'solved' && r.state !== 'cancelled').length;
    }

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">{t('menu.assets')}</h2>
                {(user.role === 'admin' || user.role === 'maintenance') && (
                    <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                        <Plus className="w-4 h-4 mr-2" /> {t('common.add')}
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="relative">
                        <div className="flex justify-between items-center mb-1">
                            <div className="text-xs text-slate-500 font-medium">{t('common.search')}</div>
                            {hasActiveFilters && (
                                <button 
                                    onClick={handleResetFilters}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    title="Zrušit filtry"
                                >
                                    <RotateCcw className="w-3 h-3" /> Reset
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                            <input 
                                className="w-full pl-8 p-1.5 border rounded text-sm" 
                                placeholder={t('common.search')} 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                            />
                        </div>
                    </div>
                    <div>
                        <MultiSelect 
                            label={t('headers.tech_types')} 
                            options={db.techTypes.list()} 
                            selectedIds={filterTypeIds} 
                            onChange={setFilterTypeIds} 
                        />
                    </div>
                    <div>
                        <MultiSelect 
                            label={t('headers.tech_states')} 
                            options={db.techStates.list()} 
                            selectedIds={filterStateIds} 
                            onChange={setFilterStateIds} 
                        />
                    </div>
                    <div>
                        <MultiSelect 
                            label={t('form.workplace')} 
                            options={workplaceOptions} 
                            selectedIds={filterWpIds} 
                            onChange={setFilterWpIds} 
                        />
                    </div>
                    <div>
                        <div className="mb-1 text-xs text-slate-500 font-medium">{t('form.is_visible')}</div>
                        <select 
                            className="w-full p-1.5 border rounded text-sm"
                            value={filterVisible}
                            onChange={e => setFilterVisible(e.target.value as any)}
                        >
                            <option value="all">{t('common.all')}</option>
                            <option value="true">{t('common.yes')}</option>
                            <option value="false">{t('common.no')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table View */}
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
                            {paginatedAssets.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-slate-400">Žádné technologie nenalezeny</td></tr>
                            ) : (
                                paginatedAssets.map(asset => {
                                    const type = db.techTypes.list().find(t => t.id === asset.typeId)?.name;
                                    const state = db.techStates.list().find(t => t.id === asset.stateId)?.name;
                                    const wp = db.workplaces.list().find(w => w.id === asset.workplaceId);
                                    const loc = db.locations.list().find(l => l.id === wp?.locationId);
                                    const sup = db.suppliers.list().find(s => s.id === asset.supplierId);
                                    const reqCount = getOpenRequestCount(asset.id);

                                    return (
                                        <tr key={asset.id} className={`border-b hover:bg-slate-50 ${!asset.isVisible ? 'bg-slate-50 opacity-70' : ''}`}>
                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                <div>{asset.name}</div>
                                                {asset.serialNumber && <div className="text-xs text-slate-500 font-mono">{asset.serialNumber}</div>}
                                            </td>
                                            <td className="px-4 py-3">{type || '-'}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border">
                                                    {state || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{wp?.name}</div>
                                                <div className="text-xs text-slate-500">{loc?.name}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{sup?.name || '-'}</td>
                                            <td className="px-4 py-3 text-center">
                                                {asset.isVisible ? (
                                                    <Eye className="w-4 h-4 text-green-500 mx-auto" />
                                                ) : (
                                                    <EyeOff className="w-4 h-4 text-slate-400 mx-auto" />
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {reqCount > 0 ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-medium cursor-pointer hover:bg-amber-200" title="Otevřené požadavky" onClick={() => onNavigate('requests', { techId: asset.id })}>
                                                        <Wrench className="w-3 h-3 mr-1" /> {reqCount}
                                                    </span>
                                                ) : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {(user.role === 'admin' || user.role === 'maintenance') && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleEdit(asset)} 
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                                title={t('common.edit')}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            {user.role === 'admin' && (
                                                                <button 
                                                                    onClick={() => setDeleteId(asset.id)} 
                                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                                                    title={t('common.delete')}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                {filtered.length > 0 && (
                    <Pagination 
                        currentPage={currentPage}
                        totalItems={filtered.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={(limit) => { setItemsPerPage(limit); setCurrentPage(1); }}
                    />
                )}
            </div>

            {isModalOpen && (
                <AssetModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    initialData={editingAsset} 
                    onSave={handleSave} 
                />
            )}

            {deleteId && (
                <ConfirmModal 
                    message={t('msg.confirm_delete')} 
                    onConfirm={handleDelete} 
                    onCancel={() => setDeleteId(null)} 
                />
            )}
        </div>
    );
};
