
import React, { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { LayoutDashboard, MapPin, Truck, Settings, Box, Wrench, Users, LogOut, Globe, Sliders, Menu, X, Calendar, ClipboardList, CalendarDays, Mail, LockKeyhole } from 'lucide-react';
import { User } from '../lib/types';
import { ChangePasswordModal } from './modals/ChangePasswordModal';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  currentPage: string;
  onNavigate: (page: string, params?: any) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentPage, onNavigate }) => {
  const { t, setLang, lang } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleNavigate = (page: string) => {
      onNavigate(page);
      setIsMobileMenuOpen(false); // Close menu on navigation
  };

  const MenuLink = ({ page, icon: Icon, label }: { page: string, icon: any, label: string }) => (
    <button
      onClick={() => handleNavigate(page)}
      className={`flex items-center w-full px-4 py-3 text-sm font-medium transition-colors ${
        currentPage === page ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5 mr-3" />
      {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-slate-900 text-white h-16 flex items-center justify-between px-4 z-40 shadow-md">
          <div className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            {t('app.name')}
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-300 hover:text-white">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
          fixed md:relative z-40 h-full w-64 bg-slate-900 text-slate-100 flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          pt-16 md:pt-0
      `}>
        <div className="hidden md:block p-5 border-b border-slate-800">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            {t('app.name')}
          </h1>
          <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{t(`role.${user.role}`)}</div>
        </div>
        
        {/* Mobile User Info in Sidebar Header */}
        <div className="md:hidden p-4 bg-slate-800 border-b border-slate-700">
             <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t(`role.${user.role}`)}</div>
             <div className="font-medium truncate">{user.name}</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <MenuLink page="dashboard" icon={LayoutDashboard} label={t('menu.dashboard')} />
          
          {(user.role === 'admin' || user.role === 'maintenance' || user.role === 'operator') && (
            <MenuLink page="assets" icon={Box} label={t('menu.assets')} />
          )}

          {/* Requests visible to all */}
          <MenuLink page="requests" icon={ClipboardList} label={t('menu.requests')} />

          {/* Calendar for Maintenance/Admin */}
          {(user.role === 'admin' || user.role === 'maintenance') && (
             <MenuLink page="calendar" icon={CalendarDays} label="Kalendář" />
          )}

          {/* Maintenance separate tab for Admin/Maintenance */}
          {(user.role === 'admin' || user.role === 'maintenance') && (
             <MenuLink page="maintenance" icon={Calendar} label={t('menu.maintenance')} />
          )}

          {/* Locations only for Admin */}
          {user.role === 'admin' && (
             <MenuLink page="locations" icon={MapPin} label={t('menu.locations')} />
          )}
          
          {(user.role === 'admin' || user.role === 'maintenance') && (
             <MenuLink page="suppliers" icon={Truck} label={t('menu.suppliers')} />
          )}

          {user.role === 'admin' && (
            <>
              <MenuLink page="tech_config" icon={Sliders} label={t('menu.tech_config')} />
              <MenuLink page="users" icon={Users} label={t('menu.users')} />
              <MenuLink page="emails" icon={Mail} label={t('menu.emails')} />
              <div className="my-2 border-t border-slate-800"></div>
              <MenuLink page="settings" icon={Settings} label="Nastavení" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between mb-4">
             <div className="flex space-x-2">
                <button onClick={() => setLang('cs')} className={`text-xs p-1 rounded ${lang === 'cs' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>CZ</button>
                <button onClick={() => setLang('en')} className={`text-xs p-1 rounded ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>EN</button>
                <button onClick={() => setLang('uk')} className={`text-xs p-1 rounded ${lang === 'uk' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>UA</button>
             </div>
             <Globe className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex items-center pt-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold mr-3">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-xs text-slate-400 truncate">{user.email}</div>
            </div>
            <div className="flex gap-1 ml-2">
                <button onClick={() => setIsPasswordModalOpen(true)} className="text-slate-400 hover:text-white" title="Změnit heslo">
                    <LockKeyhole className="w-4 h-4" />
                </button>
                <button onClick={onLogout} className="text-slate-400 hover:text-white">
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto w-full pt-16 md:pt-0">
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
           {children}
        </div>
      </main>

      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
        userId={user.id} 
      />
    </div>
  );
};
