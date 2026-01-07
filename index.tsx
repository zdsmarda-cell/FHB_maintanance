
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LocationsPage } from './pages/admin/LocationsPage';
import { SuppliersPage } from './pages/admin/SuppliersPage';
import { TechConfigPage } from './pages/admin/TechConfigPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { AssetsPage } from './pages/Assets';
import { RequestsPage } from './pages/RequestsPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { seedData, db } from './lib/db';
import { User } from './lib/types';
import { useI18n } from './lib/i18n';
import { ServerOff } from 'lucide-react';

// Maintenance Page Component (DB Error)
const MaintenanceErrorPage = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600">
        <ServerOff className="w-16 h-16 mb-4 text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-800">Systém v údržbě</h1>
        <p className="mt-2 text-center max-w-md">
            Omlouváme se, ale systém je momentálně nedostupný z důvodu údržby nebo výpadku spojení s databází. Zkuste to prosím později.
        </p>
    </div>
);

const App = () => {
  // Initialize Mock Data
  useEffect(() => {
    seedData();
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState<any>({});
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);

  // Check DB Connection
  useEffect(() => {
      const check = async () => {
          try {
              const connected = await db.checkConnection();
              setIsDbConnected(connected);
          } catch (e) {
              setIsDbConnected(false);
          }
      };
      check();
  }, []);
  
  // Login Simulation
  const handleLogin = (role: User['role']) => {
    const mockUsers = db.users.list();
    let found = mockUsers.find(u => u.role === role);
    
    // Safety fallback if seed hasn't run yet or user deleted
    if(!found && mockUsers.length > 0) found = mockUsers[0];
    
    if (found && found.isBlocked) {
        alert("Tento uživatel má zablokovaný přístup.");
        return;
    }

    if (found) {
        setUser(found);
        setPage('dashboard');
    }
  };
  
  const handleNavigate = (newPage: string, params?: any) => {
      setPage(newPage);
      setPageParams(params || {});
  }

  if (isDbConnected === false) {
      return <MaintenanceErrorPage />;
  }

  if (isDbConnected === null) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-100">Načítání systému...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-6 text-slate-800">TechMaintain Pro</h1>
          <p className="mb-6 text-slate-500">Vyberte roli pro přihlášení (Demo):</p>
          <div className="space-y-3">
            <button onClick={() => handleLogin('admin')} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Administrátor</button>
            <button onClick={() => handleLogin('maintenance')} className="w-full py-2 bg-amber-600 text-white rounded hover:bg-amber-700">Údržba</button>
            <button onClick={() => handleLogin('operator')} className="w-full py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Obsluha</button>
          </div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch(page) {
      case 'dashboard': return <Dashboard user={user} onNavigate={handleNavigate} />;
      case 'assets': return <AssetsPage user={user} onNavigate={handleNavigate} />;
      case 'locations': return <LocationsPage />;
      case 'suppliers': return <SuppliersPage />;
      case 'tech_config': return <TechConfigPage />;
      case 'requests': return <RequestsPage user={user} initialFilters={pageParams} />;
      case 'maintenance': return <MaintenancePage user={user} />;
      case 'users': return <UsersPage onNavigate={handleNavigate} />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard user={user} onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout user={user} onLogout={() => setUser(null)} currentPage={page} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
