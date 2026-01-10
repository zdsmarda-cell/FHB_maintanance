
import React, { useEffect, useState } from 'react';
import { db, api, isProductionDomain } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { calculateNextMaintenanceDate } from '../lib/helpers';
import { AlertCircle, CheckCircle, Clock, List, Calendar, Wrench, Inbox, FileCheck, Loader, ArrowRight, AlertTriangle, Euro, UserPlus, Eye } from 'lucide-react';
import { User, Maintenance, Request, Technology, Supplier } from '../lib/types';
import { Modal } from '../components/Shared';
import { RequestDetail } from '../components/requests/RequestDetail';
import { AssignModal } from '../components/requests/modals/AssignModal';

interface DashboardProps {
    user: User;
    onNavigate: (page: string, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [requests, setRequests] = useState<Request[]>([]);
  const [techs, setTechs] = useState<Technology[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Modal States
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<Maintenance | null>(null);

  // Assign Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetReq, setAssignTargetReq] = useState<Request | null>(null);
  const [assignSolverId, setAssignSolverId] = useState('');
  const [assignDate, setAssignDate] = useState('');

  const loadData = async () => {
      setLoading(true);
      try {
          const token = localStorage.getItem('auth_token');
          const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

          if (isMock) {
              setRequests(db.requests.list());
              setTechs(db.technologies.list());
              setMaintenance(db.maintenances.list());
              setUsers(db.users.list());
              setSuppliers(db.suppliers.list());
          } else {
              const [reqRes, techRes, maintRes, userRes, supRes] = await Promise.all([
                  api.get('/requests'),
                  api.get('/technologies'),
                  api.get('/maintenance'),
                  api.get('/users'),
                  api.get('/suppliers')
              ]);
              setRequests(reqRes);
              setTechs(techRes);
              setMaintenance(maintRes);
              setUsers(userRes);
              setSuppliers(supRes);
          }
      } catch (e) {
          console.error("Dashboard Load Error", e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      loadData();
  }, [user]);

  // --- Actions ---
  const openAssignModal = (req: Request) => { 
      setAssignTargetReq(req); 
      // If already assigned, prefill solver and date
      if (req.solverId) {
           setAssignSolverId(req.solverId);
      } else {
           // Default to current user if they are admin/maintenance
           setAssignSolverId(user.role === 'maintenance' || user.role === 'admin' ? user.id : ''); 
      }
      setAssignDate(req.plannedResolutionDate || new Date().toISOString().split('T')[0]); 
      setAssignModalOpen(true); 
  };

  const handleAssignConfirm = async () => {
      if (assignTargetReq && assignSolverId && assignDate) {
          const updates: any = { solverId: assignSolverId, plannedResolutionDate: assignDate };
          const newState = assignTargetReq.state === 'new' ? 'assigned' : assignTargetReq.state;
          
          setLoading(true);
          try {
              const token = localStorage.getItem('auth_token');
              const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));
              
              if (isMock) {
                  db.requests.updateState(assignTargetReq.id, newState, 'Přiřazeno z přehledu', user.id, updates);
              } else {
                  await api.put(`/requests/${assignTargetReq.id}`, {
                      state: newState,
                      ...updates
                  });
              }
              setAssignModalOpen(false); 
              setAssignTargetReq(null); 
              loadData();
          } catch(e) { console.error(e); setLoading(false); }
      }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader className="animate-spin w-8 h-8 text-blue-600"/></div>;

  // --- Calculations ---
  const activeMaintenance = maintenance.filter(m => m.isActive).length;
  const totalAssets = techs.length;
  const myUnresolved = requests.filter(r => r.authorId === user.id && r.state !== 'solved' && r.state !== 'cancelled').length;

  const newRequestsCount = requests.filter(r => r.state === 'new').length;
  const assignedToMeCount = requests.filter(r => r.solverId === user.id && r.state !== 'solved' && r.state !== 'cancelled').length;
  
  const toApproveCount = requests.filter(r => {
      if (r.isApproved || r.state === 'solved' || r.state === 'cancelled') return false;
      if (user.role === 'admin') return true;
      return (r.estimatedCost || 0) > 0; 
  }).length;

  // Urgent Requests (New or Assigned)
  const urgentRequests = requests.filter(r => 
      r.priority === 'urgent' && 
      (r.state === 'new' || r.state === 'assigned')
  ).sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());

  // Maintenance List Logic using Shared Helper
  const upcomingMaintenance = maintenance
    .filter(m => m.isActive)
    .map(m => ({ ...m, nextDateObj: calculateNextMaintenanceDate(m) }))
    .filter(m => m.nextDateObj !== null) // Filter out nulls if any
    .sort((a, b) => {
        if (!a.nextDateObj || !b.nextDateObj) return 0;
        return a.nextDateObj.getTime() - b.nextDateObj.getTime();
    })
    .slice(0, 10);

  const renderStatusBadge = (status: string) => {
        const styles: any = {
            'new': 'bg-blue-100 text-blue-800',
            'assigned': 'bg-amber-100 text-amber-800',
            'solved': 'bg-green-100 text-green-800',
            'cancelled': 'bg-red-100 text-red-800'
        };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-bold border border-transparent ${styles[status]}`}>{t(`status.${status}`) || status}</span>;
    };

  const formatTime = (minutes: number | undefined) => {
        if (!minutes) return '-';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
  }

  const Card = ({ title, value, icon: Icon, color, onClick }: any) => (
    <div onClick={onClick} className={`bg-white p-6 rounded-lg shadow-sm border border-slate-200 transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold mt-2 text-slate-800">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-slate-800">{t('menu.dashboard')}</h2>
      
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {user.role === 'operator' ? (
             <Card title={t('dashboard.my_unresolved')} value={myUnresolved} icon={List} color="bg-amber-500" onClick={() => onNavigate('requests')} />
        ) : (
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 col-span-1 md:col-span-2">
                <div className="flex items-center mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <List className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">{t('dashboard.requests_overview')}</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div onClick={() => onNavigate('requests', { status: 'new' })} className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded border border-slate-100 hover:bg-blue-50 cursor-pointer">
                        <Inbox className="w-6 h-6 text-blue-500 mb-1" />
                        <span className="text-2xl font-bold text-slate-800">{newRequestsCount}</span>
                        <span className="text-xs text-slate-500 uppercase font-medium">{t('dashboard.new_requests')}</span>
                    </div>
                    <div onClick={() => onNavigate('requests', { solverId: user.id })} className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded border border-slate-100 hover:bg-amber-50 cursor-pointer">
                        <Wrench className="w-6 h-6 text-amber-500 mb-1" />
                        <span className="text-2xl font-bold text-slate-800">{assignedToMeCount}</span>
                        <span className="text-xs text-slate-500 uppercase font-medium">{t('dashboard.to_solve')}</span>
                    </div>
                    <div onClick={() => onNavigate('requests', { mode: 'approval' })} className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded border border-slate-100 hover:bg-emerald-50 cursor-pointer">
                        <FileCheck className="w-6 h-6 text-emerald-500 mb-1" />
                        <span className="text-2xl font-bold text-slate-800">{toApproveCount}</span>
                        <span className="text-xs text-slate-500 uppercase font-medium">{t('dashboard.to_approve')}</span>
                    </div>
                </div>
            </div>
        )}
        <Card title={t('dashboard.active_maintenance')} value={activeMaintenance} icon={Clock} color="bg-blue-500" onClick={() => onNavigate('maintenance')} />
        <Card title={t('dashboard.total_assets')} value={totalAssets} icon={CheckCircle} color="bg-emerald-500" onClick={() => onNavigate('assets')} />
      </div>

      {/* Urgent Requests Section */}
      {urgentRequests.length > 0 && (
          <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 overflow-hidden">
              <div className="p-4 border-b border-red-200 bg-red-100/50 flex items-center justify-between">
                  <div className="flex items-center font-bold text-red-800">
                      <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                      Urgentní požadavky ({urgentRequests.length})
                  </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="text-xs text-red-700 uppercase bg-red-50 border-b border-red-200">
                          <tr>
                              <th className="px-4 py-3">{t('form.title')}</th>
                              <th className="px-4 py-3">Technologie</th>
                              <th className="px-4 py-3 whitespace-nowrap">Vytvořeno</th>
                              <th className="px-4 py-3 whitespace-nowrap">Termín</th>
                              <th className="px-4 py-3">Řešitel</th>
                              <th className="px-4 py-3">Dodavatel</th>
                              <th className="px-4 py-3 text-center">Cena</th>
                              <th className="px-4 py-3 text-center">Pracnost</th>
                              <th className="px-4 py-3 text-center">Stav</th>
                              <th className="px-4 py-3 text-center">Schválení</th>
                              <th className="px-4 py-3 text-right">Akce</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                          {urgentRequests.map(r => {
                              const tech = techs.find(t => t.id === r.techId);
                              const solver = users.find(u => u.id === r.solverId);
                              const supplier = r.assignedSupplierId && r.assignedSupplierId !== 'internal' 
                                  ? suppliers.find(s => s.id === r.assignedSupplierId) 
                                  : null;
                              
                              const canAssign = user.role === 'admin' || user.role === 'maintenance';

                              return (
                                  <tr key={r.id} onClick={() => setSelectedRequest(r)} className="hover:bg-red-100 cursor-pointer transition-colors bg-white">
                                      <td className="px-4 py-3 font-bold text-slate-800">{r.title}</td>
                                      <td className="px-4 py-3 text-slate-600 text-xs">{tech?.name || '-'}</td>
                                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                                          {new Date(r.createdDate).toLocaleDateString()}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                                          {r.plannedResolutionDate ? new Date(r.plannedResolutionDate).toLocaleDateString() : '-'}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600 text-xs font-medium">
                                          {solver ? (
                                              solver.name 
                                          ) : (
                                              canAssign && r.state === 'new' ? (
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); openAssignModal(r); }}
                                                    className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors" 
                                                    title="Převzít požadavek"
                                                  >
                                                      <UserPlus className="w-3 h-3 mr-1" /> Převzít
                                                  </button>
                                              ) : <span className="text-slate-400 italic">Nepřiřazeno</span>
                                          )}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600 text-xs">
                                          {supplier ? supplier.name : <span className="text-slate-400">Interní</span>}
                                      </td>
                                      <td className="px-4 py-3 text-center text-xs font-mono">
                                          {r.estimatedCost ? <span className="flex items-center justify-center gap-1"><Euro className="w-3 h-3 text-slate-400"/> {r.estimatedCost}</span> : '-'}
                                      </td>
                                      <td className="px-4 py-3 text-center text-xs font-mono">
                                          {r.estimatedTime ? <span className="flex items-center justify-center gap-1"><Clock className="w-3 h-3 text-slate-400"/> {formatTime(r.estimatedTime)}</span> : '-'}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                          {renderStatusBadge(r.state)}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                          {r.isApproved 
                                              ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> 
                                              : <div className="w-2 h-2 rounded-full bg-amber-400 mx-auto" title="Čeká" />
                                          }
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                          <button onClick={() => setSelectedRequest(r)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded">
                                              <Eye className="w-4 h-4" />
                                          </button>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Upcoming Maintenance Section */}
      {(user.role === 'admin' || user.role === 'maintenance') && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-semibold flex items-center justify-between">
                <div className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-slate-500" />
                    {t('dashboard.upcoming_maintenance')}
                </div>
                <button onClick={() => onNavigate('maintenance')} className="text-xs text-blue-600 hover:underline flex items-center">
                    Zobrazit vše <ArrowRight className="w-3 h-3 ml-1" />
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                        <tr>
                            <th className="px-4 py-3 whitespace-nowrap">Technologie</th>
                            <th className="px-4 py-3 whitespace-nowrap">S.N.</th>
                            <th className="px-4 py-3 whitespace-nowrap">{t('form.interval')}</th>
                            <th className="px-4 py-3 whitespace-nowrap">Generování</th>
                            <th className="px-4 py-3 whitespace-nowrap">{t('form.supplier')}</th>
                            <th className="px-4 py-3 whitespace-nowrap">{t('form.responsible_person')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {upcomingMaintenance.length === 0 ? (
                            <tr><td colSpan={6} className="p-6 text-center text-slate-400">Žádná naplánovaná údržba</td></tr>
                        ) : (
                            upcomingMaintenance.map(m => {
                                const tech = techs.find(t => t.id === m.techId);
                                const supplier = suppliers.find(s => s.id === m.supplierId);
                                const responsibleNames = m.responsiblePersonIds
                                    ?.map(id => users.find(u => u.id === id)?.name).filter(Boolean).join(', ');

                                return (
                                    <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedMaintenance(m)}>
                                        <td className="px-4 py-3 font-medium text-slate-700">{tech?.name || 'Neznámá'}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{tech?.serialNumber || '-'}</td>
                                        <td className="px-4 py-3">{m.interval} {t('common.days')}</td>
                                        <td className="px-4 py-3 text-slate-800 font-medium">
                                            {m.nextDateObj ? m.nextDateObj.toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">
                                            {supplier ? supplier.name : <span className="text-slate-400 italic">Interní</span>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs max-w-[200px] truncate">
                                            {responsibleNames || '-'}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* Request Detail Modal */}
      {selectedRequest && (
          <Modal title={t('headers.request_detail')} onClose={() => setSelectedRequest(null)}>
              <div className="max-h-[80vh] overflow-y-auto -m-4">
                  <RequestDetail 
                      request={selectedRequest}
                      currentUser={user}
                      technologies={techs}
                      onBack={() => setSelectedRequest(null)}
                      onEdit={() => {}} // Not allowed from dashboard quick view
                      onSolve={() => {}} 
                      onAssign={() => {}} 
                      onUnassign={() => {}}
                      onCancel={() => {}}
                      onApproveChange={() => {}} 
                      onGallery={() => {}}
                      renderStatusBadge={renderStatusBadge}
                      renderPrioBadge={(p) => <span className="text-xs font-bold uppercase">{p}</span>}
                      refresh={loadData}
                  />
              </div>
          </Modal>
      )}

      {/* Maintenance Detail Modal (Read Only View) */}
      {selectedMaintenance && (
          <Modal title={t('headers.maintenance_detail')} onClose={() => setSelectedMaintenance(null)}>
              <div className="space-y-4">
                  <div className="flex justify-between items-start">
                      <div>
                          <h3 className="text-lg font-bold text-slate-800">{selectedMaintenance.title}</h3>
                          <p className="text-sm text-slate-500">
                              {techs.find(t => t.id === selectedMaintenance.techId)?.name}
                          </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${selectedMaintenance.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
                          {selectedMaintenance.isActive ? t('status.active') : t('status.done')}
                      </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded border border-slate-200 text-sm grid grid-cols-2 gap-4">
                      <div>
                          <span className="block text-xs text-slate-500">{t('form.interval')}</span>
                          <span className="font-medium">{selectedMaintenance.interval} {t('common.days')}</span>
                      </div>
                      <div>
                          <span className="block text-xs text-slate-500">{t('col.next_maintenance')}</span>
                          <span className="font-medium text-blue-700">
                              {calculateNextMaintenanceDate(selectedMaintenance)?.toLocaleDateString() || '-'}
                          </span>
                      </div>
                      <div>
                          <span className="block text-xs text-slate-500">{t('form.supplier')}</span>
                          <span className="font-medium">
                              {suppliers.find(s => s.id === selectedMaintenance.supplierId)?.name || 'Interní'}
                          </span>
                      </div>
                      <div>
                          <span className="block text-xs text-slate-500">{t('form.responsible_person')}</span>
                          <span className="font-medium text-xs">
                              {selectedMaintenance.responsiblePersonIds?.map(id => users.find(u => u.id === id)?.name).join(', ') || '-'}
                          </span>
                      </div>
                  </div>

                  <div>
                      <h4 className="font-bold text-sm text-slate-700 mb-1">{t('form.description')}</h4>
                      <p className="text-sm text-slate-600 bg-white p-2 rounded border border-slate-100">
                          {selectedMaintenance.description || 'Bez popisu'}
                      </p>
                  </div>

                  <div className="flex justify-end pt-2">
                      <button 
                          onClick={() => onNavigate('requests', { maintenanceId: selectedMaintenance.id })}
                          className="text-sm text-blue-600 hover:underline flex items-center"
                      >
                          <List className="w-4 h-4 mr-1"/> Zobrazit historii generování ({selectedMaintenance.generatedRequestCount || 0})
                      </button>
                  </div>
              </div>
          </Modal>
      )}

      {/* Assign Modal from Urgent Table */}
      {assignModalOpen && assignTargetReq && (
          <AssignModal 
              isOpen={assignModalOpen} 
              onClose={() => setAssignModalOpen(false)} 
              onConfirm={handleAssignConfirm}
              assignDate={assignDate} 
              setAssignDate={setAssignDate} 
              assignSolverId={assignSolverId} 
              setAssignSolverId={setAssignSolverId}
              candidates={users.filter(u => u.role !== 'operator' && !u.isBlocked)} 
              currentUser={user}
              isAlreadyAssigned={false}
          />
      )}
    </div>
  );
};
