
import { User, Location, Workplace, Supplier, SupplierContact, TechType, TechState, Technology, Maintenance, MaintenanceNote, Request, RequestComment, AppSettings, PasswordResetToken, RequestHistoryEntry, Email } from './types';

// Helper to generate IDs
const uid = () => Math.random().toString(36).substr(2, 9);

// Initial Seed Data
const seedData = () => {
  if (localStorage.getItem('tmp_users')) return;

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
  
  const locations: Location[] = [{ 
    id: locId, 
    name: 'Hlavní Sklad', 
    address: { street: 'Průmyslová', number: '1', zip: '81101', city: 'Bratislava', country: 'SK' },
    isVisible: true
  }];
  
  const workplaces: Workplace[] = [{ id: wpId, locationId: locId, name: 'Hala A - Linka 1', description: 'Hlavní montážní linka', isVisible: true }];
  
  const suppliers: Supplier[] = [{ 
    id: supId, 
    name: 'TechCorp s.r.o.', 
    address: { street: 'Technická', number: '5', zip: '01001', city: 'Žilina', country: 'SK' },
    ic: '12345678', dic: 'CZ12345678', email: 'info@techcorp.cz', phone: '555123456', description: 'Generální dodavatel' 
  }];
  
  const techTypes: TechType[] = [{ id: typeId, name: 'Lisovací stroj', description: 'Hydraulické lisy' }];
  const techStates: TechState[] = [{ id: stateId, name: 'V provozu', description: 'Plně funkční' }];
  
  const techs: Technology[] = [{
    id: techId, workplaceId: wpId, supplierId: supId, typeId: typeId, stateId: stateId,
    name: 'Hydraulický Lis H500', serialNumber: 'SN-2023-001-X', description: 'Hlavní lis pro karoserie',
    installDate: '2023-01-15', weight: 5000, sharepointLink: '#', photoUrls: [],
    isVisible: true
  }];

  const settings: AppSettings = { enableOnlineTranslation: false };

  // Seed Emails
  const emails: Email[] = [
      { id: 1, to_address: 'admin@tech.com', subject: 'Test Email 1', body: 'Test content', attempts: 0, sent_at: new Date().toISOString(), error: null, created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: 2, to_address: 'fail@tech.com', subject: 'Failed Email', body: 'Error content', attempts: 3, sent_at: null, error: 'Connection timeout', created_at: new Date(Date.now() - 43000000).toISOString() },
      { id: 3, to_address: 'maint@tech.com', subject: 'Pending Email', body: 'Pending content', attempts: 0, sent_at: null, error: null, created_at: new Date().toISOString() },
  ];

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
  localStorage.setItem('tmp_emails', JSON.stringify(emails));
  localStorage.setItem('tmp_settings', JSON.stringify(settings));
};

