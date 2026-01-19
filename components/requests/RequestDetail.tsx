
import React, { useState } from 'react';
import { db } from '../../lib/db';
import { useI18n } from '../../lib/i18n';
import { Request, User, Technology } from '../../lib/types';
import { ChevronLeft, CheckCircle2, Clock, Euro, XCircle, MessageSquare, History as HistoryIcon, Loader, ArrowLeftRight } from 'lucide-react';
import { getLocalized, prepareMultilingual } from '../../lib/helpers';

interface RequestDetailProps {
    request: Request;
    currentUser: User;
    technologies: Technology[];
    onBack: () => void;
    onGallery: (images: string[], e: React.MouseEvent) => void;
    renderStatusBadge: (status: string) => React.ReactNode;
    renderPrioBadge: (prio: string) => React.ReactNode;
    refresh: () => void;
    onStatusChange?: (req: Request) => void;
}

export const RequestDetail = ({
    request,
    currentUser,
    technologies,
    onBack,
    onGallery,
    renderStatusBadge,
    renderPrioBadge,
    refresh,
    onStatusChange
}: RequestDetailProps) => {
    const { t, lang } = useI18n();
    const [commentText, setCommentText] = useState('');
    const [commentError, setCommentError] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    
    // Check permission to change status
    const canChangeStatus = (currentUser.role === 'admin' || currentUser.role === 'maintenance');

    const addComment = async () => {
        if(!commentText.trim()) {
            setCommentError(t('validation.required'));
            return;
        }
        setCommentError('');
        setIsSubmittingComment(true);

        try {
            // Translate comment content based on settings
            const translatedContent = await prepareMultilingual(commentText);

            db.comments.add({ 
                requestId: request.id, 
                authorId: currentUser.id, 
                content: translatedContent 
            });
            
            setCommentText('');
            refresh(); // Refresh parent to reload comments
        } catch (e) {
            console.error("Failed to add comment", e);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    // Helper to translate status/priority values in history
    const getTranslatedValue = (val: string) => {
        if (!val) return '';
        // Try status translation
        const statusKey = `status.${val}`;
        const statusTrans = t(statusKey);
        if (statusTrans !== statusKey) return statusTrans;

        // Try priority translation
        const prioKey = `prio.${val}`;
        const prioTrans = t(prioKey);
        if (prioTrans !== prioKey) return prioTrans;

        return val;
    };

    return (
        <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                <button onClick={onBack} className="flex items-center text-blue-600 hover:underline">
                    <ChevronLeft className="w-4 h-4 mr-1" /> {t('common.back')}
                </button>
            </div>
            
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h2 className="text-2xl font-bold text-slate-800 mr-2">{getLocalized(request.title, lang)}</h2>
                                <div className="flex items-center gap-2">
                                    {renderStatusBadge(request.state)}
                                    {canChangeStatus && onStatusChange && (
                                        <button 
                                            onClick={() => onStatusChange(request)} 
                                            className="flex items-center gap-1 ml-2 px-2 py-1 bg-white border border-slate-200 shadow-sm rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                            title={t('headers.status_change')}
                                        >
                                            <ArrowLeftRight className="w-3 h-3 text-blue-600" />
                                            <span>{t('action.change')}</span>
                                        </button>
                                    )}
                                </div>
                                {renderPrioBadge(request.priority)}
                            </div>
                            <div className="text-slate-500 text-sm flex gap-4 mt-2">
                                    <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {new Date(request.createdDate).toLocaleString()}</span>
                                    <span className="flex items-center"><Euro className="w-3 h-3 mr-1" /> {request.estimatedCost || 0}</span>
                                    <span className={`flex items-center px-2 py-0.5 rounded text-xs font-medium ${request.isApproved ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {request.isApproved ? <CheckCircle2 className="w-3 h-3 mr-1"/> : <XCircle className="w-3 h-3 mr-1"/>}
                                        {request.isApproved ? t('form.is_approved') : t('msg.waiting_for_approval')}
                                    </span>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded border border-slate-100">
                            <h4 className="font-bold text-sm text-slate-700 mb-2">{t('form.description')}</h4>
                            <p className="text-slate-600 whitespace-pre-wrap">{getLocalized(request.description, lang)}</p>
                        </div>

                        {request.cancellationReason && (
                            <div className="bg-red-50 p-4 rounded border border-red-100 text-sm text-red-800">
                                <h4 className="font-bold mb-1">{t('form.cancellation_reason')}:</h4>
                                <p>{request.cancellationReason}</p>
                            </div>
                        )}

                        {request.photoUrls && request.photoUrls.length > 0 && (
                            <div>
                                <h4 className="font-bold text-sm text-slate-700 mb-2">{t('form.photos')}</h4>
                                <div className="flex gap-2 flex-wrap">
                                    {request.photoUrls.map((url: string, i: number) => (
                                        <img 
                                            key={i} 
                                            src={url} 
                                            className="w-24 h-24 object-cover rounded cursor-pointer border hover:opacity-90" 
                                            onClick={(e) => onGallery(request.photoUrls, e)}
                                            alt="Att" 
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Comments Section */}
                        <div className="border-t pt-6">
                            <h4 className="font-bold text-lg mb-4 flex items-center"><MessageSquare className="w-5 h-5 mr-2"/> {t('headers.comments')}</h4>
                            <div className="space-y-4 mb-4">
                                {db.comments.list(request.id).map(c => {
                                    const author = db.users.list().find(u => u.id === c.authorId);
                                    return (
                                        <div key={c.id} className="bg-white border rounded p-3 text-sm">
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                <span className="font-bold text-slate-700">{author?.name}</span>
                                                <span>{new Date(c.date).toLocaleString()}</span>
                                            </div>
                                            <p className="text-slate-800">{getLocalized(c.content, lang)}</p>
                                        </div>
                                    )
                                })}
                                {db.comments.list(request.id).length === 0 && <p className="text-slate-400 italic text-sm">{t('msg.no_comments')}</p>}
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    className={`flex-1 border rounded p-2 text-sm ${commentError ? 'border-red-500' : ''}`} 
                                    placeholder={t('placeholder.write_comment')} 
                                    value={commentText} 
                                    onChange={e => setCommentText(e.target.value)}
                                    disabled={isSubmittingComment}
                                />
                                <button 
                                    onClick={addComment} 
                                    disabled={isSubmittingComment}
                                    className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 text-sm flex items-center min-w-[80px] justify-center"
                                >
                                    {isSubmittingComment ? <Loader className="animate-spin w-4 h-4" /> : t('common.send')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded border border-slate-100 text-sm space-y-3">
                            <h4 className="font-bold border-b pb-2">{t('headers.information')}</h4>
                            <div>
                                <span className="block text-slate-500 text-xs">{t('form.technology')}</span>
                                <span className="font-medium">{getLocalized(technologies.find(t => t.id === request.techId)?.name, lang)}</span>
                            </div>
                            <div>
                                <span className="block text-slate-500 text-xs">{t('label.author')}</span>
                                <span className="font-medium">{db.users.list().find(u => u.id === request.authorId)?.name}</span>
                            </div>
                            <div>
                                <span className="block text-slate-500 text-xs">{t('col.solver')}</span>
                                {request.solverId ? (
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{db.users.list().find(u => u.id === request.solverId)?.name}</span>
                                    </div>
                                ) : (
                                    <span className="font-medium text-slate-400">-</span>
                                )}
                            </div>
                            {request.plannedResolutionDate && (
                                <div>
                                    <span className="block text-slate-500 text-xs">{t('common.date')}</span>
                                    <span className="font-medium text-slate-800">{new Date(request.plannedResolutionDate).toLocaleDateString()}</span>
                                </div>
                            )}
                            {request.maintenanceId && (
                                    <div>
                                    <span className="block text-slate-500 text-xs">{t('label.source')}</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs">{t('label.auto_maintenance')}</span>
                                </div>
                            )}
                        </div>
                        
                        {/* History Log */}
                        <div className="bg-white border rounded p-4 text-sm max-h-60 overflow-y-auto">
                            <h4 className="font-bold mb-3 flex items-center"><HistoryIcon className="w-4 h-4 mr-2"/> {t('headers.change_history')}</h4>
                            <div className="space-y-3">
                                {request.history?.slice().reverse().map((h: any, i: number) => {
                                    const u = db.users.list().find(x => x.id === h.userId);
                                    return (
                                        <div key={i} className="text-xs border-l-2 border-slate-200 pl-2">
                                            <div className="flex justify-between text-slate-400 mb-0.5">
                                                <span>{new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <div className="font-medium text-slate-700">{t(`action.${h.action}`)} {u ? `(${u.name})` : ''}</div>
                                            {h.note && <div className="text-slate-500 italic mt-1">{h.note}</div>}
                                            {h.oldValue && h.newValue && (
                                                <div className="text-slate-400 mt-0.5">{getTranslatedValue(h.oldValue)} &rarr; {getTranslatedValue(h.newValue)}</div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
