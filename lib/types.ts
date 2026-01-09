
export type Role = 'admin' | 'maintenance' | 'operator';
export type Lang = 'cs' | 'en' | 'uk';

export interface Address {
  street: string;
  number: string;
  zip: string;
  city: string;
  country: string; // Changed from 'SK' literal to string to allow other countries
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  password?: string; // Added for password reset simulation
  isBlocked: boolean;
  assignedLocationIds: string[]; 
  assignedWorkplaceIds: string[]; 
  approvalLimits?: Record<string, number>; // LocationID -> Max Limit EUR
}

export interface PasswordResetToken {
  token: string;
  email: string;
  used: boolean;
  createdAt: string;
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
  serialNumber: string;
  description: string;
  installDate: string;
  weight: number;
  sharepointLink: string;
  photoUrls: string[];
  isVisible: boolean;
}

// Maintenance is now a Template
export interface Maintenance {
  id: string;
  techId: string;
  title: string;
  supplierId: string;
  responsiblePersonIds: string[]; 
  description: string;
  
  // Template Logic
  interval: number; // Days between maintenance
  allowedDays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  lastGeneratedDate?: string; // ISO Date of last created request
  createdAt?: string; // For calculation if lastGeneratedDate is null
  generatedRequestCount?: number; // Count of requests generated from this template
  
  type: 'planned' | 'operational'; // operational might be ad-hoc templates
  isActive: boolean; // Can disable template
}

export interface MaintenanceNote {
  id: string;
  maintenanceId: string;
  authorId: string;
  date: string;
  content: string;
}

export type RequestState = 'new' | 'assigned' | 'solved' | 'cancelled';
export type RequestPriority = 'basic' | 'priority' | 'urgent';

export interface RequestHistoryEntry {
    date: string;
    userId: string;
    action: 'created' | 'status_change' | 'approved' | 'rejected' | 'edited' | 'comment';
    oldValue?: string;
    newValue?: string;
    note?: string;
}

export interface Request {
  id: string;
  techId: string;
  maintenanceId?: string; // Link back to template if generated
  title: string; // Mandatory short title (max 20 chars)
  authorId: string; 
  solverId?: string; 
  assignedSupplierId?: string; // UUID or 'internal'
  createdDate: string;
  description: string;
  photoUrls: string[];
  state: RequestState;
  priority: RequestPriority;
  plannedResolutionDate?: string;
  cancellationReason?: string;
  estimatedCost?: number; // Cost in EUR
  estimatedTime?: number; // Estimated effort in minutes
  isApproved: boolean; // Approval Status Flag
  
  // New comprehensive history log replacing simple stateChangeLog
  history: RequestHistoryEntry[];
}

export interface RequestComment {
  id: string;
  requestId: string;
  authorId: string;
  date: string;
  content: string;
}

export interface Email {
    id: number | string;
    to_address: string;
    subject: string;
    body: string;
    attempts: number;
    sent_at: string | null;
    error: string | null;
    created_at: string;
}

export interface AppSettings {
  enableOnlineTranslation: boolean;
}