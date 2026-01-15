
import React, { useState, useEffect } from 'react';
import { useI18n } from '../../lib/i18n';
import { db, api, isProductionDomain } from '../../lib/db';
import { PushLog, User } from '../../lib/types';
import { RefreshCcw, Check, AlertTriangle, Clock, Filter, X, Smartphone } from 'lucide-react';
import { Pagination, ConfirmModal } from '../../components/Shared';

const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));

export const PushNotificationsPage = () => {
    const { t } = useI18n();
    const [logs, setLogs] = useState<PushLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [retryId, setRetryId] = useState<string | number | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    // Filters
    const [filterUser, setFilterUser] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalItems, setTotalItems] = useState(0);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            if (isMock) {
                // Mock logic: Filtering manually
                let data = db.pushLogs.list();
                const allUsers = db.users.list();
                setUsers(allUsers);

                if (filterUser) data = data.filter(l => l.user_id === filterUser);
                if (filterDateFrom) data = data.filter(l => l.created_at >= filterDateFrom);
                if (filterDateTo) data = data.filter(l => l.created_at <= filterDateTo);

                // Join User Name
                data = data.map(l => ({ ...l, user_name: allUsers.find(u => u.id === l.user_id)?.name || 'N/A' }));

                setTotalItems(data.length);
                const start = (currentPage - 1) * itemsPerPage;
                setLogs(data.slice(start, start + itemsPerPage));
            } else {
                const token = localStorage.getItem('auth_token');
                
                // Build Query String
                const params = new URLSearchParams({
                    page: currentPage.toString(),
                    limit: itemsPerPage.toString()
                });
                if (filterUser) params.append('userId', filterUser);
                if (filterDateFrom) params.append('dateFrom', filterDateFrom);
                if (filterDateTo) params.append('dateTo', filterDateTo);

                const [resLogs, resUsers] = await Promise.all([
                    fetch(`${api.baseUrl}/api/push-logs?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    api.get('/users')
                ]);

                if (resLogs.ok) {
                    const data = await resLogs.json();
                    setLogs(data);
                    setTotalItems(parseInt(resLogs.headers.get('X-Total-Count') || '0', 10));
                }
                setUsers(resUsers);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [currentPage, itemsPerPage, filterUser, filterDateFrom, filterDateTo]); // Re-fetch when params change

    const handleRetry = async () => {
        if (!retryId) return;
        try {
            if (isMock) {
                console.log("Mock Retry Push", retryId);
                // Simulate success
            } else {
                const token = localStorage.getItem('auth_token');
                await fetch(`${api.baseUrl}/api/push-logs/${retryId}/retry`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
            fetchLogs();
        } catch (e) { console.error(e); }
        finally { setShowConfirm(false); setRetryId(null); }
    };

    const renderStatusBadge = (status: string, error?: string) => {
        switch (status) {
            case 'sent':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1" /> {t('status.sent')}</span>;
            case 'error':
                return (
                    <div title={error} className="flex items-center cursor-help">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1" /> {t('status.error')}</span>
                    </div>
                );
            case 'skipped':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600"><Clock className="w-3 h-3 mr-1" /> {t('status.skipped')}</span>;
            default:
                return status;
        }
    };

    const clearFilters = () => {
        setFilterUser('');
        setFilterDateFrom('');
        setFilterDateTo('');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">{t('headers.push_logs')}</h2>
                <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 rounded border ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <Filter className="w-5 h-5" />
                </button>
            </div>

            {showFilters && (
                <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-sm">
                    <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-slate-700">{t('common.filter')}</span>
                        <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline flex items-center">
                            <X className="w-3 h-3 mr-1" /> {t('common.clear_filter')}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('col.recipient')}</label>
                            <select className="w-full border rounded p-1.5" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                                <option value="">{t('common.all')}</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('common.date')} (Od)</label>
                            <input type="date" className="w-full border rounded p-1.5" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('common.date')} (Do)</label>
                            <input type="date" className="w-full border rounded p-1.5" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-3">{t('col.created')}</th>
                                <th className="px-4 py-3">{t('col.recipient')}</th>
                                <th className="px-4 py-3">{t('col.subject')}</th>
                                <th className="px-4 py-3">{t('col.message')}</th>
                                <th className="px-4 py-3">{t('common.status')}</th>
                                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Načítání...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Žádné záznamy</td></tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="border-b hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                                            {new Date(log.created_at).toLocaleDateString()} <span className="text-xs">{new Date(log.created_at).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-700">
                                            {log.user_name || 'Neznámý'}
                                        </td>
                                        <td className="px-4 py-3 font-medium">{log.title}</td>
                                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={log.body}>{log.body}</td>
                                        <td className="px-4 py-3">
                                            {renderStatusBadge(log.status, log.error_message)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                                onClick={() => { setRetryId(log.id); setShowConfirm(true); }}
                                                className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"
                                                title={t('common.resend')}
                                            >
                                                <RefreshCcw className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {totalItems > 0 && (
                    <Pagination 
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                )}
            </div>

            {showConfirm && (
                <ConfirmModal 
                    title={t('common.resend')}
                    message={t('msg.confirm_resend')}
                    onConfirm={handleRetry}
                    onCancel={() => { setShowConfirm(false); setRetryId(null); }}
                />
            )}
        </div>
    );
};
