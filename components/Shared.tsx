
import React, { useState, useRef, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, ChevronDown, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Address } from '../lib/types';
import { useI18n } from '../lib/i18n';

interface AddressInputProps {
    address: Address;
    onChange: (a: Address) => void;
    errors?: Record<string, string>;
}

export const AddressInput = ({ address, onChange, errors = {} }: AddressInputProps) => {
    const { t } = useI18n();
    const countries = [
        "AF", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ",
        "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BA", "BW", "BV", "BR",
        "IO", "BN", "BG", "BF", "BI", "KH", "CM", "CA", "CV", "KY", "CF", "TD", "CL", "CN", "CX",
        "CC", "CO", "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CY", "CZ", "DK", "DJ", "DM",
        "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF",
        "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GN", "GW",
        "GY", "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IL", "IT",
        "JM", "JP", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR",
        "LY", "LI", "LT", "LU", "MO", "MK", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR",
        "MU", "YT", "MX", "FM", "MD", "MC", "MN", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL",
        "AN", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MP", "NO", "OM", "PK", "PW", "PS", "PA",
        "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RE", "RO", "RU", "RW", "SH", "KN",
        "LC", "PM", "VC", "WS", "SM", "ST", "SA", "SN", "CS", "SC", "SL", "SG", "SK", "SI", "SB",
        "SO", "ZA", "GS", "ES", "LK", "SD", "SR", "SJ", "SZ", "SE", "CH", "SY", "TW", "TJ", "TZ",
        "TH", "TL", "TG", "TK", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB",
        "US", "UM", "UY", "UZ", "VU", "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW"
    ].sort();

    return (
        <div className="grid grid-cols-6 gap-2 text-sm mt-2 bg-slate-50 p-3 rounded border border-slate-100">
            <div className="col-span-4">
                <label className="block text-xs text-slate-500">{t('form.street')}</label>
                <input 
                    className={`w-full border p-1 rounded ${errors.street ? 'border-red-500' : ''}`}
                    value={address.street} 
                    onChange={e => onChange({...address, street: e.target.value})} 
                />
                {errors.street && <span className="text-xs text-red-500">{errors.street}</span>}
            </div>
            
            <div className="col-span-2">
                <label className="block text-xs text-slate-500">{t('form.number')}</label>
                <input 
                    className={`w-full border p-1 rounded ${errors.number ? 'border-red-500' : ''}`}
                    value={address.number} 
                    onChange={e => onChange({...address, number: e.target.value})} 
                />
                {errors.number && <span className="text-xs text-red-500">{errors.number}</span>}
            </div>
            
            <div className="col-span-2">
                <label className="block text-xs text-slate-500">{t('form.zip')}</label>
                <input 
                    className={`w-full border p-1 rounded ${errors.zip ? 'border-red-500' : ''}`}
                    value={address.zip} 
                    onChange={e => onChange({...address, zip: e.target.value})} 
                />
                {errors.zip && <span className="text-xs text-red-500">{errors.zip}</span>}
            </div>
            <div className="col-span-3">
                <label className="block text-xs text-slate-500">{t('form.city')}</label>
                <input 
                    className={`w-full border p-1 rounded ${errors.city ? 'border-red-500' : ''}`} 
                    value={address.city} 
                    onChange={e => onChange({...address, city: e.target.value})} 
                />
                {errors.city && <span className="text-xs text-red-500">{errors.city}</span>}
            </div>
            <div className="col-span-1">
                <label className="block text-xs text-slate-500">{t('form.country')}</label>
                <select 
                    className="w-full border p-1 rounded bg-white" 
                    value={address.country}
                    onChange={e => onChange({...address, country: e.target.value})}
                >
                    {countries.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export const Modal = ({ title, onClose, children }: any) => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 flex-shrink-0">
                <h3 className="font-bold truncate pr-4">{title}</h3>
                <button onClick={onClose}><X className="w-5 h-5 text-slate-500 flex-shrink-0 hover:text-slate-800" /></button>
            </div>
            <div className="p-4 overflow-y-auto">
                {children}
            </div>
        </div>
    </div>
);

export const ConfirmModal = ({ title, message, onConfirm, onCancel }: { title?: string, message: string, onConfirm: () => void, onCancel: () => void }) => {
    const { t } = useI18n();
    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center overflow-hidden">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">{title || t('common.confirmation')}</h3>
                <p className="text-slate-600 mb-6">{message}</p>
                <div className="flex justify-center gap-3">
                    <button onClick={onCancel} className="px-4 py-2 border rounded hover:bg-slate-50">{t('common.no')}</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{t('common.yes')}</button>
                </div>
            </div>
        </div>
    );
}

export const AlertModal = ({ title, message, onClose }: { title?: string, message: string, onClose: () => void }) => {
    const { t } = useI18n();
    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center overflow-hidden">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">{title || t('common.warning')}</h3>
                <p className="text-slate-600 mb-6">{message}</p>
                <div className="flex justify-center">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded hover:bg-slate-900">{t('common.ok')}</button>
                </div>
            </div>
        </div>
    );
}

interface MultiSelectProps {
    label: string;
    options: { id: string, name: string }[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}

export const MultiSelect = ({ label, options, selectedIds, onChange }: MultiSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useI18n();
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(x => x !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const displayText = selectedIds.length === 0 
        ? t('common.all') 
        : `${selectedIds.length} ${t('common.selected')}`;

    return (
        <div className="relative" ref={containerRef}>
            <div className="mb-1 text-xs text-slate-500 font-medium">{label}</div>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border rounded p-1.5 text-sm flex justify-between items-center text-left"
            >
                <span className="truncate block">{displayText}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            
            {isOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                    {options.map(option => (
                        <div 
                            key={option.id} 
                            onClick={() => toggleOption(option.id)}
                            className="p-2 hover:bg-slate-50 cursor-pointer flex items-center text-sm"
                        >
                            <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${selectedIds.includes(option.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                {selectedIds.includes(option.id) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="truncate">{option.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (limit: number) => void;
}

export const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange }: PaginationProps) => {
    const { t } = useI18n();
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Ensure current page is valid
    if (currentPage > totalPages && totalPages > 0) {
        onPageChange(totalPages);
    }

    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex flex-col md:flex-row items-center justify-between px-4 py-3 bg-white border-t border-slate-200 text-sm">
            <div className="flex items-center gap-2 mb-2 md:mb-0">
                <span className="text-slate-600">{t('common.per_page')}:</span>
                <select 
                    className="border rounded p-1 bg-slate-50"
                    value={itemsPerPage}
                    onChange={e => onItemsPerPageChange(Number(e.target.value))}
                >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
            </div>
            
            <div className="flex items-center gap-4">
                <span className="text-slate-500">
                    {t('common.showing')} <span className="font-semibold text-slate-800">{startItem}-{endItem}</span> {t('common.of')} <span className="font-semibold text-slate-800">{totalItems}</span>
                </span>
                
                <div className="flex gap-1">
                    <button 
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-1 rounded border hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <span className="flex items-center px-2 font-medium text-slate-700">
                        {currentPage} / {totalPages || 1}
                    </span>

                    <button 
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="p-1 rounded border hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
