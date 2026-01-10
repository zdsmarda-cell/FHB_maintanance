
import React, { useState } from 'react';
import { db } from '../../lib/db';
import { useI18n } from '../../lib/i18n';
import { Request, User, Technology } from '../../lib/types';
import { ChevronLeft, CheckCircle2, Clock, Euro, XCircle, MessageSquare, FileCheck, History as HistoryIcon, UserPlus } from 'lucide-react';
import { CancelModal } from './modals/CancelModal';

interface RequestDetailProps {
    request: Request;
    currentUser: User;
    technologies: Technology[];
    onBack: () => void;
    onEdit: () => void;
    onSolve: () => void;
    onAssign: () => void;
    onUnassign: () => void;
    onCancel: (reason: string) => void;
    onApproveChange: (val: boolean) => void;
    onGallery: (images: string[], e: React.MouseEvent) => void;
    renderStatusBadge: (status: string) => React.ReactNode;
    renderPrioBadge: (prio: string) => React.ReactNode;
    refresh: () => void;
}

export const RequestDetail = ({
    request,
    currentUser,
    technologies,
    onBack,
    onEdit,
    onSolve,
    onAssign,
    onUnassign,
    onCancel,
    onApproveChange,
    onGallery,
    renderStatusBadge,
    renderPrioBadge,
    refresh
}: RequestDetailProps) => {
    const { t } = useI18n();
    const [commentText, setCommentText] = useState('');
    const [commentError, setCommentError] = useState('');
    
    // Cancellation Logic
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelError, setCancelError] = useState('');

    // Calculate Approval Rights
    const tech = technologies.find(t => t.id === request.techId);
    const wp = db.workplaces.list().find(w => w.id === tech?.workplaceId);
    const userLimit = currentUser.approvalLimits?.[wp?.locationId || ''];
    const hasLimitSet = userLimit !== undefined && userLimit !== null;
    const hasSufficientLimit = hasLimitSet && (userLimit >= (request.estimatedCost || 0));
    
    // Admin behaves like Maintenance regarding limits now
    const canApproveRole = (currentUser.role === 'admin' || currentUser.role === 'maintenance');
    const canAssignRole = (currentUser.role === 'admin' || currentUser.role === 'maintenance');

    const canSolve = request.isApproved;

    const addComment = () => {
        if(!commentText.trim()) {
            setCommentError(t('validation.required'));
            return;
        }
        setCommentError('');
        db.comments.add({ requestId: request.id, authorId: currentUser.id, content: commentText });
        setCommentText('');
        refresh(); // Refresh parent to reload comments
    };

    const handleCancelConfirm = () => {
        if (!cancelReason.trim()) {
            setCancelError(t('validation.required'));
            return;
        }
        onCancel(cancelReason);
        setCancelModalOpen(false);
        setCancelReason('');
    };

    return (
        <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                <button onClick={onBack} className="flex items-center text-blue-600 hover:underline">
                    <ChevronLeft className="w-4 h-4 mr-1" /> {t('common.back')}
                </button>
                <div className="flex gap-2 items-center">
                    {/* Action Buttons */}
                    {(request.state === 'new' || request.state === 'assigned') && (
                        <>
                             {/* Take Over Button for Maintenance if not already assigned to self */}
                             {canAssignRole && request.solverId !== currentUser.id && (
                                <button 
                                    onClick={onAssign}
                                    className="flex items-center text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                >
                                    <UserPlus className="w-4 h-4 mr-1" /> {request.solverId ? 'Přebrat' : 'Převzít'}
                                </button>
                             )}

                             <button onClick={() => setCancelModalOpen(true)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded hover:bg-red-100 text-sm">
                                 Storno
                             </button>
                             {request.state === 'assigned' && request.solverId === currentUser.id && (
                                <div className="relative group">
                                     <button 
                                        onClick={canSolve ? onSolve : undefined} 
                                        disabled={!canSolve}
                                        className={`flex items-center text-sm px-3 py-1 rounded ${
                                            canSolve 
                                            ? 'bg-green-600 text-white hover:bg-green-700' 
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                     >
                                         <CheckCircle2 className="w-3 h-3 mr-1" /> Vyřešit
                                     </button>
                                     {!canSolve && (
                                         <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                             Požadavek musí být schválen před vyřešením.
                                         </div>
                                     )}
                                </div>
                             )}
                        </>
                    )}
                </div>
            </div>
            
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h2 className="text-2xl font-bold text-slate-800">{request.title}</h2>
                                {renderStatusBadge(request.state)}
                                {renderPrioBadge(request.priority)}
                            </div>
                            <div className="text-slate-500 text-sm flex gap-4">
                                    <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {new Date(request.createdDate).toLocaleString()}</span>
                                    <span className="flex items-center"><Euro className="w-3 h-3 mr-1" /> {request.estimatedCost || 0}</span>
                                    <span className={`flex items-center px-2 py-0.5 rounded text-xs font-medium ${request.isApproved ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {request.isApproved ? <CheckCircle2 className="w-3 h-3 mr-1"/> : <XCircle className="w-3 h-3 mr-1"/>}
                                        {request.isApproved ? 'Schváleno' : 'Čeká na schválení'}
                                    </span>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded border border-slate-100">
                            <h4 className="font-bold text-sm text-slate-700 mb-2">{t('form.description')}</h4>
                            <p className="text-slate-600 whitespace-pre-wrap">{request.description}</p>
                        </div>

                        {request.cancellationReason && (
                            <div className="bg-red-50 p-4 rounded border border-red-100 text-sm text-red-800">
                                <h4 className="font-bold mb-1">Důvod storna:</h4>
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
                                            <p>{c.content}</p>
                                        </div>
                                    )
                                })}
                                {db.comments.list(request.id).length === 0 && <p className="text-slate-400 italic text-sm">Žádné komentáře</p>}
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    className={`flex-1 border rounded p-2 text-sm ${commentError ? 'border-red-500' : ''}`} 
                                    placeholder="Napsat komentář..." 
                                    value={commentText} 
                                    onChange={e => setCommentText(e.target.value)} 
                                />
                                <button onClick={addComment} className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 text-sm">Odeslat</button>
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded border border-slate-100 text-sm space-y-3">
                            <h4 className="font-bold border-b pb-2">Informace</h4>
                            <div>
                                <span className="block text-slate-500 text-xs">Technologie</span>
                                <span className="font-medium">{technologies.find(t => t.id === request.techId)?.name}</span>
                            </div>
                            <div>
                                <span className="block text-slate-500 text-xs">Autor</span>
                                <span className="font-medium">{db.users.list().find(u => u.id === request.authorId)?.name}</span>
                            </div>
                            <div>
                                <span className="block text-slate-500 text-xs">Řešitel</span>
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
                                    <span className="block text-slate-500 text-xs">Termín</span>
                                    <span className="font-medium text-slate-800">{new Date(request.plannedResolutionDate).toLocaleDateString()}</span>
                                </div>
                            )}
                            {request.maintenanceId && (
                                    <div>
                                    <span className="block text-slate-500 text-xs">Zdroj</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs">Automatická údržba</span>
                                </div>
                            )}
                        </div>

                            {/* Approval Box */}
                            {canApproveRole && (
                            <div className="bg-amber-50 p-4 rounded border border-amber-100 text-sm">
                                <h4 className="font-bold text-amber-800 mb-2 flex items-center"><FileCheck className="w-4 h-4 mr-2"/> Schvalování</h4>
                                <p className="text-amber-700 mb-3 text-xs">
                                    Odhadovaná cena: <strong>{request.estimatedCost || 0} EUR</strong>
                                </p>
                                
                                {!hasSufficientLimit && !request.isApproved && (
                                    <div className="mb-3 p-2 bg-red-100 text-red-800 text-xs rounded border border-red-200">
                                        Váš limit: <strong>{hasLimitSet ? userLimit : 0} EUR</strong><br/>
                                        Nemáte dostatečné oprávnění pro schválení této částky.
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onApproveChange(true)} 
                                        disabled={request.isApproved || !hasSufficientLimit}
                                        className={`flex-1 py-1 rounded flex items-center justify-center transition-colors ${request.isApproved || !hasSufficientLimit ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-1"/> Schválit
                                    </button>
                                    <button 
                                        onClick={() => onApproveChange(false)} 
                                        className={`flex-1 py-1 rounded flex items-center justify-center transition-colors ${!request.isApproved || (request.estimatedCost || 0) === 0 || !hasSufficientLimit ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                                        disabled={!request.isApproved || (request.estimatedCost || 0) === 0 || !hasSufficientLimit}
                                    >
                                        <XCircle className="w-4 h-4 mr-1"/> Zamítnout
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* History Log */}
                        <div className="bg-white border rounded p-4 text-sm max-h-60 overflow-y-auto">
                            <h4 className="font-bold mb-3 flex items-center"><HistoryIcon className="w-4 h-4 mr-2"/> Historie změn</h4>
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
                                                <div className="text-slate-400 mt-0.5">{t(`status.${h.oldValue}`)} &rarr; {t(`status.${h.newValue}`)}</div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cancel Modal */}
            <CancelModal 
                isOpen={cancelModalOpen}
                onClose={() => setCancelModalOpen(false)}
                onConfirm={handleCancelConfirm}
                reason={cancelReason}
                setReason={setCancelReason}
                error={cancelError}
            />
        </div>
    );
}
