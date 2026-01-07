
import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { User, Request } from '../lib/types';
import { AlertCircle, Clock, MessageSquare, Filter, Upload, Trash2, Edit, ArrowLeft } from 'lucide-react';
import { Modal } from '../components/Shared';

export const RequestsPage = ({ user, initialFilters }: { user: User, initialFilters?: any }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'requests' | 'history'>('requests');
  
  const [requests, setRequests] = useState(db.requests.list().sort((a,b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()));
  const [selectedReq, setSelectedReq] = useState<Request | null>(null);
  const [commentText, setCommentText] = useState('');
  
  const [showFilters, setShowFilters] = useState(!!initialFilters && Object.keys(initialFilters).length > 0);
  const [filters, setFilters] = useState({
      authorId: initialFilters?.authorId || '',
      solverId: initialFilters?.solverId || '',
      techId: initialFilters?.techId || '',
      status: initialFilters?.status || '',
      locationId: initialFilters?.locationId || '', 
      dateFrom: initialFilters?.dateFrom || '',
      dateTo: initialFilters?.dateTo || ''
  });

  useEffect(() => {
      if(initialFilters) {
          setFilters(prev => ({...prev, ...initialFilters}));
          setShowFilters(true);
      }
  }, [initialFilters]);

  // Request Form State
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);
  const [reqFormData, setReqFormData] = useState({ id: '', description: '', priority: 'basic', photoUrls: [] as string[] });
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  
  // Selection states
  const [selectedLocId, setSelectedLocId] = useState('');
  const [selectedWpId, setSelectedWpId] = useState('');
  const [selectedTechId, setSelectedTechId] = useState('');

  // Form Errors/Modals
  const [reqErrors, setReqErrors] = useState<Record<string, string>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignDate, setAssignDate] = useState('');

  // Helpers
  const getAvailableLocations = () => {
      const all = db.locations.list().filter(l => l.isVisible);
      if (user.role === 'admin') return all;
      return all.filter(l => user.assignedLocationIds.includes(l.id));
  };

  const getAvailableWorkplaces = () => {
      if (!selectedLocId) return [];
      const all = db.workplaces.list().filter(w => w.locationId === selectedLocId && w.isVisible);
      if (user.role === 'admin') return all;
      return all.filter(w => user.assignedWorkplaceIds.includes(w.id));
  };

  const getAvailableTechs = () => {
      if (!selectedWpId) return [];
      const all = db.technologies.list().filter(t => t.workplaceId === selectedWpId && t.isVisible);
      return all;
  };

  const filteredRequests = requests.filter(req => {
      if (user.role === 'operator') {
          if (req.authorId !== user.id) return false;
      }

      if (filters.locationId) {
          const tech = db.technologies.list().find(t => t.id === req.techId);
          const wp = db.workplaces.list().find(w => w.id === tech?.workplaceId);
          if (wp?.locationId !== filters.locationId) return false;
      }

      const matchAuthor = filters.authorId ? req.authorId === filters.authorId : true;
      const matchSolver = filters.solverId ? req.solverId === filters.solverId : true;
      const matchTech = filters.techId ? req.techId === filters.techId : true;
      const matchStatus = filters.status ? req.state === filters.status : true;
      
      let matchDate = true;
      if (req.plannedResolutionDate) {
          if (filters.dateFrom && req.plannedResolutionDate < filters.dateFrom) matchDate = false;
          if (filters.dateTo && req.plannedResolutionDate > filters.dateTo) matchDate = false;
      } else if (filters.dateFrom || filters.dateTo) {
          matchDate = false; 
      }

      return matchAuthor && matchSolver && matchTech && matchStatus && matchDate;
  });

  // Auto-selection logic
  useEffect(() => {
      if (isReqModalOpen && !editingReqId) {
          const locs = getAvailableLocations();
          if (locs.length === 1 && !selectedLocId) {
              setSelectedLocId(locs[0].id);
          }
      }
  }, [isReqModalOpen, user, editingReqId]);

  useEffect(() => {
      if (selectedLocId) {
          const wps = getAvailableWorkplaces();
          if (wps.length === 1 && !selectedWpId) {
              setSelectedWpId(wps[0].id);
          }
      }
  }, [selectedLocId]);

  const refresh = () => {
    setRequests(db.requests.list().sort((a,b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()));
    if (selectedReq) setSelectedReq(db.requests.list().find(r => r.id === selectedReq.id) || null);
  };

  const handleSaveRequest = () => {
    if (!reqFormData.description.trim()) {
        setReqErrors({ description: t('validation.required') });
        return;
    }
    setReqErrors({});

    if (editingReqId) {
        db.requests.updateState(editingReqId, 'new', undefined, undefined, {
            description: reqFormData.description,
            priority: reqFormData.priority as any,
            photoUrls: reqFormData.photoUrls
        });
    } else {
        if (!selectedTechId) return;
        db.requests.add({
            techId: selectedTechId,
            authorId: user.id,
            createdDate: new Date().toISOString(),
            description: reqFormData.description,
            priority: reqFormData.priority as any,
            photoUrls: reqFormData.photoUrls
        });
    }
    
    setIsReqModalOpen(false);
    setReqFormData({ id: '', description: '', priority: 'basic', photoUrls: [] });
    setEditingReqId(null);
    setSelectedLocId('');
    setSelectedWpId('');
    setSelectedTechId('');
    refresh();
  };

  const openCreateModal = () => {
      setReqFormData({ id: '', description: '', priority: 'basic', photoUrls: [] });
      setEditingReqId(null);
      setSelectedLocId('');
      setSelectedWpId('');
      setSelectedTechId('');
      setReqErrors({});
      setIsReqModalOpen(true);
  }

  const openEditModal = (req: Request) => {
      setReqFormData({
          id: req.id,
          description: req.description,
          priority: req.priority,
          photoUrls: req.photoUrls || []
      });
      setEditingReqId(req.id);
      setReqErrors({});
      setIsReqModalOpen(true);
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              setReqFormData(prev => ({ ...prev, photoUrls: [...prev.photoUrls, reader.result as string] }));
          };
          reader.readAsDataURL(file);
      }
  };

  const removePhoto = (index: number) => {
      setReqFormData(prev => ({ ...prev, photoUrls: prev.photoUrls.filter((_, i) => i !== index) }));
  }

  const changeStatus = (status: Request['state'], reason?: string, extraUpdates?: Partial<Request>) => {
      if(!selectedReq) return;
      db.requests.updateState(selectedReq.id, status, reason, user.id, extraUpdates); 
      refresh();
  };

  const confirmCancel = () => {
      if (!cancelReason.trim()) {
          setCancelError(t('validation.required'));
          return;
      }
      changeStatus('cancelled', cancelReason);
      setShowCancelModal(false);
  }

  const confirmAssign = () => {
      changeStatus('assigned', undefined, assignDate ? { plannedResolutionDate: assignDate } : undefined);
      setShowAssignModal(false);
  }

  const addComment = () => {
      if(!selectedReq || !commentText) return;
      db.comments.add({ requestId: selectedReq.id, authorId: user.id, content: commentText });
      setCommentText('');
      refresh();
  };

  const resetFilters = () => {
      setFilters({ authorId: '', solverId: '', techId: '', status: '', dateFrom: '', dateTo: '', locationId: '' });
  }

  const renderStatusBadge = (status: string) => {
      const styles: any = {
          'new': 'bg-blue-100 text-blue-800',
          'assigned': 'bg-amber-100 text-amber-800',
          'solved': 'bg-green-100 text-green-800',
          'cancelled': 'bg-slate-100 text-slate-600'
      };
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>{t(`status.${status}`)}</span>;
  };

  const canCancel = selectedReq && selectedReq.state !== 'cancelled' && (
      user.role !== 'operator' || selectedReq.state === 'new'
  );

  const canEdit = selectedReq && selectedReq.authorId === user.id && selectedReq.state === 'new';

  return (
    <div className="space-y-6">
        <div className="flex space-x-4 border-b border-slate-200 pb-2 overflow-x-auto">
            <button onClick={() => { setTab('requests'); setSelectedReq(null); }} className={`pb-2 px-2 font-medium whitespace-nowrap ${tab === 'requests' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>
                {user.role === 'operator' ? t('dashboard.my_unresolved') : t('menu.requests')}
            </button>
            
            {user.role === 'operator' && (
                <button onClick={() => { setTab('history'); setSelectedReq(null); }} className={`pb-2 px-2 font-medium whitespace-nowrap ${tab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>
                    {t('headers.my_history')}
                </button>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List View */}
            <div className={`lg:col-span-1 space-y-4 ${selectedReq ? 'hidden lg:block' : 'block'}`}>
                    <div className="flex gap-2">
                        <button onClick={openCreateModal} className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
                            + {t('headers.new_request')}
                        </button>
                        <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 rounded border ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}>
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                    
                    {showFilters && (
                        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm text-sm space-y-3">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-slate-700">{t('common.filter')}</span>
                                <button onClick={resetFilters} className="text-xs text-blue-600 hover:underline">Reset</button>
                            </div>

                            <select className="w-full p-2 border rounded" value={filters.locationId} onChange={e => setFilters({...filters, locationId: e.target.value})}>
                                <option value="">Lokalita: Vše</option>
                                {db.locations.list().map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                            
                            {user.role !== 'operator' && (
                            <>
                                <select className="w-full p-2 border rounded" value={filters.authorId} onChange={e => setFilters({...filters, authorId: e.target.value})}>
                                    <option value="">Zadavatel: Vše</option>
                                    {db.users.list().map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                                
                                <select className="w-full p-2 border rounded" value={filters.solverId} onChange={e => setFilters({...filters, solverId: e.target.value})}>
                                    <option value="">Řešitel: Vše</option>
                                    {db.users.list().map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </>
                            )}

                            <select className="w-full p-2 border rounded" value={filters.techId} onChange={e => setFilters({...filters, techId: e.target.value})}>
                                <option value="">Technologie: Vše</option>
                                {db.technologies.list().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>

                            <select className="w-full p-2 border rounded" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                                <option value="">Stav: Vše</option>
                                {['new', 'assigned', 'solved', 'cancelled'].map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                            </select>
                            
                            {user.role !== 'operator' && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-slate-400">Plán. datum od</label>
                                    <input type="date" className="w-full p-1 border rounded" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">Plán. datum do</label>
                                    <input type="date" className="w-full p-1 border rounded" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} />
                                </div>
                            </div>
                            )}
                        </div>
                    )}

                    {/* Request Modal (Create/Edit) */}
                    {isReqModalOpen && (
                        <Modal title={editingReqId ? t('common.edit') : t('headers.new_request')} onClose={() => setIsReqModalOpen(false)}>
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                                {!editingReqId && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.location')}</label>
                                            <select 
                                                className="w-full p-2 rounded border" 
                                                value={selectedLocId} 
                                                onChange={e => { setSelectedLocId(e.target.value); setSelectedWpId(''); setSelectedTechId(''); }}
                                            >
                                                <option value="">-- Vyberte lokalitu --</option>
                                                {getAvailableLocations().map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            </select>
                                        </div>
                                        {selectedLocId && (
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.workplace')}</label>
                                                <select 
                                                    className="w-full p-2 rounded border" 
                                                    value={selectedWpId} 
                                                    onChange={e => { setSelectedWpId(e.target.value); setSelectedTechId(''); }}
                                                >
                                                    <option value="">-- Vyberte pracoviště --</option>
                                                    {getAvailableWorkplaces().map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        {selectedWpId && (
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Technologie</label>
                                                <select 
                                                    className="w-full p-2 rounded border" 
                                                    value={selectedTechId} 
                                                    onChange={e => setSelectedTechId(e.target.value)}
                                                >
                                                    <option value="">-- Vyberte technologii --</option>
                                                    {getAvailableTechs().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}

                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Priorita</label>
                                    <select className="w-full p-2 rounded border" value={reqFormData.priority} onChange={e => setReqFormData({...reqFormData, priority: e.target.value})}>
                                        <option value="basic">{t('prio.basic')}</option>
                                        <option value="priority">{t('prio.priority')}</option>
                                        <option value="urgent">{t('prio.urgent')}</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.description')} *</label>
                                    <textarea 
                                    className={`w-full p-2 rounded border ${reqErrors.description ? 'border-red-500' : ''}`}
                                    placeholder={t('form.description')} 
                                    value={reqFormData.description} 
                                    onChange={e => setReqFormData({...reqFormData, description: e.target.value})}
                                    ></textarea>
                                    {reqErrors.description && <span className="text-xs text-red-500">{reqErrors.description}</span>}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('form.photos')}</label>
                                    <div className="grid grid-cols-4 gap-2 mb-2">
                                        {reqFormData.photoUrls.map((url, i) => (
                                            <div key={i} className="relative aspect-square bg-slate-100 border rounded overflow-hidden group">
                                                <img src={url} className="w-full h-full object-cover" alt="prev"/>
                                                <button onClick={() => removePhoto(i)} className="absolute top-0 right-0 p-1 bg-white/80 text-red-500 opacity-0 group-hover:opacity-100">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        <label className="flex items-center justify-center border-2 border-dashed rounded aspect-square cursor-pointer hover:bg-slate-50">
                                            <Upload className="w-5 h-5 text-slate-400" />
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                        </label>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-slate-100">
                                <button onClick={() => setIsReqModalOpen(false)} className="mr-2 text-slate-500 hover:bg-slate-100 px-3 py-2 rounded">{t('common.cancel')}</button>
                                <button 
                                    onClick={handleSaveRequest} 
                                    disabled={!editingReqId && !selectedTechId}
                                    className={`text-white px-4 py-2 rounded ${(!editingReqId && !selectedTechId) ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                >
                                    {t('common.save')}
                                </button>
                                </div>
                            </div>
                        </Modal>
                    )}

                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {filteredRequests.length === 0 ? <div className="text-center p-4 text-slate-400 text-sm">{user.role === 'operator' ? t('msg.no_my_requests') : 'Žádné požadavky'}</div> :
                        filteredRequests.map(req => {
                            const tech = db.technologies.list().find(t => t.id === req.techId);
                            return (
                                <div key={req.id} onClick={() => setSelectedReq(req)} 
                                    className={`p-4 rounded border cursor-pointer hover:bg-slate-50 ${selectedReq?.id === req.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold text-slate-800">{tech?.name || 'Unknown Asset'}</h4>
                                        {renderStatusBadge(req.state)}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{new Date(req.createdDate).toLocaleDateString()}</p>
                                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">{req.description}</p>
                                </div>
                            );
                        })}
                    </div>
            </div>

            {/* Detail View */}
            <div className={`lg:col-span-2 ${selectedReq ? 'block' : 'hidden lg:block'}`}>
                {selectedReq ? (
                    <div className="bg-white rounded border border-slate-200 h-full flex flex-col">
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex justify-between items-start mb-2 lg:mb-0">
                                <div>
                                    <button onClick={() => setSelectedReq(null)} className="lg:hidden mb-2 flex items-center text-slate-500 hover:text-blue-600">
                                        <ArrowLeft className="w-4 h-4 mr-1" /> {t('common.back')}
                                    </button>
                                    <h2 className="text-xl font-bold">{t('headers.request_detail')}</h2>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        {renderStatusBadge(selectedReq.state)}
                                        <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${selectedReq.priority === 'urgent' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{t(`prio.${selectedReq.priority}`)}</span>
                                        {selectedReq.plannedResolutionDate && (
                                            <span className="text-xs text-blue-600 flex items-center gap-1"><Clock className="w-3 h-3"/> {selectedReq.plannedResolutionDate}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-2">
                                    {canEdit && (
                                        <button onClick={() => openEditModal(selectedReq)} className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded text-sm flex items-center justify-center">
                                            <Edit className="w-3 h-3 mr-1" /> {t('common.edit')}
                                        </button>
                                    )}
                                    {(user.role !== 'operator' && selectedReq.state === 'new') && (
                                        <button onClick={() => { setAssignDate(''); setShowAssignModal(true); }} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Převzít k řešení</button>
                                    )}
                                    {(user.role !== 'operator' && selectedReq.state === 'assigned') && (
                                        <>
                                            <button onClick={() => changeStatus('solved')} className="px-3 py-1 bg-green-600 text-white rounded text-sm">{t('status.solved')}</button>
                                            <button onClick={() => changeStatus('new')} className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm">Uvolnit</button>
                                        </>
                                    )}
                                    {canCancel && (
                                        <button onClick={() => { setCancelReason(''); setCancelError(''); setShowCancelModal(true); }} className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-sm">Storno</button>
                                    )}
                                </div>
                            </div>
                            <div className="mt-6 bg-slate-50 p-4 rounded text-sm text-slate-700">
                                {selectedReq.description}
                            </div>

                            {selectedReq.photoUrls && selectedReq.photoUrls.length > 0 && (
                                    <div className="mt-4">
                                        <h5 className="text-xs font-bold text-slate-500 mb-2">{t('form.photos')}</h5>
                                        <div className="flex gap-2 flex-wrap">
                                            {selectedReq.photoUrls.map((url, i) => (
                                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                                    <img src={url} alt="request attachment" className="h-20 w-20 object-cover rounded border hover:opacity-80" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                            )}

                            <div className="mt-4 text-xs text-slate-400">
                                Author ID: {selectedReq.authorId} | Created: {new Date(selectedReq.createdDate).toLocaleString()}
                            </div>
                            {selectedReq.cancellationReason && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded text-sm text-red-800">
                                    <strong>{t('form.cancellation_reason')}:</strong> {selectedReq.cancellationReason}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
                            <h3 className="font-semibold mb-4">{t('headers.comments')} & {t('headers.history')}</h3>
                            <div className="space-y-4">
                                {db.comments.list(selectedReq.id).map(c => {
                                    const author = db.users.list().find(u => u.id === c.authorId);
                                    return (
                                        <div key={c.id} className="bg-white p-3 rounded shadow-sm border border-slate-100">
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                <span className="font-bold text-slate-700">{author?.name || 'Unknown'}</span>
                                                <span>{new Date(c.date).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm">{c.content}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="p-4 bg-white border-t border-slate-200">
                            <div className="flex gap-2">
                                <input className="flex-1 border rounded p-2" placeholder="Napsat komentář..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                                <button onClick={addComment} className="bg-blue-600 text-white px-4 rounded"><MessageSquare className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 border border-slate-200 rounded">
                        Vyberte požadavek ze seznamu
                    </div>
                )}
            </div>
        </div>

        {/* Cancellation Modal */}
        {showCancelModal && (
            <Modal title={t('headers.cancel_request')} onClose={() => setShowCancelModal(false)}>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('form.cancellation_reason')} *</label>
                    <textarea 
                        className={`w-full border p-2 rounded h-24 ${cancelError ? 'border-red-500' : 'border-slate-300'}`}
                        placeholder={t('form.cancellation_reason')}
                        value={cancelReason}
                        onChange={e => { setCancelReason(e.target.value); setCancelError(''); }}
                    ></textarea>
                    {cancelError && <p className="text-xs text-red-500 mt-1">{cancelError}</p>}
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                        <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100">{t('common.cancel')}</button>
                        <button onClick={confirmCancel} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700">{t('common.confirm')}</button>
                    </div>
                </div>
            </Modal>
        )}

        {/* Assign Modal */}
        {showAssignModal && (
            <Modal title={t('headers.assign_request')} onClose={() => setShowAssignModal(false)}>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{t('form.planned_resolution_date')}</label>
                    <input 
                        type="date"
                        className="w-full border p-2 rounded border-slate-300"
                        value={assignDate}
                        onChange={e => setAssignDate(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                        <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100">{t('common.cancel')}</button>
                        <button onClick={confirmAssign} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">{t('common.confirm')}</button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};
