
import React, { useState, useEffect } from 'react';
import { useI18n } from '../../lib/i18n';
import { db } from '../../lib/db';
import { Email } from '../../lib/types';
import { RefreshCcw, Check, AlertTriangle, Clock, Mail } from 'lucide-react';
import { Pagination } from '../../components/Shared';

const PROD_DOMAIN = 'fhbmain.impossible.cz';
const PROD_API_URL = 'https://fhbmain.impossible.cz:3010';
let API_BASE = PROD_API_URL;

// Runtime Check for Environment
const isProductionDomain = typeof window !== 'undefined' && window.location.hostname === PROD_DOMAIN;
const isMockEnv = !isProductionDomain;

export const EmailsPage = () => {
    const { t } = useI18n();
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<(string|number)[]>([]);
    
    // Filtering
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'sent' | 'error'>('all');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const fetchEmails = async () => {
        setLoading(true);
        try {
            // Force Mock if not on production domain, regardless of token status
            if (isMockEnv) {
                setEmails(db.emails.list());
            } else {
                const token = localStorage.getItem('auth_token');
                // Even in production, if token is mock-token (legacy/test login), fall back to mock
                if (!token || token.startsWith('mock-token-')) {
                     setEmails(db.emails.list());
                } else {
                    const response = await fetch(`${API_BASE}/api/emails`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        setEmails(await response.json());
                    }
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmails();
    }, []);

    const handleRetry = async () => {
        if (selectedIds.length === 0) return;
        
        if (confirm(`Opravdu chcete znovu odeslat ${selectedIds.length} označených emailů?`)) {
            if (isMockEnv) {
                db.emails.retry(selectedIds);
                fetchEmails();
                setSelectedIds([]);
            } else {
                try {
                    const token = localStorage.getItem('auth_token');
                    const response = await fetch(`${API_BASE}/api/emails/retry`, {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ ids: selectedIds })
                    });
                    if (response.ok) {
                        fetchEmails();
                        setSelectedIds([]);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }
    };

    const getStatus = (email: Email) => {
        if (email.sent_at) return 'sent';
        if (email.error || email.attempts >= 3) return 'error';
        return 'pending';
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === paginatedEmails.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(paginatedEmails.map(e => e.id));
        }
    };

    const toggleSelect = (id: string|number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(x => x !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const filteredEmails = emails.filter(e => {
        const status = getStatus(e);
        if (filterStatus === 'all') return true;
        return status === filterStatus;
    });

    const paginatedEmails = filteredEmails.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const renderStatusBadge = (status: string, error?: string | null) => {
        switch(status) {
            case 'sent': 
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1"/> {t('status.sent')}</span>;
            case 'pending': 
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1"/> {t('status.pending')}</span>;
            case 'error': 
                return (
                    <div className="flex flex-col items-start">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><AlertTriangle className="w-3 h-3 mr-1"/> {t('status.error')}</span>
                        {error && <span className="text-[10px] text-red-600 mt-1 max-w-[150px] truncate" title={error}>{error}</span>}
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">{t('headers.emails')}</h2>
                <button 
                    onClick={handleRetry} 
                    disabled={selectedIds.length === 0}
                    className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    <RefreshCcw className="w-4 h-4 mr-2" /> {t('common.retry')} {selectedIds.length > 0 && `(${selectedIds.length})`}
                </button>
            </div>

            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                {/* Filters */}
                <div className="p-4 border-b bg-slate-50 flex gap-2">
                    {['all', 'pending', 'sent', 'error'].map(s => (
                        <button
                            key={s}
                            onClick={() => { setFilterStatus(s as any); setCurrentPage(1); setSelectedIds([]); }}
                            className={`px-3 py-1 text-sm rounded ${filterStatus === s ? 'bg-white border shadow-sm font-medium text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {s === 'all' ? t('common.all') : t(`status.${s}`)}
                        </button>
                    ))}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input type="checkbox" checked={paginatedEmails.length > 0 && selectedIds.length === paginatedEmails.length} onChange={toggleSelectAll} />
                                </th>
                                <th className="px-4 py-3">{t('common.date')}</th>
                                <th className="px-4 py-3">{t('common.recipient')}</th>
                                <th className="px-4 py-3">{t('common.subject')}</th>
                                <th className="px-4 py-3">{t('common.status')}</th>
                                <th className="px-4 py-3">Pokusy</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Načítání...</td></tr>
                            ) : paginatedEmails.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Žádné emaily</td></tr>
                            ) : (
                                paginatedEmails.map(e => (
                                    <tr key={e.id} className="border-b hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggleSelect(e.id)} />
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                            {new Date(e.created_at).toLocaleDateString()} <span className="text-xs">{new Date(e.created_at).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-700">{e.to_address}</td>
                                        <td className="px-4 py-3 text-slate-600">{e.subject}</td>
                                        <td className="px-4 py-3">{renderStatusBadge(getStatus(e), e.error)}</td>
                                        <td className="px-4 py-3 text-slate-500">{e.attempts}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {filteredEmails.length > 0 && (
                    <Pagination 
                        currentPage={currentPage}
                        totalItems={filteredEmails.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                )}
            </div>
        </div>
    );
};
