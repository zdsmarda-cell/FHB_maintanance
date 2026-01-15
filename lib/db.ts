
import { User, Location, Workplace, Supplier, TechType, TechState, Technology, Maintenance, Request, Email, AppSettings, RequestHistoryEntry, PushLog } from './types';

// --- Environment Configuration ---
const PROD_DOMAIN = 'fhbmain.impossible.cz';
const PROD_API_URL = 'https://fhbmain.impossible.cz:3010';

export const isProductionDomain = typeof window !== 'undefined' && window.location.hostname === PROD_DOMAIN;
const isMockEnv = !isProductionDomain; 

// --- Internal Fetch Helper with Refresh Logic ---
const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    let token = localStorage.getItem('auth_token');
    if (!token) throw new Error('API Error: No access token found. Please login again.');

    const headers = {
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
    };

    let res = await fetch(`${PROD_API_URL}/api${endpoint}`, {
        ...options,
        headers
    });

    // If Access Token is expired (403 or 401), try to refresh
    if (res.status === 403 || res.status === 401) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
            try {
                console.log("Access token expired, attempting refresh...");
                const refreshRes = await fetch(`${PROD_API_URL}/api/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    const newAccessToken = data.accessToken;
                    
                    // Save new token
                    localStorage.setItem('auth_token', newAccessToken);
                    
                    // Retry original request
                    headers['Authorization'] = `Bearer ${newAccessToken}`;
                    res = await fetch(`${PROD_API_URL}/api${endpoint}`, {
                        ...options,
                        headers
                    });
                } else {
                    // Refresh failed (e.g. 24h expired), throw original error to trigger logout
                    console.error("Refresh token expired or invalid.");
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                    // Optional: trigger a window event or just let the app catch the error
                }
            } catch (refreshErr) {
                console.error("Error during token refresh:", refreshErr);
            }
        }
    }

    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`API Error: ${res.status} ${res.statusText} - ${errorBody}`);
    }
    
    return res.json();
};

// --- API Helper ---
export const api = {
    baseUrl: PROD_API_URL,
    
    get: async (endpoint: string) => {
        return fetchWithAuth(endpoint, { method: 'GET' });
    },

    post: async (endpoint: string, body: any) => {
        return fetchWithAuth(endpoint, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    },
    
    put: async (endpoint: string, body: any) => {
        return fetchWithAuth(endpoint, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    },

    delete: async (endpoint: string) => {
        return fetchWithAuth(endpoint, { method: 'DELETE' });
    }
};

// --- Mock Data Helpers ---
const uid = () => Math.random().toString(36).substr(2, 9);

const seedData = () => {
  if (localStorage.getItem('tmp_users')) return;
  // ... (Existing seed logic)
  const locId = uid();
  const wpId = uid();
  const userId = uid();
  const maintId = uid();
  const supId = uid();
  const typeId = uid();
  const stateId = uid();
  const techId = uid();

  const users: User[] = [
    { id: userId, name: 'Admin User', email: 'admin@tech.com', phone: '123456789', role: 'admin', isBlocked: false, assignedLocationIds: [], assignedWorkplaceIds: [], approvalLimits: {} },
    { id: maintId, name: 'Maint Guy', email: 'maint@tech.com', phone: '987654321', role: 'maintenance', isBlocked: false, assignedLocationIds: [locId], assignedWorkplaceIds: [wpId], approvalLimits: { [locId]: 100 } },
    { id: uid(), name: 'Operator Jane', email: 'op@tech.com', phone: '111222333', role: 'operator', isBlocked: false, assignedLocationIds: [locId], assignedWorkplaceIds: [wpId], approvalLimits: { [locId]: 0 } },
  ];
  
  const locations: Location[] = [{ id: locId, name: 'Hlavní Sklad', address: { street: 'Průmyslová', number: '1', zip: '81101', city: 'Bratislava', country: 'SK' }, isVisible: true }];
  const workplaces: Workplace[] = [{ id: wpId, locationId: locId, name: 'Hala A - Linka 1', description: 'Hlavní montážní linka', isVisible: true }];
  const suppliers: Supplier[] = [{ id: supId, name: 'TechCorp s.r.o.', address: { street: 'Technická', number: '5', zip: '01001', city: 'Žilina', country: 'SK' }, ic: '12345678', dic: 'CZ12345678', email: 'info@techcorp.cz', phone: '555123456', description: 'Generální dodavatel' }];
  const techTypes: TechType[] = [{ id: typeId, name: 'Lisovací stroj', description: 'Hydraulické lisy' }];
  const techStates: TechState[] = [{ id: stateId, name: 'V provozu', description: 'Plně funkční' }];
  const techs: Technology[] = [{ id: techId, workplaceId: wpId, supplierId: supId, typeId: typeId, stateId: stateId, name: 'Hydraulický Lis H500', serialNumber: 'SN-2023-001-X', description: 'Hlavní lis pro karoserie', installDate: '2023-01-15', weight: 5000, sharepointLink: '#', photoUrls: [], isVisible: true }];
  const settings: AppSettings = { enableOnlineTranslation: false };

  localStorage.setItem('tmp_users', JSON.stringify(users));
  localStorage.setItem('tmp_locations', JSON.stringify(locations));
  localStorage.setItem('tmp_workplaces', JSON.stringify(workplaces));
  localStorage.setItem('tmp_suppliers', JSON.stringify(suppliers));
  localStorage.setItem('tmp_supplier_contacts', JSON.stringify([]));
  localStorage.setItem('tmp_tech_types', JSON.stringify(techTypes));
  localStorage.setItem('tmp_tech_states', JSON.stringify(techStates));
  localStorage.setItem('tmp_technologies', JSON.stringify(techs));
  localStorage.setItem('tmp_maintenances', JSON.stringify([]));
  localStorage.setItem('tmp_maintenance_notes', JSON.stringify([]));
  localStorage.setItem('tmp_requests', JSON.stringify([]));
  localStorage.setItem('tmp_req_comments', JSON.stringify([]));
  localStorage.setItem('tmp_reset_tokens', JSON.stringify([]));
  localStorage.setItem('tmp_emails', JSON.stringify([]));
  localStorage.setItem('tmp_push_logs', JSON.stringify([]));
  localStorage.setItem('tmp_settings', JSON.stringify(settings));
};

// Generic Local DB Accessor
const db = {
  checkConnection: async (): Promise<boolean> => new Promise(r => setTimeout(() => r(true), 500)),
  get: <T>(key: string): T[] => JSON.parse(localStorage.getItem(key) || '[]'),
  set: <T>(key: string, data: T[]) => localStorage.setItem(key, JSON.stringify(data)),
  
  auth: {
      createResetToken: (email: string) => { /* ... */ return 'token'; }, // simplified
      validateToken: (t: string) => true,
      resetPassword: (t: string, p: string) => true,
      changePassword: (userId: string, oldP: string, newP: string) => {
          const users = db.get<User>('tmp_users');
          const userIndex = users.findIndex(u => u.id === userId);
          if (userIndex === -1) return false;
          
          const user = users[userIndex];
          const actualPass = user.password || 'password';
          
          if (oldP !== actualPass) return false;
          
          users[userIndex] = { ...user, password: newP };
          db.set('tmp_users', users);
          return true;
      }
  },
  settings: {
    get: (): AppSettings => JSON.parse(localStorage.getItem('tmp_settings') || '{"enableOnlineTranslation": false}'),
    save: (s: AppSettings) => localStorage.setItem('tmp_settings', JSON.stringify(s)),
  },
  emails: {
      list: () => db.get<Email>('tmp_emails'),
      retry: (ids: any) => { /* ... */ }
  },
  pushLogs: {
      list: () => db.get<PushLog>('tmp_push_logs'),
      add: (log: any) => { const l = db.pushLogs.list(); l.unshift({...log, id: uid(), created_at: new Date().toISOString()}); db.set('tmp_push_logs', l); },
      retry: (id: string|number) => { /* mock */ }
  },
  users: {
    list: () => db.get<User>('tmp_users'),
    add: (u: any) => { const l = db.users.list(); l.push({ ...u, id: uid() }); db.set('tmp_users', l); },
    update: (id: string, d: any) => { const l = db.users.list().map(x => x.id === id ? {...x, ...d} : x); db.set('tmp_users', l); }
  },
  locations: {
    list: () => db.get<Location>('tmp_locations'),
    add: (l: any) => { const list = db.locations.list(); list.push({ isVisible: true, ...l, id: uid() }); db.set('tmp_locations', list); },
    update: (id: string, d: any) => { db.set('tmp_locations', db.locations.list().map(x => x.id === id ? {...x, ...d} : x)); },
    delete: (id: string) => db.set('tmp_locations', db.locations.list().filter(x => x.id !== id))
  },
  workplaces: {
    list: () => db.get<Workplace>('tmp_workplaces'),
    byLoc: (lid: string) => db.workplaces.list().filter(w => w.locationId === lid),
    add: (w: any) => { const list = db.workplaces.list(); list.push({ isVisible: true, ...w, id: uid() }); db.set('tmp_workplaces', list); },
    update: (id: string, d: any) => { db.set('tmp_workplaces', db.workplaces.list().map(x => x.id === id ? {...x, ...d} : x)); },
    delete: (id: string) => db.set('tmp_workplaces', db.workplaces.list().filter(x => x.id !== id)),
    isUsed: (id: string) => db.technologies.list().some(t => t.workplaceId === id),
  },
  suppliers: {
    list: () => db.get<Supplier>('tmp_suppliers'),
    add: (s: any) => { const l = db.suppliers.list(); l.push({ ...s, id: uid() }); db.set('tmp_suppliers', l); },
    update: (id: string, d: any) => { db.set('tmp_suppliers', db.suppliers.list().map(x => x.id === id ? {...x, ...d} : x)); }
  },
  supplierContacts: {
    list: (sid: string) => db.get<any>('tmp_supplier_contacts').filter(c => c.supplierId === sid),
    add: (c: any) => { const l = db.get<any>('tmp_supplier_contacts'); l.push({...c, id: uid()}); db.set('tmp_supplier_contacts', l); },
    delete: (id: string) => { db.set('tmp_supplier_contacts', db.get<any>('tmp_supplier_contacts').filter(c => c.id !== id)); },
    update: (id: string, d: any) => { db.set('tmp_supplier_contacts', db.get<any>('tmp_supplier_contacts').map(c => c.id === id ? {...c, ...d} : c)); }
  },
  techTypes: {
    list: () => db.get<TechType>('tmp_tech_types'),
    add: (t: any) => { const l = db.techTypes.list(); l.push({ ...t, id: uid() }); db.set('tmp_tech_types', l); },
    update: (id: string, d: any) => { db.set('tmp_tech_types', db.techTypes.list().map(x => x.id === id ? {...x, ...d} : x)); },
    delete: (id: string) => db.set('tmp_tech_types', db.techTypes.list().filter(x => x.id !== id)),
    isUsed: (id: string) => db.technologies.list().some(t => t.typeId === id),
  },
  techStates: {
    list: () => db.get<TechState>('tmp_tech_states'),
    add: (t: any) => { const l = db.techStates.list(); l.push({ ...t, id: uid() }); db.set('tmp_tech_states', l); },
    update: (id: string, d: any) => { db.set('tmp_tech_states', db.techStates.list().map(x => x.id === id ? {...x, ...d} : x)); },
    delete: (id: string) => db.set('tmp_tech_states', db.techStates.list().filter(x => x.id !== id)),
    isUsed: (id: string) => db.technologies.list().some(t => t.stateId === id),
  },
  technologies: {
    list: () => db.get<Technology>('tmp_technologies'),
    add: (t: any) => { const l = db.technologies.list(); l.push({ isVisible: true, ...t, id: uid() }); db.set('tmp_technologies', l); },
    update: (id: string, d: any) => { db.set('tmp_technologies', db.technologies.list().map(x => x.id === id ? {...x, ...d} : x)); }
  },
  requests: {
    list: () => db.get<Request>('tmp_requests'),
    add: (r: any) => { const l = db.requests.list(); l.push({ ...r, id: uid(), createdDate: new Date().toISOString(), state: 'new', history: [] }); db.set('tmp_requests', l); },
    update: (id: string, d: any) => { db.set('tmp_requests', db.requests.list().map(x => x.id === id ? {...x, ...d} : x)); },
    updateState: (id: string, state: any, reason: string, userId: string, updates: any) => {
        const l = db.requests.list().map(r => r.id === id ? { ...r, state, cancellationReason: reason, ...updates } : r);
        db.set('tmp_requests', l);
    }
  },
  comments: {
    list: (rid: string) => db.get<any>('tmp_req_comments').filter(c => c.requestId === rid),
    add: (c: any) => { const l = db.get<any>('tmp_req_comments'); l.push({...c, id: uid(), date: new Date().toISOString()}); db.set('tmp_req_comments', l); }
  },
  maintenances: {
    list: () => db.get<Maintenance>('tmp_maintenances'),
    add: (m: any) => { const l = db.maintenances.list(); l.push({ ...m, id: uid() }); db.set('tmp_maintenances', l); },
    update: (id: string, d: any) => { db.set('tmp_maintenances', db.maintenances.list().map(x => x.id === id ? {...x, ...d} : x)); }
  },
  maintenanceNotes: {
    list: (mid: string) => db.get<any>('tmp_maintenance_notes').filter(n => n.maintenanceId === mid),
    add: (n: any) => { const l = db.get<any>('tmp_maintenance_notes'); l.push({...n, id: uid(), date: new Date().toISOString()}); db.set('tmp_maintenance_notes', l); }
  }
};

export { seedData, db, uid };
