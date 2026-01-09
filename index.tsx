
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Import global styles (Tailwind)
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LocationsPage } from './pages/admin/LocationsPage';
import { SuppliersPage } from './pages/admin/SuppliersPage';
import { TechConfigPage } from './pages/admin/TechConfigPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { EmailsPage } from './pages/admin/EmailsPage';
import { AssetsPage } from './pages/Assets';
import { RequestsPage } from './pages/RequestsPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { CalendarPage } from './pages/CalendarPage';
import { seedData, db } from './lib/db';
import { User } from './lib/types';
import { useI18n } from './lib/i18n';
import { ServerOff, KeyRound, Mail, AlertTriangle, CheckCircle, ArrowLeft, Loader, Database } from 'lucide-react';

// Maintenance Page Component (DB Error)
const MaintenanceErrorPage = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600">
        <ServerOff className="w-16 h-16 mb-4 text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-800">Systém v údržbě</h1>
        <p className="mt-2 text-center max-w-md">
            Omlouváme se, ale systém je momentálně nedostupný z důvodu údržby nebo výpadku spojení se serverem. Zkuste to prosím později.
        </p>
    </div>
);

const App = () => {
  const { t } = useI18n();
  
  // Detect if we are likely in a dev/demo environment capability
  const isDevEnv = import.meta.env && import.meta.env.DEV;

  // Initialize Mock Data if explicitly requested or in DEV
  const [useMockData, setUseMockData] = useState(isDevEnv);

  useEffect(() => {
    if (useMockData) {
        seedData();
    }
  }, [useMockData]);

  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState<any>({});
  
  // Auth States
  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset' | 'link-sent'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check URL for Reset Token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) {
        setResetToken(token);
        // Validate token (Local logic only for demo/dev, usually API would handle this too)
        const isValid = db.auth.validateToken(token);
        if (isValid) {
            setAuthView('reset');
        } else {
            setAuthView('login');
            setAuthError(t('auth.token_invalid'));
        }
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [t]);
  
  // Strict Login Handling
  const handleLogin = async (role: User['role']) => {
    setAuthError(null);
    setIsLoggingIn(true);

    // Hardcoded credentials for Demo Buttons (Mapping roles to seed emails)
    let email = '';
    let password = 'password'; 

    if (role === 'admin') email = 'admin@tech.com';
    else if (role === 'maintenance') email = 'maint@tech.com';
    else if (role === 'operator') email = 'op@tech.com';

    try {
        if (useMockData) {
            // --- DEMO / MOCK DATA MODE ---
            console.log('Using Local Storage Login (Demo Mode)');
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate tiny delay

            const mockUsers = db.users.list();
            let found = mockUsers.find(u => u.email === email);
            // Fallback for role button click if email not found exactly
            if (!found) found = mockUsers.find(u => u.role === role);

            if (found && found.isBlocked) {
                setAuthError("Tento uživatel má zablokovaný přístup.");
            } else if (found) {
                // Set a mock token so other components know we are logged in, but with mock
                localStorage.setItem('auth_token', 'mock-token-' + found.id);
                setUser(found);
                setPage('dashboard');
            } else {
                setAuthError("Chyba přihlášení (uživatel nenalezen v mock datech).");
            }

        } else {
            // --- PRODUCTION (API ONLY) ---
            const controller = new AbortController();
            // Short timeout (2s) to prevent infinite spinner feeling
            const timeoutId = setTimeout(() => controller.abort(), 2000); 

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('auth_token', data.token);
                setUser(data.user);
                setPage('dashboard');
            } else {
                if (response.status === 401) setAuthError("Neplatné přihlašovací údaje.");
                else if (response.status === 403) setAuthError("Přístup zablokován.");
                else setAuthError("Chyba serveru. Zkuste to později.");
            }
        }
    } catch (err: any) {
        console.error('Login error:', err);
        if (err.name === 'AbortError') {
            setAuthError("Server neodpovídá (Timeout). Zkontrolujte připojení nebo zkuste Demo režim.");
        } else {
            setAuthError("Nepodařilo se připojit k serveru. Zkuste Demo režim.");
        }
    } finally {
        setIsLoggingIn(false);
    }
  };

  const handleSendLink = () => {
      setAuthError(null);
      const token = db.auth.createResetToken(resetEmail);
      if (token) {
          const link = `${window.location.origin}${window.location.pathname}?resetToken=${token}`;
          setGeneratedLink(link);
          setAuthView('link-sent');
      } else {
          setAuthError('Email v systému neexistuje.'); 
      }
  };

  const handleResetPassword = () => {
      if (!resetToken || !newPassword) return;
      
      const success = db.auth.resetPassword(resetToken, newPassword);
      if (success) {
          setAuthSuccess(t('auth.reset_success'));
          setAuthView('login');
          setNewPassword('');
          setResetToken(null);
      } else {
          setAuthError(t('auth.token_invalid'));
      }
  };
  
  const handleNavigate = (newPage: string, params?: any) => {
      setPage(newPage);
      setPageParams(params || {});
  }

  const handleLogout = () => {
      setUser(null);
      localStorage.removeItem('auth_token');
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-2 text-slate-800">{t('app.name')}</h1>
          
          <div className="mb-4 text-xs font-mono text-slate-400">
              Build: {isDevEnv ? 'DEV' : 'PROD'}
          </div>

          {authSuccess && (
              <div className="mb-4 p-3 bg-green-100 text-green-800 rounded flex items-center justify-center text-sm">
                  <CheckCircle className="w-4 h-4 mr-2" /> {authSuccess}
              </div>
          )}

          {authError && (
              <div className="mb-4 p-3 bg-red-100 text-red-800 rounded flex items-center justify-center text-sm">
                  <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" /> {authError}
              </div>
          )}

          {/* LOGIN VIEW */}
          {authView === 'login' && (
            <>
                <p className="mb-6 text-slate-500">Vyberte roli pro přihlášení:</p>
                <div className="space-y-3">
                    <button onClick={() => handleLogin('admin')} disabled={isLoggingIn} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex justify-center">
                        {isLoggingIn ? <Loader className="animate-spin w-5 h-5"/> : 'Administrátor'}
                    </button>
                    <button onClick={() => handleLogin('maintenance')} disabled={isLoggingIn} className="w-full py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 flex justify-center">
                        {isLoggingIn ? <Loader className="animate-spin w-5 h-5"/> : 'Údržba'}
                    </button>
                    <button onClick={() => handleLogin('operator')} disabled={isLoggingIn} className="w-full py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex justify-center">
                        {isLoggingIn ? <Loader className="animate-spin w-5 h-5"/> : 'Obsluha'}
                    </button>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center">
                    <label className="flex items-center text-sm text-slate-500 cursor-pointer hover:text-slate-700">
                        <input 
                            type="checkbox" 
                            className="mr-2 rounded" 
                            checked={useMockData} 
                            onChange={(e) => setUseMockData(e.target.checked)} 
                        />
                        <Database className="w-4 h-4 mr-1" />
                        Demo režim (lokální data)
                    </label>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                    <button 
                        onClick={() => { setAuthView('forgot'); setAuthError(null); setAuthSuccess(null); }} 
                        className="text-sm text-slate-500 hover:text-blue-600 flex items-center justify-center w-full"
                    >
                        <KeyRound className="w-3 h-3 mr-1" /> {t('auth.forgot_password')}
                    </button>
                </div>
            </>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {authView === 'forgot' && (
              <>
                <h3 className="font-bold text-lg mb-4">{t('auth.forgot_password')}</h3>
                <div className="text-left mb-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('common.email')}</label>
                    <div className="relative">
                        <input 
                            type="email" 
                            className="w-full border p-2 pl-9 rounded" 
                            placeholder="admin@tech.com"
                            value={resetEmail}
                            onChange={e => setResetEmail(e.target.value)}
                        />
                        <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    </div>
                </div>
                <button onClick={handleSendLink} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-3">
                    {t('auth.send_link')}
                </button>
                <button onClick={() => setAuthView('login')} className="text-sm text-slate-500 hover:text-slate-800">
                    {t('common.cancel')}
                </button>
              </>
          )}

          {/* LINK SENT VIEW */}
          {authView === 'link-sent' && (
              <div className="text-left">
                  <div className="flex flex-col items-center justify-center text-green-600 mb-4">
                      <Mail className="w-12 h-12 mb-2" />
                      <h3 className="font-bold text-lg">{t('auth.link_sent_title')}</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4 text-center">{t('auth.link_sent_msg')}</p>
                  
                  <div className="bg-slate-50 p-3 rounded border border-slate-200 mb-4 break-all text-xs font-mono text-center">
                      <a href={generatedLink} className="text-blue-600 hover:underline">{generatedLink}</a>
                  </div>

                  <button onClick={() => setAuthView('login')} className="w-full py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300">
                      {t('auth.back_to_login')}
                  </button>
              </div>
          )}

          {/* RESET PASSWORD VIEW */}
          {authView === 'reset' && (
               <>
                <h3 className="font-bold text-lg mb-4">{t('auth.reset_password')}</h3>
                <div className="text-left mb-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('auth.new_password')}</label>
                    <input 
                        type="password" 
                        className="w-full border p-2 rounded" 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                    />
                </div>
                <button onClick={handleResetPassword} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-3">
                    {t('auth.reset_password')}
                </button>
                <button onClick={() => { setAuthView('login'); setResetToken(null); }} className="text-sm text-slate-500 hover:text-slate-800">
                    {t('common.cancel')}
                </button>
              </>
          )}

        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch(page) {
      case 'dashboard': return <Dashboard user={user} onNavigate={handleNavigate} />;
      case 'assets': return <AssetsPage user={user} onNavigate={handleNavigate} initialFilters={pageParams} />;
      case 'locations': return <LocationsPage />;
      case 'suppliers': return <SuppliersPage />;
      case 'tech_config': return <TechConfigPage onNavigate={handleNavigate} />;
      case 'requests': return <RequestsPage user={user} initialFilters={pageParams} />;
      case 'maintenance': return <MaintenancePage user={user} />;
      case 'calendar': return <CalendarPage user={user} onNavigate={handleNavigate} />;
      case 'users': return <UsersPage onNavigate={handleNavigate} />;
      case 'settings': return <SettingsPage />;
      case 'emails': return <EmailsPage />;
      default: return <Dashboard user={user} onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout user={user} onLogout={handleLogout} currentPage={page} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
