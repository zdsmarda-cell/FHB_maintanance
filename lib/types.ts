
export type Role = 'admin' | 'maintenance' | 'operator';
export type Lang = 'cs' | 'en' | 'uk';

export interface Address {
  street: string;
  number: string;
  zip: string;
  city: string;
  country: 'SK'; // Enum, currently only Slovakia
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  isBlocked: boolean;
  assignedLocationIds: string[]; 
  assignedWorkplaceIds: string[]; 
}

export interface Location {
  id: string;
  name: string;
  address: Address;
  isVisible: boolean;
}

export interface Workplace {
  id: string;
  locationId: string;
  name: string;
  description: string;
  isVisible: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  address: Address;
  ic: string;
  dic: string;
  email: string;
  phone: string;
  description: string;
}

export interface SupplierContact {
  id: string;
  supplierId: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  description?: string;
}

export interface TechType {
  id: string;
  name: string;
  description: string;
}

export interface TechState {
  id: string;
  name: string;
  description: string;
}

export interface Technology {
  id: string;
  workplaceId: string;
  supplierId: string;
  typeId: string;
  stateId: string;
  name: string;
  description: string;
  installDate: string;
  weight: number;
  sharepointLink: string;
  photoUrls: string[];
  isVisible: boolean;
}

export type MaintenanceState = 'planned' | 'in_progress' | 'done';
export type MaintenanceType = 'planned' | 'operational';

export interface Maintenance {
  id: string;
  techId: string;
  type: MaintenanceType;
  title: string;
  supplierId: string;
  responsiblePersonIds: string[]; 
  planDateFrom: string;
  planDateTo: string;
  realDateFrom?: string;
  realDateTo?: string;
  planHours: number;
  description: string;
  state: MaintenanceState;
  finalReport?: string; 
}

export interface MaintenanceNote {
  id: string;
  maintenanceId: string;
  authorId: string;
  date: string;
  content: string;
  attachmentUrls: string[];
}

export type RequestState = 'new' | 'assigned' | 'solved' | 'cancelled';
export type RequestPriority = 'basic' | 'priority' | 'urgent';

export interface Request {
  id: string;
  techId: string;
  authorId: string; 
  solverId?: string; 
  createdDate: string;
  description: string;
  photoUrls: string[];
  state: RequestState;
  priority: RequestPriority;
  plannedResolutionDate?: string;
  cancellationReason?: string;
  stateChangeLog: { date: string, state: RequestState }[];
}

export interface RequestComment {
  id: string;
  requestId: string;
  authorId: string;
  date: string;
  content: string;
}

export interface AppSettings {
  enableOnlineTranslation: boolean;
}