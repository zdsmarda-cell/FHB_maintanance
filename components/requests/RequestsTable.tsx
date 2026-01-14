
import React from 'react';
import { useI18n } from '../../lib/i18n';
import { Request, User, Technology, Supplier, Workplace } from '../../lib/types';
import { getLocalized } from '../../lib/helpers';
import { MultiSelect, Pagination } from '../Shared';
import { Search, CheckCircle, Clock, Euro, X, Eye, Edit, Ban, UserPlus, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { SortConfig } from '../../pages/RequestsPage'; // Import type from parent

interface RequestsTableProps {
    requests: Request[]; // Already filtered
    currentUser: User;
    technologies: Technology[];
    suppliers: Supplier[];
    users: User[];
    workplaces: Workplace[];
    onDetail: (req: Request) => void;
    onEdit: (req: Request) => void;
    onCancel: (req: Request) => void;
    onTakeOver: (req: Request) => void;
    onApproval: (req: Request) => void;
    onStatusChange: (req: Request) => void; 
    currentPage: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (limit: number) => void;
    filterState: any; 
    showFilters: boolean;
    sortConfig: SortConfig; // New Prop
    onSort: (key: string) => void; // New Prop
}

export const RequestsTable = ({ 
    requests, currentUser, technologies, suppliers, users, workplaces,
    onDetail, onEdit, onCancel, onTakeOver, onApproval, onStatusChange,
    currentPage, itemsPerPage, onPageChange, onItemsPerPageChange,
    filterState, showFilters,
    sortConfig, onSort
}: RequestsTableProps) => {
    const { t, lang } = useI18n();
    
    // Destructure controlled state
    const {
        fTitle, setFTitle,
        fTechIds, setFTechIds,
        fDateResFrom, setFDateResFrom,
        fDateResTo, setFDateResTo,
        fDateCreatedFrom, setFDateCreatedFrom,
        fDateCreatedTo, setFDateCreatedTo,
        fSolverIds, setFSolverIds,
        fSupplierIds, setFSupplierIds,
        fStatusIds, setFStatusIds,
        fPriorities, setFPriorities,
        fApproved, setFApproved,
        fMaintenanceId, setFMaintenanceId
    } = filterState;

    // Pagination
    const totalItems = requests.length;
    const paginatedRequests = requests.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Helpers
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

    const handleClearFilters = () => {
        setFTitle('');
        setFTechIds([]);
        setFDateResFrom('');
        setFDateResTo('');
        setFDateCreatedFrom('');
        setFDateCreatedTo('');
        setFSolverIds([]);
        setFSupplierIds([]);
        setFStatusIds([]);
        setFPriorities([]);
        setFApproved('all');
        if (setFMaintenanceId) setFMaintenanceId(null);
    };

    // Helper for Sortable Headers
    const SortableHeader = ({ label, sortKey, align = 'left' }: { label: string, sortKey: string, align?: string }) => {
        const isActive = sortConfig.key === sortKey;
        return (
            <th 
                className={`px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors select-none text-${align}`}
                onClick={() => onSort(sortKey)}
            >
                <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : (align === 'right' ? 'justify-end' : 'justify-start')}`}>
                    {label}
                    {isActive ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                    )}
                </div>
            </th>
        );
    };

    // Options for Filters
    const localizedTechs = technologies.map(t => ({ id: t.id, name: getLocalized(t.name, lang) }));
    const statusOptions = ['new', 'assigned', 'solved', 'cancelled'].map(s => ({ id: s, name: t(`status.${s}`) }));
    const priorityOptions = ['basic', 'priority', 'urgent'].map(p => ({ id: p, name: t(`prio.${p}`) }));
    const solverOptions = users.filter(u => u.role !== 'operator').map(u => ({ id: u.id, name: u.name }));
    const supplierOptions = [
        { id: 'internal', name: t('form.internal_solution') },
        { id: 'external', name: `${t('label.external_tasks')} (${t('common.all')})` }, // Added "External" group option
        ...suppliers.map(s => ({ id: s.id, name: getLocalized(s.name, lang) }))
    ];

    const hasActiveFilters = fTitle || fTechIds.length > 0 || fDateResFrom || fDateResTo || fDateCreatedFrom || fDateCreatedTo || fSolverIds.length > 0 || fSupplierIds.length > 0 || fStatusIds.length > 0 || fPriorities.length > 0 || fApproved !== 'all' || fMaintenanceId;
    
    return (
        <>
            {showFilters && (
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold text-slate-700">{t('common.filter')}</span>
                        {hasActiveFilters && (
                            <button onClick={handleClearFilters} className="text-xs text-blue-600 hover:text-blue-800 flex items-center">
                                <X className="w-3 h-3 mr-1" /> {t('common.clear_filter')}
                            </button>
                        )}
                    </div>
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
                        <div>
                            <div className="mb-1 text-xs text-slate-500 font-medium">{t('col.created')}</div>
                            <div className="flex gap-1">
                                <input type="date" className="w-full p-1.5 border rounded text-xs" value={fDateCreatedFrom} onChange={e => setFDateCreatedFrom(e.target.value)} />
                                <span className="text-slate-400">-</span>
                                <input type="date" className="w-full p-1.5 border rounded text-xs" value={fDateCreatedTo} onChange={e => setFDateCreatedTo(e.target.value)} />
                            </div>
                        </div>
                        <div><MultiSelect label={t('form.priority')} options={priorityOptions} selectedIds={fPriorities} onChange={setFPriorities} /></div>
                        <div><MultiSelect label={t('form.supplier')} options={supplierOptions} selectedIds={fSupplierIds} onChange={setFSupplierIds} /></div>
                        <div>
                            <div className="mb-1 text-xs text-slate-500 font-medium">{t('headers.approval')}</div>
                            <select className="w-full p-1.5 border rounded text-sm bg-white" value={fApproved} onChange={e => setFApproved(e.target.value)}>
                                <option value="all">{t('common.all')}</option>
                                <option value="yes">{t('common.yes')}</option>
                                <option value="no">{t('common.no')}</option>
                                <option value="pending">{t('filter.approval_pending')}</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b group">
                        <tr>
                            <SortableHeader label={t('col.created')} sortKey="createdDate" />
                            <SortableHeader label={t('form.title')} sortKey="title" />
                            <SortableHeader label={t('col.technology')} sortKey="techId" />
                            <SortableHeader label={t('col.deadline')} sortKey="plannedResolutionDate" />
                            <SortableHeader label={t('col.solver')} sortKey="solverId" />
                            <SortableHeader label={t('col.cost')} sortKey="estimatedCost" align="center" />
                            <SortableHeader label={t('col.time')} sortKey="estimatedTime" align="center" />
                            <SortableHeader label={t('common.status')} sortKey="state" align="center" />
                            <SortableHeader label={t('headers.approval')} sortKey="isApproved" align="center" />
                            <th className="px-4 py-3 text-right">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedRequests.length === 0 ? (
                            <tr><td colSpan={10} className="p-8 text-center text-slate-400">Žádné požadavky</td></tr>
                        ) : (
                            paginatedRequests.map(req => {
                                const tech = technologies.find(t => t.id === req.techId);
                                const solver = users.find(u => u.id === req.solverId);
                                const isUrgent = req.priority === 'urgent';
                                
                                // Check permissions logic
                                const canTakeOver = currentUser.role === 'admin' || currentUser.role === 'maintenance';
                                const canApprove = currentUser.role === 'admin' || currentUser.role === 'maintenance';
                                const canEdit = currentUser.role !== 'operator' || currentUser.id === req.authorId;
                                const isFinal = req.state === 'solved' || req.state === 'cancelled';
                                
                                // Approval Enabled: Just check if user has ROLE to approve and request is not final.
                                // We do NOT check limit here anymore for disabled state, that logic moves to modal.
                                const approvalEnabled = canApprove && !isFinal;

                                return (
                                    <tr key={req.id} className={`hover:bg-slate-50 ${isUrgent ? 'bg-red-50/30' : ''}`}>
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {new Date(req.createdDate).toLocaleDateString()}
                                            <div className="text-xs text-slate-400">
                                                {new Date(req.createdDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {isUrgent && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2" title="Urgentní"></span>}
                                            {getLocalized(req.title, lang)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{getLocalized(tech?.name, lang) || '-'}</td>
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {req.plannedResolutionDate ? new Date(req.plannedResolutionDate).toLocaleDateString() : '-'}
                                        </td>
                                        
                                        {/* Solver / Take Over Column */}
                                        <td className="px-4 py-3 text-slate-600">
                                            {req.solverId ? (
                                                <span className="font-medium text-slate-700">{solver ? solver.name : 'Neznámý'}</span>
                                            ) : (
                                                !isFinal && canTakeOver ? (
                                                    <button 
                                                        onClick={() => onTakeOver(req)}
                                                        className="inline-flex items-center px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                                    >
                                                        <UserPlus className="w-3 h-3 mr-1" /> {t('action.take_over')}
                                                    </button>
                                                ) : <span className="text-slate-400 italic">Nepřiřazeno</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-center text-xs">
                                            {req.estimatedCost ? <span className="flex items-center justify-center"><Euro className="w-3 h-3 text-slate-400 mr-1"/>{req.estimatedCost}</span> : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs">
                                            {req.estimatedTime ? <span className="flex items-center justify-center"><Clock className="w-3 h-3 text-slate-400 mr-1"/>{formatTime(req.estimatedTime)}</span> : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {/* Status Badge is now static, changes moved to Detail */}
                                            {renderStatusBadge(req.state)}
                                        </td>
                                        
                                        {/* Approval Column - Show only if approved OR cost > 0 */}
                                        <td className="px-4 py-3 text-center">
                                            {(req.isApproved || (req.estimatedCost || 0) > 0) ? (
                                                <button 
                                                    onClick={() => onApproval(req)}
                                                    disabled={!approvalEnabled}
                                                    className={`p-1 rounded transition-colors ${approvalEnabled ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default opacity-80'}`}
                                                    title={approvalEnabled ? "Změnit stav schválení" : "Nemáte oprávnění nebo je požadavek uzavřen"}
                                                >
                                                    {req.isApproved 
                                                        ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                                                        : <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mx-auto ring-2 ring-amber-100" title="Čeká na schválení" />
                                                    }
                                                </button>
                                            ) : null}
                                        </td>

                                        {/* Actions Column */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => onDetail(req)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title={t('headers.request_detail')}>
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {!isFinal && canEdit && (
                                                    <button onClick={() => onEdit(req)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded" title={t('common.edit')}>
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {!isFinal && (
                                                    <button onClick={() => onCancel(req)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title={t('action.cancel')}>
                                                        <Ban className="w-4 h-4" />
                                                    </button>
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
