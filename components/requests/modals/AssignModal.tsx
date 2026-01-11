
import React, { useEffect } from 'react';
import { Modal } from '../../Shared';
import { useI18n } from '../../../lib/i18n';
import { User } from '../../../lib/types';
import { UserMinus } from 'lucide-react';

interface AssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onRemove?: () => void; // New prop for unassigning
    assignDate: string;
    setAssignDate: (d: string) => void;
    assignSolverId: string;
    setAssignSolverId: (id: string) => void;
    candidates: User[];
    currentUser: User;
    isAlreadyAssigned?: boolean;
}

export const AssignModal = ({ 
    isOpen, 
    onClose, 
    onConfirm,
    onRemove, 
    assignDate, 
    setAssignDate, 
    assignSolverId, 
    setAssignSolverId,
    candidates,
    currentUser,
    isAlreadyAssigned
}: AssignModalProps) => {
    const { t } = useI18n();
    
    // Admin check
    const isAdmin = currentUser.role === 'admin';

    // Auto-set solver to current user if not admin and not already assigned
    useEffect(() => {
        if (isOpen && !isAdmin && !assignSolverId) {
            setAssignSolverId(currentUser.id);
        }
    }, [isOpen, isAdmin, currentUser.id, setAssignSolverId, assignSolverId]);

    if (!isOpen) return null;

    // Validation: Date is now mandatory
    const isValid = assignSolverId && assignDate;

    return (
        <Modal title={isAlreadyAssigned ? t('modal.assign_title_edit') : t('modal.assign_title_new')} onClose={onClose}>
            <div className="space-y-4">
                <div>
                    <p className="text-sm text-slate-600 mb-1">{t('form.assign_solver')}:</p>
                    {isAdmin ? (
                        <select 
                            className="w-full border p-2 rounded" 
                            value={assignSolverId} 
                            onChange={e => setAssignSolverId(e.target.value)}
                        >
                            <option value="">{t('option.choose')}</option>
                            {candidates.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({t(`role.${u.role}`)})</option>
                                ))
                            }
                        </select>
                    ) : (
                        <div className="w-full border p-2 rounded bg-slate-100 text-slate-600">
                            {currentUser.name} {t('label.self_assign')}
                        </div>
                    )}
                    {!isAdmin && <p className="text-xs text-slate-400 mt-1">{t('msg.maintenance_self_assign_only')}</p>}
                </div>
                <div>
                    <p className="text-sm text-slate-600 mb-1">{t('form.resolution_date_required')}:</p>
                    <input 
                        type="date" 
                        className={`w-full border p-2 rounded ${!assignDate ? 'border-amber-300' : ''}`}
                        value={assignDate} 
                        onChange={e => setAssignDate(e.target.value)} 
                        required
                    />
                </div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 mt-4 mb-4">
                {t('msg.req_will_be_in_progress')}
            </div>

            <div className="flex justify-between gap-2 mt-6">
                <div>
                    {isAlreadyAssigned && onRemove && (
                        <button 
                            onClick={onRemove}
                            className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 flex items-center text-sm"
                        >
                            <UserMinus className="w-4 h-4 mr-1" /> {t('action.remove_solver')}
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">{t('common.cancel')}</button>
                    <button 
                        onClick={onConfirm} 
                        disabled={!isValid} 
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAlreadyAssigned ? t('action.save_changes') : t('action.assign')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
