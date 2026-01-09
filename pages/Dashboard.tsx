
import React from 'react';
import { db } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { AlertCircle, CheckCircle, Clock, List, Calendar, Wrench, Inbox, FileCheck } from 'lucide-react';
import { User, Maintenance } from '../lib/types';

interface DashboardProps {
    user: User;
    onNavigate: (page: string, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const { t } = useI18n();
  const requests = db.requests.list();
  const techs = db.technologies.list();
  const maintenance = db.maintenances.list();

  // Counts
  const activeMaintenance = maintenance.filter(m => m.isActive).length;
  const totalAssets = techs.length;
  const myUnresolved = requests.filter(r => r.authorId === user.id && r.state !== 'solved' && r.state !== 'cancelled').length;

  // New Dashboard Logic for "Requests Overview" Card
  const newRequestsCount = requests.filter(r => r.state === 'new').length;
  const assignedToMeCount = requests.filter(r => r.solverId === user.id && r.state !== 'solved' && r.state !== 'cancelled').length;
  
  // Calculate "To Approve" count based on user limits
  // Criteria: Not Approved AND Not Solved/Cancelled AND Cost <= User Limit for that location
  const toApproveCount = requests.filter(r => {
      if (r.isApproved || r.state === 'solved' || r.state === 'cancelled') return false;
      
      const tech = techs.find(t => t.id === r.techId);
      const wp = db.workplaces.list().find(w => w.id === tech?.workplaceId);
      const locId = wp?.locationId;
      
      if (!locId) return false;

      // User must have a limit defined for this location
      // And the cost must be within that limit (if cost is higher, they can't approve it)
      const userLimit = user.approvalLimits?.[locId];
      if (userLimit === undefined) return false; // No limit defined = no approval right

      return (r.estimatedCost || 0) <= userLimit;
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
        
        {/* Unified Requests Card */}
        {user.role === 'operator' ? (
             <Card 
                title={t('dashboard.my_unresolved')} 
                value={myUnresolved} 
                icon={List} 
                color="bg-amber-500" 
                onClick={() => onNavigate('requests')}
             />
        ) : (
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 col-span-1 md:col-span-2">
                <div className="flex items-center mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <List className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">{t('dashboard.requests_overview')}</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {/* New Requests Sub-item */}
                    <div 
                        onClick={() => onNavigate('requests', { status: 'new' })}
                        className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded border border-slate-100 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-colors"
                    >
                        <Inbox className="w-6 h-6 text-blue-500 mb-1" />
                        <span className="text-2xl font-bold text-slate-800">{newRequestsCount}</span>
                        <span className="text-xs text-slate-500 uppercase font-medium">{t('dashboard.new_requests')}</span>
                    </div>

                    {/* Assigned To Me Sub-item */}
                    <div 
                        onClick={() => onNavigate('requests', { solverId: user.id })}
                        className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded border border-slate-100 hover:bg-amber-50 hover:border-amber-200 cursor-pointer transition-colors"
                    >
                        <Wrench className="w-6 h-6 text-amber-500 mb-1" />
                        <span className="text-2xl font-bold text-slate-800">{assignedToMeCount}</span>
                        <span className="text-xs text-slate-500 uppercase font-medium">{t('dashboard.to_solve')}</span>
                    </div>

                    {/* Approval Sub-item (Conditional) */}
                    {toApproveCount > 0 ? (
                        <div 
                            onClick={() => onNavigate('requests', { mode: 'approval' })}
                            className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-colors"
                        >
                            <FileCheck className="w-6 h-6 text-emerald-500 mb-1" />
                            <span className="text-2xl font-bold text-slate-800">{toApproveCount}</span>
                            <span className="text-xs text-slate-500 uppercase font-medium">{t('dashboard.to_approve')}</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded border border-slate-100 opacity-50">
                            <FileCheck className="w-6 h-6 text-slate-400 mb-1" />
                            <span className="text-2xl font-bold text-slate-400">-</span>
                            <span className="text-xs text-slate-400 uppercase font-medium">{t('dashboard.to_approve')}</span>
                        </div>
                    )}
                </div>
            </div>
        )}
        
        <Card 
            title={t('dashboard.active_maintenance')} 
            value={activeMaintenance} 
            icon={Clock} 
            color="bg-blue-500" 
            onClick={() => onNavigate('maintenance')} 
        />
        
        <Card 
            title={t('dashboard.total_assets')} 
            value={totalAssets} 
            icon={CheckCircle} 
            color="bg-emerald-500" 
            onClick={() => onNavigate('assets')}
        />
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
                                const tech = db.technologies.list().find(t => t.id === m.techId);
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
            <div className="p-2 border-t bg-slate-50 text-center">
                <button onClick={() => onNavigate('maintenance')} className="text-xs text-blue-600 hover:underline">Zobrazit vše</button>
            </div>
        </div>
      )}

      {user.role === 'operator' && (
         <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-lg mb-4">Rychlý přehled</h3>
            <p className="text-slate-500">Vítejte v systému TechMaintain Pro. Pro nahlášení nového problému přejděte do sekce Požadavky.</p>
         </div>
      )}
    </div>
  );
};
