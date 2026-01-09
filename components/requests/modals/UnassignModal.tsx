import React from 'react';
import { Modal } from '../../Shared';
import { useI18n } from '../../../lib/i18n';
import { UserMinus } from 'lucide-react';

interface UnassignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const UnassignModal = ({ isOpen, onClose, onConfirm }: UnassignModalProps) => {
    const { t } = useI18n();
    if (!isOpen) return null;

    return (
        <Modal title="Uvolnit požadavek" onClose={onClose}>
            <div className="text-center p-4">
                <UserMinus className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <p className="mb-4 text-slate-700">
                    Opravdu se chcete odhlásit z řešení tohoto požadavku? <br/>
                    Požadavek bude uvolněn a nabídnut ostatním řešitelům.
                </p>
                <div className="flex justify-center gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-slate-50 text-slate-600">
                        {t('common.cancel')}
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700">
                        Uvolnit požadavek
                    </button>
                </div>
            </div>
        </Modal>
    );
};