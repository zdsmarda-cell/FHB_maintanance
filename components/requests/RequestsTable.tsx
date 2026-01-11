
import React, { useMemo } from 'react';
import { Request, User, Workplace, Technology, Supplier } from '../../lib/types';
import { useI18n } from '../../lib/i18n';
import { CheckCircle2, Eye, Edit, Wrench, UserPlus, Ban, Trash2, Pencil, UserCog, X, RotateCcw, Clock, Euro, Image as ImageIcon } from 'lucide-react';
import { Pagination, MultiSelect } from '../Shared';
import { getLocalized } from '../../lib/helpers';

interface RequestsTableProps {
    requests: Request[];
    onRowClick: (req: Request) => void;
    onEditClick: (req: Request) => void;
    onStatusChangeClick: (req: Request) => void;
    onAssignSelf?: (req: Request) => void;
    onApprovalClick?: (req: Request) => void;
    onUnassign?: (req: Request) => void;
    onGallery?: (photos: string[], e: React.MouseEvent) => void;
    currentUser: User;
    workplaces: Workplace[];
    technologies: Technology[];
    users: User[];
    suppliers: Supplier[];
    currentPage: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (limit: number) => void;
    filterState: any; 
}

export const RequestsTable = ({ 
    requests, 
    onRowClick, 
    onEditClick,
    onStatusChangeClick,
    onAssignSelf,
    onApprovalClick,
    onUnassign,
    onGallery,
    currentUser, 
    technologies,
    users,
    suppliers,
    currentPage,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    filterState
}: RequestsTableProps) => {
    const { t, lang } = useI18n();

    // Destructure controlled state
    const {
        fTitle, setFTitle,
        fTechIds, setFTechIds,
        fDateResFrom, setFDateResFrom,
        fDateResTo, setFDateResTo,
        fSolverIds, setFSolverIds,
        fSupplierIds, setFSupplierIds,
        fStatusIds, setFStatusIds,
        fPriorities, setFPriorities,
        fApproved, setFApproved,
        fAuthorId, setFAuthorId // Author Filter
    } = filterState;

    // Check if any filter is active
    const hasActiveFilters = fTitle || 
        fTechIds.length > 0 || 
        fDateResFrom || 
        fDateResTo || 
        fSolverIds.length > 0 || 
        fSupplierIds.length > 0 || 
        fStatusIds.length > 0 || 
        fPriorities.length > 0 || 
        fApproved !== 'all' ||
        fAuthorId; // Check author filter

    const handleClearAllFilters = () => {
        setFTitle('');
        setFTechIds([]);
        setFDateResFrom('');
        setFDateResTo('');
        setFSolverIds([]);
        setFSupplierIds([]);
        setFStatusIds([]);
        setFPriorities([]);
        setFApproved('all');
        setFAuthorId('');
    };

    // -- Filtering Logic --
    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const tech = technologies.find(t => t.id === req.techId);
            
            // Note: Strict operator restriction removed in parent RequestsPage to allow full visibility on tech
            // Author Filter Logic (fAuthorId) is handled here now:
            if (fAuthorId && req.authorId !== fAuthorId) return false;

            if (fTitle) {
                const localizedTitle = getLocalized(req.title, lang);
                if (!localizedTitle.toLowerCase().includes(fTitle.toLowerCase())) return false;
            }
            if (fTechIds.length > 0 && !fTechIds.includes(req.techId)) return false;

            if (fDateResFrom || fDateResTo) {
                if (!req.plannedResolutionDate) return false;
                const resDate = new Date(req.plannedResolutionDate).getTime();
                if (fDateResFrom) {
                    if (resDate < new Date(fDateResFrom).setHours(0,0,0,0)) return false;
                }
                if (fDateResTo) {
                    if (resDate > new Date(fDateResTo).setHours(23,59,59,999)) return false;
                }
            }

            if (fSolverIds.length > 0) {
                if (!req.solverId) return false;
                if (!fSolverIds.includes(req.solverId)) return false;
            }

            if (fSupplierIds.length > 0) {
                const effectiveSupplierId = req.assignedSupplierId || tech?.supplierId || 'internal';
                if (fSupplierIds.includes('external')) {
                    if (effectiveSupplierId === 'internal') return false;
                } else if (fSupplierIds.includes('internal')) {
                    if (effectiveSupplierId !== 'internal') return false;
                } else {
                    if (!fSupplierIds.includes(effectiveSupplierId)) return false;
                }
            }

            if (fStatusIds.length > 0 && !fStatusIds.includes(req.state)) return false;
            
            if (fPriorities && fPriorities.length > 0 && !fPriorities.includes(req.priority)) return false;

            if (fApproved === 'yes' && !req.isApproved) return false;
            if (fApproved === 'no' && req.isApproved) return false;

            return true;
        });
    }, [requests, currentUser, technologies, fTitle, fTechIds, fDateResFrom, fDateResTo, fSolverIds, fSupplierIds, fStatusIds, fPriorities, fApproved, lang, fAuthorId]);

    // -- Pagination Logic --
    const totalItems = filteredRequests.length;
    const paginatedRequests = filteredRequests.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // -- Render Helpers --
    const renderStatusBadge = (status: string, onClick?: () => void) => {
        const styles: any = {
            'new': 'bg-blue-100 text-blue-800 border-blue-200',
            'assigned': 'bg-amber-100 text-amber-800 border-amber-200',
            'solved': 'bg-green-100 text-green-800 border-green-200',
            'cancelled': 'bg-red-100 text-red-800 border-red-200'
        };
        
        return (
            <span 
                onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
                className={`px-2 py-1 rounded-full text-xs font-bold border ${styles[status] || 'bg-slate-100'} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
            >
                {t(`status.${status}`) || status}
            </span>
        );
    };

    const renderApprovalBadge = (req: Request) => {
        const cost = req.estimatedCost || 0;
        const isLocked = req.state === 'solved' || req.state === 'cancelled';
        
        if (cost === 0) return <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 cursor-default">Automaticky</span>;
        if (req.isApproved) {
            return (
                <span 
                    onClick={(e) => { if (isLocked || !onApprovalClick) return; e.stopPropagation(); onApprovalClick(req); }}
                    className={`px-2 py-1 rounded text-xs font-bold border flex items-center justify-center gap-1 ${isLocked ? 'bg-green-50 text-green-700 border-green-100 cursor-default opacity-70' : 'bg-green-100 text-green-800 border-green-200 cursor-pointer hover:bg-green-200'}`}
                >
                    <CheckCircle2 className="w-3 h-3" /> {t('form.is_approved')}
                </span>
            );
        }
        if (isLocked) return <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-default flex items-center justify-center gap-1"><Ban className="w-3 h-3" /> Uzamčeno</span>;
        return (
            <span 
                onClick={(e) => { if (!onApprovalClick) return; e.stopPropagation(); onApprovalClick(req); }}
                className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer hover:bg-amber-200 flex items-center justify-center gap-1"
            >
               {t('msg.waiting_for_approval')}
            </span>
        );
    }

    const renderPriorityBadge = (prio: string) => {
        let colors = 'bg-slate-100 text-slate-700';
        if (prio === 'urgent') colors = 'bg-red-100 text-red-800 border-red-200 font-bold';
        if (prio === 'priority') colors = 'bg-amber-100 text-amber-800 border-amber-200';
        
        return <span className={`px-2 py-0.5 rounded text-xs border ${colors} uppercase`}>{t(`prio.${prio}`)}</span>;
    }

    const formatTime = (minutes: number | undefined) => {
        if (!minutes) return '-';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
    }

    // Prepare Options for MultiSelects using getLocalized
    const techOptions = technologies.map(t => ({ id: t.id, name: getLocalized(t.name, lang) }));
    const userOptions = users.filter(u => u.role !== 'operator').map(u => ({ id: u.id, name: u.name }));
    const supplierOptions = [
        { id: 'internal', name: t('form.internal_solution') },
        { id: 'external', name: 'Externí (Všichni)' },
        ...suppliers.map(s => ({ id: s.id, name: getLocalized(s.name, lang) }))
    ];
    const statusOptions = ['new', 'assigned', 'solved', 'cancelled'].map(s => ({ id: s, name: t(`status.${s}`) }));
    const priorityOptions = ['basic', 'priority', 'urgent'].map(p => ({ id: p, name: t(`prio.${p}`) }));

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-2 font-semibold w-10"></th>
                            <th className="px-4 py-2 font-semibold min-w-[150px]">{t('form.title')}</th>
                            <th className="px-4 py-2 font-semibold min-w-[150px]">{t('col.technology')}</th>
                            <th className="px-4 py-2 font-semibold whitespace-nowrap">{t('action.created')}</th>
                            <th className="px-4 py-2 font-semibold whitespace-nowrap">{t('col.deadline')}</th>
                            <th className="px-4 py-2 font-semibold min-w-[100px]">{t('form.priority')}</th>
                            <th className="px-4 py-2 font-semibold min-w-[130px]">{t('col.solver')}</th>
                            <th className="px-4 py-2 font-semibold min-w-[130px]">{t('col.supplier')}</th>
                            <th className="px-4 py-2 font-semibold text-center w-24">{t('col.cost')}</th>
                            <th className="px-4 py-2 font-semibold text-center w-24">{t('col.time')}</th>
                            <th className="px-4 py-2 font-semibold min-w-[120px]">{t('common.status')}</th>
                            <th className="px-4 py-2 font-semibold text-center min-w-[120px]">{t('col.approved')}</th>
                            <th className="px-4 py-2 font-semibold text-right">{t('common.actions')}</th>
                        </tr>
                        <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="px-2 py-2 text-center">
                                {/* Toggle for "My Requests" - Primarily for Operators */}
                                <div className="flex items-center justify-center" title={t('filter.only_mine')}>
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={fAuthorId === currentUser.id}
                                        onChange={(e) => setFAuthorId(e.target.checked ? currentUser.id : '')}
                                    />
                                    <span className="ml-1 text-[10px] text-slate-500 whitespace-nowrap">{t('filter.only_mine')}</span>
                                </div>
                            </th>
                            <th className="px-2 py-2">
                                <div className="relative">
                                    <input 
                                        className="w-full border rounded p-1 text-xs font-normal pr-6" 
                                        placeholder={t('common.search')} 
                                        value={fTitle} 
                                        onChange={e => setFTitle(e.target.value)} 
                                    />
                                    {fTitle && (
                                        <button 
                                            onClick={() => setFTitle('')} 
                                            className="absolute right-1 top-1.5 text-slate-400 hover:text-slate-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </th>
                            <th className="px-2 py-2"><div className="font-normal"><MultiSelect label="" options={techOptions} selectedIds={fTechIds} onChange={setFTechIds} /></div></th>
                            <th className="px-2 py-2"></th>
                            <th className="px-2 py-2">
                                <div className="flex flex-col gap-1">
                                    <input type="date" className="w-full border rounded p-0.5 text-xs font-normal" value={fDateResFrom} onChange={e => setFDateResFrom(e.target.value)} />
                                    <input type="date" className="w-full border rounded p-0.5 text-xs font-normal" value={fDateResTo} onChange={e => setFDateResTo(e.target.value)} />
                                </div>
                            </th>
                            <th className="px-2 py-2"><div className="font-normal"><MultiSelect label="" options={priorityOptions} selectedIds={fPriorities} onChange={setFPriorities} /></div></th>
                            <th className="px-2 py-2"><div className="font-normal"><MultiSelect label="" options={userOptions} selectedIds={fSolverIds} onChange={setFSolverIds} /></div></th>
                            <th className="px-2 py-2"><div className="font-normal"><MultiSelect label="" options={supplierOptions} selectedIds={fSupplierIds} onChange={setFSupplierIds} /></div></th>
                            {/* No filters for Price and Time */}
                            <th className="px-2 py-2"></th>
                            <th className="px-2 py-2"></th>
                            <th className="px-2 py-2"><div className="font-normal"><MultiSelect label="" options={statusOptions} selectedIds={fStatusIds} onChange={setFStatusIds} /></div></th>
                            <th className="px-2 py-2">
                                <select className="w-full border rounded p-1 text-xs font-normal" value={fApproved} onChange={e => setFApproved(e.target.value)}>
                                    <option value="all">{t('common.all')}</option>
                                    <option value="yes">{t('common.yes')}</option>
                                    <option value="no">{t('common.no')}</option>
                                </select>
                            </th>
                            <th className="px-2 py-2 text-right">
                                {hasActiveFilters && (
                                    <button 
                                        onClick={handleClearAllFilters}
                                        className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 bg-white border px-2 py-1 rounded shadow-sm"
                                        title={t('common.clear_filter')}
                                    >
                                        <RotateCcw className="w-3 h-3" /> Reset
                                    </button>
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedRequests.length === 0 ? (
                            <tr><td colSpan={13} className="p-8 text-center text-slate-400">{t('msg.no_my_requests')}</td></tr>
                        ) : (
                            paginatedRequests.map(r => {
                                const tech = technologies.find(t => t.id === r.techId);
                                const solver = users.find(u => u.id === r.solverId);
                                const isAuthorized = currentUser.role === 'admin' || currentUser.role === 'maintenance';
                                let supplierName = '-';
                                let isInternal = false;
                                if (r.assignedSupplierId === 'internal') { isInternal = true; }
                                else if (r.assignedSupplierId) { supplierName = getLocalized(suppliers.find(s => s.id === r.assignedSupplierId)?.name, lang) || '?'; }
                                else { if (tech?.supplierId) { supplierName = getLocalized(suppliers.find(s => s.id === tech.supplierId)?.name, lang) || '-'; } else { isInternal = true; } }
                                const hasPhotos = r.photoUrls && r.photoUrls.length > 0;

                                return (
                                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-center">
                                            {hasPhotos && onGallery && (
                                                <button onClick={(e) => onGallery(r.photoUrls, e)} className="text-blue-500 hover:text-blue-700" title="Zobrazit fotky">
                                                    <ImageIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{getLocalized(r.title, lang)}</td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">{getLocalized(tech?.name, lang) || '-'}</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                                            <div>{new Date(r.createdDate).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-slate-400">{new Date(r.createdDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{r.plannedResolutionDate ? new Date(r.plannedResolutionDate).toLocaleDateString() : '-'}</td>
                                        <td className="px-4 py-3">{renderPriorityBadge(r.priority)}</td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">
                                            {solver ? (
                                                <div className="flex items-center justify-between gap-1">
                                                    <span>{solver.name}</span>
                                                    {isAuthorized && r.state !== 'solved' && r.state !== 'cancelled' && (
                                                        <div className="flex gap-1">
                                                            {(currentUser.role === 'admin' || currentUser.id === r.solverId) && (
                                                                <>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); onAssignSelf && onAssignSelf(r); }} 
                                                                        className="text-slate-400 hover:text-blue-600"
                                                                        title={t('modal.assign_title_edit')}
                                                                    >
                                                                        <UserCog className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : ((isAuthorized && r.state === 'new' && onAssignSelf) ? (
                                                <button onClick={(e) => { e.stopPropagation(); onAssignSelf(r); }} className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors" title={t('action.take_over')}>
                                                    <UserPlus className="w-3 h-3 mr-1" /> {t('action.take_over')}
                                                </button>
                                            ) : '-')}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">
                                            {isInternal ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"><Wrench className="w-3 h-3 mr-1" /> {t('form.internal_solution')}</span> : <span>{supplierName}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs font-mono">
                                            {r.estimatedCost ? <span className="flex items-center justify-center gap-1"><Euro className="w-3 h-3 text-slate-400"/> {r.estimatedCost}</span> : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs font-mono">
                                            {r.estimatedTime ? <span className="flex items-center justify-center gap-1"><Clock className="w-3 h-3 text-slate-400"/> {formatTime(r.estimatedTime)}</span> : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">{renderStatusBadge(r.state, isAuthorized ? () => onStatusChangeClick(r) : undefined)}</td>
                                        <td className="px-4 py-3 text-center">{renderApprovalBadge(r)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => onRowClick(r)} className="text-slate-400 hover:text-blue-600 p-1" title={t('headers.request_detail')}><Eye className="w-4 h-4" /></button>
                                                {isAuthorized && <button onClick={() => onEditClick(r)} className="text-slate-400 hover:text-amber-600 p-1" title={t('common.edit')}><Edit className="w-4 h-4" /></button>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            {totalItems > 0 && <Pagination currentPage={currentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={onPageChange} onItemsPerPageChange={onItemsPerPageChange} />}
        </>
    );
};
