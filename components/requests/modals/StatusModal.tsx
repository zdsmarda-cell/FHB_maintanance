import React, { useState } from 'react';
import { Modal } from '../../Shared';
import { useI18n } from '../../../lib/i18n';
import { AlertTriangle } from 'lucide-react';

interface StatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (newStatus: string) => void;
    currentStatus: string;
}

export const StatusModal = ({ isOpen, onClose, onConfirm, currentStatus }: StatusModalProps) => {
    const { t } = useI18n();
    const [selectedStatus, setSelectedStatus] = useState(currentStatus);

    if (!isOpen) return null;

    const statusOptions = ['new', 'assigned', 'solved', 'cancelled'];

    return (
        <Modal title={t('headers.status_change')} onClose={onClose}>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('common.status')}</label>
                    <select 
                        className="w-full border p-2 rounded bg-white"
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                    >
                        {statusOptions.map(s => (
                            <option key={s} value={s}>{t(`status.${s}`)}</option>
                        ))}
                    </select>
                </div>

                {/* Warning when switching to New */}
                {selectedStatus === 'new' && currentStatus !== 'new' && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800 flex items-start">
                        <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span>{t('msg.status_new_warning')}</span>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100">
                    <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">
                        {t('common.cancel')}
                    </button>
                    <button 
                        onClick={() => onConfirm(selectedStatus)} 
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        {t('action.change')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};