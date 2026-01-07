
import React, { useState } from 'react';
import { db } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { Search, FileText, Calendar, Link as LinkIcon, Edit, Plus, X, Upload, Trash2, ExternalLink, EyeOff, AlertCircle, Wrench } from 'lucide-react';
import { Technology, User } from '../lib/types';
import { MultiSelect } from '../components/Shared';

interface AssetsPageProps {
    user: User;
    onNavigate?: (page: string, params?: any) => void;
}

export const AssetsPage = ({ user, onNavigate }: AssetsPageProps) => {
  const { t } = useI18n();
  const [techs, setTechs] = useState(db.technologies.list());
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedTech, setSelectedTech] = useState<any>(null);
  
  const isAdmin = user.role === 'admin';

  // Filtering State (Multi-select)
  const [filters, setFilters] = useState({
      name: '',
      typeIds: [] as string[],
      stateIds: [] as string[],
      workplaceIds: [] as string[],
      supplierIds: [] as string[],
      isVisible: 'true' as 'true' | 'false' | 'all' // Default Active = Yes
  });
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Technology>>({
    name: '', description: '', installDate: '', weight: 0, 
    typeId: '', stateId: '', supplierId: '', workplaceId: '', sharepointLink: '', photoUrls: [], isVisible: true
  });

  const refresh = () => setTechs(db.technologies.list());

  const hasActiveFilters = 
      filters.name !== '' || 
      filters.typeIds.length > 0 || 
      filters.stateIds.length > 0 || 
      filters.workplaceIds.length > 0 || 
      filters.supplierIds.length > 0 ||
      filters.isVisible !== 'true';

  const clearFilters = () => {
      setFilters({
          name: '',
          typeIds: [],
          stateIds: [],
          workplaceIds: [],
          supplierIds: [],
          isVisible: 'true'
      });
  }

  // Helper for visible items in filters/dropdowns
  const getVisibleWorkplaces = () => {
      const all = db.workplaces.list();
      return isAdmin ? all : all.filter(w => w.isVisible);
  };
  
  // Filter Logic
  const filteredTechs = techs.filter(tech => {
      // 1. Visibility Check (Controlled by filter now, but safety check for non-admins)
      if (!isAdmin && !tech.isVisible) return false;

      // 2. Active Filter logic
      if (filters.isVisible === 'true' && !tech.isVisible) return false;
      if (filters.isVisible === 'false' && tech.isVisible) return false;

      // 3. Multi-select Filters
      const matchName = tech.name.toLowerCase().includes(filters.name.toLowerCase());
      const matchType = filters.typeIds.length === 0 || filters.typeIds.includes(tech.typeId);
      const matchState = filters.stateIds.length === 0 || filters.stateIds.includes(tech.stateId);
      const matchWorkplace = filters.workplaceIds.length === 0 || filters.workplaceIds.includes(tech.workplaceId);
      const matchSupplier = filters.supplierIds.length === 0 || filters.supplierIds.includes(tech.supplierId);
      
      return matchName && matchType && matchState && matchWorkplace && matchSupplier;
  });

  const openModal = (tech?: Technology, e?: React.MouseEvent) => {
    if(e) e.stopPropagation(); // Prevent row click
    if (tech) {
      setEditingId(tech.id);
      setFormData(tech);
    } else {
      setEditingId(null);
      setFormData({
        name: '', description: '', installDate: new Date().toISOString().split('T')[0], weight: 0, 
        typeId: db.techTypes.list()[0]?.id || '', 
        stateId: db.techStates.list()[0]?.id || '', 
        supplierId: db.suppliers.list()[0]?.id || '', 
        workplaceId: db.workplaces.list()[0]?.id || '', 
        sharepointLink: '', photoUrls: [], isVisible: true
      });
    }
    setIsModalOpen(true);
  };

  const saveTech = () => {
    if (!formData.name || !formData.workplaceId) return;

    if (editingId) {
      db.technologies.update(editingId, formData);
    } else {
      db.technologies.add(formData as Technology);
    }
    
    refresh();
    if (selectedTech && editingId === selectedTech.id) {
        setSelectedTech({ ...selectedTech, ...formData });
    }
    setIsModalOpen(false);
  };

  const handleRowClick = (tech: Technology) => {
      setSelectedTech(tech);
      setView('detail');
  };

  const getOpenRequestCount = (techId: string) => {
      return db.requests.list().filter(r => r.techId === techId && r.state !== 'solved' && r.state !== 'cancelled').length;
  }

  const getNextMaintenance = (techId: string) => {
      const plans = db.maintenances.list()
        .filter(m => m.techId === techId && m.state === 'planned')
        .sort((a,b) => new Date(a.planDateFrom).getTime() - new Date(b.planDateFrom).getTime());
      return plans.length > 0 ? plans[0].planDateFrom : null;
  }

  // --- DETAIL VIEW ---
  if (view === 'detail' && selectedTech) {
    const workplace = db.workplaces.list().find(w => w.id === selectedTech.workplaceId);
    const location = db.locations.list().find(l => l.id === workplace?.locationId);
    const supplier = db.suppliers.list().find(s => s.id === selectedTech.supplierId);
    const type = db.techTypes.list().find(t => t.id === selectedTech.typeId);
    const state = db.techStates.list().find(s => s.id === selectedTech.stateId);
    const maintenance = db.maintenances.list().filter(m => m.techId === selectedTech.id);

    return (
        <div className="space-y-6 relative">
            <div className="flex justify-between items-center">
                <button onClick={() => setView('list')} className="text-blue-600 hover:underline">← {t('common.back')}</button>
                {(user.role === 'admin' || user.role === 'maintenance') && (
                    <button onClick={(e) => openModal(selectedTech)} className="flex items-center text-sm bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded">
                        <Edit className="w-4 h-4 mr-2" /> {t('common.edit')}
                    </button>
                )}
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                             {!selectedTech.isVisible && <div title="Skryto"><EyeOff className="w-6 h-6 text-slate-400" /></div>}
                             <h2 className="text-2xl font-bold">{selectedTech.name}</h2>
                        </div>
                        <div className="text-slate-500 mt-1 flex gap-4 text-sm">
                           <span className="flex items-center"><Calendar className="w-3 h-3 mr-1"/> {t('form.install_date')}: {selectedTech.installDate}</span>
                           <span>{type?.name}</span>
                           <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs">{state?.name}</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-semibold text-lg mb-4">Informace</h3>
                        <dl className="grid grid-cols-2 gap-4 text-sm">
                            <dt className="text-slate-500">{t('form.location')}</dt> <dd>{location?.name}</dd>
                            <dt className="text-slate-500">{t('form.workplace')}</dt> <dd>{workplace?.name}</dd>
                            <dt className="text-slate-500">{t('form.supplier')}</dt> <dd>{supplier?.name}</dd>
                            <dt className="text-slate-500">{t('form.weight')}</dt> <dd>{selectedTech.weight} kg</dd>
                            <dt className="text-slate-500">{t('form.documentation')}</dt> <dd><a href={selectedTech.sharepointLink} className="text-blue-600 flex items-center"><LinkIcon className="w-3 h-3 mr-1"/> Sharepoint</a></dd>
                        </dl>
                        <div className="mt-6">
                            <h4 className="font-medium mb-2">{t('form.description')}</h4>
                            <p className="text-slate-600 text-sm">{selectedTech.description}</p>
                        </div>
                        {selectedTech.photoUrls && selectedTech.photoUrls.length > 0 && (
                             <div className="mt-6">
                                <h4 className="font-medium mb-2">{t('form.photos')}</h4>
                                <div className="flex gap-2 flex-wrap">
                                    {selectedTech.photoUrls.map((url: string, i: number) => (
                                        <img key={i} src={url} alt="Tech" className="h-24 w-24 object-cover rounded border" />
                                    ))}
                                </div>
                             </div>
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg mb-4">{t('headers.history')}</h3>
                        <div className="space-y-3">
                            {maintenance.length === 0 ? <div className="text-slate-400 text-sm">Žádné záznamy</div> : maintenance.map(m => (
                                <div key={m.id} className="p-3 border rounded text-sm bg-slate-50">
                                    <div className="flex justify-between font-medium">
                                        <span>{m.title}</span>
                                        <span className="text-xs">{m.planDateFrom}</span>
                                    </div>
                                    <div className="text-xs mt-1 text-slate-500">{t(`status.${m.state}`)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {isModalOpen && <TechModal onClose={() => setIsModalOpen(false)} onSave={saveTech} data={formData} setData={setFormData} visibleWorkplaces={getVisibleWorkplaces()} isAdmin={isAdmin} />}
        </div>
    );
  }

  // --- TABLE VIEW ---
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold">{t('menu.assets')}</h2>
                {hasActiveFilters && (
                    <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 underline">
                        {t('common.clear_filter')}
                    </button>
                )}
            </div>
            {user.role === 'admin' && (
                <button onClick={() => openModal()} className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center">
                    <Plus className="w-4 h-4 mr-2" /> {t('common.add')}
                </button>
            )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                        <tr>
                            <th className="px-4 py-3 min-w-[150px] align-top">
                                <div className="mb-1">{t('form.name')}</div>
                                <input 
                                    className="w-full p-1 border rounded font-normal normal-case" 
                                    placeholder={t('common.search')}
                                    value={filters.name}
                                    onChange={e => setFilters({...filters, name: e.target.value})}
                                />
                            </th>
                            <th className="px-4 py-3 align-top min-w-[120px]">
                                <MultiSelect 
                                    label={t('form.type')} 
                                    options={db.techTypes.list()} 
                                    selectedIds={filters.typeIds} 
                                    onChange={ids => setFilters({...filters, typeIds: ids})} 
                                />
                            </th>
                            <th className="px-4 py-3 align-top min-w-[120px]">
                                <MultiSelect 
                                    label={t('form.state')} 
                                    options={db.techStates.list()} 
                                    selectedIds={filters.stateIds} 
                                    onChange={ids => setFilters({...filters, stateIds: ids})} 
                                />
                            </th>
                             <th className="px-4 py-3 align-top min-w-[120px]">
                                <MultiSelect 
                                    label={t('form.workplace')} 
                                    options={getVisibleWorkplaces().map(w => ({ id: w.id, name: w.name }))} 
                                    selectedIds={filters.workplaceIds} 
                                    onChange={ids => setFilters({...filters, workplaceIds: ids})} 
                                />
                            </th>
                             <th className="px-4 py-3 align-top min-w-[120px]">
                                <MultiSelect 
                                    label={t('form.supplier')} 
                                    options={db.suppliers.list()} 
                                    selectedIds={filters.supplierIds} 
                                    onChange={ids => setFilters({...filters, supplierIds: ids})} 
                                />
                            </th>
                            <th className="px-4 py-3 align-top min-w-[80px]">
                                <div className="mb-1 text-xs text-slate-500 font-medium">{t('form.is_visible')}</div>
                                <select 
                                    className="w-full p-1 border rounded font-normal normal-case"
                                    value={filters.isVisible}
                                    onChange={e => setFilters({...filters, isVisible: e.target.value as any})}
                                >
                                    <option value="all">{t('common.all')}</option>
                                    <option value="true">{t('common.yes')}</option>
                                    <option value="false">{t('common.no')}</option>
                                </select>
                            </th>
                            <th className="px-4 py-3 align-top text-center w-[80px]">
                                <div className="mb-1 text-xs text-slate-500 font-medium">{t('col.open_requests')}</div>
                            </th>
                            <th className="px-4 py-3 align-top text-center w-[100px]">
                                <div className="mb-1 text-xs text-slate-500 font-medium">{t('col.next_maintenance')}</div>
                            </th>
                            <th className="px-4 py-3 align-top text-center">
                                {t('common.actions')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTechs.length === 0 ? (
                            <tr><td colSpan={9} className="text-center p-8 text-slate-400">Žádné technologie nenalezeny</td></tr>
                        ) : (
                            filteredTechs.map(tech => {
                                const type = db.techTypes.list().find(t => t.id === tech.typeId);
                                const state = db.techStates.list().find(t => t.id === tech.stateId);
                                const wp = db.workplaces.list().find(t => t.id === tech.workplaceId);
                                const sup = db.suppliers.list().find(t => t.id === tech.supplierId);
                                const reqCount = getOpenRequestCount(tech.id);
                                const nextMaint = getNextMaintenance(tech.id);

                                return (
                                    <tr 
                                        key={tech.id} 
                                        onClick={() => handleRowClick(tech)}
                                        className={`border-b hover:bg-slate-50 cursor-pointer transition-colors ${!tech.isVisible ? 'opacity-75 bg-slate-50' : ''}`}
                                    >
                                        <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2">
                                            {!tech.isVisible && <EyeOff className="w-4 h-4 text-slate-400" />}
                                            {tech.name}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{type?.name}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                                                {state?.name}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{wp?.name}</td>
                                        <td className="px-4 py-3 text-slate-600">{sup?.name}</td>
                                        <td className="px-4 py-3 text-center text-slate-600">
                                            {tech.isVisible ? t('common.yes') : t('common.no')}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {reqCount > 0 ? (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('requests', { techId: tech.id }); }}
                                                    className="inline-flex items-center justify-center bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold hover:bg-red-200"
                                                >
                                                    {reqCount}
                                                </button>
                                            ) : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {nextMaint ? (
                                                 <button 
                                                    onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('maintenance'); }}
                                                    className="text-xs text-blue-600 hover:underline"
                                                 >
                                                     {nextMaint}
                                                 </button>
                                            ) : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {(user.role === 'admin' || user.role === 'maintenance') && (
                                                <button 
                                                    onClick={(e) => openModal(tech, e)} 
                                                    className="p-1 hover:bg-slate-200 rounded text-blue-600"
                                                    title={t('common.edit')}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
        {isModalOpen && <TechModal onClose={() => setIsModalOpen(false)} onSave={saveTech} data={formData} setData={setFormData} visibleWorkplaces={getVisibleWorkplaces()} isAdmin={isAdmin} />}
    </div>
  );
};

const TechModal = ({ onClose, onSave, data, setData, visibleWorkplaces, isAdmin }: any) => {
    const { t } = useI18n();
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const newPhotos = [...(data.photoUrls || []), reader.result as string];
                setData({ ...data, photoUrls: newPhotos });
            };
            reader.readAsDataURL(file);
        }
    };

    const removePhoto = (index: number) => {
        const newPhotos = data.photoUrls.filter((_: any, i: number) => i !== index);
        setData({ ...data, photoUrls: newPhotos });
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!data.name) newErrors.name = t('validation.required');
        if (!data.typeId) newErrors.typeId = t('validation.required');
        if (!data.stateId) newErrors.stateId = t('validation.required');
        if (!data.workplaceId) newErrors.workplaceId = t('validation.required');
        if (!data.supplierId) newErrors.supplierId = t('validation.required');
        if (!data.installDate) newErrors.installDate = t('validation.required');

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleSave = () => {
        if(validate()) {
            onSave();
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                    <h3 className="font-bold text-lg">{data.id ? t('common.edit') : t('common.create')}</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.name')}</label>
                        <input className={`w-full border p-2 rounded ${errors.name ? 'border-red-500' : ''}`} value={data.name} onChange={e => setData({...data, name: e.target.value})} />
                        {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
                    </div>
                    <div className="col-span-2">
                         <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.description')}</label>
                         <textarea className="w-full border p-2 rounded" rows={2} value={data.description} onChange={e => setData({...data, description: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.type')}</label>
                        <select className={`w-full border p-2 rounded ${errors.typeId ? 'border-red-500' : ''}`} value={data.typeId} onChange={e => setData({...data, typeId: e.target.value})}>
                            <option value="">-</option>
                            {db.techTypes.list().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {errors.typeId && <span className="text-xs text-red-500">{errors.typeId}</span>}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.state')}</label>
                        <select className={`w-full border p-2 rounded ${errors.stateId ? 'border-red-500' : ''}`} value={data.stateId} onChange={e => setData({...data, stateId: e.target.value})}>
                            <option value="">-</option>
                            {db.techStates.list().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {errors.stateId && <span className="text-xs text-red-500">{errors.stateId}</span>}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.workplace')}</label>
                        <select className={`w-full border p-2 rounded ${errors.workplaceId ? 'border-red-500' : ''}`} value={data.workplaceId} onChange={e => setData({...data, workplaceId: e.target.value})}>
                            <option value="">-</option>
                            {visibleWorkplaces.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({db.locations.list().find(l => l.id === t.locationId)?.name})</option>)}
                        </select>
                        {errors.workplaceId && <span className="text-xs text-red-500">{errors.workplaceId}</span>}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.supplier')}</label>
                        <select className={`w-full border p-2 rounded ${errors.supplierId ? 'border-red-500' : ''}`} value={data.supplierId} onChange={e => setData({...data, supplierId: e.target.value})}>
                            <option value="">-</option>
                            {db.suppliers.list().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {errors.supplierId && <span className="text-xs text-red-500">{errors.supplierId}</span>}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.install_date')}</label>
                        <input type="date" className={`w-full border p-2 rounded ${errors.installDate ? 'border-red-500' : ''}`} value={data.installDate} onChange={e => setData({...data, installDate: e.target.value})} />
                        {errors.installDate && <span className="text-xs text-red-500">{errors.installDate}</span>}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.weight')}</label>
                        <input type="number" className="w-full border p-2 rounded" value={data.weight} onChange={e => setData({...data, weight: parseFloat(e.target.value)})} />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">{t('form.documentation')}</label>
                        <div className="flex gap-2">
                             <input className="w-full border p-2 rounded" value={data.sharepointLink} onChange={e => setData({...data, sharepointLink: e.target.value})} placeholder="URL" />
                             {data.sharepointLink && (
                                 <a href={data.sharepointLink} target="_blank" rel="noreferrer" className="p-2 bg-slate-100 rounded hover:bg-slate-200">
                                     <ExternalLink className="w-5 h-5 text-blue-600" />
                                 </a>
                             )}
                        </div>
                    </div>
                    {/* Admin Only: Visibility Toggle */}
                    {isAdmin && (
                        <div className="col-span-2 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={data.isVisible} onChange={e => setData({...data, isVisible: e.target.checked})} />
                                <span className="text-sm font-medium">{t('form.is_visible')}</span>
                            </label>
                        </div>
                    )}
                    
                    {/* Image Upload Section */}
                    <div className="col-span-2 border-t pt-4 mt-2">
                         <label className="block text-sm font-bold text-slate-800 mb-2">{t('form.photos')}</label>
                         <div className="grid grid-cols-4 gap-4 mb-2">
                             {data.photoUrls?.map((url: string, index: number) => (
                                 <div key={index} className="relative group aspect-square bg-slate-100 rounded overflow-hidden border">
                                     <img src={url} alt="preview" className="w-full h-full object-cover" />
                                     <button 
                                        onClick={() => removePhoto(index)}
                                        className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                     >
                                         <Trash2 className="w-3 h-3" />
                                     </button>
                                 </div>
                             ))}
                             <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors aspect-square">
                                 <Upload className="w-6 h-6 text-slate-400 mb-1" />
                                 <span className="text-xs text-slate-500">{t('form.add_photo')}</span>
                                 <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                             </label>
                         </div>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 sticky bottom-0">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded">{t('common.cancel')}</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{t('common.save')}</button>
                </div>
            </div>
        </div>
    )
}