

export interface ContactPerson {
  name: string;
  title?: string; // CEO, Fondateur, Directeur, Gérant...
  email?: string; // Email spécifique à cette personne
}

export interface BusinessData {
  name: string;
  status: string; // Statut opérationnel (Ouvert, Fermé...)
  address: string;
  phone: string;
  phones?: string[]; // Liste de tous les téléphones trouvés
  hours: string; // Sera utilisé pour les détails supplémentaires si dispo
  sourceUri?: string;
  sourceTitle?: string;
  searchedTerm?: string; // Pour savoir quel terme de la liste a généré ce résultat
  
  // Nouveaux champs enrichis (Serper Places)
  website?: string;
  category?: string;
  // Note: rating, ratingCount, priceLevel supprimés car non utilisés
  
  // Champs LeadGen
  email?: string;
  emails?: string[]; // Liste de tous les emails trouvés
  socials?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
  };
  
  // Optimisation #1 : Extraction des décideurs
  decisionMakers?: ContactPerson[]; 

  // Optimisation #14 : Champ Personnalisé (Custom Column)
  customField?: string; // Ex: "Note", "Secrétaire", "Portier"...
}

export interface ColumnLabelMap {
  name: string;
  status: string;
  category: string;
  address: string;
  phone: string;
  hours: string;
  email: string;
  customField: string; // Nom de la colonne personnalisée
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  itemCount: number;
  autoExportFormats?: ('xlsx' | 'json' | 'html')[];
}

export type ScraperProvider = 'serper_eco'; // Simplification : On garde uniquement le mode performant
export type SerperStrategy = 'maps_basic' | 'web_basic' | 'maps_web_enrich';

// Provinces Canadiennes
export type CountryCode = 'qc' | 'on' | 'bc' | 'ab' | 'mb' | 'sk' | 'ns' | 'nb' | 'nl' | 'pe' | 'yt' | 'nt' | 'nu';

export interface ScraperState {
  isLoading: boolean;
  isBatchMode: boolean;
  progress: {
    current: number;
    total: number;
  };
  results: BusinessData[];
  error: string | null;
  rawText: string | null;
}

export interface SavedSession {
  query: string;
  currentIndex: number;
  results: BusinessData[];
  timestamp: number;
  config: {
    isPaidMode: boolean;
    serperKey: string;
    country: CountryCode;
    strategy: SerperStrategy;
  };
}

// Toast Notifications
export type ToastType = 'success' | 'error' | 'info';
export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}


// Nouveaux types pour l'API File System Access
export interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  values(): AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>;
}

export interface FileSystemFileHandle {
    kind: 'file';
    name: string;
    createWritable(): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    close(): Promise<void>;
}

export interface FileSystemHandlePermissionDescriptor {
    mode: 'read' | 'readwrite';
}

// Ajout pour corriger le problème @ts-ignore dans App.tsx
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}