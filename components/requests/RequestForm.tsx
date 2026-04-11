
import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../lib/i18n';
import { Euro, Trash2, Upload, Loader, Clock, Calendar, FolderKanban } from 'lucide-react';
import { getLocalized } from '../../lib/helpers';
import { db, api, isProductionDomain } from '../../lib/db'; 

interface RequestFormProps {
    formData: any;
    setFormData: (data: any) => void;
    errors: Record<string, string>;
    user: any;
    locations: any[];
    workplaces: any[];
    technologies: any[];
    suppliers: any[]; 
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removePhoto: (index: number) => void;
    isEditMode: boolean;
    isUploading: boolean;
}

export const RequestForm = ({ 
    formData, 
    setFormData, 
    errors, 
    user, 
    locations, 
    workplaces, 
    technologies,
    suppliers,
    handleImageUpload,
    removePhoto,
    isEditMode,
    isUploading
}: RequestFormProps) => {
    const { t, lang } = useI18n();
    const [projects, setProjects] = useState<any[]>([]);
    
    // Dropdown handlers for cascading selection
    const [selLoc, setSelLoc] = useState(formData.locationId || '');
    const [selWp, setSelWp] = useState(formData.workplaceId || '');

    useEffect(() => {
        const fetchProjects = async () => {
            const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));
            try {
                if (isMock) {
                    setProjects(db.projects.list().filter(p => p.isActive));
                } else {
                    const data = await api.get('/projects');
                    setProjects(data.filter((p: any) => p.isActive));
                }
            } catch (e) { console.error(e); }
        };
        fetchProjects();
    }, []);

    const availLocs = user.role === 'admin' ? locations : locations.filter((l: any) => (user.assignedLocationIds || []).includes(l.id));
    
    useEffect(() => {
        if (!isEditMode && !selLoc && availLocs.length === 1) {
            setSelLoc(availLocs[0].id);
            setFormData(prev => ({...prev, locationId: availLocs[0].id}));
        }
    }, [isEditMode, availLocs, selLoc]);

    const availWps = useMemo(() => {
        if (!selLoc) return [];
        const allowedWps = user.role === 'admin' 
            ? workplaces 
            : workplaces.filter((w: any) => (user.assignedWorkplaceIds || []).includes(w.id));
        return allowedWps.filter((w: any) => w.locationId === selLoc);
    }, [selLoc, workplaces, user]);

    useEffect(() => {
        if (!isEditMode && selLoc && !selWp && availWps.length === 1) {
            setSelWp(availWps[0].id);
            setFormData(prev => ({...prev, workplaceId: availWps[0].id}));
        }
    }, [isEditMode, selLoc, availWps, selWp]);

    // Update tech filter to check if tech.workplaceIds includes selWp
    const availTechs = useMemo(() => {
        if (!selWp) return [];
        return technologies.filter((t: any) => t.workplaceIds?.includes(selWp) && t.isVisible);
    }, [selWp, technologies]);

    // Auto-resolve Loc/Wp from existing techId in edit mode
    useEffect(() => {
        if (isEditMode && !selLoc && formData.techId) {
             const tech = technologies.find((t: any) => t.id === formData.techId);
             // Since tech can have multiple workplaces, we pick the first one that matches user's allowed locations/workplaces
             // or simply the first one found.
             if (tech && tech.workplaceIds && tech.workplaceIds.length > 0) {
                 const firstWpId = tech.workplaceIds[0];
                 const wp = workplaces.find((w: any) => w.id === firstWpId);
                 if (wp) {
                     setSelLoc(wp.locationId);
                     setSelWp(wp.id);
                     setFormData(prev => ({...prev, locationId: wp.locationId, workplaceId: wp.id}));
                 }
             }
        } else if (isEditMode && !selLoc && formData.locationId) {
             setSelLoc(formData.locationId);
             if (formData.workplaceId) {
                 setSelWp(formData.workplaceId);
             }
        }
    }, [isEditMode, formData.techId, formData.locationId, formData.workplaceId, technologies, workplaces, selLoc]);

    useEffect(() => {
        if (user.role === 'operator' && formData.assignedSupplierId !== 'internal') {
            setFormData({...formData, assignedSupplierId: 'internal'});
        }
    }, [user.role, formData, setFormData]);

    const { defaultSupplier, otherSuppliers } = useMemo(() => {
        const allSuppliers = suppliers || []; 
        let defSup = null;
        
        if (formData.techId) {
            const tech = technologies.find((t: any) => t.id === formData.techId);
            if (tech && tech.supplierId) {
                defSup = allSuppliers.find(s => s.id === tech.supplierId);
            }
        }

        const others = allSuppliers
            .filter(s => s.id !== defSup?.id)
            .sort((a, b) => getLocalized(a.name, lang).localeCompare(getLocalized(b.name, lang)));

        return { defaultSupplier: defSup, otherSuppliers: others };
    }, [formData.techId, technologies, suppliers, lang]);


    return (
        <div className="space-y-4 p-1">
             <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.project')}</label>
                <div className="relative">
                    <select 
                        className="w-full p-2 pl-8 rounded border bg-white"
                        value={formData.projectId || ''} 
                        onChange={e => setFormData({...formData, projectId: e.target.value || null})}
                    >
                        <option value="">{t('option.no_project')}</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{getLocalized(p.name, lang)}</option>
                        ))}
                    </select>
                    <FolderKanban className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.location')}</label>
                    <select 
                        className="w-full p-2 rounded border" 
                        value={selLoc} 
                        onChange={e => { 
                            setSelLoc(e.target.value); 
                            setSelWp(''); 
                            setFormData({...formData, techId: ''}); 
                        }}
                        disabled={isEditMode && !!formData.techId} 
                    >
                        <option value="">{t('option.select_location')}</option>
                        {availLocs.map((l: any) => <option key={l.id} value={l.id}>{getLocalized(l.name, lang)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.workplace')}</label>
                    <select 
                        className={`w-full p-2 rounded border ${!selLoc ? 'bg-slate-100' : ''}`}
                        value={selWp} 
                        onChange={e => { 
                            setSelWp(e.target.value); 
                            setFormData({...formData, workplaceId: e.target.value, techId: ''}); 
                        }}
                        disabled={!selLoc || (isEditMode && !!formData.techId)} 
                    >
                        <option value="">{t('option.select_wp')}</option>
                        {availWps.map((w: any) => <option key={w.id} value={w.id}>{getLocalized(w.name, lang)}</option>)}
                    </select>
                </div>
             </div>
             
             <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.technology')}</label>
                <select 
                    className={`w-full p-2 rounded border ${errors.techId ? 'border-red-500' : ''} ${(!selWp) ? 'bg-slate-100' : ''}`}
                    value={formData.techId || ''} 
                    onChange={e => setFormData({...formData, techId: e.target.value})}
                    disabled={!selWp} 
                >
                    <option value="">{selWp ? t('option.no_tech') : t('option.select_wp_first')}</option>
                    {availTechs.map((t: any) => {
                        const name = getLocalized(t.name, lang);
                        const label = t.serialNumber ? `${t.serialNumber} - ${name}` : name;
                        return <option key={t.id} value={t.id}>{label}</option>;
                    })}
                </select>
                {errors.techId && <span className="text-xs text-red-500">{errors.techId}</span>}
             </div>

             {user.role !== 'operator' && (
                 <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.solution')}</label>
                    <select 
                        className="w-full p-2 rounded border"
                        value={formData.assignedSupplierId || 'internal'} 
                        onChange={e => setFormData({...formData, assignedSupplierId: e.target.value})}
                    >
                        <option value="internal">🔧 {t('form.internal_solution')}</option>
                        
                        {defaultSupplier && (
                            <>
                                <option disabled>──────────</option>
                                <option value={defaultSupplier.id} className="font-bold bg-blue-50">
                                    {getLocalized(defaultSupplier.name, lang)} {t('form.default_for_tech')}
                                </option>
                            </>
                        )}
                        
                        <option disabled>──────────</option>
                        {otherSuppliers.map(s => (
                            <option key={s.id} value={s.id}>{getLocalized(s.name, lang)}</option>
                        ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Zvolte, zda bude problém řešen interně nebo externím dodavatelem.</p>
                 </div>
             )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.priority')}</label>
                    <select className="w-full p-2 rounded border" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                        <option value="basic">{t('prio.basic')}</option>
                        <option value="priority">{t('prio.priority')}</option>
                        <option value="urgent">{t('prio.urgent')}</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.planned_resolution_date')}</label>
                    <div className="relative">
                         <input 
                            type="date" 
                            className={`w-full p-2 pl-8 rounded border ${errors.plannedResolutionDate ? 'border-red-500' : ''}`}
                            value={formData.plannedResolutionDate || ''} 
                            onChange={e => setFormData({...formData, plannedResolutionDate: e.target.value})} 
                        />
                        <Calendar className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
                    </div>
                    {errors.plannedResolutionDate && <span className="text-xs text-red-500">{errors.plannedResolutionDate}</span>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.estimated_cost')}</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            min="0" 
                            className="w-full p-2 pl-8 rounded border" 
                            value={formData.estimatedCost ?? ''} 
                            onChange={e => setFormData({...formData, estimatedCost: e.target.value === '' ? undefined : Number(e.target.value)})}
                            placeholder="0"
                        />
                        <Euro className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.estimated_time')}</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            min="0" 
                            className="w-full p-2 pl-8 rounded border" 
                            value={formData.estimatedTime ?? ''} 
                            onChange={e => setFormData({...formData, estimatedTime: e.target.value === '' ? undefined : Number(e.target.value)})}
                            placeholder="0"
                        />
                        <Clock className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
                    </div>
                </div>
            </div>
            
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.title')} (max 50 znaků) *</label>
                <input 
                    maxLength={50}
                    className={`w-full p-2 rounded border ${errors.title ? 'border-red-500' : ''}`}
                    placeholder={t('form.title')} 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})}
                />
                {errors.title && <span className="text-xs text-red-500">{errors.title}</span>}
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.description')}</label>
                <textarea 
                className={`w-full p-2 rounded border ${errors.description ? 'border-red-500' : ''}`}
                placeholder={t('form.description')} 
                rows={4}
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                ></textarea>
                {errors.description && <span className="text-xs text-red-500">{errors.description}</span>}
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.photos')}</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                    {formData.photoUrls.map((url: string, i: number) => (
                        <div key={i} className="relative aspect-square bg-slate-100 border rounded overflow-hidden group">
                            <img src={url} className="w-full h-full object-cover" alt="prev"/>
                            <button onClick={() => removePhoto(i)} className="absolute top-0 right-0 p-1 bg-white/80 text-red-500 opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    <label className={`flex items-center justify-center border-2 border-dashed rounded aspect-square cursor-pointer hover:bg-slate-50 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {isUploading ? <Loader className="w-5 h-5 text-blue-500 animate-spin" /> : <Upload className="w-5 h-5 text-slate-400" />}
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                    </label>
                </div>
            </div>
        </div>
    );
}
