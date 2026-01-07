
import { User, Location, Workplace, Supplier, SupplierContact, TechType, TechState, Technology, Maintenance, MaintenanceNote, Request, RequestComment, AppSettings } from './types';

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
    { id: userId, name: 'Admin User', email: 'admin@tech.com', phone: '123456789', role: 'admin', isBlocked: false, assignedLocationIds: [], assignedWorkplaceIds: [] },
    { id: maintId, name: 'Maint Guy', email: 'maint@tech.com', phone: '987654321', role: 'maintenance', isBlocked: false, assignedLocationIds: [locId], assignedWorkplaceIds: [wpId] },
    { id: uid(), name: 'Operator Jane', email: 'op@tech.com', phone: '111222333', role: 'operator', isBlocked: false, assignedLocationIds: [locId], assignedWorkplaceIds: [wpId] },
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
    name: 'Hydraulický Lis H500', description: 'Hlavní lis pro karoserie',
    installDate: '2023-01-15', weight: 5000, sharepointLink: '#', photoUrls: [],
    isVisible: true
  }];

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
  localStorage.setItem('tmp_settings', JSON.stringify(settings));
};

// Generic DB Accessor
const db = {
  // Simulate DB Connection check
  checkConnection: async (): Promise<boolean> => {
      // Logic to check if DB is reachable. 
      // In this localstorage mock, we always return true unless forced false for testing maintenance page.
      return new Promise((resolve) => setTimeout(() => resolve(true), 500)); 
  },

  get: <T>(key: string): T[] => JSON.parse(localStorage.getItem(key) || '[]'),
  set: <T>(key: string, data: T[]) => localStorage.setItem(key, JSON.stringify(data)),
  
  settings: {
    get: (): AppSettings => JSON.parse(localStorage.getItem('tmp_settings') || '{"enableOnlineTranslation": false}'),
    save: (s: AppSettings) => localStorage.setItem('tmp_settings', JSON.stringify(s)),
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
    add: (r: Omit<Request, 'id' | 'state' | 'stateChangeLog'>) => {
      const list = db.requests.list();
      list.push({ ...r, id: uid(), state: 'new', stateChangeLog: [{ date: new Date().toISOString(), state: 'new' }] });
      db.set('tmp_requests', list);
    },
    updateState: (id: string, state: Request['state'], reason?: string, solverId?: string, updates?: Partial<Request>) => {
      const list = db.requests.list().map(r => {
        if (r.id !== id) return r;
        const log = [...r.stateChangeLog, { date: new Date().toISOString(), state }];
        return { 
          ...r, 
          state, 
          cancellationReason: reason, 
          solverId: solverId || r.solverId, 
          stateChangeLog: log,
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
