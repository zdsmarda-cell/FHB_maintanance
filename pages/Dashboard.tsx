
import React from 'react';
import { db } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { AlertCircle, CheckCircle, Clock, List } from 'lucide-react';
import { User } from '../lib/types';

interface DashboardProps {
    user: User;
    onNavigate: (page: string, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const { t } = useI18n();
  const requests = db.requests.list();
  const techs = db.technologies.list();
  const maintenance = db.maintenances.list();

  // Stats calculation
  const newRequests = requests.filter(r => r.state === 'new').length;
  const activeMaintenance = maintenance.filter(m => m.state === 'in_progress').length;
  const totalAssets = techs.length;
  
  // Specific for operator: Unresolved requests created by me
  const myUnresolved = requests.filter(r => r.authorId === user.id && r.state !== 'solved' && r.state !== 'cancelled').length;

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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {user.role === 'operator' ? (
             <Card 
                title={t('dashboard.my_unresolved')} 
                value={myUnresolved} 
                icon={List} 
                color="bg-amber-500" 
                onClick={() => onNavigate('operations')}
             />
        ) : (
             <Card 
                title={t('dashboard.new_requests')} 
                value={newRequests} 
                icon={AlertCircle} 
                color="bg-red-500" 
                onClick={() => onNavigate('operations', { status: 'new' })}
             />
        )}
        
        <Card 
            title={t('dashboard.active_maintenance')} 
            value={activeMaintenance} 
            icon={Clock} 
            color="bg-blue-500" 
            onClick={() => onNavigate('operations', { tab: 'maintenance' })} 
        />
        
        <Card 
            title={t('dashboard.total_assets')} 
            value={totalAssets} 
            icon={CheckCircle} 
            color="bg-emerald-500" 
            onClick={() => onNavigate('assets')}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
         <h3 className="font-semibold text-lg mb-4">Rychlý přehled</h3>
         <p className="text-slate-500">Vítejte v systému TechMaintain Pro. Vyberte modul z menu.</p>
      </div>
    </div>
  );
};
