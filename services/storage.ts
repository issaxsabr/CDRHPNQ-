
import { getDB } from './database';
import { BusinessData, Project } from '../types';
import { securePack, secureUnpack } from './security';
import { SmartCache } from './smartCache';

const LOCAL_DIR_HANDLE_PREFIX = 'mapscraper_local_handle_';

// --- SERVICE DE SYSTÈME DE FICHIERS (ADAPTÉ POUR IDB) ---
export const fileSystemService = {
    saveHandle: async (projectId: string, handle: any) => {
        const db = await getDB();
        await db.put('keyval', handle, `${LOCAL_DIR_HANDLE_PREFIX}${projectId}`);
    },
    getHandle: async (projectId: string) => {
        const db = await getDB();
        return db.get('keyval', `${LOCAL_DIR_HANDLE_PREFIX}${projectId}`);
    },
    clearHandle: async (projectId: string) => {
        const db = await getDB();
        await db.delete('keyval', `${LOCAL_DIR_HANDLE_PREFIX}${projectId}`);
    }
};

// --- SERVICE DE LISTE NOIRE (INCHANGÉ) ---
const BLACKLIST_DOMAINS = [
    'pagesjaunes.fr', 'yellowpages.ca', 'yelp.', 'tripadvisor.', 
    'societe.com', 'linkedin.com', 'facebook.com', 'instagram.com',
    'mairie.net'
];
export const blacklistService = {
    isBlacklisted: (item: BusinessData): { isBlacklisted: boolean; reason?: string } => {
        if (item.website) {
            try {
                const hostname = new URL(item.website).hostname.toLowerCase();
                for (const domain of BLACKLIST_DOMAINS) {
                    if (hostname.endsWith(domain) || hostname.includes(domain)) {
                        return { isBlacklisted: true, reason: `Domaine ignoré (Annuaire/Social): "${domain}"` };
                    }
                }
            } catch (e) { /* URL invalide, ignorer */ }
        }
        return { isBlacklisted: false };
    }
};

// --- SERVICE D'EMPREINTE (POUR LA DÉDUPLICATION) ---
export const fingerprintService = {
    generate: (item: BusinessData): string => {
        if (item.website && !item.website.includes('google') && !item.website.includes('facebook')) {
            return `WEB:${item.website.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
        }
        const simpleAddress = (item.address || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
        const simpleName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return `GEO:${simpleName}|${simpleAddress}`;
    }
};

// --- SERVICE DE PROJETS (RECONSTRUIT SUR IDB) ---
export const projectService = {
  getAllProjects: async (): Promise<Project[]> => {
    const db = await getDB();
    const projects = await db.getAll('projects');
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  createProject: async (name: string, autoExportFormats?: ('xlsx' | 'json' | 'html')[]): Promise<Project> => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      itemCount: 0,
      autoExportFormats
    };
    const db = await getDB();
    await db.add('projects', newProject);
    return newProject;
  },

  deleteProject: async (id: string): Promise<void> => {
    const db = await getDB();
    await db.delete('projects', id);
    
    // Supprimer les entreprises associées
    let cursor = await db.transaction('businesses').store.index('by-project').openCursor(id);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    
    await fileSystemService.clearHandle(id);
  },

  addResultsToProject: async (projectId: string, newResults: BusinessData[]): Promise<{ status: 'added' | 'duplicate' | 'error' | 'blacklisted', item: BusinessData, duplicateProjectId?: string }[]> => {
    const db = await getDB();
    const tx = db.transaction(['businesses', 'projects'], 'readwrite');
    const businessStore = tx.objectStore('businesses');
    const projectStore = tx.objectStore('projects');
    
    const statusResults: { status: 'added' | 'duplicate' | 'error' | 'blacklisted', item: BusinessData, duplicateProjectId?: string }[] = [];
    let addedCount = 0;

    for (const item of newResults) {
        const blCheck = blacklistService.isBlacklisted(item);
        if (blCheck.isBlacklisted) {
            statusResults.push({ status: 'blacklisted', item: { ...item, status: `Ignoré: ${blCheck.reason}` } });
            continue;
        }

        const fingerprint = fingerprintService.generate(item);
        const id = item.id || crypto.randomUUID();
        
        try {
            const secureData = await securePack({ ...item, id, projectId });
            const record = {
                id, projectId, fingerprint,
                name: item.name,
                email: item.email,
                status: item.status,
                category: item.category,
                secureData
            };
            await businessStore.add(record);
            addedCount++;
            statusResults.push({ status: 'added', item });
        } catch (e: any) {
            if (e.name === 'ConstraintError') {
                const existing = await businessStore.index('by-fingerprint').get(fingerprint);
                statusResults.push({ status: 'duplicate', item, duplicateProjectId: existing?.projectId });
            } else {
                console.error("Erreur d'ajout à la DB:", e);
                statusResults.push({ status: 'error', item });
            }
        }
    }
    
    // Mettre à jour le compteur du projet
    if (addedCount > 0) {
        const project = await projectStore.get(projectId);
        if (project) {
            project.itemCount += addedCount;
            project.updatedAt = Date.now();
            await projectStore.put(project);
        }
    }

    await tx.done;
    return statusResults;
  },

  updateProjectItem: async (projectId: string, updatedItem: BusinessData): Promise<void> => {
      if (!updatedItem.id) return;
      
      const db = await getDB();
      const secureData = await securePack(updatedItem);
      const record = {
        id: updatedItem.id,
        projectId,
        fingerprint: fingerprintService.generate(updatedItem),
        name: updatedItem.name,
        email: updatedItem.email,
        status: updatedItem.status,
        category: updatedItem.category,
        secureData
      };

      // Utiliser PUT pour écraser l'enregistrement existant
      await db.put('businesses', record);
  },
  
  getProjectContent: async (projectId: string): Promise<BusinessData[]> => {
    const db = await getDB();
    const records = await db.getAllFromIndex('businesses', 'by-project', projectId);
    return Promise.all(records.map(r => secureUnpack(r.secureData)));
  },
  
  getProjectName: async (projectId: string): Promise<string> => {
    const db = await getDB();
    const project = await db.get('projects', projectId);
    return project ? project.name : 'Inconnu';
  }
};

// --- SERVICE DE CACHE (ADAPTÉ POUR IDB) ---
export const cacheService = new SmartCache();
