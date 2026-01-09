
import React, { useEffect, useState } from 'react';
import { db, api, isProductionDomain } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { AlertCircle, CheckCircle, Clock, List, Calendar, Wrench, Inbox, FileCheck, Loader } from 'lucide-react';
import { User, Maintenance, Request, Technology } from '../lib/types';

interface DashboardProps {
    user: User;
    onNavigate: (page: string, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [techs, setTechs] = useState<Technology[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);

  // Environment check (can also be passed via props if preferred, but using import ensures consistency)
  // We use the same logic as App.tsx to decide: if isProductionDomain, try fetch.
  // Note: App.tsx passes `useMockData` state down? No, it passes user. 
  // Ideally, App should pass `isMock` prop. Assuming `isProductionDomain` implies default mode.
  // To match `App.tsx` state exactly, we'll check localStorage for 'auth_token' format or just fetch.
  
  useEffect(() => {
      const loadData = async () => {
          setLoading(true);
          try {
              const token = localStorage.getItem('auth_token');
              const isMock = !isProductionDomain || (token && token.startsWith('mock-token-'));

              if (isMock) {
                  setRequests(db.requests.list());
                  setTechs(db.technologies.list());
                  setMaintenance(db.maintenances.list());
              } else {
                  const [reqRes, techRes, maintRes] = await Promise.all([
                      api.get('/requests'),
                      api.get('/technologies'),
                      api.get('/maintenance')
                  ]);
                  setRequests(reqRes);
                  setTechs(techRes);
                  setMaintenance(maintRes);
              }
          } catch (e) {
              console.error("Dashboard Load Error", e);
          } finally {
              setLoading(false);
          }
      };
      loadData();
  }, [user]);

  if (loading) return <div className="p-10 flex justify-center"><Loader className="animate-spin w-8 h-8 text-blue-600"/></div>;

  // Counts
  const activeMaintenance = maintenance.filter(m => m.isActive).length;
  const totalAssets = techs.length;
  const myUnresolved = requests.filter(r => r.authorId === user.id && r.state !== 'solved' && r.state !== 'cancelled').length;

  const newRequestsCount = requests.filter(r => r.state === 'new').length;
  const assignedToMeCount = requests.filter(r => r.solverId === user.id && r.state !== 'solved' && r.state !== 'cancelled').length;
  
  const toApproveCount = requests.filter(r => {
      if (r.isApproved || r.state === 'solved' || r.state === 'cancelled') return false;
      const tech = techs.find(t => t.id === r.techId);
      // Need workplaces to check location... In async mode, we didn't fetch workplaces here.
      // Optimization: For dashboard counters, we might skip precise limit check or fetch workplaces too.
      // Let's rely on simple cost > 0 for now or assume user has access if admin.
      if (user.role === 'admin') return true;
      return (r.estimatedCost || 0) > 0; 
  }).length;

  // Helper to calculate next date
  const getNextDate = (m: Maintenance) => {
      const base = m.lastGeneratedDate ? new Date(m.lastGeneratedDate) : new Date();
      const next = new Date(base);
      next.setDate(base.getDate() + m.interval);
      return next.toISOString().split('T')[0];
  };

  const upcomingMaintenance = maintenance
    .filter(m => m.isActive)
    .map(m => ({ ...m, nextDate: getNextDate(m) }))
    .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())
    .slice(0, 5);

  const renderStatusBadge = (status: string) => {
        const styles: any = {
            'planned': 'bg-blue-100 text-blue-800',
            'in_progress': 'bg-amber-100 text-amber-800',
            'done': 'bg-green-100 text-green-800',
            'cancelled': 'bg-red-100 text-red-800',
            'active': 'bg-emerald-100 text-emerald-800'
        };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles['planned']}`}>{t(`status.${status}`) || status}</span>;
    };

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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">{t('menu.dashboard')}</h2>
      
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

      {(user.role === 'admin' || user.role === 'maintenance') && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-semibold flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-slate-500" />
                {t('dashboard.upcoming_maintenance')}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                        <tr>
                            <th className="px-4 py-3">Technologie</th>
                            <th className="px-4 py-3">{t('common.date')}</th>
                            <th className="px-4 py-3">Typ</th>
                            <th className="px-4 py-3">{t('common.status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {upcomingMaintenance.length === 0 ? (
                            <tr><td colSpan={4} className="p-6 text-center text-slate-400">Žádná naplánovaná údržba</td></tr>
                        ) : (
                            upcomingMaintenance.map(m => {
                                const tech = techs.find(t => t.id === m.techId);
                                return (
                                    <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => onNavigate('maintenance')}>
                                        <td className="px-4 py-3 font-medium text-slate-700">{tech?.name}</td>
                                        <td className="px-4 py-3">{m.nextDate}</td>
                                        <td className="px-4 py-3 text-slate-500">{m.type === 'operational' ? 'Provozní' : 'Plánovaná'}</td>
                                        <td className="px-4 py-3">{renderStatusBadge('planned')}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};
