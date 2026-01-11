import React, { useState, useEffect, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; 
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
import { User, Lang } from './lib/types';
import { useI18n } from './lib/i18n';
import { KeyRound, Mail, AlertTriangle, CheckCircle, Loader, Database, Server, Lock, User as UserIcon } from 'lucide-react';

// --- Error Boundary Component ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("React Critical Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 flex flex-col items-center justify-center min-h-screen bg-slate-50 text-red-900">
          <AlertTriangle className="w-16 h-16 text-red-600 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Kritická chyba aplikace</h1>
          <p className="mb-4">Aplikace narazila na neočekávanou chybu.</p>
          <div className="bg-white p-4 rounded border border-red-200 font-mono text-sm max-w-2xl overflow-auto shadow-sm">
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Obnovit stránku
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Environment Detection ---

const PROD_DOMAIN = 'fhbmain.impossible.cz';
const PROD_API_URL = 'https://fhbmain.impossible.cz:3010';

const isProductionDomain = typeof window !== 'undefined' && window.location.hostname === PROD_DOMAIN;
const shouldForceMock = !isProductionDomain;

const App = () => {
  const { t, lang, setLang } = useI18n();
  
  const [useMockData, setUseMockData] = useState(shouldForceMock);

  useEffect(() => {
    if (useMockData) {
        seedData();
        console.log(`Environment: ${window.location.hostname} -> Using Mock Data (Preview/Dev Mode)`);
    } else {
        console.log(`Environment: ${window.location.hostname} -> Using Production API`);
    }
  }, [useMockData]);

  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState<any>({});
  
  // Auth States
  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset' | 'link-sent'>('login');
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Added confirm password
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- Session Restoration & Auto-Logout Logic ---
  const handleLogout = () => {
      setUser(null);
      setLoginEmail('');
      setLoginPassword('');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_login_time');
  };

  useEffect(() => {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');
      const storedLoginTime = localStorage.getItem('auth_login_time');
      
      if (storedToken && storedUser) {
          // Check 24h timeout
          if (storedLoginTime) {
              const loginTime = parseInt(storedLoginTime, 10);
              const now = Date.now();
              const hoursElapsed = (now - loginTime) / (1000 * 60 * 60);
              
              if (hoursElapsed >= 24) {
                  console.warn("Session expired (24h limit). Logging out.");
                  handleLogout();
                  return;
              }
          }

          try {
              const parsedUser = JSON.parse(storedUser);
              setUser(parsedUser);
              console.log('Session restored for:', parsedUser.email);
          } catch (e) {
              console.error('Failed to restore session:', e);
              handleLogout();
          }
      }
  }, []);

  // Timer for Auto-Logout (check every minute)
  useEffect(() => {
      if (!user) return;

      const interval = setInterval(() => {
          const storedLoginTime = localStorage.getItem('auth_login_time');
          if (storedLoginTime) {
              const loginTime = parseInt(storedLoginTime, 10);
              const now = Date.now();
              const hoursElapsed = (now - loginTime) / (1000 * 60 * 60);
              
              if (hoursElapsed >= 24) {
                  console.warn("Auto-logout triggered (24h limit).");
                  handleLogout();
                  alert("Vaše relace vypršela (24 hodin). Přihlašte se prosím znovu.");
              }
          }
      }, 60000); // Check every minute

      return () => clearInterval(interval);
  }, [user]);

  // Check URL for Reset Token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) {
        setResetToken(token);
        if (useMockData) {
            const isValid = db.auth.validateToken(token);
            if (isValid) {
                setAuthView('reset');
            } else {
                setAuthView('login');
                setAuthError(t('auth.token_invalid'));
            }
        } else {
             setAuthView('reset'); 
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [useMockData, t]);
  
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    setIsLoggingIn(true);

    if (!loginEmail || !loginPassword) {
        setAuthError(t('auth.enter_email'));
        setIsLoggingIn(false);
        return;
    }

    try {
        if (useMockData) {
            // --- DEMO / MOCK LOGIC ---
            await new Promise(resolve => setTimeout(resolve, 600)); 

            const mockUsers = db.users.list();
            const found = mockUsers.find(u => u.email.toLowerCase() === loginEmail.toLowerCase());

            if (found && found.isBlocked) {
                setAuthError(t('auth.account_blocked'));
            } else if (found) {
                if (found.password && found.password !== loginPassword && loginPassword !== 'password') {
                     setAuthError(t('auth.invalid_credentials'));
                } else {
                    const now = Date.now().toString();
                    localStorage.setItem('auth_token', 'mock-token-' + found.id);
                    localStorage.setItem('auth_user', JSON.stringify(found));
                    localStorage.setItem('auth_login_time', now);
                    setUser(found);
                    setPage('dashboard');
                }
            } else {
                setAuthError(t('auth.user_not_found'));
            }

        } else {
            // --- PRODUCTION API LOGIC ---
            console.log(`Authenticating against: ${PROD_API_URL}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); 

            const response = await fetch(`${PROD_API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginEmail, password: loginPassword }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const now = Date.now().toString();
                
                localStorage.setItem('auth_token', data.token);
                if (data.refreshToken) {
                    localStorage.setItem('refresh_token', data.refreshToken);
                }
                localStorage.setItem('auth_user', JSON.stringify(data.user));
                localStorage.setItem('auth_login_time', now);
                
                setUser(data.user);
                setPage('dashboard');
            } else {
                if (response.status === 401) setAuthError(t('auth.invalid_credentials'));
                else if (response.status === 403) setAuthError(t('auth.account_blocked'));
                else setAuthError(t('auth.server_error'));
            }
        }
    } catch (err: any) {
        console.error('Login error:', err);
        if (err.name === 'AbortError') {
            setAuthError(t('auth.timeout'));
        } else {
            setAuthError(t('auth.connection_error'));
        }
    } finally {
        setIsLoggingIn(false);
    }
  };

  // Helper for Demo Mode - Quick Fill
  const demoFill = (email: string) => {
      setLoginEmail(email);
      setLoginPassword('password');
  };

  const handleSendLink = async () => {
      setAuthError(null);
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(resetEmail)) {
          setAuthError(t('auth.invalid_email_format'));
          return;
      }

      if (useMockData) {
          const token = db.auth.createResetToken(resetEmail);
          if (token) {
              const link = `${window.location.origin}${window.location.pathname}?resetToken=${token}`;
              setGeneratedLink(link);
              setAuthView('link-sent');
          } else {
              setAuthError(t('auth.email_not_found')); 
          }
      } else {
          try {
              setIsLoggingIn(true);
              const res = await fetch(`${PROD_API_URL}/api/auth/forgot-password`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: resetEmail, lang: lang }) // Send current language
              });
              
              if (res.ok) {
                  setAuthView('link-sent');
                  setGeneratedLink(t('auth.link_sent_success')); 
              } else {
                  throw new Error('Server error');
              }
          } catch(e) {
              console.error(e);
              setAuthError(t('auth.send_error'));
          } finally {
              setIsLoggingIn(false);
          }
      }
  };

  const handleResetPassword = async () => {
      if (!resetToken || !newPassword || !confirmPassword) return;
      
      if (newPassword !== confirmPassword) {
          setAuthError(t('auth.passwords_do_not_match'));
          return;
      }

      if (useMockData) {
          const success = db.auth.resetPassword(resetToken, newPassword);
          if (success) {
              setAuthSuccess(t('auth.reset_success'));
              setAuthView('login');
              setNewPassword('');
              setConfirmPassword('');
              setResetToken(null);
          } else {
              setAuthError(t('auth.token_invalid'));
          }
      } else {
           try {
               setIsLoggingIn(true);
               const res = await fetch(`${PROD_API_URL}/api/auth/reset-password`, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ token: resetToken, password: newPassword })
               });

               if (res.ok) {
                   setAuthSuccess(t('auth.reset_success'));
                   setAuthView('login');
                   setNewPassword('');
                   setConfirmPassword('');
                   setResetToken(null);
               } else {
                   const errData = await res.json();
                   setAuthError(errData.error || t('auth.reset_error'));
               }
           } catch(e: any) {
               setAuthError(t('auth.token_invalid'));
           } finally {
               setIsLoggingIn(false);
           }
      }
  };
  
  const handleNavigate = (newPage: string, params?: any) => {
      setPage(newPage);
      setPageParams(params || {});
  }

  const handleLangChange = (l: Lang) => {
      setLang(l);
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 relative">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center relative">
          
          {/* Language Switcher */}
          <div className="absolute top-4 right-4 flex space-x-1">
             <button onClick={() => handleLangChange('cs')} className={`text-xs px-2 py-1 rounded transition-colors ${lang === 'cs' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>CZ</button>
             <button onClick={() => handleLangChange('en')} className={`text-xs px-2 py-1 rounded transition-colors ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>EN</button>
             <button onClick={() => handleLangChange('uk')} className={`text-xs px-2 py-1 rounded transition-colors ${lang === 'uk' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>UA</button>
          </div>

          <h1 className="text-2xl font-bold mb-2 text-slate-800 mt-2">{t('app.name')}</h1>
          
          <div className="mb-6 flex justify-center">
              <span className={`text-xs px-2 py-1 rounded font-mono flex items-center gap-1 ${useMockData ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                  {useMockData ? <Database className="w-3 h-3"/> : <Server className="w-3 h-3"/>}
                  {useMockData ? t('auth.local_data') : 'PRODUCTION API'}
              </span>
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
                <form onSubmit={handleLogin} className="text-left space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('common.email')}</label>
                        <div className="relative">
                            <input 
                                type="email" 
                                className="w-full border p-2 pl-9 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                                placeholder="name@company.com"
                                value={loginEmail}
                                onChange={e => setLoginEmail(e.target.value)}
                                disabled={isLoggingIn}
                            />
                            <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('auth.password')}</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full border p-2 pl-9 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                                placeholder="••••••••"
                                value={loginPassword}
                                onChange={e => setLoginPassword(e.target.value)}
                                disabled={isLoggingIn}
                            />
                            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoggingIn} 
                        className="w-full py-2.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center transition-colors shadow-sm"
                    >
                        {isLoggingIn ? <Loader className="animate-spin w-5 h-5"/> : t('auth.login')}
                    </button>
                </form>

                <div className="mt-4 pt-2">
                    <button 
                        onClick={() => { setAuthView('forgot'); setAuthError(null); setAuthSuccess(null); }} 
                        className="text-sm text-slate-500 hover:text-blue-600 flex items-center justify-center w-full"
                    >
                        <KeyRound className="w-3 h-3 mr-1" /> {t('auth.forgot_password')}
                    </button>
                </div>

                {/* DEMO HELPERS - Only Visible in Mock Mode */}
                {useMockData && (
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">{t('auth.demo_accounts')}</p>
                        <div className="flex justify-center gap-2 text-xs">
                            <button onClick={() => demoFill('admin@tech.com')} className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600">Admin</button>
                            <button onClick={() => demoFill('maint@tech.com')} className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600">Maint</button>
                            <button onClick={() => demoFill('op@tech.com')} className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600">Op</button>
                        </div>
                    </div>
                )}

                {/* Environment Switcher */}
                {shouldForceMock && (
                    <div className="mt-4 flex flex-col items-center">
                        <label className="flex items-center text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                            <input 
                                type="checkbox" 
                                className="mr-1.5 rounded accent-blue-600" 
                                checked={useMockData} 
                                onChange={(e) => setUseMockData(e.target.checked)} 
                            />
                            <span>{t('auth.local_data')}</span>
                        </label>
                    </div>
                )}
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
                <button onClick={handleSendLink} disabled={isLoggingIn} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-3 flex justify-center">
                    {isLoggingIn ? <Loader className="animate-spin w-5 h-5"/> : t('auth.send_link')}
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
                      {useMockData ? (
                          <a href={generatedLink} className="text-blue-600 hover:underline">{generatedLink}</a>
                      ) : (
                          <span className="text-slate-600">{generatedLink}</span>
                      )}
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
                        className="w-full border p-2 rounded mb-2" 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                    />
                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('auth.confirm_password')}</label>
                    <input 
                        type="password" 
                        className="w-full border p-2 rounded" 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                    />
                </div>
                <button onClick={handleResetPassword} disabled={isLoggingIn} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-3 flex justify-center">
                    {isLoggingIn ? <Loader className="animate-spin w-5 h-5"/> : t('auth.reset_password')}
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
      case 'locations': return <LocationsPage onNavigate={handleNavigate} />;
      case 'suppliers': return <SuppliersPage onNavigate={handleNavigate} />;
      case 'tech_config': return <TechConfigPage onNavigate={handleNavigate} />;
      case 'requests': return <RequestsPage user={user} initialFilters={pageParams} />;
      case 'maintenance': return <MaintenancePage user={user} onNavigate={handleNavigate} />;
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
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);