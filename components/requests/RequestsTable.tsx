import React, { useMemo } from 'react';
import { useI18n } from '../../lib/i18n';
import { Request, User, Technology, Supplier } from '../../lib/types';
import { getLocalized } from '../../lib/helpers';
import { MultiSelect, Pagination } from '../Shared';
import { Search, CheckCircle, Clock, Euro } from 'lucide-react';

interface RequestsTableProps {
    requests: Request[];
    currentUser: User;
    technologies: Technology[];
    suppliers: Supplier[];
    users: User[];
    onRowClick: (req: Request) => void;
    currentPage: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (limit: number) => void;
    filterState: any; 
    showFilters: boolean;
}

export const RequestsTable = ({ 
    requests, currentUser, technologies, suppliers, users,
    onRowClick, currentPage, itemsPerPage, onPageChange, onItemsPerPageChange,
    filterState, showFilters
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
        fAuthorId, // Author Filter
        fMaintenanceId // Maintenance Filter
    } = filterState;

    // --- Filtering Logic ---
    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const tech = technologies.find(t => t.id === req.techId);
            
            // Author Filter Logic
            if (fAuthorId && req.authorId !== fAuthorId) return false;

            // Maintenance Filter Logic
            if (fMaintenanceId && req.maintenanceId !== fMaintenanceId) return false;

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
    }, [requests, technologies, fTitle, fTechIds, fDateResFrom, fDateResTo, fSolverIds, fSupplierIds, fStatusIds, fPriorities, fApproved, lang, fAuthorId, fMaintenanceId]);

    // Pagination
    const totalItems = filteredRequests.length;
    const paginatedRequests = filteredRequests.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Helpers for rendering
    const renderStatusBadge = (status: string) => {
        const styles: any = {
            'new': 'bg-blue-100 text-blue-800',
            'assigned': 'bg-amber-100 text-amber-800',
            'solved': 'bg-green-100 text-green-800',
            'cancelled': 'bg-red-100 text-red-800'
        };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles[status]}`}>{t(`status.${status}`)}</span>;
    };

    const formatTime = (minutes: number | undefined) => {
        if (!minutes) return '-';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    // Filter Options
    const localizedTechs = technologies.map(t => ({ id: t.id, name: getLocalized(t.name, lang) }));
    const statusOptions = ['new', 'assigned', 'solved', 'cancelled'].map(s => ({ id: s, name: t(`status.${s}`) }));
    const priorityOptions = ['basic', 'priority', 'urgent'].map(p => ({ id: p, name: t(`prio.${p}`) }));
    const solverOptions = users.filter(u => u.role !== 'operator').map(u => ({ id: u.id, name: u.name }));
    
    return (
        <>
            {showFilters && (
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <div className="mb-1 text-xs text-slate-500 font-medium">{t('form.title')}</div>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
                                <input className="w-full pl-8 p-1.5 border rounded text-sm bg-white" value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder={t('common.search')} />
                            </div>
                        </div>
                        <div><MultiSelect label={t('col.technology')} options={localizedTechs} selectedIds={fTechIds} onChange={setFTechIds} /></div>
                        <div><MultiSelect label={t('common.status')} options={statusOptions} selectedIds={fStatusIds} onChange={setFStatusIds} /></div>
                        <div><MultiSelect label={t('col.solver')} options={solverOptions} selectedIds={fSolverIds} onChange={setFSolverIds} /></div>
                        
                        <div>
                            <div className="mb-1 text-xs text-slate-500 font-medium">{t('col.deadline')}</div>
                            <div className="flex gap-1">
                                <input type="date" className="w-full p-1.5 border rounded text-xs" value={fDateResFrom} onChange={e => setFDateResFrom(e.target.value)} />
                                <span className="text-slate-400">-</span>
                                <input type="date" className="w-full p-1.5 border rounded text-xs" value={fDateResTo} onChange={e => setFDateResTo(e.target.value)} />
                            </div>
                        </div>
                        <div><MultiSelect label={t('form.priority')} options={priorityOptions} selectedIds={fPriorities} onChange={setFPriorities} /></div>
                        <div>
                            <div className="mb-1 text-xs text-slate-500 font-medium">{t('headers.approval')}</div>
                            <select className="w-full p-1.5 border rounded text-sm bg-white" value={fApproved} onChange={e => setFApproved(e.target.value)}>
                                <option value="all">{t('common.all')}</option>
                                <option value="yes">{t('common.yes')}</option>
                                <option value="no">{t('common.no')}</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                        <tr>
                            <th className="px-4 py-3">{t('form.title')}</th>
                            <th className="px-4 py-3">{t('col.technology')}</th>
                            <th className="px-4 py-3">{t('col.deadline')}</th>
                            <th className="px-4 py-3">{t('col.solver')}</th>
                            <th className="px-4 py-3 text-center">{t('col.cost')}</th>
                            <th className="px-4 py-3 text-center">{t('col.time')}</th>
                            <th className="px-4 py-3 text-center">{t('common.status')}</th>
                            <th className="px-4 py-3 text-center">{t('headers.approval')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedRequests.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-400">Žádné požadavky</td></tr>
                        ) : (
                            paginatedRequests.map(req => {
                                const tech = technologies.find(t => t.id === req.techId);
                                const solver = users.find(u => u.id === req.solverId);
                                const isUrgent = req.priority === 'urgent';

                                return (
                                    <tr key={req.id} onClick={() => onRowClick(req)} className={`hover:bg-slate-50 cursor-pointer ${isUrgent ? 'bg-red-50/30' : ''}`}>
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {isUrgent && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2" title="Urgentní"></span>}
                                            {getLocalized(req.title, lang)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{getLocalized(tech?.name, lang) || '-'}</td>
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {req.plannedResolutionDate ? new Date(req.plannedResolutionDate).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{solver ? solver.name : <span className="text-slate-400 italic">Nepřiřazeno</span>}</td>
                                        <td className="px-4 py-3 text-center text-xs">
                                            {req.estimatedCost ? <span className="flex items-center justify-center"><Euro className="w-3 h-3 text-slate-400 mr-1"/>{req.estimatedCost}</span> : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs">
                                            {req.estimatedTime ? <span className="flex items-center justify-center"><Clock className="w-3 h-3 text-slate-400 mr-1"/>{formatTime(req.estimatedTime)}</span> : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">{renderStatusBadge(req.state)}</td>
                                        <td className="px-4 py-3 text-center">
                                            {req.isApproved 
                                                ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                                                : ((req.estimatedCost || 0) > 0 ? <div className="w-2 h-2 rounded-full bg-amber-400 mx-auto" title="Čeká na schválení" /> : <span className="text-slate-300">-</span>)
                                            }
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {totalItems > 0 && (
                <Pagination 
                    currentPage={currentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={onPageChange}
                    onItemsPerPageChange={onItemsPerPageChange}
                />
            )}
        </>
    );
};