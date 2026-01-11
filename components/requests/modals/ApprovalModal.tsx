import React from 'react';
import { Modal } from '../../Shared';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../lib/i18n';

interface ApprovalModalProps {
    request: any;
    technologies: any[];
    hasSufficientLimit: boolean;
    onClose: () => void;
    onApprove: (approve: boolean) => void;
}

export const ApprovalModal = ({ request, technologies, hasSufficientLimit, onClose, onApprove }: ApprovalModalProps) => {
    const { t } = useI18n();
    if (!request) return null;

    const techName = technologies.find(t => t.id === request.techId)?.name;

    return (
        <Modal title={t('headers.change_approval')} onClose={onClose}>
            <div className="text-center p-4">
                {hasSufficientLimit ? (
                    <>
                        <p className="mb-6 text-slate-600">
                            Přejete si změnit stav schválení pro požadavek na technologii <strong>{techName}</strong> s cenou <strong>{request.estimatedCost} €</strong>?
                        </p>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={() => onApprove(true)} 
                                className={`px-4 py-2 rounded text-white flex items-center ${request.isApproved ? 'bg-emerald-600 opacity-50 cursor-default' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                disabled={request.isApproved}
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" /> {t('common.approve')}
                            </button>
                            <button 
                                onClick={() => onApprove(false)} 
                                className={`px-4 py-2 rounded text-white flex items-center ${!request.isApproved ? 'bg-red-600 opacity-50 cursor-default' : 'bg-red-600 hover:bg-red-700'}`}
                                disabled={!request.isApproved}
                            >
                                <XCircle className="w-4 h-4 mr-2" /> {request.isApproved ? 'Odebrat souhlas' : t('common.reject')}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center">
                        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
                        <p className="mb-6 text-slate-700 font-medium">
                            {t('msg.approval_limit_exceeded')}
                        </p>
                        <div className="text-sm text-slate-500 mb-6 bg-slate-50 p-2 rounded">
                            Cena požadavku: <strong>{request.estimatedCost} €</strong>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="px-6 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                        >
                            {t('common.back')}
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};