
import { User, Request, Location, Workplace, Technology, Supplier, Maintenance, Email, PushLog, Project } from './types';

export const PROD_DOMAIN = 'fhbmain.impossible.cz';
export const PROD_API_URL = 'https://fhbmain.impossible.cz:3010';

export const isProductionDomain = typeof window !== 'undefined' && window.location.hostname === PROD_DOMAIN;

export const uid = () => Math.random().toString(36).substr(2, 9);

const getStorage = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  const s = localStorage.getItem(key);
  return s ? JSON.parse(s) : [];
};

const setStorage = (key: string, data: any[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
};

// --- API Client with Auto-Refresh Logic ---

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

const handleLogout = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/';
    }
};

const refreshAccessToken = async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return null;

    try {
        const res = await fetch(`${PROD_API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('auth_token', data.accessToken);
            return data.accessToken;
        } else {
            // Refresh token is invalid or expired
            handleLogout();
            return null;
        }
    } catch (error) {
        console.error('Failed to refresh token', error);
        handleLogout();
        return null;
    }
};

const fetchWithRetry = async (url: string, options: RequestInit = {}) => {
    // 1. Attach current token
    const token = localStorage.getItem('auth_token');
    const headers = { ...options.headers } as Record<string, string>;
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // 2. Initial Request
    let res = await fetch(url, { ...options, headers });

    // 3. Check for 403 (Forbidden) or 401 (Unauthorized) indicating token expiration
    if (res.status === 403 || res.status === 401) {
        // Only attempt refresh if we have a refresh token
        if (localStorage.getItem('refresh_token')) {
            if (!isRefreshing) {
                isRefreshing = true;
                refreshPromise = refreshAccessToken().finally(() => {
                    isRefreshing = false;
                    refreshPromise = null;
                });
            }

            // Wait for the single refresh request to finish
            const newToken = await refreshPromise;

            if (newToken) {
                // Retry the original request with the new token
                headers['Authorization'] = `Bearer ${newToken}`;
                res = await fetch(url, { ...options, headers });
            }
        }
    }

    if (!res.ok) throw new Error(await res.text());
    
    // Check if response has content (for 204 No Content support)
    const text = await res.text();
    return text ? JSON.parse(text) : {};
};

export const api = {
    baseUrl: PROD_API_URL,
    get: (endpoint: string) => fetchWithRetry(`${PROD_API_URL}/api${endpoint}`),
    post: (endpoint: string, body: any) => fetchWithRetry(`${PROD_API_URL}/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }),
    put: (endpoint: string, body: any) => fetchWithRetry(`${PROD_API_URL}/api${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }),
    delete: (endpoint: string) => fetchWithRetry(`${PROD_API_URL}/api${endpoint}`, {
        method: 'DELETE'
    })
};

export const db = {
  auth: {
      validateToken: (token: string) => {
          const tokens = getStorage<any>('tmp_reset_tokens');
          const t = tokens.find(x => x.token === token);
          if (!t) return false;
          if (new Date(t.expires) < new Date()) return false;
          return true;
      },
      createResetToken: (email: string) => {
          const users = getStorage<User>('tmp_users');
          const user = users.find(u => u.email === email);
          if (!user) return null;
          const token = uid();
          const tokens = getStorage<any>('tmp_reset_tokens');
          tokens.push({ token, email, expires: new Date(Date.now() + 3600000).toISOString() });
          setStorage('tmp_reset_tokens', tokens);
          return token;
      },
      resetPassword: (token: string, pass: string) => {
          const tokens = getStorage<any>('tmp_reset_tokens');
          const t = tokens.find(x => x.token === token);
          if (!t) return false;
          
          const users = getStorage<User>('tmp_users');
          const userIndex = users.findIndex(u => u.email === t.email);
          if (userIndex === -1) return false;
          
          users[userIndex].password = pass;
          setStorage('tmp_users', users);
          
          // Invalidate token
          setStorage('tmp_reset_tokens', tokens.filter(x => x.token !== token));
          return true;
      },
      changePassword: (userId: string, old: string, newP: string) => {
          const users = getStorage<User>('tmp_users');
          const idx = users.findIndex(u => u.id === userId);
          if (idx === -1) return false;
          if (users[idx].password !== old && old !== 'password') return false; // Mock check
          users[idx].password = newP;
          setStorage('tmp_users', users);
          return true;
      }
  },
  users: {
    list: () => getStorage<User>('tmp_users'),
    add: (u: any) => { const l = db.users.list(); l.push({...u, id: uid()}); setStorage('tmp_users', l); },
    update: (id: string, d: any) => { setStorage('tmp_users', db.users.list().map(x => x.id === id ? {...x, ...d} : x)); },
  },
  locations: {
    list: () => getStorage<Location>('tmp_locations'),
    add: (l: any) => { const list = db.locations.list(); list.push({...l, id: uid()}); setStorage('tmp_locations', list); },
    update: (id: string, d: any) => { setStorage('tmp_locations', db.locations.list().map(x => x.id === id ? {...x, ...d} : x)); }
  },
  workplaces: {
    list: () => getStorage<Workplace>('tmp_workplaces'),
    add: (w: any) => { const list = db.workplaces.list(); list.push({...w, id: uid()}); setStorage('tmp_workplaces', list); },
    update: (id: string, d: any) => { setStorage('tmp_workplaces', db.workplaces.list().map(x => x.id === id ? {...x, ...d} : x)); },
    delete: (id: string) => { setStorage('tmp_workplaces', db.workplaces.list().filter(x => x.id !== id)); },
    isUsed: (id: string) => getStorage<Technology>('tmp_technologies').some(t => t.workplaceId === id)
  },
  suppliers: {
    list: () => getStorage<Supplier>('tmp_suppliers'),
    add: (s: any) => { const list = db.suppliers.list(); list.push({...s, id: uid()}); setStorage('tmp_suppliers', list); },
    update: (id: string, d: any) => { setStorage('tmp_suppliers', db.suppliers.list().map(x => x.id === id ? {...x, ...d} : x)); }
  },
  supplierContacts: {
      list: (supId: string) => getStorage<any>('tmp_supplier_contacts').filter(c => c.supplierId === supId),
      add: (c: any) => { const l = getStorage<any>('tmp_supplier_contacts'); l.push({...c, id: uid()}); setStorage('tmp_supplier_contacts', l); },
      delete: (id: string) => { setStorage('tmp_supplier_contacts', getStorage<any>('tmp_supplier_contacts').filter(x => x.id !== id)); },
      update: (id: string, d: any) => { setStorage('tmp_supplier_contacts', getStorage<any>('tmp_supplier_contacts').map(x => x.id === id ? {...x, ...d} : x)); }
  },
  techTypes: {
      list: () => getStorage<any>('tmp_tech_types'),
      add: (t: any) => { const l = db.techTypes.list(); l.push({...t, id: uid()}); setStorage('tmp_tech_types', l); },
      update: (id: string, d: any) => { setStorage('tmp_tech_types', db.techTypes.list().map(x => x.id === id ? {...x, ...d} : x)); },
      delete: (id: string) => { setStorage('tmp_tech_types', db.techTypes.list().filter(x => x.id !== id)); },
      isUsed: (id: string) => getStorage<Technology>('tmp_technologies').some(t => t.typeId === id)
  },
  techStates: {
      list: () => getStorage<any>('tmp_tech_states'),
      add: (t: any) => { const l = db.techStates.list(); l.push({...t, id: uid()}); setStorage('tmp_tech_states', l); },
      update: (id: string, d: any) => { setStorage('tmp_tech_states', db.techStates.list().map(x => x.id === id ? {...x, ...d} : x)); },
      delete: (id: string) => { setStorage('tmp_tech_states', db.techStates.list().filter(x => x.id !== id)); },
      isUsed: (id: string) => getStorage<Technology>('tmp_technologies').some(t => t.stateId === id)
  },
  technologies: {
    list: () => getStorage<Technology>('tmp_technologies'),
    add: (t: any) => { const l = db.technologies.list(); l.push({...t, id: uid()}); setStorage('tmp_technologies', l); },
    update: (id: string, d: any) => { setStorage('tmp_technologies', db.technologies.list().map(x => x.id === id ? {...x, ...d} : x)); },
    delete: (id: string) => { setStorage('tmp_technologies', db.technologies.list().filter(x => x.id !== id)); }
  },
  maintenances: {
    list: () => getStorage<Maintenance>('tmp_maintenances'),
    add: (m: any) => { const l = db.maintenances.list(); l.push({...m, id: uid(), createdAt: new Date().toISOString()}); setStorage('tmp_maintenances', l); },
    update: (id: string, d: any) => { setStorage('tmp_maintenances', db.maintenances.list().map(x => x.id === id ? {...x, ...d} : x)); },
    delete: (id: string) => { setStorage('tmp_maintenances', db.maintenances.list().filter(x => x.id !== id)); }
  },
  requests: {
    list: () => getStorage<Request>('tmp_requests'),
    add: (r: any) => { 
        const l = db.requests.list(); 
        const now = new Date().toISOString();
        const defaultState = r.solverId ? 'assigned' : 'new';
        l.push({ 
            ...r, 
            id: uid(), 
            state: r.state || defaultState,
            createdDate: now,
            history: [{ date: now, userId: r.authorId, action: 'created', note: 'Vytvořeno v demo režimu' }]
        }); 
        setStorage('tmp_requests', l); 
    },
    update: (id: string, d: any) => { 
        setStorage('tmp_requests', db.requests.list().map(x => x.id === id ? {...x, ...d} : x)); 
    },
    updateState: (id: string, state: string, reason: string, userId: string, extraFields: any = {}) => {
        setStorage('tmp_requests', db.requests.list().map(x => {
            if (x.id === id) {
                const history = x.history || [];
                history.push({
                    date: new Date().toISOString(),
                    userId: userId,
                    action: 'status_change',
                    note: reason || `Změna stavu na ${state}`,
                    oldValue: x.state,
                    newValue: state
                });
                return { ...x, state, cancellationReason: reason, ...extraFields, history };
            }
            return x;
        }));
    }
  },
  comments: {
      list: (reqId: string) => getStorage<any>('tmp_comments').filter(c => c.requestId === reqId),
      add: (c: any) => { const l = getStorage<any>('tmp_comments'); l.push({...c, id: uid(), date: new Date().toISOString()}); setStorage('tmp_comments', l); }
  },
  settings: {
      get: () => {
          const s = localStorage.getItem('tmp_settings');
          return s ? JSON.parse(s) : { enableOnlineTranslation: false };
      },
      save: (s: any) => localStorage.setItem('tmp_settings', JSON.stringify(s))
  },
  emails: {
      list: () => {
          let l = getStorage<Email>('tmp_emails');
          if (l.length === 0) {
              l = [
                  { id: '1', to_address: 'admin@tech.com', subject: 'Nový požadavek: Oprava lisu', body: 'Prosím o opravu...', created_at: new Date().toISOString(), sent_at: new Date().toISOString(), attempts: 1, error: null },
                  { id: '2', to_address: 'maint@tech.com', subject: 'Údržba', body: 'Check...', created_at: new Date(Date.now() - 86400000).toISOString(), sent_at: null, attempts: 0, error: null }
              ];
              setStorage('tmp_emails', l);
          }
          return l;
      },
      retry: (ids: (string|number)[]) => {
          const l = getStorage<Email>('tmp_emails');
          setStorage('tmp_emails', l.map(e => ids.includes(e.id) ? { ...e, sent_at: null, error: null, attempts: 0 } : e));
      }
  },
  pushLogs: {
      list: () => getStorage<PushLog>('tmp_push_logs')
  },
  projects: {
      list: () => getStorage<Project>('tmp_projects'),
      add: (p: any) => { const l = getStorage<Project>('tmp_projects'); l.push({...p, id: uid(), createdAt: new Date().toISOString()}); setStorage('tmp_projects', l); },
      update: (id: string, d: any) => { setStorage('tmp_projects', getStorage<Project>('tmp_projects').map(x => x.id === id ? {...x, ...d} : x)); },
      delete: (id: string) => { setStorage('tmp_projects', getStorage<Project>('tmp_projects').filter(x => x.id !== id)); }
  }
};

export const seedData = () => {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem('tmp_users')) {
    const users: User[] = [
      { id: 'u1', name: 'Admin User', email: 'admin@tech.com', role: 'admin', phone: '+420123456789', isBlocked: false, assignedLocationIds: [], assignedWorkplaceIds: [], password: 'password', approvalLimits: {} },
      { id: 'u2', name: 'Maintenance User', email: 'maint@tech.com', role: 'maintenance', phone: '+420987654321', isBlocked: false, assignedLocationIds: [], assignedWorkplaceIds: [], password: 'password', approvalLimits: {} },
      { id: 'u3', name: 'Operator User', email: 'op@tech.com', role: 'operator', phone: '+420111222333', isBlocked: false, assignedLocationIds: [], assignedWorkplaceIds: [], password: 'password', approvalLimits: {} }
    ];
    setStorage('tmp_users', users);

    const locs = [{ id: 'l1', name: 'Hlavní Sklad', address: { street: 'Průmyslová', number: '1', city: 'Praha', zip: '10000', country: 'CZ' }, isVisible: true }];
    setStorage('tmp_locations', locs);
    const wps = [{ id: 'w1', locationId: 'l1', name: 'Dílna A', description: 'Montáž', isVisible: true }];
    setStorage('tmp_workplaces', wps);

    setStorage('tmp_tech_types', [{id: 'tt1', name: 'Hydraulika'}, {id: 'tt2', name: 'Elektro'}]);
    setStorage('tmp_tech_states', [{id: 'ts1', name: 'V provozu'}, {id: 'ts2', name: 'Mimo provoz'}]);

    setStorage('tmp_technologies', [
        { id: 't1', name: 'Hydraulický Lis 500T', serialNumber: 'SN-2023-001-X', typeId: 'tt1', stateId: 'ts1', workplaceId: 'w1', isVisible: true, supplierId: '', installDate: '2023-01-01', weight: 5000, description: 'Velký lis', sharepointLink: '', photoUrls: [] }
    ]);
    
    setStorage('tmp_requests', []);
    setStorage('tmp_suppliers', []);
    setStorage('tmp_maintenances', []);
    setStorage('tmp_comments', []);
    setStorage('tmp_supplier_contacts', []);
    setStorage('tmp_push_logs', []);
    setStorage('tmp_projects', []);
  }
};
