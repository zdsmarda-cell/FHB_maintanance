
import React, { useState } from 'react';
import { Modal } from '../Shared';
import { useI18n } from '../../lib/i18n';
import { Lock, Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import { db, api, isProductionDomain } from '../../lib/db';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

export const ChangePasswordModal = ({ isOpen, onClose, userId }: ChangePasswordModalProps) => {
    const { t } = useI18n();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        setError(null);
        if (!oldPassword || !newPassword || !confirmPassword) {
            setError(t('msg.fields_required'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError(t('msg.passwords_mismatch'));
            return;
        }
        if (newPassword.length < 4) {
            setError(t('msg.password_short'));
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

            if (isMock) {
                // Mock simulation
                await new Promise(r => setTimeout(r, 800));
                const result = db.auth.changePassword(userId, oldPassword, newPassword);
                if (!result) throw new Error(t('msg.password_change_failed'));
            } else {
                await api.post('/auth/change-password', {
                    userId,
                    oldPassword,
                    newPassword
                });
            }
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }, 1500);
        } catch (e: any) {
            console.error(e);
            setError(e.message || t('msg.password_change_failed'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal title={t('modal.change_password')} onClose={onClose}>
            {success ? (
                <div className="flex flex-col items-center justify-center p-6 text-green-600">
                    <CheckCircle className="w-12 h-12 mb-2" />
                    <p className="font-bold">{t('msg.password_changed')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded text-sm flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.old_password')}</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full border p-2 pl-9 rounded" 
                                value={oldPassword}
                                onChange={e => setOldPassword(e.target.value)}
                            />
                            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.new_password')}</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full border p-2 pl-9 rounded" 
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.confirm_password')}</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full border p-2 pl-9 rounded" 
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                            />
                            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                        <button onClick={onClose} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">
                            {t('common.cancel')}
                        </button>
                        <button 
                            onClick={handleSubmit} 
                            disabled={loading}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center"
                        >
                            {loading && <Loader className="animate-spin w-4 h-4 mr-2" />}
                            {t('action.change_password')}
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};
