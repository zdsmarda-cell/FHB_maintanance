
import React from 'react';
import { Modal } from '../../Shared';
import { useI18n } from '../../../lib/i18n';

interface CancelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    reason: string;
    setReason: (r: string) => void;
    error: string;
}

export const CancelModal = ({ isOpen, onClose, onConfirm, reason, setReason, error }: CancelModalProps) => {
    const { t } = useI18n();
    if (!isOpen) return null;

    return (
        <Modal title={t('modal.cancel_request_title')} onClose={onClose}>
            <p className="text-sm text-slate-600 mb-2">{t('modal.cancel_request_prompt')}</p>
            <textarea 
                className={`w-full border p-2 rounded ${error ? 'border-red-500' : ''}`}
                rows={3} 
                value={reason} 
                onChange={e => setReason(e.target.value)} 
            />
            {error && <span className="text-xs text-red-500">{error}</span>}
            <div className="flex justify-end gap-2 mt-4">
                <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">{t('common.cancel')}</button>
                <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">{t('action.confirm_cancel')}</button>
            </div>
        </Modal>
    );
};