// Generic DB Accessor
const db = {
  // Simulate DB Connection check
  checkConnection: async (): Promise<boolean> => {
      return new Promise((resolve) => setTimeout(() => resolve(true), 500)); 
  },

  get: <T>(key: string): T[] => JSON.parse(localStorage.getItem(key) || '[]'),
  set: <T>(key: string, data: T[]) => localStorage.setItem(key, JSON.stringify(data)),
  
  settings: {
    get: (): AppSettings => JSON.parse(localStorage.getItem('tmp_settings') || '{"enableOnlineTranslation": false}'),
    save: (s: AppSettings) => localStorage.setItem('tmp_settings', JSON.stringify(s)),
  },

  auth: {
    createResetToken: (email: string): string | null => {
        const users = db.users.list();
        const user = users.find(u => u.email === email);
        if (!user) return null;

        const tokenString = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const tokens = db.get<PasswordResetToken>('tmp_reset_tokens');
        tokens.push({
            token: tokenString,
            email: email,
            used: false,
            createdAt: new Date().toISOString()
        });
        db.set('tmp_reset_tokens', tokens);
        return tokenString;
    },
    validateToken: (tokenString: string): boolean => {
        const tokens = db.get<PasswordResetToken>('tmp_reset_tokens');
        // Find token and check if NOT used
        const token = tokens.find(t => t.token === tokenString);
        if (!token) return false;
        if (token.used) return false;
        return true;
    },
    resetPassword: (tokenString: string, newPass: string): boolean => {
        const tokens = db.get<PasswordResetToken>('tmp_reset_tokens');
        const tokenIdx = tokens.findIndex(t => t.token === tokenString);
        
        if (tokenIdx === -1) return false;
        if (tokens[tokenIdx].used) return false;

        // 1. Mark token as used
        tokens[tokenIdx].used = true;
        db.set('tmp_reset_tokens', tokens);

        // 2. Update user password (Simulated)
        const users = db.users.list();
        const userIdx = users.findIndex(u => u.email === tokens[tokenIdx].email);
        if (userIdx !== -1) {
            users[userIdx].password = newPass;
            db.set('tmp_users', users);
            return true;
        }
        return false;
    }
  },

  emails: {
      list: () => db.get<Email>('tmp_emails').sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      retry: (ids: (string|number)[]) => {
          const list = db.get<Email>('tmp_emails').map(e => {
              if (ids.includes(e.id)) {
                  return { ...e, sent_at: null, error: null, attempts: 0 };
              }
              return e;
          });
          db.set('tmp_emails', list);
      }
  },

  users: {
    list: () => db.get<User>('tmp_users'),
    add: (u: Omit<User, 'id'>) => { const list = db.users.list(); list.push({ ...u, id: uid() }); db.set('tmp_users', list); },
    update: (id: string, diff: Partial<User>) => {
        const list = db.users.list().map(u => u.id === id ? { ...u, ...diff } : u);
        db.set('tmp_users', list);
    }
  },
  locations: {
    list: () => db.get<Location>('tmp_locations'),
    add: (l: Omit<Location, 'id'>) => { const list = db.locations.list(); list.push({ isVisible: true, ...l, id: uid() }); db.set('tmp_locations', list); },
    update: (id: string, diff: Partial<Location>) => {
        const list = db.locations.list().map(l => l.id === id ? { ...l, ...diff } : l);
        db.set('tmp_locations', list);
    },
    delete: (id: string) => { db.set('tmp_locations', db.locations.list().filter(x => x.id !== id)); }
  },
  workplaces: {
    list: () => db.get<Workplace>('tmp_workplaces'),
    byLoc: (lid: string) => db.workplaces.list().filter(w => w.locationId === lid),
    add: (w: Omit<Workplace, 'id'>) => { const list = db.workplaces.list(); list.push({ isVisible: true, ...w, id: uid() }); db.set('tmp_workplaces', list); },
    update: (id: string, diff: Partial<Workplace>) => {
        const list = db.workplaces.list().map(w => w.id === id ? { ...w, ...diff } : w);
        db.set('tmp_workplaces', list);
    },
    delete: (id: string) => { db.set('tmp_workplaces', db.workplaces.list().filter(x => x.id !== id)); },
    isUsed: (id: string) => db.technologies.list().some(t => t.workplaceId === id),
  },
  suppliers: {
    list: () => db.get<Supplier>('tmp_suppliers'),
    add: (s: Omit<Supplier, 'id'>) => { const list = db.suppliers.list(); list.push({ ...s, id: uid() }); db.set('tmp_suppliers', list); },
    update: (id: string, diff: Partial<Supplier>) => {
        const list = db.suppliers.list().map(s => s.id === id ? { ...s, ...diff } : s);
        db.set('tmp_suppliers', list);
    },
    delete: (id: string) => { db.set('tmp_suppliers', db.suppliers.list().filter(x => x.id !== id)); }
  },
  supplierContacts: {
    list: (supplierId: string) => db.get<SupplierContact>('tmp_supplier_contacts').filter(c => c.supplierId === supplierId),
    add: (c: Omit<SupplierContact, 'id'>) => { const list = db.get<SupplierContact>('tmp_supplier_contacts'); list.push({...c, id: uid()}); db.set('tmp_supplier_contacts', list); },
    delete: (id: string) => { db.set('tmp_supplier_contacts', db.get<SupplierContact>('tmp_supplier_contacts').filter(c => c.id !== id)); },
    update: (id: string, diff: Partial<SupplierContact>) => {
        const list = db.get<SupplierContact>('tmp_supplier_contacts').map(c => c.id === id ? {...c, ...diff} : c);
        db.set('tmp_supplier_contacts', list);
    }
  },
  techTypes: {
    list: () => db.get<TechType>('tmp_tech_types'),
    add: (t: Omit<TechType, 'id'>) => { const list = db.techTypes.list(); list.push({ ...t, id: uid() }); db.set('tmp_tech_types', list); },
    update: (id: string, diff: Partial<TechType>) => {
        const list = db.techTypes.list().map(t => t.id === id ? { ...t, ...diff } : t);
        db.set('tmp_tech_types', list);
    },
    delete: (id: string) => { db.set('tmp_tech_types', db.techTypes.list().filter(x => x.id !== id)); },
    isUsed: (id: string) => db.technologies.list().some(t => t.typeId === id),
  },
  techStates: {
    list: () => db.get<TechState>('tmp_tech_states'),
    add: (t: Omit<TechState, 'id'>) => { const list = db.techStates.list(); list.push({ ...t, id: uid() }); db.set('tmp_tech_states', list); },
    update: (id: string, diff: Partial<TechState>) => {
        const list = db.techStates.list().map(t => t.id === id ? { ...t, ...diff } : t);
        db.set('tmp_tech_states', list);
    },
    delete: (id: string) => { db.set('tmp_tech_states', db.techStates.list().filter(x => x.id !== id)); },
    isUsed: (id: string) => db.technologies.list().some(t => t.stateId === id),
  },
  technologies: {
    list: () => db.get<Technology>('tmp_technologies'),
    add: (t: Omit<Technology, 'id'>) => { const list = db.technologies.list(); list.push({ isVisible: true, ...t, id: uid() }); db.set('tmp_technologies', list); },
    update: (id: string, diff: Partial<Technology>) => {
      const list = db.technologies.list().map(t => t.id === id ? { ...t, ...diff } : t);
      db.set('tmp_technologies', list);
    }
  },
  requests: {
    list: () => db.get<Request>('tmp_requests'),
    add: (r: Omit<Request, 'id' | 'state' | 'history' | 'createdDate'> & { state?: Request['state'] }) => {
      const list = db.requests.list();
      const newState = r.state || 'new';
      
      const cost = Number(r.estimatedCost || 0);
      const time = r.estimatedTime ? Number(r.estimatedTime) : undefined;
      // Auto-approve if cost is 0
      const isApproved = cost === 0 ? true : (r.isApproved ?? false);

      const createdDate = new Date().toISOString();
      const assignedSupplierId = r.assignedSupplierId || 'internal';
      
      const newHistory: RequestHistoryEntry = {
          date: createdDate,
          userId: r.authorId,
          action: 'created',
          note: 'Požadavek vytvořen'
      };

      list.push({ 
          ...r, 
          id: uid(), 
          createdDate: createdDate,
          state: newState, 
          assignedSupplierId,
          estimatedCost: cost,
          estimatedTime: time,
          isApproved: isApproved,
          history: [newHistory] 
      } as Request);
      db.set('tmp_requests', list);
    },
    update: (id: string, diff: Partial<Request>) => {
        const list = db.requests.list().map(r => {
            if (r.id === id) {
                const merged = { ...r, ...diff };
                
                // Logic: If price changes
                // 1. New price is 0 -> Auto-approve
                // 2. New price > 0 AND price changed -> Revoke approval (isApproved = false)
                
                const oldCost = r.estimatedCost || 0;
                const newCost = diff.estimatedCost !== undefined ? Number(diff.estimatedCost) : oldCost;

                if (diff.estimatedCost !== undefined && newCost !== oldCost) {
                    if (newCost === 0) {
                        merged.isApproved = true;
                    } else {
                        // Price changed to a non-zero value, revoke approval
                        merged.isApproved = false;
                    }
                }
                
                return merged;
            }
            return r;
        });
        db.set('tmp_requests', list);
    },
    updateState: (id: string, state: Request['state'], reason: string | undefined, userId: string | undefined, updates?: Partial<Request>) => {
      const list = db.requests.list().map(r => {
        if (r.id !== id) return r;
        
        const newHistory = [...(r.history || [])];
        
        // Log State Change
        if (r.state !== state) {
            newHistory.push({
                date: new Date().toISOString(),
                userId: userId || 'system',
                action: 'status_change',
                oldValue: r.state,
                newValue: state,
                note: reason
            });
        }
        
        // Log Approval Change (if triggered via updates)
        if (updates && updates.isApproved !== undefined && updates.isApproved !== r.isApproved) {
            newHistory.push({
                date: new Date().toISOString(),
                userId: userId || 'system',
                action: updates.isApproved ? 'approved' : 'rejected'
            });
        }

        // Log generic edit if description or cost changes significantly
        if (updates && (updates.description || updates.estimatedCost || updates.title)) {
            // simple check, could be more granular
             newHistory.push({
                date: new Date().toISOString(),
                userId: userId || 'system',
                action: 'edited'
            });
        }

        return { 
          ...r, 
          state, 
          cancellationReason: reason, 
          solverId: updates?.solverId || r.solverId, // allow updates to override solver
          history: newHistory,
          ...updates 
        };
      });
      db.set('tmp_requests', list);
    }
  },
  comments: {
    list: (reqId: string) => db.get<RequestComment>('tmp_req_comments').filter(c => c.requestId === reqId),
    add: (c: Omit<RequestComment, 'id' | 'date'>) => {
      const list = db.get<RequestComment>('tmp_req_comments');
      list.push({ ...c, id: uid(), date: new Date().toISOString() });
      db.set('tmp_req_comments', list);
    }
  },
  maintenances: {
    list: () => db.get<Maintenance>('tmp_maintenances'),
    add: (m: Omit<Maintenance, 'id'>) => {
       const list = db.maintenances.list();
       list.push({ ...m, id: uid() });
       db.set('tmp_maintenances', list);
    },
    update: (id: string, diff: Partial<Maintenance>) => {
        const list = db.maintenances.list().map(m => m.id === id ? { ...m, ...diff } : m);
        db.set('tmp_maintenances', list);
    }
  },
  maintenanceNotes: {
    list: (maintId: string) => db.get<MaintenanceNote>('tmp_maintenance_notes').filter(n => n.maintenanceId === maintId),
    add: (n: Omit<MaintenanceNote, 'id' | 'date'>) => {
        const list = db.get<MaintenanceNote>('tmp_maintenance_notes');
        list.push({ ...n, id: uid(), date: new Date().toISOString() });
        db.set('tmp_maintenance_notes', list);
    }
  }
};

export { seedData, db, uid };
